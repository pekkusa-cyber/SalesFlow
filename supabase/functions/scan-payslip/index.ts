// scan-payslip: läser en lönespec (Hogia/MyPayslip) eller Quinyx-tidrapport.
// 1) Google Vision gör om bilden till text.
// 2) En AI-modell (Groq) tolkar texten till fält.
// 3) Fasta regler läser de viktigaste siffrorna direkt ur texten och vinner över
//    AI-tolkningen när de hittar något. AI:n har tidigare tagit årets bruttolön
//    ("Bruttolön total/år") som månadens och multiplikatorn "1,00" som OB-timmar.
// 4) Rimlighetskontroll: orimliga värden tas bort i stället för att sparas.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VISION_KEY = Deno.env.get("GOOGLE_VISION_API_KEY");
const GROQ_KEY = Deno.env.get("GROQ_API_KEY");

// "19 951,00" / "-1 383,17" / "34 407" → tal
function tal(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).replace(/[\s ]/g, "").replace(/−/g, "-").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

// Fasta regler för Hogia/MyPayslip. Texten från Vision kommer rad för rad; en
// lönerad står som rubrik, sedan "MMDD-MMDD  pris x antal", och beloppet kan
// hamna på samma rad eller längre ner. Därför läses antal ur "pris x antal".
export function regler(text: string) {
  const ut: Record<string, number> = {};
  const rader = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const hela = rader.join("\n");
  const BEL = /^-?\s?\d{1,3}(?:[ \u00a0]\d{3})*,\d{1,2}$/;

  // Månadens bruttolön: talet i parentes efter "Prel skatt tabell"
  const br = hela.match(/Prel\.?\s*skatt\s*tabell[\s\S]{0,30}?\(\s*([\d\s\u00a0]+,\d{1,2})\s*\)/i);
  if (br) ut.brutto = tal(br[1])!;
  // Månadens skatt: första beloppet efter "Prel skatt tabell"
  const sk = hela.match(/Prel\.?\s*skatt\s*tabell[^\n]*\n(?:\([^)]*\)\n)?\s*(-\s?\d{1,3}(?:[ \u00a0]\d{3})*,\d{2})/i);
  if (sk) ut.skatt = Math.abs(tal(sk[1])!);

  // Netto: "Din lön" följt av beloppet (t.ex. "34 407 kr")
  const ne = hela.match(/Din\s+l[öo]n[^\d\n]*\n?[^\d\n]*?(\d{1,3}(?:[ \u00a0]\d{3})+|\d{4,6})(?:,\d{2})?\s*kr/i);
  if (ne) ut.netto = tal(ne[1])!;

  // "pris x antal" på raderna under en rubrik (datum kan stå före, på egen rad eller saknas)
  const prisAntal = (i: number) => {
    for (let k = i + 1; k < Math.min(rader.length, i + 5); k++) {
      const m = rader[k].match(/(-?\s?[\d\u00a0 ]+,\d{2})\s*x\s*(\d+(?:,\d{1,2})?)\s*$/i);
      if (m) {
        // datumet "1022-1022" kan sitta ihop med priset: "1022-1022-181,14x0,33"
        const pris = tal(m[1].replace(/^.*?(\d{4}-\d{4})/, ""))!;
        return { pris: Math.abs(pris), antal: tal(m[2])! };
      }
      if (/[a-zåäö]{3,}/i.test(rader[k]) && !(k === i + 1 && /^[a-zåäö]/.test(rader[k]))) break; // nästa rubrik
    }
    return null;
  };
  // belopp på datumraden direkt under rubriken: "1001-1031 19951,00"
  const datumBelopp = (i: number) => {
    for (let k = i + 1; k < Math.min(rader.length, i + 3); k++) {
      const m = rader[k].match(/^(\d{2})\d{2}-\d{4}\s+(\d[\d\s\u00a0]*,\d{2})$/);
      if (m) return { belopp: tal(m[2])!, mm: +m[1] };
      if (/[a-zåäö]{3,}/i.test(rader[k])) break;
    }
    return null;
  };

  const ob50: number[] = [], ob100: number[] = [], bonus: number[] = [], franvKr: number[] = [], senKr: number[] = [], bonusRad: { belopp: number; mm: number }[] = [], obMm: number[] = [];
  for (let i = 0; i < rader.length; i++) {
    const r = rader[i];
    if (/^OB[- ]?till[äa]gg\s*50\s*%/i.test(r) || /^OB\s*kontant\s*50/i.test(r)) { const t = prisAntal(i); if (t) { ob50.push(t.antal); const d = (rader[i + 1] || "").match(/^(\d{2})\d{2}-\d{4}/); if (d) obMm.push(+d[1]); } }
    else if (/^OB[- ]?till[äa]gg\s*100\s*%/i.test(r) || /^OB\s*kontant\s*100/i.test(r)) { const t = prisAntal(i); if (t) { ob100.push(t.antal); const d = (rader[i + 1] || "").match(/^(\d{2})\d{2}-\d{4}/); if (d) obMm.push(+d[1]); } }
    else if (/^Bonus\b/i.test(r)) { const b = datumBelopp(i); if (b != null) { bonus.push(b.belopp); bonusRad.push(b); } }
    else if (/^(F[öo]r[äa]ldrale|VAB|Sjuk|Tj[äa]nstledig|Sen ankomst|Fr[åa]nvaro)/i.test(r)) {
      const t = prisAntal(i);
      if (t) { franvKr.push(t.pris * t.antal); if (/^Sen ankomst/i.test(r)) senKr.push(t.pris * t.antal); }   // sen ankomst/tidig hemgång ingår i frånvarosumman men redovisas också separat
    }
  }
  const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
  if (ob50.length) ut.ob50 = sum(ob50);
  if (ob100.length) ut.ob100 = sum(ob100);
  if (bonus.length) {
    ut.bonus = sum(bonus);                                   // allt som betalades ut som bonus på specen
    // Bonus som hör till själva månaden: rader vars datum ligger i samma månad som OB-raderna.
    // En spec kan även innehålla en bonusrad från månaden före (t.ex. 0801-0831 på septemberspecen).
    const freq: Record<number, number> = {}; obMm.forEach((m) => (freq[m] = (freq[m] || 0) + 1));
    const huvud = Object.keys(freq).sort((a, b) => freq[+b] - freq[+a])[0];
    if (huvud != null) { const egen = bonusRad.filter((b) => b.mm === +huvud).map((b) => b.belopp); if (egen.length) ut.bonus_manad = sum(egen); }
  }
  // Arbetsmånaden avgörs av datumen på raderna (MMDD), aldrig av AI-modellens gissning:
  // månaden som flest OB-/bonusrader ligger i. Avgör vilken månad specen sparas på.
  { const alla = obMm.concat(bonusRad.map((b) => b.mm)); const f: Record<number, number> = {}; alla.forEach((m) => (f[m] = (f[m] || 0) + 1));
    const bast = Object.keys(f).sort((a, b) => f[+b] - f[+a])[0]; if (bast != null && +bast >= 1 && +bast <= 12) ut.manad_nr = +bast; }
  if (franvKr.length) ut.franvaro_avdrag_kr = sum(franvKr);
  if (senKr.length) ut.sen_avdrag_kr = sum(senKr); else if (/Sen ankomst/i.test(hela) === false) ut.sen_avdrag_kr = 0;
  return ut;
}

