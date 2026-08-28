import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function jsonResp(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const WINDOWS = { ACUTE: 7, MID: 14, CHRONIC: 28, LONG: 56 }

const SEUILS = {
  RPE_FATIGUE: 7.5,
  RPE_FATIGUE_SEANCES: 3,
  CHARGE_PROGRESSION: 0.05,
  STAGNATION_SESSIONS: { debutant: 3, intermediaire: 4, avance: 6, expert: 8 } as Record<string, number>,
}

// Niveau & stratégie dérivés des années de pratique — MÊMES seuils que Code.gs
// (getNiveauExperienceGS / getStrategieFromAnnees). Source de vérité : ./Code.gs
function getNiveauExperience(annees: number): string {
  const a = Number(annees) || 0
  if (a <= 3) return 'debutant'
  if (a <= 7) return 'intermediaire'
  if (a <= 12) return 'avance'
  return 'expert'
}
function getStrategieFromAnnees(annees: number): string {
  const niveau = getNiveauExperience(annees)
  if (niveau === 'debutant') return 'Progression linéaire'
  if (niveau === 'intermediaire') return 'Double progression'
  return 'Progression avancée'
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
const rateMap = new Map<string, { n: number; exp: number }>()

function checkRate(ip: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || entry.exp < now) { rateMap.set(ip, { n: 1, exp: now + windowMs }); return true }
  if (entry.n >= max) return false
  entry.n++
  return true
}

// ── Supabase client ───────────────────────────────────────────────────────────
let _sb: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!_sb) _sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  return _sb
}

// ── Crypto / Auth ─────────────────────────────────────────────────────────────
async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashSalted(pwd: string, salt: string): Promise<string> {
  const pepper = Deno.env.get('PEPPER') ?? ''
  return 's2$' + await sha256hex(`${salt}|${pepper}|${pwd}`)
}

// athletes.id est un PK texte non auto-généré → on calcule max(id numérique)+1 (comme Code.gs)
async function nextAthleteId(): Promise<string> {
  const { data } = await sb().from('athletes').select('id')
  let maxId = 0
  for (const r of data || []) { const n = Number(r.id); if (!isNaN(n) && n > maxId) maxId = n }
  return String(maxId + 1)
}

async function verifyPwd(pwd: string, stored: string, salt: string): Promise<{ ok: boolean; upgrade: string | null }> {
  if (!stored) return { ok: false, upgrade: null }
  if (stored.startsWith('s2$')) {
    return { ok: stored === await hashSalted(pwd, salt), upgrade: null }
  }
  if (stored === await sha256hex(pwd)) {
    return { ok: true, upgrade: await hashSalted(pwd, salt) }
  }
  return { ok: false, upgrade: null }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function normDate(d: unknown): string {
  const dt = parseFR(d)
  return dt ? fmtYMD(dt) : String(d ?? '').slice(0, 10)
}

function fmtFR(d: unknown): string {
  const s = String(d ?? '').split('T')[0]
  if (!s || s === 'null' || s === 'undefined') return ''
  if (s.includes('/')) return s
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

function parseFR(d: unknown): Date | null {
  const s = String(d ?? '').trim()
  if (!s) return null
  if (s.includes('/')) {
    const [dd, mm, yyyy] = s.split('/')
    const dt = new Date(Date.UTC(+yyyy, +mm - 1, +dd))
    return isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(s.includes('T') ? s : s + 'T00:00:00Z')
  return isNaN(dt.getTime()) ? null : dt
}

function fmtYMD(d: Date): string { return d.toISOString().slice(0, 10) }

function minus(base: Date, days: number): Date {
  const d = new Date(base); d.setUTCDate(d.getUTCDate() - days); return d
}

function getLundi(d: Date): Date {
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d); r.setUTCDate(d.getUTCDate() + diff); return r
}

function isoWeek(date: Date): string {
  const d = new Date(date); d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7)
  const w1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const wn = 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getUTCDay() + 6) % 7) / 7)
  return `${d.getUTCFullYear()}-W${String(wn).padStart(2, '0')}`
}

function prevIsoWeek(w: string): string {
  const [yr, wStr] = w.split('-W')
  let wn = parseInt(wStr) - 1
  let y = parseInt(yr)
  if (wn < 1) { y--; wn = 52 }
  return `${y}-W${String(wn).padStart(2, '0')}`
}

// ── Computation engines ───────────────────────────────────────────────────────
function computeGlobal(perfs: any[]): any {
  if (!perfs.length) return { source: 'GLOBAL_ENGINE', total_seances: 0, total_series: 0, total_reps: 0, tonnage_total_kg: 0, nb_seances: 0, tonnage_total: 0, mean_rpe: 0, records: {}, records_par_exo: {}, dernieres_seances: [] }

  const datesSet = new Set<string>()
  const records: Record<string, { charge: number; reps: number; volume: number; date: string }> = {}
  let totalTonnage = 0, totalRpe = 0, rpeCount = 0, totalSeries = 0, totalReps = 0
  const seanceMap: Record<string, { date: string; tonnage: number; exercices: Set<string>; muscles: Set<string> }> = {}

  for (const r of perfs) {
    const charge = Number(r.charge) || 0
    const reps = Number(r.reps) || 0
    const tonnage = charge * reps
    totalTonnage += tonnage
    totalSeries++
    totalReps += reps
    if (r.rpe) { totalRpe += Number(r.rpe); rpeCount++ }
    // séances = jours distincts (comme Code.gs seancesSet.add(dateStr))
    datesSet.add(normDate(r.date))

    const exo = r.exercice
    if (exo && (!records[exo] || charge > records[exo].charge || (charge === records[exo].charge && reps > records[exo].reps))) {
      records[exo] = { charge, reps, volume: Number(r.volume) || tonnage, date: fmtFR(r.date) }
    }

    if (!seanceMap[r.seance_id]) seanceMap[r.seance_id] = { date: r.date, tonnage: 0, exercices: new Set(), muscles: new Set() }
    seanceMap[r.seance_id].tonnage += tonnage
    if (exo) seanceMap[r.seance_id].exercices.add(exo)
    if (r.muscle) seanceMap[r.seance_id].muscles.add(r.muscle)
  }

  const dernieres_seances = Object.entries(seanceMap)
    .sort((a, b) => String(b[1].date).localeCompare(String(a[1].date)))
    .slice(0, 3)
    .map(([sid, s]) => ({
      seance_id: sid,
      date: fmtFR(s.date),
      tonnage: Math.round(s.tonnage),
      exercices: [...s.exercices],
      muscles: [...s.muscles],
    }))

  const totalSeances = datesSet.size
  return {
    source: 'GLOBAL_ENGINE',
    total_seances: totalSeances,
    total_series: totalSeries,
    total_reps: totalReps,
    tonnage_total_kg: Math.round(totalTonnage),
    // rétro-compat
    nb_seances: totalSeances,
    tonnage_total: Math.round(totalTonnage),
    mean_rpe: rpeCount ? Math.round(totalRpe / rpeCount * 10) / 10 : 0,
    records,
    records_par_exo: records,
    dernieres_seances,
  }
}

function computeRecent(perfs: any[], now: Date): any {
  const KEY_MAP: Record<string, string> = { ACUTE: 'j7', MID: 'j14', CHRONIC: 'j28', LONG: 'j56' }
  const result: Record<string, any> = {}
  for (const [key, days] of Object.entries(WINDOWS)) {
    const cutoff = fmtYMD(minus(now, days))
    const filtered = perfs.filter(r => normDate(r.date) >= cutoff)
    // séances = nombre de JOURS d'entraînement distincts (comme Code.gs finalizeWindow: w.dates.size)
    const datesSet = new Set(filtered.map(r => normDate(r.date)))
    const seances = datesSet.size
    const tonnage = filtered.reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
    const rpeRows = filtered.filter(r => r.rpe)
    const parMuscle: Record<string, number> = {}
    for (const r of filtered) {
      if (r.muscle) parMuscle[r.muscle] = (parMuscle[r.muscle] || 0) + ((Number(r.charge) || 0) * (Number(r.reps) || 0))
    }
    // tonnage par jour, puis loads sur TOUTE la fenêtre (jours de repos = 0) — comme Code.gs
    const dailyTonnage: Record<string, number> = {}
    for (const r of filtered) {
      const d = normDate(r.date)
      dailyTonnage[d] = (dailyTonnage[d] || 0) + (Number(r.charge) || 0) * (Number(r.reps) || 0)
    }
    const loads: number[] = []
    for (let d = 0; d < days; d++) {
      const day = fmtYMD(minus(now, days - d - 1))
      loads.push(dailyTonnage[day] || 0)
    }
    const mean = loads.reduce((s, v) => s + v, 0) / loads.length
    const std = Math.sqrt(loads.reduce((s, v) => s + (v - mean) ** 2, 0) / loads.length)
    const monotonie = (std > 0 && seances > 0) ? Math.round(mean / std * 100) / 100 : null
    const strain = (monotonie !== null) ? Math.round(mean * days * monotonie) : null
    result[KEY_MAP[key]] = {
      seances,
      tonnage: Math.round(tonnage / 100) / 10,
      tonnage_kg: Math.round(tonnage),
      rpe_moyen: rpeRows.length ? Math.round(rpeRows.reduce((s, r) => s + Number(r.rpe), 0) / rpeRows.length * 10) / 10 : null,
      volume_par_muscle: parMuscle,
      frequence_semaine: Math.round(seances / (days / 7) * 10) / 10,
      monotonie,
      strain,
    }
  }
  return result
}

function computeComparison(perfs: any[], now: Date): any {
  const c7  = fmtYMD(minus(now, 7))
  const c14 = fmtYMD(minus(now, 14))
  const c28 = fmtYMD(minus(now, 28))
  const c56 = fmtYMD(minus(now, 56))

  const calcWindow = (rows: any[]) => {
    const tonnage = rows.reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
    const rpeRows = rows.filter(r => r.rpe)
    const maxChargePerExo: Record<string, number> = {}
    for (const r of rows) if (r.exercice) maxChargePerExo[r.exercice] = Math.max(maxChargePerExo[r.exercice] || 0, Number(r.charge) || 0)
    return { seances: new Set(rows.map(r => normDate(r.date))).size, tonnage: Math.round(tonnage), rpe_moyen: rpeRows.length ? Math.round(rpeRows.reduce((s, r) => s + Number(r.rpe), 0) / rpeRows.length * 10) / 10 : null, maxCharge: maxChargePerExo }
  }

  const j7w  = calcWindow(perfs.filter(r => normDate(r.date) >= c7))
  const j7pw = calcWindow(perfs.filter(r => { const d = normDate(r.date); return d >= c14 && d < c7 }))
  const j28w = calcWindow(perfs.filter(r => normDate(r.date) >= c28))
  const j28pw = calcWindow(perfs.filter(r => { const d = normDate(r.date); return d >= c56 && d < c28 }))

  const evol = (a: number, b: number) => b ? Math.round((a - b) / b * 100) : null

  // On ne compare QUE les exercices réellement faits cette semaine (curr > 0).
  // Un exercice non fait cette semaine n'est PAS une "baisse" — il n'est juste pas au programme.
  // (Avant : l'union des 2 fenêtres faisait apparaître curr=0 → -100% → faux "en baisse".)
  const chargeDetails = Object.keys(j7w.maxCharge).map(exo => {
    const curr = j7w.maxCharge[exo] || 0
    if (!curr) return null
    const prev = j7pw.maxCharge[exo] || 0
    const pct = prev > 0 ? Math.round((curr - prev) / prev * 100) : null   // prev=0 → nouvel exo cette semaine → '—' (ni hausse ni baisse)
    return { exercice: exo, charge_actuelle: curr, charge_prec: prev, up: pct != null && pct > 3, down: pct != null && pct < -3, variation: pct != null ? (pct > 0 ? `+${pct}%` : `${pct}%`) : '—' }
  }).filter(Boolean)

  return {
    j7_vs_j7prec: {
      tonnage: { j7: j7w.tonnage, j7_prec: j7pw.tonnage, evol_pct: evol(j7w.tonnage, j7pw.tonnage) },
      seances: { j7: j7w.seances, j7_prec: j7pw.seances },
      rpe: { j7: j7w.rpe_moyen, j7_prec: j7pw.rpe_moyen },
      charge_details: chargeDetails,
    },
    j28_vs_j28prec: {
      tonnage: { j28: j28w.tonnage, j28_prec: j28pw.tonnage, evol_pct: evol(j28w.tonnage, j28pw.tonnage) },
      seances: { j28: j28w.seances, j28_prec: j28pw.seances },
      rpe: { j28: j28w.rpe_moyen, j28_prec: j28pw.rpe_moyen },
      charge: { evol_pct: evol(j28w.tonnage, j28pw.tonnage) },
    },
  }
}

function computeStreak(dates: string[], now: Date): number {
  if (!dates.length) return 0
  const weeks = new Set(dates.map(d => { const dt = parseFR(d) || new Date(d + 'T00:00:00Z'); return isoWeek(dt) }))
  let streak = 0, w = isoWeek(now)
  for (let i = 0; i < 52; i++) {
    if (weeks.has(w)) { streak++; w = prevIsoWeek(w) } else break
  }
  return streak
}

// (Ancien computeACWR backend supprimé — Phase 2B. Remplacé par la chaîne ACWR centrale
//  ci-dessous : calculerChargeSport('muscu') → calculerACWR. Correctif 0→null intégré.)

// ============================================================================
// MOTEUR ACWR CENTRAL (Phase 2B) — chaîne multisport UNIQUE
//   calculerChargeSport → normaliserCharge → calculerACWR → fiabiliteACWR → interpreterACWR
// La FORMULE est inchangée : aiguë(Σ7 j) / (chronique Σ28 j / 4).
// Le problème vacances/reprise/historique est traité par la FIABILITÉ, pas la formule.
// Ajouter un sport = ajouter un cas dans calculerChargeSport ; le reste ne bouge pas.
// ============================================================================

// Seuils ACWR — SOURCE UNIQUE (utilisée par interpreterACWR ET evaluerEtatAthlete).
const SEUILS_ACWR = { BAS: 0.8, OPT_MAX: 1.3, HAUT: 1.5 }
// Jours actifs minimum sur 28 j pour une chronique fiable. Décision métier : 6.
// En-dessous de 6 jours actifs, la chronique (÷4) repose sur trop peu de séances réelles
// et un pic isolé fausse le ratio → ACWR non interprétable. Critère de FIABILITÉ
// uniquement — jamais une alerte ; une faible fréquence n'est pas un problème en soi.
const ACWR_MIN_JOURS_ACTIFS_28 = 6

// A. Adaptateur de charge PAR SPORT → série journalière commune {isoDate: charge}.
function calculerChargeSport(sport: string, rows: any[]): { chargeParJour: Record<string, number>; premiere: string | null } {
  const chargeParJour: Record<string, number> = {}
  let premiere: string | null = null
  const add = (d: string | null, v: number) => {
    if (!d || !(v > 0)) return
    chargeParJour[d] = (chargeParJour[d] || 0) + v
    if (!premiere || d < premiere) premiere = d
  }
  if (sport === 'muscu') {
    // Charge muscu = TONNAGE (charge × reps) agrégé par jour.
    for (const r of rows) add(normDate(r.date), (Number(r.charge) || 0) * (Number(r.reps) || 0))
  } else if (sport === 'foot') {
    // Charge foot = charge_interne (sRPE-like) déjà calculée, table indicateurs.
    for (const r of rows) if (String(r.cle) === 'charge_interne') add(normDate(r.date), Number(r.valeur) || 0)
  } else {
    // Sports futurs (cyclisme : puissance/durée ; natation : distance/sRPE…) : adaptateur
    // à fournir. Par défaut on prend une charge déjà normalisée {date, charge} si présente,
    // sinon aucune charge → ACWR non interprétable (pas d'alerte).
    for (const r of rows) add(normDate(r.date), Number(r.charge) || 0)
  }
  return { chargeParJour, premiere }
}

// B. Normalisation — identité aujourd'hui (point d'extension si un sport livrait un autre format).
function normaliserCharge(x: { chargeParJour: Record<string, number>; premiere: string | null }) { return x }

// C. Ratio ACWR couplé + nb de jours actifs sur 28 j (pour la fiabilité chronique).
function calculerACWR(chargeParJour: Record<string, number>, now: Date): { ratio: number | null; aigue: number; chronique: number; joursActifs28: number } {
  let aigue = 0, somme28 = 0, joursActifs28 = 0
  for (let d = 0; d < 28; d++) {
    const v = chargeParJour[fmtYMD(minus(now, d))] || 0
    somme28 += v
    if (v > 0) joursActifs28++
    if (d < 7) aigue += v
  }
  const chronique = somme28 / 4
  return { ratio: chronique > 0 ? Math.round(aigue / chronique * 100) / 100 : null, aigue, chronique, joursActifs28 }
}

// Garde-fou FIABILITÉ centralisé (une seule copie) : historique < 28 j, reprise vacances < 28 j,
// OU chronique trouée (jours actifs insuffisants). Retourne false = ACWR non interprétable.
function fiabiliteACWR(premiere: string | null, ctxObj: any, now: Date, joursActifs28: number): boolean {
  const histo = _joursDepuis(premiere, now)
  if (histo == null || histo < 28) return false
  if (joursActifs28 < ACWR_MIN_JOURS_ACTIFS_28) return false
  if (ctxObj && String(ctxObj.etat || '') === 'retour_vacances') {
    const rd = _joursDepuis(ctxObj.date_debut, now)
    if (rd != null && rd >= 0 && rd < 28) return false
  }
  return true
}

// D. Interprétation catégorielle — NE renvoie jamais une couleur d'athlète.
function interpreterACWR(ratio: number | null, fiable: boolean): string {
  if (!fiable || ratio == null) return 'non_interpretable'
  if (ratio > SEUILS_ACWR.HAUT) return 'eleve'
  if (ratio > SEUILS_ACWR.OPT_MAX) return 'vigilance'
  if (ratio < SEUILS_ACWR.BAS) return 'sous_charge'
  return 'normal'
}

// ── Alertes ───────────────────────────────────────────────────────────────────
// Porté fidèlement de Code.gs calculerAlertes : champs { type, severite, message }
function calculerAlertes(perfs: any[], _athleteId: string, anneesPratique: number, enPause: boolean): any[] {
  const alertes: any[] = []
  if (!perfs.length) return alertes
  const now = new Date()
  const sept = fmtYMD(minus(now, 7))
  const troisSem = fmtYMD(minus(now, 21))

  const datesRecentes: Record<string, boolean> = {}
  let rpeTotal7j = 0, rpeCount7j = 0
  const chg7Sum: Record<string, number> = {}, chg7Cnt: Record<string, number> = {}
  const chgPrecSum: Record<string, number> = {}, chgPrecCnt: Record<string, number> = {}
  const progressionParExo: Record<string, Record<string, any>> = {}
  const rpeParExo: Record<string, Record<string, any>> = {}

  for (const row of perfs) {
    const dIso = normDate(row.date); if (!dIso) continue
    const exo = String(row.exercice || '')
    const charge = Number(row.charge) || 0
    const reps = Number(row.reps) || 0
    const rpe = Number(row.rpe) || 0

    if (dIso >= sept) {
      datesRecentes[dIso] = true
      if (rpe > 0) { rpeTotal7j += rpe; rpeCount7j++ }
      if (charge > 0) { chg7Sum[exo] = (chg7Sum[exo] || 0) + charge; chg7Cnt[exo] = (chg7Cnt[exo] || 0) + 1 }
    } else if (dIso >= troisSem) {
      if (charge > 0) { chgPrecSum[exo] = (chgPrecSum[exo] || 0) + charge; chgPrecCnt[exo] = (chgPrecCnt[exo] || 0) + 1 }
    }

    if (!progressionParExo[exo]) progressionParExo[exo] = {}
    const p = progressionParExo[exo][dIso]
    if (!p || charge > p.charge || (charge === p.charge && reps > p.reps)) progressionParExo[exo][dIso] = { date: dIso, charge, reps }

    if (rpe > 0 && charge > 0) {
      if (!rpeParExo[exo]) rpeParExo[exo] = {}
      const rp = rpeParExo[exo][dIso]
      if (!rp || charge > rp.charge) rpeParExo[exo][dIso] = { date: dIso, charge, rpe }
    }
  }

  if (Object.keys(datesRecentes).length === 0 && !enPause)
    alertes.push({ type: 'irregularite', severite: 'haute', message: 'Aucune séance depuis 7 jours ou plus' })

  if (rpeCount7j > 0) {
    const rpeMoyen = rpeTotal7j / rpeCount7j
    const pctParExo: number[] = []
    for (const exo of Object.keys(chg7Sum)) {
      if (chgPrecCnt[exo] > 0) {
        const avant = chgPrecSum[exo] / chgPrecCnt[exo]
        const apres = chg7Sum[exo] / chg7Cnt[exo]
        if (avant > 0) pctParExo.push((apres - avant) / avant * 100)
      }
    }
    if (pctParExo.length > 0) {
      const chargeEvol = Math.round(pctParExo.reduce((a, b) => a + b, 0) / pctParExo.length)
      if (rpeMoyen > 8.5 && chargeEvol < -5)
        alertes.push({ type: 'fatigue', severite: 'haute', message: `RPE moyen élevé (${Math.round(rpeMoyen * 10) / 10}) combiné à une baisse de charge de ${chargeEvol}%` })
    }
  }

  const niveau = getNiveauExperience(anneesPratique)
  const seuil = SEUILS.STAGNATION_SESSIONS[niveau]
  for (const exo of Object.keys(progressionParExo)) {
    const entries = (Object.values(progressionParExo[exo]) as any[]).sort((a, b) => a.date.localeCompare(b.date))
    if (entries.length < seuil) continue
    const derniersN = entries.slice(-seuil)
    let meilleurAvant: any = null, progresse = false
    for (const en of derniersN) {
      if (meilleurAvant && (en.charge > meilleurAvant.charge || (en.charge === meilleurAvant.charge && en.reps > meilleurAvant.reps))) progresse = true
      if (!meilleurAvant || en.charge > meilleurAvant.charge || (en.charge === meilleurAvant.charge && en.reps > meilleurAvant.reps)) meilleurAvant = en
    }
    if (!progresse)
      alertes.push({ type: 'stagnation', severite: 'moyenne', message: `${exo} : aucun progrès depuis ${seuil} séances (niveau ${niveau})` })
  }

  for (const exo of Object.keys(rpeParExo)) {
    const sessions = (Object.values(rpeParExo[exo]) as any[]).sort((a, b) => a.date.localeCompare(b.date))
    if (sessions.length < 4) continue
    const last4 = sessions.slice(-4)
    const rpeAvant = (last4[0].rpe + last4[1].rpe) / 2
    const rpeApres = (last4[2].rpe + last4[3].rpe) / 2
    const chgAvant = (last4[0].charge + last4[1].charge) / 2
    const chgApres = (last4[2].charge + last4[3].charge) / 2
    const rpeHausse = rpeApres - rpeAvant
    const chgPct = chgAvant > 0 ? (chgApres - chgAvant) / chgAvant * 100 : 0
    if (rpeHausse >= 1.0 && chgPct < 3)
      alertes.push({ type: 'fatigue_rpe', severite: 'moyenne', message: `${exo} : RPE en hausse de +${Math.round(rpeHausse * 10) / 10} pt (moy. ${Math.round(rpeApres * 10) / 10}) sans progression de charge — fatigue latente ?` })
  }

  return alertes
}

