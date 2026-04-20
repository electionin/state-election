import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { fetchStateConfig, stateExists } from '../../../../../../services/appConfig'
import { fetchElectorCsvRows, toInt } from '../../../../../../services/electors'
import {
  fetchPollingStationCsvRows,
  normalizePollingStationLanguage,
  parseAcCode,
  type PollingStationCsvRow,
} from '../../../../../../services/pollingStations'
import {
  filterAndSortPollingStations,
  getSectionGroupMetricValue,
  type PollingStationGroupingMetric,
  groupPollingStationsBySection,
  groupSectionsByMetric,
  splitPartsCovered,
} from '../../../../../../services/pollingStationsView'

type LoaderData = {
  stateId: string
  district: string
  acNo: number
  acName: string
  lang: 'ta' | 'en'
  rows: PollingStationCsvRow[]
}

export const Route = createFileRoute('/$state/data/$district/$acCode/ps/$lang')({
  loader: async ({ params }) => {
    if (!(await stateExists(params.state))) {
      throw notFound()
    }

    const lang = normalizePollingStationLanguage(params.lang)
    const acNo = parseAcCode(params.acCode)
    if (!lang || !acNo) {
      throw notFound()
    }

    const config = await fetchStateConfig(params.state)
    const districtParam = decodeURIComponent(params.district).trim().toLowerCase()
    const electorRows = await fetchElectorCsvRows(config.elector_csv_path)
    const districtRows = electorRows.filter((row) => row.district_name?.trim().toLowerCase() === districtParam)
    if (districtRows.length === 0) {
      throw notFound()
    }

    const acRow = districtRows.find((row) => toInt(row.ac_no) === acNo)
    if (!acRow) {
      throw notFound()
    }

    let rows: PollingStationCsvRow[]
    try {
      rows = await fetchPollingStationCsvRows(params.state, params.acCode, lang)
    } catch {
      throw notFound()
    }

    return {
      stateId: config.state_id,
      district: acRow.district_name,
      acNo,
      acName: acRow.ac_name,
      lang,
      rows,
    } satisfies LoaderData
  },
  component: PollingStationsPage,
})

