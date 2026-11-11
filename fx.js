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
        <button data-n="franv">${ic('event_busy')}<span>Frånvaro</span></button>
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
    view.addEventListener('touchstart', e => { if (!e.touches || !e.touches[0]) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; start = e.target; }, { passive: true });
    view.addEventListener('touchend', e => { if (!e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (start && start.closest && start.closest('.fx-flip')) return window.fxVand();
      if (start && start.closest && start.closest('.fx-slot')) return window.fxSlot();
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
    else if (n === 'franv') { if (!$('sheet-absence').classList.contains('is-open')) navTo('absence'); }
    else if (n === 'kal') { if (!$('sheet-month').classList.contains('is-open')) navTo('month'); }
    else if (n === 'lon') { if (!$('sheet-lon').classList.contains('is-open')) navTo('lon'); }
    else if (n === 'mer') { oppnaArk($('fx-mer')); }
    aktiv();
  }
  function aktiv() {
    let n = 'idag';
    if ($('sheet-month') && $('sheet-month').classList.contains('is-open')) n = 'kal';
    else if ($('sheet-lon') && $('sheet-lon').classList.contains('is-open')) n = 'lon';
    else if ($('sheet-absence') && $('sheet-absence').classList.contains('is-open')) n = 'franv';
    else if ($('notes-modal') && !$('notes-modal').classList.contains('hidden')) n = 'mer';
    document.querySelectorAll('#fx-nav button').forEach(b => b.classList.toggle('on', b.dataset.n === n));
    document.body.classList.toggle('fx-sida', n !== 'idag');
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
  function rakna(el, till, fmt) {
    fmt = fmt || kr;
    if (!el) return;
    const fran = forra == null ? till * 0.6 : forra; forra = till;
    if (fran === till || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(till); return; }
    const t0 = performance.now();
    (function s(t) { const f = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - f, 3); el.textContent = fmt(fran + (till - fran) * e); if (f < 1) requestAnimationFrame(s); })(t0);
  }

  // ---------- rita ----------
  let vy0 = '';
  function rita() {
    if (!$('fx') || typeof db === 'undefined' || !db.d) return;
    const dag = true, k = hemDag(), d = dateOf(k);
    const arIdag = d.getTime() === realToday.getTime();
    $('fx-date').innerHTML = dag
      ? `<small>${arIdag ? 'Idag' : (d < realToday ? 'Tidigare' : 'Kommande')}</small><b>${DAG[d.getDay()]} ${d.getDate()} ${MAN[d.getMonth()]}</b>`
      : `<small>Månaden</small><b>${stor(MAN[viewDate.getMonth()])} ${viewDate.getFullYear()}</b>`;
    $('fx-date').classList.toggle('borta', dag && !arIdag);
    const m = manad();
    const html = idag(k, m);
    const vyId = (dag ? 'd' : 'm') + k + viewDate.getMonth();
    const v = $('fx-view');
    const igen = vyId === vy0; v.classList.toggle('nt', igen);
    v.innerHTML = html;
    if (vyId !== vy0) { v.classList.remove('in'); void v.offsetWidth; v.classList.add('in'); vy0 = vyId; }
    const big = $('fx-big'); if (big) rakna(big, +big.dataset.v || 0, n => Math.round(n) + ' %');
    document.querySelectorAll('.fx-fill').forEach(f => { const w = f.dataset.w; requestAnimationFrame(() => { f.style.width = w + '%'; }); });
    document.querySelectorAll('.fx-rc').forEach(c => { const d = c.dataset.d; requestAnimationFrame(() => { c.style.strokeDasharray = d; }); });
    document.querySelectorAll('.fx-bar i').forEach(f => { const h = f.dataset.h; requestAnimationFrame(() => { f.style.height = h + '%'; }); });
    // anpassa tills allt får plats – ingen scroll på Idag och Månad
    const sc = $('fx-scroll');
    sc.classList.remove('fit1', 'fit2', 'fit3', 'fit4', 'fit5'); sc.scrollTop = 0;
    const over = () => sc.scrollHeight > sc.clientHeight + 1 || [...document.querySelectorAll('#fx .fx-face')].some(f => f.scrollHeight > f.clientHeight + 1);
    for (const f of ['fit1', 'fit2', 'fit3', 'fit4', 'fit5']) { if (!over()) break; sc.classList.add(f); }
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

  // ---------- mätarna: röd → guld → grön efter framsteg, streck för tempot ----------
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
  const RED = [216, 81, 63], AMB = [214, 160, 40], GRN = [15, 157, 98];
  const farg = f => { f = Math.max(0, Math.min(1, f || 0)); const c = f < .5 ? mix(RED, AMB, f * 2) : mix(AMB, GRN, (f - .5) * 2); return `rgb(${c.join(',')})`; };
  const gp = (r, a) => { const t = a * Math.PI / 180; return [50 + r * Math.sin(t), 50 - r * Math.cos(t)]; };
  const garc = (r, a0, a1) => { const p0 = gp(r, a0), p1 = gp(r, a1); return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`; };
  function matare(f, tick, sw) {
    const r = 41, fc = Math.max(0, Math.min(1, f || 0));
    let s = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${garc(r, -135, 135)}" fill="none" stroke="var(--hr-track)" stroke-width="${sw}" stroke-linecap="round"/>`;
    if (fc > .004) s += `<path class="fx-rc" data-d="100 100" pathLength="100" d="${garc(r, -135, -135 + 270 * fc)}" fill="none" stroke="${farg(f)}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="0 100"/>`;
    if (tick != null) { const a = -135 + 270 * Math.max(0, Math.min(1, tick)), p0 = gp(r - sw / 2 - 3, a), p1 = gp(r + sw / 2 + 3, a); s += `<line class="fx-tick" x1="${p0[0].toFixed(2)}" y1="${p0[1].toFixed(2)}" x2="${p1[0].toFixed(2)}" y2="${p1[1].toFixed(2)}" stroke="var(--hr-tx)" stroke-width="2.8" stroke-linecap="round"/>`; }
    return s + '</svg>';
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
  const pc = x => Math.round(x * 100) + ' %';
  const chip = (txt, typ) => `<span class="fx-chip ${typ}">${txt}</span>`;
  const kol = (cls, rubrik, varde, g, inne, under) => `<div class="fx-k ${cls}"><div class="t"><span>${rubrik}</span><b>${varde}</b></div><div class="g">${g}<div class="c">${inne}</div></div><div class="u">${under}</div></div>`;
  const rad = (typ, txt) => `<p><i class="${typ}">${typ === 'k' ? 'Kan nå' : 'Måste'}</i><span>${txt}</span></p>`;
  let vand = false, slot = false;

  function idag(k, m) {
    const v = malVy(k), o = db.d[k] || {}, p = uiPass(k), tid = uiTidKvar(k), d = dateOf(k);
    const arIdag = d.getTime() === realToday.getTime();
    const mal = v.bas > 0, kvar = Math.max(0, v.bas - v.salt);
    const fs = mal ? v.salt / v.bas : 0, klar = mal && v.salt >= v.bas;
    const nu = new Date(), mm = nu.getHours() * 60 + nu.getMinutes();
    let fp = null;
    if (p) fp = arIdag ? Math.max(0, Math.min(1, (mm - p.a) / (p.b - p.a))) : (d < realToday ? 1 : null);
    const speed = (p && arIdag && mm - p.a > 15) ? v.salt / ((mm - p.a) / 60) : null;
    const proj = (speed != null && tid > 0) ? v.salt + speed * (tid / 60) : null;
    // månadens tempo: var du borde vara just nu
    const isNu = m.cy === realToday.getFullYear() && m.cm === realToday.getMonth() + 1;
    const mfp = isNu ? Math.min(1, (realToday.getDate() - 1 + nu.getHours() / 24) / m.dim) : (new Date(m.cy, m.cm - 1, 1) < realToday ? 1 : 0);
    const mf = m.mal > 0 ? m.salt / m.mal : 0, mklar = m.mal > 0 && m.salt >= m.mal;
    const mdiff = m.salt - m.mal * mfp, mfas = mdiff >= -m.mal * .02;
    // ---- framsidan ----
    const dagKol = o.abs
      ? kol('sid', 'Idag', String(o.abs).split(' ')[0], matare(0, null, 9), '<b>—</b>', `<small>${esc(String(o.abs).split(' ')[0] === 'Åtgärd' ? 'saknar typ' : 'frånvaro')}</small>`)
      : !mal ? kol('sid', 'Dagsmål', '—', matare(0, null, 9), '<b>—</b>', `<small>${v.salt > 0 ? kr(v.salt) + ' kr' : (p ? 'inget mål' : 'ledig')}</small>`)
      : kol('sid', 'Dagsmål', kk(v.bas), matare(fs, fp, 9), `<b>${pc(fs)}</b>`, `<small>${kr(v.salt)} kr</small>`);
    const manKol = kol('main', 'Månadsmål', `${kr(m.mal)} kr`, matare(mf, isNu ? mfp : null, 8),
      `<b id="fx-big" data-v="${Math.round(mf * 100)}">${pc(mf)}</b><small>${kr(m.salt)} kr</small>`,
      mklar ? chip('Målet nått', 'ok') : isNu ? chip(`${mfas ? 'I fas' : 'Efter'} ${mdiff >= 0 ? '+' : '−'}${kk(Math.abs(mdiff))}`, mfas ? 'ok' : 'am') : '');
    let krKol;
    if (mklar) krKol = kol('sid', 'Krävs/pass', '✓', matare(1, null, 9), '<b>✓</b>', chip('Mål nått', 'ok'));
    else if (m.krav != null) { const r = m.avg ? m.avg / m.krav : 0; krKol = kol('sid', 'Krävs/pass', kk(m.krav), matare(r, null, 9), `<b>${pc(Math.min(r, 9.99))}</b>`, chip(r >= 1 ? 'I fas' : 'Efter', r >= 1 ? 'ok' : 'am')); }
    else krKol = kol('sid', 'Krävs/pass', '—', matare(0, null, 9), '<b>—</b>', '<small>inga pass kvar</small>');
    let kan, mast;
    if (o.abs) { kan = `Ingen försäljning väntas, du är registrerad som <b>${esc(o.abs)}</b>.`; mast = m.krav ? `<b>${kk(m.krav)} per pass</b> resten av månaden.` : 'Inget att göra idag.'; }
    else if (klar) { kan = `<b>${kr(v.salt)} kr</b> · ${pc(fs)} av dagsmålet.`; mast = m.nasta && m.kravNasta ? `<b>${kk(m.kravNasta)} per pass</b> för ${m.nasta.pct} % bonus.` : 'Målet är nått, bra jobbat.'; }
    else if (mal && proj != null) { kan = `<b>${kk(proj)}</b> idag om du håller farten (${Math.round(proj / v.bas * 100)} %).`; mast = tid > 0 ? `<b>${kr(kvar / (tid / 60))} kr/tim</b> i ${hm(tid)}. Du säljer ${kr(speed)} nu.` : `<b>${kr(kvar)} kr</b> kvar.`; }
    else if (mal) { kan = `Dagsmålet är <b>${kr(v.bas)} kr</b>.`; mast = `<b>${kr(kvar)} kr</b> kvar för att nå det.`; }
    else { kan = `Prognos för månaden <b>${kk(m.prognos)}</b>.`; mast = m.krav ? `<b>${kk(m.krav)} per pass</b> resten av månaden.` : 'Inget att göra.'; }
    // ---- baksidan: månaden ----
    const vs = new Date(d); vs.setDate(vs.getDate() - ((vs.getDay() + 6) % 7));
    let vSalt = 0, vMal = 0, vGatt = 0;
    for (let i = 0; i < 7; i++) {
      const dd = new Date(vs); dd.setDate(vs.getDate() + i); const kk2 = keyOf(dd), t = dayTarget(kk2) || 0;
      vSalt += (db.d[kk2] || {}).s || 0; vMal += t;
      if (dd < realToday) vGatt += t; else if (dd.getTime() === realToday.getTime()) vGatt += t * (fp == null ? 0 : fp);
    }
    const vf = vMal > 0 ? vSalt / vMal : 0;
    const veckaKol = vMal > 0 ? kol('sid', 'Veckan', kk(vMal), matare(vf, vGatt / vMal, 9), `<b>${pc(vf)}</b>`, `<small>${kr(vSalt)} kr</small>`) : kol('sid', 'Veckan', '—', matare(0, null, 9), '<b>—</b>', '<small>inga mål</small>');
    const pf = m.mal > 0 ? m.prognos / m.mal : 0, reach = m.steg.filter(t => m.prognos >= t.min).pop();
    const progKol = kol('main', 'Prognos', `${kr(m.prognos)} kr`, matare(pf, null, 8), `<b>${pc(pf)}</b><small>av ${kk(m.mal)}</small>`, reach ? chip(`räcker till ${reach.pct} %`, 'gold') : chip('under bonusnivå', 'am'));
    const ch = chansAtt(m, m.mal);
    const chansKol = ch == null ? kol('sid', 'Chans', '—', matare(0, null, 9), '<b>—</b>', '') : kol('sid', 'Chans', 'målet', matare(ch, null, 9), `<b>${pc(ch)}</b>`, chip(ch >= .66 ? 'Trolig' : ch >= .33 ? 'Möjlig' : 'Svår', ch >= .66 ? 'ok' : ch >= .33 ? 'gold' : 'am'));
    let mkan, mmast;
    if (mklar) { mkan = `Redan <b>${kk(m.salt)}</b>, prognos ${kk(m.prognos)}.`; mmast = m.nasta && m.kravNasta ? `<b>${kk(m.kravNasta)} per pass</b> för ${m.nasta.pct} % bonus.` : 'Du är på högsta nivån.'; }
    else if (isNu) { mkan = `Prognos <b>${kk(m.prognos)}</b> · ${reach ? `räcker till <b>${reach.pct} % bonus</b>` : 'under bonusnivå'}.`; mmast = m.nasta && m.kravNasta ? `<b>${kk(m.kravNasta)} per pass</b> i ${m.rW} pass för ${m.nasta.pct} % bonus.` : (m.krav ? `<b>${kk(m.krav)} per pass</b> för målet.` : 'Inga pass kvar.'); }
    else { mkan = `Slutade på <b>${kk(m.salt)}</b> (${pc(mf)} av målet).`; mmast = m.nu ? `Bonusnivå: <b>${m.nu.pct} %</b>.` : 'Ingen bonusnivå nådd.'; }
    // ---- rutor ----
    let np = null;
    for (let i = 1, dd = new Date(realToday); i <= 21; i++) { dd.setDate(dd.getDate() + 1); const k2 = keyOf(dd), q = db.q[k2] || {}, o2 = db.d[k2] || {}; if (q.start && !o2.abs && o2.st !== 'Ledig') { np = { k: k2, d: new Date(dd), q, mal: dayTarget(k2) }; break; } }
    const bonusV = m.nu && !m.nasta ? `${m.nu.pct} %` : m.nasta ? `${m.nasta.pct} %` : '—';
    const bonusS = m.nu && !m.nasta ? 'högsta nivån' : m.nasta ? `${kk(m.nasta.min - m.salt)} kvar` : 'inga nivåer';
    // ---- bonusstegen ----
    const satt = (typeof savedBudgets !== 'undefined' && savedBudgets[`${m.cy}-${m.cm}`]) || null;
    const topT = Math.max(1, ...m.steg.map(t => t.min), m.mal), skala = topT * 1.06, pos = x => Math.max(0, Math.min(100, x / skala * 100));
    const nod = m.steg.map(t => {
      const ok = m.salt >= t.min, vald = satt ? Number(satt) === Number(t.min) : t.pct === 12;
      return `<button class="nd${ok ? ' ok' : ''}${vald ? ' vald' : ''}" style="left:${pos(t.min).toFixed(1)}%" onclick="fxBonus(${Number(t.min)})" aria-label="${t.pct} procent bonus"><b>${t.pct} %</b><i>${ok ? ic('check') : vald ? ic('flag') : ''}</i><small>${kk(t.min)}</small></button>`;
    }).join('');
    const vnr = (() => { const t = new Date(d); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); const j = new Date(t.getFullYear(), 0, 4); return 1 + Math.round(((t - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7); })();
    return `
      <section class="fx-flip" id="fx-flip">
        <div class="fx-card3${vand ? ' vand' : ''}">
          <div class="fx-face fram">
            <div class="fx-fh"><span>${arIdag ? 'Idag' : DAG[d.getDay()] + ' ' + d.getDate() + ' ' + MAN[d.getMonth()].slice(0, 3)} och månaden</span><button class="fx-dots" onclick="fxVand()" aria-label="Vänd till månaden"><i class="on"></i><i></i></button></div>
            <div class="fx-g3">${dagKol}${manKol}${krKol}</div>
            <div class="fx-say">${rad('k', kan)}${rad('m', mast)}</div>
          </div>
          <div class="fx-face bak">
            <div class="fx-fh"><span>${stor(MAN[m.cm - 1])} · prognos</span><button class="fx-dots" onclick="fxVand()" aria-label="Vänd tillbaka"><i></i><i class="on"></i></button></div>
            <div class="fx-g3">${veckaKol}${progKol}${chansKol}</div>
            <div class="fx-say">${rad('k', mkan)}${rad('m', mmast)}</div>
          </div>
        </div>
      </section>
      <section class="fx-t3">
        <div class="fx-t g"><span>Prognos</span><b>${kk(m.prognos)}</b><small>${m.mal > 0 ? pc(pf) + ' av målet' : ''}</small></div>
        <button class="fx-t k" onclick="fxSlot(true)"><span>${m.nu && !m.nasta ? 'Bonus' : 'Nästa bonus'}</span><b>${bonusV}</b><small>${bonusS}</small></button>
        ${np ? `<button class="fx-t b" onclick="fxDag('${np.k}')"><span>Nästa pass</span><b>${DAG[np.d.getDay()].slice(0, 3)} ${np.d.getDate()}</b><small>mål ${np.mal ? kk(np.mal) : '—'} · ${String(np.q.start).slice(0, 5)}</small></button>` : `<div class="fx-t b"><span>Nästa pass</span><b>—</b><small>inget i schemat</small></div>`}
      </section>
      <section class="fx-slot${slot ? ' b' : ''}" id="fx-slot">
        <button class="fx-slh" onclick="fxSlot()"><span class="a">Vecka ${vnr}</span><span class="b">Bonussystem · tryck för att välja mål</span><i class="dots"><em></em><em></em></i></button>
        <div class="fx-sltr"><div class="p">${veckorad(k)}</div><div class="p"><div class="fx-lad"><div class="lt"><i class="lf fx-fill" data-w="${pos(m.salt).toFixed(1)}"></i>${nod}</div></div></div></div>
      </section>`;
  }
  window.fxVand = function () { vand = !vand; const c = document.querySelector('#fx .fx-card3'); if (c) c.classList.toggle('vand', vand); try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
  window.fxSlot = function (till) { slot = typeof till === 'boolean' ? till : !slot; const s = $('fx-slot'); if (s) s.classList.toggle('b', slot); };
  window.fxBonus = function (min) {
    const key = `${viewDate.getFullYear()}-${viewDate.getMonth() + 1}`;
    const satt = typeof savedBudgets !== 'undefined' ? savedBudgets[key] : null;
    if (Number(satt) === Number(min)) { setGlobalBudget(null); showToast('✓', 'Målet följer bonustrappan', 1800); }
    else { setGlobalBudget(min); showToast('✓', 'Månadsmål ' + Number(min).toLocaleString('sv-SE') + ' kr', 1800); }
  };

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
  bygg(); try { if (typeof hemLage !== 'undefined' && hemLage !== 'dag') setHemLage('dag'); } catch (e) {} schema();
  window.addEventListener('load', schema);
  setTimeout(schema, 900);
})();
