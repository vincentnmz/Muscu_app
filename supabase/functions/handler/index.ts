import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  STAGNATION_SESSIONS: { debutant: 3, intermediaire: 5, avance: 8 } as Record<string, number>,
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
  if (!perfs.length) return { nb_seances: 0, tonnage_total: 0, mean_rpe: 0, records: {}, dernieres_seances: [] }

  const seanceIds = new Set<string>()
  const records: Record<string, { charge: number; volume: number; date: string }> = {}
  let totalTonnage = 0, totalRpe = 0, rpeCount = 0
  const seanceMap: Record<string, { date: string; tonnage: number; exercices: Set<string>; muscles: Set<string> }> = {}

  for (const r of perfs) {
    const charge = Number(r.charge) || 0
    const reps = Number(r.reps) || 0
    const tonnage = charge * reps
    totalTonnage += tonnage
    if (r.rpe) { totalRpe += Number(r.rpe); rpeCount++ }
    seanceIds.add(r.seance_id)

    const exo = r.exercice
    if (exo && (!records[exo] || charge > records[exo].charge)) {
      records[exo] = { charge, volume: Number(r.volume) || tonnage, date: fmtFR(r.date) }
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

  return {
    nb_seances: seanceIds.size,
    tonnage_total: Math.round(totalTonnage),
    mean_rpe: rpeCount ? Math.round(totalRpe / rpeCount * 10) / 10 : 0,
    records,
    dernieres_seances,
  }
}

function computeRecent(perfs: any[], now: Date): any {
  const result: Record<string, any> = {}
  for (const [key, days] of Object.entries(WINDOWS)) {
    const cutoff = fmtYMD(minus(now, days))
    const filtered = perfs.filter(r => String(r.date).slice(0, 10) >= cutoff)
    const seanceIds = new Set(filtered.map(r => r.seance_id))
    const tonnage = filtered.reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
    const rpeRows = filtered.filter(r => r.rpe)
    const parMuscle: Record<string, number> = {}
    for (const r of filtered) {
      if (r.muscle) parMuscle[r.muscle] = (parMuscle[r.muscle] || 0) + ((Number(r.charge) || 0) * (Number(r.reps) || 0))
    }
    result[key.toLowerCase()] = {
      nb_seances: seanceIds.size,
      tonnage: Math.round(tonnage),
      mean_rpe: rpeRows.length ? Math.round(rpeRows.reduce((s, r) => s + Number(r.rpe), 0) / rpeRows.length * 10) / 10 : 0,
      volume_par_muscle: parMuscle,
    }
  }
  return result
}

function computeComparison(perfs: any[], now: Date): any {
  const c28 = fmtYMD(minus(now, 28))
  const c56 = fmtYMD(minus(now, 56))
  const recent = perfs.filter(r => String(r.date).slice(0, 10) >= c28)
  const previous = perfs.filter(r => { const d = String(r.date).slice(0, 10); return d >= c56 && d < c28 })
  const calc = (rows: any[]) => {
    const tonnage = rows.reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
    const rpeRows = rows.filter(r => r.rpe)
    return { nb_seances: new Set(rows.map(r => r.seance_id)).size, tonnage: Math.round(tonnage), mean_rpe: rpeRows.length ? Math.round(rpeRows.reduce((s, r) => s + Number(r.rpe), 0) / rpeRows.length * 10) / 10 : 0 }
  }
  const p1 = calc(recent), p2 = calc(previous)
  return {
    periode_recente: p1, periode_precedente: p2,
    evolution: {
      tonnage: p2.tonnage ? Math.round((p1.tonnage - p2.tonnage) / p2.tonnage * 100) : null,
      nb_seances: p1.nb_seances - p2.nb_seances,
      mean_rpe: Math.round((p1.mean_rpe - p2.mean_rpe) * 10) / 10,
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

function computeACWR(perfs: any[], now: Date): number {
  const c7 = fmtYMD(minus(now, 7)), c28 = fmtYMD(minus(now, 28))
  const t7 = perfs.filter(r => String(r.date).slice(0, 10) >= c7).reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
  const t28 = perfs.filter(r => String(r.date).slice(0, 10) >= c28).reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)
  if (!t28) return 0
  return Math.round(t7 / (t28 / 4) * 100) / 100
}

// ── Alertes ───────────────────────────────────────────────────────────────────
function calculerAlertes(perfs: any[], _athleteId: string, anneesPratique: number, enPause: boolean): any[] {
  if (enPause || !perfs.length) return []
  const alertes: any[] = []
  const now = new Date()
  const c7 = fmtYMD(minus(now, 7))
  const c28 = fmtYMD(minus(now, 28))

  if (!perfs.some(r => String(r.date).slice(0, 10) >= c7)) {
    alertes.push({ cle: 'irregularite', message: 'Aucune séance ces 7 derniers jours', niveau: 'warning' })
  }

  const perfs28 = perfs.filter(r => String(r.date).slice(0, 10) >= c28)
  const sids28 = [...new Set(perfs28.map(r => r.seance_id))].sort()
  if (sids28.length >= SEUILS.RPE_FATIGUE_SEANCES) {
    const dernIds = sids28.slice(-SEUILS.RPE_FATIGUE_SEANCES)
    const dernPerfs = perfs28.filter(r => dernIds.includes(r.seance_id))
    const rpeRows = dernPerfs.filter(r => r.rpe)
    const meanRpe = rpeRows.length ? rpeRows.reduce((s, r) => s + Number(r.rpe), 0) / rpeRows.length : 0
    if (meanRpe >= SEUILS.RPE_FATIGUE) {
      alertes.push({ cle: 'fatigue_rpe', message: `RPE moyen élevé (${Math.round(meanRpe * 10) / 10}/10) sur les dernières séances`, niveau: 'warning' })
    }
  }

  const niveau = anneesPratique < 1 ? 'debutant' : anneesPratique < 3 ? 'intermediaire' : 'avance'
  const stagnN = SEUILS.STAGNATION_SESSIONS[niveau]
  const parExo: Record<string, any[]> = {}
  for (const r of perfs) { if (!parExo[r.exercice]) parExo[r.exercice] = []; parExo[r.exercice].push(r) }
  for (const [exo, rows] of Object.entries(parExo)) {
    const sorted = rows.sort((a, b) => String(a.date).localeCompare(String(b.date)))
    if (sorted.length < stagnN) continue
    const last = sorted.slice(-stagnN)
    const c0 = Number(last[0].charge) || 0
    const cN = Number(last[last.length - 1].charge) || 0
    if (c0 > 0 && Math.abs(cN - c0) / c0 < SEUILS.CHARGE_PROGRESSION) {
      alertes.push({ cle: 'stagnation', message: `Stagnation sur ${exo} (${stagnN} séances)`, niveau: 'info', exercice: exo })
    }
  }

  return alertes
}

// ── Cardio helper ─────────────────────────────────────────────────────────────
async function buildCardioAll(athleteId: string): Promise<any> {
  const { data: rows } = await sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'cardio_%').order('date', { ascending: false })
  if (!rows?.length) return { windows: { 7: [], 30: [], 90: [], 180: [] }, history: [] }

  const now = new Date()
  const seanceMap: Record<string, any> = {}
  for (const r of rows) {
    if (!seanceMap[r.seance_id]) seanceMap[r.seance_id] = { seance_id: r.seance_id, date: r.date, indicateurs: {} }
    seanceMap[r.seance_id].indicateurs[r.cle] = r.valeur
  }
  const sessions = Object.values(seanceMap).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
  const history = sessions.map((s: any) => ({ seance_id: s.seance_id, date: fmtFR(s.date), ...s.indicateurs }))
  const bw = (days: number) => {
    const cutoff = fmtYMD(minus(now, days))
    return sessions.filter((s: any) => String(s.date).slice(0, 10) >= cutoff).map((s: any) => ({ seance_id: s.seance_id, date: fmtFR(s.date), ...s.indicateurs }))
  }
  return { windows: { 7: bw(7), 30: bw(30), 90: bw(90), 180: bw(180) }, history }
}

// ── Progression par exo ───────────────────────────────────────────────────────
function buildProgressionParExo(perfs: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {}
  for (const r of perfs) {
    if (!map[r.exercice]) map[r.exercice] = []
    map[r.exercice].push({ date: fmtFR(r.date), charge: Number(r.charge) || 0, reps: Number(r.reps) || 0, volume: Number(r.volume) || (Number(r.charge) || 0) * (Number(r.reps) || 0) })
  }
  for (const exo of Object.keys(map)) {
    map[exo].sort((a, b) => { const da = parseFR(a.date), db = parseFR(b.date); return (da?.getTime() || 0) - (db?.getTime() || 0) })
  }
  return map
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

function buildVolumeParJour(perfs: any[], now: Date): Record<string, number> {
  const cutoff = fmtYMD(minus(now, 28))
  const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const r: Record<string, number> = {}
  for (const p of perfs) {
    if (String(p.date).slice(0, 10) < cutoff) continue
    const d = parseFR(p.date) || new Date(String(p.date) + 'T00:00:00Z')
    const label = jours[d.getUTCDay()]
    r[label] = (r[label] || 0) + (Number(p.charge) || 0) * (Number(p.reps) || 0)
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
  if (!ok) return jsonResp({ erreur: 'Identifiants incorrects' })
  if (upgrade) await sb().from('athletes').update({ password_hash: upgrade }).eq('id', ath.id)

  return jsonResp({ ok: true, id: ath.id, nom: ath.nom, sport: ath.sport || 'muscu', coach_id: ath.coach_id, strategie: ath.strategie })
}

async function handleRegister(params: URLSearchParams): Promise<Response> {
  const login = params.get('login')?.trim()
  const pwd = params.get('password')?.trim()
  const nom = params.get('nom')?.trim() || login
  if (!login || !pwd) return jsonResp({ erreur: 'Paramètres manquants' })

  const { data: existing } = await sb().from('athletes').select('id').eq('login', login).single()
  if (existing) return jsonResp({ erreur: 'Login déjà utilisé' })

  const hash = await hashSalted(pwd, login)
  const { data, error } = await sb().from('athletes').insert({ login, nom, password_hash: hash, sport: 'muscu' }).select().single()
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true, id: data.id, nom: data.nom, sport: 'muscu' })
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
  ] = await Promise.all([
    sb().from('performances').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
    sb().from('athletes').select('*').eq('id', athleteId).single(),
    sb().from('programme').select('*').eq('athlete_id', athleteId).order('groupe_id').order('id'),
    sb().from('poids_historique').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(30),
    sb().from('bien_etre').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }).limit(30),
    sb().from('volume_obti').select('*'),
    sb().from('indicateurs').select('*').eq('athlete_id', athleteId).eq('source', 'contexte').order('date', { ascending: false }).limit(5),
    sb().from('indicateurs').select('*').eq('athlete_id', athleteId).eq('cle', 'pause').order('date', { ascending: false }).limit(1),
    sb().from('indicateurs').select('*').eq('athlete_id', athleteId).like('seance_id', 'cardio_%').order('date', { ascending: false }),
  ])

  const perfs = perfsAll || []
  const sport = athData?.sport || 'muscu'
  const enPause = pauseRows?.length ? pauseRows[0].valeur !== 'fin' : false

  const globalData = computeGlobal(perfs)
  const recentData = computeRecent(perfs, now)
  const comparisonData = computeComparison(perfs, now)

  const dates = [...new Set(perfs.map(r => String(r.date).slice(0, 10)))].sort()
  const dernierDate = dates[dates.length - 1]
  const regularite = computeStreak(dates, now)
  const acwr = sport === 'muscu' ? computeACWR(perfs, now) : null

  const c7 = fmtYMD(minus(now, 7))
  const tonnage7 = perfs.filter(r => String(r.date).slice(0, 10) >= c7).reduce((s, r) => s + (Number(r.charge) || 0) * (Number(r.reps) || 0), 0)

  let muscleRetard: string | null = null
  if (volObtiRows?.length) {
    const lundiStr = fmtYMD(lundi)
    const perfsWeek = perfs.filter(r => String(r.date).slice(0, 10) >= lundiStr)
    const seriesParMuscle: Record<string, number> = {}
    for (const r of perfsWeek) if (r.muscle) seriesParMuscle[r.muscle] = (seriesParMuscle[r.muscle] || 0) + 1
    for (const v of volObtiRows) {
      if ((seriesParMuscle[v.muscle] || 0) < (v.series_min_semaine || 0)) { muscleRetard = v.muscle; break }
    }
  }

  const alertes = calculerAlertes(perfs, athleteId, Number(athData?.annees) || 0, enPause)

  const datesSeances: Record<string, string> = {}
  for (const d of dates) {
    const row = perfs.find(r => String(r.date).slice(0, 10) === d)
    if (row) datesSeances[d] = row.seance_id
  }

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

  const contexte = contexteRows?.[0] ? {
    id: contexteRows[0].id, date: fmtFR(contexteRows[0].date),
    description: contexteRows[0].valeur, cle: contexteRows[0].cle,
  } : null

  let cardio = null
  if (sport === 'muscu' && cardioRows?.length) {
    const seanceMap: Record<string, any> = {}
    for (const r of cardioRows) {
      if (!seanceMap[r.seance_id]) seanceMap[r.seance_id] = { seance_id: r.seance_id, date: r.date, indicateurs: {} }
      seanceMap[r.seance_id].indicateurs[r.cle] = r.valeur
    }
    const sessions = Object.values(seanceMap).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
    const history = sessions.map((s: any) => ({ seance_id: s.seance_id, date: fmtFR(s.date), ...s.indicateurs }))
    const bw = (days: number) => {
      const cutoff = fmtYMD(minus(now, days))
      return sessions.filter((s: any) => String(s.date).slice(0, 10) >= cutoff).map((s: any) => ({ seance_id: s.seance_id, date: fmtFR(s.date), ...s.indicateurs }))
    }
    cardio = { windows: { 7: bw(7), 30: bw(30), 90: bw(90), 180: bw(180) }, history }
  }

  let volume_obti = null
  if (sport === 'muscu' && volObtiRows?.length) {
    const lundiStr = fmtYMD(lundi)
    const perfsWeek = perfs.filter(r => String(r.date).slice(0, 10) >= lundiStr)
    const seriesParMuscle: Record<string, number> = {}
    for (const r of perfsWeek) if (r.muscle) seriesParMuscle[r.muscle] = (seriesParMuscle[r.muscle] || 0) + 1
    volume_obti = volObtiRows.map(v => ({
      muscle: v.muscle, series_semaine: seriesParMuscle[v.muscle] || 0,
      series_min: v.series_min_semaine, series_opt: v.series_opt_semaine,
    }))
  }

  return jsonResp({
    global: globalData,
    recent: recentData,
    comparison: comparisonData,
    dashboard: {
      derniere_seance: dernierDate ? fmtFR(dernierDate) : null,
      prochaine_seance: null,
      regularite,
      tonnage: Math.round(tonnage7),
      muscle_retard: muscleRetard,
      acwr,
      progression: null,
      records_mois: null,
      alertes,
    },
    historique: {
      dates_seances: datesSeances,
      exercices: [...new Set(perfs.map(r => r.exercice).filter(Boolean))],
      progression_par_exo: buildProgressionParExo(perfs),
      volume_semaine: buildVolumeSemaineHisto(perfs),
      volume_par_jour: buildVolumeParJour(perfs, now),
    },
    poids,
    programme,
    bien_etre,
    pause: enPause,
    contexte,
    sport,
    cardio,
    volume_obti,
  })
}

