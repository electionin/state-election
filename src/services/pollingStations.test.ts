import { describe, expect, it, vi } from 'vitest'
import {
  buildPollingStationsCsvPath,
  fetchPollingStationCsvRows,
  normalizePollingStationLanguage,
  parseAcCode,
} from './pollingStations'

describe('normalizePollingStationLanguage', () => {
  it('accepts ta and en case-insensitively', () => {
    expect(normalizePollingStationLanguage('ta')).toBe('ta')
    expect(normalizePollingStationLanguage('EN')).toBe('en')
  })

  it('rejects unsupported language codes', () => {
    expect(normalizePollingStationLanguage('')).toBeNull()
    expect(normalizePollingStationLanguage('hi')).toBeNull()
  })
})

describe('parseAcCode', () => {
  it('parses acNNN format', () => {
    expect(parseAcCode('ac154')).toBe(154)
    expect(parseAcCode('AC009')).toBe(9)
  })

  it('rejects invalid ac code formats', () => {
    expect(parseAcCode('154')).toBeNull()
    expect(parseAcCode('ac')).toBeNull()
    expect(parseAcCode('ac0')).toBeNull()
  })
})

describe('buildPollingStationsCsvPath', () => {
  it('builds tamil and english file paths', () => {
    expect(buildPollingStationsCsvPath('tn', 'ac154', 'ta')).toBe(
      '/data/states/tn/polling-stations/ac154/polling_stations.csv',
    )
    expect(buildPollingStationsCsvPath('TN', 'AC154', 'en')).toBe(
      '/data/states/tn/polling-stations/ac154/polling_stations_en.csv',
    )
  })

  it('returns null for invalid input', () => {
    expect(buildPollingStationsCsvPath('', 'ac154', 'ta')).toBeNull()
    expect(buildPollingStationsCsvPath('tn', '154', 'ta')).toBeNull()
  })
})

describe('fetchPollingStationCsvRows', () => {
  it('parses polling station csv rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        [
          'serial_no,polling_station_no,polling_station_location,parts_covered,all_voters_covered',
          '1,1,"School A","1.Street A",All Voters',
        ].join('\n'),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPollingStationCsvRows('tn', 'ac154', 'en')).resolves.toEqual([
      {
        serial_no: '1',
        polling_station_no: '1',
        polling_station_location: 'School A',
        parts_covered: '1.Street A',
        all_voters_covered: 'All Voters',
      },
    ])

    expect(fetchMock).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