// ── Cardio helper ─────────────────────────────────────────────────────────────
function _aggCardioWindow(sessions: any[], now: Date, days: number): any {
  const cutoff = fmtYMD(minus(now, days))
  const ws = sessions.filter((s: any) => normDate(s.date) >= cutoff)
  let distance = 0, duree = 0, calories = 0, pas = 0
  const par_type: Record<string, number> = {}
  for (const s of ws) {
    const ind = s.indicateurs
    if (ind.distance) distance += Number(ind.distance) || 0
    if (ind.duree) duree += Number(ind.duree) || 0
    if (ind.calories) calories += Number(ind.calories) || 0
    if (ind.pas) pas += Number(ind.pas) || 0
    const t = ind.type_cardio || 'autre'
    par_type[t] = (par_type[t] || 0) + 1
  }
  let charge = 0
  for (const s of ws) { const ind = s.indicateurs; if (ind.charge_interne) charge += Number(ind.charge_interne) || 0 }
  return {
    sessions: ws.length,
    distance: distance > 0 ? Math.round(distance * 10) / 10 : null,
    duree: duree > 0 ? Math.round(duree) : null,
    calories: calories > 0 ? Math.round(calories) : null,
    charge: charge > 0 ? Math.round(charge) : null,
    pas: pas > 0 ? Math.round(pas) : null,
    par_type,
  }
}

// Historique cardio : les valeurs viennent d'une colonne texte → convertir en nombres
// (sauf type_cardio) sinon le front concatène les chaînes (0 + "60" + "30" = "06030")
function _cardioNumify(ind: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(ind)) {
    if (k === 'type_cardio') { out[k] = String(v ?? '') ; continue }
    out[k] = (v === '' || v == null) ? null : (Number(v) || 0)
  }
  return out
}

// Champs cardio "plats" envoyés par le front → lignes Indicateurs (comme Code.gs saveCardio)
function _buildCardioRows(body: any, athlete_id: string, sid: string, date: string): any[] {
  const rows: any[] = []
  const addNum = (cle: string, val: unknown, unite = '') => {
    const n = Number(val)
    if (val === '' || val == null || isNaN(n) || n === 0) return
    rows.push({ date, athlete_id, seance_id: sid, cle, valeur: String(n), unite, source: 'saisie' })
  }
  const addStr = (cle: string, val: unknown) => {
    if (val === '' || val == null) return
    rows.push({ date, athlete_id, seance_id: sid, cle, valeur: String(val), unite: '', source: 'saisie' })
  }
  addStr('type_cardio', body.type_cardio)
  addNum('duree', body.duree, 'min')
  addNum('distance', body.distance, 'km')
  addNum('vitesse_moy', body.vitesse_moy, 'km/h')
  addNum('inclinaison', body.inclinaison, '%')
  addNum('puissance_moy', body.puissance_moy, 'W')
  addNum('cadence', body.cadence, 'rpm')
  addNum('pas', body.pas, 'pas')
  addNum('fc_moy', body.fc_moy, 'bpm')
  addNum('calories', body.calories, 'kcal')
  const dureeN = Number(body.duree), rpeN = Number(body.rpe)
  if (dureeN && rpeN) {
    addNum('rpe', body.rpe, '1-10')
    rows.push({ date, athlete_id, seance_id: sid, cle: 'charge_interne', valeur: String(dureeN * rpeN), unite: 'UA', source: 'calculé' })
  }
  return rows
}

async function buildCardioAll(athleteId: string): Promise<any> {
  const { data: rows } = await sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'cardio_%').order('date', { ascending: false })
  if (!rows?.length) return { windows: { 7: { sessions: 0, par_type: {} }, 30: { sessions: 0, par_type: {} }, 90: { sessions: 0, par_type: {} }, 180: { sessions: 0, par_type: {} } }, history: [] }

  const now = new Date()
  const seanceMap: Record<string, any> = {}
  for (const r of rows) {
    if (!seanceMap[r.seance_id]) seanceMap[r.seance_id] = { seance_id: r.seance_id, date: r.date, indicateurs: {} }
    seanceMap[r.seance_id].indicateurs[r.cle] = r.valeur
  }
  const sessions = Object.values(seanceMap).sort((a: any, b: any) => normDate(b.date).localeCompare(normDate(a.date)))
  // history: dates ISO, valeurs numériques (colonne texte → éviter la concaténation côté front)
  const history = sessions.map((s: any) => ({ sid: s.seance_id, seance_id: s.seance_id, date: normDate(s.date), ..._cardioNumify(s.indicateurs) }))
  return {
    windows: { 7: _aggCardioWindow(sessions, now, 7), 30: _aggCardioWindow(sessions, now, 30), 90: _aggCardioWindow(sessions, now, 90), 180: _aggCardioWindow(sessions, now, 180) },
    history,
  }
}

// ── Progression par exo ───────────────────────────────────────────────────────
function buildProgressionParExo(perfs: any[]): Record<string, any[]> {
  // 1 point par DATE (meilleure série du jour), 8 plus récentes — comme Code.gs (évite les doublons)
  const byExo: Record<string, Record<string, any>> = {}
  for (const r of perfs) {
    const exo = r.exercice; if (!exo) continue
    const dmy = fmtFR(r.date)
    const charge = Number(r.charge) || 0, reps = Number(r.reps) || 0
    if (!byExo[exo]) byExo[exo] = {}
    const cur = byExo[exo][dmy]
    if (!cur || charge > cur.charge || (charge === cur.charge && reps > cur.reps)) {
      // le front lit p.seance (p.seance.substring(...)) → indispensable
      byExo[exo][dmy] = { date: dmy, seance: String(r.seance_id || ''), charge, reps, volume: charge * reps }
    }
  }
  const out: Record<string, any[]> = {}
  for (const exo of Object.keys(byExo)) {
    out[exo] = Object.values(byExo[exo]).sort((a, b) => (parseFR(b.date)?.getTime() || 0) - (parseFR(a.date)?.getTime() || 0)).slice(0, 8)
  }
  return out
}

function buildVolumeSemaineHisto(perfs: any[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const p of perfs) {
    const d = parseFR(p.date) || new Date(String(p.date) + 'T00:00:00Z')
    const w = isoWeek(d)
    r[w] = (r[w] || 0) + (Number(p.charge) || 0) * (Number(p.reps) || 0)
  }
  return r
}

function buildVolumeParJour(perfs: any[]): Record<string, number> {
  // clés ISO yyyy-mm-dd (comme Code.gs volumeParJour) → heatmap d'activité (front)
  const r: Record<string, number> = {}
  for (const p of perfs) {
    const dIso = normDate(p.date); if (!dIso) continue
    r[dIso] = (r[dIso] || 0) + (Number(p.charge) || 0) * (Number(p.reps) || 0)
  }
  return r
}

// ── GET handlers ──────────────────────────────────────────────────────────────
async function handleLogin(params: URLSearchParams): Promise<Response> {
  const login = params.get('login')?.trim()
  const pwd = params.get('password')?.trim()
  if (!login || !pwd) return jsonResp({ erreur: 'Paramètres manquants' })

  const { data: ath } = await sb().from('athletes').select('*').eq('login', login).single()
  if (!ath) return jsonResp({ erreur: 'Identifiants incorrects' })

  const { ok, upgrade } = await verifyPwd(pwd, ath.password_hash || '', ath.login)
  if (!ok) return jsonResp({ erreur: 'Identifiants incorrects', error: 'Identifiants incorrects' })
  if (upgrade) await sb().from('athletes').update({ password_hash: upgrade }).eq('id', ath.id)

  // objectif (chaîne) + poids courant depuis la table objectif (comme Code.gs athleteFromRow)
  const { data: objRow } = await sb().from('objectif').select('*').eq('athlete_id', ath.id).limit(1)
  const obj = objRow?.[0]
  const poids = (ath.poids != null && ath.poids !== '') ? Number(ath.poids)
    : (obj?.poids_kg != null && obj.poids_kg !== '') ? Number(obj.poids_kg) : null

  // Stratégie de surcharge progressive : si vide en base (ex. migration), on la
  // recalcule depuis les années de pratique (muscu uniquement) — auto-réparation.
  const sportL = ath.sport || 'muscu'
  const strategieL = ath.strategie || (sportL === 'muscu' ? getStrategieFromAnnees(Number(ath.annees) || 0) : '')

  return jsonResp({ success: true, athlete: {
    athlete_id: ath.id,
    nom: ath.nom,
    sport: sportL,
    coach_id: ath.coach_id,
    strategie: strategieL,
    objectif: obj?.objectif ?? strategieL ?? '',
    strategie_progression: strategieL || 'Progression linéaire',
    annees_pratique: Number(ath.annees) || 0,
    poids,
    taille: (ath.taille != null && ath.taille !== '') ? Number(ath.taille) : null,
    ddn: ath.ddn ? fmtFR(ath.ddn) : '',
  }})
}

async function handleRegister(params: URLSearchParams): Promise<Response> {
  const login = params.get('login')?.trim()
  const pwd = params.get('password')?.trim()
  const nom = (params.get('prenom') || params.get('nom') || login)?.trim()
  const ddn = params.get('ddn') || null
  const taille = params.get('taille') || null
  const annees = params.get('annees') || '0'
  const sport = params.get('sport') || 'muscu'
  if (!login || !pwd) return jsonResp({ erreur: 'Paramètres manquants' })

  const { data: existing } = await sb().from('athletes').select('id').eq('login', login).single()
  if (existing) return jsonResp({ erreur: 'Login déjà utilisé', message: 'Login déjà utilisé' })

  const hash = await hashSalted(pwd, login)
  const newId = await nextAthleteId()
  const { data, error } = await sb().from('athletes').insert({ id: newId, login, nom, password_hash: hash, sport, ddn, taille, annees: Number(annees) || 0 }).select().single()
  if (error) return jsonResp({ erreur: error.message, message: error.message })
  return jsonResp({ success: true, athlete: {
    athlete_id: data.id,
    nom: data.nom,
    sport: data.sport || 'muscu',
    coach_id: null,
    strategie: '',
    objectif: '',
    strategie_progression: '',
    annees_pratique: Number(annees) || 0,
  }})
}

async function handleGetAppData(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')?.trim()
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })

  const now = new Date()
  const lundi = getLundi(now)

  const [
    { data: perfsAll },
    { data: athData },
    { data: progRows },
    { data: poidsRows },
    { data: beRows },
    { data: volObtiRows },
    { data: contexteRows },
    { data: pauseRows },
    { data: cardioRows },
    { data: objectifRows },
    { data: pasJourRows },
  ] = await Promise.all([
    sb().from('performances').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
    sb().from('athletes').select('*').eq('id', athleteId).single(),
    sb().from('programme').select('*').eq('athlete_id', athleteId).order('groupe_id').order('id'),
    sb().from('poids_historique').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(30),
    sb().from('bien_etre').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(30),
    sb().from('volume_obti').select('*'),
    sb().from('contexte_athlete').select('*').eq('athlete_id', athleteId).order('date_debut', { ascending: false }),
    sb().from('indicateurs').select('*').eq('athlete_id', athleteId).eq('cle', 'pause').order('date', { ascending: false }).limit(1),
    sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'cardio_%').order('date', { ascending: false }),
    sb().from('objectif').select('*').eq('athlete_id', athleteId).limit(1),
    sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'pasjour_%').order('date', { ascending: false }),
  ])

  const perfs = perfsAll || []
  const sport = athData?.sport || 'muscu'
  // pause active = aujourd'hui dans [debut, fin] (comme Code.gs athleteEnPause)
  const pauseRow = pauseRows?.[0]
  let enPause = false
  let pauseObj: any = null
  if (pauseRow && pauseRow.valeur && pauseRow.valeur !== 'fin') {
    const debut = normDate(pauseRow.valeur) || null
    const fin = pauseRow.unite ? normDate(pauseRow.unite) : null
    const today0 = fmtYMD(now)
    if ((!debut || today0 >= debut) && (!fin || today0 <= fin)) {
      enPause = true
      pauseObj = { debut, fin }
    }
  }

  const globalData = computeGlobal(perfs)
  const recentData = computeRecent(perfs, now)
  const comparisonData = computeComparison(perfs, now)

  const dates = [...new Set(perfs.map(r => normDate(r.date)))].sort()
  const dernierDate = dates[dates.length - 1]
  // ACWR — chaîne CENTRALE multisport (source unique).
  const chSportA = sport === 'muscu' ? normaliserCharge(calculerChargeSport('muscu', perfs)) : { chargeParJour: {}, premiere: null }
  const acwrCalcA = calculerACWR(chSportA.chargeParJour, now)
  const acwr = sport === 'muscu' ? acwrCalcA.ratio : null

  const c7 = fmtYMD(minus(now, 7))
  const tonnage7 = perfs.filter(r => normDate(r.date) >= c7).reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)

  const lundiStr = fmtYMD(lundi)
  const perfsWeek = perfs.filter(r => normDate(r.date) >= lundiStr)
  const seriesParMuscle: Record<string, number> = {}
  for (const r of perfsWeek) if (r.muscle) seriesParMuscle[r.muscle] = (seriesParMuscle[r.muscle] || 0) + 1

  // prochaine séance = prochaine séance non faite du programme cette semaine (comme Code.gs getProchaineSeance)
  const prochaineSeance = (() => {
    const faitesSemaine = new Set<string>()
    for (const r of perfs) if (normDate(r.date) >= lundiStr) faitesSemaine.add(String(r.seance_id).toLowerCase())
    const ordre: string[] = []
    const vues = new Set<string>()
    for (const r of (progRows || [])) { const sid = String(r.seance_id); if (!vues.has(sid)) { ordre.push(sid); vues.add(sid) } }
    if (ordre.length === 0) return null
    let lastDone = -1
    for (let k = ordre.length - 1; k >= 0; k--) { if (faitesSemaine.has(ordre[k].toLowerCase())) { lastDone = k; break } }
    if (lastDone === -1) return ordre[0]
    for (let k = 1; k <= ordre.length; k++) { const idx = (lastDone + k) % ordre.length; if (!faitesSemaine.has(ordre[idx].toLowerCase())) return ordre[idx] }
    return null
  })()

  // muscle en retard = sur 4 SEMAINES, plus grand retard, faites < min×4 (comme Code.gs computeMuscleRetard)
  const c28mr = fmtYMD(minus(now, 28))
  const seriesParMuscle4: Record<string, number> = {}
  for (const r of perfs) {
    if (normDate(r.date) >= c28mr && r.muscle) seriesParMuscle4[r.muscle] = (seriesParMuscle4[r.muscle] || 0) + 1
  }
  let muscleRetard: string | null = null
  let muscleRetardObj: any = null
  let maxRetard = 0
  for (const v of (volObtiRows || [])) {
    const min4 = (Number(v.series_min_semaine) || 0) * 4
    const opt4 = (Number(v.series_opt_semaine) || 0) * 4
    const faites = seriesParMuscle4[v.muscle] || 0
    const retard = opt4 - faites
    if (retard > maxRetard && faites < min4) {
      maxRetard = retard
      muscleRetard = v.muscle
      muscleRetardObj = { muscle: v.muscle, series_faites: Math.round(faites * 10) / 10, series_min: min4, series_optimale: opt4 }
    }
  }

  const alertes = calculerAlertes(perfs, athleteId, Number(athData?.annees) || 0, enPause)

  // le front indexe l'agenda et la vérification par clé JJ/MM/AAAA
  const datesSeances: Record<string, string> = {}
  for (const d of dates) {
    const row = perfs.find(r => normDate(r.date) === d)
    if (row) datesSeances[fmtFR(d)] = row.seance_id
  }

  // Build derniere_seance as object
  let derniereSeanceObj: any = null
  if (dernierDate) {
    const dernPerfs = perfs.filter(r => normDate(r.date) === dernierDate)
    const dernSid = dernPerfs[0]?.seance_id || ''
    const rpeRowsDern = dernPerfs.filter(r => r.rpe)
    const uniqueExos = new Set(dernPerfs.map(r => r.exercice).filter(Boolean))
    const dernTonnage = dernPerfs.reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
    derniereSeanceObj = {
      date: fmtFR(dernierDate),
      seance_id: dernSid,
      nb_exercices: uniqueExos.size,
      nb_series: dernPerfs.length,
      rpe_moyen: rpeRowsDern.length ? Math.round(rpeRowsDern.reduce((s, r) => s + Number(r.rpe), 0) / rpeRowsDern.length * 10) / 10 : null,
      tonnage_kg: Math.round(dernTonnage),
      tonnage_t: Math.round(dernTonnage / 100) / 10,
    }
  }

  // regularite as object
  const seancesJ7 = recentData.j7?.seances ?? 0
  // séances de la SEMAINE CALENDAIRE (depuis lundi) → l'anneau d'objectif se remet à zéro chaque lundi
  const seancesCetteSemaine = new Set(perfsWeek.map(r => normDate(r.date))).size
  // séances prévues/semaine : table objectif, colonne seances_semaine
  const seancesPrevues = Number(objectifRows?.[0]?.seances_semaine) || 0
  const streakSemaines = computeStreak(dates, now)
  const regulariteObj = {
    seances_j7: seancesJ7,
    seances_semaine: seancesCetteSemaine,
    seances_prevues: seancesPrevues,
    streak: streakSemaines,
  }

  // tonnage as object with j7 + evol_pct from comparison (in tonnes, matching Code.gs finalizeWindow)
  const tonnageEvol = comparisonData.j7_vs_j7prec?.tonnage?.evol_pct ?? null
  const j7PrecKg = comparisonData.j7_vs_j7prec?.tonnage?.j7_prec ?? null
  const tonnageObj = {
    j7: Math.round(tonnage7 / 100) / 10,
    evol_pct: tonnageEvol,
    j7_prec: j7PrecKg != null ? Math.round(j7PrecKg / 100) / 10 : null,
  }

  // records_30j: count exercises that have their best record set within 30 days
  const c30 = fmtYMD(minus(now, 30))
  const records30j = Object.values(globalData.records || {}).filter((rec: any) => {
    const d = parseFR(rec.date)
    return d ? fmtYMD(d) >= c30 : false
  }).length

  // Enrich globalData
  const enrichedGlobal = { ...globalData, muscle_retard: muscleRetardObj, records_30j: records30j }

  const poids = (poidsRows || []).map(r => ({ date: fmtFR(r.date), poids: Number(r.poids) }))

  const programme = (progRows || []).map(r => ({
    id: r.id, row_index: r.id, athlete_id: r.athlete_id, seance_id: r.seance_id,
    exercice: r.exercice, series_prevues: r.series_prevues, reps_mini: r.reps_mini,
    reps_max: r.reps_max, repos_sec: r.repos_sec, groupe_id: r.groupe_id,
  }))

  const bien_etre = (beRows || []).map(r => ({
    date: fmtFR(r.date), sommeil: r.sommeil, energie: r.energie,
    fatigue: r.fatigue_musculaire, douleur: r.douleur,
    zone: r.zone_douloureuse, ressenti: r.ressenti_global, note: r.note,
  }))

  // contexte actif : table contexte_athlete, période contenant aujourd'hui, la plus récente (comme Code.gs lireContexteActif)
  const contexte = (() => {
    if (!contexteRows?.length) return null
    const today0 = parseFR(fmtYMD(now))!  // aujourd'hui à minuit UTC
    let best: any = null, bestDebut: Date | null = null
    for (const r of contexteRows) {
      const etat = String(r.etat || '').trim()
      if (!etat) continue
      const d = r.date_debut ? (parseFR(r.date_debut) ?? new Date(r.date_debut + 'T00:00:00Z')) : null
      const f = r.date_fin ? (parseFR(r.date_fin) ?? new Date(r.date_fin + 'T00:00:00Z')) : null
      if (d && today0 < d) continue   // pas encore commencé
      if (f && today0 > f) continue   // déjà terminé
      if (!bestDebut || (d && d > bestDebut)) { bestDebut = d; best = r }
    }
    if (!best) return null
    let joursRestants: number | null = null
    if (best.date_fin) {
      const ff = parseFR(best.date_fin) ?? new Date(best.date_fin + 'T00:00:00Z')
      if (ff) joursRestants = Math.max(0, Math.round((ff.getTime() - today0.getTime()) / 86_400_000))
    }
    return {
      id: best.id,
      etat: best.etat,
      description: best.note || '',
      note: best.note || '',
      date_debut: fmtFR(best.date_debut),
      date_fin: best.date_fin ? fmtFR(best.date_fin) : null,
      source: best.source || '',
      jours_restants: joursRestants,
    }
  })()

  let cardio = null
  if (sport === 'muscu' && cardioRows?.length) {
    const seanceMap: Record<string, any> = {}
    for (const r of cardioRows) {
      if (!seanceMap[r.seance_id]) seanceMap[r.seance_id] = { seance_id: r.seance_id, date: r.date, indicateurs: {} }
      seanceMap[r.seance_id].indicateurs[r.cle] = r.valeur
    }
    const sessions = Object.values(seanceMap).sort((a: any, b: any) => normDate(b.date).localeCompare(normDate(a.date)))
    // history: dates ISO (comparaison JS côté navigateur), valeurs numériques, sid pour édit/suppr
    const history = sessions.map((s: any) => ({ sid: s.seance_id, seance_id: s.seance_id, date: normDate(s.date), ..._cardioNumify(s.indicateurs) }))
    cardio = {
      windows: { 7: _aggCardioWindow(sessions, now, 7), 30: _aggCardioWindow(sessions, now, 30), 90: _aggCardioWindow(sessions, now, 90), 180: _aggCardioWindow(sessions, now, 180) },
      history,
    }
  }
  // Pas quotidiens ambiants (Fitbit) : [{date, pas}] triés récent → ancien.
  const pas_quotidiens = (pasJourRows || [])
    .filter((r: any) => r.cle === 'pas')
    .map((r: any) => ({ date: normDate(r.date), pas: Number(r.valeur) || 0 }))
    .filter((x: any) => x.pas > 0)

  let volume_obti: any[] = []
  if (sport === 'muscu' && volObtiRows?.length) {
    volume_obti = volObtiRows.map(v => ({
      muscle: v.muscle, series_semaine: seriesParMuscle[v.muscle] || 0,
      series_min: v.series_min_semaine, series_opt: v.series_opt_semaine,
    }))
  }

  // >>> MOTEUR CENTRAL (muscu) — Phase 2 : la muscu consomme le MÊME moteur que le
  // foot pour l'état/dispo/risque/récup. Les anciens interpréteurs front
  // (computeMarqueursCoach, buildRecupFromData) sont CONSERVÉS pour comparaison ;
  // ici on ajoute juste l'état unifié `moteur` (additif, ne casse rien).
  // Signaux muscu : ACWR (tonnage, avec garde-fou reprise), bien-être (questionnaire),
  // contexte. injStatut = null (la muscu ne trace pas l'entité Blessure comme le foot).
  let moteur: any = null
  if (sport === 'muscu') {
    const premiereP = chSportA.premiere   // 1re charge (tonnage), source centrale
    const ctxObjM = _contexteActif(contexteRows || [], now)
    const ctxEtatM = ctxObjM ? String(ctxObjM.etat || 'saison_normale') : 'saison_normale'
    const sigM = _aggSignaux(beRows || [], now, 7)
    const seances7M = new Set(perfs.filter(r => (normDate(r.date) || '') >= c7).map(r => normDate(r.date))).size
    const histoM = _joursDepuis(premiereP, now)
    const etatM = evaluerEtatAthlete({
      acwr, acwrFiable: fiabiliteACWR(premiereP, ctxObjM, now, acwrCalcA.joursActifs28), seances7: seances7M,
      douleur: sigM.douleur, fatigue: sigM.fatigue, sommeil: sigM.sommeil, courbatures: null,
      injStatut: null, ctxEtat: ctxEtatM,
      q: { jours: histoM != null ? histoM : (perfs.length ? 7 : 0), wellnessN: sigM.wellnessN, hasCharge: perfs.length > 0 },
    })
    moteur = {
      disponibilite: etatM.disponibilite, surcharge: etatM.surcharge, risque_blessure: etatM.risque_blessure,
      recup: etatM.recup, reco: etatM.reco, confiance: etatM.confiance, alertes: etatM.alertes,
      acwr_fiable: etatM.acwr_fiable, acwr_categorie: etatM.acwr_categorie, contexte_tag: etatM.contexte_tag,
    }
    if (etatM.acwr_note) moteur.acwr_note = etatM.acwr_note
  }

  return jsonResp({
    moteur,
    global: enrichedGlobal,
    recent: { ...recentData, derniere_seance: derniereSeanceObj },
    comparison: comparisonData,
    dashboard: {
      derniere_seance: derniereSeanceObj,
      prochaine_seance: prochaineSeance,
      regularite: regulariteObj,
      tonnage: tonnageObj,
      muscle_retard: muscleRetard,
      acwr,
      progression: null,
      records_mois: null,
      streak: { semaines: streakSemaines },
      alertes,
    },
    historique: {
      dates_seances: datesSeances,
      exercices: [...new Set(perfs.map(r => r.exercice).filter(Boolean))],
      progression_par_exo: buildProgressionParExo(perfs),
      volume_semaine: Object.entries(seriesParMuscle).map(([muscle, faites]) => ({ muscle, faites })),
      volume_par_jour: buildVolumeParJour(perfs),
    },
    poids,
    programme,
    bien_etre,
    pause: pauseObj,
    contexte,
    sport,
    cardio,
    pas_quotidiens,
    volume_obti,
  })
}

