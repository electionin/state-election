import Papa from 'papaparse'
import { getAppBasePath, resolvePublicAssetPath } from './url'
import { normalizeStateId } from './appConfig'

export type PollingStationLanguage = 'ta' | 'en'

export type PollingStationCsvRow = {
  serial_no: string
  polling_station_no: string
  polling_station_location: string
  section: string
  parts_covered: string
  category: string
  all_voters_covered: string
  male: string
  female: string
  third_gender: string
  total: string
  vanniyar: string
  sc: string
  minority: string
  others: string
  total_votes: string
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim()
}

function isNumericText(value: string): boolean {
  return /^\d+$/.test(value)
}

function normalizePollingStationRow(row: Partial<PollingStationCsvRow>): PollingStationCsvRow {
  const serialNo = normalizeText(row.serial_no)
  const pollingStationNo = normalizeText(row.polling_station_no)
  const location = normalizeText(row.polling_station_location)
  const section = normalizeText(row.section)
  const partsCovered = normalizeText(row.parts_covered)
  const category = normalizeText(row.category)
  const voterType = normalizeText(row.all_voters_covered)
  const male = normalizeText(row.male)
  const female = normalizeText(row.female)
  const thirdGender = normalizeText(row.third_gender)
  const total = normalizeText(row.total)
  const vanniyar = normalizeText(row.vanniyar)
  const sc = normalizeText(row.sc)
  const minority = normalizeText(row.minority)
  const others = normalizeText(row.others)
  const totalVotes = normalizeText(row.total_votes)

  // Recover from shifted rows where polling_station_no is missing in CSV:
  // serial_no,location,parts_covered,all_voters_covered
  if (!voterType && !isNumericText(pollingStationNo) && location.startsWith('1.') && partsCovered.length > 0) {
    return {
      serial_no: serialNo,
      polling_station_no: serialNo,
      polling_station_location: pollingStationNo,
      section: '',
      parts_covered: location,
      category: '',
      all_voters_covered: partsCovered,
      male: '',
      female: '',
      third_gender: '',
      total: '',
      vanniyar: '',
      sc: '',
      minority: '',
      others: '',
      total_votes: '',
    }
  }

  // Recover from shifted rows with section column schema:
  // serial_no,location,parts_covered,all_voters_covered
  // mapped as: serial_no,polling_station_no,polling_station_location,section
  if (!voterType && !partsCovered && !isNumericText(pollingStationNo) && location.startsWith('1.') && section.length > 0) {
    return {
      serial_no: serialNo,
      polling_station_no: serialNo,
      polling_station_location: pollingStationNo,
      section: '',
      parts_covered: location,
      category: '',
      all_voters_covered: section,
      male: '',
      female: '',
      third_gender: '',
      total: '',
      vanniyar: '',
      sc: '',
      minority: '',
      others: '',
      total_votes: '',
    }
  }

  return {
    serial_no: serialNo,
    polling_station_no: pollingStationNo || serialNo,
    polling_station_location: location,
    section,
    parts_covered: partsCovered,
    category,
    all_voters_covered: voterType,
    male,
    female,
    third_gender: thirdGender,
    total,
    vanniyar,
    sc,
    minority,
    others,
    total_votes: totalVotes,
  }
}

function buildRowKey(row: PollingStationCsvRow): string {
  const serial = normalizeText(row.serial_no)
  const stationNo = normalizeText(row.polling_station_no)
  if (serial || stationNo) return `${serial}|${stationNo}`
  return ''
}

function mergeCommonFields(
  baseRows: PollingStationCsvRow[],
  sourceRows: PollingStationCsvRow[],
): PollingStationCsvRow[] {
  const sourceByKey = new Map<string, PollingStationCsvRow>()
  for (const row of sourceRows) {
    const key = buildRowKey(row)
    if (key) sourceByKey.set(key, row)
  }

  return baseRows.map((row, index) => {
    const key = buildRowKey(row)
    const source = (key ? sourceByKey.get(key) : undefined) ?? sourceRows[index]
    if (!source) return row

    return {
      ...row,
      male: source.male || row.male,
      female: source.female || row.female,
      third_gender: source.third_gender || row.third_gender,
      total: source.total || row.total,
      vanniyar: source.vanniyar || row.vanniyar,
      sc: source.sc || row.sc,
      minority: source.minority || row.minority,
      others: source.others || row.others,
      total_votes: source.total_votes || row.total_votes,
    }
  })
}

async function fetchAndParsePollingStationCsvRows(path: string): Promise<PollingStationCsvRow[]> {
  const response = await fetch(resolvePublicAssetPath(path, getAppBasePath()))
  if (!response.ok) {
    throw new Error(`Failed to load polling stations CSV (${response.status})`)
  }

  const csvText = await response.text()
  const parsed = Papa.parse<PollingStationCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  const nonRecoverableError = parsed.errors.find((error) => error.code !== 'TooFewFields')
  if (nonRecoverableError) {
    throw new Error(nonRecoverableError.message)
  }

  return parsed.data.map((row) => normalizePollingStationRow(row))
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

  const rows = await fetchAndParsePollingStationCsvRows(csvPath)
  if (lang !== 'en') return rows

  const tamilPath = buildPollingStationsCsvPath(stateId, acCode, 'ta')
  if (!tamilPath) return rows

  const tamilRows = await fetchAndParsePollingStationCsvRows(tamilPath)
  return mergeCommonFields(rows, tamilRows)
}
