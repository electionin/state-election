import type { PollingStationCsvRow } from './pollingStations'
import { toInt } from './electors'

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

export function splitPartsCovered(partsCovered: string): string[] {
  return (partsCovered ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export function filterAndSortPollingStations(
  rows: PollingStationCsvRow[],
  query: string,
): PollingStationCsvRow[] {
  const tokens = normalizeSearchText(query)
    .split(/\s+/)
    .filter((token) => token.length > 0)

  const filtered =
    tokens.length === 0
      ? rows
      : rows.filter((row) => {
          const searchable = [
            row.polling_station_no ?? '',
            row.polling_station_location ?? '',
            row.parts_covered ?? '',
          ]
            .join(' ')
            .toLowerCase()
          return tokens.every((token) => searchable.includes(token))
        })

  return [...filtered].sort((a, b) => toInt(a.polling_station_no) - toInt(b.polling_station_no))
}