async function handleGetLastPerf(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  const seanceId = params.get('seance_id') || ''
  if (!athleteId) return jsonResp({ perfs: {} })

  const { data: rows } = await sb().from('performances').select('*').eq('athlete_id', athleteId)
  // regroupement par exercice → par date (séance courante vs tout l'historique)
  const seancesCourantes: Record<string, Record<string, any[]>> = {}
  const toutesSeances: Record<string, Record<string, any[]>> = {}
  for (const r of rows || []) {
    const date = normDate(r.date)
    const exo = String(r.exercice || '')
    const s = { serie: r.serie, charge: Number(r.charge) || 0, reps: Number(r.reps) || 0 }
    if (!toutesSeances[exo]) toutesSeances[exo] = {}
    ;(toutesSeances[exo][date] ||= []).push(s)
    if (String(r.seance_id) !== seanceId) continue
    if (!seancesCourantes[exo]) seancesCourantes[exo] = {}
    ;(seancesCourantes[exo][date] ||= []).push(s)
  }

  const getRef = (series: any[]) => {
    let ref = series[0]
    for (const s of series) if (s.charge > ref.charge || (s.charge === ref.charge && s.reps > ref.reps)) ref = s
    return ref
  }
  const buildForExo = (byDate: Record<string, any[]>) => {
    const dates = Object.keys(byDate).sort().reverse()
    const last = dates[0], prev = dates[1], prev2 = dates[2]
    if (!last) return null
    const rl = getRef(byDate[last])
    const o: any = { date: last, series: byDate[last], max_reps: rl.reps, last_charge: rl.charge, prev_max_reps: null, prev_charge: null, prev2_max_reps: null, prev2_charge: null }
    if (prev) { const r = getRef(byDate[prev]); o.prev_max_reps = r.reps; o.prev_charge = r.charge }
    if (prev2) { const r = getRef(byDate[prev2]); o.prev2_max_reps = r.reps; o.prev2_charge = r.charge }
    return o
  }

  const result: Record<string, any> = {}
  for (const exo of Object.keys(seancesCourantes)) { const o = buildForExo(seancesCourantes[exo]); if (o) result[exo] = o }
  for (const exo of Object.keys(toutesSeances)) { if (!result[exo]) { const o = buildForExo(toutesSeances[exo]); if (o) result[exo] = o } }
  return jsonResp({ perfs: result })
}

async function handleGetExercices(): Promise<Response> {
  // catalogue complet depuis la table exercices ; le front lit data.exercices
  const { data } = await sb().from('exercices').select('*').order('exercice')
  const exercices = (data || []).filter(r => r.exercice_id).map(r => ({
    exercice_id: r.exercice_id,
    exercice: r.exercice,
    muscle: r.muscle,
    muscle_secondaire: r.muscle_secondaire || '',
    increment_kg: r.increment_kg || '2.5 / 5kg',
  }))
  return jsonResp({ exercices })
}

async function handleLoginCoach(params: URLSearchParams): Promise<Response> {
  const login = params.get('login')?.trim()
  const pwd = params.get('password')?.trim()
  if (!login || !pwd) return jsonResp({ erreur: 'Paramètres manquants' })

  const { data: coach } = await sb().from('coachs').select('*').eq('login', login).single()
  if (!coach) return jsonResp({ success: false, error: 'Login ou mot de passe incorrect.' })

  const { ok, upgrade } = await verifyPwd(pwd, coach.password_hash || '', coach.login)
  if (!ok) return jsonResp({ success: false, error: 'Login ou mot de passe incorrect.' })
  if (upgrade) await sb().from('coachs').update({ password_hash: upgrade }).eq('coach_id', coach.coach_id)

  return jsonResp({ success: true, coach: { coach_id: coach.coach_id, nom: coach.nom, sport: String(coach.sport || '').trim() || 'muscu', role: String(coach.role || '').trim() || 'coach' } })
}

async function handleGetCoachAthletes(params: URLSearchParams): Promise<Response> {
  const coachId = params.get('coach_id')
  if (!coachId) return jsonResp({ erreur: 'coach_id manquant' })

  const { data: athletes } = await sb().from('athletes').select('*').eq('coach_id', coachId)
  if (!athletes?.length) return jsonResp({ ok: true, athletes: [] })

  const athleteIds = athletes.map(a => a.id)
  const now = new Date()
  const c28 = fmtYMD(minus(now, 28))

  const [{ data: perfsAll }, { data: pauseAll }, { data: beAll }] = await Promise.all([
    sb().from('performances').select('*').in('athlete_id', athleteIds).gte('date', c28),
    sb().from('indicateurs').select('*').in('athlete_id', athleteIds).eq('cle', 'pause').order('date', { ascending: false }),
    sb().from('bien_etre').select('*').in('athlete_id', athleteIds).order('date', { ascending: false }),
  ])

  const result = athletes.map(ath => {
    const perfs = (perfsAll || []).filter(r => r.athlete_id === ath.id)
    const pauses = (pauseAll || []).filter(r => r.athlete_id === ath.id)
    const enPause = pauses.length > 0 && pauses[0].valeur !== 'fin'
    const dates = [...new Set(perfs.map(r => normDate(r.date)))].sort()
    const alertes = calculerAlertes(perfs, ath.id, Number(ath.annees) || 0, enPause)
    const lastBE = (beAll || []).find(r => r.athlete_id === ath.id)
    const anneesA = Number(ath.annees) || 0
    const sportA = ath.sport || 'muscu'
    const strategieA = ath.strategie || (sportA === 'muscu' ? getStrategieFromAnnees(anneesA) : '')
    return {
      athlete_id: String(ath.id), id: ath.id, nom: ath.nom, sport: sportA, en_pause: enPause,
      derniere_seance: dates.length ? fmtFR(dates[dates.length - 1]) : null,
      annees_pratique: anneesA,                         // ← rétabli (perdu à la migration) : pilote le niveau côté coach
      niveau: getNiveauExperience(anneesA),
      strategie_progression: strategieA,
      alertes,
      bien_etre: lastBE ? { date: fmtFR(lastBE.date), fatigue: lastBE.fatigue_musculaire, energie: lastBE.energie, sommeil: lastBE.sommeil } : null,
    }
  })

  return jsonResp({ ok: true, athletes: result })
}

async function handleGetCoachAthleteDetail(params: URLSearchParams): Promise<Response> {
  const coachId = params.get('coach_id')
  const athleteId = params.get('athlete_id')
  if (!coachId || !athleteId) return jsonResp({ erreur: 'Paramètres manquants' })

  const { data: ath } = await sb().from('athletes').select('*').eq('id', athleteId).eq('coach_id', coachId).single()
  if (!ath) return jsonResp({ erreur: 'Athlète non trouvé' })

  const now = new Date()
  const [{ data: perfs }, { data: poidsRows }, { data: beRows }, { data: progRows }, { data: contexteRows }, { data: objectifsRows }, { data: blessuresRows }] = await Promise.all([
    sb().from('performances').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
    sb().from('poids_historique').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(30),
    sb().from('bien_etre').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(30),
    sb().from('programme').select('*').eq('athlete_id', athleteId).order('groupe_id').order('id'),
    sb().from('contexte_athlete').select('*').eq('athlete_id', athleteId).order('date_debut', { ascending: false }),
    sb().from('objectifs').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
    sb().from('blessures').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
  ])

  const perfsArr = perfs || []
  const globalData = computeGlobal(perfsArr)
  const recentData = computeRecent(perfsArr, now)
  const alertes = calculerAlertes(perfsArr, athleteId, Number(ath.annees) || 0, false)

  return jsonResp({
    ok: true,
    athlete: { id: ath.id, nom: ath.nom, ddn: fmtFR(ath.ddn), taille: ath.taille, annees: ath.annees, annees_pratique: Number(ath.annees) || 0, niveau: getNiveauExperience(Number(ath.annees) || 0), strategie: ath.strategie || ((ath.sport || 'muscu') === 'muscu' ? getStrategieFromAnnees(Number(ath.annees) || 0) : ''), strategie_progression: ath.strategie || ((ath.sport || 'muscu') === 'muscu' ? getStrategieFromAnnees(Number(ath.annees) || 0) : ''), sport: ath.sport || 'muscu', poste: ath.poste, sexe: ath.sexe, club: ath.club, categorie: ath.categorie, antecedents: ath.antecedents, login: ath.login },
    global: globalData,
    recent: recentData,
    alertes,
    poids: (poidsRows || []).map(r => ({ date: fmtFR(r.date), poids: Number(r.poids) })),
    bien_etre: (beRows || []).map(r => ({ date: fmtFR(r.date), sommeil: r.sommeil, energie: r.energie, fatigue: r.fatigue_musculaire, douleur: r.douleur, zone: r.zone_douloureuse, ressenti: r.ressenti_global, note: r.note })),
    programme: (progRows || []).map(r => ({ id: r.id, row_index: r.id, seance_id: r.seance_id, exercice: r.exercice, series_prevues: r.series_prevues, reps_mini: r.reps_mini, reps_max: r.reps_max, repos_sec: r.repos_sec, groupe_id: r.groupe_id })),
    contexte: (contexteRows || []).map(r => ({ id: r.id, etat: r.etat, description: r.note || '', note: r.note || '', date_debut: fmtFR(r.date_debut), date_fin: r.date_fin ? fmtFR(r.date_fin) : null, source: r.source || '' })),
    objectifs: (objectifsRows || []).map(r => ({ id: r.id, categorie: r.categorie, description: r.description, statut: r.statut, date: fmtFR(r.date) })),
    blessures: (blessuresRows || []).map(r => ({ id: r.id, date: fmtFR(r.date), type: r.type, localisation: r.localisation, gravite: r.gravite, duree: r.duree, retour_terrain: fmtFR(r.retour_terrain), retour_competition: fmtFR(r.retour_competition), statut: r.statut })),
    historique: {
      progression_par_exo: buildProgressionParExo(perfsArr),
      volume_semaine: buildVolumeSemaineHisto(perfsArr),
    },
  })
}

async function handleGetCommentaires(params: URLSearchParams): Promise<Response> {
  const coachId = params.get('coach_id')
  const athleteId = params.get('athlete_id')
  let query = sb().from('commentaires').select('*').order('comment_id', { ascending: false }).limit(200)
  if (coachId) query = query.eq('coach_id', coachId)
  if (athleteId) query = query.eq('athlete_id', athleteId)
  const { data } = await query
  return jsonResp({ commentaires: (data || []).map(r => ({ id: r.comment_id, athlete_id: r.athlete_id, coach_id: r.coach_id, coach_nom: r.coach_nom, message: r.message, date: r.date, lu: r.lu === true || String(r.lu).toUpperCase() === 'TRUE', auteur: r.auteur, auteur_nom: r.auteur_nom })) })
}

async function handleGetCoachProgramme(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
  const { data } = await sb().from('programme').select('*').eq('athlete_id', athleteId).order('groupe_id').order('id')
  const lignes = (data || []).map(r => ({ id: r.id, row_index: r.id, athlete_id: r.athlete_id, seance_id: r.seance_id, exercice: r.exercice, series_prevues: r.series_prevues, reps_mini: r.reps_mini, reps_max: r.reps_max, repos_sec: r.repos_sec, groupe_id: r.groupe_id }))
  // le front lit data.lignes ; on garde aussi "programme" par rétro-compat
  return jsonResp({ ok: true, lignes, programme: lignes })
}

async function handleGetSeancesDetail(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ error: 'athlete_id manquant' })
  const { data } = await sb().from('performances').select('*').eq('athlete_id', athleteId)
  // groupé par DATE (JJ/MM/AAAA) → exos → series (comme Code.gs getSeancesDetail)
  const parDate: Record<string, { date: string; seance_id: string; _parExo: Record<string, any[]>; _ordreExo: string[]; _meta: Record<string, any> }> = {}
  const ordreDate: string[] = []
  for (const row of data || []) {
    const dIso = normDate(row.date); if (!dIso) continue
    const dmy = fmtFR(dIso)
    const exo = String(row.exercice || '')
    const seanceId = String(row.seance_id || 'Séance')
    if (!parDate[dmy]) { parDate[dmy] = { date: dmy, seance_id: seanceId, _parExo: {}, _ordreExo: [], _meta: {} }; ordreDate.push(dmy) }
    const bloc = parDate[dmy]
    if (!bloc._parExo[exo]) { bloc._parExo[exo] = []; bloc._ordreExo.push(exo); bloc._meta[exo] = { muscle: row.muscle || '', exercice_id: row.exercice_id != null ? String(row.exercice_id) : '' } }
    // repos inclus → l'éditeur de séance peut reconstruire les lignes complètes
    bloc._parExo[exo].push({ serie: bloc._parExo[exo].length + 1, charge: Number(row.charge) || null, reps: Number(row.reps) || null, rpe: Number(row.rpe) || null, repos: Number(row.repos) || null })
  }
  const seances = ordreDate.map(dmy => {
    const bloc = parDate[dmy]
    return { date: bloc.date, seance_id: bloc.seance_id, exos: bloc._ordreExo.map(exo => ({ exo, muscle: bloc._meta[exo].muscle, exercice_id: bloc._meta[exo].exercice_id, series: bloc._parExo[exo] })) }
  })
  seances.sort((a, b) => {
    const toMs = (d: string) => { const p = d.split('/'); return new Date(+p[2], +p[1] - 1, +p[0]).getTime() }
    return toMs(b.date) - toMs(a.date)
  })
  return jsonResp({ seances })
}

async function handleGetAlertesTraitees(params: URLSearchParams): Promise<Response> {
  const coachId = params.get('coach_id')
  if (!coachId) return jsonResp({ traitees: {} })
  const { data } = await sb().from('alertes_traitees').select('*').eq('coach_id', coachId)
  // le front lit data.traitees = { cle -> semaine }
  const traitees: Record<string, string> = {}
  for (const r of data || []) traitees[String(r.cle)] = String(r.semaine || '')
  return jsonResp({ traitees })
}

async function handleGetBilanPDF(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
  const [{ data: ath }, { data: perfs }, { data: poidsRows }, { data: beRows }, { data: tests }] = await Promise.all([
    sb().from('athletes').select('*').eq('id', athleteId).single(),
    sb().from('performances').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
    sb().from('poids_historique').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(12),
    sb().from('bien_etre').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(12),
    sb().from('tests').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
  ])
  const now = new Date()
  return jsonResp({ ok: true, athlete: ath, global: computeGlobal(perfs || []), recent: computeRecent(perfs || [], now), poids: (poidsRows || []).map(r => ({ date: fmtFR(r.date), poids: Number(r.poids) })), bien_etre: (beRows || []).map(r => ({ date: fmtFR(r.date), sommeil: r.sommeil, energie: r.energie, fatigue: r.fatigue_musculaire })), tests: (tests || []).map(r => ({ date: fmtFR(r.date), cle: r.cle, valeur: r.valeur, unite: r.unite })) })
}

async function handleLierAthlete(params: URLSearchParams): Promise<Response> {
  const coachId = params.get('coach_id')
  const athleteId = params.get('athlete_id')
  const loginAth = params.get('login_athlete') || params.get('cle')
  if (!coachId) return jsonResp({ success: false, error: 'coach_id manquant' })
  if (loginAth) {
    const { data: ath } = await sb().from('athletes').select('*').eq('login', loginAth).single()
    if (!ath) return jsonResp({ success: false, error: 'Athlète introuvable' })
    const { error } = await sb().from('athletes').update({ coach_id: coachId }).eq('id', ath.id)
    if (error) return jsonResp({ success: false, error: error.message })
    return jsonResp({ success: true, athlete_id: ath.id, nom: ath.nom })
  }
  if (athleteId) {
    const { error } = await sb().from('athletes').update({ coach_id: coachId }).eq('id', athleteId)
    if (error) return jsonResp({ success: false, error: error.message })
    return jsonResp({ success: true })
  }
  return jsonResp({ success: false, error: 'Paramètres manquants' })
}

// =============================================================================
// MOTEUR CENTRAL D'ÉTAT ATHLÈTE — source unique de vérité (Phase 2 · priorité 1)
// -----------------------------------------------------------------------------
// Une SEULE fonction décide de l'état d'un athlète. L'accueil (getSuiviEquipe) ET
// la fiche (getSuiviJoueur) l'appellent avec des signaux agrégés de la MÊME façon
// (_aggSignaux) → elles ne peuvent plus se contredire. `niveau` (0/1/2) alimente
// à la fois le statut cockpit (vert/orange/rouge) et la disponibilité fiche
// (Prêt/Vigilance/À surveiller) : même source, deux libellés.
// Fonction PURE (aucun accès BDD) → testable hors-ligne (voir tests/).
// -----------------------------------------------------------------------------
// Agrégation commune des signaux bien-être sur une fenêtre (jours). Choix figés :
//   douleur = MAX récent · fatigue = MAX récent · sommeil = MOYENNE récente.
// (max pour la douleur/fatigue = orienté prévention ; moyenne sommeil = §16, une
//  seule mauvaise nuit ne doit pas suffire.)
function _aggSignaux(rows: any[], now: Date, days = 7): { douleur: number|null; fatigue: number|null; sommeil: number|null; wellnessN: number } {
  const cut = fmtYMD(minus(now, days))
  const doul: number[] = [], fat: number[] = [], som: number[] = []
  for (const r of rows || []) {
    const dIso = normDate(r.date); if (!dIso || dIso < cut) continue
    if (r.douleur != null && r.douleur !== '') doul.push(Number(r.douleur))
    if (r.fatigue_musculaire != null && r.fatigue_musculaire !== '') fat.push(Number(r.fatigue_musculaire))
    if (r.sommeil != null && r.sommeil !== '') som.push(Number(r.sommeil))
  }
  const mx = (a: number[]) => a.length ? Math.max(...a) : null
  const mn = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
  return { douleur: mx(doul), fatigue: mx(fat), sommeil: mn(som), wellnessN: Math.max(doul.length, fat.length, som.length) }
}

