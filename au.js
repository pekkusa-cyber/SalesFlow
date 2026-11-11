// ============================================================
// SalesFlow — AURORA-startsidan
// En helt ny startsida som ersätter den gamla. All data och logik kommer
// från script.js (db, malVy, dayTarget, getBudgetForMonth, pushMatrixSync …);
// den här filen ritar bara. Gamla startsidans DOM finns kvar dold så att
// befintlig kod som skriver till den inte går sönder.
// ============================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const kr = n => Math.round(n).toLocaleString('sv-SE');
  const kk = n => (Math.round(n / 100) / 10).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const DAG = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  const KORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  const keyOf = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const dateOf = k => { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const ICON = n => `<span class="material-symbols-rounded">${n}</span>`;

  // ---------- skelett ----------
  const R = 92, C = 2 * Math.PI * R, ARC = C * 0.75;
  function bygg() {
    if ($('au')) return;
    const el = document.createElement('main');
    el.id = 'au'; el.className = 'au';
    el.innerHTML = `
      <header class="au-top">
        <div class="au-ttl"><small id="au-sub"></small><h1 id="au-title">Översikt</h1></div>
        <div class="au-acts">
          <button class="au-ib" onclick="openCoachModalMain()" aria-label="Säljcoach">${ICON('auto_awesome')}</button>
          <button class="au-ib" onclick="openBudgetModal()" aria-label="Inställningar">${ICON('settings')}</button>
        </div>
      </header>
      <div class="au-scroll">
        <section class="au-hero au-glass">
          <div class="au-hrow">
            <div class="au-seg" id="au-seg"><i></i><button data-l="dag">Dag</button><button data-l="manad">Månad</button></div>
            <button id="au-relief" class="au-relief" onclick="toggleReliefMode()" hidden></button>
          </div>
          <div class="au-gauge">
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <defs><linearGradient id="au-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="var(--au-g1)"/><stop offset="1" stop-color="var(--au-g2)"/></linearGradient></defs>
              <circle class="au-track" cx="110" cy="110" r="${R}" stroke-dasharray="${ARC} ${C}" transform="rotate(135 110 110)"/>
              <circle id="au-prog" class="au-prog" cx="110" cy="110" r="${R}" stroke-dasharray="${ARC} ${C}" stroke-dashoffset="${ARC}" transform="rotate(135 110 110)"/>
              <g id="au-ticks"></g>
            </svg>
            <div class="au-gc"><b id="au-big">0</b><small id="au-of"></small><span id="au-state"></span></div>
          </div>
          <div class="au-stats" id="au-stats"></div>
        </section>
        <section class="au-weekbox">
          <div class="au-wkhead"><span id="au-wk"></span><div><button class="au-mini" data-w="-1" aria-label="Förra veckan">${ICON('chevron_left')}</button><button class="au-mini" data-w="1" aria-label="Nästa vecka">${ICON('chevron_right')}</button></div></div>
          <div class="au-week" id="au-week"></div>
        </section>
        <section id="au-main" class="au-main"></section>
      </div>`;
    document.body.appendChild(el);

    const pad = document.createElement('div');
    pad.id = 'au-pad'; pad.className = 'au-sheet';
    pad.innerHTML = `<div class="au-sheet-panel au-glass">
        <div class="au-pad-top"><button class="au-ib" data-p="x" aria-label="Stäng">${ICON('close')}</button><span id="au-pad-dag"></span><span style="width:42px"></span></div>
        <div class="au-pad-disp"><b id="au-pad-v">0</b><small>kr</small></div>
        <div class="au-pad-hint" id="au-pad-hint"></div>
        <div class="au-keys">${['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(x => `<button data-k="${x}">${x}</button>`).join('')}</div>
        <button class="au-save" data-p="ok">Spara</button>
      </div>`;
    document.body.appendChild(pad);

    // händelser
    el.querySelector('#au-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setHemLage(b.dataset.l); });
    el.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => flyttaVecka(+b.dataset.w)));
    const wk = $('au-week'); let sx = 0, sy = 0;
    wk.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    wk.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) flyttaVecka(dx < 0 ? 1 : -1); }, { passive: true });
    pad.addEventListener('click', e => {
      if (e.target === pad) return stangPad();
      const k = e.target.closest('[data-k]'); if (k) return tryck(k.dataset.k);
      const p = e.target.closest('[data-p]'); if (!p) return;
      if (p.dataset.p === 'x') stangPad(); else sparaPad();
    });
  }

  // ---------- beräkningar (samma som updateDash) ----------
  function manad() {
    const cy = viewDate.getFullYear(), cm = viewDate.getMonth() + 1, dim = new Date(cy, cm, 0).getDate();
    const b = getBudgetForMonth(cy, cm);
    let tS = 0, dP = 0, tP = 0, rW = 0, sAvsl = 0, dAvsl = 0, sIdag = 0, idagPass = false; const dagar = [];
    for (let d = 1; d <= dim; d++) {
      const k = `${cy}-${cm}-${d}`, o = db.d[k] || { s: 0 }, q = db.q[k] || {}, dObj = new Date(cy, cm - 1, d), s = o.s || 0;
      const arIdag = dObj.getTime() === realToday.getTime();
      tS += s; if (s > 0) dP++;
      if (dObj < realToday) { sAvsl += s; if (s > 0) dAvsl++; } else if (arIdag) sIdag = s;
      if ((q.start || s > 0) && !isMeetingDay(k)) { tP++; if (dObj >= realToday) rW++; if (arIdag) idagPass = true; }
      dagar.push({ d, k, s, mal: dayTarget(k), abs: o.abs, fram: dObj >= realToday, idag: arIdag });
    }
    let avg = dAvsl ? sAvsl / dAvsl : 0;
    if (!avg) { const f = new Date(cy, cm - 2, 1); avg = snittPerPass(f.getFullYear(), f.getMonth() + 1); }
    if (!avg) avg = dP ? tS / dP : 0;
    const prognos = sAvsl + (idagPass ? Math.max(sIdag, avg) : sIdag) + avg * Math.max(0, rW - (idagPass ? 1 : 0));
    const ratio = getMonthlyBonusReliefRatio(cy, cm) || 0, lattat = dashRelief && ratio > 0;
    const mal = lattat ? Math.round(b * (1 - ratio)) : b;
    let steg = [];
    try { steg = (lattat ? lonAdjustedTiers(cy, cm).tiers : lonTiersForMonth(cm)).filter(t => +t.min > 0).sort((a, c) => a.min - c.min); } catch (e) {}
    return { cy, cm, dim, salt: tS, mal, prognos, rW, tP, ratio, lattat, steg, dagar, avg,
      krav: tS >= mal && mal > 0 ? 0 : (rW > 0 ? (mal - tS) / rW : null) };
  }

  // ---------- räkna upp tal ----------
  const tal = new WeakMap();
  function rakna(el, till, fmt) {
    const fran = tal.has(el) ? tal.get(el) : 0; tal.set(el, till);
    if (fran === till || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(till); return; }
    const t0 = performance.now(), dur = 650;
    (function steg(t) { const f = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - f, 3); el.textContent = fmt(fran + (till - fran) * e); if (f < 1) requestAnimationFrame(steg); })(t0);
  }
  function ring(f, klar) {
    const p = $('au-prog'); if (!p) return;
    p.style.strokeDashoffset = ARC * (1 - Math.max(0, Math.min(1, f)));
    p.classList.toggle('klar', !!klar);
  }

  // ---------- rita ----------
  let lage0 = null, dag0 = null;
  function rita() {
    if (!$('au') || typeof db === 'undefined' || !db.d) return;
    const dag = hemLage === 'dag', k = hemDag(), d = dateOf(k), m = manad();
    const seg = $('au-seg'); seg.dataset.on = dag ? 'dag' : 'manad';
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.l === (dag ? 'dag' : 'manad')));
    const arIdag = d.getTime() === realToday.getTime();
    $('au-sub').textContent = dag ? (arIdag ? 'Idag' : DAG[d.getDay()]) : `${MAN[m.cm - 1][0].toUpperCase() + MAN[m.cm - 1].slice(1)} ${m.cy}`;
    $('au-title').textContent = dag ? `${d.getDate()} ${MAN[d.getMonth()]}` : 'Översikt';

    const ticks = $('au-ticks'); let tk = '';
    if (dag) {
      const v = malVy(k), tid = uiTidKvar(k), kvar = Math.max(0, v.bas - v.salt);
      rakna($('au-big'), v.salt, kr);
      $('au-of').textContent = v.bas > 0 ? `av ${kr(v.bas)} kr` : 'inget dagsmål';
      const st = $('au-state');
      st.textContent = !(v.bas > 0) ? (v.salt > 0 ? 'Registrerat' : 'Inget mål') : v.lage === 'jagar' ? `Jagar · ${Math.round(v.salt / v.bas * 100)} %` : v.lage === 'boost' ? 'Boost' : 'Dagsmålet klart';
      st.className = v.bas > 0 && v.lage !== 'jagar' ? 'ok' : '';
      ring(v.bas > 0 ? v.salt / (v.bas + (v.boost || 0)) : 0, v.bas > 0 && v.salt >= v.bas);
      const tim = tid ? Math.floor(tid / 60) + ' h ' + String(tid % 60).padStart(2, '0') : '—';
      const perTim = tid > 0 && kvar > 0 ? kr(kvar / (tid / 60)) : '—';
      stats([['Dagsmål', v.bas > 0 ? kk(v.bas) : '—'], ['Kvar', v.bas > 0 ? (kvar > 0 ? kr(kvar) : '✓') : '—'], ['Per timme', perTim], ['Tid kvar', tim]]);
      $('au-relief').hidden = true;
    } else {
      rakna($('au-big'), m.salt, kr);
      $('au-of').textContent = `av ${kr(m.mal)} kr`;
      const nu = m.steg.filter(t => m.salt >= t.min).pop(), ifas = m.prognos >= m.mal;
      const st = $('au-state'); st.textContent = nu ? `${nu.pct} % bonus nådd` : ifas ? 'I fas' : 'Efter'; st.className = nu || ifas ? 'ok' : 'efter';
      ring(m.mal > 0 ? m.salt / m.mal : 0, m.salt >= m.mal && m.mal > 0);
      m.steg.forEach(t => { const f = m.mal > 0 ? t.min / m.mal : 2; if (f > 1.001) return; const a = (135 + 270 * f) * Math.PI / 180; tk += `<line x1="${110 + 80 * Math.cos(a)}" y1="${110 + 80 * Math.sin(a)}" x2="${110 + 104 * Math.cos(a)}" y2="${110 + 104 * Math.sin(a)}"/>`; });
      stats([['Krävs/pass', m.krav === 0 ? '✓' : m.krav == null ? '—' : kk(m.krav)], ['Prognos', kk(m.prognos)], ['Pass kvar', `${m.rW}`], ['Läge', m.mal > 0 ? Math.round(m.salt / m.mal * 100) + ' %' : '—']]);
      const rp = $('au-relief'); rp.hidden = !(m.ratio > 0);
      if (m.ratio > 0) { rp.textContent = (m.lattat ? 'Lättat ' : 'Ordinarie ') + '−' + Math.round(m.ratio * 100) + ' %'; rp.classList.toggle('on', m.lattat); }
    }
    ticks.innerHTML = tk;
    vecka(k);
    const main = $('au-main');
    main.innerHTML = dag ? arbete(k) : oversikt(m);
    if (lage0 !== hemLage || dag0 !== k) { main.classList.remove('in'); void main.offsetWidth; main.classList.add('in'); }
    lage0 = hemLage; dag0 = k;
  }
  function stats(rader) { $('au-stats').innerHTML = rader.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join(''); }

  function vecka(valt) {
    const start = new Date(currentWeekStart); start.setHours(0, 0, 0, 0);
    const vnr = (() => { const t = new Date(start); t.setDate(t.getDate() + 3); const j = new Date(t.getFullYear(), 0, 4); return 1 + Math.round(((t - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7); })();
    $('au-wk').textContent = `Vecka ${vnr}`;
    let h = '';
    for (let i = 0; i < 7; i++) {
      const dd = new Date(start); dd.setDate(start.getDate() + i);
      const k = keyOf(dd), o = db.d[k] || {}, q = db.q[k] || {}, s = o.s || 0, mal = dayTarget(k);
      let cls = '', under = '';
      if (o.abs) { const t = String(o.abs).split(' ')[0]; cls = 'abs'; under = `<i class="au-dot d-${t.toLowerCase().replace(/[^a-zåäö]/g, '')}"></i>`; }
      else if (s > 0) { cls = mal > 0 && s >= mal ? 'hit' : 'sold'; under = kk(s); }
      else if (o.st === 'Ledig' || (!q.start && dd < realToday)) { cls = 'off'; under = 'Ledig'; }
      else if (q.start) { under = String(q.start).slice(0, 5); }
      else { cls = 'off'; under = 'Ledig'; }
      if (dd.getTime() === realToday.getTime()) cls += ' idag';
      if (k === valt && hemLage === 'dag') cls += ' on';
      h += `<button class="au-d ${cls}" onclick="goToDayDash('${k}');setHemLage('dag')"><span>${KORT[dd.getDay()]}</span><b>${dd.getDate()}</b><small>${under}</small></button>`;
    }
    $('au-week').innerHTML = h;
  }
  function flyttaVecka(dir) {
    const d = dateOf(hemDag()); d.setDate(d.getDate() + 7 * dir);
    goToDayDash(keyOf(d));
  }

  const STATUS = [['Arbete', 'work', 'Arbete'], ['Ledig', 'weekend', 'Ledig'], ['Semester', 'beach_access', 'Semester'], ['Sjuk', 'sick', 'Sjuk'], ['VAB', 'child_care', 'VAB'], ['Föräldraledig', 'stroller', 'Föräldraledig']];
  function arbete(k) {
    const o = db.d[k] || {}, v = malVy(k), p = uiPass(k);
    const aktiv = o.abs ? String(o.abs).split(' ')[0] : (o.st === 'Ledig' ? 'Ledig' : 'Arbete');
    const info = o.abs ? esc(o.abs) : p ? `Pass ${p.start}–${p.slut}` : 'Inget pass i schemat';
    const sub = v.bas > 0 ? (v.salt < v.bas ? `${kr(v.bas - v.salt)} kr kvar till dagsmålet` : 'Dagsmålet är nått') : 'Tryck för att skriva belopp';
    return `
      <div class="au-entry au-glass" onclick="auPad()">
        <div><small>${info}</small><b>${kr(v.salt)} kr</b><span>${sub}</span></div>
        <button class="au-add" onclick="event.stopPropagation();auPad()" aria-label="Lägg till belopp"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
      </div>
      <div class="au-quick">
        <button class="au-glass" onclick="uiLagg(1000)">+1 000</button><button class="au-glass" onclick="uiLagg(2500)">+2 500</button><button class="au-glass" onclick="uiLagg(5000)">+5 000</button>
        <button class="au-glass" onclick="document.getElementById('gm-camera-input').click()">${ICON('document_scanner')}</button>
      </div>
      <div class="au-chips">${STATUS.map(s => `<button class="au-chip au-glass${aktiv === s[0] ? ' on' : ''}" onclick="uiStatus('${s[0]}')">${ICON(s[1])}${s[2]}</button>`).join('')}</div>
      <div class="au-tools">
        <button class="au-tool au-glass" onclick="uiBoost()">${ICON('bolt')}Boost</button>
        <button class="au-tool au-glass" onclick="uiEval()">${ICON('rate_review')}Utvärdera</button>
        <button class="au-tool au-glass" onclick="openFocusMode2()">${ICON('center_focus_strong')}Fokus</button>
      </div>`;
  }
  function oversikt(m) {
    const max = Math.max(1, ...m.dagar.map(x => Math.max(x.s, x.mal)));
    const bars = m.dagar.map((x, i) => {
      let c = 'f', h = 3;
      if (x.abs && !x.s) { c = 'a'; h = 8; }
      else if (x.s > 0) { c = x.mal > 0 && x.s >= x.mal ? 'h' : 'm'; h = Math.max(4, x.s / max * 100); }
      else if (x.fram && x.mal > 0) { c = 'p'; h = Math.max(4, x.mal / max * 100); }
      return `<button class="au-b ${c}${x.idag ? ' idag' : ''}" style="--h:${h.toFixed(1)}%;--i:${i}" onclick="goToDayDash('${x.k}');setHemLage('dag')" aria-label="${x.d}"><i></i></button>`;
    }).join('');
    const tiles = m.steg.map(t => { const nadd = m.salt >= t.min; return `<div class="au-tier au-glass${nadd ? ' nadd' : ''}"><b>${t.pct} %</b><span>${kr(t.min)}</span><small>${nadd ? 'Nådd' : kk(t.min - m.salt) + ' kvar'}</small></div>`; }).join('');
    return `
      <div class="au-chart au-glass">
        <div class="au-ch-head"><b>Dag för dag</b><span><i class="h"></i>nått <i class="m"></i>under <i class="a"></i>frånvaro</span></div>
        <div class="au-bars">${bars}</div>
        <div class="au-axis"><span>1</span><span>${Math.ceil(m.dim / 2)}</span><span>${m.dim}</span></div>
      </div>
      <div class="au-tiers">${tiles}</div>`;
  }

  // ---------- beloppsark ----------
  let padV = '', padNy = true;
  window.auPad = function () {
    const k = hemDag(); activeK = k;
    const o = db.d[k] || {}; padV = o.s > 0 ? String(o.s) : ''; padNy = true;
    const d = dateOf(k); $('au-pad-dag').textContent = `${DAG[d.getDay()]} ${d.getDate()} ${MAN[d.getMonth()]}`;
    visaPad(); $('au-pad').classList.add('open');
  };
  function visaPad() {
    $('au-pad-v').textContent = padV ? kr(+padV) : '0';
    const v = malVy(hemDag()), ny = +padV || 0;
    $('au-pad-hint').textContent = v.bas > 0 ? (ny < v.bas ? `${kr(v.bas - ny)} kr kvar till dagsmålet` : 'Dagsmålet nås') : 'Dagens totala försäljning';
  }
  function tryck(x) {
    if (x === 'C') padV = ''; else if (x === '⌫') padV = padV.slice(0, -1);
    else { if (padNy) padV = ''; if (padV.length < 7) padV = (padV + x).replace(/^0+/, ''); }
    padNy = false; visaPad();
  }
  function stangPad() { $('au-pad').classList.remove('open'); }
  function sparaPad() {
    const k = hemDag(), val = +padV || 0, ex = db.d[k] || {};
    if (ex.abs) pushMatrixSync(k, { s: val }); else pushMatrixSync(k, { s: val, st: 'Arbete', abs: null });
    stangPad();
  }

  // ---------- koppla in ----------
  let kö = 0;
  const schema = () => { if (kö) return; kö = requestAnimationFrame(() => { kö = 0; try { rita(); } catch (e) { console.error(e); } }); };
  window.auRita = schema;
  ['updateDash', 'updateDashboardView', 'renderWeekSlides', 'ritaHem', 'pushMatrixSync', 'goToDayDash', 'toggleReliefMode'].forEach(n => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function () { const r = f.apply(this, arguments); schema(); return r; };
    try { if (n === 'updateDash') updateDash = window[n]; if (n === 'pushMatrixSync') pushMatrixSync = window[n]; if (n === 'renderWeekSlides') renderWeekSlides = window[n]; if (n === 'updateDashboardView') updateDashboardView = window[n]; } catch (e) {}
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schema(); });
  setInterval(schema, 60000);
  document.documentElement.classList.add('au-on');
  bygg(); schema();
  window.addEventListener('load', schema);
  setTimeout(schema, 800);
})();