async function handleGetLastPerf(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  const exercice = params.get('exercice')
  if (!athleteId || !exercice) return jsonResp({ erreur: 'Paramètres manquants' })

  const { data } = await sb().from('performances').select('*').eq('athlete_id', athleteId).eq('exercice', exercice).order('date', { ascending: false }).limit(20)
  return jsonResp({ ok: true, data: (data || []).map(r => ({ date: fmtFR(r.date), charge: r.charge, reps: r.reps, serie: r.serie, rpe: r.rpe, volume: r.volume })) })
}

async function handleGetExercices(): Promise<Response> {
  const { data } = await sb().from('performances').select('exercice, muscle')
  if (!data) return jsonResp({ ok: true, data: [] })
  const uniq = new Map<string, string>()
  for (const r of data) if (r.exercice && !uniq.has(r.exercice)) uniq.set(r.exercice, r.muscle || '')
  return jsonResp({ ok: true, data: [...uniq.entries()].map(([exercice, muscle]) => ({ exercice, muscle })) })
}

async function handleLoginCoach(params: URLSearchParams): Promise<Response> {
  const login = params.get('login')?.trim()
  const pwd = params.get('password')?.trim()
  if (!login || !pwd) return jsonResp({ erreur: 'Paramètres manquants' })

  const { data: coach } = await sb().from('coachs').select('*').eq('login', login).single()
  if (!coach) return jsonResp({ erreur: 'Identifiants incorrects' })

  const { ok, upgrade } = await verifyPwd(pwd, coach.password_hash || '', coach.login)
  if (!ok) return jsonResp({ erreur: 'Identifiants incorrects' })
  if (upgrade) await sb().from('coachs').update({ password_hash: upgrade }).eq('coach_id', coach.coach_id)

  return jsonResp({ ok: true, coach_id: coach.coach_id, nom: coach.nom, sport: coach.sport || 'muscu' })
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
    const dates = [...new Set(perfs.map(r => String(r.date).slice(0, 10)))].sort()
    const alertes = calculerAlertes(perfs, ath.id, Number(ath.annees) || 0, enPause)
    const lastBE = (beAll || []).find(r => r.athlete_id === ath.id)
    return {
      id: ath.id, nom: ath.nom, sport: ath.sport || 'muscu', en_pause: enPause,
      derniere_seance: dates.length ? fmtFR(dates[dates.length - 1]) : null,
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
    sb().from('indicateurs').select('*').eq('athlete_id', athleteId).eq('source', 'contexte').order('date', { ascending: false }).limit(5),
    sb().from('objectifs').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
    sb().from('blessures').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
  ])

  const perfsArr = perfs || []
  const globalData = computeGlobal(perfsArr)
  const recentData = computeRecent(perfsArr, now)
  const alertes = calculerAlertes(perfsArr, athleteId, Number(ath.annees) || 0, false)

  return jsonResp({
    ok: true,
    athlete: { id: ath.id, nom: ath.nom, ddn: fmtFR(ath.ddn), taille: ath.taille, annees: ath.annees, strategie: ath.strategie, sport: ath.sport || 'muscu', poste: ath.poste, sexe: ath.sexe, club: ath.club, categorie: ath.categorie, antecedents: ath.antecedents, login: ath.login },
    global: globalData,
    recent: recentData,
    alertes,
    poids: (poidsRows || []).map(r => ({ date: fmtFR(r.date), poids: Number(r.poids) })),
    bien_etre: (beRows || []).map(r => ({ date: fmtFR(r.date), sommeil: r.sommeil, energie: r.energie, fatigue: r.fatigue_musculaire, douleur: r.douleur, zone: r.zone_douloureuse, ressenti: r.ressenti_global, note: r.note })),
    programme: (progRows || []).map(r => ({ id: r.id, row_index: r.id, seance_id: r.seance_id, exercice: r.exercice, series_prevues: r.series_prevues, reps_mini: r.reps_mini, reps_max: r.reps_max, repos_sec: r.repos_sec, groupe_id: r.groupe_id })),
    contexte: (contexteRows || []).map(r => ({ id: r.id, date: fmtFR(r.date), description: r.valeur, cle: r.cle, unite: r.unite })),
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
  let query = sb().from('commentaires').select('*').order('created_at', { ascending: false }).limit(100)
  if (coachId) query = query.eq('coach_id', coachId)
  if (athleteId) query = query.eq('athlete_id', athleteId)
  const { data } = await query
  return jsonResp({ ok: true, commentaires: (data || []).map(r => ({ id: r.id, athlete_id: r.athlete_id, coach_id: r.coach_id, texte: r.texte, date: fmtFR(r.created_at || r.date), lu: r.lu, auteur: r.auteur })) })
}

async function handleGetCoachProgramme(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
  const { data } = await sb().from('programme').select('*').eq('athlete_id', athleteId).order('groupe_id').order('id')
  return jsonResp({ ok: true, programme: (data || []).map(r => ({ id: r.id, row_index: r.id, athlete_id: r.athlete_id, seance_id: r.seance_id, exercice: r.exercice, series_prevues: r.series_prevues, reps_mini: r.reps_mini, reps_max: r.reps_max, repos_sec: r.repos_sec, groupe_id: r.groupe_id })) })
}

async function handleGetSeancesDetail(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  const semaine = params.get('semaine')
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
  let query = sb().from('performances').select('*').eq('athlete_id', athleteId)
  if (semaine) query = query.eq('semaine', semaine)
  const { data } = await query.order('date').order('seance_id').order('serie')
  const seances: Record<string, any> = {}
  for (const r of data || []) {
    if (!seances[r.seance_id]) seances[r.seance_id] = { seance_id: r.seance_id, date: fmtFR(r.date), semaine: r.semaine, nom: r.nom, lignes: [] }
    seances[r.seance_id].lignes.push({ exercice: r.exercice, muscle: r.muscle, serie: r.serie, charge: r.charge, reps: r.reps, rpe: r.rpe, repos: r.repos, volume: r.volume })
  }
  return jsonResp({ ok: true, seances: Object.values(seances) })
}

async function handleGetAlertesTraitees(params: URLSearchParams): Promise<Response> {
  const coachId = params.get('coach_id')
  if (!coachId) return jsonResp({ erreur: 'coach_id manquant' })
  const { data } = await sb().from('alertes_traitees').select('*').eq('coach_id', coachId)
  return jsonResp({ ok: true, alertes: data || [] })
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
  const cle = params.get('cle')
  if (!coachId) return jsonResp({ erreur: 'coach_id manquant' })
  if (athleteId) {
    const { error } = await sb().from('athletes').update({ coach_id: coachId }).eq('id', athleteId)
    if (error) return jsonResp({ erreur: error.message })
    return jsonResp({ ok: true })
  }
  if (cle) {
    const { data: ath } = await sb().from('athletes').select('*').eq('login', cle).single()
    if (!ath) return jsonResp({ erreur: 'Athlète non trouvé' })
    await sb().from('athletes').update({ coach_id: coachId }).eq('id', ath.id)
    return jsonResp({ ok: true, athlete_id: ath.id, nom: ath.nom })
  }
  return jsonResp({ erreur: 'Paramètres manquants' })
}

async function handleGetSuiviEquipe(params: URLSearchParams): Promise<Response> {
  return handleGetCoachAthletes(params)
}

async function handleGetSuiviJoueur(params: URLSearchParams): Promise<Response> {
  return handleGetCoachAthleteDetail(params)
}

async function handleGetContexte(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
  const { data } = await sb().from('indicateurs').select('*').eq('athlete_id', athleteId).eq('source', 'contexte').order('date', { ascending: false })
  return jsonResp({ ok: true, contextes: (data || []).map(r => ({ id: r.id, date: fmtFR(r.date), description: r.valeur, cle: r.cle, unite: r.unite })) })
}

async function handleGetTests(params: URLSearchParams): Promise<Response> {
  const athleteId = params.get('athlete_id')
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
  const { data } = await sb().from('tests').select('*').eq('athlete_id', athleteId).order('date', { ascending: false })
  return jsonResp({ ok: true, tests: (data || []).map(r => ({ date: fmtFR(r.date), cle: r.cle, valeur: r.valeur, unite: r.unite })) })
}

// ── POST handlers ─────────────────────────────────────────────────────────────
async function handleRegisterCoach(body: any): Promise<Response> {
  const login = body.login?.trim(), pwd = body.password?.trim(), nom = body.nom?.trim() || body.login, sport = body.sport || 'muscu'
  if (!login || !pwd) return jsonResp({ erreur: 'Paramètres manquants' })
  const { data: existing } = await sb().from('coachs').select('coach_id').eq('login', login).single()
  if (existing) return jsonResp({ erreur: 'Login déjà utilisé' })
  const hash = await hashSalted(pwd, login)
  const { data: maxRow } = await sb().from('coachs').select('coach_id').order('coach_id', { ascending: false }).limit(1)
  const newId = maxRow?.length ? String(Number(maxRow[0].coach_id) + 1) : '1'
  const { data, error } = await sb().from('coachs').insert({ coach_id: newId, login, nom, password_hash: hash, sport }).select().single()
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true, coach_id: data.coach_id, nom: data.nom, sport })
}