interface EtatInput {
  acwr: number | null
  acwrFiable?: boolean         // false = chronique insuffisante (reprise) → ACWR non interprétable
  seances7: number
  douleur: number | null       // agrégé (max récent)
  fatigue: number | null       // agrégé (max récent)
  sommeil: number | null       // agrégé (moyenne récente)
  courbatures: number | null   // muscu (indicateurs) sinon null
  injStatut: 'indispo' | 'retour_progressif' | null
  ctxEtat: string
  q: { jours: number; wellnessN: number; hasCharge: boolean }
}

function evaluerEtatAthlete(s: EtatInput): any {
  const NIV = ['Prêt', 'Vigilance', 'À surveiller']
  const COUL = ['#22c55e', '#f5a623', '#e5484d']
  const STA = ['vert', 'orange', 'rouge']
  const ctx = s.ctxEtat || 'saison_normale'
  const reposPrevu = ctx === 'deload' || ctx === 'retour_vacances' || ctx === 'retour_blessure'

  // --- Garde-fou ACWR (décision retour-vacances) : si l'historique de charge est
  // insuffisant (reprise, < 28 j de chronique réelle), l'ACWR est NON INTERPRÉTABLE.
  // On n'en tire alors AUCUNE alerte (ni surcharge ni sous-charge) — les autres
  // indicateurs (douleur, fatigue, sommeil, récup…) continuent de fonctionner.
  const acwrOk = s.acwr != null && s.acwrFiable !== false
  const acwrForConf = acwrOk ? s.acwr : null

  // --- Niveau de confiance (qualité des données disponibles) ---
  let confiance: string
  if (s.q.wellnessN === 0 && !s.q.hasCharge) confiance = 'non_interpretable'
  else if (s.q.jours < 7 || s.q.wellnessN === 0) confiance = 'faible'
  else if (s.q.jours < 21 || s.q.wellnessN < 3 || acwrForConf == null) confiance = 'moyenne'
  else confiance = 'haute'

  // --- Charge (ACWR) ajustée par le contexte — seulement si ACWR interprétable ---
  let surchargeN = 0
  if (acwrOk) {
    surchargeN = (s.acwr as number) > SEUILS_ACWR.HAUT ? 2 : (s.acwr as number) > SEUILS_ACWR.OPT_MAX ? 1 : 0
    if (ctx === 'deload') surchargeN = Math.max(0, surchargeN - 1)
    if (ctx === 'retour_vacances') surchargeN = Math.min(2, surchargeN + 1)
  }

  const doul = s.douleur ?? 0, fat = s.fatigue ?? 0, som = s.sommeil, courb = s.courbatures ?? 0
  const chargeHaute = surchargeN >= 1
  const sommeilBas = som != null && som <= 2
  const fatigueHaute = fat >= 4
  const douleurGene = doul >= 2, douleurForte = doul >= 3

  // --- Signaux → alertes (le contexte peut en supprimer) ---
  const alertes: { type: string; severite: string; message: string }[] = []
  if (s.seances7 === 0 && s.injStatut !== 'indispo' && !reposPrevu)
    alertes.push({ type: 'absence', severite: 'haute', message: 'Aucune séance depuis 7 jours' })
  if (surchargeN >= 2) alertes.push({ type: 'surcharge', severite: 'haute', message: `Charge aiguë élevée (ACWR ${s.acwr})` })
  else if (surchargeN === 1) alertes.push({ type: 'charge', severite: 'moyenne', message: `Charge en hausse (ACWR ${s.acwr})` })
  else if (acwrOk && (s.acwr as number) < SEUILS_ACWR.BAS && s.seances7 > 0 && !reposPrevu) alertes.push({ type: 'sous_charge', severite: 'moyenne', message: `Sous-charge (ACWR ${s.acwr})` })
  if (douleurForte) alertes.push({ type: 'douleur', severite: 'haute', message: 'Douleur signalée' })
  else if (douleurGene) alertes.push({ type: 'douleur', severite: 'moyenne', message: 'Gêne signalée' })
  if (fatigueHaute) alertes.push({ type: 'fatigue', severite: 'moyenne', message: `Fatigue élevée (${Math.round(fat * 10) / 10}/5)` })
  if (sommeilBas) alertes.push({ type: 'sommeil', severite: 'moyenne', message: `Sommeil dégradé (${Math.round((som as number) * 10) / 10}/5)` })

  // --- Risque blessure (cumul de points) ---
  const rbPts = surchargeN + (douleurForte ? 2 : douleurGene ? 1 : 0) + (fatigueHaute ? 1 : 0) + (courb >= 4 ? 1 : 0)
  let risqueBlessureN = rbPts >= 3 ? 2 : rbPts >= 1 ? 1 : 0
  if (ctx === 'retour_blessure') risqueBlessureN = Math.min(2, risqueBlessureN + 1)

  // --- Récupération (score bien-être) ---
  const recArr: number[] = []
  if (som != null) recArr.push(som / 5)
  if (s.fatigue != null) recArr.push((6 - fat) / 5)
  if (s.courbatures != null) recArr.push((6 - courb) / 5)
  const recScore = recArr.length ? (recArr.reduce((a, b) => a + b, 0) / recArr.length) * 100 : null
  const recup = recScore == null ? '—' : recScore >= 75 ? 'Excellent' : recScore >= 60 ? 'Bon' : recScore >= 45 ? 'Moyen' : 'Faible'

  // --- Niveau global (0/1/2) : UNE seule décision, partagée par les deux vues ---
  // Décision métier « récup faible » : ISOLÉE → Vigilance (orange). Rouge seulement
  // si elle s'accompagne d'un AUTRE signal concordant INDÉPENDANT de la récup
  // (charge élevée ou douleur — pas sommeil/fatigue qui SONT la cause de la récup).
  const recFaible = recScore != null && recScore < 45
  const signalConcordant = chargeHaute || douleurGene              // indépendants de la récup
  const recFaibleConcordante = recFaible && signalConcordant
  let niveau: number
  if (s.injStatut === 'indispo') niveau = 2
  else {
    const haute = alertes.some(a => a.severite === 'haute')
    const combo = fatigueHaute && sommeilBas && chargeHaute        // §16 : combinaison de signaux
    const bad = haute || risqueBlessureN === 2 || recFaibleConcordante || combo
    const mid = alertes.length > 0 || risqueBlessureN === 1 || recFaible || (recScore != null && recScore < 60) || s.injStatut === 'retour_progressif'
    niveau = bad ? 2 : mid ? 1 : 0
  }
  if (ctx === 'retour_blessure' && niveau === 0) niveau = 1
  if (confiance === 'non_interpretable') niveau = 0   // nouvel athlète : pas de fausse alerte

  // --- Recommandation (explicable, non médicale) ---
  let reco: string
  if (s.injStatut === 'indispo') reco = 'Indisponible — poursuivre la réathlétisation.'
  else if (confiance === 'non_interpretable') reco = 'Données insuffisantes pour établir une tendance.'
  else if (surchargeN >= 2) reco = `Charge aiguë élevée (ACWR ${s.acwr != null ? s.acwr.toFixed(2) : '—'}) — réduire le volume 48 h.`
  else if (douleurForte) reco = 'Douleur signalée — évaluer avant de charger.'
  else if (douleurGene) reco = 'Gêne récente — surveiller, avis kiné si besoin.'
  else if (recFaibleConcordante) reco = 'Récupération faible + autre signal — alléger et surveiller de près.'
  else if (recFaible) reco = 'Récupération faible — vigilance, alléger si ça persiste.'
  else if (s.injStatut === 'retour_progressif') reco = 'Retour progressif — respecter la progressivité de charge.'
  else if (niveau === 1) reco = 'Vigilance — surveiller les sensations, ne pas surcharger.'
  else reco = 'RAS — maintenir la charge actuelle.'

  const donnees: string[] = []
  if (s.q.hasCharge) donnees.push('charge')
  if (s.q.wellnessN > 0) donnees.push('bien-être')
  if (s.injStatut) donnees.push('blessure')

  const out: any = {
    niveau,
    statut: STA[niveau],
    disponibilite: { niveau: NIV[niveau], couleur: COUL[niveau] },
    surchargeN, surcharge: ['Faible', 'Modéré', 'Élevé'][surchargeN],
    risqueBlessureN, risque_blessure: ['Faible', 'Modéré', 'Élevé'][risqueBlessureN],
    recScore, recup,
    alertes, confiance, reco,
    acwr_fiable: acwrOk,
    donnees_utilisees: donnees,
    contexte_tag: ctx !== 'saison_normale' ? ctx : null,
    signaux: { acwr: acwrOk ? s.acwr : null, douleur: s.douleur, fatigue: s.fatigue, sommeil: s.sommeil, seances7: s.seances7 },
    acwr_categorie: interpreterACWR(s.acwr ?? null, acwrOk),
  }
  // Note générique : couvre historique < 28 j, reprise vacances < 28 j, chronique trouée
  // (jours actifs insuffisants). Jamais transformée en alerte négative.
  if (!acwrOk && s.acwr != null) out.acwr_note = 'ACWR non interprétable — historique de charge insuffisant'
  return out
}

// Jours écoulés depuis une date (ISO ou FR). null si absente/illisible.
function _joursDepuis(d: string | null | undefined, now: Date): number | null {
  if (!d) return null
  const iso = normDate(String(d)); if (!iso) return null
  const dt = new Date(iso + 'T00:00:00Z'); if (isNaN(dt.getTime())) return null
  return Math.floor((now.getTime() - dt.getTime()) / 86400000)
}
// (Ancien _acwrFiable supprimé — Phase 2B. Le garde-fou historique + reprise + jours
//  actifs est désormais dans fiabiliteACWR, brique de la chaîne ACWR centrale.)

async function handleGetSuiviEquipe(params: URLSearchParams): Promise<Response> {
  const coachId = params.get('coach_id')
  if (!coachId) return jsonResp({ joueurs: [], equipe: {}, error: 'coach_id manquant' })
  try {
    const now = new Date()
    const j7 = fmtYMD(minus(now, 7))
    const j28 = fmtYMD(minus(now, 28))

    const [{ data: aths }, { data: indAll }, { data: beAll }, { data: injAll }, { data: testAll }, { data: ctxAll }] = await Promise.all([
      sb().from('athletes').select('*').eq('coach_id', coachId),
      sb().from('indicateurs').select('*').eq('cle', 'charge_interne'),
      sb().from('bien_etre').select('*').gte('date', j7),
      sb().from('blessures').select('*'),
      sb().from('tests').select('*'),
      // Contexte par athlète : nécessaire pour appliquer deload / retour blessure AUSSI
      // sur l'accueil (avant, seule la fiche l'appliquait → incohérence).
      sb().from('contexte_athlete').select('*'),
    ])
    // login inclus uniquement pour les joueurs démo (id demo_*) → affiché sur la carte
    // du cockpit pour tester la connexion. Jamais pour les vrais athlètes (vie privée).
    const joueurs = (aths || []).map(a => ({ athlete_id: String(a.id), nom: a.nom, poste: String(a.poste || ''), login: String(a.id).startsWith('demo_') ? String(a.login || '') : '' }))
    const athIds = new Set(joueurs.map(j => j.athlete_id))
    // Contexte actif par athlète (même helper que la fiche → même interprétation).
    const ctxRowsByAth: Record<string, any[]> = {}
    for (const r of ctxAll || []) { const id = String(r.athlete_id); if (athIds.has(id)) (ctxRowsByAth[id] ||= []).push(r) }
    const ctxObjOf = (id: string): any => _contexteActif(ctxRowsByAth[id] || [], now)
    const ctxEtatOf = (id: string): string => { const c = ctxObjOf(id); return c ? String(c.etat || 'saison_normale') : 'saison_normale' }
    // Lignes bien-être brutes par athlète → agrégation commune (_aggSignaux).
    const beRawByAth: Record<string, any[]> = {}
    for (const rb of beAll || []) { const id = String(rb.athlete_id); if (athIds.has(id)) (beRawByAth[id] ||= []).push(rb) }

    // charge_interne par athlète (7j / 28j) + dernière + PREMIÈRE (historique) + jours actifs 7j
    const parAth: Record<string, { charge7: number; charge28: number; seances7: Set<string>; derniere: string | null; premiere: string | null; chargeParJour: Record<string, number> }> = {}
    const acc = (id: string) => (parAth[id] ||= { charge7: 0, charge28: 0, seances7: new Set(), derniere: null, premiere: null, chargeParJour: {} })
    for (const row of indAll || []) {
      const id = String(row.athlete_id)
      if (!athIds.has(id)) continue
      const dIso = normDate(row.date)
      if (!dIso) continue
      const val = Number(row.valeur) || 0
      const a = acc(id)
      if (!a.derniere || dIso > a.derniere) a.derniere = dIso
      if (!a.premiere || dIso < a.premiere) a.premiere = dIso   // pour le garde-fou ACWR (historique)
      if (dIso >= j28) { a.charge28 += val; if (val > 0) a.chargeParJour[dIso] = (a.chargeParJour[dIso] || 0) + val }  // série 28 j → chaîne ACWR centrale
      if (dIso >= j7) { a.charge7 += val; a.seances7.add(dIso) }
    }

    // bien-être 7j par athlète
    const beAth: Record<string, { fatigue: number[]; douleur: number[]; sommeil: number[] }> = {}
    for (const rb of beAll || []) {
      const id = String(rb.athlete_id)
      if (!athIds.has(id)) continue
      if (!beAth[id]) beAth[id] = { fatigue: [], douleur: [], sommeil: [] }
      if (rb.fatigue_musculaire != null && rb.fatigue_musculaire !== '') beAth[id].fatigue.push(Number(rb.fatigue_musculaire))
      if (rb.douleur != null && rb.douleur !== '') beAth[id].douleur.push(Number(rb.douleur))
      if (rb.sommeil != null && rb.sommeil !== '') beAth[id].sommeil.push(Number(rb.sommeil))
    }
    const moy = (arr: number[]) => arr && arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
    const mx = (arr: number[]) => arr && arr.length ? Math.max(...arr) : null

    // blessures actives
    const injByAth: Record<string, any> = {}
    for (const r of injAll || []) {
      const st = String(r.statut || '')
      if (st !== 'indispo' && st !== 'retour_progressif') continue
      if (!athIds.has(String(r.athlete_id))) continue
      injByAth[String(r.athlete_id)] = { type: String(r.type || ''), localisation: String(r.localisation || ''), statut: st, retour_terrain: r.retour_terrain ? fmtFR(r.retour_terrain) : '', retour_competition: r.retour_competition ? fmtFR(r.retour_competition) : '' }
    }

    // progression via tests (premier vs dernier point, selon le sens)
    const SENS: Record<string, number> = { vma: 1, sprint_10m: -1, sprint_30m: -1, cmj: 1, squat_jump: 1, yoyo_test: 1, agilite_5_10_5: -1, force_iso: 1, force_max: 1, '1rm': 1, test_vitesse: 1 }
    const testsAth: Record<string, Record<string, { d: number; v: number }[]>> = {}
    for (const r of testAll || []) {
      const id = String(r.athlete_id)
      if (!athIds.has(id)) continue
      const dt = parseFR(r.date); if (!dt) continue
      ;(testsAth[id] ||= {})
      ;(testsAth[id][String(r.cle)] ||= []).push({ d: dt.getTime(), v: Number(r.valeur) })
    }
    const progressionAth = (id: string) => {
      const tset = testsAth[id]; if (!tset) return 'stable'
      let up = 0, down = 0
      for (const c in tset) {
        const pts = tset[c].sort((a, b) => a.d - b.d)
        if (pts.length < 2) continue
        const diff = (pts[pts.length - 1].v - pts[0].v) * (SENS[c] || 1)
        if (diff > 0) up++; else if (diff < 0) down++
      }
      return up > down ? 'progression' : (down > up ? 'regression' : 'stable')
    }

    const resultats: any[] = []
    const nb: Record<string, number> = { vert: 0, orange: 0, rouge: 0 }
    let chargeEquipe = 0, nbProg = 0, nbReg = 0, nbIndispo = 0
    const fatigueEquipeArr: number[] = [], beEquipeArr: number[] = [], blesses: any[] = []

    for (const j of joueurs) {
      const a = parAth[j.athlete_id] || { charge7: 0, charge28: 0, seances7: new Set<string>(), derniere: null, premiere: null, chargeParJour: {} }
      const seances7 = a.seances7.size
      // ACWR — chaîne CENTRALE (foot = charge_interne), source unique.
      const acwrCalc = calculerACWR(a.chargeParJour, now)
      const acwr = acwrCalc.ratio
      const inj = injByAth[j.athlete_id] || null
      const histoDays = _joursDepuis(a.premiere, now)
      const acwrFiable = fiabiliteACWR(a.premiere, ctxObjOf(j.athlete_id), now, acwrCalc.joursActifs28)

      // Signaux agrégés (fenêtre 7 j) — MÊME agrégation que la fiche (_aggSignaux).
      const sig = _aggSignaux(beRawByAth[j.athlete_id] || [], now, 7)

      // >>> MOTEUR CENTRAL — statut, alertes, dispo, risque, récup, reco, confiance <<<
      const etat = evaluerEtatAthlete({
        acwr, acwrFiable, seances7,
        douleur: sig.douleur, fatigue: sig.fatigue, sommeil: sig.sommeil, courbatures: null,
        injStatut: inj ? inj.statut : null,
        ctxEtat: ctxEtatOf(j.athlete_id),
        q: { jours: histoDays != null ? histoDays : (a.charge7 > 0 || sig.wellnessN > 0 ? 7 : 0), wellnessN: sig.wellnessN, hasCharge: a.charge7 > 0 || a.charge28 > 0 },
      })

      /* ===== ANCIEN MOTEUR (conservé temporairement pour comparaison — Phase 2 P1) =====
         Remplacé par evaluerEtatAthlete ci-dessus. Il calculait douleur=max, fatigue=MOYENNE,
         sommeil=MOYENNE, ignorait le contexte, et « toute alerte haute = rouge » (indépendamment
         de la fiche). Gardé en commentaire le temps de valider la bascule.
           const fatigueMoy = moy(be.fatigue), douleurMax = mx(be.douleur), sommeilMoy = moy(be.sommeil)
           if (seances7 === 0 && !(inj?.statut === 'indispo')) alertes.push({absence…})
           if (acwr > 1.5) … ; if (douleurMax >= 2) … ; if (fatigueMoy >= 4) … ; if (sommeilMoy <= 2) …
           statut = alertes.some(haute) ? 'rouge' : alertes.length ? 'orange' : 'vert'
      ===== */

      const statut = etat.statut
      const alertes = etat.alertes
      nb[statut]++
      chargeEquipe += a.charge7
      if (sig.fatigue != null) fatigueEquipeArr.push(sig.fatigue)

      const prog = progressionAth(j.athlete_id)
      const beComp: number[] = []
      if (sig.sommeil != null) beComp.push(sig.sommeil)
      if (sig.fatigue != null) beComp.push(6 - sig.fatigue)
      if (sig.douleur != null) beComp.push(6 - sig.douleur)
      const beScore = beComp.length ? beComp.reduce((x, y) => x + y, 0) / beComp.length : null
      if (beScore != null) beEquipeArr.push(beScore)
      if (prog === 'progression') nbProg++; else if (prog === 'regression') nbReg++
      if (inj) { blesses.push({ athlete_id: j.athlete_id, nom: j.nom, poste: j.poste, type: inj.type, localisation: inj.localisation, statut: inj.statut, retour_terrain: inj.retour_terrain, retour_competition: inj.retour_competition }); if (inj.statut === 'indispo') nbIndispo++ }

      resultats.push({
        athlete_id: j.athlete_id, nom: j.nom, poste: j.poste, login: j.login || '',
        derniere_seance: a.derniere ? fmtFR(a.derniere) : null,
        seances_7j: seances7,
        charge_7j: Math.round(a.charge7),
        acwr,
        fatigue_moy: sig.fatigue != null ? Math.round(sig.fatigue * 10) / 10 : null,
        douleur_max: sig.douleur,
        sommeil_moy: sig.sommeil != null ? Math.round(sig.sommeil * 10) / 10 : null,
        statut, progression: prog, blesse: inj ? inj.statut : null, alertes,
        // Enrichissements du moteur central (mêmes valeurs que la fiche) :
        disponibilite: etat.disponibilite, risque_blessure: etat.risque_blessure,
        recup: etat.recup, confiance: etat.confiance, reco: etat.reco, contexte_tag: etat.contexte_tag,
        acwr_fiable: etat.acwr_fiable, acwr_categorie: etat.acwr_categorie,
      })
    }

    const rang: Record<string, number> = { rouge: 0, orange: 1, vert: 2 }
    resultats.sort((x, y) => rang[x.statut] - rang[y.statut] || (y.charge_7j - x.charge_7j))

    // charge hebdo équipe (8 dernières semaines)
    const semCharges: Record<string, number> = {}
    for (const row of indAll || []) {
      if (!athIds.has(String(row.athlete_id))) continue
      const d = parseFR(row.date); if (!d) continue
      const lundiStr = fmtFR(fmtYMD(getLundi(d)))
      semCharges[lundiStr] = (semCharges[lundiStr] || 0) + (Number(row.valeur) || 0)
    }
    const semKeys = Object.keys(semCharges).sort((a, b) => (parseFR(a)?.getTime() || 0) - (parseFR(b)?.getTime() || 0))
    const chargeHebdo = semKeys.slice(-8).map(sem => ({ sem, charge: Math.round(semCharges[sem]) }))

    return jsonResp({
      joueurs: resultats,
      equipe: {
        total: joueurs.length,
        vert: nb.vert, orange: nb.orange, rouge: nb.rouge,
        indispo: nbIndispo,
        charge_equipe: Math.round(chargeEquipe),
        fatigue_moyenne: fatigueEquipeArr.length ? Math.round((moy(fatigueEquipeArr) || 0) * 10) / 10 : null,
        bienetre_moyen: beEquipeArr.length ? Math.round((moy(beEquipeArr) || 0) * 10) / 10 : null,
        en_progression: nbProg, en_regression: nbReg,
      },
      blesses,
      charge_hebdo: chargeHebdo,
    })
  } catch (err) {
    return jsonResp({ joueurs: [], equipe: {}, error: String((err as any)?.message || err) })
  }
}

