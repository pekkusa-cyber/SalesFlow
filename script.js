// ==========================================
//  GLOBAL CORE VARIABLES
// ==========================================
let sb = null;
let db = { b: 240000, d: {}, q: {} };
let timeline = {};
let viewDate = new Date();
let realToday = new Date(); realToday.setHours(0,0,0,0);
let activeK = null;
let viewMode = 'dash';
let currentWeekStart = new Date(realToday);
const startDayOffset = currentWeekStart.getDay() || 7; 
currentWeekStart.setDate(currentWeekStart.getDate() - startDayOffset + 1);
currentWeekStart.setHours(0,0,0,0);
let multiSelectKeys = new Set();
let currentFocusReason = null;
let pendingAbsenceType = null;
let pendingAbsenceSource = null;

let savedNotes = [];
let savedBudgets = {};

let touchStartX = 0, touchStartY = 0;
let inlineNumpadValue = "";
let numpadTarget = null; let numpadValue = "";
let inlineNumpadJustOpened = false;
let mainNumpadJustOpened = false;

const evalMetrics = [
    { id: 'flow', label: 'Kundflöde' },
    { id: 'energy', label: 'Energi' },
    { id: 'engagement', label: 'Engagemang' },
    { id: 'closing', label: 'Avslut' },
    { id: 'upsell', label: 'Merförsäljning' }
];
let evalState = {};
let currentSummaryView = 'stats';

const SB_URL = 'https://xnrclzkzzthlesaftpvs.supabase.co';
const SB_KEY = 'sb_publishable_EhCyGN_p4TH-rtOEuDLXOA_9hIxS7pW';
try { if (typeof supabase !== 'undefined') { sb = supabase.createClient(SB_URL, SB_KEY); } } catch(e) { console.error(e); }

// ==========================================
//  HELPER FUNCTIONS
// ==========================================
function getK(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function parseNum(val) { if (val === undefined || val === null || val === '') return 0; if (typeof val === 'number') return val; let str = String(val).replace(/\s/g, '').replace(',', '.'); let num = parseFloat(str); return isNaN(num) ? 0 : num; }

function getBudgetForMonth(y, m) { return savedBudgets[`${y}-${m}`] || 240000; }

function setGlobalBudget(amount) { 
    let cy = viewDate.getFullYear(); let cm = viewDate.getMonth() + 1;
    let mKey = `${cy}-${cm}`;
    savedBudgets[mKey] = amount;
    
    try { localStorage.setItem('sf_budgets', JSON.stringify(savedBudgets)); } catch(e){} 
    db.b = amount; 
    
    if (sb) {
        sb.from('monthly_budgets').upsert({ month_key: mKey, budget: amount }).then(({error}) => {
            if(error) console.warn("Supabase budget fel:", error);
        });
    }
    
    calculateTimeline(); updateDash(); closeBudgetModal(); 
}

function setTheme(themeName) { document.body.setAttribute('data-theme', themeName); localStorage.setItem('sf_theme', themeName); }
const savedTheme = localStorage.getItem('sf_theme') || 'light'; document.body.setAttribute('data-theme', savedTheme);

// ==========================================
//  INITIALIZATION & DATA LOADING
// ==========================================
function extractDateTime(line) {
    const match = line.match(/:(\d{8})(T\d{6})?/);
    if (match) {
        const dateStr = match[1]; const timeStr = match[2]; const y = dateStr.substring(0, 4); const m = dateStr.substring(4, 6); const d = dateStr.substring(6, 8);
        let hh = "00"; let mm = "00"; let hasTime = false;
        if (timeStr) { hh = timeStr.substring(1, 3); mm = timeStr.substring(3, 5); hasTime = true; }
        return { dateKey: `${parseInt(y, 10)}-${parseInt(m, 10)}-${parseInt(d, 10)}`, time: `${hh}:${mm}`, hasTime: hasTime };
    } return null;
}

function processParsedEvent(ev, desc) {
    if (!ev.start) return;
    const fullText = desc.toLowerCase(); let isWork = false; let isLedig = false;
    if (fullText.includes("sen ankomst") || fullText.includes("tidig hemgång")) { isWork = true; } 
    else if (fullText.includes("q: ledighet") || fullText.includes("ledighet")) { isLedig = true; } 
    else if (fullText.includes("sales") || fullText.includes("cross tech") || fullText.includes("arbetspass") || fullText.includes("q:")) { isWork = true; }

    let sdParts = ev.start.dateKey.split('-'); let sd = new Date(parseInt(sdParts[0]), parseInt(sdParts[1])-1, parseInt(sdParts[2]));
    let duration = 0; let endStr = ev.end && ev.end.hasTime ? ev.end.time : null;
    
    if (ev.start.hasTime && ev.end && ev.end.hasTime) {
        let edParts = ev.end.dateKey.split('-'); let ed = new Date(parseInt(edParts[0]), parseInt(edParts[1])-1, parseInt(edParts[2]));
        let [h1, m1] = ev.start.time.split(':').map(Number); let [h2, m2] = ev.end.time.split(':').map(Number);
        let d1 = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), h1, m1); let d2 = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), h2, m2);
        duration = (d2.getTime() - d1.getTime()) / 3600000; if(duration < 0) duration = 0;
    }

    const k = `${sd.getFullYear()}-${sd.getMonth() + 1}-${sd.getDate()}`;
    if (!db.q[k]) db.q[k] = { work_h: 0, ledig_h: 0 };
    if (isWork) {
        db.q[k].exists = true; if(!db.q[k].start || ev.start.time < db.q[k].start) db.q[k].start = ev.start.time;
        if(endStr) { let currentEnd = db.q[k].end || "00:00"; if(currentEnd === "00:00" && endStr !== "00:00" && !db.q[k].end) { db.q[k].end = endStr; } else if (endStr === "00:00") { db.q[k].end = "00:00"; } else if (endStr > currentEnd && currentEnd !== "00:00") { db.q[k].end = endStr; } }
        db.q[k].work_h += duration;
    }
    if (isLedig) { db.q[k].exists = true; db.q[k].ledig_h += duration; }
}

async function loadAllData() {
    try {
        if (sb) {
            const [salesRes, budgetRes, notesRes] = await Promise.all([
                sb.from('sales_data').select('*'),
                sb.from('monthly_budgets').select('*'),
                sb.from('notes').select('*').order('id', { ascending: false })
            ]);

            if (salesRes.data) {
                db.d = {};
                salesRes.data.forEach(r => db.d[r.date_key] = { 
                    st: r.status, s: parseNum(r.sales), abs: r.is_absent, src: r.is_absent === 'Åtgärd krävs' ? 'Auto' : 'Manual', raw: r.raw_reason || r.is_absent || '', fk_perc: r.fk_perc, abs_hours: r.abs_hours,
                    eval: r.eval_data || null, eval_text: '', has_eval_saved: !!r.eval_data
                });
            }

            if (budgetRes.data) {
                savedBudgets = {};
                budgetRes.data.forEach(r => savedBudgets[r.month_key] = parseNum(r.budget));
                try { localStorage.setItem('sf_budgets', JSON.stringify(savedBudgets)); } catch(e){} 
            }

            if (notesRes.data) {
                savedNotes = notesRes.data.map(r => ({
                    id: r.id, name: r.customer_name || '', phone: r.phone || '', order: r.order_nr || '', text: r.note_text
                }));
                try { localStorage.setItem('sf_notes', JSON.stringify(savedNotes)); } catch(e){}
            }
        }

        const response = await fetch("https://raw.githubusercontent.com/pekkusa-cyber/SalesFlow/main/schema.ics?t=" + Date.now()); 
        if(!response.ok) throw new Error("Kunde inte hämta ICS"); const text = await response.text();
        
        db.q = {}; const lines = text.split(/\r?\n/); let inEvent = false; let event = {}; let fullDesc = "";
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line === "BEGIN:VEVENT") { inEvent = true; event = {}; fullDesc = ""; } 
            else if (line === "END:VEVENT") { inEvent = false; processParsedEvent(event, fullDesc); } 
            else if (inEvent) {
                if (line.startsWith("DTSTART")) { event.start = extractDateTime(line); } 
                else if (line.startsWith("DTEND")) { event.end = extractDateTime(line); } 
                else if (line.startsWith("SUMMARY:") || line.startsWith("DESCRIPTION:")) { fullDesc += " " + line; } 
                else if (!line.includes(":")) { fullDesc += " " + line; }
            }
        }

        let upserts = [];
        for (let k in db.q) {
            let qd = db.q[k];
            if (qd.ledig_h > 0) {
                let total = qd.work_h + qd.ledig_h; let actual_perc = total > 0 ? (qd.ledig_h / total) * 100 : 100;
                let fk_perc = 0; if (actual_perc >= 100) fk_perc = 100; else if (actual_perc >= 75) fk_perc = 75; else if (actual_perc >= 50) fk_perc = 50; else if (actual_perc >= 25) fk_perc = 25; else fk_perc = 0;
                qd.actual_perc = actual_perc; qd.fk_perc = fk_perc; qd.abs_hours = qd.ledig_h;
                
                let existing = db.d[k]; let needsFlag = false;
                if (!existing) { needsFlag = true; } 
                else {
                    const validAbsences = ['Sjuk', 'VAB', 'VAB Belma', 'VAB Wilma', 'Föräldraledig', 'Föräldraledig Belma', 'Föräldraledig Wilma', 'Semester', 'Tjänstledig'];
                    const hasValidAbsence = existing.abs && validAbsences.some(a => existing.abs.includes(a));
                    if (!hasValidAbsence && existing.abs !== 'Åtgärd krävs') { if (!(existing.st === 'Arbete' && existing.s > 0)) { needsFlag = true; } }
                }

                if (needsFlag) {
                    db.d[k] = { st: 'Arbete', s: existing?.s || 0, abs: 'Åtgärd krävs', src: 'Auto', raw: `Frånvaro ${qd.ledig_h.toFixed(2)}h`, fk_perc: fk_perc, abs_hours: qd.ledig_h, eval: existing?.eval || null, eval_text: '', has_eval_saved: !!existing?.eval };
                    upserts.push({ date_key: k, status: 'Arbete', sales: existing?.s || 0, is_absent: 'Åtgärd krävs', raw_reason: `Frånvaro ${qd.ledig_h.toFixed(2)}h`, fk_perc: fk_perc, abs_hours: qd.ledig_h, eval_data: existing?.eval || null });
                } else if (existing && existing.src === 'Manual') {
                    if(existing.fk_perc == null || existing.abs_hours == null) {
                         existing.fk_perc = fk_perc; existing.abs_hours = qd.ledig_h;
                         upserts.push({ date_key: k, status: existing.st, sales: existing.s, is_absent: existing.abs, raw_reason: existing.raw, fk_perc: fk_perc, abs_hours: qd.ledig_h, eval_data: existing.eval || null });
                    }
                }
            }
        }

        try { if(!savedBudgets || Object.keys(savedBudgets).length === 0) savedBudgets = JSON.parse(localStorage.getItem('sf_budgets')) || {}; } catch(e){}
        try { if(!savedNotes || savedNotes.length === 0) savedNotes = JSON.parse(localStorage.getItem('sf_notes')) || []; } catch(e){}
        for (let k in db.d) {
            if (!db.d[k].has_eval_saved) {
                const savedEv = localStorage.getItem(`sf_eval_obj_${k}`);
                if (savedEv) { db.d[k].eval = JSON.parse(savedEv); db.d[k].has_eval_saved = true; }
            }
        }
        
        if(sb && upserts.length > 0) { sb.from('sales_data').upsert(upserts).then(({error}) => { if(error) console.warn("Supabase fel", error); }); }
    } catch(e) { console.warn("Kunde inte hämta data", e); }
}

