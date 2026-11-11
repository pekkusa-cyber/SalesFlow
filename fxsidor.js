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
    let remsa = '';
    for (let d = 1; d <= dim; d++) {
      const k = `${cy}-${cm}-${d}`, o = db.d[k] || {}, t = o.abs && o.abs !== 'Ledig' ? typAv(o.abs) : null;
      const idag = new Date(cy, cm - 1, d).getTime() === realToday.getTime();
      remsa += `<i class="${t ? 'f-' + t.c : ''}${idag ? ' idag' : ''}${o.abs_hours && !isWholeDayAbsence(k) ? ' del' : ''}" title="${d}"></i>`;
    }
    const sum = {}; per.forEach(p => { const t = typAv(p.abs); if (t.c !== 'atg') sum[t.c] = (sum[t.c] || 0) + p.dagar.length; });
    const latt = bonusLattnad(cy, cm).dagar, ratio = bonusLattnad(cy, cm).ratio;
    const atg = per.filter(p => typAv(p.abs).c === 'atg');
    const vanl = per.filter(p => typAv(p.abs).c !== 'atg');
    const tot = Object.values(sum).reduce((a, b) => a + b, 0);
    const chips = Object.keys(sum).map(c => `<span class="fp-chip f-${c}">${ic(TYP[c].i)}${c === 'fl' ? 'FL' : TYP[c].n}<b>${sum[c]}</b></span>`).join('');
    const atgHtml = atg.length ? `<button class="fp-atg" onclick="fvStart(${JSON.stringify(atg.flatMap(p => p.dagar)).replace(/"/g, '&quot;')})">${ic('error')}<div><b>${atg.reduce((n, p) => n + p.dagar.length, 0)} dagar saknar typ</b><small>${atg.map(p => intervall(uiDatum(p.dagar[0]), uiDatum(p.dagar[p.dagar.length - 1]))).join(', ')}</small></div><span>Välj typ</span></button>` : '';
    const rader = vanl.map(p => {
      const t = typAv(p.abs), a = uiDatum(p.fran), b = uiDatum(p.till);
      const delar = p.dagar.filter(k => (db.d[k] || {}).abs_hours && !isWholeDayAbsence(k));
      const tim = delar.reduce((n, k) => n + (+db.d[k].abs_hours || 0), 0);
      const ger = (t.c === 'sem' || t.c === 'fl') && p.dagar.some(k => lattnadPeriod(uiDatum(k)) >= LATTNAD_MIN_DAGAR);
      const barn = p.abs.includes(' ') ? p.abs.split(' ').slice(1).join(' ') : '';
      const id = p.dagar[0], oppen = fvOppen === id;
      const dag = JSON.stringify(p.dagar).replace(/"/g, '&quot;');
      return `<div class="fp-row${oppen ? ' open' : ''}" onclick="fvToggla('${id}')">
        <span class="fp-ic f-${t.c}">${ic(t.i)}</span>
        <div class="fp-t"><b>${t.n}${barn ? ' · ' + uiEsc(barn) : ''}</b><small>${intervall(a, b)}${delar.length ? ' · ' + String(Math.round(tim * 100) / 100).replace('.', ',') + ' h' : ''}${ger ? ' · <em>ger lättnad</em>' : ''}${p.ovrigt ? ' · ' + p.ovrigt + ' i grannmånad' : ''}</small></div>
        <div class="fp-n"><b>${p.dagar.length}</b><small>${p.dagar.length === 1 ? 'dag' : 'dgr'}</small></div>
        <div class="fp-act" onclick="event.stopPropagation()">
          <button onclick="fvStart(${dag})">${ic('edit')}Ändra</button>
          <button onclick="goToDayDash('${p.dagar[0]}');setHemLage('dag')">${ic('today')}Visa dag</button>
          <button class="del" onclick="fvTaBort(this, ${dag})">${ic('delete')}Ta bort</button>
        </div></div>`;
    }).join('');
    pane.innerHTML = `<div class="fp">
      <div class="fp-sum"><div><b>${tot}</b><span>${tot === 1 ? 'dag frånvaro' : 'dagar frånvaro'}</span></div><div><b>${latt}</b><span>lättnadsdagar</span></div><div><b>${ratio > 0 ? '−' + Math.round(ratio * 100) + ' %' : '—'}</b><span>lägre bonusmål</span></div></div>
      <div class="fp-remsa">${remsa}</div>
      <div class="fp-ax"><span>1</span><span>${Math.ceil(dim / 2)}</span><span>${dim}</span></div>
      ${chips ? `<div class="fp-chips">${chips}</div>` : ''}
      ${atgHtml}
      <div class="fp-list">${rader || `<div class="fp-tom">${ic('event_available')}<b>Ingen frånvaro i ${UI_MAN[cm - 1]}</b><small>Lägg in semester, sjukdag, VAB eller föräldraledighet nedan.</small></div>`}</div>
      <button class="fp-add" onclick="fvStart()">${ic('add')}Lägg in frånvaro</button>
    </div>`;
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

  // ---------- starta ----------
  function start() {
    ['sheet-month', 'sheet-lon', 'notes-modal', 'budget-modal', 'summary-modal', 'lon-settings-modal', 'coach-main-modal', 'focus-mode', 'nt-form', 'lon-confirm-modal', 'child-select-modal', 'eval-modal']
      .forEach(bevaka);
    try { if (typeof viewMode !== 'undefined' && viewMode === 'absence') renderAbsence(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
