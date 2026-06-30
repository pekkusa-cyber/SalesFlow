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
let focusKeySet = null;
let summaryFocus = null;
let pendingAbsenceType = null;
let pendingAbsenceSource = null;

let savedNotes = [];
let savedBudgets = {};
let savedCalls = [];

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

// ==========================================
//  TOAST NOTIFICATIONS
// ==========================================
function showToast(icon, msg, duration = 4000) {
    const toast = document.getElementById('sf-toast');
    if(!toast) return;
    document.getElementById('sf-toast-icon').innerText = icon;
    document.getElementById('sf-toast-msg').innerText = msg;
    toast.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-8');
    
    if(window.toastTimer) clearTimeout(window.toastTimer);
    
    window.toastTimer = setTimeout(() => {
        toast.classList.add('opacity-0', 'pointer-events-none', '-translate-y-8');
    }, duration);
}

// ==========================================
//  COACH LOGIK (SÄLJ-JOURNAL MED UI)
// ==========================================
let activeCoachCallId = null;

function openCoachModalMain() {
    const m = document.getElementById('coach-main-modal');
    if(m) { 
        m.classList.remove('hidden'); 
        setTimeout(() => m.classList.remove('opacity-0'), 10); 
    }
}

function closeCoachModalMain() {
    const m = document.getElementById('coach-main-modal');
    if(m) { 
        m.classList.add('opacity-0'); 
        setTimeout(() => m.classList.add('hidden'), 300); 
    }
}

function openCoachHistoryModal() {
    renderCoachingLibrary();
    const m = document.getElementById('coach-history-modal');
    if(m) { 
        m.classList.remove('hidden'); 
        setTimeout(() => m.classList.remove('opacity-0'), 10); 
    }
}

function closeCoachHistoryModal() {
    const m = document.getElementById('coach-history-modal');
    if(m) { 
        m.classList.add('opacity-0'); 
        setTimeout(() => m.classList.add('hidden'), 300); 
    }
}

async function submitNewCall() {
    const textInput = document.getElementById('call-input-text');
    const titleInput = document.getElementById('call-input-title');
    const typeInput = document.getElementById('call-input-type');
    const statusText = document.getElementById('coach-status-text');
    const btn = document.getElementById('btn-analyze-call');

    if (!textInput) return;
    const transcription = textInput.value.trim();
    if (!transcription) { alert("Du måste klistra in text att analysera!"); return; }

    const tag = typeInput && typeInput.value === 'utv' ? '[UTV] ' : '[BRA] ';
    const rawTitle = titleInput && titleInput.value ? titleInput.value : 'Okänt Samtal';
    const finalTitle = tag + rawTitle;

    if (btn) btn.disabled = true;
    if (statusText) { statusText.classList.remove('hidden'); }

    try {
        const response = await fetch("https://xnrclzkzzthlesaftpvs.supabase.co/functions/v1/transcribe-and-save", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'analyze_single', text: transcription })
        });

        const result = await response.json();
        if (response.ok && sb) {
            const { data } = await sb.from('sales_calls').insert({
                title: finalTitle,
                transcription: transcription,
                analysis: result.analysis
            }).select().single();

            if (data) {
                savedCalls.unshift(data);
                textInput.value = '';
                if(titleInput) titleInput.value = '';
                
                if(btn) {
                    let oldText = btn.innerHTML;
                    btn.innerHTML = "✅ SPARAD I HISTORIK!";
                    btn.classList.add("bg-emerald-500", "border-emerald-400");
                    btn.classList.remove("bg-slate-800");
                    setTimeout(() => {
                        btn.innerHTML = oldText;
                        btn.classList.remove("bg-emerald-500", "border-emerald-400");
                        btn.classList.add("bg-slate-800");
                    }, 2500);
                }

                const callCount = savedCalls.length;
                if (callCount >= 2 && (callCount === 2 || callCount % 3 === 0)) {
                    setTimeout(autoAnalyzeRedThread, 1500);
                }

                renderCoachingLibrary();
            }
        }
    } catch (e) { console.error("Kunde inte analysera", e); }

    if (btn) btn.disabled = false;
    if (statusText) statusText.classList.add('hidden');
}

async function autoAnalyzeRedThread() {
    showToast("🤖", "Hjärnan analyserar mönster i dina samtal...", 3000);
    try {
        const response = await fetch("https://xnrclzkzzthlesaftpvs.supabase.co/functions/v1/transcribe-and-save", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: 'analyze_thread' })
        });
        const result = await response.json();
        
        if (response.ok && result.analysis) {
            localStorage.setItem('sf_latest_red_thread', result.analysis);
            showToast("🧠", "Röd tråd hittad i dina sälj! (Både bra & utveckling)", 6000);
            renderCoachingLibrary(); 
        } else {
            showToast("⚠️", "Behöver fler samtal för att hitta en tydlig röd tråd.", 4000);
        }
    } catch (e) { 
        showToast("❌", "Kunde inte leta efter röd tråd just nu (serverfel).", 4000);
    }
}

