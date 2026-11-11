// ============================================================
// SalesFlow — KALENDERN (rutnät + markering)
// Rent rutnät med veckonummer. Tryck på en dag: dagsfönster med
// Registrera sälj, Frånvaro, Ledig och Öppna dagen. Håll inne (eller
// tryck "Markera") och dra över dagar: list med frånvarotyper för alla.
// Gamla kalendern (#d-cal) ritas fortfarande men döljs – sammanfattningens
// fokusläge använder den.
// ============================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ic = n => `<span class="material-symbols-rounded">${n}</span>`;
  const kr = n => Math.round(n).toLocaleString('sv-SE');
  const kk = n => (Math.round(n / 100) / 10).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k';
  const MAN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const DAG = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  const AB = { vab: ['child_care', 'VAB'], fl: ['stroller', 'FL'], sjuk: ['sick', 'Sjuk'], sem: ['beach_access', 'Sem'], tl: ['work_off', 'TL'], atg: ['error', 'Typ?'] };
  const typ = abs => { if (!abs || abs === 'Ledig') return null; try { const t = fvTyp(abs); return t ? t.c : 'tl'; } catch (e) { return 'tl'; } };
  const keyOf = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const dateOf = k => { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const veckonr = d => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); const j = new Date(t.getFullYear(), 0, 4); return 1 + Math.round(((t - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7); };
  const stanger = (k, q) => { if (!q || !q.end) return false; const d = dateOf(k).getDay(), e = String(q.end).slice(0, 5); return (d === 0 || d === 6) ? e === '16:30' : e === '19:30'; };

  let val = new Set(), markerar = false;

  function rita(y, m) {
    const pane = $('pane-month'); if (!pane) return;
    let box = $('fk'); if (!box) { box = document.createElement('div'); box.id = 'fk'; pane.appendChild(box); kopplaGest(box); }
    const dim = new Date(y, m, 0).getDate();
    // summering
    let salt = 0, fr = 0, kvar = 0;
    for (let d = 1; d <= dim; d++) { const k = `${y}-${m}-${d}`, o = db.d[k] || {}, q = db.q[k] || {}; salt += o.s || 0; if (o.abs && o.abs !== 'Ledig') fr++; if (q.start && new Date(y, m - 1, d) >= realToday && !o.abs) kvar++; }
    const mal = getBudgetForMonth(y, m), r = getMonthlyBonusReliefRatio(y, m);
    // rutnät: från måndagen före den 1:a, 6 veckor
    const forsta = new Date(y, m - 1, 1), start = new Date(forsta); start.setDate(1 - ((forsta.getDay() + 6) % 7));
    let g = '';
    for (let w = 0; w < 6; w++) {
      const vd = new Date(start); vd.setDate(start.getDate() + w * 7);
      g += `<div class="fk-vn">${veckonr(vd)}</div>`;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + w * 7 + i);
        const k = keyOf(d), o = db.d[k] || {}, q = db.q[k] || {}, ut = d.getMonth() !== m - 1;
        const t = typ(o.abs), s = o.s || 0, dm = dayTarget(k), framtid = d >= realToday;
        let cls = ut ? 'ut' : '', inner = '';
        if (!ut) {
          if (t) { cls += ' ab f-' + t; inner = `<span class="fk-lab">${ic(AB[t][0])}${AB[t][1]}</span>`; if (s > 0) inner += `<span class="fk-val">${kk(s)}</span>`; }
          else if (s > 0) { const ok = dm > 0 && s >= dm; inner = `<span class="fk-val ${dm > 0 ? (ok ? 'ok' : 'lag') : ''}">${kk(s)}</span>${dm > 0 ? `<i class="fk-bar"><em class="${ok ? 'ok' : ''}" style="width:${Math.min(100, s / dm * 100)}%"></em></i>` : ''}`; }
          else if (o.st === 'Ledig' || o.abs === 'Ledig' || (!q.start && !s)) { cls += ' ledig'; inner = `<span class="fk-lab">Ledig</span>`; }
          else if (q.start) inner = `<span class="fk-tm">${String(q.start).slice(0, 5)}</span>${q.end ? `<span class="fk-tm e">${String(q.end).slice(0, 5)}</span>` : ''}`;
          if (stanger(k, q) && !t) inner += `<span class="fk-key">${ic('key')}</span>`;
          if (d.getTime() === realToday.getTime()) cls += ' idag';
          if (val.has(k)) cls += ' val';
        }
        g += `<button class="fk-d ${cls}" data-k="${ut ? '' : k}"><span class="fk-n">${d.getDate()}</span>${inner}</button>`;
      }
    }
    box.innerHTML = `
      <div class="fk-sum"><div><b>${uiK(salt)}</b><span>av ${uiK(mal)}</span></div><div><b>${kvar}</b><span>pass kvar</span></div><div><b>${fr}</b><span>frånvaro</span></div><div><b>${r > 0 ? '−' + Math.round(r * 100) + ' %' : '—'}</b><span>lättnad</span></div></div>
      <div class="fk-wk"><span></span>${'MTOTFLS'.split('').map(x => `<span>${x}</span>`).join('')}</div>
      <div class="fk-grid${markerar ? ' markerar' : ''}">${g}</div>
      <div class="fk-tips">${markerar ? 'Tryck eller dra över dagar för att markera' : 'Tryck på en dag · håll inne för att markera flera'}</div>`;
    ritaList();
  }

  // ---------- gester: tryck, håll inne, dra ----------
  function kopplaGest(box) {
    let tim = null, startK = null, drar = false, rorde = false, sx = 0, sy = 0;
    const kAt = (x, y) => { const el = document.elementFromPoint(x, y); const c = el && el.closest && el.closest('.fk-d'); return c && c.dataset.k ? c.dataset.k : null; };
    box.addEventListener('pointerdown', e => {
      const c = e.target.closest('.fk-d'); if (!c || !c.dataset.k) return;
      startK = c.dataset.k; rorde = false; sx = e.clientX; sy = e.clientY;
      if (markerar) { drar = true; vaxla(startK, true); return; }
      tim = setTimeout(() => { tim = null; markerar = true; drar = true; val = new Set([startK]); try { navigator.vibrate && navigator.vibrate(15); } catch (x) {} omrita(); }, 450);
    });
    box.addEventListener('pointermove', e => {
      if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) { rorde = true; if (tim) { clearTimeout(tim); tim = null; } }
      if (!drar) return;
      const k = kAt(e.clientX, e.clientY); if (k && !val.has(k)) { val.add(k); omrita(); }
    });
    const slut = e => {
      if (tim) { clearTimeout(tim); tim = null; if (!rorde && startK) oppnaDag(startK); }
      drar = false; startK = null;
    };
    box.addEventListener('pointerup', slut); box.addEventListener('pointercancel', () => { if (tim) clearTimeout(tim); tim = null; drar = false; });
    box.addEventListener('contextmenu', e => e.preventDefault());
  }
  function vaxla(k, forsta) { if (val.has(k) && forsta) val.delete(k); else val.add(k); if (!val.size) markerar = false; omrita(); }
  function omrita() { rita(viewDate.getFullYear(), viewDate.getMonth() + 1); }
  window.fkAvbryt = function () { val = new Set(); markerar = false; omrita(); };
  window.fkMarkera = function () { markerar = true; omrita(); };

  // ---------- markeringslisten ----------
  function ritaList() {
    let bar = $('fk-bar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'fk-bar'; document.body.appendChild(bar); }
    const open = $('sheet-month') && $('sheet-month').classList.contains('is-open');
    if (!markerar || !open) { bar.classList.remove('open'); return; }
    const ks = [...val].sort((a, b) => dateOf(a) - dateOf(b));
    const kort = d => `${d.getDate()} ${MAN[d.getMonth()].slice(0, 3)}`;
    const omr = ks.length ? (ks.length === 1 ? kort(dateOf(ks[0])) : kort(dateOf(ks[0])) + ' – ' + kort(dateOf(ks[ks.length - 1]))) : 'Inga dagar';
    bar.innerHTML = `<div class="fk-bt"><b>${ks.length} ${ks.length === 1 ? 'dag vald' : 'dagar valda'}</b><span>${omr}</span><button onclick="fkAvbryt()">Avbryt</button></div>
      <div class="fk-bb">
        <button class="f-vab" onclick="fkSatt('VAB')" ${ks.length ? '' : 'disabled'}>${ic('child_care')}VAB</button>
        <button class="f-fl" onclick="fkSatt('Föräldraledig')" ${ks.length ? '' : 'disabled'}>${ic('stroller')}Föräldral.</button>
        <button class="f-sem" onclick="fkSatt('Semester')" ${ks.length ? '' : 'disabled'}>${ic('beach_access')}Semester</button>
        <button class="f-sjuk" onclick="fkSatt('Sjuk')" ${ks.length ? '' : 'disabled'}>${ic('sick')}Sjuk</button>
        <button onclick="fkSatt('Ledig')" ${ks.length ? '' : 'disabled'}>${ic('weekend')}Ledig</button>
        <button onclick="fkSatt('Arbete')" ${ks.length ? '' : 'disabled'}>${ic('work')}Arbete</button>
      </div>`;
    bar.classList.add('open');
  }
  window.fkSatt = function (t) {
    const ks = [...val]; if (!ks.length) return;
    if (t === 'VAB' || t === 'Föräldraledig') { fkAvbryt(); fvStart(ks); fvValjTyp(t); return; }
    ks.forEach(k => {
      if (t === 'Arbete') pushMatrixSync(k, { abs: null, st: 'Arbete', abs_hours: null });
      else if (t === 'Ledig') pushMatrixSync(k, { abs: 'Ledig', st: 'Ledig', abs_hours: null });
      else pushMatrixSync(k, { abs: t, st: t, abs_hours: null, raw: '' });
    });
    showToast('✓', `${t} · ${ks.length} ${ks.length === 1 ? 'dag' : 'dagar'}`, 1800);
    fkAvbryt();
  };

  // ---------- dagsfönstret ----------
  function oppnaDag(k) {
    let el = $('fk-dag');
    if (!el) { el = document.createElement('div'); el.id = 'fk-dag'; el.className = 'fx-sheet'; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) stang(); }); }
    const d = dateOf(k), o = db.d[k] || {}, p = uiPass(k), v = malVy(k), t = typ(o.abs);
    const info = t ? `${o.abs}${o.abs_hours ? ' · ' + String(o.abs_hours).replace('.', ',') + ' h' : ''}` : p ? `Pass ${p.start}–${p.slut}${v.bas > 0 ? ' · mål ' + kr(v.bas) : ''}` : (o.st === 'Ledig' || o.abs === 'Ledig') ? 'Ledig' : 'Inget pass i schemat';
    const pct = v.bas > 0 ? Math.min(100, v.salt / v.bas * 100) : 0;
    const pill = t ? `<span class="fx-pill am">${AB[t][1] === 'Typ?' ? 'Saknar typ' : AB[t][1]}</span>` : v.bas > 0 ? `<span class="fx-pill ${v.salt >= v.bas ? 'ok' : 'ac'}">${v.salt >= v.bas ? 'Klart' : Math.round(pct) + ' %'}</span>` : '';
    el.innerHTML = `<div class="fx-panel fk-panel"><div class="fx-grab"></div>
      <div class="fk-dh"><div><b>${DAG[d.getDay()]} ${d.getDate()} ${MAN[d.getMonth()]}</b><small>${uiEsc(info)}</small></div>${pill}</div>
      <div class="fk-amt"><b>${kr(v.salt)}</b><em>kr</em></div>
      ${v.bas > 0 ? `<div class="fx-track fk-tr"><i class="fx-fill${v.salt >= v.bas ? ' ok' : ''}" style="width:${pct}%"></i></div>` : ''}
      <div class="fk-acts">
        <button class="pri" data-a="salj">${ic('add')}<span>Registrera sälj</span></button>
        <button data-a="franv">${ic('event_busy')}<span>${t ? 'Ändra frånvaro' : 'Frånvaro'}</span></button>
        <button data-a="${t ? 'ta' : 'ledig'}">${ic(t ? 'delete' : (o.st === 'Ledig' || o.abs === 'Ledig' ? 'work' : 'weekend'))}<span>${t ? 'Ta bort frånvaro' : (o.st === 'Ledig' || o.abs === 'Ledig' ? 'Arbete' : 'Ledig')}</span></button>
        <button data-a="oppna">${ic('open_in_new')}<span>Öppna dagen</span></button>
      </div></div>`;
    el.onclick = e => {
      if (e.target === el) return stang();
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a; stang();
      if (a === 'salj') { activeK = k; setTimeout(() => window.fxReg && window.fxReg('salj'), 150); }
      else if (a === 'franv') { setTimeout(() => fvStart(t ? franvPeriod(k) : [k]), 150); }
      else if (a === 'ta') { franvPeriod(k).length > 1 && t ? pushMatrixSync(k, { abs: null, st: 'Arbete', abs_hours: null }) : pushMatrixSync(k, { abs: null, st: 'Arbete', abs_hours: null }); }
      else if (a === 'ledig') { const ar = o.st === 'Ledig' || o.abs === 'Ledig'; pushMatrixSync(k, ar ? { abs: null, st: 'Arbete' } : { abs: 'Ledig', st: 'Ledig' }); }
      else if (a === 'oppna') { goToDayDash(k); setHemLage('dag'); }
    };
    requestAnimationFrame(() => el.classList.add('open'));
    function stang() { el.classList.remove('open'); }
  }
  // hela frånvaroperioden runt en dag (för "Ändra frånvaro")
  function franvPeriod(k) {
    const abs = (db.d[k] || {}).abs, ut = [k];
    const steg = (x, dir) => { const d = dateOf(x); d.setDate(d.getDate() + dir); return keyOf(d); };
    let a = k, b = k, x;
    while ((db.d[x = steg(a, -1)] || {}).abs === abs && ut.length < 60) { a = x; ut.unshift(x); }
    while ((db.d[x = steg(b, 1)] || {}).abs === abs && ut.length < 60) { b = x; ut.push(x); }
    return ut;
  }

  window.fkDag = oppnaDag;
  // ---------- koppla in ----------
  const rc = window.renderCal;
  window.renderCal = renderCal = function (y, m) { const r = rc.apply(this, arguments); try { rita(y, m); } catch (e) { console.error(e); } return r; };
  // listen följer om kalendern är öppen
  const sm = $('sheet-month');
  if (sm) new MutationObserver(() => { if (!sm.classList.contains('is-open') && markerar) { val = new Set(); markerar = false; } ritaList(); }).observe(sm, { attributes: true, attributeFilter: ['class'] });
})();
