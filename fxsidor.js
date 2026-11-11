// ============================================================
// SalesFlow — FOKUS, undersidorna
// 1. Emojis byts mot riktiga ikoner överallt (kalender, lön, anteckningar …)
// 2. Ny frånvarosida och ett nytt inläggningsflöde på en skärm
// Logiken (fvPerioder, fvTyp, pushMatrixSync …) kommer från script.js.
// ============================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ic = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}">${n}</span>`;

  // ---------- 1. emojis → ikoner ----------
  const EMO = [
    ['⚠️', 'error', 'atg'], ['⚠', 'error', 'atg'], ['👶', 'child_care', 'vab'], ['👧', 'child_care', 'vab'], ['🍼', 'stroller', 'fl'], ['🤒', 'sick', 'sjuk'],
    ['✈️', 'beach_access', 'sem'], ['✈', 'beach_access', 'sem'], ['🏠', 'weekend', 'ledig'], ['🏢', 'work_off', 'tl'], ['💼', 'work', ''],
    ['🔑', 'key', 'key'], ['🔀', 'swap_horiz', 'key'], ['📞', 'call', ''], ['📦', 'inventory_2', ''], ['⏳', 'schedule', ''], ['⌛', 'schedule', ''],
    ['🔴', 'priority_high', 'bad'], ['🧾', 'receipt_long', ''], ['🟡', '', ''], ['☀️', 'light_mode', ''], ['🌙', 'dark_mode', ''], ['📱', 'smartphone', ''],
    ['🎯', 'my_location', ''], ['📲', 'notifications_active', ''], ['✅', 'check_circle', 'ok'], ['🗑️', 'delete', ''], ['🔥', 'local_fire_department', 'am'],
    ['📷', 'photo_camera', ''], ['📅', 'event', ''], ['💡', 'lightbulb', ''], ['🤝', 'handshake', ''], ['👥', 'groups', ''], ['⭐', 'star', 'am'], ['🏆', 'emoji_events', 'am']
  ];
  const RX = new RegExp('(' + EMO.map(e => e[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'g');
  const SKIP = new Set(['TEXTAREA', 'INPUT', 'SCRIPT', 'STYLE', 'OPTION', 'SELECT']);
  function byt(rot) {
    if (!rot) return;
    const w = document.createTreeWalker(rot, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        const p = n.parentNode;
        if (!p || SKIP.has(p.nodeName) || p.isContentEditable || (p.classList && (p.classList.contains('material-symbols-rounded') || p.classList.contains('fx-emo')))) return NodeFilter.FILTER_REJECT;
        RX.lastIndex = 0; return RX.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const lista = []; while (w.nextNode()) lista.push(w.currentNode);
    lista.forEach(n => {
      const f = document.createDocumentFragment(); let last = 0; const s = n.nodeValue; RX.lastIndex = 0; let m;
      while ((m = RX.exec(s))) {
        if (m.index > last) f.appendChild(document.createTextNode(s.slice(last, m.index)));
        const e = EMO.find(x => x[0] === m[1]);
        if (e && e[1]) { const sp = document.createElement('span'); sp.className = 'material-symbols-rounded fx-emo' + (e[2] ? ' e-' + e[2] : ''); sp.textContent = e[1]; f.appendChild(sp); }
        last = m.index + m[0].length;
      }
      if (last < s.length) f.appendChild(document.createTextNode(s.slice(last).replace(/^\s+/, last ? ' ' : '')));
      n.parentNode.replaceChild(f, n);
    });
  }
  let ko = new Set(), tick = 0;
  function bevaka(id) {
    const el = $(id); if (!el) return;
    byt(el);
    new MutationObserver(() => { ko.add(el); if (!tick) tick = requestAnimationFrame(() => { tick = 0; ko.forEach(byt); ko.clear(); }); })
      .observe(el, { childList: true, subtree: true, characterData: true });
  }
  window.fxByt = byt;

  // ---------- 2. frånvaron ----------
  const TYP = {
    sem: { n: 'Semester', i: 'beach_access' }, sjuk: { n: 'Sjuk', i: 'sick' }, vab: { n: 'VAB', i: 'child_care' },
    fl: { n: 'Föräldraledig', i: 'stroller' }, tl: { n: 'Tjänstledig', i: 'work_off' }, atg: { n: 'Åtgärd krävs', i: 'error' }
  };
  try { FV_TYPER.forEach(x => { x.i = ic(TYP[x.c].i); }); } catch (e) {}
  const typAv = abs => { const t = fvTyp(abs); return t ? (TYP[t.c] ? Object.assign({ c: t.c }, TYP[t.c], { t: t.t }) : { c: 'tl', n: t.t, i: 'event_busy', t: t.t }) : null; };
  const KORT = d => `${d.getDate()} ${UI_MAN[d.getMonth()].slice(0, 3)}`;
  const intervall = (a, b) => KORT(a) + (a.getTime() !== b.getTime() ? ' – ' + KORT(b) : '');

  renderAbsence = function () {
    const pane = $('pane-absence'); if (!pane) return;
    const cy = viewDate.getFullYear(), cm = viewDate.getMonth() + 1, dim = new Date(cy, cm, 0).getDate();
    const per = fvPerioder(cy, cm);
    const bl = bonusLattnad(cy, cm), mal0 = getBudgetForMonth(cy, cm);
    const mal = bl.ratio > 0 ? Math.round(mal0 * (1 - bl.ratio)) : mal0;
    const sum = {}; let atgN = 0, atgDagar = [];
    per.forEach(p => { const t = typAv(p.abs); if (t.c === 'atg') { atgN += p.dagar.length; atgDagar = atgDagar.concat(p.dagar); } else sum[t.c] = (sum[t.c] || 0) + p.dagar.length; });
    const tot = Object.values(sum).reduce((a, b) => a + b, 0) + atgN;
    // månadskalender
    const forsta = (new Date(cy, cm - 1, 1).getDay() + 6) % 7;
    let cal = 'MTOTFLS'.split('').map(x => `<span>${x}</span>`).join('') + '<i></i>'.repeat(forsta);
    for (let d = 1; d <= dim; d++) {
      const k = `${cy}-${cm}-${d}`, o = db.d[k] || {}, t = o.abs && o.abs !== 'Ledig' ? typAv(o.abs) : null;
      const idag = new Date(cy, cm - 1, d).getTime() === realToday.getTime();
      cal += `<button class="${t ? 'f-' + t.c : ''}${idag ? ' idag' : ''}${o.abs === 'Ledig' ? ' ledig' : ''}" style="animation-delay:${d * 12}ms" onclick="fkDag('${k}')">${t ? ic(t.i) : ''}<b>${d}</b></button>`;
    }
    const tiles = Object.keys(sum).map(c => `<div class="fp-tile f-${c}">${ic(TYP[c].i)}<span>${TYP[c].n}</span><b>${sum[c]}</b></div>`).join('')
      + (atgN ? `<button class="fp-tile f-atg" onclick="fvStart(${JSON.stringify(atgDagar).replace(/"/g, '&quot;')})">${ic('error')}<span>Saknar typ</span><b>${atgN}</b><small>Tryck för att välja</small></button>` : '');
    pane.innerHTML = `<div class="fp">
      <section class="fp-hero"><div><span>Borta i ${UI_MAN[cm - 1]}</span><b>${tot} ${tot === 1 ? 'dag' : 'dagar'}</b><small>${bl.ratio > 0 ? `bonusmålet sänks ${Math.round(bl.ratio * 100)} % till ${mal.toLocaleString('sv-SE')} kr` : 'påverkar inte bonusmålet'}</small></div>
        <div class="r"><span>Lättnad</span><b>${bl.dagar} ${bl.dagar === 1 ? 'dag' : 'dagar'}</b></div></section>
      <section class="fp-cal">${cal}</section>
      ${tiles ? `<section class="fp-tiles">${tiles}</section>` : `<p class="fp-tom">Ingen frånvaro i ${UI_MAN[cm - 1]}. Tryck på en dag för att lägga in.</p>`}
      <button class="fp-add" onclick="fvStart()">${ic('add')}Lägg in frånvaro</button>
    </div>`;
    pane.classList.remove('kompakt'); if (pane.scrollHeight > pane.clientHeight + 1) pane.classList.add('kompakt');
  };

  // flödet: allt på en skärm
  const BARN = ['Belma', 'Wilma'];
  fvStart = function (forval) {
    fv = { typ: null, barn: null, a: null, b: null, hel: true, tim: '', man: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1) };
    if (Array.isArray(forval) && forval.length) {
      const s = forval.slice().sort((x, y) => uiDatum(x) - uiDatum(y));
      fv.a = s[0]; fv.b = s[s.length - 1];
      const o = db.d[s[0]] || {}, t = fvTyp(o.abs);
      if (t && t.c !== 'atg') { fv.typ = t.t; if (o.abs.includes(' ')) fv.barn = o.abs.split(' ').slice(1).join(' '); }
      if (o.abs_hours && !isWholeDayAbsence(s[0])) { fv.hel = false; fv.tim = String(o.abs_hours); }
      fv.man = new Date(uiDatum(s[0]).getFullYear(), uiDatum(s[0]).getMonth(), 1);
    }
    let el = $('fv-sheet');
    if (!el) { el = document.createElement('div'); el.id = 'fv-sheet'; el.className = 'ui-sheet'; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) fvStang(); }); }
    el.classList.add('open'); fvRita();
  };
  fvValjTyp = function (t) { fv.typ = t; const x = FV_TYPER.find(y => y.t === t); if (!x.barn) fv.barn = null; else if (!fv.barn) fv.barn = null; fvRita(); };
  fvValjBarn = function (b) { fv.barn = b; fvRita(); };
  window.fvSnabb = function (v) {
    const d = new Date(realToday), k = x => getK(x);
    if (v === 'idag') { fv.a = fv.b = k(d); }
    else if (v === 'imorgon') { d.setDate(d.getDate() + 1); fv.a = fv.b = k(d); }
    else if (v === 'veckan') { fv.a = k(d); const s = new Date(d); s.setDate(s.getDate() + (7 - (s.getDay() || 7))); fv.b = k(s); }
    else if (v === 'nasta') { const m = new Date(d); m.setDate(m.getDate() + (8 - (m.getDay() || 7))); const s = new Date(m); s.setDate(s.getDate() + 6); fv.a = k(m); fv.b = k(s); }
    fv.man = new Date(uiDatum(fv.a).getFullYear(), uiDatum(fv.a).getMonth(), 1);
    fvRita();
  };
  fvRita = function () {
    const el = $('fv-sheet'); if (!el || !fv) return;
    const t = fv.typ ? FV_TYPER.find(x => x.t === fv.typ) : null;
    const y = fv.man.getFullYear(), m = fv.man.getMonth() + 1, dim = new Date(y, m, 0).getDate();
    const forsta = (new Date(y, m - 1, 1).getDay() || 7) - 1;
    const valda = new Set(fvDagar());
    let cal = ['M', 'T', 'O', 'T', 'F', 'L', 'S'].map(x => `<span>${x}</span>`).join('') + '<i></i>'.repeat(forsta);
    for (let d = 1; d <= dim; d++) {
      const k = `${y}-${m}-${d}`, o = db.d[k] || {}, tt = o.abs && o.abs !== 'Ledig' ? typAv(o.abs) : null;
      const cls = [valda.has(k) ? 'val' : '', k === fv.a ? 'start' : '', k === fv.b ? 'slut' : '', tt ? 'har f-' + tt.c : '', (db.q[k] || {}).start ? 'pass' : '', new Date(y, m - 1, d).getTime() === realToday.getTime() ? 'idag' : ''].join(' ');
      cal += `<button class="${cls}" onclick="fvDag('${k}')">${d}</button>`;
    }
    const n = valda.size, behBarn = t && t.barn;
    const klar = t && n && (!behBarn || fv.barn) && (fv.hel || +String(fv.tim).replace(',', '.') > 0);
    const absStr = fv.typ ? fv.typ + (fv.barn ? ' ' + fv.barn : '') : '';
    el.innerHTML = `<div class="ui-panel fq">
      <div class="fq-top"><b>Lägg in frånvaro</b><button class="fq-x" onclick="fvStang()" aria-label="Stäng">${ic('close')}</button></div>
      <div class="fq-typer">${FV_TYPER.map(x => `<button class="f-${x.c}${fv.typ === x.t ? ' on' : ''}" onclick="fvValjTyp('${x.t}')">${ic(TYP[x.c].i)}<span>${x.c === 'fl' ? 'Föräldral.' : x.t}</span></button>`).join('')}</div>
      ${behBarn ? `<div class="fq-seg">${BARN.map(b => `<button class="${fv.barn === b ? 'on' : ''}" onclick="fvValjBarn('${b}')">${ic('child_care')}${b}</button>`).join('')}</div>` : ''}
      <div class="fq-snabb"><button onclick="fvSnabb('idag')">Idag</button><button onclick="fvSnabb('imorgon')">Imorgon</button><button onclick="fvSnabb('veckan')">Resten av veckan</button><button onclick="fvSnabb('nasta')">Nästa vecka</button></div>
      <div class="fq-cal">
        <div class="fq-ch"><button onclick="fvMan(-1)" aria-label="Förra månaden">${ic('chevron_left')}</button><b>${UI_MAN[m - 1]} ${y}</b><button onclick="fvMan(1)" aria-label="Nästa månad">${ic('chevron_right')}</button></div>
        <div class="fq-grid">${cal}</div>
      </div>
      <div class="fq-hel"><button class="${fv.hel ? 'on' : ''}" onclick="fv.hel=true;fvRita()">Hel dag</button><button class="${!fv.hel ? 'on' : ''}" onclick="fv.hel=false;fvRita()">Del av dag</button>
        ${fv.hel ? '' : `<input id="fv-tim" type="number" inputmode="decimal" min="0.25" max="12" step="0.25" placeholder="timmar" value="${uiEsc(fv.tim)}" oninput="fv.tim=this.value;document.querySelector('.fq-save').disabled=!(this.value>0&&${!!(t && n && (!behBarn || fv.barn))})">`}</div>
      <button class="fq-save" ${klar ? '' : 'disabled'} onclick="fvSpara()">${!t ? 'Välj typ av frånvaro' : behBarn && !fv.barn ? 'Välj barn' : !n ? 'Välj dag eller dagar' : `Spara ${uiEsc(absStr)} · ${n} ${n === 1 ? 'dag' : 'dagar'}`}</button>
    </div>`;
  };
  Object.assign(window, { fvStart, fvValjTyp, fvValjBarn, fvRita });

  // ---------- modaler som inte ska scrolla: anpassa tills allt får plats ----------
  function anpassa(id) {
    const m = $(id); if (!m) return;
    const kor = () => {
      const d = m.querySelector('.md-dialog'); if (!d || m.classList.contains('hidden')) return;
      d.classList.remove('fm1', 'fm2', 'fm3'); d.scrollTop = 0;
      for (const f of ['fm1', 'fm2', 'fm3']) { if (d.scrollHeight <= d.clientHeight + 1) break; d.classList.add(f); }
    };
    new MutationObserver(() => { setTimeout(kor, 80); setTimeout(kor, 450); }).observe(m, { attributes: true, attributeFilter: ['class'] });
  }
  window.fxAnpassa = anpassa;

  // ---------- starta ----------
  function start() {
    ['sheet-month', 'sheet-lon', 'notes-modal', 'budget-modal', 'summary-modal', 'lon-settings-modal', 'coach-main-modal', 'focus-mode', 'nt-form', 'lon-confirm-modal', 'child-select-modal', 'eval-modal']
      .forEach(bevaka);
    ['summary-modal', 'budget-modal'].forEach(anpassa);
    try { if (typeof viewMode !== 'undefined' && viewMode === 'absence') renderAbsence(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
