import Papa from 'papaparse'
import { getAppBasePath, resolvePublicAssetPath } from './url'
import { normalizeStateId } from './appConfig'

export type PollingStationLanguage = 'ta' | 'en'

export type PollingStationCsvRow = {
  serial_no: string
  polling_station_no: string
  polling_station_location: string
  parts_covered: string
  all_voters_covered: string
}

export function normalizePollingStationLanguage(value: string | null | undefined): PollingStationLanguage | null {
  const lang = (value ?? '').trim().toLowerCase()
  if (lang === 'ta' || lang === 'en') return lang
  return null
}

export function parseAcCode(value: string | null | undefined): number | null {
  const raw = (value ?? '').trim().toLowerCase()
  const match = /^ac(\d+)$/.exec(raw)
  if (!match) return null

  const acNo = Number.parseInt(match[1], 10)
  if (!Number.isFinite(acNo) || acNo <= 0) return null
  return acNo
}

export function buildPollingStationsCsvPath(
  stateId: string,
  acCode: string,
  lang: PollingStationLanguage,
): string | null {
  const state = normalizeStateId(stateId)
  const acNo = parseAcCode(acCode)
  if (!state || !acNo) return null

  const canonicalAcCode = `ac${acNo}`
  const fileName = lang === 'en' ? 'polling_stations_en.csv' : 'polling_stations.csv'
  return `/data/states/${state}/polling-stations/${canonicalAcCode}/${fileName}`
}

export async function fetchPollingStationCsvRows(
  stateId: string,
  acCode: string,
  lang: PollingStationLanguage,
): Promise<PollingStationCsvRow[]> {
  const csvPath = buildPollingStationsCsvPath(stateId, acCode, lang)
  if (!csvPath) {
    throw new Error('Invalid polling station path params')
  }

  const response = await fetch(resolvePublicAssetPath(csvPath, getAppBasePath()))
  if (!response.ok) {
    throw new Error(`Failed to load polling stations CSV (${response.status})`)
  }

  const csvText = await response.text()
  const parsed = Papa.parse<PollingStationCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message)
  }

  return parsed.data
}