async function syncData() {
    const btn = document.getElementById('sync-btn'); if(!btn) return;
    const oldTxt = btn.innerHTML; btn.innerHTML = '<span>⚡</span> SYNKAR...';
    await loadAllData(); calculateTimeline(); updateDash(); 
    if (viewMode === 'dash') updateDashboardView();
    else if (viewMode === 'absence') renderAbsence();
    setTimeout(() => { btn.innerHTML = oldTxt; }, 800);
}

// ==========================================
//  VIEW & STATE LOGIC
// ==========================================
function setMode(mode) {
    if (currentFocusReason && mode !== 'month') { closeFocusMode(true); }
    
    if (!viewDate) viewDate = new Date(realToday); if (!currentWeekStart) currentWeekStart = new Date(realToday);
    multiSelectKeys.clear(); closeMonthEdit(); if(numpadTarget) closeNumpad();
    viewMode = mode; 
    document.body.className = `mode-${mode} ${currentFocusReason ? 'focus-mode-active' : ''}`;

    ['dash', 'month', 'absence'].forEach(m => {
        const b = document.getElementById(`tab-${m}`);
        if(b) { 
            if(m === mode) b.className = "flex-1 text-[6.5px] font-black uppercase tracking-wider py-1.5 rounded-md transition-all bg-[#0ea5e9] text-white shadow-sm"; 
            else b.className = "flex-1 text-[6.5px] font-black uppercase tracking-wider py-1.5 rounded-md text-slate-500 transition-all hover:bg-slate-200/50"; 
        }
    });
    if (mode === 'dash' && !activeK) { activeK = getK(realToday); }
    calculateTimeline(); updateDash();
    if (mode === 'dash') { renderWeekSlides(); updateDashboardView(); } 
    else if (mode === 'month') { renderCal(viewDate.getFullYear(), viewDate.getMonth() + 1); } 
    else if (mode === 'absence') { renderAbsence(); } 
    updateTopTitle();
}

function toggleDashMode() {
    activeK = getK(realToday); currentWeekStart = new Date(realToday);
    const sdo = currentWeekStart.getDay() || 7; currentWeekStart.setDate(currentWeekStart.getDate() - sdo + 1); currentWeekStart.setHours(0,0,0,0);
    viewDate = new Date(realToday); 
    db.b = getBudgetForMonth(viewDate.getFullYear(), viewDate.getMonth() + 1);
    if (viewMode !== 'dash') { setMode('dash'); } 
    else {
        calculateTimeline(); renderWeekSlides(); updateDashboardView(); updateTopTitle(); updateTopInfoBar();
        document.querySelectorAll('.vp-cell, .day-cell').forEach(c => { if(activeK && c.dataset.key === activeK) c.classList.add('active-focus'); else c.classList.remove('active-focus'); });
    }
}

function navArrow(dir) {
    if (viewMode === 'month' || viewMode === 'absence') {
        navCal(dir);
    } else if (viewMode === 'dash') {
        navDay(dir);
    }
}

function navDay(offset) {
    multiSelectKeys.clear(); closeMonthEdit(); if(numpadTarget) closeNumpad();
    let baseDate;
    if (activeK) {
        let p = activeK.split('-');
        baseDate = new Date(p[0], p[1]-1, p[2]);
    } else {
        baseDate = new Date(realToday);
    }
    baseDate.setDate(baseDate.getDate() + offset);
    activeK = getK(baseDate);
    
    let start = new Date(currentWeekStart);
    let end = new Date(currentWeekStart); end.setDate(end.getDate() + 6); end.setHours(23,59,59,999);
    
    if (baseDate < start || baseDate > end) {
        currentWeekStart = new Date(baseDate);
        const sdo = currentWeekStart.getDay() || 7; 
        currentWeekStart.setDate(currentWeekStart.getDate() - sdo + 1); currentWeekStart.setHours(0,0,0,0);
        
        let thursday = new Date(currentWeekStart); thursday.setDate(thursday.getDate() + 3);
        if (thursday.getMonth() !== viewDate.getMonth()) {
            viewDate = new Date(thursday.getFullYear(), thursday.getMonth(), 1);
            db.b = getBudgetForMonth(viewDate.getFullYear(), viewDate.getMonth() + 1);
            calculateTimeline(); updateDash();
        }
        renderWeekSlides();
    } else {
        document.querySelectorAll('.vp-cell').forEach(c => {
            if (c.dataset.key === activeK) c.classList.add('active-focus');
            else c.classList.remove('active-focus');
        });
    }
    updateDashboardView(); updateTopTitle(); updateTopInfoBar();
}

function navCal(offset) {
    multiSelectKeys.clear(); closeMonthEdit(); if(numpadTarget) closeNumpad();
    if (viewMode === 'month' || viewMode === 'absence') { 
        viewDate.setMonth(viewDate.getMonth() + offset); 
        currentWeekStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
        const sdo = currentWeekStart.getDay() || 7; currentWeekStart.setDate(currentWeekStart.getDate() - sdo + 1); currentWeekStart.setHours(0,0,0,0);
        calculateTimeline(); updateDash(); if (viewMode === 'absence') renderAbsence(); 
    } 
    else if (viewMode === 'dash') { 
        currentWeekStart.setDate(currentWeekStart.getDate() + (offset * 7)); activeK = null; 
        let thursday = new Date(currentWeekStart); thursday.setDate(thursday.getDate() + 3); const majorityMonth = thursday.getMonth();
        if (majorityMonth !== viewDate.getMonth()) {
            viewDate = new Date(thursday.getFullYear(), thursday.getMonth(), 1);
            db.b = getBudgetForMonth(viewDate.getFullYear(), viewDate.getMonth() + 1);
            calculateTimeline(); updateDash();
        }
        renderWeekSlides(); updateDashboardView(); 
    } 
    updateTopTitle();
}

function goToDayFromMonth(k) {
    activeK = k; const parts = k.split('-'); const d = new Date(parts[0], parts[1]-1, parts[2]);
    viewDate = new Date(d.getFullYear(), d.getMonth(), 1); currentWeekStart = new Date(d);
    const sdo = currentWeekStart.getDay() || 7; currentWeekStart.setDate(currentWeekStart.getDate() - sdo + 1); currentWeekStart.setHours(0,0,0,0);
    multiSelectKeys.clear(); closeMonthEdit(); if(numpadTarget) closeNumpad();
    viewMode = 'dash'; document.body.className = `mode-dash ${currentFocusReason ? 'focus-mode-active' : ''}`;
    ['dash', 'month', 'absence'].forEach(m => {
        const b = document.getElementById(`tab-${m}`);
        if(b) { if(m === 'dash') b.className = "flex-1 text-[6.5px] font-black uppercase tracking-wider py-1.5 rounded-md transition-all bg-[#0ea5e9] text-white shadow-sm"; else b.className = "flex-1 text-[6.5px] font-black uppercase tracking-wider py-1.5 rounded-md text-slate-500 transition-all hover:bg-slate-200/50"; }
    });
    calculateTimeline(); updateDash(); renderWeekSlides(); updateDashboardView(); updateTopTitle();
}

function selectDay(k, el, e) {
    e.stopPropagation();
    if (viewMode === 'month') {
        if (multiSelectKeys.has(k)) { multiSelectKeys.delete(k); el.classList.remove('active-focus'); } else { multiSelectKeys.add(k); el.classList.add('active-focus'); }
        if (multiSelectKeys.size > 0) {
            document.getElementById('cal-standard-header').classList.add('hidden'); document.getElementById('month-edit-menu').classList.remove('hidden');
            const mText = document.getElementById('month-sales-text');
            if(multiSelectKeys.size === 1) { const singleK = Array.from(multiSelectKeys)[0]; const o = db.d[singleK] || {}; if (mText) { if (o.s > 0) { mText.innerText = o.s + ' kr'; mText.classList.replace('text-slate-400', 'text-[#0ea5e9]'); } else { mText.innerText = '0 kr'; mText.classList.replace('text-[#0ea5e9]', 'text-slate-400'); } } } else { if (mText) { mText.innerText = '0 kr'; mText.classList.replace('text-[#0ea5e9]', 'text-slate-400'); } }
        } else { closeMonthEdit(); }
    } else {
        const isSameDay = (activeK === k);
        if (isSameDay) { activeK = null; document.querySelectorAll('.vp-cell').forEach(c => c.classList.remove('active-focus')); if (viewMode === 'dash') { updateDashboardView(); } updateTopInfoBar(); return; }
        activeK = k; document.querySelectorAll('.vp-cell').forEach(c => c.classList.remove('active-focus')); el.classList.add('active-focus'); if (viewMode === 'dash') { updateDashboardView(); }
    }
    if(numpadTarget) closeNumpad(); updateTopTitle(); updateTopInfoBar();
}

// ==========================================
//  CORE LOGIC (TIMELINE & SYNCS)
// ==========================================
function getCellState(k) { 
    const o = db.d[k] || {}, qData = db.q[k] || {}; 
    if (o.abs && o.abs.includes('Semester')) return 'semester';
    if (o.abs) return 'absent'; 
    if (o.st === 'Ledig') return 'ledig'; 
    if (o.s > 0) return 'worked'; 
    if (qData.start) return 'planned'; 
    return 'unplanned'; 
}

function calculateTimeline() {
    timeline = {};
    for (let offset = -1; offset <= 1; offset++) {
        let tempD = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
        let cy = tempD.getFullYear(); let cm = tempD.getMonth() + 1; let daysM = new Date(cy, cm, 0).getDate();
        let tW = 0; 
        for(let d=1; d<=daysM; d++) { const k = `${cy}-${cm}-${d}`; const o = db.d[k] || {}; const qData = db.q[k] || {}; if (qData.start || o.s > 0) tW++; }
        if (tW === 0) tW = 21; 
        let rB = getBudgetForMonth(cy, cm), rP = tW;
        for(let d=1; d<=daysM; d++) { 
            const k = `${cy}-${cm}-${d}`; const o = db.d[k] || {s:0}; const qData = db.q[k] || {}; const isW = (qData.start || o.s > 0); 
            if (isW) { const target = rP > 0 ? rB / rP : 0; timeline[k] = { target: Math.max(0, target) }; rB -= o.s; rP--; } else { timeline[k] = { target: 0 }; rB -= o.s; } 
        }
    }
}