function openSavedRedThread() {
    const text = localStorage.getItem('sf_latest_red_thread');
    if(!text) return;
    document.getElementById('rt-content').innerHTML = formatCoachText(text);
    const m = document.getElementById('red-thread-modal');
    if(m) { m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0'), 10); }
}

function renderCoachingLibrary() {
    const list = document.getElementById('coach-history-list');
    if (!list) return;

    const bra = savedCalls.filter(c => (c.title || '').includes('[BRA]'));
    const utv = savedCalls.filter(c => (c.title || '').includes('[UTV]') || (!(c.title || '').includes('[BRA]') && !(c.title || '').includes('[UTV]')));

    let html = '';

    const savedThread = localStorage.getItem('sf_latest_red_thread');
    if (savedThread) {
        html += `
        <div onclick="openSavedRedThread()" class="mb-5 bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] p-4 rounded-[20px] shadow-md text-white active:scale-95 transition-transform cursor-pointer relative overflow-hidden border border-[#bae6fd]">
            <div class="absolute right-[-10px] top-[-10px] text-[60px] opacity-10">🧠</div>
            <h4 class="text-[11.5px] font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><span class="text-[16px]">🧠</span> DIN RÖDA TRÅD</h4>
            <p class="text-[10px] font-bold text-[#e0f2fe] leading-snug">AI:n har hittat mönster i dina samtal. Klicka för insikter.</p>
        </div>`;
    }
    
    if(bra.length > 0) {
        html += `<div class="mb-3">
                    <h4 class="text-[9px] font-black uppercase text-emerald-600 tracking-widest mb-2 border-b border-emerald-100 pb-1.5 flex items-center gap-1.5"><span>✅</span> Lyckade Avslut</h4>
                    <div class="flex flex-col gap-2">${bra.map(c => createCallCard(c, 'emerald')).join('')}</div>
                 </div>`;
    }
    
    if(utv.length > 0) {
        html += `<div>
                    <h4 class="text-[9px] font-black uppercase text-rose-500 tracking-widest mb-2 border-b border-rose-100 pb-1.5 flex items-center gap-1.5"><span>🎯</span> Utvecklingspotential</h4>
                    <div class="flex flex-col gap-2">${utv.map(c => createCallCard(c, 'rose')).join('')}</div>
                 </div>`;
    }

    if(bra.length === 0 && utv.length === 0 && !savedThread) {
        list.innerHTML = `<p class="text-center text-[10px] font-bold text-slate-400 mt-6 uppercase tracking-widest">Historiken är tom</p>`;
    } else {
        list.innerHTML = html;
    }
}

function createCallCard(call, color) {
    const cleanTitle = (call.title || 'Samtal').replace('[BRA] ', '').replace('[UTV] ', '');
    const dateStr = new Date(call.created_at).toLocaleDateString('sv-SE', {day: 'numeric', month: 'short'});
    return `
        <div onclick="openCoachCall('${call.id}')" class="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 hover:border-${color}-300 cursor-pointer active:scale-95 transition-all flex justify-between items-center relative overflow-hidden group">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-${color}-400 opacity-80 group-hover:opacity-100 transition-opacity"></div>
            <div class="pl-3 flex flex-col">
                <span class="text-[11px] font-black uppercase text-slate-800 tracking-wider">${cleanTitle}</span>
                <span class="text-[9px] font-bold text-slate-400 mt-1">${dateStr}</span>
            </div>
            <span class="text-[14px] opacity-40 group-hover:opacity-100 transition-opacity">👉</span>
        </div>`;
}

function formatCoachText(rawText) {
    let t = rawText || '';
    t = t.replace(/### (.*)/g, '<h3 class="text-[11px] font-black text-[#0ea5e9] uppercase tracking-widest mt-5 mb-2 border-b border-slate-100 pb-1">$1</h3>');
    t = t.replace(/## (.*)/g, '<h2 class="text-[12px] font-black text-slate-800 uppercase tracking-widest mt-5 mb-2">$1</h2>');
    t = t.replace(/\*\*(.*?)\*\*/g, '<span class="font-black text-slate-800">$1</span>');
    t = t.replace(/^- (.*)/gm, '<li class="ml-4 mb-1.5 list-disc text-slate-600 pl-1">$1</li>');
    t = t.replace(/\*/g, ''); 
    t = t.replace(/\n\n/g, '<div class="h-2"></div>');
    return t;
}

function openCoachCall(id) {
    const call = savedCalls.find(c => c.id === id || c.id === parseInt(id));
    if(!call) return;
    activeCoachCallId = call.id;

    const cleanTitle = (call.title || 'Samtal').replace('[BRA] ', '').replace('[UTV] ', '');
    document.getElementById('crm-title').innerText = cleanTitle;
    document.getElementById('crm-date').innerText = new Date(call.created_at).toLocaleString('sv-SE').substring(0,16);
    
    document.getElementById('crm-read-view').innerHTML = formatCoachText(call.analysis);
    
    document.getElementById('crm-edit-title').value = call.title; 
    document.getElementById('crm-edit-text').value = call.analysis;

    document.getElementById('crm-read-view').classList.remove('hidden');
    document.getElementById('crm-read-buttons').classList.remove('hidden');
    document.getElementById('crm-edit-view').classList.add('hidden');
    document.getElementById('crm-edit-buttons').classList.add('hidden');

    const m = document.getElementById('coach-read-modal');
    if(m) { m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0'), 10); }
}

function closeCoachCall() {
    const m = document.getElementById('coach-read-modal');
    if(m) { m.classList.add('opacity-0'); setTimeout(() => m.classList.add('hidden'), 300); }
    activeCoachCallId = null;
}

function toggleCoachEdit() {
    const rView = document.getElementById('crm-read-view');
    const eView = document.getElementById('crm-edit-view');
    const rBtn = document.getElementById('crm-read-buttons');
    const eBtn = document.getElementById('crm-edit-buttons');
    
    if(rView.classList.contains('hidden')) {
        rView.classList.remove('hidden'); rBtn.classList.remove('hidden');
        eView.classList.add('hidden'); eBtn.classList.add('hidden');
    } else {
        rView.classList.add('hidden'); rBtn.classList.add('hidden');
        eView.classList.remove('hidden'); eView.classList.add('flex'); eBtn.classList.remove('hidden');
    }
}

async function saveCoachCall() {
    if(!activeCoachCallId || !sb) return;
    const nTitle = document.getElementById('crm-edit-title').value;
    const nText = document.getElementById('crm-edit-text').value;

    const { error } = await sb.from('sales_calls').update({ title: nTitle, analysis: nText }).eq('id', activeCoachCallId);
    if(!error) {
        const idx = savedCalls.findIndex(c => c.id === activeCoachCallId);
        if(idx !== -1) {
            savedCalls[idx].title = nTitle;
            savedCalls[idx].analysis = nText;
        }
        renderCoachingLibrary();
        
        document.getElementById('crm-title').innerText = nTitle.replace('[BRA] ', '').replace('[UTV] ', '');
        document.getElementById('crm-read-view').innerHTML = formatCoachText(nText);
        toggleCoachEdit();
    } else { alert("Kunde inte spara uppdateringen."); }
}

async function deleteCoachCall() {
    if(!activeCoachCallId || !sb) return;
    if(!confirm("Vill du verkligen radera denna insikt? Det går inte att ångra.")) return;

    const { error } = await sb.from('sales_calls').delete().eq('id', activeCoachCallId);
    if(!error) {
        savedCalls = savedCalls.filter(c => c.id !== activeCoachCallId);
        renderCoachingLibrary();
        closeCoachCall();
    } else { alert("Kunde inte radera."); }
}

function closeRedThreadModal() {
    const m = document.getElementById('red-thread-modal');
    if(m) { m.classList.add('opacity-0'); setTimeout(() => m.classList.add('hidden'), 300); }
}

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
    if (!db.q[k]) db.q[k] = { work_h: 0, ledig_h: 0, ledigPeriods: [] };
    if (!db.q[k].ledigPeriods) db.q[k].ledigPeriods = [];
    if (isWork) {
        db.q[k].exists = true; if(!db.q[k].start || ev.start.time < db.q[k].start) db.q[k].start = ev.start.time;
        if(endStr) { let currentEnd = db.q[k].end || "00:00"; if(currentEnd === "00:00" && endStr !== "00:00" && !db.q[k].end) { db.q[k].end = endStr; } else if (endStr === "00:00") { db.q[k].end = "00:00"; } else if (endStr > currentEnd && currentEnd !== "00:00") { db.q[k].end = endStr; } }
        db.q[k].work_h += duration;
    }
    if (isLedig) { 
        db.q[k].exists = true; 
        db.q[k].ledig_h += duration; 
        if (ev.start.hasTime && endStr) {
            db.q[k].ledigPeriods.push({ start: ev.start.time, end: endStr });
        }
    }
}

async function loadAllData() {
    try {
        if (sb) {
            const [salesRes, budgetRes, notesRes, callsRes] = await Promise.all([
                sb.from('sales_data').select('*'),
                sb.from('monthly_budgets').select('*'),
                sb.from('notes').select('*').order('id', { ascending: false }),
                sb.from('sales_calls').select('*').order('created_at', { ascending: false })
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

            if (callsRes && callsRes.data) {
                savedCalls = callsRes.data;
            }
        }

        const response = await fetch("https://raw.githubusercontent.com/pekkusa-cyber/SalesFlow/main/schema.ics?t=" + Date.now()); 
        if(!response.ok) throw new Error("Kunde inte hämta ICS"); const text = await response.text();
        
        db.q = {}; invalidateScheduleCache(); const lines = text.split(/\r?\n/); let inEvent = false; let event = {}; let fullDesc = "";
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
    
    if (!viewDate) viewDate = new Date(realToday); 
    if (!currentWeekStart) currentWeekStart = new Date(realToday);
    
    multiSelectKeys.clear(); 
    closeMonthEdit(); 
    if(numpadTarget) closeNumpad();
    
    viewMode = mode; 
    document.body.classList.remove('mode-dash', 'mode-month', 'mode-absence');
    document.body.classList.add(`mode-${mode}`);
    document.body.classList.toggle('focus-mode-active', !!currentFocusReason);

    ['dash', 'month', 'absence'].forEach(m => {
        const b = document.getElementById(`tab-${m}`);
        if(b) { 
            if(m === mode) b.className = "flex-1 text-[6.5px] font-black uppercase tracking-wider py-1.5 rounded-md transition-all bg-[#0ea5e9] text-white shadow-sm"; 
            else b.className = "flex-1 text-[6.5px] font-black uppercase tracking-wider py-1.5 rounded-md text-slate-500 transition-all hover:bg-slate-200/50"; 
        }
    });

    // Dagens dag visas som ring (ej förvald) – väljs först vid tryck
    
    calculateTimeline(); 
    updateDash();
    
    if (mode === 'dash') { 
        renderWeekSlides(); 
        updateDashboardView(); 
    } else if (mode === 'month') { 
        renderCal(viewDate.getFullYear(), viewDate.getMonth() + 1); 
        updateCalToolbar();
    } else if (mode === 'absence') { 
        renderAbsence(); 
    }
    updateTopTitle();
}

function toggleDashMode() {
    const todayK = getK(realToday);
    const alreadyToday = (viewMode === 'dash' && activeK === todayK);
    activeK = alreadyToday ? null : todayK;   // toggle: markera/avmarkera idag
    currentWeekStart = new Date(realToday);
    const sdo = currentWeekStart.getDay() || 7; 
    currentWeekStart.setDate(currentWeekStart.getDate() - sdo + 1); 
    currentWeekStart.setHours(0,0,0,0);
    viewDate = new Date(realToday); 
    db.b = getBudgetForMonth(viewDate.getFullYear(), viewDate.getMonth() + 1);
    
    if (viewMode !== 'dash') { 
        setMode('dash'); 
    } else {
        calculateTimeline(); 
        renderWeekSlides(); 
        updateDashboardView(); 
        updateTopTitle(); 
        updateTopInfoBar();
        document.querySelectorAll('.vp-cell, .day-cell').forEach(c => { 
            if(activeK && c.dataset.key === activeK) c.classList.add('active-focus'); 
            else c.classList.remove('active-focus'); 
        });
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
    let baseDate = activeK ? new Date(activeK.split('-')[0], activeK.split('-')[1]-1, activeK.split('-')[2]) : new Date(realToday);
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
        calculateTimeline(); updateDash(); 
        if (viewMode === 'absence') renderAbsence(); 
    } else if (viewMode === 'dash') { 
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
    setMode('dash');
}

function syncTodayBlue() {
    const todayK = getK(realToday);
    document.querySelectorAll('.vp-cell').forEach(c => {
        if (c.dataset.key === todayK) c.classList.add('status-today'); // ringen finns alltid
    });
}
function selectDay(k, el, e) {
    e.stopPropagation();
    if (document.body.classList.contains('focus-mode-active')) { focusShowDay(k, el); return; }
    if (viewMode === 'month') {
        if (multiSelectKeys.has(k)) { multiSelectKeys.delete(k); el.classList.remove('active-focus'); } else { multiSelectKeys.add(k); el.classList.add('active-focus'); }
        updateCalToolbar();
    } else {
        const isSameDay = (activeK === k);
        if (isSameDay) { activeK = null; document.querySelectorAll('.vp-cell').forEach(c => c.classList.remove('active-focus')); syncTodayBlue(); if (viewMode === 'dash') { updateDashboardView(); } updateTopInfoBar(); return; }
        activeK = k; document.querySelectorAll('.vp-cell').forEach(c => c.classList.remove('active-focus')); el.classList.add('active-focus'); syncTodayBlue(); if (viewMode === 'dash') { updateDashboardView(); }
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
    const dashInner = document.getElementById('dash-inner-card');
    if (!dashInner) return;

    const dashTab = document.getElementById('tab-dash'); 
    if (dashTab) dashTab.innerText = activeK ? 'DAG' : 'VECKA';
    
    let dTarget = 0, dSales = 0, dDiff = 0; 
    let title = "", subtitle = "", statusText = "VÄLJ DAG"; 
    let showActions = false, absType = null, isReached = false, isActiveNow = false;

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
        let isPastShift = dObj.getTime() < realToday.getTime();
        
        if (isToday) {
            let endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19;
            let endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
            let shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
            if (now >= shiftEnd) isPastShift = true;
        }

        if (isToday && qData.start && !o.abs && state !== 'ledig' && state !== 'semester' && state !== 'unplanned') { 
            let startH = parseInt(qData.start.split(':')[0]||10); let startM = parseInt(qData.start.split(':')[1]||0);
            let endH = parseInt(qData.end.split(':')[0]||19); let endM = parseInt(qData.end.split(':')[1]||0);
            let shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
            let shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);

            if (now >= shiftStart && now < shiftEnd) { isActiveNow = true; }
            if (now >= shiftEnd && !o.has_eval_saved && !window.evalPromptedToday) {
                window.evalPromptedToday = true;
                setTimeout(openEvalModal, 1500);
            }
        }

        const btnEval = document.getElementById('btn-trigger-eval');
        if (btnEval) {
            if (qData.start && state !== 'ledig' && state !== 'semester') { 
                btnEval.classList.remove('hidden'); btnEval.classList.add('flex');
                if(o.has_eval_saved || (o.eval && Object.keys(o.eval).length > 0)) {
                    btnEval.innerText = "✅"; btnEval.classList.remove('eval-needs-action');
                } else { 
                    btnEval.innerText = "✏️";
                    if (isPastShift) btnEval.classList.add('eval-needs-action');
                    else btnEval.classList.remove('eval-needs-action');
                }
            } else { btnEval.classList.add('hidden'); btnEval.classList.remove('flex'); }
        }

        const actsGrid = document.getElementById('dash-actions-grid'); 
        const stdActions = `<div class="absolute inset-0 flex gap-0.5 p-0.5 bg-slate-50"><button onclick="handleDashAction('Arbete')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">⚒️</button><button onclick="handleDashAction('Ledig')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">🏠</button><button onclick="handleDashAction('Semester')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">✈️</button><button onclick="handleDashAction('Sjuk')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">🤒</button><button onclick="handleDashAction('VAB')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">👶</button><button onclick="handleDashAction('Föräldraledig')" class="flex-1 text-[16px] bg-white hover:bg-slate-50 border border-slate-100 rounded-[10px] active:scale-95 flex items-center justify-center transition-colors shadow-sm drop-shadow-sm">🍼</button></div>`;
        if (actsGrid) {
            if (absType === 'VAB' || absType === 'Föräldraledig') { actsGrid.innerHTML = `<div class="p-0.5 bg-slate-50 w-full h-full flex gap-1"><button onclick="triggerChildSelection('${absType}', 'dash')" class="w-full h-full bg-[#fef3c7] hover:bg-[#fde68a] text-[#d97706] font-black text-[10px] rounded-[10px] border border-[#fcd34d] shadow-sm flex items-center justify-center uppercase tracking-widest active:scale-95 transition-transform">⚠️ Välj Barn</button></div>`; } else { actsGrid.innerHTML = stdActions; }
        }
        
        const statusMetaEl = document.getElementById('dash-status-meta');
        if (statusMetaEl) {
            let metaText = ""; if (absType && o.abs_hours && absType !== 'Åtgärd krävs') { let totalH = qData.work_h ? (qData.work_h + o.abs_hours) : o.abs_hours; let actualP = totalH > 0 ? Math.round((o.abs_hours / totalH)*100) : 100; metaText = `${o.abs_hours.toFixed(2).replace('.00','')}h | ${actualP}% (${o.fk_perc || 0}%)`; } 
            statusMetaEl.innerText = metaText;
        }
    } else {
        let wPass = 0, firstShiftTarget = null; let startD = new Date(currentWeekStart), endD = new Date(currentWeekStart); endD.setDate(endD.getDate() + 6); const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        for(let i=0; i<7; i++) { const cd = new Date(currentWeekStart); cd.setDate(currentWeekStart.getDate() + i); const k = getK(cd); const state = getCellState(k); dSales += (db.d[k]?.s || 0); if(state === 'worked' || state === 'planned') { if(firstShiftTarget === null) firstShiftTarget = (timeline[k]?.target || 0); wPass++; } }
        dTarget = (firstShiftTarget || 0) * wPass; dDiff = dSales - dTarget; title = `VECKA ${getWeekNumber(currentWeekStart)}`; subtitle = `${startD.getDate()} ${months[startD.getMonth()]} - ${endD.getDate()} ${months[endD.getMonth()]} (${wPass} Pass)`; statusText = "VÄLJ DAG..."; showActions = false; absType = null; isReached = dTarget > 0 && dSales >= dTarget; 
        const statusMetaEl = document.getElementById('dash-status-meta'); if(statusMetaEl) statusMetaEl.innerText = "";
        const btnEval = document.getElementById('btn-trigger-eval'); if(btnEval) btnEval.classList.add('hidden');
    }

    const titleEl = document.getElementById('dash-title'); if(titleEl) titleEl.innerText = title.toUpperCase(); 
    const subtitleEl = document.getElementById('dash-subtitle'); if(subtitleEl) subtitleEl.innerText = subtitle; 
    const statusTextEl = document.getElementById('dash-status-text'); if(statusTextEl) statusTextEl.innerText = statusText;
    const lblTargetEl = document.getElementById('dash-lbl-target'); if(lblTargetEl) lblTargetEl.innerText = activeK ? "DAGSMÅL" : "VECKOMÅL"; 
    const valTargetEl = document.getElementById('dash-val-target'); if(valTargetEl) valTargetEl.innerText = (dTarget/1000).toFixed(1) + " k";
    
    const salesEl = document.getElementById('dash-val-sales'); if(salesEl) { salesEl.innerText = (dSales/1000).toFixed(1) + " k"; salesEl.style.color = isReached ? 'var(--pos)' : (dTarget > 0 ? 'var(--neg)' : 'var(--sting-blue)'); }
    const diffEl = document.getElementById('dash-val-diff'); if(diffEl) { diffEl.innerText = (dDiff >= 0 ? "+" : "") + (dDiff/1000).toFixed(1) + " k"; diffEl.style.color = dDiff >= 0 ? "var(--sting-blue)" : "var(--neg)"; }
    
    const p = dTarget > 0 ? Math.min(100, Math.round((dSales / dTarget) * 100)) : 0; 
    const valPercEl = document.getElementById('dash-val-perc'); if(valPercEl) valPercEl.innerText = p + "%";
    
    const g = document.getElementById('dash-gauge-prog'); if(g) { g.style.strokeDashoffset = 283 - ((p / 100) * 212); g.style.stroke = isReached ? 'var(--pos)' : (dTarget > 0 ? 'var(--neg)' : 'var(--sting-blue)'); }
    
    const badgeEl = document.getElementById('dash-abs-badge');
    if (badgeEl) {
        if (absType) { const em = { 'Sjuk': '🤒', 'VAB': '👶', 'VAB Belma': '👶', 'VAB Wilma': '👶', 'Föräldraledig': '🍼', 'Föräldraledig Belma': '🍼', 'Föräldraledig Wilma': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' }; let bKey = absType.split(' ')[0]; badgeEl.innerText = em[absType] || em[bKey] || '•'; badgeEl.classList.remove('hidden'); badgeEl.className = `absolute top-0 right-2 w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[14px] z-20 ${absType.includes('Semester') ? 'bg-teal-100 text-teal-600' : (absType.includes('VAB') ? 'bg-amber-100 text-amber-600' : (absType.includes('Föräldraledig') ? 'bg-purple-100 text-purple-600' : (absType === 'Åtgärd krävs' ? 'bg-rose-500 text-white border-none' : 'bg-rose-100 text-rose-600')))}`; } 
        else { badgeEl.classList.add('hidden'); }
    }

    const acts = document.getElementById('dash-actions'); 
    if (acts) {
        if (showActions) { acts.classList.remove('opacity-0', 'pointer-events-none', 'h-0', 'mt-0'); acts.classList.add('opacity-100', 'pointer-events-auto', 'h-[42px]', 'mt-1'); } 
        else { acts.classList.remove('opacity-100', 'pointer-events-auto', 'h-[42px]', 'mt-1'); acts.classList.add('opacity-0', 'pointer-events-none', 'h-0', 'mt-0'); }
    }
    
    const scannerLayer = document.getElementById('cyber-scanner-layer');
    if (dashInner) { dashInner.classList.remove('goal-ambient', 'red-cyber', 'blue-cyber'); }
    if (g) { g.classList.remove('goal-ambient-gauge', 'red-cyber-gauge', 'blue-cyber-gauge'); }
    if (scannerLayer) scannerLayer.style.display = 'none';
    
    if (activeK && viewMode === 'dash') {
        if (isActiveNow) { 
            if(scannerLayer) scannerLayer.style.display = 'block'; 
            if(g) g.classList.add('blue-cyber-gauge'); 
            if(dashInner) dashInner.classList.add('blue-cyber'); 
        } else if (isReached) { 
            if(dashInner) dashInner.classList.add('goal-ambient'); 
            if(g) g.classList.add('goal-ambient-gauge'); 
        } else if (dTarget > 0) { 
            if(dashInner) dashInner.classList.add('red-cyber'); 
            if(g) g.classList.add('red-cyber-gauge'); 
        }
    }
}

function createSliderCell(cd, k) {
    const o = db.d[k] || {s:0}, t = timeline[k] || {target:0}, qData = db.q[k] || {}; 
    const isPast = cd < realToday, isToday = cd.getTime() === realToday.getTime(), state = getCellState(k);
    
    let cls = 'vp-cell';
    if (o.abs) { cls += ' type-unplanned'; } 
    else if (state === 'ledig' || state === 'unplanned') { cls += ' type-unplanned'; } 
    else if (qData.start) { cls += ' type-planned'; }

    if (isPast) { cls += ' vp-past'; if (o.s >= t.target && o.s > 0) cls += ' history-success'; else cls += ' history-fail'; } 
    else if (isToday) { cls += ' status-today'; }   // dagens dag har alltid sin ring

    if (activeK === k) cls += ' active-focus';
    if (currentFocusReason && o.abs && o.abs.includes(currentFocusReason)) cls += ' focus-highlight';
    
    const dayNames = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    const dayName = dayNames[cd.getDay()];
    
    let valStr = '';
    let isShiftActive = false;
    if (isToday && qData.start) {
        const now = new Date();
        const startH = parseInt(qData.start.split(':')[0]), startM = parseInt(qData.start.split(':')[1]);
        const endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19, endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
        const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
        const shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
        isShiftActive = (state !== 'absent' && state !== 'ledig' && state !== 'semester' && now >= shiftStart && now < shiftEnd);
    }
    let liveDot = isShiftActive ? '<span class="live-dot"></span>' : '';

    // Försäljning visas ALLTID om den finns, oavsett frånvaro
    if (o.s > 0) { 
        valStr = `${(o.s/1000).toFixed(1)}k`; 
    } else if (o.abs) { 
        let bKey = o.abs.split(' ')[0]; 
        const em = { 'Sjuk': '🤒', 'VAB': '👶', 'Föräldraledig': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' };
        valStr = `${em[o.abs] || em[bKey] || '•'}`;
    } else if (qData.start) { 
        valStr = `${liveDot}${qData.start.substring(0,5)}`; 
    } else { 
        valStr = `Ledig`; 
    }

    const cell = document.createElement('div');
    cell.className = cls;
    cell.dataset.key = k;
    cell.onclick = (e) => selectDay(k, cell, e);

    // Frånvaro-badge i hörnet OM det finns försäljning samtidigt (annars täcker valStr redan emojin)
    // Frånvaro-badge i hörnet OM det finns försäljning samtidigt (annars täcker valStr redan emojin)
    let absBadge = '';
    if (o.abs && o.s > 0) {
        let bKey = o.abs.split(' ')[0]; 
        const em = { 'Sjuk': '🤒', 'VAB': '👶', 'Föräldraledig': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' };
        absBadge = `<div class="u-badge badge-abs">${em[o.abs] || em[bKey] || '•'}</div>`;
    }

    let keyBadge = '';
    if (!o.abs && qData.start && qData.end) {
        let dayOfWeek = cd.getDay();
        let isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isClosing = (!isWeekend && qData.end.substring(0,5) === '19:30') ||
                          (isWeekend && qData.end.substring(0,5) === '16:30');
        if (isClosing) {
            keyBadge = `<div class="u-badge badge-key">🔑</div>`;
        } else {
            let endCounts = {};
            for (let k2 in db.q) {
                const qd2 = db.q[k2];
                if (!qd2.end) continue;
                const d2 = new Date(k2.split('-')[0], k2.split('-')[1]-1, k2.split('-')[2]);
                if (d2.getDay() !== dayOfWeek) continue;
                const e = qd2.end.substring(0,5);
                if (e === '19:30' || e === '16:30') continue;
                endCounts[e] = (endCounts[e] || 0) + 1;
            }
            let normalEnd = null, maxCount = 0;
            for (let t2 in endCounts) { if (endCounts[t2] > maxCount) { maxCount = endCounts[t2]; normalEnd = t2; } }
            if (normalEnd && qData.end.substring(0,5) !== normalEnd) {
                keyBadge = `<div class="u-badge badge-key" style="font-size:10px;">🔀</div>`;
            }
        }
    }

    cell.innerHTML = `${absBadge}${keyBadge}<span class="vp-name">${dayName}</span><span class="vp-date">${cd.getDate()}</span><span class="vp-val flex items-center justify-center">${valStr}</span>`;
    return cell;
}

function createDayCell(cd, k) {
    const o = db.d[k] || {s:0}, t = timeline[k] || {target:0}, qData = db.q[k] || {}; 
    let cls = 'day-cell', b = '', content = '', wt = ''; 
    const em = { 'Sjuk': '🤒', 'VAB': '👶', 'VAB Belma': '👶', 'VAB Wilma': '👶', 'Föräldraledig': '🍼', 'Föräldraledig Belma': '🍼', 'Föräldraledig Wilma': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' }; 
    const isPast = cd < realToday, isToday = cd.getTime() === realToday.getTime(), state = getCellState(k);
    const dayOfWeek = cd.getDay(); 
    
    let isShiftActive = false;
    if (isToday && qData.start) {
        const now = new Date();
        const startH = parseInt(qData.start.split(':')[0]), startM = parseInt(qData.start.split(':')[1]);
        const endH = qData.end ? parseInt(qData.end.split(':')[0]) : 19, endM = qData.end ? parseInt(qData.end.split(':')[1]) : 0;
        const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
        const shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
        isShiftActive = (state !== 'absent' && state !== 'ledig' && state !== 'semester' && now >= shiftStart && now < shiftEnd);
    }
    
    if (dayOfWeek === 1 && viewMode === 'month') wt = `<div class="week-tag">${getWeekNumber(cd)}</div>`;
    
    if (o.abs && o.s > 0) { let bKey = o.abs.split(' ')[0]; if (o.abs === 'Åtgärd krävs') { b += `<div class="u-badge badge-abs badge-action" style="background:#ef4444; color:white; border:none;">${em[o.abs] || '•'}</div>`; } else { b += `<div class="u-badge badge-abs">${em[o.abs] || em[bKey] || '•'}</div>`; } }
    
    if (!o.abs && qData.start && qData.end) {
        let isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const isClosing = (!isWeekend && qData.end.substring(0,5) === '19:30') ||
                          (isWeekend && qData.end.substring(0,5) === '16:30');
        if (isClosing) {
            b += `<div class="u-badge badge-key">🔑</div>`;
        } else {
            if (!_normalEndCache) _normalEndCache = computeNormalEndByWeekday();
            const normalEnd = _normalEndCache[dayOfWeek];
            if (normalEnd && qData.end.substring(0,5) !== normalEnd) {
                b += `<div class="u-badge badge-key">🔀</div>`;
            }
        }
    }

    if (o.s > 0) { content = `<span class="cell-main-val mt-1">${(o.s/1000).toFixed(1)} k</span>`; } else if (o.abs) { let bKey = o.abs.split(' ')[0]; content = `<span class="cell-abs-emoji">${em[o.abs] || em[bKey] || '•'}</span>`; } else if (qData.start && !o.abs) { content = `<div class="flex flex-col items-center justify-center leading-[1.1] mt-[4px] text-[7.5px] font-bold"><span>${qData.start.substring(0,5)}</span><span>${qData.end.substring(0,5)}</span></div>`; } else if (state === 'unplanned' || (state === 'ledig' && o.s === 0)) { content = `<span class="text-[7.5px] font-black text-slate-800 mt-1 uppercase tracking-widest opacity-50">LEDIG</span>`; }

    if (o.abs) { let baseAbs = o.abs.split(' ')[0]; if (qData.start && baseAbs !== 'Åtgärd krävs') { if (baseAbs === 'Sjuk') cls += ' bg-split-sjuk'; else if (baseAbs === 'VAB') cls += ' bg-split-vab'; else if (baseAbs === 'Föräldraledig') cls += ' bg-split-fledig'; else if (baseAbs === 'Semester') cls += ' bg-split-sem'; else cls += ' type-absent'; } else { if (baseAbs === 'Sjuk' || baseAbs === 'Åtgärd krävs') cls += ' type-absent'; else if (baseAbs === 'Semester') cls += ' type-semester'; else cls += ' type-absent'; } } else if (state === 'ledig' || state === 'unplanned') { cls += ' type-unplanned'; } else if (isPast) { cls += ' history-cell'; if (o.s >= t.target && o.s > 0) cls += ' history-success'; else cls += ' history-fail'; } else { if (isToday) cls += ' status-today'; else if (qData.start) cls += ' type-planned'; }
    if (isShiftActive) cls += ' active-shift-pulse'; 
    
    if (isToday) cls += ' status-today';
    if (viewMode === 'month' && multiSelectKeys.has(k)) { cls += ' active-focus'; } else if (viewMode !== 'month' && activeK === k) { cls += ' active-focus'; }
    if (currentFocusReason && currentFocusReason !== '__day__' && o.abs && o.abs.includes(currentFocusReason) && cd.getMonth() === viewDate.getMonth() && cd.getFullYear() === viewDate.getFullYear()) { cls += ' focus-highlight'; }
    if (focusKeySet && focusKeySet.has(k)) { cls += ' focus-highlight'; }
    
    const cell = document.createElement('div'); cell.className = cls; cell.dataset.key = k; cell.onclick = (e) => selectDay(k, cell, e);
    cell.innerHTML = `${wt}<span class="date-num">${cd.getDate()}</span><div class="flex flex-col items-center justify-center h-full w-full pt-[6px] text-center tracking-tighter">${b}${content}</div>`; return cell;
}

// Cachar "normalt sluttid per veckodag" så avvikelse-badgen inte räknar om allt per cell
let _normalEndCache = null;
function computeNormalEndByWeekday() {
    const counts = {};
    for (let k2 in db.q) {
        const qd2 = db.q[k2]; if (!qd2.end) continue;
        const p = k2.split('-'); const wd = new Date(p[0], p[1]-1, p[2]).getDay();
        const e = qd2.end.substring(0,5);
        if (e === '19:30' || e === '16:30') continue;
        (counts[wd] = counts[wd] || {}); counts[wd][e] = (counts[wd][e] || 0) + 1;
    }
    const best = {};
    for (let wd in counts) { let ne = null, mc = 0; for (let t2 in counts[wd]) { if (counts[wd][t2] > mc) { mc = counts[wd][t2]; ne = t2; } } best[wd] = ne; }
    return best;
}
function invalidateScheduleCache() { _normalEndCache = null; }

function renderCal(y, m) { 
    const g = document.getElementById('d-cal'); if(!g) return;
    _normalEndCache = computeNormalEndByWeekday();
    const frag = document.createDocumentFragment();
    const lastDate = new Date(y, m, 0).getDate(); const firstDay = new Date(y, m-1, 1).getDay() || 7; const prevMonthLastDate = new Date(y, m-1, 0).getDate();
    for(let i = 1; i < firstDay; i++) { const d = prevMonthLastDate - (firstDay - 1) + i; const cell = document.createElement('div'); cell.className = 'day-cell opacity-40 pointer-events-none bg-transparent border-transparent shadow-none'; cell.innerHTML = `<span class="date-num opacity-50">${d}</span>`; frag.appendChild(cell); } 
    for(let d=1; d<=lastDate; d++) frag.appendChild(createDayCell(new Date(y, m-1, d), `${y}-${m}-${d}`)); 
    const totalCellsSoFar = (firstDay - 1) + lastDate; const remainingCells = 42 - totalCellsSoFar;
    for(let d=1; d<=remainingCells; d++) { const cell = document.createElement('div'); cell.className = 'day-cell opacity-40 pointer-events-none bg-transparent border-transparent shadow-none'; cell.innerHTML = `<span class="date-num opacity-50">${d}</span>`; frag.appendChild(cell); }
    g.replaceChildren(frag);
}

function populateSlide(cId, sD) { 
    const c = document.getElementById(cId); if(!c) return;
    if (!_normalEndCache) _normalEndCache = computeNormalEndByWeekday();
    const frag = document.createDocumentFragment();
    for(let i=0; i<7; i++) { const cd = new Date(sD); cd.setDate(cd.getDate() + i); frag.appendChild(createSliderCell(cd, getK(cd))); } 
    c.replaceChildren(frag);
}

function renderWeekSlides() { populateSlide('slide-curr', currentWeekStart); }
function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7); }

let absFilterSet = new Set();
function absFilter(type) {
    if (absFilterSet.has(type)) absFilterSet.delete(type); else absFilterSet.add(type);
    applyAbsFilter(); updateAbsFilterButtons();
}
function absFilterClear() { absFilterSet.clear(); applyAbsFilter(); updateAbsFilterButtons(); }
function applyAbsFilter() {
    document.querySelectorAll('#pane-absence .abs-type[data-abs]').forEach(c => {
        const t = c.getAttribute('data-abs');
        const show = absFilterSet.size === 0 || absFilterSet.has(t);
        c.style.display = show ? '' : 'none';
    });
}
function updateAbsFilterButtons() {
    document.querySelectorAll('.abs-fil-btn').forEach(b => {
        b.classList.toggle('is-on', absFilterSet.has(b.getAttribute('data-abs')));
    });
}

function renderAbsence() {
    const pane = document.getElementById('pane-absence'); if(!pane) return;
    const cm = viewDate.getMonth() + 1; const cy = viewDate.getFullYear(); const daysM = new Date(cy, cm, 0).getDate();
    const daysShort = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör'];
    const em = { 'Sjuk': '🤒', 'VAB': '👶', 'VAB Belma': '👶', 'VAB Wilma': '👶', 'Föräldraledig': '🍼', 'Föräldraledig Belma': '🍼', 'Föräldraledig Wilma': '🍼', 'Semester': '✈️', 'Tjänstledig': '🏢', 'Åtgärd krävs': '⚠️' };
    const col = { 'Sjuk': 'text-rose-600', 'VAB': 'text-amber-600', 'VAB Belma': 'text-amber-600', 'VAB Wilma': 'text-amber-600', 'Föräldraledig': 'text-purple-600', 'Föräldraledig Belma': 'text-purple-600', 'Föräldraledig Wilma': 'text-purple-600', 'Semester': 'text-teal-600', 'Tjänstledig': 'text-slate-600', 'Åtgärd krävs': 'text-rose-600' };
    const types = ['Sjuk','VAB','VAB Belma','VAB Wilma','Föräldraledig','Föräldraledig Belma','Föräldraledig Wilma','Semester','Tjänstledig','Åtgärd krävs'];
    let groups = {}; let order = []; let totalAbs = 0;
    for (let d = 1; d <= daysM; d++) {
        const k = `${cy}-${cm}-${d}`; const o = db.d[k] || {}; const qData = db.q[k] || {};
        if (o.abs && types.some(a => o.abs.includes(a))) {
            const reason = o.abs; totalAbs++;
            if (!groups[reason]) { groups[reason] = []; order.push(reason); }
            const dObj = new Date(cy, cm-1, d); const dayStr = `${daysShort[dObj.getDay()]} ${d}`;
            let hStr = null, actualP = null, fk = null;
            if (o.fk_perc !== undefined && o.abs_hours && reason !== 'Åtgärd krävs') {
                const totalH = qData.work_h ? (qData.work_h + o.abs_hours) : o.abs_hours;
                actualP = totalH > 0 ? Math.round((o.abs_hours / totalH) * 100) : 100;
                hStr = o.abs_hours.toFixed(2).replace('.00','');
                fk = o.fk_perc;
            }
            groups[reason].push({ k, dayStr, hStr, actualP, fk });
        }
    }
    if (totalAbs === 0) { pane.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400 opacity-60"><span class="text-4xl mb-3">💪</span><p class="text-[9px] font-black uppercase tracking-widest text-center px-4">Ingen registrerad frånvaro<br>denna månad</p></div>`; return; }

    let html = `<div class="abs-sum-wrap"><h4 class="abs-sum-title">SAMMANFATTNING</h4>`;
    order.forEach(reason => {
        const bKey = reason.split(' ')[0]; const icon = em[reason] || em[bKey] || '•'; const tCol = col[reason] || col[bKey] || 'text-slate-500';
        const days = groups[reason];
        const rows = days.map(it => {
            const meta = it.hStr ? `${it.hStr} tim · andel ${it.actualP}%${it.fk ? ` · FK ${it.fk}%` : ''}` : 'heldag';
            return `<button onclick="absFocusDay('${it.k}','${reason.replace(/'/g,"\\'")}')" class="abs-day-row"><span class="abs-day-when">${it.dayStr}</span><span class="abs-day-meta">${meta}</span><span class="material-symbols-rounded abs-day-arrow">my_location</span></button>`;
        }).join('');
        html += `<div class="abs-type" data-abs="${bKey}" data-reason="${reason.replace(/"/g,'&quot;')}">
            <button class="abs-type-head" onclick="absToggleType(this)">
                <span class="abs-type-name ${tCol}">${icon} ${reason}</span>
                <span class="abs-type-right"><span class="abs-type-count">${days.length} ${days.length === 1 ? 'dag' : 'dagar'}</span><span class="material-symbols-rounded abs-type-chev">expand_more</span></span>
            </button>
            <div class="abs-type-list">${rows}</div>
        </div>`;
    });
    html += `<button onclick="absAddType()" class="abs-register-btn"><span class="material-symbols-rounded">add</span> Registrera frånvaro</button></div>`;
    pane.innerHTML = `<div class="flex flex-col h-full overflow-hidden"><div class="overflow-y-auto hide-scrollbar flex-1">${html}</div></div>`;
    applyAbsFilter(); updateAbsFilterButtons();
}
function absToggleType(btn) {
    const t = btn.closest('.abs-type'); if (!t) return;
    const reason = t.getAttribute('data-reason');
    if (t.classList.contains('open')) { absFocusType(reason); return; } // redan öppen → fokusera alla dagar
    t.parentElement.querySelectorAll('.abs-type.open').forEach(x => x.classList.remove('open'));
    t.classList.add('open');
}
let focusReturn = null;
const FOCUS_EM = { 'Sjuk':'🤒','VAB':'👶','Föräldraledig':'🍼','Semester':'✈️','Tjänstledig':'🏢','Ledig':'🏠','Åtgärd krävs':'⚠️' };
function focusEmoji(reason){ if(!reason) return '•'; for(const key in FOCUS_EM){ if(reason.includes(key)) return FOCUS_EM[key]; } return '•'; }
function setFocusInfo(html){ const el=document.getElementById('focus-info'); if(el) el.innerHTML = html || ''; }
// Fokusera ALLA dagar för en frånvarotyp
function absFocusType(reason){
    focusReturn = { reason };
    currentFocusReason = reason;
    document.body.classList.add('focus-mode-active');
    const cy = viewDate.getFullYear(), cm = viewDate.getMonth() + 1;
    let n = 0; Object.keys(db.d).forEach(k => { const p = k.split('-'); if (+p[0]===cy && +p[1]===cm) { const o = db.d[k]; if (o && o.abs && o.abs.includes(reason)) n++; } });
    setFocusInfo(`<span class="fi-emoji">${focusEmoji(reason)}</span><span class="fi-main">${reason}</span><span class="fi-meta">${n} ${n===1?'dag':'dagar'} denna månad</span>`);
    if (typeof window.calSeg === 'function') window.calSeg('month');
}
// Fokusåtgärder från Sammanfattning → markera dagar i kalendern
function focusFromSummary(type, arg) {
    const F = summaryFocus || {};
    let keys = [], emoji = '•', label = '';
    if (type === 'work') { keys = F.work || []; emoji = '💼'; label = 'Pass / Jobb'; }
    else if (type === 'abs') { keys = F.abs || []; emoji = '🚫'; label = 'Frånvaro'; }
    else if (type === 'best') { keys = F.best || []; emoji = '🚀'; label = 'Bästa dag'; }
    else if (type === 'worst') { keys = F.worst || []; emoji = '📉'; label = 'Sämsta dag'; }
    else if (type === 'green') { keys = F.green || []; emoji = '🔥'; label = 'Gröna dagar'; }
    else if (type === 'week') { keys = F.week || []; emoji = '🏆'; label = 'Bästa veckan'; }
    else if (type === 'reason') { keys = (F.reasons && F.reasons[arg]) || []; emoji = focusEmoji(arg); label = arg; }
    if (!keys.length) { showToast('ℹ️', 'Inga dagar att visa', 1800); return; }
    const meta = `${keys.length} ${keys.length === 1 ? 'dag' : 'dagar'} denna månad`;
    focusKeySet = new Set(keys);
    currentFocusReason = '__keys__';
    focusReturn = { summary: true };
    document.body.classList.add('focus-mode-active');
    setFocusInfo(`<span class="fi-emoji">${emoji}</span><span class="fi-main">${label}</span><span class="fi-meta">${meta}</span>`);
    if (typeof closeSummaryModal === 'function') closeSummaryModal();
    if (typeof window.openMonthFocus === 'function') window.openMonthFocus();
}
window.focusFromSummary = focusFromSummary;
// I fokusläge: tryck på en markerad dag → visa just den dagens detaljer i info-rutan
function focusShowDay(k, el){
    const o = db.d[k] || {}; const qData = db.q[k] || {};
    const parts = k.split('-'); const dObj = new Date(+parts[0], +parts[1]-1, +parts[2]);
    const dShort = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör'][dObj.getDay()];
    let emoji, main, metaTxt;
    if (o.abs) {
        emoji = focusEmoji(o.abs); main = o.abs;
        if (o.fk_perc !== undefined && o.abs_hours) { const hStr = o.abs_hours.toFixed(2).replace('.00',''); metaTxt = `${dShort} ${parts[2]} · ${hStr} tim · FK ${o.fk_perc}%`; }
        else metaTxt = `${dShort} ${parts[2]} · heldag`;
    } else if (o.s > 0) {
        const tgt = (timeline[k] && timeline[k].target) || 0;
        emoji = (tgt > 0 && o.s >= tgt) ? '🔥' : '💰'; main = `${(o.s/1000).toFixed(1)}k`;
        metaTxt = tgt > 0 ? `${dShort} ${parts[2]} · mål ${(tgt/1000).toFixed(1)}k` : `${dShort} ${parts[2]}`;
    } else {
        emoji = '📅'; main = `${dShort} ${parts[2]}`; metaTxt = '';
    }
    setFocusInfo(`<span class="fi-emoji">${emoji}</span><span class="fi-main">${main}</span><span class="fi-meta">${metaTxt}</span>`);
    document.querySelectorAll('#d-cal .day-cell').forEach(c => c.classList.remove('active-focus'));
    if (el) el.classList.add('active-focus');
}

// I fokusläge: tryck på en enskild dag → fokusera just den dagen i kalendern
// I fokusläge: tryck på en enskild dag → fokusera just den dagen i kalendern
function absFocusDay(k, reason) {
    focusReturn = { reason: reason || null };
    currentFocusReason = '__day__';
    document.body.classList.add('focus-mode-active');
    const o = db.d[k] || {}; const qData = db.q[k] || {};
    const parts = k.split('-'); const dObj = new Date(parts[0], parts[1]-1, parts[2]);
    const r = o.abs || reason || '';
    let metaTxt;
    if (o.fk_perc !== undefined && o.abs_hours) {
        const hStr = o.abs_hours.toFixed(2).replace('.00','');
        metaTxt = `${hStr} tim · ${o.fk_perc}%`;
    } else {
        metaTxt = `heldag`;
    }
    setFocusInfo(`<span class="fi-emoji">${focusEmoji(r)}</span><span class="fi-main">${r}</span><span class="fi-meta">${metaTxt}</span>`);
    if (typeof window.calSeg === 'function') window.calSeg('month');
    setTimeout(() => {
        document.querySelectorAll('#d-cal .day-cell').forEach(c => {
            if (c.dataset.key === k) c.classList.add('focus-highlight'); else c.classList.remove('focus-highlight');
        });
        const cell = document.querySelector(`#d-cal .day-cell[data-key="${k}"]`);
        if (cell) cell.classList.add('active-focus');
    }, 60);
}

// "Tillbaka" i fokusläge → tillbaka till Frånvaro med rätt typ expanderad
function absFocusBack() {
    const r = focusReturn; closeFocusMode(true);
    if (r && r.summary) { if (typeof window.closeActiveSheet === 'function') window.closeActiveSheet(); if (typeof openSummaryModal === 'function') openSummaryModal('month'); return; }
    if (typeof window.calSeg === 'function') window.calSeg('absence');
    setTimeout(() => {
        if (r && r.reason) {
            const t = document.querySelector(`#pane-absence .abs-type[data-reason="${r.reason.replace(/"/g,'&quot;')}"]`);
            if (t) { t.parentElement.querySelectorAll('.abs-type.open').forEach(x => x.classList.remove('open')); t.classList.add('open'); }
        }
    }, 90);
}
// "+ Registrera frånvaro" → hoppa till kalendern, markera dag(ar) och tryck en frånvarosymbol
function absAddType(){
    if (currentFocusReason) closeFocusMode(true);
    if (typeof window.calSeg === 'function') window.calSeg('month');
    if (typeof showToast === 'function') showToast('🗓️','Markera dag(ar) i kalendern och tryck en frånvaro-symbol',4200);
}
// Tryck på frånvarotyp i sammanfattningen → hoppa till kalendern och markera dagarna
function absToCalendar(reason){
    currentFocusReason = reason;
    document.body.classList.add('focus-mode-active');
    if (typeof window.calSeg === 'function') window.calSeg('month');
    setTimeout(()=>{
        document.querySelectorAll('#d-cal .day-cell').forEach(c => {
            const k=c.dataset.key; const o=db.d[k];
            if (o && o.abs && o.abs.includes(reason)) c.classList.add('focus-highlight'); else c.classList.remove('focus-highlight');
        });
    }, 60);
}

// ==========================================
//  UI & MODAL LOGIC
// ==========================================
// ==========================================
//  NOTE IMAGE SCANNING LOGIC (SUPABASE EDGE FUNCTION)
// ==========================================
function triggerNoteImageSelect() {
    const input = document.getElementById('note-image-input');
    if (input) input.click();
}

function showNoteImageLoader() {
    const spinner = document.getElementById('image-load-spinner');
    if (spinner) spinner.classList.remove('hidden');
}

function hideNoteImageLoader() {
    const spinner = document.getElementById('image-load-spinner');
    if (spinner) spinner.classList.add('hidden');
}

async function handleNoteImageSelect(input) {
    const file = input.files[0];
    if (!file) return;

    const spinner = document.getElementById('image-load-spinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
        if (!sb) throw new Error("Supabase-klienten saknas. Ladda om appen.");

        // Komprimera bilden till max ~500KB
        const compressed = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxW = 1024;
                    const scale = Math.min(1, maxW / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        const { data, error } = await sb.functions.invoke('analyze-sales-note-image', {
            body: { image_base64: compressed }
        });

        if (error) throw new Error(error.message);

        // Stöd både snake_case och camelCase från Gemini
        if (data.namn || data.name)        document.getElementById('note-name').value  = data.namn || data.name;
        if (data.telefon || data.phone)    document.getElementById('note-phone').value = data.telefon || data.phone;
        if (data.ordernummer || data.order) document.getElementById('note-order').value = data.ordernummer || data.order;

    } catch (err) {
        alert("Kunde inte analysera: " + err.message);
    } finally {
        if (spinner) spinner.classList.add('hidden');
        input.value = '';
    }
}

async function handleNoteImageSelect(input) {
    const file = input.files[0];
    if (!file) return;

    const spinner = document.getElementById('image-load-spinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
        if (!sb) throw new Error("Supabase-klienten saknas. Ladda om appen.");

        // Komprimera bilden till max ~500KB
        const compressed = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxW = 1024;
                    const scale = Math.min(1, maxW / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        const { data, error } = await sb.functions.invoke('analyze-sales-note-image', {
            body: { image_base64: compressed }
        });

        if (error) throw new Error(error.message);

        // Stöd både snake_case och camelCase från Gemini
        if (data.namn || data.name)        document.getElementById('note-name').value  = data.namn || data.name;
        if (data.telefon || data.phone)    document.getElementById('note-phone').value = data.telefon || data.phone;
        if (data.ordernummer || data.order) document.getElementById('note-order').value = data.ordernummer || data.order;

    } catch (err) {
        alert("Kunde inte analysera: " + err.message);
    } finally {
        if (spinner) spinner.classList.add('hidden');
        input.value = '';
    }
}

async function handleGMImageSelect(input) {
    const file = input.files[0];
    if (!file) return;

    showToast('📷', 'Skannar GM-rapport...', 3000);

    try {
        const compressed = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxW = 1024;
                    const scale = Math.min(1, maxW / img.width);
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        const { data, error } = await sb.functions.invoke('scan-gm-image', {
            body: { image_base64: compressed }
        });

        if (error) throw new Error(error.message);
        if (!data.gm || isNaN(data.gm)) throw new Error('Kunde inte hitta GM-värde');

        // Lägg in i dagens försäljning
        const gmValue = Math.round(Number(data.gm));
        inlineNumpadValue = String(gmValue);
        updateInlineNumpadDisplay();

        showToast('✅', `GM inlagt: ${gmValue.toLocaleString('sv-SE')} kr`, 3000);

    } catch (err) {
        showToast('❌', 'Kunde inte skanna: ' + err.message, 4000);
    } finally {
        input.value = '';
    }
}

// ==========================================
//  LÖN — prognos brutto/netto/skatt/bonus
// ==========================================
let lonViewDate = null;
let lonCfg = null;
let lonMonthly = {};
let lonAvdrag = 0;

function lonSetAvdrag(v){ lonAvdrag = v; const seg=document.getElementById('lon-avdrag-seg'); if(seg) seg.querySelectorAll('button').forEach(b=>b.classList.toggle('active', parseInt(b.dataset.av)===v)); lonRecalc(); }

// Arbetsmånad = innevarande månad. Utbetalas månaden efter.
function lonWorkDate(){ return new Date(realToday.getFullYear(), realToday.getMonth(), 1); }
function lonPayoutDate(){ const w=lonWorkDate(); return new Date(w.getFullYear(), w.getMonth()+1, 1); }
// Bilagor gäller senast avslutade månad (föregående)
function lonUploadTarget(){ return new Date(realToday.getFullYear(), realToday.getMonth()-1, 1); }
function lonUploadTargetKey(){ const d=lonUploadTarget(); return `${d.getFullYear()}-${d.getMonth()+1}`; }
function lonUploadsObj(){ if(!lonMonthly._uploads) lonMonthly._uploads={}; return lonMonthly._uploads; }
function lonHasFacit(key, slot){ const m=lonMonthly[key]; return !!(m && m['cal_'+slot]); }
function lonHasFile(key, slot){ const m=lonMonthly[key]; return !!(m && m['file_'+slot]); }
function lonHasProg(key, slot){ const m=lonMonthly[key]; return !!(m && m['prog_'+slot]); }
function lonMonthClosed(key){ return lonHasFacit(key,'tidrapport') && lonHasFacit(key,'lonespec'); }
function lonUploadDone(slot){ return lonHasFacit(lonUploadTargetKey(), slot); }
function lonUploadOpen(){ return true; } // bilagor alltid öppna – appen sorterar själv

// ---- Klassificering av en bilaga utifrån månaden i dokumentet ----
const LON_MONTHS=['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
function lonMonthIdx(y,m){ return y*12 + (m-1); }
function lonMonthLabel(key){ const p=key.split('-').map(Number); return `${LON_MONTHS[p[1]-1]} ${p[0]}`; }
function lonCurKey(){ return `${realToday.getFullYear()}-${realToday.getMonth()+1}`; }
function lonDetectedKey(data){
    if (data && data.manad_nr>=1 && data.manad_nr<=12){
        const y = (data.ar && data.ar>2020 && data.ar<2100) ? data.ar : realToday.getFullYear();
        return `${y}-${data.manad_nr}`;
    }
    return null;
}
function lonClassify(detKey){
    if(!detKey) return 'unknown';
    const p=detKey.split('-').map(Number);
    const diff = lonMonthIdx(realToday.getFullYear(), realToday.getMonth()+1) - lonMonthIdx(p[0], p[1]);
    if (diff <= 0) return 'prognos';
    if (diff === 1) return 'facit';
    if (diff === 2) return 'sent';
    return 'old';
}
function lonRecentMonthKeys(n){ n=n||4; const out=[]; for(let i=0;i<n;i++){ const d=new Date(realToday.getFullYear(), realToday.getMonth()-i+1, 1); out.push(`${d.getFullYear()}-${d.getMonth()+1}`); } return out; }
function lonApplyPrognos(data, key, slot){
    const m=lonMonthly[key]||{}; m['prog_'+slot]={ ob50:data.ob50, ob100:data.ob100, franvaro_tim:data.franvaro_tim }; lonMonthly[key]=m; lonSaveMonthly(); lonFillFields(); lonRecalc();
}
function lonUndoPrognos(key, slot){ const m=lonMonthly[key]; if(m){ delete m['prog_'+slot]; lonSaveMonthly(); lonFillFields(); lonRecalc(); } }
function lonClearFileKey(key, slot){ const m=lonMonthly[key]; if(m){ delete m['file_'+slot]; lonSaveMonthly(); } }

const LON_CFG_DEF = {
    manadslon: 29554, tillagg: 515, timpris: 181.14, timdivisor: 163.17,
    obWindows: {
        weekday: [ {from:'18:15', to:'20:00', bucket:50}, {from:'20:00', to:'24:00', bucket:100} ],
        sat:     [ {from:'12:00', to:'24:00', bucket:100} ],
        sun:     [ {from:'00:00', to:'24:00', bucket:100} ],
        red:     [ {from:'00:00', to:'24:00', bucket:100} ]
    },
    obCorr: { ob50: 1, ob100: 1 },
    franvCorr: 1,
    taxAnchors: [
        [10000,1196],[11000,1403],[11768,1568],[12000,1609],[13000,1815],[14000,2020],[15000,2219],[16000,2419],[17000,2662],[18000,2905],[19000,3148],
        [20000,3391],[21000,3634],[22000,3877],[23000,4120],[24000,4371],[25000,4622],[26000,4873],[26458,5024],[27000,5124],[28000,5376],[29000,5627],
        [30000,5878],[31000,6129],[32000,6381],[33000,6632],[34000,6883],[35000,7134],[36000,7386],[37000,7637],[38000,7888],[39000,8139],
        [40000,8402],[41000,8732],[42000,9062],[43000,9392],[44000,9722],[44015,9788],[45000,10052],[46000,10382],[47000,10712],[48000,11042],[49000,11372],
        [50000,11702],[51000,12032],[52000,12362],[53000,12692],[54000,13022],[55000,13352],[56000,13875],[57000,14405],[58000,14935],[59000,15465],
        [60000,15995],[62000,17055],[64000,18115],[66000,19175],[68000,20235],[70000,21295],[75000,23945],[80000,26595]
    ],
    bonusTiers: [{min:180000,max:240000,pct:10},{min:240000,max:350000,pct:12},{min:350000,max:null,pct:15}]
};

function lonNormalizeCfg(c){
    if (!c || typeof c !== 'object') c = {};
    const D = LON_CFG_DEF;
    if (typeof c.manadslon !== 'number' || !c.manadslon) c.manadslon = D.manadslon;
    if (typeof c.tillagg !== 'number') c.tillagg = D.tillagg;
    if (!c.timdivisor) c.timdivisor = D.timdivisor;
    if (typeof c.timpris !== 'number') c.timpris = D.timpris;
    if (!c.obWindows) c.obWindows = JSON.parse(JSON.stringify(D.obWindows));
    if (!c.obCorr || typeof c.obCorr.ob50 !== 'number' || typeof c.obCorr.ob100 !== 'number') c.obCorr = { ob50:1, ob100:1 };
    if (typeof c.franvCorr !== 'number' || !c.franvCorr) c.franvCorr = 1;
    if (!Array.isArray(c.taxAnchors) || c.taxAnchors.length < 30) c.taxAnchors = JSON.parse(JSON.stringify(D.taxAnchors));
    if (!Array.isArray(c.bonusTiers) || !c.bonusTiers.length) c.bonusTiers = JSON.parse(JSON.stringify(D.bonusTiers));
    return c;
}
function lonLoad() {
    let loaded = null;
    try { loaded = JSON.parse(localStorage.getItem('sf_lon_cfg')); } catch(e){ loaded = null; }
    lonCfg = lonNormalizeCfg(loaded || JSON.parse(JSON.stringify(LON_CFG_DEF)));
    try { lonMonthly = JSON.parse(localStorage.getItem('sf_lon_monthly')) || {}; } catch(e){ lonMonthly = {}; }
}
function lonSaveCfg(){ try { localStorage.setItem('sf_lon_cfg', JSON.stringify(lonCfg)); } catch(e){} lonPushRemote('cfg', lonCfg); }
function lonSaveMonthly(){ try { localStorage.setItem('sf_lon_monthly', JSON.stringify(lonMonthly)); } catch(e){} lonPushRemote('monthly', lonMonthly); }
function lonKey(){ return `${lonViewDate.getFullYear()}-${lonViewDate.getMonth()+1}`; }

function getMonthlySales(y, m){
    let tot = 0; const dim = new Date(y, m, 0).getDate();
    for (let d=1; d<=dim; d++){ const o = db.d[`${y}-${m}-${d}`]; if (o && o.s) tot += o.s; }
    return tot;
}
function getMonthlyFranvaroHours(y, m){
    let h = 0; const dim = new Date(y, m, 0).getDate();
    for (let d=1; d<=dim; d++){ const o = db.d[`${y}-${m}-${d}`]; if (o && o.abs_hours && o.abs !== 'Åtgärd krävs') h += o.abs_hours; }
    return Math.round(h*100)/100;
}
function lonTimpris(){ const mn = lonNum('lon-cfg-manadslon') || (lonCfg && lonCfg.manadslon) || LON_CFG_DEF.manadslon; const div = (lonCfg && lonCfg.timdivisor) || 163.17; return Math.round(mn/div*100)/100; }

// ---- Svenska röda dagar (helgdagar) ----
function lonEaster(y){ const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(y,mo-1,da); }
function lonHolidays(y){
    const s=new Set(); const add=(d)=>s.add(`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`);
    [[0,1],[0,6],[4,1],[5,6],[11,24],[11,25],[11,26],[11,31]].forEach(([mo,da])=>add(new Date(y,mo,da)));
    const e=lonEaster(y); const off=(n)=>{const d=new Date(e); d.setDate(e.getDate()+n); return d;};
    add(off(-2)); add(off(1)); add(off(39)); add(off(49)); // långfredag, annandag påsk, Kristi himmelsfärd, pingstdagen
    // Midsommardagen = lördag 20-26 juni; Alla helgons dag = lördag 31okt-6nov
    for(let d=20; d<=26; d++){ const dt=new Date(y,5,d); if(dt.getDay()===6) add(dt); }
    for(let d=31; d<=37; d++){ const dt=new Date(y,9,d); if(dt.getDay()===6) add(dt); }
    return s;
}
function lonMinutes(t){ const p=String(t).split(':'); return (parseInt(p[0])||0)*60+(parseInt(p[1])||0); }
function lonOverlap(s1,e1,s2,e2){ return Math.max(0, Math.min(e1,e2)-Math.max(s1,s2)); }

// ---- Skatta OB-timmar ur passen i appen (rå, utan korrektion) ----
function lonEstimateOBraw(y, m){
    const dim = new Date(y, m, 0).getDate();
    const hol = lonHolidays(y);
    const W = (lonCfg.obWindows || LON_CFG_DEF.obWindows);
    let ob50=0, ob100=0;
    for (let d=1; d<=dim; d++){
        const k=`${y}-${m}-${d}`; const q=db.q[k]; if(!q || !q.start || !q.end) continue;
        const o=db.d[k]||{}; if(o.abs && o.abs!=='Åtgärd krävs') continue;
        const ds=lonMinutes(q.start), de=lonMinutes(q.end); if(de<=ds) continue;
        const dow=new Date(y,m-1,d).getDay();
        const isRed = hol.has(k);
        let wins = isRed ? W.red : (dow===0 ? W.sun : (dow===6 ? W.sat : W.weekday));
        wins.forEach(w=>{ const h=lonOverlap(ds,de,lonMinutes(w.from), w.to==='24:00'?1440:lonMinutes(w.to))/60; if(h>0){ if(w.bucket===100) ob100+=h; else ob50+=h; } });
    }
    return { ob50: Math.round(ob50*100)/100, ob100: Math.round(ob100*100)/100 };
}
function lonEstimateOB(y, m){
    const r=lonEstimateOBraw(y,m); const c=lonCfg.obCorr||{ob50:1,ob100:1};
    return { ob50: Math.round(r.ob50*(c.ob50||1)*100)/100, ob100: Math.round(r.ob100*(c.ob100||1)*100)/100 };
}

// ---- Inlärning (FAIL-SAFE): spara råvärden per månad+typ; senaste gäller; räkna om allt från grunden ----
function lonApplyCalibration(d, monthKey, slot){
    const k = monthKey || lonUploadTargetKey();
    const m = lonMonthly[k] || {};
    m['cal_'+(slot||'lonespec')] = d;   // skriv över – senaste bilagan gäller, inget snitt
    lonMonthly[k] = m;
    lonRecomputeLearning();
    lonSaveMonthly(); lonSaveCfg();
    lonFillFields(); lonRecalc();
}
function lonClearCalibration(monthKey, slot){
    const m = lonMonthly[monthKey]; if(!m) return;
    delete m['cal_'+slot];
    lonRecomputeLearning();
    lonSaveMonthly(); lonSaveCfg();
}
// Räknar om obCorr/franvCorr/skattepunkter/grundlön ENBART utifrån de bilagor som finns just nu
function lonRecomputeLearning(){
    lonCfg.taxAnchors = JSON.parse(JSON.stringify(LON_CFG_DEF.taxAnchors));
    lonCfg.obCorr = { ob50:1, ob100:1 };
    lonCfg.franvCorr = 1;
    const r50=[], r100=[], rfranv=[]; let latestBase=null, latestIdx=-1;
    const sane=(ratio)=> (ratio>=0.4 && ratio<=2.5);   // utanför detta = troligen fel månad → ignorera
    Object.keys(lonMonthly).forEach(mk=>{
        if (mk==='_uploads' || !/^\d{4}-\d{1,2}$/.test(mk)) return;
        const rec = lonMonthly[mk]; if(!rec || typeof rec!=='object') return;
        const tid = rec.cal_tidrapport || {}, spec = rec.cal_lonespec || {};
        const parts = mk.split('-'); const y=+parts[0], mo=+parts[1];
        const pick=(a,b)=> (a!=null? a : (b!=null? b : null));
        const ob50a = pick(spec.ob50, tid.ob50), ob100a = pick(spec.ob100, tid.ob100);
        const est = lonEstimateOBraw(y, mo);
        if (ob50a!=null && est.ob50>0 && sane(ob50a/est.ob50)) r50.push(ob50a/est.ob50);
        if (ob100a!=null && est.ob100>0 && sane(ob100a/est.ob100)) r100.push(ob100a/est.ob100);
        const ftim = pick(spec.franvaro_tim, pick(tid.franvaro_tim, getMonthlyFranvaroHours(y,mo)));
        const fkr = spec.franvaro_avdrag_kr;
        const base = (ftim||0) * (lonCfg.manadslon / (lonCfg.timdivisor||163.17));
        if (fkr!=null && base>0 && sane(Math.abs(fkr)/base)) rfranv.push(Math.abs(fkr)/base);
        if (spec.brutto!=null && spec.skatt!=null && +spec.brutto>5000){
            const g=Math.round(+spec.brutto), tax=Math.round(Math.abs(+spec.skatt));
            const a=lonCfg.taxAnchors; const idx=a.findIndex(p=>Math.abs(p[0]-g)<=50);
            if(idx>=0) a[idx]=[g,tax]; else a.push([g,tax]);
        }
        if (spec.manadslon!=null && +spec.manadslon>10000){ const ix=y*12+mo; if(ix>latestIdx){ latestIdx=ix; latestBase=+spec.manadslon; } }
        rec.actualOb50 = ob50a; rec.actualOb100 = ob100a;
        if (ftim!=null) rec.franv = ftim;
    });
    const avg=(arr)=> arr.length ? arr.reduce((s,x)=>s+x,0)/arr.length : 1;
    const clamp=(v)=> Math.min(2, Math.max(0.5, v));
    lonCfg.obCorr.ob50 = Math.round(clamp(avg(r50))*1000)/1000;
    lonCfg.obCorr.ob100 = Math.round(clamp(avg(r100))*1000)/1000;
    lonCfg.franvCorr = Math.round(clamp(avg(rfranv))*1000)/1000;
    if (latestBase) lonCfg.manadslon = latestBase;
    lonCfg.taxAnchors.sort((x,y)=>x[0]-y[0]);
}
function lonNum(id){ const el = document.getElementById(id); if(!el) return 0; const v = parseFloat(String(el.value).replace(/\s/g,'').replace(',','.')); return isNaN(v) ? 0 : v; }
function lonKr(n){ return Math.round(n).toLocaleString('sv-SE') + ' kr'; }

function lonTax(g){
    if (g <= 0) return 0;
    if (g > 80000) return g * 0.34;
    const a = [...lonCfg.taxAnchors].filter(p=>p && p.length===2).sort((x,y)=>x[0]-y[0]);
    if (a.length === 0) return 0;
    if (a.length === 1) return Math.max(0, a[0][1]);
    if (g <= a[0][0]){ const s=(a[1][1]-a[0][1])/(a[1][0]-a[0][0]); return Math.max(0, a[0][1]+(g-a[0][0])*s); }
    for (let i=0;i<a.length-1;i++){ if (g <= a[i+1][0]){ const s=(a[i+1][1]-a[i][1])/(a[i+1][0]-a[i][0]); return a[i][1]+(g-a[i][0])*s; } }
    const n=a.length, s=(a[n-1][1]-a[n-2][1])/(a[n-1][0]-a[n-2][0]); return Math.max(0, a[n-1][1]+(g-a[n-1][0])*s);
}
function lonBonusAuto(sales){
    for (const t of lonCfg.bonusTiers){ const max=(t.max==null?Infinity:t.max); if (sales>=t.min && sales<max) return sales*((t.pct||0)/100); }
    return 0;
}

function lonGetOB(){
    const m = lonMonthly[lonKey()] || {};
    const est = lonEstimateOB(lonViewDate.getFullYear(), lonViewDate.getMonth()+1);
    if (m.actualOb50!=null || m.actualOb100!=null){
        return { ob50: (m.actualOb50!=null? m.actualOb50: est.ob50), ob100: (m.actualOb100!=null? m.actualOb100: est.ob100), src:'facit' };
    }
    const p = m.prog_tidrapport;
    if (p && (p.ob50!=null || p.ob100!=null)){
        return { ob50: (p.ob50!=null? p.ob50: est.ob50), ob100: (p.ob100!=null? p.ob100: est.ob100), src:'prognos' };
    }
    return { ...est, src:'auto' };
}
function lonRecalc(){
    if (!lonViewDate) return;
    const H = lonTimpris();
    const tpEl = document.getElementById('lon-cfg-timpris'); if (tpEl) tpEl.value = H;
    const manadslon = lonNum('lon-cfg-manadslon') || (lonCfg && lonCfg.manadslon) || LON_CFG_DEF.manadslon;
    const tillagg = lonNum('lon-cfg-tillagg') || (lonCfg && lonCfg.tillagg) || 0;
    const sales = lonNum('lon-sales');
    const OB = lonGetOB();
    const ob50 = OB.ob50 * H * 0.5;
    const ob100 = OB.ob100 * H;
    const franvTim = lonNum('lon-franv');
    const franvKr = franvTim * H * (lonCfg.franvCorr || 1);
    const extraAdd = lonNum('lon-extra-add');
    const extraDed = lonNum('lon-extra-ded');

    const obEl=document.getElementById('lon-ob50'); if(obEl) obEl.value=OB.ob50; const ob1El=document.getElementById('lon-ob100'); if(ob1El) ob1El.value=OB.ob100;
    const obHint=document.getElementById('lon-ob-hint'); if(obHint) obHint.innerText = OB.src==='faktisk' ? 'Från bilaga (faktisk)' : 'Auto från dina pass';

    // BONUS: auto ur försäljning × tier, minus procentavdrag (10/20/30)
    const pct = lonBonusPct(sales);
    const bonusBrutto = lonBonusAuto(sales);
    const bonus = bonusBrutto * (1 - (lonAvdrag||0)/100);

    const obTot = ob50 + ob100;
    const franvTot = franvKr + extraDed;
    const brutto = manadslon + tillagg + obTot + bonus + extraAdd - franvTot;
    const skatt = lonTax(brutto);
    const netto = brutto - skatt;

    document.getElementById('lon-net').innerText = lonKr(netto);
    document.getElementById('lon-tax').innerText = '−' + lonKr(skatt);
    document.getElementById('lon-gross').innerText = lonKr(brutto);
    document.getElementById('lon-bonus-out').innerText = lonKr(bonus);
    document.getElementById('lon-ob-out').innerText = lonKr(obTot);
    document.getElementById('lon-franvaro-out').innerText = '−' + lonKr(franvTot);
    const avEl = document.getElementById('lon-bonus-sub');
    if (avEl){ let t = sales>0 ? ` ${pct}% av ${lonKr(sales)}` : ''; if((lonAvdrag||0)>0) t += ` − ${lonAvdrag}%`; avEl.innerText = t; }

    lonCfg.manadslon = manadslon || lonCfg.manadslon;
    lonCfg.tillagg = tillagg || lonCfg.tillagg;
    lonCfg.timpris = H;
    lonSaveCfg();
    const k = lonKey(); const prev = lonMonthly[k] || {};
    lonMonthly[k] = { ...prev, avdrag: lonAvdrag||0 };
    lonSaveMonthly();
}
function lonBonusPct(sales){ for (const t of lonCfg.bonusTiers){ const max=(t.max==null?Infinity:t.max); if (sales>=t.min && sales<max) return t.pct||0; } return 0; }

function lonRenderTiers(){
    const c = document.getElementById('lon-bonus-tiers'); if(!c) return; c.innerHTML='';
    lonCfg.bonusTiers.forEach((t,i)=>{
        const row = document.createElement('div'); row.className='lon-tier-row';
        row.innerHTML = `<input type="tel" inputmode="numeric" class="md-input" value="${t.min}" placeholder="från" onchange="lonTierEdit(${i},'min',this.value)">
            <input type="tel" inputmode="numeric" class="md-input" value="${t.max==null?'':t.max}" placeholder="till (tomt=∞)" onchange="lonTierEdit(${i},'max',this.value)">
            <input type="tel" inputmode="decimal" class="md-input" value="${t.pct}" placeholder="%" onchange="lonTierEdit(${i},'pct',this.value)">
            <button class="lon-del-btn" onclick="lonTierDel(${i})">✕</button>`;
        c.appendChild(row);
    });
}
function lonTierEdit(i,f,v){ const n=parseFloat(String(v).replace(',','.')); if(f==='max'){ lonCfg.bonusTiers[i].max = (String(v).trim()===''?null:(isNaN(n)?null:n)); } else { lonCfg.bonusTiers[i][f] = isNaN(n)?0:n; } lonSaveCfg(); lonRecalc(); }
function lonTierDel(i){ lonCfg.bonusTiers.splice(i,1); lonSaveCfg(); lonRenderTiers(); lonRecalc(); }
function lonAddTier(){ lonCfg.bonusTiers.push({min:0,max:null,pct:0}); lonSaveCfg(); lonRenderTiers(); }

function lonRenderAnchors(){
    const c = document.getElementById('lon-tax-anchors'); if(!c) return; c.innerHTML='';
    lonCfg.taxAnchors.sort((a,b)=>a[0]-b[0]).forEach((p,i)=>{
        const row = document.createElement('div'); row.className='lon-tier-row';
        row.innerHTML = `<input type="tel" inputmode="numeric" class="md-input" value="${p[0]}" placeholder="brutto" onchange="lonAnchorEdit(${i},0,this.value)">
            <input type="tel" inputmode="numeric" class="md-input" value="${p[1]}" placeholder="skatt" onchange="lonAnchorEdit(${i},1,this.value)">
            <button class="lon-del-btn" onclick="lonAnchorDel(${i})">✕</button>`;
        c.appendChild(row);
    });
}
function lonAnchorEdit(i,j,v){ const n=parseFloat(String(v).replace(/\s/g,'').replace(',','.')); lonCfg.taxAnchors[i][j]=isNaN(n)?0:n; lonSaveCfg(); lonRecalc(); }
function lonAnchorDel(i){ lonCfg.taxAnchors.splice(i,1); lonSaveCfg(); lonRenderAnchors(); lonRecalc(); }
function lonAddAnchor(){ lonCfg.taxAnchors.push([0,0]); lonSaveCfg(); lonRenderAnchors(); }

function lonFillFields(){
    const k = lonKey(); const m = lonMonthly[k] || {};
    const y = lonViewDate.getFullYear(), mo = lonViewDate.getMonth()+1;
    const setV=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=(v===undefined||v===null||v==='')?'':v; };
    setV('lon-sales', getMonthlySales(y, mo) || '');
    const OB = lonGetOB(); setV('lon-ob50', OB.ob50); setV('lon-ob100', OB.ob100);
    const appFranv = getMonthlyFranvaroHours(y, mo);
    setV('lon-franv', (m.franv!==undefined && m.franv!=='') ? m.franv : (appFranv || ''));
    setV('lon-extra-add', m.extraAdd); setV('lon-extra-ded', m.extraDed);
    lonAvdrag = m.avdrag || 0;
    const seg=document.getElementById('lon-avdrag-seg'); if(seg) seg.querySelectorAll('button').forEach(b=>b.classList.toggle('active', parseInt(b.dataset.av)===lonAvdrag));
    setV('lon-cfg-manadslon', lonCfg.manadslon); setV('lon-cfg-tillagg', lonCfg.tillagg);
    setV('lon-cfg-timpris', lonTimpris());
    const months=['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
    const pm=lonPayoutDate();
    const payLbl=document.getElementById('lon-payout-lbl'); if(payLbl) payLbl.innerText = `utbetalas i ${months[pm.getMonth()]} ${pm.getFullYear()}`;
    const sub=document.getElementById('lon-period-sub'); if(sub) sub.innerText = `Avser arbete i ${months[lonViewDate.getMonth()]} ${y}`;
    lonRenderUploads(); lonRenderReminder();
}

// Lön-sheet fylls (anropas av navigationscontrollern via openSheet('lon'))
function renderLonSheet(){
    if (!lonCfg) lonLoad();
    lonViewDate = lonWorkDate();
    lonFillFields(); lonRecalc();
    lonSyncRemote();
}
window.renderLonSheet = renderLonSheet;

function lonSettingsOpen(){ const m=document.getElementById('lon-settings-modal'); return m && !m.classList.contains('hidden'); }
function openLonSettings(){
    if (!lonCfg) lonLoad();
    lonRenderTiers(); lonRenderUploads();
    const m=document.getElementById('lon-settings-modal');
    if(m){ m.classList.remove('hidden'); setTimeout(()=>m.classList.replace('opacity-0','opacity-100'),10); if(window.sfPushHist) window.sfPushHist(); }
}
function closeLonSettings(){
    const m=document.getElementById('lon-settings-modal'); if(!m || m.classList.contains('hidden')) return;
    m.classList.replace('opacity-100','opacity-0');
    setTimeout(()=>m.classList.add('hidden'),300);
}
window.openLonSettings = openLonSettings; window.closeLonSettings = closeLonSettings; window.lonSettingsOpen = lonSettingsOpen;

// ---- Bilagor: alltid öppna, appen klassificerar själv ----
function lonClickUpload(slot){ document.getElementById('lon-file-input-'+slot).click(); }
function lonRenderUploads(){
    const cur=realToday; const prev=new Date(cur.getFullYear(), cur.getMonth()-1, 1);
    const prevKey=`${prev.getFullYear()}-${prev.getMonth()+1}`;
    [['tidrapport','Tidrapport (löneart)'],['lonespec','Lönespec']].forEach(([slot,name])=>{
        const btn=document.getElementById('lon-btn-'+slot); const txt=btn&&btn.querySelector('.lon-upbtn-txt');
        if(txt) txt.innerText = name;
        if(btn) btn.classList.remove('lon-locked');
        lonRenderFile(slot);
    });
    const help=document.getElementById('lon-upload-help');
    if(help) help.innerHTML = `Ladda upp <b>när du vill</b> – appen läser månaden ur bilden och avgör själv om det är <b>prognos</b> (pågående månad), <b>facit</b> (avslutad → kalibrerar) eller för gammal. Senaste filen per månad gäller alltid.`;
    const ls=document.getElementById('lon-learn-status');
    if(ls){ const c=lonCfg; ls.innerHTML = `Inlärt: OB-faktor ${(c.obCorr.ob50||1).toFixed(2)}/${(c.obCorr.ob100||1).toFixed(2)}, frånvaro ${(c.franvCorr||1).toFixed(2)}, ${c.taxAnchors.length} skattepunkter.`; }
    lonRenderHistory();
}
function lonRenderReminder(){
    const el=document.getElementById('lon-reminder'); if(!el) return;
    const prev=new Date(realToday.getFullYear(), realToday.getMonth()-1, 1);
    const prevKey=`${prev.getFullYear()}-${prev.getMonth()+1}`; const prevLbl=lonMonthLabel(prevKey);
    const day=realToday.getDate();
    let msg='', urgent=false;
    if (!lonMonthClosed(prevKey)){
        if (!lonHasFacit(prevKey,'tidrapport')){
            urgent = day>10;
            msg = urgent
                ? `⚠️ <b>${prevLbl}</b> är inte stängd – du har inte skickat in tidrapporten (löneart) än. Tryck här.`
                : `📋 Dags att skicka in <b>tidrapporten</b> för ${prevLbl}. Tryck här.`;
        } else if (!lonHasFacit(prevKey,'lonespec')){
            msg = `🧾 Skicka in <b>lönespecen</b> för ${prevLbl} (utbetald nu) så stängs månaden. Tryck här.`;
        }
    }
    if (msg){ el.innerHTML = msg; el.classList.toggle('lon-reminder-urgent', urgent); el.classList.remove('hidden'); } else { el.classList.add('hidden'); }
}
function lonRenderHistory(){
    const el=document.getElementById('lon-history'); if(!el) return;
    const keys=lonRecentMonthKeys(3); // innevarande + 2 bakåt
    el.innerHTML = keys.map(key=>{
        const m=lonMonthly[key]||{};
        const isCur = key===lonCurKey();
        const tid = lonHasFacit(key,'tidrapport')?'✓':(lonHasProg(key,'tidrapport')?'~':'—');
        const spec = lonHasFacit(key,'lonespec')?'✓':'—';
        let badge, cls;
        if (lonMonthClosed(key)){ badge='Stängd'; cls='lh-green'; }
        else if (isCur && (lonHasProg(key,'tidrapport')||lonHasFacit(key,'tidrapport'))){ badge='Prognos'; cls='lh-blue'; }
        else if (lonHasFacit(key,'tidrapport')||lonHasFacit(key,'lonespec')){ badge='Öppen'; cls='lh-amber'; }
        else { badge=isCur?'Pågår':'Väntar'; cls='lh-grey'; }
        return `<div class="lon-hist-row ${cls}"><span class="lh-month">${lonMonthLabel(key)}</span><span class="lh-marks">tidr ${tid} · spec ${spec}</span><span class="lh-badge">${badge}</span></div>`;
    }).join('');
}

async function lonSyncRemote(){
    if (typeof sb === 'undefined' || !sb) return;
    try {
        const { data, error } = await sb.from('lon_store').select('id,data');
        if (error || !data) return;
        let changed=false;
        data.forEach(row=>{
            if(row.id==='cfg' && row.data && typeof row.data.manadslon === 'number'){ lonCfg = lonNormalizeCfg(row.data); changed=true; }
            if(row.id==='monthly' && row.data && typeof row.data === 'object'){ lonMonthly = row.data; changed=true; }
        });
        // Om molnet bara har tomma seed-rader: spara upp den lokala (riktiga) konfigen dit
        const cfgRow = data.find(r=>r.id==='cfg');
        if (!cfgRow || !cfgRow.data || typeof cfgRow.data.manadslon !== 'number') lonPushRemote('cfg', lonCfg);
        if (changed){ try{ localStorage.setItem('sf_lon_cfg', JSON.stringify(lonCfg)); localStorage.setItem('sf_lon_monthly', JSON.stringify(lonMonthly)); }catch(e){}
            lonRenderTiers(); lonRenderAnchors(); lonFillFields(); lonRecalc(); }
    } catch(e){}
}
function lonPushRemote(id, data){ if (typeof sb === 'undefined' || !sb) return; try { sb.from('lon_store').upsert({ id, data, updated_at: new Date().toISOString() }).then(()=>{}); } catch(e){} }

async function lonHandleUpload(input, slot){
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        if (typeof sb === 'undefined' || !sb){
            // ingen avläsning → lägg under föregående månad (facit) som reserv
            const k=lonUploadTargetKey(); const m=lonMonthly[k]||{}; m['file_'+slot]={name:file.name,data:dataUrl}; lonMonthly[k]=m; lonSaveMonthly(); lonRenderUploads();
            showToast('📎','Bilaga sparad (avläsning ej aktiv)',2600); return;
        }
        showToast('🧠','Läser av dokumentet...',2500);
        let data=null, err=null;
        try { const r=await sb.functions.invoke('scan-payslip',{body:{image_base64:dataUrl,kind:slot}}); data=r.data; err=r.error; } catch(ex){ err=ex; }
        if (err){ let msg=err.message||'fel'; try{const j=await err.context.json(); if(j&&j.error)msg=j.error;}catch(_){}; showToast('⚠️','Avläsning misslyckades: '+msg,4500); return; }
        const empty = !data || (data.ob50==null&&data.ob100==null&&data.brutto==null&&data.franvaro_tim==null&&data.bonus==null&&data.manad_nr==null);
        if (empty){ showToast('🔍','Inget kunde läsas av bilden',3500); return; }
        const detKey = lonDetectedKey(data);
        if (!detKey){
            lonConfirm({ title:'Vilken månad avser bilagan?', msg:'Kunde inte läsa månaden automatiskt. Välj månad:', okLabel:'Spara', months:lonRecentMonthKeys(4),
                onOk:(key)=> lonRouteUpload(data, key, slot, file.name, dataUrl) });
            return;
        }
        lonRouteUpload(data, detKey, slot, file.name, dataUrl);
    };
    reader.readAsDataURL(file);
    input.value='';
}
function lonRouteUpload(data, detKey, slot, fileName, dataUrl){
    let cls = lonClassify(detKey);
    if (slot==='lonespec' && cls==='prognos') cls='facit'; // en spec är alltid ett facit
    const lbl = lonMonthLabel(detKey);
    const storeFile = ()=>{ const m=lonMonthly[detKey]||{}; m['file_'+slot]={name:fileName,data:dataUrl}; lonMonthly[detKey]=m; lonSaveMonthly(); };
    if (cls==='old'){
        storeFile(); lonRenderUploads();
        const expected = lonMonthLabel(lonUploadTargetKey());
        lonConfirm({ title:`Fel månad – ${lbl}`, tone:'warn',
            msg:`Det här verkar avse <b>${lbl}</b>, men jag väntar på <b>${expected}</b>. Den är för gammal för att kalibrera och påverkar ingenting. Vill du kalibrera den ändå?`,
            okLabel:'Kalibrera ändå', cancelLabel:'Lämna',
            onOk:()=>{ lonApplyCalibration(data, detKey, slot); lonRenderUploads(); showToast('✅',`${lbl} kalibrerad`,2500); } });
        return;
    }
    if (cls==='prognos'){
        storeFile(); lonApplyPrognos(data, detKey, slot); lonRenderUploads();
        lonToastUndo(`📊 ${lbl} – prognos uppdaterad`, ()=>{ lonUndoPrognos(detKey,slot); lonClearFileKey(detKey,slot); lonRenderUploads(); showToast('↩️','Ångrat – prognosen återställd',1800); });
        return;
    }
    // facit / sent → bekräftelsedialog
    const sent = cls==='sent';
    lonConfirm({
        title: sent ? `${lbl} (lite sent)` : lbl,
        msg: `Stämmer det att den här <b>${slot==='tidrapport'?'tidrapporten':'lönespecen'}</b> avser <b>${lbl}</b>?${sent?' Det är ett par månader sedan, men det går bra att kalibrera.':''} Då kalibreras och månaden stängs.`,
        okLabel:'Ja, kalibrera', cancelLabel:'Avbryt',
        onOk:()=>{ storeFile(); lonApplyCalibration(data, detKey, slot); lonRenderUploads(); showToast('✅',`${lbl} kalibrerad ${lonMonthClosed(detKey)?'· månad stängd':''}`,3000); }
    });
}
// Enkel bekräftelsedialog (med valfri månadsväljare)
function lonConfirm(opts){
    const modal=document.getElementById('lon-confirm-modal'); if(!modal) { if(opts.onOk) opts.onOk(opts.months?opts.months[0]:undefined); return; }
    document.getElementById('lon-confirm-title').innerText = opts.title||'Bekräfta';
    document.getElementById('lon-confirm-msg').innerHTML = opts.msg||'';
    const sel=document.getElementById('lon-confirm-select');
    if (opts.months){ sel.classList.remove('hidden'); sel.innerHTML = opts.months.map(k=>`<option value="${k}">${lonMonthLabel(k)}</option>`).join(''); }
    else sel.classList.add('hidden');
    const ok=document.getElementById('lon-confirm-ok'), cancel=document.getElementById('lon-confirm-cancel');
    ok.innerText = opts.okLabel||'OK'; cancel.innerText = opts.cancelLabel||'Avbryt';
    ok.classList.toggle('md-btn-tonal-red', opts.tone==='warn');
    const close=()=>{ modal.classList.replace('opacity-100','opacity-0'); setTimeout(()=>modal.classList.add('hidden'),250); };
    ok.onclick=()=>{ const key=opts.months? sel.value : undefined; close(); if(opts.onOk) opts.onOk(key); };
    cancel.onclick=()=>{ close(); showToast('✖️','Avbrutet – inget ändrades',1800); };
    modal.classList.remove('hidden'); setTimeout(()=>modal.classList.replace('opacity-0','opacity-100'),10);
}
function lonConfirmOpen(){ const m=document.getElementById('lon-confirm-modal'); return m && !m.classList.contains('hidden'); }
window.lonConfirmOpen=lonConfirmOpen;
// Toast med Ångra-knapp (6 sek)
function lonToastUndo(text, onUndo){
    const t=document.getElementById('lon-undo-toast'); if(!t){ showToast('📊',text,3000); return; }
    t.querySelector('.lon-undo-txt').innerText=text;
    const btn=t.querySelector('.lon-undo-btn');
    t.classList.remove('hidden'); requestAnimationFrame(()=>t.classList.add('show'));
    let done=false; const hide=()=>{ if(done)return; done=true; t.classList.remove('show'); setTimeout(()=>t.classList.add('hidden'),300); };
    btn.onclick=()=>{ hide(); if(onUndo) onUndo(); };
    clearTimeout(t._timer); t._timer=setTimeout(hide,6000);
}
function lonRenderFile(slot){
    // visa filen för den månad som senast har en bilaga av denna typ (innevarande → bakåt)
    let k=null; for(const key of lonRecentMonthKeys(4)){ if(lonHasFile(key,slot)){ k=key; break; } }
    const el = document.getElementById('lon-file-'+slot); if(!el) return;
    if (!k){ el.classList.add('hidden'); el.innerHTML=''; return; }
    const f = lonMonthly[k]['file_'+slot];
    el.classList.remove('hidden');
    el.innerHTML = `📎 ${lonMonthLabel(k)}: ${f.name}` + (f.data?' <span class="lon-file-open">öppna</span>':'') + ' <span class="lon-file-del">ta bort</span>';
    const o = el.querySelector('.lon-file-open'); if(o) o.onclick = ()=>{ const w=window.open(); if(w) w.document.write('<iframe src="'+f.data+'" style="border:0;width:100%;height:100%"></iframe>'); };
    const d = el.querySelector('.lon-file-del'); if(d) d.onclick = ()=>{ delete lonMonthly[k]['file_'+slot]; lonClearCalibration(k, slot); delete (lonMonthly[k]||{})['prog_'+slot]; lonSaveMonthly(); lonRenderUploads(); lonRenderReminder(); lonRecalc(); showToast('🗑️',`${lonMonthLabel(k)} ${slot} borttagen – omräknad`,2800); };
}

async function init() {
    try {
        const savedTheme = localStorage.getItem('sf_theme') || 'light';
        if (document.body) { document.body.setAttribute('data-theme', savedTheme); }
    } catch(e) { console.warn('Theme init error', e); }

    await loadAllData();
    setMode('dash');
    updateTopTitle();
}

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
    const ex = db.d[activeK] || {};
    if (ex.abs) { pushMatrixSync(activeK, { s: val }); }              // behåll frånvaro – siffror räknas ändå
    else { pushMatrixSync(activeK, { s: val, st: 'Arbete', abs: null }); }
    closeInlineNumpad();
}

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
    const str = (numpadValue === "") ? "0 kr" : (Number(numpadValue).toLocaleString('sv-SE') + " kr");
    const dispEl = document.getElementById('numpad-display');
    if(dispEl) dispEl.innerText = str;
    if(numpadTarget === 'month') {
        const textEl = document.getElementById('month-sales-text');
        if(textEl) textEl.innerText = str;
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
            const ex = db.d[k] || {};
            if (ex.abs) { pushMatrixSync(k, { s: val }); }            // behåll frånvaro – siffror räknas ändå
            else { pushMatrixSync(k, { s: val, st: 'Arbete', abs: null }); }
        });
        closeMonthEdit();
    }
    closeNumpad();
}

function closeFocusMode(force) { 
    currentFocusReason = null; 
    focusKeySet = null;
    document.body.classList.remove('focus-mode-active'); 
    document.querySelectorAll('.day-cell, .vp-cell').forEach(c => c.classList.remove('focus-highlight', 'active-focus'));
    const fl=document.getElementById('focus-info'); if(fl) fl.innerHTML='';
    if (viewMode === 'month') { renderCal(viewDate.getFullYear(), viewDate.getMonth() + 1); updateCalToolbar(); }
    updateDashboardView(); updateTopInfoBar(); 
}

function updateCalToolbar() {
    const bar = document.getElementById('cal-symbol-bar');
    const mText = document.getElementById('month-sales-text');
    const n = multiSelectKeys.size;
    if (bar) bar.classList.toggle('has-selection', n > 0);
    if (mText) {
        if (n === 1) { const o = db.d[Array.from(multiSelectKeys)[0]] || {}; mText.innerText = (o.s > 0 ? Number(o.s).toLocaleString('sv-SE') : '0') + ' kr'; }
        else if (n > 1) { mText.innerText = n + ' dagar'; }
        else { mText.innerText = '0 kr'; }
    }
}

function calApply(type) {
    if (!multiSelectKeys.size) { showToast('☝️', 'Markera dag(ar) i kalendern först'); return; }
    checkOverwriteFromPopup(type);
}

function calAmountEdit() {
    if (!multiSelectKeys.size) { showToast('☝️', 'Markera dag(ar) i kalendern först'); return; }
    openNumpad('month', 0, 'VÄLJ BELOPP');
}

// "Försäljning"-knappen: hoppa till vald dag i dagsvyn (slider) där belopp m.m. kan ändras
function calToSales() {
    let k = null;
    if (multiSelectKeys && multiSelectKeys.size === 1) k = Array.from(multiSelectKeys)[0];
    else if (multiSelectKeys && multiSelectKeys.size > 1) { showToast('☝️', 'Välj en enstaka dag för att öppna dagsvyn', 2200); return; }
    else if (activeK) k = activeK;
    else k = getK(realToday);
    goToDayDash(k);
}
function goToDayDash(k) {
    if (multiSelectKeys) multiSelectKeys.clear();
    activeK = k;
    const p = k.split('-'); const d = new Date(+p[0], +p[1]-1, +p[2]);
    currentWeekStart = new Date(d); const sdo = currentWeekStart.getDay() || 7; currentWeekStart.setDate(currentWeekStart.getDate() - sdo + 1); currentWeekStart.setHours(0,0,0,0);
    viewDate = new Date(d); db.b = getBudgetForMonth(viewDate.getFullYear(), viewDate.getMonth() + 1);
    if (document.body.classList.contains('focus-mode-active') && typeof window.closeFocusMode === 'function') window.closeFocusMode(true);
    if (typeof window.closeActiveSheet === 'function') window.closeActiveSheet();
    setMode('dash');
    calculateTimeline(); renderWeekSlides(); updateDashboardView(); updateTopTitle(); updateTopInfoBar();
    setTimeout(() => { document.querySelectorAll('.vp-cell').forEach(c => c.classList.toggle('active-focus', c.dataset.key === k)); syncTodayBlue && syncTodayBlue(); }, 60);
}
window.calToSales = calToSales; window.goToDayDash = goToDayDash;

function closeMonthEdit() {
    multiSelectKeys.clear();
    document.querySelectorAll('.day-cell, .vp-cell').forEach(c => c.classList.remove('active-focus'));
    updateCalToolbar();
    updateTopInfoBar();
}

function openEvalModal() { 
    if (!activeK) return;
    const o = db.d[activeK] || {};
    
    if (o.eval) {
        evalState = typeof o.eval === 'string' ? JSON.parse(o.eval) : JSON.parse(JSON.stringify(o.eval));
        if(evalState.emoji) evalState = {}; 
    } else { evalState = {}; }
    
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
        html += `<div class="flex flex-col gap-1.5 p-2 bg-slate-50/50 rounded-2xl border border-slate-100"><span class="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">${m.label}</span><div class="flex gap-1.5 justify-between">${btnHtml}</div></div>`;
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
        const merged = { date_key: activeK, status: db.d[activeK].st || 'Arbete', sales: db.d[activeK].s || 0, is_absent: db.d[activeK].abs || null, raw_reason: db.d[activeK].raw || null, fk_perc: db.d[activeK].fk_perc || null, abs_hours: db.d[activeK].abs_hours || null, eval_data: evalState };
        sb.from('sales_data').upsert(merged).then(({error}) => { if(error) console.warn("Supabase utvärdering fel:", error); });
    }
    closeEvalModal(); updateDashboardView();
}

function openSavedNotesModal() {
    const m = document.getElementById('saved-notes-modal');
    if (!m) return;
    try { renderNotes(); } catch (e) { console.warn('renderNotes', e); }
    if (typeof window.closeNotesModal === 'function') window.closeNotesModal();
    m.classList.remove('hidden');
    requestAnimationFrame(() => {
        m.classList.remove('opacity-0'); m.classList.add('opacity-100');
        if (m.children[0]) m.children[0].classList.remove('scale-95');
    });
    if (window.sfPushHist) window.sfPushHist();
}
window.openSavedNotesModal = openSavedNotesModal;

function closeSavedNotesModal() {
    const m = document.getElementById('saved-notes-modal');
    if(m) {
        m.classList.add('opacity-0');
        if(m.children[0]) m.children[0].classList.add('scale-95');
        setTimeout(() => {
            m.classList.add('hidden');
        }, 300);
    }
}

let currentEditId = null;

function openNotesModal() {
    const m = document.getElementById('notes-modal');
    if(m) { m.classList.remove('hidden'); m.classList.replace('opacity-0', 'opacity-100'); }
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    if (modal) {
        modal.classList.replace('opacity-100', 'opacity-0');
        modal.classList.add('hidden');
        currentEditId = null;
        const submitBtn = document.getElementById('note-submit-btn');
        if(submitBtn) submitBtn.innerText = "SPARA ANTECKNING";
        ['note-name', 'note-phone', 'note-order', 'note-text', 'note-due', 'note-prio'].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).value = '';
        });
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
        const index = cleanNotes.findIndex(n => n.id === currentEditId);
        if (index !== -1) { cleanNotes[index] = { ...cleanNotes[index], name, phone, order, text, due, prio }; }
        currentEditId = null;
        document.getElementById('note-submit-btn').innerText = "SPARA ANTECKNING";
    } else {
        const newNote = { id: Date.now(), name, phone, order, text, due, prio };
        cleanNotes.unshift(newNote);
        if (typeof sb !== 'undefined' && sb) {
            sb.from('notes').insert([{ id: newNote.id, customer_name: newNote.name, phone: newNote.phone, order_nr: newNote.order, note_text: newNote.text }]).then(({error}) => { if(error) console.warn("Supabase fel:", error); });
        }
    }
    
    localStorage.setItem('sf_notes_clean', JSON.stringify(cleanNotes));
    
    if(nameEl) nameEl.value = ''; if(phoneEl) phoneEl.value = ''; if(orderEl) orderEl.value = ''; 
    if(textEl) textEl.value = ''; if(dueEl) dueEl.value = ''; if(prioEl) prioEl.value = ''; 
    
    closeNotesModal();
    setTimeout(openSavedNotesModal, 300);
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
    
    closeSavedNotesModal();
    setTimeout(openNotesModal, 300);
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
    
    localStorage.removeItem('sf_notes');
    let cleanNotes = [];
    try { cleanNotes = JSON.parse(localStorage.getItem('sf_notes_clean')) || []; } catch(e){}
    
    checkUrgentNotes(cleanNotes);
    
    if(cleanNotes.length === 0) { 
        c.innerHTML = '<div class="h-full flex flex-col items-center justify-center p-4 mt-4"><span class="text-3xl mb-2 opacity-40">📝</span><p class="text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">Inga anteckningar</p></div>'; 
        return;
    }

    cleanNotes.sort((a, b) => {
        const prioA = a.prio ? parseInt(a.prio) : 99; 
        const prioB = b.prio ? parseInt(b.prio) : 99;
        return prioA - prioB;
    });

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
            if (diffDays <= 7 && diffDays >= -30) { hasUrgent = true; break; }
        }
    }

    if (hasUrgent) { penBtn.classList.add('urgent-note-blink'); } else { penBtn.classList.remove('urgent-note-blink'); }
}

function toggleSummaryView() {
    const stats = document.getElementById('summary-stats-view');
    const insights = document.getElementById('summary-insights-view');
    const title = document.getElementById('summary-modal-title');
    if (currentSummaryView === 'stats') {
        stats.classList.add('hidden'); insights.classList.remove('hidden'); currentSummaryView = 'insights'; title.innerText = "INSIKTER";
    } else {
        insights.classList.add('hidden'); stats.classList.remove('hidden'); currentSummaryView = 'stats'; title.innerText = "SAMMANFATTNING";
    }
}

function calculateSummaryStats() {
    const cy = viewDate.getFullYear(); const cm = viewDate.getMonth() + 1; const daysM = new Date(cy, cm, 0).getDate();
    let wDays = 0, aDays = 0, bestS = 0, bestD = "--", worstS = Infinity, worstD = "--";
    let streak = 0, maxStreak = 0; let absCounts = {};
    let f_work = [], f_abs = [], f_green = [], f_reasons = {}, f_bestKey = null, f_worstKey = null, weekKeyMap = {};
    let totalEvals = 0;
    let goodScores = { flow: 0, energy: 0, engagement: 0, closing: 0, upsell: 0 }; let goodCount = { flow: 0, energy: 0, engagement: 0, closing: 0, upsell: 0 };
    let badScores = { flow: 0, energy: 0, engagement: 0, closing: 0, upsell: 0 }; let badCount = { flow: 0, energy: 0, engagement: 0, closing: 0, upsell: 0 };
    
    for (let d=1; d<=daysM; d++) {
        const k = `${cy}-${cm}-${d}`; const o = db.d[k] || {s:0}; const tgt = timeline[k]?.target || 0; const qData = db.q[k] || {};
        
        if ((o.s > 0) || (qData.start && !o.abs && o.st !== 'Ledig' && o.st !== 'Semester')) { wDays++; f_work.push(k); }
        if (o.abs && !o.abs.includes('Semester') && o.abs !== 'Åtgärd krävs') { aDays++; let baseAbs = o.abs.split(' ')[0]; absCounts[baseAbs] = (absCounts[baseAbs] || 0) + 1; }
        if (o.abs && o.abs !== 'Åtgärd krävs') { f_abs.push(k); const full = o.abs; (f_reasons[full] = f_reasons[full] || []).push(k); }
        
        if (o.s > 0) {
            if (o.s > bestS) { bestS = o.s; bestD = `${d}/${cm}`; f_bestKey = k; }
            if (o.s < worstS) { worstS = o.s; worstD = `${d}/${cm}`; f_worstKey = k; }
        }
        
        if (tgt > 0 && o.s >= tgt) { streak++; if (streak > maxStreak) maxStreak = streak; f_green.push(k); } else if (tgt > 0 && o.s < tgt && !o.abs) { streak = 0; }

        if (o.eval) {
            totalEvals++; let ev = typeof o.eval === 'string' ? JSON.parse(o.eval) : o.eval;
            let isGood = tgt > 0 && o.s >= tgt; let isBad = tgt > 0 && o.s < tgt;
            evalMetrics.forEach(m => {
                let score = ev[m.id];
                if (score) {
                    if (isGood) { goodScores[m.id] += score; goodCount[m.id]++; }
                    if (isBad) { badScores[m.id] += score; badCount[m.id]++; }
                }
            });
        }
    }
    
    document.getElementById('sum-workdays').innerText = wDays; document.getElementById('sum-absdays').innerText = aDays;
    
    if (bestS > 0) { document.getElementById('sum-bestday-val').innerText = (bestS/1000).toFixed(1) + "k"; document.getElementById('sum-bestday-lbl').innerText = bestD; } else { document.getElementById('sum-bestday-val').innerText = "0k"; document.getElementById('sum-bestday-lbl').innerText = "--"; }
    if (worstS !== Infinity) { document.getElementById('sum-worstday-val').innerText = (worstS/1000).toFixed(1) + "k"; document.getElementById('sum-worstday-lbl').innerText = worstD; } else { document.getElementById('sum-worstday-val').innerText = "0k"; document.getElementById('sum-worstday-lbl').innerText = "--"; }
    
    document.getElementById('sum-streak').innerText = maxStreak + " 🔥";
    
    let weeklySalesMap = {};
    for (let d=1; d<=daysM; d++) {
        const k = `${cy}-${cm}-${d}`;
        const sales = db.d[k]?.s || 0;
        if (sales > 0) {
            let dObj = new Date(cy, cm-1, d);
            dObj = new Date(Date.UTC(dObj.getFullYear(), dObj.getMonth(), dObj.getDate()));
            let dayNum = dObj.getUTCDay() || 7; 
            dObj.setUTCDate(dObj.getUTCDate() + 4 - dayNum);
            let yearStart = new Date(Date.UTC(dObj.getUTCFullYear(),0,1));
            let weekNo = Math.ceil((((dObj - yearStart) / 86400000) + 1)/7);
            let weekKey = dObj.getUTCFullYear() + '-W' + weekNo;

            if (!weeklySalesMap[weekKey]) weeklySalesMap[weekKey] = 0;
            weeklySalesMap[weekKey] += sales;
            (weekKeyMap[weekKey] = weekKeyMap[weekKey] || []).push(k);
        }
    }

    let bestWk = 0; let bestWkLbl = "--"; let bestWkKey = null;
    for (const [wKey, wSum] of Object.entries(weeklySalesMap)) {
        if (wSum > bestWk) {
            bestWk = wSum;
            bestWkLbl = "V." + wKey.split('-W')[1];
            bestWkKey = wKey;
        }
    }
    document.getElementById('sum-bestweek-val').innerText = (bestWk/1000).toFixed(1) + "k"; document.getElementById('sum-bestweek-lbl').innerText = bestWkLbl;

    // Spara nyckelmängder för sammanfattningens fokusåtgärder
    summaryFocus = {
        work: f_work, abs: f_abs, green: f_green, reasons: f_reasons,
        best: f_bestKey ? [f_bestKey] : [], worst: f_worstKey ? [f_worstKey] : [],
        week: bestWkKey ? (weekKeyMap[bestWkKey] || []) : []
    };
    
    const absDetails = document.getElementById('sum-abs-details'); const absList = document.getElementById('sum-abs-list');
    if (Object.keys(f_reasons).length > 0) {
        absDetails.classList.remove('hidden'); let h = "";
        for (let a in f_reasons) {
            const cnt = f_reasons[a].length;
            h += `<button onclick="focusFromSummary('reason','${a.replace(/'/g,"\\'")}')" class="sum-reason-row"><span class="sum-reason-name">${focusEmoji(a)} ${a}</span><span class="sum-reason-cnt">${cnt} st <span class="material-symbols-rounded">chevron_right</span></span></button>`;
        }
        absList.innerHTML = h;
    } else { absDetails.classList.add('hidden'); }

    const insightCont = document.getElementById('insight-container');
    if (totalEvals === 0) {
        insightCont.innerHTML = `<div class="flex flex-col items-center justify-center py-10 opacity-50"><span class="text-4xl mb-2">🫙</span><p class="text-[10px] font-black uppercase tracking-widest text-center text-slate-500">Inga utvärderingar<br>denna månad</p></div>`;
    } else {
        let goodHtml = ''; let badHtml = '';
        evalMetrics.forEach(m => {
            let gAvg = goodCount[m.id] > 0 ? (goodScores[m.id] / goodCount[m.id]).toFixed(1) : '-';
            let bAvg = badCount[m.id] > 0 ? (badScores[m.id] / badCount[m.id]).toFixed(1) : '-';
            if(gAvg !== '-') { goodHtml += `<div class="flex justify-between items-center py-0.5 border-b border-[#bbf7d0] last:border-0"><span class="text-[9.5px] font-bold text-emerald-700">${m.label}</span><span class="text-[11px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded shadow-sm">${gAvg}</span></div>`; }
            if(bAvg !== '-') { badHtml += `<div class="flex justify-between items-center py-0.5 border-b border-[#fecdd3] last:border-0"><span class="text-[9.5px] font-bold text-rose-700">${m.label}</span><span class="text-[11px] font-black text-rose-600 bg-white px-2 py-0.5 rounded shadow-sm">${bAvg}</span></div>`; }
        });

        insightCont.innerHTML = `
            <div class="bg-white border border-slate-100 rounded-[20px] p-2 shadow-sm flex flex-col gap-2">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center mb-0.5">Dina mönster (${totalEvals} pass)</span>
                ${goodHtml ? `<div class="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-2 shadow-inner"><span class="text-[8px] font-black text-emerald-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">✅ Snitt när du NÅTT MÅL</span><div class="flex flex-col">${goodHtml}</div></div>` : ''}
                ${badHtml ? `<div class="bg-[#fff1f2] border border-[#fecdd3] rounded-xl p-2 shadow-inner"><span class="text-[8px] font-black text-rose-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">❌ Snitt när du MISSAT MÅL</span><div class="flex flex-col">${badHtml}</div></div>` : ''}
            </div>
        `;
    }
}

function openSummaryModal(mode) { 
    calculateSummaryStats(); currentSummaryView = 'stats';
    document.getElementById('summary-stats-view').classList.remove('hidden'); document.getElementById('summary-insights-view').classList.add('hidden'); document.getElementById('summary-modal-title').innerText = "SAMMANFATTNING";
    const m = document.getElementById('summary-modal'); if(m) { m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0'), 10); } 
}

function closeSummaryModal() { const m = document.getElementById('summary-modal'); if(m) { m.classList.add('opacity-0'); setTimeout(() => m.classList.add('hidden'), 300); } }

function selectChild(name) { 
    closeChildModal();
    let absStr = pendingAbsenceType; if (absStr === 'VAB' || absStr === 'Föräldraledig') absStr += ' ' + name;
    if (pendingAbsenceSource === 'dash' && activeK) { pushMatrixSync(activeK, { abs: absStr, st: 'Arbete' }); } 
    else if (pendingAbsenceSource === 'month' && multiSelectKeys.size > 0) { multiSelectKeys.forEach(k => pushMatrixSync(k, { abs: absStr, st: 'Arbete' })); closeMonthEdit(); }
}
function closeChildModal() { const m = document.getElementById('child-select-modal'); if(m) m.classList.add('hidden'); }
function triggerChildSelection(type, source) { 
    pendingAbsenceType = type; pendingAbsenceSource = source;
    const m = document.getElementById('child-select-modal'); if(m) { document.getElementById('child-modal-title').innerText = type + ' GÄLLER VEM?'; m.classList.remove('hidden'); setTimeout(() => m.classList.remove('opacity-0'), 10); } 
}

function openBudgetModal() { const m = document.getElementById('budget-modal'); if(m) m.classList.remove('hidden'); }
function closeBudgetModal() { const m = document.getElementById('budget-modal'); if(m) m.classList.add('hidden'); }
function closeNoteConfirmModal() { const m = document.getElementById('note-confirm-modal'); if(m) m.classList.add('hidden'); }

function checkOverwriteFromPopup(type) { 
    if (type === 'VAB' || type === 'Föräldraledig') { triggerChildSelection(type, 'month'); return; }
    if (type === 'delete') { multiSelectKeys.forEach(k => pushMatrixSync(k, { abs: null, st: 'Arbete' })); closeMonthEdit(); return; }
    multiSelectKeys.forEach(k => pushMatrixSync(k, { abs: type === 'Arbete' ? null : type, st: type })); closeMonthEdit(); 
}

function handleDashAction(type) { 
    if(!activeK) return;
    if (type === 'VAB' || type === 'Föräldraledig') { triggerChildSelection(type, 'dash'); return; }
    pushMatrixSync(activeK, { abs: type === 'Arbete' ? null : type, st: type }); 
}

function hideConfirm() { const box = document.getElementById('confirm-box'); if(box) box.style.display = 'none'; }

function triggerFocusMode(reason) { 
    currentFocusReason = reason; let temp = currentFocusReason; currentFocusReason = null; setMode('month'); currentFocusReason = temp;
    document.body.classList.add('focus-mode-active');
    document.querySelectorAll('.day-cell, .vp-cell').forEach(c => {
        const k = c.dataset.key; const o = db.d[k];
        if(o && o.abs && o.abs.includes(reason)) c.classList.add('focus-highlight'); else c.classList.remove('focus-highlight');
    });
    closeSummaryModal();
}

// ==========================================
//  EVENT LISTENERS & APP START
// ==========================================
function handleSwipeStart(e) { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; }
function handleSwipeEnd(e, targetView) { 
    let dx = e.changedTouches[0].screenX - touchStartX; let dy = e.changedTouches[0].screenY - touchStartY; 
    if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) { 
        let dir = dx > 0 ? -1 : 1; 
        if (targetView === 'day') navDay(dir);
        else if (targetView === 'week') navCal(dir);
        else if (targetView === 'month' && viewMode === 'month') navCal(dir);
        else if (targetView === 'absence' && viewMode === 'absence') navCal(dir);
        else if (targetView === 'coach' && viewMode === 'coach') navCal(dir);
    } 
}

const pdInner = document.getElementById('dash-inner-card'); 
if(pdInner) { pdInner.addEventListener('touchstart', handleSwipeStart, {passive: true}); pdInner.addEventListener('touchend', (e) => handleSwipeEnd(e, 'day'), {passive: true}); }
const sCurr = document.getElementById('slide-curr'); 
if(sCurr) { sCurr.addEventListener('touchstart', handleSwipeStart, {passive: true}); sCurr.addEventListener('touchend', (e) => handleSwipeEnd(e, 'week'), {passive: true}); }

const pm = document.getElementById('pane-month'); if(pm) { pm.addEventListener('touchstart', handleSwipeStart, {passive: true}); pm.addEventListener('touchend', (e) => handleSwipeEnd(e, 'month'), {passive: true}); }
const pa = document.getElementById('pane-absence'); if(pa) { pa.addEventListener('touchstart', handleSwipeStart, {passive: true}); pa.addEventListener('touchend', (e) => handleSwipeEnd(e, 'absence'), {passive: true}); }
const pc = document.getElementById('pane-coach'); if(pc) { pc.addEventListener('touchstart', handleSwipeStart, {passive: true}); pc.addEventListener('touchend', (e) => handleSwipeEnd(e, 'coach'), {passive: true}); }

const infoBar = document.getElementById('top-info-bar');
if (infoBar) {
    infoBar.addEventListener('click', () => {
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
}

document.addEventListener('click', (e) => { 
    const mMenu = document.getElementById('month-edit-menu'); 
    if (mMenu && !mMenu.classList.contains('hidden') && !e.target.closest('#month-edit-menu') && !e.target.closest('.day-cell') && !e.target.closest('.vp-cell') && !e.target.closest('#bottom-numpad-view') && !e.target.closest('#top-info-bar')) { 
        multiSelectKeys.clear(); 
        document.querySelectorAll('.day-cell, .vp-cell').forEach(c => c.classList.remove('active-focus')); 
        closeMonthEdit(); 
        updateTopInfoBar(); 
    } 
});

window.addEventListener('DOMContentLoaded', () => { init(); });

if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").catch(e => {}); }
