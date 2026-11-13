import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
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
  if (a <= 10) return 'avance'   // seuils validés 28/10 : 0-3 · 4-7 · 8-10 · 11+
  return 'expert'
}
function getStrategieFromAnnees(annees: number): string {
  const niveau = getNiveauExperience(annees)
  if (niveau === 'debutant') return 'Progression linéaire'
  if (niveau === 'intermediaire') return 'Double progression'
  return 'Progression avancée'
}
// N2 — Années de pratique EFFECTIVES = ancienneté saisie à la création + années
// écoulées depuis la création du compte. Sans ça l'ancienneté reste FIGÉE (un « 3 ans »
// le resterait à vie) et le niveau (débutant→expert) n'évolue jamais dans le temps.
// ── Volume cible PAR NIVEAU (décision porteur 03/11, docs/proposition-volume-par-niveau-2026-11-03.md) ──
// SOURCE UNIQUE des cibles (séries/muscle/semaine, séries indirectes = 0,5) : l'athlète, le coach, le mail,
// le plan de la semaine et le générateur lisent tous `volume_obti` renvoyé par getAppData (= cette table,
// au niveau de l'athlète). La table Supabase `volume_obti` n'est plus lue.
// Sources : Schoenfeld 2017 (≥ 10 séries), Baz-Valle 2022 (12-20 entraînés), ACSM 2009 (débutant : peu suffit).
const _VOL_GRANDS = ['Pectoraux', 'Dos', 'Quadriceps', 'Fessier', 'Ischio']
const _VOL_PETITS = ['Epaule', 'Biceps', 'Triceps', 'Mollets']
const VOLUME_CIBLES_NIVEAU: Record<string, Record<string, [number, number]>> = (() => {
  const t = (g: [number, number], p: [number, number], ab: [number, number]) => {
    const o: Record<string, [number, number]> = {}
    _VOL_GRANDS.forEach(m => { o[m] = g }); _VOL_PETITS.forEach(m => { o[m] = p }); o['Abdominaux'] = ab
    return o
  }
  return {
    debutant: t([6, 12], [6, 12], [6, 12]),          // porteur : 6-12 pour tous les muscles
    intermediaire: t([10, 16], [8, 14], [6, 12]),
    avance: t([12, 20], [10, 18], [8, 14]),
    expert: t([12, 20], [10, 18], [8, 14]),        // aucune étude ne distingue avancé et expert
  }
})()
// Zones à développer en priorité (porteur 03/11, docs/zones-prioritaires-2026-11-03.md) : 2 max, choisies par
// l'athlète ou son coach. Règle validée : le MINIMUM d'une zone prioritaire passe au MILIEU de sa fourchette
// (débutant 6-12 → 9-12 ; intermédiaire 10-16 → 13-16), l'optimum ne change pas.
const ZONES_PRIO: Record<string, string[]> = {
  fessiers: ['Fessier'], jambes: ['Quadriceps', 'Ischio'], pectoraux: ['Pectoraux'], dos: ['Dos'],
  epaules: ['Epaule'], bras: ['Biceps', 'Triceps'], abdos: ['Abdominaux'],
}
function zonesPrioMuscles(zones: any): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  ;(Array.isArray(zones) ? zones : []).forEach((z: any) => (ZONES_PRIO[String(z)] || []).forEach(m => { out[m] = true }))
  return out
}
// Muscles que l'athlète a choisi de ne pas travailler en direct (porteur 09/11 : séance trop courte pour tout
// couvrir → « retirer des muscles »). Exclus des cibles de volume : jamais signalés « sous le minimum ».
// Une zone prioritaire ne peut pas être exclue.
const MUSCLES_EXCLUABLES = ['Pectoraux', 'Dos', 'Quadriceps', 'Fessier', 'Ischio', 'Epaule', 'Biceps', 'Triceps', 'Mollets', 'Abdominaux']
function musclesExclusValides(exclus: any, zones?: any): string[] {
  const P = zonesPrioMuscles(zones)
  return [...new Set((Array.isArray(exclus) ? exclus : []).map((m: any) => String(m)))].filter(m => MUSCLES_EXCLUABLES.includes(m) && !P[m])
}
// Lignes au format de l'ancienne table (muscle, series_min_semaine, series_opt_semaine) pour un niveau.
function volumeCiblesRows(niveau: string, zones?: any, exclus?: any): any[] {
  const T = VOLUME_CIBLES_NIVEAU[niveau] || VOLUME_CIBLES_NIVEAU.intermediaire
  const P = zonesPrioMuscles(zones), X = musclesExclusValides(exclus, zones)
  return Object.keys(T).filter(m => !X.includes(m)).map(m => {
    const mn = P[m] ? Math.round((T[m][0] + T[m][1]) / 2) : T[m][0]
    return { muscle: m, series_min_semaine: mn, series_opt_semaine: T[m][1], series_max_semaine: Math.round(T[m][1] * 1.5), prio: !!P[m] }
  })
}

function anneesEffectives(base: any, created_at: any, now: Date): number {
  const b = Number(base) || 0
  if (!created_at) return b
  const t = new Date(created_at).getTime()
  if (isNaN(t)) return b
  const ecoulees = Math.floor((now.getTime() - t) / (365.25 * 86400000))
  return b + (ecoulees > 0 ? ecoulees : 0)
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

// ── Hachage lent « w1 » (10/11, audit P1 — docs/note-hachage-mdp-2026-11-10.md, option C) ──
// w1$<tours>$<sel b64>$<hash b64> = PBKDF2-SHA256(clé = hash s2 existant, sel aléatoire 16 octets, tours).
// On ENVELOPPE le s2 (login + PEPPER + mot de passe) : tous les comptes peuvent être convertis sans connaître
// les mots de passe, et une fuite de la base + PEPPER ne permet plus de tester des milliards de mots de passe
// par seconde. Le nombre de tours est stocké (on pourra l'augmenter sans casser les anciens).
// L'ancien s2 est gardé dans password_hash_s2 (retour arrière) pendant l'observation, puis la colonne sera supprimée.
const W1_TOURS = 600000
function _b64(u: Uint8Array): string { let x = ''; for (const c of u) x += String.fromCharCode(c); return btoa(x) }
function _deb64(t: string): Uint8Array { const x = atob(t); const u = new Uint8Array(x.length); for (let i = 0; i < x.length; i++) u[i] = x.charCodeAt(i); return u }
async function _pbkdf2(materiel: string, sel: Uint8Array, tours: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(materiel), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: tours }, k, 256))
}
async function envelopperS2(s2: string): Promise<string> {
  const sel = crypto.getRandomValues(new Uint8Array(16))
  return 'w1$' + W1_TOURS + '$' + _b64(sel) + '$' + _b64(await _pbkdf2(s2, sel, W1_TOURS))
}
// Conversion des comptes existants s2 → w1 (10/11), par lots (limite de calcul de la fonction Edge).
// Déclenchée par un jeton à usage limité créé en base par le porteur / l'assistant (table jetons_admin,
// service_role seul) : aucun secret dans l'app ni dans les messages. Ne renvoie JAMAIS de hash.
const W1_LOT = 3
async function handleEnvelopperHachages(body: any): Promise<Response> {
  const jeton = String(body.jeton || '')
  if (!/^[0-9a-f-]{36}$/i.test(jeton)) return jsonResp({ success: false, error: 'non autorisé' }, 401)
  const { data: j } = await sb().from('jetons_admin').select('jeton').eq('jeton', jeton).eq('action', 'envelopperHachages').gt('expire', new Date().toISOString()).limit(1)
  if (!j || !j.length) return jsonResp({ success: false, error: 'non autorisé' }, 401)
  let traites = 0, echecs = 0
  for (const [table, col] of [['athletes', 'id'], ['coachs', 'coach_id']] as const) {
    if (traites >= W1_LOT) break
    const { data: rows, error } = await sb().from(table).select(col + ',password_hash').like('password_hash', 's2$%').limit(W1_LOT - traites)
    if (error) return jsonResp({ success: false, error: 'lecture : ' + error.message })
    for (const r of rows || []) {
      const s2 = String((r as any).password_hash)
      const { error: e } = await sb().from(table).update({ password_hash: await envelopperS2(s2), password_hash_s2: s2 }).eq(col, String((r as any)[col])).eq('password_hash', s2)
      if (e) echecs++; else traites++
    }
  }
  const [{ data: ra }, { data: rc }] = await Promise.all([
    sb().from('athletes').select('id').like('password_hash', 's2$%').limit(5000),
    sb().from('coachs').select('coach_id').like('password_hash', 's2$%').limit(5000),
  ])
  return jsonResp({ success: echecs === 0, traites, echecs, restants: (ra || []).length + (rc || []).length })
}
// Comparaison en temps constant (pas d'arrêt au premier caractère différent).
function _egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
async function _verifW1(s2: string, stored: string): Promise<boolean> {
  const p = stored.split('$'); if (p.length !== 4) return false
  const tours = Number(p[1]); if (!(tours >= 1000 && tours <= 5000000)) return false
  try { return _egal(_b64(await _pbkdf2(s2, _deb64(p[2]), tours)), p[3]) } catch (_) { return false }
}
// upgrade = { s2 } quand le compte est encore dans un ancien format (connexion réussie) : seule la
// CONNEXION le convertit en w1 (_passerEnW1) — pas de calcul lent inutile ailleurs (suppression de compte…).
async function verifyPwd(pwd: string, stored: string, salt: string): Promise<{ ok: boolean; upgrade: { s2: string } | null }> {
  if (!stored) return { ok: false, upgrade: null }
  if (stored.startsWith('w1$')) return { ok: await _verifW1(await hashSalted(pwd, salt), stored), upgrade: null }
  if (stored.startsWith('s2$')) {
    const s2 = await hashSalted(pwd, salt)
    return _egal(stored, s2) ? { ok: true, upgrade: { s2 } } : { ok: false, upgrade: null }
  }
  if (_egal(stored, await sha256hex(pwd))) return { ok: true, upgrade: { s2: await hashSalted(pwd, salt) } }
  return { ok: false, upgrade: null }
}
async function _passerEnW1(table: 'athletes' | 'coachs', col: string, id: string, up: { s2: string }, ancien: string): Promise<void> {
  try { await _majMotDePasse(table, col, id, { password_hash: await envelopperS2(up.s2), password_hash_s2: up.s2 }, ancien) } catch (_) {}
}
// Champs à stocker pour un mot de passe (inscription, changement, réinitialisation) : w1 + s2 de secours.
async function hashPourStockage(pwd: string, salt: string): Promise<{ password_hash: string; password_hash_s2: string }> {
  const s2 = await hashSalted(pwd, salt)
  return { password_hash: await envelopperS2(s2), password_hash_s2: s2 }
}
// Écrit les champs mot de passe. Si la colonne password_hash_s2 n'existe pas (migration pas appliquée) :
// comportement d'AVANT, on écrit le s2 seul (jamais un w1 sans secours tant que la migration manque).
const _COL_ABSENTE = ['42703', 'PGRST204']
async function _majMotDePasse(table: 'athletes' | 'coachs', col: string, id: string, champs: { password_hash: string; password_hash_s2: string }, si?: string): Promise<{ error: any }> {
  let q: any = sb().from(table).update(champs).eq(col, id); if (si) q = q.eq('password_hash', si)
  const { error } = await q
  if (!error || !_COL_ABSENTE.includes(String((error as any).code || ''))) return { error }
  let q2: any = sb().from(table).update({ password_hash: champs.password_hash_s2 }).eq(col, id); if (si) q2 = q2.eq('password_hash', si)
  return await q2
}
async function _insererAvecMotDePasse(table: 'athletes' | 'coachs', row: any, champs: { password_hash: string; password_hash_s2: string }): Promise<{ data: any; error: any }> {
  const r1 = await sb().from(table).insert({ ...row, ...champs }).select().single()
  if (!r1.error || !_COL_ABSENTE.includes(String((r1.error as any).code || ''))) return r1
  return await sb().from(table).insert({ ...row, password_hash: champs.password_hash_s2 }).select().single()
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
  const seanceMap: Record<string, { date: string; seance_id: string; tonnage: number; exercices: Set<string>; muscles: Set<string> }> = {}

  for (const r of perfs) {
    const charge = Number(r.charge) || 0
    const reps = Number(r.reps) || 0
    const tonnage = charge * reps
    totalTonnage += tonnage
    totalSeries++
    totalReps += reps
    if (r.rpe) { totalRpe += Number(r.rpe); rpeCount++ }
    // séances = jours distincts (comme Code.gs seancesSet.add(dateStr))
    const dIso = normDate(r.date)
    datesSet.add(dIso)

    const exo = r.exercice
    if (exo && (!records[exo] || charge > records[exo].charge || (charge === records[exo].charge && reps > records[exo].reps))) {
      records[exo] = { charge, reps, volume: Number(r.volume) || tonnage, date: fmtFR(r.date) }
    }

    // Une SÉANCE RÉELLE = une DATE réelle. On NE regroupe PAS par seance_id : c'est
    // le NOM/TYPE de séance (« Push », « Full body »…), réutilisé à chaque séance de
    // ce type → sinon toutes les séances d'un même type fusionnent (bug « 36 exos »).
    if (dIso) {
      if (!seanceMap[dIso]) seanceMap[dIso] = { date: dIso, seance_id: String(r.seance_id ?? ''), tonnage: 0, exercices: new Set(), muscles: new Set() }
      seanceMap[dIso].tonnage += tonnage
      if (exo) seanceMap[dIso].exercices.add(exo)
      if (r.muscle) seanceMap[dIso].muscles.add(r.muscle)
    }
  }

  const dernieres_seances = Object.values(seanceMap)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))   // dates ISO yyyy-mm-dd → tri chronologique fiable
    .slice(0, 3)
    .map((s) => ({
      seance_id: s.seance_id,
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
  // Fenêtres pour l'écran Analyses : les 4 de base + périodes longues (3/6/9 mois, an).
  const RECENT_WINDOWS: Record<string, number> = { ...WINDOWS, M3: 90, M6: 180, M9: 270, Y: 365 }
  const KEY_MAP: Record<string, string> = { ACUTE: 'j7', MID: 'j14', CHRONIC: 'j28', LONG: 'j56', M3: 'j90', M6: 'j180', M9: 'j270', Y: 'j365' }
  const result: Record<string, any> = {}
  for (const [key, days] of Object.entries(RECENT_WINDOWS)) {
    const cutoff = fmtYMD(minus(now, days - 1))
    const filtered = perfs.filter(r => normDate(r.date) >= cutoff)
    // séances = nombre de JOURS d'entraînement distincts (comme Code.gs finalizeWindow: w.dates.size)
    const datesSet = new Set(filtered.map(r => normDate(r.date)))
    const seances = datesSet.size
    const tonnage = filtered.reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
    const rpeRows = filtered.filter(r => r.rpe)
    const parMuscle: Record<string, number> = {}
    const seriesMuscle: Record<string, number> = {}
    for (const r of filtered) {
      if (r.muscle) { parMuscle[r.muscle] = (parMuscle[r.muscle] || 0) + ((Number(r.charge) || 0) * (Number(r.reps) || 0)); seriesMuscle[r.muscle] = (seriesMuscle[r.muscle] || 0) + 1 }
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
      series: filtered.length,
      reps: filtered.reduce((s, r) => s + (Number(r.reps) || 0), 0),
      tonnage: Math.round(tonnage / 100) / 10,
      tonnage_kg: Math.round(tonnage),
      rpe_moyen: rpeRows.length ? Math.round(rpeRows.reduce((s, r) => s + Number(r.rpe), 0) / rpeRows.length * 10) / 10 : null,
      volume_par_muscle: parMuscle,
      series_par_muscle: seriesMuscle,
      frequence_semaine: Math.round(seances / (days / 7) * 10) / 10,
      monotonie,
      strain,
    }
  }
  // Fenêtre « semaine calendaire » (depuis lundi) — pour le réglage semaine_type.
  {
    const cutoff = fmtYMD(getLundi(now))
    const filtered = perfs.filter(r => normDate(r.date) >= cutoff)
    const seriesMuscle: Record<string, number> = {}
    const parMuscle: Record<string, number> = {}
    for (const r of filtered) if (r.muscle) { seriesMuscle[r.muscle] = (seriesMuscle[r.muscle] || 0) + 1; parMuscle[r.muscle] = (parMuscle[r.muscle] || 0) + ((Number(r.charge) || 0) * (Number(r.reps) || 0)) }
    const tonnage = filtered.reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
    const rpeRows = filtered.filter(r => r.rpe)
    result['semaineCal'] = {
      seances: new Set(filtered.map(r => normDate(r.date))).size,
      series: filtered.length,
      reps: filtered.reduce((s, r) => s + (Number(r.reps) || 0), 0),
      tonnage: Math.round(tonnage / 100) / 10,
      tonnage_kg: Math.round(tonnage),
      rpe_moyen: rpeRows.length ? Math.round(rpeRows.reduce((s, r) => s + Number(r.rpe), 0) / rpeRows.length * 10) / 10 : null,
      volume_par_muscle: parMuscle,
      series_par_muscle: seriesMuscle,
    }
  }
  return result
}

function computeComparison(perfs: any[], now: Date): any {
  const c7  = fmtYMD(minus(now, 6))
  const c14 = fmtYMD(minus(now, 13))
  const c28 = fmtYMD(minus(now, 27))
  const c56 = fmtYMD(minus(now, 55))

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
    // NB : on garde j28/j28_prec (lus par le cockpit + tests) ET on expose
    // courant/precedent/evol_pct/diff attendus par le bloc « Tendance mensuelle »
    // (tonnage en tonnes pour l'affichage « …t vs …t »). Ajout non cassant.
    j28_vs_j28prec: {
      tonnage: { j28: j28w.tonnage, j28_prec: j28pw.tonnage, evol_pct: evol(j28w.tonnage, j28pw.tonnage),
                 courant: Math.round(j28w.tonnage / 100) / 10, precedent: Math.round(j28pw.tonnage / 100) / 10 },
      seances: { j28: j28w.seances, j28_prec: j28pw.seances,
                 courant: j28w.seances, precedent: j28pw.seances, evol_pct: evol(j28w.seances, j28pw.seances) },
      rpe: { j28: j28w.rpe_moyen, j28_prec: j28pw.rpe_moyen,
             courant: j28w.rpe_moyen, precedent: j28pw.rpe_moyen,
             diff: (j28w.rpe_moyen != null && j28pw.rpe_moyen != null) ? Math.round((j28w.rpe_moyen - j28pw.rpe_moyen) * 10) / 10 : null },
      charge: { evol_pct: evol(j28w.tonnage, j28pw.tonnage) },
    },
  }
}

// Tendances 4 / 8 semaines : évolution première semaine → dernière semaine de la
// période (volume = nb de séries/sem., RPE moyen, charge moyenne/sem.) + statut
// « positif / plateau / régression ». null si < 2 semaines de données (le front
// affiche alors « Pas assez de données sur cette période »). Descriptif, aucune
// décision — lu par afficherTendances (athlète) et afficherCoachTendances (coach).
function computeTendances(perfs: any[], now: Date): any {
  const curWk = isoWeek(now)   // semaine EN COURS (incomplète) → exclue des tendances
  const build = (weeks: number) => {
    const cut = fmtYMD(minus(now, weeks * 7))
    const rows = (perfs || []).filter(r => normDate(r.date) >= cut)
    if (!rows.length) return null
    const byWeek: Record<string, { series: number; rpeSum: number; rpeN: number; chargeSum: number; chargeN: number }> = {}
    for (const r of rows) {
      const iso = normDate(r.date); if (!iso) continue
      const dt = parseFR(r.date) || new Date(iso + 'T00:00:00Z')
      const wk = isoWeek(dt)
      if (wk === curWk) continue   // on ne compare que des semaines COMPLÈTES (pas la semaine partielle en cours)
      const w = byWeek[wk] || (byWeek[wk] = { series: 0, rpeSum: 0, rpeN: 0, chargeSum: 0, chargeN: 0 })
      w.series += 1
      if (r.rpe != null && r.rpe !== '') { w.rpeSum += Number(r.rpe); w.rpeN += 1 }
      const ch = Number(r.charge) || 0
      if (ch > 0) { w.chargeSum += ch; w.chargeN += 1 }
    }
    const keys = Object.keys(byWeek).sort()
    if (keys.length < 2) return null
    const first = byWeek[keys[0]], last = byWeek[keys[keys.length - 1]]
    const r1 = (v: number) => Math.round(v * 10) / 10
    const volume_debut = first.series, volume_fin = last.series
    const rpe_debut = first.rpeN ? r1(first.rpeSum / first.rpeN) : 0
    const rpe_fin = last.rpeN ? r1(last.rpeSum / last.rpeN) : 0
    const charge_debut = first.chargeN ? Math.round(first.chargeSum / first.chargeN) : 0
    const charge_fin = last.chargeN ? Math.round(last.chargeSum / last.chargeN) : 0
    const chargePct = charge_debut > 0 ? (charge_fin - charge_debut) / charge_debut : 0
    const volPct = volume_debut > 0 ? (volume_fin - volume_debut) / volume_debut : 0
    const rpeUp = rpe_fin - rpe_debut
    // Statut : le VOLUME compte autant que la charge. Une baisse nette de volume
    // OU de charge (ou un RPE qui flambe) → ce n'est PAS « positif ».
    const baisse = chargePct <= -0.05 || volPct <= -0.10
    const hausse = chargePct >= 0.05 || volPct >= 0.10
    let statut: string
    if (baisse || rpeUp >= 1.0) statut = 'regression'
    else if (hausse) statut = 'positif'
    else statut = 'plateau'
    return { volume_debut, volume_fin, rpe_debut, rpe_fin, charge_debut, charge_fin, statut }
  }
  return { s4: build(4), s8: build(8) }
}

function computeStreak(dates: string[], now: Date): number {
  if (!dates.length) return 0
  const weeks = new Set(dates.map(d => { const dt = parseFR(d) || new Date(d + 'T00:00:00Z'); return isoWeek(dt) }))
  let streak = 0, w = isoWeek(now)
  // Semaine en cours encore vide (ex. lundi matin) : elle ne casse pas la série (audit régularité 31/10).
  if (!weeks.has(w)) w = prevIsoWeek(w)
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

// ============================================================================
// CORE NOVALYZ — CONFIGURATION MÉTIER (Phase 3A) · SOURCE UNIQUE DE VÉRITÉ
// ----------------------------------------------------------------------------
// Refactor de CONFIGURATION uniquement : toutes les valeurs sont reprises
// À L'IDENTIQUE de l'existant. Aucune règle nouvelle, aucun changement de
// comportement, aucune modification de seuil. Le moteur (evaluerEtatAthlete)
// et la chaîne ACWR lisent désormais ces constantes au lieu de littéraux.
// ============================================================================

// --- Seuils santé / charge (agnostiques du sport) ---
const CORE_SEUILS = {
  // Douleur /5 (1 Aucune · 2 Légère · 3 Modérée · 4 Forte · 5 Très forte) — validé porteur oct. 2026 :
  // Légère = simple point d'attention (pas de Vigilance) ; Modérée = Vigilance ; Forte+ = rouge.
  douleur:     { attention: 2, gene: 3, forte: 4 },
  fatigue:     { haute: 4 },                         // /5
  sommeil:     { bas: 2 },                           // /5  (moyenne récente ≤2)
  courbatures: { haut: 4 },                          // /5  (muscu)
  recup:       { faible: 45, moyen: 60, bon: 75 },   // score 0..100
  acwr:        { bas: 0.8, optMax: 1.3, haut: 1.5 }, // ratio (ex-SEUILS_ACWR, Phase 2B)
}

// --- Niveaux d'état (0/1/2) — MÉTIER uniquement (Phase 3B) ---
// Le Core décide du NIVEAU et de son libellé/statut métier ; il ne décide plus
// de la COULEUR d'affichage (mapping niveau→couleur = responsabilité du front).
// `statut` (vert/orange/rouge) reste une CATÉGORIE métier utilisée comme clé de
// tri/regroupement côté front — ce n'est pas une couleur hexadécimale.
const CORE_NIVEAUX = [
  { cle: 'optimal',   label: 'Prêt',         statut: 'vert'   },
  { cle: 'vigilance', label: 'Vigilance',    statut: 'orange' },
  { cle: 'action',    label: 'À surveiller', statut: 'rouge'  },
]

// --- Fiabilité / confiance (qualité des données) ---
const CORE_FIABILITE = {
  histoMin: 28,          // jours d'historique de charge min pour un ACWR fiable
  joursActifsMin: 6,     // jours actifs min sur 28 (chronique non trouée) — décision métier
  joursActifsChroniqueMin: 4, // jours actifs min HORS semaine aiguë (jours 7→27). En dessous, la
                              // base chronique est creuse (reprise/vacances) → l'ACWR flambe même
                              // pour un volume normal → NON interprétable. Auto-détection sans
                              // que l'athlète ait à déclarer « retour vacances ».
  confJoursFaible: 7,    // < 7 j d'historique → confiance faible
  confJoursMoyen: 21,    // < 21 j → confiance moyenne
  wellnessMin: 3,        // < 3 mesures bien-être → confiance moyenne
}

// --- Contextes de performance — REGISTRE DÉCLARATIF (SOURCE UNIQUE des effets, Phase 3C) ---
// Chaque contexte porte ses effets métier. evaluerEtatAthlete les APPLIQUE via
// effetsContexte() aux mêmes points qu'avant (parité stricte). Valeurs inchangées.
const CORE_CONTEXTES = {
  saison_normale:  { reposPrevu: false },
  deload:          { reposPrevu: true,  surchargeDelta: -1 },
  retour_vacances: { reposPrevu: true,  surchargeDelta: +1, acwrRepriseJours: 28 },
  retour_blessure: { reposPrevu: true,  niveauMin: 1, risqueDelta: +1 },
  intensification: { reposPrevu: false },
}

// Résolution centralisée des effets de contexte (Phase 3C) — consomme CORE_CONTEXTES.
// Ne DÉCIDE rien : fournit les paramètres d'effet ; evaluerEtatAthlete reste seul
// à appliquer et à décider du verdict. Contexte inconnu → aucun effet (parité).
function effetsContexte(ctxEtat: string): { reposPrevu: boolean; surchargeDelta: number; niveauMin: number | null; risqueDelta: number } {
  const c: any = (CORE_CONTEXTES as any)[ctxEtat] || {}
  return {
    reposPrevu: c.reposPrevu === true,
    surchargeDelta: c.surchargeDelta || 0,
    niveauMin: c.niveauMin != null ? c.niveauMin : null,
    risqueDelta: c.risqueDelta || 0,
  }
}
// Clamp d'un niveau 0..2 (surcharge / risque ajustés par le contexte).
const clampNiv = (n: number): number => Math.max(0, Math.min(2, n))

// Seuils SANTÉ exposés au front (bilan NovalyzEngine) — Phase 4C-A.
// SOURCE UNIQUE = CORE_SEUILS. Le front les consomme via moteur.seuils_sante
// (fallback front 2/4/3 uniquement si absent : ancien backend / hors-ligne).
function seuilsSanteAPI() {
  return { sommeilBas: CORE_SEUILS.sommeil.bas, fatigueHaute: CORE_SEUILS.fatigue.haute, douleurForte: CORE_SEUILS.douleur.forte }
}

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
function calculerACWR(chargeParJour: Record<string, number>, now: Date): { ratio: number | null; aigue: number; chronique: number; joursActifs28: number; joursActifsChronique: number } {
  let aigue = 0, somme28 = 0, joursActifs28 = 0, joursActifsChronique = 0
  for (let d = 0; d < 28; d++) {
    const v = chargeParJour[fmtYMD(minus(now, d))] || 0
    somme28 += v
    if (v > 0) { joursActifs28++; if (d >= 7) joursActifsChronique++ }  // jours actifs HORS semaine aiguë (base chronique réelle)
    if (d < 7) aigue += v
  }
  const chronique = somme28 / 4
  return { ratio: chronique > 0 ? Math.round(aigue / chronique * 100) / 100 : null, aigue, chronique, joursActifs28, joursActifsChronique }
}

// Garde-fou FIABILITÉ centralisé (une seule copie) : historique < 28 j, reprise vacances < 28 j,
// OU chronique trouée (jours actifs insuffisants). Retourne false = ACWR non interprétable.
function fiabiliteACWR(premiere: string | null, ctxObj: any, now: Date, joursActifs28: number, joursActifsChronique = 99): boolean {
  const histo = _joursDepuis(premiere, now)
  if (histo == null || histo < CORE_FIABILITE.histoMin) return false
  if (joursActifs28 < CORE_FIABILITE.joursActifsMin) return false
  // Auto-détection reprise / layoff : si la base chronique (jours actifs hors semaine
  // aiguë) est trop creuse, l'ACWR n'est PAS interprétable — un volume normal après
  // une coupure ferait flamber le ratio (ex. 2.99) et fausserait le point du jour.
  if (joursActifsChronique < CORE_FIABILITE.joursActifsChroniqueMin) return false
  if (ctxObj && String(ctxObj.etat || '') === 'retour_vacances') {
    const rd = _joursDepuis(ctxObj.date_debut, now)
    if (rd != null && rd >= 0 && rd < CORE_CONTEXTES.retour_vacances.acwrRepriseJours) return false
  }
  return true
}

// D. Interprétation catégorielle — NE renvoie jamais une couleur d'athlète.
function interpreterACWR(ratio: number | null, fiable: boolean): string {
  if (!fiable || ratio == null) return 'non_interpretable'
  if (ratio > CORE_SEUILS.acwr.haut) return 'eleve'
  if (ratio > CORE_SEUILS.acwr.optMax) return 'vigilance'
  if (ratio < CORE_SEUILS.acwr.bas) return 'sous_charge'
  return 'normal'
}

// ── Modèle fitness-fatigue de Banister (standard TrainingPeaks) ───────────────
// Sur la charge quotidienne (sRPE pour cardio/foot, tonnage pour muscu) :
//   ATL (fatigue)      = moyenne exponentielle 7 j
//   CTL (forme/fond)   = moyenne exponentielle 42 j
//   TSB (fraîcheur)    = CTL − ATL            (négatif = fatigue, positif = frais)
// On expose aussi des indicateurs INDÉPENDANTS DE L'UNITÉ (comparables tonnage ↔
// sRPE) : tsbPct = (CTL−ATL)/CTL·100 et ratio = ATL/CTL (= EWMA-ACWR, version
// recherche de l'ACWR, plus robuste au bruit que les fenêtres fixes).
// Amorçage sur la 1re charge (charge constante → ratio 1 / tsbPct 0) : évite le
// biais de démarrage quand l'historique est court.
function calculerFitnessFatigue(chargeParJour: Record<string, number>, now: Date): {
  ctl: number; atl: number; tsb: number; tsbPct: number | null; ratio: number | null; joursActifs42: number
} {
  const keys = Object.keys(chargeParJour).filter(k => (chargeParJour[k] || 0) > 0).sort()
  if (!keys.length) return { ctl: 0, atl: 0, tsb: 0, tsbPct: null, ratio: null, joursActifs42: 0 }
  const LA = 2 / (7 + 1), LC = 2 / (42 + 1)
  const span = Math.max(0, _joursDepuis(keys[0], now) ?? 0)
  let ewmaA = chargeParJour[keys[0]], ewmaC = chargeParJour[keys[0]], joursActifs42 = 0
  for (let d = span; d >= 0; d--) {
    const v = chargeParJour[fmtYMD(minus(now, d))] || 0
    if (d < 42 && v > 0) joursActifs42++
    if (d === span) continue            // jour d'amorçage déjà posé
    ewmaA = v * LA + (1 - LA) * ewmaA
    ewmaC = v * LC + (1 - LC) * ewmaC
  }
  return {
    ctl: Math.round(ewmaC), atl: Math.round(ewmaA), tsb: Math.round(ewmaC - ewmaA),
    tsbPct: ewmaC > 0 ? Math.round((ewmaC - ewmaA) / ewmaC * 100) : null,
    ratio: ewmaC > 0 ? Math.round(ewmaA / ewmaC * 100) / 100 : null,
    joursActifs42,
  }
}

// ── Noms de muscles (audit 26/10 #2) ─────────────────────────────────────────
// Le catalogue et l'historique contenaient des variantes (« Moletts », « fessier »,
// « Triceps␣ ») qui ne correspondaient jamais aux objectifs de volume (« Mollets »…) →
// séries jamais comptées. Clé canonique : sans espaces parasites, casse/alias unifiés.
const _MUSCLE_ALIAS: Record<string, string> = {
  'corps entier': 'Corps entier',   // 07/11 : exercices fonctionnels (burpees, pneu…) — hors volume par muscle
  moletts: 'Mollets', mollet: 'Mollets', mollets: 'Mollets', fessier: 'Fessier', fessiers: 'Fessier',
  ischio: 'Ischio', ischios: 'Ischio', epaule: 'Epaule', epaules: 'Epaule', abdominaux: 'Abdominaux', abdos: 'Abdominaux',
  triceps: 'Triceps', biceps: 'Biceps', dos: 'Dos', pectoraux: 'Pectoraux', quadriceps: 'Quadriceps',
  adducteur: 'Adducteur', adducteurs: 'Adducteur', trapeze: 'Trapèze', trapezes: 'Trapèze',
  // Catalogue 06/11 : 2 nouveaux groupes (liste fermée de 14 muscles validée par le porteur).
  'avant-bras': 'Avant-bras', 'avant bras': 'Avant-bras', avantbras: 'Avant-bras', lombaire: 'Lombaires', lombaires: 'Lombaires',
}
function normMuscle(m: unknown): string {
  const raw = String(m ?? '').trim()
  if (!raw) return ''
  const key = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
  return _MUSCLE_ALIAS[key] || (raw.charAt(0).toUpperCase() + raw.slice(1))
}

// ── Règle « charge + ressenti » (entrées du moteur, oct. 2026) ─────────────────
// Charge SOUTENUE : fraîcheur (TSB%) < -12 sur au moins 3 des 5 derniers jours
// (un pic d'un jour — reprise après une pause, grosse séance — ne compte pas).
function chargeSoutenueJours(chargeParJour: Record<string, number>, now: Date): number {
  let n = 0
  for (let d = 0; d < 5; d++) {
    const f = calculerFitnessFatigue(chargeParJour, minus(now, d))
    if (f.tsbPct != null && f.tsbPct < -12) n++
  }
  return n
}
// Sous-charge SOUTENUE : ratio ATL/CTL < 0.80 CHAQUE jour des 14 derniers jours
// (baisse de > 20 % maintenue 2 semaines ; une semaine légère ne compte pas).
function sousChargeSoutenue(chargeParJour: Record<string, number>, now: Date): boolean {
  for (let d = 0; d < 14; d++) {
    const f = calculerFitnessFatigue(chargeParJour, minus(now, d))
    if (f.ratio == null || f.ratio >= 0.80) return false
  }
  return true
}
// Ressenti concordant. Deux sources (une suffit) :
//  (1) bien-être : moyenne des 3 dernières saisies (≤ 7 j) vs baseline perso (saisies
//      plus anciennes ≤ 35 j, ≥ 7 valeurs) — fatigue musculaire +1 pt (5 = très
//      fatigué) OU sommeil −1 pt (5 = très bon) ;
//  (2) RPE en hausse (≥ +1 pt) à charge ÉGALE ou plus basse (≤ +2,5 %) sur ≥ 2
//      exercices, dernière séance de l'exo ≤ 10 j.
// `evaluable` = on dispose d'assez de bien-être pour affirmer « tu encaisses bien ».
//  (3) [31/10, seuil A validé porteur] FC de repos de la montre : moyenne des 3 derniers jours
//      (≥ 2 mesures) ≥ ta normale + 5 bpm (normale = 4 semaines avant, ≥ 14 mesures). Signe
//      d'appoint (Buchheit 2014 : la FC complète le questionnaire, pas seule) : il ne compte que
//      dans cette règle, donc seulement si la charge est élevée en même temps.
function ressentiConcordant(beRows: any[], perfs: any[], now: Date, fcRows: any[] = [], ignorerRpe = false): { degrade: boolean; evaluable: boolean; rpeExos: string[]; rpeDetails: any[]; rpeEvalues: number; fc: any; raisons: string[] } {
  const c7 = fmtYMD(minus(now, 6)), c35 = fmtYMD(minus(now, 34))
  const rows = (beRows || []).map((r: any) => ({ d: normDate(r.date), fat: (r.fatigue_musculaire == null || r.fatigue_musculaire === '') ? null : Number(r.fatigue_musculaire), som: (r.sommeil == null || r.sommeil === '') ? null : Number(r.sommeil) }))
    .filter((r: any) => r.d && r.d >= c35).sort((a: any, b: any) => b.d.localeCompare(a.d))
  const moy = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
  const serie = (k: 'fat' | 'som') => {
    const rec = rows.filter((r: any) => r.d >= c7 && r[k] != null && !isNaN(r[k])).slice(0, 3)
    const recD = new Set(rec.map((r: any) => r.d))
    const base = rows.filter((r: any) => !recD.has(r.d) && r[k] != null && !isNaN(r[k]))
    return { ok: rec.length >= 3 && base.length >= 7, rec: moy(rec.map((r: any) => r[k])), base: moy(base.map((r: any) => r[k])) }
  }
  const F = serie('fat'), S = serie('som')
  const fatDeg = F.ok && (F.rec as number) - (F.base as number) >= 1
  const somDeg = S.ok && (S.base as number) - (S.rec as number) >= 1
  // RPE à charge ≤ : par exo, top charge du jour + son RPE.
  const parExo: Record<string, Record<string, { charge: number; rpe: number }>> = {}
  for (const r of perfs || []) {
    const d = normDate(r.date); const ch = Number(r.charge) || 0; const rpe = Number(r.rpe) || 0
    if (!d || rpe <= 0) continue
    const exo = String(r.exercice || ''); const m = (parExo[exo] ||= {})
    if (!m[d] || ch > m[d].charge) m[d] = { charge: ch, rpe }
  }
  const c10 = fmtYMD(minus(now, 10)), rpeExos: string[] = [], rpeDetails: any[] = []
  let rpeEvalues = 0
  for (const exo of Object.keys(parExo)) {
    const ds = Object.keys(parExo[exo]).sort()
    if (ds.length < 4 || ds[ds.length - 1] < c10) continue
    const l = ds.slice(-4).map(d => parExo[exo][d])
    const rpeAv = (l[0].rpe + l[1].rpe) / 2, rpeAp = (l[2].rpe + l[3].rpe) / 2
    const chAv = (l[0].charge + l[1].charge) / 2, chAp = (l[2].charge + l[3].charge) / 2
    const chPct = chAv > 0 ? (chAp - chAv) / chAv * 100 : 0
    rpeEvalues++
    if (rpeAp - rpeAv >= 1 && chPct <= 2.5) { rpeExos.push(exo); rpeDetails.push({ exo, charge: Math.round(chAp * 10) / 10, rpeAvant: rpeAv, rpeApres: rpeAp }) }
  }
  // Intensification (contexte, audit X3 01/11) : la hausse de RPE est ATTENDUE → pas un signal.
  const rpeDeg = !ignorerRpe && rpeExos.length >= 2
  // (3) FC de repos (montre).
  const c3 = fmtYMD(minus(now, 2)), c30 = fmtYMD(minus(now, 30))
  const fcRec: number[] = [], fcBase: number[] = []
  for (const r of fcRows || []) {
    const d = normDate(r.date); const v = Number(r.fc_repos)
    if (!d || !(v > 0)) continue
    if (d >= c3 && d <= fmtYMD(now)) fcRec.push(v)
    else if (d >= c30 && d < c3) fcBase.push(v)
  }
  const fcOk = fcRec.length >= 2 && fcBase.length >= 14
  const fcR = moy(fcRec), fcB = moy(fcBase)
  const fcDeg = fcOk && (fcR as number) - (fcB as number) >= 5
  const fc = { evaluable: fcOk, recente: fcR != null ? Math.round(fcR * 10) / 10 : null, normale: fcB != null ? Math.round(fcB * 10) / 10 : null, mesures: fcRec.length, mesuresBase: fcBase.length, degrade: fcDeg }
  const raisons: string[] = []
  if (fatDeg) raisons.push('fatigue'); if (somDeg) raisons.push('sommeil'); if (rpeDeg) raisons.push('rpe'); if (fcDeg) raisons.push('fc_repos')
  return { degrade: fatDeg || somDeg || rpeDeg || fcDeg, evaluable: F.ok || S.ok, rpeExos, rpeDetails, rpeEvalues, fc, raisons }
}

// ── Alertes ───────────────────────────────────────────────────────────────────
// Porté fidèlement de Code.gs calculerAlertes : champs { type, severite, message }
function calculerAlertes(perfs: any[], _athleteId: string, anneesPratique: number, enPause: boolean): any[] {
  const alertes: any[] = []
  if (!perfs.length) return alertes
  const now = new Date()
  const sept = fmtYMD(minus(now, 6))
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
    // Audit #7 : stagnation seulement sur des séances RÉCENTES (dernière ≤ 21 j, fenêtre ≤ 90 j).
    if (derniersN[derniersN.length - 1].date < fmtYMD(minus(now, 21)) || derniersN[0].date < fmtYMD(minus(now, 90))) continue
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
    if (last4[3].date < fmtYMD(minus(now, 14))) continue   // Audit #7 : exo plus pratiqué → pas d'alerte
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
  const cutoff = fmtYMD(minus(now, days - 1))
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
    if (k === 'type_cardio' || k === 'hyrox_mode' || k === 'hyrox_division') { out[k] = String(v ?? '') ; continue }
    out[k] = (v === '' || v == null) ? null : (Number(v) || 0)
  }
  return out
}

// Champs cardio "plats" envoyés par le front → lignes Indicateurs (comme Code.gs saveCardio)
// S5 (audit saisies 02/11) : valeurs plausibles uniquement (une durée négative passait).
const CARDIO_LIMITES: Record<string, [number, number, string]> = {
  duree: [1, 600, 'Durée : 1 à 600 min'], distance: [0, 300, 'Distance : 0 à 300 km'], fc_moy: [30, 230, 'FC moyenne : 30 à 230 bpm'],
  calories: [0, 5000, 'Calories : 0 à 5 000 kcal'], vitesse_moy: [0, 100, 'Vitesse : 0 à 100 km/h'], deniv: [0, 10000, 'Dénivelé : 0 à 10 000 m'],
}
function _cardioHorsLimites(body: any, d: string): string | null {
  for (const k of Object.keys(CARDIO_LIMITES)) {
    const v = body[k]; if (v === '' || v == null) continue
    const n = Number(v); const [mn, mx, msg] = CARDIO_LIMITES[k]
    if (isNaN(n) || n < mn || n > mx) return msg
  }
  const demain = new Date(); demain.setUTCDate(demain.getUTCDate() + 1)   // marge fuseau horaire
  if (d > fmtYMD(demain)) return 'La date ne peut pas être dans le futur.'
  return null
}
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
  addNum('vitesse_max', body.vitesse_max, 'km/h')
  addNum('inclinaison', body.inclinaison, '%')
  addNum('puissance_moy', body.puissance_moy, 'W')
  addNum('puissance_max', body.puissance_max, 'W')
  addNum('cadence', body.cadence, 'rpm')
  addNum('pas', body.pas, 'pas')
  addNum('fc_moy', body.fc_moy, 'bpm')
  addNum('calories', body.calories, 'kcal')
  addNum('deniv', body.deniv, 'm')              // dénivelé positif (D+), issu des imports .FIT/.GPX/Strava
  const dureeN = Number(body.duree), rpeN = Number(body.rpe)
  if (dureeN && rpeN) {
    addNum('rpe', body.rpe, '1-10')
    rows.push({ date, athlete_id, seance_id: sid, cle: 'charge_interne', valeur: String(dureeN * rpeN), unite: 'UA', source: 'calculé' })
  }
  return rows
}

// Mappe une activité Strava (item de GET /athlete/activities, ou détail) vers le
// schéma cardio de Novalyz. PURE : conversions d'unités uniquement (m/s→km/h,
// m→km, s→min), aucun accès réseau/DB. Renvoie null si ce n'est pas du vélo.
// Le résultat est un « body » consommable par _buildCardioRows (Étape 3).
function mapStravaActivite(a: any): any {
  if (!a) return null
  const t = String(a.sport_type || a.type || '')
  if (!/Ride/.test(t)) return null                              // Ride/VirtualRide/GravelRide/MountainBikeRide/EBikeRide…
  const num = (v: any) => (v != null && v !== '' && !isNaN(Number(v))) ? Number(v) : null
  const r1 = (v: number | null) => v == null ? null : Math.round(v * 10) / 10
  const r2 = (v: number | null) => v == null ? null : Math.round(v * 100) / 100
  const ri = (v: number | null) => v == null ? null : Math.round(v)
  const spd = num(a.average_speed), spdMax = num(a.max_speed), dist = num(a.distance), mv = num(a.moving_time)
  const dateSrc = String(a.start_date_local || a.start_date || '')
  return {
    strava_id: a.id != null ? String(a.id) : null,
    type_cardio: 'velo',
    date: dateSrc ? dateSrc.slice(0, 10) : '',
    duree: mv != null ? Math.round(mv / 60) : null,             // s → min
    distance: r2(dist == null ? null : dist / 1000),            // m → km
    vitesse_moy: r1(spd == null ? null : spd * 3.6),            // m/s → km/h
    vitesse_max: r1(spdMax == null ? null : spdMax * 3.6),      // m/s → km/h
    puissance_moy: ri(num(a.average_watts)),                    // W
    puissance_max: ri(num(a.max_watts)),                        // W
    cadence: ri(num(a.average_cadence)),                        // rpm (pédalage)
    fc_moy: ri(num(a.average_heartrate)),                       // bpm
    calories: ri(num(a.calories)),                              // kcal (détail activité uniquement)
    deniv: ri(num(a.total_elevation_gain)),                     // m D+ (dénivelé positif)
  }
}

async function buildCardioAll(athleteId: string): Promise<any> {
  const { data: rows } = await _toutLire(() => sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'cardio_%').order('date', { ascending: false }).order('id'))
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
  // 1 point par DATE : meilleure série du jour (charge/reps/1RM) + volTotal = volume
  // de TOUTES les séries de l'exo ce jour-là (pour la vue « Volume toutes séries »).
  // 30 dates les plus récentes (assez pour une vraie tendance sur longues périodes).
  const byExo: Record<string, Record<string, any>> = {}
  for (const r of perfs) {
    const exo = r.exercice; if (!exo) continue
    const dmy = fmtFR(r.date)
    const charge = Number(r.charge) || 0, reps = Number(r.reps) || 0
    if (!byExo[exo]) byExo[exo] = {}
    let cur = byExo[exo][dmy]
    // le front lit p.seance (p.seance.substring(...)) → indispensable
    if (!cur) { cur = byExo[exo][dmy] = { date: dmy, seance: String(r.seance_id || ''), charge, reps, volume: charge * reps, volTotal: 0, series: [] } }
    // meilleure série du jour (charge, puis reps à charge égale)
    if (charge > cur.charge || (charge === cur.charge && reps > cur.reps)) {
      cur.charge = charge; cur.reps = reps; cur.volume = charge * reps
      if (r.seance_id) cur.seance = String(r.seance_id)
    }
    cur.volTotal += charge * reps   // somme de TOUTES les séries du jour (travail total)
    // #4 Surcharge PAR SÉRIE : on conserve chaque série du jour (n° + charge/reps/rpe)
    // pour tracer l'évolution des séries 2/3/4, pas seulement de la meilleure. Le n°
    // de série vient de la colonne `serie` ; à défaut, l'ordre d'insertion (1-indexé).
    // + repos réel de la série (secondes) : la lecture (Aujourd'hui / Analyses) et les
    // cibles de saisie s'appuient sur le repos de la dernière fois (décision 29/10).
    cur.series.push({ serie: Number(r.serie) || (cur.series.length + 1), charge, reps, rpe: Number(r.rpe) || null, repos: Number(r.repos) > 0 ? Number(r.repos) : null })
  }
  const out: Record<string, any[]> = {}
  for (const exo of Object.keys(byExo)) {
    const pts = Object.values(byExo[exo])
    for (const p of pts) p.series.sort((a: any, b: any) => (a.serie || 0) - (b.serie || 0))   // S1, S2, S3…
    out[exo] = pts.sort((a, b) => (parseFR(b.date)?.getTime() || 0) - (parseFR(a.date)?.getTime() || 0)).slice(0, 30)
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

// Agrégat muscu par JOUR d'entraînement (historique COMPLET). Permet au front de
// recalculer n'importe quelle fenêtre calendaire (semaine/mois/année navigables
// avec flèches) en SOMMANT les jours — mêmes définitions que computeRecent
// (seances = jours distincts, series = nb de lignes, tonnage = Σ charge×reps…),
// donc à offset 0 les chiffres coïncident avec les fenêtres glissantes du backend.
// Valeurs NON arrondies par jour → le front arrondit la somme (cohérent avec recent).
// Muscle SECONDAIRE d'un exercice compté 0,5 série (décision 01/11, audit Analyses R4) :
// partout où l'on compte des séries par muscle (Résumé, semaine, volume, mail récap).
function _secMap(exoRows: any[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const e of (exoRows || [])) { const k = String((e as any).exercice || '').trim().toLowerCase(); const ms = normMuscle((e as any).muscle_secondaire); if (k && ms) m[k] = ms }
  return m
}
function _addSeriesMuscle(acc: Record<string, number>, r: any, secByExo?: Record<string, string>) {
  if (r.muscle && normMuscle(r.muscle) !== 'Corps entier') acc[r.muscle] = (acc[r.muscle] || 0) + 1   // 07/11 : corps entier hors volume par muscle
  const sec = secByExo && secByExo[String(r.exercice || '').trim().toLowerCase()]
  if (sec && sec !== normMuscle(r.muscle)) acc[sec] = (acc[sec] || 0) + 0.5
}
// VRAIS records (audit Analyses R2) : chaque fois qu'une série dépasse le meilleur PRÉCÉDENT de
// l'exercice (charge, ou reps à charge égale). La 1re fois qu'un exercice est fait n'en est pas un.
// Source unique pour l'app (Résumé « Records battus ») et le mail récap.
function _recordsEvenements(perfs: any[]): any[] {
  // Meilleur de la journée par exercice, comparé au meilleur des jours PRÉCÉDENTS (les séries
  // d'une même séance ne se battent pas entre elles).
  const jour: Record<string, Record<string, number[]>> = {}
  for (const r of (perfs || [])) {
    const d = normDate(r.date), e = String(r.exercice || ''), c = Number(r.charge) || 0, rp = Number(r.reps) || 0
    if (!d || !e || c <= 0) continue
    const j = (jour[d] = jour[d] || {}), x = j[e]
    if (!x || c > x[0] || (c === x[0] && rp > x[1])) j[e] = [c, rp]
  }
  const best: Record<string, number[]> = {}, out: any[] = []
  for (const d of Object.keys(jour).sort()) {
    for (const e of Object.keys(jour[d])) {
      const [c, rp] = jour[d][e], b = best[e]
      if (b && (c > b[0] || (c === b[0] && rp > b[1]))) out.push({ exo: e, date: d, c, r: rp })
      if (!b || c > b[0] || (c === b[0] && rp > b[1])) best[e] = [c, rp]
    }
  }
  return out
}
function buildDailyMuscu(perfs: any[], secByExo?: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const r of perfs) {
    const d = normDate(r.date); if (!d) continue
    const charge = Number(r.charge) || 0, reps = Number(r.reps) || 0
    let o = out[d]
    if (!o) o = out[d] = { series: 0, reps: 0, tonnage_kg: 0, rpe_sum: 0, rpe_n: 0, spm: {} as Record<string, number>, vpm: {} as Record<string, number> }
    o.series++
    o.reps += reps
    o.tonnage_kg += charge * reps
    if (r.rpe) { o.rpe_sum += Number(r.rpe); o.rpe_n++ }
    _addSeriesMuscle(o.spm, r, secByExo)
    if (r.muscle) o.vpm[r.muscle] = (o.vpm[r.muscle] || 0) + charge * reps
  }
  return out
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

// Volume de la SEMAINE en cours = nombre de séries par muscle depuis lundi.
// SOURCE DE VÉRITÉ UNIQUE : consommée à l'identique par le payload athlète
// (getAppData) ET coach (getSuiviJoueur) → même forme [{ muscle, faites }],
// le front (afficherVolumeMuscle / renderBilanBalance / cockpit E) l'attend ainsi.
function buildVolumeSemaineParMuscle(perfs: any[], now: Date, secByExo?: Record<string, string>): any[] {
  const lundiStr = fmtYMD(getLundi(now))
  const parMuscle: Record<string, number> = {}
  for (const r of perfs) {
    if (normDate(r.date) >= lundiStr) _addSeriesMuscle(parMuscle, r, secByExo)
  }
  return Object.entries(parMuscle).map(([muscle, faites]) => ({ muscle, faites }))
}

// Détail des séances (Analyses · Historique) : 20 dernières séances, regroupées
// par (date, seance_id), avec chaque exercice et ses séries (charge/reps/rpe/repos).
function buildSeancesDetail(perfs: any[]): any[] {
  const map: Record<string, any> = {}
  for (const r of perfs) {
    const dIso = normDate(r.date); if (!dIso) continue
    const key = dIso + '|' + String(r.seance_id ?? '')
    if (!map[key]) map[key] = { date: dIso, date_fr: fmtFR(r.date), seance_id: String(r.seance_id ?? ''), tonnage: 0, series: 0, exos: {} as Record<string, any> }
    const s = map[key], charge = Number(r.charge) || 0, reps = Number(r.reps) || 0
    s.tonnage += charge * reps; s.series++
    const exo = r.exercice || '—'
    if (!s.exos[exo]) s.exos[exo] = { nom: exo, muscle: r.muscle || '', series: [] }
    s.exos[exo].series.push({ charge, reps, rpe: Number(r.rpe) || null, repos: Number(r.repos) || null })
  }
  return Object.values(map)
    .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 40)   // 40 séances : assez pour naviguer plusieurs mois en arrière (Par groupe / Par séance / Historique)
    .map((s: any) => ({ date: s.date, date_fr: s.date_fr, seance_id: s.seance_id, tonnage: Math.round(s.tonnage), nb_series: s.series, exercices: Object.values(s.exos) }))
}

// ── Agrégats FOOT (extraits de handleGetSuiviJoueur — ISO-COMPORTEMENT) ──────────
// Fonctions PURES pour rendre les calculs foot testables (traçabilité). Elles
// reproduisent EXACTEMENT la logique inline précédente (fenêtres, arrondis,
// filtres, valeurs par défaut). Aucune amélioration de formule ici.

// Fenêtres de charge interne (UA). charge7/28 = Σ sur dIso ≥ now-7 / now-28 ;
// chargeParJour (7 j, toutes valeurs) ; chargeParJour28 (28 j, valeurs > 0 →
// chaîne ACWR) ; premiereCharge = plus ancienne date de charge ; chargeParSem/
// semLundi (semaine ISO, pour la charge hebdo).
function chargeFenetresFoot(rows: any[], now: Date) {
  const j7 = fmtYMD(minus(now, 6)), j28 = fmtYMD(minus(now, 27))
  const chargeParJour: Record<string, number> = {}, chargeParJour28: Record<string, number> = {}
  const chargeParSem: Record<string, number> = {}, semLundi: Record<string, string> = {}
  let charge7 = 0, charge28 = 0
  let premiereCharge: string | null = null
  let derniere: string | null = null   // date de charge la plus récente (accueil)
  for (const row of rows || []) {
    if (String(row.cle) !== 'charge_interne') continue
    const dIso = normDate(row.date); if (!dIso) continue
    const val = Number(row.valeur) || 0
    const dObj = parseFR(dIso)!
    const w = isoWeek(dObj)
    chargeParSem[w] = (chargeParSem[w] || 0) + val
    const lundiStr = fmtYMD(getLundi(dObj))
    if (!semLundi[w] || lundiStr < semLundi[w]) semLundi[w] = lundiStr
    if (!premiereCharge || dIso < premiereCharge) premiereCharge = dIso
    if (!derniere || dIso > derniere) derniere = dIso
    if (dIso >= j28) { charge28 += val; if (val > 0) chargeParJour28[dIso] = (chargeParJour28[dIso] || 0) + val }
    if (dIso >= j7) { charge7 += val; chargeParJour[dIso] = (chargeParJour[dIso] || 0) + val }
  }
  return { charge7, charge28, chargeParJour, chargeParJour28, premiereCharge, derniere, chargeParSem, semLundi }
}

// Monotonie / strain (Foster) sur 7 jours glissants. sdD = 0 → monotonie null.
function monotonieStrainFoot(chargeParJour: Record<string, number>, charge7: number, now: Date) {
  const days7: number[] = []
  for (let dd = 0; dd < 7; dd++) days7.push(chargeParJour[fmtYMD(minus(now, dd))] || 0)
  const meanD = days7.reduce((a, b) => a + b, 0) / 7
  const sdD = Math.sqrt(days7.reduce((a, b) => a + (b - meanD) ** 2, 0) / 7)
  const monotonie = sdD > 0 ? Math.round(meanD / sdD * 100) / 100 : null
  const strain = monotonie != null ? Math.round(charge7 * monotonie) : null
  return { monotonie, strain }
}

// Agrégation des matchs (saison). matchs = 8 plus récents ; match_agg = par clé
// {total, moy} ; match_stats = {nb, note_moy (moyenne), minutes/buts/passes_d (Σ)}.
// Chaque match reste indépendant (une entrée seances par seance_id unique).
function aggMatchsFoot(seances: Record<string, any>) {
  const num = (v: any) => (v !== '' && v != null) ? Number(v) : null
  const tousMatchs = Object.values(seances).filter((s: any) => String(s.cles['type_seance']) === 'match').sort((a: any, b: any) => b.dateIso.localeCompare(a.dateIso))
  const matchs = tousMatchs.slice(0, 8).map((s: any) => ({
    date: s.date, note: num(s.cles['note']), buts: num(s.cles['buts']) || 0,
    passes_d: num(s.cles['passes_decisives']) || 0, xg: num(s.cles['xg']), xa: num(s.cles['xa']), minutes: num(s.cles['minutes_jouees']),
  }))
  const aggSum: Record<string, number> = {}, aggCnt: Record<string, number> = {}
  for (const s of tousMatchs) for (const k in (s as any).cles) { const vv = num((s as any).cles[k]); if (vv == null) continue; aggSum[k] = (aggSum[k] || 0) + vv; aggCnt[k] = (aggCnt[k] || 0) + 1 }
  const matchAgg: Record<string, any> = {}
  for (const kk in aggSum) matchAgg[kk] = { total: Math.round(aggSum[kk] * 100) / 100, moy: aggCnt[kk] ? Math.round(aggSum[kk] / aggCnt[kk] * 10) / 10 : 0 }
  const matchStats = { nb: tousMatchs.length, note_moy: aggCnt['note'] ? Math.round(aggSum['note'] / aggCnt['note'] * 10) / 10 : null, minutes: aggSum['minutes_jouees'] || 0, buts: aggSum['buts'] || 0, passes_d: aggSum['passes_decisives'] || 0 }
  return { matchs, match_agg: matchAgg, match_stats: matchStats }
}

// Agrégation GPS sur une fenêtre de `jours` (Σ, sauf vmax = max). Valeur absente
// → 0 (comportement actuel : Number(x || 0)).
function aggGpsFenetreFoot(seances: Record<string, any>, now: Date, jours: number) {
  const cutoff = fmtYMD(minus(now, jours))
  const gps: any = { distance: 0, distance_hi: 0, sprint_distance: 0, sprints: 0, accel: 0, decel: 0, vmax: 0, charge_gps: 0, n: 0 }
  for (const s of Object.values(seances) as any[]) {
    if (!s.dateIso || s.dateIso < cutoff) continue
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
  return gps
}

// Séances foot : sépare le VRAI total (toutes les séances non-renfo enregistrées)
// de la LISTE récente (10 plus récentes, triées par date). total ≠ liste.length.
// Iso-comportement : reproduit exactement l'ancien listeSeances (tri + slice 10).
function seancesFoot(seances: Record<string, any>, renfoIds: Set<string>) {
  const nonRenfo = Object.entries(seances).filter(([sid]) => !renfoIds.has(sid)).map(([, s]) => s)
  const total = nonRenfo.length
  const liste = nonRenfo.sort((a: any, b: any) => b.dateIso.localeCompare(a.dateIso)).slice(0, 10).map((s: any) => ({
    date: s.date, type: s.cles['type_seance'] || '—', duree: s.cles['duree'] || null,
    rpe: s.cles['rpe'] || null, charge: s.cles['charge_interne'] || null,
    distance_hi: s.cles['distance_hi'] || null, sprints: s.cles['sprints'] || null,
  }))
  return { total, liste }
}

// ── Agrégats ÉQUIPE / PRÉPA (extraits de handleGetSuiviEquipe — ISO-COMPORTEMENT) ──
// Sens des tests physiques : +1 = « plus haut = mieux », -1 = « plus bas = mieux ».
const SENS_TESTS: Record<string, number> = { vma: 1, sprint_10m: -1, sprint_30m: -1, cmj: 1, squat_jump: 1, yoyo_test: 1, agilite_5_10_5: -1, force_iso: 1, force_max: 1, '1rm': 1, test_vitesse: 1 }

// Score bien-être d'un joueur = moyenne de [sommeil, 6−fatigue, 6−douleur] (dims
// renseignées). null si aucune dimension. sig = sortie de _aggSignaux.
function beScoreJoueur(sig: any): number | null {
  const beComp: number[] = []
  if (sig.sommeil != null) beComp.push(sig.sommeil)
  const _fm = sig.fatigueMoy != null ? sig.fatigueMoy : sig.fatigue   // 06/11 : moyenne (score), pas le pire jour
  if (_fm != null) beComp.push(6 - _fm)
  if (sig.douleur != null) beComp.push(6 - sig.douleur)
  return beComp.length ? beComp.reduce((x, y) => x + y, 0) / beComp.length : null
}

// Progression d'un athlète depuis ses tests : par clé, signe de (dernier − premier)
// × sens. up>down → progression ; down>up → regression ; sinon stable.
// tset = { cle: [{ d: timestamp, v: valeur }] } ; sens = SENS_TESTS.
function progressionAthlete(tset: any, sens: Record<string, number>): string {
  if (!tset) return 'stable'
  let up = 0, down = 0
  for (const c in tset) {
    const pts = tset[c].slice().sort((a, b) => a.d - b.d)
    if (pts.length < 2) continue
    const diff = (pts[pts.length - 1].v - pts[0].v) * (sens[c] || 1)
    if (diff > 0) up++; else if (diff < 0) down++
  }
  return up > down ? 'progression' : (down > up ? 'regression' : 'stable')
}

// Charge hebdomadaire d'équipe : Σ charge_interne par semaine ISO (lundi), 8
// dernières semaines, ordre chronologique. rows = lignes charge_interne.
function chargeHebdoEquipe(rows: any[], athIds: Set<string>): any[] {
  const semCharges: Record<string, number> = {}
  for (const row of rows || []) {
    if (!athIds.has(String(row.athlete_id))) continue
    const d = parseFR(row.date); if (!d) continue
    const lundiStr = fmtFR(fmtYMD(getLundi(d)))
    semCharges[lundiStr] = (semCharges[lundiStr] || 0) + (Number(row.valeur) || 0)
  }
  const semKeys = Object.keys(semCharges).sort((a, b) => (parseFR(a)?.getTime() || 0) - (parseFR(b)?.getTime() || 0))
  return semKeys.slice(-8).map(sem => ({ sem, charge: Math.round(semCharges[sem]) }))
}

// Agrégats d'équipe à partir des items par joueur { charge7, fatigue, beScore,
// progression } : charge cumulée (arrondie), fatigue moyenne, bien-être moyen
// (arrondis 0,1 ; null si aucune valeur), et comptes progression/régression.
function agregerEquipe(items: any[]) {
  const moy = (arr: number[]) => arr && arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
  let chargeEquipe = 0, nbProg = 0, nbReg = 0
  const fatigueArr: number[] = [], beArr: number[] = []
  for (const it of items) {
    chargeEquipe += it.charge7 || 0
    if (it.fatigue != null) fatigueArr.push(it.fatigue)
    if (it.beScore != null) beArr.push(it.beScore)
    if (it.progression === 'progression') nbProg++; else if (it.progression === 'regression') nbReg++
  }
  return {
    charge_equipe: Math.round(chargeEquipe),
    fatigue_moyenne: fatigueArr.length ? Math.round((moy(fatigueArr) || 0) * 10) / 10 : null,
    bienetre_moyen: beArr.length ? Math.round((moy(beArr) || 0) * 10) / 10 : null,
    en_progression: nbProg, en_regression: nbReg,
  }
}

// ── GET handlers ──────────────────────────────────────────────────────────────
// C7 (02/11) : même traitement du mot de passe PARTOUT (espaces retirés aux deux bouts, comme
// la connexion le faisait déjà). Avant : changement / reset gardaient les espaces → connexion impossible.
function _mdp(v: unknown): string { return String(v ?? '').trim() }
const MDP_MIN = 6

// C5 (02/11) : limite d'essais de connexion — 5 échecs sur un même login en 15 min → bloqué
// jusqu'à ce que le plus ancien de ces 5 échecs ait 15 min. Comptés aussi pour un login inexistant
// (même réponse, pas d'énumération). Table login_echecs (clé 'a:<login>' / 'c:<login>').
const LOGIN_MAX_ECHECS = 5, LOGIN_FENETRE_MS = 15 * 60 * 1000
async function _loginBloqueMin(cle: string): Promise<number> {
  try {
    const depuis = new Date(Date.now() - LOGIN_FENETRE_MS).toISOString()
    const { data } = await sb().from('login_echecs').select('created_at').eq('cle', cle).gte('created_at', depuis).order('created_at', { ascending: true })
    if (!data || data.length < LOGIN_MAX_ECHECS) return 0
    const t = new Date(data[data.length - LOGIN_MAX_ECHECS].created_at).getTime()
    return Math.max(1, Math.ceil((t + LOGIN_FENETRE_MS - Date.now()) / 60000))
  } catch (_) { return 0 }
}
async function _loginEchec(cle: string): Promise<void> {
  try {
    await sb().from('login_echecs').insert({ cle, created_at: new Date().toISOString() })
    await sb().from('login_echecs').delete().lt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  } catch (_) {}
}
async function _loginReussi(cle: string): Promise<void> { try { await sb().from('login_echecs').delete().eq('cle', cle) } catch (_) {} }
function _msgBloque(min: number): string { return `Trop d'essais. Réessaie dans ${min} min.` }

// C8 (02/11) : changer / réinitialiser le mot de passe déconnecte les AUTRES appareils.
// sess_depuis (secondes) : toute session émise avant est refusée. Renvoie un jeton neuf pour
// l'appareil qui fait le changement (il reste connecté).
const _sessDepuisCache = new Map<string, { v: number; t: number }>()
async function _revoquerSessions(role: 'a' | 'c', id: string): Promise<string | null> {
  const nowS = Math.floor(Date.now() / 1000)
  try {
    if (role === 'a') await sb().from('athletes').update({ sess_depuis: nowS }).eq('id', id)
    else await sb().from('coachs').update({ sess_depuis: nowS }).eq('coach_id', id)
    _sessDepuisCache.set(role + ':' + id, { v: nowS, t: Date.now() })
  } catch (_) {}
  return await signSession(role, id, nowS)
}
async function _sessDepuis(role: 'a' | 'c', id: string): Promise<number> {
  const k = role + ':' + id, c = _sessDepuisCache.get(k)
  if (c && Date.now() - c.t < 30000) return c.v
  let v = 0
  try {
    const { data } = role === 'a'
      ? await sb().from('athletes').select('sess_depuis').eq('id', id).single()
      : await sb().from('coachs').select('sess_depuis').eq('coach_id', id).single()
    v = Number(data && (data as any).sess_depuis) || 0
  } catch (_) {}
  _sessDepuisCache.set(k, { v, t: Date.now() })
  return v
}

// C9 (02/11) : mail de bienvenue (login, jamais le mot de passe) + lien « Confirmer mon adresse ».
// Jeton de confirmation signé (HMAC, même clé que les sessions), valable 7 jours, lié à l'adresse.
async function _jetonEmail(role: 'a' | 'c', id: string, email: string): Promise<string | null> {
  const key = await _sessKey(); if (!key) return null
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600
  const payload = `e1.${role}.${_b64uStr(id)}.${_b64uStr(email.toLowerCase())}.${exp}`
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
  return payload + '.' + _b64u(sig)
}
async function _lireJetonEmail(tok: string): Promise<{ role: 'a' | 'c'; id: string; email: string } | null> {
  try {
    const key = await _sessKey(); if (!key || !tok) return null
    const p = String(tok).split('.'); if (p.length !== 6 || p[0] !== 'e1' || (p[1] !== 'a' && p[1] !== 'c')) return null
    const sigB = Uint8Array.from(atob(p[5].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((p[5].length + 3) % 4)), c => c.charCodeAt(0))
    const ok = await crypto.subtle.verify('HMAC', key, sigB, new TextEncoder().encode(p.slice(0, 5).join('.'))); if (!ok) return null
    if (Number(p[4]) < Math.floor(Date.now() / 1000)) return null
    return { role: p[1] as 'a' | 'c', id: _unb64uStr(p[2]), email: _unb64uStr(p[3]) }
  } catch (_) { return null }
}
async function _envoyerMailCompte(role: 'a' | 'c', id: string, email: string, login: string, nom: string, bienvenue: boolean): Promise<boolean> {
  const tok = await _jetonEmail(role, id, email); if (!tok) return false
  const lien = _appLien('confirm_email', tok)
  const prenom = String(nom || '').trim().split(/\s+/)[0] || ''
  const blocLogin = `<div style="background:#0f1525;border:1px solid #263050;border-radius:12px;padding:14px 16px;margin:0 0 6px">
      <div style="font-size:12px;color:#8b96b0;text-transform:uppercase;letter-spacing:.08em">Ton login${role === 'c' ? ' coach' : ''}</div>
      <div style="font-size:28px;font-weight:800;letter-spacing:.2em;color:#fff;margin-top:4px">${_escHtml(login)}</div></div>`
  const html = bienvenue
    ? _mailCompte(`Bienvenue sur Novalyz${prenom ? ', ' + _escHtml(prenom) : ''} 👋`, `
      <p style="color:#a9b4cc;line-height:1.55;margin:0 0 16px">Ton compte est créé. Garde ce mail : il contient ton identifiant de connexion.</p>
      ${blocLogin}
      <p style="color:#a9b4cc;line-height:1.55;margin:16px 0 0">Confirme ton adresse : c'est elle qui te permettra de récupérer ton mot de passe.</p>
      ${_mailBouton(lien, 'Confirmer mon adresse')}
      <p style="color:#8b96b0;font-size:13px;line-height:1.5;margin:0">Mot de passe oublié ? Sur l'écran de connexion, touche « Mot de passe oublié ? » et saisis cette adresse : tu recevras un lien pour en choisir un nouveau. Par sécurité, Novalyz n'envoie jamais ton mot de passe.</p>
      <p style="color:#5f6b86;font-size:12px;line-height:1.5;margin:14px 0 0">Tu n'as pas créé de compte Novalyz ? Ignore ce mail.</p>`)
    : _mailCompte('Confirme ton adresse e-mail', `
      <p style="color:#a9b4cc;line-height:1.55;margin:0 0 6px">Cette adresse vient d'être associée à ton compte Novalyz (login <b>${_escHtml(login)}</b>). Confirme-la : c'est elle qui te permettra de récupérer ton mot de passe.</p>
      ${_mailBouton(lien, 'Confirmer mon adresse')}
      <p style="color:#5f6b86;font-size:12px;line-height:1.5;margin:0">Lien valable 7 jours. Ce n'est pas toi ? Ignore ce mail.</p>`)
  return _envoyerEmail(email, bienvenue ? 'Bienvenue sur Novalyz — ton login' : 'Confirme ton adresse e-mail Novalyz', html)
}
async function handleConfirmerEmail(body: any): Promise<Response> {
  const j = await _lireJetonEmail(String(body.token || ''))
  if (!j) return jsonResp({ success: false, error: 'Lien invalide ou expiré.' })
  // L'adresse doit être TOUJOURS celle du compte (sinon le lien d'une ancienne adresse confirmerait la nouvelle).
  const { data } = j.role === 'a'
    ? await sb().from('athletes').select('email').eq('id', j.id).single()
    : await sb().from('coachs').select('email').eq('coach_id', j.id).single()
  if (!data || String((data as any).email || '').trim().toLowerCase() !== j.email) return jsonResp({ success: false, error: 'Cette adresse n\'est plus celle de ton compte.' })
  const r = j.role === 'a'
    ? await sb().from('athletes').update({ email_verifie: true }).eq('id', j.id)
    : await sb().from('coachs').update({ email_verifie: true }).eq('coach_id', j.id)
  if (r.error) return jsonResp({ success: false, error: r.error.message })
  return jsonResp({ success: true })
}
// Renvoyer le lien de confirmation (compte de la session).
async function handleRenvoyerConfirmationEmail(body: any): Promise<Response> {
  const role = body._sessRole === 'c' ? 'c' : 'a', id = String(body._sessId || '')
  if (!id) return jsonResp({ success: false, error: 'Session requise' })
  const { data } = role === 'a'
    ? await sb().from('athletes').select('email,login,nom,email_verifie').eq('id', id).single()
    : await sb().from('coachs').select('email,login,nom,email_verifie').eq('coach_id', id).single()
  const d: any = data || {}
  if (!d.email) return jsonResp({ success: false, error: 'Aucune adresse e-mail sur ton compte.' })
  if (d.email_verifie) return jsonResp({ success: true, deja: true })
  const ok = await _envoyerMailCompte(role, id, String(d.email).trim(), String(d.login || ''), String(d.nom || ''), false)
  return jsonResp(ok ? { success: true } : { success: false, error: 'Envoi impossible pour le moment.' })
}

async function handleLogin(params: URLSearchParams): Promise<Response> {
  const login = params.get('login')?.trim()
  const pwd = params.get('password')?.trim()
  if (!login || !pwd) return jsonResp({ erreur: 'Paramètres manquants' })

  const cleL = 'a:' + login
  const bloqueMin = await _loginBloqueMin(cleL)
  if (bloqueMin) return jsonResp({ erreur: _msgBloque(bloqueMin), error: _msgBloque(bloqueMin), bloque: true })

  const { data: ath } = await sb().from('athletes').select('*').eq('login', login).single()
  if (!ath) { await _loginEchec(cleL); return jsonResp({ erreur: 'Identifiants incorrects', error: 'Identifiants incorrects' }) }

  const { ok, upgrade } = await verifyPwd(pwd, ath.password_hash || '', ath.login)
  if (!ok) { await _loginEchec(cleL); return jsonResp({ erreur: 'Identifiants incorrects', error: 'Identifiants incorrects' }) }
  await _loginReussi(cleL)
  if (upgrade) await _passerEnW1('athletes', 'id', String(ath.id), upgrade, ath.password_hash)   // 10/11 : passage en w1

  // objectif (chaîne) + poids courant depuis la table objectif (comme Code.gs athleteFromRow)
  const { data: objRow } = await sb().from('objectif').select('*').eq('athlete_id', ath.id).limit(1)
  const obj = objRow?.[0]
  const poids = (ath.poids != null && ath.poids !== '') ? Number(ath.poids)
    : (obj?.poids_kg != null && obj.poids_kg !== '') ? Number(obj.poids_kg) : null

  // Stratégie de surcharge progressive : si vide en base (ex. migration), on la
  // recalcule depuis les années de pratique (muscu uniquement) — auto-réparation.
  const sportL = ath.sport || 'muscu'
  // N2 : ancienneté EFFECTIVE (évolue avec le temps depuis la création) → pilote le
  // niveau et la stratégie. Si une stratégie est déjà figée en base, on la respecte.
  const anneesEffL = anneesEffectives(ath.annees, ath.created_at, new Date())
  const strategieL = ath.strategie || (sportL === 'muscu' ? getStrategieFromAnnees(anneesEffL) : '')

  return jsonResp({ success: true, athlete: {
    athlete_id: ath.id,
    login: ath.login,
    nom: ath.nom,
    sport: sportL,
    coach_id: ath.coach_id,
    strategie: strategieL,
    objectif: obj?.objectif ?? strategieL ?? '',
    strategie_progression: strategieL || 'Progression linéaire',
    annees_pratique: anneesEffL,
    poids,
    taille: (ath.taille != null && ath.taille !== '') ? Number(ath.taille) : null,
    ddn: ath.ddn ? fmtFR(ath.ddn) : '',
    sexe: (ath.sexe === 'H' || ath.sexe === 'F') ? ath.sexe : '',
    email: ath.email || '',
    email_verifie: !!ath.email_verifie,
    recap_freq: ath.recap_freq || 'off',
  }})
}

// Validation minimale d'un email (format). L'email est OPTIONNEL dans Novalyz :
// une chaîne vide est gérée en amont (non stockée), ici on ne juge que le format.
function _emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function handleRegister(params: URLSearchParams): Promise<Response> {
  const login = params.get('login')?.trim()
  const pwd = params.get('password')?.trim()
  const nom = (params.get('prenom') || params.get('nom') || login)?.trim()
  const ddn = params.get('ddn') || null
  const taille = params.get('taille') || null
  const poids = params.get('poids') || null
  const annees = params.get('annees') || '0'
  const sport = params.get('sport') || 'muscu'
  const email = (params.get('email') || '').trim()
  const sexe = String(params.get('sexe') || '').trim().toUpperCase()
  // 07/11 (maquette validée) : tout est obligatoire, vérifié ICI aussi (avant : seulement dans l'app → comptes à moitié remplis).
  const refus = (m: string) => jsonResp({ erreur: m, message: m })
  if (!login || !pwd) return refus('Login et mot de passe obligatoires.')
  if (!/^\d{4}$/.test(login)) return refus('Le login doit faire 4 chiffres.')
  if (pwd.length < MDP_MIN) return refus('Mot de passe : 6 caractères minimum.')   // C6
  if (!nom || nom === login) return refus('Indique ton prénom.')
  if (!email || !_emailValide(email)) return refus('E-mail invalide.')
  if (sexe !== 'H' && sexe !== 'F') return refus('Indique ton sexe.')
  const ddnD = ddn ? new Date(String(ddn).slice(0, 10) + 'T00:00:00') : null
  const age = ddnD && !isNaN(ddnD.getTime()) ? (Date.now() - ddnD.getTime()) / (365.25 * 864e5) : NaN
  if (!(age >= 10 && age <= 100)) return refus('Date de naissance invalide.')
  const tN = Number(taille), pN = Number(String(poids || '').replace(',', '.'))
  if (!(tN >= 100 && tN <= 250)) return refus('Taille invalide (en cm).')
  if (!(pN >= 25 && pN <= 300)) return refus('Poids invalide (en kg).')
  if (sport === 'muscu' && !(params.get('annees') != null && params.get('annees') !== '' && Number(annees) >= 0 && Number(annees) <= 80)) return refus('Indique tes années de pratique.')

  // Accès bêta par code d'invitation : si le secret BETA_INVITE_CODE est défini,
  // l'inscription exige ce code. S'il est vide/absent → inscription OUVERTE
  // (rétro-compatible : la garde ne s'active que quand tu poses le secret).
  const code = (params.get('code') || '').trim()
  const required = (Deno.env.get('BETA_INVITE_CODE') || '').trim()
  if (required && code !== required) return jsonResp({ erreur: 'Code invalide', message: 'Code d\'invitation invalide ou manquant.', code_requis: true })

  const { data: existing } = await sb().from('athletes').select('id').eq('login', login).single()
  if (existing) return jsonResp({ erreur: 'Login déjà utilisé', message: 'Ce login est déjà pris : choisis-en un autre.', login_pris: true })

  const hash = await hashPourStockage(pwd, login)
  const newId = await nextAthleteId()
  const { data, error } = await _insererAvecMotDePasse('athletes', { id: newId, login, nom, sport, ddn, taille, poids: (poids != null && poids !== '') ? (Number(poids) || null) : null, annees: Number(annees) || 0, email: email || null, sexe }, hash)
  if (error) return jsonResp({ erreur: error.message, message: error.message })
  // C9 : mail de bienvenue (login + confirmer l'adresse). Un échec d'envoi ne bloque pas l'inscription.
  if (email) { try { await _envoyerMailCompte('a', String(data.id), email, String(data.login), String(data.nom || ''), true) } catch (_) {} }
  return jsonResp({ success: true, athlete: {
    athlete_id: data.id,
    login: data.login,
    nom: data.nom,
    sport: data.sport || 'muscu',
    coach_id: null,
    // Niveau dérivé des années saisies DÈS l'inscription (comme au login) — sinon les
    // cibles de volume restaient « intermédiaire » par défaut jusqu'à la reconnexion.
    strategie: sport === 'muscu' ? getStrategieFromAnnees(Number(annees) || 0) : '',
    objectif: '',
    strategie_progression: sport === 'muscu' ? getStrategieFromAnnees(Number(annees) || 0) : '',
    annees_pratique: Number(annees) || 0,
    email: email || '',
    email_verifie: false,
  }})
}

// L'athlète change LUI-MÊME son mot de passe (connecté). Preuve de possession :
// on exige le mot de passe ACTUEL (verifyPwd) avant de le remplacer. Réutilise
// hashSalted (salt = login). Ne touche qu'à password_hash.
async function handleChangePassword(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const ancien = _mdp(body.ancien_mdp)
  const nouveau = _mdp(body.nouveau_mdp)
  if (!athlete_id || !ancien || !nouveau) return jsonResp({ success: false, error: 'Paramètres manquants' })
  if (nouveau.length < 6) return jsonResp({ success: false, error: 'Mot de passe : 6 caractères minimum.' })
  const { data: ath } = await sb().from('athletes').select('id,login,password_hash').eq('id', athlete_id).single()
  if (!ath) return jsonResp({ success: false, error: 'Accès refusé' })
  const { ok } = await verifyPwd(ancien, ath.password_hash || '', ath.login)
  if (!ok) return jsonResp({ success: false, error: 'Mot de passe actuel incorrect' })
  const hash = await hashPourStockage(nouveau, ath.login)
  const { error } = await _majMotDePasse('athletes', 'id', String(ath.id), hash)
  if (error) return jsonResp({ success: false, error: error.message })
  await _invaliderTokensReset(String(ath.id))   // sécurité : plus aucun lien de reset actif
  const token = await _revoquerSessions('a', String(ath.id))   // C8 : autres appareils déconnectés, celui-ci reste connecté
  return jsonResp(token ? { success: true, token } : { success: true })
}

// Ajout / mise à jour / effacement de l'email d'un athlète (compte existant).
// Email OPTIONNEL : une chaîne vide efface l'email. Un email non vide doit être
// valide. Ne touche à aucun autre champ.
async function handleSaveEmail(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const email = String(body.email || '').trim()
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  if (email && !_emailValide(email)) return jsonResp({ success: false, error: 'Email invalide' })
  const { data: avant } = await sb().from('athletes').select('email,login,nom,email_verifie').eq('id', athlete_id).single()
  const change = String((avant as any)?.email || '').trim().toLowerCase() !== email.toLowerCase()
  const patch: any = { email: email || null }
  if (change) patch.email_verifie = false
  const { error } = await sb().from('athletes').update(patch).eq('id', athlete_id)
  if (error) return jsonResp({ success: false, error: error.message })
  // C9 : nouvelle adresse → lien de confirmation.
  let confirmationEnvoyee = false
  if (change && email) { try { confirmationEnvoyee = await _envoyerMailCompte('a', athlete_id, email, String((avant as any)?.login || ''), String((avant as any)?.nom || ''), false) } catch (_) {} }
  return jsonResp({ success: true, email, email_verifie: change ? false : !!(avant as any)?.email_verifie, confirmation_envoyee: confirmationEnvoyee })
}

// L'athlète met à jour son profil (nom, taille, poids, années, ddn). Ne touche
// qu'aux champs fournis. N'affecte ni login ni mot de passe ni coach.
async function handleSaveProfil(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const patch: any = {}
  if (body.nom != null && String(body.nom).trim()) patch.nom = String(body.nom).trim()
  if (body.taille != null && body.taille !== '') patch.taille = Number(body.taille) || null
  if (body.poids != null && body.poids !== '') patch.poids = Number(body.poids) || null
  if (body.ddn != null && String(body.ddn).trim()) patch.ddn = String(body.ddn).trim()
  // Sexe (H / F) : sert au calcul des calories (Mifflin-St Jeor) et à l'analyse morpho.
  if (body.sexe === 'H' || body.sexe === 'F') patch.sexe = body.sexe
  if (body.annees != null && body.annees !== '') {
    // Le profil affiche l'ancienneté EFFECTIVE (saisie + années écoulées depuis la création,
    // cf. anneesEffectives). On stocke donc la BASE = effective − écoulées ; sinon chaque
    // enregistrement du profil rajoutait les années écoulées une 2e fois.
    const { data: aRow } = await sb().from('athletes').select('created_at').eq('id', athlete_id).single()
    const eff = Number(body.annees) || 0
    const ecoulees = anneesEffectives(0, aRow?.created_at, new Date())
    patch.annees = Math.max(0, eff - ecoulees)
  }
  if (!Object.keys(patch).length) return jsonResp({ success: false, error: 'Rien à enregistrer' })
  const { error } = await sb().from('athletes').update(patch).eq('id', athlete_id)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

// Le coach met à jour son profil (nom, email). Email optionnel, validé s'il est
// non vide.
async function handleSaveCoachProfil(body: any): Promise<Response> {
  const coach_id = String(body.coach_id || '')
  if (!coach_id) return jsonResp({ success: false, error: 'coach_id manquant' })
  const patch: any = {}
  if (body.nom != null && String(body.nom).trim()) patch.nom = String(body.nom).trim()
  let nouvelEmail = '', avantC: any = null
  if (body.email != null) {
    const e = String(body.email).trim()
    if (e && !_emailValide(e)) return jsonResp({ success: false, error: 'Email invalide' })
    patch.email = e || null
    const { data: av } = await sb().from('coachs').select('email,login,nom,email_verifie').eq('coach_id', coach_id).single()
    avantC = av || {}
    if (String(avantC.email || '').trim().toLowerCase() !== e.toLowerCase()) { patch.email_verifie = false; nouvelEmail = e }
  }
  if (!Object.keys(patch).length) return jsonResp({ success: false, error: 'Rien à enregistrer' })
  const { error } = await sb().from('coachs').update(patch).eq('coach_id', coach_id)
  if (error) return jsonResp({ success: false, error: error.message })
  let confirmationEnvoyee = false
  if (nouvelEmail) { try { confirmationEnvoyee = await _envoyerMailCompte('c', coach_id, nouvelEmail, String(avantC.login || ''), String(patch.nom || avantC.nom || ''), false) } catch (_) {} }
  return jsonResp({ success: true, confirmation_envoyee: confirmationEnvoyee, email_verifie: avantC ? (nouvelEmail ? false : !!avantC.email_verifie) : undefined })
}

// Le coach change LUI-MÊME son mot de passe (preuve de possession : ancien mdp).
async function handleChangePasswordCoach(body: any): Promise<Response> {
  const coach_id = String(body.coach_id || '')
  const ancien = _mdp(body.ancien_mdp)
  const nouveau = _mdp(body.nouveau_mdp)
  if (!coach_id || !ancien || !nouveau) return jsonResp({ success: false, error: 'Paramètres manquants' })
  if (nouveau.length < 6) return jsonResp({ success: false, error: 'Mot de passe : 6 caractères minimum.' })
  const { data: coach } = await sb().from('coachs').select('coach_id,login,password_hash').eq('coach_id', coach_id).single()
  if (!coach) return jsonResp({ success: false, error: 'Accès refusé' })
  const { ok } = await verifyPwd(ancien, coach.password_hash || '', coach.login)
  if (!ok) return jsonResp({ success: false, error: 'Mot de passe actuel incorrect' })
  const hash = await hashPourStockage(nouveau, coach.login)
  const { error } = await _majMotDePasse('coachs', 'coach_id', String(coach_id), hash)
  if (error) return jsonResp({ success: false, error: error.message })
  await _invaliderTokensReset('coach:' + coach_id)
  const token = await _revoquerSessions('c', coach_id)   // C8
  return jsonResp(token ? { success: true, token } : { success: true })
}

// Club et catégorie par défaut du coach (préférence d'équipe). Stockage simple.
async function handleSaveClubCoach(body: any): Promise<Response> {
  const coach_id = String(body.coach_id || '')
  if (!coach_id) return jsonResp({ success: false, error: 'coach_id manquant' })
  const patch = { club: String(body.club || '').trim() || null, categorie_defaut: String(body.categorie_defaut || '').trim() || null }
  const { error } = await sb().from('coachs').update(patch).eq('coach_id', coach_id)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

// ── Export RGPD (portabilité des données) ─────────────────────────────────────
// Tables personnelles d'un athlète, clé = athlete_id (jamais password_hash).
// ── Lecture COMPLÈTE paginée (audit 01/11) ─────────────────────────────────────
// PostgREST (Supabase) plafonne une requête à 1 000 lignes PAR DÉFAUT, SANS erreur : le
// résultat est simplement coupé. Un athlète avec 2 808 lignes de séances n'en voyait que
// 1 000 (records, historique, tendances faux). On lit donc par pages de 1 000 jusqu'au bout.
// build() doit renvoyer une NOUVELLE requête à chaque appel, avec un tri stable (… .order('id')).
async function _toutLire(build: () => any, pas = 1000): Promise<{ data: any[]; error: any }> {
  const out: any[] = []
  for (let i = 0; i < 500; i++) {
    const b = build()
    if (!b || typeof b.range !== 'function') { const r = await b; return { data: (r && r.data) || [], error: (r && r.error) || null } }
    const { data, error } = await b.range(i * pas, i * pas + pas - 1)
    if (error) return { data: out, error }
    out.push(...(data || []))
    if (!data || data.length < pas) break
  }
  return { data: out, error: null }
}

const _EXPORT_TABLES = ['performances', 'indicateurs', 'bien_etre', 'tests', 'objectifs', 'objectif', 'blessures', 'poids_historique', 'commentaires', 'contexte_athlete', 'programme', 'notes', 'planning', 'pauses', 'activites']

async function _collecterDonneesAthlete(id: string): Promise<Record<string, any>> {
  const bloc: Record<string, any> = {}
  for (const t of _EXPORT_TABLES) {
    try { const { data } = await _toutLire(() => sb().from(t).select('*').eq('athlete_id', id).order('id')); bloc[t] = data || [] }
    catch (_) { bloc[t] = [] }
  }
  return bloc
}

// Export complet des données d'UN athlète (JSON). Le hash n'est jamais exporté.
async function handleExportAthlete(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const { data: prof } = await sb().from('athletes').select('*').eq('id', athlete_id).single()
  if (!prof) return jsonResp({ success: false, error: 'Athlète introuvable' })
  const profil: any = { ...prof }; delete profil.password_hash
  const bloc = await _collecterDonneesAthlete(athlete_id)
  return jsonResp({ success: true, data: { export: 'novalyz', type: 'athlete', date: new Date().toISOString(), athlete_id, profil, ...bloc } })
}

// Audit Réglages R3 (01/11, option a) : l'athlète reçoit SES données par e-mail (JSON complet +
// CSV des séances en pièces jointes) — sur l'app Android, le téléchargement direct n'est pas fiable.
async function handleExportAthleteEmail(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const { data: prof } = await sb().from('athletes').select('*').eq('id', athlete_id).single()
  if (!prof) return jsonResp({ success: false, error: 'Athlète introuvable' })
  const email = String((prof as any).email || '').trim()
  if (!email || !_emailValide(email)) return jsonResp({ success: false, error: 'Ajoute d\'abord ton e-mail (Réglages ▸ Mon compte).' })
  const profil: any = { ...prof }; delete profil.password_hash
  const bloc: any = await _collecterDonneesAthlete(athlete_id)
  const stamp = fmtYMD(new Date())
  const json = JSON.stringify({ export: 'novalyz', type: 'athlete', date: new Date().toISOString(), athlete_id, profil, ...bloc }, null, 2)
  const att = [{ filename: 'novalyz-mes-donnees-' + stamp + '.json', content: _b64Utf8(json) }]
  const csv = _csvRows(bloc && bloc.performances || [])
  if (csv) att.push({ filename: 'novalyz-seances-' + stamp + '.csv', content: _b64Utf8(csv) })
  const prenom = String((prof as any).nom || '').trim().split(/\s+/)[0] || ''
  const html = _emailShell('Tes données Novalyz', 'Export du ' + fmtFR(stamp), `<p style="font-size:14px;line-height:1.5;margin:0 0 10px">Bonjour ${_escHtml(prenom)},</p><p style="font-size:14px;line-height:1.5;margin:0">Tu trouveras en pièces jointes toutes tes données : le fichier <b>JSON</b> (profil, séances, bien-être, cardio, poids, programme…) et un <b>CSV</b> de tes séances, lisible dans un tableur.</p>`)
  const ok = await _envoyerEmail(email, 'Novalyz — tes données', html, att)
  return jsonResp(ok ? { success: true, email } : { success: false, error: 'Envoi impossible pour le moment. Réessaie plus tard.' })
}

// Export des données de TOUS les athlètes d'un coach (JSON).
async function handleExportEquipe(body: any): Promise<Response> {
  const coach_id = String(body.coach_id || '')
  if (!coach_id) return jsonResp({ success: false, error: 'coach_id manquant' })
  const { data: aths } = await sb().from('athletes').select('*').eq('coach_id', coach_id)
  const athletes: any[] = []
  for (const a of (aths || [])) {
    const profil: any = { ...a }; delete profil.password_hash
    const bloc = await _collecterDonneesAthlete(a.id)
    athletes.push({ athlete_id: a.id, profil, ...bloc })
  }
  return jsonResp({ success: true, data: { export: 'novalyz', type: 'equipe', date: new Date().toISOString(), coach_id, athletes } })
}

// Bilan d'UN client à la demande (même contenu que le bilan auto envoyé par e-mail,
// mais téléchargeable/imprimable quand le coach le veut). Vérifie que l'athlète
// appartient bien au coach avant de servir quoi que ce soit.
async function handleBilanClient(body: any): Promise<Response> {
  const coach_id = String(body.coach_id || '')
  const athlete_id = String(body.athlete_id || '')
  const periode = String(body.periode || 'semaine') === 'mois' ? 'mois' : 'semaine'
  if (!coach_id || !athlete_id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const { data: rows } = await sb().from('athletes').select('id,nom,coach_id,annees,created_at').eq('id', athlete_id)
  const aRow: any = (rows || [])[0]
  if (!aRow || String(aRow.coach_id) !== coach_id) return jsonResp({ success: false, error: 'Athlète introuvable' })
  const now = new Date()
  const [{ data: perfs }, { data: prog }, { data: be }, { data: sante }] = await Promise.all([
    _toutLire(() => sb().from('performances').select('date,exercice,muscle,charge,reps,rpe,seance_id').eq('athlete_id', athlete_id).order('id')),
    sb().from('programme').select('seance_id,series_prevues').eq('athlete_id', athlete_id),
    sb().from('bien_etre').select('date,sommeil,energie,fatigue_musculaire').eq('athlete_id', athlete_id),
    sb().from('indicateurs').select('date,cle,valeur').eq('athlete_id', athlete_id).like('seance_id', 'sante_%'),
  ])
  const bilan = _bilanAthlete(perfs || [], prog || [], be || [], sante || [], now, periode, anneesEffectives(aRow.annees, aRow.created_at, now))
  const prenom = String(aRow.nom || '').split(/\s+/)[0]
  const html = _emailBilanAthleteHTML(prenom, periode, bilan)
  return jsonResp({ success: true, html, nom: aRow.nom || '' })
}

// Coach : envoi À LA DEMANDE du bilan d'un athlète par e-mail (bouton Réglages coach).
// Même contenu que le bilan auto / la page imprimable, envoyé à l'e-mail de l'athlète.
async function handleEnvoyerBilanMail(body: any): Promise<Response> {
  const coach_id = String(body.coach_id || '')
  const athlete_id = String(body.athlete_id || '')
  const periode = ['mois', '3mois'].indexOf(String(body.periode || '')) >= 0 ? String(body.periode) : 'semaine'
  if (!coach_id || !athlete_id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const { data: rows } = await sb().from('athletes').select('id,nom,email,coach_id,annees,created_at').eq('id', athlete_id)
  const aRow: any = (rows || [])[0]
  if (!aRow || String(aRow.coach_id) !== coach_id) return jsonResp({ success: false, error: 'Athlète introuvable' })
  const email = String(aRow.email || '').trim()
  if (!email) return jsonResp({ success: false, error: "Cet athlète n'a pas renseigné d'e-mail." })
  const now = new Date()
  const [{ data: perfs }, { data: prog }, { data: be }, { data: sante }] = await Promise.all([
    _toutLire(() => sb().from('performances').select('date,exercice,muscle,charge,reps,rpe,seance_id').eq('athlete_id', athlete_id).order('id')),
    sb().from('programme').select('seance_id,series_prevues').eq('athlete_id', athlete_id),
    sb().from('bien_etre').select('date,sommeil,energie,fatigue_musculaire').eq('athlete_id', athlete_id),
    sb().from('indicateurs').select('date,cle,valeur').eq('athlete_id', athlete_id).like('seance_id', 'sante_%'),
  ])
  const bilan = _bilanAthlete(perfs || [], prog || [], be || [], sante || [], now, periode, anneesEffectives(aRow.annees, aRow.created_at, now))
  const prenom = String(aRow.nom || '').split(/\s+/)[0]
  const html = _emailBilanAthleteHTML(prenom, periode, bilan)
  const label = periode === '3mois' ? 'des 3 derniers mois' : periode === 'mois' ? 'du mois' : 'de la semaine'
  const sent = await _envoyerEmail(email, `Novalyz — Ton bilan ${label}`, html)
  return jsonResp({ success: sent, email, error: sent ? null : "Échec de l'envoi (réessaie)." })
}

// Envoi de l'analyse morpho par e-mail. HTML construit SERVEUR à partir du
// résultat structuré (chaînes échappées) → pas d'injection. Bac à sable Resend :
// seul l'e-mail du compte propriétaire est délivré tant qu'un domaine n'est pas vérifié.
function _mEsc(s: any): string { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function _morphoMailHTML(nom: string, r: any, seg: any): string {
  r = r || {}
  const card = (title: string, inner: string) => `<div style="background:#141a28;border:1px solid #2a3450;border-radius:12px;padding:12px 14px;margin:0 0 12px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#8b96b0;margin-bottom:8px">${title}</div>${inner}</div>`
  let b = ''
  if (r.morphotype) b += card("Vue d'ensemble", `<div style="font-size:14px;color:#e9eef8">${_mEsc(r.morphotype)}</div>`)
  if (Array.isArray(r.equilibre) && r.equilibre.length) b += card('Équilibre musculaire', r.equilibre.map((e: any) => `<div style="font-size:13px;color:#e9eef8;margin:3px 0">${_mEsc(e.g)} — <b>${_mEsc(e.n)}</b></div>`).join(''))
  if (Array.isArray(r.priorites) && r.priorites.length) b += card("Priorités d'entraînement", r.priorites.map((p: any, i: number) => `<div style="font-size:13px;color:#e9eef8;margin:5px 0"><b>${i + 1}. ${_mEsc(p.t)}</b>${p.d ? ` — <span style="color:#8b96b0">${_mEsc(p.d)}</span>` : ''}${Array.isArray(p.ex) && p.ex.length ? `<div style="color:#8b96b0;font-size:12px">${p.ex.map((x: any) => _mEsc(x)).join(' · ')}</div>` : ''}</div>`).join(''))
  if (Array.isArray(r.exercices) && r.exercices.length) b += card('Exercices selon les leviers', r.exercices.map((e: any) => `<div style="font-size:13px;color:#e9eef8;margin:6px 0"><b>${_mEsc(e.t)}</b>${e.d ? ` — <span style="color:#8b96b0">${_mEsc(e.d)}</span>` : ''}${Array.isArray(e.bons) && e.bons.length ? `<div style="color:#37d3b5;font-size:12px">À privilégier : ${e.bons.map((x: any) => _mEsc(x)).join(', ')}</div>` : ''}${Array.isArray(e.eviter) && e.eviter.length ? `<div style="color:#ff8a8d;font-size:12px">À éviter : ${e.eviter.map((x: any) => _mEsc(x)).join(', ')}</div>` : ''}</div>`).join(''))
  if (r.reco) b += card('Reco Novalyz', `<div style="font-size:13px;color:#e9eef8">${_mEsc(r.reco)}</div>`)
  const SL: Record<string, string> = { taille: 'Taille', tronc: 'Tronc', epaules: 'Épaules', hanches: 'Hanches', humerus: 'Humérus', avantbras: 'Avant-bras', envergure: 'Envergure', femur: 'Fémur', tibia: 'Tibia' }
  const sp = Object.keys(SL).filter(k => seg && seg[k] != null && Number(seg[k]) > 0).map(k => `${SL[k]} ${Number(seg[k])} cm`)
  if (sp.length) b += card('Mesures de segment', `<div style="font-size:12px;color:#8b96b0">${sp.map(x => _mEsc(x)).join(' · ')}</div>`)
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;background:#0b0e14;color:#e9eef8;margin:0;padding:16px">${_mailHeader()}<div style="max-width:620px;margin:0 auto"><h2 style="margin:0 0 4px">Analyse morpho-anatomique${nom ? ` — ${_mEsc(nom)}` : ''}</h2><div style="color:#8b96b0;font-size:12px;margin-bottom:14px">Indicatif, non médical. Généré par Novalyz.</div>${b || '<div style="color:#8b96b0">Analyse vide.</div>'}</div></body></html>`
}
async function handleEnvoyerMorphoMail(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  let to = String(body.to || '').trim()
  if (!to && athlete_id) { try { const { data } = await sb().from('athletes').select('email').eq('id', athlete_id); if (data?.length && data[0].email) to = String(data[0].email).trim() } catch (_) {} }
  if (!to && athlete_id) { try { const { data } = await sb().from('athletes_email').select('email').eq('athlete_id', athlete_id).limit(1); if (data?.length && data[0].email) to = String(data[0].email).trim() } catch (_) {} }
  if (!to || !_emailValide(to)) return jsonResp({ success: false, error: "Aucune adresse e-mail valide (renseigne-la d'abord)." })
  const html = _morphoMailHTML(String(body.nom || ''), body.resultat || {}, body.segments || {})
  const sent = await _envoyerEmail(to, 'Novalyz — Analyse morphologique', html)
  return jsonResp({ success: sent, email: to, error: sent ? null : "Échec de l'envoi. (Bac à sable Resend : seul l'e-mail du compte est délivré pour l'instant.)" })
}

// ── Reset de mot de passe par email (P2 — backend seul) ───────────────────────
// Réponse TOUJOURS générique pour un email valide (anti-énumération) : on ne
// révèle jamais si un compte existe. Le token brut n'existe QUE dans le lien de
// l'email ; en base on ne garde que son hash. Expiration 1 h, usage unique.
// ⚠️ PRODUCTION : cette action DEVRA être protégée par un rate limiting (par IP
// et par email) avant mise en production — non implémenté dans cette étape.
const RESET_MSG_GENERIQUE = 'Si un compte correspond à cette adresse, un email de réinitialisation a été envoyé.'
const RESET_TOKEN_MSG = 'Lien invalide ou expiré. Refais une demande.'   // message unique (anti-énumération)
const RESET_MAX_PAR_FENETRE = 3          // rate limiting : max demandes par compte…
const RESET_FENETRE_MS = 15 * 60 * 1000  // …sur une fenêtre de 15 min (durable, en base).

// Invalide TOUS les tokens de reset encore actifs d'un athlète (used=true).
// Appelé après tout changement de mot de passe (reset email, self-service,
// reset coach) pour qu'aucun ancien lien ne reste exploitable.
async function _invaliderTokensReset(athlete_id: string): Promise<void> {
  try { await sb().from('password_reset_tokens').update({ used: true }).eq('athlete_id', String(athlete_id)).eq('used', false) } catch (_) {}
}

// Envoie l'email de reset via Resend. Ne logue jamais la clé ni le token.
// Envoi e-mail générique (Resend) — UNE source unique pour tous les e-mails
// transactionnels (reset de mot de passe, résumés coach/athlète…). Renvoie true
// si Resend a accepté l'envoi.
// ⚠️ Bac à sable Resend : tant qu'aucun domaine n'est vérifié (from =
//    onboarding@resend.dev), Resend ne délivre QU'À l'adresse du compte
//    propriétaire. Les autres destinataires ne reçoivent rien (cf. roadmap P0-1).
// En-tête e-mail : logo Novalyz + nom (image absolue, compatible clients mail).
// Audit connexion C10 (02/11) : bandeau unique (logo + logotype NOVALYZ sur bloc noir, nid d'abeille
// bleu) — une image plutôt qu'un fond CSS, ignoré par certains logiciels de mail. Hébergé sous /dev/
// (conservé par le déploiement de main) ; secret MAIL_LOGO_URL pour pointer ailleurs sans redéployer.
const MAIL_LOGO_URL = Deno.env.get('MAIL_LOGO_URL') || 'https://app.novalyz.fr/assets/mail-header.png'
function _mailHeader(): string {
  return `<div style="max-width:620px;margin:0 auto 14px">
    <img src="${MAIL_LOGO_URL}" width="620" alt="Novalyz — Analyze · Plan · Perform" style="display:block;width:100%;max-width:620px;height:auto;border:0;border-radius:14px">
  </div>`
}
async function _envoyerEmail(to: string, subject: string, html: string, attachments?: { filename: string; content: string }[]): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) { console.error('email: RESEND_API_KEY absente'); return false }
  const dest = String(to || '').trim()
  if (!dest || !_emailValide(dest)) { console.error('email: destinataire invalide'); return false }
  const from = Deno.env.get('RESEND_FROM') || 'Novalyz <onboarding@resend.dev>'
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(attachments && attachments.length ? { from, to: [dest], subject, html, attachments } : { from, to: [dest], subject, html }),
    })
    if (!r.ok) { console.error('email: envoi refusé (HTTP ' + r.status + ')'); return false }
    return true
  } catch (_) { console.error('email: erreur réseau envoi'); return false }
}
// UTF-8 → base64 (pièces jointes Resend : champ « content » en base64).
function _b64Utf8(txt: string): string {
  const bytes = new TextEncoder().encode(txt); let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
function _csvRows(rows: any[]): string {
  if (!rows || !rows.length) return ''
  const cols = Object.keys(rows[0]), esc = (v: any) => { const t = v == null ? '' : String(v); return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t }
  return [cols.join(',')].concat(rows.map((r: any) => cols.map((c) => esc(r[c])).join(','))).join('\n')
}

// C2 (02/11) : liens des mails vers la PROD par défaut (avant : préprod /dev/). Secret APP_BASE_URL prioritaire.
function _appLien(param: string, val: string): string {
  const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://app.novalyz.fr/'
  return baseUrl + (baseUrl.indexOf('?') !== -1 ? '&' : '?') + param + '=' + encodeURIComponent(val)
}
// Coquille simple des mails de compte (reset, bienvenue, confirmation).
function _mailCompte(titre: string, corps: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,sans-serif;background:#0b0e14;color:#e9eef8;margin:0;padding:16px">
    ${_mailHeader()}
    <div style="max-width:620px;margin:0 auto;background:#141a28;border:1px solid #2a3450;border-radius:14px;padding:20px 16px">
      <h2 style="margin:0 0 12px;font-size:20px">${titre}</h2>
      ${corps}
    </div></body></html>`
}
function _mailBouton(lien: string, txt: string): string {
  return `<p style="text-align:center;margin:20px 0"><a href="${lien}" style="display:inline-block;background:#1A5FFF;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${txt}</a></p>`
}
// comptes = [{ type: 'athlète' | 'coach', login, token }]
async function _envoyerEmailReset(email: string, comptes: { type: string; login: string; token: string }[]): Promise<boolean> {
  const plusieurs = comptes.length > 1
  const blocs = comptes.map((c) => (plusieurs ? `<p style="margin:16px 0 0;color:#e9eef8">Compte ${_escHtml(c.type)} — login <b>${_escHtml(c.login)}</b></p>` : '')
    + _mailBouton(_appLien('reset_token', c.token), 'Réinitialiser mon mot de passe')).join('')
  const html = _mailCompte('Réinitialisation de votre mot de passe', `
      <p style="color:#a9b4cc;line-height:1.5">Une demande de réinitialisation de mot de passe Novalyz a été faite pour cette adresse${plusieurs ? ', qui est liée à plusieurs comptes. Choisissez le compte concerné' : ''}. Le lien s'ouvre dans votre navigateur ; reconnectez-vous ensuite dans l'app avec le nouveau mot de passe.</p>
      ${blocs}
      <p style="color:#8b96b0;font-size:13px;line-height:1.5">Lien valable <b>1 heure</b>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.</p>`)
  return _envoyerEmail(email, 'Réinitialisation de votre mot de passe Novalyz', html)
}

// Recherche sans casse d'une adresse (ilike, jokers % et _ neutralisés).
function _ilikeExact(v: string): string { return v.replace(/[\\%_]/g, (m) => '\\' + m) }

async function handleRequestPasswordReset(body: any): Promise<Response> {
  const email = String(body.email || '').trim()
  // Étape A — format invalide : erreur normale, rien créé, rien envoyé.
  if (!email || !_emailValide(email)) return jsonResp({ success: false, error: 'Email invalide' })

  // Réponse identique dans tous les cas valides (anti-énumération).
  const generique = () => jsonResp({ success: true, message: RESET_MSG_GENERIQUE })

  // C3/C4 (02/11) : sans casse, TOUS les comptes de l'adresse (athlètes ET coachs). Avant : un seul
  // athlète attendu (.single) → aucune adresse partagée ne recevait rien, et les coachs jamais.
  const motif = _ilikeExact(email)
  const [{ data: aths }, { data: chs }] = await Promise.all([
    sb().from('athletes').select('id,login').ilike('email', motif),
    sb().from('coachs').select('coach_id,login').ilike('email', motif),
  ])
  const cibles = [
    ...(aths || []).map((a: any) => ({ cle: String(a.id), type: 'athlète', login: String(a.login || '') })),
    ...(chs || []).map((c: any) => ({ cle: 'coach:' + String(c.coach_id), type: 'coach', login: String(c.login || '') })),
  ]
  if (!cibles.length) return generique()

  const comptes: { type: string; login: string; token: string; hash: string }[] = []
  for (const c of cibles) {
    // Rate limiting DURABLE (en base), par compte : au-delà, même réponse générique, rien envoyé.
    try {
      const { data: recents } = await sb().from('password_reset_tokens').select('created_at').eq('athlete_id', c.cle)
      const seuil = Date.now() - RESET_FENETRE_MS
      const nb = (recents || []).filter((r: any) => new Date(r.created_at).getTime() > seuil).length
      if (nb >= RESET_MAX_PAR_FENETRE) { console.error('reset: rate limit atteint'); continue }
    } catch (_) {}
    // Un seul lien actif par compte.
    await _invaliderTokensReset(c.cle)
    // Jeton aléatoire (32 octets → 64 hex) ; seul son hash est stocké ; expiration +1 h.
    const rawBytes = new Uint8Array(32); crypto.getRandomValues(rawBytes)
    const rawToken = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    const token_hash = await sha256hex(rawToken)
    const expires_at = new Date(Date.now() + 3600 * 1000).toISOString()
    const { error } = await sb().from('password_reset_tokens').insert({ athlete_id: c.cle, token_hash, expires_at, used: false, created_at: new Date().toISOString() })
    if (error) { console.error('reset: échec insertion token'); continue }
    comptes.push({ type: c.type, login: c.login, token: rawToken, hash: token_hash })
  }
  if (!comptes.length) return generique()

  // Envoi. En cas d'échec Resend : invalider les tokens (pas de reset actif inutilisable).
  const envoye = await _envoyerEmailReset(email, comptes)
  if (!envoye) {
    for (const c of comptes) { try { await sb().from('password_reset_tokens').update({ used: true }).eq('token_hash', c.hash) } catch (_) {} }
  }
  // Anti-énumération : on renvoie toujours la même réponse générique.
  return generique()
}

// Complète le reset : consomme un token valide (non expiré, non utilisé) et
// remplace le mot de passe. Le token est fourni EN CLAIR par le lien de l'email ;
// on le compare par son hash. Usage unique (token marqué used après succès).
async function handleResetPassword(body: any): Promise<Response> {
  const token = String(body.token || '').trim()
  const nouveau = _mdp(body.nouveau_mdp)
  if (!token || !nouveau) return jsonResp({ success: false, error: 'Paramètres manquants' })
  if (nouveau.length < 6) return jsonResp({ success: false, error: 'Mot de passe : 6 caractères minimum.' })

  const token_hash = await sha256hex(token)
  // Message UNIQUE pour tout échec de token (invalide / utilisé / expiré) :
  // ne révèle pas lequel (anti-énumération).
  const { data: row } = await sb().from('password_reset_tokens').select('*').eq('token_hash', token_hash).eq('used', false).single()
  if (!row) return jsonResp({ success: false, error: RESET_TOKEN_MSG })
  if (new Date(row.expires_at).getTime() < Date.now()) {
    try { await sb().from('password_reset_tokens').update({ used: true }).eq('token_hash', token_hash) } catch (_) {}
    return jsonResp({ success: false, error: RESET_TOKEN_MSG })
  }

  // C4 (02/11) : jeton d'un compte coach = « coach:<coach_id> ».
  const cle = String(row.athlete_id)
  if (cle.startsWith('coach:')) {
    const cid = cle.slice(6)
    const { data: co } = await sb().from('coachs').select('coach_id,login').eq('coach_id', cid).single()
    if (!co) return jsonResp({ success: false, error: RESET_TOKEN_MSG })
    const hashC = await hashPourStockage(nouveau, co.login)
    const { error: eC } = await _majMotDePasse('coachs', 'coach_id', String(cid), hashC)
    if (eC) return jsonResp({ success: false, error: eC.message })
    await _invaliderTokensReset(cle)
    await _revoquerSessions('c', cid)   // C8 : les autres appareils sont déconnectés
    return jsonResp({ success: true })
  }
  const { data: ath } = await sb().from('athletes').select('id,login').eq('id', cle).single()
  if (!ath) return jsonResp({ success: false, error: RESET_TOKEN_MSG })

  const hash = await hashPourStockage(nouveau, ath.login)
  const { error } = await _majMotDePasse('athletes', 'id', String(ath.id), hash)
  if (error) return jsonResp({ success: false, error: error.message })
  // Succès : invalider TOUS les tokens de reset actifs de l'athlète (dont celui-ci).
  await _invaliderTokensReset(String(ath.id))
  await _revoquerSessions('a', String(ath.id))   // C8
  return jsonResp({ success: true })
}

// « Lecture Novalyz » (muscu) : constats + 1 reco, ORIENTÉS OBJECTIF, à partir de
// signaux DÉJÀ calculés (comparison 4 sem., moteur, régularité). Déterministe ;
// ne recalcule rien et ne remplace pas le moteur (angle progression/objectif).
// Angle complémentaire de moteur.reco (qui est orienté état/récup du jour).
// « Respect du programme » : sur les exercices portant une cible (charge %1RM /
// RPE), combien sont DANS la cible à leur dernière exécution. Réutilise la même
// logique que le front (1RM estimé = max charge×(1+reps/30) ; charge tol ±5% ;
// RPE moyen ±1). Retourne {nCible, nEval, nOk} ou null si aucune cible définie.
function buildRespectProgramme(programme: any[], seancesDetail: any[], perfs: any[]): any {
  const cibles = (programme || []).filter(p => p && (p.charge_pct_1rm != null || p.rpe_cible != null))
  if (!cibles.length) return null
  const est1RM: Record<string, number> = {}
  for (const r of (perfs || [])) {
    const exo = r.exercice; if (!exo) continue
    const c = Number(r.charge) || 0, reps = Number(r.reps) || 0
    if (!c || !reps) continue
    const e = c * (1 + reps / 30)
    if (!est1RM[exo] || e > est1RM[exo]) est1RM[exo] = e
  }
  const seen: Record<string, boolean> = {}
  let nCible = 0, nEval = 0, nOk = 0
  for (const p of cibles) {
    const exo = p.exercice; if (!exo || seen[exo]) continue; seen[exo] = true
    nCible++
    let lastEx: any = null, lastDate = ''
    for (const s of (seancesDetail || [])) {
      for (const e of (s.exercices || [])) { if (e.nom === exo && (s.date || '') >= lastDate) { lastDate = s.date; lastEx = e } }
    }
    const series = lastEx ? (lastEx.series || []) : []
    if (!series.length) continue
    nEval++
    let chargeOk = true, rpeOk = true
    if (p.charge_pct_1rm != null && est1RM[exo]) {
      const target = Math.round(est1RM[exo] * Number(p.charge_pct_1rm) / 100 / 2.5) * 2.5
      const real = Math.max(...series.map((x: any) => Number(x.charge) || 0))
      if (target && real) chargeOk = Math.abs(real - target) / target <= 0.05
    }
    if (p.rpe_cible != null) {
      const rpes = series.map((x: any) => Number(x.rpe) || 0).filter((v: number) => v > 0)
      if (rpes.length) { const mr = Math.round(rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length); rpeOk = Math.abs(mr - Number(p.rpe_cible)) <= 1 }
    }
    if (chargeOk && rpeOk) nOk++
  }
  return { nCible, nEval, nOk }
}
function buildSyntheseMuscu(objectif: string, comparison: any, moteur: any, regularite: any, execCible?: any, extras?: any): any {
  // Normalisé SANS accents : des valeurs héritées existent (« séche » vs « sèche »),
  // la détection doit rester robuste à l'orthographe (sinon le cadrage saute).
  const obj = String(objectif || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const prise = obj.includes('masse') || obj.includes('hypertroph')
  const seche = obj.includes('seche') || obj.includes('perte')
  // Objectif = colonne vertébrale : recomp (masse + sèche) et maintien doivent aussi
  // cadrer la lecture (pas seulement masse/sèche). Synchronisé avec OBJECTIFS (front).
  const recomp = prise && seche
  const maintien = obj.includes('maintien')
  const cmp = (comparison && comparison.j28_vs_j28prec) || {}
  const tonEvolRaw = cmp.tonnage ? cmp.tonnage.evol_pct : null
  const rpeDiff = cmp.rpe ? cmp.rpe.diff : null
  // FIABILITÉ : nombre de séances sur la fenêtre courante / précédente (28 j).
  const nCur = cmp.seances ? (cmp.seances.j28 != null ? cmp.seances.j28 : cmp.seances.courant) : null
  const nPrev = cmp.seances ? (cmp.seances.j28_prec != null ? cmp.seances.j28_prec : cmp.seances.precedent) : null
  // Une évolution % n'est fiable que si la période précédente est une VRAIE base
  // (≥ 3 séances) — sinon un mois quasi vide produit des % aberrants (+2400 %…).
  // Audit #6 : une PAUSE (≥ 10 j sans séance) dans la période précédente gonfle la hausse.
  const pausePrev = (extras && extras.pausePrevJours) || 0
  const baseFiable = typeof nPrev === 'number' && nPrev >= 3 && pausePrev < 10
  const tonEvol = (tonEvolRaw != null && baseFiable) ? tonEvolRaw : null
  const recup = (moteur && moteur.recup) || null
  const dispo = (moteur && moteur.disponibilite && moteur.disponibilite.niveau) || null
  // Contexte de performance (déclaré par l'athlète) : la synthèse doit interpréter
  // en conséquence (déload → baisse de volume normale ; intensification → hausse
  // d'effort attendue), sinon l'explication du contexte serait fausse.
  const ctx = (moteur && moteur.contexte_tag) || null
  const enDeload = ctx === 'deload'
  const enIntensif = ctx === 'intensification'
  const enReprise = ctx === 'retour_vacances' || ctx === 'retour_blessure'
  // État du jour dégradé (récup faible OU disponibilité Vigilance/À surveiller) :
  // la reco progression doit alors S'ALIGNER avec le verdict (pas de « augmente »).
  const etatVigilance = recup === 'Faible' || dispo === 'À surveiller' || dispo === 'Vigilance'
  // Régularité selon le RÉGLAGE de l'athlète (Réglages ▸ semaine d'entraînement) :
  //  • calendaire (défaut) : séances du lundi → aujourd'hui, jugées au PRORATA des jours
  //    écoulés (un lundi à 0/4 n'est pas « sous l'objectif » — audit #1) ;
  //  • glissant : séances des 7 derniers jours.
  const semGliss = !!(extras && extras.semaineType === 'glissant')
  const jourSem = Math.min(7, Math.max(1, Number(extras && extras.jourSemaine) || 7))
  const seancesCur = regularite ? (semGliss
    ? (regularite.seances_j7 != null ? regularite.seances_j7 : null)
    : (regularite.seances_semaine != null ? regularite.seances_semaine : null)) : null
  const periodeReg = semGliss ? 'sur les 7 derniers jours' : 'cette semaine'
  const seancesPrev = regularite ? (regularite.seances_prevues || null) : null

  const constats: any[] = []
  if (tonEvol != null) {
    if (tonEvol >= 5 && (rpeDiff == null || rpeDiff <= 0.5)) {
      constats.push({ ton: 'positif', texte: `Ton volume progresse (+${tonEvol}% sur 4 semaines) sans hausse marquée de l'effort perçu — progression cohérente${recomp ? ' avec ta recomposition' : (prise ? ' avec ta prise de masse' : (seche ? ' malgré la sèche, bon signe' : (maintien ? ' — au-delà de ce qu\'un simple maintien demande' : '')))}.` })
    } else if (tonEvol <= -8) {
      if (enDeload) constats.push({ ton: 'neutre', texte: `Volume réduit (${tonEvol}% sur 4 semaines) — normal pendant ton déload, tu récupères.` })
      else if (enReprise) constats.push({ ton: 'neutre', texte: `Volume plus bas (${tonEvol}% sur 4 semaines) — cohérent avec ta reprise, remonte progressivement.` })
      else constats.push({ ton: 'attention', texte: `Ton volume a baissé (${tonEvol}% sur 4 semaines)${recomp ? ' — surveille ta force pour préserver ta recomposition' : (seche ? ' — attention à préserver le muscle pendant la sèche' : (maintien ? ' — tolérable pour un maintien tant que ta régularité tient' : ''))}.` })
    } else {
      constats.push({ ton: 'neutre', texte: `Volume stable sur 4 semaines (${tonEvol > 0 ? '+' : ''}${tonEvol}%).` })
    }
  } else if (tonEvolRaw != null) {
    // Une évolution existe mais la base est trop courte pour l'affirmer honnêtement.
    constats.push({ ton: 'neutre', texte: pausePrev >= 10
      ? `Volume ${tonEvolRaw >= 0 ? 'en hausse' : 'en baisse'} sur 4 semaines, mais la période de comparaison inclut une pause de ${pausePrev} jours : l'évolution n'est pas représentative.`
      : `Pas encore assez de recul pour juger l'évolution de ton volume (période précédente trop courte).` })
  }
  // Respect du programme (exécution vs cible charge %1RM / RPE), si des cibles existent.
  if (execCible && execCible.nEval > 0) {
    const r = execCible.nOk, n = execCible.nEval
    if (r >= Math.ceil(n * 0.7)) constats.push({ ton: 'positif', texte: `Tu respectes ton programme : dans la cible sur ${r}/${n} exercice${n > 1 ? 's' : ''} suivi${n > 1 ? 's' : ''} (charge / RPE).` })
    else constats.push({ ton: 'attention', texte: `Respect du programme : ${r}/${n} exercice${n > 1 ? 's' : ''} dans la cible — ajuste tes charges ou revois tes cibles.` })
  } else if (execCible && execCible.nCible > 0) {
    constats.push({ ton: 'neutre', texte: `Tu as défini des cibles mais pas encore réalisé ces exercices — fais-les pour suivre ton respect du programme.` })
  }
  // En intensification, une hausse de RPE est ATTENDUE → on ne la traite pas comme
  // une contrainte anormale (la récup faible, elle, reste un signal quel que soit le contexte).
  const rpeMonte = rpeDiff != null && rpeDiff >= 0.7 && (tonEvol == null || tonEvol <= 2) && !enIntensif
  const contrainte = rpeMonte || recup === 'Faible'
  if (rpeMonte) {
    constats.push({ ton: 'attention', texte: `Ton effort perçu (RPE) monte (+${rpeDiff}) alors que le volume stagne — tu forces plus pour le même travail.` })
  } else if (recup === 'Faible') {
    constats.push({ ton: 'attention', texte: `Ta récupération est dégradée ces jours-ci.` })
  } else if (etatVigilance) {
    constats.push({ ton: 'attention', texte: `Ton état du jour appelle à la vigilance (récupération / fatigue) — à prendre en compte avant d'intensifier.` })
  }
  // Seuil « sous l'objectif » : 60 % de l'objectif, proratisé aux jours écoulés en calendaire.
  const seuilReg = seancesPrev ? (semGliss ? seancesPrev * 0.6 : Math.floor(seancesPrev * 0.6 * jourSem / 7)) : 0
  const regFaible = !!(seancesPrev && seancesCur != null && seancesCur < seuilReg)
  if (regFaible) constats.push({ ton: 'attention', texte: `Régularité sous ton objectif (${seancesCur}/${seancesPrev} séances ${periodeReg}).` })
  else if (seancesPrev && seancesCur != null && seancesCur >= seancesPrev && !constats.some(c => c.ton === 'attention')) {
    constats.push({ ton: 'positif', texte: `Régularité au rendez-vous (${seancesCur}/${seancesPrev} séances ${periodeReg}).` })
  } else if (seancesPrev && seancesCur != null && !semGliss && seancesCur < seancesPrev) {
    // Semaine en cours, dans les temps : on donne le compte, sans juger.
    constats.push({ ton: 'neutre', texte: `Régularité : ${seancesCur}/${seancesPrev} séances cette semaine.` })
  }

  const aBaisse = tonEvol != null && tonEvol <= -8
  const progOk = tonEvol != null && tonEvol >= 5
  let reco: any
  if (contrainte) reco = { texte: `Allège temporairement le volume ou l'intensité 1 à 2 séances pour laisser la récupération remonter.`, priorite: 'haute' }
  else if (regFaible) reco = { texte: `Vise ${seancesPrev} séances/semaine : la régularité est le 1er moteur de progression.`, priorite: 'moyenne' }
  // État en vigilance : on NE dit PAS « augmente » — on s'aligne sur le verdict.
  else if (etatVigilance && progOk) reco = { texte: `Ta progression est cohérente, mais ton état du jour appelle à la vigilance : garde la charge sans l'augmenter aujourd'hui et priorise la récupération ; tu relanceras la surcharge une fois au vert.`, priorite: 'moyenne' }
  else if (etatVigilance) reco = { texte: `Priorise la récupération aujourd'hui (état en vigilance) avant d'augmenter la charge.`, priorite: 'moyenne' }
  else if (aBaisse) reco = { texte: recomp ? `Reviens à tes charges habituelles pour préserver tes acquis (recomposition).` : (maintien ? `Reviens à ta charge habituelle : elle suffit à maintenir tes acquis.` : (prise ? `Remonte progressivement le volume par muscle vers ta cible pour relancer la prise de masse.` : `Remonte progressivement ton volume vers ta cible.`)), priorite: 'moyenne' }
  else if (progOk) reco = { texte: maintien ? `Tu es même au-dessus d'un simple maintien : garde cette charge, inutile de forcer la surcharge.` : `Conserve la structure actuelle et poursuis la surcharge progressive (petites hausses de charge ou de reps).`, priorite: 'info' }
  else reco = { texte: `Continue et enregistre régulièrement tes séances : les analyses s'affinent avec les données.`, priorite: 'info' }

  // ── Pool de recommandations : plusieurs LEVIERS applicables, pas un message figé.
  // Le front en affiche un par jour (rotation) → « le mot de Novalyz » tourne.
  // Chaque entrée reste une règle TRACÉE sur l'état mesuré, jamais un chiffre inventé ;
  // on n'ajoute un levier que si sa condition est vraie. (CLAUDE.md §5/§6bis)
  const reco_pool: any[] = []
  const pushReco = (t: string, p: string) => { if (t && !reco_pool.some(x => x.texte === t)) reco_pool.push({ texte: t, priorite: p }) }
  // 1) Le levier prioritaire du jour (reco principale déjà calculée).
  pushReco(reco.texte, reco.priorite)
  // 1bis) Leviers de RÉCUPÉRATION ciblés (readiness Hooper) — poussés UNIQUEMENT si le
  //   signal est RÉELLEMENT sous-optimal sur la moyenne/le max récent (moteur.signaux),
  //   jamais un conseil de récup générique. Tracé sur la donnée mesurée. (CLAUDE.md §5/§6bis)
  const sig = (moteur && moteur.signaux) || {}
  const somMoy = sig.sommeil, strMoy = sig.stress, courbMx = sig.courbatures
  const sommeilFaible = somMoy != null && somMoy < 3              // moyenne récente < « Moyen » (3/5)
  const stressEleve = strMoy != null && strMoy >= 3.5            // moyenne récente ≥ « Modéré/Élevé »
  const courbHautes = courbMx != null && courbMx >= 4  // DOMS marqués (= CORE_SEUILS.courbatures.haut)
  if (sommeilFaible && stressEleve) {
    pushReco(`Sommeil et stress pèsent sur ta récupération en ce moment : vise 7-9 h de sommeil régulier et un temps calme avant de dormir — c'est là que ton corps encaisse la charge d'entraînement.`, 'moyenne')
  } else if (sommeilFaible) {
    pushReco(`Ton sommeil est en dessous ces jours-ci : vise 7-9 h et des horaires réguliers — c'est le 1er facteur de récupération et de progression.`, 'moyenne')
  } else if (stressEleve) {
    pushReco(`Ton stress est élevé ces jours-ci : il freine la récupération. Garde l'entraînement (il aide à décompresser), mais baisse l'intensité si besoin et ménage-toi des temps de pause.`, 'moyenne')
  }
  if (courbHautes) {
    pushReco(`Courbatures marquées : échauffe-toi bien, garde une amplitude contrôlée, et laisse ~48 h à un muscle très courbaturé avant de le recharger fort.`, 'moyenne')
  }
  // 2) Leviers de PROGRESSION selon l'état mesuré (uniquement si pas de contrainte/vigilance).
  if (!contrainte && !etatVigilance) {
    // 2a) FEU VERT fraîcheur — signal de charge PRIMAIRE (fitness-fatigue / TSB %). Quand
    //     la fraîcheur est nettement positive (peu de fatigue résiduelle vs fond de forme)
    //     ET fiable, c'est le moment d'oser pousser. Tracé sur moteur.charge_fatigue.
    const cf = (moteur && moteur.charge_fatigue) || {}
    if (cf.fiable === true && cf.tsbPct != null && cf.tsbPct >= 5) {
      pushReco(`Tu es bien récupéré : ta fraîcheur est au vert (peu de fatigue résiduelle). C'est le bon moment pour une séance un peu plus intense ou pour tenter une charge au-dessus de ton habituel sur un exercice clé.`, 'moyenne')
    }
    // 2b) TEMPS DE REPOS entre séries — fait factuel mesuré (moyenne des repos loggés).
    //     Un repos court bride la force sur les exercices lourds (force/hypertrophie) ;
    //     on n'en parle PAS en sèche (repos court souvent voulu pour la densité). N min
    //     pour éviter le bruit. Le chiffre affiché est vérifié ; le conseil est conditionnel.
    const reposMoy = extras && extras.reposMoy != null ? extras.reposMoy : null
    const reposN = (extras && extras.reposN) || 0
    if (reposN >= 6 && reposMoy != null && reposMoy < 90 && !seche) {
      pushReco(`Tes temps de repos sont courts en moyenne (~${reposMoy}s entre séries). Pour la force et la masse, vise plutôt 2-3 min sur tes exercices lourds — tu pousseras plus fort sur les séries suivantes.`, 'moyenne')
    }
    if (progOk) pushReco(`Tu progresses : pour continuer, ajoute une petite surcharge (+1 rep, ou +2,5 kg) sur un exercice clé dès que ta dernière série passe bien.`, 'moyenne')
    if (tonEvol != null && !aBaisse && !progOk) pushReco(`Ton volume est stable : relance la progression en visant +1 rep sur tes exos principaux, puis +2,5 kg une fois le haut de ta fourchette atteint.`, 'moyenne')
    if (tonEvol != null && !aBaisse) pushReco(`Cible un muscle en retard : ajoute 1 à 2 séries par semaine là où ton volume est sous ta cible, pour équilibrer ton développement.`, 'moyenne')
    // 3) Leviers d'AIDE transverses (toujours utiles, non chiffrés → priorité info).
    //    Philosophie : on ne change PAS d'exercice — on progresse par l'intensité, la
    //    surcharge progressive, la récupération et la nutrition (demande porteur).
    // Audit 06/11 : seulement si les séries sont loin de l'échec (RPE moyen 28 j < 8) — sinon la reco contredit
    // l'écran (« chaque série va près de l'échec ») pour quelqu'un qui pousse déjà à RPE 8,6.
    const rpeMoy28 = cmp.rpe && cmp.rpe.j28 != null ? Number(cmp.rpe.j28) : null
    if (rpeMoy28 != null && rpeMoy28 > 0 && rpeMoy28 < 8) pushReco(`Mets de l'intensité : tes séries finissent en moyenne à RPE ${String(Math.round(rpeMoy28 * 10) / 10).replace('.', ',')}. Les dernières doivent finir proches de l'échec (1-2 reps en réserve) — c'est le signal qui déclenche la progression.`, 'info')
    pushReco(`Progresse une variable à la fois et garde les mêmes exercices : d'abord les reps jusqu'au haut de ta fourchette, puis la charge — c'est comme ça qu'on mesure vraiment les progrès.`, 'info')
    pushReco(`Soigne ta récupération : vise 7-9 h de sommeil et un repos suffisant entre séries (2-3 min sur les gros exercices) pour pousser fort la séance d'après.`, 'info')
    pushReco(`Assure l'apport : assez de protéines (~1,6 à 2 g/kg/jour) et évite un déficit calorique prolongé si ton objectif est de gagner force et muscle.`, 'info')
    pushReco(`Soigne l'exécution avant la charge : tempo contrôlé et amplitude complète rendent chaque série plus efficace.`, 'info')
    pushReco(`Enregistre ton RPE à chaque série : plus tes données sont complètes, plus les analyses et les cibles de charge sont justes.`, 'info')
  }
  // Confiance = profondeur réelle des données (nb de séances) + présence d'une base
  // de comparaison fiable — plus honnête que « un % existe donc c'est bon ».
  let confiance: string
  if (nCur == null || nCur < 2) confiance = 'faible'
  else if (!baseFiable) confiance = 'moyenne'
  else confiance = (nCur >= 6) ? 'bonne' : 'moyenne'
  // volume_fiable : la comparaison de tonnage 28 j vs 28 j est-elle représentative ? (l'onglet
  // Tendances l'affiche aussi — il doit porter la même réserve que la lecture, audit 30/10).
  const volume_fiable = tonEvol != null
  const volume_raison = (!volume_fiable && tonEvolRaw != null) ? (pausePrev >= 10 ? `pause de ${pausePrev} jours dans la période précédente` : 'période précédente trop courte') : null
  return { objectif: objectif || null, constats: constats.slice(0, 3), reco, reco_pool, confiance, volume_fiable, volume_raison }
}

// « Lecture Novalyz » (cardio) : régularité + charge cardio (RPE×durée) 28j vs 28j
// précédents + efficience (FC à effort constant). Déterministe, ne recalcule que
// Charge interne d'une sortie cardio (session-RPE de Foster = RPE × durée, en UA).
// Si le RPE manque — cas des IMPORTS MONTRE (durée + FC mais pas de RPE ressenti) —
// on l'ESTIME à partir de la FC moyenne (repères larges, sans FCmax individuelle →
// prudent) ; sinon RPE modéré (5). => une activité importée pèse dans la charge au
// lieu de compter 0 (correctif #5 : elle entre bien dans le croisé muscu/cardio).
function chargeInterneCardio(s: any): number {
  // La MARCHE (quotidienne, importée de la montre) est une activité, pas un entraînement :
  // hors charge (décision 30/10 ; elle faisait 82 % de la charge cardio annuelle). Même règle que le front.
  if (/^marche/i.test(String((s && s.type_cardio) || ''))) return 0
  const duree = Number(s && s.duree) || 0
  if (duree <= 0) return 0
  let rpe = Number(s && s.rpe) || 0
  if (rpe <= 0) {
    const fc = Number(s && (s.fc_moy != null ? s.fc_moy : s.fc)) || 0
    rpe = fc >= 165 ? 9 : fc >= 150 ? 8 : fc >= 138 ? 7 : fc >= 125 ? 6 : fc >= 110 ? 5 : fc > 0 ? 4 : 5
  }
  return rpe * duree
}

// des agrégats simples sur cardio.history. S'aligne sur l'état du jour (récup/dispo).
function buildSyntheseCardio(cardio: any, moteur: any, now: Date): any {
  const hist = (cardio && cardio.history) || []
  if (!hist.length) {
    return { constats: [{ ton: 'neutre', texte: `Pas encore de cardio enregistré.` }], reco: { texte: `Ajoute une sortie cardio pour suivre ton endurance.`, priorite: 'info' }, confiance: 'faible' }
  }
  const c28 = fmtYMD(minus(now, 27)), c56 = fmtYMD(minus(now, 55))
  let n28 = 0, n56 = 0, ch28 = 0, ch56 = 0, dist28 = 0, mn28 = 0, mn56 = 0
  const fcPts: any[] = []
  for (const s of hist) {
    const d = String(s.date || '')
    // Audit #9 : une « sortie » < 5 min ET < 0,3 km (tests, imports parasites) ne compte pas.
    if ((Number(s.duree) || 0) < 5 && (Number(s.distance) || 0) < 0.3) continue
    const ua = chargeInterneCardio(s)
    if (d >= c28) { n28++; ch28 += ua; mn28 += Number(s.duree) || 0; dist28 += Number(s.distance) || 0; if (Number(s.fc_moy)) fcPts.push({ d: d, fc: Number(s.fc_moy), rpe: Number(s.rpe) || 0 }) }
    else if (d >= c56) { n56++; ch56 += ua; mn56 += Number(s.duree) || 0 }
  }
  // FIABILITÉ : n'évaluer l'évolution de charge que si la période précédente a une
  // vraie base (≥ 2 sorties) — sinon 1 sortie isolée produit un % aberrant.
  const chEvol = (ch56 > 0 && n56 >= 2) ? Math.round((ch28 - ch56) / ch56 * 100) : null
  // Baisse d'ACTIVITÉ = minutes de sorties, marche comprise (la marche est hors CHARGE
  // depuis le 30/10 mais reste de l'activité : sa baisse doit toujours se voir).
  const actEvol = (mn56 > 0 && n56 >= 2) ? Math.round((mn28 - mn56) / mn56 * 100) : null
  const recup = (moteur && moteur.recup) || null
  const dispo = (moteur && moteur.disponibilite && moteur.disponibilite.niveau) || null
  const etatVigilance = recup === 'Faible' || dispo === 'À surveiller' || dispo === 'Vigilance'

  const constats: any[] = []
  if (n28 === 0) {
    constats.push({ ton: 'neutre', texte: `Aucune sortie cardio ces 4 dernières semaines.` })
  } else {
    constats.push({ ton: n28 >= 4 ? 'positif' : 'neutre', texte: `${n28} sortie${n28 > 1 ? 's' : ''} cardio ces 4 semaines${dist28 ? ` (${Math.round(dist28 * 10) / 10} km au total)` : ''}.` })
    if (chEvol != null && chEvol >= 50) constats.push({ ton: 'attention', texte: `Ta charge cardio a fortement augmenté (+${chEvol}% sur 4 semaines) — hausse rapide.` })
    else if (actEvol != null && actEvol <= -50) constats.push({ ton: 'attention', texte: `Forte baisse de ton activité cardio (${actEvol}% de temps sur 4 semaines) — si l'endurance est un objectif, reprends progressivement.` })
    else if (actEvol != null && actEvol <= -40) constats.push({ ton: 'neutre', texte: `Ton activité cardio a baissé (${actEvol}% de temps sur 4 semaines).` })
    // Efficience : FC moyenne 1re vs 2de moitié — MAIS seulement « à effort comparable »,
    // càd si le RPE moyen des deux moitiés est proche (sinon une FC plus basse peut venir
    // de sorties plus faciles, pas d'un gain d'endurance). On ne l'affirme donc que si
    // l'effort est vérifié comparable.
    if (fcPts.length >= 4) {
      const srt = fcPts.slice().sort((a, b) => a.d.localeCompare(b.d))
      const half = Math.floor(srt.length / 2)
      const avgFc = (arr: any[]) => arr.reduce((s, x) => s + x.fc, 0) / arr.length
      const oldH = srt.slice(0, half), newH = srt.slice(half)
      const fcOld = avgFc(oldH), fcNew = avgFc(newH)
      const rpeOldArr = oldH.map((x: any) => x.rpe).filter((v: number) => v > 0)
      const rpeNewArr = newH.map((x: any) => x.rpe).filter((v: number) => v > 0)
      const effortComparable = rpeOldArr.length && rpeNewArr.length &&
        Math.abs(rpeOldArr.reduce((a: number, b: number) => a + b, 0) / rpeOldArr.length - rpeNewArr.reduce((a: number, b: number) => a + b, 0) / rpeNewArr.length) <= 1
      if (fcNew <= fcOld - 4 && effortComparable) constats.push({ ton: 'positif', texte: `À effort comparable, ta FC moyenne baisse (${Math.round(fcOld)}→${Math.round(fcNew)} bpm) — bon signe pour ton endurance.` })
    }
  }

  const chargeJump = chEvol != null && chEvol >= 50
  let reco: any
  if (etatVigilance && (chargeJump || n28 > 0)) reco = { texte: `Ton état du jour appelle à la vigilance : garde un cardio facile aujourd'hui et priorise la récupération.`, priorite: 'moyenne' }
  else if (chargeJump) reco = { texte: `Fais monter ta charge cardio plus graduellement (≈ +10 % par semaine max) pour limiter le risque de surmenage.`, priorite: 'moyenne' }
  else if (n28 === 0) reco = { texte: `Reprends 1 à 2 sorties cardio par semaine pour bâtir ta base d'endurance.`, priorite: 'info' }
  // Audit 28/10 #3 : après une forte baisse, pas de « continue sur ce rythme ».
  else if (actEvol != null && actEvol <= -40) reco = { texte: `Reprends progressivement : 1 à 2 sorties faciles par semaine pour reconstruire ta base d'endurance.`, priorite: 'info' }
  else reco = { texte: `Continue sur ce rythme et varie les intensités (facile / modéré) pour progresser sans t'épuiser.`, priorite: 'info' }

  const confiance = (n28 + n56 >= 4) ? 'bonne' : (n28 > 0 ? 'moyenne' : 'faible')
  return { objectif: null, constats: constats.slice(0, 3), reco, confiance }
}

// NB (audit 28/10 #9) : synthèse sur 4 SEMAINES fixes. L'écran athlète Croisé ne
// l'affiche PAS (il recalcule sur la période choisie, front `_maCroise…`) ; elle reste
// disponible pour d'autres usages (IA, coach) — ne pas la présenter comme « cette semaine ».
// « Lecture Novalyz » (croisé) : équilibre muscu/cardio (28j) + récupération vs
// charge globale. Déterministe ; s'aligne sur l'état du jour.
function buildSyntheseCroise(comparison: any, cardio: any, moteur: any, now: Date): any {
  const c28 = fmtYMD(minus(now, 27))
  let cardioUA = 0
  const hist = (cardio && cardio.history) || []
  for (const s of hist) { if (String(s.date || '') >= c28) cardioUA += chargeInterneCardio(s) }
  const muscuT = (comparison && comparison.j28_vs_j28prec && comparison.j28_vs_j28prec.tonnage && comparison.j28_vs_j28prec.tonnage.j28) || 0
  const muscuUA = Math.round(muscuT / 50)   // proxy pour rendre muscu et cardio comparables
  const tot = muscuUA + cardioUA
  const recup = (moteur && moteur.recup) || null
  const dispo = (moteur && moteur.disponibilite && moteur.disponibilite.niveau) || null
  const etatVigilance = recup === 'Faible' || dispo === 'À surveiller' || dispo === 'Vigilance'
  if (tot === 0) {
    return { objectif: null, constats: [{ ton: 'neutre', texte: `Pas encore assez de séances muscu + cardio pour croiser tes données.` }], reco: { texte: `Enregistre tes séances des deux côtés : Novalyz croisera charge et récupération.`, priorite: 'info' }, confiance: 'faible' }
  }
  const mPct = Math.round(muscuUA / tot * 100)
  const constats: any[] = []
  if (mPct >= 85) constats.push({ ton: 'neutre', texte: `Ta charge est quasi 100 % musculation (${mPct} %). Un peu de cardio renforcerait ta base d'endurance.` })
  else if (mPct <= 15) constats.push({ ton: 'neutre', texte: `Ta charge est quasi 100 % cardio (${100 - mPct} %). La musculation entretient force et masse.` })
  else constats.push({ ton: 'positif', texte: `Bon équilibre muscu / cardio (${mPct} % / ${100 - mPct} %).` })
  if (recup === 'Excellent' || recup === 'Bon') constats.push({ ton: 'positif', texte: `Ta récupération est ${recup === 'Excellent' ? 'excellente' : 'bonne'} — tu encaisses bien ta charge actuelle.` })
  else if (recup === 'Faible') constats.push({ ton: 'attention', texte: `Ta récupération est basse — allège ta charge globale (muscu + cardio) le temps qu'elle remonte.` })

  let reco: any
  if (etatVigilance) reco = { texte: `Ta charge globale pèse sur ta récupération : prévois une semaine un peu plus légère ou une journée de repos.`, priorite: 'moyenne' }
  else if (mPct >= 85) reco = { texte: `Ajoute 1 séance de cardio facile par semaine pour équilibrer et soutenir ta récupération.`, priorite: 'info' }
  else if (mPct <= 15) reco = { texte: `Ajoute 1 à 2 séances de musculation par semaine pour préserver force et masse.`, priorite: 'info' }
  else reco = { texte: `Bon équilibre : conserve ce ratio muscu / cardio et veille à ce que la récupération suive la charge.`, priorite: 'info' }
  const confiance = (muscuUA > 0 && cardioUA > 0) ? 'bonne' : 'moyenne'
  return { objectif: null, constats: constats.slice(0, 3), reco, confiance }
}

// P0 #6 — Centre d'alertes (athlète) : UNE liste typée au schéma unifié, à partir
// des alertes DÉJÀ produites par le moteur (pas de 2e moteur) + stagnation depuis
// comparison. Classée par sévérité. L'état « lu » est appliqué ensuite (getAppData).
function buildAlertesCentre(moteur: any, comparison: any): any[] {
  const SEV: Record<string, number> = { haute: 3, moyenne: 2, basse: 1 }
  const TITRES: Record<string, string> = {
    absence: 'Absence prolongée', charge: 'Charge en hausse', surcharge: 'Charge récente élevée',
    sous_charge: 'Sous-charge', douleur: 'Douleur signalée', fatigue: 'Fatigue élevée',
    sommeil: 'Sommeil dégradé', stagnation: 'Stagnation',
  }
  const ACTIONS: Record<string, string> = {
    absence: 'Reprends une séance cette semaine pour relancer la régularité.',
    charge: "Surveille tes sensations, évite d'augmenter la charge cette semaine.",
    surcharge: 'Allège la charge 1 à 2 séances pour récupérer.',
    sous_charge: 'Tu peux augmenter progressivement ton volume.',
    douleur: "Adapte la charge sur la zone et surveille ; avis kiné si ça persiste.",
    fatigue: "Priorise le sommeil et la récupération ; évite d'intensifier.",
    sommeil: "Améliore ton sommeil ; séance normale mais pas d'intensification.",
    stagnation: "Mets plus d'intensité (séries proches de l'échec) et progresse en charge/reps. Pense aussi au temps de repos : trop court entre séries, tu ne peux pas pousser — vise 2-3 min sur les gros exercices. Si tu es déjà à ton max, persévère et soigne ta récupération (sommeil).",
  }
  const reliability = (moteur && moteur.confiance) || 'moyenne'
  const context = (moteur && moteur.contexte_tag) || null
  const out: any[] = []
  const push = (type: string, severity: string, evidence: string, source: string) =>
    out.push({ type, severity: severity || 'moyenne', source: source || 'moteur', title: TITRES[type] || type, evidence: evidence || '', context, reliability, action: ACTIONS[type] || '' })
  ;((moteur && moteur.alertes) || []).forEach((a: any) => push(a.type, a.severite, a.message, 'moteur'))
  // Douleur : titre = message précis du moteur (intensité + zone) et conseil proportionné
  // (une gêne légère n'appelle pas « avis kiné » — validé porteur oct. 2026).
  out.forEach((x: any) => {
    if (x.type !== 'douleur' || x.source !== 'moteur') return
    if (x.evidence) x.title = x.evidence
    if (x.severity === 'basse') x.action = 'Rien d\'alarmant : surveille-la, et note-la si elle revient ou augmente.'
    else if (x.severity === 'haute') x.action = 'Évite de charger la zone et fais-la évaluer (médecin / kiné) avant de reprendre fort.'
  })
  // Stagnation : ≥3 exercices en baisse cette semaine (depuis comparison), si non couvert.
  // FIABILITÉ (anti-fausse-alerte) : on NE crie PAS « stagnation » quand le contexte
  // EXPLIQUE la baisse (deload / retour de vacances / retour de blessure — la baisse
  // est voulue ou attendue), ni quand les données sont trop maigres pour l'affirmer
  // (confiance faible ou non interprétable). Sinon on accuse à tort une régression.
  const ctxAmnistieStag = context === 'deload' || context === 'retour_vacances' || context === 'retour_blessure'
  const fiabInsuffisanteStag = reliability === 'faible' || reliability === 'non_interpretable'
  const det = (comparison && comparison.j7_vs_j7prec && comparison.j7_vs_j7prec.charge_details) || []
  const baisseAll = det.filter((d: any) => d && d.down)
  const baisseExos = baisseAll.map((d: any) => d.exercice).filter(Boolean)
  if (baisseAll.length >= 3 && !out.some(a => a.type === 'stagnation') && !ctxAmnistieStag && !fiabInsuffisanteStag) {
    // On NOMME les exercices concernés (sinon « 3 exercices en baisse » sans détail).
    const liste = baisseExos.slice(0, 6).join(', ')
    const ev = baisseExos.length ? `${baisseAll.length} exercices en baisse cette semaine : ${liste}.` : `${baisseAll.length} exercices en baisse cette semaine.`
    push('stagnation', 'moyenne', ev, 'progression')
  }
  out.sort((a, b) => (SEV[b.severity] || 0) - (SEV[a.severity] || 0))
  return out
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
    { data: _volObtiDb },   // plus utilisée (03/11) : cibles = VOLUME_CIBLES_NIVEAU
    { data: contexteRows },
    { data: pauseRows },
    { data: cardioRows },
    { data: objectifRows },
    { data: pasJourRows },
    { data: blessuresRows },
    { data: alerteLueRows },
    { data: prefRows },
    { data: santeRows },
    { data: nutriRows },
    { data: recompRows },
    { data: mensuRows },
    { data: suiviPhotoRows },
    { data: exoCatRows },
  ] = await Promise.all([
    _toutLire(() => sb().from('performances').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).order('id')),
    sb().from('athletes').select('*').eq('id', athleteId).single(),
    sb().from('programme').select('*').eq('athlete_id', athleteId).order('groupe_id').order('id'),
    sb().from('poids_historique').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(30),
    // 400 (et non 30) : Croisé / Forme lisent l'historique sur Mois / Année ; à 30, l'année ne
    // voyait qu'août-octobre et comptait « 30 relevés » au lieu de 34 (audit 29/10).
    sb().from('bien_etre').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(400),
    sb().from('volume_obti').select('*'),
    sb().from('contexte_athlete').select('*').eq('athlete_id', athleteId).order('date_debut', { ascending: false }),
    // 13/11 : à date égale, la DERNIÈRE saisie gagne (avant : activer puis annuler le même jour → résultat au hasard).
    sb().from('indicateurs').select('*').eq('athlete_id', athleteId).eq('cle', 'pause').order('date', { ascending: false }).order('id', { ascending: false }).limit(1),
    _toutLire(() => sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'cardio_%').order('date', { ascending: false }).order('id')),
    sb().from('objectif').select('*').eq('athlete_id', athleteId).limit(1),
    _toutLire(() => sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'pasjour_%').order('date', { ascending: false }).order('id')),
    sb().from('blessures').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
    sb().from('indicateurs').select('cle').eq('athlete_id', athleteId).eq('seance_id', 'alerte_lue'),
    sb().from('indicateurs').select('cle,valeur').eq('athlete_id', athleteId).eq('seance_id', 'pref').order('date', { ascending: false }),
    _toutLire(() => sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'sante_%').order('date', { ascending: false }).order('id')),
    _toutLire(() => sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'nutri_%').order('date', { ascending: false }).order('id')),
    sb().from('indicateurs').select('cle,valeur,date').eq('athlete_id', athleteId).eq('seance_id', 'recompense'),
    sb().from('indicateurs').select('date,cle,valeur,unite').eq('athlete_id', athleteId).eq('seance_id', 'mensuration').order('date', { ascending: false }),
    sb().from('indicateurs').select('date,cle,valeur').eq('athlete_id', athleteId).eq('seance_id', 'suivi_photo').order('date', { ascending: false }),
    sb().from('exercices').select('exercice,muscle_secondaire'),
  ])

  // Agenda daté : fenêtre courte pour l'athlète (aujourd'hui → +14 j) → séances
  // prévues, « séance du jour », rappels. Le coach navigue librement via getPlanning.
  // 04/11 : depuis le LUNDI de la semaine (séance du jour, séances pas faites, « Ma semaine »).
  const _planFrom = (() => { const d = new Date(now); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return fmtYMD(d) })()
  const _planTo = fmtYMD(new Date(now.getTime() + 14 * 86400000))
  const { data: planRows } = await sb().from('planning')
    .select('id,date,seance_id,statut,source')
    .eq('athlete_id', athleteId).gte('date', _planFrom).lte('date', _planTo)
    .order('date', { ascending: true })

  // Audit #2 : muscle canonique (sinon « Moletts » ≠ « Mollets » → séries jamais comptées).
  const perfs = (perfsAll || []).map((r: any) => ({ ...r, muscle: normMuscle(r.muscle) }))
  // Cibles de volume du NIVEAU de l'athlète (ancienneté effective) — source unique (03/11).
  const niveauAth = getNiveauExperience(anneesEffectives(athData?.annees, athData?.created_at, now))
  // Préférences : athletes.prefs d'abord, ancienne ligne indicateurs en secours (10/11, voir _prefsAthleteLues).
  const prefsA = _prefsAthleteLues((athData as any)?.prefs, prefRows)
  const zonesPrio: string[] = Array.isArray(prefsA.zones_prio) ? (prefsA.zones_prio as unknown[]).filter((z: any) => ZONES_PRIO[String(z)]).map(String).slice(0, 2) : []
  const musclesExclus = musclesExclusValides(prefsA.muscles_exclus, zonesPrio)   // 09/11
  const volObtiRows = volumeCiblesRows(niveauAth, zonesPrio, musclesExclus)
  void _volObtiDb
  const sport = athData?.sport || 'muscu'
  // pause active = aujourd'hui dans [debut, fin] (comme Code.gs athleteEnPause)
  const pauseRow = pauseRows?.[0]
  const pauseObj: any = pauseActive(pauseRow, now)
  const enPause = !!pauseObj

  const globalData = computeGlobal(perfs)
  const recentData = computeRecent(perfs, now)
  const comparisonData = computeComparison(perfs, now)

  const dates = [...new Set(perfs.map(r => normDate(r.date)))].sort()
  const dernierDate = dates[dates.length - 1]
  // ACWR — chaîne CENTRALE multisport (source unique).
  const chSportA = sport === 'muscu' ? normaliserCharge(calculerChargeSport('muscu', perfs)) : { chargeParJour: {}, premiere: null }
  const acwrCalcA = calculerACWR(chSportA.chargeParJour, now)
  const acwr = sport === 'muscu' ? acwrCalcA.ratio : null

  const c7 = fmtYMD(minus(now, 6))
  // (tonnage 7 j : plus de recalcul local — SOURCE UNIQUE = computeRecent.j7, voir tonnageObj)

  const lundiStr = fmtYMD(lundi)
  const perfsWeek = perfs.filter(r => normDate(r.date) >= lundiStr)
  const _secAll = _secMap(exoCatRows || [])
  const seriesParMuscle: Record<string, number> = {}
  for (const r of perfsWeek) _addSeriesMuscle(seriesParMuscle, r, _secAll)

  // prochaine séance = prochaine séance non faite du programme cette semaine (comme Code.gs getProchaineSeance)
  const prochaineSeance = (() => {
    const faitesSemaine = new Set<string>()
    let derniereFaite = '', derniereDate = ''   // séance la plus RÉCENTE de la semaine (pas la plus loin dans l'ordre)
    for (const r of perfs) { const d = normDate(r.date); if (d >= lundiStr) { const sid = String(r.seance_id).toLowerCase(); faitesSemaine.add(sid); if (d >= derniereDate) { derniereDate = d; derniereFaite = sid } } }
    const ordre: string[] = []
    const vues = new Set<string>()
    for (const r of (progRows || [])) { const sid = String(r.seance_id); if (!vues.has(sid)) { ordre.push(sid); vues.add(sid) } }
    if (ordre.length === 0) return null
    let lastDone = -1
    lastDone = ordre.findIndex(o => o.toLowerCase() === derniereFaite)
    if (lastDone === -1) for (let k = ordre.length - 1; k >= 0; k--) { if (faitesSemaine.has(ordre[k].toLowerCase())) { lastDone = k; break } }
    if (lastDone === -1) return ordre[0]
    for (let k = 1; k <= ordre.length; k++) { const idx = (lastDone + k) % ordre.length; if (!faitesSemaine.has(ordre[idx].toLowerCase())) return ordre[idx] }
    return null
  })()

  // muscle en retard = sur 4 SEMAINES, plus grand retard, faites < min×4 (comme Code.gs computeMuscleRetard)
  const c28mr = fmtYMD(minus(now, 27))
  const seriesParMuscle4: Record<string, number> = {}
  // Audit #5 : le muscle SECONDAIRE de l'exercice compte 0,5 série (squat → fessiers…),
  // comme l'onglet Analyses — sinon « Fessier 0 série » alors qu'il est travaillé.
  const _secByExo: Record<string, string> = {}
  for (const e of (exoCatRows || [])) { const k = String((e as any).exercice || '').trim().toLowerCase(); const ms = normMuscle((e as any).muscle_secondaire); if (k && ms) _secByExo[k] = ms }
  for (const r of perfs) {
    if (normDate(r.date) < c28mr) continue
    if (r.muscle) seriesParMuscle4[r.muscle] = (seriesParMuscle4[r.muscle] || 0) + 1
    const sec = _secByExo[String(r.exercice || '').trim().toLowerCase()]
    if (sec && sec !== r.muscle) seriesParMuscle4[sec] = (seriesParMuscle4[sec] || 0) + 0.5
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

  const alertes = calculerAlertes(perfs, athleteId, anneesEffectives(athData?.annees, athData?.created_at, now), enPause)   // N2 : ancienneté effective

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
  // séances prévues/semaine : valeur explicite (table objectif) sinon DÉRIVÉE du
  // programme = nombre de séances distinctes (chaque séance ≈ 1×/semaine). Ainsi
  // l'adhérence « X/N » reflète le vrai programme (issu de l'onboarding ou du builder).
  const seancesPrevuesExplicite = Number(objectifRows?.[0]?.seances_semaine) || 0
  const seancesProgramme = new Set((progRows || []).map((r: any) => String(r.seance_id ?? '')).filter(Boolean)).size
  const seancesPrevues = seancesPrevuesExplicite || seancesProgramme
  const streakSemaines = computeStreak(dates, now)
  const regulariteObj = {
    seances_j7: seancesJ7,
    seances_semaine: seancesCetteSemaine,
    seances_prevues: seancesPrevues,
    streak: streakSemaines,
  }

  // tonnage as object with j7 + evol_pct from comparison (in tonnes, matching Code.gs finalizeWindow)
  // j7 : SOURCE UNIQUE = computeRecent.j7.tonnage (même fenêtre now-7, même formule) —
  // plus de recalcul local (dédup anomalie #3, valeur identique).
  const tonnageEvol = comparisonData.j7_vs_j7prec?.tonnage?.evol_pct ?? null
  const j7PrecKg = comparisonData.j7_vs_j7prec?.tonnage?.j7_prec ?? null
  const tonnageObj = {
    j7: recentData.j7.tonnage,
    evol_pct: tonnageEvol,
    j7_prec: j7PrecKg != null ? Math.round(j7PrecKg / 100) / 10 : null,
  }

  // records_30j: count exercises that have their best record set within 30 days
  const c30 = fmtYMD(minus(now, 30))
  const records30j = Object.values(globalData.records || {}).filter((rec: any) => {
    const d = parseFR(rec.date)
    return d ? fmtYMD(d) >= c30 : false
  }).length
  // records_total : nombre d'exos où l'athlète détient un record (= exos pratiqués
  // avec charge). PERMANENT (ne décroît jamais) → base des points « records » de la
  // boutique, pour que les points ne s'évaporent plus (fenêtre 30 j = affichage seul).
  const recordsTotal = Object.keys(globalData.records || {}).length

  // Enrich globalData
  const enrichedGlobal = { ...globalData, muscle_retard: muscleRetardObj, records_30j: records30j, records_total: recordsTotal, records_evenements: _recordsEvenements(perfs) }

  const poids = (poidsRows || []).map(r => ({ date: fmtFR(r.date), poids: Number(r.poids) }))

  const programme = (progRows || []).map(r => ({
    id: r.id, row_index: r.id, athlete_id: r.athlete_id, seance_id: r.seance_id,
    exercice: r.exercice, series_prevues: r.series_prevues, reps_mini: r.reps_mini,
    reps_max: r.reps_max, repos_sec: r.repos_sec, groupe_id: r.groupe_id,
    jour: r.jour != null ? Number(r.jour) : null,   // jour conseillé (1=lun … 7=dim), null = non planifié
    charge_pct_1rm: r.charge_pct_1rm != null ? Number(r.charge_pct_1rm) : null,   // cible : % du 1RM
    rpe_cible: r.rpe_cible != null ? Number(r.rpe_cible) : null,                  // cible : RPE
    type: r.type || null,                                                         // 'cardio' = item cardio (hybride), sinon muscu
    cardio_cible: r.cardio_cible != null ? Number(r.cardio_cible) : null,         // valeur de la cible cardio
    cardio_unite: r.cardio_unite || null,                                         // 'min' | 'km' | 'libre'
    // Schéma de séries (#4) : 'fixe'(défaut) | 'double' | 'topbackoff' | 'pyramidal'.
    schema: r.schema || null, backoff_pct: r.backoff_pct != null ? Number(r.backoff_pct) : null,
    series_json: r.series_json != null ? r.series_json : null,   // pyramidal : [{pct,reps,rpe}]
  }))

  const bien_etre = (beRows || []).map(r => ({
    date: fmtFR(r.date), sommeil: r.sommeil, energie: r.energie,
    fatigue: r.fatigue_musculaire, motivation: r.motivation, douleur: r.douleur,
    stress: r.stress, courbatures: r.courbatures,
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
  // Bilans de séance (ressenti perçu + douleurs), muscu vs cardio SÉPARÉS → onglet
  // Analyses. Lignes indicateurs `ressenti_<type>` / `douleur_<type>` (valeur 1..4 ;
  // pour la douleur, unite = zone). Triés récent → ancien.
  // rpe_muscu/rpe_cardio = RPE de séance CR-10 (0..10, nouveau). ressenti_* = legacy
  // (difficulté 1..4) conservé pour l'historique. Le front préfère rpe_* si présent.
  let analyses: any = { ressenti_muscu: [], ressenti_cardio: [], rpe_muscu: [], rpe_cardio: [], duree_muscu: [], duree_cardio: [], douleurs_muscu: [], douleurs_cardio: [], notes_muscu: [], notes_cardio: [] }
  {
    // Lecture complète (avant : 400 lignes max, tous types confondus).
    const { data: bilanRows } = await _toutLire(() => sb().from('indicateurs').select('*')
      .eq('athlete_id', athleteId)
      .in('cle', ['ressenti_muscu', 'ressenti_cardio', 'rpe_muscu', 'rpe_cardio', 'duree_muscu', 'duree_cardio', 'douleur_muscu', 'douleur_cardio', 'note_muscu', 'note_cardio', 'rpe'])
      .order('date', { ascending: false }).order('id', { ascending: true }))
    const rpeForm: any[] = []
    for (const r of (bilanRows || [])) {
      if (r.cle === 'note_muscu' || r.cle === 'note_cardio') { (r.cle === 'note_muscu' ? analyses.notes_muscu : analyses.notes_cardio).push({ date: normDate(r.date), seance_id: r.seance_id, note: String(r.valeur || '') }); continue }
      // S1 : RPE saisi dans l'ancien formulaire cardio (« rpe » sur une séance cardio_…).
      if (r.cle === 'rpe') { if (/^cardio_/.test(String(r.seance_id || ''))) rpeForm.push({ date: normDate(r.date), seance_id: r.seance_id, valeur: Number(r.valeur) || null }); continue }
      const base = { date: normDate(r.date), seance_id: r.seance_id, valeur: Number(r.valeur) || null }
      if (r.cle === 'ressenti_muscu') analyses.ressenti_muscu.push(base)
      else if (r.cle === 'ressenti_cardio') analyses.ressenti_cardio.push(base)
      else if (r.cle === 'rpe_muscu') analyses.rpe_muscu.push(base)
      else if (r.cle === 'rpe_cardio') analyses.rpe_cardio.push(base)
      else if (r.cle === 'duree_muscu') analyses.duree_muscu.push(base)
      else if (r.cle === 'duree_cardio') analyses.duree_cardio.push(base)
      else if (r.cle === 'douleur_muscu') analyses.douleurs_muscu.push({ ...base, zone: r.unite || '' })
      else if (r.cle === 'douleur_cardio') analyses.douleurs_cardio.push({ ...base, zone: r.unite || '' })
    }
    // S1 : une séance cardio sans bilan garde le RPE de son formulaire → visible dans « Effort ».
    const avecBilan = new Set([...analyses.rpe_cardio, ...analyses.ressenti_cardio].map((x: any) => String(x.seance_id)))
    for (const x of rpeForm) if (x.valeur != null && !avecBilan.has(String(x.seance_id))) analyses.rpe_cardio.push(x)
    analyses.rpe_cardio.sort((a: any, b: any) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }

  // Pas quotidiens ambiants (Fitbit) : [{date, pas}] triés récent → ancien.
  const pas_quotidiens = (pasJourRows || [])
    .filter((r: any) => r.cle === 'pas')
    .map((r: any) => ({ date: normDate(r.date), pas: Number(r.valeur) || 0 }))
    .filter((x: any) => x.pas > 0)

  // Historique santé montre (Health Connect) : 1 objet par jour {date, sommeil_min,
  // fc_repos, pas} agrégé depuis les lignes indicateurs seance_id 'sante_<date>'.
  const santeMap: Record<string, any> = {}
  for (const r of (santeRows || [])) {
    const d = normDate(r.date); if (!d) continue
    if (!santeMap[d]) santeMap[d] = { date: d }
    const v = Number(r.valeur); if (isNaN(v)) continue
    if (r.cle === 'sommeil_min') santeMap[d].sommeil_min = v
    else if (r.cle === 'fc_repos') santeMap[d].fc_repos = v
    else if (r.cle === 'pas') santeMap[d].pas = v
  }
  const sante_historique = Object.values(santeMap).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
  // Montre 06/11 : heure + marque de la dernière synchro réussie (saveSante) → « Synchronisée à 14:32 » athlète et coach.
  let montre_sync: any = null
  try {
    const { data: ms } = await sb().from('indicateurs').select('valeur,unite').eq('athlete_id', athleteId).eq('cle', 'montre_sync').order('id', { ascending: false }).limit(1)
    if (ms && ms[0]) montre_sync = { at: String(ms[0].valeur || ''), marque: String(ms[0].unite || '') }
  } catch (_) {}

  // Historique nutrition (saisie manuelle / Health Connect) : 1 objet par jour
  // {date, kcal, prot} agrégé depuis les lignes indicateurs seance_id 'nutri_<date>'.
  const nutriMap: Record<string, any> = {}
  for (const r of (nutriRows || [])) {
    const d = normDate(r.date); if (!d) continue
    if (!nutriMap[d]) nutriMap[d] = { date: d }
    const v = Number(r.valeur); if (isNaN(v)) continue
    if (r.cle === 'kcal') nutriMap[d].kcal = v
    else if (r.cle === 'prot') nutriMap[d].prot = v
    else if (r.cle === 'gluc') nutriMap[d].gluc = v
    else if (r.cle === 'lip') nutriMap[d].lip = v
  }
  const nutri_historique = Object.values(nutriMap).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))

  // ── Mensurations (N3) : indicateurs seance_id='mensuration', 1 ligne/mesure/date,
  // regroupées par date. Clés : poitrine, taille, hanches, epaules, bras_g/_d,
  // avantbras_g/_d, cuisse_g/_d, mollet, masse_grasse. Valeurs numériques (col texte).
  const mensurations = (() => {
    const byDate: Record<string, any> = {}
    for (const r of (mensuRows || [])) {
      const d = fmtFR(r.date)
      if (!byDate[d]) byDate[d] = { date: d }
      const n = Number(r.valeur)
      byDate[d][String(r.cle)] = (r.valeur === '' || r.valeur == null || isNaN(n)) ? null : n
    }
    return Object.values(byDate).sort((a: any, b: any) => (parseFR(b.date)?.getTime() || 0) - (parseFR(a.date)?.getTime() || 0))
  })()

  // ── Photos de suivi (N3) : indicateurs seance_id='suivi_photo' (cle=angle,
  // valeur=chemin Storage). Bucket PRIVÉ 'suivi-photos' → URLs signées (TTL 2 h).
  const suivi_photos = await (async () => {
    const rows = (suiviPhotoRows || []).filter((r: any) => r.valeur)
    if (!rows.length) return []
    const paths = rows.map((r: any) => String(r.valeur))
    const urls: Record<string, string> = {}
    try {
      const { data: signed } = await sb().storage.from('suivi-photos').createSignedUrls(paths, 7200)
      ;(signed || []).forEach((s: any, i: number) => { if (s && s.signedUrl) urls[paths[i]] = s.signedUrl })
    } catch (_) { /* bucket absent / pas de photo : best-effort */ }
    return rows.map((r: any) => ({ date: fmtFR(r.date), angle: String(r.cle || 'face'), path: String(r.valeur), url: urls[String(r.valeur)] || null }))
      .sort((a: any, b: any) => (parseFR(b.date)?.getTime() || 0) - (parseFR(a.date)?.getTime() || 0))
  })()

  let volume_obti: any[] = []
  if (sport === 'muscu' && volObtiRows?.length) {
    volume_obti = volObtiRows.map(v => ({
      muscle: v.muscle, series_semaine: seriesParMuscle[v.muscle] || 0,
      series_min: v.series_min_semaine, series_opt: v.series_opt_semaine,
      prio: !!(v as any).prio,
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
    // Audit Notifications N4 (01/11) : l'ACTIVITÉ compte la muscu ET le cardio (hors marche) —
    // une semaine de vélo / course / Hyrox n'est plus une « absence prolongée ».
    const _cardioActif: Record<string, string> = {}   // seance_id → date, cardio hors marche
    { const typ: Record<string, string> = {}, dt: Record<string, string> = {}
      for (const r of (cardioRows || [])) { if (r.cle === 'type_cardio') typ[r.seance_id] = String(r.valeur || ''); if (!dt[r.seance_id]) dt[r.seance_id] = normDate(r.date) }
      for (const sid of Object.keys(dt)) if (!/^marche/i.test(typ[sid] || '')) _cardioActif[sid] = dt[sid] }
    const _joursActifs = new Set<string>([...perfs.map(r => normDate(r.date)), ...Object.values(_cardioActif)].filter(Boolean) as string[])
    const seances7M = [..._joursActifs].filter(d => d >= c7).length
    // Retour de vacances : l'absence se compte à partir de la FIN de la pause (R1, 01/11).
    const _pauseFin = (pauseRow && pauseRow.valeur && pauseRow.valeur !== 'fin' && pauseRow.unite) ? normDate(pauseRow.unite) : null
    let derniereActivite = [..._joursActifs].sort().pop() || null
    if (_pauseFin && _pauseFin <= fmtYMD(now) && (!derniereActivite || _pauseFin > derniereActivite)) derniereActivite = _pauseFin
    const histoM = _joursDepuis(premiereP, now)
    // Modèle fitness-fatigue (Banister) sur la charge muscu (tonnage) — calculé AVANT
    // le verdict car il est désormais le SIGNAL DE CHARGE PRIMAIRE (ACWR = secondaire).
    // Forme (CTL) / fatigue (ATL) / fraîcheur (TSB) + ratio ATL/CTL. Fiable si assez
    // d'historique (≥ 28 j et ≥ 8 jours actifs sur 42) — sinon affiché comme indicatif.
    // sRPE (charge interne de Foster) = Σ RPE(CR-10) × durée(min) par jour. On apparie
    // rpe_muscu + duree_muscu par (date|seance_id). Modèle HYBRIDE : on bascule la
    // fraîcheur sur le sRPE dès qu'il y a ≥ 28 j d'historique sRPE et ≥ 8 jours actifs
    // /42 ; sinon on garde le tonnage (continuité avec l'historique existant).
    const _dureeByKey: Record<string, number> = {}
    for (const x of (analyses.duree_muscu || [])) { if (x && x.valeur != null && x.date) _dureeByKey[x.date + '|' + (x.seance_id || '')] = x.valeur }
    const srpeParJour: Record<string, number> = {}
    let srpePremiere: string | null = null
    for (const x of (analyses.rpe_muscu || [])) {
      if (!x || x.valeur == null || !x.date) continue
      const dur = _dureeByKey[x.date + '|' + (x.seance_id || '')]
      if (dur == null || dur <= 0) continue
      srpeParJour[x.date] = (srpeParJour[x.date] || 0) + x.valeur * dur
      if (!srpePremiere || x.date < srpePremiere) srpePremiere = x.date
    }
    const ffSRPE = calculerFitnessFatigue(srpeParJour, now)
    const srpeSpan = srpePremiere ? (_joursDepuis(srpePremiere, now) ?? 0) : 0
    const useSRPE = srpeSpan >= 28 && ffSRPE.joursActifs42 >= 8
    const ffA = useSRPE ? ffSRPE : calculerFitnessFatigue(chSportA.chargeParJour, now)
    const ffFiable = useSRPE ? true : (histoM != null && histoM >= 28 && ffA.joursActifs42 >= 8)
    // Règle « charge + ressenti » : mêmes données de charge que la fraîcheur affichée.
    const chargeSrcM = useSRPE ? srpeParJour : chSportA.chargeParJour
    const joursHautsM = chargeSoutenueJours(chargeSrcM, now)
    const ressM = ressentiConcordant(beRows || [], perfs, now, sante_historique, ctxEtatM === 'intensification')
    const etatM = evaluerEtatAthlete({
      chargeSoutenue: ffFiable && joursHautsM >= 3,
      ressentiDegrade: ressM.degrade, ressentiEvaluable: ressM.evaluable,
      sousChargeSoutenue: ffFiable && sousChargeSoutenue(chargeSrcM, now),
      acwr, acwrFiable: fiabiliteACWR(premiereP, ctxObjM, now, acwrCalcA.joursActifs28, acwrCalcA.joursActifsChronique),
      // Charge PRIMAIRE = fitness-fatigue ; ACWR conservé (repli + affichage secondaire).
      ffTsbPct: ffA.tsbPct, ffRatio: ffA.ratio, ffFiable,
      seances7: seances7M,
      // Verdict athlète : fatigue = MOYENNE récente (readiness), pas le pire jour.
      douleur: sigM.douleur, douleurZone: sigM.douleurZone, douleurDate: sigM.douleurDate, fatigue: sigM.fatigueVerdict, sommeil: sigM.sommeilVerdict, stress: sigM.stress, courbatures: sigM.courbatures,
      injStatut: null, ctxEtat: ctxEtatM,
      q: { jours: histoM != null ? histoM : (perfs.length ? 7 : 0), wellnessN: sigM.wellnessN, hasCharge: perfs.length > 0 },
      enPause: enPause || (!!_pauseFin && _pauseFin <= fmtYMD(now) && _pauseFin >= fmtYMD(minus(now, 6))),   // + 7 j de reprise après la pause
    })
    moteur = {
      disponibilite: etatM.disponibilite, surcharge: etatM.surcharge, risque_blessure: etatM.risque_blessure,
      recScore: etatM.recScore, recup: etatM.recup, reco: etatM.reco, confiance: etatM.confiance, alertes: etatM.alertes,
      causes: etatM.causes,   // ce qui produit Vigilance/rouge (affiché sous le verdict)
      // Règle « charge + ressenti » exposée à l'app : la carte Fraîcheur ne dit plus « Fatigue » sur la charge seule.
      charge_ressenti: { soutenue: ffFiable && joursHautsM >= 3, jours_hauts: joursHautsM, degrade: ressM.degrade, evaluable: ressM.evaluable, rpe_exos: ressM.rpeExos, rpe_details: ressM.rpeDetails, rpe_evalues: ressM.rpeEvalues, fc_repos: ressM.fc, raisons: ressM.raisons },
      signaux: etatM.signaux,   // readiness Hooper agrégé (sommeil/stress/courbatures…) → leviers ciblés tracés
      acwr_fiable: etatM.acwr_fiable, acwr_categorie: etatM.acwr_categorie, contexte_tag: etatM.contexte_tag,
      charge_fatigue: { ctl: ffA.ctl, atl: ffA.atl, tsb: ffA.tsb, tsbPct: ffA.tsbPct, ratio: ffA.ratio, fiable: ffFiable, source: useSRPE ? 'srpe' : 'tonnage' },
      seuils_sante: seuilsSanteAPI(),   // Phase 4C-A : CORE_SEUILS → API → NovalyzEngine
      derniere_activite: derniereActivite,   // muscu ou cardio hors marche (rythme des rappels d'absence, N3)
      pause_fin: (_pauseFin && _pauseFin <= fmtYMD(now)) ? _pauseFin : null,   // fin du mode vacances (suggestion « retour de vacances », X5)
    }
    if (etatM.acwr_note) moteur.acwr_note = etatM.acwr_note
  }

  // Calculés une fois : détail des séances + respect du programme (exécution vs cible).
  const seancesDetailArr = buildSeancesDetail(perfs)
  // « Saisie par ton coach » (présentiel) : marqueur posé par saveSeance (indicateurs cle 'saisi_par').
  try {
    const { data: spRows } = await sb().from('indicateurs').select('date,seance_id').eq('athlete_id', athleteId).eq('cle', 'saisi_par')
    const sp = new Set((spRows || []).map((r: any) => normDate(r.date) + '|' + String(r.seance_id ?? '')))
    for (const sd of seancesDetailArr as any[]) if (sp.has(sd.date + '|' + sd.seance_id)) sd.saisi_par_coach = true
  } catch (_) {}
  // 06/11 — séance libre rattachée à la séance prévue qu'elle remplace (« Ma semaine ») : indicateurs cle 'rattache',
  // seance_id = séance réelle (ex. « Libre »), date = date de la séance, valeur = séance prévue ou '__plus__'.
  try {
    const { data: raRows } = await sb().from('indicateurs').select('date,seance_id,valeur,unite').eq('athlete_id', athleteId).eq('cle', 'rattache')
    const ra: Record<string, any> = {}
    for (const r of (raRows || []) as any[]) ra[normDate(r.date) + '|' + String(r.seance_id ?? '')] = r
    for (const sd of seancesDetailArr as any[]) { const r = ra[sd.date + '|' + sd.seance_id]; if (r) { sd.rattache = String(r.valeur || ''); sd.rattache_par = String(r.unite || '') } }
  } catch (_) {}
  const execCibleMuscu = buildRespectProgramme(programme, seancesDetailArr, perfs)
  // Temps de repos entre séries (levier B) : moyenne des repos RÉELLEMENT loggés (>0)
  // sur 28 j. Fait factuel vérifié → alimente un levier « mot de Novalyz » conditionnel.
  const _repCut = fmtYMD(minus(now, 27))
  const _repVals: number[] = []
  for (const r of perfs) { const d = normDate(r.date); if (!d || d < _repCut) continue; const rp = Number(r.repos) || 0; if (rp > 0) _repVals.push(rp) }
  const reposMoy = _repVals.length ? Math.round(_repVals.reduce((a, b) => a + b, 0) / _repVals.length) : null
  // Audit #6 : plus longue pause (jours sans séance) qui touche la période de comparaison (J-56 → J-28).
  let pausePrevJours = 0
  {
    const c56p = fmtYMD(minus(now, 55)), c28p = fmtYMD(minus(now, 27))
    const ds = [...new Set(perfs.map((r: any) => normDate(r.date)).filter((d: any) => d && d >= c56p))].sort() as string[]
    let prev = c56p
    for (const d of ds) {
      if (prev < c28p) { const g = (_joursDepuis(prev, new Date(d + 'T12:00:00Z')) ?? 0) - 1; if (g > pausePrevJours) pausePrevJours = g }
      prev = d
    }
  }
  const _semType = prefsA.semaine_type === 'glissant' ? 'glissant' : 'calendaire'
  const _jourSem = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(lundi.getUTCFullYear(), lundi.getUTCMonth(), lundi.getUTCDate())) / 86400000) + 1
  const synthExtras = { reposMoy, reposN: _repVals.length, pausePrevJours, semaineType: _semType, jourSemaine: _jourSem }

  // Coach actuel (audit liaison 30/10) : le front ne lisait coach_id qu'à la connexion →
  // un athlète lié (ou détaché) après s'être connecté restait « sans coach » jusqu'à la reconnexion.
  const _coachIdLie = String(athData?.coach_id ?? '').trim()
  let coachLie: { coach_id: string; nom: string } | null = null
  if (_coachIdLie && _coachIdLie !== 'null' && _coachIdLie !== '0') {
    const { data: cRow } = await sb().from('coachs').select('coach_id,nom').eq('coach_id', _coachIdLie).single()
    coachLie = { coach_id: _coachIdLie, nom: String((cRow as any)?.nom || '').trim() }
  }

  return jsonResp({
    moteur,
    coach_lie: coachLie,
    coach_demande: await (async () => { const r = (prefRows || []).find((x: any) => x.cle === COACH_DEMANDE_CLE); if (!r || coachLie) return null; const { data: c } = await sb().from('coachs').select('coach_id,nom').eq('coach_id', String(r.valeur)).single(); return c ? { coach_id: String((c as any).coach_id), nom: String((c as any).nom || '').trim() || 'Un coach' } : null })(),
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
      volume_semaine: buildVolumeSemaineParMuscle(perfs, now, _secAll),
      volume_par_jour: buildVolumeParJour(perfs),
      daily_muscu: buildDailyMuscu(perfs, _secAll),
      tendances: computeTendances(perfs, now),
    },
    poids,
    programme,
    planning: (planRows || []).map((r: any) => ({ id: r.id, date: fmtFR(r.date), date_iso: r.date, seance_id: r.seance_id, statut: r.statut, source: r.source })),
    bien_etre,
    pause: pauseObj,
    pause_prevue: pausePrevue(pauseRow, now),
    contexte,
    sport,
    cardio,
    analyses,
    analyse_synthese: {
      muscu: buildSyntheseMuscu((objectifRows && objectifRows[0] && objectifRows[0].objectif) || '', comparisonData, moteur, regulariteObj, execCibleMuscu, synthExtras),
      cardio: buildSyntheseCardio(cardio, moteur, now),
      croise: buildSyntheseCroise(comparisonData, cardio, moteur, now),
    },
    alertes_centre: (() => {
      const weekKey = fmtYMD(getLundi(now))
      const luSet = new Set((alerteLueRows || []).map((r: any) => String(r.cle)))
      return buildAlertesCentre(moteur, comparisonData).map((a: any) => {
        const id = a.type + '|' + weekKey
        return { ...a, id, read: luSet.has(id) }
      })
    })(),
    seances_detail: seancesDetailArr,
    semaine_type: prefsA.semaine_type === 'glissant' ? 'glissant' : 'calendaire',
    // Onboarding : intro vue une fois + proposition auto de programme coupée par l'athlète.
    onboarding_vu: prefsA.onboarding_vu === true,
    prog_auto_off: prefsA.prog_auto_off === true,
    // Lecture v3 (03/11) : niveau d'expérience de l'athlète (ancienneté effective) → mêmes règles athlète / coach.
    niveau_experience: niveauAth,
    zones_prio: zonesPrio,   // zones à développer en priorité (2 max) — cibles relevées dans volume_obti
    muscles_exclus: musclesExclus,   // 09/11 : muscles retirés par choix (séance trop courte) — absents de volume_obti
    // Écran 6 (04/11, décision porteur) : propositions Novalyz à l'athlète seulement s'il n'a PAS de coach,
    // ou si son coach l'a autorisé (pref novalyz_athlete = '1'). Avec coach : Novalyz propose au coach.
    novalyz_athlete_ok: prefsA.novalyz_athlete === true,
    propositions_novalyz: !athData?.coach_id || prefsA.novalyz_athlete === true,
    prog_maj: (() => { const r = (prefRows || []).find((x: any) => x.cle === 'prog_maj'); if (!r) return null; try { return JSON.parse(String(r.valeur || 'null')) } catch (_) { return null } })(),
    // Cibles de volume de TOUS les niveaux (générateur : niveau choisi dans l'assistant) — même table que volume_obti.
    volume_niveaux: Object.fromEntries(Object.keys(VOLUME_CIBLES_NIVEAU).map(k => [k, volumeCiblesRows(k).map(r => ({ muscle: r.muscle, series_min: r.series_min_semaine, series_opt: r.series_opt_semaine }))])),
    exo_categories: (prefsA.exo_categories && typeof prefsA.exo_categories === 'object' && !Array.isArray(prefsA.exo_categories)) ? prefsA.exo_categories : {},
    // Récompenses : solde de points (gagnés − dépensés) + récompenses déjà réclamées.
    // Gagnés = total_seances×10 + records_total×50 (PERMANENT : records à vie, plus la
    // fenêtre 30 j glissante qui faisait disparaître les points). Dépenses = somme des
    // claims (seance_id='recompense', valeur = coût). Source unique front↔back.
    recompenses: { ...calculerPoints(perfsAll || [], beRows || [], progRows || [], Number(seancesPrevues) || 0, recompRows || [], now), ia_active: !!Deno.env.get('ANTHROPIC_API_KEY'), ia_credits: await _iaCreditsRestants(athleteId) },
    pas_quotidiens,
    sante_historique,
    montre_sync,
    ...(await (async () => {   // 07/11 : photo de profil (la sienne + celle de son coach)
      const pa = _avatarPath('a', String(athleteId)), cId = String((athData as any)?.coach_id || '')
      const pc = cId ? _avatarPath('c', cId) : ''
      const u = await _avatarUrls([pa, pc])
      return { photo_url: u[pa] || null, coach_photo_url: pc ? (u[pc] || null) : null }
    })()),
    nutri_historique,
    mensurations,
    suivi_photos,
    blessures: (blessuresRows || []).map(r => ({
      id: String(r.id || ''), date: r.date ? fmtFR(r.date) : '',
      type: String(r.type || ''), localisation: String(r.localisation || ''),
      gravite: String(r.gravite || ''), duree: (r.duree !== '' && r.duree != null) ? Number(r.duree) : null,
      retour_terrain: r.retour_terrain ? fmtFR(r.retour_terrain) : '',
      retour_competition: r.retour_competition ? fmtFR(r.retour_competition) : '',
      statut: String(r.statut || ''),
    })),
    volume_obti,
  })
}

async function handleGetLastPerf(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ perfs: {} })

  const { data: rows } = await _toutLire(() => sb().from('performances').select('*').eq('athlete_id', athleteId).order('id'))
  // Regroupement par exercice → par date, TOUTES séances confondues : la référence
  // « dernière fois » = la DERNIÈRE fois où l'exercice a été fait, quelle que soit la
  // séance (avant : priorité à la même seance_id → avec un split A/B ou une séance
  // « Libre », on comparait à une séance plus ancienne et les cibles ne suivaient pas).
  // `seance_id` (param) n'est plus utilisé pour le choix de la référence.
  const toutesSeances: Record<string, Record<string, any[]>> = {}
  for (const r of rows || []) {
    const date = normDate(r.date)
    const exo = String(r.exercice || '')
    const rpeN = (r.rpe == null || r.rpe === '') ? null : Number(r.rpe)
    const reposN = Number(r.repos)
    const s = { serie: r.serie, charge: Number(r.charge) || 0, reps: Number(r.reps) || 0, rpe: (rpeN != null && !isNaN(rpeN)) ? rpeN : null, repos: reposN > 0 ? reposN : null }
    if (!toutesSeances[exo]) toutesSeances[exo] = {}
    ;(toutesSeances[exo][date] ||= []).push(s)
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
    const series = byDate[last].slice().sort((a: any, b: any) => (Number(a.serie) || 0) - (Number(b.serie) || 0))
    const rl = getRef(series)
    const o: any = { date: last, series, max_reps: rl.reps, last_charge: rl.charge, prev_max_reps: null, prev_charge: null, prev2_max_reps: null, prev2_charge: null }
    if (prev) {
      const r = getRef(byDate[prev]); o.prev_max_reps = r.reps; o.prev_charge = r.charge
      // Détail de l'avant-dernière fois : la surcharge par niveau vérifie « toutes les séries
      // au haut de la fourchette, 2 séances de suite » (pas seulement la meilleure série).
      o.prev_date = prev
      o.prev_series = byDate[prev].slice().sort((a: any, b: any) => (Number(a.serie) || 0) - (Number(b.serie) || 0))
    }
    if (prev2) { const r = getRef(byDate[prev2]); o.prev2_max_reps = r.reps; o.prev2_charge = r.charge }
    return o
  }

  const result: Record<string, any> = {}
  for (const exo of Object.keys(toutesSeances)) { const o = buildForExo(toutesSeances[exo]); if (o) result[exo] = o }
  return jsonResp({ perfs: result })
}

async function handleGetExercices(): Promise<Response> {
  // catalogue complet depuis la table exercices ; le front lit data.exercices
  const { data } = await sb().from('exercices').select('*').order('exercice')
  // 07/11 : catalogue COMMUN = exercices validés. Ceux créés par un coach et pas encore
  // validés (statut 'en_attente') ne sont visibles que de ce coach et de ses athlètes (exercicesPrives).
  return jsonResp({ exercices: _exoLignes((data || []).filter((r: any) => (r.statut || 'valide') === 'valide')) })
}
function _exoLignes(rows: any[]): any[] {
  return (rows || []).filter(r => r.exercice_id).map(r => ({
    exercice_id: r.exercice_id,
    exercice: r.exercice,
    muscle: normMuscle(r.muscle),
    muscle_secondaire: normMuscle(r.muscle_secondaire),
    increment_kg: r.increment_kg || '2.5 / 5kg',
    // Catalogue 06/11 : matériel, disciplines (liste « muscu,street… »), type de mesure, auteur (coach).
    materiel: r.materiel || '', disciplines: r.disciplines || 'muscu', mesure: r.mesure || 'charge_reps', cree_par: r.cree_par || '',
    statut: r.statut || 'valide',
  }))
}
// Exercices en attente de validation du coach de la session (coach : les siens ; athlète : ceux de SON coach).
async function handleExercicesPrives(body: any): Promise<Response> {
  let cid = ''
  if (body._sessRole === 'c') cid = String(body._sessId || '')
  else if (body.athlete_id) {
    const { data: a } = await sb().from('athletes').select('coach_id').eq('id', String(body.athlete_id)).single()
    cid = String((a as any)?.coach_id || '')
  }
  if (!cid) return jsonResp({ exercices: [] })
  const { data } = await sb().from('exercices').select('*').eq('cree_par', 'coach:' + cid).eq('statut', 'en_attente').order('exercice')
  return jsonResp({ exercices: _exoLignes(data || []) })
}
// Clé de nom normalisée (même règle que la colonne nom_cle + index unique en base, 07/11).
const _nomCle = (t: any) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Catalogue 06/11 — un coach crée un exercice : muscle choisi dans la liste fermée (14), plus de saisie libre.
// 07/11 : « Corps entier » (burpees, pneu, slam ball…) : compte dans la séance, PAS dans le volume par muscle
// (absent de VOLUME_CIBLES_NIVEAU → jamais dans volume_obti). Matériel fonctionnel ajouté.
const CAT_MUSCLES = ['Pectoraux', 'Dos', 'Trapèze', 'Epaule', 'Biceps', 'Triceps', 'Avant-bras', 'Abdominaux', 'Lombaires', 'Quadriceps', 'Ischio', 'Fessier', 'Adducteur', 'Mollets', 'Corps entier']
const CAT_MATERIEL = ['Barre', 'Haltères', 'Machine', 'Poulie', 'Smith', 'Poids du corps', 'Sac lesté', 'Kettlebell', 'Médecine-ball', 'Pneu / masse', 'Autre']
async function handleCreerExercice(body: any): Promise<Response> {
  if (body._sessRole !== 'c') return jsonResp({ erreur: 'Réservé aux coachs' })
  const nom = String(body.exercice || '').replace(/\s+/g, ' ').trim()
  const muscle = normMuscle(body.muscle), sec = body.muscle_secondaire ? normMuscle(body.muscle_secondaire) : null
  const materiel = CAT_MATERIEL.includes(String(body.materiel || '')) ? String(body.materiel) : 'Autre'
  if (!nom || nom.length > 60) return jsonResp({ erreur: 'Nom manquant ou trop long (60 caractères max)' })
  if (!CAT_MUSCLES.includes(muscle)) return jsonResp({ erreur: 'Muscle inconnu' })
  if (sec && (!CAT_MUSCLES.includes(sec) || sec === muscle)) return jsonResp({ erreur: 'Muscle secondaire invalide' })
  const { data: tous } = await sb().from('exercices').select('exercice_id,exercice,statut,cree_par')
  const cle = _nomCle(nom), moi = 'coach:' + String(body._sessId || '')
  const meme = (tous || []).find((e: any) => _nomCle(e.exercice) === cle)
  if (meme) {
    const enAttente = (meme.statut || 'valide') === 'en_attente'
    return jsonResp({ erreur: enAttente && meme.cree_par !== moi ? 'Un autre coach a déjà proposé cet exercice : il sera dans le catalogue dès qu\'il est validé.' : 'Cet exercice existe déjà : utilise « ' + meme.exercice + ' ».', existant: { exercice_id: meme.exercice_id, exercice: meme.exercice } })
  }
  // 07/11 : privé au coach (et à ses athlètes) + « en attente » jusqu'à validation par le porteur.
  // Unicité garantie en base (exercice_id = clé primaire, nom_cle = index unique) : si deux coachs
  // créent en même temps, l'un des deux échoue proprement → on retente avec le numéro suivant.
  let id = Math.max(0, ...(tous || []).map((e: any) => Number(e.exercice_id) || 0)) + 1
  for (let essai = 0; essai < 3; essai++, id++) {
    const row = { exercice_id: String(id), exercice: nom, nom_cle: cle, statut: 'en_attente', muscle, muscle_secondaire: sec, increment_kg: materiel === 'Haltères' ? '2' : '2.5', materiel, disciplines: 'muscu', mesure: 'charge_reps', cree_par: moi }
    const { error } = await sb().from('exercices').insert(row)
    if (!error) return jsonResp({ ok: true, exercice: row })
    const msg = String(error.message || '')
    if (/nom_cle/.test(msg)) return jsonResp({ erreur: 'Cet exercice existe déjà.' })
    if (!/duplicate|unique|pkey/i.test(msg)) return jsonResp({ erreur: msg })
  }
  return jsonResp({ erreur: 'Création impossible, réessaie.' })
}

async function handleLoginCoach(params: URLSearchParams): Promise<Response> {
  const login = params.get('login')?.trim()
  const pwd = params.get('password')?.trim()
  if (!login || !pwd) return jsonResp({ erreur: 'Paramètres manquants' })

  const cleC = 'c:' + login
  const bloqueMin = await _loginBloqueMin(cleC)
  if (bloqueMin) return jsonResp({ success: false, error: _msgBloque(bloqueMin), bloque: true })

  const { data: coach } = await sb().from('coachs').select('*').eq('login', login).single()
  if (!coach) { await _loginEchec(cleC); return jsonResp({ success: false, error: 'Login ou mot de passe incorrect.' }) }

  const { ok, upgrade } = await verifyPwd(pwd, coach.password_hash || '', coach.login)
  if (!ok) { await _loginEchec(cleC); return jsonResp({ success: false, error: 'Login ou mot de passe incorrect.' }) }
  await _loginReussi(cleC)
  if (upgrade) await _passerEnW1('coachs', 'coach_id', String(coach.coach_id), upgrade, coach.password_hash)   // 10/11 : passage en w1

  return jsonResp({ success: true, coach: { coach_id: coach.coach_id, nom: coach.nom, sport: String(coach.sport || '').trim() || 'muscu', role: String(coach.role || '').trim() || 'coach', email: coach.email || '', email_verifie: !!coach.email_verifie, club: coach.club || '', categorie_defaut: coach.categorie_defaut || '', recap_freq: coach.recap_freq || 'off' } })
}

// Pause active = aujourd'hui dans [debut, fin] (valeur = début, unite = fin, 'fin' = pause levée). Une source pour
// getAppData et getCoachAthletes (audit 06/11 : getCoachAthletes disait « en pause » pour toute pause jamais levée,
// ex. Vincent, pause du 19/08 au 02/09 encore lue comme en cours le 06/11).
// 13/11 (retour client) : pause EN COURS OU À VENIR, pour l'affichage (Réglages, agendas). pauseActive reste la
// seule utilisée par le moteur (alertes en veille uniquement pendant la pause). Terminée ou annulée → null.
function pausePrevue(row: any, now: Date): { debut: string | null, fin: string | null, active: boolean } | null {
  if (!row || !row.valeur || row.valeur === 'fin') return null
  const debut = normDate(row.valeur) || null
  const fin = row.unite ? normDate(row.unite) : null
  const today0 = fmtYMD(now)
  if (fin && today0 > fin) return null
  return { debut, fin, active: !debut || today0 >= debut }
}
function pauseActive(row: any, now: Date): { debut: string | null, fin: string | null } | null {
  if (!row || !row.valeur || row.valeur === 'fin') return null
  const debut = normDate(row.valeur) || null
  const fin = row.unite ? normDate(row.unite) : null
  const today0 = fmtYMD(now)
  return ((!debut || today0 >= debut) && (!fin || today0 <= fin)) ? { debut, fin } : null
}
async function handleGetCoachAthletes(params: URLSearchParams): Promise<Response> {
  const coachId = params.get('coach_id')
  if (!coachId) return jsonResp({ erreur: 'coach_id manquant' })

  const { data: athletes } = await sb().from('athletes').select('*').eq('coach_id', coachId)
  if (!athletes?.length) return jsonResp({ ok: true, athletes: [] })

  const athleteIds = athletes.map(a => a.id)
  const now = new Date()
  const c28 = fmtYMD(minus(now, 27))

  const [{ data: perfsAll }, { data: pauseAll }, { data: beAll }] = await Promise.all([
    _toutLire(() => sb().from('performances').select('*').in('athlete_id', athleteIds).gte('date', c28).order('id')),
    sb().from('indicateurs').select('*').in('athlete_id', athleteIds).eq('cle', 'pause').order('date', { ascending: false }).order('id', { ascending: false }),
    _toutLire(() => sb().from('bien_etre').select('*').in('athlete_id', athleteIds).order('date', { ascending: false }).order('id')),
  ])

  // Audit #8 : le coach voit les MÊMES alertes que l'athlète (moteur central → alertes_centre),
  // pas celles de l'ancien calculerAlertes. Repli sur l'ancien calcul si l'appel échoue (foot inclus).
  const centreByAth: Record<string, any[] | null> = {}
  await Promise.all(athletes.map(async (ath: any) => {
    if ((ath.sport || 'muscu') !== 'muscu') return
    try {
      const r = await handleGetAppData(new URLSearchParams({ athlete_id: String(ath.id) }))
      const d: any = await r.json()
      if (Array.isArray(d && d.alertes_centre)) centreByAth[String(ath.id)] = d.alertes_centre.map((x: any) => ({
        type: x.type, severite: x.severity, message: (x.evidence && x.evidence !== x.title) ? (x.title + ' — ' + x.evidence) : x.title,
      }))
    } catch (_) { /* repli ancien calcul */ }
  }))

  const avatars = await _avatarUrls(athletes.map(a => _avatarPath('a', String(a.id))))   // 07/11 photo de profil
  const result = athletes.map(ath => {
    const perfs = (perfsAll || []).filter(r => r.athlete_id === ath.id)
    const pauses = (pauseAll || []).filter(r => r.athlete_id === ath.id)
    const enPause = !!pauseActive(pauses[0], now)
    const dates = [...new Set(perfs.map(r => normDate(r.date)))].sort()
    const anneesA = anneesEffectives(ath.annees, ath.created_at, now)   // N2 : ancienneté effective (évolue dans le temps)
    const alertes = centreByAth[String(ath.id)] || calculerAlertes(perfs, ath.id, anneesA, enPause)
    const lastBE = (beAll || []).find(r => r.athlete_id === ath.id)
    const sportA = ath.sport || 'muscu'
    const strategieA = ath.strategie || (sportA === 'muscu' ? getStrategieFromAnnees(anneesA) : '')
    return {
      athlete_id: String(ath.id), id: ath.id, nom: ath.nom, sport: sportA, en_pause: enPause,
      photo_url: avatars[_avatarPath('a', String(ath.id))] || null,
      derniere_seance: dates.length ? fmtFR(dates[dates.length - 1]) : null,
      annees_pratique: anneesA,                         // ← rétabli (perdu à la migration) : pilote le niveau côté coach
      niveau: getNiveauExperience(anneesA),
      strategie_progression: strategieA,
      alertes,
      bien_etre: lastBE ? { date: fmtFR(lastBE.date), fatigue: lastBE.fatigue_musculaire, energie: lastBE.energie, sommeil: lastBE.sommeil } : null,
    }
  })

  return jsonResp({ ok: true, athletes: result, ia_active: !!Deno.env.get('ANTHROPIC_API_KEY') })
}

async function handleGetCommentaires(params: URLSearchParams): Promise<Response> {
  let coachId = params.get('coach_id')
  const athleteId = params.get('athlete_id')
  // M2 (01/11) : un fil = la conversation avec UN coach. Côté athlète (session athlète) → son coach
  // actuel ; côté coach → ce coach (posé par authCheck depuis la session). M7 : conversation complète.
  if (!coachId && athleteId && params.get('_sess_role') === 'a') {
    const { data: a } = await sb().from('athletes').select('coach_id').eq('id', athleteId).single()
    coachId = String((a as any)?.coach_id || '') || '__aucun__'
  }
  // Défense en profondeur (10/11) : jamais de lecture globale sans filtre.
  if (!coachId && !athleteId) return jsonResp({ commentaires: [] })
  const { data } = await _toutLire(() => {
    let q = sb().from('commentaires').select('*')
    if (coachId) q = q.eq('coach_id', coachId)
    if (athleteId) q = q.eq('athlete_id', athleteId)
    return q.order('comment_id', { ascending: false })
  })
  // Média (photo/vidéo athlète → coach) : on renvoie une URL de LECTURE signée
  // (bucket privé coach-media), TTL 2 h, régénérée à chaque chargement du fil.
  const rows = data || []
  const paths = rows.filter(r => r.media_path).map(r => r.media_path)
  const urlByPath: Record<string, string> = {}
  if (paths.length) {
    try {
      const { data: signed } = await sb().storage.from('coach-media').createSignedUrls(paths, 7200)
      for (const s of (signed || [])) { if (s && s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl }
    } catch (_) { /* best-effort : sans URL, la bulle affiche juste la légende */ }
  }
  return jsonResp({ commentaires: rows.map(r => ({ id: r.comment_id, athlete_id: r.athlete_id, coach_id: r.coach_id, coach_nom: r.coach_nom, message: r.message, date: r.date, lu: r.lu === true || String(r.lu).toUpperCase() === 'TRUE', auteur: r.auteur, auteur_nom: r.auteur_nom, media_type: r.media_type || null, media_url: r.media_path ? (urlByPath[r.media_path] || null) : null })) })
}

async function handleGetCoachProgramme(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
  const { data } = await sb().from('programme').select('*').eq('athlete_id', athleteId).order('groupe_id').order('id')
  const lignes = (data || []).map(r => ({ id: r.id, row_index: r.id, athlete_id: r.athlete_id, seance_id: r.seance_id, exercice: r.exercice, series_prevues: r.series_prevues, reps_mini: r.reps_mini, reps_max: r.reps_max, repos_sec: r.repos_sec, groupe_id: r.groupe_id, jour: r.jour != null ? Number(r.jour) : null, charge_pct_1rm: r.charge_pct_1rm != null ? Number(r.charge_pct_1rm) : null, rpe_cible: r.rpe_cible != null ? Number(r.rpe_cible) : null, type: r.type || null, cardio_cible: r.cardio_cible != null ? Number(r.cardio_cible) : null, cardio_unite: r.cardio_unite || null, schema: r.schema || null, backoff_pct: r.backoff_pct != null ? Number(r.backoff_pct) : null, series_json: r.series_json != null ? r.series_json : null }))
  // le front lit data.lignes ; on garde aussi "programme" par rétro-compat
  return jsonResp({ ok: true, lignes, programme: lignes })
}

async function handleGetSeancesDetail(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ error: 'athlete_id manquant' })
  const { data } = await _toutLire(() => sb().from('performances').select('*').eq('athlete_id', athleteId).order('id'))
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
    _toutLire(() => sb().from('performances').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).order('id')),
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
  const loginAth = String(params.get('login_athlete') || params.get('cle') || '').trim()
  if (!coachId) return jsonResp({ success: false, error: 'coach_id manquant' })
  // Audit 30/10 : avant, la liaison ÉCRASAIT sans rien dire le coach_id existant (un coach
  // pouvait « prendre » l'athlète d'un autre coach avec son seul login à 4 chiffres).
  // Désormais : un athlète déjà suivi par un AUTRE coach est refusé ; il doit d'abord
  // quitter son coach (Réglages ▸ Mon coach, action detacherCoach).
  const lier = async (ath: any): Promise<Response> => {
    const cur = String(ath.coach_id ?? '').trim()
    if (cur && cur !== 'null' && cur !== '0' && cur !== String(coachId)) {
      return jsonResp({ success: false, deja_autre: true, error: 'Cet athlète est déjà suivi par un autre coach. Il doit d\'abord quitter son coach (Réglages ▸ Compte ▸ Mon coach).' })
    }
    if (cur === String(coachId)) return jsonResp({ success: true, deja: true, athlete_id: ath.id, nom: ath.nom })
    // Option A (décision 30/10) : plus de liaison directe. Le coach envoie une DEMANDE,
    // l'athlète l'accepte ou la refuse dans son app (repondreDemandeCoach). Stockée en pref
    // (indicateurs, seance_id 'pref', cle 'coach_demande', valeur = coach_id) : une seule
    // demande en attente par athlète, la plus récente remplace l'autre (le nom est affiché).
    const { data: ex } = await sb().from('indicateurs').select('valeur').eq('athlete_id', ath.id).eq('seance_id', 'pref').eq('cle', COACH_DEMANDE_CLE).limit(1)
    if (ex && ex.length) {
      if (String(ex[0].valeur) === String(coachId)) return jsonResp({ success: true, demande: true, deja_demande: true, athlete_id: ath.id, nom: ath.nom })
      const { error } = await sb().from('indicateurs').update({ valeur: String(coachId), date: fmtYMD(new Date()) }).eq('athlete_id', ath.id).eq('seance_id', 'pref').eq('cle', COACH_DEMANDE_CLE)
      if (error) return jsonResp({ success: false, error: error.message })
    } else {
      const { error } = await sb().from('indicateurs').insert({ athlete_id: ath.id, date: fmtYMD(new Date()), seance_id: 'pref', cle: COACH_DEMANDE_CLE, valeur: String(coachId), unite: '', source: 'app' })
      if (error) return jsonResp({ success: false, error: error.message })
    }
    const { data: cRow } = await sb().from('coachs').select('nom').eq('coach_id', coachId).single()
    const cNom = String((cRow as any)?.nom || '').trim() || 'Un coach'
    await notifyAthlete(String(ath.id), { title: cNom + ' veut te suivre', body: 'Ouvre Novalyz pour accepter ou refuser.', tag: 'novalyz-coach-demande', target: 'accueil' }).catch(() => {})
    return jsonResp({ success: true, demande: true, athlete_id: ath.id, nom: ath.nom })
  }
  if (loginAth) {
    if (!/^\d{4}$/.test(loginAth)) return jsonResp({ success: false, error: 'Le login doit faire 4 chiffres.' })
    const { data: ath } = await sb().from('athletes').select('id,nom,coach_id').eq('login', loginAth).single()
    if (!ath) return jsonResp({ success: false, error: 'Aucun athlète avec ce login.' })
    return lier(ath)
  }
  if (athleteId) {
    const { data: ath } = await sb().from('athletes').select('id,nom,coach_id').eq('id', athleteId).single()
    if (!ath) return jsonResp({ success: false, error: 'Athlète introuvable' })
    return lier(ath)
  }
  return jsonResp({ success: false, error: 'Paramètres manquants' })
}

const COACH_DEMANDE_CLE = 'coach_demande'

// L'athlète répond à la demande de suivi d'un coach (option A, 30/10).
// Accepter : coach_id = coach de la demande. Dans tous les cas la demande est effacée.
async function handleRepondreDemandeCoach(body: any): Promise<Response> {
  const athleteId = String(body.athlete_id || '')
  if (!athleteId) return jsonResp({ success: false, error: 'athlete_id manquant' })
  // Règle métier (porteur, 11/11 — audit P2.1) : la demande appartient à l'athlète. Seul l'athlète de la
  // SESSION l'accepte ou la refuse ; aucun coach (même son coach actuel) ne peut y répondre.
  if (body._sessRole !== 'a' || String(body._sessId || '') !== athleteId) return jsonResp({ success: false, error: 'Seul l\'athlète peut répondre à cette demande.' })
  const { data: dem } = await sb().from('indicateurs').select('valeur').eq('athlete_id', athleteId).eq('seance_id', 'pref').eq('cle', COACH_DEMANDE_CLE).limit(1)
  const coachId = dem && dem.length ? String(dem[0].valeur || '') : ''
  if (!coachId) return jsonResp({ success: false, error: 'Aucune demande en attente.' })
  // Le coach qui a fait la demande doit être celui que l'athlète a vu (anti-remplacement entre-temps) : obligatoire.
  if (body.coach_id_vu == null || String(body.coach_id_vu) !== coachId) return jsonResp({ success: false, error: 'La demande a changé : rouvre l\'app.' })
  // Un athlète déjà rattaché à un (autre) coach le quitte d'abord (même règle que lierAthlete et l'app).
  // Refuser reste toujours possible. Rien n'est supprimé en cas de refus métier.
  if (body.accepter) {
    const { data: aCur } = await sb().from('athletes').select('coach_id').eq('id', athleteId).single()
    const cur = String((aCur as any)?.coach_id ?? '').trim()
    if (cur && cur !== 'null' && cur !== '0' && cur !== coachId) return jsonResp({ success: false, error: 'Quitte d\'abord ton coach actuel (Réglages ▸ Mon coach) avant d\'accepter un nouveau coach.' })
  }
  await sb().from('indicateurs').delete().eq('athlete_id', athleteId).eq('seance_id', 'pref').eq('cle', COACH_DEMANDE_CLE)
  if (!body.accepter) return jsonResp({ success: true, accepte: false })
  const { data: cRow } = await sb().from('coachs').select('coach_id,nom').eq('coach_id', coachId).single()
  if (!cRow) return jsonResp({ success: false, error: 'Ce coach n\'existe plus.' })
  const { error } = await sb().from('athletes').update({ coach_id: coachId }).eq('id', athleteId)
  if (error) return jsonResp({ success: false, error: error.message })
  await _appliquerDefautsCoach(coachId, athleteId)   // P7 (05/11) : défauts du coach pour ses nouveaux athlètes
  const { data: aRow } = await sb().from('athletes').select('nom').eq('id', athleteId).single()
  await notifyCoach(coachId, { title: String((aRow as any)?.nom || 'Ton athlète') + ' a accepté ton suivi', body: 'Il apparaît maintenant dans ton équipe.', tag: 'novalyz-coach-demande', target: 'coach' }).catch(() => {})
  return jsonResp({ success: true, accepte: true, coach: { coach_id: coachId, nom: String((cRow as any).nom || '') } })
}

// L'athlète quitte son coach (ou le coach retire son athlète) : coach_id → null.
// Droits : authCheck vérifie athlete_id = soi (athlète) ou athlète lié (coach).
async function handleDetacherCoach(body: any): Promise<Response> {
  const athleteId = String(body.athlete_id || '')
  if (!athleteId) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const { error } = await sb().from('athletes').update({ coach_id: null }).eq('id', athleteId)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
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
function _aggSignaux(rows: any[], now: Date, days = 7): { douleur: number|null; douleurZone: string|null; douleurDate: string|null; fatigue: number|null; fatigueMoy: number|null; sommeil: number|null; stress: number|null; courbatures: number|null; wellnessN: number; fatigueVerdict: number|null; sommeilVerdict: number|null } {
  // Zone lisible : anciennes saisies perdues stockées « NaN » → aucune zone (sinon l'alerte
  // affichait « Gêne légère signalée (nan) », vu sur données réelles le 31/10).
  const _zoneOk = (z: any): string | null => { const t = String(z == null ? '' : z).trim(); return (!t || /^(nan|null|undefined)$/i.test(t)) ? null : t }
  const cut = fmtYMD(minus(now, days - 1))
  const doul: number[] = [], fat: number[] = [], som: number[] = [], str: number[] = [], courb: number[] = []
  const fatD: { d: string; v: number }[] = [], somD: { d: string; v: number }[] = []
  // DOULEUR = DERNIÈRE saisie (jour le plus récent ; pire valeur de ce jour-là), plus
  // le MAX des 7 jours : une douleur passée (« Aucune » le lendemain) ne maintient
  // plus l'athlète en Vigilance / rouge pendant une semaine (validé porteur oct. 2026).
  let dLastDate: string | null = null, dLast: number | null = null, dZone: string | null = null
  let cLastDate: string | null = null, cLast: number | null = null
  for (const r of rows || []) {
    const dIso = normDate(r.date); if (!dIso || dIso < cut) continue
    if (r.douleur != null && r.douleur !== '') {
      const v = Number(r.douleur); doul.push(v)
      if (!isNaN(v) && (dLastDate == null || dIso > dLastDate)) { dLastDate = dIso; dLast = v; dZone = _zoneOk(r.zone_douloureuse) }
      else if (!isNaN(v) && dIso === dLastDate && v > (dLast as number)) { dLast = v; dZone = _zoneOk(r.zone_douloureuse) || dZone }
    }
    if (r.fatigue_musculaire != null && r.fatigue_musculaire !== '') { fat.push(Number(r.fatigue_musculaire)); fatD.push({ d: dIso, v: Number(r.fatigue_musculaire) }) }
    if (r.sommeil != null && r.sommeil !== '') { som.push(Number(r.sommeil)); somD.push({ d: dIso, v: Number(r.sommeil) }) }
    if (r.stress != null && r.stress !== '') str.push(Number(r.stress))
    if (r.courbatures != null && r.courbatures !== '') {
      const cv = Number(r.courbatures); courb.push(cv)
      // Audit #4 : comme la douleur, on suit la DERNIÈRE saisie (pas le pire des 7 jours).
      if (!isNaN(cv) && (cLastDate == null || dIso > cLastDate)) { cLastDate = dIso; cLast = cv }
      else if (!isNaN(cv) && dIso === cLastDate && cv > (cLast as number)) cLast = cv
    }
  }
  const mx = (a: number[]) => a.length ? Math.max(...a) : null
  const mn = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
  // `fatigue` = MAX (prévention, lu par le coach — figé). `fatigueMoy` = moyenne
  // récente, utilisée par le VERDICT athlète (readiness) pour qu'un seul jour
  // fatigué ne plombe pas la semaine. Ajout non cassant.
  // Hooper : on ajoute stress (moyenne récente) et courbatures/DOMS (MAX, prévention).
  // 06/11 (retour porteur) : « le jour compte pour le jour ». Une mauvaise nuit / une journée fatiguée ne doit
  // pas tout remettre en cause les jours suivants. VERDICT (athlète ET coach, même règle) :
  //   · réponse d'aujourd'hui ou d'hier → c'est elle qui compte (dernière réponse) ;
  //   · sinon (pas de réponse récente) → seulement une TENDANCE : ≥ 2 réponses défavorables sur 7 j,
  //     ou moyenne 7 j défavorable ; sinon rien (pas de Vigilance sur une vieille réponse isolée).
  // Avant : athlète = moyenne 7 j (une seule mauvaise réponse comptait 7 j s'il ne répondait plus) ;
  //         coach = MAXIMUM 7 j (une journée à 4/5 = « Fatigue élevée » pendant une semaine).
  const recent = fmtYMD(minus(now, 1))
  const derniere = (a: { d: string; v: number }[]) => { let b: { d: string; v: number } | null = null; for (const x of a) if (!isNaN(x.v) && (!b || x.d >= b.d)) b = x; return b }
  const verdict = (a: { d: string; v: number }[], mauvais: (v: number) => boolean): number | null => {
    const last = derniere(a); if (!last) return null
    if (last.d >= recent) return last.v
    const vals = a.map(x => x.v).filter(v => !isNaN(v)), moy = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    if (vals.filter(mauvais).length >= 2) return moy
    if (vals.length >= 2 && moy != null && mauvais(moy)) return moy   // une moyenne = au moins 2 réponses (1 vieille réponse seule ne compte pas)
    return null
  }
  const fatigueVerdict = verdict(fatD, v => v >= 4)
  const sommeilVerdict = verdict(somD, v => v <= 2)
  return { fatigueVerdict, sommeilVerdict, douleur: dLast, douleurZone: dZone, douleurDate: dLastDate, fatigue: mx(fat), fatigueMoy: mn(fat), sommeil: mn(som), stress: mn(str), courbatures: cLast, wellnessN: Math.max(doul.length, fat.length, som.length, str.length, courb.length) }
}

interface EtatInput {
  acwr: number | null
  acwrFiable?: boolean         // false = chronique insuffisante (reprise) → ACWR non interprétable
  // Modèle fitness-fatigue (Banister) — SIGNAL DE CHARGE PRIMAIRE (muscu). Plus
  // robuste que l'ACWR couplé (EWMA). Si fourni & fiable, il pilote la charge ;
  // sinon on retombe sur l'ACWR (chemin foot, qui ne fournit pas encore le FF).
  ffTsbPct?: number | null     // (CTL−ATL)/CTL·100 : négatif = fatigue récente > fond
  ffRatio?: number | null      // ATL/CTL (= EWMA-ACWR)
  ffFiable?: boolean           // historique suffisant (≥28 j et ≥8 jours actifs/42)
  seances7: number
  douleur: number | null       // agrégé (max récent)
  fatigue: number | null       // agrégé (max récent)
  sommeil: number | null       // agrégé (moyenne récente)
  stress: number | null        // readiness Hooper (1..5, 5 = TRÈS stressé, item invert) — moyenne récente
  courbatures: number | null   // readiness Hooper (DOMS) / muscu — max récent
  injStatut: 'indispo' | 'retour_progressif' | null
  blessureGrave?: boolean       // blessure active modérée/grave (muscu : table blessures)
  ctxEtat: string
  q: { jours: number; wellnessN: number; hasCharge: boolean }
  enPause?: boolean            // mode vacances actif (Réglages) → pas d'absence / sous-charge
  // RÈGLE « CHARGE + RESSENTI » (oct. 2026, validée porteur). Si ces champs sont
  // FOURNIS (muscu), une alerte de charge exige une charge SOUTENUE (TSB% < -12 sur
  // ≥ 3 des 5 derniers jours) ET un signal ressenti concordant (fatigue/sommeil
  // dégradés vs la baseline perso, ou RPE en hausse à charge ≤) — Meeusen 2013,
  // Saw 2016. La sous-charge exige une baisse SOUTENUE ≥ 14 j (désentraînement
  // après 2-3 sem. : Mujika & Padilla 2000). Non fournis (foot, ACWR) → règle historique.
  douleurZone?: string | null    // zone de la dernière douleur saisie (affichage de la cause)
  douleurDate?: string | null    // date (aaaa-mm-jj) de cette saisie
  chargeSoutenue?: boolean | null
  ressentiDegrade?: boolean | null
  ressentiEvaluable?: boolean | null
  sousChargeSoutenue?: boolean | null
}

function evaluerEtatAthlete(s: EtatInput): any {
  const NIV = CORE_NIVEAUX.map(n => n.label)     // ['Prêt','Vigilance','À surveiller']
  const STA = CORE_NIVEAUX.map(n => n.statut)    // ['vert','orange','rouge'] — catégorie métier
  const ctx = s.ctxEtat || 'saison_normale'
  // Effets de contexte centralisés (Phase 3C) — pilotés par CORE_CONTEXTES.
  const eff = effetsContexte(ctx)
  // Mode vacances (Réglages, audit R1 01/11) = repos prévu : pas d'alerte d'absence ni de volume trop bas.
  const reposPrevu = eff.reposPrevu || s.enPause === true

  // --- Garde-fou ACWR (décision retour-vacances) : si l'historique de charge est
  // insuffisant (reprise, < 28 j de chronique réelle), l'ACWR est NON INTERPRÉTABLE.
  // On n'en tire alors AUCUNE alerte (ni surcharge ni sous-charge) — les autres
  // indicateurs (douleur, fatigue, sommeil, récup…) continuent de fonctionner.
  const acwrOk = s.acwr != null && s.acwrFiable !== false
  // Signal de charge PRIMAIRE = fitness-fatigue (Banister) s'il est fourni & fiable.
  // Repli = ACWR couplé (chemin foot). `chargeOk` = charge interprétable par l'un OU l'autre.
  const ffOk = s.ffFiable === true && s.ffTsbPct != null
  const chargeOk = ffOk || acwrOk

  // --- Niveau de confiance (qualité des données disponibles) ---
  let confiance: string
  if (s.q.wellnessN === 0 && !s.q.hasCharge) confiance = 'non_interpretable'
  else if (s.q.jours < CORE_FIABILITE.confJoursFaible || s.q.wellnessN === 0) confiance = 'faible'
  else if (s.q.jours < CORE_FIABILITE.confJoursMoyen || s.q.wellnessN < CORE_FIABILITE.wellnessMin || !chargeOk) confiance = 'moyenne'
  else confiance = 'haute'

  // --- Charge : fitness-fatigue PRIMAIRE (TSB %), ACWR en repli. Ajustée par contexte. ---
  // Fraîcheur (TSB %) : < -30 = charge récente très élevée (2) ; < -12 = en hausse (1).
  // Aligné sur les libellés front (« Fatigue » dès TSB < -12). ACWR ne sert qu'en repli.
  let surchargeN = 0
  if (ffOk) {
    const t = s.ffTsbPct as number
    surchargeN = t <= -30 ? 2 : t < -12 ? 1 : 0
  } else if (acwrOk) {
    surchargeN = (s.acwr as number) > CORE_SEUILS.acwr.haut ? 2 : (s.acwr as number) > CORE_SEUILS.acwr.optMax ? 1 : 0
  }
  if (chargeOk && eff.surchargeDelta) surchargeN = clampNiv(surchargeN + eff.surchargeDelta)

  const doul = s.douleur ?? 0, fat = s.fatigue ?? 0, som = s.sommeil, courb = s.courbatures ?? 0, str = s.stress ?? 0
  const chargeHaute = surchargeN >= 1
  const sommeilBas = som != null && som <= CORE_SEUILS.sommeil.bas
  // Intensification (X3, 01/11) : fatigue élevée ATTENDUE → Vigilance seulement à 5/5 (même seuil que l'app).
  const fatigueHaute = fat >= (s.ctxEtat === 'intensification' ? 5 : CORE_SEUILS.fatigue.haute)
  const douleurGene = doul >= CORE_SEUILS.douleur.gene, douleurForte = doul >= CORE_SEUILS.douleur.forte
  const douleurLegere = !douleurGene && doul >= CORE_SEUILS.douleur.attention   // point d'attention, sans Vigilance

  // --- Signaux → alertes (le contexte peut en supprimer) ---
  const alertes: { type: string; severite: string; message: string }[] = []
  // « Absence » seulement si l'athlète a DÉJÀ un historique d'entraînement : sinon
  // un nouveau (ou quelqu'un qui n'a jamais loggé de séance) recevrait « Absence
  // prolongée » (haute) + push dès le 1er jour — faux positif (fiabilité).
  if (s.seances7 === 0 && s.injStatut !== 'indispo' && !reposPrevu && s.q.hasCharge)
    alertes.push({ type: 'absence', severite: 'haute', message: 'Aucune séance (muscu ou cardio) depuis 7 jours' })
  // Messages SANS mention ACWR (repère secondaire peu fiable) : on parle de « charge
  // récente » (modèle fitness-fatigue). L'action concrète reste dans buildAlertesCentre.
  const sousCharge = ffOk ? (s.ffRatio != null && (s.ffRatio as number) < 0.80)
                          : (acwrOk && (s.acwr as number) < CORE_SEUILS.acwr.bas)
  const regleRessenti = s.chargeSoutenue != null   // muscu : règle « charge + ressenti »
  if (regleRessenti) {
    if (surchargeN >= 1 && s.chargeSoutenue === true && s.ressentiDegrade === true) {
      if (surchargeN >= 2) alertes.push({ type: 'surcharge', severite: 'haute', message: 'Charge élevée depuis plusieurs jours et tu récupères moins bien : allège 1 à 2 séances.' })
      else alertes.push({ type: 'charge', severite: 'moyenne', message: 'Ta charge monte et tu récupères moins bien depuis quelques jours : allège 1 séance.' })
    } else if (sousCharge && s.sousChargeSoutenue === true && s.seances7 > 0 && !reposPrevu) {
      alertes.push({ type: 'sous_charge', severite: 'moyenne', message: 'Ton volume est bas depuis 2 semaines. Au-delà de 3 semaines, on commence à perdre en force ; 1 séance par semaine suffit à maintenir.' })
    }
  } else {
    if (surchargeN >= 2) alertes.push({ type: 'surcharge', severite: 'haute', message: 'Charge récente élevée' })
    else if (surchargeN === 1) alertes.push({ type: 'charge', severite: 'moyenne', message: 'Charge en hausse' })
    else if (sousCharge && s.seances7 > 0 && !reposPrevu) alertes.push({ type: 'sous_charge', severite: 'moyenne', message: 'Charge en baisse' })
  }
  const _zoneTxt = s.douleurZone ? ' (' + String(s.douleurZone).toLowerCase() + ')' : ''
  if (douleurForte) alertes.push({ type: 'douleur', severite: 'haute', message: 'Douleur forte signalée' + _zoneTxt })
  else if (douleurGene) alertes.push({ type: 'douleur', severite: 'moyenne', message: 'Douleur modérée signalée' + _zoneTxt })
  else if (douleurLegere) alertes.push({ type: 'douleur', severite: 'basse', message: 'Gêne légère signalée' + _zoneTxt })
  if (fatigueHaute) alertes.push({ type: 'fatigue', severite: 'moyenne', message: `Fatigue élevée (${Math.round(fat * 10) / 10}/5)` })
  if (sommeilBas) alertes.push({ type: 'sommeil', severite: 'moyenne', message: `Sommeil dégradé (${Math.round((som as number) * 10) / 10}/5)` })

  // --- Risque blessure (cumul de points) ---
  // Audit #3 : sous la règle « charge + ressenti », la charge seule ne fait pas de risque.
  const surchargeRisque = (regleRessenti && !(s.chargeSoutenue === true && s.ressentiDegrade === true)) ? 0 : surchargeN
  const rbPts = surchargeRisque + (douleurForte ? 2 : douleurGene ? 1 : 0) + (fatigueHaute ? 1 : 0) + (courb >= CORE_SEUILS.courbatures.haut ? 1 : 0)
  let risqueBlessureN = rbPts >= 3 ? 2 : rbPts >= 1 ? 1 : 0
  if (eff.risqueDelta) risqueBlessureN = clampNiv(risqueBlessureN + eff.risqueDelta)

  // --- Récupération (score bien-être) ---
  // Readiness = indice de Hooper : sommeil + fatigue + stress + courbatures (DOMS).
  // Items « invert » (fatigue/stress/courbatures) : 5 = mauvais → (6 - v)/5.
  const recArr: number[] = []
  if (som != null) recArr.push(som / 5)
  if (s.fatigue != null) recArr.push((6 - fat) / 5)
  if (s.stress != null) recArr.push((6 - str) / 5)
  if (s.courbatures != null) recArr.push((6 - courb) / 5)
  const recScore = recArr.length ? (recArr.reduce((a, b) => a + b, 0) / recArr.length) * 100 : null
  const recup = recScore == null ? '—' : recScore >= CORE_SEUILS.recup.bon ? 'Excellent' : recScore >= CORE_SEUILS.recup.moyen ? 'Bon' : recScore >= CORE_SEUILS.recup.faible ? 'Moyen' : 'Faible'

  // --- Niveau global (0/1/2) : UNE seule décision, partagée par les deux vues ---
  // Décision métier « récup faible » : ISOLÉE → Vigilance (orange). Rouge seulement
  // si elle s'accompagne d'un AUTRE signal concordant INDÉPENDANT de la récup
  // (charge élevée ou douleur — pas sommeil/fatigue qui SONT la cause de la récup).
  const recFaible = recScore != null && recScore < CORE_SEUILS.recup.faible
  const signalConcordant = chargeHaute || douleurGene              // indépendants de la récup
  const recFaibleConcordante = recFaible && signalConcordant
  // Calibrage sévérité : sous-charge et absence sont des signaux de charge BASSE /
  // régularité — ils restent des ALERTES (coach, reco) mais ne dégradent PAS la
  // disponibilité du jour (readiness). De plus, « récup moyenne » seule (<60) ne
  // suffit plus à passer en Vigilance : il faut « récup faible » (<45) ou un cumul.
  // RÈGLE CHARGE (demande porteur) : une CHARGE récente élevée SEULE — quand la
  // récupération est bonne — NE dégrade PAS le verdict du jour. Elle reste un
  // REPÈRE informatif (bullet + reco « ne surcharge pas »), pas une alerte. La
  // Vigilance vient des signaux de READINESS (fatigue, sommeil, récup faible,
  // douleur/gêne, courbatures, retour progressif), ou de la charge COMBINÉE à l'un
  // d'eux. => on exclut charge/surcharge (comme sous_charge/absence) du verdict.
  const courbHaute = s.courbatures != null && courb >= CORE_SEUILS.courbatures.haut
  const readinessFlag = fatigueHaute || sommeilBas || recFaible || douleurGene || courbHaute || s.injStatut === 'retour_progressif'
  const alertesEtat = alertes.filter(a => a.type !== 'sous_charge' && a.type !== 'absence' && a.type !== 'charge' && a.type !== 'surcharge' && a.severite !== 'basse')
  let niveau: number
  // RÈGLE DE SÉVÉRITÉ (demande porteur) : le ROUGE (niveau 2) est RÉSERVÉ à une
  // BLESSURE modérée/grave (ou indispo) ou une DOULEUR FORTE. Tout le reste —
  // fatigue/TSB, récupération, sommeil, combinaison de signaux — PLAFONNE à ORANGE
  // (Vigilance). La charge haute seule n'orange même plus : elle est informative.
  if (s.injStatut === 'indispo' || s.blessureGrave === true || douleurForte) niveau = 2
  else niveau = (alertesEtat.length > 0 || readinessFlag) ? 1 : 0
  if (eff.niveauMin != null && niveau < eff.niveauMin) niveau = eff.niveauMin
  if (confiance === 'non_interpretable') niveau = 0   // nouvel athlète : pas de fausse alerte

  // CAUSES du verdict (règle 6bis) : ce qui a RÉELLEMENT produit Vigilance / rouge,
  // affiché tel quel sous le verdict (avant : la cause, ex. une douleur, n'apparaissait pas).
  const causes: string[] = []
  if (niveau >= 1) {
    const _dz = s.douleurZone ? ' — ' + String(s.douleurZone).toLowerCase() : ''
    const _dd = s.douleurDate ? ' (' + String(s.douleurDate).slice(8, 10) + '/' + String(s.douleurDate).slice(5, 7) + ')' : ''
    if (s.injStatut === 'indispo') causes.push('Indisponible (blessure)')
    else if (s.blessureGrave === true) causes.push('Blessure en cours')
    if (douleurForte) causes.push('Douleur forte' + _dz + _dd)
    else if (douleurGene) causes.push('Douleur modérée' + _dz + _dd)
    if (fatigueHaute) causes.push('Fatigue élevée')
    if (sommeilBas) causes.push('Sommeil dégradé')
    if (recFaible) causes.push('Récupération faible')
    if (courbHaute) causes.push('Courbatures importantes')
    if (s.injStatut === 'retour_progressif') causes.push('Retour progressif de blessure')
    if (!causes.length && eff.niveauMin != null) causes.push('Contexte déclaré (' + ctx.replace(/_/g, ' ') + ')')
  }

  // --- Recommandation (explicable, non médicale) ---
  let reco: string
  if (s.injStatut === 'indispo') reco = 'Indisponible — poursuivre la réathlétisation.'
  else if (confiance === 'non_interpretable') reco = 'Données insuffisantes pour établir une tendance.'
  else if (douleurForte) reco = 'Douleur signalée — évaluer avant de charger.'
  else if (douleurGene) reco = 'Douleur modérée — adapte la charge sur la zone et surveille ; avis kiné si ça persiste.'
  else if (recFaibleConcordante) reco = 'Récupération faible + autre signal — alléger et surveiller de près.'
  else if (recFaible) reco = 'Récupération faible — vigilance, alléger si ça persiste.'
  else if (s.injStatut === 'retour_progressif') reco = 'Retour progressif — respecter la progressivité de charge.'
  // Charge élevée COMBINÉE à un signe de fatigue (→ Vigilance) : on allège.
  else if (chargeHaute && niveau === 1) reco = 'Charge récente élevée et un signe de fatigue — allège le volume et priorise la récupération.'
  // Charge élevée SEULE (récup bonne → Prêt) : repère informatif, pas un ordre.
  // Règle ressenti : on ne dit « tu encaisses bien » QUE si le ressenti a pu être évalué.
  else if (chargeHaute && regleRessenti && s.chargeSoutenue === true && s.ressentiDegrade === true) reco = 'Ta charge monte et tu récupères moins bien — allège 1 séance et priorise le sommeil.'
  else if (chargeHaute && regleRessenti && s.ressentiEvaluable === true && s.ressentiDegrade !== true) reco = 'Ta charge monte et tu encaisses bien — continue, sans empiler davantage de volume.'
  else if (chargeHaute && regleRessenti && s.ressentiEvaluable !== true && s.ressentiDegrade !== true) reco = 'Ta charge monte — renseigne ton état du jour pour qu\'on vérifie que tu récupères bien.'
  else if (chargeHaute) reco = 'Charge en forte hausse récemment — évite d\'empiler encore du volume ; si tu te sens frais, entraîne-toi normalement.'
  else if (niveau === 1) reco = 'Vigilance — surveiller les sensations, ne pas surcharger.'
  // Audit Aujourd'hui T2 (01/11) : absence ≥ 7 j → plus de « maintenir la charge » (contradictoire).
  else if (alertes.some(a => a.type === 'absence')) reco = 'Pas de séance depuis 7 jours ou plus : reprends une séance cette semaine pour relancer ta régularité.'
  else reco = 'RAS — maintenir la charge actuelle.'

  const donnees: string[] = []
  if (s.q.hasCharge) donnees.push('charge')
  if (s.q.wellnessN > 0) donnees.push('bien-être')
  if (s.injStatut) donnees.push('blessure')

  const out: any = {
    niveau,
    causes,
    statut: STA[niveau],
    disponibilite: { niveau: NIV[niveau] },   // couleur retirée (Phase 3B) → mapping front
    surchargeN, surcharge: ['Faible', 'Modéré', 'Élevé'][surchargeN],
    risqueBlessureN, risque_blessure: ['Faible', 'Modéré', 'Élevé'][risqueBlessureN],
    recScore, recup,
    alertes, confiance, reco,
    acwr_fiable: acwrOk,
    donnees_utilisees: donnees,
    contexte_tag: ctx !== 'saison_normale' ? ctx : null,
    signaux: { acwr: acwrOk ? s.acwr : null, douleur: s.douleur, fatigue: s.fatigue, sommeil: s.sommeil, stress: s.stress, courbatures: s.courbatures, seances7: s.seances7 },
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
    const j7 = fmtYMD(minus(now, 6))
    const j28 = fmtYMD(minus(now, 27))

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
    // Mutualisation (Étape 3) : MÊME helper que la fiche joueur (chargeFenetresFoot).
    // On groupe les lignes charge_interne par athlète, puis on réutilise le helper.
    // a.chargeParJour = série 28 j (val>0) → entrée ACWR ; seances7 = jours de charge 7 j.
    const rowsByAth: Record<string, any[]> = {}
    for (const row of indAll || []) { const id = String(row.athlete_id); if (athIds.has(id)) (rowsByAth[id] ||= []).push(row) }
    const parAth: Record<string, { charge7: number; charge28: number; seances7: Set<string>; derniere: string | null; premiere: string | null; chargeParJour: Record<string, number> }> = {}
    for (const id in rowsByAth) {
      const c = chargeFenetresFoot(rowsByAth[id], now)
      parAth[id] = { charge7: c.charge7, charge28: c.charge28, seances7: new Set(Object.keys(c.chargeParJour)), derniere: c.derniere, premiere: c.premiereCharge, chargeParJour: c.chargeParJour28 }
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
    const testsAth: Record<string, Record<string, { d: number; v: number }[]>> = {}
    for (const r of testAll || []) {
      const id = String(r.athlete_id)
      if (!athIds.has(id)) continue
      const dt = parseFR(r.date); if (!dt) continue
      ;(testsAth[id] ||= {})
      ;(testsAth[id][String(r.cle)] ||= []).push({ d: dt.getTime(), v: Number(r.valeur) })
    }
    const progressionAth = (id: string) => progressionAthlete(testsAth[id], SENS_TESTS)   // extrait PUR

    const resultats: any[] = []
    const nb: Record<string, number> = { vert: 0, orange: 0, rouge: 0 }
    let nbIndispo = 0
    const blesses: any[] = []
    const equipeItems: { charge7: number; fatigue: number | null; beScore: number | null; progression: string }[] = []

    for (const j of joueurs) {
      const a = parAth[j.athlete_id] || { charge7: 0, charge28: 0, seances7: new Set<string>(), derniere: null, premiere: null, chargeParJour: {} }
      const seances7 = a.seances7.size
      // ACWR — chaîne CENTRALE (foot = charge_interne), source unique.
      const acwrCalc = calculerACWR(a.chargeParJour, now)
      const acwr = acwrCalc.ratio
      const inj = injByAth[j.athlete_id] || null
      const histoDays = _joursDepuis(a.premiere, now)
      const acwrFiable = fiabiliteACWR(a.premiere, ctxObjOf(j.athlete_id), now, acwrCalc.joursActifs28, acwrCalc.joursActifsChronique)

      // Signaux agrégés (fenêtre 7 j) — MÊME agrégation que la fiche (_aggSignaux).
      const sig = _aggSignaux(beRawByAth[j.athlete_id] || [], now, 7)

      // >>> MOTEUR CENTRAL — statut, alertes, dispo, risque, récup, reco, confiance <<<
      const etat = evaluerEtatAthlete({
        acwr, acwrFiable, seances7,
        douleur: sig.douleur, douleurZone: sig.douleurZone, douleurDate: sig.douleurDate, fatigue: sig.fatigueVerdict, sommeil: sig.sommeilVerdict, stress: null, courbatures: null,
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
      const prog = progressionAth(j.athlete_id)
      const beScore = beScoreJoueur(sig)
      equipeItems.push({ charge7: a.charge7, fatigue: (sig.fatigueMoy != null ? sig.fatigueMoy : sig.fatigue), beScore, progression: prog })
      if (inj) { blesses.push({ athlete_id: j.athlete_id, nom: j.nom, poste: j.poste, type: inj.type, localisation: inj.localisation, statut: inj.statut, retour_terrain: inj.retour_terrain, retour_competition: inj.retour_competition }); if (inj.statut === 'indispo') nbIndispo++ }

      resultats.push({
        athlete_id: j.athlete_id, nom: j.nom, poste: j.poste, login: j.login || '',
        derniere_seance: a.derniere ? fmtFR(a.derniere) : null,
        seances_7j: seances7,
        charge_7j: Math.round(a.charge7),
        acwr,
        fatigue_moy: sig.fatigueMoy != null ? Math.round(sig.fatigueMoy * 10) / 10 : null,   // 06/11 : c'était le MAX sous le nom « moy »
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

    // Agrégats d'équipe + charge hebdo (8 sem.) — extraits PURS.
    const eqAgg = agregerEquipe(equipeItems)
    const chargeHebdo = chargeHebdoEquipe(indAll || [], athIds)

    return jsonResp({
      joueurs: resultats,
      equipe: {
        total: joueurs.length,
        vert: nb.vert, orange: nb.orange, rouge: nb.rouge,
        indispo: nbIndispo,
        charge_equipe: eqAgg.charge_equipe,
        fatigue_moyenne: eqAgg.fatigue_moyenne,
        bienetre_moyen: eqAgg.bienetre_moyen,
        en_progression: eqAgg.en_progression, en_regression: eqAgg.en_regression,
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
    const j7 = fmtYMD(minus(now, 6))
    const j14 = fmtYMD(minus(now, 13))
    const j28 = fmtYMD(minus(now, 27))

    const [{ data: ath }, { data: indAll }, { data: beAll }, { data: injAll }, { data: objAll }, { data: ctxAll }, { data: perfAll }] = await Promise.all([
      sb().from('athletes').select('*').eq('id', athleteId).single(),
      _toutLire(() => sb().from('indicateurs').select('*').eq('athlete_id', athleteId).order('id')),
      sb().from('bien_etre').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(60),
      sb().from('blessures').select('*').eq('athlete_id', athleteId),
      sb().from('objectifs').select('*').eq('athlete_id', athleteId),
      sb().from('contexte_athlete').select('*').eq('athlete_id', athleteId).order('date_debut', { ascending: false }),
      // Séances de renfo réalisées (exécution guidée côté joueur) — affichage seul,
      // ne compte pas dans l'ACWR foot (pas de charge_interne).
      _toutLire(() => sb().from('performances').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).order('id')),
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
    const wellDate: Record<string, number> = {}, bienetreI: Record<string, number> = {}

    for (const row of indAll || []) {
      const dIso = normDate(row.date); if (!dIso) continue
      const sid = String(row.seance_id), cle = String(row.cle)
      if (!seances[sid]) seances[sid] = { date: fmtFR(dIso), dateIso: dIso, cles: {} }
      seances[sid].cles[cle] = row.valeur
      if (WELL[cle] && row.valeur !== '' && row.valeur != null) {
        const t = (parseFR(dIso)?.getTime()) || 0
        if (!wellDate[cle] || t >= wellDate[cle]) { wellDate[cle] = t; bienetreI[cle] = Number(row.valeur) }
      }
    }

    // Fenêtres de charge interne (extrait PUR, iso-comportement).
    const { charge7, charge28, chargeParJour, chargeParJour28, premiereCharge, chargeParSem, semLundi } = chargeFenetresFoot(indAll || [], now)

    // ACWR — chaîne CENTRALE (foot = charge_interne), source unique.
    const acwrCalcF = calculerACWR(chargeParJour28, now)
    const acwr = acwrCalcF.ratio
    const chargeHebdo = Object.keys(chargeParSem).sort().slice(-6).map(w => ({
      semaine: w, charge: Math.round(chargeParSem[w]), label: semLundi[w] ? fmtFR(semLundi[w]).slice(0, 5) : w,
    }))

    const { monotonie, strain } = monotonieStrainFoot(chargeParJour, charge7, now)   // extrait PUR
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

    // Vrai total (toutes séances non-renfo) + liste récente (10 max) — extrait PUR.
    const { total: totalSeancesFoot, liste: listeSeances } = seancesFoot(seances, renfoIds)

    const gps = aggGpsFenetreFoot(seances, now, 7)   // extrait PUR (fenêtre 7 j)

    const { matchs, match_agg: matchAgg, match_stats: matchStats } = aggMatchsFoot(seances)   // extrait PUR
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
    const acwrFiableF = fiabiliteACWR(premiereCharge, contexte, now, acwrCalcF.joursActifs28, acwrCalcF.joursActifsChronique)
    const etat = evaluerEtatAthlete({
      acwr, acwrFiable: acwrFiableF, seances7: seances7f,
      douleur: sig7.douleur, douleurZone: sig7.douleurZone, douleurDate: sig7.douleurDate, fatigue: sig7.fatigueVerdict, sommeil: sig7.sommeilVerdict,
      stress: _n(bienetre.stress), courbatures: _n(bienetre.courbatures),
      injStatut: injActive ? (injActive.statut as any) : null,
      ctxEtat,
      q: { jours: histoDaysF != null ? histoDaysF : (charge7 > 0 || sig7.wellnessN > 0 ? 7 : 0), wellnessN: sig7.wellnessN, hasCharge: charge7 > 0 || charge28 > 0 },
    })
    const _ctxLabels: Record<string, string> = { deload: 'Déload', retour_vacances: 'Retour vacances', retour_blessure: 'Retour blessure', intensification: 'Intensification' }
    const moteur: any = {
      disponibilite: etat.disponibilite,
      surcharge: etat.surcharge, risque_blessure: etat.risque_blessure, recup: etat.recup,
      reco: etat.reco, confiance: etat.confiance, alertes: etat.alertes, causes: etat.causes,
      acwr_fiable: etat.acwr_fiable, acwr_categorie: etat.acwr_categorie,
      seuils_sante: seuilsSanteAPI(),   // Phase 4C-A : CORE_SEUILS → API → NovalyzEngine
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
      seances: listeSeances, total_seances: totalSeancesFoot, renfo_seances,
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
    // Comptes de démo : s2 (mot de passe de démo public ; 14 hachages lents d'un coup dépasseraient la limite de calcul).
    // Ils passent en w1 à leur première connexion (verifyPwd).
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
// 07/11 — Inscription : login disponible ? (athlète : 4 chiffres + proposition d'un login libre ;
// coach : identifiant libre). code_requis = booléen seul (jamais la valeur du secret BETA_INVITE_CODE).
async function handleLoginDispo(body: any): Promise<Response> {
  const login = String(body.login || '').trim()
  const code_requis = !!(Deno.env.get('BETA_INVITE_CODE') || '').trim()
  if (body.type === 'c') {
    if (!login) return jsonResp({ ok: true, valide: false, dispo: false, code_requis })
    const { data: ex } = await sb().from('coachs').select('coach_id').eq('login', login).maybeSingle()
    return jsonResp({ ok: true, valide: true, dispo: !ex, code_requis })
  }
  const { data: tous } = await sb().from('athletes').select('login')
  const pris = new Set((tous || []).map((r: any) => String(r.login || '')))
  let propose = ''
  for (let i = 0; i < 40 && !propose; i++) { const c = String(1000 + Math.floor(Math.random() * 9000)); if (!pris.has(c)) propose = c }
  if (!/^\d{4}$/.test(login)) return jsonResp({ ok: true, valide: false, dispo: false, propose, code_requis })
  return jsonResp({ ok: true, valide: true, dispo: !pris.has(login), propose: pris.has(login) ? propose : '', code_requis })
}
async function handleRegisterCoach(body: any): Promise<Response> {
  const login = body.login?.trim(), pwd = body.password?.trim(), nom = body.nom?.trim() || body.login, sport = body.sport || 'muscu'
  const role = STAFF_ROLES.includes(String(body.role || '')) ? String(body.role) : 'coach'
  const email = String(body.email || '').trim() || null
  if (!login || !pwd) return jsonResp({ success: false, error: 'Identifiant et mot de passe obligatoires.' })
  if (pwd.length < MDP_MIN) return jsonResp({ success: false, error: 'Mot de passe : 6 caractères minimum.' })   // C6
  // 07/11 : tout obligatoire côté serveur aussi.
  if (!body.nom || !String(body.nom).trim()) return jsonResp({ success: false, error: 'Indique ton nom.' })
  if (!email || !_emailValide(email)) return jsonResp({ success: false, error: 'E-mail invalide.' })
  if (!body.sport) return jsonResp({ success: false, error: 'Choisis ton sport.' })
  const { data: existing } = await sb().from('coachs').select('coach_id').eq('login', login).single()
  if (existing) return jsonResp({ success: false, error: 'Cet identifiant coach est déjà utilisé.' })
  const hash = await hashPourStockage(pwd, login)
  const { data: allCoachs } = await sb().from('coachs').select('coach_id')
  let maxCoach = 0
  for (const r of allCoachs || []) { const n = Number(r.coach_id); if (!isNaN(n) && n > maxCoach) maxCoach = n }
  const newId = String(maxCoach + 1)
  const { data, error } = await _insererAvecMotDePasse('coachs', { coach_id: newId, login, nom, email, sport, role }, hash)
  if (error) return jsonResp({ success: false, error: error.message })
  if (email) { try { await _envoyerMailCompte('c', String(data.coach_id), email, String(data.login), String(data.nom || ''), true) } catch (_) {} }   // C9
  return jsonResp({ success: true, coach: { coach_id: data.coach_id, nom: data.nom, email: data.email || '', email_verifie: false, sport: String(sport || '').trim() || 'muscu', role } })
}

async function handleSupprimerCompte(body: any): Promise<Response> {
  const athleteId = body.athlete_id
  if (!athleteId) return jsonResp({ success: false, error: 'athlete_id manquant' })
  // Audit Réglages R2 (01/11) : preuve que c'est bien l'athlète — ressaisie de SON mot de passe
  // (vérifié avec verifyPwd existant, hachage inchangé). La session coach est refusée dans authCheck.
  const mdp = _mdp(body.mdp)
  if (!mdp) return jsonResp({ success: false, error: 'Mot de passe requis pour supprimer le compte.' })
  const { data: athPwd } = await sb().from('athletes').select('login,password_hash').eq('id', athleteId).single()
  if (!athPwd) return jsonResp({ success: false, error: 'Compte introuvable' })
  const { ok: mdpOk } = await verifyPwd(mdp, (athPwd as any).password_hash || '', (athPwd as any).login)
  if (!mdpOk) return jsonResp({ success: false, error: 'Mot de passe incorrect.' })
  // Suppression COMPLÈTE des données personnelles (RGPD + exigence Play Store).
  // Chaque .delete() est tolérant : une table vide n'est pas une erreur.
  await Promise.all([
    sb().from('performances').delete().eq('athlete_id', athleteId),
    sb().from('bien_etre').delete().eq('athlete_id', athleteId),
    sb().from('programme').delete().eq('athlete_id', athleteId),
    sb().from('indicateurs').delete().eq('athlete_id', athleteId),
    sb().from('poids_historique').delete().eq('athlete_id', athleteId),
    sb().from('tests').delete().eq('athlete_id', athleteId),
    sb().from('commentaires').delete().eq('athlete_id', athleteId),
    sb().from('blessures').delete().eq('athlete_id', athleteId),
    sb().from('objectif').delete().eq('athlete_id', athleteId),
    sb().from('contexte_athlete').delete().eq('athlete_id', athleteId),
    sb().from('native_push_tokens').delete().eq('athlete_id', String(athleteId)),
    sb().from('password_reset_tokens').delete().eq('athlete_id', String(athleteId)),
    sb().from('google_health_tokens').delete().eq('athlete_id', String(athleteId)),
    // Tables oubliées jusqu'au 28/10/2026 (audit avant test fermé Play Store) :
    sb().from('notes').delete().eq('athlete_id', athleteId),
    sb().from('objectifs').delete().eq('athlete_id', athleteId),
    sb().from('activites').delete().eq('athlete_id', athleteId),
    sb().from('planning').delete().eq('athlete_id', athleteId),
    sb().from('pauses').delete().eq('athlete_id', athleteId),
    sb().from('push_subscriptions').delete().eq('athlete_id', athleteId),
    sb().from('alertes_historique').delete().eq('athlete_id', athleteId),
    sb().from('envois_recus').delete().eq('athlete_id', athleteId),
  ].map((q: any) => Promise.resolve(q).catch(() => null)))
  // Fichiers privés rangés sous le préfixe <athlete_id>/ : médias coach (photos/vidéos
  // de la conversation) ET photos de suivi corporel (face/profil/dos). On liste puis
  // on supprime, par lots (list() est paginé).
  for (const bucket of ['coach-media', 'suivi-photos']) {
    try {
      for (let guard = 0; guard < 50; guard++) {
        const { data: files } = await sb().storage.from(bucket).list(String(athleteId), { limit: 1000 })
        if (!files || !files.length) break
        await sb().storage.from(bucket).remove(files.map((f: any) => `${athleteId}/${f.name}`))
        if (files.length < 1000) break
      }
    } catch (_) { /* best-effort : pas de fichier ou bucket absent */ }
  }
  await sb().from('athletes').delete().eq('id', athleteId)
  return jsonResp({ success: true })
}

async function handleCoachCreerAthlete(body: any): Promise<Response> {
  const { coach_id, login, password, annees, strategie, ddn, taille, sexe } = body
  const nom = (body.prenom || body.nom || '').trim()
  if (!coach_id || !nom || !login || !password) return jsonResp({ success: false, error: 'Champs manquants' })
  // E-mail facultatif (récaps / notifs). Normalisé ; validé seulement s'il est fourni.
  const email = String(body.email || '').trim().toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResp({ success: false, error: 'E-mail invalide.' })
  const { data: existing } = await sb().from('athletes').select('id').eq('login', login).single()
  if (existing) return jsonResp({ success: false, error: 'Ce login est déjà utilisé.' })
  const hash = await hashPourStockage(password, login)
  const { data: coach } = await sb().from('coachs').select('sport').eq('coach_id', coach_id).single()
  const newId = await nextAthleteId()
  const { data, error } = await _insererAvecMotDePasse('athletes', { id: newId, login, nom, coach_id, sport: coach?.sport || 'muscu', annees: annees || 0, strategie: strategie || '', ddn: ddn || null, taille: taille || null, sexe: sexe || null, email: email || null }, hash)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true, id: data.id, nom: data.nom })
}

// Reset du mot de passe d'un athlète PAR SON COACH (Option C). Ne remplace que
// password_hash, via le même hachage qu'à la création (hashSalted, salt = login).
// Sécurité : le coach ne peut réinitialiser QUE ses propres athlètes
// (athletes.coach_id === coach_id). Aucune écriture si un contrôle échoue ;
// message générique « Accès refusé » (anti-énumération, pas de fuite de données).
async function handleCoachResetAthlete(body: any): Promise<Response> {
  const coach_id = String(body.coach_id || '')
  const athlete_id = String(body.athlete_id || '')
  const nouveau_mdp = _mdp(body.nouveau_mdp)
  if (!coach_id || !athlete_id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  if (!nouveau_mdp || nouveau_mdp.length < 6) return jsonResp({ success: false, error: 'Mot de passe : 6 caractères minimum.' })

  const { data: coach } = await sb().from('coachs').select('coach_id').eq('coach_id', coach_id).single()
  if (!coach) return jsonResp({ success: false, error: 'Accès refusé' })

  const { data: ath } = await sb().from('athletes').select('id,login,coach_id').eq('id', athlete_id).single()
  if (!ath || String(ath.coach_id) !== String(coach_id)) return jsonResp({ success: false, error: 'Accès refusé' })

  const hash = await hashPourStockage(nouveau_mdp, ath.login)
  const { error } = await _majMotDePasse('athletes', 'id', String(ath.id), hash)
  if (error) return jsonResp({ success: false, error: error.message })
  await _invaliderTokensReset(String(ath.id))   // le reset coach annule les liens email actifs de l'athlète
  await _revoquerSessions('a', String(ath.id))   // C8 : l'athlète est déconnecté de ses appareils
  return jsonResp({ success: true })
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

// ── Anti-doublon des envois de séance (10/11/2026, audit P1 étape 1) ─────────
// Table envois_recus, contrainte UNIQUE (athlete_id, envoi_id) : le serveur RÉSERVE l'envoi
// avant d'écrire la séance → deux requêtes simultanées avec le même envoi_id : une seule gagne.
//   'nouveau'   : réservé par CETTE requête → on écrit la séance ;
//   'deja_recu' : séance déjà écrite (statut ok) → réponse « déjà reçu », rien de réécrit ;
//   'en_cours'  : une autre requête l'écrit en ce moment → erreur temporaire : l'app garde la
//                 séance en file et réessaie (rien n'est perdu, rien n'est doublé) ;
//   'ancien'    : table absente (migration pas appliquée) → ancien mécanisme (indicateurs).
// Réservation restée 'en_cours' plus de 3 min (serveur interrompu) → reprise atomique.
// Règle de priorité : la nouvelle table fait foi ; l'ancien marqueur d'indicateurs n'est lu
// que si rien n'existe dans la nouvelle (et il est encore écrit pendant la transition).
const ENVOI_EN_COURS_MAX_MS = 3 * 60 * 1000
async function _reserverEnvoi(aid: string, envoi: string, seanceId: string | null, date: string | null): Promise<'nouveau' | 'deja_recu' | 'en_cours' | 'ancien'> {
  const ins = await sb().from('envois_recus').insert({ athlete_id: aid, envoi_id: envoi, seance_id: seanceId, date, statut: 'en_cours' })
  if (!ins.error) return 'nouveau'
  if (String((ins.error as any).code || '') !== '23505') return 'ancien'
  const { data: ex } = await sb().from('envois_recus').select('statut,updated_at').eq('athlete_id', aid).eq('envoi_id', envoi).maybeSingle()
  if (ex && (ex as any).statut === 'ok') return 'deja_recu'
  if (ex && new Date((ex as any).updated_at).getTime() < Date.now() - ENVOI_EN_COURS_MAX_MS) {
    const limite = new Date(Date.now() - ENVOI_EN_COURS_MAX_MS).toISOString()
    const { data: rep } = await sb().from('envois_recus').update({ updated_at: new Date().toISOString() })
      .eq('athlete_id', aid).eq('envoi_id', envoi).eq('statut', 'en_cours').lt('updated_at', limite).select('athlete_id')
    if (rep && (rep as any[]).length) return 'nouveau'
  }
  return 'en_cours'
}
async function _ancienMarqueurEnvoi(aid: string, envoi: string): Promise<boolean> {
  const { data: deja } = await sb().from('indicateurs').select('seance_id').eq('athlete_id', aid).eq('cle', 'envoi_id').eq('valeur', envoi).limit(1)
  return !!(deja && deja.length)
}
async function _finEnvoi(aid: string, envoi: string, ok: boolean): Promise<void> {
  try {
    if (ok) await sb().from('envois_recus').update({ statut: 'ok', updated_at: new Date().toISOString() }).eq('athlete_id', aid).eq('envoi_id', envoi)
    else await sb().from('envois_recus').delete().eq('athlete_id', aid).eq('envoi_id', envoi).eq('statut', 'en_cours')
  } catch (_) { /* best-effort : en cas d'échec, la réservation expire après 3 min */ }
}

async function handleSaveSeance(data: any[], saisiParCoach?: any, envoiId?: any): Promise<Response> {
  if (!data?.length) return jsonResp({ erreur: 'Données manquantes' })
  // Envoi déjà reçu (même identifiant) → on ne réécrit pas : protège d'un double enregistrement
  // quand le réseau coupe après l'écriture et que l'app renvoie depuis sa file d'attente (01/11),
  // ou quand deux envois partent en même temps (10/11 : réservation atomique, voir _reserverEnvoi).
  const _envoi = String(envoiId || '').trim().slice(0, 100)
  const _aid0 = String((data[0] || [])[4] || '')
  let _reserve = false
  if (_envoi && _aid0) {
    const etat = await _reserverEnvoi(_aid0, _envoi, String((data[0] || [])[2] || '') || null, normDate((data[0] || [])[0]) || null)
    if (etat === 'deja_recu') return jsonResp({ success: true, deja_recu: true })
    if (etat === 'en_cours') return jsonResp({ erreur: 'Envoi déjà en cours de traitement, nouvel essai automatique.', en_cours: true })
    if (await _ancienMarqueurEnvoi(_aid0, _envoi)) {          // reçu avant la migration (ancien marqueur)
      if (etat === 'nouveau') await _finEnvoi(_aid0, _envoi, true)
      return jsonResp({ success: true, deja_recu: true })
    }
    _reserve = etat === 'nouveau'
  }

  // data = array of arrays: [date, semaine, seance_id, nom, athlete_id, exercice, muscle, exercice_id, serie, charge, reps, rpe, repos, volume]
  // colonnes numériques → coercition ('' / NaN → null) sinon Postgres rejette tout l'insert
  const num = (v: any) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v)
  const rows = data.map((r: any[]) => ({
    date: normDate(r[0]) || r[0], semaine: num(r[1]), seance_id: r[2], nom: r[3], athlete_id: String(r[4]),
    exercice: r[5], muscle: r[6], exercice_id: r[7] != null ? String(r[7]) : null, serie: num(r[8]),
    charge: num(r[9]), reps: num(r[10]), rpe: num(r[11]), repos: num(r[12]), volume: num(r[13]),
  }))
  // H2 (audit hors-ligne 02/11) : séance saisie sans catalogue (app démarrée hors-ligne) → muscle
  // et identifiant d'exercice complétés depuis le catalogue (sinon volume par muscle faux).
  const sansMuscle = [...new Set(rows.filter((r: any) => !String(r.muscle || '').trim() && r.exercice).map((r: any) => String(r.exercice)))]
  if (sansMuscle.length) {
    try {
      const { data: cat } = await sb().from('exercices').select('exercice,muscle,exercice_id')
      const key = (t: any) => String(t || '').trim().toLowerCase()
      const byNom: Record<string, any> = {}; for (const c of (cat || [])) byNom[key((c as any).exercice)] = c
      for (const r of rows as any[]) {
        if (String(r.muscle || '').trim()) continue
        const c = byNom[key(r.exercice)]
        if (c) { r.muscle = c.muscle; if (!r.exercice_id || r.exercice_id === String(r.exercice)) r.exercice_id = String(c.exercice_id) }
      }
    } catch (_) {}
  }

  const { error: perfError } = await sb().from('performances').insert(rows)
  if (perfError) { if (_reserve) await _finEnvoi(_aid0, _envoi, false); return jsonResp({ erreur: perfError.message }) }
  if (_reserve) await _finEnvoi(_aid0, _envoi, true)   // séance écrite → envoi confirmé (avant les agrégats)

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

  // Saisie en présentiel PAR LE COACH (décision 30/10) : la séance compte dès que le coach
  // valide ; on garde la trace « saisie par ton coach » (affichée côté athlète).
  const coachSaisie = String(saisiParCoach || '').trim()
  if (coachSaisie) {
    for (const [sid, s] of Object.entries(seanceMap) as [string, any][]) {
      indicRows.push({ date: s.date, athlete_id: s.athlete_id, seance_id: sid, source: 'coach', cle: 'saisi_par', valeur: 'coach:' + coachSaisie, unite: '' })
    }
  }

  if (_envoi) { const s0 = Object.keys(seanceMap)[0]; if (s0) indicRows.push({ date: seanceMap[s0].date, athlete_id: seanceMap[s0].athlete_id, seance_id: s0, source: 'app', cle: 'envoi_id', valeur: _envoi, unite: '' }) }
  if (indicRows.length) await sb().from('indicateurs').insert(indicRows)
  if (coachSaisie) {
    const aid = String(rows[0]?.athlete_id || '')
    const sids = Object.keys(seanceMap).join(', ')
    if (aid) await notifyAthlete(aid, { title: 'Ton coach a enregistré ta séance', body: (sids ? sids + ' · ' : '') + 'tu peux ajouter ton ressenti dans l\'app.', tag: 'novalyz-saisie-coach', target: 'accueil' }).catch(() => {})
  }
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
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@novalyz.fr', pub, priv)
    _vapidReady = true
  } catch (_) { _vapidReady = false }
  return _vapidReady
}

// Envoie une notif push à tous les abonnements d'un athlète. Best-effort :
// n'échoue jamais l'appelant, et purge les abonnements morts (404/410).
async function sendPushToAthlete(athlete_id: string, payload: Record<string, unknown>): Promise<number> {
  if (!_vapidInit()) return 0
  const { data: subs } = await sb().from('push_subscriptions').select('*').eq('athlete_id', String(athlete_id))
  if (!subs?.length) return 0
  const body = JSON.stringify(payload)
  let ok = 0
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)
      ok++
    } catch (err: any) {
      const code = err && (err.statusCode || err.status)
      if (code === 404 || code === 410) { try { await sb().from('push_subscriptions').delete().eq('endpoint', s.endpoint) } catch (_) {} }
    }
  }))
  return ok
}

async function handleSavePushSub(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const endpoint = String(body.endpoint || '')
  const p256dh = String(body.p256dh || '')
  const auth = String(body.auth || '')
  if (!athlete_id || !endpoint || !p256dh || !auth) return jsonResp({ success: false, error: 'Paramètres manquants' })
  // Sécurité (audit P2.1, 11/11) : le propriétaire vient de la SESSION (athlète : son id ; coach :
  // « coach:<id> », COACH_PUSH_PREFIX), jamais de l'app. Avant : upsert sur l'endpoint → n'importe quel
  // compte réattribuait à son nom l'abonnement d'un autre, et un coach pouvait s'abonner sous l'id de son athlète.
  const sid = String(body._sessId || '')
  if (!sid) return jsonResp({ success: false, error: 'Session requise' })
  const proprio = body._sessRole === 'c' ? COACH_PUSH_PREFIX + sid : sid
  if (athlete_id !== proprio) return jsonResp({ success: false, error: 'Abonnement non autorisé pour ce compte.' })
  const user_agent = String(body.user_agent || ''), created_at = new Date().toISOString()
  // 1) Adresse nouvelle → insertion. 2) Adresse déjà connue → mise à jour SEULEMENT si elle est à ce compte
  // (filtre sur le propriétaire dans la même requête : pas de lecture puis écriture). 3) Sinon : refus, rien ne change.
  const { error: eIns } = await sb().from('push_subscriptions').insert({ athlete_id: proprio, endpoint, p256dh, auth, user_agent, created_at })
  if (!eIns) return jsonResp({ success: true })
  if (String((eIns as any).code || '') !== '23505' && !/duplicate|unique/i.test(String(eIns.message || ''))) return jsonResp({ success: false, error: eIns.message })
  const { data: maj, error: eMaj } = await sb().from('push_subscriptions').update({ p256dh, auth, user_agent, created_at }).eq('endpoint', endpoint).eq('athlete_id', proprio).select('id')
  if (eMaj) return jsonResp({ success: false, error: eMaj.message })
  if (!maj || !maj.length) return jsonResp({ success: false, error: 'Cet appareil reçoit déjà les notifications d’un autre compte. Désactive-les d’abord sur cet autre compte.' })
  return jsonResp({ success: true })
}

async function handleDeletePushSub(body: any): Promise<Response> {
  const endpoint = String(body.endpoint || '')
  if (!endpoint) return jsonResp({ success: false, error: 'endpoint manquant' })
  // Sécurité (audit P2.1, 11/11) : on ne supprime que l'abonnement de la personne connectée
  // (athlète : son id ; coach : « coach:<id> », COACH_PUSH_PREFIX). Sans session : rien.
  const proprio = body._sessRole === 'c' ? COACH_PUSH_PREFIX + String(body._sessId || '') : String(body._sessId || '')
  if (!body._sessId) return jsonResp({ success: true })
  const { error } = await sb().from('push_subscriptions').delete().eq('endpoint', endpoint).eq('athlete_id', proprio)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

// ── Notifications natives (FCM HTTP v1) ───────────────────────────────────────
// Transport pour l'app Android (Capacitor). Indépendant du Web Push (VAPID) :
// stockage séparé (native_push_tokens), envoi via l'API FCM HTTP v1 authentifiée
// par un compte de service (secret Supabase FCM_SERVICE_ACCOUNT, jamais au front).
// La logique métier « quoi/quand notifier » ne change pas : seul le transport
// s'ajoute, en parallèle du Web Push (voir notifyAthlete).
let _fcmSa: any = null
function _fcmServiceAccount(): any {
  if (_fcmSa !== null) return _fcmSa
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!raw) { _fcmSa = false; return false }
  try {
    const sa = JSON.parse(raw)
    _fcmSa = (sa && sa.client_email && sa.private_key && sa.project_id) ? sa : false
  } catch (_) { _fcmSa = false }
  return _fcmSa
}

function _b64url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function _b64urlStr(str: string): string { return _b64url(new TextEncoder().encode(str)) }
function _pemToDer(pem: string): Uint8Array {
  const b64 = String(pem).replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const der = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i)
  return der
}

// Jeton d'accès OAuth2 (Google) obtenu via JWT signé par le compte de service.
// Mis en cache jusqu'à ~1 min avant expiration.
let _fcmTokenCache: { token: string, exp: number } | null = null
async function _getFcmAccessToken(sa: any): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)
  if (_fcmTokenCache && _fcmTokenCache.exp > now + 60) return _fcmTokenCache.token
  try {
    const header = { alg: 'RS256', typ: 'JWT' }
    const claim = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }
    const signingInput = _b64urlStr(JSON.stringify(header)) + '.' + _b64urlStr(JSON.stringify(claim))
    const key = await crypto.subtle.importKey('pkcs8', _pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)))
    const jwt = signingInput + '.' + _b64url(sig)
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt),
    })
    const j = await resp.json()
    if (!j || !j.access_token) return null
    _fcmTokenCache = { token: j.access_token, exp: now + (Number(j.expires_in) || 3600) }
    return j.access_token
  } catch (_) { return null }
}

// Envoie une notif FCM à tous les tokens natifs d'un athlète. Best-effort :
// n'échoue jamais l'appelant, purge les tokens morts (404 / UNREGISTERED).
async function sendFcmToAthlete(athlete_id: string, payload: Record<string, unknown>): Promise<{ sent: number, found: number, error?: string }> {
  const sa = _fcmServiceAccount()
  if (!sa) return { sent: 0, found: 0, error: 'fcm-sa-absent' }
  const { data: toks } = await sb().from('native_push_tokens').select('*').eq('athlete_id', String(athlete_id))
  if (!toks?.length) return { sent: 0, found: 0 }
  const access = await _getFcmAccessToken(sa)
  if (!access) return { sent: 0, found: toks.length, error: 'fcm-auth' }
  const url = 'https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send'
  let sent = 0
  await Promise.all(toks.map(async (t: any) => {
    const message = {
      token: t.token,
      notification: { title: String(payload.title || 'Novalyz'), body: String(payload.body || '') },
      data: { target: String(payload.target || ''), url: String(payload.url || './') },
    }
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + access, 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) })
      if (r.ok) { sent++; return }
      let txt = ''
      try { txt = await r.text() } catch (_) {}
      if (r.status === 404 || /UNREGISTERED|NOT_FOUND/.test(txt)) {
        try { await sb().from('native_push_tokens').delete().eq('token', t.token) } catch (_) {}
      }
    } catch (_) {}
  }))
  return { sent, found: toks.length }
}

// Notifie un athlète sur TOUS ses canaux (Web Push + FCM), chacun best-effort et
// indépendant. Point d'entrée unique des notifications métier.
async function notifyAthlete(athlete_id: string, payload: Record<string, unknown>): Promise<number> {
  // Retourne le nombre d'envois ACCEPTÉS (FCM + Web Push) → le cron ne compte « envoyée » que si > 0 (N1).
  const r = await Promise.all([
    sendPushToAthlete(athlete_id, payload).catch(() => 0),
    sendFcmToAthlete(athlete_id, payload).then((x) => x.sent).catch(() => 0),
  ])
  return (Number(r[0]) || 0) + (Number(r[1]) || 0)
}

// Notifie un COACH. Les tokens du coach sont stockés dans les MÊMES tables push
// que les athlètes, sous un identifiant namespacé `coach:<coach_id>` (athlete_id
// est un simple text sans FK) → on réutilise toute la plomberie sans schéma dédié.
const COACH_PUSH_PREFIX = 'coach:'
// 09/11/2026 — Comptes de DÉMO / TEST (colonne is_demo sur athletes et coachs, voir
// supabase/migrations/20261109170000_is_demo.sql) : exclus des envois AUTOMATIQUES (alertes
// push du matin, résumés e-mail) et des futures statistiques. Les actions faites à la main dans
// l'app (message du coach, etc.) restent normales. Si la colonne n'existe pas encore (migration
// pas appliquée), rien n'est exclu et rien ne casse.
async function _comptesDemo(): Promise<{ ath: Set<string>; coach: Set<string> }> {
  const ath = new Set<string>(), coach = new Set<string>()
  try {
    const [{ data: a, error: ea }, { data: c, error: ec }] = await Promise.all([
      sb().from('athletes').select('id').eq('is_demo', true),
      sb().from('coachs').select('coach_id').eq('is_demo', true),
    ])
    if (!ea) for (const r of (a || []) as any[]) ath.add(String(r.id))
    if (!ec) for (const r of (c || []) as any[]) coach.add(String(r.coach_id))
  } catch (_) { /* colonne absente : aucune exclusion */ }
  return { ath, coach }
}
async function notifyCoach(coach_id: string, payload: Record<string, unknown>): Promise<number> {
  if (!coach_id) return 0
  return await notifyAthlete(COACH_PUSH_PREFIX + coach_id, payload)
}


// ══════════ Réglages coach (écran 9, 05/11) ══════════
// coachs.prefs (jsonb, migration coachs_prefs) : notif, groupes, defauts, resume_dernier.
const COACH_NOTIF_DEFAUT: Record<string, boolean> = { messages: true, douleur: true, resume: true, chaque: false, calme: true }
const COACH_DEFAUTS_DEFAUT = { novalyz_athlete: false, semaine_type: 'calendaire' }
const _coachPrefsCache: Record<string, any> = {}
async function _coachPrefs(coachId: string): Promise<any> {
  const out: any = { notif: { ...COACH_NOTIF_DEFAUT }, groupes: [], defauts: { ...COACH_DEFAUTS_DEFAUT }, resume_dernier: '' }
  if (!coachId) return out
  try {
    const { data, error } = await sb().from('coachs').select('prefs').eq('coach_id', coachId).single()
    const pr: any = (!error && data && (data as any).prefs) || {}
    if (pr.notif && typeof pr.notif === 'object') for (const k of Object.keys(COACH_NOTIF_DEFAUT)) if (typeof pr.notif[k] === 'boolean') out.notif[k] = pr.notif[k]
    if (Array.isArray(pr.groupes)) out.groupes = pr.groupes
    if (pr.defauts && typeof pr.defauts === 'object') out.defauts = { ...out.defauts, ...pr.defauts }
    out.resume_dernier = String(pr.resume_dernier || '')
  } catch (_) {}
  return out
}
async function _coachPrefsEcrire(coachId: string, patch: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await sb().from('coachs').select('prefs').eq('coach_id', coachId).single()
  if (error) return error.message
  const cur = ((data as any) && (data as any).prefs) || {}
  const { error: e2 } = await sb().from('coachs').update({ prefs: { ...cur, ...patch } }).eq('coach_id', coachId)
  return e2 ? e2.message : null
}
// Heure de Paris (heures calmes 22 h – 7 h).
function _heureParis(d: Date): number { try { return Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).format(d)) } catch (_) { return d.getUTCHours() + 1 } }
function _heuresCalmes(prefs: any, d = new Date()): boolean { if (!prefs || !prefs.notif || !prefs.notif.calme) return false; const h = _heureParis(d); return h >= 22 || h < 7 }
async function handleGetCoachPrefs(params: URLSearchParams): Promise<Response> {
  const coachId = String(params.get('coach_id') || '')
  if (!coachId) return jsonResp({ success: false, error: 'coach_id manquant' })
  const pr = await _coachPrefs(coachId)
  // Téléphone coach enregistré ? (notifications natives ou web)
  let tel = false
  try {
    const [{ data: n }, { data: w }] = await Promise.all([
      sb().from('native_push_tokens').select('athlete_id').eq('athlete_id', COACH_PUSH_PREFIX + coachId).limit(1),
      sb().from('push_subscriptions').select('athlete_id').eq('athlete_id', COACH_PUSH_PREFIX + coachId).limit(1),
    ])
    tel = !!((n && n.length) || (w && w.length))
  } catch (_) {}
  return jsonResp({ success: true, notif: pr.notif, groupes: pr.groupes, defauts: pr.defauts, telephone: tel })
}
async function handleSaveCoachPref(body: any): Promise<Response> {
  const coachId = String(body.coach_id || ''), cle = String(body.cle || ''), v = body.valeur
  if (!coachId) return jsonResp({ success: false, error: 'coach_id manquant' })
  if (body._sessRole && body._sessRole !== 'c') return jsonResp({ success: false, error: 'Réservé au coach' })
  let val: any = null
  if (cle === 'notif') {
    val = {}; for (const k of Object.keys(COACH_NOTIF_DEFAUT)) val[k] = !!(v && v[k])
  } else if (cle === 'defauts') {
    val = { novalyz_athlete: !!(v && v.novalyz_athlete), semaine_type: (v && v.semaine_type === 'glissant') ? 'glissant' : 'calendaire' }
  } else if (cle === 'groupes') {
    if (!Array.isArray(v) || v.length > 30) return jsonResp({ success: false, error: 'Groupes invalides' })
    const { data: mine } = await sb().from('athletes').select('id').eq('coach_id', coachId)
    const ok = new Set((mine || []).map((r: any) => String(r.id)))
    val = v.map((g: any) => ({ nom: String((g && g.nom) || '').trim().slice(0, 40), ids: [...new Set(((g && g.ids) || []).map(String))].filter((id: string) => ok.has(id)).slice(0, 300) })).filter((g: any) => g.nom)
  } else return jsonResp({ success: false, error: 'Réglage inconnu' })
  const err = await _coachPrefsEcrire(coachId, { [cle]: val })
  return err ? jsonResp({ success: false, error: err }) : jsonResp({ success: true, valeur: val })
}
// ══════════ Préférences ATHLÈTE (10/11/2026, audit P1 étape 2) ══════════
// Source principale : athletes.prefs (jsonb, valeurs TYPÉES), comme coachs.prefs.
// Avant : une ligne indicateurs par préférence (seance_id 'pref', valeur texte).
// Lecture (règle de priorité) : la clé PRÉSENTE dans athletes.prefs fait foi ; l'ancienne ligne
// indicateurs n'est lue que si la clé est absente de prefs (secours de transition).
// Écriture : fusion ATOMIQUE dans athletes.prefs (fonction SQL athlete_prefs_merge) ; plus aucune
// écriture dans indicateurs, sauf si la migration n'est pas encore appliquée (fonction absente) :
// on écrit alors dans l'ancien stockage, pour que rien ne casse.
// Hors périmètre (pas des préférences, restent dans indicateurs) : prog_maj, coach_demande.
const PREFS_ATHLETE_CLES = ['semaine_type', 'onboarding_vu', 'prog_auto_off', 'novalyz_athlete', 'zones_prio', 'exo_categories', 'muscles_exclus']
// Ancienne valeur texte (indicateurs) → valeur typée (athletes.prefs). undefined = illisible.
function _prefDepuisAncien(cle: string, valeur: unknown): unknown {
  const t = String(valeur ?? '')
  if (cle === 'semaine_type') return t === 'glissant' ? 'glissant' : 'calendaire'
  if (cle === 'onboarding_vu' || cle === 'prog_auto_off' || cle === 'novalyz_athlete') return t === '1'
  try {
    const o = JSON.parse(t)
    if (cle === 'zones_prio' || cle === 'muscles_exclus') return Array.isArray(o) ? o : undefined
    if (cle === 'exo_categories') return (o && typeof o === 'object' && !Array.isArray(o)) ? o : undefined
  } catch (_) { return undefined }
  return undefined
}
// Valeur typée → ancien texte (utilisé seulement si la migration n'est pas appliquée).
function _prefVersAncien(cle: string, v: unknown): string {
  if (cle === 'onboarding_vu' || cle === 'prog_auto_off' || cle === 'novalyz_athlete') return v === true ? '1' : '0'
  if (cle === 'semaine_type') return v === 'glissant' ? 'glissant' : 'calendaire'
  return JSON.stringify(v)
}
// Préférences lues : { clé: valeur typée } pour les clés connues (absente = jamais réglée).
// prefRows = lignes indicateurs 'pref' triées de la plus récente à la plus ancienne.
function _prefsAthleteLues(prefsNeuf: unknown, prefRows: any[] | null | undefined): Record<string, unknown> {
  const neuf: Record<string, unknown> = (prefsNeuf && typeof prefsNeuf === 'object' && !Array.isArray(prefsNeuf)) ? prefsNeuf as Record<string, unknown> : {}
  const out: Record<string, unknown> = {}
  for (const cle of PREFS_ATHLETE_CLES) {
    if (Object.prototype.hasOwnProperty.call(neuf, cle)) { out[cle] = neuf[cle]; continue }
    const r = (prefRows || []).find((x: any) => x.cle === cle)
    if (r) { const v = _prefDepuisAncien(cle, r.valeur); if (v !== undefined) out[cle] = v }
  }
  return out
}
async function _prefAncienEcrire(aid: string, cle: string, valeur: string, source: string): Promise<string | null> {
  const { data: ex } = await sb().from('indicateurs').select('date').eq('athlete_id', aid).eq('seance_id', 'pref').eq('cle', cle).limit(1)
  const { error } = (ex && ex.length)
    ? await sb().from('indicateurs').update({ valeur, date: fmtYMD(new Date()) }).eq('athlete_id', aid).eq('seance_id', 'pref').eq('cle', cle)
    : await sb().from('indicateurs').insert({ athlete_id: aid, date: fmtYMD(new Date()), seance_id: 'pref', cle, valeur, unite: '', source })
  return error ? error.message : null
}
// Écrit des préférences (patch partiel, valeurs typées). Renvoie un message d'erreur ou null.
async function _prefsAthleteEcrire(aid: string, patch: Record<string, unknown>, source = 'app'): Promise<string | null> {
  const { error } = await sb().rpc('athlete_prefs_merge', { p_athlete_id: aid, p_patch: patch })
  if (!error) return null
  const code = String((error as any).code || '')
  // Migration pas encore appliquée (fonction ou colonne inconnue) → ancien stockage.
  if (['PGRST202', '42883', '42703', 'PGRST204'].includes(code)) {
    for (const [cle, v] of Object.entries(patch)) { const e = await _prefAncienEcrire(aid, cle, _prefVersAncien(cle, v), source); if (e) return e }
    return null
  }
  return error.message
}
// Défauts du coach appliqués quand un athlète accepte son suivi (P7).
async function _appliquerDefautsCoach(coachId: string, aid: string): Promise<void> {
  try {
    const pr = await _coachPrefs(coachId)
    const patch: Record<string, unknown> = {}
    if (pr.defauts.novalyz_athlete) patch.novalyz_athlete = true
    if (pr.defauts.semaine_type === 'glissant') patch.semaine_type = 'glissant'
    if (Object.keys(patch).length) await _prefsAthleteEcrire(aid, patch, 'coach')
  } catch (_) { /* best-effort */ }
}
// Notification immédiate au coach (douleur forte), selon ses réglages + heures calmes. 1 par athlète et par jour.
async function _notifCoachDouleur(aid: string, niv: number, zone: string): Promise<void> {
  try {
    const { data: aRow } = await sb().from('athletes').select('coach_id,nom').eq('id', aid).single()
    const cId = aRow && (aRow as any).coach_id ? String((aRow as any).coach_id) : ''
    if (!cId) return
    const pr = await _coachPrefs(cId)
    if (!pr.notif.douleur || _heuresCalmes(pr)) return
    const ckey = 'c|' + cId + '|douleur_imm|' + fmtYMD(new Date())
    const { data: deja } = await sb().from('indicateurs').select('date').eq('athlete_id', aid).eq('seance_id', 'alerte_push_coach').eq('cle', ckey).limit(1)
    if (deja && deja.length) return
    const who = String((aRow as any).nom || 'Ton athlète').trim().split(/\s+/)[0]
    const n = await notifyCoach(cId, { title: '⚠️ ' + who + ' · douleur ' + niv + '/5' + (zone ? ' (' + zone + ')' : ''), body: 'Signalée à l\'instant. Ouvre sa fiche pour adapter la suite.', tag: 'novalyz-coach-douleur', target: 'coach' })
    if (n > 0) await sb().from('indicateurs').insert({ athlete_id: aid, date: fmtYMD(new Date()), seance_id: 'alerte_push_coach', cle: ckey, valeur: '1', unite: '', source: 'app' })
  } catch (_) {}
}
// Séances PRÉVUES faites depuis lunIso, séances libres rattachées comprises — MÊME règle que l'app
// (_rattachements / _faitesPeriode, js/app.js) : 1) séance du programme faite ; 2) séance libre rattachée
// explicitement (indicateur « rattache », sauf « __plus__ ») ; 3) sinon rattachement automatique à la séance
// prévue non encore faite qui partage ≥ 50 % de ses exercices (la plus proche), dans l'ordre des dates.
// 07/11 : avant, le résumé coach ignorait les rattachements → « 3 séances en retard » alors que 2 avaient
// été faites en séance libre.
function _faitesSemaineRatt(data: any, lunIso: string): Set<string> {
  const key = (x: any) => String(x || '').trim().toLowerCase()
  const ordre: string[] = [], exos: Record<string, string[]> = {}
  for (const p of ((data && data.programme) || [])) {
    if (!p || !p.seance_id || p.type === 'cardio') continue
    const sid = String(p.seance_id)
    if (!exos[sid]) { ordre.push(sid); exos[sid] = [] }
    if (p.exercice) exos[sid].push(key(p.exercice))
  }
  const estProg: Record<string, boolean> = {}; ordre.forEach((o) => { estProg[key(o)] = true })
  const sds = ((data && data.seances_detail) || []).filter((x: any) => x && x.date && x.date >= lunIso && x.seance_id != null)
    .slice().sort((a: any, b: any) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  const faites = new Set<string>()
  for (const x of sds) if (estProg[key(x.seance_id)] || !ordre.length) faites.add(key(x.seance_id))
  const traite = new Set<string>()
  for (const x of sds) {
    if (estProg[key(x.seance_id)] || !x.rattache) continue
    traite.add(x.date + '|' + x.seance_id)
    if (String(x.rattache) !== '__plus__') faites.add(key(x.rattache))
  }
  for (const x of sds) {
    if (estProg[key(x.seance_id)] || traite.has(x.date + '|' + x.seance_id)) continue
    const ex = ((x.exercices || x.exos) || []).map((e: any) => key(e && (e.nom || e.exo || e.exercice))).filter(Boolean)
    if (!ex.length) continue
    const set = new Set(ex)
    let best: { sid: string; n: number } | null = null
    for (const sid of ordre) {
      if (faites.has(key(sid))) continue
      const vu = new Set<string>(); let n = 0
      for (const e of exos[sid]) if (set.has(e) && !vu.has(e)) { vu.add(e); n++ }
      if (n / ex.length >= 0.5 && (!best || n > best.n)) best = { sid, n }
    }
    if (best) faites.add(key(best.sid))
  }
  return faites
}
// Séances en retard cette semaine (agenda, sinon jour conseillé ; « annule » = pas cette semaine) — même règle que l'app.
function _seancesEnRetard(data: any, now: Date): number {
  try {
    const j = (now.getUTCDay() + 6) % 7 + 1
    const lun = new Date(now); lun.setUTCHours(0, 0, 0, 0); lun.setUTCDate(lun.getUTCDate() - (j - 1))
    const lunIso = fmtYMD(lun), todayIso = fmtYMD(now)
    const key = (x: any) => String(x || '').trim().toLowerCase()
    const faites = _faitesSemaineRatt(data, lunIso)
    const plan: Record<string, string[]> = {}, annul: Record<string, boolean> = {}
    for (const r of ((data && data.planning) || [])) { const iso = String(r.date_iso || '').slice(0, 10); if (iso < lunIso) continue; if (r.statut === 'annule') annul[key(r.seance_id)] = true; else (plan[key(r.seance_id)] = plan[key(r.seance_id)] || []).push(iso) }
    const jours: Record<string, number> = {}
    for (const p of ((data && data.programme) || [])) { if (!p || !p.seance_id || p.type === 'cardio') continue; const k = key(p.seance_id); if (p.jour != null && p.jour !== '' && jours[k] == null) jours[k] = Number(p.jour) }
    let n = 0
    const sids = new Set([...Object.keys(jours), ...Object.keys(plan)])
    for (const k of sids) {
      if (faites.has(k) || annul[k]) continue
      const dates = plan[k] || (jours[k] != null ? [fmtYMD(new Date(lun.getTime() + (jours[k] - 1) * 864e5))] : [])
      if (dates.some((d) => d < todayIso)) n++
    }
    return n
  } catch (_) { return 0 }
}

// Rappel d'absence dû aujourd'hui ? (audit Notifications N3, 01/11) — J7, J10, J14, J21, J28 puis stop.
// derniereActivite / dernierPush : 'YYYY-MM-DD' (dernierPush = dernier rappel d'absence APRÈS la dernière activité).
function _rythmeAbsence(derniereActivite: string | null, dernierPush: string | null, now: Date): boolean {
  if (!derniereActivite) return false
  const j = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5)
  const today = fmtYMD(now), abs = j(derniereActivite, today)
  if (abs < 7 || abs > 28) return false
  // Jalons FIXES (jours d'absence) : un rappel est dû si un jalon est atteint depuis le dernier
  // rappel de cet épisode. Un jour de cron manqué → envoyé le lendemain, sans décaler la suite.
  const dejaJ = (!dernierPush || dernierPush < derniereActivite) ? -1 : j(derniereActivite, dernierPush)
  return [7, 10, 14, 21, 28].some((m) => m <= abs && m > dejaJ)
}

// ── Notifications intelligentes (cron) — roadmap #29 ──────────────────────────
// Parcourt les athlètes abonnés au push (natif OU web), calcule leurs alertes en
// RÉUTILISANT handleGetAppData (même logique déterministe, aucune duplication) et
// envoie UNE notification pour l'alerte IMPORTANTE (severity 'haute', ce qui inclut
// l'absence prolongée) non déjà notifiée cette semaine. Anti-spam : 1 push par
// (type, semaine) via indicateurs seance_id='alerte_push'. Protégé par CRON_SECRET.
async function handleCronPushAlertes(body: any): Promise<Response> {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || String(body.secret || '') !== secret) return jsonResp({ error: 'unauthorized' }, 401)
  const [{ data: nt }, { data: ws }] = await Promise.all([
    sb().from('native_push_tokens').select('athlete_id'),
    sb().from('push_subscriptions').select('athlete_id'),
  ])
  const tok = [...new Set([...(nt || []), ...(ws || [])].map((r: any) => String(r.athlete_id)).filter(Boolean))]
  // P2/P3 (05/11) : les alertes du COACH ne dépendent plus des notifications de l'athlète → on parcourt aussi
  // les athlètes des coachs qui ont un téléphone enregistré. L'athlète n'est notifié que s'il a lui-même un jeton.
  const demo = await _comptesDemo()   // 09/11 : comptes démo/test exclus des alertes automatiques
  const tokAth = new Set(tok.filter((x) => x.indexOf(COACH_PUSH_PREFIX) !== 0 && !demo.ath.has(x)))
  const coachsTel = tok.filter((x) => x.indexOf(COACH_PUSH_PREFIX) === 0).map((x) => x.slice(COACH_PUSH_PREFIX.length)).filter((c) => !demo.coach.has(c))
  let athCoachs: string[] = []
  if (coachsTel.length) { const { data: ac } = await sb().from('athletes').select('id').in('coach_id', coachsTel); athCoachs = (ac || []).map((r: any) => String(r.id)).filter((x: string) => !demo.ath.has(x)) }
  const ids = [...new Set([...tokAth, ...athCoachs])]
  const resume: Record<string, { surv: string[]; retard: number }> = {}
  // Rappel QUOTIDIEN : tant qu'une alerte « haute » reste active, on re-notifie
  // chaque jour (1 push/jour/athlète, la plus sévère). Clé anti-doublon par JOUR
  // (avant : par semaine → une seule notif/semaine, d'où l'impression « ça ne
  //  notifie plus »). Dès que l'alerte est résolue, plus de clé → plus de push.
  const dayKey = fmtYMD(new Date())
  let pushed = 0, pushedCoach = 0, scanned = 0
  for (const id of ids) {
    if (id.indexOf(COACH_PUSH_PREFIX) === 0) continue   // token COACH : pas un athlète à analyser
    scanned++
    try {
      const res = await handleGetAppData(new URLSearchParams({ athlete_id: id }))
      const data: any = await res.json()
      // Résumé du matin du coach (P4) : athlètes avec une alerte active + séances en retard.
      try {
        const { data: aR } = await sb().from('athletes').select('coach_id,nom').eq('id', id).single()
        const cR = aR && (aR as any).coach_id ? String((aR as any).coach_id) : ''
        if (cR) {
          const r = resume[cR] || (resume[cR] = { surv: [], retard: 0 })
          if (((data && data.alertes_centre) || []).some((a: any) => a && !a.read)) r.surv.push(String((aR as any).nom || '').trim().split(/\s+/)[0])
          r.retard += _seancesEnRetard(data, new Date())
        }
      } catch (_) {}
      // Politique de notification (demande porteur) : on pousse les alertes HAUTES
      // (douleur forte, charge très élevée, absence prolongée) ET deux cas de sévérité
      // moyenne explicitement voulus : séance manquée / régularité, et volume trop bas
      // (sous-charge). alertes_centre est déjà trié par sévérité → [0] = la plus grave.
      const PUSH_TYPES = new Set(['absence', 'irregularite', 'sous_charge'])
      const importantes = ((data && data.alertes_centre) || [])
        .filter((a: any) => a && !a.read && (a.severity === 'haute' || PUSH_TYPES.has(a.type)))
      if (!importantes.length) continue
      const top = importantes[0]   // déjà trié par sévérité décroissante
      // Clé par TYPE + JOUR (pas top.id, qui est stable → bloquerait le rappel
      // quotidien). Une alerte active re-notifie donc chaque jour.
      const key = top.type + '|' + dayKey
      // Rythme des rappels (audit Notifications 01/11, validé porteur) :
      //  • ABSENCE : J7, J10, J14, J21, J28 puis STOP (l'alerte reste visible dans l'app) — _rythmeAbsence ;
      //  • IRRÉGULARITÉ et VOLUME TROP BAS (sous-charge) : au plus 1 rappel tous les 3 jours.
      if (top.type === 'absence') {
        const da = data && data.moteur && data.moteur.derniere_activite
        const { data: lp } = await sb().from('indicateurs').select('date').eq('athlete_id', id).eq('seance_id', 'alerte_push').like('cle', 'absence|%').gte('date', da || '1970-01-01').order('date', { ascending: false }).limit(1)
        if (!_rythmeAbsence(da || null, (lp && lp[0]) ? normDate(lp[0].date) : null, new Date())) continue
      } else if (top.type === 'irregularite' || top.type === 'sous_charge') {
        const since = fmtYMD(minus(new Date(), 2))
        const { data: recent } = await sb().from('indicateurs').select('date').eq('athlete_id', id).eq('seance_id', 'alerte_push').like('cle', top.type + '|%').gte('date', since).limit(1)
        if (recent && recent.length) continue
      }
      // 1) Notifier l'ATHLÈTE (s'il a lui-même activé les notifications) — anti-spam par (athlète, alerte, jour).
      const { data: deja } = await sb().from('indicateurs').select('date').eq('athlete_id', id).eq('seance_id', 'alerte_push').eq('cle', key).limit(1)
      if (tokAth.has(id) && !(deja && deja.length)) {
        const nA = await notifyAthlete(id, { title: '⚠️ ' + (top.title || 'Alerte Novalyz'), body: top.action || top.evidence || '', tag: 'novalyz-alerte', target: 'accueil' })
        // N1 : « envoyée » seulement si au moins un appareil l'a acceptée.
        if (nA > 0) { await sb().from('indicateurs').insert({ athlete_id: id, date: fmtYMD(new Date()), seance_id: 'alerte_push', cle: key, valeur: '1', unite: '', source: 'cron' }); pushed++ }
      }
      // 2) Notifier le COACH de l'athlète — anti-spam DÉDIÉ (indépendant du push athlète),
      //    pour qu'il soit prévenu même si l'athlète a déjà reçu sa notif.
      try {
        const { data: aRow } = await sb().from('athletes').select('coach_id,nom').eq('id', id).single()
        const coachId = aRow && (aRow as any).coach_id ? String((aRow as any).coach_id) : ''
        // P4 : alerte par alerte seulement si le coach l'a choisi (sinon : résumé du matin).
        const prC = coachId ? (_coachPrefsCache[coachId] || (_coachPrefsCache[coachId] = await _coachPrefs(coachId))) : null
        if (coachId && prC && prC.notif.chaque && !_heuresCalmes(prC)) {
          const ckey = 'c|' + coachId + '|' + key
          const { data: dejaC } = await sb().from('indicateurs').select('date').eq('athlete_id', id).eq('seance_id', 'alerte_push_coach').eq('cle', ckey).limit(1)
          if (!(dejaC && dejaC.length)) {
            const who = (aRow && (aRow as any).nom) ? String((aRow as any).nom).split(/\s+/)[0] : 'Un athlète'
            const nC = await notifyCoach(coachId, { title: '⚠️ ' + who + ' · ' + (top.title || 'Alerte'), body: top.evidence || top.action || '', tag: 'novalyz-coach-alerte', target: 'coach' })
            if (nC > 0) { await sb().from('indicateurs').insert({ athlete_id: id, date: fmtYMD(new Date()), seance_id: 'alerte_push_coach', cle: ckey, valeur: '1', unite: '', source: 'cron' }); pushedCoach++ }
          }
        }
      } catch (_) { /* coach best-effort */ }
    } catch (_) { /* best-effort : un athlète en échec ne bloque pas les autres */ }
  }
  // Résumé du matin (P4) : UNE notification par coach (téléphone enregistré + réglage actif), 1 fois par jour.
  let resumes = 0
  for (const cId of coachsTel) {
    try {
      const pr = await _coachPrefs(cId)
      if (!pr.notif.resume || pr.resume_dernier === dayKey) continue
      const r = resume[cId] || { surv: [], retard: 0 }
      const { data: nl } = await sb().from('commentaires').select('comment_id').eq('coach_id', cId).eq('auteur', 'athlete').eq('lu', false)
      const nMsg = (nl || []).length
      const parts: string[] = []
      if (r.surv.length) parts.push(r.surv.length + ' à surveiller (' + r.surv.slice(0, 3).join(', ') + (r.surv.length > 3 ? '…' : '') + ')')
      if (r.retard) parts.push(r.retard + ' séance' + (r.retard > 1 ? 's' : '') + ' en retard')
      if (nMsg) parts.push(nMsg + ' message' + (nMsg > 1 ? 's' : '') + ' non lu' + (nMsg > 1 ? 's' : ''))
      if (!parts.length) continue   // rien à dire → pas de notification
      const n = await notifyCoach(cId, { title: 'Novalyz · ton équipe ce matin', body: parts.join(' · '), tag: 'novalyz-coach-resume', target: 'coach' })
      if (n > 0) { resumes++; await _coachPrefsEcrire(cId, { resume_dernier: dayKey }) }
    } catch (_) {}
  }
  return jsonResp({ ok: true, scanned, pushed, pushedCoach, resumes })
}

// ── Résumés e-mail (cron) — coach (équipe) + athlète (bilan) ─────────────────
// Envoie, pour une période ('semaine' | 'mois'), UN e-mail HTML riche :
//   • à chaque COACH ayant un e-mail → résumé de son équipe (effectif, statuts,
//     athlètes à surveiller, blessés) — RÉUTILISE handleGetSuiviEquipe (source unique) ;
//   • à chaque ATHLÈTE ayant un e-mail → bilan perso (séances, tonnage, RPE,
//     records, forme) — RÉUTILISE handleGetBilanPDF.
// Format : e-mail HTML (pas de pièce jointe PDF). Protégé par CRON_SECRET.
// ⚠️ Délivrabilité : en bac à sable Resend (from onboarding@resend.dev), seul le
//    propriétaire du compte Resend reçoit réellement les e-mails (roadmap P0-1).
function _escHtml(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Coquille e-mail commune (thème sombre Novalyz, identique au mail de reset).
function _emailShell(titre: string, sousTitre: string, corps: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,Helvetica,sans-serif;background:#0b0e14;color:#e9eef8;margin:0;padding:16px">
    ${_mailHeader()}
    <div style="max-width:620px;margin:0 auto;background:#141a28;border:1px solid #2a3450;border-radius:14px;padding:18px 16px">
      <h2 style="margin:0 0 4px;font-size:20px">${_escHtml(titre)}</h2>
      <p style="margin:0 0 18px;color:#8b96b0;font-size:13px">${_escHtml(sousTitre)}</p>
      ${corps}
      <p style="color:#5f6b85;font-size:12px;line-height:1.5;margin:22px 0 0;border-top:1px solid #2a3450;padding-top:14px">Résumé automatique Novalyz. Vous le recevez car une adresse e-mail est associée à votre compte.</p>
    </div></body></html>`
}

function _chipStatut(statut: string): string {
  const map: Record<string, { bg: string; fg: string; txt: string }> = {
    rouge:  { bg: '#3a1418', fg: '#ff6b74', txt: 'À agir' },
    orange: { bg: '#3a2c12', fg: '#f5a623', txt: 'À surveiller' },
    vert:   { bg: '#0f2e24', fg: '#37d3b5', txt: 'Optimal' },
  }
  const c = map[statut] || map.vert
  return `<span style="display:inline-block;background:${c.bg};color:${c.fg};font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px">${c.txt}</span>`
}

// Roues « pourcentage » = PNG statiques pré-rendus (0..100), hébergés sur GitHub
// Pages. Choix e-mail : une image PNG s'affiche dans TOUS les clients (Gmail,
// Outlook…), contrairement au SVG/CSS. Les assets sont dans assets/roues/ (livrés
// avec le front). ⚠️ visibles seulement une fois la branche déployée sur Pages.
const ROUE_BASE = Deno.env.get('ROUE_BASE') || 'https://app.novalyz.fr/assets/roues/'
function _roueImg(pct: number, size = 118, variant = '', alt?: string): string {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)))
  const pre = variant ? variant + '-' : ''   // '' = turquoise (défaut), 'b' = bleu, 'v' = violet
  const a = alt != null ? alt : (p + '%')
  return `<img src="${ROUE_BASE}roue-${pre}${p}.png" width="${size}" height="${size}" alt="${_escHtml(a)}" style="display:block;margin:0 auto;border:0">`
}
function _fmtDuree(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')}` : `${m} min`
}

// Données du bilan athlète (PUR — aucune BDD, testable). Toutes les valeurs sont
// tracées à une source réelle : perfs (séances/séries/tonnage/RPE, volume/muscle,
// progression 1RM Epley fenêtre vs précédente), programme (prévu), bien_etre
// (ressenti /5), indicateurs sante_ (montre : pas, sommeil_min, fc_repos).
function _bilanAthlete(perfs: any[], programme: any[], bienEtre: any[], sante: any[], now: Date, periode: string, annees = 0): any {
  const days = periode === '3mois' ? 90 : periode === 'mois' ? 28 : 7
  const weeks = days / 7
  const cut = fmtYMD(minus(now, days - 1))
  const cutPrev = fmtYMD(minus(now, days * 2))
  const inWin = (perfs || []).filter(r => normDate(r.date) >= cut)
  const inPrev = (perfs || []).filter(r => { const dd = normDate(r.date); return dd >= cutPrev && dd < cut })

  const seancesFaites = new Set(inWin.map(r => normDate(r.date))).size
  const seancesProg = new Set((programme || []).map((p: any) => String(p.seance_id ?? '')).filter(Boolean)).size
  const seancesPrevues = Math.round(seancesProg * weeks)
  const seriesFaites = inWin.length
  const seriesProgSem = (programme || []).reduce((s: number, p: any) => s + (Number(p.series_prevues) || 0), 0)
  const seriesPrevues = Math.round(seriesProgSem * weeks)

  let tonnage = 0, reps = 0, rpeSum = 0, rpeN = 0
  const volMus: Record<string, number> = {}        // volume = charge×reps (balance)
  const serMus: Record<string, number> = {}        // nb de SÉRIES par muscle (bloc Volume)
  for (const r of inWin) {
    const c = Number(r.charge) || 0, rp = Number(r.reps) || 0
    tonnage += c * rp; reps += rp
    if (r.rpe) { rpeSum += Number(r.rpe); rpeN++ }
    if (r.muscle) {
      volMus[r.muscle] = (volMus[r.muscle] || 0) + c * rp
      serMus[r.muscle] = (serMus[r.muscle] || 0) + 1   // 1 ligne perf = 1 série
    }
  }
  // Volume musculaire en SÉRIES vs cible (identique au bloc Résumé muscu de l'app).
  // Cibles séries/muscle/semaine par niveau (années de pratique) — mêmes seuils que
  // _maVolTargets() côté front : débutant 8/12, intermédiaire 10/16, avancé 12/20.
  const _tgt = annees >= 8 ?   // mêmes seuils que getNiveauExperience (avancé 8+, expert partage)
    { min: 12, opt: 20, label: 'avancé' }
    : annees >= 4 ? { min: 10, opt: 16, label: 'intermédiaire' }
    : { min: 8, opt: 12, label: 'débutant' }
  const volMuscu = Object.keys(serMus)
    .map(m => {
      const tot = serMus[m], opt = _tgt.opt * weeks, min = _tgt.min * weeks
      const statut = tot >= opt ? 'opt' : tot >= min ? 'sous' : 'insuf'
      const pct = Math.min(100, Math.round(tot / (opt * 1.3) * 100))   // barre (cible à ~77%)
      return { muscle: m, series: tot, opt: Math.round(opt), min: Math.round(min), statut, pct }
    })
    .sort((a, b) => b.series - a.series)
  const totVol = Object.values(volMus).reduce((s, v) => s + v, 0) || 1
  const balance = Object.keys(volMus).map(m => ({ muscle: m, pct: Math.round(volMus[m] / totVol * 100) }))
    .sort((a, b) => b.pct - a.pct).slice(0, 6)
  // Vraie balance agoniste / antagoniste : poussée vs tirage (pecs/dos), avant vs
  // arrière cuisse (quadri/ischios), flexion vs extension bras (biceps/triceps).
  // Volume (charge×reps) par muscle, matching par mots-clés (tolère pluriels/accents).
  const _normM = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const _sumK = (keys: string[], excl: string[] = []) => {
    let t = 0
    for (const m in volMus) { const n = _normM(m); if (keys.some(k => n.indexOf(k) >= 0) && !excl.some(e => n.indexOf(e) >= 0)) t += volMus[m] }
    return t
  }
  const _pairDefs = [
    { la: 'Pectoraux', ka: ['pector'], lb: 'Dos', kb: ['dos', 'dorsa'] },
    { la: 'Quadriceps', ka: ['quadri'], lb: 'Ischios', kb: ['ischio', 'femor'] },
    { la: 'Biceps', ka: ['biceps'], xa: ['femor'], lb: 'Triceps', kb: ['triceps'] },
  ]
  const balancePairs = _pairDefs.map(p => {
    const a = _sumK(p.ka, (p as any).xa || []), b2 = _sumK(p.kb), t = a + b2
    if (t <= 0) return null
    const pa = Math.round(a / t * 100)
    return { la: p.la, lb: p.lb, pa, pb: 100 - pa }
  }).filter(Boolean)

  // Progression par exercice : meilleur 1RM estimé (Epley = charge·(1+reps/30)),
  // fenêtre courante vs fenêtre précédente de même durée. Exos présents dans LES
  // DEUX fenêtres seulement (comparables) → pas de faux + / faux −.
  const bestEpley = (rows: any[]) => {
    const m: Record<string, number> = {}
    for (const r of rows) {
      const c = Number(r.charge) || 0, rp = Number(r.reps) || 0
      if (c <= 0 || rp <= 0) continue
      const e = c * (1 + rp / 30)
      if (m[r.exercice] == null || e > m[r.exercice]) m[r.exercice] = e
    }
    return m
  }
  const bW = bestEpley(inWin), bP = bestEpley(inPrev)
  const prog: any[] = []
  for (const exo in bW) {
    if (bP[exo] != null && bP[exo] > 0) prog.push({ exo, pct: Math.round((bW[exo] - bP[exo]) / bP[exo] * 100) })
  }
  const enProgres = prog.filter(p => p.pct >= 3).sort((a, b) => b.pct - a.pct).slice(0, 3)
  const enRecul = prog.filter(p => p.pct <= -3).sort((a, b) => a.pct - b.pct).slice(0, 3)

  // Records (meilleure charge par exo, tous temps).
  // Records SUR LA PÉRIODE (meilleure charge par exo dans la fenêtre choisie).
  const recMap: Record<string, { charge: number; reps: number }> = {}
  for (const r of inWin) {
    const c = Number(r.charge) || 0, rp = Number(r.reps) || 0
    if (c <= 0) continue
    const cur = recMap[r.exercice]
    if (!cur || c > cur.charge || (c === cur.charge && rp > cur.reps)) recMap[r.exercice] = { charge: c, reps: rp }
  }
  const records = Object.keys(recMap).map(e => ({ exo: e, charge: recMap[e].charge, reps: recMap[e].reps }))
    .sort((a, b) => b.charge - a.charge).slice(0, 4)

  const sWin = (sante || []).filter((r: any) => normDate(r.date) >= cut)
  const avgKey = (cle: string) => {
    const v = sWin.filter((r: any) => r.cle === cle).map((r: any) => Number(r.valeur)).filter((n: number) => !isNaN(n))
    return v.length ? v.reduce((s: number, x: number) => s + x, 0) / v.length : null
  }
  const pas = avgKey('pas'), somMin = avgKey('sommeil_min'), fc = avgKey('fc_repos')

  const beWin = (bienEtre || []).filter((r: any) => normDate(r.date) >= cut)
  const avgBe = (k: string) => {
    const v = beWin.map((r: any) => Number(r[k])).filter((n: number) => !isNaN(n) && n > 0)
    return v.length ? Math.round(v.reduce((s: number, x: number) => s + x, 0) / v.length * 10) / 10 : null
  }

  return {
    seancesFaites, seancesPrevues, seriesFaites, seriesPrevues,
    tonnageKg: Math.round(tonnage), reps, rpeMoyen: rpeN ? Math.round(rpeSum / rpeN * 10) / 10 : null,
    balance, balancePairs, volMuscu, volLevel: _tgt.label, enProgres, enRecul, records,
    montre: { pas: pas != null ? Math.round(pas) : null, sommeilMin: somMin != null ? Math.round(somMin) : null, fcRepos: fc != null ? Math.round(fc) : null },
    ressenti: { sommeil: avgBe('sommeil'), energie: avgBe('energie'), fatigue: avgBe('fatigue_musculaire') },
  }
}

function _emailResumeEquipeHTML(coachNom: string, periode: string, d: any): string {
  const eq = (d && d.equipe) || {}
  const joueurs: any[] = (d && d.joueurs) || []
  const blesses: any[] = (d && d.blesses) || []
  const total = eq.total || joueurs.length || 0
  const periodeLabel = periode === '3mois' ? 'des 3 derniers mois' : periode === 'mois' ? 'du mois' : 'de la semaine'
  const ceLabel = periode === '3mois' ? 'ces 3 mois' : periode === 'mois' ? 'ce mois' : 'cette semaine'

  // Roue « effectif actif » = part des athlètes ayant ≥ 1 séance sur 7 j.
  const actifs = joueurs.filter(j => Number(j.seances_7j) > 0).length
  const pctActif = total > 0 ? Math.round(100 * actifs / total) : 0
  // Barre de statut (segments vert/orange/rouge) — plus lisible qu'un camembert
  // pour une répartition à 3 catégories, et compatible tous clients mail.
  const v = eq.vert || 0, o = eq.orange || 0, r = eq.rouge || 0
  const tot3 = (v + o + r) || 1
  const seg = (n: number, bg: string) => n > 0 ? `<td width="${Math.round(100 * n / tot3)}%" style="background:${bg};height:30px;text-align:center;color:#06231c;font-size:12px;font-weight:700;font-family:Arial,sans-serif">${n}</td>` : ''
  const barre = `<table role="presentation" width="100%" style="border-collapse:collapse;border-radius:9px;overflow:hidden;margin:10px 0 4px"><tr>
      ${seg(v, '#0ca30c')}${seg(o, '#fab219')}${seg(r, '#d03b3b')}
    </tr></table>
    <table role="presentation" width="100%" style="font-size:12px;color:#8b96b0"><tr>
      <td>🟢 Optimal ${v}</td><td style="text-align:center">🟡 À surveiller ${o}</td><td style="text-align:right">🔴 À agir ${r}</td></tr></table>`

  const hero = `<table role="presentation" width="100%" style="border-collapse:separate"><tr>
      <td width="140" valign="middle" style="background:#0f1522;border:1px solid #243049;border-radius:14px;padding:12px;text-align:center">
        ${_roueImg(pctActif, 110)}
        <div style="font-size:11px;color:#8b96b0;margin-top:6px">Effectif actif ${ceLabel}</div>
        <div style="font-size:11px;color:#5f6b85">${actifs}/${total} athlète${total > 1 ? 's' : ''}</div>
      </td>
      <td style="width:12px"></td>
      <td valign="middle" style="background:#0f1522;border:1px solid #243049;border-radius:14px;padding:12px 14px">
        <div style="font-size:12px;color:#8b96b0;margin-bottom:2px">Répartition de l'effectif (${total})</div>
        ${barre}
      </td>
    </tr></table>`

  const stat = (label: string, val: unknown, unite = '') =>
    `<td align="center" style="background:#0f1522;border:1px solid #243049;border-radius:12px;padding:12px 6px">
       <div style="font-size:19px;font-weight:800;color:#e9eef8;line-height:1">${_escHtml(val)}<span style="font-size:12px;color:#8b96b0;font-weight:600">${unite ? ' ' + _escHtml(unite) : ''}</span></div>
       <div style="font-size:11px;color:#8b96b0;margin-top:4px">${_escHtml(label)}</div></td>`
  const ch = eq.charge_equipe != null ? Math.round(eq.charge_equipe) : '—'
  const ft = eq.fatigue_moyenne != null ? (Math.round(eq.fatigue_moyenne * 10) / 10) : '—'
  const be = eq.bienetre_moyen != null ? (Math.round(eq.bienetre_moyen * 10) / 10) : '—'
  const statsRow = `<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:8px 0;margin:12px 0 4px"><tr>
      ${stat('Effectif', total)}
      ${stat('Charge équipe', ch, 'UA')}
      ${stat('Fatigue moy.', ft, '/5')}
      ${stat('Bien-être', be, '/5')}
    </tr></table>`

  // Athlètes à surveiller (rouge/orange) — déjà triés par gravité par le moteur.
  const aSuivre = joueurs.filter(j => j.statut === 'rouge' || j.statut === 'orange')
  let listeHtml = ''
  if (aSuivre.length) {
    const lignes = aSuivre.map(j => {
      const nbAl = Array.isArray(j.alertes) ? j.alertes.length : 0
      const alTxt = nbAl ? `${nbAl} alerte${nbAl > 1 ? 's' : ''}` : '—'
      const ds = j.derniere_seance ? `dernière séance ${_escHtml(j.derniere_seance)}` : 'aucune séance'
      return `<tr>
        <td style="padding:10px 2px;border-bottom:1px solid #223049">
          <div style="font-weight:700;font-size:14px">${_escHtml(j.nom || '—')}</div>
          <div style="font-size:12px;color:#8b96b0;margin-top:2px">${ds} · ${_escHtml(j.seances_7j || 0)} séa./7j · ${_escHtml(alTxt)}</div>
        </td>
        <td style="padding:10px 2px;border-bottom:1px solid #223049;text-align:right;white-space:nowrap">${_chipStatut(j.statut)}</td>
      </tr>`
    }).join('')
    listeHtml = `<h3 style="font-size:15px;margin:22px 0 6px">À surveiller ${ceLabel}</h3>
      <table role="presentation" width="100%" style="border-collapse:collapse">${lignes}</table>`
  } else {
    listeHtml = `<p style="background:#0f2e24;border:1px solid #1f5b4a;color:#9fe6d2;border-radius:10px;padding:12px;font-size:13px;margin:16px 0 0">✅ Aucun athlète en alerte sur la période — effectif au vert.</p>`
  }

  // Dynamique : en progression vs en régression (tests / charges).
  let dynHtml = ''
  const prog = Number(eq.en_progression) || 0, reg = Number(eq.en_regression) || 0
  if (prog + reg > 0) {
    const t = prog + reg
    dynHtml = `<h3 style="font-size:15px;margin:22px 0 6px">Dynamique de l'effectif</h3>
      <table role="presentation" width="100%" style="border-collapse:collapse;border-radius:9px;overflow:hidden"><tr>
        ${prog > 0 ? `<td width="${Math.round(100 * prog / t)}%" style="background:#0ca30c;height:30px;text-align:center;color:#06231c;font-size:12px;font-weight:700">▲ ${prog} en progrès</td>` : ''}
        ${reg > 0 ? `<td width="${Math.round(100 * reg / t)}%" style="background:#fab219;height:30px;text-align:center;color:#3a2c12;font-size:12px;font-weight:700">▼ ${reg} en recul</td>` : ''}
      </tr></table>`
  }

  let blessesHtml = ''
  if (blesses.length) {
    const lignes = blesses.map(b => `<li style="margin:3px 0">${_escHtml(b.nom || '—')} — ${_escHtml(b.type || 'blessure')}${b.localisation ? ' (' + _escHtml(b.localisation) + ')' : ''}${b.statut === 'indispo' ? ' · indisponible' : ' · retour progressif'}</li>`).join('')
    blessesHtml = `<h3 style="font-size:15px;margin:22px 0 6px">Infirmerie (${blesses.length})</h3>
      <ul style="margin:0;padding-left:18px;color:#cdd6ea;font-size:13px;line-height:1.6">${lignes}</ul>`
  }

  const corps = hero + statsRow + listeHtml + dynHtml + blessesHtml
  const sous = `Résumé ${periodeLabel} · effectif de ${total} athlète${total > 1 ? 's' : ''}`
  return _emailShell('Bonjour ' + (coachNom || 'coach'), sous, corps)
}

function _emailBilanAthleteHTML(prenom: string, periode: string, b: any): string {
  const ceLabel = periode === '3mois' ? 'ces 3 mois' : periode === 'mois' ? 'ce mois' : 'cette semaine'
  const perLabel = periode === 'mois' ? 'du mois' : 'de la semaine'

  // --- Ta charge d'entraînement : 2 ROUES (images PNG, robustes en mail) ---
  //   bleu = Séances réalisées/prévues · violet = Intensité (RPE moyen /10).
  const pctSeances = b.seancesPrevues > 0 ? Math.round(100 * b.seancesFaites / b.seancesPrevues) : null
  const pctRpe = b.rpeMoyen != null ? Math.round(b.rpeMoyen / 10 * 100) : null
  const roueCell = (inner: string) =>
    `<td width="50%" valign="top" align="center" style="background:#0f1522;border:1px solid #243049;border-radius:14px;padding:14px 8px 12px">${inner}</td>`
  const seancesInner = pctSeances != null
    ? `${_roueImg(pctSeances, 112, 'b', pctSeances + '%')}
       <div style="font-size:13px;font-weight:700;color:#e9eef8;margin-top:9px;font-family:Arial,sans-serif">Séances</div>
       <div style="font-size:11px;color:#8b96b0;font-family:Arial,sans-serif">${b.seancesFaites} / ${b.seancesPrevues} réalisées</div>`
    : `<div style="font-size:30px;font-weight:800;color:#4d82ff">${b.seancesFaites}</div>
       <div style="font-size:13px;font-weight:700;color:#e9eef8;margin-top:6px;font-family:Arial,sans-serif">Séances</div>
       <div style="font-size:11px;color:#8b96b0;font-family:Arial,sans-serif">réalisées ${ceLabel}</div>`
  const rpeInner = pctRpe != null
    ? `${_roueImg(pctRpe, 112, 'v', b.rpeMoyen + '/10')}
       <div style="font-size:13px;font-weight:700;color:#e9eef8;margin-top:9px;font-family:Arial,sans-serif">Intensité</div>
       <div style="font-size:11px;color:#8b96b0;font-family:Arial,sans-serif">RPE moyen / 10</div>`
    : `<div style="font-size:30px;font-weight:800;color:#b47ee0">—</div>
       <div style="font-size:13px;font-weight:700;color:#e9eef8;margin-top:6px;font-family:Arial,sans-serif">Intensité</div>
       <div style="font-size:11px;color:#8b96b0;font-family:Arial,sans-serif">RPE non renseigné</div>`
  const rouesRow = `<h3 style="font-size:15px;margin:2px 0 10px;font-family:Arial,sans-serif">Ta charge d'entraînement <span style="font-weight:400;font-size:12px;color:#5f6b85">${ceLabel}</span></h3>`
    + `<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:8px 0"><tr>${roueCell(seancesInner)}${roueCell(rpeInner)}</tr></table>`

  // --- tuiles absolues ---
  const stat = (label: string, val: unknown, unite = '') =>
    `<td align="center" style="background:#0f1522;border:1px solid #243049;border-radius:12px;padding:12px 6px">
       <div style="font-size:19px;font-weight:800;color:#e9eef8;line-height:1">${_escHtml(val)}<span style="font-size:12px;color:#8b96b0;font-weight:600">${unite ? ' ' + _escHtml(unite) : ''}</span></div>
       <div style="font-size:11px;color:#8b96b0;margin-top:4px">${_escHtml(label)}</div></td>`
  const statsRow = `<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:8px 0;margin:10px 0 4px"><tr>
      ${stat('Tonnage', b.tonnageKg || 0, 'kg')}
      ${stat('Séries', b.seriesFaites || 0)}
      ${stat('Reps', b.reps || 0)}
      ${stat('RPE moy.', b.rpeMoyen != null ? b.rpeMoyen : '—')}
    </tr></table>`

  // --- Volume musculaire : séries par muscle vs cible (identique au bloc de
  //     l'écran Résumé muscu). Vert = cible atteinte, orange = sous-optimal, rouge
  //     = insuffisant. Cible selon le niveau (années de pratique). ---
  let volumeHtml = ''
  if (b.volMuscu && b.volMuscu.length) {
    const VC: Record<string, string> = { opt: '#00A854', sous: '#E07800', insuf: '#DC3545' }
    const rows = b.volMuscu.map((v: any) => {
      const col = VC[v.statut] || VC.opt
      return `<div style="margin:0 0 9px">
        <table role="presentation" width="100%" style="border-collapse:collapse;font-family:Arial,sans-serif"><tr>
          <td style="font-size:13px;color:#cdd6ea">${_escHtml(v.muscle)}</td>
          <td style="text-align:right;font-size:12px;font-weight:700;color:${col}">${v.series} / ${v.opt} séries</td></tr></table>
        <table role="presentation" width="100%" style="border-collapse:collapse;background:#0f1522;border-radius:7px;margin-top:4px"><tr>
          <td width="${Math.max(3, v.pct)}%" style="background:${col};height:14px;border-radius:7px;font-size:0;line-height:0">&nbsp;</td><td></td></tr></table>
      </div>`
    }).join('')
    const leg = [['#00A854', 'Optimal'], ['#E07800', 'Sous-optimal'], ['#DC3545', 'Insuffisant']]
      .map(a => `<span style="font-size:11px;color:#8b96b0;margin-right:12px;white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${a[0]};vertical-align:middle;margin-right:4px"></span>${a[1]}</span>`).join('')
    volumeHtml = `<h3 style="font-size:15px;margin:18px 0 8px;font-family:Arial,sans-serif">Volume musculaire <span style="font-weight:400;font-size:12px;color:#5f6b85">${ceLabel} · séries</span></h3>${rows}
      <div style="margin-top:8px">${leg}</div>
      <div style="font-size:11px;color:#5f6b85;margin-top:6px;font-family:Arial,sans-serif">À droite : ta cible (niveau ${_escHtml(b.volLevel || 'intermédiaire')}). Barre verte = atteinte.</div>`
  }

  // --- Vraie balance musculaire : paires agoniste / antagoniste (barres 2 côtés). ---
  let balanceHtml = ''
  if (b.balancePairs && b.balancePairs.length) {
    const rows = b.balancePairs.map((p: any) => `<div style="margin:0 0 12px">
        <table role="presentation" width="100%" style="border-collapse:collapse;font-family:Arial,sans-serif"><tr>
          <td style="font-size:12.5px;color:#cdd6ea">${_escHtml(p.la)} <b style="color:#e9eef8">${p.pa}%</b></td>
          <td style="text-align:right;font-size:12.5px;color:#cdd6ea"><b style="color:#e9eef8">${p.pb}%</b> ${_escHtml(p.lb)}</td></tr></table>
        <table role="presentation" width="100%" style="border-collapse:collapse;border-radius:7px;overflow:hidden;margin-top:4px"><tr>
          <td width="${p.pa}%" style="background:#1A5FFF;height:16px;font-size:0;line-height:0">&nbsp;</td>
          <td width="${p.pb}%" style="background:#9D5FD3;height:16px;font-size:0;line-height:0">&nbsp;</td></tr></table>
      </div>`).join('')
    balanceHtml = `<h3 style="font-size:15px;margin:18px 0 8px;font-family:Arial,sans-serif">Balance musculaire <span style="font-weight:400;font-size:12px;color:#5f6b85">agoniste / antagoniste</span></h3>${rows}
      <div style="font-size:11px;color:#5f6b85;margin-top:2px;font-family:Arial,sans-serif">Vise ~50 / 50. Un écart marqué et durable = point faible à travailler.</div>`
  }

  // --- exercices en progrès / recul ---
  let progHtml = ''
  if ((b.enProgres && b.enProgres.length) || (b.enRecul && b.enRecul.length)) {
    const col = (titre: string, color: string, arr: any[], signe: string) => {
      const items = (arr && arr.length)
        ? arr.map(p => `<div style="display:block;font-size:13px;padding:5px 0;border-bottom:1px solid #1c2740">${_escHtml(p.exo)} <span style="float:right;font-weight:700;color:${color}">${signe}${Math.abs(p.pct)}%</span></div>`).join('')
        : `<div style="font-size:12px;color:#5f6b85;padding:5px 0">—</div>`
      return `<td width="50%" valign="top" style="background:#0f1522;border:1px solid #243049;border-radius:12px;padding:12px 13px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:${color};margin-bottom:6px">${titre}</div>${items}</td>`
    }
    progHtml = `<h3 style="font-size:15px;margin:18px 0 8px">Exercices · dynamique <span style="font-weight:400;font-size:12px;color:#5f6b85">1RM estimé vs période précédente</span></h3>
      <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:10px 0"><tr>
        ${col('▲ En progrès', '#0ca30c', b.enProgres, '+')}
        ${col('▼ À relancer', '#fab219', b.enRecul, '−')}
      </tr></table>`
  }

  // --- forme / montre ---
  let formeHtml = ''
  const mt = b.montre || {}, rs = b.ressenti || {}
  const hcards: string[] = []
  if (mt.pas != null) hcards.push(`<td align="center" style="background:#0f1522;border:1px solid #243049;border-radius:12px;padding:12px 6px"><div style="font-size:16px">👟</div><div style="font-size:17px;font-weight:800;margin-top:3px">${mt.pas.toLocaleString('fr-FR')}</div><div style="font-size:11px;color:#8b96b0;margin-top:2px">Pas / jour</div></td>`)
  if (mt.sommeilMin != null) hcards.push(`<td align="center" style="background:#0f1522;border:1px solid #243049;border-radius:12px;padding:12px 6px"><div style="font-size:16px">😴</div><div style="font-size:17px;font-weight:800;margin-top:3px">${_fmtDuree(mt.sommeilMin)}</div><div style="font-size:11px;color:#8b96b0;margin-top:2px">Sommeil</div></td>`)
  if (mt.fcRepos != null) hcards.push(`<td align="center" style="background:#0f1522;border:1px solid #243049;border-radius:12px;padding:12px 6px"><div style="font-size:16px">❤️</div><div style="font-size:17px;font-weight:800;margin-top:3px">${mt.fcRepos}</div><div style="font-size:11px;color:#8b96b0;margin-top:2px">FC repos (bpm)</div></td>`)
  const ress: string[] = []
  if (rs.sommeil != null) ress.push(stat('Sommeil ressenti', rs.sommeil, '/5'))
  if (rs.energie != null) ress.push(stat('Énergie', rs.energie, '/5'))
  if (rs.fatigue != null) ress.push(stat('Fatigue', rs.fatigue, '/5'))
  if (hcards.length || ress.length) {
    formeHtml = `<h3 style="font-size:15px;margin:18px 0 8px">Ta forme <span style="font-weight:400;font-size:12px;color:#5f6b85">moyenne ${perLabel} · montre</span></h3>`
    if (hcards.length) formeHtml += `<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:8px 0"><tr>${hcards.join('')}</tr></table>`
    if (ress.length) formeHtml += `<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:8px 0;margin-top:8px"><tr>${ress.join('')}</tr></table>`
  }

  // --- records ---
  let recHtml = ''
  if (b.records && b.records.length) {
    const lignes = b.records.map((rec: any) => `<tr>
        <td style="padding:7px 2px;border-bottom:1px solid #223049;font-size:13px">${_escHtml(rec.exo)}</td>
        <td style="padding:7px 2px;border-bottom:1px solid #223049;text-align:right;font-size:13px;font-weight:700;color:#37d3b5">${_escHtml(rec.charge)} kg × ${_escHtml(rec.reps)}</td>
      </tr>`).join('')
    recHtml = `<h3 style="font-size:15px;margin:18px 0 8px">Tes records <span style="font-weight:400;font-size:12px;color:#5f6b85">meilleures charges · ${ceLabel}</span></h3>
      <table role="presentation" width="100%" style="border-collapse:collapse">${lignes}</table>`
  }

  const corps = rouesRow + statsRow + volumeHtml + balanceHtml + progHtml + formeHtml + recHtml +
    `<p style="margin:18px 0 0;color:#8b96b0;font-size:12px;line-height:1.5">Ouvre Novalyz pour l'analyse détaillée de ta ${perLabel.replace('du ', '').replace('de la ', '')}.</p>`
  const sous = `Ton bilan ${perLabel}`
  return _emailShell('Bonjour ' + (prenom || 'athlète'), sous, corps)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIL RÉCAP v2 (maquette mockups/novalyz-mail-recap-v2.html, validée le 01/11/2026)
// Règles : vraie période (mois civil / semaine lun→dim / trimestre ÉCOULÉS), même
// lecture des exercices que l'app (_lectureExos porté ci-dessous à l'identique),
// VRAIS records, volume par muscle avec les cibles de l'app (volume_obti) et les
// muscles secondaires à 0,5 série, balance en SÉRIES, forme vs « ta normale » (les 3
// mois avant la période), cardio, 3 recos chiffrées. TOUT est facultatif : sans
// montre / bien-être / cardio / séance, le bloc concerné disparaît (jamais de zéro
// inventé). Mise en page : 2 tuiles par ligne max (lisible sur mobile 360 px).
// ═══════════════════════════════════════════════════════════════════════════════
const _MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
// Bornes de la période ÉCOULÉE [debut, fin) en UTC + période précédente de même type.
function _recapBornes(per: string, now: Date): { debut: Date; fin: Date; precDebut: Date; label: string; sousTitre: string; jours: number } {
  const Y = now.getUTCFullYear(), M = now.getUTCMonth()
  const d2 = (d: Date) => String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0')
  if (per === 'mois') {
    const debut = new Date(Date.UTC(Y, M - 1, 1)), fin = new Date(Date.UTC(Y, M, 1)), precDebut = new Date(Date.UTC(Y, M - 2, 1))
    const nom = _MOIS_FR[debut.getUTCMonth()], dern = minus(fin, 1).getUTCDate()
    return { debut, fin, precDebut, label: nom, sousTitre: `Ton bilan ${/^[aeiouéo]/.test(nom) ? "d'" : 'de '}${nom} · du 1er au ${dern} ${nom}`, jours: Math.round((fin.getTime() - debut.getTime()) / 864e5) }
  }
  if (per === '3mois') {
    const q = Math.floor(M / 3), debut = new Date(Date.UTC(Y, (q - 1) * 3, 1)), fin = new Date(Date.UTC(Y, q * 3, 1)), precDebut = new Date(Date.UTC(Y, (q - 2) * 3, 1))
    const a = _MOIS_FR[debut.getUTCMonth()], b = _MOIS_FR[minus(fin, 1).getUTCMonth()]
    return { debut, fin, precDebut, label: `${a} → ${b}`, sousTitre: `Ton bilan du trimestre · ${a} → ${b}`, jours: Math.round((fin.getTime() - debut.getTime()) / 864e5) }
  }
  const lundi = getLundi(new Date(Date.UTC(Y, M, now.getUTCDate())))
  const debut = minus(lundi, 7), fin = lundi, precDebut = minus(lundi, 14)
  return { debut, fin, precDebut, label: 'la semaine', sousTitre: `Ton bilan de la semaine · du ${d2(debut)} au ${d2(minus(fin, 1))}`, jours: 7 }
}
// --- Lecture des exercices : PORT FIDÈLE de js/app.js (_exoFourchette, _cdAvgRpe,
//     _progSecondaire, _lectureExos). Toute évolution de l'une doit suivre l'autre
//     (test tests/recap-v2.test.js compare les deux sur les mêmes données). ---
const _RC_CAT_R: Record<string, number[]> = { gros: [6, 12], moyen: [6, 12], petit: [8, 20] }
function _rcFourchette(nom: string, rmin: any, rmax: any, cats: any) {
  const k = String(nom || '').trim(), c = (cats && (cats[k] || cats[nom])) || '', r = _RC_CAT_R[c]
  const progDefaut = (rmin == null && rmax == null) || (Number(rmin) === 8 && Number(rmax) === 12)
  if (r && progDefaut) return { rmin: r[0], rmax: r[1] }
  return { rmin, rmax }
}
function _rcAvgRpe(series: any[]): number | null {
  if (!Array.isArray(series)) return null
  const xs = series.map(s => Number(s && s.rpe)).filter(x => !isNaN(x) && x > 0)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
function _rcProgSecondaire(pA: any, pB: any): string | null {
  const num = (x: any) => { const n = Number(x); return isNaN(n) ? 0 : n }
  const c = num(pA.charge), r = num(pA.reps)
  if (c !== num(pB.charge) || r !== num(pB.reps)) return null
  const top = (p: any) => (Array.isArray(p.series) ? p.series : []).filter((x: any) => num(x.charge) === c && num(x.reps) >= r)
  const tA = top(pA), tB = top(pB)
  if (!tA.length || !tB.length) return null
  if (tA.length > tB.length) return tA.length + ' séries à ' + r + ' reps au lieu de ' + tB.length
  const rpe = (t: any[]) => { const v = t.map((x: any) => num(x.rpe)).filter((x: number) => x > 0); return v.length ? v.reduce((a: number, b: number) => a + b, 0) / v.length : null }
  const rA = rpe(tA), rB = rpe(tB)
  if (tA.length >= Math.min(tB.length, 2) && rA != null && rB != null && rA <= rB - 0.5) return 'même niveau à RPE ' + String(Math.round(rA * 10) / 10).replace('.', ',') + ' au lieu de ' + String(Math.round(rB * 10) / 10).replace('.', ',')
  return null
}
function _rcLectureExos(prog: Record<string, any[]>, lignes: any[], cats: any, nowT: number, ctxEtat?: string | null): any {
  // Audit Contexte X1 (01/11) — même règle que l'app : en déload / reprise, « recule » et « bloqué » sont attendus.
  const ctxA = ctxEtat === 'deload' ? 'déload' : (ctxEtat === 'retour_vacances' || ctxEtat === 'retour_blessure') ? 'reprise' : null
  const pd = (x: any) => { const d = parseFR(x); return d ? d.getTime() : 0 }
  const num = (x: any) => { const n = Number(x); return isNaN(n) ? 0 : n }
  const days = (t: number) => (nowT - t) / 864e5
  const R: any = { records: [], progresse: [], recule: [], bloque: [], sous: [], attendu: [], ctx: ctxA }
  for (const exo of Object.keys(prog || {})) {
    const pts = prog[exo] || []; if (!pts.length) continue
    const dt0 = pd(pts[0].date); if (!dt0) continue
    const c0 = num(pts[0].charge), r0 = num(pts[0].reps), dj = days(dt0)
    if (dj > 21) continue
    let pl: any = null
    for (const l of lignes || []) { if (l && String(l.exercice || '').trim() === String(exo).trim() && l.type !== 'cardio') { pl = l; break } }
    const f = _rcFourchette(exo, pl && pl.reps_mini != null && pl.reps_mini !== '' ? Number(pl.reps_mini) : null, pl && pl.reps_max != null && pl.reps_max !== '' ? Number(pl.reps_max) : null, cats)
    const ser = Array.isArray(pts[0].series) ? pts[0].series.filter((x: any) => num(x.reps) > 0) : []
    const rpes = ser.map((x: any) => num(x.rpe)).filter((x: number) => x > 0)
    const rpeMax = rpes.length ? Math.max(...rpes) : null
    if (f.rmin && ser.length && rpeMax != null && rpeMax >= 9 && c0 > 0) {
      const nSous = ser.filter((x: any) => num(x.reps) < f.rmin).length
      if (nSous * 2 > ser.length) { R.sous.push({ exo, c: c0, r: r0, rpe: rpeMax, rmin: f.rmin, rmax: f.rmax, hist: pts.slice(0, 4).reverse().map((p: any) => ({ c: num(p.charge), r: num(p.reps) })) }); continue }
    }
    if (dj <= 10 && pts.length >= 2) {
      let bestC = 0, repsAtBest = 0
      for (let k = 1; k < pts.length; k++) { const cc = num(pts[k].charge), rr = num(pts[k].reps); if (cc > bestC) { bestC = cc; repsAtBest = rr } else if (cc === bestC && rr > repsAtBest) repsAtBest = rr }
      if (c0 > 0 && (c0 > bestC || (c0 === bestC && r0 > repsAtBest))) { R.records.push({ exo, c: c0, r: r0 }); continue }
    }
    if (pts.length < 2) continue
    const c1 = num(pts[1].charge), r1 = num(pts[1].reps)
    if (dj <= 14 && (c0 > c1 || (c0 === c1 && r0 > r1))) { R.progresse.push({ exo }); continue }
    const p2 = (dj <= 14) ? _rcProgSecondaire(pts[0], pts[1]) : null
    if (p2) { R.progresse.push({ exo, why: p2 }); continue }
    if (c0 < c1 && r0 < r1 && !(pts.length >= 3 && c0 > num(pts[2].charge))) { (ctxA ? R.attendu : R.recule).push({ exo, c0, c1, r0, r1 }); continue }
    if (pts.length >= 3) {
      const c2 = num(pts[2].charge), r2 = num(pts[2].reps)
      if (c0 === c1 && c1 === c2 && r0 <= r1 && r1 <= r2) {
        if (_rcProgSecondaire(pts[1], pts[2])) continue
        let n = 3; while (n < pts.length && num(pts[n].charge) === c0 && num(pts[n].reps) >= num(pts[n - 1].reps) && !_rcProgSecondaire(pts[n - 1], pts[n])) n++
        if (ctxA) R.attendu.push({ exo, c0, c1: c0, r0, r1 }); else R.bloque.push({ exo, c: c0, r: r0, n })
      }
    }
  }
  return R
}
// Bilan v2 (PUR, testable). `in_` = { perfs (brutes), appData (getAppData), secByExo
// (exercice→muscle secondaire), musByExo (exercice→muscle) }.
function _bilanRecapV2(in_: any, per: string, now: Date): any {
  const B = _recapBornes(per, now)
  const d0 = fmtYMD(B.debut), d1 = fmtYMD(B.fin), dp = fmtYMD(B.precDebut)
  const ad = in_.appData || {}, perfsAll = (in_.perfs || []).filter((r: any) => normDate(r.date))
  const inP = perfsAll.filter((r: any) => { const d = normDate(r.date); return d >= d0 && d < d1 })
  const inPrev = perfsAll.filter((r: any) => { const d = normDate(r.date); return d >= dp && d < d0 })
  const sem = B.jours / 7
  const out: any = { per, bornes: { debut: d0, fin: d1 }, label: B.label, sousTitre: B.sousTitre }
  // Régularité
  const objectif = Number(ad.dashboard && ad.dashboard.regularite && ad.dashboard.regularite.seances_prevues) || 0
  const jours = Array.from(new Set(inP.map((r: any) => normDate(r.date)))).sort()
  out.seances = jours.length
  out.seancesPrec = new Set(inPrev.map((r: any) => normDate(r.date))).size
  out.objectif = objectif
  out.prevues = objectif ? Math.round(objectif * sem) : 0
  if (per !== 'semaine') {
    const semaines: any[] = []
    let lun = getLundi(B.debut)
    while (fmtYMD(lun) < d1) {
      const dim = minus(lun, -7), a = fmtYMD(lun) < d0 ? d0 : fmtYMD(lun), b = fmtYMD(dim) > d1 ? d1 : fmtYMD(dim)
      const complete = fmtYMD(lun) >= d0 && fmtYMD(dim) <= d1
      semaines.push({ du: a, au: fmtYMD(minus(parseFR(b) as Date, 1)), n: jours.filter((j: any) => j >= a && j < b).length, complete })
      lun = dim
    }
    out.semaines = semaines
    out.semainesObjectif = objectif ? semaines.filter(s => s.complete && s.n >= objectif).length : null
    out.semainesCompletes = semaines.filter(s => s.complete).length
  }
  // Entraînement
  let ton = 0, reps = 0, rs = 0, rn = 0
  for (const r of inP) { const c = Number(r.charge) || 0, rp = Number(r.reps) || 0; ton += c * rp; reps += rp; if (Number(r.rpe) > 0) { rs += Number(r.rpe); rn++ } }
  out.tonnage = Math.round(ton); out.series = inP.length; out.reps = reps; out.rpe = rn ? Math.round(rs / rn * 10) / 10 : null
  out.tonnagePrec = Math.round(inPrev.reduce((s: number, r: any) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0))
  // Vrais records (source unique _recordsEvenements, partagée avec l'app) : meilleur par exercice sur la période.
  const recs: Record<string, any> = {}
  for (const e of _recordsEvenements(perfsAll)) { if (e.date < d0 || e.date >= d1) continue; const x = recs[e.exo]; if (!x || e.c > x.c || (e.c === x.c && e.r > x.r)) recs[e.exo] = e }
  out.records = Object.values(recs).sort((a: any, b: any) => b.c - a.c)
  // Lecture des exercices au dernier jour de la période (mêmes règles que l'app).
  const prog = (ad.historique && ad.historique.progression_par_exo) || {}
  const progAvant: Record<string, any[]> = {}
  for (const k of Object.keys(prog)) { const pts = (prog[k] || []).filter((p: any) => normDate(p.date) < d1); if (pts.length) progAvant[k] = pts }
  out.lecture = _rcLectureExos(progAvant, ad.programme || [], ad.exo_categories || {}, B.fin.getTime() - 4 * 3600e3, ad.contexte && ad.contexte.etat)
  // Volume par muscle (séries / semaine ; secondaire = 0,5) vs cibles volume_obti.
  const vm: Record<string, number> = {}
  for (const r of inP) {
    const m = normMuscle(r.muscle); if (m) vm[m] = (vm[m] || 0) + 1
    const s = normMuscle((in_.secByExo || {})[String(r.exercice || '').trim().toLowerCase()])
    if (s && s !== m) vm[s] = (vm[s] || 0) + 0.5
  }
  const progMus = new Set((ad.programme || []).filter((l: any) => l && l.type !== 'cardio').map((l: any) => normMuscle((in_.musByExo || {})[String(l.exercice || '').trim().toLowerCase()])).filter(Boolean))
  const cibles = (ad.volume_obti || []).map((v: any) => ({ muscle: normMuscle(v.muscle), min: Number(v.series_min) || 0, opt: Number(v.series_opt) || 0 }))
  const vol: any[] = [], horsProg: string[] = []
  for (const c of cibles) {
    const parSem = Math.round((vm[c.muscle] || 0) / sem * 10) / 10
    if (parSem <= 0 && !progMus.has(c.muscle)) { horsProg.push(c.muscle); continue }
    vol.push({ muscle: c.muscle, parSem, min: c.min, opt: c.opt, statut: parSem >= c.min ? 'ok' : 'bas' })
  }
  out.volume = out.series ? vol.sort((a, b) => b.parSem - a.parSem) : []
  out.horsProg = out.series ? horsProg : []
  // Balance en séries.
  const S = (m: string) => vm[m] || 0
  out.balance = [['Pectoraux', 'Dos'], ['Quadriceps', 'Ischio'], ['Biceps', 'Triceps']].map(([a, b]) => {
    const t = S(a) + S(b); if (t <= 0) return null
    const pa = Math.round(S(a) / t * 100); return { a: a === 'Ischio' ? 'Ischios' : a, b: b === 'Ischio' ? 'Ischios' : b, pa, pb: 100 - pa }
  }).filter(Boolean)
  // Forme : période vs normale (les 91 jours avant la période).
  const n0 = fmtYMD(minus(B.debut, 91))
  const moy = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
  const sh = Array.isArray(ad.sante_historique) ? ad.sante_historique : []
  const shP = (k: string, a: string, b: string, minV = 0) => sh.filter((x: any) => { const d = normDate(x.date); return d >= a && d < b && Number(x[k]) > minV }).map((x: any) => Number(x[k]))
  const montre: any = {}
  // Nuits < 3 h = enregistrement incomplet (montre retirée) → ignorées ; normale dès 14 nuits complètes.
  const sP = shP('sommeil_min', d0, d1, 179), sN = shP('sommeil_min', n0, d0, 179)
  if (sP.length) montre.sommeil = { v: Math.round(moy(sP) as number), n: sP.length, normale: sN.length >= 14 ? Math.round(moy(sN) as number) : null, nN: sN.length }
  const fP = shP('fc_repos', d0, d1), fN = shP('fc_repos', n0, d0)
  if (fP.length) montre.fc = { v: Math.round(moy(fP) as number), normale: fN.length >= 14 ? Math.round(moy(fN) as number) : null, nN: fN.length }
  const pP = shP('pas', d0, d1), pN = shP('pas', n0, d0)
  if (pP.length) montre.pas = { v: Math.round(moy(pP) as number), normale: pN.length >= 14 ? Math.round(moy(pN) as number) : null, nN: pN.length }
  out.montre = montre
  const be = Array.isArray(ad.bien_etre) ? ad.bien_etre : []
  const beV = (k: string, a: string, b: string) => be.filter((x: any) => { const d = normDate(x.date); return d >= a && d < b }).map((x: any) => Number(x[k])).filter((v: number) => !isNaN(v) && v > 0)
  out.forme = [['sommeil', 'Sommeil ressenti', false], ['fatigue', 'Fatigue musculaire', true], ['stress', 'Stress', true], ['courbatures', 'Courbatures', true]].map(([k, lab, inv]: any) => {
    const p = beV(k, d0, d1); if (!p.length) return null
    const n = beV(k, n0, d0), v = Math.round((moy(p) as number) * 10) / 10, nm = n.length >= 7 ? Math.round((moy(n) as number) * 10) / 10 : null
    const etat = nm == null ? 'nd' : (inv ? (v - nm >= 1 ? 'haut' : 'ok') : (nm - v >= 1 ? 'bas' : 'ok'))
    return { k, lab, v, normale: nm, nN: n.length, etat }
  }).filter(Boolean)
  // Cardio.
  const ch = ((ad.cardio && ad.cardio.history) || []).filter((s: any) => normDate(s.date))
  const chP = ch.filter((s: any) => { const d = normDate(s.date); return d >= d0 && d < d1 })
  const derniere = ch.map((s: any) => normDate(s.date)).filter((d: string) => d < d1).sort().pop() || null
  out.cardio = { n: chP.length, duree: chP.reduce((s: number, x: any) => s + (Number(x.duree) || 0), 0), types: chP.map((s: any) => String(s.type_cardio || 'autre')), derniere }
  // Recos (max 3) — mêmes règles que l'app, chiffres réels.
  const recos: string[] = []
  const bas = out.volume.filter((v: any) => v.statut === 'bas' && v.min > 0)
  if (bas.length) {
    const JAMBES = ['Quadriceps', 'Ischio', 'Fessier', 'Mollets', 'Adducteur']
    const titre = bas.every((v: any) => JAMBES.indexOf(v.muscle) >= 0) ? 'Jambes sous le minimum' : 'Volume sous le minimum'
    const nm = (m: string) => ({ Ischio: 'ischios', Fessier: 'fessiers', Epaule: 'épaules', Abdominaux: 'abdominaux' } as any)[m] || m.toLowerCase()
    recos.push(`<b>${titre}</b> : ` + bas.map((v: any) => `${nm(v.muscle)} ${_frNum(v.parSem)} séries/sem. (min. ${v.min})`).join(', ') + '. Pour atteindre le minimum, il manque environ ' + bas.map((v: any) => `${Math.max(1, Math.round(v.min - v.parSem))} séries/sem. ${['Ischio', 'Fessier'].indexOf(v.muscle) >= 0 ? 'aux' : 'aux'} ${nm(v.muscle)}`).join(', ').replace(/, ([^,]*)$/, ' et $1') + '.')
  }
  const L = out.lecture
  const sous = (L.sous || []).slice().sort((a: any, b: any) => (b.rpe - a.rpe) || (a.r - b.r))[0]
  if (sous) {
    const same = (sous.hist || []).filter((h: any) => h.c === sous.c).map((h: any) => h.r)
    const desc = same.length >= 2 ? `à ${_frNum(sous.c)} kg tu es passé de ${same.slice(0, -1).join(' à ')} puis ${same[same.length - 1]} rep${same[same.length - 1] > 1 ? 's' : ''} (RPE ${_frNum(sous.rpe)})` : `${_frNum(sous.c)} kg × ${sous.r} à RPE ${_frNum(sous.rpe)}, sous ta fourchette (${sous.rmin}-${sous.rmax})`
    recos.push(`<b>${_escHtml(sous.exo)}</b> : ${desc}. Au choix : alléger un peu pour revenir à ${sous.rmin} reps, ou garder ${_frNum(sous.c)} kg et viser +1 rep.`)
  } else if ((L.recule || []).length) {
    const x = L.recule[0]; recos.push(`<b>${_escHtml(x.exo)}</b> : charge et reps en baisse (${_frNum(x.c1)} kg × ${x.r1} → ${_frNum(x.c0)} kg × ${x.r0}). Vérifie ta récupération avant d'insister.`)
  } else if ((L.bloque || []).length) {
    const x = L.bloque[0]; recos.push(`<b>${_escHtml(x.exo)}</b> : ${_frNum(x.c)} kg × ${x.r} depuis ${x.n} séances. Pour débloquer : un repos un peu plus long, le placer plus tôt dans la séance, ou viser RPE 8-9 sur toutes tes séries.`)
  }
  const ilYa = derniere ? Math.round((B.fin.getTime() - (parseFR(derniere) as Date).getTime()) / 864e5) : null
  if (ilYa == null) recos.push('<b>Cardio</b> : aucune sortie enregistrée. 1 à 2 sorties par semaine pour ta base d\'endurance.')
  else if (ilYa > 14) recos.push(`<b>Cardio</b> : aucune sortie depuis le ${fmtFR(derniere).slice(0, 5)}. 1 à 2 sorties par semaine pour ta base d'endurance.`)
  out.recos = out.series || ch.length ? recos.slice(0, 3) : []
  // D6 (04/11) : athlète avec coach (sans autorisation du coach) → pas de recos Novalyz, les consignes viennent du coach.
  if (ad.propositions_novalyz === false) { out.recos = []; out.recos_coach = true }
  return out
}
function _frNum(v: any): string { const n = Number(v); if (isNaN(n)) return String(v); return (Math.round(n * 10) / 10).toLocaleString('fr-FR') }
function _emailRecapV2HTML(prenom: string, b: any): string {
  const td = 'background:#0f1522;border:1px solid #243049;border-radius:12px;padding:12px 10px'
  const h3 = (t: string, s = '') => `<h3 style="font-size:15px;margin:20px 0 9px;font-family:Arial,sans-serif;color:#e9eef8">${t}${s ? ` <span style="font-weight:400;font-size:12px;color:#6f7b96">${s}</span>` : ''}</h3>`
  const grid2 = (cells: string[]) => { let h = ''; for (let i = 0; i < cells.length; i += 2) h += `<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:0 8px"><tr><td width="50%" valign="top" style="padding-right:4px">${cells[i]}</td><td width="50%" valign="top" style="padding-left:4px">${cells[i + 1] || ''}</td></tr></table>`; return h }
  const tile = (val: string, lab: string, vs = '', vsCol = '#6f7b96') => `<div style="${td};text-align:center"><div style="font-size:19px;font-weight:800;color:#e9eef8;line-height:1.1">${val}</div><div style="font-size:11px;color:#8b96b0;margin-top:4px">${lab}</div>${vs ? `<div style="font-size:10.5px;color:${vsCol};margin-top:3px">${vs}</div>` : ''}</div>`
  const ligne = (g: string, d: string, last = false) => `<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="font-size:13px;color:#cdd6ea;padding:6px 0;${last ? '' : 'border-bottom:1px solid #1c2740'}">${g}</td><td style="font-size:13px;text-align:right;padding:6px 0;white-space:nowrap;${last ? '' : 'border-bottom:1px solid #1c2740'}">${d}</td></tr></table>`
  const card = (inner: string) => `<div style="${td}">${inner}</div>`
  let h = ''
  // Régularité
  if (!b.seances && b.prevues) h += h3('Ta régularité', b.objectif ? `objectif ${b.objectif} séances / semaine` : '') + card(`<div style="font-size:13px;color:#cdd6ea">Aucune séance enregistrée sur la période. Ton bilan se remplira dès tes prochaines séances.</div>`)
  else if (b.seances) {
    const pct = b.prevues ? Math.round(100 * b.seances / b.prevues) : null
    const roue = pct != null ? _roueImg(Math.min(100, pct), 104, 'b', pct + '%') : `<div style="font-size:30px;font-weight:800;color:#4d82ff">${b.seances}</div>`
    let reg = `<div style="${td};text-align:center">${roue}<div style="font-size:13px;color:#e9eef8;margin-top:8px"><b>${b.seances} séance${b.seances > 1 ? 's' : ''}</b>${b.prevues ? ` <span style="color:#8b96b0">/ ${b.prevues} prévues</span>` : ''}</div>${b.per !== 'semaine' || b.seancesPrec ? `<div style="font-size:11px;color:#6f7b96;margin-top:3px">période précédente : ${b.seancesPrec}</div>` : ''}</div>`
    if (b.semaines && b.semaines.length) {
      const mx = Math.max(b.objectif || 1, ...b.semaines.map((s: any) => s.n), 1)
      const cols = b.semaines.map((s: any) => { const col = !s.complete ? '#4d82ff66' : (b.objectif && s.n >= b.objectif ? '#37d39a' : '#fab219'); return `<td valign="bottom" align="center" style="padding:0 3px;font-size:10.5px;color:#8b96b0;font-family:Arial,sans-serif"><div style="font-size:11px;color:#e9eef8;font-weight:700;margin-bottom:3px">${s.n}</div><div style="height:${Math.max(4, Math.round(44 * s.n / mx))}px;background:${col};border-radius:5px 5px 2px 2px;font-size:0;line-height:0">&nbsp;</div><div style="margin-top:4px">${s.du.slice(8, 10)}/${s.du.slice(5, 7)}${s.complete ? '' : '*'}</div></td>` }).join('')
      reg += `<div style="${td};margin-top:8px"><div style="font-size:11px;color:#8b96b0;margin-bottom:6px">Séances par semaine (début de semaine)</div><table role="presentation" width="100%" style="border-collapse:collapse;height:80px"><tr>${cols}</tr></table><div style="font-size:11px;color:#6f7b96;margin-top:6px">${b.objectif ? `${b.semainesObjectif} semaine${b.semainesObjectif > 1 ? 's' : ''} à l'objectif sur ${b.semainesCompletes} complète${b.semainesCompletes > 1 ? 's' : ''}` : ''}${b.semaines.some((s: any) => !s.complete) ? ' · *semaine incomplète' : ''}</div></div>`
    }
    h += h3('Ta régularité', b.objectif ? `objectif ${b.objectif} séances / semaine` : '') + reg
  }
  // Entraînement
  if (b.series) {
    h += h3('Ton entraînement', b.label) + grid2([
      tile(_frNum(b.tonnage) + '<span style="font-size:12px;color:#8b96b0;font-weight:600"> kg</span>', 'Tonnage', b.tonnagePrec ? 'période préc. ' + _frNum(b.tonnagePrec) : ''),
      tile(String(b.series), 'Séries'), tile(_frNum(b.reps), 'Reps'), tile(b.rpe != null ? _frNum(b.rpe) : '—', 'RPE moyen')])
    const L = b.lecture || {}
    h += h3('Tes exercices', 'même lecture que dans l\'app · fin de période') + card(
      ligne('★ Records battus', `<b style="color:#37d39a">${b.records.length}</b>`) + ligne('▲ En progrès', `<b style="color:#37d39a">${(L.progresse || []).length}</b>`)
      + ligne('! Sous ta fourchette', `<b style="color:${(L.sous || []).length ? '#fab219' : '#8b96b0'}">${(L.sous || []).length}</b>`) + ligne('▼ En recul ou bloqués', `<b style="color:${((L.recule || []).length + (L.bloque || []).length) ? '#fab219' : '#8b96b0'}">${(L.recule || []).length + (L.bloque || []).length}</b>`, true))
    if (b.records.length) {
      const top = b.records.slice(0, 4)
      h += h3('Tes vrais records', 'charge (ou reps à charge égale) jamais atteinte avant') + card(top.map((r: any, i: number) => ligne(_escHtml(r.exo), `<b style="color:#37d39a">${_frNum(r.c)} kg × ${r.r}</b> <span style="color:#8b96b0">${r.date.slice(8, 10)}/${r.date.slice(5, 7)}</span>`, i === top.length - 1)).join('')
        + (b.records.length > 4 ? `<div style="font-size:11px;color:#6f7b96;margin-top:6px">+ ${b.records.length - 4} autre${b.records.length - 4 > 1 ? 's' : ''} record${b.records.length - 4 > 1 ? 's' : ''} sur la période.</div>` : ''))
    }
    if (b.volume.length) {
      const NM: any = { Ischio: 'Ischios', Fessier: 'Fessiers', Epaule: 'Épaules' }
      h += h3('Volume par muscle', 'séries / semaine en moyenne · cibles de l\'app') + card(b.volume.map((v: any) => {
        const col = v.statut === 'ok' ? '#37d39a' : '#ff6b6b', w = v.opt ? Math.max(3, Math.min(100, Math.round(v.parSem / v.opt * 100))) : 3
        return `<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="font-size:13px;color:#cdd6ea">${_escHtml(NM[v.muscle] || v.muscle)}</td><td style="text-align:right;font-size:12px;font-weight:700;color:${col};white-space:nowrap">${_frNum(v.parSem)} · ${v.statut === 'ok' ? `cible ${v.min}–${v.opt}` : `min. ${v.min}`}</td></tr></table><table role="presentation" width="100%" style="border-collapse:collapse;background:#0b111c;border-radius:7px;margin:4px 0 9px"><tr><td width="${w}%" style="background:${col};height:11px;border-radius:7px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0">&nbsp;</td></tr></table>`
      }).join('') + `<div style="font-size:11px;color:#6f7b96;line-height:1.5">${b.horsProg.length ? `Pas dans ton programme sur la période : ${b.horsProg.map((m: string) => (NM[m] || m).toLowerCase()).join(', ')}. · ` : ''}Muscles secondaires comptés 0,5 série (comme dans l'app).</div>`)
    }
    if (b.balance.length) {
      h += h3('Balance musculaire', 'en séries') + card(b.balance.map((p: any) => `<table role="presentation" width="100%" style="border-collapse:collapse"><tr><td style="font-size:12.5px;color:#cdd6ea">${p.a} <b style="color:#e9eef8">${p.pa}%</b></td><td style="text-align:right;font-size:12.5px;color:#cdd6ea"><b style="color:#e9eef8">${p.pb}%</b> ${p.b}</td></tr></table><table role="presentation" width="100%" style="border-collapse:collapse;margin:4px 0 11px"><tr><td width="${p.pa}%" style="background:#1A5FFF;height:13px;font-size:0;line-height:0">&nbsp;</td><td width="${p.pb}%" style="background:#9D5FD3;height:13px;font-size:0;line-height:0">&nbsp;</td></tr></table>`).join('')
        + `<div style="font-size:11px;color:#6f7b96">Équilibré entre 40 et 60 %.${b.balance.every((p: any) => p.pa >= 40 && p.pa <= 60) ? ' Ici tout est équilibré.' : ''}</div>`)
    }
  }
  // Forme (montre + ressenti) — chaque tuile seulement si la donnée existe.
  const fc: string[] = [], m = b.montre || {}
  if (m.sommeil) fc.push(tile(_fmtDuree(m.sommeil.v), 'Sommeil (montre)', m.sommeil.normale != null ? 'normale ' + _fmtDuree(m.sommeil.normale) : `normale dès 14 nuits complètes (${m.sommeil.nN})`))
  if (m.fc) fc.push(tile(String(m.fc.v), 'FC repos (bpm)', m.fc.normale != null ? 'normale ' + m.fc.normale : `normale dès 14 mesures (${m.fc.nN})`))
  if (m.pas) fc.push(tile(_frNum(m.pas.v), 'Pas / jour', m.pas.normale != null ? 'normale ' + _frNum(m.pas.normale) : ''))
  for (const f of b.forme || []) fc.push(tile(_frNum(f.v) + '<span style="font-size:12px;color:#8b96b0;font-weight:600">/5</span>', f.lab, f.etat === 'nd' ? 'normale dès 7 saisies' : (f.etat === 'ok' ? `dans ta normale (${_frNum(f.normale)})` : `${f.etat === 'bas' ? 'sous' : 'au-dessus de'} ta normale (${_frNum(f.normale)})`), f.etat === 'ok' ? '#37d39a' : (f.etat === 'nd' ? '#6f7b96' : '#fab219')))
  if (fc.length) h += h3('Ta forme', 'moyenne de la période · vs ta normale (les 3 mois d\'avant)') + grid2(fc)
  // Cardio
  if (b.cardio && (b.cardio.n || b.cardio.derniere)) {
    const LB: any = { marche_normale: 'marche', velo: 'vélo', footing: 'footing', course: 'course', natation: 'natation', rameur: 'rameur', hyrox: 'Hyrox', autre: 'autre' }
    const cnt: any = {}; (b.cardio.types || []).forEach((t: string) => { cnt[t] = (cnt[t] || 0) + 1 })
    const txt = b.cardio.n ? Object.keys(cnt).map(t => `${cnt[t]} ${LB[t] || t}${cnt[t] > 1 && !/s$/.test(LB[t] || t) ? 's' : ''}`).join(', ') + ' · ' + _fmtDuree(b.cardio.duree) : 'Aucune sortie sur la période'
    h += h3('Cardio', b.label) + card(`<div style="font-size:13px;color:#cdd6ea">${txt}${b.cardio.derniere ? ` · dernière sortie le ${fmtFR(b.cardio.derniere).slice(0, 5)}` : ''}.</div>`)
  }
  // Recos
  if (b.recos_coach) h += h3('Tes consignes') + `<div style="background:#13213f;border:1px solid #27407a;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.5;color:#d6e2ff">Les consignes de la semaine viennent de ton coach : retrouve-les dans ton programme et ta conversation.</div>`
  if (b.recos && b.recos.length) h += h3('Ce que Novalyz retient') + `<div style="background:#13213f;border:1px solid #27407a;border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.5;color:#e9eef8">${b.recos.map((r: string, i: number) => `<div style="padding:4px 0">${i + 1}. ${r}</div>`).join('')}</div>`
  if (!h) h = `<p style="font-size:13px;color:#cdd6ea">Pas encore de séance enregistrée sur la période. Ton bilan se remplira dès tes premières séances.</p>`
  h += `<p style="margin:18px 0 0;color:#8b96b0;font-size:12px">Ouvre Novalyz pour le détail de ${b.per === 'semaine' ? 'ta semaine' : b.per === 'mois' ? 'ton mois' : 'ton trimestre'}.</p>`
  return _emailShell('Bonjour ' + (prenom || 'athlète'), b.sousTitre, h)
}

function _periodeLabel(periode: string): string {
  return periode === '3mois' ? 'des 3 derniers mois' : periode === 'mois' ? 'du mois' : 'de la semaine'
}
// Envoi des résumés par e-mail. Deux modes :
//  • MANUEL (défaut) : envoie à TOUS ceux qui ont un e-mail, avec la `periode` donnée
//    (utilisé pour les tests à la demande).
//  • AUTO (`auto:true`, appelé chaque jour par le cron) : n'envoie qu'aux comptes
//    dont la fréquence choisie (recap_freq) tombe AUJOURD'HUI, et avec la période
//    correspondante. Hebdo = lundi · Mensuel = le 1er du mois · Trimestriel =
//    le 1er de janv/avr/juil/oct. Pas d'état « dernier envoi » : le calendrier suffit.
async function handleCronResumes(body: any): Promise<Response> {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || String(body.secret || '') !== secret) return jsonResp({ error: 'unauthorized' }, 401)
  const auto = body.auto === true || String(body.auto) === 'true'
  const periode = ['mois', '3mois'].indexOf(String(body.periode || '')) >= 0 ? String(body.periode) : 'semaine'
  const now = new Date()
  const dom = now.getUTCDate(), dow = now.getUTCDay(), mon = now.getUTCMonth() + 1
  const isWeekly = dow === 1, isMonthly = dom === 1, isQuarterly = dom === 1 && [1, 4, 7, 10].indexOf(mon) >= 0
  // Fréquence d'un compte → période à envoyer aujourd'hui (null = rien aujourd'hui).
  const periodeFor = (freq: string): string | null => {
    if (!auto) return periode                      // mode manuel : on envoie toujours
    const f = String(freq || 'off')
    if (f === 'semaine') return isWeekly ? 'semaine' : null
    if (f === 'mois') return isMonthly ? 'mois' : null
    if (f === '3mois') return isQuarterly ? '3mois' : null
    return null                                     // 'off' / inconnu → jamais
  }

  let coachsOk = 0, coachsSkip = 0, athletesOk = 0, athletesSkip = 0

  const demo = await _comptesDemo()   // 09/11 : comptes démo/test exclus des résumés automatiques
  // 1) Coachs — un résumé d'équipe par coach ayant un e-mail.
  try {
    const { data: coachs } = await sb().from('coachs').select('coach_id,nom,email,recap_freq')
    for (const c of coachs || []) {
      if (demo.coach.has(String((c as any).coach_id))) { coachsSkip++; continue }
      const email = String((c as any).email || '').trim()
      const per = periodeFor((c as any).recap_freq)
      if (!email || !per) { coachsSkip++; continue }
      try {
        const res = await handleGetSuiviEquipe(new URLSearchParams({ coach_id: String((c as any).coach_id) }))
        const data: any = await res.json()
        const prenom = String((c as any).nom || '').split(/\s+/)[0]
        const html = _emailResumeEquipeHTML(prenom, per, data)
        const sujet = `Novalyz — Résumé ${_periodeLabel(per)} de ton équipe`
        if (await _envoyerEmail(email, sujet, html)) coachsOk++; else coachsSkip++
      } catch (_) { coachsSkip++ }
    }
  } catch (_) { /* best-effort */ }

  // 2) Athlètes — un bilan perso par athlète ayant un e-mail.
  try {
    const { data: aths } = await sb().from('athletes').select('id,nom,email,annees,recap_freq,created_at')
    for (const a of aths || []) {
      if (demo.ath.has(String((a as any).id))) { athletesSkip++; continue }
      const email = String((a as any).email || '').trim()
      const per = periodeFor((a as any).recap_freq)
      if (!email || !per) { athletesSkip++; continue }
      const aid = String((a as any).id)
      try {
        // Mail récap v2 (01/11) : mêmes données que l'app (getAppData) + séries brutes
        // (records, volume) + catalogue (muscle secondaire). Voir _bilanRecapV2.
        const [{ data: perfs }, { data: exos }, appRes] = await Promise.all([
          _toutLire(() => sb().from('performances').select('date,exercice,muscle,charge,reps,rpe,serie,seance_id').eq('athlete_id', aid).order('id')),
          sb().from('exercices').select('exercice,muscle,muscle_secondaire'),
          handleGetAppData(new URLSearchParams({ athlete_id: aid })),
        ])
        const appData: any = await appRes.json()
        const secByExo: Record<string, string> = {}, musByExo: Record<string, string> = {}
        for (const e of exos || []) { const k = String((e as any).exercice || '').trim().toLowerCase(); if (!k) continue; if ((e as any).muscle_secondaire) secByExo[k] = String((e as any).muscle_secondaire); if ((e as any).muscle) musByExo[k] = String((e as any).muscle) }
        const bilan = _bilanRecapV2({ perfs: perfs || [], appData, secByExo, musByExo }, per, now)
        const prenom = String((a as any).nom || '').split(/\s+/)[0]
        const html = _emailRecapV2HTML(prenom, bilan)
        const sujet = `Novalyz — ${bilan.sousTitre.split(' · ')[0]}`
        if (await _envoyerEmail(email, sujet, html)) athletesOk++; else athletesSkip++
      } catch (_) { athletesSkip++ }
    }
  } catch (_) { /* best-effort */ }

  return jsonResp({ ok: true, auto, periode, coachsOk, coachsSkip, athletesOk, athletesSkip })
}

// Enregistre la fréquence de recap choisie (athlète OU coach). Valeurs acceptées :
// 'off' | 'semaine' | 'mois' | '3mois'. Le front envoie athlete_id OU coach_id.
// P9 (05/11) : formulaire « Envoyer un retour » → hello@novalyz.fr (l'adresse perso n'apparaît plus dans l'app).
const CONTACT_NOVALYZ = 'hello@novalyz.fr'
async function handleEnvoyerRetour(body: any): Promise<Response> {
  const msg = String(body.message || '').trim().slice(0, 3000)
  if (msg.length < 3) return jsonResp({ success: false, error: 'Message vide' })
  const role = body._sessRole === 'c' ? 'c' : (body._sessRole === 'a' ? 'a' : ''), id = String(body._sessId || '')
  let qui = 'inconnu', mail = ''
  try {
    if (role === 'c') { const { data } = await sb().from('coachs').select('nom,email').eq('coach_id', id).single(); qui = 'Coach ' + String((data as any)?.nom || id) + ' (id ' + id + ')'; mail = String((data as any)?.email || '') }
    else if (role === 'a') { const { data } = await sb().from('athletes').select('nom,email').eq('id', id).single(); qui = 'Athlète ' + String((data as any)?.nom || id) + ' (id ' + id + ')'; mail = String((data as any)?.email || '') }
  } catch (_) {}
  // 11/11 — Bouton « Signaler un problème / une idée » (athlète ET coach) : le retour est ENREGISTRÉ
  // (table retours, migration 20261111150000) avec l'écran, la version et la plateforme, puis envoyé par
  // e-mail comme avant. Table absente (migration pas encore appliquée) → e-mail seul, comme avant.
  const type = RETOUR_TYPES.includes(String(body.type)) ? String(body.type) : 'autre'
  const court = (v: any, n: number) => { const s = String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); return s || null }
  const ecran = court(body.ecran, 60), version = court(body.version, 60)
  const plateforme = ['web', 'android', 'ios'].includes(String(body.plateforme)) ? String(body.plateforme) : null
  const compte = role === 'c' ? COACH_PUSH_PREFIX + id : id
  let enregistre = false
  if (role && id) {
    try {
      // Anti-abus : RETOURS_MAX_JOUR retours par compte sur 24 h glissantes.
      const depuis = new Date(Date.now() - 86_400_000).toISOString()
      const { data: recents, error: eLire } = await sb().from('retours').select('id').eq('compte_id', compte).gte('created_at', depuis).limit(RETOURS_MAX_JOUR)
      if (!eLire && (recents || []).length >= RETOURS_MAX_JOUR) return jsonResp({ success: false, error: 'Tu as déjà envoyé beaucoup de retours aujourd\'hui. Réessaie demain.' })
      if (!eLire) {
        const { error: eIns } = await sb().from('retours').insert({ role, compte_id: compte, type, message: msg, ecran, version, plateforme })
        enregistre = !eIns
      }
    } catch (_) { /* table absente : e-mail seul */ }
  }
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const contexte = [RETOUR_LIBELLES[type], ecran ? 'écran : ' + ecran : '', version ? 'version : ' + version : '', plateforme || ''].filter(Boolean).join(' · ')
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5"><p><b>Retour depuis l'app</b> — ${esc(qui)}${mail ? ' · ' + esc(mail) : ''}</p><p style="color:#555">${esc(contexte)}</p><p style="white-space:pre-wrap">${esc(msg)}</p></div>`
  const ok = await _envoyerEmail(CONTACT_NOVALYZ, 'Retour Novalyz [' + RETOUR_LIBELLES[type] + '] — ' + qui, html)
  return jsonResp(ok || enregistre ? { success: true, enregistre } : { success: false, error: 'Envoi impossible pour le moment' })
}
const RETOUR_TYPES = ['bug', 'idee', 'autre']
const RETOUR_LIBELLES: Record<string, string> = { bug: 'Problème', idee: 'Idée', autre: 'Autre' }
const RETOURS_MAX_JOUR = 20

// Site vitrine (lot 4, 07/11) : formulaire « Rejoindre la bêta » (www.novalyz.com/beta). Action PUBLIQUE.
// Anti-spam : champ piège (site_web, invisible pour un humain) + 5 envois / heure / IP (mémoire de l'instance).
// Un e-mail déjà inscrit est mis à jour sans nouvel e-mail de notification. Réponse identique dans tous les cas
// (on ne révèle pas si une adresse est déjà inscrite). Table : supabase/beta_inscriptions.sql.
const BETA_PROFILS = ['athlete', 'coach', 'structure'], BETA_APPAREILS = ['android', 'iphone', 'ordinateur']
const _betaRate = new Map<string, { n: number; exp: number }>()
async function handleInscriptionBeta(body: any, ip = 'unknown'): Promise<Response> {
  if (String(body.site_web || '').trim()) return jsonResp({ success: true })          // robot : on ne dit rien
  const now = Date.now(), r = _betaRate.get(ip)
  if (r && r.exp > now && r.n >= 5) return jsonResp({ success: false, error: 'Trop d’envois. Réessaie dans une heure.' })
  if (!r || r.exp <= now) _betaRate.set(ip, { n: 1, exp: now + 3_600_000 }); else r.n++
  const prenom = String(body.prenom || '').trim().replace(/\s+/g, ' ')
  const email = String(body.email || '').trim().toLowerCase()
  const profil = String(body.profil || ''), appareil = String(body.appareil || '')
  const message = String(body.message || '').trim().slice(0, 1000) || null
  const source = (String(body.source || '').toLowerCase().match(/^[a-z0-9_-]{1,30}$/) || [null])[0]
  if (!prenom || prenom.length > 60) return jsonResp({ success: false, error: 'Indique ton prénom.' })
  if (!email || email.length > 200 || !_emailValide(email)) return jsonResp({ success: false, error: 'E-mail invalide.' })
  if (BETA_PROFILS.indexOf(profil) < 0) return jsonResp({ success: false, error: 'Choisis ton profil.' })
  if (BETA_APPAREILS.indexOf(appareil) < 0) return jsonResp({ success: false, error: 'Choisis ton appareil.' })
  const { data: ex } = await sb().from('beta_inscriptions').select('id').eq('email', email).maybeSingle()
  if (ex) {
    await sb().from('beta_inscriptions').update({ prenom, profil, appareil, message, updated_at: new Date().toISOString() }).eq('id', (ex as any).id)
    return jsonResp({ success: true })
  }
  const { error } = await sb().from('beta_inscriptions').insert({ prenom, email, profil, appareil, message, source })
  if (error) { console.error('beta: insertion refusée'); return jsonResp({ success: false, error: 'Enregistrement impossible pour le moment.' }) }
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lib: Record<string, string> = { athlete: 'Athlète', coach: 'Coach', structure: 'Structure', android: 'Android', iphone: 'iPhone', ordinateur: 'Ordinateur' }
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5"><p><b>Nouvelle inscription bêta</b> (site)</p>
    <p>${esc(prenom)} · ${esc(email)}<br>${lib[profil]} · ${lib[appareil]}${source ? ' · source : ' + esc(source) : ''}</p>${message ? `<p style="white-space:pre-wrap">${esc(message)}</p>` : ''}
    <p style="color:#666">${appareil === 'android' ? 'À ajouter à la liste des testeurs Google Play (adresse du compte Google).' : 'À qui envoyer le lien de l’app web : https://app.novalyz.fr'}</p></div>`
  await _envoyerEmail(CONTACT_NOVALYZ, 'Bêta Novalyz — ' + prenom + ' (' + lib[profil] + ', ' + lib[appareil] + ')', html)
  return jsonResp({ success: true })
}

async function handleSaveRecapFreq(body: any): Promise<Response> {
  const freq = ['off', 'semaine', 'mois', '3mois'].indexOf(String(body.freq || '')) >= 0 ? String(body.freq) : null
  if (!freq) return jsonResp({ success: false, error: 'Fréquence invalide' })
  const athlete_id = String(body.athlete_id || '')
  const coach_id = String(body.coach_id || '')
  try {
    if (athlete_id) {
      const { error } = await sb().from('athletes').update({ recap_freq: freq }).eq('id', athlete_id)
      if (error) return jsonResp({ success: false, error: error.message })
    } else if (coach_id) {
      const { error } = await sb().from('coachs').update({ recap_freq: freq }).eq('coach_id', coach_id)
      if (error) return jsonResp({ success: false, error: error.message })
    } else {
      return jsonResp({ success: false, error: 'Identifiant manquant' })
    }
  } catch (e) { return jsonResp({ success: false, error: String(e) }) }
  return jsonResp({ success: true, freq })
}

async function handleSaveNativePushToken(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const token = String(body.token || '')
  const platform = String(body.platform || '')
  if (!athlete_id || !token) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const row = { token, athlete_id, platform, created_at: new Date().toISOString() }
  // N1 (01/11) : un même téléphone peut recevoir les notifs ATHLÈTE et COACH → clé (token, athlete_id).
  let { error } = await sb().from('native_push_tokens').upsert(row, { onConflict: 'token,athlete_id' })
  // Repli tant que la table n'a pas encore la clé (token, athlete_id) (migration native_push_tokens_v2.sql).
  if (error) ({ error } = await sb().from('native_push_tokens').upsert(row, { onConflict: 'token' }))
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

async function handleDeleteNativePushToken(body: any): Promise<Response> {
  const token = String(body.token || '')
  if (!token) return jsonResp({ success: false, error: 'token manquant' })
  // Sécurité (audit P2.1, 11/11) : on ne supprime que la ligne de la personne connectée (athlète : son id ;
  // coach : « coach:<id> », COACH_PUSH_PREFIX), jamais selon l'athlete_id envoyé par l'app. Avant : sans
  // athlete_id, n'importe quel compte effaçait le jeton d'un autre ; un coach effaçait celui de son athlète.
  // Désactiver pour UN rôle ne coupe toujours pas l'autre rôle du même téléphone (N1, clé token + athlete_id).
  const sid = String(body._sessId || '')
  if (!sid) return jsonResp({ success: true })
  const proprio = body._sessRole === 'c' ? COACH_PUSH_PREFIX + sid : sid
  const { error } = await sb().from('native_push_tokens').delete().eq('token', token).eq('athlete_id', proprio)
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
  // Canal natif (FCM) : diagnostic en parallèle du Web Push.
  let fcm: any = { configured: false, found: 0, sent: 0 }
  try {
    if (_fcmServiceAccount()) {
      const r = await sendFcmToAthlete(athlete_id, { title: '🔔 Test Novalyz', body: 'Si tu vois ceci, les notifications marchent !', target: '', url: './' })
      fcm = { configured: true, found: r.found, sent: r.sent, error: r.error || null }
    }
  } catch (e: any) { fcm = { configured: true, found: 0, sent: 0, error: String((e && e.message) || e).slice(0, 200) } }
  return jsonResp({ success: true, vapid, subsFound: subs?.length || 0, sent: results.filter(r => r.ok).length, results, fcm })
}

// Heure d'un message en heure de PARIS (audit Messagerie M1, 01/11 : avant, heure UTC → −1 / −2 h).
function _dateParis(d: Date): string {
  try {
    const p: Record<string, string> = {}
    for (const x of new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)) p[x.type] = x.value
    return `${p.day}/${p.month}/${p.year} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
  } catch (_) { return `${fmtFR(fmtYMD(d))} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
}
const MSG_MAX = 4000
async function handleSaveCommentaire(body: any): Promise<Response> {
  const { athlete_id, texte, message } = body
  const msg = String(message || texte || '').trim()
  if (!athlete_id || !msg) return jsonResp({ success: false, error: 'Paramètres manquants' })
  if (msg.length > MSG_MAX) return jsonResp({ success: false, error: `Message trop long (${MSG_MAX} caractères maximum).` })
  // Audit Messagerie (01/11) — M3 : l'auteur vient de la SESSION (posée par authCheck), pas de l'app ;
  // M2 : le coach destinataire et les noms viennent de la base.
  const roleSess = body._sessRole
  const aut = roleSess === 'a' ? 'athlete' : roleSess === 'c' ? 'coach' : (body.auteur === 'athlete' ? 'athlete' : 'coach')
  const { data: aRow } = await sb().from('athletes').select('coach_id,nom').eq('id', String(athlete_id)).single()
  const coachIdMsg = aut === 'coach' ? String(body.coach_id || (aRow as any)?.coach_id || '') : String((aRow as any)?.coach_id || '')
  let coachNom = ''
  if (coachIdMsg) { try { const { data: c } = await sb().from('coachs').select('nom').eq('coach_id', coachIdMsg).single(); coachNom = String((c as any)?.nom || '') } catch (_) {} }
  const auteurNom = aut === 'athlete' ? String((aRow as any)?.nom || '').trim().split(/\s+/)[0] : coachNom
  // M5 : même message du même auteur reçu il y a < 5 s → doublon (double envoi), ignoré.
  const now = Date.now()
  const { data: rec } = await sb().from('commentaires').select('comment_id,message').eq('athlete_id', String(athlete_id)).eq('auteur', aut).gte('comment_id', now - 5000)
  if ((rec || []).some((r: any) => String(r.message) === msg)) return jsonResp({ success: true, deja: true })
  const { error } = await sb().from('commentaires').insert({ comment_id: now, date: _dateParis(new Date(now)), coach_id: coachIdMsg, coach_nom: coachNom, athlete_id, message: msg, lu: false, auteur: aut, auteur_nom: auteurNom })
  if (error) return jsonResp({ success: false, error: error.message })
  const coach_nom = coachNom, auteur_nom = auteurNom
  // Notif push : coach → athlète (Étape A) ; athlète → SON coach (audit Notifications N2, 01/11).
  // Le coach est lu en base (pas celui envoyé par le client).
  if (aut === 'athlete') {
    try {
      const { data: aRow } = await sb().from('athletes').select('coach_id,nom').eq('id', String(athlete_id)).single()
      const cId = aRow && (aRow as any).coach_id ? String((aRow as any).coach_id) : ''
      const prM = cId ? await _coachPrefs(cId) : null
      if (cId && prM && prM.notif.messages && !_heuresCalmes(prM)) {   // P4 (05/11) : réglage + heures calmes (sinon : résumé du matin)
        const who = (aRow && (aRow as any).nom) ? String((aRow as any).nom).trim().split(/\s+/)[0] : 'Ton athlète'
        const apercuA = msg.length > 90 ? msg.slice(0, 87) + '…' : msg
        await notifyCoach(cId, { title: `💬 ${who}`, body: apercuA, tag: 'novalyz-msg-coach', target: 'coach-messages' })
      }
    } catch (_) {}
  }
  if (aut === 'coach') {
    const expediteur = String(coach_nom || auteur_nom || 'Ton coach')
    const apercu = msg.length > 90 ? msg.slice(0, 87) + '…' : msg
    try { await notifyAthlete(String(athlete_id), { title: `💬 ${expediteur}`, body: apercu, tag: 'novalyz-msg', target: 'conversation' }) } catch (_) {}
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
  // M4 (01/11) : chacun ne supprime que SES messages (auteur = rôle de la session).
  if (body._sessRole === 'a' || body._sessRole === 'c') {
    const { data: rowA } = await sb().from('commentaires').select('auteur').eq('comment_id', id).limit(1).single()
    const estAth = String((rowA as any)?.auteur || '') === 'athlete'
    if (rowA && (body._sessRole === 'a') !== estAth) return jsonResp({ success: false, error: 'Tu ne peux supprimer que tes propres messages.' })
  }
  // Si le message portait un média (photo/vidéo), on supprime aussi le fichier
  // du bucket privé (pas d'orphelin qui traîne).
  try {
    const { data: row } = await sb().from('commentaires').select('media_path').eq('comment_id', id).limit(1).single()
    if (row && row.media_path) { try { await sb().storage.from('coach-media').remove([row.media_path]) } catch (_) {} }
  } catch (_) {}
  const { error } = await sb().from('commentaires').delete().eq('comment_id', id)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

// ── Médias athlète → coach (photo/vidéo, bucket privé coach-media) ─────────────
// Upload direct client → Storage via URL d'upload SIGNÉE (pas de base64 par la
// fonction → gros fichiers vidéo OK). 3 temps : (1) mediaUploadUrl donne un chemin
// + une URL signée ; (2) le client PUT le fichier dessus ; (3) envoyerMediaCoach
// crée le message. Photos/vidéos réservées au lien athlète↔coach.
const MEDIA_EXT_OK: Record<string, string> = { jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', mp4: 'video', mov: 'video', webm: 'video' }
async function handleMediaUploadUrl(body: any): Promise<Response> {
  const athleteId = String(body.athlete_id || '')
  const ext = String(body.ext || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!athleteId) return jsonResp({ success: false, error: 'athlete_id manquant' })
  if (!MEDIA_EXT_OK[ext]) return jsonResp({ success: false, error: 'Format non pris en charge' })
  const path = `${athleteId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { data, error } = await sb().storage.from('coach-media').createSignedUploadUrl(path)
  if (error || !data) return jsonResp({ success: false, error: (error && error.message) || 'upload-url' })
  // data = { signedUrl (URL complète à PUT), token, path }
  return jsonResp({ success: true, path: data.path, token: data.token, signedUrl: data.signedUrl, media_type: MEDIA_EXT_OK[ext] })
}

async function handleEnvoyerMediaCoach(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const media_path = String(body.media_path || '')
  const media_type = body.media_type === 'video' ? 'video' : 'image'
  if (!athlete_id || !media_path) return jsonResp({ success: false, error: 'Paramètres manquants' })
  if (body.consent !== true) return jsonResp({ success: false, error: 'Consentement requis' })
  // Le chemin doit appartenir à cet athlète (préfixe <athlete_id>/) — anti-usurpation.
  if (!media_path.startsWith(athlete_id + '/')) return jsonResp({ success: false, error: 'Chemin invalide' })
  const legende = (String(body.message || '').trim() || (media_type === 'video' ? '🎥 Vidéo' : '📷 Photo')).slice(0, MSG_MAX)
  const comment_id = Date.now()
  // M1 heure de Paris ; M2 coach destinataire + noms lus en base.
  const { data: aRowM } = await sb().from('athletes').select('coach_id,nom').eq('id', athlete_id).single()
  const cIdM = String((aRowM as any)?.coach_id || '')
  let cNomM = ''
  if (cIdM) { try { const { data: c } = await sb().from('coachs').select('nom').eq('coach_id', cIdM).single(); cNomM = String((c as any)?.nom || '') } catch (_) {} }
  const { error } = await sb().from('commentaires').insert({ comment_id, date: _dateParis(new Date(comment_id)), coach_id: cIdM, coach_nom: cNomM, athlete_id, message: legende, lu: false, auteur: 'athlete', auteur_nom: String((aRowM as any)?.nom || '').trim().split(/\s+/)[0], media_path, media_type })
  if (error) return jsonResp({ success: false, error: error.message })
  let media_url: string | null = null
  try { const { data: s } = await sb().storage.from('coach-media').createSignedUrl(media_path, 7200); media_url = (s && s.signedUrl) || null } catch (_) {}
  return jsonResp({ success: true, id: comment_id, media_type, media_url })
}

// ── Photo de profil (07/11) — athlète ET coach, bucket PRIVÉ 'suivi-photos' ─────
// Chemin FIXE par personne (pas de colonne en base) : athlète « <id>/avatar.jpg » (supprimée
// avec son dossier à la suppression du compte), coach « coachs/<id>/avatar.jpg ».
// Lecture : URL signée (2 h). Écriture : URL d'upload signée en upsert (remplace l'ancienne).
// Droits : authCheck (athlète = la sienne ; coach = la sienne ou celle d'un athlète LIÉ).
const _avatarPath = (role: 'a' | 'c', id: string) => role === 'a' ? `${id}/avatar.jpg` : `coachs/${id}/avatar.jpg`
async function _avatarUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const ps = paths.filter(Boolean)
  if (!ps.length) return out
  try {
    const { data } = await sb().storage.from('suivi-photos').createSignedUrls(ps, 7200)
    ;(data || []).forEach((s: any, i: number) => { if (s && s.signedUrl && !s.error) out[ps[i]] = s.signedUrl })
  } catch (_) { /* pas de photo / bucket absent : best-effort */ }
  return out
}
function _avatarCible(body: any): { role: 'a' | 'c'; id: string } | null {
  if (body.athlete_id) return { role: 'a', id: String(body.athlete_id) }
  if (body.coach_id) return { role: 'c', id: String(body.coach_id) }
  return null
}
async function handlePhotoProfilUploadUrl(body: any): Promise<Response> {
  const c = _avatarCible(body)
  if (!c) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const path = _avatarPath(c.role, c.id)
  const { data, error } = await sb().storage.from('suivi-photos').createSignedUploadUrl(path, { upsert: true })
  if (error || !data) return jsonResp({ success: false, error: (error && error.message) || 'upload-url' })
  return jsonResp({ success: true, path: data.path, signedUrl: data.signedUrl })
}
async function handlePhotoProfil(body: any): Promise<Response> {
  const c = _avatarCible(body)
  if (!c) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const p = _avatarPath(c.role, c.id)
  const u = await _avatarUrls([p])
  return jsonResp({ success: true, url: u[p] || null })
}
async function handleSupprimerPhotoProfil(body: any): Promise<Response> {
  const c = _avatarCible(body)
  if (!c) return jsonResp({ success: false, error: 'Paramètres manquants' })
  try { await sb().storage.from('suivi-photos').remove([_avatarPath(c.role, c.id)]) } catch (_) {}
  return jsonResp({ success: true })
}

// ── Suivi corps (N3) : mensurations (indicateurs) + photos (bucket 'suivi-photos') ─
// Saisie PAR L'ATHLÈTE ; le coach consulte via getAppData. Mensurations en cm
// (masse_grasse en %), 1 ligne/mesure/date. Photos : upload signé direct → Storage.
const MENSU_KEYS = ['poitrine', 'taille', 'hanches', 'epaules', 'bras_g', 'bras_d', 'avantbras_g', 'avantbras_d', 'cuisse_g', 'cuisse_d', 'mollet', 'masse_grasse']
async function handleSaveMensuration(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const dateYMD = body.date ? fmtYMD(new Date(String(body.date))) : fmtYMD(new Date())
  const mesures = (body.mesures && typeof body.mesures === 'object') ? body.mesures : {}
  const rows: any[] = []
  for (const k of MENSU_KEYS) {
    const v = mesures[k]
    if (v === '' || v == null || isNaN(Number(v))) continue
    // P4 (audit 02/11) : valeurs plausibles uniquement.
    const n = Number(v), [mn, mx] = (k === 'masse_grasse') ? [2, 60] : [10, 250]
    if (n < mn || n > mx) return jsonResp({ success: false, error: (k === 'masse_grasse' ? 'Masse grasse : 2 à 60 %' : 'Tour : 10 à 250 cm') })
    rows.push({ date: dateYMD, athlete_id, seance_id: 'mensuration', cle: k, valeur: String(n), unite: (k === 'masse_grasse' ? '%' : 'cm'), source: 'athlete' })
  }
  if (!rows.length) return jsonResp({ success: false, error: 'Aucune mesure' })
  // P2 (audit 02/11) : on ne remplace QUE les mesures envoyées (avant : toute la date était
  // effacée → ajouter le mollet le soir effaçait la taille du matin).
  await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('seance_id', 'mensuration').eq('date', dateYMD).in('cle', rows.map((r) => r.cle))
  { const { error } = await sb().from('indicateurs').insert(rows); if (error) return jsonResp({ success: false, error: error.message }) }
  return jsonResp({ success: true, date: fmtFR(dateYMD), n: rows.length })
}

const SUIVI_PHOTO_EXT_OK: Record<string, boolean> = { jpg: true, jpeg: true, png: true, webp: true }
const SUIVI_ANGLE_OK: Record<string, boolean> = { face: true, profil: true, dos: true }
async function handleSuiviPhotoUploadUrl(body: any): Promise<Response> {
  const athleteId = String(body.athlete_id || '')
  const ext = String(body.ext || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!athleteId) return jsonResp({ success: false, error: 'athlete_id manquant' })
  if (!SUIVI_PHOTO_EXT_OK[ext]) return jsonResp({ success: false, error: 'Format non pris en charge' })
  const path = `${athleteId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { data, error } = await sb().storage.from('suivi-photos').createSignedUploadUrl(path)
  if (error || !data) return jsonResp({ success: false, error: (error && error.message) || 'upload-url' })
  return jsonResp({ success: true, path: data.path, token: data.token, signedUrl: data.signedUrl })
}
async function handleSaveSuiviPhoto(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const photo_path = String(body.path || '')
  const angle = SUIVI_ANGLE_OK[String(body.angle || '')] ? String(body.angle) : 'face'
  if (!athlete_id || !photo_path) return jsonResp({ success: false, error: 'Paramètres manquants' })
  if (!photo_path.startsWith(athlete_id + '/')) return jsonResp({ success: false, error: 'Chemin invalide' })
  const dateYMD = body.date ? fmtYMD(new Date(String(body.date))) : fmtYMD(new Date())
  // P7 (audit 02/11) : date choisie par l'athlète (photo « avant » ancienne), jamais future.
  { const dm = new Date(); dm.setUTCDate(dm.getUTCDate() + 1); if (dateYMD > fmtYMD(dm)) return jsonResp({ success: false, error: 'La date ne peut pas être dans le futur.' }) }
  const { error } = await sb().from('indicateurs').insert({ date: dateYMD, athlete_id, seance_id: 'suivi_photo', cle: angle, valeur: photo_path, unite: '', source: 'athlete' })
  if (error) return jsonResp({ success: false, error: error.message })
  let url: string | null = null
  try { const { data: s } = await sb().storage.from('suivi-photos').createSignedUrl(photo_path, 7200); url = (s && s.signedUrl) || null } catch (_) {}
  return jsonResp({ success: true, date: fmtFR(dateYMD), angle, path: photo_path, url })
}
async function handleSupprimerSuiviPhoto(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const photo_path = String(body.path || '')
  if (!athlete_id || !photo_path) return jsonResp({ success: false, error: 'Paramètres manquants' })
  if (!photo_path.startsWith(athlete_id + '/')) return jsonResp({ success: false, error: 'Chemin invalide' })
  try { await sb().storage.from('suivi-photos').remove([photo_path]) } catch (_) {}
  await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('seance_id', 'suivi_photo').eq('valeur', photo_path)
  return jsonResp({ success: true })
}

async function handleSaveObjectif(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const objectif = String(body.objectif ?? body.strategie ?? '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  // Objectif de séances/semaine (1..7) : n'est persisté que si fourni (sinon on ne
  // touche pas la valeur existante). Alimente l'anneau d'adhérence « X/N ».
  const ssRaw = body.seances_semaine
  const seancesSem = (ssRaw === '' || ssRaw == null || isNaN(Number(ssRaw))) ? null : Math.max(1, Math.min(7, Math.round(Number(ssRaw))))
  // table objectif : une ligne par athlète (colonne objectif = chaîne stratégie)
  const { data: existing } = await sb().from('objectif').select('id').eq('athlete_id', athlete_id).limit(1)
  if (existing?.length) {
    const patch: any = { objectif }
    if (seancesSem != null) patch.seances_semaine = seancesSem
    await sb().from('objectif').update(patch).eq('id', existing[0].id)
  } else {
    const ins: any = { athlete_id, objectif }
    if (seancesSem != null) ins.seances_semaine = seancesSem
    await sb().from('objectif').insert(ins)
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
  // jour conseillé : facultatif ; à l'insertion, hérite du jour déjà posé sur la séance.
  const jourIn = (body.jour === '' || body.jour == null) ? null : Number(body.jour)
  // cibles (phase 2) : % du 1RM + RPE cible. '' → null (efface).
  const pctIn = (body.charge_pct_1rm === '' || body.charge_pct_1rm == null) ? null : Number(body.charge_pct_1rm)
  const rpeIn = (body.rpe_cible === '' || body.rpe_cible == null) ? null : Number(body.rpe_cible)
  // Item CARDIO (programme hybride) : type='cardio', exercice = activité, cible =
  // (valeur, unité 'min'|'km'|'libre'). Les champs muscu (séries/reps…) restent nuls.
  const typeIn = (body.type === 'cardio') ? 'cardio' : (body.type === 'muscu' ? 'muscu' : null)
  const cibleIn = (body.cardio_cible === '' || body.cardio_cible == null) ? null : Number(body.cardio_cible)
  const uniteIn = (body.cardio_unite === '' || body.cardio_unite == null) ? null : String(body.cardio_unite)
  // Schéma de séries (#4) : valeur contrôlée ; backoff_pct (top-set+back-off) ; series_json (pyramidal).
  const _SCHEMAS = ['fixe', 'double', 'topbackoff', 'pyramidal']
  const schemaIn = _SCHEMAS.includes(String(body.schema)) ? String(body.schema) : null
  const backoffIn = (body.backoff_pct === '' || body.backoff_pct == null) ? null : Number(body.backoff_pct)
  const seriesJsonIn = _parseSeriesJson(body.series_json)
  if (row_index) {
    const patch: any = { seance_id, exercice, series_prevues, reps_mini, reps_max, repos_sec, groupe_id }
    if (body.jour !== undefined) patch.jour = jourIn
    if (body.charge_pct_1rm !== undefined) patch.charge_pct_1rm = pctIn
    if (body.rpe_cible !== undefined) patch.rpe_cible = rpeIn
    if (body.type !== undefined) patch.type = typeIn
    if (body.cardio_cible !== undefined) patch.cardio_cible = cibleIn
    if (body.cardio_unite !== undefined) patch.cardio_unite = uniteIn
    if (body.schema !== undefined) patch.schema = schemaIn
    if (body.backoff_pct !== undefined) patch.backoff_pct = backoffIn
    if (body.series_json !== undefined) patch.series_json = seriesJsonIn
    const { error } = await sb().from('programme').update(patch).eq('id', row_index)
    if (error) return jsonResp({ erreur: error.message })
  } else {
    let jour = jourIn
    if (jour == null && seance_id) {
      // hérite du jour de la séance (si une autre ligne de la même séance en a un)
      const { data: sib } = await sb().from('programme').select('jour').eq('athlete_id', athlete_id).eq('seance_id', seance_id).not('jour', 'is', null).limit(1)
      if (sib && sib.length && sib[0].jour != null) jour = Number(sib[0].jour)
    }
    const { error } = await sb().from('programme').insert({ athlete_id, athlete_nom: athlete_nom || '', seance_id, exercice, series_prevues, reps_mini, reps_max, repos_sec, groupe_id, jour, charge_pct_1rm: pctIn, rpe_cible: rpeIn, type: typeIn, cardio_cible: cibleIn, cardio_unite: uniteIn, schema: schemaIn, backoff_pct: backoffIn, series_json: seriesJsonIn })
    if (error) return jsonResp({ erreur: error.message })
  }
  return jsonResp({ ok: true })
}

// Pyramidal : tableau de cibles par série [{pct, reps, rpe}]. Accepte un array JS
// (client supabase → jsonb) OU une chaîne JSON. Nettoie/typé ; null si vide/invalide.
function _parseSeriesJson(v: any): any[] | null {
  let arr = v
  if (typeof v === 'string') { if (!v.trim()) return null; try { arr = JSON.parse(v) } catch { return null } }
  if (!Array.isArray(arr) || !arr.length) return null
  const out = arr.slice(0, 12).map((s: any) => ({
    pct: (s && s.pct != null && s.pct !== '') ? Number(s.pct) : null,
    reps: (s && s.reps != null && s.reps !== '') ? Number(s.reps) : null,
    rpe: (s && s.rpe != null && s.rpe !== '') ? Number(s.rpe) : null,
  }))
  return out.length ? out : null
}

// Jour conseillé d'une séance (Lun=1 … Dim=7, null = non planifié) : appliqué à
// TOUTES les lignes de la séance. Le jour est indicatif — faire la séance un autre
// jour ne la pénalise pas (le suivi « réalisé » compte la séance quel que soit le jour).
async function handleSaveProgrammeJour(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const seance_id = String(body.seance_id ?? '')
  if (!athlete_id || !seance_id) return jsonResp({ erreur: 'Paramètres manquants' })
  const jour = (body.jour === '' || body.jour == null) ? null : Number(body.jour)
  if (jour != null && (isNaN(jour) || jour < 1 || jour > 7)) return jsonResp({ erreur: 'jour invalide' })
  const { error } = await sb().from('programme').update({ jour }).eq('athlete_id', athlete_id).eq('seance_id', seance_id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

// ====================== AGENDA DATÉ (table `planning`) =====================
// Séances du programme posées à des DATES réelles, à côté de `programme` (qui
// garde la DÉFINITION des séances + `jour` = semaine type / modèle par défaut).
// Plusieurs séances par jour autorisées (unique sur athlete_id+date+seance_id).
// `statut` par défaut 'planifie' ; le calcul 'fait/manqué' viendra plus tard
// (croisement avec `performances`). Mêmes droits que saveProgrammeJour.

// Lecture d'une plage de dates (navigation par semaine, côté coach).
async function handleGetPlanning(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const from = String(body.from || '')
  const to = String(body.to || '')
  if (!athlete_id || !from || !to) return jsonResp({ erreur: 'Paramètres manquants' })
  const { data, error } = await sb().from('planning')
    .select('id,date,seance_id,statut,source,note')
    .eq('athlete_id', athlete_id).gte('date', from).lte('date', to)
    .order('date', { ascending: true })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true, rows: data || [] })
}

// Poser une séance un jour donné (upsert sur l'index unique → idempotent).
// 06/11 — « Cette séance remplace laquelle ? » : rattache une séance réelle (souvent « Libre ») à une séance prévue
// du programme, ou '__plus__' (séance en plus), ou '' pour revenir au calcul automatique. Athlète ou son coach.
async function handleSetRattachement(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const date = normDate(String(body.date || ''))
  const seance_id = String(body.seance_id ?? '')
  const cible = String(body.cible ?? '').trim()
  if (!athlete_id || !date || !seance_id) return jsonResp({ erreur: 'Paramètres manquants' })
  const par = body._sessRole === 'c' ? 'coach' : 'athlete'
  const { error: e1 } = await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('cle', 'rattache').eq('date', date).eq('seance_id', seance_id)
  if (e1) return jsonResp({ erreur: e1.message })
  if (cible) {
    const { error } = await sb().from('indicateurs').insert({ date, athlete_id, seance_id, cle: 'rattache', valeur: cible, unite: par, source: 'app' })
    if (error) return jsonResp({ erreur: error.message })
  }
  return jsonResp({ ok: true, par })
}
async function handlePlanSeance(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const date = String(body.date || '')
  const seance_id = String(body.seance_id ?? '')
  if (!athlete_id || !date || !seance_id) return jsonResp({ erreur: 'Paramètres manquants' })
  const source = (body.source === 'athlete' || body.source === 'auto') ? body.source : 'coach'
  // 04/11 : statut « annule » = « pas cette semaine » (séance non faite, plus rappelée, sans pénalité).
  const statut = body.statut === 'annule' ? 'annule' : 'planifie'
  const { data, error } = await sb().from('planning')
    .upsert({ athlete_id, date, seance_id, statut, source }, { onConflict: 'athlete_id,date,seance_id' })
    .select('id').single()
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true, id: data?.id })
}

// Déplacer une séance posée vers une autre date (glisser-déposer / changer de jour).
async function handleMovePlanning(body: any): Promise<Response> {
  const id = Number(body.id)
  const date = String(body.date || '')
  if (!id || !date) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('planning').update({ date, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

// Retirer une séance posée (jour de repos).
async function handleUnplanPlanning(body: any): Promise<Response> {
  const id = Number(body.id)
  if (!id) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('planning').delete().eq('id', id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

// Génération d'un programme de départ (onboarding). Le FRONT construit les lignes
// (objectif + jours + niveau → structure, en piochant dans le catalogue) ; le
// backend persiste de façon atomique : si remplacer=true, on efface d'abord tout
// le programme de l'athlète, puis on insère les lignes fournies.
async function handleGenererProgramme(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  const lignes = Array.isArray(body.lignes) ? body.lignes : []
  if (!lignes.length) return jsonResp({ erreur: 'Aucune ligne à insérer' })
  const nom = String(body.athlete_nom || '')
  const num = (v: any) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v)
  const rows = lignes.map((l: any) => ({
    athlete_id, athlete_nom: nom,
    seance_id: String(l.seance_id ?? ''),
    exercice: String(l.exercice ?? ''),
    series_prevues: num(l.series_prevues),
    reps_mini: num(l.reps_mini),
    reps_max: num(l.reps_max),
    repos_sec: num(l.repos_sec),
    groupe_id: l.groupe_id ? String(l.groupe_id) : null,
    jour: num(l.jour),
    charge_pct_1rm: num(l.charge_pct_1rm),
    rpe_cible: num(l.rpe_cible),
    schema: ['fixe', 'double', 'topbackoff', 'pyramidal'].includes(String(l.schema)) ? String(l.schema) : null,
    backoff_pct: num(l.backoff_pct),
    series_json: _parseSeriesJson(l.series_json),
  })).filter((r: any) => r.exercice && r.seance_id)
  if (!rows.length) return jsonResp({ erreur: 'Lignes invalides' })
  if (body.remplacer) {
    const { error: delErr } = await sb().from('programme').delete().eq('athlete_id', athlete_id)
    if (delErr) return jsonResp({ erreur: delErr.message })
  }
  const { error } = await sb().from('programme').insert(rows)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true, inserees: rows.length })
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
  // Données propres au coach (exigence Play Store, 28/10/2026) : alertes « traitées »,
  // jetons de notification (stockés sous COACH_PUSH_PREFIX + id). Les MESSAGES restent
  // (ils appartiennent aussi à la conversation de l'athlète) mais le nom est anonymisé.
  await Promise.all([
    sb().from('alertes_traitees').delete().eq('coach_id', coach_id),
    sb().from('native_push_tokens').delete().eq('athlete_id', COACH_PUSH_PREFIX + String(coach_id)),
    sb().from('push_subscriptions').delete().eq('athlete_id', COACH_PUSH_PREFIX + String(coach_id)),
    sb().storage.from('suivi-photos').remove([_avatarPath('c', String(coach_id))]),   // 07/11 : photo de profil du coach
    sb().from('commentaires').update({ coach_nom: 'Coach (compte supprimé)', auteur_nom: 'Coach (compte supprimé)' }).eq('coach_id', coach_id).eq('auteur', 'coach'),
  ].map((q: any) => Promise.resolve(q).catch(() => null)))
  const { error } = await sb().from('coachs').delete().eq('coach_id', coach_id)
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true })
}

async function handleSaveBienEtre(body: any): Promise<Response> {
  const { athlete_id, seance_id, date, sommeil, energie, fatigue, motivation, stress, courbatures, douleur, zone, ressenti, note } = body
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  // colonnes numériques : '' ou texte → null (sinon Postgres rejette tout l'insert)
  const num = (v: any) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v)
  const d = normDate(date) || fmtYMD(new Date())
  const row: any = {
    date: d, seance_id: seance_id || null, athlete_id,
    sommeil: num(sommeil), energie: num(energie), fatigue_musculaire: num(fatigue), motivation: num(motivation), douleur: num(douleur),
    // Readiness Hooper : stress + courbatures (DOMS) — colonnes ajoutées (migration SQL).
    stress: num(stress), courbatures: num(courbatures),
    zone_douloureuse: zone != null && zone !== '' ? String(zone) : null,
    ressenti_global: ressenti != null && ressenti !== '' ? String(ressenti) : null,
    note: num(note),
  }
  // UNE seule ligne bien_etre par (athlete_id, date). L'état du jour (readiness :
  // sommeil/énergie/fatigue, saisi AVANT la séance) et la douleur (remontée du
  // bilan APRÈS la séance) écrivent tous deux la ligne du jour → on FUSIONNE les
  // champs non nuls au lieu d'écraser (sinon l'un effacerait l'autre).
  const { data: existing } = await sb().from('bien_etre')
    .select('seance_id').eq('athlete_id', athlete_id).eq('date', d).limit(1)
  if (existing && existing.length) {
    const patch: any = {}
    for (const k of Object.keys(row)) {
      if (k === 'date' || k === 'athlete_id') continue
      if (k === 'seance_id') { if (row.seance_id) patch.seance_id = row.seance_id; continue }
      if (row[k] != null) patch[k] = row[k]   // ne fusionne que les champs fournis
    }
    if (!Object.keys(patch).length) return jsonResp({ ok: true, success: true, updated: false })
    const { error } = await sb().from('bien_etre').update(patch).eq('athlete_id', athlete_id).eq('date', d)
    if (error) return jsonResp({ success: false, error: error.message })
    if (row.douleur != null && row.douleur >= 3 && typeof _notifCoachDouleur === 'function') await _notifCoachDouleur(String(athlete_id), row.douleur, String(row.zone_douloureuse || ''))   // P4 (05/11)
    return jsonResp({ ok: true, success: true, updated: true })
  }
  const { error } = await sb().from('bien_etre').insert(row)
  if (error) return jsonResp({ success: false, error: error.message })
  if (row.douleur != null && row.douleur >= 3 && typeof _notifCoachDouleur === 'function') await _notifCoachDouleur(String(athlete_id), row.douleur, String(row.zone_douloureuse || ''))   // P4 (05/11)
  return jsonResp({ ok: true, success: true })
}

// Bilan de séance (APRÈS validation, muscu OU cardio) : ressenti perçu + douleur.
// → lignes `indicateurs` (ressenti_<type> / douleur_<type>) taguées par seance_id,
//   pour des analyses SÉPARÉES muscu vs cardio. La douleur remonte aussi dans le
//   bien_etre du jour (fusion) pour rester visible du moteur (règles douleur).
async function handleSaveBilanSeance(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const type = (body.type === 'cardio') ? 'cardio' : 'muscu'
  const d = normDate(body.date) || fmtYMD(new Date())
  const sid = body.seance_id ? String(body.seance_id) : `${type}_${Date.now()}`
  const num = (v: any) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v)
  const rpe = num(body.rpe)             // 0..10 — RPE de séance CR-10 (session-RPE Foster)
  const duree = num(body.duree)         // minutes (chrono de séance) → charge interne sRPE = RPE × durée
  const ressenti = num(body.ressenti)   // LEGACY 1..4 (1 = Facile … 4 = Très dur)
  const douleur = num(body.douleur)     // 1..4 (1 = aucune)
  const zone = (body.zone != null && body.zone !== '') ? String(body.zone) : ''
  // S2 (audit saisies 02/11) : la note du bilan est rangée AVEC la séance (avant : seulement un
  // message au coach → perdue sans coach).
  const note = String(body.note || '').trim().slice(0, 2000)

  // S4 : un bilan REMPLACE le précédent de la même séance (renvoi après échec réseau, double appui).
  try { await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('date', d).eq('seance_id', sid).in('cle', [`rpe_${type}`, `ressenti_${type}`, `duree_${type}`, `douleur_${type}`, `note_${type}`]) } catch (_) {}

  const rows: any[] = []
  // Nouveau : RPE CR-10 (cle rpe_<type>). Repli legacy : ancien ressenti 1..4.
  if (rpe != null) rows.push({ date: d, athlete_id, seance_id: sid, cle: `rpe_${type}`, valeur: String(rpe), unite: 'cr10', source: 'saisie' })
  else if (ressenti != null) rows.push({ date: d, athlete_id, seance_id: sid, cle: `ressenti_${type}`, valeur: String(ressenti), unite: '', source: 'saisie' })
  // Durée de séance (pour le sRPE = charge interne). Stockée même si RPE absent.
  if (duree != null && duree > 0) rows.push({ date: d, athlete_id, seance_id: sid, cle: `duree_${type}`, valeur: String(duree), unite: 'min', source: 'saisie' })
  if (douleur != null && douleur > 1) rows.push({ date: d, athlete_id, seance_id: sid, cle: `douleur_${type}`, valeur: String(douleur), unite: zone, source: 'saisie' })
  if (note) rows.push({ date: d, athlete_id, seance_id: sid, cle: `note_${type}`, valeur: note, unite: '', source: 'saisie' })
  // S1 : cardio — le RPE n'est plus demandé dans le formulaire, seulement ici. On le recopie sur la
  // séance (« rpe ») + charge interne = RPE × durée de la séance (lue en base), comme avant.
  if (type === 'cardio' && rpe != null && body.seance_id) {
    try {
      const { data: dr } = await sb().from('indicateurs').select('valeur').eq('athlete_id', athlete_id).eq('seance_id', sid).eq('cle', 'duree').limit(1)
      const dureeSea = Number(dr && dr[0] && (dr[0] as any).valeur) || 0
      await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('seance_id', sid).in('cle', ['rpe', 'charge_interne'])
      rows.push({ date: d, athlete_id, seance_id: sid, cle: 'rpe', valeur: String(rpe), unite: '1-10', source: 'saisie' })
      if (dureeSea > 0 && rpe > 0) rows.push({ date: d, athlete_id, seance_id: sid, cle: 'charge_interne', valeur: String(dureeSea * rpe), unite: 'UA', source: 'calculé' })
    } catch (_) {}
  }
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ success: false, error: error.message })
  }

  // Ressenti + douleur → bien_etre du jour (fusion) : c'est le SNAPSHOT du jour que
  // lisent l'écran État (« bien-être du jour ») et le moteur (règles douleur). On y
  // recopie donc TOUJOURS le ressenti et la douleur du bilan (avant, seule une
  // douleur > 1 y arrivait → ressenti/douleur=1 invisibles côté État).
  const patch: any = {}
  if (ressenti != null) patch.ressenti_global = String(ressenti)
  if (douleur != null) { patch.douleur = douleur; if (zone) patch.zone_douloureuse = zone }
  if (Object.keys(patch).length) {
    const { data: be } = await sb().from('bien_etre').select('seance_id').eq('athlete_id', athlete_id).eq('date', d).limit(1)
    if (be && be.length) {
      await sb().from('bien_etre').update(patch).eq('athlete_id', athlete_id).eq('date', d)
    } else {
      await sb().from('bien_etre').insert(Object.assign({ date: d, seance_id: sid, athlete_id }, patch))
    }
  }
  return jsonResp({ ok: true, success: true })
}

// HYROX (P2-22) : 8 × (Run 1 km + atelier). Stockée dans l'historique cardio
// (seance_id `cardio_hyrox_…`, type_cardio='hyrox', durée=total) → compte dans la
// charge cardio, et les 16 splits + poids utilisés reviennent avec la session.
async function handleSaveHyrox(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const d = normDate(body.date) || fmtYMD(new Date())
  const mode = body.mode === 'entrainement' ? 'entrainement' : 'course'
  const division = String(body.division || 'mo')
  const num = (v: any) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v)
  const segs = (body.segments && typeof body.segments === 'object') ? body.segments : {}
  const poids = (body.poids && typeof body.poids === 'object') ? body.poids : {}
  const segKeys = Object.keys(segs).filter(k => num(segs[k]) != null && Number(segs[k]) > 0)
  if (!segKeys.length) return jsonResp({ success: false, error: 'aucun segment' })
  const total = num(body.total_sec) || segKeys.reduce((a, k) => a + Number(segs[k]), 0)
  const runKm = segKeys.filter(k => k.indexOf('run') === 0).length
  const sid = `cardio_hyrox_${Date.now()}`
  const R = (cle: string, valeur: string, unite = '') => ({ date: d, athlete_id, seance_id: sid, cle, valeur, unite, source: 'saisie' })
  const rows: any[] = [
    R('type_cardio', 'hyrox'),
    R('duree', String(Math.round(total / 60)), 'min'),
    R('hyrox_mode', mode),
    R('hyrox_division', division),
    R('hyrox_total', String(total), 's'),
  ]
  if (runKm > 0) rows.push(R('distance', String(runKm), 'km'))
  if (num(body.rpe) != null) rows.push(R('rpe', String(num(body.rpe))))
  segKeys.forEach(k => rows.push(R('hyrox_' + k, String(Math.round(Number(segs[k]))), 's')))
  Object.keys(poids).forEach(k => { if (num(poids[k]) != null) rows.push(R('hyrox_poids_' + k, String(Number(poids[k])), 'kg')) })
  const { error } = await sb().from('indicateurs').insert(rows)
  if (error) return jsonResp({ success: false, error: error.message })
  try { await rebuildActivites(athlete_id) } catch (_) {}   // P0.2 : entité Activité à jour
  return jsonResp({ ok: true, success: true, seance_id: sid, total_sec: total })
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

// Marque une alerte athlète comme lue (état durable, stocké dans indicateurs
// sous seance_id='alerte_lue', cle=<id> où id = type|semaine). Idempotent.
// Préférence « semaine d'entraînement » (calendaire lundi→dim. / glissante 7 j).
// ── Récompenses : catalogue (source de vérité des COÛTS côté serveur) ──────────
// Le front a le catalogue d'affichage (titres/descriptions/icônes) ; ici on ne garde
// que ce qui est nécessaire à la VALIDATION d'un achat (coût + type). Les collabs
// seront ajoutées ici comme nouvelles entrées (type:'collab', + code à servir plus tard).
const RECOMPENSES_CATALOGUE: Record<string, { cout: number; type: string; dispo?: boolean; repetable?: boolean }> = {
  // Points v2 (30/10) : badges et thème ne s'achètent plus, ils se DÉBLOQUENT avec les
  // points gagnés (COLLECTION_PALIERS). Gardés ici pour reconnaître les anciens achats.
  badge_pionnier:    { cout: 50,  type: 'badge', dispo: false },
  badge_assidu:      { cout: 150, type: 'badge', dispo: false },
  skin_gold:         { cout: 300, type: 'skin',  dispo: false },
  badge_machine:     { cout: 600, type: 'badge', dispo: false },
  // Boutique (décision 30/10) : +5 questions à Novalyz IA, achetable plusieurs fois.
  // Refusé tant que l'IA n'est pas activée côté serveur (clé absente).
  ia_plus5:          { cout: 150, type: 'boutique', repetable: true },
  // Collabs — teasers, pas encore achetables (aucun partenaire branché).
  collab_partenaire: { cout: 800,  type: 'collab', dispo: false },
  collab_programme:  { cout: 1000, type: 'collab', dispo: false },
}

// ===========================================================================
// POINTS v2 (décision 30/10) — on gagne des points sur les gestes qui rendent
// les analyses fiables, calculés à partir des VRAIES données (rien n'est stocké,
// tout est recalculable). Barème calibré « pas trop facile » sur les données
// réelles (≈ 85 pts/sem. en moyenne, ≈ 170 pour une semaine parfaite à 4 séances).
// ===========================================================================
const POINTS_BAREME = { seance: 10, rpe: 5, questionnaire: 3, complete: 5, record: 20, recordMaxSem: 3, objectif: 30 }
// Collection : débloquée automatiquement par les points GAGNÉS (plus achetée).
const COLLECTION_PALIERS: { id: string; seuil: number }[] = [
  { id: 'badge_pionnier', seuil: 50 }, { id: 'badge_assidu', seuil: 300 }, { id: 'skin_gold', seuil: 600 }, { id: 'badge_machine', seuil: 1200 },
]
// Achat répétable : stocké sous « <id>_<horodatage> » → id du catalogue.
function _rewBase(id: string): string { return String(id || '').replace(/_\d{10,}$/, '') }
// ── Quotas atomiques (10/11, audit P1 étape 3 : table quotas_jour) ──
// Avant : compteur lu AVANT l'appel IA puis réécrit APRÈS → deux questions simultanées passaient et ne
// comptaient que pour une. Maintenant : une unité est RÉSERVÉE avant l'appel (quota_reserver, une seule
// requête SQL : plafond jamais dépassé) et RENDUE si l'appel échoue. Si la migration n'est pas encore
// appliquée (fonction absente), on retombe sur l'ancien stockage indicateurs (même comportement qu'avant).
const QUOTA_CUMUL = '1970-01-01'   // crédits IA achetés : compteur unique (pas par jour)
const _QUOTA_ANCIEN: Record<string, string> = { ia: 'ia_quota', morpho: 'morpho_quota', ia_bonus: 'ia_bonus' }
const _ABSENT = ['PGRST202', '42883', '42P01', 'PGRST205']
async function _quotaAncienUtilise(sujet: string, type: string, jour: string): Promise<number> {
  if (type === 'ia_bonus') { const { data } = await sb().from('indicateurs').select('cle').eq('athlete_id', sujet).eq('seance_id', 'ia_bonus'); return (data || []).length }
  const { data } = await sb().from('indicateurs').select('valeur').eq('athlete_id', sujet).eq('seance_id', _QUOTA_ANCIEN[type]).eq('cle', jour).limit(1)
  return data?.length ? (Number((data[0] as any).valeur) || 0) : 0
}
// { ok, n (compteur après réservation), ancien (stockage indicateurs), erreur }
async function _quotaReserver(sujet: string, type: string, jour: string, max: number): Promise<{ ok: boolean; n: number; ancien?: boolean; erreur?: boolean }> {
  const ancien = async () => {
    try { const used = await _quotaAncienUtilise(sujet, type, jour); return used < max ? { ok: true, n: used + 1, ancien: true } : { ok: false, n: used, ancien: true } }
    catch (_) { return { ok: false, n: 0, erreur: true } }
  }
  try {
    const { data, error } = await sb().rpc('quota_reserver', { p_sujet: sujet, p_type: type, p_jour: jour, p_max: max })
    if (!error) { const v = Array.isArray(data) ? data[0] : data; const n = Number(v); return (v == null || !n) ? { ok: false, n: max } : { ok: true, n } }
    if (!_ABSENT.includes(String((error as any).code || ''))) return { ok: false, n: 0, erreur: true }
    return await ancien()
  } catch (_) { return await ancien() }   // fonction indisponible côté client → ancien stockage
}
// Appel IA échoué : on rend l'unité réservée (rien à faire en ancien stockage : il n'écrit qu'après succès).
async function _quotaRendre(sujet: string, type: string, jour: string, r: { ok: boolean; ancien?: boolean }): Promise<void> {
  if (!r.ok || r.ancien) return
  try { await sb().rpc('quota_rendre', { p_sujet: sujet, p_type: type, p_jour: jour }) } catch (_) {}
}
// Ancien stockage seulement (migration pas appliquée) : écrit APRÈS succès, comme avant.
async function _quotaAncienEcrire(sujet: string, type: string, jour: string, r: { ok: boolean; n: number; ancien?: boolean }): Promise<void> {
  if (!r.ok || !r.ancien) return
  try {
    if (type === 'ia_bonus') { await sb().from('indicateurs').insert({ athlete_id: sujet, date: jour, seance_id: 'ia_bonus', cle: String(Date.now()), valeur: '1', unite: '', source: 'ia' }); return }
    if (r.n > 1) await sb().from('indicateurs').update({ valeur: String(r.n) }).eq('athlete_id', sujet).eq('seance_id', _QUOTA_ANCIEN[type]).eq('cle', jour)
    else await sb().from('indicateurs').insert({ athlete_id: sujet, date: jour, seance_id: _QUOTA_ANCIEN[type], cle: jour, valeur: '1', unite: '', source: 'ia' })
  } catch (_) {}
}
// Crédits de questions IA : achats (5 par achat) − déjà consommés (quotas_jour 'ia_bonus' ; sinon ancien stockage).
async function _iaCreditsAchetes(athlete_id: string): Promise<number> {
  const { data: cl } = await sb().from('indicateurs').select('cle').eq('athlete_id', athlete_id).eq('seance_id', 'recompense')
  return (cl || []).filter((r: any) => _rewBase(String(r.cle)) === 'ia_plus5').length * 5
}
async function _iaCreditsUtilises(athlete_id: string): Promise<number> {
  const { data, error } = await sb().from('quotas_jour').select('n').eq('sujet', athlete_id).eq('type', 'ia_bonus').eq('jour', QUOTA_CUMUL).limit(1)
  if (!error) return data?.length ? (Number((data[0] as any).n) || 0) : 0
  return _quotaAncienUtilise(athlete_id, 'ia_bonus', QUOTA_CUMUL)
}
async function _iaCreditsRestants(athlete_id: string): Promise<number> {
  const [achetes, utilises] = await Promise.all([_iaCreditsAchetes(athlete_id), _iaCreditsUtilises(athlete_id)])
  return Math.max(0, achetes - utilises)
}
function _lundiYMD(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10)
}
function calculerPoints(perfs: any[], beRows: any[], progRows: any[], objectifSem: number, claims: any[], now: Date): any {
  const B = POINTS_BAREME
  // Séance = un jour d'entraînement (même définition que computeGlobal).
  const parJour: Record<string, any[]> = {}
  for (const r of perfs || []) { const d = normDate(r.date); if (d) (parJour[d] = parJour[d] || []).push(r) }
  const prevues: Record<string, number> = {}
  for (const l of progRows || []) { if (l && l.type !== 'cardio' && l.seance_id) prevues[String(l.seance_id)] = (prevues[String(l.seance_id)] || 0) + (Number(l.series_prevues) || 0) }
  const ev: { date: string; k: string; pts: number; detail: string }[] = []
  const best: Record<string, number> = {}
  const recSem: Record<string, number> = {}
  const seancesSem: Record<string, number> = {}
  for (const d of Object.keys(parJour).sort()) {
    const rows = parJour[d]
    const sem = _lundiYMD(d)
    seancesSem[sem] = (seancesSem[sem] || 0) + 1
    const cnt: Record<string, number> = {}; rows.forEach(r => { const k = String(r.seance_id || ''); cnt[k] = (cnt[k] || 0) + 1 })
    const sid = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || ''
    ev.push({ date: d, k: 'seance', pts: B.seance, detail: sid })
    if (rows.every(r => r.rpe != null && String(r.rpe).trim() !== '' && Number(r.rpe) > 0)) ev.push({ date: d, k: 'rpe', pts: B.rpe, detail: sid })
    if (prevues[sid] && rows.filter(r => String(r.seance_id || '') === sid).length >= prevues[sid]) ev.push({ date: d, k: 'complete', pts: B.complete, detail: sid })
    // Record = charge max battue sur un exercice déjà fait (1er passage ≠ record). 3 max / semaine.
    const maxJour: Record<string, number> = {}
    rows.forEach(r => { const e = String(r.exercice || ''); const c = Number(r.charge) || 0; if (e && c > (maxJour[e] || 0)) maxJour[e] = c })
    for (const e of Object.keys(maxJour)) {
      const c = maxJour[e]
      if (best[e] != null && c > best[e] && (recSem[sem] || 0) < B.recordMaxSem) { recSem[sem] = (recSem[sem] || 0) + 1; ev.push({ date: d, k: 'record', pts: B.record, detail: e + ' ' + String(c).replace('.', ',') + ' kg' }) }
      best[e] = Math.max(best[e] ?? 0, c)
    }
  }
  // Questionnaire : 1 par jour (bilan de séance ou questionnaire du jour).
  const jours = new Set<string>(); for (const r of beRows || []) { const d = normDate(r.date); if (d) jours.add(d) }
  for (const d of jours) ev.push({ date: d, k: 'questionnaire', pts: B.questionnaire, detail: '' })
  // Objectif de la semaine atteint (séances ≥ objectif). Semaine en cours comptée dès qu'il est atteint.
  const obj = Math.max(1, Math.round(Number(objectifSem) || 0))
  if (Number(objectifSem) > 0) for (const sem of Object.keys(seancesSem)) if (seancesSem[sem] >= obj) ev.push({ date: sem, k: 'objectif', pts: B.objectif, detail: obj + ' séances' })
  const gagnes = ev.reduce((a, e) => a + e.pts, 0)
  // Dépenses : seulement la boutique. Les anciens badges / thème achetés restent acquis
  // (collection) mais ne sont plus déduits du solde (ils sont désormais gratuits).
  const cl = (claims || []).map((r: any) => ({ id: String(r.cle), cout: Number(r.valeur) || 0, date: r.date ? fmtFR(r.date) : '' }))
  const depenses = cl.filter(c => { const it = RECOMPENSES_CATALOGUE[_rewBase(c.id)]; return !!it && it.type === 'boutique' }).reduce((a, c) => a + c.cout, 0)
  const lundi = _lundiYMD(fmtYMD(now))
  const semEv = ev.filter(e => e.date >= lundi)
  const sum = (k: string) => semEv.filter(e => e.k === k)
  const lignes = [
    { k: 'seance', n: sum('seance').length, pts: sum('seance').reduce((a, e) => a + e.pts, 0) },
    { k: 'rpe', n: sum('rpe').length, pts: sum('rpe').reduce((a, e) => a + e.pts, 0) },
    { k: 'questionnaire', n: sum('questionnaire').length, pts: sum('questionnaire').reduce((a, e) => a + e.pts, 0) },
    { k: 'complete', n: sum('complete').length, pts: sum('complete').reduce((a, e) => a + e.pts, 0) },
    { k: 'record', n: sum('record').length, pts: sum('record').reduce((a, e) => a + e.pts, 0), details: sum('record').map(e => e.detail) },
    { k: 'objectif', n: sum('objectif').length, pts: sum('objectif').reduce((a, e) => a + e.pts, 0), fait: seancesSem[lundi] || 0, cible: Number(objectifSem) > 0 ? obj : null },
  ]
  const owned = new Set(cl.map(c => c.id))
  const collection = COLLECTION_PALIERS.map(p => ({ id: p.id, seuil: p.seuil, debloque: gagnes >= p.seuil || owned.has(p.id) }))
  const il30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const records30 = ev.filter(e => e.k === 'record' && e.date >= il30).length
  return { gagnes, depenses, solde: gagnes - depenses, claims: cl, bareme: B, records_30j: records30, semaine: { lundi, total: semEv.reduce((a, e) => a + e.pts, 0), lignes }, collection, version: 2 }
}

// Réclamer / acheter une récompense : vérifie le solde (gagnés − dépensés) côté
// SERVEUR (jamais confiance au client pour le coût) + l'unicité, puis enregistre
// le claim (indicateurs seance_id='recompense', valeur = coût).
async function handleClaimRecompense(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const reward_id = String(body.reward_id || '')
  if (!athlete_id || !reward_id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const item = RECOMPENSES_CATALOGUE[reward_id]
  if (!item) return jsonResp({ success: false, error: 'Récompense inconnue' })
  if (item.dispo === false) return jsonResp({ success: false, error: 'Bientôt disponible' })

  const { data: claims } = await sb().from('indicateurs').select('cle,valeur').eq('athlete_id', athlete_id).eq('seance_id', 'recompense')
  if (!item.repetable && (claims || []).some((c: any) => String(c.cle) === reward_id)) return jsonResp({ success: false, error: 'Déjà débloquée' })
  if (reward_id === 'ia_plus5' && !Deno.env.get('ANTHROPIC_API_KEY')) return jsonResp({ success: false, error: 'Novalyz IA n\'est pas encore activée : rien n\'a été débité.' })

  const now = new Date()
  // Solde = EXACTEMENT celui affiché (même calcul que getAppData → calculerPoints).
  let solde = 0
  try { const d: any = await (await handleGetAppData(new URLSearchParams({ athlete_id }))).json(); solde = Number(d?.recompenses?.solde) || 0 } catch (_) {}
  if (solde < item.cout) return jsonResp({ success: false, error: 'Solde insuffisant', solde })

  const { error } = await sb().from('indicateurs').insert({ athlete_id, date: fmtYMD(now), seance_id: 'recompense', cle: item.repetable ? reward_id + '_' + Date.now() : reward_id, valeur: String(item.cout), unite: 'pts', source: 'app' })
  if (error) return jsonResp({ success: false, error: error.message })
  return jsonResp({ success: true, reward_id, cout: item.cout, type: item.type, solde: solde - item.cout })
}

// Préférences drapeaux (onboarding_vu, prog_auto_off, novalyz_athlete) → athletes.prefs (booléens, 10/11).
// Idempotent.
async function handleSavePref(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const cle = String(body.cle || '')
  if (!athlete_id || !['onboarding_vu', 'prog_auto_off', 'novalyz_athlete'].includes(cle)) return jsonResp({ success: false, error: 'Paramètres invalides' })
  // « novalyz_athlete » (écran 6, 04/11) : réglé par le COACH (« laisser Novalyz proposer à l'athlète ») — pas par l'athlète.
  if (cle === 'novalyz_athlete' && body._sessRole && body._sessRole !== 'c') return jsonResp({ success: false, error: 'Réservé au coach' })
  const v = !(body.valeur === 0 || body.valeur === '0' || body.valeur === false)
  const err = await _prefsAthleteEcrire(athlete_id, { [cle]: v })   // 10/11 : athletes.prefs
  if (err) return jsonResp({ success: false, error: err })
  return jsonResp({ success: true })
}

// Écran 6 (04/11) : dernière modification du programme (auteur coach / athlète, date, séance, exercice) —
// affichée à l'autre partie (« Ton coach a mis à jour ton programme » / « Vincent a modifié son programme »).
async function _progMajTrace(action: string, body: any, run: () => Promise<Response>): Promise<Response> {
  let aid = String(body.athlete_id || ''), seance = String(body.seance_id || ''), exo = String(body.exercice || '')
  if ((!aid || !seance) && body.row_index) {
    try { const { data } = await sb().from('programme').select('athlete_id,seance_id,exercice').eq('id', body.row_index).limit(1); const r: any = data && data[0]; if (r) { aid = aid || String(r.athlete_id || ''); seance = seance || String(r.seance_id || ''); exo = exo || String(r.exercice || '') } } catch (_) {}
  }
  const res = await run()
  try {
    const role = body._sessRole === 'c' ? 'c' : (body._sessRole === 'a' ? 'a' : '')
    if (aid && role) {
      const quoi = action === 'genererProgramme' ? 'programme regénéré' : action === 'supprimerProgrammeLigne' ? 'exercice retiré' : (body.row_index ? 'exercice modifié' : 'exercice ajouté')
      const valeur = JSON.stringify({ date: new Date().toISOString(), par: role, quoi, seance: action === 'genererProgramme' ? '' : seance, exercice: action === 'genererProgramme' ? '' : exo })
      const { data: ex } = await sb().from('indicateurs').select('date').eq('athlete_id', aid).eq('seance_id', 'pref').eq('cle', 'prog_maj').limit(1)
      if (ex?.length) await sb().from('indicateurs').update({ valeur, date: fmtYMD(new Date()) }).eq('athlete_id', aid).eq('seance_id', 'pref').eq('cle', 'prog_maj')
      else await sb().from('indicateurs').insert({ athlete_id: aid, date: fmtYMD(new Date()), seance_id: 'pref', cle: 'prog_maj', valeur, unite: '', source: 'app' })
    }
  } catch (_) { /* le traçage ne bloque jamais l'enregistrement */ }
  return res
}

// Zones à développer en priorité (2 max), choisies par l'athlète ou son coach → athletes.prefs.zones_prio (10/11).
async function handleSaveZonesPrio(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id || !Array.isArray(body.zones)) return jsonResp({ success: false, error: 'Paramètres invalides' })
  const zones = [...new Set(body.zones.map((z: any) => String(z)))].filter((z: any) => ZONES_PRIO[z as string]).slice(0, 2)
  const err = await _prefsAthleteEcrire(athlete_id, { zones_prio: zones })   // 10/11 : athletes.prefs
  if (err) return jsonResp({ success: false, error: err })
  return jsonResp({ success: true, zones })
}

// Muscles retirés par choix (porteur 09/11) : durée de séance trop courte pour tout couvrir → l'athlète (ou
// son coach) retire des muscles plutôt que d'allonger la séance. Liste remplacée à chaque enregistrement.
async function handleSaveMusclesExclus(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id || !Array.isArray(body.muscles)) return jsonResp({ success: false, error: 'Paramètres invalides' })
  const { data: a } = await sb().from('athletes').select('prefs').eq('id', athlete_id).maybeSingle()
  const zones = (a as any)?.prefs?.zones_prio
  const muscles = musclesExclusValides(body.muscles, Array.isArray(body.zones) ? body.zones : zones)
  const err = await _prefsAthleteEcrire(athlete_id, { muscles_exclus: muscles })
  if (err) return jsonResp({ success: false, error: err })
  return jsonResp({ success: true, muscles })
}

// Catégorie de chaque exercice choisie par l'athlète (ou son coach) : gros (6-8 reps),
// moyen (8-12), petit (12-25). Sert aux fourchettes de reps de la lecture et des
// cibles de saisie. Stockée dans athletes.prefs.exo_categories (objet, 10/11 ; avant : ligne
// indicateurs 'pref'), remplacée à chaque enregistrement. Idempotent.
const EXO_CATS = ['gros', 'moyen', 'petit']
async function handleSaveExoCategories(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const src = (body.categories && typeof body.categories === 'object') ? body.categories : null
  if (!athlete_id || !src) return jsonResp({ success: false, error: 'Paramètres invalides' })
  const out: Record<string, string> = {}
  for (const k of Object.keys(src).slice(0, 400)) {
    const nom = String(k).trim().slice(0, 120), v = String(src[k] || '')
    if (nom && EXO_CATS.includes(v)) out[nom] = v
  }
  const err = await _prefsAthleteEcrire(athlete_id, { exo_categories: out })   // 10/11 : athletes.prefs
  if (err) return jsonResp({ success: false, error: err })
  return jsonResp({ success: true, categories: out })
}

// Historique santé montre (Health Connect) : le FRONT pousse un lot de jours
// {date, sommeil_min?, fc_repos?, pas?}. Stockage 1 ligne/métrique sous
// seance_id 'sante_<YYYYMMDD>'. Idempotent : on efface les lignes santé des dates
// concernées puis on réinsère (préserve les autres dates de l'historique).
async function handleSaveSante(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const entries = Array.isArray(body.entries) ? body.entries : []
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const dates = Array.from(new Set(entries.map((e: any) => normDate(e.date)).filter(Boolean)))
  if (!dates.length) return jsonResp({ success: true, saved: 0 })
  const sids = dates.map((d: string) => `sante_${d.replace(/-/g, '')}`)
  const src = String(body.source || 'health_connect')
  const rows: any[] = []
  for (const e of entries) {
    const d = normDate(e.date); if (!d) continue
    const sid = `sante_${d.replace(/-/g, '')}`
    const push = (cle: string, v: any, unite: string) => {
      if (v == null || v === '' || isNaN(Number(v))) return
      rows.push({ date: d, athlete_id, seance_id: sid, cle, valeur: String(Math.round(Number(v))), unite, source: src })
    }
    push('sommeil_min', e.sommeil_min, 'min')
    push('fc_repos', e.fc_repos, 'bpm')
    push('pas', e.pas, 'pas')
  }
  // Supprime-puis-réinsère UNIQUEMENT les clés réellement fournies (idempotent par
  // métrique). IMPORTANT : si un lot n'apporte pas les pas (ex. la requête pas de
  // Health Connect a échoué), on ne doit PAS effacer les pas déjà stockés de ces
  // jours — sinon chaque synchro « sommeil+FC seuls » viderait l'historique des pas.
  const clesPresent = Array.from(new Set(rows.map((r: any) => r.cle)))
  for (const cle of clesPresent) {
    try { await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('cle', cle).in('seance_id', sids) } catch (_) {}
  }
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ success: false, error: error.message })
  }
  // Montre 06/11 : dernière synchro réussie (heure serveur) + marque choisie dans le parcours guidé.
  try {
    const marque = String(body.marque || '').replace(/[^\p{L}\p{N} /·.-]/gu, '').slice(0, 40)
    await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('cle', 'montre_sync')
    await sb().from('indicateurs').insert({ date: fmtYMD(new Date()), athlete_id, seance_id: 'montre_sync', cle: 'montre_sync', valeur: new Date().toISOString(), unite: marque, source: src })
  } catch (_) {}
  return jsonResp({ success: true, saved: rows.length })
}

// Nutrition : upsert idempotent par jour. 1 ligne indicateurs par métrique
// (kcal / prot) sous seance_id 'nutri_<YYYYMMDD>'. Le front envoie toujours les
// deux champs du jour ensemble, donc supprimer-puis-insérer ne perd rien.
async function handleSaveNutrition(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const entries = Array.isArray(body.entries) ? body.entries : []
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const dates = Array.from(new Set(entries.map((e: any) => normDate(e.date)).filter(Boolean)))
  if (!dates.length) return jsonResp({ success: true, saved: 0 })
  const sids = dates.map((d: string) => `nutri_${d.replace(/-/g, '')}`)
  try { await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).in('seance_id', sids) } catch (_) {}
  const src = String(body.source || 'manuel')
  const rows: any[] = []
  for (const e of entries) {
    const d = normDate(e.date); if (!d) continue
    const sid = `nutri_${d.replace(/-/g, '')}`
    const push = (cle: string, v: any, unite: string) => {
      if (v == null || v === '' || isNaN(Number(v))) return
      rows.push({ date: d, athlete_id, seance_id: sid, cle, valeur: String(Math.round(Number(v))), unite, source: src })
    }
    push('kcal', e.kcal, 'kcal')
    push('prot', e.prot, 'g')
    push('gluc', e.gluc, 'g')
    push('lip', e.lip, 'g')
  }
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ success: false, error: error.message })
  }
  return jsonResp({ success: true, saved: rows.length })
}

// ===========================================================================
// COACH IA (chat groundé) — couche langage branchée sur le moteur. Répond
// UNIQUEMENT à partir des données réelles de l'athlète (jamais de chiffre
// inventé). Base gratuite = quota/jour ; au-delà = premium (à venir, C5).
// Clé : secret Supabase ANTHROPIC_API_KEY. Modèle : Haiku 5.5 (éco). Morpho = Sonnet 5.5 (vision fine).
// ===========================================================================
const IA_QUOTA_JOUR = 2

// Contexte envoyé à l'IA (audit Novalyz IA I1/I2, 01/11) : les MÊMES données que l'app,
// chacune DATÉE (« il y a N j »), rien de périmé présenté comme actuel, rien de masqué dans l'app.
function _iaContexte(d: any, now: Date = new Date()): string {
  if (!d || d.erreur) return '(données indisponibles pour le moment)'
  const L: string[] = []
  const today = fmtYMD(now)
  const iso = (x: any) => { const t = String(x || ''); if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10); const p = parseFR(t); return p ? fmtYMD(p) : null }
  const age = (x: any) => { const i = iso(x); return i ? Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(i + 'T00:00:00Z')) / 864e5) : null }
  const quand = (x: any) => { const a = age(x), i = iso(x); if (a == null || !i) return ''; const dm = i.slice(8, 10) + '/' + i.slice(5, 7); return a === 0 ? "aujourd'hui" : (a === 1 ? 'hier (' + dm + ')' : 'le ' + dm + ', il y a ' + a + ' j') }
  const m = d.moteur || {}, dash = d.dashboard || {}
  // État AFFICHÉ par l'app : « Prêt » seulement avec un questionnaire ≤ 7 j (sinon « non renseigné »).
  const be = (d.bien_etre || [])[0], beAge = be ? age(be.date) : null
  let etat = (m.disponibilite && m.disponibilite.niveau) || null
  if (etat === 'Prêt' && !(beAge != null && beAge <= 6)) etat = 'non renseigné (pas de questionnaire ces 7 derniers jours)'
  if (etat) L.push(`- État du jour (verdict de l'app) : ${etat}${m.causes && m.causes.length ? ' — cause : ' + m.causes.join(', ') : ''}.`)
  if (m.reco) L.push(`- Reco du jour (moteur) : ${m.reco}`)
  const cf = m.charge_fatigue
  if (cf && cf.tsbPct != null) L.push(`- Fraîcheur (charge récente vs habituelle) : ${cf.tsbPct >= 5 ? 'frais' : cf.tsbPct >= -12 ? 'équilibré' : 'charge en hausse'}${cf.fiable ? '' : ' (indicatif, historique court)'}.`)
  if (be && beAge != null && beAge <= 6) {
    const v = (k: string) => (be[k] != null && be[k] !== '' && !isNaN(Number(be[k]))) ? Number(be[k]) + '/5' : null
    const parts = [['sommeil', v('sommeil')], ['fatigue musculaire', v('fatigue')], ['stress', v('stress')], ['courbatures', v('courbatures')], ['douleur', v('douleur')]].filter((x) => x[1]).map((x) => x[0] + ' ' + x[1])
    if (parts.length) L.push(`- Dernier questionnaire (${quand(be.date)}) : ${parts.join(', ')} (sommeil : 5 = très bien ; fatigue/stress/courbatures/douleur : 1 = aucun).`)
  } else if (be) L.push(`- Dernier questionnaire : ${quand(be.date)} — trop ancien pour juger la forme d'aujourd'hui.`)
  else L.push('- Aucun questionnaire de forme enregistré.')
  const al = (d.alertes_centre || []).filter((a: any) => a && !a.read).slice(0, 4)
  if (al.length) L.push(`- Alertes en cours : ${al.map((a: any) => a.title + (a.evidence ? ' (' + a.evidence + ')' : '')).join(' ; ')}.`)
  if (d.contexte && d.contexte.etat && d.contexte.etat !== 'saison_normale') L.push(`- Contexte de performance déclaré : ${String(d.contexte.etat).replace(/_/g, ' ')}${d.contexte.jours_restants != null ? ' (' + d.contexte.jours_restants + ' j restants)' : ''}.`)
  if (d.pause && d.pause.debut) L.push(`- Mode vacances actif (${d.pause.debut}${d.pause.fin ? ' → ' + d.pause.fin : ''}).`)
  // Séances
  if (dash.derniere_seance && dash.derniere_seance.date) L.push(`- Dernière séance muscu : ${dash.derniere_seance.seance_id || ''} ${quand(dash.derniere_seance.date)}${dash.derniere_seance.nb_series ? ' · ' + dash.derniere_seance.nb_series + ' séries' : ''}${dash.derniere_seance.rpe_moyen ? ' · RPE moyen ' + dash.derniere_seance.rpe_moyen : ''}.`)
  const reg = dash.regularite || {}
  if (reg.seances_prevues != null) L.push(`- Régularité : objectif ${reg.seances_prevues} séances/semaine ; ${reg.seances_semaine != null ? reg.seances_semaine : '—'} faites cette semaine (depuis lundi).`)
  if (dash.prochaine_seance) { const ex = (d.programme || []).filter((p: any) => p && p.seance_id === dash.prochaine_seance && p.type !== 'cardio').map((p: any) => String(p.exercice).trim()); L.push(`- Prochaine séance du programme : ${dash.prochaine_seance}${ex.length ? ' (' + ex.join(', ') + ')' : ''}. Les charges/reps visées sont dans l'app (Aujourd'hui ▸ « Ce que Novalyz vise ») — ne les invente pas.`) }
  else if ((d.programme || []).length) L.push('- Semaine du programme terminée (toutes les séances faites).')
  // Lecture des exercices (même calcul que l'app et le mail récap).
  try {
    const Lx = _rcLectureExos((d.historique && d.historique.progression_par_exo) || {}, d.programme || [], d.exo_categories || {}, now.getTime(), d.contexte && d.contexte.etat)
    const kg = (x: any) => String(x).replace('.', ',')
    if (Lx.records.length) L.push(`- Records récents : ${Lx.records.slice(0, 4).map((x: any) => x.exo.trim() + ' ' + kg(x.c) + ' kg × ' + x.r).join(' ; ')}.`)
    if (Lx.progresse.length) L.push(`- En progrès : ${Lx.progresse.slice(0, 4).map((x: any) => x.exo.trim()).join(', ')}.`)
    if (Lx.bloque.length) L.push(`- Bloqués : ${Lx.bloque.slice(0, 3).map((x: any) => x.exo.trim() + ' à ' + kg(x.c) + ' kg × ' + x.r + ' depuis ' + x.n + ' séances').join(' ; ')}.`)
    if (Lx.recule.length) L.push(`- En recul : ${Lx.recule.slice(0, 3).map((x: any) => x.exo.trim()).join(', ')}.`)
    if (Lx.sous.length) L.push(`- Sous la fourchette de reps : ${Lx.sous.slice(0, 3).map((x: any) => x.exo.trim() + ' (fourchette ' + x.rmin + '-' + x.rmax + ' reps ; dernière fois ' + kg(x.c) + ' kg × ' + x.r + ' à RPE ' + x.rpe + ')').join(' ; ')}.`)
    if ((Lx.attendu || []).length) L.push(`- Baisse attendue (${Lx.ctx}) : ${Lx.attendu.slice(0, 3).map((x: any) => x.exo.trim()).join(', ')}.`)
  } catch (_) {}
  // Volume de la semaine vs minimum (séries/muscle, muscle secondaire = 0,5).
  const vo = (d.volume_obti || []).filter((o: any) => o && o.muscle && Number(o.series_min) > 0)
  if (vo.length) L.push(`- Volume de la semaine en cours, depuis lundi (séries faites / minimum hebdo) : ${vo.map((o: any) => o.muscle + ' ' + String(Math.round((Number(o.series_semaine) || 0) * 10) / 10).replace('.', ',') + '/' + o.series_min).join(', ')}.`)
  // Cardio 7 jours.
  const c7 = fmtYMD(minus(now, 6)), ch = ((d.cardio && d.cardio.history) || []).filter((h: any) => String(h.date || '') >= c7)
  if (ch.length) L.push(`- Cardio 7 derniers jours : ${ch.length} sortie(s), ${Math.round(ch.reduce((a: number, h: any) => a + (Number(h.duree) || 0), 0))} min au total.`)
  if (d.objectif && d.objectif.objectif) L.push(`- Objectif : ${d.objectif.objectif}.`)
  if (d.poids && d.poids[0] && d.poids[0].poids != null) L.push(`- Poids : ${String(d.poids[0].poids).replace('.', ',')} kg (pesée ${quand(d.poids[0].date)}).`)
  const nut = (d.nutri_historique || [])[0]
  if (nut && age(nut.date) != null && (age(nut.date) as number) <= 7) L.push(`- Nutrition saisie ${quand(nut.date)} : ${nut.kcal != null ? nut.kcal + ' kcal' : '—'}${nut.prot != null ? ', ' + nut.prot + ' g de protéines' : ''} (peut être incomplète).`)
  return L.length ? L.join('\n') : '(peu de données : encourage à enregistrer séances + questionnaire)'
}

// Garde-fou chiffres (audit I3, 01/11) : nombres de la réponse absents des données / de la question.
// 0-10 tolérés (comptes, RPE, notes /5 génériques). Virgule / point équivalents.
function _iaChiffresInconnus(reply: string, sources: string): string[] {
  const norm = (x: string) => String(Number(x.replace(',', '.')))
  const connus = new Set((sources.match(/\d+(?:[.,]\d+)?/g) || []).map(norm))
  const out: string[] = []
  for (const n of (reply.match(/\d+(?:[.,]\d+)?/g) || [])) { const v = norm(n); if (Number(v) <= 10 && Number.isInteger(Number(v))) continue; if (!connus.has(v) && out.indexOf(n) < 0) out.push(n) }
  return out
}
// Retire les phrases qui contiennent un chiffre non vérifié (dernier recours).
function _iaRetirerPhrases(reply: string, inconnus: string[]): string {
  const ph = reply.split(/(?<=[.!?])\s+/)
  return ph.filter((p) => !inconnus.some((n) => new RegExp('(^|[^0-9.,])' + n.replace(/[.,]/g, '[.,]') + '([^0-9]|$)').test(p))).join(' ').trim()
}

async function handleChatIA(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  // Mode COACH (audit I4, 01/11) : le coach interroge l'IA SUR un de ses athlètes → l'IA lui parle
  // du joueur à la 3e personne, et le quota est celui du COACH (plus celui de l'athlète).
  const coachMode = body.mode === 'coach' && !!body.coach_id
  const quotaId = coachMode ? 'coach:' + String(body.coach_id) : athlete_id
  const msgs = Array.isArray(body.messages) ? body.messages : []
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return jsonResp({ success: true, reply: "L'assistant IA n'est pas encore activé côté serveur (clé manquante). Tes analyses détaillées restent dans l'onglet Analyses.", disabled: true })

  // Quota jour (base gratuite) — RÉSERVÉ avant l'appel (quotas_jour, 10/11), rendu si l'appel échoue.
  const jour = fmtYMD(new Date())
  if (!Array.isArray(msgs) || !msgs.some((m: any) => m && m.role === 'user' && m.content)) return jsonResp({ success: false, error: 'message vide' })
  let resa = await _quotaReserver(quotaId, 'ia', jour, IA_QUOTA_JOUR), resaType = 'ia', resaSujet = quotaId, resaJour = jour
  if (resa.erreur) return jsonResp({ success: false, error: 'quota_indisponible', reply: "Désolé, l'assistant est indisponible pour le moment. Réessaie dans un instant." })
  const used = resa.ok ? resa.n - 1 : IA_QUOTA_JOUR
  // Au-delà du quota du jour : questions achetées avec les points (Mes points ▸ boutique), réservées pareil.
  let bonus = false
  if (!resa.ok) {
    if (coachMode) return jsonResp({ success: true, limited: true, reply: `Limite du jour atteinte (${IA_QUOTA_JOUR} questions à Novalyz IA). Reviens demain.` })
    const achetes = await _iaCreditsAchetes(athlete_id)
    resa = await _quotaReserver(athlete_id, 'ia_bonus', QUOTA_CUMUL, achetes); resaType = 'ia_bonus'; resaSujet = athlete_id; resaJour = QUOTA_CUMUL
    if (resa.erreur) return jsonResp({ success: false, error: 'quota_indisponible', reply: "Désolé, l'assistant est indisponible pour le moment. Réessaie dans un instant." })
    if (!resa.ok) return jsonResp({ success: true, limited: true, reply: `Tu as atteint ta limite du jour (${IA_QUOTA_JOUR} échanges avec Novalyz IA). Tu peux échanger 150 points contre 5 questions de plus (Aujourd'hui ▸ Mes points), ou revenir demain. En attendant, jette un œil à l'onglet Analyses.` })
    bonus = true
  }

  // Grounding : données réelles (moteur = source de vérité).
  let ctxTxt = '(données indisponibles)', prenomAth = ''
  try { const res = await handleGetAppData(new URLSearchParams({ athlete_id })); const dd = await res.json(); ctxTxt = _iaContexte(dd, new Date()); prenomAth = String((dd && dd.athlete && dd.athlete.nom) || '').trim().split(/\s+/)[0] } catch (_) {}
  if (coachMode && !prenomAth) { try { const { data: a } = await sb().from('athletes').select('nom').eq('id', athlete_id).single(); prenomAth = String((a as any)?.nom || '').trim().split(/\s+/)[0] } catch (_) {} }

  const qui = coachMode
    ? `Tu parles au COACH de l'athlète ${prenomAth || '(prénom inconnu)'} (pas à l'athlète) : parle de l'athlète à la 3e personne et aide le coach à décider.`
    : `Tu parles à l'athlète (tutoiement).`
  const system = `Tu es le coach IA de Novalyz, une app d'entraînement (musculation + cardio). ${qui} En français, bienveillant, concret et CONCIS (3 à 6 phrases).

RÈGLES STRICTES :
- Réponds UNIQUEMENT à partir des DONNÉES ci-dessous (ce sont celles que l'app affiche). N'invente JAMAIS un chiffre, une charge, une séance ou une valeur : si l'info n'y est pas, dis-le simplement et indique où la trouver dans l'app.
- Chaque donnée est datée : ne présente pas une donnée ancienne comme actuelle.
- Ne donne pas de charges ou de reps à viser : elles sont calculées par l'app (Aujourd'hui ▸ « Ce que Novalyz vise »).
- Tu n'es pas médecin : aucun diagnostic ni prescription. En cas de douleur/blessure, invite à consulter un professionnel.
- Ne contredis pas les verdicts de l'app (état du jour, alertes, reco, contexte).
- Reste sur l'entraînement / la récupération / la nutrition sportive ; recentre gentiment si on te demande autre chose.

DONNÉES (aujourd'hui) :
${ctxTxt}`

  const history = msgs
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-12)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))
  if (!history.length || history[history.length - 1].role !== 'user') { await _quotaRendre(resaSujet, resaType, resaJour, resa); return jsonResp({ success: false, error: 'message vide' }) }

  const appel = async (msgs: any[]): Promise<string | null> => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 700, system, messages: msgs }),
    })
    const j = await r.json()
    if (!r.ok) return null
    return (Array.isArray(j.content) ? j.content.filter((b: any) => b && b.type === 'text').map((b: any) => b.text).join('\n') : '').trim()
  }
  let reply = ''
  try {
    const r1 = await appel(history)
    if (r1 == null) { await _quotaRendre(resaSujet, resaType, resaJour, resa); return jsonResp({ success: false, error: 'ia_http', reply: "Désolé, l'assistant a rencontré un souci. Réessaie dans un instant." }) }
    reply = r1
    // Garde-fou chiffres (I3, 01/11) : tout nombre doit venir des données ou de la question.
    const sources = ctxTxt + '\n' + history.filter((m: any) => m.role === 'user').map((m: any) => m.content).join('\n')
    let inconnus = _iaChiffresInconnus(reply, sources)
    if (inconnus.length) {
      const r2 = await appel(history.concat([{ role: 'assistant', content: reply }, { role: 'user', content: `Ta réponse contient des chiffres qui ne sont PAS dans mes données (${inconnus.join(', ')}). Réécris-la sans aucun chiffre absent des données ci-dessus.` }]))
      if (r2) { reply = r2; inconnus = _iaChiffresInconnus(reply, sources) }
      if (inconnus.length) reply = _iaRetirerPhrases(reply, inconnus)
    }
  } catch (_) {
    await _quotaRendre(resaSujet, resaType, resaJour, resa)
    return jsonResp({ success: false, error: 'ia_reseau', reply: "Désolé, l'assistant est injoignable pour le moment." })
  }
  if (!reply) reply = "Je n'ai pas cette information dans tes données — regarde les onglets Aujourd'hui et Analyses, ou reformule ta question."

  await _quotaAncienEcrire(resaSujet, resaType, resaJour, resa)   // seulement si la migration n'est pas appliquée
  void bonus

  return jsonResp({ success: true, reply, remaining: Math.max(0, IA_QUOTA_JOUR - (used + 1)) })
}

// Analyse morpho-anatomique par PHOTO (premium, en veille sans clé). Vision Claude
// Sonnet 5.5. Photos JAMAIS stockées (RGPD-minimal) : analysées puis jetées, on ne
// garde que le texte renvoyé (non persisté non plus). Consentement obligatoire.
const MORPHO_QUOTA_JOUR = 1

// Recommandations d'exercices DÉTERMINISTES à partir des leviers (segments mesurés)
// et des antécédents déclarés. Règles biomécaniques figées — AUCUNE invention, aucun
// chiffre sorti du chapeau : on ne déduit que ce que les ratios de leviers impliquent.
// Chaque item : { t, d, bons[], eviter[], src:'mesure'|'antecedent' }.
function recoMorphoExercices(seg: any, q: any): any[] {
  const num = (x: any) => { const v = Number(x); return (x != null && isFinite(v) && v > 0) ? v : null }
  const taille = num(seg?.taille), tronc = num(seg?.tronc), femur = num(seg?.femur), tibia = num(seg?.tibia)
  const humerus = num(seg?.humerus), avant = num(seg?.avantbras), envergure = num(seg?.envergure)
  const epaules = num(seg?.epaules), hanches = num(seg?.hanches)
  const out: any[] = []

  // 1) Squat : rapport fémur / tronc (à défaut fémur / tibia)
  if (femur && tronc) {
    const r = femur / tronc
    if (r >= 0.82) out.push({ t: 'Fémurs longs vs tronc', d: "En squat, ton buste penchera davantage vers l'avant : privilégie des variantes qui gardent le dos sûr et le genou libre.", bons: ['Squat gobelet', 'Hack squat', 'Squat barre haute + talons surélevés', 'Presse à cuisses'], eviter: ['Good morning lourd', 'Squat barre basse très large au départ'], src: 'mesure' })
    else if (r <= 0.72) out.push({ t: 'Tronc long / fémurs courts', d: 'Tes leviers autorisent un squat plus vertical, dos droit.', bons: ['Back squat barre basse', 'Front squat', 'Squat barre haute'], eviter: [], src: 'mesure' })
    else out.push({ t: 'Leviers de squat équilibrés', d: 'Pas de contrainte marquée : les variantes de squat te conviennent.', bons: ['Back squat', 'Front squat'], eviter: [], src: 'mesure' })
  } else if (femur && tibia) {
    if (femur / tibia >= 1.15) out.push({ t: 'Fémurs longs (vs tibias)', d: 'Buste plus penché en squat : garde le dos neutre.', bons: ['Squat gobelet', 'Hack squat', 'Talons surélevés'], eviter: ['Good morning lourd'], src: 'mesure' })
  }

  // 2) Bras : ape index (envergure − taille), à défaut (humérus+avant-bras)/taille
  const bras = (humerus && avant) ? (humerus + avant) : null
  let longArms = false, shortArms = false
  if (envergure && taille) { const ape = envergure - taille; if (ape >= 3) longArms = true; else if (ape <= -3) shortArms = true }
  else if (bras && taille) { const r = bras / taille; if (r >= 0.455) longArms = true; else if (r <= 0.40) shortArms = true }
  if (longArms) out.push({ t: 'Bras longs', d: "À l'aise sur les tirages/tractions (allonge) ; amplitude plus longue au développé couché.", bons: ['Tractions', 'Rowing', 'Développé couché prise modérée'], eviter: ['Développé couché prise très large'], src: 'mesure' })
  else if (shortArms) out.push({ t: 'Bras courts', d: 'Développé couché favorisé ; tirages sur une course un peu plus longue.', bons: ['Développé couché', 'Dips'], eviter: [], src: 'mesure' })

  // 3) Épaules vs hanches
  if (epaules && hanches) {
    const r = epaules / hanches
    if (r >= 1.45) out.push({ t: 'Carrure large (épaules ≫ hanches)', d: 'Atout pour un visuel en V : entretiens dos et épaules.', bons: ['Tractions', 'Développé épaules', 'Rowing'], eviter: [], src: 'mesure' })
    else if (r <= 1.15) out.push({ t: 'Bassin large vs épaules', d: 'Élargir les épaules équilibre la silhouette ; au squat, un stance un peu plus large peut être plus naturel.', bons: ['Développé épaules', 'Élévations latérales', 'Tirage'], eviter: [], src: 'mesure' })
  }

  // 4) Style de soulevé de terre (tronc + fémur + bras) — solide.
  if (femur && tronc) {
    const r = femur / tronc
    if (r >= 0.82) out.push({ t: 'Soulevé de terre : plutôt sumo / trap-bar', d: 'Fémurs longs : le conventionnel penche beaucoup le dos. Le sumo ou la trap-bar réduisent le bras de levier lombaire.', bons: ['Soulevé de terre sumo', 'Trap-bar deadlift', 'Hip thrust'], eviter: ['Conventionnel lourd dos très penché'], src: 'mesure' })
    else if (longArms) out.push({ t: 'Soulevé de terre : conventionnel favorable', d: 'Bras longs + tronc proportionné : course courte, le conventionnel te convient.', bons: ['Soulevé de terre conventionnel', 'Rack pull'], eviter: [], src: 'mesure' })
    else out.push({ t: 'Soulevé de terre : conventionnel ou trap-bar', d: 'Pas de contrainte forte : choisis selon le confort lombaire.', bons: ['Soulevé de terre conventionnel', 'Trap-bar deadlift'], eviter: [], src: 'mesure' })
  }

  // 5) Appui de squat (largeur) — hanches vs épaules — solide.
  if (hanches && epaules) {
    const r = hanches / epaules
    if (r >= 1.1) out.push({ t: 'Squat : appui large, pointes ouvertes', d: 'Hanches plus larges que les épaules : un stance large et des pointes de pied ouvertes libèrent la hanche.', bons: ['Squat stance large', 'Box squat', 'Sumo squat'], eviter: ['Stance très serré, pieds droits'], src: 'mesure' })
    else if (r <= 0.9) out.push({ t: 'Squat : appui plus serré possible', d: 'Bassin étroit : un stance modéré, pieds peu ouverts, peut suffire.', bons: ['Squat stance modéré', 'Front squat'], eviter: [], src: 'mesure' })
  }

  // 6) Développé couché (amplitude) — humérus — solide.
  if (humerus && taille) {
    if (humerus / taille >= 0.21) out.push({ t: 'Développé couché : longue amplitude', d: 'Humérus long : grande course, point faible en bas. Travaille la portion basse et le volume pectoral.', bons: ['Floor press / board press', 'Écarté (volume pec)', 'Développé prise modérée'], eviter: ['Prise très large à froid'], src: 'mesure' })
  }

  // 7) PISTE (à nuancer) — Tibia / cheville / mollet.
  if (femur && tibia) {
    const r = femur / tibia
    if (r >= 1.15) out.push({ t: 'Tibias courts (vs fémurs)', d: 'Avis indicatif, à nuancer : buste un peu plus penché au squat → talons surélevés souvent utiles. Dépend aussi de ta mobilité de cheville.', bons: ['Talons surélevés au squat', 'Mobilité cheville', 'Mollets debout'], eviter: [], src: 'piste' })
    else if (r <= 0.95) out.push({ t: 'Tibias longs (vs fémurs)', d: 'Avis indicatif, à nuancer : squat plus vertical possible ; pense aux mollets. À ajuster selon ton ressenti.', bons: ['Squat barre haute', 'Mollets assis + debout'], eviter: [], src: 'piste' })
  }

  // 8) PISTE (à nuancer) — Avant-bras : curls & tirage.
  if (avant && humerus) {
    const r = avant / humerus
    if (r >= 0.75) out.push({ t: 'Avant-bras longs', d: 'Avis indicatif, à nuancer : au biceps, le curl pupitre / incliné donne une meilleure tension ; au rowing, une prise un peu plus large. À tester.', bons: ['Curl pupitre', 'Curl incliné', 'Rowing prise large'], eviter: [], src: 'piste' })
    else if (r <= 0.6) out.push({ t: 'Avant-bras courts', d: 'Avis indicatif, à nuancer : bon levier au curl debout ; le tirage reste confortable.', bons: ['Curl barre debout', 'Tirage classique'], eviter: [], src: 'piste' })
  }

  // 9) Garde-fous — antécédents / état (sécurité, sans avis médical)
  const ant: string[] = Array.isArray(q?.antecedents) ? q.antecedents.map((x: any) => String(x)) : []
  const femmeFlags: string[] = Array.isArray(q?.femme) ? q.femme.map((x: any) => String(x)) : []
  const has = (k: string) => ant.indexOf(k) >= 0
  if (has('hernie') || has('disque') || has('sciatique')) out.push({ t: 'Garde-fou — dos / colonne', d: 'On écarte la flexion lombaire chargée et l’hyperpression ; variantes appui et dos neutre. Avis médical si douleur.', bons: ['Hip thrust', 'Presse à cuisses', 'Squat gobelet', 'Tirage poitrine appuyé', 'Gainage anti-extension'], eviter: ['Soulevé de terre lourd dos rond', 'Good morning', 'Squat très lourd à froid'], src: 'antecedent' })
  if (has('epaule') || has('tendinite')) out.push({ t: 'Garde-fou — épaule / tendons', d: 'Amplitude maîtrisée, prise neutre, pas de charge max sur l’articulation douloureuse ; excentrique léger et progressif.', bons: ['Développé haltères prise neutre', 'Face pull', 'Élévations légères', 'Excentrique léger'], eviter: ['Développé nuque', 'Dips profonds', 'Développé très large', 'Charges max en douleur'], src: 'antecedent' })
  if (has('genou')) out.push({ t: 'Garde-fou — genou', d: 'Amplitudes sans douleur, pas de choc ; renforce quadriceps et ischios en contrôle.', bons: ['Presse amplitude confortable', 'Leg curl / extension légers', 'Vélo'], eviter: ['Fentes profondes lourdes', 'Sauts / pliométrie', 'Squat complet douloureux'], src: 'antecedent' })
  if (has('poignet')) out.push({ t: 'Garde-fou — poignet', d: 'Poignet neutre (pas cassé en arrière) ; sangles pour soulager la prise.', bons: ['Prise neutre / marteau', 'Sangles de tirage', 'Machines'], eviter: ['Poignet en hyperextension chargé', 'Développé poignet cassé'], src: 'antecedent' })
  if (has('cheville')) out.push({ t: 'Garde-fou — cheville', d: 'Travail de proprioception, pas d’instabilité en charge.', bons: ['Renfo mollets contrôlé', 'Proprioception / équilibre', 'Presse'], eviter: ['Sauts / réception instable', 'Charges lourdes en déséquilibre'], src: 'antecedent' })
  if (has('cardiaque') || has('hta') || has('asthme')) out.push({ t: 'Garde-fou — cœur / tension / respiration', d: 'Éviter l’hyperpression (blocage respiratoire) : respire, séries modérées, récup suffisante. Avis médical recommandé.', bons: ['Séries 8–15 reps', 'Récupération suffisante', 'Cardio progressif'], eviter: ['Charges maximales en apnée (Valsalva)', 'Isométries longues maximales'], src: 'antecedent' })
  if (has('prothese')) out.push({ t: 'Garde-fou — arthrose / prothèse', d: 'Travail sans douleur, amplitudes maîtrisées, machines guidées.', bons: ['Machines guidées', 'Amplitudes confortables'], eviter: ['Chocs / sauts', 'Amplitudes extrêmes douloureuses'], src: 'antecedent' })
  if (has('chirurgie') || has('blessure')) out.push({ t: 'Garde-fou — zone en récupération', d: 'Reprise progressive sur la zone concernée, sans douleur ; suis les consignes du pro qui te suit.', bons: ['Charges légères progressives', 'Amplitude indolore', 'Renforcement contrôlé'], eviter: ['Charges lourdes sur la zone', 'Mouvements douloureux'], src: 'antecedent' })
  if (femmeFlags.indexOf('grossesse') >= 0 || femmeFlags.indexOf('postpartum') >= 0) out.push({ t: 'Garde-fou — grossesse / post-partum', d: 'Priorité sécurité : avis médical / sage-femme requis (rien de médical ici).', bons: ['Renforcement doux', 'Plancher pelvien', 'Travail debout'], eviter: ['Décubitus dorsal prolongé', 'Hyperpression abdominale', 'Charges maximales'], src: 'antecedent' })

  return out
}

async function handleAnalyseMorpho(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  const images = Array.isArray(body.images) ? body.images : []
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  if (!body.consent) return jsonResp({ success: false, error: 'consentement requis' })
  if (!images.length) return jsonResp({ success: false, error: 'aucune photo' })
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return jsonResp({ success: true, disabled: true, analyse: "L'analyse morpho n'est pas encore activée côté serveur (clé manquante)." })

  const jour = fmtYMD(new Date())
  // Quota RÉSERVÉ avant l'analyse (quotas_jour, 10/11), rendu si elle échoue.
  const resaM = await _quotaReserver(athlete_id, 'morpho', jour, MORPHO_QUOTA_JOUR)
  if (resaM.erreur) return jsonResp({ success: false, error: 'quota_indisponible', analyse: "Service indisponible pour le moment. Réessaie dans un instant." })
  if (!resaM.ok) return jsonResp({ success: true, limited: true, analyse: `Tu as atteint ta limite du jour (${MORPHO_QUOTA_JOUR} analyse morpho). La version premium (bientôt) en débloquera plus.` })

  let objTxt = ''
  try { const { data: o } = await sb().from('objectif').select('objectif').eq('athlete_id', athlete_id).limit(1); if (o?.length && o[0].objectif) objTxt = String(o[0].objectif) } catch (_) {}

  // Mensurations de segments (si l'athlète en a saisi) → fiabilisent la partie proportions.
  let mensTxt = ''
  try {
    const { data: m } = await sb().from('indicateurs').select('cle,valeur,unite,date').eq('athlete_id', athlete_id).eq('seance_id', 'mensuration').order('date', { ascending: false })
    if (m?.length) {
      const seen: Record<string, boolean> = {}; const parts: string[] = []
      for (const r of m) { const k = String(r.cle); if (seen[k]) continue; seen[k] = true; parts.push(`${k}: ${r.valeur}${r.unite ? ' ' + r.unite : ''}`) }
      if (parts.length) mensTxt = parts.join(' · ')
    }
  } catch (_) {}

  // Questionnaire + mesures de segment (morpho v2) : adaptent l'analyse (homme/femme),
  // fiabilisent les proportions, et alimentent les recos d'exercices déterministes.
  const q = (body.questionnaire && typeof body.questionnaire === 'object') ? body.questionnaire : {}
  const seg = (body.segments && typeof body.segments === 'object') ? body.segments : {}
  const SEG_LBL: Record<string, string> = { taille: 'taille', tronc: 'tronc (buste)', epaules: "largeur d'épaules", hanches: 'largeur de hanches', humerus: 'bras (humérus)', avantbras: 'avant-bras', envergure: 'envergure', femur: 'fémur', tibia: 'tibia' }
  const segParts: string[] = []
  for (const k of Object.keys(SEG_LBL)) { const v = Number((seg as any)[k]); if ((seg as any)[k] != null && isFinite(v) && v > 0) segParts.push(`${SEG_LBL[k]} ${v} cm`) }
  const segTxt = segParts.join(' · ')
  const sexe = String((q as any).sexe || '')
  const sexeTxt = sexe === 'F' ? 'une femme' : sexe === 'H' ? 'un homme' : ''
  const ANT_LBL: Record<string, string> = { hernie: 'hernie discale', disque: 'disque pincé / discopathie', sciatique: 'sciatique / lombalgie', scoliose: 'scoliose', epaule: 'épaule sensible', tendinite: 'tendinite', genou: 'genou douloureux', poignet: 'poignet / canal carpien', cheville: 'cheville instable', prothese: 'prothèse/arthrose', cardiaque: 'problème cardiaque', hta: 'hypertension', asthme: 'asthme', chirurgie: 'chirurgie récente', blessure: 'blessure en cours' }
  const FEM_LBL: Record<string, string> = { grossesse: 'grossesse en cours', postpartum: 'post-partum récent', diastasis: 'diastasis' }
  const antList = Array.isArray((q as any).antecedents) ? (q as any).antecedents.map((x: any) => ANT_LBL[String(x)] || String(x)) : []
  const femList = Array.isArray((q as any).femme) ? (q as any).femme.map((x: any) => FEM_LBL[String(x)] || String(x)) : []
  const antTxt = [...antList, ...femList].join(', ')
  const exercices = recoMorphoExercices(seg, q)

  // Vues étiquetées (face / profil / dos) dans l'ordre des images envoyées.
  const views = Array.isArray(body.views) ? body.views.map((v: any) => String(v || '')) : []
  const content: any[] = []
  images.slice(0, 3).forEach((im: any, i: number) => {
    if (im && im.data && im.media_type) {
      content.push({ type: 'text', text: `Photo ${views[i] ? '(' + views[i] + ')' : '#' + (i + 1)} :` })
      content.push({ type: 'image', source: { type: 'base64', media_type: String(im.media_type), data: String(im.data) } })
    }
  })
  if (!content.length) { await _quotaRendre(athlete_id, 'morpho', jour, resaM); return jsonResp({ success: false, error: 'images invalides' }) }
  content.push({
    type: 'text', text: `Analyse la morphologie pour orienter l'ENTRAÎNEMENT en musculation.${sexeTxt ? ` La personne est ${sexeTxt}.` : ''}${objTxt ? ` Objectif : ${objTxt}.` : ''}${segTxt ? ` Longueurs de segments fournies (cm) : ${segTxt} — tu PEUX donc affirmer les proportions correspondantes (confiance "mesure").` : (mensTxt ? ` Mensurations fournies : ${mensTxt}.` : ' Aucune mesure de segment fournie (les proportions restent à confirmer, confiance "mesure").')}${antTxt ? ` Antécédents/état signalés : ${antTxt} — tiens-en compte avec prudence (jamais d'avis médical).` : ''}

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte autour, aucune balise markdown), EXACTEMENT cette forme :
{
 "morphotype": "une courte phrase (type de carrure / répartition de la masse)",
 "synthese": [ {"t":"constat général","c":"visible|probable|mesure"} ],
 "equilibre": [ {"g":"nom du groupe musculaire","n":"développé|correct|moyen|en retard","ton":"good|warn|bad"} ],
 "posture": [ {"t":"observation posturale","c":"visible|probable|mesure"} ],
 "priorites": [ {"t":"titre court","d":"pourquoi en 1 phrase","ex":["exercice 1","exercice 2"]} ],
 "reco": "une phrase de synthèse actionnable",
 "mesures": "ce qu'il faudrait mesurer pour fiabiliser, ou ce que les segments/mensurations fournis apportent"
}
N'inclus PAS de recommandations d'exercices basées sur les LEVIERS (longueurs de segments) dans ce JSON : elles sont calculées séparément de façon déterministe. "priorites" reste ta lecture issue des PHOTOS (groupes en retard à travailler).`
  })

  const system = `Tu es un préparateur physique. À partir de photos (face / profil / dos) et, si fournies, de mensurations de segments, tu orientes la MUSCULATION : groupes en avance / en retard, équilibre, posture globale.

RÈGLES STRICTES — réponds en FRANÇAIS, UNIQUEMENT en JSON conforme au format demandé :
- Base tes constats sur des PRINCIPES RECONNUS (biomécanique, correctif postural, pratique de la musculation). N'INVENTE RIEN.
- Niveau de confiance OBLIGATOIRE sur chaque constat de "synthese" et "posture" : "visible" (clair sur la photo), "probable" (tendance à confirmer), "mesure" (nécessite une mesure).
- AUCUN chiffre inventé : jamais de % de masse grasse ni de longueur de segment estimée. Les proportions/longueurs ne sont affirmées QUE si des mensurations sont fournies ; sinon confiance "mesure" et dis-le dans "mesures".
- Pas de jugement esthétique ni sur le poids / le gras. Ton factuel et bienveillant.
- Tu n'es PAS médecin : aucun diagnostic. Un doute postural → formule « à confirmer par un bilan de mouvement ».
- Si une vue manque ou est inexploitable, signale-le dans "mesures" et baisse la confiance des constats concernés.
- "equilibre" : liste les principaux groupes jugeables (ex. dos, épaules, pectoraux, bras, fessiers, quadriceps, ischios, mollets). "priorites" : 2 à 4 items, chacun avec des exercices concrets.
- Si le sexe est précisé, adopte la lecture anatomique correspondante (homme / femme). Si des antécédents/état sont signalés, reste prudent (adaptation, jamais de diagnostic).`

  let raw = ''
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1800, system, messages: [{ role: 'user', content }] }),
    })
    const j = await r.json()
    if (!r.ok) { await _quotaRendre(athlete_id, 'morpho', jour, resaM); return jsonResp({ success: false, error: 'ia_http_' + r.status, analyse: "L'analyse a rencontré un souci. Réessaie dans un instant." }) }
    raw = (Array.isArray(j.content) ? j.content.filter((b: any) => b && b.type === 'text').map((b: any) => b.text).join('\n') : '').trim()
  } catch (_) {
    await _quotaRendre(athlete_id, 'morpho', jour, resaM)
    return jsonResp({ success: false, error: 'ia_reseau', analyse: "Service injoignable pour le moment." })
  }
  if (!raw) await _quotaRendre(athlete_id, 'morpho', jour, resaM)
  if (!raw) return jsonResp({ success: true, analyse: "Je n'ai pas pu produire d'analyse — réessaie avec des photos plus nettes (face, profil, dos, bonne lumière, tenue ajustée)." })

  // Parse JSON structuré (tolérant : retire d'éventuelles balises ``` et texte autour).
  let resultat: any = null
  try {
    let s = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    const a = s.indexOf('{'), b = s.lastIndexOf('}')
    if (a >= 0 && b > a) s = s.slice(a, b + 1)
    resultat = JSON.parse(s)
  } catch (_) { resultat = null }

  // Recos d'exercices DÉTERMINISTES (leviers + antécédents) attachées au résultat.
  // Source de vérité = les règles ci-dessus, pas l'IA.
  if (exercices.length) { if (!resultat) resultat = {}; (resultat as any).exercices = exercices }

  await _quotaAncienEcrire(athlete_id, 'morpho', jour, resaM)   // seulement si la migration n'est pas appliquée

  // Photos NON stockées : rien gardé côté serveur. `resultat` = structuré (ou null → front retombe sur `analyse`).
  return jsonResp({ success: true, resultat, analyse: (resultat && resultat.reco) ? String(resultat.reco) : raw })
}

async function handleSaveSemaineType(body: any): Promise<Response> {
  const { athlete_id } = body
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const v = (body.valeur === 'glissant') ? 'glissant' : 'calendaire'
  const err = await _prefsAthleteEcrire(String(athlete_id), { semaine_type: v })   // 10/11 : athletes.prefs
  if (err) return jsonResp({ success: false, error: err })
  return jsonResp({ success: true })
}

async function handleMarquerAlerteLue(body: any): Promise<Response> {
  const { athlete_id, id } = body
  if (!athlete_id || !id) return jsonResp({ success: false, error: 'Paramètres manquants' })
  const { data: existing } = await sb().from('indicateurs').select('date').eq('athlete_id', athlete_id).eq('seance_id', 'alerte_lue').eq('cle', String(id)).limit(1)
  if (!existing?.length) {
    const { error } = await sb().from('indicateurs').insert({ athlete_id, date: fmtYMD(new Date()), seance_id: 'alerte_lue', cle: String(id), valeur: '1', unite: '', source: 'app' })
    if (error) return jsonResp({ success: false, error: error.message })
  }
  return jsonResp({ success: true })
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
  // Audit Contexte X7 (01/11) : poser un état REMPLACE celui en cours.
  //  • même état aux mêmes dates déjà enregistré → rien à ajouter (double appui) ;
  //  • toute période qui chevauche le nouveau début (sans fin OU fin ≥ début) est close la veille ;
  //    si elle commençait le même jour (ou après), elle est remplacée (supprimée).
  const { data: rowsAth } = await sb().from('contexte_athlete').select('*').eq('athlete_id', athlete_id)
  if ((rowsAth || []).some((r: any) => String(r.etat) === etat && normDate(r.date_debut) === debut && (normDate(r.date_fin) || null) === (fin || null))) {
    return jsonResp({ success: true, deja: true, actif: _contexteActif(rowsAth || [], new Date()) })
  }
  const newD = parseFR(debut)
  if (newD) {
    const veille = new Date(newD.getTime()); veille.setUTCDate(veille.getUTCDate() - 1)
    const veilleStr = fmtYMD(veille)
    for (const r of (rowsAth || [])) {
      const rd = normDate(r.date_debut), rf = r.date_fin ? normDate(r.date_fin) : null
      if (rf && rf < debut) continue                       // période déjà finie avant le nouveau début
      if (rd && rd >= debut) await sb().from('contexte_athlete').delete().eq('id', r.id)
      else await sb().from('contexte_athlete').update({ date_fin: veilleStr }).eq('id', r.id)
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
  // Audit Contexte X9 (01/11) : « Terminer » clôt l'état ACTIF, qu'il ait une date de fin ou non
  // (avant : seulement les états sans fin → « Contexte introuvable » pour tous les états à durée).
  // Fin = hier (l'état ne s'applique plus aujourd'hui) ; commencé aujourd'hui → supprimé.
  const { data: rowsC } = await sb().from('contexte_athlete').select('*').eq('athlete_id', athlete_id)
  const act = _contexteActif(rowsC || [], new Date())
  if (act && act.id) {
    const hier = fmtYMD(minus(new Date(), 1))
    const r = (rowsC || []).find((x: any) => x.id === act.id)
    const rd = r ? normDate(r.date_debut) : null
    const q = (rd && rd > hier) ? sb().from('contexte_athlete').delete().eq('id', act.id) : sb().from('contexte_athlete').update({ date_fin: body.date_fin ? fin : hier }).eq('id', act.id)
    const { error } = await q
    if (error) return jsonResp({ success: false, error: error.message })
    return jsonResp({ success: true })
  }
  return jsonResp({ success: false, error: 'Aucun état en cours' })
}

async function handleSaveCardio(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'Athlète manquant' })
  const sid = `cardio_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const d = normDate(body.date) || fmtYMD(new Date())
  const pb = _cardioHorsLimites(body, d)
  if (pb) return jsonResp({ success: false, error: pb })
  const rows = _buildCardioRows(body, athlete_id, sid, d)
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ success: false, error: error.message })
  }
  try { await rebuildActivites(athlete_id) } catch (_) {}   // P0.2 : tenir l'entité Activité à jour
  return jsonResp({ success: true, seance_id: sid })
}

// ═══════════ P0.2 — Entité Activité canonique (socle multi-source) ═══════════
// (Re)construit `activites` + `activite_sources` à partir des séances cardio
// existantes (indicateurs cardio_%). Idempotent : upsert sur (athlete_id, seance_id)
// → l'activity_id reste STABLE, pour que le GPS et les autres sources s'y rattachent
// plus tard sans casser les liens. N'affecte pas le moteur (table à part).
async function rebuildActivites(athlete_id: string): Promise<{ built: number; error?: string }> {
  const { data: rows, error } = await sb().from('indicateurs')
    .select('date, seance_id, cle, valeur, source').eq('athlete_id', athlete_id).like('seance_id', 'cardio_%')
  if (error) return { built: 0, error: error.message }
  const bySid: Record<string, { date: string; cles: Record<string, string>; source: string }> = {}
  for (const r of (rows || [])) {
    const sid = String(r.seance_id)
    if (!bySid[sid]) bySid[sid] = { date: normDate(r.date), cles: {}, source: '' }
    bySid[sid].cles[String(r.cle)] = String(r.valeur)
    if (r.source && !bySid[sid].source) bySid[sid].source = String(r.source)
  }
  const srcMeta: Record<string, string> = {}
  const actRows = Object.keys(bySid).map((sid) => {
    const b = bySid[sid]
    const isHyrox = sid.indexOf('cardio_hyrox_') === 0 || b.cles['type_cardio'] === 'hyrox'
    const type = isHyrox ? 'hyrox' : (b.cles['type_cardio'] || 'autre')
    const dureeS = isHyrox
      ? (Number(b.cles['hyrox_total']) || (Number(b.cles['duree']) || 0) * 60)
      : (Number(b.cles['duree']) || 0) * 60
    const distM = (Number(b.cles['distance']) || 0) * 1000
    const debut = b.date ? new Date(b.date + 'T00:00:00Z').toISOString() : null
    const src = (b.source === 'fitbit') ? 'google_health' : 'manual'
    srcMeta[sid] = src
    return {
      athlete_id, seance_id: sid, type, debut, fin: null,
      duree_s: dureeS || null, distance_m: distM || null,
      source_primaire: src, statut: 'complete', updated_at: new Date().toISOString(),
    }
  })
  if (!actRows.length) return { built: 0 }
  const { data: upserted, error: upErr } = await sb().from('activites')
    .upsert(actRows, { onConflict: 'athlete_id,seance_id' }).select('id, seance_id')
  if (upErr) return { built: 0, error: upErr.message }
  const srcRows = (upserted || []).map((a: any) => ({
    activity_id: a.id, source: srcMeta[String(a.seance_id)] || 'manual',
    source_ref: String(a.seance_id), imported_at: new Date().toISOString(),
  }))
  if (srcRows.length) {
    const { error: sErr } = await sb().from('activite_sources').upsert(srcRows, { onConflict: 'activity_id,source' })
    if (sErr) return { built: actRows.length, error: sErr.message }
  }
  return { built: actRows.length }
}

async function handleRebuildActivites(body: any): Promise<Response> {
  const athlete_id = String(body.athlete_id || '')
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const r = await rebuildActivites(athlete_id)
  if (r.error) return jsonResp({ success: false, error: r.error, built: r.built })
  return jsonResp({ success: true, built: r.built })
}

async function handleGetActivites(params: URLSearchParams): Promise<Response> {
  const athlete_id = params.get('athlete_id') || ''
  if (!athlete_id) return jsonResp({ success: false, error: 'athlete_id manquant' })
  const { data: acts, error } = await sb().from('activites')
    .select('*').eq('athlete_id', athlete_id).order('debut', { ascending: false }).limit(500)
  if (error) return jsonResp({ success: false, error: error.message })
  const ids = (acts || []).map((a: any) => a.id)
  let sources: any[] = []
  if (ids.length) {
    const { data: srcs } = await sb().from('activite_sources').select('activity_id, source, source_ref').in('activity_id', ids)
    sources = srcs || []
  }
  const byAct: Record<string, string[]> = {}
  for (const s of sources) { (byAct[String(s.activity_id)] = byAct[String(s.activity_id)] || []).push(String(s.source)) }
  const activites = (acts || []).map((a: any) => ({
    id: a.id, seance_id: a.seance_id, type: a.type, debut: a.debut, duree_s: a.duree_s,
    distance_m: a.distance_m != null ? Number(a.distance_m) : null,
    source_primaire: a.source_primaire, statut: a.statut, sources: byAct[String(a.id)] || [],
  }))
  return jsonResp({ success: true, activites })
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
  // Comme l'ancien marqueur (effacé avec les indicateurs de la séance) : la séance supprimée
  // libère son envoi_id. Sans effet si la table n'existe pas encore.
  try { await sb().from('envois_recus').delete().eq('athlete_id', athleteId).eq('seance_id', seanceId).eq('date', iso) } catch (_) {}
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
// ═══════════════════ SESSIONS (jeton signé) — 28/10/2026 ═══════════════════
// Avant : AUCUNE session — l'app envoyait l'id de l'athlète et le serveur le croyait
// (n'importe qui pouvait lire une fiche en devinant un id). Désormais : à la connexion
// / inscription, le serveur remet un jeton signé HMAC-SHA256 (clé dérivée de PEPPER,
// déjà en env Supabase), valable 30 jours ; l'app le renvoie à chaque appel (`_t`).
// Le mot de passe (hashSalted/verifyPwd) n'est PAS modifié.
// Droits : un athlète n'accède qu'à SES données (et à son propre coach pour la
// messagerie) ; un coach n'accède qu'à SES athlètes.
// Déploiement en 2 temps : AUTH_ENFORCE absent → mode OBSERVATION (on journalise les
// appels non conformes, rien n'est refusé) ; AUTH_ENFORCE=1 → refus 401.
const SESSION_TTL_S = 30 * 24 * 3600
const ATHLETE_COACH_ACTIONS = new Set(['saveCommentaire', 'envoyerMediaCoach', 'mediaUploadUrl', 'getCommentaires', 'marquerCommentairesLus'])
const AUTH_PUBLIC = new Set(['ping', 'login', 'register', 'loginDispo', 'loginCoach', 'registerCoach', 'requestPasswordReset', 'resetPassword', 'confirmerEmail', 'exercices', 'inscriptionBeta', 'cronPushAlertes', 'cronResumes', 'cronResumesAuto', 'envelopperHachages'])
let _sessKeyCache: CryptoKey | null = null
function _b64u(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function _b64uStr(str: string): string { return _b64u(new TextEncoder().encode(str)) }
function _unb64uStr(s: string): string { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))) }
async function _sessKey(): Promise<CryptoKey | null> {
  const pepper = Deno.env.get('PEPPER'); if (!pepper) return null
  if (!_sessKeyCache) _sessKeyCache = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper + '|novalyz-session-v1'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  return _sessKeyCache
}
async function signSession(role: 'a' | 'c', id: string, nowS?: number): Promise<string | null> {
  const key = await _sessKey(); if (!key) return null
  const exp = Math.floor(nowS != null ? nowS : Date.now() / 1000) + SESSION_TTL_S
  const payload = `v1.${role}.${_b64uStr(String(id))}.${exp}`
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
  return payload + '.' + _b64u(sig)
}
async function verifySession(tok: string, nowS?: number): Promise<{ role: 'a' | 'c'; id: string; iat: number } | null> {
  try {
    const key = await _sessKey(); if (!key || !tok) return null
    const parts = String(tok).split('.'); if (parts.length !== 5 || parts[0] !== 'v1' || (parts[1] !== 'a' && parts[1] !== 'c')) return null
    const payload = parts.slice(0, 4).join('.')
    const sigB = Uint8Array.from(atob(parts[4].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((parts[4].length + 3) % 4)), c => c.charCodeAt(0))
    const ok = await crypto.subtle.verify('HMAC', key, sigB, new TextEncoder().encode(payload)); if (!ok) return null
    if (Number(parts[3]) < Math.floor(nowS != null ? nowS : Date.now() / 1000)) return null
    return { role: parts[1] as 'a' | 'c', id: _unb64uStr(parts[2]), iat: Number(parts[3]) - SESSION_TTL_S }
  } catch (_) { return null }
}
// Vérifie qu'un appel a le droit de toucher les ids qu'il vise.
// Droits PAR LIGNE : actions qui visent une ligne par son identifiant (sans athlete_id
// fiable dans la requête). On relit le(s) propriétaire(s) de la ligne en base ; la
// session doit être cet athlète, ou son coach. (Sinon un jeton valide suffisait à
// supprimer le commentaire / la blessure / la ligne de programme… de n'importe qui.)
const ROW_OWNED: Record<string, { table: string; col: string; ids: (b: any) => any[] }> = {
  supprimerCommentaire:   { table: 'commentaires', col: 'comment_id', ids: b => [b.id] },
  marquerCommentairesLus: { table: 'commentaires', col: 'comment_id', ids: b => Array.isArray(b.ids) ? b.ids : [] },
  supprimerProgrammeLigne:{ table: 'programme',    col: 'id', ids: b => [b.row_index] },
  saveProgrammeLigne:     { table: 'programme',    col: 'id', ids: b => b.row_index ? [b.row_index] : [] },
  movePlanning:           { table: 'planning',     col: 'id', ids: b => [b.id] },
  unplanPlanning:         { table: 'planning',     col: 'id', ids: b => [b.id] },
  deleteObjectifJoueur:   { table: 'objectifs',    col: 'id', ids: b => [b.id] },
  saveObjectifJoueur:     { table: 'objectifs',    col: 'id', ids: b => b.id ? [b.id] : [] },
  deleteBlessure:         { table: 'blessures',    col: 'id', ids: b => [b.id] },
  saveBlessure:           { table: 'blessures',    col: 'id', ids: b => b.id ? [b.id] : [] },
  cloreContexte:          { table: 'contexte_athlete', col: 'id', ids: b => b.id ? [b.id] : [] },
}
async function _sessionPeutAthlete(sess: { role: string; id: string }, aid: string): Promise<boolean> {
  if (sess.role === 'a') return aid === sess.id
  const { data } = await sb().from('athletes').select('coach_id').eq('id', aid).single()
  return !!data && String(data.coach_id || '') === sess.id
}
async function _checkLignes(action: string, body: any, sess: { role: string; id: string }): Promise<string | null> {
  // Photo de suivi : le chemin du fichier commence par l'id de l'athlète propriétaire.
  if (action === 'supprimerSuiviPhoto') {
    const p = String((body && body.path) || ''), owner = p.split('/')[0]
    if (!owner || !(await _sessionPeutAthlete(sess, owner))) return 'photo ' + p + ' (non autorisée)'
    return null
  }
  const def = ROW_OWNED[action]
  if (!def || !body) return null
  const ids = def.ids(body).filter((x: any) => x != null && x !== '')
  if (!ids.length) return null
  const sel = def.table === 'commentaires' ? 'athlete_id,coach_id' : 'athlete_id'
  const { data } = await sb().from(def.table).select(sel).in(def.col, ids)
  for (const r of (data || []) as any[]) {
    // Commentaire : le coach destinataire y a droit aussi (même si l'athlète a changé de coach).
    if (def.table === 'commentaires' && sess.role === 'c' && String(r.coach_id || '') === sess.id) continue
    if (!(await _sessionPeutAthlete(sess, String(r.athlete_id || '')))) return def.table + ' de ' + r.athlete_id + ' (non autorisée)'
  }
  return null
}
async function authCheck(action: string, params: URLSearchParams, body: any): Promise<{ ok: boolean; reason?: string }> {
  // Champs de session réservés au serveur : jamais acceptés depuis l'app.
  if (body && typeof body === 'object') { delete body._sessRole; delete body._sessId }
  try { params.delete('_sess_role') } catch (_) {}
  if (AUTH_PUBLIC.has(action)) return { ok: true }
  const tok = params.get('_t') || (body && body._t) || ''
  const sess = tok ? await verifySession(String(tok)) : null
  if (!sess) return { ok: false, reason: tok ? 'jeton invalide ou expiré' : 'jeton absent' }
  // C8 : session émise avant le dernier changement de mot de passe → refusée.
  const depuis = await _sessDepuis(sess.role, sess.id)
  if (depuis && sess.iat < depuis) return { ok: false, reason: 'session révoquée (mot de passe changé)' }
  // Messagerie (audit 01/11, M2/M3/M4) : le rôle de la SESSION est transmis aux handlers
  // (jamais celui déclaré par l'app). Les clés _sess* venues du client sont écrasées ici.
  if (body && typeof body === 'object') { body._sessRole = sess.role; body._sessId = sess.id }
  params.set('_sess_role', sess.role)
  if (action === 'getCommentaires' && sess.role === 'c') params.set('coach_id', sess.id)
  // Sécurité (audit P2.1, 10/11) : un athlète sans athlete_id lisait TOUTE la table commentaires.
  // athlete_id absent ou vide → celui de la session ; un autre athlete_id reste refusé plus bas (401).
  if (action === 'getCommentaires' && sess.role === 'a' && !String(params.get('athlete_id') || '').trim()) params.set('athlete_id', sess.id)
  const aid = String(params.get('athlete_id') || (body && (body.athlete_id || (body.data && body.data.athlete_id))) || '')
  const cid = String(params.get('coach_id') || (body && body.coach_id) || '')
  // saveSeance : data = lignes [date, semaine, seance_id, nom, athlete_id, …] → athlete_id en [4].
  // Avant, aucune vérification (le tableau n'a pas de champ athlete_id). Coach : seulement ses athlètes.
  if (action === 'saveSeance' && body && Array.isArray(body.data)) {
    if (body.saisi_par_coach != null && body.saisi_par_coach !== '' && (sess.role !== 'c' || String(body.saisi_par_coach) !== sess.id)) return { ok: false, reason: 'saisi_par_coach ≠ session' }
    const ids = [...new Set(body.data.map((r: any) => String(Array.isArray(r) ? r[4] : '')))]
    for (const id of ids) if (!id || !(await _sessionPeutAthlete(sess, id))) return { ok: false, reason: (sess.role === 'c' ? 'coach ' : 'athlète ') + sess.id + ' → séance de ' + id }
  }
  // Supprimer un compte athlète : uniquement l'athlète lui-même (jamais son coach) — R2, 01/11.
  if (action === 'supprimerCompte' && sess.role !== 'a') return { ok: false, reason: 'coach ' + sess.id + ' → suppression du compte de ' + aid }
  if (sess.role === 'a') {
    if (aid && aid !== sess.id) return { ok: false, reason: 'athlète ' + sess.id + ' → données de ' + aid }
    if (cid) {
      // Un athlète ne cite un coach_id QUE pour écrire / envoyer un média à SON coach
      // (sinon il pourrait lister tous les athlètes de son coach via une route coach).
      if (!ATHLETE_COACH_ACTIONS.has(action)) return { ok: false, reason: 'athlète ' + sess.id + ' → route coach (' + action + ')' }
      const { data } = await sb().from('athletes').select('coach_id').eq('id', sess.id).single()
      if (!data || String(data.coach_id || '') !== cid) return { ok: false, reason: 'athlète ' + sess.id + ' → coach ' + cid }
    }
    const lr = await _checkLignes(action, body, sess)
    return lr ? { ok: false, reason: 'athlète ' + sess.id + ' → ' + lr } : { ok: true }
  }
  if (cid && cid !== sess.id) return { ok: false, reason: 'coach ' + sess.id + ' → coach ' + cid }
  // Jeton push du coach : rangé sous « coach:<id> » (COACH_PUSH_PREFIX), pas un athlète.
  // Seul le coach de la session peut l'écrire / le retirer (05/11 : avant, refus → déconnexion sur mobile).
  if (aid && aid.startsWith(COACH_PUSH_PREFIX)) {
    return aid === COACH_PUSH_PREFIX + sess.id ? { ok: true } : { ok: false, reason: 'coach ' + sess.id + ' → ' + aid }
  }
  if (aid) {
    const { data } = await sb().from('athletes').select('coach_id').eq('id', aid).single()
    if (!data || String(data.coach_id || '') !== sess.id) return { ok: false, reason: 'coach ' + sess.id + ' → athlète ' + aid + ' (non lié)' }
  }
  const lr = await _checkLignes(action, body, sess)
  return lr ? { ok: false, reason: 'coach ' + sess.id + ' → ' + lr } : { ok: true }
}
// Ajoute le jeton à une réponse de connexion / inscription réussie.
async function withSession(resp: Response, role: 'a' | 'c'): Promise<Response> {
  try {
    const d: any = await resp.clone().json()
    const id = d && d.success ? (role === 'a' ? (d.athlete && d.athlete.athlete_id) : (d.coach && d.coach.coach_id)) : null
    if (id == null) return resp
    const token = await signSession(role, String(id))
    if (!token) return resp
    return jsonResp({ ...d, token }, resp.status)
  } catch (_) { return resp }
}
async function _authGate(action: string, params: URLSearchParams, body: any): Promise<Response | null> {
  const r = await authCheck(String(action || ''), params, body)
  if (r.ok) return null
  const enforce = Deno.env.get('AUTH_ENFORCE') === '1' && !!Deno.env.get('PEPPER')
  console.warn('[auth' + (enforce ? '' : ':observation') + '] ' + action + ' — ' + r.reason)
  return enforce ? jsonResp({ erreur: 'Session expirée — reconnecte-toi.', auth: true }, 401) : null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRate(ip)) return jsonResp({ erreur: 'Trop de requêtes' }, 429)

  const url = new URL(req.url)
  const params = url.searchParams

  try {
    if (req.method === 'GET') {
      const action = params.get('action')
      const _deny = await _authGate(String(action || ''), params, null); if (_deny) return _deny
      switch (action) {
        case 'ping':                  return jsonResp({ ok: true })
        case 'login':                 return withSession(await handleLogin(params), 'a')
        case 'register':              return withSession(await handleRegister(params), 'a')
        case 'getAppData':            return handleGetAppData(params)
        case 'getLastPerf':           return handleGetLastPerf(params)
        case 'getPoids':              return handleGetPoids(params)
        case 'getActivites':          return handleGetActivites(params)
        case 'exercices':             return handleGetExercices()
        case 'loginCoach':            return withSession(await handleLoginCoach(params), 'c')
        case 'getCoachAthletes':      return handleGetCoachAthletes(params)
        case 'getCommentaires':       return handleGetCommentaires(params)
        case 'getCoachPrefs':         return handleGetCoachPrefs(params)
        case 'getCoachProgramme':     return handleGetCoachProgramme(params)
        case 'getSeancesDetail':      return handleGetSeancesDetail(params)
        case 'getAlertesTraitees':    return handleGetAlertesTraitees(params)
        case 'getBilanPDF':           return handleGetBilanPDF(params)
        case 'lierAthlete':           return handleLierAthlete(params)
        case 'getSuiviEquipe':        return handleGetSuiviEquipe(params)
        case 'getSuiviJoueur':        return handleGetSuiviJoueur(params)
        case 'getTests':              return handleGetTests(params)
        default:                      return jsonResp({ erreur: `Action inconnue: ${action}` }, 404)
      }
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const action = body.action
      const _deny = await _authGate(String(action || ''), params, body); if (_deny) return _deny
      switch (action) {
        case 'inscriptionBeta':          return handleInscriptionBeta(body, ip)
        case 'login':                    return withSession(await handleLogin(new URLSearchParams({ login: body.login, password: body.password })), 'a')
        case 'register':                 return withSession(await handleRegister(new URLSearchParams({ login: body.login, password: body.password, nom: body.nom || '', prenom: body.prenom || '', ddn: body.ddn || '', taille: body.taille || '', poids: body.poids || '', annees: body.annees == null ? '' : String(body.annees), sport: body.sport || 'muscu', email: body.email || '', code: body.code || '', sexe: body.sexe || '' })), 'a')
        case 'loginDispo':               return handleLoginDispo(body)
        case 'photoProfilUploadUrl':     return handlePhotoProfilUploadUrl(body)
        case 'photoProfil':              return handlePhotoProfil(body)
        case 'supprimerPhotoProfil':     return handleSupprimerPhotoProfil(body)
        case 'registerCoach':            return withSession(await handleRegisterCoach(body), 'c')
        case 'seedDemoFoot':             return handleSeedDemoFoot(body)
        case 'clearDemoFoot':            return handleClearDemoFoot(body)
        case 'supprimerCompte':          return handleSupprimerCompte(body)
        case 'coachCreerAthlete':        return handleCoachCreerAthlete(body)
        case 'detacherCoach':            return handleDetacherCoach(body)
        case 'repondreDemandeCoach':     return handleRepondreDemandeCoach(body)
        case 'coachResetAthlete':        return handleCoachResetAthlete(body)
        case 'saveEmail':                return handleSaveEmail(body)
        case 'changePassword':           return handleChangePassword(body)
        case 'saveProfil':               return handleSaveProfil(body)
        case 'saveCoachProfil':          return handleSaveCoachProfil(body)
        case 'changePasswordCoach':      return handleChangePasswordCoach(body)
        case 'saveClubCoach':            return handleSaveClubCoach(body)
        case 'exportAthlete':            return handleExportAthlete(body)
        case 'exportAthleteEmail':       return handleExportAthleteEmail(body)
        case 'exportEquipe':             return handleExportEquipe(body)
        case 'bilanClient':              return handleBilanClient(body)
        case 'envoyerBilanMail':         return handleEnvoyerBilanMail(body)
        case 'saveRecapFreq':            return handleSaveRecapFreq(body)
        case 'saveCoachPref':            return handleSaveCoachPref(body)
        case 'envoyerRetour':            return handleEnvoyerRetour(body)
        case 'requestPasswordReset':     return handleRequestPasswordReset(body)
        case 'resetPassword':            return handleResetPassword(body)
        case 'confirmerEmail':           return handleConfirmerEmail(body)
        case 'renvoyerConfirmationEmail': return handleRenvoyerConfirmationEmail(body)
        case 'saveSportCoach':           return handleSaveSportCoach(body)
        case 'saveTest':                 return handleSaveTest(body)
        case 'loginCoach':               return withSession(await handleLoginCoach(new URLSearchParams({ login: body.login, password: body.password })), 'c')
        case 'saveSeance':               return handleSaveSeance(body.data, body.saisi_par_coach, body.envoi_id)
        case 'deleteSeance':             return handleDeleteSeance(body)
        case 'updateSeance':             return handleUpdateSeance(body)
        case 'saveCommentaire':          return handleSaveCommentaire(body)
        case 'mediaUploadUrl':           return handleMediaUploadUrl(body)
        case 'envoyerMediaCoach':        return handleEnvoyerMediaCoach(body)
        case 'saveMensuration':          return handleSaveMensuration(body)
        case 'suiviPhotoUploadUrl':      return handleSuiviPhotoUploadUrl(body)
        case 'saveSuiviPhoto':           return handleSaveSuiviPhoto(body)
        case 'supprimerSuiviPhoto':      return handleSupprimerSuiviPhoto(body)
        case 'savePushSub':              return handleSavePushSub(body)
        case 'deletePushSub':            return handleDeletePushSub(body)
        case 'cronPushAlertes':          return handleCronPushAlertes(body)
        case 'envelopperHachages':       return handleEnvelopperHachages(body)   // jeton jetons_admin (10/11)
        case 'cronResumes':              return handleCronResumes(body)
        case 'cronResumesAuto':          return handleCronResumes({ ...body, auto: true })
        case 'saveNativePushToken':      return handleSaveNativePushToken(body)
        case 'deleteNativePushToken':    return handleDeleteNativePushToken(body)
        case 'testPush':                 return handleTestPush(body)
        case 'marquerCommentairesLus':   return handleMarquerCommentairesLus(body)
        case 'supprimerCommentaire':     return handleSupprimerCommentaire(body)
        case 'saveObjectif':             return handleSaveObjectif(body)
        case 'rebuildActivites':         return handleRebuildActivites(body)
        case 'savePoids':                return handleSavePoids(body)
        case 'saveNote':                 return handleSaveNote(body)
        case 'saveProgrammeLigne':       return _progMajTrace(action, body, () => handleSaveProgrammeLigne(body))
        case 'saveProgrammeJour':        return handleSaveProgrammeJour(body)
        case 'getPlanning':              return handleGetPlanning(body)
        case 'planSeance':               return handlePlanSeance(body)
        case 'setRattachement':          return handleSetRattachement(body)
        case 'creerExercice':            return handleCreerExercice(body)
        case 'exercicesPrives':          return handleExercicesPrives(body)
        case 'movePlanning':             return handleMovePlanning(body)
        case 'unplanPlanning':           return handleUnplanPlanning(body)
        case 'genererProgramme':         return _progMajTrace(action, body, () => handleGenererProgramme(body))
        case 'supprimerProgrammeLigne':  return _progMajTrace(action, body, () => handleSupprimerProgrammeLigne(body))
        case 'deleteCoach':              return handleDeleteCoach(body)
        case 'saveBienEtre':             return handleSaveBienEtre(body)
        case 'saveBilanSeance':          return handleSaveBilanSeance(body)
        case 'setPauseAthlete':          return handleSetPauseAthlete(body)
        case 'marquerAlerteTraitee':     return handleMarquerAlerteTraitee(body)
        case 'marquerAlerteLue':         return handleMarquerAlerteLue(body)
        case 'saveSemaineType':          return handleSaveSemaineType(body)
        case 'savePref':                 return handleSavePref(body)
        case 'saveExoCategories':        return handleSaveExoCategories(body)
        case 'saveZonesPrio':            return handleSaveZonesPrio(body)
        case 'saveMusclesExclus':        return handleSaveMusclesExclus(body)
        case 'claimRecompense':          return handleClaimRecompense(body)
        case 'saveSante':                return handleSaveSante(body)
        case 'saveNutrition':            return handleSaveNutrition(body)
        case 'chatIA':                   return handleChatIA(body)
        case 'analyseMorpho':            return handleAnalyseMorpho(body)
        case 'envoyerMorphoMail':        return handleEnvoyerMorphoMail(body)
        case 'saveObjectifJoueur':       return handleSaveObjectifJoueur(body)
        case 'deleteObjectifJoueur':     return handleDeleteObjectifJoueur(body)
        case 'saveBlessure':             return handleSaveBlessure(body)
        case 'deleteBlessure':           return handleDeleteBlessure(body)
        case 'saveMatch':                return handleSaveMatch(body)
        case 'saveBilanAthlete':         return handleSaveBilanAthlete(body)
        case 'saveContexte':             return handleSaveContexte(body)
        case 'cloreContexte':            return handleCloreContexte(body)
        case 'saveCardio':               return handleSaveCardio(body)
        case 'saveHyrox':                return handleSaveHyrox(body)
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