function pushMatrixSync(k, o) {
    const old = db.d[k] || {}; const qd = db.q[k] || {};
    const merged = { 
        st: o.st !== undefined ? o.st : (old.st || 'Arbete'), 
        s: o.s !== undefined ? o.s : (old.s || 0), 
        abs: o.abs !== undefined ? o.abs : (old.abs || null), 
        src: o.src !== undefined ? o.src : 'Manual', 
        raw: o.raw !== undefined ? o.raw : (old.raw || ''), 
        fk_perc: o.fk_perc !== undefined ? o.fk_perc : (old.fk_perc || qd.fk_perc || null), 
        abs_hours: o.abs_hours !== undefined ? o.abs_hours : (old.abs_hours || qd.abs_hours || null), 
        eval: old.eval || null, 
        eval_text: old.eval_text || '', 
        has_eval_saved: old.has_eval_saved || false
    };
    db.d[k] = merged; calculateTimeline(); updateDash(); 
    if (viewMode === 'dash') updateDashboardView();
    if (sb) { 
        sb.from('sales_data').upsert({ 
            date_key: k, status: merged.st, sales: merged.s, is_absent: merged.abs, 
            raw_reason: merged.raw, fk_perc: merged.fk_perc, abs_hours: merged.abs_hours, 
            eval_data: merged.eval 
        }).then(({error}) => { if(error) console.warn("Supabase fel", error); }); 
    }
}

// ==========================================
//  RENDERING FUNCTIONS
// ==========================================
function updateDash() { 
    db.b = getBudgetForMonth(viewDate.getFullYear(), viewDate.getMonth() + 1);
    const cm = viewDate.getMonth() + 1, cy = viewDate.getFullYear(); let tS = 0, dP = 0, tP = 0, rW = 0; const daysM = new Date(cy, cm, 0).getDate();
    for(let d=1; d<=daysM; d++) { const k = `${cy}-${cm}-${d}`; const o = db.d[k] || {s:0}; const qData = db.q[k] || {}; tS += o.s; if (o.s > 0) dP++; if (qData.start || o.s > 0) { tP++; const dObj = new Date(cy, cm-1, d); if (dObj >= realToday) rW++; } }
    const monthlyPerc = db.b > 0 ? Math.round((tS/db.b)*100) : 0; const avg = dP ? (tS / dP) : 0;
    
    const bValEl = document.getElementById('d-budget-val'); if(bValEl) bValEl.innerText = db.b.toLocaleString('sv-SE') + " kr";
    const maxK = Math.round(db.b / 1000); const maxLbl = document.getElementById('g-max-lbl'); if (maxLbl) maxLbl.innerText = maxK;
    const tgtEl = document.getElementById('d-today-target'); if(tgtEl) tgtEl.innerText = Math.round((timeline[getK(realToday)]?.target || 0)/1000) + " k";
    const avgEl = document.getElementById('d-avg-val'); if(avgEl) avgEl.innerText = Math.round(avg/1000) + " k"; 
    const mainValEl = document.getElementById('h-main-val'); if(mainValEl) mainValEl.innerText = (tS/1000).toFixed(1) + " k";
    const percEl = document.getElementById('h-perc-val'); if(percEl) percEl.innerText = monthlyPerc + "%"; 
    const leftEl = document.getElementById('d-work-left'); if(leftEl) leftEl.innerText = `${rW} Pass Kvar`;
    const totEl = document.getElementById('d-work-total'); if(totEl) totEl.innerText = `${tP} Totalt`; 
    const kvarEl = document.getElementById('d-kvar'); if(kvarEl) kvarEl.innerText = Math.max(0, Math.round((db.b - tS)/1000)) + " k";
    
    const hCirc = document.getElementById('h-circle-prog'); 
    if(hCirc) {
        const isTopReached = tS >= db.b && db.b > 0;
        hCirc.style.strokeDashoffset = 326.7 - ((Math.min(monthlyPerc, 100) / 100) * (326.7 * 0.75));
        hCirc.style.stroke = isTopReached ? 'var(--pos)' : 'var(--neg)';
        hCirc.style.filter = isTopReached ? 'drop-shadow(0 0 8px rgba(16,185,129,0.6))' : 'drop-shadow(0 0 8px rgba(244,63,94,0.6))';
    }
    
    const progStr = Math.round((avg * tP)/1000); 
    const progEl = document.getElementById('d-prog'); if(progEl) { progEl.innerText = progStr + " k"; progEl.style.color = progStr >= (db.b/1000) ? 'var(--pos)' : 'var(--neg)'; }
    const statEl = document.getElementById('d-status'); if(statEl) { statEl.innerText = progStr >= (db.b/1000) ? "I FAS" : "EFTER"; statEl.style.color = progStr >= (db.b/1000) ? 'var(--pos)' : 'var(--neg)'; }
    
    if(viewMode === 'month') renderCal(cy, cm); else if(viewMode === 'dash') { renderWeekSlides(); updateDashboardView(); } else if(viewMode === 'absence') renderAbsence();
    updateTopTitle(); updateTopInfoBar();
}

function updateTopTitle() {
    const titleEl = document.getElementById('dynamic-view-title'); const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    if (titleEl) {
        if (viewMode === 'dash') {
            if (activeK) { const p = activeK.split('-'); const d = new Date(p[0], p[1]-1, p[2]); titleEl.innerText = `${d.getDate()} ${months[d.getMonth()].toUpperCase()} ${d.getFullYear()}`; } else { titleEl.innerText = `VECKA ${getWeekNumber(currentWeekStart)} - ${currentWeekStart.getFullYear()}`; }
        } else { titleEl.innerText = `${months[viewDate.getMonth()].toUpperCase()} ${viewDate.getFullYear()}`; }
    }
    const topMonthLbl = document.getElementById('top-month-lbl'); if (topMonthLbl) { topMonthLbl.innerText = `${months[viewDate.getMonth()].toUpperCase()} ${viewDate.getFullYear()}`; }
}

function updateTopInfoBar() {
    const infoTextEl = document.getElementById('top-info-text'); const infoBarEl = document.getElementById('top-info-bar'); if(!infoTextEl || !infoBarEl) return;
    let forceNextShift = (viewMode === 'dash' || viewMode === 'absence'); let displayDay = null;
    if (!forceNextShift && viewMode === 'month' && multiSelectKeys.size === 1) { displayDay = Array.from(multiSelectKeys)[0]; }
    
    const daysShort = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']; 
    const emObj = { 'Sjuk': '🤒', 'VAB': '👶', 'Föräldraledig': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' };
    let newHTML = ""; let isActiveShiftNow = false;
    let now = new Date();

    if (displayDay) {
        const o = db.d[displayDay] || {s:0}; const qData = db.q[displayDay] || {}; const state = getCellState(displayDay);
        const dObj = new Date(displayDay.split('-')[0], displayDay.split('-')[1]-1, displayDay.split('-')[2]); const dayName = daysShort[dObj.getDay()].toUpperCase(); const dDate = `${dObj.getDate()}/${dObj.getMonth()+1}`;
        const isToday = dObj.getTime() === realToday.getTime(); 
        
        let startH = qData.start ? parseInt(qData.start.split(':')[0]) : 10;
        let startM = qData.start ? parseInt(qData.start.split(':')[1]) : 0;
        let endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19;
        let endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
        
        let shiftStart = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), startH, startM);
        let shiftEnd = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), endH, endM);

        if (isToday && qData.start && !o.abs && state !== 'ledig' && state !== 'semester' && state !== 'unplanned' && now >= shiftStart && now < shiftEnd) { 
            isActiveShiftNow = true; 
        }

        if (o.abs) { 
            let bKey = o.abs.split(' ')[0]; 
            let emoji = emObj[bKey] || '⚠️';
            let txt = `${emoji} ${o.abs.toUpperCase()}`;
            if (o.abs_hours && o.abs !== 'Åtgärd krävs') { 
                let totalH = qData.work_h ? (qData.work_h + o.abs_hours) : o.abs_hours; let actualP = totalH > 0 ? Math.round((o.abs_hours / totalH) * 100) : 100; txt += ` • ${o.abs_hours.toFixed(2).replace('.00','')}h • ${actualP}% FK`; 
            } 
            newHTML = `<span class="text-rose-400 font-bold">${dayName} ${dDate}</span> <span class="text-white/20">|</span> <span class="text-white">${txt}</span>`; 
        } else if (qData.start && !o.abs) { newHTML = `<span class="text-[#38bdf8] font-bold">${dayName} ${dDate}</span> <span class="text-white/20">|</span> <span class="text-white">PASS ${qData.start.substring(0,5)}-${qData.end.substring(0,5)}</span>`; } else if (state === 'ledig' || state === 'unplanned') { newHTML = `<span class="text-slate-400 font-bold">${dayName} ${dDate}</span> <span class="text-white/20">|</span> <span class="text-slate-300">🏠 LEDIG</span>`; } else { newHTML = `<span class="text-slate-400 font-bold">${dayName} ${dDate}</span> <span class="text-white/20">|</span> <span class="text-slate-400">INGEN DATA</span>`; }
    } else {
        let nextShiftDate = null; let cDate = new Date(realToday);
        
        for(let i=0; i<30; i++) { 
            const k = getK(cDate); const qData = db.q[k] || {}; const state = getCellState(k); 
            let isToday = cDate.getTime() === realToday.getTime();
            
            let endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19;
            let endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
            let shiftEnd = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate(), endH, endM);
            
            if (qData.start && state !== 'absent' && state !== 'ledig' && state !== 'semester') { 
                if (isToday && now >= shiftEnd) {
                    // Skippa
                } else {
                    nextShiftDate = new Date(cDate); 
                    break; 
                }
            } 
            cDate.setDate(cDate.getDate() + 1); 
        }
        
        if (nextShiftDate) {
            const k = getK(nextShiftDate); const qData = db.q[k]; const o = db.d[k] || {}; const state = getCellState(k); const dayName = daysShort[nextShiftDate.getDay()].toUpperCase(); const dDate = `${nextShiftDate.getDate()}/${nextShiftDate.getMonth()+1}`; let prefix = (nextShiftDate.getTime() === realToday.getTime()) ? 'IDAG' : 'NÄSTA PASS';
            const isToday = nextShiftDate.getTime() === realToday.getTime(); 
            
            let startH = qData.start ? parseInt(qData.start.split(':')[0]) : 10;
            let startM = qData.start ? parseInt(qData.start.split(':')[1]) : 0;
            let endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19;
            let endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
            let shiftStart = new Date(nextShiftDate.getFullYear(), nextShiftDate.getMonth(), nextShiftDate.getDate(), startH, startM);
            let shiftEnd = new Date(nextShiftDate.getFullYear(), nextShiftDate.getMonth(), nextShiftDate.getDate(), endH, endM);

            if (isToday && qData.start && !o.abs && state !== 'ledig' && state !== 'semester' && state !== 'unplanned' && now >= shiftStart && now < shiftEnd) { 
                isActiveShiftNow = true; 
            }
            newHTML = `<span class="text-[#38bdf8] font-bold">${prefix}</span> <span class="text-white/20">|</span> <span class="text-white">${dayName} ${dDate} • ${qData.start.substring(0,5)}-${qData.end.substring(0,5)}</span>`;
        } else { newHTML = `<span class="text-slate-400">INGA PLANERADE PASS HITTADES</span>`; }
    }
    if (infoTextEl.innerHTML !== newHTML) { infoTextEl.innerHTML = newHTML; infoTextEl.classList.remove('animate-info-pop'); void infoTextEl.offsetWidth; infoTextEl.classList.add('animate-info-pop'); }
    if (isActiveShiftNow) { infoBarEl.classList.add('active-info-pulse'); } else { infoBarEl.classList.remove('active-info-pulse'); }
}

