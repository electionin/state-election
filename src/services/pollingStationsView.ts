import type { PollingStationCsvRow } from './pollingStations'
import { toInt } from './electors'

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

export function splitPartsCovered(partsCovered: string): string[] {
  return (partsCovered ?? '')
    .split(/\r?\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export type PollingStationSectionGroup = {
  section: string
  rows: PollingStationCsvRow[]
}

export type PollingStationCountGroup = {
  count: number
  sections: PollingStationSectionGroup[]
}

export function groupPollingStationsBySection(rows: PollingStationCsvRow[]): PollingStationSectionGroup[] {
  const groups = new Map<string, PollingStationCsvRow[]>()

  for (const row of rows) {
    const section = (row.section ?? '').trim() || 'Unsectioned'
    const existing = groups.get(section)
    if (existing) {
      existing.push(row)
    } else {
      groups.set(section, [row])
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }))
    .map(([section, groupedRows]) => ({ section, rows: groupedRows }))
}

export function groupSectionsByPollingStationCount(
  sectionGroups: PollingStationSectionGroup[],
): PollingStationCountGroup[] {
  const groups = new Map<number, PollingStationSectionGroup[]>()

  for (const sectionGroup of sectionGroups) {
    const count = sectionGroup.rows.length
    const existing = groups.get(count)
    if (existing) {
      existing.push(sectionGroup)
    } else {
      groups.set(count, [sectionGroup])
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b - a)
    .map(([count, sections]) => ({
      count,
      sections: [...sections].sort((a, b) =>
        a.section.localeCompare(b.section, undefined, { sensitivity: 'base', numeric: true }),
      ),
    }))
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
            row.section ?? '',
            row.parts_covered ?? '',
          ]
            .join(' ')
            .toLowerCase()
          return tokens.every((token) => searchable.includes(token))
        })

  return [...filtered].sort((a, b) => toInt(a.polling_station_no) - toInt(b.polling_station_no))
}
