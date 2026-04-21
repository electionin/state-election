import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { fetchStateConfig, stateExists } from '../../../../../services/appConfig'
import { fetchElectorCsvRows, toInt } from '../../../../../services/electors'
import {
  buildTamilNaduAcRollMapUrl,
  buildTamilNaduConstituencyMapUrl,
  computeSexRatio,
  fetchAcDetails,
  findAcDetail,
  getCandidatePhotoUrl,
  getElectionSymbolImageUrl,
  type AcCandidate,
  type AcDetail,
} from '../../../../../services/acDetails'
import { parseAcCode } from '../../../../../services/pollingStations'

type LoaderData = {
  stateId: string
  district: string
  acNo: number
  acName: string
  acDetail: AcDetail
}

type PageTab = 'contestants' | 'result'
type PageLang = 'ta' | 'en'

export const Route = createFileRoute('/$state/data/$district/$acCode/')({
  loader: async ({ params }) => {
    if (!(await stateExists(params.state))) throw notFound()

    const acNo = parseAcCode(params.acCode)
    if (!acNo) throw notFound()

    const config = await fetchStateConfig(params.state)
    const districtParam = decodeURIComponent(params.district).trim().toLowerCase()
    const electorRows = await fetchElectorCsvRows(config.elector_csv_path)
    const districtRows = electorRows.filter((row) => row.district_name?.trim().toLowerCase() === districtParam)
    if (districtRows.length === 0) throw notFound()

    const acRow = districtRows.find((row) => toInt(row.ac_no) === acNo)
    if (!acRow) throw notFound()

    const allAcDetails = await fetchAcDetails(params.state)
    const acDetail = findAcDetail(allAcDetails, params.acCode)
    if (!acDetail) throw notFound()

    return {
      stateId: config.state_id,
      district: acRow.district_name,
      acNo,
      acName: acRow.ac_name,
      acDetail,
    } satisfies LoaderData
  },
  component: AcDetailPage,
})

