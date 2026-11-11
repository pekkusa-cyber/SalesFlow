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
    const igen = vyId === vy0; v.classList.toggle('nt', igen);
    v.innerHTML = html;
    if (vyId !== vy0) { v.classList.remove('in'); void v.offsetWidth; v.classList.add('in'); vy0 = vyId; }
    const big = $('fx-big'); if (big) rakna(big, +big.dataset.v || 0);
    document.querySelectorAll('.fx-fill').forEach(f => { const w = f.dataset.w; requestAnimationFrame(() => { f.style.width = w + '%'; }); });
    document.querySelectorAll('.fx-rc').forEach(c => { const d = c.dataset.d; requestAnimationFrame(() => { c.style.strokeDasharray = d; }); });
    document.querySelectorAll('.fx-bar i').forEach(f => { const h = f.dataset.h; requestAnimationFrame(() => { f.style.height = h + '%'; }); });
    // anpassa tills allt får plats – ingen scroll på Idag och Månad
    const sc = $('fx-scroll');
    sc.classList.remove('fit1', 'fit2', 'fit3', 'fit4', 'fit5'); sc.scrollTop = 0;
    for (const f of ['fit1', 'fit2', 'fit3', 'fit4', 'fit5']) { if (sc.scrollHeight <= sc.clientHeight + 1) break; sc.classList.add(f); }
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

  // ---------- tre mätare: tempo (vänster), sålt + tid (mitten), höger efter vy ----------
  const GREEN = '#0f9d62', GOLD = '#c9a227', AMBER = '#d9a441', BLUE = '#2c55f5';
  const gp = (r, a) => { const t = a * Math.PI / 180; return [40 + r * Math.sin(t), 40 - r * Math.cos(t)]; };
  const garc = (r, a0, a1) => { const p0 = gp(r, a0), p1 = gp(r, a1); return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`; };
  function sgauge(kind, v, col) {
    let fill = '';
    if (kind === 'div') {
      if (Math.abs(v) > .01) fill += `<path class="fx-rc" data-d="100 100" pathLength="100" d="${garc(32, 0, Math.max(-1, Math.min(1, v)) * 135)}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 100"/>`;
      const a = gp(38, 0), b = gp(26, 0);
      fill += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="var(--hr-tx)" stroke-width="2" stroke-linecap="round"/>`;
    } else if (v > .005) fill = `<path class="fx-rc" data-d="100 100" pathLength="100" d="${garc(32, -135, -135 + 270 * Math.min(1, v))}" fill="none" stroke="${col}" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 100"/>`;
    return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="${garc(32, -135, 135)}" fill="none" stroke="var(--hr-track)" stroke-width="8" stroke-linecap="round"/>${fill}</svg>`;
  }
  const RY = 62, CY = 2 * Math.PI * RY, RI = 49, CI = 2 * Math.PI * RI;
  function bigring(fs, fp) {
    const a = Math.max(0, Math.min(1, fs)), b = Math.max(0, Math.min(1, fp));
    return `<svg viewBox="0 0 148 148" aria-hidden="true"><defs><linearGradient id="fxg1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0b8a55"/><stop offset="1" stop-color="#3fc98a"/></linearGradient><linearGradient id="fxg2" x1="0" x2="1"><stop offset="0" stop-color="#b8901a"/><stop offset="1" stop-color="#e8c85a"/></linearGradient></defs>
      <circle cx="74" cy="74" r="${RY}" fill="none" stroke="var(--hr-track)" stroke-width="13"/>
      <circle class="fx-rc" data-d="${(CY * a).toFixed(1)} ${CY.toFixed(1)}" cx="74" cy="74" r="${RY}" fill="none" stroke="url(#fxg1)" stroke-width="13" stroke-linecap="round" stroke-dasharray="0 999" transform="rotate(-90 74 74)"/>
      <circle cx="74" cy="74" r="${RI}" fill="none" stroke="var(--hr-track2)" stroke-width="6"/>
      <circle class="fx-rc" data-d="${(CI * b).toFixed(1)} ${CI.toFixed(1)}" cx="74" cy="74" r="${RI}" fill="none" stroke="url(#fxg2)" stroke-width="6" stroke-linecap="round" stroke-dasharray="0 999" transform="rotate(-90 74 74)"/></svg>`;
  }
  const erf = x => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + .3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
  function chansAtt(m, mal) {
    if (!(mal > 0)) return null;
    if (m.salt >= mal) return 1;
    if (!m.rW) return 0;
    const v = m.dagar.filter(x => !x.fram && x.s > 0).map(x => x.s);
    const mean = v.length ? v.reduce((a, b) => a + b, 0) / v.length : m.avg;
    const sd = v.length > 2 ? Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (v.length - 1)) : (m.avg || 1) * .4;
    const z = (m.prognos - mal) / Math.max(1, sd * Math.sqrt(m.rW));
    return Math.max(0, Math.min(1, .5 * (1 + erf(z / Math.SQRT2))));
  }
  const hm = min => Math.floor(min / 60) + ' h ' + String(Math.round(min % 60)).padStart(2, '0') + ' min';
  const sidoG = (g, c, l, e, am) => `<div class="fx-sg"><div class="g">${g}<div class="c">${c}</div></div><div class="lb">${l}<em${am ? ' class="am"' : ''}>${e}</em></div></div>`;
  const rad = (typ, txt) => `<p><i class="${typ === 'k' ? 'k' : 'm'}">${typ === 'k' ? 'Kan nå' : 'Måste'}</i><span>${txt}</span></p>`;

  function idag(k, m) {
    const v = malVy(k), o = db.d[k] || {}, p = uiPass(k), tid = uiTidKvar(k), d = dateOf(k);
    const arIdag = d.getTime() === realToday.getTime();
    const mal = v.bas > 0, kvar = Math.max(0, v.bas - v.salt);
    const fs = mal ? v.salt / v.bas : 0, klar = mal && v.salt >= v.bas;
    const nu = new Date(), mm = nu.getHours() * 60 + nu.getMinutes();
    let fp = 0;
    if (p) fp = arIdag ? Math.max(0, Math.min(1, (mm - p.a) / (p.b - p.a))) : (d < realToday ? 1 : 0);
    const speed = (p && arIdag && mm - p.a > 15) ? v.salt / ((mm - p.a) / 60) : null;
    const proj = (speed != null && tid > 0) ? v.salt + speed * (tid / 60) : null;
    // vänster mätare: tempo mot tiden
    let tg, tc, tl, te, tam = false, pill, pc;
    if (o.abs) { pill = String(o.abs).split(' ')[0] === 'Åtgärd' ? 'Saknar typ' : String(o.abs).split(' ')[0]; pc = 'am'; tg = sgauge('div', 0, GREEN); tc = '<b>—</b><small>frånvaro</small>'; tl = 'Tempo'; te = 'ingen försäljning'; }
    else if (!mal || !p) { pill = v.salt > 0 ? 'Registrerat' : (p ? 'Inget mål' : 'Ledig'); pc = 'gr'; tg = sgauge('div', 0, GREEN); tc = '<b>—</b><small>tempo</small>'; tl = 'Tempo'; te = mal ? 'inget pass' : 'inget mål'; }
    else {
      const diff = v.salt - v.bas * fp, vv = diff / (v.bas * .25);
      const fas = diff >= -v.bas * .03;
      tg = sgauge('div', vv, fas ? GREEN : AMBER); tam = !fas;
      tc = `<b>${diff >= 0 ? '+' : '−'}${kk(Math.abs(diff))}</b><small>vs tid</small>`;
      tl = 'Tempo'; te = klar ? 'före' : fas ? (diff > v.bas * .03 ? 'före' : 'i fas') : 'efter';
      pill = klar ? 'Klart' : (fas ? 'I fas' : 'Efter'); pc = klar || fas ? 'ok' : 'am';
      if (!arIdag) { te = d < realToday ? 'resultat' : 'kommande'; pill = klar ? 'Klart' : (d < realToday ? 'Missat' : 'Kommande'); pc = klar ? 'ok' : 'gr'; }
    }
    // höger mätare: snitt per pass kvar
    let rg;
    if (m.mal > 0 && m.salt >= m.mal) rg = sidoG(sgauge('p', 1, GOLD), '<b>✓</b><small>mål nått</small>', 'Månadsmål', m.nasta ? `${kk(m.nasta.min - m.salt)} till ${m.nasta.pct} %` : 'högsta nivån');
    else if (m.krav != null) { const r = m.avg ? m.avg / m.krav : 0; rg = sidoG(sgauge('p', r, r >= 1 ? GREEN : AMBER), `<b>${kk(m.krav)}</b><small>per pass</small>`, 'Snitt/pass kvar', m.avg ? `ditt ${kk(m.avg)}` : '—', r < 1); }
    else rg = sidoG(sgauge('p', 0, GREEN), '<b>—</b>', 'Snitt/pass kvar', 'inga pass kvar');
    // texten: vad du kan nå och vad du måste göra
    let kan, mast;
    if (o.abs) { kan = `Ingen försäljning väntas, du är registrerad som <b>${esc(o.abs)}</b>.`; mast = 'Inget att göra idag.'; }
    else if (klar) { kan = `<b>${kr(v.salt)} kr</b> · ${Math.round(fs * 100)} % av dagsmålet.`; mast = m.nasta && m.kravNasta ? `<b>${kk(m.kravNasta)} per pass</b> för ${m.nasta.pct} % bonus.` : 'Målet är nått, bra jobbat.'; }
    else if (mal && proj != null) { kan = `<b>${kk(proj)}</b> om du håller farten (${Math.round(proj / v.bas * 100)} % av målet).`; mast = tid > 0 ? `<b>${kr(kvar / (tid / 60))} kr/tim</b> i ${hm(tid)}. Du säljer ${kr(speed)} nu.` : `<b>${kr(kvar)} kr</b> kvar.`; }
    else if (mal) { kan = `Dagsmålet är <b>${kr(v.bas)} kr</b>.`; mast = `<b>${kr(kvar)} kr</b> kvar för att nå det.`; }
    else { kan = 'Inget dagsmål den här dagen.'; mast = m.krav ? `<b>${kk(m.krav)} per pass</b> resten av månaden.` : 'Inget att göra.'; }
    const L = lon();
    const bonusV = m.nu && !m.nasta ? `${m.nu.pct} %` : m.nasta ? `${m.nasta.pct} %` : '—';
    const bonusS = m.nu && !m.nasta ? 'högsta nivån' : m.nasta ? `${kk(m.nasta.min - m.salt)} kvar` : 'inga nivåer';
    const lonS = (L.lbl.match(/(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)/i) || [])[0];
    return `
      <section class="fx-hero4">
        <div class="fx-ht"><span>${arIdag ? 'Sålt idag' : 'Sålt ' + DAG[d.getDay()].toLowerCase()}</span><span class="fx-pill2 ${pc}">${esc(pill)}</span></div>
        <div class="fx-gz">
          ${sidoG(tg, tc, tl, te, tam)}
          <div class="fx-bigring${klar ? ' klar' : ''}">${bigring(fs, fp)}<div class="c"><b id="fx-big" data-v="${v.salt}">${kr(v.salt)}</b><small>${mal ? 'av ' + kr(v.bas) + ' kr' : 'inget dagsmål'}</small>${mal ? `<i>${Math.round(fs * 100)} %</i>` : ''}</div></div>
          ${rg}
        </div>
        <div class="fx-say">${rad('k', kan)}${rad('m', mast)}</div>
      </section>
      <section class="fx-t3">
        <button class="fx-t g" onclick="setHemLage('manad')"><span>${stor(MAN[m.cm - 1])}</span><b>${kk(m.salt)}</b><small>${m.mal > 0 ? Math.round(m.salt / m.mal * 100) + ' % av ' + kk(m.mal) : ''}</small></button>
        <button class="fx-t k" onclick="setHemLage('manad')"><span>${m.nu && !m.nasta ? 'Bonus' : 'Nästa bonus'}</span><b>${bonusV}</b><small>${bonusS}</small></button>
        <button class="fx-t b" onclick="navTo('lon')"><span>Lön</span><b>${L.net || '—'}</b><small>${lonS ? '25 ' + lonS.slice(0, 3).toLowerCase() : 'kommande'}</small></button>
      </section>
      ${veckorad(k)}`;
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
    const fs = m.mal > 0 ? m.salt / m.mal : 0, klar = m.mal > 0 && m.salt >= m.mal;
    const isNu = m.cy === realToday.getFullYear() && m.cm === realToday.getMonth() + 1;
    const fp = isNu ? Math.min(1, (realToday.getDate() - 1 + new Date().getHours() / 24) / m.dim) : (new Date(m.cy, m.cm - 1, 1) < realToday ? 1 : 0);
    // vänster: tempo mot månadens gång
    const diff = m.salt - m.mal * fp, fas = diff >= -m.mal * .02;
    const tg = sgauge('div', m.mal > 0 ? diff / (m.mal * .2) : 0, fas ? GREEN : AMBER);
    const tc = `<b>${diff >= 0 ? '+' : '−'}${kk(Math.abs(diff))}</b><small>vs tid</small>`;
    // höger: prognos och chans
    const ch = chansAtt(m, m.mal);
    const chCol = ch == null ? GREEN : ch >= .66 ? GREEN : ch >= .33 ? GOLD : AMBER;
    const rg = ch == null ? sidoG(sgauge('p', 0, GREEN), '<b>—</b>', 'Prognos', '—') : sidoG(sgauge('p', ch, chCol), `<b>${Math.round(ch * 100)} %</b><small>chans</small>`, `Prognos ${kk(m.prognos)}`, `${Math.round(m.prognos / m.mal * 100)} % av målet`, ch < .33);
    const reach = m.steg.filter(t => m.prognos >= t.min).pop();
    let kan, mast;
    if (klar) { kan = `Redan <b>${kk(m.salt)}</b>, prognos ${kk(m.prognos)}.`; mast = m.nasta && m.kravNasta ? `<b>${kk(m.kravNasta)} per pass</b> för ${m.nasta.pct} % bonus.` : 'Du är på högsta nivån.'; }
    else if (isNu) {
      kan = `Prognos <b>${kk(m.prognos)}</b> · ${reach ? `räcker till <b>${reach.pct} % bonus</b>` : (m.steg[0] ? `under ${m.steg[0].pct} %-nivån` : 'under målet')}.`;
      mast = m.nasta && m.kravNasta ? `<b>${kk(m.kravNasta)} per pass</b> i ${m.rW} pass för ${m.nasta.pct} % bonus.` : (m.krav ? `<b>${kk(m.krav)} per pass</b> för månadsmålet.` : 'Inga pass kvar.');
    } else { kan = `Slutade på <b>${kk(m.salt)}</b> (${Math.round(fs * 100)} % av målet).`; mast = m.nu ? `Bonusnivå: <b>${m.nu.pct} %</b>.` : 'Ingen bonusnivå nådd.'; }
    const pill = klar ? 'Klart' : (fas ? 'I fas' : 'Efter'), pc = klar || fas ? 'ok' : 'am';
    // bonusstege
    const topT = Math.max(1, ...m.steg.map(t => t.min), m.mal), scale = topT * 1.08, pos = x => Math.max(0, Math.min(100, x / scale * 100));
    let nxt = true;
    const nod = m.steg.map(t => {
      const ok = m.salt >= t.min; let cls = ok ? 'ok' : (nxt ? 'nx' : ''); if (!ok) nxt = false;
      return `<div class="nd ${cls}" style="left:${pos(t.min).toFixed(1)}%"><b>${t.pct} %</b><i>${ok ? ic('check') : cls === 'nx' ? ic('star') : ''}</i></div><div class="nl" style="left:${pos(t.min).toFixed(1)}%"><em>${kk(t.min)}</em>${ok ? 'nådd' : cls === 'nx' ? kk(t.min - m.salt) + ' kvar' : ''}</div>`;
    }).join('');
    return `
      <section class="fx-hero4 mo">
        <div class="fx-ht"><span>Sålt i ${MAN[m.cm - 1]}</span><div class="fx-hr"><span class="fx-pill2 ${pc}">${pill}</span><div class="fx-mnav"><button onclick="fxMan(-1)" aria-label="Förra månaden">${ic('chevron_left')}</button><button onclick="fxMan(1)" aria-label="Nästa månad">${ic('chevron_right')}</button></div></div></div>
        <div class="fx-gz">
          ${sidoG(tg, tc, 'Tempo', klar ? 'före' : fas ? 'i fas' : 'efter', !fas && !klar)}
          <div class="fx-bigring${klar ? ' klar' : ''}">${bigring(fs, fp)}<div class="c"><b id="fx-big" data-v="${m.salt}">${kr(m.salt)}</b><small>av ${kr(m.mal)} kr</small><i>${Math.round(fs * 100)} %</i></div></div>
          ${rg}
        </div>
        <div class="fx-say">${rad('k', kan)}${rad('m', mast)}</div>
      </section>
      <section class="fx-box">
        <div class="fx-bh"><b>Dag för dag</b><span><i class="h"></i>nått<i class="m"></i>under<i class="a"></i>frånvaro</span></div>
        <div class="fx-bar">${m.avg ? `<div class="fx-avg" style="bottom:${Math.min(100, m.avg / max * 100).toFixed(1)}%"><span>snitt ${kk(m.avg)}</span></div>` : ''}${bars}</div>
        <div class="fx-ax"><span>1</span><span>8</span><span>15</span><span>22</span><span>${m.dim}</span></div>
      </section>
      <section class="fx-box">
        <div class="fx-bh"><b>Bonussystem</b>${m.ratio > 0 ? `<button onclick="toggleReliefMode()">${m.lattat ? 'Lättat −' + Math.round(m.ratio * 100) + ' %' : 'Visa lättat −' + Math.round(m.ratio * 100) + ' %'}</button>` : `<span class="gold">${ic('workspace_premium')}</span>`}</div>
        <div class="fx-ladder"><div class="lt"><i class="lf fx-fill${klar ? ' ok' : ''}" data-w="${pos(m.salt).toFixed(1)}"></i>${m.prognos > m.salt ? `<em class="pg" style="left:${pos(m.prognos).toFixed(1)}%"></em>` : ''}${nod}</div></div>
      </section>`;
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