function updateDashboardView() {
    const dashTab = document.getElementById('tab-dash'); if (dashTab) dashTab.innerText = activeK ? 'DAG' : 'VECKA';
    let dTarget = 0, dSales = 0, dDiff = 0; let title = "", subtitle = "", statusText = "VÄLJ DAG"; let showActions = false; let absType = null; let isReached = false; let isActiveNow = false;

    if (activeK) {
        const parts = activeK.split('-'); const dObj = new Date(parts[0], parts[1]-1, parts[2]); const o = db.d[activeK] || {s:0}; const qData = db.q[activeK] || {};
        const daysLong = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']; const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        title = `${daysLong[dObj.getDay()]} ${dObj.getDate()} ${months[dObj.getMonth()]}`; subtitle = qData.start ? `${qData.start.substring(0,5)} — ${qData.end.substring(0,5)}` : 'Inga tider';
        dTarget = timeline[activeK]?.target || 0; dSales = o.s || 0; dDiff = dSales - dTarget; absType = o.abs;
        const state = getCellState(activeK);
        if (state === 'absent') statusText = absType.toUpperCase(); else if (state === 'semester') statusText = 'SEMESTER'; else if (state === 'ledig' || state === 'unplanned') statusText = 'LEDIG'; else statusText = 'ARBETSPASS';
        showActions = true; isReached = dTarget > 0 && dSales >= dTarget;

        const isToday = dObj.getTime() === realToday.getTime(); 
        let now = new Date();
        
        let isPastShift = false;
        if (dObj.getTime() < realToday.getTime()) {
            isPastShift = true;
        } else if (isToday) {
            let endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19;
            let endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
            let shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
            if (now >= shiftEnd) isPastShift = true;
        }

        if (isToday && qData.start && !o.abs && state !== 'ledig' && state !== 'semester' && state !== 'unplanned') { 
            let startH = parseInt(qData.start.split(':')[0]||10);
            let startM = parseInt(qData.start.split(':')[1]||0);
            let endH = parseInt(qData.end.split(':')[0]||19);
            let endM = parseInt(qData.end.split(':')[1]||0);
            
            let shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
            let shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);

            if (now >= shiftStart && now < shiftEnd) {
                isActiveNow = true; 
            }
            
            if (now >= shiftEnd && !o.has_eval_saved && !window.evalPromptedToday) {
                window.evalPromptedToday = true;
                setTimeout(openEvalModal, 1500);
            }
        }

        const btnEval = document.getElementById('btn-trigger-eval');
        if (qData.start && state !== 'ledig' && state !== 'semester') { 
            btnEval.classList.remove('hidden'); btnEval.classList.add('flex');
            if(o.has_eval_saved || (o.eval && Object.keys(o.eval).length > 0)) {
                btnEval.innerText = "✅"; 
                btnEval.classList.remove('eval-needs-action');
            } else { 
                btnEval.innerText = "✏️";
                if (isPastShift) {
                    btnEval.classList.add('eval-needs-action');
                } else {
                    btnEval.classList.remove('eval-needs-action');
                }
            }
        } else { 
            btnEval.classList.add('hidden'); btnEval.classList.remove('flex'); 
        }

        const actsGrid = document.getElementById('dash-actions-grid'); const stdActions = `<div class="absolute inset-0 flex gap-0.5 p-0.5 bg-slate-50"><button onclick="handleDashAction('Arbete')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">⚒️</button><button onclick="handleDashAction('Ledig')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">🏠</button><button onclick="handleDashAction('Semester')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">✈️</button><button onclick="handleDashAction('Sjuk')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">🤒</button><button onclick="handleDashAction('VAB')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">👶</button><button onclick="handleDashAction('Föräldraledig')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">🍼</button></div>`;
        if (absType === 'VAB' || absType === 'Föräldraledig') { actsGrid.innerHTML = `<div class="p-0.5 bg-slate-50 w-full h-full flex gap-1"><button onclick="triggerChildSelection('${absType}', 'dash')" class="w-full h-full bg-[#fef3c7] hover:bg-[#fde68a] text-[#d97706] font-black text-[10px] rounded-[10px] border border-[#fcd34d] shadow-sm flex items-center justify-center uppercase tracking-widest active:scale-95 transition-transform">⚠️ Välj Barn</button></div>`; } else { actsGrid.innerHTML = stdActions; }
        
        let metaText = ""; if (absType && o.abs_hours && absType !== 'Åtgärd krävs') { let totalH = qData.work_h ? (qData.work_h + o.abs_hours) : o.abs_hours; let actualP = totalH > 0 ? Math.round((o.abs_hours / totalH)*100) : 100; metaText = `${o.abs_hours.toFixed(2).replace('.00','')}h | ${actualP}% (${o.fk_perc || 0}%)`; } document.getElementById('dash-status-meta').innerText = metaText;
    } else {
        let wPass = 0, firstShiftTarget = null; let startD = new Date(currentWeekStart), endD = new Date(currentWeekStart); endD.setDate(endD.getDate() + 6); const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        for(let i=0; i<7; i++) { const cd = new Date(currentWeekStart); cd.setDate(currentWeekStart.getDate() + i); const k = getK(cd); const state = getCellState(k); dSales += (db.d[k]?.s || 0); if(state === 'worked' || state === 'planned') { if(firstShiftTarget === null) firstShiftTarget = (timeline[k]?.target || 0); wPass++; } }
        dTarget = (firstShiftTarget || 0) * wPass; dDiff = dSales - dTarget; title = `VECKA ${getWeekNumber(currentWeekStart)}`; subtitle = `${startD.getDate()} ${months[startD.getMonth()]} - ${endD.getDate()} ${months[endD.getMonth()]} (${wPass} Pass)`; statusText = "VÄLJ DAG..."; showActions = false; absType = null; isReached = dTarget > 0 && dSales >= dTarget; document.getElementById('dash-status-meta').innerText = "";
        document.getElementById('btn-trigger-eval').classList.add('hidden');
    }

    document.getElementById('dash-title').innerText = title.toUpperCase(); document.getElementById('dash-subtitle').innerText = subtitle; document.getElementById('dash-status-text').innerText = statusText;
    document.getElementById('dash-lbl-target').innerText = activeK ? "DAGSMÅL" : "VECKOMÅL"; document.getElementById('dash-val-target').innerText = (dTarget/1000).toFixed(1) + " k";
    const salesEl = document.getElementById('dash-val-sales'); salesEl.innerText = (dSales/1000).toFixed(1) + " k"; salesEl.style.color = isReached ? 'var(--pos)' : (dTarget > 0 ? 'var(--neg)' : 'var(--sting-blue)');
    const diffEl = document.getElementById('dash-val-diff'); diffEl.innerText = (dDiff >= 0 ? "+" : "") + (dDiff/1000).toFixed(1) + " k"; diffEl.style.color = dDiff >= 0 ? "var(--sting-blue)" : "var(--neg)";
    const p = dTarget > 0 ? Math.min(100, Math.round((dSales / dTarget) * 100)) : 0; document.getElementById('dash-val-perc').innerText = p + "%";
    
    const g = document.getElementById('dash-gauge-prog'); if(g) { g.style.strokeDashoffset = 283 - ((p / 100) * 212); g.style.stroke = isReached ? 'var(--pos)' : (dTarget > 0 ? 'var(--neg)' : 'var(--sting-blue)'); }
    const badgeEl = document.getElementById('dash-abs-badge');
    if (absType) { const em = { 'Sjuk': '🤒', 'VAB': '👶', 'VAB Belma': '👶', 'VAB Wilma': '👶', 'Föräldraledig': '🍼', 'Föräldraledig Belma': '🍼', 'Föräldraledig Wilma': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' }; let bKey = absType.split(' ')[0]; badgeEl.innerText = em[absType] || em[bKey] || '•'; badgeEl.classList.remove('hidden'); badgeEl.className = `absolute top-0 right-2 w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[14px] z-20 ${absType.includes('Semester') ? 'bg-teal-100 text-teal-600' : (absType.includes('VAB') ? 'bg-amber-100 text-amber-600' : (absType.includes('Föräldraledig') ? 'bg-purple-100 text-purple-600' : (absType === 'Åtgärd krävs' ? 'bg-rose-500 text-white border-none' : 'bg-rose-100 text-rose-600')))}`; } else { badgeEl.classList.add('hidden'); }
    const acts = document.getElementById('dash-actions'); if (showActions) { acts.classList.remove('opacity-0', 'pointer-events-none', 'h-0', 'mt-0'); acts.classList.add('opacity-100', 'pointer-events-auto', 'h-[42px]', 'mt-1'); } else { acts.classList.remove('opacity-100', 'pointer-events-auto', 'h-[42px]', 'mt-1'); acts.classList.add('opacity-0', 'pointer-events-none', 'h-0', 'mt-0'); }
    
    const innerCard = document.getElementById('dash-inner-card');
    const scannerLayer = document.getElementById('cyber-scanner-layer');
    const gProg = document.getElementById('dash-gauge-prog');

    innerCard.classList.remove('goal-ambient', 'red-cyber', 'blue-cyber'); 
    innerCard.style.borderColor = '';
    gProg.classList.remove('goal-ambient-gauge', 'red-cyber-gauge', 'blue-cyber-gauge');
    scannerLayer.style.display = 'none';
    
    if (activeK && viewMode === 'dash') {
        if (isActiveNow) {
            scannerLayer.style.display = 'block';
            gProg.classList.add('blue-cyber-gauge');
            innerCard.classList.add('blue-cyber'); 
        } else if (isReached) {
            innerCard.classList.add('goal-ambient');
            gProg.classList.add('goal-ambient-gauge');
        } else if (dTarget > 0) {
            innerCard.classList.add('red-cyber');
            gProg.classList.add('red-cyber-gauge');
        }
    }
}

function createSliderCell(cd, k) {
    const o = db.d[k] || {s:0}, t = timeline[k] || {target:0}, qData = db.q[k] || {}; 
    const isPast = cd < realToday, isToday = cd.getTime() === realToday.getTime(), state = getCellState(k);
    
    let cls = 'vp-cell';

    if (o.abs) {
       // absence styles are handled by background if needed, but standard vp uses text/emojis
       cls += ' type-unplanned'; // basic fallback
    } else if (state === 'ledig' || state === 'unplanned') {
       cls += ' type-unplanned';
    } else if (qData.start) {
       cls += ' type-planned';
    }

    if (isPast) {
        cls += ' vp-past';
        if (o.s >= t.target && o.s > 0) cls += ' history-success';
        else cls += ' history-fail';
    } else if (isToday) {
        cls += ' status-today'; 
    }

    if (activeK === k) cls += ' active-focus';
    if (currentFocusReason && o.abs && o.abs.includes(currentFocusReason)) cls += ' focus-highlight';
    
    const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    const dayName = dayNames[cd.getDay()];
    
    let valStr = '';
    
    let now = new Date();
    let startH = qData.start ? parseInt(qData.start.split(':')[0]) : 10;
    let startM = qData.start ? parseInt(qData.start.split(':')[1]) : 0;
    let endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19;
    let endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
    let shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
    let shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
    
    let isShiftActive = (isToday && qData.start && state !== 'absent' && state !== 'ledig' && state !== 'semester' && now >= shiftStart && now < shiftEnd);
    let liveDot = isShiftActive ? '<span class="live-dot"></span>' : '';

    if (o.abs) { 
        let bKey = o.abs.split(' ')[0]; 
        const em = { 'Sjuk': '🤒', 'VAB': '👶', 'Föräldraledig': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' };
        valStr = `${em[o.abs] || em[bKey] || '•'}`;
    } else if (o.s > 0) { 
        valStr = `${(o.s/1000).toFixed(1)}k`; 
    } else if (qData.start) { 
        valStr = `${liveDot}${qData.start.substring(0,5)}`; 
    } else { 
        valStr = `Ledig`; 
    }

    const cell = document.createElement('div');
    cell.className = cls;
    cell.dataset.key = k;
    cell.onclick = (e) => selectDay(k, cell, e);
    cell.innerHTML = `
        <span class="vp-name">${dayName}</span>
        <span class="vp-date">${cd.getDate()}</span>
        <span class="vp-val flex items-center justify-center">${valStr}</span>
    `;
    return cell;
}

function createDayCell(cd, k) {
    const o = db.d[k] || {s:0}, t = timeline[k] || {target:0}, qData = db.q[k] || {}; 
    let cls = 'day-cell', b = '', content = '', wt = ''; 
    const em = { 'Sjuk': '🤒', 'VAB': '👶', 'VAB Belma': '👶', 'VAB Wilma': '👶', 'Föräldraledig': '🍼', 'Föräldraledig Belma': '🍼', 'Föräldraledig Wilma': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' }; 
    const isPast = cd < realToday, isToday = cd.getTime() === realToday.getTime(), state = getCellState(k);
    const dayOfWeek = cd.getDay(); 
    
    let now = new Date();
    let startH = qData.start ? parseInt(qData.start.split(':')[0]) : 10;
    let startM = qData.start ? parseInt(qData.start.split(':')[1]) : 0;
    let endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19;
    let endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
    let shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
    let shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
    let isShiftActive = (isToday && qData.start && state !== 'absent' && state !== 'ledig' && state !== 'semester' && now >= shiftStart && now < shiftEnd);
    
    if (dayOfWeek === 1 && viewMode === 'month') wt = `<div class="week-tag">${getWeekNumber(cd)}</div>`;
    if (o.abs) { let bKey = o.abs.split(' ')[0]; if (o.abs === 'Åtgärd krävs') { b += `<div class="u-badge badge-abs badge-action" style="background:#ef4444; color:white; border:none;">${em[o.abs] || '•'}</div>`; } else { b += `<div class="u-badge badge-abs">${em[o.abs] || em[bKey] || '•'}</div>`; } }
    if (o.s > 0) { content = `<span class="cell-main-val mt-1">${(o.s/1000).toFixed(1)} k</span>`; } else if (qData.start && !o.abs) { content = `<div class="flex flex-col items-center justify-center leading-[1.1] mt-[4px] text-[7.5px] font-bold"><span>${qData.start.substring(0,5)}</span><span>${qData.end.substring(0,5)}</span></div>`; } else if (state === 'unplanned' || (state === 'ledig' && o.s === 0)) { content = `<span class="text-[7.5px] font-black text-slate-800 mt-1 uppercase tracking-widest opacity-50">LEDIG</span>`; }

    if (o.abs) { let baseAbs = o.abs.split(' ')[0]; if (qData.start && baseAbs !== 'Åtgärd krävs') { if (baseAbs === 'Sjuk') cls += ' bg-split-sjuk'; else if (baseAbs === 'VAB') cls += ' bg-split-vab'; else if (baseAbs === 'Föräldraledig') cls += ' bg-split-fledig'; else if (baseAbs === 'Semester') cls += ' bg-split-sem'; else cls += ' type-absent'; } else { if (baseAbs === 'Sjuk' || baseAbs === 'Åtgärd krävs') cls += ' type-absent'; else if (baseAbs === 'Semester') cls += ' type-semester'; else cls += ' type-absent'; } } else if (state === 'ledig' || state === 'unplanned') { cls += ' type-unplanned'; } else if (isPast) { cls += ' history-cell'; if (o.s >= t.target && o.s > 0) cls += ' history-success'; else cls += ' history-fail'; } else { if (isToday) cls += ' status-today'; else if (qData.start) cls += ' type-planned'; }
    if (isShiftActive) cls += ' active-shift-pulse'; 
    
    if (viewMode === 'month' && multiSelectKeys.has(k)) { cls += ' active-focus'; } else if (viewMode !== 'month' && activeK === k) { cls += ' active-focus'; }
    if (currentFocusReason && o.abs && o.abs.includes(currentFocusReason)) { cls += ' focus-highlight'; }
    
    const cell = document.createElement('div'); cell.className = cls; cell.dataset.key = k; cell.onclick = (e) => selectDay(k, cell, e);
    cell.innerHTML = `${wt}<span class="date-num">${cd.getDate()}</span><div class="flex flex-col items-center justify-center h-full w-full pt-[6px] text-center tracking-tighter">${b}${content}</div>`; return cell;
}

function renderCal(y, m) { 
    const g = document.getElementById('d-cal'); if(!g) return; g.innerHTML = ''; 
    const lastDate = new Date(y, m, 0).getDate(); const firstDay = new Date(y, m-1, 1).getDay() || 7; const prevMonthLastDate = new Date(y, m-1, 0).getDate();
    for(let i = 1; i < firstDay; i++) { const d = prevMonthLastDate - (firstDay - 1) + i; const cell = document.createElement('div'); cell.className = 'day-cell opacity-40 pointer-events-none bg-transparent border-transparent shadow-none'; cell.innerHTML = `<span class="date-num opacity-50">${d}</span>`; g.appendChild(cell); } 
    for(let d=1; d<=lastDate; d++) g.appendChild(createDayCell(new Date(y, m-1, d), `${y}-${m}-${d}`)); 
    const totalCellsSoFar = (firstDay - 1) + lastDate; const remainingCells = 42 - totalCellsSoFar;
    for(let d=1; d<=remainingCells; d++) { const cell = document.createElement('div'); cell.className = 'day-cell opacity-40 pointer-events-none bg-transparent border-transparent shadow-none'; cell.innerHTML = `<span class="date-num opacity-50">${d}</span>`; g.appendChild(cell); }
}

function populateSlide(cId, sD) { 
    const c = document.getElementById(cId); 
    if(!c) return; 
    c.innerHTML = ''; 
    for(let i=0; i<7; i++) { 
        const cd = new Date(sD); 
        cd.setDate(cd.getDate() + i); 
        c.appendChild(createSliderCell(cd, getK(cd))); 
    } 
}

function renderWeekSlides() { populateSlide('slide-curr', currentWeekStart); }
function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7); }

function renderAbsence() {
    const pane = document.getElementById('pane-absence'); if(!pane) return;
    const cm = viewDate.getMonth() + 1; const cy = viewDate.getFullYear(); const daysM = new Date(cy, cm, 0).getDate(); let absCounts = {}; let absListHTML = ''; let totalAbs = 0; const daysLong = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
    const em = { 'Sjuk': '🤒', 'VAB': '👶', 'VAB Belma': '👶', 'VAB Wilma': '👶', 'Föräldraledig': '🍼', 'Föräldraledig Belma': '🍼', 'Föräldraledig Wilma': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' }; const col = { 'Sjuk': 'text-rose-600', 'VAB': 'text-amber-600', 'VAB Belma': 'text-amber-600', 'VAB Wilma': 'text-amber-600', 'Föräldraledig': 'text-purple-600', 'Föräldraledig Belma': 'text-purple-600', 'Föräldraledig Wilma': 'text-purple-600', 'Semester': 'text-teal-600', 'Tjänstledig': 'text-slate-600', 'Åtgärd krävs': 'text-rose-600' }; const bgClass = { 'Sjuk': 'bg-rose-50', 'VAB': 'bg-amber-50', 'VAB Belma': 'bg-amber-50', 'VAB Wilma': 'bg-amber-50', 'Föräldraledig': 'bg-purple-50', 'Föräldraledig Belma': 'bg-purple-50', 'Föräldraledig Wilma': 'bg-purple-50', 'Semester': 'bg-teal-50', 'Tjänstledig': 'bg-slate-50', 'Åtgärd krävs': 'bg-rose-50' };

    for (let d = 1; d <= daysM; d++) {
        const k = `${cy}-${cm}-${d}`; const o = db.d[k] || {}; const qData = db.q[k] || {};
        if (o.abs && ['Sjuk', 'VAB', 'VAB Belma', 'VAB Wilma', 'Föräldraledig', 'Föräldraledig Belma', 'Föräldraledig Wilma', 'Semester', 'Tjänstledig', 'Åtgärd krävs'].some(a => o.abs.includes(a))) {
            let reason = o.abs; absCounts[reason] = (absCounts[reason] || 0) + 1; totalAbs++; const dObj = new Date(cy, cm-1, d); const dayStr = `${daysLong[dObj.getDay()]} ${d}`; let bKey = reason.split(' ')[0]; const icon = em[reason] || em[bKey] || '•'; const tCol = col[reason] || col[bKey] || 'text-slate-500'; const bCol = bgClass[reason] || bgClass[bKey] || 'bg-slate-50';
            let statsHtml = ""; if (o.fk_perc !== undefined && o.abs_hours && reason !== 'Åtgärd krävs') { let totalH = qData.work_h ? (qData.work_h + o.abs_hours) : o.abs_hours; let actualP = totalH > 0 ? Math.round((o.abs_hours / totalH) * 100) : 100; let hStr = o.abs_hours.toFixed(2).replace('.00',''); statsHtml = `<div class="flex items-center gap-2 mt-3"><div class="bg-white border border-slate-100 rounded-xl px-2 py-2 flex flex-col items-center flex-1 shadow-sm"><span class="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tid Borta</span><span class="text-[12px] font-black text-slate-700">${hStr} tim</span></div><div class="bg-white border border-slate-100 rounded-xl px-2 py-2 flex flex-col items-center flex-1 shadow-sm"><span class="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Frånvaro (FK)</span><span class="text-[12px] font-black text-[#0ea5e9]">${actualP}% <span class="text-slate-400 text-[9.5px]">(${o.fk_perc}%)</span></span></div></div>`; }
            absListHTML += `<div class="flex flex-col p-3 mb-2 border border-slate-100/60 rounded-[20px] bg-white shadow-sm hover:shadow-md transition-shadow"><div class="flex justify-between items-center"><span class="text-[9.5px] font-black uppercase text-slate-500 tracking-wider flex items-center">${dayStr}</span><span class="text-[10px] font-black ${tCol} ${bCol} border border-slate-100/50 uppercase tracking-widest px-2.5 py-1.5 rounded-lg">${icon} ${reason}</span></div>${statsHtml}</div>`;
        }
    }
    if (totalAbs === 0) { pane.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400 opacity-60"><span class="text-4xl mb-3">💪</span><p class="text-[9px] font-black uppercase tracking-widest text-center px-4">Ingen registrerad frånvaro<br>denna månad</p></div>`; return; }

    let summaryHTML = `<div class="mb-2 bg-white rounded-[20px] border border-slate-200 p-3 shadow-md flex-shrink-0"><h4 class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1.5">SAMMANFATTNING</h4>`;
    for (let reason in absCounts) { let bKey = reason.split(' ')[0]; const icon = em[reason] || em[bKey] || '•'; const tCol = col[reason] || col[bKey] || 'text-slate-500'; summaryHTML += `<div onclick="triggerFocusMode('${reason}')" class="flex justify-between items-center mb-1 last:mb-0 cursor-pointer active:scale-95 transition-transform hover:bg-slate-50 p-1.5 -mx-1.5 rounded-lg"><span class="text-[10px] font-black ${tCol} uppercase tracking-wider">${icon} ${reason}</span><span class="text-[11px] font-black text-slate-800">${absCounts[reason]} dagar</span></div>`; }
    summaryHTML += `</div>`; pane.innerHTML = `<div class="flex flex-col h-full overflow-hidden">${summaryHTML}<div class="overflow-y-auto hide-scrollbar flex-1 pb-2">${absListHTML}</div></div>`;
}

// ==========================================
//  UI & MODAL LOGIC
// ==========================================
async function init() {
    await loadAllData();
    setMode('dash');
    updateTopTitle();
}

// --- INLINE NUMPAD (DASHBOARD) ---
function openInlineNumpad() {
    if (!activeK) return;
    const o = db.d[activeK] || {s: 0};
    inlineNumpadValue = o.s > 0 ? String(o.s) : "";
    inlineNumpadJustOpened = true;
    updateInlineNumpadDisplay();
    const m = document.getElementById('dash-inline-numpad');
    if(m) m.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
}

function closeInlineNumpad() {
    const m = document.getElementById('dash-inline-numpad');
    if(m) m.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
}

function updateInlineNumpadDisplay() {
    const disp = document.getElementById('inline-numpad-display');
    if(disp) {
        if(inlineNumpadValue === "") disp.innerText = "0 kr";
        else disp.innerText = Number(inlineNumpadValue).toLocaleString('sv-SE') + " kr";
    }
}

function inlinePress(key) {
    if (inlineNumpadJustOpened) {
        if (key === 'clear') { inlineNumpadValue = ""; }
        else if (key === 'back') { inlineNumpadValue = inlineNumpadValue.slice(0, -1); }
        else { inlineNumpadValue = key; }
        inlineNumpadJustOpened = false;
        updateInlineNumpadDisplay();
        return;
    }
    if (key === 'clear') { inlineNumpadValue = ""; }
    else if (key === 'back') { inlineNumpadValue = inlineNumpadValue.slice(0, -1); }
    else { if (inlineNumpadValue.length < 8) inlineNumpadValue += key; }
    updateInlineNumpadDisplay();
}

function inlineTarget() {
    inlineNumpadJustOpened = false;
    if (!activeK) return;
    let target = timeline[activeK]?.target || 0;
    if (target > 0) { inlineNumpadValue = String(Math.ceil(target)); updateInlineNumpadDisplay(); }
}

function inlineAdd(amount) {
    inlineNumpadJustOpened = false;
    let current = Number(inlineNumpadValue) || 0;
    current += amount;
    inlineNumpadValue = String(current);
    updateInlineNumpadDisplay();
}

function saveInlineNumpad() {
    if (!activeK) return;
    let val = Number(inlineNumpadValue) || 0;
    pushMatrixSync(activeK, { s: val, st: 'Arbete', abs: null });
    closeInlineNumpad();
}

// --- MAIN NUMPAD (MONTH VIEW) ---
function openNumpad(mode, defaultVal, title) {
    numpadTarget = mode;
    numpadValue = defaultVal > 0 ? String(defaultVal) : "";
    mainNumpadJustOpened = true;
    const np = document.getElementById('bottom-numpad-view');
    if(np) np.classList.remove('opacity-0', 'pointer-events-none');
    updateNumpadDisplay();
}

function closeNumpad() {
    numpadTarget = null;
    const np = document.getElementById('bottom-numpad-view');
    if(np) np.classList.add('opacity-0', 'pointer-events-none');
}

function updateNumpadDisplay() {
    if(numpadTarget === 'month') {
        const textEl = document.getElementById('month-sales-text');
        if(textEl) {
            if(numpadValue === "") textEl.innerText = "0 kr";
            else textEl.innerText = Number(numpadValue).toLocaleString('sv-SE') + " kr";
        }
    }
}

function numpadPress(key) {
    if (mainNumpadJustOpened) {
        if (key === 'clear') { numpadValue = ""; }
        else if (key === 'back') { numpadValue = numpadValue.slice(0, -1); }
        else { numpadValue = key; }
        mainNumpadJustOpened = false;
        updateNumpadDisplay();
        return;
    }
    if (key === 'clear') { numpadValue = ""; }
    else if (key === 'back') { numpadValue = numpadValue.slice(0, -1); }
    else { if (numpadValue.length < 8) numpadValue += key; }
    updateNumpadDisplay();
}

function numpadSave() {
    let val = Number(numpadValue) || 0;
    if (numpadTarget === 'month' && multiSelectKeys.size > 0) {
        multiSelectKeys.forEach(k => {
            pushMatrixSync(k, { s: val, st: 'Arbete', abs: null });
        });
        closeMonthEdit();
    }
    closeNumpad();
}

function closeFocusMode(force) { 
    currentFocusReason = null; 
    document.body.classList.remove('focus-mode-active'); 
    document.querySelectorAll('.day-cell, .vp-cell').forEach(c => c.classList.remove('focus-highlight'));
    updateDashboardView(); updateTopInfoBar(); 
}

function closeMonthEdit() { 
    const menu = document.getElementById('month-edit-menu'); 
    if(menu) menu.classList.add('hidden'); 
    const head = document.getElementById('cal-standard-header'); 
    if(head) head.classList.remove('hidden'); 
    multiSelectKeys.clear(); 
    document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active-focus')); 
    updateTopInfoBar();
}

// --- UTVÄRDERING (NY SKALA 1-5) ---
function openEvalModal() { 
    if (!activeK) return;
    const o = db.d[activeK] || {};
    
    if (o.eval) {
        evalState = typeof o.eval === 'string' ? JSON.parse(o.eval) : JSON.parse(JSON.stringify(o.eval));
        if(evalState.emoji) evalState = {}; 
    } else {
        evalState = {};
    }
    
    renderEvalMetricsUI();
    
    const m = document.getElementById('eval-modal'); 
    if(m) { m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0'), 10); } 
}

function closeEvalModal() { 
    const m = document.getElementById('eval-modal'); 
    if(m) { m.classList.add('opacity-0'); setTimeout(() => m.classList.add('hidden'), 300); } 
}

function setEvalScore(metricId, score) {
    evalState[metricId] = score;
    renderEvalMetricsUI();
}

function renderEvalMetricsUI() {
    const cont = document.getElementById('eval-metrics-container');
    if(!cont) return;
    let html = '';

    evalMetrics.forEach(m => {
        let score = evalState[m.id] || 0;
        let btnHtml = '';
        for(let i=1; i<=5; i++) {
            let activeClass = (i === score) ? 'active' : 'bg-slate-50 text-slate-500 border-slate-200';
            btnHtml += `<button onclick="setEvalScore('${m.id}', ${i})" class="eval-scale-btn flex-1 py-2.5 rounded-xl text-[12px] font-black border shadow-sm ${activeClass}">${i}</button>`;
        }

        html += `
            <div class="flex flex-col gap-1.5 p-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">${m.label}</span>
                <div class="flex gap-1.5 justify-between">
                    ${btnHtml}
                </div>
            </div>
        `;
    });
    cont.innerHTML = html;
}

async function saveEvalModal() { 
    if (!activeK) return;
    if (!db.d[activeK]) db.d[activeK] = {s:0};
    db.d[activeK].eval = evalState;
    db.d[activeK].has_eval_saved = true;
    try { localStorage.setItem('sf_eval_obj_' + activeK, JSON.stringify(evalState)); } catch(e){}
    
    if (sb) {
        const merged = {
            date_key: activeK,
            status: db.d[activeK].st || 'Arbete',
            sales: db.d[activeK].s || 0,
            is_absent: db.d[activeK].abs || null,
            raw_reason: db.d[activeK].raw || null,
            fk_perc: db.d[activeK].fk_perc || null,
            abs_hours: db.d[activeK].abs_hours || null,
            eval_data: evalState
        };
        sb.from('sales_data').upsert(merged).then(({error}) => { 
            if(error) console.warn("Supabase utvärdering fel:", error); 
        });
    }

    closeEvalModal(); 
    updateDashboardView();
}

// --- ANTECKNINGAR I POPUP --- //
let currentEditId = null;

function openNotesModal() {
    const m = document.getElementById('notes-modal');
    if(m) {
        renderNotes();
        m.classList.remove('hidden');
        setTimeout(() => m.classList.replace('opacity-0', 'opacity-100'), 10);
    }
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) {
        modal.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            currentEditId = null;
            const submitBtn = document.getElementById('note-submit-btn');
            if(submitBtn) submitBtn.innerText = "SPARA ANTECKNING";
            ['note-name', 'note-phone', 'note-order', 'note-text', 'note-due', 'note-prio'].forEach(id => {
                if(document.getElementById(id)) document.getElementById(id).value = '';
            });
        }, 300);
    }
}

function addNote() { 
    const nameEl = document.getElementById('note-name');
    const phoneEl = document.getElementById('note-phone');
    const orderEl = document.getElementById('note-order');
    const textEl = document.getElementById('note-text');
    const dueEl = document.getElementById('note-due');
    const prioEl = document.getElementById('note-prio');
    
    const name = nameEl ? nameEl.value.trim() : '';
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const order = orderEl ? orderEl.value.trim() : '';
    const text = textEl ? textEl.value.trim() : '';
    const due = dueEl ? dueEl.value : '';
    const prio = prioEl ? prioEl.value : '';
    
    if(!text && !name) return; 

    let cleanNotes = [];
    try { cleanNotes = JSON.parse(localStorage.getItem('sf_notes_clean')) || []; } catch(e){}

    if (currentEditId) {
        // Uppdatera befintlig
        const index = cleanNotes.findIndex(n => n.id === currentEditId);
        if (index !== -1) {
            cleanNotes[index] = { ...cleanNotes[index], name, phone, order, text, due, prio };
        }
        currentEditId = null;
        document.getElementById('note-submit-btn').innerText = "SPARA ANTECKNING";
    } else {
        // Lägg till ny
        const newNote = { id: Date.now(), name, phone, order, text, due, prio };
        cleanNotes.unshift(newNote);
        if (typeof sb !== 'undefined' && sb) {
            sb.from('notes').insert([{ id: newNote.id, customer_name: newNote.name, phone: newNote.phone, order_nr: newNote.order, note_text: newNote.text }]).then(({error}) => { if(error) console.warn("Supabase fel:", error); });
        }
    }
    
    localStorage.setItem('sf_notes_clean', JSON.stringify(cleanNotes));
    
    if(nameEl) nameEl.value = ''; if(phoneEl) phoneEl.value = ''; if(orderEl) orderEl.value = ''; 
    if(textEl) textEl.value = ''; if(dueEl) dueEl.value = ''; if(prioEl) prioEl.value = ''; 
    
    renderNotes(); 
}

function editNote(id) {
    let cleanNotes = [];
    try { cleanNotes = JSON.parse(localStorage.getItem('sf_notes_clean')) || []; } catch(e){}
    const note = cleanNotes.find(n => n.id === id);
    if(!note) return;

    document.getElementById('note-name').value = note.name || '';
    document.getElementById('note-phone').value = note.phone || '';
    document.getElementById('note-order').value = note.order || '';
    document.getElementById('note-text').value = note.text || '';
    document.getElementById('note-due').value = note.due || '';
    document.getElementById('note-prio').value = note.prio || '';

    currentEditId = id;
    document.getElementById('note-submit-btn').innerText = "UPPDATERA ANTECKNING";
    document.getElementById('notes-list-container').scrollTop = 0;
}

function deleteNote(id) {
    if(!confirm("Vill du verkligen radera denna anteckning?")) return;
    let cleanNotes = [];
    try { cleanNotes = JSON.parse(localStorage.getItem('sf_notes_clean')) || []; } catch(e){}
    cleanNotes = cleanNotes.filter(n => n.id !== id);
    localStorage.setItem('sf_notes_clean', JSON.stringify(cleanNotes));
    renderNotes();
}

function renderNotes() { 
    const c = document.getElementById('notes-list-container'); 
    if(!c) return;
    
    // Tar bort den gamla trasiga datan
    localStorage.removeItem('sf_notes');
    
    let cleanNotes = [];
    try { cleanNotes = JSON.parse(localStorage.getItem('sf_notes_clean')) || []; } catch(e){}
    
    checkUrgentNotes(cleanNotes);
    
    if(cleanNotes.length === 0) { 
        c.innerHTML = '<div class="h-full flex flex-col items-center justify-center p-4 mt-4"><span class="text-3xl mb-2 opacity-40">📝</span><p class="text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">Inga anteckningar</p></div>'; 
        return;
    }

    const prioIcons = { '1': '🔴 Prio 1', '2': '🟡 Prio 2', '3': '🔵 Prio 3' };

    c.innerHTML = cleanNotes.map(note => {
        let dueHtml = '';
        if (note.due) {
            const daysLeft = Math.ceil((new Date(note.due) - new Date()) / (1000 * 60 * 60 * 24));
            const colorClass = daysLeft < 0 ? 'text-red-500 font-black' : (daysLeft <= 7 ? 'text-amber-500 font-bold' : 'text-slate-400');
            dueHtml = `<span class="${colorClass}">⏳ ${note.due}</span>`;
        }
        
        return `
            <div class="p-3.5 bg-white border border-slate-200 rounded-xl flex flex-col gap-1.5 shadow-sm relative">
                <div class="flex justify-between items-start">
                    ${note.name ? `<div class="text-[10px] font-black uppercase text-[#0ea5e9] tracking-wider">${note.name}</div>` : '<div></div>'}
                    <div class="flex gap-2">
                        <button onclick="editNote(${note.id})" class="text-[10px] text-slate-300 hover:text-[#0ea5e9] transition-colors">✏️</button>
                        <button onclick="deleteNote(${note.id})" class="text-[10px] text-slate-300 hover:text-red-500 transition-colors">🗑️</button>
                    </div>
                </div>
                ${note.text ? `<div class="text-[11px] font-bold text-slate-700 leading-snug whitespace-pre-wrap">${note.text}</div>` : ''}
                <div class="flex justify-between items-center text-[9px] font-black text-slate-400 mt-1 uppercase tracking-wide border-t border-slate-100 pt-2">
                    <div class="flex flex-col gap-1">
                        ${note.phone ? `<span>📞 ${note.phone}</span>` : ''}
                        ${note.order ? `<span>📦 ${note.order}</span>` : ''}
                    </div>
                    <div class="flex flex-col items-end gap-1 text-right">
                        ${note.prio ? `<span>${prioIcons[note.prio]}</span>` : ''}
                        ${dueHtml}
                    </div>
                </div>
            </div>`;
    }).join('');
}

function checkUrgentNotes(notes) {
    const penBtn = document.querySelector('[onclick="openNotesModal()"]') || document.getElementById('btn-notes');
    if(!penBtn) return;

    let hasUrgent = false;
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let n of notes) {
        if (n.prio === '1' && n.due) {
            const dueDate = new Date(n.due);
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 7 && diffDays >= -30) {
                hasUrgent = true;
                break;
            }
        }
    }

    if (hasUrgent) {
        penBtn.classList.add('urgent-note-blink');
    } else {
        penBtn.classList.remove('urgent-note-blink');
    }
}