async function handleGetSuiviJoueur(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id') || ''
  if (!athleteId) return jsonResp({ error: 'athlete_id manquant' })
  try {
    const now = new Date()
    const j7 = fmtYMD(minus(now, 7))
    const j14 = fmtYMD(minus(now, 14))
    const j28 = fmtYMD(minus(now, 28))

    const [{ data: ath }, { data: indAll }, { data: beAll }, { data: injAll }, { data: objAll }, { data: ctxAll }, { data: perfAll }] = await Promise.all([
      sb().from('athletes').select('*').eq('id', athleteId).single(),
      sb().from('indicateurs').select('*').eq('athlete_id', athleteId),
      sb().from('bien_etre').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(60),
      sb().from('blessures').select('*').eq('athlete_id', athleteId),
      sb().from('objectifs').select('*').eq('athlete_id', athleteId),
      sb().from('contexte_athlete').select('*').eq('athlete_id', athleteId).order('date_debut', { ascending: false }),
      // Séances de renfo réalisées (exécution guidée côté joueur) — affichage seul,
      // ne compte pas dans l'ACWR foot (pas de charge_interne).
      sb().from('performances').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
    ])

    const nom = ath?.nom || ''
    const poste = String(ath?.poste || '')
    const ddn = ath?.ddn ? fmtFR(ath.ddn) : ''
    const taille = (ath?.taille != null && ath.taille !== '') ? Number(ath.taille) : null
    const jambe = String(ath?.jambe_dominante || '')
    const poids = (ath?.poids != null && ath.poids !== '') ? Number(ath.poids) : null
    const antecedents = String(ath?.antecedents || '')
    const heatmap = String(ath?.heatmap || '')
    const sexe = String(ath?.sexe || ''), club = String(ath?.club || ''), categorie = String(ath?.categorie || '')
    const date_entree = String(ath?.date_entree || ''), discipline = String(ath?.discipline || '')
    let age: number | null = null
    if (ddn) { const dn = parseFR(ddn); if (dn) age = Math.floor((Date.now() - dn.getTime()) / 31557600000) }

    const WELL: Record<string, number> = { sommeil: 1, energie: 1, fatigue: 1, motivation: 1, stress: 1, courbatures: 1, douleur: 1, dispo_mentale: 1, fatigue_post: 1, difficulte_seance: 1, satisfaction: 1, douleur_post: 1 }
    const seances: Record<string, { date: string; dateIso: string; cles: Record<string, any> }> = {}
    const chargeParSem: Record<string, number> = {}, semLundi: Record<string, string> = {}
    let charge7 = 0, charge28 = 0
    let premiereCharge: string | null = null   // 1re date de charge (garde-fou ACWR reprise)
    const chargeParJour: Record<string, number> = {}
    const chargeParJour28: Record<string, number> = {}   // série 28 j → chaîne ACWR centrale
    const wellDate: Record<string, number> = {}, bienetreI: Record<string, number> = {}

    for (const row of indAll || []) {
      const dIso = normDate(row.date); if (!dIso) continue
      const sid = String(row.seance_id), cle = String(row.cle), val = Number(row.valeur) || 0
      if (!seances[sid]) seances[sid] = { date: fmtFR(dIso), dateIso: dIso, cles: {} }
      seances[sid].cles[cle] = row.valeur
      if (WELL[cle] && row.valeur !== '' && row.valeur != null) {
        const t = (parseFR(dIso)?.getTime()) || 0
        if (!wellDate[cle] || t >= wellDate[cle]) { wellDate[cle] = t; bienetreI[cle] = Number(row.valeur) }
      }
      if (cle === 'charge_interne') {
        const dObj = parseFR(dIso)!
        const w = isoWeek(dObj)
        chargeParSem[w] = (chargeParSem[w] || 0) + val
        const lundiStr = fmtYMD(getLundi(dObj))
        if (!semLundi[w] || lundiStr < semLundi[w]) semLundi[w] = lundiStr
        if (!premiereCharge || dIso < premiereCharge) premiereCharge = dIso
        if (dIso >= j28) { charge28 += val; if (val > 0) chargeParJour28[dIso] = (chargeParJour28[dIso] || 0) + val }
        if (dIso >= j7) { charge7 += val; chargeParJour[dIso] = (chargeParJour[dIso] || 0) + val }
      }
    }

    // ACWR — chaîne CENTRALE (foot = charge_interne), source unique.
    const acwrCalcF = calculerACWR(chargeParJour28, now)
    const acwr = acwrCalcF.ratio
    const chargeHebdo = Object.keys(chargeParSem).sort().slice(-6).map(w => ({
      semaine: w, charge: Math.round(chargeParSem[w]), label: semLundi[w] ? fmtFR(semLundi[w]).slice(0, 5) : w,
    }))

    const days7: number[] = []
    for (let dd = 0; dd < 7; dd++) days7.push(chargeParJour[fmtYMD(minus(now, dd))] || 0)
    const meanD = days7.reduce((a, b) => a + b, 0) / 7
    const sdD = Math.sqrt(days7.reduce((a, b) => a + (b - meanD) ** 2, 0) / 7)
    const monotonie = sdD > 0 ? Math.round(meanD / sdD * 100) / 100 : null
    const strain = monotonie != null ? Math.round(charge7 * monotonie) : null
    const kpiFoot: any = { charge_mensuelle: Math.round(charge28), monotonie, strain, temps_jeu: 0 }

    // ---- Séances de renfo réalisées (table performances) -------------------
    // Regroupées par (date, seance_id). Le ressenti éventuel (bien_etre de même
    // date/seance) est tagué « renfo » et rattaché ici → il n'apparaît PAS dans
    // le bien-être foot (état du jour / bloc bien-être), qui reste lié aux
    // séances d'entraînement.
    const renfoMap: Record<string, any> = {}
    const renfoKeys = new Set<string>()   // `${dateIso}|${seance_id}` → tag ressenti renfo
    const renfoIds = new Set<string>()    // seance_id renfo → exclure des séances foot
    for (const p of perfAll || []) {
      const dIso = normDate(p.date); if (!dIso) continue
      const sid = String(p.seance_id || '')
      renfoIds.add(sid); renfoKeys.add(`${dIso}|${sid}`)
      const key = `${dIso}|${sid}`
      if (!renfoMap[key]) renfoMap[key] = { dateIso: dIso, date: fmtFR(dIso), seance_id: sid, exercices: {} as Record<string, any>, nb_series: 0, volume_total: 0, rpe_sum: 0, rpe_n: 0 }
      const rs = renfoMap[key]
      const exo = String(p.exercice || '—')
      if (!rs.exercices[exo]) rs.exercices[exo] = { exercice: exo, muscle: String(p.muscle || ''), series: [] }
      rs.exercices[exo].series.push({ serie: Number(p.serie) || (rs.exercices[exo].series.length + 1), charge: p.charge != null && p.charge !== '' ? Number(p.charge) : null, reps: p.reps != null && p.reps !== '' ? Number(p.reps) : null, rpe: p.rpe != null && p.rpe !== '' ? Number(p.rpe) : null, volume: p.volume != null && p.volume !== '' ? Number(p.volume) : null })
      rs.nb_series++
      if (p.volume != null && p.volume !== '') rs.volume_total += Number(p.volume) || 0
      if (p.rpe != null && p.rpe !== '') { rs.rpe_sum += Number(p.rpe); rs.rpe_n++ }
    }
    // Ressenti renfo : la ligne bien_etre de même (date, seance_id).
    const renfoRessenti: Record<string, any> = {}
    for (const rb of beAll || []) {
      const dIso = normDate(rb.date); if (!dIso) continue
      const k = `${dIso}|${String(rb.seance_id || '')}`
      if (renfoKeys.has(k) && !renfoRessenti[k]) {
        renfoRessenti[k] = {
          sommeil: rb.sommeil !== '' && rb.sommeil != null ? Number(rb.sommeil) : null,
          energie: rb.energie !== '' && rb.energie != null ? Number(rb.energie) : null,
          fatigue: rb.fatigue_musculaire !== '' && rb.fatigue_musculaire != null ? Number(rb.fatigue_musculaire) : null,
          douleur: rb.douleur !== '' && rb.douleur != null ? Number(rb.douleur) : null,
          ressenti: rb.ressenti_global != null && rb.ressenti_global !== '' ? String(rb.ressenti_global) : null,
          note: rb.note !== '' && rb.note != null ? Number(rb.note) : null,
        }
      }
    }
    const renfo_seances = Object.values(renfoMap)
      .sort((a: any, b: any) => b.dateIso.localeCompare(a.dateIso))
      .slice(0, 10)
      .map((rs: any) => ({
        date: rs.date, seance_id: rs.seance_id, nb_series: rs.nb_series,
        volume_total: Math.round(rs.volume_total),
        rpe_moyen: rs.rpe_n ? Math.round(rs.rpe_sum / rs.rpe_n * 10) / 10 : null,
        exercices: Object.values(rs.exercices),
        ressenti: renfoRessenti[`${rs.dateIso}|${rs.seance_id}`] || null,
      }))

    const wellness: any[] = []
    for (const rb of beAll || []) {
      const dIso = normDate(rb.date); if (!dIso || dIso < j14) continue
      if (renfoKeys.has(`${dIso}|${String(rb.seance_id || '')}`)) continue   // ressenti renfo : exclu du bien-être foot
      wellness.push({ date: fmtFR(dIso), dateIso: dIso,
        sommeil: rb.sommeil !== '' && rb.sommeil != null ? Number(rb.sommeil) : null,
        energie: rb.energie !== '' && rb.energie != null ? Number(rb.energie) : null,
        fatigue: rb.fatigue_musculaire !== '' && rb.fatigue_musculaire != null ? Number(rb.fatigue_musculaire) : null,
        douleur: rb.douleur !== '' && rb.douleur != null ? Number(rb.douleur) : null })
    }
    wellness.sort((a, b) => a.dateIso.localeCompare(b.dateIso))
    wellness.forEach(w => { delete w.dateIso })

    const bienetre: Record<string, any> = {}
    const wLast2 = wellness.length ? wellness[wellness.length - 1] : null
    if (wLast2) {
      if (wLast2.sommeil != null) bienetre.sommeil = wLast2.sommeil
      if (wLast2.energie != null) bienetre.energie = wLast2.energie
      if (wLast2.fatigue != null) bienetre.fatigue = wLast2.fatigue
      if (wLast2.douleur != null) bienetre.douleur = wLast2.douleur
    }
    for (const wk in bienetreI) bienetre[wk] = bienetreI[wk]

    const listeSeances = Object.entries(seances)
      .filter(([sid]) => !renfoIds.has(sid))   // exclut les séances de renfo (affichées dans leur propre bloc)
      .map(([, s]) => s)
      .sort((a, b) => b.dateIso.localeCompare(a.dateIso)).slice(0, 10).map(s => ({
        date: s.date, type: s.cles['type_seance'] || '—', duree: s.cles['duree'] || null,
        rpe: s.cles['rpe'] || null, charge: s.cles['charge_interne'] || null,
        distance_hi: s.cles['distance_hi'] || null, sprints: s.cles['sprints'] || null,
      }))

    const gps: any = { distance: 0, distance_hi: 0, sprint_distance: 0, sprints: 0, accel: 0, decel: 0, vmax: 0, charge_gps: 0, n: 0 }
    for (const s of Object.values(seances)) {
      if (!s.dateIso || s.dateIso < j7) continue
      gps.n++
      gps.distance += Number(s.cles['distance_totale'] || 0)
      gps.distance_hi += Number(s.cles['distance_hi'] || 0)
      gps.sprint_distance += Number(s.cles['sprint_distance'] || 0)
      gps.sprints += Number(s.cles['sprints'] || 0)
      gps.accel += Number(s.cles['accelerations'] || 0)
      gps.decel += Number(s.cles['decelerations'] || 0)
      gps.charge_gps += Number(s.cles['charge_gps'] || 0)
      const vm = Number(s.cles['vitesse_max'] || 0); if (vm > gps.vmax) gps.vmax = vm
    }

    const num = (v: any) => (v !== '' && v != null) ? Number(v) : null
    const tousMatchs = Object.values(seances).filter(s => String(s.cles['type_seance']) === 'match').sort((a, b) => b.dateIso.localeCompare(a.dateIso))
    const matchs = tousMatchs.slice(0, 8).map(s => ({
      date: s.date, note: num(s.cles['note']), buts: num(s.cles['buts']) || 0,
      passes_d: num(s.cles['passes_decisives']) || 0, xg: num(s.cles['xg']), xa: num(s.cles['xa']), minutes: num(s.cles['minutes_jouees']),
    }))
    const aggSum: Record<string, number> = {}, aggCnt: Record<string, number> = {}
    for (const s of tousMatchs) for (const k in s.cles) { const vv = num(s.cles[k]); if (vv == null) continue; aggSum[k] = (aggSum[k] || 0) + vv; aggCnt[k] = (aggCnt[k] || 0) + 1 }
    const matchAgg: Record<string, any> = {}
    for (const kk in aggSum) matchAgg[kk] = { total: Math.round(aggSum[kk] * 100) / 100, moy: aggCnt[kk] ? Math.round(aggSum[kk] / aggCnt[kk] * 10) / 10 : 0 }
    const matchStats = { nb: tousMatchs.length, note_moy: aggCnt['note'] ? Math.round(aggSum['note'] / aggCnt['note'] * 10) / 10 : null, minutes: aggSum['minutes_jouees'] || 0, buts: aggSum['buts'] || 0, passes_d: aggSum['passes_decisives'] || 0 }
    kpiFoot.temps_jeu = matchStats.minutes
    const heatArr = heatmap ? heatmap.split(',').map(v => Number(v) || 0) : []

    const objectifs = (objAll || []).map(o => ({ id: String(o.id || ''), categorie: String(o.categorie || ''), description: String(o.description || ''), statut: String(o.statut || '') }))
    const blessures = (injAll || []).map(r => ({ id: String(r.id || ''), date: r.date ? fmtFR(r.date) : '', type: String(r.type || ''), localisation: String(r.localisation || ''), gravite: String(r.gravite || ''), duree: (r.duree !== '' && r.duree != null) ? Number(r.duree) : null, retour_terrain: r.retour_terrain ? fmtFR(r.retour_terrain) : '', retour_competition: r.retour_competition ? fmtFR(r.retour_competition) : '', statut: String(r.statut || '') }))

    const contexte = _contexteActif(ctxAll || [], now)
    const ctxEtat = (contexte && contexte.etat) ? String(contexte.etat) : 'saison_normale'

    const _n = (x: any) => (x != null && x !== '') ? Number(x) : null
    // >>> MOTEUR CENTRAL — EXACTEMENT le même calcul que l'accueil (getSuiviEquipe) <<<
    // Signaux agrégés sur 7 j (douleur/fatigue = max, sommeil = moyenne), ressenti
    // « renfo » exclu (tagué à part). L'accueil et la fiche partagent cette fonction
    // → un même athlète a forcément la même interprétation dans les deux vues.
    let injActive: any = null
    for (const b of blessures) { if (b.statut === 'indispo' || b.statut === 'retour_progressif') { injActive = b; break } }
    const seances7f = Object.keys(chargeParJour).length
    const beFoot = (beAll || []).filter(rb => { const dI = normDate(rb.date); return dI ? !renfoKeys.has(`${dI}|${String(rb.seance_id || '')}`) : true })
    const sig7 = _aggSignaux(beFoot, now, 7)
    const histoDaysF = _joursDepuis(premiereCharge, now)
    const acwrFiableF = fiabiliteACWR(premiereCharge, contexte, now, acwrCalcF.joursActifs28)
    const etat = evaluerEtatAthlete({
      acwr, acwrFiable: acwrFiableF, seances7: seances7f,
      douleur: sig7.douleur, fatigue: sig7.fatigue, sommeil: sig7.sommeil,
      courbatures: _n(bienetre.courbatures),
      injStatut: injActive ? (injActive.statut as any) : null,
      ctxEtat,
      q: { jours: histoDaysF != null ? histoDaysF : (charge7 > 0 || sig7.wellnessN > 0 ? 7 : 0), wellnessN: sig7.wellnessN, hasCharge: charge7 > 0 || charge28 > 0 },
    })
    const _ctxLabels: Record<string, string> = { deload: 'Déload', retour_vacances: 'Retour vacances', retour_blessure: 'Retour blessure', intensification: 'Intensification' }
    const moteur: any = {
      disponibilite: etat.disponibilite,
      surcharge: etat.surcharge, risque_blessure: etat.risque_blessure, recup: etat.recup,
      reco: etat.reco, confiance: etat.confiance, alertes: etat.alertes,
      acwr_fiable: etat.acwr_fiable, acwr_categorie: etat.acwr_categorie,
    }
    if (etat.acwr_note) moteur.acwr_note = etat.acwr_note
    if (etat.contexte_tag) moteur.contexte_tag = _ctxLabels[etat.contexte_tag] || etat.contexte_tag

    /* ===== ANCIEN MOTEUR FICHE (conservé temporairement pour comparaison — Phase 2 P1) =====
       Remplacé par evaluerEtatAthlete. Il combinait dernière valeur + max récent (14 j),
       une formule de points locale, une échelle dispo propre et NE partageait pas la
       logique de l'accueil → sources des contradictions. Détail conservé en référence :
         douleurM/fatigueM = dernière ; doulMaxR/fatMaxR = max 14 j ; doulEff = max(...)
         surchargeN(ACWR)+contexte ; rbPts ; recScore(sommeil,fatigue,courbatures,fatigue_post)
         dispoN(bad/mid) ; moteur.reco (chaîne if/else)
    ===== */

    return jsonResp({
      athlete_id: athleteId, nom, poste,
      ddn, age, taille, poids, jambe_dominante: jambe, antecedents,
      sexe, club, categorie, date_entree, discipline,
      charge_7j: Math.round(charge7), acwr,
      charge_hebdo: chargeHebdo,
      wellness, bienetre, gps, kpi_foot: kpiFoot,
      seances: listeSeances, renfo_seances,
      matchs, match_stats: matchStats, match_agg: matchAgg, heatmap: heatArr,
      objectifs, blessures, moteur, contexte,
    })
  } catch (err) {
    return jsonResp({ error: String((err as any)?.message || err) })
  }
}

function _contexteActif(rows: any[], now: Date): any {
  if (!rows?.length) return null
  const today0 = parseFR(fmtYMD(now))!
  let best: any = null, bestDebut: Date | null = null
  for (const r of rows) {
    const etat = String(r.etat || '').trim()
    if (!etat) continue
    const d = r.date_debut ? (parseFR(r.date_debut) ?? new Date(r.date_debut + 'T00:00:00Z')) : null
    const f = r.date_fin ? (parseFR(r.date_fin) ?? new Date(r.date_fin + 'T00:00:00Z')) : null
    if (d && today0 < d) continue
    if (f && today0 > f) continue
    if (!bestDebut || (d && d > bestDebut)) { bestDebut = d; best = r }
  }
  if (!best) return null
  let joursRestants: number | null = null
  if (best.date_fin) {
    const ff = parseFR(best.date_fin) ?? new Date(best.date_fin + 'T00:00:00Z')
    if (ff) joursRestants = Math.max(0, Math.round((ff.getTime() - today0.getTime()) / 86_400_000))
  }
  return { id: best.id, etat: best.etat, description: best.note || '', note: best.note || '', date_debut: fmtFR(best.date_debut), date_fin: best.date_fin ? fmtFR(best.date_fin) : null, source: best.source || '', jours_restants: joursRestants }
}

async function handleGetContexte(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ error: 'athlete_id manquant' })
  const { data } = await sb().from('contexte_athlete').select('*').eq('athlete_id', athleteId).order('date_debut', { ascending: false })
  const historique = (data || []).map(r => ({ id: r.id, etat: r.etat, date_debut: fmtFR(r.date_debut), date_fin: r.date_fin ? fmtFR(r.date_fin) : '', source: r.source || '', note: r.note || '' }))
  return jsonResp({ success: true, actif: _contexteActif(data || [], new Date()), historique })
}

async function handleGetTests(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ tests: [] })
  const { data } = await sb().from('tests').select('*').eq('athlete_id', athleteId)
  // groupé par clé avec points (comme Code.gs getTests) → le front lit tests[].points
  const parCle: Record<string, { cle: string; unite: string; points: any[] }> = {}
  for (const r of data || []) {
    const dIso = normDate(r.date); if (!dIso) continue
    const cle = String(r.cle)
    if (!parCle[cle]) parCle[cle] = { cle, unite: String(r.unite || ''), points: [] }
    parCle[cle].points.push({ date: fmtFR(dIso), _t: parseFR(dIso)?.getTime() || 0, valeur: Number(r.valeur) })
  }
  const tests = Object.values(parCle).map(t => {
    t.points.sort((a: any, b: any) => a._t - b._t)
    t.points.forEach((p: any) => { delete p._t })
    return t
  })
  return jsonResp({ tests })
}

