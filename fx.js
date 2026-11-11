// ============================================================
// SalesFlow — FOKUS
// Ny startsida (Idag + Månad), ny meny, nytt registreringsark och "Mer".
// All data och logik kommer från script.js; den här filen ritar bara.
// Den gamla startsidan och den gamla menyn finns kvar dolda så att
// befintlig kod som skriver till dem inte går sönder.
// ============================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const kr = n => Math.round(n).toLocaleString('sv-SE');
  const kk = n => { const v = Math.round(n / 100) / 10; return v.toLocaleString('sv-SE', { minimumFractionDigits: v >= 100 ? 0 : 1, maximumFractionDigits: v >= 100 ? 0 : 1 }) + 'k'; };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const DAG = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  const KORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  const stor = s => s.charAt(0).toUpperCase() + s.slice(1);
  const keyOf = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const dateOf = k => { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const ic = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}">${n}</span>`;
  const surr = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };

  // ---------- skelett ----------
  function bygg() {
    if ($('fx')) return;
    const el = document.createElement('main');
    el.id = 'fx';
    el.innerHTML = `
      <header class="fx-top">
        <button class="fx-date" id="fx-date" aria-label="Gå till idag"></button>
        <div class="fx-acts">
          <button class="fx-ib" onclick="openCoachModalMain()" aria-label="Säljcoach">${ic('auto_awesome')}</button>
          <button class="fx-ib" onclick="openBudgetModal()" aria-label="Inställningar">${ic('settings')}</button>
        </div>
      </header>
      <div class="fx-scroll" id="fx-scroll"><div id="fx-view"></div></div>
      <button class="fx-cta" id="fx-cta">${ic('add')}<span class="fx-cta-t">Registrera försäljning</span></button>
      <nav class="fx-nav" id="fx-nav" aria-label="Meny">
        <button data-n="idag">${ic('today')}<span>Idag</span></button>
        <button data-n="manad">${ic('bar_chart')}<span>Månad</span></button>
        <button data-n="kal">${ic('calendar_month')}<span>Kalender</span></button>
        <button data-n="lon">${ic('payments')}<span>Lön</span></button>
        <button data-n="mer">${ic('more_horiz')}<span>Mer</span></button>
      </nav>`;
    document.body.appendChild(el);
    document.body.appendChild($('fx-nav'));

    // registreringsark
    const reg = document.createElement('div');
    reg.id = 'fx-reg'; reg.className = 'fx-sheet';
    reg.innerHTML = `<div class="fx-panel">
      <div class="fx-grab"></div>
      <div class="fx-ph"><b>Registrera</b><span id="fx-reg-dag"></span></div>
      <div class="fx-tabs" id="fx-tabs"><button data-t="salj" class="on">Försäljning</button><button data-t="status">Status</button><button data-t="mer">Verktyg</button></div>
      <div class="fx-pane" data-p="salj">
        <div class="fx-amt"><b id="fx-amt">0</b><small>kr</small></div>
        <div class="fx-hint" id="fx-hint"></div>
        <div class="fx-qk">${[500, 1000, 2500, 5000].map(v => `<button data-q="${v}">+${kr(v)}</button>`).join('')}</div>
        <div class="fx-keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(x => `<button data-k="${x}">${x === '⌫' ? ic('backspace') : x}</button>`).join('')}</div>
        <button class="fx-save" data-a="spara">Spara</button>
      </div>
      <div class="fx-pane" data-p="status" hidden>
        <p class="fx-note">Vad gäller dagen?</p>
        <div class="fx-stat" id="fx-stat"></div>
      </div>
      <div class="fx-pane" data-p="mer" hidden>
        <div class="fx-list">
          <button data-a="gm">${ic('document_scanner')}<div><b>Skanna GM-rapport</b><small>Läs in dagens försäljning från en bild</small></div></button>
          <button data-a="boost">${ic('bolt')}<div><b>Höj ribban</b><small>Lägg en boost ovanpå dagsmålet</small></div></button>
          <button data-a="eval">${ic('rate_review')}<div><b>Utvärdera passet</b><small>Hur gick dagen?</small></div></button>
          <button data-a="fokus">${ic('center_focus_strong')}<div><b>Fokusläge</b><small>Bara dagen, i helskärm</small></div></button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(reg);

    // mer-ark
    const mer = document.createElement('div');
    mer.id = 'fx-mer'; mer.className = 'fx-sheet';
    mer.innerHTML = `<div class="fx-panel">
      <div class="fx-grab"></div>
      <div class="fx-ph"><b>Mer</b></div>
      <div class="fx-list">
        <button data-m="franvaro">${ic('event_busy')}<div><b>Frånvaro</b><small id="fx-mer-fv">Semester, sjuk, VAB och föräldraledigt</small></div>${ic('chevron_right', 'fx-chev')}</button>
        <button data-m="noter">${ic('sticky_note_2')}<div><b>Anteckningar</b><small id="fx-mer-nt">Kunder, ordrar och uppföljning</small></div>${ic('chevron_right', 'fx-chev')}</button>
        <button data-m="summering">${ic('insights')}<div><b>Sammanfattning</b><small>Bästa dagar, streak och frånvaro</small></div>${ic('chevron_right', 'fx-chev')}</button>
        <button data-m="coach">${ic('auto_awesome')}<div><b>Säljcoach</b><small>Analysera samtal</small></div>${ic('chevron_right', 'fx-chev')}</button>
        <button data-m="fokus">${ic('center_focus_strong')}<div><b>Fokusläge</b><small>Bara dagen, i helskärm</small></div>${ic('chevron_right', 'fx-chev')}</button>
        <button data-m="inst">${ic('settings')}<div><b>Inställningar</b><small>Mål, tema, synk och notiser</small></div>${ic('chevron_right', 'fx-chev')}</button>
      </div>
    </div>`;
    document.body.appendChild(mer);

    // händelser
    $('fx-date').addEventListener('click', () => { gaIdag(); });
    $('fx-cta').addEventListener('click', () => oppnaReg('salj'));
    $('fx-nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { surr(); navigera(b.dataset.n); } });
    [reg, mer].forEach(s => s.addEventListener('click', e => { if (e.target === s) stangArk(s); }));
    reg.addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (t) return visaFlik(t.dataset.t);
      const k = e.target.closest('[data-k]'); if (k) { surr(); return tryck(k.dataset.k); }
      const q = e.target.closest('[data-q]'); if (q) { surr(); padV = String((+padV || 0) + (+q.dataset.q)); padNy = false; return visaPad(); }
      const s = e.target.closest('[data-s]'); if (s) { stangArk(reg); uiStatus(s.dataset.s); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      const x = a.dataset.a;
      if (x === 'spara') return sparaPad();
      stangArk(reg);
      if (x === 'gm') $('gm-camera-input').click();
      else if (x === 'boost') uiBoost();
      else if (x === 'eval') uiEval();
      else if (x === 'fokus') openFocusMode2();
    });
    mer.addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      stangArk(mer); const m = b.dataset.m;
      setTimeout(() => {
        if (m === 'franvaro') navTo('absence');
        else if (m === 'noter') navTo('notes');
        else if (m === 'summering') openSummaryModal('month');
        else if (m === 'coach') openCoachModalMain();
        else if (m === 'fokus') openFocusMode2();
        else if (m === 'inst') openBudgetModal();
        aktiv();
      }, 120);
    });
    // svep på veckoraden byter vecka, svep på sidan byter dag/månad
    let sx = 0, sy = 0, start = null;
    const view = $('fx-scroll');
    view.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; start = e.target; }, { passive: true });
    view.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (start && start.closest && start.closest('.fx-week')) return flyttaDag(dx < 0 ? 7 : -7);
      if (hemLage === 'dag') flyttaDag(dx < 0 ? 1 : -1); else flyttaManad(dx < 0 ? 1 : -1);
    }, { passive: true });
    // menyn följer vilken sida som är öppen
    const obs = new MutationObserver(aktiv);
    ['sheet-month', 'sheet-absence', 'sheet-lon', 'notes-modal'].forEach(id => { const n = $(id); if (n) obs.observe(n, { attributes: true, attributeFilter: ['class'] }); });
  }

  // ---------- navigering ----------
  function stangSidor() {
    if (typeof window.closeActiveSheet === 'function' && document.querySelector('.sf-sheet.is-open')) window.closeActiveSheet();
    const nm = $('notes-modal'); if (nm && !nm.classList.contains('hidden') && typeof closeNotesModal === 'function') closeNotesModal();
  }
  function navigera(n) {
    if (n === 'idag') { stangSidor(); gaIdag(); $('fx-scroll').scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (n === 'manad') { stangSidor(); if (hemLage !== 'manad') setHemLage('manad'); else schema(); $('fx-scroll').scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (n === 'kal') { if (!$('sheet-month').classList.contains('is-open')) navTo('month'); }
    else if (n === 'lon') { if (!$('sheet-lon').classList.contains('is-open')) navTo('lon'); }
    else if (n === 'mer') { oppnaArk($('fx-mer')); }
    aktiv();
  }
  function aktiv() {
    let n = hemLage === 'dag' ? 'idag' : 'manad';
    if ($('sheet-month') && $('sheet-month').classList.contains('is-open')) n = 'kal';
    else if ($('sheet-lon') && $('sheet-lon').classList.contains('is-open')) n = 'lon';
    else if (($('sheet-absence') && $('sheet-absence').classList.contains('is-open')) || ($('notes-modal') && !$('notes-modal').classList.contains('hidden'))) n = 'mer';
    document.querySelectorAll('#fx-nav button').forEach(b => b.classList.toggle('on', b.dataset.n === n));
    document.body.classList.toggle('fx-sida', n === 'kal' || n === 'lon' || n === 'mer');
  }
  function gaIdag() { const k = keyOf(realToday); goToDayDash(k); setHemLage('dag'); }
  function flyttaDag(steg) { const d = dateOf(hemDag()); d.setDate(d.getDate() + steg); goToDayDash(keyOf(d)); if (hemLage !== 'dag') setHemLage('dag'); }
  function flyttaManad(steg) {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth() + steg, 1);
    const idag = new Date(realToday);
    const k = (d.getFullYear() === idag.getFullYear() && d.getMonth() === idag.getMonth()) ? keyOf(idag) : keyOf(d);
    goToDayDash(k); setHemLage('manad');
  }
  window.fxMan = flyttaManad;
  window.fxDag = k => { goToDayDash(k); setHemLage('dag'); };

  // ---------- beräkningar ----------
  function manad() {
    const cy = viewDate.getFullYear(), cm = viewDate.getMonth() + 1, dim = new Date(cy, cm, 0).getDate();
    const b = getBudgetForMonth(cy, cm);
    let tS = 0, dP = 0, tP = 0, rW = 0, sAvsl = 0, dAvsl = 0, sIdag = 0, idagPass = false, frv = 0, best = null; const dagar = [];
    for (let d = 1; d <= dim; d++) {
      const k = `${cy}-${cm}-${d}`, o = db.d[k] || { s: 0 }, q = db.q[k] || {}, dObj = new Date(cy, cm - 1, d), s = o.s || 0;
      const arIdag = dObj.getTime() === realToday.getTime();
      tS += s; if (s > 0) dP++;
      if (o.abs) frv++;
      if (s > 0 && (!best || s > best.s)) best = { d, s };
      if (dObj < realToday) { sAvsl += s; if (s > 0) dAvsl++; } else if (arIdag) sIdag = s;
      if ((q.start || s > 0) && !isMeetingDay(k)) { tP++; if (dObj >= realToday) rW++; if (arIdag) idagPass = true; }
      dagar.push({ d, k, s, mal: dayTarget(k), abs: o.abs, fram: dObj >= realToday, idag: arIdag, dow: dObj.getDay() });
    }
    let avg = dAvsl ? sAvsl / dAvsl : 0;
    if (!avg) { const f = new Date(cy, cm - 2, 1); avg = snittPerPass(f.getFullYear(), f.getMonth() + 1); }
    if (!avg) avg = dP ? tS / dP : 0;
    const prognos = sAvsl + (idagPass ? Math.max(sIdag, avg) : sIdag) + avg * Math.max(0, rW - (idagPass ? 1 : 0));
    const ratio = getMonthlyBonusReliefRatio(cy, cm) || 0, lattat = dashRelief && ratio > 0;
    const mal = lattat ? Math.round(b * (1 - ratio)) : b;
    let steg = [];
    try { steg = (lattat ? lonAdjustedTiers(cy, cm).tiers : lonTiersForMonth(cm)).filter(t => +t.min > 0).sort((a, c) => a.min - c.min); } catch (e) {}
    const nu = steg.filter(t => tS >= t.min).pop() || null, nasta = steg.find(t => tS < t.min) || null;
    return { cy, cm, dim, salt: tS, mal, prognos, rW, tP, ratio, lattat, steg, dagar, avg, frv, best, nu, nasta,
      krav: tS >= mal && mal > 0 ? 0 : (rW > 0 ? (mal - tS) / rW : null),
      kravNasta: nasta && rW > 0 ? (nasta.min - tS) / rW : null };
  }
  // bästa veckodag senaste 90 dagarna
  function bastaVeckodag() {
    const sum = Array(7).fill(0), n = Array(7).fill(0), d = new Date(realToday);
    for (let i = 0; i < 90; i++) { d.setDate(d.getDate() - 1); const s = (db.d[keyOf(d)] || {}).s || 0; if (s > 0) { sum[d.getDay()] += s; n[d.getDay()]++; } }
    let bi = -1, bv = 0; for (let i = 0; i < 7; i++) if (n[i] >= 2 && sum[i] / n[i] > bv) { bv = sum[i] / n[i]; bi = i; }
    return bi < 0 ? null : { dag: DAG[bi].toLowerCase(), snitt: bv };
  }
  // lönen (läser lönevyns egen beräkning utan att spara eller synka något)
  let lonCache = null, lonTid = 0;
  function lon() {
    if (lonCache && Date.now() - lonTid < 8000) return lonCache;
    try {
      if (typeof lonLoad === 'function' && !lonCfg) lonLoad();
      const oppen = $('sheet-lon') && $('sheet-lon').classList.contains('is-open');
      if (!oppen && typeof lonDefaultWorkDate === 'function') { lonViewDate = lonDefaultWorkDate(); lonFillFields(); lonRecalc(); }
      const net = ($('lon-net') || {}).textContent || '';
      const lbl = (($('lon-payout-lbl') || {}).textContent || '').toLowerCase();
      lonCache = { net: net.replace(/\s*kr$/, ''), lbl: lbl ? stor(lbl) : '' }; lonTid = Date.now();
    } catch (e) { lonCache = { net: '—', lbl: '' }; }
    return lonCache;
  }

  // ---------- räkna upp tal ----------
  let forra = null;
  function rakna(el, till) {
    if (!el) return;
    const fran = forra == null ? till * 0.6 : forra; forra = till;
    if (fran === till || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = kr(till); return; }
    const t0 = performance.now();
    (function s(t) { const f = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - f, 3); el.textContent = kr(fran + (till - fran) * e); if (f < 1) requestAnimationFrame(s); })(t0);
  }

  // ---------- rita ----------
  let vy0 = '';
  function rita() {
    if (!$('fx') || typeof db === 'undefined' || !db.d) return;
    const dag = hemLage === 'dag', k = hemDag(), d = dateOf(k);
    const arIdag = d.getTime() === realToday.getTime();
    $('fx-date').innerHTML = dag
      ? `<small>${arIdag ? 'Idag' : (d < realToday ? 'Tidigare' : 'Kommande')}</small><b>${DAG[d.getDay()]} ${d.getDate()} ${MAN[d.getMonth()]}</b>`
      : `<small>Månaden</small><b>${stor(MAN[viewDate.getMonth()])} ${viewDate.getFullYear()}</b>`;
    $('fx-date').classList.toggle('borta', dag && !arIdag);
    const m = manad();
    const html = dag ? idag(k, m) : manadVy(m);
    const vyId = (dag ? 'd' : 'm') + k + viewDate.getMonth();
    const v = $('fx-view');
    v.innerHTML = html;
    if (vyId !== vy0) { v.classList.remove('in'); void v.offsetWidth; v.classList.add('in'); vy0 = vyId; }
    const big = $('fx-big'); if (big) rakna(big, +big.dataset.v || 0);
    document.querySelectorAll('.fx-fill').forEach(f => { const w = f.dataset.w; requestAnimationFrame(() => { f.style.width = w + '%'; }); });
    document.querySelectorAll('.fx-bar i').forEach(f => { const h = f.dataset.h; requestAnimationFrame(() => { f.style.height = h + '%'; }); });
    // anpassa tills allt får plats – ingen scroll på Idag och Månad
    const sc = $('fx-scroll');
    sc.classList.remove('fit1', 'fit2', 'fit3'); sc.scrollTop = 0;
    for (const f of ['fit1', 'fit2', 'fit3']) { if (sc.scrollHeight <= sc.clientHeight + 1) break; sc.classList.add(f); }
    $('fx-cta').querySelector('.fx-cta-t').textContent = dag && !arIdag ? `Registrera ${d.getDate()} ${MAN[d.getMonth()].slice(0, 3)}` : 'Registrera försäljning';
    aktiv();
  }

  function veckorad(valt) {
    const start = new Date(dateOf(valt)); const dow = (start.getDay() + 6) % 7; start.setDate(start.getDate() - dow);
    let h = '';
    for (let i = 0; i < 7; i++) {
      const dd = new Date(start); dd.setDate(start.getDate() + i);
      const k = keyOf(dd), o = db.d[k] || {}, q = db.q[k] || {}, s = o.s || 0, mal = dayTarget(k);
      let mark = '<i class="fx-ln"></i>', cls = '';
      if (o.abs) { mark = `<i class="fx-pt t-${String(o.abs).split(' ')[0].toLowerCase()}"></i>`; cls = 'ab'; }
      else if (s > 0 && mal > 0) mark = `<i class="fx-ln"><em class="${s >= mal ? 'ok' : 'lag'}" style="width:${Math.min(100, s / mal * 100)}%"></em></i>`;
      else if (s > 0) mark = `<i class="fx-ln"><em class="ok" style="width:100%"></em></i>`;
      else if (!q.start || o.st === 'Ledig') cls = 'ledig';
      if (dd.getTime() === realToday.getTime()) cls += ' idag';
      if (k === valt) cls += ' on';
      h += `<button class="fx-wd ${cls}" onclick="fxDag('${k}')"><span>${KORT[dd.getDay()]}</span><b>${dd.getDate()}</b>${mark}</button>`;
    }
    return `<div class="fx-week">${h}</div>`;
  }

  function idag(k, m) {
    const v = malVy(k), o = db.d[k] || {}, p = uiPass(k), tid = uiTidKvar(k), d = dateOf(k);
    const arIdag = d.getTime() === realToday.getTime();
    const kvar = Math.max(0, v.bas - v.salt), mal = v.bas > 0;
    const pct = mal ? Math.min(100, v.salt / v.bas * 100) : 0;
    // status
    let pill = '', pc = '';
    if (o.abs) { pill = String(o.abs).split(' ')[0] === 'Åtgärd' ? 'Åtgärd krävs' : String(o.abs).split(' ')[0]; pc = 'am'; }
    else if (!mal) { pill = v.salt > 0 ? 'Registrerat' : (p ? 'Inget mål' : 'Ledig'); pc = 'gr'; }
    else if (v.salt >= v.bas) { pill = v.lage === 'boost' ? 'Boost' : 'Klart'; pc = 'ok'; }
    else { pill = `${Math.round(pct)} %`; pc = 'ac'; }
    // tidslinje
    let tl = '';
    if (o.abs) tl = `<div class="fx-abs">${ic('event_busy')}<span>${esc(o.abs)}${o.abs_hours ? ' · ' + String(o.abs_hours).replace('.', ',') + ' h' : ''}</span></div>`;
    else if (p || mal) {
      const nu = new Date(), mm = nu.getHours() * 60 + nu.getMinutes();
      const f = p ? (arIdag ? Math.max(0, Math.min(1, (mm - p.a) / (p.b - p.a))) : (d < realToday ? 1 : 0)) : 0;
      tl = `<div class="fx-track"><i class="fx-fill${v.salt >= v.bas && mal ? ' ok' : ''}" data-w="${pct.toFixed(1)}"></i>${arIdag && f > 0 && f < 1 ? `<em style="left:${(f * 100).toFixed(1)}%"></em>` : ''}</div>`
        + (p ? `<div class="fx-tl"><span>${p.start}</span><span>${arIdag && f > 0 && f < 1 ? 'nu ' + String(nu.getHours()).padStart(2, '0') + ':' + String(nu.getMinutes()).padStart(2, '0') : ((p.b - p.a) / 60).toFixed(1).replace('.', ',') + ' h pass'}</span><span>${p.slut}</span></div>` : '');
    } else tl = `<div class="fx-abs fx-tom">${ic('event_available')}<span>Inget pass i schemat</span></div>`;
    const perTim = tid > 0 && kvar > 0 ? kr(kvar / (tid / 60)) : '—';
    const tidS = tid ? Math.floor(tid / 60) + ' h ' + String(tid % 60).padStart(2, '0') : '—';
    const kvarS = !mal ? '—' : kvar > 0 ? kr(kvar) : '+' + kr(v.salt - v.bas);
    // smart rad
    let tips = '';
    if (mal && arIdag && tid > 0 && kvar > 0) tips = `<b>${kr(kvar / (tid / 60))} kr/tim</b> resten av passet når dagsmålet.`;
    else if (mal && v.salt >= v.bas && m.nasta && m.kravNasta) tips = `Snyggt! <b>${kk(m.kravNasta)} per pass</b> ger ${m.nasta.pct} % bonus.`;
    else if (m.nasta && m.kravNasta) tips = `<b>${kk(m.kravNasta)} per pass</b> resten av månaden ger ${m.nasta.pct} % bonus.`;
    const L = lon();
    const bonusV = m.nu && !m.nasta ? `${m.nu.pct} %` : m.nasta ? `${m.nasta.pct} %` : '—';
    const bonusS = m.nu && !m.nasta ? 'högsta nivån nådd' : m.nasta ? `${kk(m.nasta.min - m.salt)} kvar` : 'inga nivåer';
    const lonS = (L.lbl.match(/(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)/i) || [])[0];
    return `
      ${veckorad(k)}
      <section class="fx-hero2">
        <div class="fx-hh"><span class="fx-lbl">${arIdag ? 'Sålt idag' : 'Sålt ' + DAG[d.getDay()].toLowerCase()}</span>${o.abs ? '' : `<span class="fx-pill ${pc}">${esc(pill)}</span>`}</div>
        <div class="fx-big"><b id="fx-big" data-v="${v.salt}">${kr(v.salt)}</b><em>kr</em></div>
        <div class="fx-sub">${mal ? `av ${kr(v.bas)}${v.boost ? ' + ' + kk(v.boost) + ' boost' : ''}` : 'Inget dagsmål'}</div>
        ${tl}
        <div class="fx-met3"><div><span>Kvar</span><b>${kvarS}</b></div><div><span>Per timme</span><b>${perTim}</b></div><div><span>Tid kvar</span><b>${tidS}</b></div></div>
      </section>
      ${tips ? `<p class="fx-tips">${ic('lightbulb')}<span>${tips}</span></p>` : ''}
      <section class="fx-tiles">
        <button class="fx-tile t-mint" onclick="setHemLage('manad')">${ic('trending_up')}<span>${stor(MAN[m.cm - 1])}</span><b>${kk(m.salt)}</b><small>${m.mal > 0 ? Math.round(m.salt / m.mal * 100) + ' % av ' + kk(m.mal) : ''}</small><i class="fx-mini"><em style="width:${m.mal > 0 ? Math.min(100, m.salt / m.mal * 100) : 0}%"></em></i></button>
        <button class="fx-tile t-sand" onclick="setHemLage('manad')">${ic('workspace_premium')}<span>${m.nu && !m.nasta ? 'Bonus' : 'Nästa bonus'}</span><b>${bonusV}</b><small>${bonusS}</small><i class="fx-steps">${m.steg.map(t => `<em class="${m.salt >= t.min ? 'on' : ''}"></em>`).join('')}</i></button>
        <button class="fx-tile t-lav" onclick="navTo('lon')">${ic('payments')}<span>Lön</span><b>${L.net || '—'}</b><small>${lonS ? '25 ' + lonS.slice(0, 3).toLowerCase() : 'kommande'}</small><i class="fx-mini"></i></button>
      </section>`;
  }

  function manadVy(m) {
    const max = Math.max(1, ...m.dagar.map(x => Math.max(x.s, x.mal)));
    const bars = m.dagar.map(x => {
      let c = 'f', h = 2;
      if (x.abs && !x.s) { c = 'a'; h = 6; }
      else if (x.s > 0) { c = x.mal > 0 && x.s >= x.mal ? 'h' : 'm'; h = Math.max(4, x.s / max * 100); }
      else if (x.fram && x.mal > 0) { c = 'p'; h = Math.max(4, x.mal / max * 100); }
      return `<button class="${c}${x.idag ? ' idag' : ''}" onclick="fxDag('${x.k}')" aria-label="${x.d}"><i data-h="${h.toFixed(1)}"></i></button>`;
    }).join('');
    const pct = m.mal > 0 ? Math.round(m.salt / m.mal * 100) : 0;
    const ifas = m.prognos >= m.mal;
    let sub = '';
    if (m.salt >= m.mal && m.mal > 0) sub = `Målet nått · <b>${m.nasta ? kk(m.nasta.min - m.salt) + ' till ' + m.nasta.pct + ' %' : 'högsta nivån'}</b>`;
    else if (m.krav != null) sub = `<b>${kk(m.krav)} per pass</b> räcker till målet`;
    else sub = `${pct} % av målet`;
    const tiers = m.steg.map(t => {
      const f = Math.min(100, m.salt / t.min * 100), nadd = m.salt >= t.min;
      return `<div class="fx-tr${nadd ? ' nadd' : ''}"><b>${t.pct} %</b><span class="fx-tmin">${kk(t.min)}</span><div class="fx-tb"><i class="fx-fill" data-w="${f.toFixed(1)}"></i></div><small>${nadd ? 'Nådd' : kk(t.min - m.salt) + ' kvar'}</small></div>`;
    }).join('');
    return `
      <section class="fx-hero2">
        <div class="fx-hh"><span class="fx-lbl">Sålt i ${MAN[m.cm - 1]}</span><div class="fx-mnav"><button onclick="fxMan(-1)" aria-label="Förra månaden">${ic('chevron_left')}</button><button onclick="fxMan(1)" aria-label="Nästa månad">${ic('chevron_right')}</button></div></div>
        <div class="fx-big"><b id="fx-big" data-v="${m.salt}">${kr(m.salt)}</b><em>kr</em></div>
        <div class="fx-sub">${pct} % av ${kr(m.mal)}${m.salt >= m.mal && m.mal > 0 ? ' · ' + sub : ''}</div>
        <div class="fx-track"><i class="fx-fill${ifas ? '' : ' efter'}${m.salt >= m.mal && m.mal > 0 ? ' ok' : ''}" data-w="${Math.min(100, pct)}"></i>${m.mal > 0 ? `<em class="prog" style="left:${Math.min(100, m.prognos / m.mal * 100).toFixed(1)}%"></em>` : ''}</div>
        <div class="fx-tl"><span class="${ifas ? 'okt' : 'eft'}">${ifas ? 'I fas' : 'Efter'}</span><span>${m.krav ? 'krävs <b>' + kk(m.krav) + '</b>/pass · ' : ''}prognos ${kk(m.prognos)}</span></div>
        <div class="fx-met3"><div><span>Pass kvar</span><b>${m.rW} av ${m.tP}</b></div><div><span>Snitt/pass</span><b>${m.avg ? kk(m.avg) : '—'}</b></div><div><span>Frånvaro</span><b>${m.frv} ${m.frv === 1 ? 'dag' : 'dgr'}</b></div></div>
      </section>
      <section class="fx-box">
        <div class="fx-bh"><b>Dag för dag</b><span><i class="h"></i>nått<i class="m"></i>under<i class="a"></i>frånvaro</span></div>
        <div class="fx-bar">${bars}</div>
      </section>
      <section class="fx-box">
        <div class="fx-bh"><b>Bonusnivåer</b>${m.ratio > 0 ? `<button onclick="toggleReliefMode()">${m.lattat ? 'Lättat −' + Math.round(m.ratio * 100) + ' %' : 'Visa lättat −' + Math.round(m.ratio * 100) + ' %'}</button>` : ''}</div>
        <div class="fx-tiers">${tiers || '<p class="fx-note">Inga bonusnivåer för månaden.</p>'}</div>
      </section>
`;
  }

  // ---------- ark ----------
  function oppnaArk(s) { s.classList.add('open'); document.body.classList.add('fx-ark'); try { sfPushHist && sfPushHist(); } catch (e) {} }
  function stangArk(s) { s.classList.remove('open'); if (!document.querySelector('.fx-sheet.open')) document.body.classList.remove('fx-ark'); }
  window.addEventListener('popstate', () => document.querySelectorAll('.fx-sheet.open').forEach(stangArk));
  const STATUS = [['Arbete', 'work', 'Arbete'], ['Ledig', 'weekend', 'Ledig'], ['Semester', 'beach_access', 'Semester'], ['Sjuk', 'sick', 'Sjuk'], ['VAB', 'child_care', 'VAB'], ['Föräldraledig', 'stroller', 'Föräldraledig']];
  let padV = '', padNy = true;
  function oppnaReg(flik) {
    const k = hemDag(); activeK = k;
    const o = db.d[k] || {}, d = dateOf(k);
    padV = o.s > 0 ? String(o.s) : ''; padNy = true;
    $('fx-reg-dag').textContent = `${DAG[d.getDay()]} ${d.getDate()} ${MAN[d.getMonth()]}`;
    const aktivS = o.abs ? String(o.abs).split(' ')[0] : (o.st === 'Ledig' ? 'Ledig' : 'Arbete');
    $('fx-stat').innerHTML = STATUS.map(s => `<button data-s="${s[0]}" class="${aktivS === s[0] ? 'on' : ''}">${ic(s[1])}<span>${s[2]}</span></button>`).join('');
    visaFlik(flik || 'salj'); visaPad(); oppnaArk($('fx-reg'));
  }
  window.fxReg = oppnaReg;
  function visaFlik(t) {
    document.querySelectorAll('#fx-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    document.querySelectorAll('#fx-reg .fx-pane').forEach(p => { p.hidden = p.dataset.p !== t; });
  }
  function visaPad() {
    $('fx-amt').textContent = padV ? kr(+padV) : '0';
    const v = malVy(hemDag()), ny = +padV || 0, o = db.d[hemDag()] || {};
    const diff = ny - (o.s || 0);
    $('fx-hint').innerHTML = (v.bas > 0 ? (ny < v.bas ? `${kr(v.bas - ny)} kr kvar till dagsmålet` : '<b class="ok">Dagsmålet nås</b>') : 'Dagens totala försäljning') + (diff && o.s ? ` · ${diff > 0 ? '+' : '−'}${kr(Math.abs(diff))}` : '');
  }
  function tryck(x) {
    if (x === 'C') padV = ''; else if (x === '⌫') padV = padV.slice(0, -1);
    else { if (padNy) padV = ''; if (padV.length < 7) padV = (padV + x).replace(/^0+/, ''); }
    padNy = false; visaPad();
  }
  function sparaPad() {
    const k = hemDag(), val = +padV || 0, ex = db.d[k] || {};
    if (ex.abs) pushMatrixSync(k, { s: val }); else pushMatrixSync(k, { s: val, st: 'Arbete', abs: null });
    try { if (navigator.vibrate) navigator.vibrate([10, 40, 10]); } catch (e) {}
    stangArk($('fx-reg'));
  }

  // ---------- koppla in ----------
  let ko = 0;
  const schema = () => { if (ko) return; ko = requestAnimationFrame(() => { ko = 0; try { rita(); } catch (e) { console.error(e); } }); };
  window.fxRita = schema;
  ['updateDash', 'updateDashboardView', 'renderWeekSlides', 'ritaHem', 'pushMatrixSync', 'goToDayDash', 'toggleReliefMode'].forEach(n => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); if (n === 'pushMatrixSync') lonTid = 0; schema(); return r; };
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schema(); });
  setInterval(schema, 60000);
  document.documentElement.classList.add('fx-on');
  bygg(); schema();
  window.addEventListener('load', schema);
  setTimeout(schema, 900);
})();