// --- SAMMANFATTNING & INSIKTER ---
function toggleSummaryView() {
    const stats = document.getElementById('summary-stats-view');
    const insights = document.getElementById('summary-insights-view');
    const title = document.getElementById('summary-modal-title');
    if (currentSummaryView === 'stats') {
        stats.classList.add('hidden'); 
        insights.classList.remove('hidden'); 
        currentSummaryView = 'insights';
        title.innerText = "INSIKTER";
    } else {
        insights.classList.add('hidden'); 
        stats.classList.remove('hidden'); 
        currentSummaryView = 'stats';
        title.innerText = "SAMMANFATTNING";
    }
}

function calculateSummaryStats() {
    const cy = viewDate.getFullYear();
    const cm = viewDate.getMonth() + 1;
    const daysM = new Date(cy, cm, 0).getDate();
    
    let wDays = 0, aDays = 0, bestS = 0, bestD = "--", worstS = Infinity, worstD = "--";
    let streak = 0, maxStreak = 0;
    let absCounts = {};
    
    let totalEvals = 0;
    let goodScores = { flow: 0, energy: 0, engagement: 0, closing: 0, upsell: 0 };
    let goodCount = { flow: 0, energy: 0, engagement: 0, closing: 0, upsell: 0 };
    let badScores = { flow: 0, energy: 0, engagement: 0, closing: 0, upsell: 0 };
    let badCount = { flow: 0, energy: 0, engagement: 0, closing: 0, upsell: 0 };
    
    for (let d=1; d<=daysM; d++) {
        const k = `${cy}-${cm}-${d}`;
        const o = db.d[k] || {s:0};
        const tgt = timeline[k]?.target || 0;
        const qData = db.q[k] || {};
        
        if ((o.s > 0) || (qData.start && !o.abs && o.st !== 'Ledig' && o.st !== 'Semester')) wDays++;
        
        if (o.abs && !o.abs.includes('Semester') && o.abs !== 'Åtgärd krävs') {
            aDays++;
            let baseAbs = o.abs.split(' ')[0];
            absCounts[baseAbs] = (absCounts[baseAbs] || 0) + 1;
        }
        
        if (o.s > 0) {
            if (o.s > bestS) { bestS = o.s; bestD = `${d}/${cm}`; }
            if (o.s < worstS) { worstS = o.s; worstD = `${d}/${cm}`; }
        }
        
        if (tgt > 0 && o.s >= tgt) {
            streak++;
            if (streak > maxStreak) maxStreak = streak;
        } else if (tgt > 0 && o.s < tgt) {
            streak = 0;
        }

        if (o.eval) {
            totalEvals++;
            let ev = typeof o.eval === 'string' ? JSON.parse(o.eval) : o.eval;
            let isGood = tgt > 0 && o.s >= tgt;
            let isBad = tgt > 0 && o.s < tgt;

            evalMetrics.forEach(m => {
                let score = ev[m.id];
                if (score) {
                    if (isGood) { goodScores[m.id] += score; goodCount[m.id]++; }
                    if (isBad) { badScores[m.id] += score; badCount[m.id]++; }
                }
            });
        }
    }
    
    document.getElementById('sum-workdays').innerText = wDays;
    document.getElementById('sum-absdays').innerText = aDays;
    
    if (bestS > 0) {
        document.getElementById('sum-bestday-val').innerText = (bestS/1000).toFixed(1) + "k";
        document.getElementById('sum-bestday-lbl').innerText = bestD;
    } else {
        document.getElementById('sum-bestday-val').innerText = "0k";
        document.getElementById('sum-bestday-lbl').innerText = "--";
    }
    
    if (worstS !== Infinity) {
        document.getElementById('sum-worstday-val').innerText = (worstS/1000).toFixed(1) + "k";
        document.getElementById('sum-worstday-lbl').innerText = worstD;
    } else {
        document.getElementById('sum-worstday-val').innerText = "0k";
        document.getElementById('sum-worstday-lbl').innerText = "--";
    }
    
    document.getElementById('sum-streak').innerText = maxStreak + " 🔥";
    
    let bestWk = 0; let bestWkLbl = "--";
    for (let d=1; d<=daysM-6; d++) {
        let wkS = 0;
        for(let i=0; i<7; i++) { wkS += (db.d[`${cy}-${cm}-${d+i}`]?.s || 0); }
        if (wkS > bestWk) {
            bestWk = wkS;
            bestWkLbl = `V.${getWeekNumber(new Date(cy, cm-1, d))}`;
        }
    }
    document.getElementById('sum-bestweek-val').innerText = (bestWk/1000).toFixed(1) + "k";
    document.getElementById('sum-bestweek-lbl').innerText = bestWkLbl;
    
    const absDetails = document.getElementById('sum-abs-details');
    const absList = document.getElementById('sum-abs-list');
    if (Object.keys(absCounts).length > 0) {
        absDetails.classList.remove('hidden');
        let h = "";
        const em = { 'Sjuk': '🤒', 'VAB': '👶', 'Föräldraledig': '🍼' };
        for(let a in absCounts) {
            h += `<div class="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100"><span class="text-[9px] font-black uppercase tracking-wider text-slate-600">${em[a] || '⚠️'} ${a}</span><span class="text-[10px] font-black text-slate-800">${absCounts[a]} st</span></div>`;
        }
        absList.innerHTML = h;
    } else {
        absDetails.classList.add('hidden');
    }

    const insightCont = document.getElementById('insight-container');
    if (totalEvals === 0) {
        insightCont.innerHTML = `<div class="flex flex-col items-center justify-center py-10 opacity-50"><span class="text-4xl mb-2">🫙</span><p class="text-[10px] font-black uppercase tracking-widest text-center text-slate-500">Inga utvärderingar<br>denna månad</p></div>`;
    } else {
        let goodHtml = '';
        let badHtml = '';

        evalMetrics.forEach(m => {
            let gAvg = goodCount[m.id] > 0 ? (goodScores[m.id] / goodCount[m.id]).toFixed(1) : '-';
            let bAvg = badCount[m.id] > 0 ? (badScores[m.id] / badCount[m.id]).toFixed(1) : '-';

            if(gAvg !== '-') {
                goodHtml += `<div class="flex justify-between items-center py-0.5 border-b border-[#bbf7d0] last:border-0"><span class="text-[9.5px] font-bold text-emerald-700">${m.label}</span><span class="text-[11px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded shadow-sm">${gAvg}</span></div>`;
            }
            if(bAvg !== '-') {
                badHtml += `<div class="flex justify-between items-center py-0.5 border-b border-[#fecdd3] last:border-0"><span class="text-[9.5px] font-bold text-rose-700">${m.label}</span><span class="text-[11px] font-black text-rose-600 bg-white px-2 py-0.5 rounded shadow-sm">${bAvg}</span></div>`;
            }
        });

        insightCont.innerHTML = `
            <div class="bg-white border border-slate-100 rounded-[20px] p-2 shadow-sm flex flex-col gap-2">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center mb-0.5">Dina mönster (${totalEvals} pass)</span>
                
                ${goodHtml ? `
                <div class="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-2 shadow-inner">
                    <span class="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">✅ Snitt när du NÅTT MÅL</span>
                    <div class="flex flex-col">${goodHtml}</div>
                </div>` : ''}

                ${badHtml ? `
                <div class="bg-[#fff1f2] border border-[#fecdd3] rounded-xl p-2 shadow-inner">
                    <span class="text-[8px] font-black text-rose-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">❌ Snitt när du MISSAT MÅL</span>
                    <div class="flex flex-col">${badHtml}</div>
                </div>` : ''}
            </div>
        `;
    }
}

