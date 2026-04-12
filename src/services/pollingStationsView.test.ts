import { describe, expect, it } from 'vitest'
import {
  filterAndSortPollingStations,
  groupPollingStationsByCategory,
  groupPollingStationsBySection,
  groupSectionsByPollingStationCount,
  splitPartsCovered,
} from './pollingStationsView'

describe('filterAndSortPollingStations', () => {
  const rows = [
    {
      serial_no: '2',
      polling_station_no: '10',
      polling_station_location: 'Zeta School',
      category: '0',
      section: 'Zeta',
      parts_covered: 'A',
      all_voters_covered: 'All Voters',
    },
    {
      serial_no: '1',
      polling_station_no: '2',
      polling_station_location: 'Alpha Hall',
      category: '1',
      section: 'Alpha',
      parts_covered: 'B',
      all_voters_covered: 'All Voters',
    },
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
        {
          serial_no: '1',
          polling_station_no: '154',
          polling_station_location: 'Govt School Kavanur',
          category: '1',
          section: 'Kavanur',
          parts_covered: 'North Street, Main Road, Agraharam',
          all_voters_covered: 'All Voters',
        },
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
      {
        serial_no: '1',
        polling_station_no: '1',
        polling_station_location: 'A',
        category: '1',
        section: 'S1',
        parts_covered: 'P1',
        all_voters_covered: 'All Voters',
      },
      {
        serial_no: '2',
        polling_station_no: '2',
        polling_station_location: 'B',
        category: '',
        section: '',
        parts_covered: 'P2',
        all_voters_covered: 'All Voters',
      },
      {
        serial_no: '3',
        polling_station_no: '3',
        polling_station_location: 'C',
        category: '1',
        section: 'S1',
        parts_covered: 'P3',
        all_voters_covered: 'All Voters',
      },
    ])

    expect(groups.map((g) => `${g.section}:${g.rows.length}`)).toContain('S1:2')
    expect(groups.map((g) => `${g.section}:${g.rows.length}`)).toContain('Unsectioned:1')
  })
})

describe('groupSectionsByPollingStationCount', () => {
  it('groups section groups by their polling station counts', () => {
    const groupedByCount = groupSectionsByPollingStationCount([
      {
        section: 'A',
        rows: [
          {
            serial_no: '1',
            polling_station_no: '1',
            polling_station_location: 'A1',
            category: '0',
            section: 'A',
            parts_covered: 'P1',
            all_voters_covered: 'All Voters',
          },
        ],
      },
      {
        section: 'B',
        rows: [
          {
            serial_no: '2',
            polling_station_no: '2',
            polling_station_location: 'B1',
            category: '0',
            section: 'B',
            parts_covered: 'P2',
            all_voters_covered: 'All Voters',
          },
          {
            serial_no: '3',
            polling_station_no: '3',
            polling_station_location: 'B2',
            category: '0',
            section: 'B',
            parts_covered: 'P3',
            all_voters_covered: 'All Voters',
          },
        ],
      },
    ])

    expect(groupedByCount.map((group) => `${group.count}:${group.sections.length}`)).toEqual(['2:1', '1:1'])
  })
})

describe('groupPollingStationsByCategory', () => {
  it('groups rows by category with fallback', () => {
    const grouped = groupPollingStationsByCategory([
      {
        serial_no: '1',
        polling_station_no: '1',
        polling_station_location: 'A',
        category: '1',
        section: 'S1',
        parts_covered: 'P1',
        all_voters_covered: 'All Voters',
      },
      {
        serial_no: '2',
        polling_station_no: '2',
        polling_station_location: 'B',
        category: '0',
        section: 'S2',
        parts_covered: 'P2',
        all_voters_covered: 'All Voters',
      },
      {
        serial_no: '3',
        polling_station_no: '3',
        polling_station_location: 'C',
        category: '',
        section: 'S3',
        parts_covered: 'P3',
        all_voters_covered: 'All Voters',
      },
    ])

    expect(grouped.map((group) => group.category)).toEqual(['0', '1', 'Uncategorized'])
  })
})
