import { describe, expect, it } from 'vitest'
import { filterAndSortPollingStations, splitPartsCovered } from './pollingStationsView'

describe('filterAndSortPollingStations', () => {
  const rows = [
    {
      serial_no: '2',
      polling_station_no: '10',
      polling_station_location: 'Zeta School',
      parts_covered: 'A',
      all_voters_covered: 'All Voters',
    },
    {
      serial_no: '1',
      polling_station_no: '2',
      polling_station_location: 'Alpha Hall',
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
  it('splits comma-separated parts into a clean list', () => {
    expect(splitPartsCovered('North Street, Main Road, , Agraharam')).toEqual([
      'North Street',
      'Main Road',
      'Agraharam',
    ])
  })
})
