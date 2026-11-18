/* Ångra: efter varje ändring av en dag (sälj, frånvaro, ledig, flera dagar) visas en
   liten ruta med "Ångra" i sex sekunder. Läggs som ett lager runt pushMatrixSync, så alla
   ställen som sparar en dag får det utan att varje ställe behöver ändras. */
(function () {
  'use strict';
  if (typeof pushMatrixSync !== 'function' || typeof db === 'undefined') return;
  const orig = pushMatrixSync;
  const kr = n => Math.round(n).toLocaleString('sv-SE') + ' kr';
  let grupp = null, ater = false, bar = null, timer = null, senaste = null;

  // ändringar som sker inom 350 ms hör ihop (t.ex. flera markerade dagar)
  function avsluta() {
    const g = grupp; grupp = null; if (!g || !g.poster.length) return;
    // ändrade ingenting? visa ingenting
    const ändrad = g.poster.some(p => JSON.stringify(slim(p.gammal)) !== JSON.stringify(slim(db.d[p.k])));
    if (!ändrad) return;
    senaste = g.poster;
    visa(etikett(g.poster));
  }
  const slim = o => o ? { st: o.st || 'Arbete', s: o.s || 0, abs: o.abs || null, h: o.abs_hours || null } : { st: 'Arbete', s: 0, abs: null, h: null };

  function etikett(poster) {
    if (poster.length > 1) return `${poster.length} dagar ändrade`;
    const p = poster[0], a = slim(p.gammal), b = slim(db.d[p.k]);
    if (a.abs !== b.abs) {
      if (!b.abs) return a.abs === 'Ledig' ? 'Markerad som arbetsdag' : 'Frånvaro borttagen';
      if (b.abs === 'Ledig') return 'Markerad som ledig';
      return 'Frånvaro sparad';
    }
    if (a.s !== b.s) {
      const d = b.s - a.s;
      return d >= 0 ? `Sälj sparat · +${kr(d)}` : `Sälj ändrat · ${kr(d)}`;
    }
    return 'Ändring sparad';
  }

  function skapaBar() {
    if (bar) return bar;
    bar = document.createElement('div'); bar.id = 'sf-undo'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span class="u-t"></span><button type="button" class="u-b">Ångra</button>';
    bar.querySelector('.u-b').addEventListener('click', angra);
    document.body.appendChild(bar);
    return bar;
  }
  function visa(text) {
    const b = skapaBar(); b.classList.remove('klar'); b.querySelector('.u-t').textContent = text;
    b.classList.remove('ut'); void b.offsetWidth; b.classList.add('in');
    clearTimeout(timer); timer = setTimeout(dolj, 6000);
  }
  function dolj() { if (bar) { bar.classList.remove('in'); bar.classList.add('ut'); } senaste = null; }

  function angra() {
    const poster = senaste; if (!poster) return;
    ater = true;
    try {
      poster.forEach(p => {
        const g = p.gammal || {};
        orig(p.k, { st: g.st || 'Arbete', s: g.s || 0, abs: g.abs || null, abs_hours: g.abs_hours || null, raw: g.raw || '', fk_perc: g.fk_perc || null, src: g.src || 'Manual' });
      });
    } finally { ater = false; }
    senaste = null; clearTimeout(timer);
    if (bar) { bar.querySelector('.u-t').textContent = 'Ångrat'; bar.classList.add('klar'); }
    timer = setTimeout(() => { dolj(); if (bar) bar.classList.remove('klar'); }, 1100);
  }

  window.pushMatrixSync = pushMatrixSync = function (k) {
    if (!ater) {
      if (!grupp) { grupp = { poster: [] }; setTimeout(avsluta, 350); }
      if (!grupp.poster.some(p => p.k === k)) grupp.poster.push({ k, gammal: db.d[k] ? JSON.parse(JSON.stringify(db.d[k])) : null });
    }
    return orig.apply(this, arguments);
  };
  window.fxAngra = angra;
})();
