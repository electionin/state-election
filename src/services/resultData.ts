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
