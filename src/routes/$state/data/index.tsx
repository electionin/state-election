import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { fetchStateConfig, stateExists, type AppConfig } from '../../../services/appConfig'
import { fetchElectorCsvRows, toInt, type ElectorCsvRow } from '../../../services/electors'
import { fetchAcDetailsPayload } from '../../../services/acDetails'

type DistrictSummary = {
  district: string
  districtNo: number
  districtTa?: string
  acCount: number
  male: number
  female: number
  thirdGender: number
  totalVoters: number
}

type SortColumn = 'district' | 'acCount' | 'male' | 'female' | 'thirdGender' | 'totalVoters'
type SortDirection = 'asc' | 'desc'
type LoaderData = { config: AppConfig; districts: DistrictSummary[] }

function aggregateDistrictData(rows: ElectorCsvRow[]): DistrictSummary[] {
  const districtMap = new Map<
    string,
    { districtNo: number; acNos: Set<string>; male: number; female: number; thirdGender: number; totalVoters: number }
  >()

  for (const row of rows) {
    const district = row.district_name?.trim()
    if (!district) continue

    const record = districtMap.get(district) ?? {
      districtNo: toInt(row.district_no),
      acNos: new Set<string>(),
      male: 0,
      female: 0,
      thirdGender: 0,
      totalVoters: 0,
    }
    record.acNos.add(row.ac_no)
    record.male += toInt(row.male)
    record.female += toInt(row.female)
    record.thirdGender += toInt(row.third_gender)
    record.totalVoters += toInt(row.total)
    districtMap.set(district, record)
  }

  return Array.from(districtMap.entries())
    .map(([district, record]) => ({
      district,
      districtNo: record.districtNo,
      acCount: record.acNos.size,
      male: record.male,
      female: record.female,
      thirdGender: record.thirdGender,
      totalVoters: record.totalVoters,
    }))
    .sort((a, b) => a.district.localeCompare(b.district))
}

export const Route = createFileRoute('/$state/data/')({
  loader: async ({ params }) => {
    if (!(await stateExists(params.state))) {
      throw notFound()
    }
    const config = await fetchStateConfig(params.state)
    const rows = await fetchElectorCsvRows(config.elector_csv_path)
    const districts = aggregateDistrictData(rows)

    try {
      const payload = await fetchAcDetailsPayload(params.state)
      const districtByCode = new Map(payload.districts?.map((d) => [d.dcode, d]) ?? [])
      const byDistrictName = new Map(districts.map((d) => [d.district.trim().toLowerCase(), d]))

      const metricsByDistrict = new Map<
        string,
        { acCount: number; male: number; female: number; thirdGender: number; totalVoters: number; districtTa?: string }
      >()

      for (const ac of payload.acs ?? []) {
        const district = districtByCode.get(ac.dcode)
        if (!district) continue
        const key = district.name_en.trim().toLowerCase()
        const existing = metricsByDistrict.get(key) ?? {
          acCount: 0,
          male: 0,
          female: 0,
          thirdGender: 0,
          totalVoters: 0,
          districtTa: district.name_ta,
        }
        existing.acCount += 1
        existing.male += ac.male_voters
        existing.female += ac.female_voters
        existing.thirdGender += ac.thirdgender_voters
        existing.totalVoters += ac.total_voters
        if (!existing.districtTa) existing.districtTa = district.name_ta
        metricsByDistrict.set(key, existing)
      }

      for (const [key, metrics] of metricsByDistrict.entries()) {
        const row = byDistrictName.get(key)
        if (!row) continue
        row.acCount = metrics.acCount
        row.male = metrics.male
        row.female = metrics.female
        row.thirdGender = metrics.thirdGender
        row.totalVoters = metrics.totalVoters
        row.districtTa = metrics.districtTa
      }

      for (const row of districts) {
        const district = districtByCode.get(row.districtNo)
        if (district?.name_ta) {
          row.districtTa = district.name_ta
        }
      }
    } catch {
      // Keep CSV aggregates when DB-backed payload is unavailable.
    }

    return { config, districts } satisfies LoaderData
  },
  component: DataDashboard,
})

