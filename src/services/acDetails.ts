import { getAppBasePath, resolvePublicAssetPath } from './url'
import { normalizeStateId } from './appConfig'
import { parseAcCode } from './pollingStations'

export type AcCandidate = {
  sl_no: number
  name_en: string
  name_ta: string
  party_en: string
  party_ta: string
  alliance_ta: string
  symbol_en: string
  photo_name: string
  photo_file: string
}

export type AcDetail = {
  dcode: number
  pc_code: number
  ac_code: number
  name_ta: string
  name_en: string
  reserved: string
  polling_stations: number
  male_voters: number
  female_voters: number
  thirdgender_voters: number
  total_voters: number
  candidates: AcCandidate[]
}

export type DistrictDetail = {
  dcode: number
  name_en: string
  name_ta: string
}

type AcDetailsPayload = {
  districts?: DistrictDetail[]
  acs: AcDetail[]
}

export function buildAcDetailsPath(stateId: string): string | null {
  const state = normalizeStateId(stateId)
  if (!state) return null
  return `/data/states/${state}/ac_details.json`
}

export async function fetchAcDetails(stateId: string): Promise<AcDetail[]> {
  const payload = await fetchAcDetailsPayload(stateId)
  return payload.acs ?? []
}

export async function fetchAcDetailsPayload(stateId: string): Promise<AcDetailsPayload> {
  const path = buildAcDetailsPath(stateId)
  if (!path) {
    throw new Error('Invalid state for AC details')
  }

  const response = await fetch(resolvePublicAssetPath(path, getAppBasePath()))
  if (!response.ok) {
    throw new Error(`Failed to load AC details (${response.status})`)
  }

  return (await response.json()) as AcDetailsPayload
}

export function findAcDetail(rows: AcDetail[], acCode: string): AcDetail | null {
  const acNo = parseAcCode(acCode)
  if (!acNo) return null
  return rows.find((row) => row.ac_code === acNo) ?? null
}

export function computeSexRatio(maleVoters: number, femaleVoters: number): number {
  if (maleVoters <= 0) return 0
  return (femaleVoters / maleVoters) * 1000
}

export function buildTamilNaduConstituencyMapUrl(acNameEn: string): string {
  const normalized = acNameEn
    .trim()
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')

  return `https://commons.wikimedia.org/wiki/Special:FilePath/Constitution-${encodeURIComponent(normalized)}.svg`
}

export function buildTamilNaduAcRollMapUrl(acCode: number): string {
  return `https://erolls.tn.gov.in/acwithcandidate_tnla2026/AC%20MAP/${acCode}.jpg`
}

export function getElectionSymbolImageUrl(symbolName: string): string {
  const normalized = symbolName.trim().toLowerCase()
  const mapped: Record<string, string> = {
    'rising sun':
      'https://commons.wikimedia.org/wiki/Special:FilePath/Indian%20election%20symbol%20rising%20sun.svg',
    'two leaves':
      'https://commons.wikimedia.org/wiki/Special:FilePath/Indian%20Election%20Symbol%20Two%20Leaves.svg',
    whistle: 'https://commons.wikimedia.org/wiki/Special:FilePath/Indian%20Election%20Symbol%20Whistle.png',
    'farmer carrying plough':
      'https://i0.wp.com/www.naamtamilar.org/wp-content/uploads/2020/05/vivasayi-chinnam-naam-tamilar-katchi-election-symbol-ntk-2025-3-1.png?resize=696%2C928&ssl=1',
  }
  if (mapped[normalized]) return mapped[normalized]

  // Fallback to SEC Puducherry free-symbol icon set for symbols missing in our primary map.
  const secMap: Record<string, string> = {
    camera: 'https://sec.py.gov.in/sites/default/files/camera.png',
    'gas cylinder': 'https://sec.py.gov.in/sites/default/files/gascylinder.png',
    ring: 'https://sec.py.gov.in/sites/default/files/ring.png',
    balloon: 'https://sec.py.gov.in/sites/default/files/balloon.png',
    bucket: 'https://sec.py.gov.in/sites/default/files/bucket.png',
    'electric pole': 'https://sec.py.gov.in/sites/default/files/electricpole.png',
    'jack fruit': 'https://sec.py.gov.in/sites/default/files/jackfruit.png',
    'pressure cooker': 'https://sec.py.gov.in/sites/default/files/pressurecooker.png',
    'battery torch': 'https://sec.py.gov.in/sites/default/files/batterytorch.bmp',
  }
  if (secMap[normalized]) return secMap[normalized]

  const secSlug = normalized.replace(/[^a-z0-9]+/g, '')
  if (!secSlug) return ''
  return `https://sec.py.gov.in/sites/default/files/${secSlug}.png`
}

export function getCandidatePhotoUrl(stateId: string, candidate: AcCandidate): string {
  if (!candidate.photo_file) return ''
  const state = normalizeStateId(stateId)
  if (!state) return ''
  return `/data/states/${state}/candidate_photo/${encodeURIComponent(candidate.photo_file)}`
}
