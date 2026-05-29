import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, X } from 'lucide-react'
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
import { fetchAcResult, computePollingStationResults, type PollingStationResult } from '../../../../../services/resultData'

type CandidateResultInfo = {
  name: string
  party: string
  totalSecuredVotes: number
  winner: boolean
  margin: number | null
}

type LoaderData = {
  stateId: string
  district: string
  acNo: number
  acName: string
  acDetail: AcDetail
  psResults: PollingStationResult[]
  resultCandidates: CandidateResultInfo[]
  resultTotalVotes: number
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

    const resultData = await fetchAcResult(config.state_id, acNo)
    const psResults = resultData ? computePollingStationResults(resultData) : []
    const resultCandidates: CandidateResultInfo[] = resultData
      ? resultData.assembly_constituency.candidates.map((c) => ({
          name: c.name,
          party: c.party,
          totalSecuredVotes: c.total_secured_votes,
          winner: c.winner,
          margin: c.margin,
        }))
      : []
    const resultTotalVotes = resultData?.assembly_constituency.stats.total_votes ?? 0

    return {
      stateId: config.state_id,
      district: acRow.district_name,
      acNo,
      acName: acRow.ac_name,
      acDetail,
      psResults,
      resultCandidates,
      resultTotalVotes,
    } satisfies LoaderData
  },
  component: AcDetailPage,
})

