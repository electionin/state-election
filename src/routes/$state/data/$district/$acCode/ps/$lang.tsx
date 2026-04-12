import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
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
  groupPollingStationsByCategory,
  groupPollingStationsBySection,
  groupSectionsByPollingStationCount,
  splitPartsCovered,
} from '../../../../../../services/pollingStationsView'
import { downloadCategoryReportPdf } from '../../../../../../services/pollingStationReport'

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
  const languageLabel = lang === 'en' ? 'English' : 'Tamil'
  const boothLabel = lang === 'en' ? 'Booth' : 'வாக்குச்சாவடி'
  const [search, setSearch] = useState('')
  const [sectionSearch, setSectionSearch] = useState('')
  const filteredRows = useMemo(() => filterAndSortPollingStations(rows, search), [rows, search])
  const sectionFilteredRows = useMemo(() => {
    const query = sectionSearch.trim().toLowerCase()
    if (!query) return filteredRows
    return filteredRows.filter((row) => row.section.toLowerCase().includes(query))
  }, [filteredRows, sectionSearch])
  const categoryGroups = useMemo(() => groupPollingStationsByCategory(sectionFilteredRows), [sectionFilteredRows])
  const categoryCountGroups = useMemo(
    () =>
      categoryGroups.map((categoryGroup) => ({
        category: categoryGroup.category,
        countGroups: groupSectionsByPollingStationCount(groupPollingStationsBySection(categoryGroup.rows)),
      })),
    [categoryGroups],
  )
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>(
    () => groupPollingStationsByCategory(rows).map((group) => group.category),
  )
  const [collapsedSections, setCollapsedSections] = useState<string[]>(
    () =>
      groupPollingStationsByCategory(rows).flatMap((categoryGroup) =>
        groupPollingStationsBySection(categoryGroup.rows).map((sectionGroup) => `${categoryGroup.category}::${sectionGroup.section}`),
      ),
  )
  const [collapsedCountGroups, setCollapsedCountGroups] = useState<string[]>(
    () =>
      groupPollingStationsByCategory(rows).flatMap((categoryGroup) =>
        groupSectionsByPollingStationCount(groupPollingStationsBySection(categoryGroup.rows)).map(
          (countGroup) => `${categoryGroup.category}::${countGroup.count}`,
        ),
      ),
  )
  const [selectedSerialNo, setSelectedSerialNo] = useState<string>(rows[0]?.serial_no ?? '')
  const selectedRow = filteredRows.find((row) => row.serial_no === selectedSerialNo) ?? filteredRows[0] ?? null

  const onSelectStation = (serialNo: string) => {
    setSelectedSerialNo(serialNo)
  }

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) =>
      prev.includes(section) ? prev.filter((name) => name !== section) : [...prev, section],
    )
  }

  const toggleCountGroup = (countKey: string) => {
    setCollapsedCountGroups((prev) =>
      prev.includes(countKey) ? prev.filter((value) => value !== countKey) : [...prev, countKey],
    )
  }

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) =>
      prev.includes(category) ? prev.filter((name) => name !== category) : [...prev, category],
    )
  }

  const getCategoryLabel = (category: string): string => {
    if (category === '0') return 'General'
    if (category === '1') return 'Colony'
    if (category === 'Uncategorized') return 'Uncategorized'
    return `Category ${category}`
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
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by station no. or location"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:max-w-sm"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="max-h-[65vh] overflow-y-auto rounded-lg border border-slate-200">
              {filteredRows.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No polling stations found for this search.</p>
              ) : (
                <>
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3">
                    <input
                      type="text"
                      value={sectionSearch}
                      onChange={(e) => setSectionSearch(e.target.value)}
                      placeholder="Search section name"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  {categoryCountGroups.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No sections found.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {categoryCountGroups.map(({ category, countGroups }) => {
                        const categoryCollapsed = collapsedCategories.includes(category)
                        const categoryTotal = countGroups.reduce(
                          (sum, countGroup) => sum + countGroup.sections.reduce((inner, section) => inner + section.rows.length, 0),
                          0,
                        )
                        const categoryRows = countGroups.flatMap((countGroup) => countGroup.sections.flatMap((section) => section.rows))
                        return (
                          <li key={category} className="bg-white">
                            <button
                              type="button"
                              onClick={() => toggleCategory(category)}
                              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                            >
                              <span className="flex items-center gap-3 text-sm font-semibold text-slate-900">
                                <span>
                                  {getCategoryLabel(category)} ({categoryTotal})
                                </span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    downloadCategoryReportPdf({
                                      stateId,
                                      acNo,
                                      acName,
                                      lang,
                                      categoryLabel: getCategoryLabel(category),
                                      rows: categoryRows,
                                    })
                                  }}
                                  className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                                >
                                  Get Report
                                </button>
                              </span>
                              <span className="text-xs text-slate-500">{categoryCollapsed ? '▸' : '▾'}</span>
                            </button>
                            {!categoryCollapsed && (
                              <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/40">
                                {countGroups.map((countGroup) => {
                                  const countKey = `${category}::${countGroup.count}`
                                  const countCollapsed = collapsedCountGroups.includes(countKey)
                                  return (
                                    <li key={`${category}-${countGroup.count}`} className="bg-white">
                                      <button
                                        type="button"
                                        onClick={() => toggleCountGroup(countKey)}
                                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                                      >
                                        <span className="text-sm font-semibold text-slate-900">
                                          {countGroup.count} {boothLabel} ({countGroup.sections.length})
                                        </span>
                                        <span className="text-xs text-slate-500">{countCollapsed ? '▸' : '▾'}</span>
                                      </button>
                                      {!countCollapsed && (
                                        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/30">
                                          {countGroup.sections.map((group) => {
                                            const sectionKey = `${category}::${group.section}`
                                            const sectionCollapsed = collapsedSections.includes(sectionKey)
                                            return (
                                              <li key={`${category}-${group.section}`} className="bg-white">
                                                <button
                                                  type="button"
                                                  onClick={() => toggleSection(sectionKey)}
                                                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                                                >
                                                  <span className="text-sm font-semibold text-slate-900">
                                                    {group.section} ({group.rows.length})
                                                  </span>
                                                  <span className="text-xs text-slate-500">{sectionCollapsed ? '▸' : '▾'}</span>
                                                </button>
                                                {!sectionCollapsed && (
                                                  <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/20">
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
                                                            <p className="text-sm font-semibold text-slate-900">
                                                              PS {row.polling_station_no}
                                                            </p>
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
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Voter Type</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedRow.all_voters_covered}</p>
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