function openSummaryModal(mode) { 
    calculateSummaryStats();
    currentSummaryView = 'stats';
    document.getElementById('summary-stats-view').classList.remove('hidden');
    document.getElementById('summary-insights-view').classList.add('hidden');
    document.getElementById('summary-modal-title').innerText = "SAMMANFATTNING";
    
    const m = document.getElementById('summary-modal'); 
    if(m) { m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0'), 10); } 
}

function closeSummaryModal() { const m = document.getElementById('summary-modal'); if(m) { m.classList.add('opacity-0'); setTimeout(() => m.classList.add('hidden'), 300); } }

function selectChild(name) { 
    closeChildModal();
    let absStr = pendingAbsenceType;
    if (absStr === 'VAB' || absStr === 'Föräldraledig') absStr += ' ' + name;
    
    if (pendingAbsenceSource === 'dash' && activeK) {
        pushMatrixSync(activeK, { abs: absStr, st: 'Arbete', s: 0 });
    } else if (pendingAbsenceSource === 'month' && multiSelectKeys.size > 0) {
        multiSelectKeys.forEach(k => pushMatrixSync(k, { abs: absStr, st: 'Arbete', s: 0 }));
        closeMonthEdit();
    }
}
function closeChildModal() { const m = document.getElementById('child-select-modal'); if(m) m.classList.add('hidden'); }
function triggerChildSelection(type, source) { 
    pendingAbsenceType = type; pendingAbsenceSource = source;
    const m = document.getElementById('child-select-modal'); 
    if(m) { 
        document.getElementById('child-modal-title').innerText = type + ' GÄLLER VEM?'; 
        m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0'), 10); 
    } 
}

function openBudgetModal() { const m = document.getElementById('budget-modal'); if(m) m.classList.remove('hidden'); }
function closeBudgetModal() { const m = document.getElementById('budget-modal'); if(m) m.classList.add('hidden'); }
function closeNoteConfirmModal() { const m = document.getElementById('note-confirm-modal'); if(m) m.classList.add('hidden'); }

function checkOverwriteFromPopup(type) { 
    if (type === 'VAB' || type === 'Föräldraledig') { triggerChildSelection(type, 'month'); return; }
    if (type === 'delete') { multiSelectKeys.forEach(k => pushMatrixSync(k, { abs: null, st: 'Arbete', s: 0 })); closeMonthEdit(); return; }
    multiSelectKeys.forEach(k => pushMatrixSync(k, { abs: type === 'Arbete' ? null : type, st: type, s: 0 })); 
    closeMonthEdit(); 
}

function handleDashAction(type) { 
    if(!activeK) return;
    if (type === 'VAB' || type === 'Föräldraledig') { triggerChildSelection(type, 'dash'); return; }
    pushMatrixSync(activeK, { abs: type === 'Arbete' ? null : type, st: type, s: 0 }); 
}

function hideConfirm() { const box = document.getElementById('confirm-box'); if(box) box.style.display = 'none'; }

function triggerFocusMode(reason) { 
    currentFocusReason = reason; 
    
    let temp = currentFocusReason;
    currentFocusReason = null;
    setMode('month'); 
    currentFocusReason = temp;

    document.body.classList.add('focus-mode-active');
    document.querySelectorAll('.day-cell, .vp-cell').forEach(c => {
        const k = c.dataset.key;
        const o = db.d[k];
        if(o && o.abs && o.abs.includes(reason)) c.classList.add('focus-highlight');
        else c.classList.remove('focus-highlight');
    });
    
    closeSummaryModal();
}

// ==========================================
//  EVENT LISTENERS & APP START
// ==========================================
function handleSwipeStart(e) { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; }
function handleSwipeEnd(e, targetView) { 
    let dx = e.changedTouches[0].screenX - touchStartX; 
    let dy = e.changedTouches[0].screenY - touchStartY; 
    if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) { 
        let dir = dx > 0 ? -1 : 1; 
        if (targetView === 'day') navDay(dir);
        else if (targetView === 'week') navCal(dir);
        else if (targetView === 'month' && viewMode === 'month') navCal(dir);
        else if (targetView === 'absence' && viewMode === 'absence') navCal(dir);
    } 
}

