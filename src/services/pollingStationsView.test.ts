import { describe, expect, it } from 'vitest'
import {
  filterAndSortPollingStations,
  groupSectionsByMetric,
  groupPollingStationsBySection,
  splitPartsCovered,
} from './pollingStationsView'
import type { PollingStationCsvRow } from './pollingStations'

function buildRow(overrides: Partial<PollingStationCsvRow>): PollingStationCsvRow {
  return {
    serial_no: overrides.serial_no ?? '',
    polling_station_no: overrides.polling_station_no ?? '',
    polling_station_location: overrides.polling_station_location ?? '',
    section: overrides.section ?? '',
    parts_covered: overrides.parts_covered ?? '',
    category: overrides.category ?? '',
    all_voters_covered: overrides.all_voters_covered ?? '',
    male: overrides.male ?? '',
    female: overrides.female ?? '',
    third_gender: overrides.third_gender ?? '',
    total: overrides.total ?? '',
    vanniyar: overrides.vanniyar ?? '',
    sc: overrides.sc ?? '',
    minority: overrides.minority ?? '',
    others: overrides.others ?? '',
    total_votes: overrides.total_votes ?? '',
  }
}

describe('filterAndSortPollingStations', () => {
  const rows = [
    buildRow({
      serial_no: '2',
      polling_station_no: '10',
      polling_station_location: 'Zeta School',
      section: 'Zeta',
      parts_covered: 'A',
      all_voters_covered: 'All Voters',
    }),
    buildRow({
      serial_no: '1',
      polling_station_no: '2',
      polling_station_location: 'Alpha Hall',
      section: 'Alpha',
      parts_covered: 'B',
      all_voters_covered: 'All Voters',
    }),
  ]

  it('sorts by polling station number', () => {
    const result = filterAndSortPollingStations(rows, '')
    expect(result.map((r) => r.polling_station_no)).toEqual(['2', '10'])
  })

  it('filters by station number and location', () => {
    expect(filterAndSortPollingStations(rows, '10').map((r) => r.polling_station_no)).toEqual(['10'])
    expect(filterAndSortPollingStations(rows, 'alpha').map((r) => r.polling_station_no)).toEqual(['2'])
  })

  it('supports multi-word partial search and includes parts_covered', () => {
    const result = filterAndSortPollingStations(
      [
        buildRow({
          serial_no: '1',
          polling_station_no: '154',
          polling_station_location: 'Govt School Kavanur',
          section: 'Kavanur',
          parts_covered: 'North Street, Main Road, Agraharam',
          all_voters_covered: 'All Voters',
        }),
      ],
      'kava mai',
    )
    expect(result).toHaveLength(1)
  })
})

describe('splitPartsCovered', () => {
  it('splits newline-separated parts into a clean list', () => {
    expect(splitPartsCovered('North Street\nMain Road\n\nAgraharam')).toEqual([
      'North Street',
      'Main Road',
      'Agraharam',
    ])
  })
})

describe('groupPollingStationsBySection', () => {
  it('groups rows by section with fallback for blank section', () => {
    const groups = groupPollingStationsBySection([
      buildRow({
        serial_no: '1',
        polling_station_no: '1',
        polling_station_location: 'A',
        section: 'S1',
        parts_covered: 'P1',
        all_voters_covered: 'All Voters',
      }),
      buildRow({
        serial_no: '2',
        polling_station_no: '2',
        polling_station_location: 'B',
        section: '',
        parts_covered: 'P2',
        all_voters_covered: 'All Voters',
      }),
      buildRow({
        serial_no: '3',
        polling_station_no: '3',
        polling_station_location: 'C',
        section: 'S1',
        parts_covered: 'P3',
        all_voters_covered: 'All Voters',
      }),
    ])

    expect(groups.map((g) => `${g.section}:${g.rows.length}`)).toContain('S1:2')
    expect(groups.map((g) => `${g.section}:${g.rows.length}`)).toContain('Unsectioned:1')
  })
})

describe('groupSectionsByPollingStationCount', () => {
  it('groups section groups by selected metric totals', () => {
    const groupedByCount = groupSectionsByMetric(
      [
      {
        section: 'A',
        rows: [
          buildRow({
            serial_no: '1',
            polling_station_no: '1',
            polling_station_location: 'A1',
            section: 'A',
            parts_covered: 'P1',
            all_voters_covered: 'All Voters',
            male: '100',
            female: '200',
            third_gender: '1',
            total: '301',
            vanniyar: '90',
            sc: '70',
            minority: '40',
            others: '101',
            total_votes: '301',
          }),
        ],
      },
      {
        section: 'B',
        rows: [
          buildRow({
            serial_no: '2',
            polling_station_no: '2',
            polling_station_location: 'B1',
            section: 'B',
            parts_covered: 'P2',
            all_voters_covered: 'All Voters',
            male: '120',
            female: '220',
            third_gender: '2',
            total: '342',
            vanniyar: '100',
            sc: '80',
            minority: '50',
            others: '112',
            total_votes: '342',
          }),
          buildRow({
            serial_no: '3',
            polling_station_no: '3',
            polling_station_location: 'B2',
            section: 'B',
            parts_covered: 'P3',
            all_voters_covered: 'All Voters',
            male: '130',
            female: '230',
            third_gender: '3',
            total: '363',
            vanniyar: '110',
            sc: '90',
            minority: '60',
            others: '103',
            total_votes: '363',
          }),
        ],
      },
      ],
      'pollingStations',
    )

    expect(groupedByCount.map((group) => `${group.count}:${group.sections.length}`)).toEqual(['2:1', '1:1'])
  })
})

describe('groupSectionsByMetric', () => {
  it('groups sections by female total for selected metric', () => {
    const groupedByFemale = groupSectionsByMetric(
      [
        {
          section: 'A',
          rows: [
            buildRow({
              serial_no: '1',
              polling_station_no: '1',
              polling_station_location: 'A1',
              section: 'A',
              parts_covered: 'P1',
              all_voters_covered: 'All Voters',
              male: '50',
              female: '100',
              third_gender: '0',
              total: '150',
              vanniyar: '30',
              sc: '10',
              minority: '20',
              others: '90',
              total_votes: '150',
            }),
            buildRow({
              serial_no: '2',
              polling_station_no: '2',
              polling_station_location: 'A2',
              section: 'A',
              parts_covered: 'P2',
              all_voters_covered: 'All Voters',
              male: '50',
              female: '50',
              third_gender: '0',
              total: '100',
              vanniyar: '20',
              sc: '10',
              minority: '10',
              others: '60',
              total_votes: '100',
            }),
          ],
        },
        {
          section: 'B',
          rows: [
            buildRow({
              serial_no: '3',
              polling_station_no: '3',
              polling_station_location: 'B1',
              section: 'B',
              parts_covered: 'P3',
              all_voters_covered: 'All Voters',
              male: '30',
              female: '100',
              third_gender: '0',
              total: '130',
              vanniyar: '25',
              sc: '8',
              minority: '12',
              others: '85',
              total_votes: '130',
            }),
          ],
        },
      ],
      'female',
    )

    expect(groupedByFemale.map((group) => `${group.count}:${group.sections.length}`)).toEqual(['150:1', '100:1'])
  })
})
