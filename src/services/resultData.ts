import { getAppBasePath, resolvePublicAssetPath } from './url'
import { normalizeStateId } from './appConfig'

export type ResultSecuredVote = {
  polling_station_no: number
  votes: number
}

export type ResultCandidate = {
  candidate_id: number
  name: string
  party: string
  symbol: string
  total_secured_votes: number
  postal_votes: number | null
  evm_votes: number | null
  rejected_votes: number | null
  nota_votes: number | null
  winner: boolean
  margin: number | null
  secured_votes: ResultSecuredVote[]
}

export type ResultPollingStation = {
  no: number
  name: string
  male: number | null
  female: number | null
  third_gender: number
  total_votes: number
}

export type AcResultData = {
  state: string
  election_year: number
  district: { district_id: number; district_name: string }
  assembly_constituency: {
    ac_code: number
    ac_name: string
    stats: {
      male: number
      female: number
      third_gender: number
      total_votes: number
      total_polling_stations: number
    }
    polling_stations: ResultPollingStation[]
    candidates: ResultCandidate[]
  }
}

export type PsCandidateResult = {
  name: string
  party: string
  votes: number
  isLead: boolean
}

export type PollingStationResult = {
  psNo: number
  psName: string
  totalVotes: number
  candidates: PsCandidateResult[]
}

export function buildAcResultPath(stateId: string, acNo: number): string | null {
  const state = normalizeStateId(stateId)
  if (!state || acNo <= 0) return null
  const padded = acNo.toString().padStart(3, '0')
  return `/data/states/${state}/result/ac${padded}.json`
}

export async function fetchAcResult(stateId: string, acNo: number): Promise<AcResultData | null> {
  const path = buildAcResultPath(stateId, acNo)
  if (!path) return null

  try {
    const response = await fetch(resolvePublicAssetPath(path, getAppBasePath()))
    if (!response.ok) return null
    return (await response.json()) as AcResultData
  } catch {
    return null
  }
}

export function computePollingStationResults(data: AcResultData): PollingStationResult[] {
  const { polling_stations, candidates } = data.assembly_constituency

  const votesMap = new Map<number, { name: string; party: string; votes: number }[]>()

  for (const ps of polling_stations) {
    votesMap.set(ps.no, [])
  }

  for (const candidate of candidates) {
    for (const sv of candidate.secured_votes) {
      const entry = votesMap.get(sv.polling_station_no)
      if (entry) {
        entry.push({ name: candidate.name, party: candidate.party, votes: sv.votes })
      }
    }
  }

  return polling_stations.map((ps) => {
    const rawCandidates = votesMap.get(ps.no) ?? []
    const sorted = [...rawCandidates].sort((a, b) => b.votes - a.votes)
    const maxVotes = sorted[0]?.votes ?? 0

    const candidateResults: PsCandidateResult[] = sorted.map((c) => ({
      name: c.name,
      party: c.party,
      votes: c.votes,
      isLead: c.votes === maxVotes && maxVotes > 0,
    }))

    return {
      psNo: ps.no,
      psName: ps.name,
      totalVotes: ps.total_votes,
      candidates: candidateResults,
    }
  })
}

export function getPartyColorClass(party: string): string {
  const p = party.toLowerCase()
  if (p.includes('dravida munnetra kazhagam') && !p.includes('anna')) return 'bg-red-800'
  if (p.includes('anna dravida') || p.includes('aiadmk') || p.includes('admk')) return 'bg-green-700'
  if (p.includes('naam tamilar') || p.includes('nam tamilar') || p.includes('ntk')) return 'bg-orange-400'
  if (p.includes('tamilaga vettri') || p.includes('tamil vettri') || p.includes('tvk')) return 'bg-yellow-500'
  if (p.includes('bharatiya janata') || p.includes('bjp')) return 'bg-orange-600'
  if (p.includes('indian national congress') || p.includes('inc') || p.includes('congress')) return 'bg-blue-500'
  if (p.includes('communist party') || p.includes('cpm') || p.includes('cpi')) return 'bg-red-600'
  return 'bg-amber-600'
}

export async function fetchAcWinnerParty(stateId: string, acNo: number): Promise<string | null> {
  const data = await fetchAcResult(stateId, acNo)
  if (!data) return null
  return data.assembly_constituency.candidates.find((c) => c.winner)?.party ?? null
}