function DataDashboard() {
  const { config, districts } = Route.useLoaderData()
  const state = config.state_id
  const [lang, setLang] = useState<'ta' | 'en'>('en')
  const [sortColumn, setSortColumn] = useState<SortColumn>('district')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([])
  const selectedDistrictSet = useMemo(() => new Set(selectedDistricts), [selectedDistricts])

  const districtsForSummary = useMemo(() => {
    if (selectedDistricts.length === 0) return districts
    return districts.filter((district) => selectedDistrictSet.has(district.district))
  }, [districts, selectedDistrictSet, selectedDistricts.length])

  const totalVoters = districtsForSummary.reduce((sum, d) => sum + d.totalVoters, 0)
  const totalAc = districtsForSummary.reduce((sum, d) => sum + d.acCount, 0)
  const totalMale = districtsForSummary.reduce((sum, d) => sum + d.male, 0)
  const totalFemale = districtsForSummary.reduce((sum, d) => sum + d.female, 0)
  const totalThirdGender = districtsForSummary.reduce((sum, d) => sum + d.thirdGender, 0)

  const sortedDistricts = useMemo(() => {
    const rows = [...districts]
    rows.sort((a, b) => {
      let result = 0
      if (sortColumn === 'district') result = a.district.localeCompare(b.district)
      if (sortColumn === 'acCount') result = a.acCount - b.acCount
      if (sortColumn === 'male') result = a.male - b.male
      if (sortColumn === 'female') result = a.female - b.female
      if (sortColumn === 'thirdGender') result = a.thirdGender - b.thirdGender
      if (sortColumn === 'totalVoters') result = a.totalVoters - b.totalVoters
      return sortDirection === 'asc' ? result : -result
    })
    return rows
  }, [districts, sortColumn, sortDirection])

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortColumn(column)
    setSortDirection('asc')
  }

  const toggleDistrictSelection = (district: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(district) ? prev.filter((item) => item !== district) : [...prev, district],
    )
  }
  const allSelected = selectedDistricts.length === districts.length && districts.length > 0
  const toggleSelectAll = () => setSelectedDistricts(allSelected ? [] : districts.map((d) => d.district))
  const labels =
    lang === 'ta'
      ? {
          stateTitle: state === 'tn' ? 'தமிழ்நாடு' : config.state_name,
          subtitle: 'மாவட்ட வாரியாக வாக்காளர் விவரங்கள்',
          districts: selectedDistricts.length > 0 ? 'மாவட்டங்கள் (தேர்வு)' : 'மாவட்டங்கள்',
          acCount: 'சட்டமன்ற தொகுதிகள்',
          male: 'ஆண்',
          female: 'பெண்',
          thirdGender: 'மூன்றாம் பாலினம்',
          totalVoters: 'மொத்த வாக்குகள்',
        }
      : {
          stateTitle: config.state_name,
          subtitle: `Overview of ${config.district_label.toLowerCase()}-wise electors information`,
          districts: selectedDistricts.length > 0 ? 'Districts (Selected)' : 'Districts',
          acCount: `No. of ${config.ac_short_label}`,
          male: 'Male',
          female: 'Female',
          thirdGender: 'Third Gender',
          totalVoters: 'Total Voters',
        }

  return (
    <section className="space-y-6 select-none caret-transparent">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900">{labels.stateTitle}</h2>
          <p className="text-sm text-slate-600">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang('ta')}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${lang === 'ta' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            தமிழ்
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${lang === 'en' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            English
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          className="lg:col-span-2"
          label={labels.districts}
          value={districtsForSummary.length.toLocaleString('en-IN')}
        />
        <StatCard className="lg:col-span-2" label={labels.acCount} value={totalAc.toLocaleString('en-IN')} />
        <StatCard label={labels.male} value={totalMale.toLocaleString('en-IN')} />
        <StatCard label={labels.female} value={totalFemale.toLocaleString('en-IN')} />
        <StatCard label={labels.thirdGender} value={totalThirdGender.toLocaleString('en-IN')} />
        <StatCard label={labels.totalVoters} value={totalVoters.toLocaleString('en-IN')} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="w-12 px-4 py-3 text-center font-semibold">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={`Select all ${config.district_label.toLowerCase()}s`}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                  />
                </th>
                <SortableHeader
                  align="left"
                  label={lang === 'ta' ? 'மாவட்டம்' : config.district_label}
                  active={sortColumn === 'district'}
                  direction={sortDirection}
                  onClick={() => handleSort('district')}
                />
                <SortableHeader
                  align="right"
                  label={labels.acCount}
                  active={sortColumn === 'acCount'}
                  direction={sortDirection}
                  onClick={() => handleSort('acCount')}
                />
                <SortableHeader
                  align="right"
                  label={labels.male}
                  active={sortColumn === 'male'}
                  direction={sortDirection}
                  onClick={() => handleSort('male')}
                />
                <SortableHeader
                  align="right"
                  label={labels.female}
                  active={sortColumn === 'female'}
                  direction={sortDirection}
                  onClick={() => handleSort('female')}
                />
                <SortableHeader
                  align="right"
                  label={labels.thirdGender}
                  active={sortColumn === 'thirdGender'}
                  direction={sortDirection}
                  onClick={() => handleSort('thirdGender')}
                />
                <SortableHeader
                  align="right"
                  label={labels.totalVoters}
                  active={sortColumn === 'totalVoters'}
                  direction={sortDirection}
                  onClick={() => handleSort('totalVoters')}
                />
              </tr>
            </thead>
            <tbody>
              {sortedDistricts.map((row) => (
                <tr
                  key={row.district}
                  className={`border-t border-slate-100 hover:bg-slate-50/70 ${
                    selectedDistrictSet.has(row.district) ? 'font-semibold text-slate-900' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedDistrictSet.has(row.district)}
                      onChange={() => toggleDistrictSelection(row.district)}
                      aria-label={`Select ${row.district}`}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      to="/$state/data/$district"
                      params={{ state, district: row.district }}
                      className="text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      {lang === 'ta' ? row.districtTa || row.district : row.district}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.acCount.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.male.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.female.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.thirdGender.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.totalVoters.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function SortableHeader({
  label,
  active,
  direction,
  align,
  onClick,
}: {
  label: string
  active: boolean
  direction: SortDirection
  align: 'left' | 'right'
  onClick: () => void
}) {
  const alignClass = align === 'right' ? 'text-right' : 'text-left'
  const arrow = active ? (direction === 'asc' ? '↑' : '↓') : '↕'
  return (
    <th className={`px-4 py-3 ${alignClass} font-semibold`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 select-none caret-transparent"
      >
        <span>{label}</span>
        <span className="text-xs">{arrow}</span>
      </button>
    </th>
  )
}
