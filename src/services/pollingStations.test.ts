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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          [
            'serial_no,polling_station_no,polling_station_location,section,parts_covered,all_voters_covered',
            '1,1,"School A","Section A","1.Street A",All Voters',
          ].join('\n'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          [
            'serial_no,polling_station_no,polling_station_location,section,parts_covered,all_voters_covered,female,total,vanniyar,sc,minority',
            '1,1,"School A","Section A","1.Street A",அனைத்து வாக்காளர்கள்,500,1000,300,120,80',
          ].join('\n'),
      })

    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPollingStationCsvRows('tn', 'ac154', 'en')).resolves.toEqual([
      {
        serial_no: '1',
        polling_station_no: '1',
        polling_station_location: 'School A',
        section: 'Section A',
        parts_covered: '1.Street A',
        category: '',
        all_voters_covered: 'All Voters',
        male: '',
        female: '500',
        third_gender: '',
        total: '1000',
        vanniyar: '300',
        sc: '120',
        minority: '80',
        others: '',
        total_votes: '',
      },
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })

  it('normalizes tamil rows when polling_station_no column is missing in some rows', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        [
          'serial_no,polling_station_no,polling_station_location,section,parts_covered,all_voters_covered',
          '121,121,"Location A","Section A","1.Part A; 2.Part B","அனைத்து வாக்காளர்கள்"',
          '122,"Location B","1.Part C; 2.Part D","அனைத்து வாக்காளர்கள்"',
        ].join('\n'),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPollingStationCsvRows('tn', 'ac154', 'ta')).resolves.toEqual([
      {
        serial_no: '121',
        polling_station_no: '121',
        polling_station_location: 'Location A',
        section: 'Section A',
        parts_covered: '1.Part A; 2.Part B',
        category: '',
        all_voters_covered: 'அனைத்து வாக்காளர்கள்',
        male: '',
        female: '',
        third_gender: '',
        total: '',
        vanniyar: '',
        sc: '',
        minority: '',
        others: '',
        total_votes: '',
      },
      {
        serial_no: '122',
        polling_station_no: '122',
        polling_station_location: 'Location B',
        section: '',
        parts_covered: '1.Part C; 2.Part D',
        category: '',
        all_voters_covered: 'அனைத்து வாக்காளர்கள்',
        male: '',
        female: '',
        third_gender: '',
        total: '',
        vanniyar: '',
        sc: '',
        minority: '',
        others: '',
        total_votes: '',
      },
    ])

    vi.unstubAllGlobals()
  })

  it('merges EN rows with common fields from TA rows', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          [
            'serial_no,polling_station_no,polling_station_location,section,parts_covered,all_voters_covered',
            '1,1,"School A","Section A","1.Street A",All Voters',
            '2,2,"School B","Section B","1.Street B",All Voters',
          ].join('\n'),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          [
            'serial_no,polling_station_no,polling_station_location,section,parts_covered,all_voters_covered,female,total,vanniyar,sc,minority',
            '1,1,"Tamil School A","Section A","1.Street A",அனைத்து வாக்காளர்கள்,400,900,200,100,80',
            '2,2,"Tamil School B","Section B","1.Street B",அனைத்து வாக்காளர்கள்,500,1000,250,150,90',
          ].join('\n'),
      })

    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchPollingStationCsvRows('tn', 'ac154', 'en')
    expect(rows.map((row) => ({ serial: row.serial_no, female: row.female, total: row.total }))).toEqual([
      { serial: '1', female: '400', total: '900' },
      { serial: '2', female: '500', total: '1000' },
    ])
    expect(rows.map((row) => ({ serial: row.serial_no, vanniyar: row.vanniyar, sc: row.sc, minority: row.minority }))).toEqual([
      { serial: '1', vanniyar: '200', sc: '100', minority: '80' },
      { serial: '2', vanniyar: '250', sc: '150', minority: '90' },
    ])

    vi.unstubAllGlobals()
  })
})