// ── POST handlers ─────────────────────────────────────────────────────────────
// ── Données de démo (14 joueurs foot, symptômes variés) ───────────────────────
async function handleSeedDemoFoot(body: any): Promise<Response> {
  const coachId = String(body.coach_id || '')
  if (!coachId) return jsonResp({ success: false, error: 'coach_id manquant' })
  // Chaque profil : w = multiplicateurs de charge [sem0 (récente) → sem3 (ancienne)],
  // fat/dou/som sur l'échelle réelle de l'app 1..5 (fat & dou : 5 = fort ; som : 5 = excellent).
  // zone = localisation de la douleur (si dou ≥ 2) ; injury = blessure active éventuelle.
  const PROF: any[] = [
    // 1) Surcharge pure — ACWR élevé
    { nom: 'Lucas Martin',   poste: 'Milieu',    w: [2.0, 1, 1, 1],       fat: 3, dou: 0, som: 4 },
    // 2) Charge en hausse — à surveiller
    { nom: 'Yanis Benali',   poste: 'Ailier',    w: [1.6, 1, 1, 1],       fat: 3, dou: 0, som: 4 },
    // 3) Fatigue élevée
    { nom: 'Théo Roux',      poste: 'Défenseur', w: [1, 1, 1, 1],         fat: 4, dou: 0, som: 3 },
    // 4) Douleur signalée
    { nom: 'Enzo Petit',     poste: 'Attaquant', w: [1, 1, 1, 1],         fat: 3, dou: 3, som: 4, zone: 'Ischio droit' },
    // 5) Absence — aucune séance sur 7 j
    { nom: 'Adam Klein',     poste: 'Milieu',    w: [0, 1, 1, 1],         fat: 2, dou: 0, som: 4 },
    // 6) Retour progressif + charge qui remonte (risque de rechute)
    { nom: 'Noah Lefort',    poste: 'Gardien',   w: [0.6, 0.6, 0.5, 0],   fat: 2, dou: 1, som: 4,
      injury: { statut: 'retour_progressif', type: 'Entorse', loc: 'Cheville droite', gravite: 'modérée', jDebut: 20, terrain: 5, compet: -10 } },
    // 7-10) Disponibles (référence "au vert")
    { nom: 'Malo Thomas',    poste: 'Ailier',    w: [1, 1, 1, 1],         fat: 2, dou: 0, som: 4 },
    { nom: 'Ruben Aziz',     poste: 'Défenseur', w: [1, 1, 1, 1],         fat: 2, dou: 0, som: 4 },
    { nom: 'Sacha Dubois',   poste: 'Milieu',    w: [1, 1, 1, 1],         fat: 1, dou: 0, som: 5 },
    { nom: 'Gabin Vidal',    poste: 'Attaquant', w: [1, 1, 1, 1],         fat: 2, dou: 0, som: 4 },
    // 11) Indisponible (blessure sévère, ne s'entraîne pas)
    { nom: 'Ilan Faure',     poste: 'Défenseur', w: [0, 0, 1, 1],         fat: 2, dou: 0, som: 4,
      injury: { statut: 'indispo', type: 'Lésion musculaire', loc: 'Ischio gauche', gravite: 'sévère', jDebut: 10, terrain: -14, compet: -28 } },
    // 12) NOUVEAU — Sous-charge / désentraînement (ACWR bas mais présent)
    { nom: 'Rayan Cohen',    poste: 'Milieu',    w: [0.4, 1, 1, 1],       fat: 2, dou: 0, som: 4 },
    // 13) NOUVEAU — Sommeil dégradé
    { nom: 'Nathan Berger',  poste: 'Ailier',    w: [1, 1, 1, 1],         fat: 3, dou: 0, som: 1.5 },
    // 14) NOUVEAU — Cumul critique : surcharge + fatigue + douleur + sommeil (rouge multi-alertes)
    { nom: 'Elias Marchand', poste: 'Attaquant', w: [2.0, 1, 1, 1],       fat: 5, dou: 3, som: 1.5, zone: 'Adducteurs' },
  ]
  // ---- Gabarits par poste pour des données riches (radar, heatmap, GPS, stats) ----
  // Valeurs MOYENNES visées par match (mises à l'échelle par la « qualité » q du joueur).
  const POSTE_MATCH: Record<string, Record<string, number>> = {
    'Attaquant': { buts: 0.6, xg: 0.7, xa: 0.35, tirs: 3.2, tirs_cadres: 1.6, passes_cles: 1.7, centres_reussis: 1.1, passes_decisives: 0.3 },
    'Milieu':    { passes_reussies: 58, passes_progressives: 7.5, ballons_recuperes: 9, pressings_reussis: 11, duels_gagnes: 6.5, passes_cles: 1.4 },
    'Ailier':    { dribbles_reussis: 3.2, centres_reussis: 2.0, passes_cles: 1.9, tirs: 2.4, buts: 0.4, xa: 0.5, passes_decisives: 0.4 },
    'Défenseur': { interceptions: 3.4, tacles_reussis: 3.6, degagements: 6, duels_gagnes: 6.4, fautes: 1.2 },
    'Gardien':   { arrets: 3, xgot_arrete: 0.5, relances_reussies: 19, sorties_aeriennes: 2 },
  }
  // Clés « rares » (0/1 par match, cumulées sur la saison) vs « taux » (moy/match).
  const RARE = new Set(['buts', 'passes_decisives'])
  const FLOAT = new Set(['xg', 'xa', 'xgot_arrete'])
  // Heatmap 18 zones (6 colonnes défense→attaque × 3 lignes), 0..100.
  const POSTE_HEAT: Record<string, number[]> = {
    'Gardien':   [92,55,20,8,4,2, 96,60,22,9,4,2, 90,52,18,7,3,2],
    'Défenseur': [40,72,82,46,18,8, 46,82,92,56,22,10, 42,74,84,48,20,9],
    'Milieu':    [12,46,80,84,48,18, 15,56,92,96,60,22, 12,48,82,86,50,18],
    'Ailier':    [8,20,44,70,82,74, 10,26,56,84,94,86, 30,52,72,80,74,56],
    'Attaquant': [4,10,26,56,84,90, 6,15,40,72,96,94, 5,12,28,58,86,88],
  }
  const POSTE_PHYS: Record<string, [number, number]> = {
    'Gardien': [186, 78], 'Défenseur': [183, 74], 'Milieu': [176, 69], 'Ailier': [174, 66], 'Attaquant': [180, 73],
  }
  // Tests physiques par poste : base réaliste U17 [cle, base, spread, décimales].
  const POSTE_TESTS: Record<string, Array<[string, number, number, number]>> = {
    _default: [['vma', 16.5, 1, 1], ['sprint_30m', 4.3, 0.25, 2], ['cmj', 38, 4, 0], ['yoyo_test', 1800, 300, 0], ['agilite_5_10_5', 5.1, 0.3, 2]],
    'Gardien': [['vma', 15, 1, 1], ['sprint_30m', 4.5, 0.25, 2], ['cmj', 42, 4, 0], ['yoyo_test', 1500, 250, 0], ['agilite_5_10_5', 5.3, 0.3, 2]],
    'Ailier': [['vma', 17.5, 1, 1], ['sprint_30m', 4.1, 0.2, 2], ['cmj', 40, 4, 0], ['yoyo_test', 2000, 300, 0], ['agilite_5_10_5', 4.9, 0.3, 2]],
  }
  const rnd = () => Math.random()
  const ji = (base: number, spread: number) => Math.max(0, Math.round(base + (rnd() * 2 - 1) * spread))
  const jf = (base: number, spread: number, dec = 1) => { const m = Math.pow(10, dec); return Math.max(0, Math.round((base + (rnd() * 2 - 1) * spread) * m) / m) }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const isoOf = (o: number) => new Date(today.getTime() - o * 86400000).toISOString().slice(0, 10)
  // Identifiants de démo simples : login à 4 chiffres + mot de passe partagé,
  // pour pouvoir se connecter en tant que joueur et tester la vue athlète.
  const DEMO_PWD = 'foot1234'
  // On cherche automatiquement un bloc de N logins 4 chiffres consécutifs LIBRES
  // (évite de heurter les vrais athlètes). Nos propres joueurs démo sont ignorés
  // (on va réécrire leurs logins). Repli sur 9001 si rien trouvé (très improbable).
  let loginBase = 9001
  try {
    const { data: allAth } = await sb().from('athletes').select('login,id')
    const taken = new Set<string>()
    for (const a of allAth || []) {
      if (String(a.id || '').startsWith(`demo_${coachId}_`)) continue
      const l = String(a.login || '')
      if (/^\d{4}$/.test(l)) taken.add(l)
    }
    for (let b = 9001; b <= 9999 - PROF.length; b++) {
      let free = true
      for (let k = 0; k < PROF.length; k++) if (taken.has(String(b + k))) { free = false; break }
      if (free) { loginBase = b; break }
    }
  } catch (_) {}
  const logins: string[] = []
  const athRows: any[] = [], indRows: any[] = [], beRows: any[] = [], injRows: any[] = [], testRows: any[] = [], objRows: any[] = []
  for (let n = 0; n < PROF.length; n++) {
    const id = `demo_${coachId}_${n + 1}`
    const p = PROF[n]
    const login = String(loginBase + n)   // bloc de 4 chiffres consécutifs libres (ex. 9005 → 9018)
    logins.push(login)
    const pwdHash = await hashSalted(DEMO_PWD, login)
    // Qualité du joueur (fait varier radar/stats/tests). Les blessés jouent moins bien.
    const q = (p.injury ? 0.7 : 0.85) + rnd() * 0.35
    const [tB, pB] = POSTE_PHYS[p.poste] || [178, 70]
    const jambe = rnd() < 0.75 ? 'Droite' : 'Gauche'
    const anneeN = 2008 + Math.floor(rnd() * 2)   // U17 → nés 2008-2009
    const ddn = `${anneeN}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 27)).padStart(2, '0')}`
    const heat = (POSTE_HEAT[p.poste] || POSTE_HEAT['Milieu']).map(v => Math.max(0, Math.min(100, v + Math.round((rnd() * 2 - 1) * 8)))).join(',')
    athRows.push({ id, login, nom: p.nom, coach_id: coachId, sport: 'foot', poste: p.poste, categorie: 'U17', club: 'Démo FC', sexe: 'H', annees: 5, password_hash: pwdHash,
      ddn, taille: ji(tB, 4), poids: ji(pB, 4), jambe_dominante: jambe, heatmap: heat, date_entree: isoOf(300 + Math.floor(rnd() * 400)), antecedents: '' })
    const base = 520
    for (let o = 27; o >= 0; o--) {
      if (o % 7 !== 0 && o % 7 !== 2 && o % 7 !== 4 && o % 7 !== 6) continue   // ~4 jours actifs/sem.
      const mult = p.w[Math.floor(o / 7)] ?? 1
      if (mult <= 0) continue
      const val = Math.round(base * mult * (0.92 + Math.random() * 0.16))
      const sid = `demo_${id}_${o}`
      indRows.push({ date: isoOf(o), athlete_id: id, seance_id: sid, cle: 'charge_interne', valeur: String(val), unite: 'UA', source: 'demo' })
      // Séance d'entraînement enrichie (type, durée, RPE, GPS) → « dernières séances » lisibles.
      const rpe = Math.max(3, Math.min(9, Math.round(4 + mult * 2 + (rnd() * 2 - 1))))
      const addTr = (cle: string, v: any, u = '') => indRows.push({ date: isoOf(o), athlete_id: id, seance_id: sid, cle, valeur: String(v), unite: u, source: 'demo' })
      addTr('type_seance', 'entrainement')
      addTr('duree', ji(80, 12), 'min'); addTr('rpe', rpe, '')
      addTr('distance_totale', ji(6500, 1200), 'm'); addTr('distance_hi', ji(520, 160), 'm')
      addTr('sprints', ji(14, 6), ''); addTr('vitesse_max', jf(29 + q * 2, 1.5, 1), 'km/h')
      addTr('charge_gps', ji(Math.round(val * 0.7), 40), 'UA')
    }
    for (const o of [1, 3, 5]) {
      // Seul le sommeil est bruité (les alertes fatigue/douleur restent déterministes). Échelle 1..5.
      const jit = (x: number, d: number) => Math.max(1, Math.min(5, Math.round((x + (Math.random() * 2 - 1) * d) * 10) / 10))
      beRows.push({ date: isoOf(o), seance_id: `demobe_${id}_${o}`, athlete_id: id, sommeil: jit(p.som, 0.3), energie: 3, fatigue_musculaire: p.fat, douleur: p.dou, zone_douloureuse: p.dou >= 2 ? (p.zone || 'Genou') : '', ressenti_global: 4, note: '' })
    }
    // ---- Matchs (stats par poste + GPS) → alimente radar, barres, heatmap KPIs ----
    const tmpl = POSTE_MATCH[p.poste] || POSTE_MATCH['Milieu']
    const indispo = p.injury && p.injury.statut === 'indispo'
    const matchOffs = [4, 12, 20, 28, 36, 44, 52]
    matchOffs.forEach((off, mi) => {
      if (indispo && off <= 14) return   // un joueur indisponible n'a pas joué récemment
      const sid = `demomatch_${id}_${mi}`
      const addM = (cle: string, v: any, u = '') => indRows.push({ date: isoOf(off), athlete_id: id, seance_id: sid, cle, valeur: String(v), unite: u, source: 'demo' })
      addM('type_seance', 'match')
      addM('minutes_jouees', [90, 90, 78, 90, 65, 90, 88][mi] ?? 90, 'min')
      addM('note', jf(5.5 + q * 1.2, 0.7, 1), '')
      for (const cle in tmpl) {
        const bv = tmpl[cle] * q
        let v: number
        if (RARE.has(cle)) v = rnd() < bv ? (rnd() < 0.15 ? 2 : 1) : 0
        else if (FLOAT.has(cle)) v = jf(bv, bv * 0.5, 2)
        else v = jf(bv, bv * 0.22, cle === 'passes_reussies' || cle === 'relances_reussies' ? 0 : 1)
        addM(cle, v)
      }
      // GPS de match (plus intense que l'entraînement ; ailier/attaquant courent plus vite).
      const vmaxBase = (p.poste === 'Ailier' || p.poste === 'Attaquant') ? 32 : (p.poste === 'Gardien' ? 26 : 30)
      addM('distance_totale', ji(9800, 900), 'm'); addM('distance_hi', ji(820, 200), 'm')
      addM('sprint_distance', ji(240, 70), 'm'); addM('sprints', ji(22, 6), '')
      addM('accelerations', ji(34, 8), ''); addM('decelerations', ji(33, 8), '')
      addM('vitesse_max', jf(vmaxBase + q, 1.3, 1), 'km/h'); addM('charge_gps', ji(420, 60), 'UA')
    })
    // ---- Tests physiques (2 dates : progression visible) ----
    const testTmpl = POSTE_TESTS[p.poste] || POSTE_TESTS._default
    for (const [cle, b, sp, dec] of testTmpl) {
      testRows.push({ date: isoOf(35), athlete_id: id, cle, valeur: String(jf(b, sp, dec)), unite: '' })
      // 2e mesure plus récente, légèrement meilleure (progression) selon le sens du test.
      const better = jf(b * (['sprint_30m', 'agilite_5_10_5'].includes(cle) ? 0.97 : 1.04), sp * 0.6, dec)
      testRows.push({ date: isoOf(8), athlete_id: id, cle, valeur: String(better), unite: '' })
    }
    // ---- Objectifs (1-2 par joueur, variés) ----
    const OBJS: Array<[string, string]> = [
      ['Physique', 'Améliorer la VMA de 0,5 km/h'],
      ['Technique', 'Fiabiliser le pied faible'],
      ['Tactique', 'Améliorer les prises d’information avant réception'],
      ['Match', 'Peser davantage dans le dernier tiers'],
    ]
    const nObj = 1 + Math.floor(rnd() * 2)
    for (let k = 0; k < nObj; k++) {
      const o2 = OBJS[(n + k) % OBJS.length]
      objRows.push({ id: `demoobj_${coachId}_${n + 1}_${k}`, athlete_id: id, categorie: o2[0], description: o2[1], statut: rnd() < 0.3 ? 'atteint' : 'en_cours', date: isoOf(60 + k * 20) })
    }
    // ---- Historique de blessure (une blessure passée « rétablie » pour ~1 joueur sur 2) ----
    if (!p.injury && rnd() < 0.5) {
      const past = [['Contracture', 'Mollet gauche', 'légère'], ['Entorse', 'Cheville gauche', 'modérée'], ['Tendinite', 'Genou droit', 'légère']][Math.floor(rnd() * 3)]
      injRows.push({ id: `demoinjp_${coachId}_${n + 1}`, athlete_id: id, date: isoOf(90 + Math.floor(rnd() * 60)), type: past[0], localisation: past[1], gravite: past[2], duree: '', retour_terrain: isoOf(70), retour_competition: isoOf(60), statut: 'retabli' })
    }
    if (p.injury) {
      const inj = p.injury
      injRows.push({ id: `demoinj_${coachId}_${n + 1}`, athlete_id: id, date: isoOf(inj.jDebut), type: inj.type, localisation: inj.loc, gravite: inj.gravite, duree: '', retour_terrain: isoOf(inj.terrain), retour_competition: isoOf(inj.compet), statut: inj.statut })
    }
  }
  try {
    // Idempotent : purge les données démo existantes avant de régénérer (évite les doublons de charge/bien-être).
    // Les joueurs démo sont identifiés par leur id (demo_{coachId}_*), pas par le login (désormais simple).
    const { data: prev } = await sb().from('athletes').select('id').eq('coach_id', coachId).like('id', 'demo_%')
    const prevIds = (prev || []).map((r: any) => String(r.id))
    if (prevIds.length) {
      for (const t of ['indicateurs', 'bien_etre', 'blessures', 'performances', 'tests', 'objectifs']) {
        try { await sb().from(t).delete().in('athlete_id', prevIds) } catch (_) {}
      }
    }
    const { error: upErr } = await sb().from('athletes').upsert(athRows, { onConflict: 'id' })
    if (upErr) return jsonResp({ success: false, error: 'Upsert athlètes : ' + upErr.message })
    if (indRows.length) await sb().from('indicateurs').insert(indRows)
    if (beRows.length) await sb().from('bien_etre').insert(beRows)
    if (injRows.length) await sb().from('blessures').upsert(injRows, { onConflict: 'id' })
    if (testRows.length) await sb().from('tests').insert(testRows)
    if (objRows.length) await sb().from('objectifs').upsert(objRows, { onConflict: 'id' })
  } catch (e: any) { return jsonResp({ success: false, error: String((e && e.message) || e) }) }
  // Auto-test connexion : relit le 1er joueur démo et vérifie que foot1234 sera accepté.
  let login_test: any = null
  try {
    const { data: chk } = await sb().from('athletes').select('login,password_hash').eq('id', athRows[0].id).single()
    if (chk) {
      const storedHash = String(chk.password_hash || '')
      const calc = await hashSalted(DEMO_PWD, String(chk.login))
      login_test = { login: String(chk.login), ok: storedHash === calc, storedLen: storedHash.length }
    }
  } catch (e: any) { login_test = { error: String((e && e.message) || e) } }
  return jsonResp({ success: true, joueurs: athRows.length, charges: indRows.length, bienetre: beRows.length, blessures: injRows.length, tests: testRows.length, objectifs: objRows.length, logins, password: DEMO_PWD, login_test })
}

async function handleClearDemoFoot(body: any): Promise<Response> {
  const coachId = String(body.coach_id || '')
  if (!coachId) return jsonResp({ success: false, error: 'coach_id manquant' })
  const { data: demos } = await sb().from('athletes').select('id').eq('coach_id', coachId).like('id', 'demo_%')
  const ids = (demos || []).map((r: any) => String(r.id))
  if (!ids.length) return jsonResp({ success: true, supprimes: 0 })
  // Toutes les tables filles possibles : sinon une contrainte de clé étrangère
  // (ex. programme de renfo ajouté par le prépa) bloque la suppression → les
  // joueurs « réapparaissent ». Les tables inexistantes échouent sans gravité.
  const childTables = ['indicateurs', 'bien_etre', 'blessures', 'performances', 'programme',
    'tests', 'objectifs', 'commentaires', 'poids_historique', 'contexte_athlete',
    'google_health_tokens', 'push_subscriptions']
  for (const t of childTables) {
    try { await sb().from(t).delete().in('athlete_id', ids) } catch (_) {}
  }
  const { error: delErr } = await sb().from('athletes').delete().in('id', ids)
  if (delErr) return jsonResp({ success: false, error: 'Suppression bloquée : ' + delErr.message })
  // Vérifie ce qui reste réellement (compte réel supprimé)
  const { data: rest } = await sb().from('athletes').select('id').in('id', ids)
  const restants = (rest || []).length
  return jsonResp({ success: true, supprimes: ids.length - restants, restants })
}

const STAFF_ROLES = ['coach', 'prepa']   // (kine plus tard) ; l'ancien "coach_solo" = "coach"
async function handleRegisterCoach(body: any): Promise<Response> {
  const login = body.login?.trim(), pwd = body.password?.trim(), nom = body.nom?.trim() || body.login, sport = body.sport || 'muscu'
  const role = STAFF_ROLES.includes(String(body.role || '')) ? String(body.role) : 'coach'
  if (!login || !pwd) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const { data: existing } = await sb().from('coachs').select('coach_id').eq('login', login).single()
  if (existing) return jsonResp({ success: false, error: 'Cet identifiant coach est déjà utilisé.' })
  const hash = await hashSalted(pwd, login)
  const { data: allCoachs } = await sb().from('coachs').select('coach_id')
  let maxCoach = 0
  for (const r of allCoachs || []) { const n = Number(r.coach_id); if (!isNaN(n) && n > maxCoach) maxCoach = n }
  const newId = String(maxCoach + 1)
  const { data, error } = await sb().from('coachs').insert({ coach_id: newId, login, nom, password_hash: hash, sport, role }).select().single()
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true, coach: { coach_id: data.coach_id, nom: data.nom, sport: String(sport || '').trim() || 'muscu', role } })
}