function AcDetailPage() {
  const { stateId, district, acNo, acName, acDetail, psResults, resultCandidates, resultTotalVotes } = Route.useLoaderData()
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
          result: 'பகுப்பாய்வு',
          party: 'கட்சி',
          resultBlank: 'பகுப்பாய்வு தகவல் பின்னர் புதுப்பிக்கப்படும்.',
          voteDetails: 'வாக்காளர் விவரங்கள்',
          totalVotes: 'மொத்த வாக்குகள்',
          votes: 'வாக்குகள்',
          lead: 'முன்னிலை',
          ps: 'வாக்குச்சாவடி',
          margin: 'வெற்றி வித்தியாசம்',
        }
      : {
          titlePrefix: 'Assembly Constituency',
          contestants: 'Contestants',
          result: 'Analysis',
          party: 'Party',
          resultBlank: 'Analysis data will be updated later.',
          voteDetails: 'Vote Details',
          totalVotes: 'Total Votes',
          votes: 'Votes',
          lead: 'Lead',
          ps: 'Polling Station',
          margin: 'Margin',
        }

  const resultByName = useMemo(() => {
    const map = new Map<string, CandidateResultInfo>()
    for (const c of resultCandidates) {
      map.set(c.name.trim().toLowerCase(), c)
    }
    return map
  }, [resultCandidates])

  const topCandidates = useMemo(() => {
    return [...acDetail.candidates]
      .sort((a, b) => a.sl_no - b.sl_no)
      .map((candidate) => {
        const key = (candidate.name_en ?? '').trim().toLowerCase()
        const resultInfo = resultByName.get(key)
        const votePct =
          resultInfo && resultTotalVotes > 0
            ? (resultInfo.totalSecuredVotes * 100) / resultTotalVotes
            : null
        return {
          ...candidate,
          photoUrl: getCandidatePhotoUrl(stateId, candidate),
          symbolUrl: getElectionSymbolImageUrl(candidate.symbol_en),
          totalSecuredVotes: resultInfo?.totalSecuredVotes ?? null,
          votePct,
          winner: resultInfo?.winner ?? false,
          margin: resultInfo?.margin ?? null,
        }
      })
      .filter((candidate) => candidate.photoUrl)
      .slice(0, 4)
  }, [acDetail.candidates, stateId, resultByName, resultTotalVotes])

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
              marginLabel={labels.margin}
              lang={pageLang}
            />
          ))}
        </div>
      ) : psResults.length > 0 ? (
        <PollingStationResultsGrid psResults={psResults} labels={labels} />
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
  marginLabel,
  lang,
}: {
  candidate: AcCandidate & {
    photoUrl: string
    symbolUrl: string
    totalSecuredVotes: number | null
    votePct: number | null
    winner: boolean
    margin: number | null
  }
  partyLabel: string
  marginLabel: string
  lang: PageLang
}) {
  const name = lang === 'ta' ? candidate.name_ta || candidate.name_en : candidate.name_en || candidate.name_ta
  const party = lang === 'ta' ? candidate.party_ta || candidate.party_en : candidate.party_en || candidate.party_ta
  const alliance = candidate.alliance_ta || '-'
  const badgeClass = getAllianceBadgeClass(alliance)
  const borderClass = candidate.winner
    ? `border-4 ${getPartyBorderClass(candidate.party_en ?? '')}`
    : 'border border-slate-200'

  return (
    <article className={`overflow-hidden rounded-xl bg-white shadow-sm ${borderClass}`}>
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
        {candidate.totalSecuredVotes !== null && (
          <div className="pt-1 border-t border-slate-100 space-y-1 text-center">
            <p className="text-sm font-bold text-slate-900">
              {candidate.totalSecuredVotes.toLocaleString('en-IN')}
              {candidate.votePct !== null && (
                <span className="ml-1.5 text-xs font-medium text-slate-500">
                  ({candidate.votePct.toFixed(1)}%)
                </span>
              )}
            </p>
            {candidate.winner && candidate.margin !== null && (
              <p className="text-xs font-semibold text-emerald-700">
                {marginLabel}: {candidate.margin.toLocaleString('en-IN')}
              </p>
            )}
          </div>
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

function getPartyBorderClass(party: string): string {
  const p = party.toLowerCase()
  if (p.includes('dravida munnetra kazhagam') && !p.includes('anna')) return 'border-red-800'
  if (p.includes('anna dravida') || p.includes('aiadmk') || p.includes('admk')) return 'border-green-700'
  if (p.includes('naam tamilar') || p.includes('nam tamilar') || p.includes('ntk')) return 'border-blue-700'
  if (p.includes('bharatiya janata') || p.includes('bjp')) return 'border-orange-600'
  if (p.includes('indian national congress') || p.includes('inc') || p.includes('congress')) return 'border-blue-500'
  if (p.includes('communist party') || p.includes('cpm') || p.includes('cpi')) return 'border-red-600'
  return 'border-amber-600'
}

function getPartyColorClass(party: string): string {
  const p = party.toLowerCase()
  if (p.includes('dravida munnetra kazhagam') && !p.includes('anna')) return 'bg-red-800'
  if (p.includes('anna dravida') || p.includes('aiadmk') || p.includes('admk')) return 'bg-green-700'
  if (p.includes('naam tamilar') || p.includes('nam tamilar') || p.includes('ntk')) return 'bg-blue-700'
  if (p.includes('bharatiya janata') || p.includes('bjp')) return 'bg-orange-600'
  if (p.includes('indian national congress') || p.includes('inc') || p.includes('congress')) return 'bg-blue-500'
  if (p.includes('communist party') || p.includes('cpm') || p.includes('cpi')) return 'bg-red-600'
  return 'bg-amber-600'
}

type ResultLabels = {
  totalVotes: string
  votes: string
  lead: string
  ps: string
}

function PollingStationResultsGrid({
  psResults,
  labels,
}: {
  psResults: PollingStationResult[]
  labels: ResultLabels
}) {
  const [selectedPs, setSelectedPs] = useState<PollingStationResult | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {psResults.map((ps) => (
          <PollingStationCard key={ps.psNo} ps={ps} labels={labels} onOpen={() => setSelectedPs(ps)} />
        ))}
      </div>
      {selectedPs && (
        <PollingStationModal ps={selectedPs} labels={labels} onClose={() => setSelectedPs(null)} />
      )}
    </>
  )
}

function PollingStationCard({
  ps,
  labels,
  onOpen,
}: {
  ps: PollingStationResult
  labels: ResultLabels
  onOpen: () => void
}) {
  const lead = ps.candidates[0]
  const leadColorClass = lead ? getPartyColorClass(lead.party) : 'bg-amber-600'

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className={`px-3 py-1.5 text-xs font-semibold text-white ${leadColorClass}`}>
          {labels.ps} {ps.psNo}
        </div>
        <div className="p-3 space-y-2">
          <p className="text-xs text-slate-500 leading-snug line-clamp-2">{ps.psName}</p>
          {lead ? (
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-slate-900 leading-tight">{lead.name}</p>
              <p className="text-xs text-slate-500 truncate">{lead.party}</p>
              <div className="flex items-center justify-between pt-1">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white ${leadColorClass}`}>
                  {labels.lead}
                </span>
                <span className="text-sm font-bold text-slate-800">{lead.votes.toLocaleString('en-IN')}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">—</p>
          )}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>{labels.totalVotes}</span>
            <span className="font-semibold text-slate-700">{ps.totalVotes.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </button>
    </article>
  )
}

function PollingStationModal({
  ps,
  labels,
  onClose,
}: {
  ps: PollingStationResult
  labels: ResultLabels
  onClose: () => void
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh]">
        <div className={`flex items-start justify-between px-4 py-3 rounded-t-2xl ${ps.candidates[0] ? getPartyColorClass(ps.candidates[0].party) : 'bg-amber-600'}`}>
          <div>
            <p className="text-xs font-semibold text-white/80">{labels.ps} {ps.psNo}</p>
            <p className="text-sm font-bold text-white leading-snug mt-0.5">{ps.psName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 mt-0.5 shrink-0 rounded-full p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">{labels.totalVotes}</span>
          <span className="text-sm font-bold text-slate-800">{ps.totalVotes.toLocaleString('en-IN')}</span>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {ps.candidates.map((c, i) => {
            const pct = ps.totalVotes > 0 ? (c.votes / ps.totalVotes) * 100 : 0
            const barColor = getPartyColorClass(c.party)
            return (
              <div key={`${c.name}-${i}`} className={`rounded-xl border p-3 space-y-2 ${c.isLead ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm leading-tight ${c.isLead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                      {c.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.party}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-slate-900">{c.votes.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-400">{pct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${barColor}`}
                    style={{ width: `${Math.max(1, pct)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
