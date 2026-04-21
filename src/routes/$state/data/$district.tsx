import { Link, Outlet, createFileRoute, notFound, useLocation } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowLeft, MapPinned } from 'lucide-react'
import { fetchStateConfig, stateExists, type AppConfig } from '../../../services/appConfig'
import { fetchElectorCsvRows, toInt } from '../../../services/electors'
import { buildTamilNaduConstituencyMapUrl, fetchAcDetailsPayload } from '../../../services/acDetails'

type DistrictAcRow = {
  district: string
  districtNo: number
  acNo: number
  acName: string
  acNameTa?: string
  acNameEn?: string
  pollingStations: number | null
  male: number
  female: number
  thirdGender: number
  totalVoters: number
}

type LoaderData = { config: AppConfig; rows: DistrictAcRow[]; districtNameTa: string }

export const Route = createFileRoute('/$state/data/$district')({
  loader: async ({ params }) => {
    if (!(await stateExists(params.state))) {
      throw notFound()
    }
    const config = await fetchStateConfig(params.state)
    const parsed = await fetchElectorCsvRows(config.elector_csv_path)

    const districtParam = decodeURIComponent(params.district).trim().toLowerCase()
    const rows: DistrictAcRow[] = parsed
      .filter((row) => row.district_name?.trim().toLowerCase() === districtParam)
      .map((row) => ({
        district: row.district_name,
        districtNo: toInt(row.district_no),
        acNo: toInt(row.ac_no),
        acName: row.ac_name,
        pollingStations: row.polling_stations?.trim() ? toInt(row.polling_stations) : null,
        male: toInt(row.male),
        female: toInt(row.female),
        thirdGender: toInt(row.third_gender),
        totalVoters: toInt(row.total),
      }))
      .sort((a, b) => a.acNo - b.acNo)

    let districtNameTa = ''
    try {
      const payload = await fetchAcDetailsPayload(params.state)
      const acDetails = payload.acs ?? []
      const districtMatch = (payload.districts ?? []).find(
        (d) => d.name_en.trim().toLowerCase() === districtParam,
      )
      districtNameTa = districtMatch?.name_ta ?? ''

      const metricsByAc = new Map(
        acDetails.map((item) => [
          item.ac_code,
          {
            pollingStations: item.polling_stations,
            male: item.male_voters,
            female: item.female_voters,
            thirdGender: item.thirdgender_voters,
            totalVoters: item.total_voters,
            acNameTa: item.name_ta,
            acNameEn: item.name_en,
          },
        ]),
      )

      for (const row of rows) {
        const metrics = metricsByAc.get(row.acNo)
        if (!metrics) continue
        row.pollingStations = Number.isFinite(metrics.pollingStations) ? metrics.pollingStations : row.pollingStations
        row.male = metrics.male
        row.female = metrics.female
        row.thirdGender = metrics.thirdGender
        row.totalVoters = metrics.totalVoters
        row.acNameTa = metrics.acNameTa || row.acName
        row.acNameEn = metrics.acNameEn || row.acName
      }
    } catch {
      // Continue with CSV values when state-level AC details are unavailable.
    }

    if (rows.length === 0) throw notFound()

    return { config, rows, districtNameTa } satisfies LoaderData
  },
  component: DistrictDetail,
})