async function handleSupprimerCompte(body: any): Promise<Response> {
  const athleteId = body.athlete_id
  if (!athleteId) return jsonResp({ success: false, error: 'athlete_id manquant' })
  await Promise.all([
    sb().from('performances').delete().eq('athlete_id', athleteId),
    sb().from('bien_etre').delete().eq('athlete_id', athleteId),
    sb().from('programme').delete().eq('athlete_id', athleteId),
    sb().from('indicateurs').delete().eq('athlete_id', athleteId),
    sb().from('poids_historique').delete().eq('athlete_id', athleteId),
    sb().from('tests').delete().eq('athlete_id', athleteId),
    sb().from('commentaires').delete().eq('athlete_id', athleteId),
  ])
  await sb().from('athletes').delete().eq('id', athleteId)
  return jsonResp({ success: true })
}

async function handleCoachCreerAthlete(body: any): Promise<Response> {
  const { coach_id, login, password, annees, strategie, ddn, taille, sexe } = body
  const nom = (body.prenom || body.nom || '').trim()
  if (!coach_id || !nom || !login || !password) return jsonResp({ success: false, error: 'Champs manquants' })
  const { data: existing } = await sb().from('athletes').select('id').eq('login', login).single()
  if (existing) return jsonResp({ success: false, error: 'Ce login est déjà utilisé.' })
  const hash = await hashSalted(password, login)
  const { data: coach } = await sb().from('coachs').select('sport').eq('coach_id', coach_id).single()
  const newId = await nextAthleteId()
  const { data, error } = await sb().from('athletes').insert({ id: newId, login, nom, password_hash: hash, coach_id, sport: coach?.sport || 'muscu', annees: annees || 0, strategie: strategie || '', ddn: ddn || null, taille: taille || null, sexe: sexe || null }).select().single()
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true, id: data.id, nom: data.nom })
}

async function handleSaveSportCoach(body: any): Promise<Response> {
  const { coach_id, sport } = body
  if (!coach_id || !sport) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('coachs').update({ sport }).eq('coach_id', coach_id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveTest(body: any): Promise<Response> {
  const { athlete_id, cle, valeur, unite, date } = body
  if (!athlete_id || !cle || valeur === undefined || valeur === '') return jsonResp({ success: false, error: 'Champs manquants' })
  const { error } = await sb().from('tests').insert({ date: normDate(date) || fmtYMD(new Date()), athlete_id, cle, valeur: String(Number(valeur) || 0), unite: unite || '' })
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

async function handleSaveSeance(data: any[]): Promise<Response> {
  if (!data?.length) return jsonResp({ erreur: 'Données manquantes' })

  // data = array of arrays: [date, semaine, seance_id, nom, athlete_id, exercice, muscle, exercice_id, serie, charge, reps, rpe, repos, volume]
  // colonnes numériques → coercition ('' / NaN → null) sinon Postgres rejette tout l'insert
  const num = (v: any) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v)
  const rows = data.map((r: any[]) => ({
    date: normDate(r[0]) || r[0], semaine: num(r[1]), seance_id: r[2], nom: r[3], athlete_id: String(r[4]),
    exercice: r[5], muscle: r[6], exercice_id: r[7] != null ? String(r[7]) : null, serie: num(r[8]),
    charge: num(r[9]), reps: num(r[10]), rpe: num(r[11]), repos: num(r[12]), volume: num(r[13]),
  }))

  const { error: perfError } = await sb().from('performances').insert(rows)
  if (perfError) return jsonResp({ erreur: perfError.message })

  // Double-write to indicateurs: aggregate per seance
  const seanceMap: Record<string, any> = {}
  for (const r of rows) {
    if (!seanceMap[r.seance_id]) seanceMap[r.seance_id] = { date: r.date, athlete_id: r.athlete_id, tonnage: 0, nb_series: 0, rpe_sum: 0, rpe_count: 0, exercices: new Set<string>(), muscles: new Set<string>() }
    const s = seanceMap[r.seance_id]
    s.tonnage += (Number(r.charge) || 0) * (Number(r.reps) || 0)
    s.nb_series++
    if (r.rpe) { s.rpe_sum += Number(r.rpe); s.rpe_count++ }
    if (r.exercice) s.exercices.add(r.exercice)
    if (r.muscle) s.muscles.add(r.muscle)
  }

  const indicRows: any[] = []
  for (const [sid, s] of Object.entries(seanceMap) as [string, any][]) {
    const base = { date: s.date, athlete_id: s.athlete_id, seance_id: sid, source: 'muscu' }
    indicRows.push({ ...base, cle: 'tonnage_total', valeur: String(Math.round(s.tonnage)), unite: 'kg' })
    indicRows.push({ ...base, cle: 'nb_series', valeur: String(s.nb_series), unite: '' })
    if (s.rpe_count) indicRows.push({ ...base, cle: 'rpe_moyen', valeur: String(Math.round(s.rpe_sum / s.rpe_count * 10) / 10), unite: '' })
    indicRows.push({ ...base, cle: 'exercices', valeur: [...s.exercices].join(','), unite: '' })
    indicRows.push({ ...base, cle: 'muscles', valeur: [...s.muscles].join(','), unite: '' })
  }

  // Per-exercise sub-rows
  const exoAgg: Record<string, any> = {}
  for (const r of rows) {
    const eid = r.exercice_id || r.exercice?.replace(/\s+/g, '_') || 'exo'
    const key = `${r.seance_id}||${eid}`
    if (!exoAgg[key]) exoAgg[key] = { date: r.date, athlete_id: r.athlete_id, seance_id: r.seance_id + '_exo_' + eid, tonnage: 0 }
    exoAgg[key].tonnage += (Number(r.charge) || 0) * (Number(r.reps) || 0)
  }
  for (const e of Object.values(exoAgg) as any[]) {
    indicRows.push({ date: e.date, athlete_id: e.athlete_id, seance_id: e.seance_id, source: 'muscu', cle: 'tonnage_exo', valeur: String(Math.round(e.tonnage)), unite: 'kg' })
  }

  if (indicRows.length) await sb().from('indicateurs').insert(indicRows)
  return jsonResp({ ok: true })
}

// ── Notifications push (Étape A : messages) ───────────────────────────────────
let _vapidReady: boolean | null = null
function _vapidInit(): boolean {
  if (_vapidReady !== null) return _vapidReady
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!pub || !priv) { _vapidReady = false; return false }
  try {
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:portefaixvincent@gmail.com', pub, priv)
    _vapidReady = true
  } catch (_) { _vapidReady = false }
  return _vapidReady
}

// Envoie une notif push à tous les abonnements d'un athlète. Best-effort :
// n'échoue jamais l'appelant, et purge les abonnements morts (404/410).
async function sendPushToAthlete(athlete_id: string, payload: Record<string, unknown>): Promise<void> {
  if (!_vapidInit()) return
  const { data: subs } = await sb().from('push_subscriptions').select('*').eq('athlete_id', String(athlete_id))
  if (!subs?.length) return
  const body = JSON.stringify(payload)
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)
    } catch (err: any) {
      const code = err && (err.statusCode || err.status)
      if (code === 404 || code === 410) { try { await sb().from('push_subscriptions').delete().eq('endpoint', s.endpoint) } catch (_) {} }
    }
  }))
}

async function handleSavePushSub(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const endpoint = String(body.endpoint || '')
  const p256dh = String(body.p256dh || '')
  const auth = String(body.auth || '')
  if (!athlete_id || !endpoint || !p256dh || !auth) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const row = { athlete_id, endpoint, p256dh, auth, user_agent: String(body.user_agent || ''), created_at: new Date().toISOString() }
  const { error } = await sb().from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

async function handleDeletePushSub(body: any): Promise<Response> {
  const endpoint = String(body.endpoint || '')
  if (!endpoint) return jsonResp({ success: false, error: 'endpoint manquant' })
  const { error } = await sb().from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

// Diagnostic : envoie une notif de test à l'athlète et renvoie précisément quel
// maillon casse (secrets VAPID absents ? aucun abonnement ? web-push en erreur ?).
async function handleTestPush(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const vapid = _vapidInit()
  const { data: subs, error: selErr } = await sb().from('push_subscriptions').select('*').eq('athlete_id', athlete_id)
  if (selErr) return jsonResp({ success: false, stage: 'table', vapid, error: selErr.message })
  const results: any[] = []
  if (vapid && subs?.length) {
    const payload = JSON.stringify({ title: '🔔 Test Novalyz', body: 'Si tu vois ceci, les notifications marchent !', tag: 'novalyz-test', url: './' })
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        results.push({ ok: true })
      } catch (err: any) {
        const code = err && (err.statusCode || err.status)
        results.push({ ok: false, code: code || null, msg: String((err && err.message) || err).slice(0, 300) })
        if (code === 404 || code === 410) { try { await sb().from('push_subscriptions').delete().eq('endpoint', s.endpoint) } catch (_) {} }
      }
    }
  }
  return jsonResp({ success: true, vapid, subsFound: subs?.length || 0, sent: results.filter(r => r.ok).length, results })
}

// ── Google Health API (montre Fitbit via compte Google) ───────────────────────
// Étape A : connexion OAuth (échange du code, stockage des jetons). La synchro
// des activités viendra dans une étape suivante.
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

async function handleGoogleHealthCallback(body: any): Promise<Response> {
  const code = String(body.code || '')
  const redirect_uri = String(body.redirect_uri || '')
  const athlete_id = String(body.athlete_id || '')
  if (!code || !redirect_uri || !athlete_id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || ''
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || ''
  if (!clientId || !clientSecret) return jsonResp({ success: false, error: 'Secrets Google absents côté serveur (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)' })
  const form = new URLSearchParams()
  form.set('code', code)
  form.set('client_id', clientId)
  form.set('client_secret', clientSecret)
  form.set('redirect_uri', redirect_uri)
  form.set('grant_type', 'authorization_code')
  let tok: any
  try {
    const r = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() })
    tok = await r.json().catch(() => ({}))
    if (!r.ok) return jsonResp({ success: false, error: (tok && (tok.error_description || tok.error)) || ('HTTP ' + r.status) })
  } catch (e: any) { return jsonResp({ success: false, error: String((e && e.message) || e) }) }
  if (!tok.access_token) return jsonResp({ success: false, error: 'Aucun jeton reçu de Google' })
  const expiresAt = new Date(Date.now() + (Number(tok.expires_in || 3600) * 1000)).toISOString()
  const row: any = { athlete_id, access_token: tok.access_token, expires_at: expiresAt, scope: tok.scope || '', updated_at: new Date().toISOString() }
  if (tok.refresh_token) row.refresh_token = tok.refresh_token   // absent si l'utilisateur a déjà autorisé une fois
  const { error } = await sb().from('google_health_tokens').upsert(row, { onConflict: 'athlete_id' })
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true, hasRefresh: !!tok.refresh_token, scope: tok.scope || '' })
}

async function handleGoogleHealthStatus(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, connected: false })
  const { data, error } = await sb().from('google_health_tokens').select('athlete_id, scope, updated_at, refresh_token').eq('athlete_id', athlete_id).maybeSingle()
  if (error) return jsonResp({ success: false, connected: false, error: error.message })
  return jsonResp({ success: true, connected: !!data, scope: (data && data.scope) || '', hasRefresh: !!(data && data.refresh_token) })
}

async function handleGoogleHealthDisconnect(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const { error } = await sb().from('google_health_tokens').delete().eq('athlete_id', athlete_id)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

// Renvoie un access_token valide (rafraîchi si expiré) pour un athlète.
async function _googleAccessToken(athlete_id: string): Promise<{ token: string | null; error?: string }> {
  const { data, error } = await sb().from('google_health_tokens').select('*').eq('athlete_id', athlete_id).maybeSingle()
  if (error) return { token: null, error: error.message }
  if (!data) return { token: null, error: 'non connecté' }
  const now = Date.now()
  const exp = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (data.access_token && exp > now + 60000) return { token: data.access_token }
  if (!data.refresh_token) return { token: data.access_token || null, error: data.access_token ? undefined : 'jeton expiré (refresh absent — reconnecte la montre)' }
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || ''
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || ''
  const form = new URLSearchParams()
  form.set('client_id', clientId); form.set('client_secret', clientSecret)
  form.set('refresh_token', data.refresh_token); form.set('grant_type', 'refresh_token')
  try {
    const r = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() })
    const tok = await r.json().catch(() => ({}))
    if (!r.ok || !tok.access_token) return { token: null, error: (tok && (tok.error_description || tok.error)) || ('refresh HTTP ' + r.status) }
    const expiresAt = new Date(Date.now() + (Number(tok.expires_in || 3600) * 1000)).toISOString()
    await sb().from('google_health_tokens').update({ access_token: tok.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() }).eq('athlete_id', athlete_id)
    return { token: tok.access_token }
  } catch (e: any) { return { token: null, error: String((e && e.message) || e) } }
}

// Explorateur (temporaire) : renvoie le JSON brut de l'API pour un type de
// donnée, afin de caler l'affichage sur la vraie structure des réponses.
async function handleGoogleHealthProbe(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const dataType = String(body.dataType || 'exercise').trim()
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const { token, error } = await _googleAccessToken(athlete_id)
  if (!token) return jsonResp({ success: false, stage: 'token', error: error || 'pas de token' })
  // On liste sans filtre de dates (la syntaxe de filtre dépend du type) pour
  // voir la structure réelle des points de données.
  const url = `https://health.googleapis.com/v4/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints?pageSize=20`
  try {
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
    const txt = await r.text()
    let json: any = null; try { json = JSON.parse(txt) } catch (_) {}
    return jsonResp({ success: r.ok, status: r.status, dataType, raw: (json ?? txt) })
  } catch (e: any) { return jsonResp({ success: false, stage: 'fetch', error: String((e && e.message) || e) }) }
}