// Touch Listeners uppdelade mellan vecka och dag
const pdInner = document.getElementById('dash-inner-card'); 
if(pdInner) { 
    pdInner.addEventListener('touchstart', handleSwipeStart, {passive: true}); 
    pdInner.addEventListener('touchend', (e) => handleSwipeEnd(e, 'day'), {passive: true}); 
}
const sCurr = document.getElementById('slide-curr'); 
if(sCurr) { 
    sCurr.addEventListener('touchstart', handleSwipeStart, {passive: true}); 
    sCurr.addEventListener('touchend', (e) => handleSwipeEnd(e, 'week'), {passive: true}); 
}

const pm = document.getElementById('pane-month'); if(pm) { pm.addEventListener('touchstart', handleSwipeStart, {passive: true}); pm.addEventListener('touchend', (e) => handleSwipeEnd(e, 'month'), {passive: true}); }
const pa = document.getElementById('pane-absence'); if(pa) { pa.addEventListener('touchstart', handleSwipeStart, {passive: true}); pa.addEventListener('touchend', (e) => handleSwipeEnd(e, 'absence'), {passive: true}); }

document.getElementById('top-info-bar').addEventListener('click', () => {
    if (viewMode !== 'dash' && !multiSelectKeys.size) return;
    let cDate = new Date(realToday);
    for(let i=0; i<30; i++) {
        const k = getK(cDate); const qData = db.q[k] || {}; const state = getCellState(k);
        if (qData.start && state !== 'absent' && state !== 'ledig' && state !== 'semester') {
            if(!activeK) { goToDayFromMonth(k); }
            break;
        }
        cDate.setDate(cDate.getDate() + 1);
    }
});

document.addEventListener('click', (e) => { const mMenu = document.getElementById('month-edit-menu'); if (mMenu && !mMenu.classList.contains('hidden') && !e.target.closest('#month-edit-menu') && !e.target.closest('.day-cell') && !e.target.closest('.vp-cell') && !e.target.closest('#bottom-numpad-view') && !e.target.closest('#top-info-bar')) { multiSelectKeys.clear(); document.querySelectorAll('.day-cell, .vp-cell').forEach(c => c.classList.remove('active-focus')); closeMonthEdit(); updateTopInfoBar(); } });

// Start the application
init();

if ("serviceWorker" in navigator) { 
    navigator.serviceWorker.register("sw.js").catch(e => {}); 
}