function DistrictDetail() {
  const { config, rows, districtNameTa } = Route.useLoaderData()
  const location = useLocation()
  const isPollingStationsPage = /\/ac\d+\/ps\/(ta|en)\/?$/.test(location.pathname)
  const isAcDetailPage = /\/ac\d+\/?$/.test(location.pathname)
  const state = config.state_id
  const [lang, setLang] = useState<'ta' | 'en'>('en')
  const district = rows[0].district
  const totalVoters = rows.reduce((sum, row) => sum + row.totalVoters, 0)
  const totalMale = rows.reduce((sum, row) => sum + row.male, 0)
  const totalFemale = rows.reduce((sum, row) => sum + row.female, 0)
  const totalThirdGender = rows.reduce((sum, row) => sum + row.thirdGender, 0)
  const hasPollingStations = rows.some((row) => row.pollingStations !== null)
  const totalPollingStations = hasPollingStations
    ? rows.reduce((sum, row) => sum + (row.pollingStations ?? 0), 0).toLocaleString('en-IN')
    : 'NA'
  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.acNo - b.acNo), [rows])

  if (isPollingStationsPage || isAcDetailPage) {
    return <Outlet />
  }

  const labels =
    lang === 'ta'
      ? {
          headerTitle: districtNameTa || district,
          subtitle: `${districtNameTa || district} மாவட்டம் - சட்டமன்ற தொகுதிகள்`,
          acCount: 'சட்டமன்ற தொகுதிகள்',
          pollingStations: 'வாக்குச்சாவடி எண்ணிக்கை',
          male: 'ஆண்',
          female: 'பெண்',
          others: 'மூன்றாம் பாலினம்',
          total: 'மொத்த வாக்குகள்',
          psTa: 'PS தமிழ்',
          psEn: 'PS ஆங்கிலம்',
        }
      : {
          headerTitle: district,
          subtitle: `${config.ac_label}-wise information in ${district} ${config.district_label.toLowerCase()}`,
          acCount: `No. of ${config.ac_short_label}`,
          pollingStations: 'No. of Polling Stations',
          male: 'Male',
          female: 'Female',
          others: 'Third Gender',
          total: 'Total Votes',
          psTa: 'PS TA',
          psEn: 'PS EN',
        }

  return (
    <section className="space-y-6 select-none caret-transparent">
      <div className="flex items-start gap-3">
        <Link
          to="/$state/data"
          params={{ state }}
          className="mt-1 rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900">{labels.headerTitle}</h2>
          <p className="text-sm text-slate-600">{labels.subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
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
          label={labels.acCount}
          value={rows.length.toLocaleString('en-IN')}
        />
        <StatCard className="lg:col-span-2" label={labels.pollingStations} value={totalPollingStations} />
        <StatCard label={labels.male} value={totalMale.toLocaleString('en-IN')} />
        <StatCard label={labels.female} value={totalFemale.toLocaleString('en-IN')} />
        <StatCard label={labels.others} value={totalThirdGender.toLocaleString('en-IN')} />
        <StatCard label={labels.total} value={totalVoters.toLocaleString('en-IN')} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedRows.map((row, index) => {
          const badgeClass = CARD_BADGE_COLORS[index % CARD_BADGE_COLORS.length]
          const displayAcName = lang === 'ta' ? row.acNameTa || row.acName : row.acNameEn || row.acName
          const mapUrl = state === 'tn' ? buildTamilNaduConstituencyMapUrl(row.acNameEn || row.acName) : null
          return (
            <article key={`${row.districtNo}-${row.acNo}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className={`px-3 py-2 text-xs font-semibold text-white ${badgeClass}`}>
                AC {row.acNo}
              </div>
              <div className="space-y-3 p-4">
                <Link
                  to="/$state/data/$district/$acCode"
                  params={{ state, district, acCode: `ac${row.acNo}` }}
                  className="text-lg font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                >
                  {displayAcName}
                </Link>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {mapUrl ? (
                    <img src={mapUrl} alt={displayAcName} className="h-28 w-full object-contain" />
                  ) : (
                    <div className="flex h-28 items-center justify-center text-slate-500">
                      <MapPinned size={36} />
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.pollingStations}</p>
                  <p className="mt-1 text-3xl font-extrabold text-slate-900">{(row.pollingStations ?? 0).toLocaleString('en-IN')}</p>
                </div>

                {(() => {
                  const malePct = row.totalVoters > 0 ? (row.male / row.totalVoters) * 100 : 0
                  const femalePct = row.totalVoters > 0 ? (row.female / row.totalVoters) * 100 : 0
                  const othersPct = row.totalVoters > 0 ? (row.thirdGender / row.totalVoters) * 100 : 0
                  return (
                    <div className="space-y-2">
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="flex h-full">
                          <div className="bg-blue-600" style={{ width: `${malePct}%` }} />
                          <div className="bg-pink-600" style={{ width: `${femalePct}%` }} />
                          <div className="bg-violet-600" style={{ width: `${othersPct}%` }} />
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">
                        {labels.male}: {row.male.toLocaleString('en-IN')} | {labels.female}: {row.female.toLocaleString('en-IN')} |{' '}
                        {labels.others}: {row.thirdGender.toLocaleString('en-IN')}
                      </p>
                      <p className="text-2xl font-extrabold text-slate-900">
                        {labels.total}: {row.totalVoters.toLocaleString('en-IN')}
                      </p>
                    </div>
                  )
                })()}

                <div className="flex items-center gap-3 pt-1">
                  <Link
                    to="/$state/data/$district/$acCode/ps/$lang"
                    params={{ state, district, acCode: `ac${row.acNo}`, lang: 'ta' }}
                    className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {labels.psTa}
                  </Link>
                  <Link
                    to="/$state/data/$district/$acCode/ps/$lang"
                    params={{ state, district, acCode: `ac${row.acNo}`, lang: 'en' }}
                    className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {labels.psEn}
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

const CARD_BADGE_COLORS = ['bg-blue-700', 'bg-emerald-700', 'bg-amber-700', 'bg-rose-700', 'bg-indigo-700', 'bg-teal-700']

function StatCard({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