async function handleSupprimerCompte(body: any): Promise<Response> {
  const athleteId = body.athlete_id
  if (!athleteId) return jsonResp({ erreur: 'athlete_id manquant' })
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
  return jsonResp({ ok: true })
}

async function handleCoachCreerAthlete(body: any): Promise<Response> {
  const { coach_id, nom, login, password, annees, strategie, ddn, taille, sexe } = body
  if (!coach_id || !nom || !login || !password) return jsonResp({ erreur: 'Paramètres manquants' })
  const { data: existing } = await sb().from('athletes').select('id').eq('login', login).single()
  if (existing) return jsonResp({ erreur: 'Login déjà utilisé' })
  const hash = await hashSalted(password, login)
  const { data: coach } = await sb().from('coachs').select('sport').eq('coach_id', coach_id).single()
  const { data, error } = await sb().from('athletes').insert({ login, nom, password_hash: hash, coach_id, sport: coach?.sport || 'muscu', annees: annees || 0, strategie: strategie || '', ddn: ddn || null, taille: taille || null, sexe: sexe || null }).select().single()
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true, id: data.id, nom: data.nom })
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
  if (!athlete_id || !cle || valeur === undefined) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('tests').insert({ date: date || fmtYMD(new Date()), athlete_id, cle, valeur, unite: unite || '' })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveSeance(data: any[]): Promise<Response> {
  if (!data?.length) return jsonResp({ erreur: 'Données manquantes' })

  // data = array of arrays: [date, semaine, seance_id, nom, athlete_id, exercice, muscle, exercice_id, serie, charge, reps, rpe, repos, volume]
  const rows = data.map((r: any[]) => ({
    date: r[0], semaine: r[1], seance_id: r[2], nom: r[3], athlete_id: r[4],
    exercice: r[5], muscle: r[6], exercice_id: r[7], serie: r[8],
    charge: r[9], reps: r[10], rpe: r[11], repos: r[12], volume: r[13],
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

async function handleSaveCommentaire(body: any): Promise<Response> {
  const { athlete_id, coach_id, texte, auteur } = body
  if (!athlete_id || !texte) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('commentaires').insert({ athlete_id, coach_id: coach_id || null, texte, auteur: auteur || 'coach', lu: false })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleMarquerCommentairesLus(body: any): Promise<Response> {
  const { athlete_id, coach_id } = body
  let query = sb().from('commentaires').update({ lu: true }).eq('lu', false)
  if (athlete_id) query = query.eq('athlete_id', athlete_id)
  if (coach_id) query = query.eq('coach_id', coach_id)
  const { error } = await query
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSupprimerCommentaire(body: any): Promise<Response> {
  const { id } = body
  if (!id) return jsonResp({ erreur: 'id manquant' })
  const { error } = await sb().from('commentaires').delete().eq('id', id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveObjectif(body: any): Promise<Response> {
  const { athlete_id, strategie } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  const { error } = await sb().from('athletes').update({ strategie }).eq('id', athlete_id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSavePoids(body: any): Promise<Response> {
  const { athlete_id, athlete_nom, poids, date } = body
  if (!athlete_id || poids === undefined) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('poids_historique').insert({ date: date || fmtYMD(new Date()), athlete_id, athlete_nom: athlete_nom || '', poids: Number(poids) })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveNote(body: any): Promise<Response> {
  const { athlete_id, note } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  const { error } = await sb().from('athletes').update({ heatmap: note }).eq('id', athlete_id)
  if (error) return jsonResp({ erreur: error.message })
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
  if (!coach_id) return jsonResp({ erreur: 'coach_id manquant' })
  await sb().from('athletes').update({ coach_id: null }).eq('coach_id', coach_id)
  const { error } = await sb().from('coachs').delete().eq('coach_id', coach_id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveBienEtre(body: any): Promise<Response> {
  const { athlete_id, seance_id, date, sommeil, energie, fatigue, douleur, zone, ressenti, note } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  const { error } = await sb().from('bien_etre').insert({
    date: date || fmtYMD(new Date()), seance_id: seance_id || null, athlete_id,
    sommeil, energie, fatigue_musculaire: fatigue, douleur,
    zone_douloureuse: zone, ressenti_global: ressenti, note,
  })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSetPauseAthlete(body: any): Promise<Response> {
  const { athlete_id, pause } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  const { error } = await sb().from('indicateurs').insert({ date: fmtYMD(new Date()), athlete_id, seance_id: `pause_${Date.now()}`, cle: 'pause', valeur: pause ? 'debut' : 'fin', unite: '', source: 'system' })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleMarquerAlerteTraitee(body: any): Promise<Response> {
  const { coach_id, cle, semaine } = body
  if (!coach_id || !cle) return jsonResp({ erreur: 'Paramètres manquants' })
  const sem = semaine || isoWeek(new Date())
  const { data: existing } = await sb().from('alertes_traitees').select('id').eq('coach_id', coach_id).eq('cle', cle).eq('semaine', sem).single()
  if (!existing) {
    const { error } = await sb().from('alertes_traitees').insert({ coach_id, cle, semaine: sem })
    if (error) return jsonResp({ erreur: error.message })
  }
  return jsonResp({ ok: true })
}

async function handleSaveObjectifJoueur(body: any): Promise<Response> {
  const { athlete_id, categorie, description, statut, date, id } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  if (id) {
    const { error } = await sb().from('objectifs').update({ categorie, description, statut }).eq('id', id)
    if (error) return jsonResp({ erreur: error.message })
  } else {
    const { error } = await sb().from('objectifs').insert({ athlete_id, categorie, description, statut: statut || 'en_cours', date: date || fmtYMD(new Date()) })
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
    const { error } = await sb().from('blessures').insert({ athlete_id, date: date || fmtYMD(new Date()), type, localisation, gravite, duree, retour_terrain, retour_competition, statut: statut || 'en_cours' })
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
  const { athlete_id, date, adversaire, score, temps_jeu, poste, note } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  const sid = `match_${Date.now()}`
  const d = date || fmtYMD(new Date())
  const rows: any[] = []
  const push = (cle: string, valeur: unknown, unite = '') => rows.push({ date: d, athlete_id, seance_id: sid, cle, valeur: String(valeur), unite, source: 'match' })
  if (adversaire) push('adversaire', adversaire)
  if (score) push('score', score)
  if (temps_jeu) push('temps_jeu', temps_jeu, 'min')
  if (poste) push('poste', poste)
  if (note !== undefined) push('note', note)
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ erreur: error.message })
  }
  return jsonResp({ ok: true, seance_id: sid })
}

async function handleSaveBilanAthlete(body: any): Promise<Response> {
  const { athlete_id, ...fields } = body
  if (!athlete_id) return jsonResp({ erreur: 'athlete_id manquant' })
  const allowed = ['ddn', 'taille', 'annees', 'strategie', 'sport', 'poste', 'sexe', 'club', 'categorie', 'antecedents', 'jambe_dominante', 'discipline']
  const update: Record<string, any> = {}
  for (const k of allowed) if (fields[k] !== undefined) update[k] = fields[k]
  if (!Object.keys(update).length) return jsonResp({ ok: true })
  const { error } = await sb().from('athletes').update(update).eq('id', athlete_id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveContexte(body: any): Promise<Response> {
  const { athlete_id, description, cle, date } = body
  if (!athlete_id || !description) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('indicateurs').insert({ date: date || fmtYMD(new Date()), athlete_id, seance_id: `contexte_${Date.now()}`, cle: cle || 'contexte', valeur: description, unite: null, source: 'contexte' })
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleCloreContexte(body: any): Promise<Response> {
  const { id, athlete_id } = body
  if (!id && !athlete_id) return jsonResp({ erreur: 'Paramètres manquants' })
  let query = sb().from('indicateurs').update({ unite: fmtYMD(new Date()) }).eq('source', 'contexte')
  if (id) query = query.eq('id', id)
  else query = query.eq('athlete_id', athlete_id).is('unite', null)
  const { error } = await query
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleSaveCardio(body: any): Promise<Response> {
  const { athlete_id, date, indicateurs } = body
  if (!athlete_id || !indicateurs) return jsonResp({ erreur: 'Paramètres manquants' })
  const sid = `cardio_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const d = date || fmtYMD(new Date())
  const rows = Object.entries(indicateurs).map(([cle, valeur]) => ({ date: d, athlete_id, seance_id: sid, cle, valeur: String(valeur), unite: '', source: 'cardio' }))
  if (rows.length) {
    const { error } = await sb().from('indicateurs').insert(rows)
    if (error) return jsonResp({ erreur: error.message })
  }
  return jsonResp({ ok: true, seance_id: sid })
}

async function handleDeleteCardio(body: any): Promise<Response> {
  const { athlete_id, seance_id } = body
  if (!athlete_id || !seance_id) return jsonResp({ erreur: 'Paramètres manquants' })
  const { error } = await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('seance_id', seance_id)
  if (error) return jsonResp({ erreur: error.message })
  return jsonResp({ ok: true })
}

async function handleUpdateCardio(body: any): Promise<Response> {
  const { athlete_id, seance_id, date, indicateurs } = body
  if (!athlete_id || !seance_id) return jsonResp({ erreur: 'Paramètres manquants' })
  await sb().from('indicateurs').delete().eq('athlete_id', athlete_id).eq('seance_id', seance_id)
  if (indicateurs) {
    const d = date || fmtYMD(new Date())
    const rows = Object.entries(indicateurs).map(([cle, valeur]) => ({ date: d, athlete_id, seance_id, cle, valeur: String(valeur), unite: '', source: 'cardio' }))
    if (rows.length) {
      const { error } = await sb().from('indicateurs').insert(rows)
      if (error) return jsonResp({ erreur: error.message })
    }
  }
  return jsonResp({ ok: true })
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
        case 'register':                 return handleRegister(new URLSearchParams({ login: body.login, password: body.password, nom: body.nom || '' }))
        case 'registerCoach':            return handleRegisterCoach(body)
        case 'supprimerCompte':          return handleSupprimerCompte(body)
        case 'coachCreerAthlete':        return handleCoachCreerAthlete(body)
        case 'saveSportCoach':           return handleSaveSportCoach(body)
        case 'saveTest':                 return handleSaveTest(body)
        case 'loginCoach':               return handleLoginCoach(new URLSearchParams({ login: body.login, password: body.password }))
        case 'saveSeance':               return handleSaveSeance(body.data)
        case 'saveCommentaire':          return handleSaveCommentaire(body)
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
    console.error('Handler error:', e)
    return jsonResp({ erreur: 'Erreur serveur interne' }, 500)
  }
})