function PollingStationsPage() {
  const { stateId, district, acNo, acName, lang, rows } = Route.useLoaderData()
  const isTamil = lang === 'ta'
  const languageLabel = lang === 'en' ? 'English' : 'Tamil'
  const groupingOptions: { value: PollingStationGroupingMetric; label: string; itemLabel: string }[] = [
    { value: 'pollingStations', label: 'Polling Stations', itemLabel: 'Polling Stations' },
    { value: 'voters', label: 'Voters', itemLabel: 'Voters' },
    { value: 'vanniyar', label: 'Vanniyar', itemLabel: 'Vanniyar' },
    { value: 'sc', label: 'SC', itemLabel: 'SC' },
    { value: 'minority', label: 'Minority', itemLabel: 'Minority' },
    { value: 'female', label: 'Female', itemLabel: 'Female' },
  ]
  const [search, setSearch] = useState('')
  const [sectionSearch, setSectionSearch] = useState('')
  const [groupingMetric, setGroupingMetric] = useState<PollingStationGroupingMetric>('pollingStations')
  const filteredRows = useMemo(() => filterAndSortPollingStations(rows, search), [rows, search])
  const sectionGroups = useMemo(() => groupPollingStationsBySection(filteredRows), [filteredRows])
  const visibleSectionGroups = useMemo(() => {
    const query = sectionSearch.trim().toLowerCase()
    if (!query) return sectionGroups
    return sectionGroups.filter((group) => group.section.toLowerCase().includes(query))
  }, [sectionGroups, sectionSearch])
  const countGroups = useMemo(
    () => groupSectionsByMetric(visibleSectionGroups, groupingMetric),
    [visibleSectionGroups, groupingMetric],
  )
  const [collapsedSections, setCollapsedSections] = useState<string[]>(
    () => groupPollingStationsBySection(rows).map((group) => group.section),
  )
  const [collapsedCountGroupsByMetric, setCollapsedCountGroupsByMetric] = useState<
    Record<PollingStationGroupingMetric, number[]>
  >(() => {
    const allSectionGroups = groupPollingStationsBySection(rows)
    return {
      pollingStations: groupSectionsByMetric(allSectionGroups, 'pollingStations').map((group) => group.count),
      voters: groupSectionsByMetric(allSectionGroups, 'voters').map((group) => group.count),
      vanniyar: groupSectionsByMetric(allSectionGroups, 'vanniyar').map((group) => group.count),
      sc: groupSectionsByMetric(allSectionGroups, 'sc').map((group) => group.count),
      minority: groupSectionsByMetric(allSectionGroups, 'minority').map((group) => group.count),
      female: groupSectionsByMetric(allSectionGroups, 'female').map((group) => group.count),
    }
  })
  const [selectedSerialNo, setSelectedSerialNo] = useState<string>(rows[0]?.serial_no ?? '')
  const selectedRow = filteredRows.find((row) => row.serial_no === selectedSerialNo) ?? filteredRows[0] ?? null
  const selectedGroupingOption = groupingOptions.find((option) => option.value === groupingMetric) ?? groupingOptions[0]
  const collapsedCountGroups = collapsedCountGroupsByMetric[groupingMetric] ?? []

  const onSelectStation = (serialNo: string) => {
    setSelectedSerialNo(serialNo)
  }

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) =>
      prev.includes(section) ? prev.filter((name) => name !== section) : [...prev, section],
    )
  }

  const toggleCountGroup = (count: number) => {
    setCollapsedCountGroupsByMetric((prev) => {
      const current = prev[groupingMetric] ?? []
      return {
        ...prev,
        [groupingMetric]: current.includes(count) ? current.filter((value) => value !== count) : [...current, count],
      }
    })
  }

  return (
    <section className="space-y-6 select-none caret-transparent">
      <div className="flex items-start gap-3">
        <Link
          to="/$state/data/$district"
          params={{ state: stateId, district }}
          className="mt-1 rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900">{`AC ${acNo} - ${acName}`}</h2>
          <p className="text-sm text-slate-600">
            Polling Stations in {acName} ({languageLabel})
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {filteredRows.length.toLocaleString('en-IN')} polling stations
          </p>
          <div className="relative w-full sm:max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by station no. or location"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Group Left Pane By</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {groupingOptions.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <input
                  type="radio"
                  name="grouping-metric"
                  value={option.value}
                  checked={groupingMetric === option.value}
                  onChange={() => setGroupingMetric(option.value)}
                  className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="max-h-[65vh] overflow-y-auto rounded-lg border border-slate-200">
              {filteredRows.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No polling stations found for this search.</p>
              ) : (
                <>
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={sectionSearch}
                        onChange={(e) => setSectionSearch(e.target.value)}
                        placeholder="Search section name"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      {sectionSearch ? (
                        <button
                          type="button"
                          onClick={() => setSectionSearch('')}
                          aria-label="Clear section search"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <X size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {countGroups.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No sections found.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {countGroups.map((countGroup) => {
                        const parentCollapsed = collapsedCountGroups.includes(countGroup.count)
                        return (
                          <li key={countGroup.count} className="bg-white">
                            <button
                              type="button"
                              onClick={() => toggleCountGroup(countGroup.count)}
                              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                            >
                              <span className="text-sm font-semibold text-slate-900">
                                {countGroup.count.toLocaleString('en-IN')} {selectedGroupingOption.itemLabel} (
                                {countGroup.sections.length})
                              </span>
                              <span className="text-xs text-slate-500">{parentCollapsed ? '▸' : '▾'}</span>
                            </button>
                            {!parentCollapsed && (
                              <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/40">
                                {countGroup.sections.map((group) => {
                                  const sectionCollapsed = collapsedSections.includes(group.section)
                                  return (
                                    <li key={group.section} className="bg-white">
                                      <button
                                        type="button"
                                        onClick={() => toggleSection(group.section)}
                                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                                      >
                                        <span className="text-sm font-semibold text-slate-900">
                                          {group.section} ({getSectionGroupMetricValue(group, groupingMetric).toLocaleString('en-IN')})
                                        </span>
                                        <span className="text-xs text-slate-500">{sectionCollapsed ? '▸' : '▾'}</span>
                                      </button>
                                      {!sectionCollapsed && (
                                        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/30">
                                          {group.rows.map((row) => {
                                            const isSelected = selectedRow?.serial_no === row.serial_no
                                            return (
                                              <li key={`${row.serial_no}-${row.polling_station_no}`}>
                                                <button
                                                  type="button"
                                                  onClick={() => onSelectStation(row.serial_no)}
                                                  className={`w-full px-6 py-3 text-left transition ${
                                                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                                                  }`}
                                                >
                                                  <p className="text-sm font-semibold text-slate-900">PS {row.polling_station_no}</p>
                                                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                                                    {row.polling_station_location}
                                                  </p>
                                                </button>
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="h-full rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              {selectedRow ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Parts Covered</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                      {splitPartsCovered(selectedRow.parts_covered).map((part) => (
                        <li key={`selected-${selectedRow.serial_no}-${part}`}>{part}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Voter Summary</p>
                    <div className="mt-2 overflow-hidden rounded-md border border-slate-200 bg-white">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-medium text-slate-600">
                              {isTamil ? 'ஆண்' : 'Male'}
                            </th>
                            <td className="px-3 py-2 text-right text-slate-900">
                              {toInt(selectedRow.male).toLocaleString('en-IN')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-medium text-slate-600">
                              {isTamil ? 'பெண்' : 'Female'}
                            </th>
                            <td className="px-3 py-2 text-right text-slate-900">
                              {toInt(selectedRow.female).toLocaleString('en-IN')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-medium text-slate-600">
                              {isTamil ? 'மூன்றாம் பாலினம்' : 'Third Gender'}
                            </th>
                            <td className="px-3 py-2 text-right text-slate-900">
                              {toInt(selectedRow.third_gender).toLocaleString('en-IN')}
                            </td>
                          </tr>
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-slate-700">
                              {isTamil ? 'மொத்த வாக்குகள்' : 'Total Votes'}
                            </th>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">
                              {toInt(selectedRow.total).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Community Summary</p>
                    <div className="mt-2 overflow-hidden rounded-md border border-slate-200 bg-white">
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-medium text-slate-600">
                              {isTamil ? 'வன்னியர்' : 'Vanniyar'}
                            </th>
                            <td className="px-3 py-2 text-right text-slate-900">
                              {toInt(selectedRow.vanniyar).toLocaleString('en-IN')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-medium text-slate-600">
                              {isTamil ? 'ஆதிதிராவிடர்' : 'SC'}
                            </th>
                            <td className="px-3 py-2 text-right text-slate-900">
                              {toInt(selectedRow.sc).toLocaleString('en-IN')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-100">
                            <th className="px-3 py-2 text-left font-medium text-slate-600">
                              {isTamil ? 'சிறுபான்மை' : 'Minority'}
                            </th>
                            <td className="px-3 py-2 text-right text-slate-900">
                              {toInt(selectedRow.minority).toLocaleString('en-IN')}
                            </td>
                          </tr>
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">
                              {isTamil ? 'மற்றவர்கள்' : 'Others'}
                            </th>
                            <td className="px-3 py-2 text-right text-slate-900">
                              {toInt(selectedRow.others).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Select a polling station to view parts covered.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