// Orimliga värden tas bort. Årets totaler är mångdubbelt större än en månadslön.
function rimligt(o: Record<string, number | null>) {
  const ml = o.manadslon && o.manadslon > 10000 && o.manadslon < 80000 ? o.manadslon : 30000;
  const tak = ml * 4;
  for (const f of ["brutto", "netto", "skatt", "bonus", "bonus_manad", "franvaro_avdrag_kr", "sen_avdrag_kr"]) {
    const v = o[f];
    if (v != null && (v < 0 || v > tak)) o[f] = null;
  }
  // "1,00" är multiplikatorn på OB-raden, aldrig timmar (OB på en hel månad blir aldrig exakt 1 + 1)
  if (o.ob50 === 1 && o.ob100 === 1) { o.ob50 = null; o.ob100 = null; }
  for (const f of ["ob50", "ob100"]) { const v = o[f]; if (v != null && (v < 0 || v > 200)) o[f] = null; }
  if (o.brutto == null && o.netto != null && o.skatt != null) o.brutto = Math.round((o.netto + o.skatt) * 100) / 100;
  if (o.netto == null && o.brutto != null && o.skatt != null) o.netto = Math.round(o.brutto - o.skatt);
  return o;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!VISION_KEY) throw new Error("GOOGLE_VISION_API_KEY saknas");
    if (!GROQ_KEY) throw new Error("GROQ_API_KEY saknas");

    const body = await req.json();
    const { image_base64, kind, debug } = body ?? {};
    if (!image_base64) throw new Error("image_base64 saknas");

    // 1) OCR via Google Vision
    const b64 = String(image_base64).includes(",") ? String(image_base64).split(",")[1] : String(image_base64);
    const visionRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ image: { content: b64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }),
    });
    const visionJson = await visionRes.json();
    if (!visionRes.ok) throw new Error("Vision fel: " + JSON.stringify(visionJson));
    const text = visionJson?.responses?.[0]?.fullTextAnnotation?.text ?? visionJson?.responses?.[0]?.textAnnotations?.[0]?.description ?? "";
    if (!text) throw new Error("Ingen text hittades i bilden");

    // 2) Strukturera med Groq
    const sys =
      "Du läser svenska lönespecifikationer (Hogia/MyPayslip) och Quinyx-lönearter/tidrapporter. " +
      "Returnera ENDAST giltig JSON, inga förklaringar, inga kodstaket. " +
      "VIKTIGAST — manad_nr: heltal 1-12 för ARBETSMÅNADEN som dokumentet AVSER. " +
      "På en lönespec står överst en utbetalningsmånad (t.ex. 'Juni 2026', 'Utbetalningsdatum 18 juni') — den ska du IGNORERA. " +
      "Arbetsmånaden avgörs istället av datumintervallen på rad-raderna, t.ex. 'OB-tillägg 0509-0524', 'Bonus 0501-0531', 'Föräldraled 0501-0501'. " +
      "Dessa MMDD-intervall visar den faktiska arbetsmånaden. Om de flesta variabla raderna (OB, bonus, frånvaro) ligger i 05xx → manad_nr=5 (maj), även om utbetalningsetiketten säger juni. " +
      "Ignorera raden 'Månadslön'/'Individuellt tillägg' (0601-0630) vid bedömningen — den följer utbetalningsmånaden. Använd OB/bonus/frånvaro-radernas månad. " +
      "För en Quinyx-tidrapport: använd 'Från'-datumet (t.ex. maj 01 → 5). " +
      "ar: årtalet för arbetsmånaden. " +
      "Övriga fält (uteslut det du ej hittar): " +
      "ob50 och ob100 = ANTAL TIMMAR. På lönespecen står OB-raden som 'OB-tillägg 50 % Månlön' och under den t.ex. '1005-1022 90,57x8,62' — " +
      "timmarna är talet EFTER x (8,62), inte priset (90,57) och aldrig multiplikatorn 1,00. Finns flera rader med samma procent: summera timmarna. " +
      "franvaro_tim (summa frånvarotimmar: föräldraledig hel+del, VAB, sjuk), " +
      "franvaro_avdrag_kr (summan av negativa rader för FRÅNVARO i kr som POSITIVT tal – Föräldraledig/Föräldraled, VAB, Sjuk, Tjänstledig, Sen ankomst/tidig hemgång. " +
      "Räkna INTE med raden 'Avdr. semester'/'Avdrag semester' här, den hör till semesterfälten nedan), " +
      "bonus (BELOPP-kolumnen, längst till höger, på raden 'Bonus ARB' eller 'Bonus Kollektivanst' eller 'Bonus' — ta ALDRIG ANTAL- eller PRIS-kolumnen, bara sista talet på raden. Om ingen sådan rad finns: uteslut fältet helt, gissa ALDRIG 0), " +
      "manadslon (kr 'Månadslön ARB'), " +
      "brutto = MÅNADENS bruttolön: talet i parentes efter 'Prel skatt tabell', t.ex. 'Prel skatt tabell (44261,30)' → 44261.30, eller 'Bruttolön mån'. " +
      "ALDRIG värden under SALDON som 'Lön i år', 'Bruttolön total/år' eller 'Skatt i år' – det är årets totaler. " +
      "skatt (kr 'Prel skatt tabell'/'Skatt mån', positivt, MÅNADENS skatt, aldrig 'Skatt i år'), netto (kr 'Din lön'/'DIN LÖN', det stora beloppet högst upp). " +
      "sem_lon_dag (PRIS/á-priset på semesterlöne-raden, t.ex. 'Semesterlön heltid', 'Semesterlön Månlön', 'Semesterlön Månlön >4d' – kr per semesterdag, t.ex. '3450,53x20,00' → 3450.53), " +
      "sem_lon_dagar (ANTALET dagar på semesterlöne-raden, dvs talet efter x i '3450,53x20,00' → 20), " +
      "sem_avdrag_dagar (ANTALET dagar på semesteravdrags-raden, dvs talet efter x i '-1383,17x17,00' → 17), " +
      "sem_saldo_betald (ANTAL dagar på raden 'Betald semester' under rubriken SALDON – heltal, uteslut om raden saknas), " +
      "sem_avdrag_dag (PRIS på semesteravdrags-raden som POSITIVT tal, t.ex. 'Avdrag semester heltid', 'Avdr. semester Heltid ARB' — t.ex. '-1383,17x17,00' → 1383.17). Uteslut båda om raderna saknas. " +
      "Svensk decimalkomma → punkt. Ta bort tusentalsmellanslag.";

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_completion_tokens: 4096,
        reasoning_effort: "low",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Typ: ${kind || "okänd"}\n\nText:\n${text}` },
        ],
      }),
    });
    const groqJson = await groqRes.json();
    if (!groqRes.ok) throw new Error("Groq fel: " + JSON.stringify(groqJson));
    const choice = groqJson?.choices?.[0];
    let content = choice?.message?.content;
    if (typeof content !== "string") content = "";
    if (!content.trim() && choice?.message?.reasoning) content = String(choice.message.reasoning);
    if (!content.trim()) throw new Error("Tomt svar från Groq (finish_reason: " + String(choice?.finish_reason) + ")");

    const cleaned = content.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed: Record<string, unknown>;
    if (cleaned.startsWith("{")) parsed = JSON.parse(cleaned);
    else {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Kunde inte tolka JSON: " + content.substring(0, 200));
      parsed = JSON.parse(m[0]);
    }
    const num = (v: unknown) => {
      if (v === null || v === undefined || v === "") return null;
      const n = parseFloat(String(v).replace(/\s/g, "").replace(/,/g, "."));
      return Number.isFinite(n) ? n : null;
    };

    const out: Record<string, number | null> = {
      manad_nr: parsed.manad_nr != null ? Math.round(Number(parsed.manad_nr)) : null,
      ar: parsed.ar != null ? Math.round(Number(parsed.ar)) : null,
      ob50: num(parsed.ob50),
      ob100: num(parsed.ob100),
      franvaro_tim: num(parsed.franvaro_tim),
      franvaro_avdrag_kr: parsed.franvaro_avdrag_kr != null ? Math.abs(num(parsed.franvaro_avdrag_kr) ?? 0) : null,
      sen_avdrag_kr: null,
      bonus_manad: null,
      bonus: num(parsed.bonus),
      manadslon: num(parsed.manadslon),
      brutto: num(parsed.brutto),
      skatt: parsed.skatt != null ? Math.abs(num(parsed.skatt) ?? 0) : null,
      netto: num(parsed.netto),
      sem_lon_dag: num(parsed.sem_lon_dag),
      sem_saldo_betald: num(parsed.sem_saldo_betald),
      sem_lon_dagar: num(parsed.sem_lon_dagar),
      sem_avdrag_dagar: num(parsed.sem_avdrag_dagar),
      sem_avdrag_dag: parsed.sem_avdrag_dag != null ? Math.abs(num(parsed.sem_avdrag_dag) ?? 0) : null,
    };

    // 3) fasta regler vinner (bara för lönespec)
    const fast = kind === "tidrapport" ? {} : regler(text);
    for (const [k, v] of Object.entries(fast)) if (v != null && Number.isFinite(v)) out[k] = v;

    // 4) rimlighetskontroll
    rimligt(out);

    const svar: Record<string, unknown> = { ...out };
    if (debug) { svar._text = text; svar._ai = parsed; svar._regler = fast; }
    return new Response(JSON.stringify(svar), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as any)?.message ?? err) }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