// Importe les activités Fitbit (dataType 'exercise') comme séances cardio, dans
// la table indicateurs (seance_id 'cardio_fitbit_<id>' → apparaît dans le bloc
// cardio existant). Ré-exécutable sans doublon (on efface puis réinsère par id).
async function handleGoogleHealthSync(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const { token, error } = await _googleAccessToken(athlete_id)
  if (!token) return jsonResp({ success: false, stage: 'token', error: error || 'pas de token' })
  // Récupère jusqu'à ~200 activités (5 pages de 50).
  let points: any[] = []
  let pageToken = ''
  try {
    for (let i = 0; i < 5; i++) {
      const u = `https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints?pageSize=50` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
      const r = await fetch(u, { headers: { 'Authorization': 'Bearer ' + token } })
      if (!r.ok) { const t = await r.text(); return jsonResp({ success: false, stage: 'fetch', status: r.status, error: t.slice(0, 300) }) }
      const j = await r.json()
      const dp = j.dataPoints || []
      points = points.concat(dp)
      pageToken = j.nextPageToken || ''
      if (!pageToken || dp.length === 0) break
    }
  } catch (e: any) { return jsonResp({ success: false, stage: 'fetch', error: String((e && e.message) || e) }) }

  // Types "musculation" exclus du cardio (déjà suivis ailleurs dans l'app).
  const MUSCU_TYPES = new Set(['WEIGHT_MACHINES', 'WEIGHTLIFTING', 'STRENGTH_TRAINING', 'STRENGTH', 'BODYWEIGHT'])
  // Fitbit exerciseType → code cardio interne de l'app (labels/icônes/couleurs).
  const TYPE_MAP: Record<string, string> = {
    WALKING: 'marche_normale', HIKING: 'marche_inclinee',
    RUNNING: 'footing', JOGGING: 'footing', TREADMILL: 'footing', TREADMILL_RUNNING: 'footing',
    BIKING: 'velo', OUTDOOR_BIKE: 'velo', MOUNTAIN_BIKING: 'velo', SPINNING: 'velo', INDOOR_BIKE: 'velo',
    SWIMMING: 'natation',
    ROWING_MACHINE: 'rameur', ROWING: 'rameur',
    HIIT: 'hiit', INTERVAL_WORKOUT: 'hiit', INTERVAL_TRAINING: 'hiit',
    ELLIPTICAL: 'elliptique',
    BOXING: 'boxe', KICKBOXING: 'boxe', MARTIAL_ARTS: 'boxe',
  }
  const cutoff = Date.now() - 180 * 86400000   // 180 derniers jours
  const rowsToInsert: any[] = []
  let imported = 0
  for (const p of points) {
    const ex = p.exercise
    if (!ex || !ex.interval || !ex.interval.startTime) continue
    if (MUSCU_TYPES.has(String(ex.exerciseType || '').toUpperCase())) continue
    const t = Date.parse(ex.interval.startTime)
    if (isNaN(t) || t < cutoff) continue
    const idMatch = String(p.name || '').match(/dataPoints\/(\d+)/)
    const dpId = idMatch ? idMatch[1] : String(t)
    const sid = `cardio_fitbit_${dpId}`
    const offsetSec = parseInt(String(ex.interval.startUtcOffset || '0').replace('s', ''), 10) || 0
    const date = new Date(t + offsetSec * 1000).toISOString().slice(0, 10)
    const m = ex.metricsSummary || {}
    const dureeMin = Math.round((parseInt(String(ex.activeDuration || '0').replace('s', ''), 10) || 0) / 60)
    const distanceKm = m.distanceMillimeters ? Number(m.distanceMillimeters) / 1_000_000 : 0
    const add = (cle: string, valeur: string, unite: string) => rowsToInsert.push({ date, athlete_id, seance_id: sid, cle, valeur, unite, source: 'fitbit' })
    const typeCode = TYPE_MAP[String(ex.exerciseType || '').toUpperCase()] || 'autre'
    add('type_cardio', typeCode, '')
    if (dureeMin > 0) add('duree', String(dureeMin), 'min')
    if (distanceKm > 0) add('distance', String(Math.round(distanceKm * 100) / 100), 'km')
    const fc = Number(m.averageHeartRateBeatsPerMinute)
    if (fc > 0) add('fc_moy', String(fc), 'bpm')
    const cal = Number(m.caloriesKcal)
    if (cal > 0) add('calories', String(cal), 'kcal')
    const pas = Number(m.steps)
    if (pas > 0) add('pas', String(pas), 'pas')
    if (distanceKm > 0 && dureeMin > 0) add('vitesse_moy', String(Math.round((distanceKm / (dureeMin / 60)) * 10) / 10), 'km/h')
    imported++
  }
  // Pas quotidiens (ambiants) : agrégat par jour via dailyRollUp, stockés à part
  // (seance_id 'pasjour_YYYYMMDD') pour ne pas polluer les séances cardio.
  const stepRows: any[] = []
  let stepsImported = 0
  let stepsError: string | null = null
  try {
    const end = new Date()
    const t0 = { hours: 0, minutes: 0, seconds: 0, nanos: 0 }
    const dateNDaysAgo = (n: number) => { const d = new Date(end.getTime() - n * 86400000); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } }
    const endDate = { year: end.getUTCFullYear(), month: end.getUTCMonth() + 1, day: end.getUTCDate() }
    // Contrainte API : windowSizeDays × pageSize ≤ 90 jours (et plage ≤ 90 j)
    // pour 'steps'. On prend 88 jours, fenêtre 1 j, pageSize 90.
    const reqBody = {
      range: {
        start: { date: dateNDaysAgo(88), time: t0 },
        end: { date: endDate, time: t0 },
      }, windowSizeDays: 1, pageSize: 90,
    }
    const url = 'https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp'
    let stepJson: any = null
    const r = await fetch(url, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody),
    })
    if (r.ok) { stepJson = await r.json(); stepsError = null }
    else { stepsError = 'HTTP ' + r.status + ' :: ' + (await r.text()).replace(/\s+/g, ' ').slice(0, 300) }
    if (stepJson) {
      const dps = stepJson.rollupDataPoints || stepJson.dataPoints || []
      for (const dp of dps) {
        const cs = dp.civilStartTime || dp.civilStart || {}
        const cd = cs.date || cs || {}
        const y = cd.year, mo = cd.month, da = cd.day
        if (!y || !mo || !da) continue
        const date = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`
        const count = (dp.steps && dp.steps.countSum) ? Number(dp.steps.countSum) : 0
        if (count > 0) { stepRows.push({ date, athlete_id, seance_id: `pasjour_${date.replace(/-/g, '')}`, cle: 'pas', valeur: String(count), unite: 'pas', source: 'fitbit' }); stepsImported++ }
      }
      // Si rien n'a été importé alors que la requête a réussi, on montre la structure.
      if (stepsImported === 0) {
        stepsError = '0 importé · ' + dps.length + ' points · sample=' + JSON.stringify(dps[0] || Object.keys(stepJson)).slice(0, 320)
      }
    }
  } catch (e: any) { stepsError = String((e && e.message) || e) }

  // Rafraîchissement complet : on efface les séances issues de la montre
  // (cardio_fitbit_) et les pas quotidiens (pasjour_) puis on réinsère.
  try { await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).like('seance_id', 'cardio_fitbit_%') } catch (_) {}
  try { await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).like('seance_id', 'pasjour_%') } catch (_) {}
  const allRows = rowsToInsert.concat(stepRows)
  if (allRows.length) {
    const { error: insErr } = await sb().from('indicateurs').insert(allRows)
    if (insErr) return jsonResp({ success: false, stage: 'insert', error: insErr.message })
  }
  await sb().from('google_health_tokens').update({ updated_at: new Date().toISOString() }).eq('athlete_id', athlete_id)
  return jsonResp({ success: true, imported, stepsImported, stepsError })
}

async function handleSaveCommentaire(body: any): Promise<Response> {
  const { athlete_id, coach_id, texte, message, auteur, auteur_nom, coach_nom } = body
  const msg = message || texte
  if (!athlete_id || !msg) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const d = new Date()
  const dateStr = `${fmtFR(fmtYMD(d))} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const aut = auteur === 'athlete' ? 'athlete' : 'coach'
  const { error } = await sb().from('commentaires').insert({ comment_id: Date.now(), date: dateStr, coach_id: coach_id || '', coach_nom: coach_nom || '', athlete_id, message: msg, lu: false, auteur: aut, auteur_nom: auteur_nom || '' })
  if (error) return jsonResp({ success: false, error: error.message })
  // Notif push : seul le message du coach → athlète déclenche une notif (Étape A).
  if (aut === 'coach') {
    const expediteur = String(coach_nom || auteur_nom || 'Ton coach')
    const apercu = msg.length > 90 ? msg.slice(0, 87) + '…' : msg
    try { await sendPushToAthlete(String(athlete_id), { title: `💬 ${expediteur}`, body: apercu, tag: 'novalyz-msg', target: 'conversation' }) } catch (_) {}
  }
  return jsonResp({ success: true })
}

async function handleMarquerCommentairesLus(body: any): Promise<Response> {
  const ids = (body.ids || []).map((x: any) => Number(x)).filter((n: number) => !isNaN(n))
  if (ids.length) {
    const { error } = await sb().from('commentaires').update({ lu: true }).in('comment_id', ids)
    if (error) return jsonResp({ success: false, error: error.message })
  }
  return jsonResp({ success: true })
}

async function handleSupprimerCommentaire(body: any): Promise<Response> {
  const { id } = body
  if (!id) return jsonResp({ success: false, error: 'id manquant' })
  const { error } = await sb().from('commentaires').delete().eq('comment_id', id)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

async function handleSaveObjectif(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const objectif = String(body.objectif ?? body.strategie ?? '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  // table objectif : une ligne par athlète (colonne objectif = chaîne stratégie)
  const { data: existing } = await sb().from('objectif').select('id').eq('athlete_id', athlete_id).limit(1)
  if (existing?.length) {
    await sb().from('objectif').update({ objectif }).eq('id', existing[0].id)
  } else {
    await sb().from('objectif').insert({ athlete_id, objectif })
  }
  // garde athletes.strategie en phase (lu par la réponse de login)
  await sb().from('athletes').update({ strategie: objectif }).eq('id', athlete_id)
  return jsonResp({ success: true })
}

async function handleGetPoids(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
  const { data } = await sb().from('poids_historique').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(30)
  return jsonResp({ ok: true, poids: (data || []).map(r => ({ date: fmtFR(r.date), poids: Number(r.poids) })) })
}

async function handleSavePoids(body: any): Promise<Response> {
  const { athlete_id, poids, date } = body
  const athlete_nom = body.athlete_nom || body.athlete || ''
  if (!athlete_id || poids === undefined) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('poids_historique').insert({ date: normDate(date) || fmtYMD(new Date()), athlete_id, athlete_nom, poids: Number(poids) })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveNote(body: any): Promise<Response> {
  const { athlete_id, note, seance_id } = body
  const athlete_nom = body.athlete || body.athlete_nom || ''
  if (!athlete_id) return jsonResp({ ok: false, error: 'athlete_id manquant' })
  const { error } = await sb().from('notes').insert({ date: normDate(body.date) || fmtYMD(new Date()), athlete_id, athlete_nom, seance_id: seance_id || null, note: note || '' })
  if (error) return jsonResp({ ok: false, error: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveProgrammeLigne(body: any): Promise<Response> {
  const { athlete_id, athlete_nom, seance_id, exercice, series_prevues, reps_mini, reps_max, repos_sec, groupe_id, row_index } = body
  if (!athlete_id || !exercice) return jsonResp({ erreur: 'Paramètres manquants' })
  if (row_index) {
    const { error } = await sb().from('programme').update({ seance_id, exercice, series_prevues, reps_mini, reps_max, repos_sec, groupe_id }).eq('id', row_index)
    if (error) return jsonResp({ erreur: error.message })
  } else {
    const { error } = await sb().from('programme').insert({ athlete_id, athlete_nom: athlete_nom || '', seance_id, exercice, series_prevues, reps_mini, reps_max, repos_sec, groupe_id })
    if (error) return jsonResp({ erreur: error.message })
  }
  return jsonResp({ ok: true })
}

async function handleSupprimerProgrammeLigne(body: any): Promise<Response> {
  const { row_index } = body
  if (!row_index) return jsonResp({ erreur: 'row_index manquant' })
  const { error } = await sb().from('programme').delete().eq('id', row_index)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleDeleteCoach(body: any): Promise<Response> {
  const { coach_id } = body
  if (!coach_id) return jsonResp({ success: false, error: 'coach_id manquant' })
  await sb().from('athletes').update({ coach_id: null }).eq('coach_id', coach_id)
  const { error } = await sb().from('coachs').delete().eq('coach_id', coach_id)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

async function handleSaveBienEtre(body: any): Promise<Response> {
  const { athlete_id, seance_id, date, sommeil, energie, fatigue, douleur, zone, ressenti, note } = body
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  // colonnes numériques : '' ou texte → null (sinon Postgres rejette tout l'insert)
  const num = (v: any) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v)
  const { error } = await sb().from('bien_etre').insert({
    date: normDate(date) || fmtYMD(new Date()), seance_id: seance_id || null, athlete_id,
    sommeil: num(sommeil), energie: num(energie), fatigue_musculaire: num(fatigue), douleur: num(douleur),
    zone_douloureuse: zone != null && zone !== '' ? String(zone) : null,
    ressenti_global: ressenti != null && ressenti !== '' ? String(ressenti) : null,
    note: num(note),
  })
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ ok: true, success: true })
}

async function handleSetPauseAthlete(body: any): Promise<Response> {
  const { athlete_id, debut, fin } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  const valeur = debut ? String(debut) : 'fin'
  const unite = (debut && fin) ? String(fin) : null
  const { error } = await sb().from('indicateurs').insert({ date: fmtYMD(new Date()), athlete_id, seance_id: `pause_${Date.now()}`, cle: 'pause', valeur, unite, source: 'system' })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleMarquerAlerteTraitee(body: any): Promise<Response> {
  const { coach_id, cle, semaine } = body
  if (!coach_id || !cle) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const sem = semaine || fmtYMD(getLundi(new Date()))
  // une ligne par (coach_id, cle) : on met à jour la semaine si elle existe, sinon on insère
  const { data: existing } = await sb().from('alertes_traitees').select('id').eq('coach_id', coach_id).eq('cle', cle).limit(1)
  if (existing?.length) {
    const { error } = await sb().from('alertes_traitees').update({ semaine: sem }).eq('id', existing[0].id)
    if (error) return jsonResp({ success: false, error: error.message })
  } else {
    const { error } = await sb().from('alertes_traitees').insert({ coach_id, cle, semaine: sem })
    if (error) return jsonResp({ success: false, error: error.message })
  }
  return jsonResp({ success: true })
}

async function handleSaveObjectifJoueur(body: any): Promise<Response> {
  const { athlete_id, categorie, description, statut, date, id } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  if (id) {
    const { error } = await sb().from('objectifs').update({ categorie, description, statut }).eq('id', id)
    if (error) return jsonResp({ erreur: error.message })
  } else {
    const { error } = await sb().from('objectifs').insert({ id: `obj_${Date.now()}`, athlete_id, categorie, description, statut: statut || 'en_cours', date: date || fmtYMD(new Date()) })
    if (error) return jsonResp({ erreur: error.message })
  }
  return jsonResp({ ok: true })
}

async function handleDeleteObjectifJoueur(body: any): Promise<Response> {
  const { id } = body
  if (!id) return jsonResp({ erreur: 'id manquant' })
  const { error } = await sb().from('objectifs').delete().eq('id', id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveBlessure(body: any): Promise<Response> {
  const { athlete_id, date, type, localisation, gravite, duree, retour_terrain, retour_competition, statut, id } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  if (id) {
    const { error } = await sb().from('blessures').update({ type, localisation, gravite, duree, retour_terrain, retour_competition, statut }).eq('id', id)
    if (error) return jsonResp({ erreur: error.message })
  } else {
    const { error } = await sb().from('blessures').insert({ id: `bles_${Date.now()}`, athlete_id, date: date || fmtYMD(new Date()), type, localisation, gravite, duree, retour_terrain, retour_competition, statut: statut || 'en_cours' })
    if (error) return jsonResp({ erreur: error.message })
  }
  return jsonResp({ ok: true })
}

async function handleDeleteBlessure(body: any): Promise<Response> {
  const { id } = body
  if (!id) return jsonResp({ erreur: 'id manquant' })
  const { error } = await sb().from('blessures').delete().eq('id', id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveMatch(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'Athlète manquant' })
  const date = normDate(body.date) || fmtYMD(new Date())
  const sid = `m${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const rows: any[] = []
  const add = (cle: string, val: unknown, unite = '', src = 'saisie') => {
    if (val === '' || val == null || isNaN(Number(val))) return
    rows.push({ date, athlete_id, seance_id: sid, cle, valeur: String(Number(val)), unite, source: src })
  }
  rows.push({ date, athlete_id, seance_id: sid, cle: 'type_seance', valeur: 'match', unite: '', source: 'saisie' })
  const duree = Number(body.duree) || 0, rpe = Number(body.rpe) || 0
  if (duree) add('duree', duree, 'min')
  if (rpe) add('rpe', rpe, '1-10')
  if (duree && rpe) add('charge_interne', duree * rpe, 'UA', 'calculé')
  add('minutes_jouees', body.minutes_jouees, 'min')
  add('note', body.note, '/10')
  if (body.heure) rows.push({ date, athlete_id, seance_id: sid, cle: 'heure', valeur: String(body.heure), unite: '', source: 'saisie' })
  add('intensite_prevue', body.intensite_prevue, 'score')
  add('intensite_realisee', body.intensite_realisee, 'score')
  if (body.titulaire != null && body.titulaire !== '') add('titulaire', Number(body.titulaire) ? 1 : 0, 'bool')
  const stats = body.stats || {}
  for (const k in stats) add(String(k), stats[k], 'nb')
  const { error } = await sb().from('indicateurs').insert(rows)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true, seance_id: sid })
}

async function handleSaveBilanAthlete(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'Athlète manquant' })
  const date = normDate(body.date) || fmtYMD(new Date())
  const sid = `bilan_${Date.now()}`
  const CLES = ['sommeil', 'energie', 'fatigue', 'motivation', 'stress', 'courbatures', 'douleur', 'dispo_mentale', 'fatigue_post', 'difficulte_seance', 'satisfaction', 'douleur_post']
  const vals = body.vals || {}
  const rows: any[] = []
  for (const c of CLES) {
    const v = vals[c]
    if (v === '' || v == null || isNaN(Number(v))) continue
    rows.push({ date, athlete_id, seance_id: sid, cle: c, valeur: String(Number(v)), unite: '1-5', source: 'saisie' })
  }
  if (body.commentaire) rows.push({ date, athlete_id, seance_id: sid, cle: 'commentaire', valeur: String(body.commentaire), unite: 'texte', source: 'saisie' })
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ success: false, error: error.message })
  }
  return jsonResp({ success: true, seance_id: sid })
}

async function handleSaveContexte(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const etat = String(body.etat || body.cle || '').trim()
  if (!athlete_id || !etat) return jsonResp({ success: false, error: 'athlete_id ou etat manquant' })
  const debut = normDate(body.date_debut) || fmtYMD(new Date())
  const fin = body.date_fin ? normDate(body.date_fin) : null
  const source = String(body.source || 'manuel')
  const note = String(body.note || body.description || '')
  // Clôt les périodes ouvertes débutant avant le nouveau début (veille du nouveau début)
  const { data: openRows } = await sb().from('contexte_athlete').select('*').eq('athlete_id', athlete_id).is('date_fin', null)
  const newD = parseFR(debut)
  if (openRows?.length && newD) {
    const veille = new Date(newD.getTime()); veille.setUTCDate(veille.getUTCDate() - 1)
    const veilleStr = fmtYMD(veille)
    for (const r of openRows) {
      const rowD = r.date_debut ? parseFR(r.date_debut) : null
      if (rowD && rowD <= newD) await sb().from('contexte_athlete').update({ date_fin: veilleStr }).eq('id', r.id)
    }
  }
  const { error } = await sb().from('contexte_athlete').insert({ id: `ctx_${Date.now()}`, athlete_id, etat, date_debut: debut, date_fin: fin, source, note })
  if (error) return jsonResp({ success: false, error: error.message })
  const { data: allRows } = await sb().from('contexte_athlete').select('*').eq('athlete_id', athlete_id)
  return jsonResp({ success: true, actif: _contexteActif(allRows || [], new Date()) })
}

async function handleCloreContexte(body: any): Promise<Response> {
  const id = String(body.id || '')
  const athlete_id = String(body.athlete_id || '')
  if (!id && !athlete_id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const fin = body.date_fin ? normDate(body.date_fin) : fmtYMD(new Date())
  if (id) {
    const { error } = await sb().from('contexte_athlete').update({ date_fin: fin }).eq('id', id)
    if (error) return jsonResp({ success: false, error: error.message })
    return jsonResp({ success: true })
  }
  const { data: openRows } = await sb().from('contexte_athlete').select('id').eq('athlete_id', athlete_id).is('date_fin', null).limit(1)
  if (openRows?.length) {
    const { error } = await sb().from('contexte_athlete').update({ date_fin: fin }).eq('id', openRows[0].id)
    if (error) return jsonResp({ success: false, error: error.message })
    return jsonResp({ success: true })
  }
  return jsonResp({ success: false, error: 'Contexte introuvable' })
}

async function handleSaveCardio(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'Athlète manquant' })
  const sid = `cardio_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const d = normDate(body.date) || fmtYMD(new Date())
  const rows = _buildCardioRows(body, athlete_id, sid, d)
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ success: false, error: error.message })
  }
  return jsonResp({ success: true, seance_id: sid })
}

// Supprime une séance muscu = toutes les lignes performances pour un athlète, un
// type de séance (seance_id) et une date donnés. La date peut être stockée en ISO
// (AAAA-MM-JJ, séances récentes) ou en JJ/MM/AAAA (héritage) → on couvre les deux.
// Supprime aussi le bien-être associé à cette séance (évite un questionnaire orphelin).
async function handleDeleteSeance(body: any): Promise<Response> {
  const athleteId = String(body.athlete_id || '').trim()
  const seanceId = String(body.seance_id || '')
  const iso = normDate(body.date)
  if (!athleteId || !seanceId || !iso) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const fr = fmtFR(iso)
  const r1 = await sb().from('performances').delete().eq('athlete_id', athleteId).eq('seance_id', seanceId).eq('date', iso)
  const r2 = await sb().from('performances').delete().eq('athlete_id', athleteId).eq('seance_id', seanceId).eq('date', fr)
  const err = r1.error || r2.error
  if (err) return jsonResp({ success: false, error: err.message })
  // Nettoie aussi les agrégats indicateurs muscu + le bien-être de cette séance.
  for (const d of [iso, fr]) {
    await sb().from('indicateurs').delete().eq('athlete_id', athleteId).eq('seance_id', seanceId).eq('date', d)
    await sb().from('bien_etre').delete().eq('athlete_id', athleteId).eq('seance_id', seanceId).eq('date', d)
  }
  return jsonResp({ success: true })
}

// Modifie une séance muscu = on remplace intégralement son contenu (comme updateCardio) :
// suppression de l'ancienne version (perf + indicateurs muscu) puis réinsertion via
// saveSeance. `data` = lignes complètes [date, semaine, seance_id, nom, athlete_id,
// exercice, muscle, exercice_id, serie, charge, reps, rpe, repos, volume]. data vide = suppression.
async function handleUpdateSeance(body: any): Promise<Response> {
  const athleteId = String(body.athlete_id || '').trim()
  const seanceId = String(body.seance_id || '')
  const iso = normDate(body.date)
  const data = Array.isArray(body.data) ? body.data : []
  if (!athleteId || !seanceId || !iso) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const fr = fmtFR(iso)
  for (const d of [iso, fr]) {
    await sb().from('performances').delete().eq('athlete_id', athleteId).eq('seance_id', seanceId).eq('date', d)
    await sb().from('indicateurs').delete().eq('athlete_id', athleteId).eq('seance_id', seanceId).eq('date', d)
  }
  if (!data.length) return jsonResp({ success: true, deleted: true })
  const res = await handleSaveSeance(data)
  let j: any = null; try { j = await res.json() } catch (_) { j = null }
  if (j && j.erreur) return jsonResp({ success: false, error: j.erreur })
  return jsonResp({ success: true })
}

async function handleDeleteCardio(body: any): Promise<Response> {
  const { athlete_id, seance_id } = body
  if (!athlete_id || !seance_id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const { error } = await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('seance_id', seance_id)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

async function handleUpdateCardio(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const seance_id = String(body.seance_id || '')
  if (!athlete_id || !seance_id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('seance_id', seance_id)
  const d = normDate(body.date) || fmtYMD(new Date())
  const rows = _buildCardioRows(body, athlete_id, seance_id, d)
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ success: false, error: error.message })
  }
  return jsonResp({ success: true })
}

// ── Router ────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRate(ip)) return jsonResp({ erreur: 'Trop de requêtes' }, 429)

  const url = new URL(req.url)
  const params = url.searchParams

  try {
    if (req.method === 'GET') {
      const action = params.get('action')
      switch (action) {
        case 'ping':                  return jsonResp({ ok: true })
        case 'login':                 return handleLogin(params)
        case 'register':              return handleRegister(params)
        case 'getAppData':            return handleGetAppData(params)
        case 'getLastPerf':           return handleGetLastPerf(params)
        case 'getPoids':              return handleGetPoids(params)
        case 'exercices':             return handleGetExercices()
        case 'loginCoach':            return handleLoginCoach(params)
        case 'getCoachAthletes':      return handleGetCoachAthletes(params)
        case 'getCoachAthleteDetail': return handleGetCoachAthleteDetail(params)
        case 'getCommentaires':       return handleGetCommentaires(params)
        case 'getCoachProgramme':     return handleGetCoachProgramme(params)
        case 'getSeancesDetail':      return handleGetSeancesDetail(params)
        case 'getAlertesTraitees':    return handleGetAlertesTraitees(params)
        case 'getBilanPDF':           return handleGetBilanPDF(params)
        case 'lierAthlete':           return handleLierAthlete(params)
        case 'getSuiviEquipe':        return handleGetSuiviEquipe(params)
        case 'getSuiviJoueur':        return handleGetSuiviJoueur(params)
        case 'getContexte':           return handleGetContexte(params)
        case 'getTests':              return handleGetTests(params)
        default:                      return jsonResp({ erreur: `Action inconnue: ${action}` }, 404)
      }
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const action = body.action
      switch (action) {
        case 'login':                    return handleLogin(new URLSearchParams({ login: body.login, password: body.password }))
        case 'register':                 return handleRegister(new URLSearchParams({ login: body.login, password: body.password, nom: body.nom || '', prenom: body.prenom || '', ddn: body.ddn || '', taille: body.taille || '', annees: String(body.annees || '0'), sport: body.sport || 'muscu' }))
        case 'registerCoach':            return handleRegisterCoach(body)
        case 'seedDemoFoot':             return handleSeedDemoFoot(body)
        case 'clearDemoFoot':            return handleClearDemoFoot(body)
        case 'supprimerCompte':          return handleSupprimerCompte(body)
        case 'coachCreerAthlete':        return handleCoachCreerAthlete(body)
        case 'saveSportCoach':           return handleSaveSportCoach(body)
        case 'saveTest':                 return handleSaveTest(body)
        case 'loginCoach':               return handleLoginCoach(new URLSearchParams({ login: body.login, password: body.password }))
        case 'saveSeance':               return handleSaveSeance(body.data)
        case 'deleteSeance':             return handleDeleteSeance(body)
        case 'updateSeance':             return handleUpdateSeance(body)
        case 'saveCommentaire':          return handleSaveCommentaire(body)
        case 'savePushSub':              return handleSavePushSub(body)
        case 'deletePushSub':            return handleDeletePushSub(body)
        case 'testPush':                 return handleTestPush(body)
        case 'googleHealthCallback':     return handleGoogleHealthCallback(body)
        case 'googleHealthStatus':       return handleGoogleHealthStatus(body)
        case 'googleHealthDisconnect':   return handleGoogleHealthDisconnect(body)
        case 'googleHealthProbe':        return handleGoogleHealthProbe(body)
        case 'googleHealthSync':         return handleGoogleHealthSync(body)
        case 'marquerCommentairesLus':   return handleMarquerCommentairesLus(body)
        case 'supprimerCommentaire':     return handleSupprimerCommentaire(body)
        case 'saveObjectif':             return handleSaveObjectif(body)
        case 'savePoids':                return handleSavePoids(body)
        case 'saveNote':                 return handleSaveNote(body)
        case 'saveProgrammeLigne':       return handleSaveProgrammeLigne(body)
        case 'supprimerProgrammeLigne':  return handleSupprimerProgrammeLigne(body)
        case 'deleteCoach':              return handleDeleteCoach(body)
        case 'saveBienEtre':             return handleSaveBienEtre(body)
        case 'setPauseAthlete':          return handleSetPauseAthlete(body)
        case 'marquerAlerteTraitee':     return handleMarquerAlerteTraitee(body)
        case 'saveObjectifJoueur':       return handleSaveObjectifJoueur(body)
        case 'deleteObjectifJoueur':     return handleDeleteObjectifJoueur(body)
        case 'saveBlessure':             return handleSaveBlessure(body)
        case 'deleteBlessure':           return handleDeleteBlessure(body)
        case 'saveMatch':                return handleSaveMatch(body)
        case 'saveBilanAthlete':         return handleSaveBilanAthlete(body)
        case 'saveContexte':             return handleSaveContexte(body)
        case 'cloreContexte':            return handleCloreContexte(body)
        case 'saveCardio':               return handleSaveCardio(body)
        case 'deleteCardio':             return handleDeleteCardio(body)
        case 'updateCardio':             return handleUpdateCardio(body)
        default:                         return jsonResp({ erreur: `Action inconnue: ${action}` }, 404)
      }
    }

    return jsonResp({ erreur: 'Méthode non supportée' }, 405)
  } catch (e) {
    // On renvoie le vrai message (et l'action visée) : indispensable pour diagnostiquer
    // un plantage lié aux données d'un compte précis. Sans ça le front n'a qu'un 500 opaque.
    const msg = (e && (e as any).message) ? String((e as any).message) : String(e)
    console.error('Handler error:', e)
    return jsonResp({ erreur: 'Erreur serveur : ' + msg, action: params.get('action') || null }, 500)
  }
})