function AcDetailPage() {
  const { stateId, district, acNo, acName, acDetail } = Route.useLoaderData()
  const [activeTab, setActiveTab] = useState<PageTab>('contestants')
  const [pageLang, setPageLang] = useState<PageLang>('ta')

  const mapUrl = buildTamilNaduConstituencyMapUrl(acDetail.name_en || acName)
  const rollMapUrl = buildTamilNaduAcRollMapUrl(acNo)
  const sexRatio = computeSexRatio(acDetail.male_voters, acDetail.female_voters)

  const labels =
    pageLang === 'ta'
      ? {
          titlePrefix: 'சட்டமன்ற தொகுதி',
          contestants: 'போட்டியாளர்கள்',
          result: 'முடிவு',
          party: 'கட்சி',
          resultBlank: 'முடிவு தகவல் பின்னர் புதுப்பிக்கப்படும்.',
          voteDetails: 'வாக்காளர் விவரங்கள்',
        }
      : {
          titlePrefix: 'Assembly Constituency',
          contestants: 'Contestants',
          result: 'Result',
          party: 'Party',
          resultBlank: 'Result data will be updated later.',
          voteDetails: 'Vote Details',
        }

  const topCandidates = useMemo(() => {
    const candidates = [...acDetail.candidates]
      .sort((a, b) => a.sl_no - b.sl_no)
      .map((candidate) => ({
        ...candidate,
        photoUrl: getCandidatePhotoUrl(stateId, candidate),
        symbolUrl: getElectionSymbolImageUrl(candidate.symbol_en),
      }))
      .filter((candidate) => candidate.photoUrl)
      .slice(0, 4)
    return candidates
  }, [acDetail.candidates, stateId])

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
          <h2 className="text-2xl font-bold text-slate-900">{`AC ${acNo} - ${pageLang === 'ta' ? acDetail.name_ta || acName : acDetail.name_en || acName}`}</h2>
          <p className="text-sm text-slate-600">{labels.titlePrefix}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPageLang('ta')}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${pageLang === 'ta' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          தமிழ்
        </button>
        <button
          type="button"
          onClick={() => setPageLang('en')}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${pageLang === 'en' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          English
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <a href={rollMapUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
          <img src={mapUrl} alt={acDetail.name_en} className="h-[340px] w-full rounded-md border border-slate-200 object-contain bg-slate-50" />
        </a>
        <VoteStatsCard
          title={labels.voteDetails}
          male={acDetail.male_voters}
          female={acDetail.female_voters}
          thirdGender={acDetail.thirdgender_voters}
          total={acDetail.total_voters}
          sexRatio={sexRatio}
          lang={pageLang}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('contestants')}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${activeTab === 'contestants' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {labels.contestants}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('result')}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${activeTab === 'result' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {labels.result}
        </button>
      </div>

      {activeTab === 'contestants' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {topCandidates.map((candidate) => (
            <CandidateCard
              key={`${candidate.sl_no}-${candidate.name_en}`}
              candidate={candidate}
              partyLabel={labels.party}
              lang={pageLang}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">{labels.resultBlank}</p>
        </div>
      )}
    </section>
  )
}

function VoteStatsCard({
  title,
  male,
  female,
  thirdGender,
  total,
  sexRatio,
  lang,
}: {
  title: string
  male: number
  female: number
  thirdGender: number
  total: number
  sexRatio: number
  lang: PageLang
}) {
  const rows = [
    { label: lang === 'ta' ? 'ஆண்' : 'Male', value: male, max: total, color: 'bg-sky-600' },
    { label: lang === 'ta' ? 'பெண்' : 'Female', value: female, max: total, color: 'bg-emerald-600' },
    { label: lang === 'ta' ? 'மூன்றாம் பாலினம்' : 'Third Gender', value: thirdGender, max: total, color: 'bg-violet-600' },
    { label: lang === 'ta' ? 'மொத்தம்' : 'Total', value: total, max: total, color: 'bg-slate-700' },
    { label: lang === 'ta' ? 'பாலின விகிதம்' : 'Sex Ratio', value: Number(sexRatio.toFixed(2)), max: 1200, color: 'bg-amber-600' },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">{title}</h3>
      <div className="space-y-3">
        {rows.map((row) => {
          const width = row.max > 0 ? Math.max(2, Math.min(100, (row.value / row.max) * 100)) : 0
          return (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{row.label}</span>
                <span className="font-semibold text-slate-900">{row.value.toLocaleString('en-IN')}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-200">
                <div className={`h-2.5 rounded-full ${row.color}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CandidateCard({
  candidate,
  partyLabel,
  lang,
}: {
  candidate: AcCandidate & { photoUrl: string; symbolUrl: string }
  partyLabel: string
  lang: PageLang
}) {
  const name = lang === 'ta' ? candidate.name_ta || candidate.name_en : candidate.name_en || candidate.name_ta
  const party = lang === 'ta' ? candidate.party_ta || candidate.party_en : candidate.party_en || candidate.party_ta
  const alliance = candidate.alliance_ta || '-'
  const badgeClass = getAllianceBadgeClass(alliance)

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`px-3 py-2 text-center text-xs font-bold tracking-wide text-white ${badgeClass}`}>{alliance}</div>
      <img src={candidate.photoUrl} alt={name} className="h-56 w-full object-cover bg-slate-100" />
      <div className="space-y-2 p-3">
        <p className="text-center text-base font-semibold text-slate-900">{name}</p>
        <p className="text-center text-sm text-slate-600">{`(${partyLabel}: ${party || '-'})`}</p>
        {candidate.symbolUrl ? (
          <img src={candidate.symbolUrl} alt={candidate.symbol_en} className="mx-auto h-12 w-12 object-contain" />
        ) : (
          <p className="text-center text-xs text-slate-500">{candidate.symbol_en || '-'}</p>
        )}
      </div>
    </article>
  )
}

function getAllianceBadgeClass(allianceTa: string): string {
  const text = allianceTa.toLowerCase().replace(/\s+/g, '')
  if (text.includes('அஇஅதிமுக') || text.includes('அதிமுக')) return 'bg-green-700'
  if (text.startsWith('திமுக') || text.includes('தி.மு.க')) return 'bg-red-800'
  if (text.includes('நாம்தமிழர்')) return 'bg-blue-700'
  if (text.includes('த.வெ.க')) return 'bg-yellow-700'
  return 'bg-slate-700'
}
