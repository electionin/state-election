import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { fetchStateConfig, stateExists, type AppConfig } from '../../../services/appConfig'
import { fetchAllForm21eAcSummaries, getPartyColorClass, getPartyRowBgClass, type AcResultSummary } from '../../../services/resultData'

type SortColumn = 'acNo' | 'acName' | 'district' | 'winnerName' | 'winnerParty' | 'votePct' | 'margin'
type SortDirection = 'asc' | 'desc'
type LoaderData = { config: AppConfig; summaries: AcResultSummary[] }

const AC_NOS = Array.from({ length: 234 }, (_, i) => i + 1)

export const Route = createFileRoute('/$state/data/result')({
  loader: async ({ params }) => {
    if (!(await stateExists(params.state))) {
      throw notFound()
    }
    const config = await fetchStateConfig(params.state)
    const summaries = await fetchAllForm21eAcSummaries(config.state_id, AC_NOS)
    return { config, summaries } satisfies LoaderData
  },
  component: ResultDashboard,
})

function ResultDashboard() {
  const { config, summaries } = Route.useLoaderData()
  const state = config.state_id
  const [sortColumn, setSortColumn] = useState<SortColumn>('acNo')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortColumn(column)
    setSortDirection('asc')
  }

  const sorted = useMemo(() => {
    const rows = [...summaries]
    rows.sort((a, b) => {
      let result = 0
      if (sortColumn === 'acNo') result = a.acNo - b.acNo
      else if (sortColumn === 'acName') result = a.acName.localeCompare(b.acName)
      else if (sortColumn === 'district') result = a.districtName.localeCompare(b.districtName)
      else if (sortColumn === 'winnerName') result = (a.winnerName ?? '').localeCompare(b.winnerName ?? '')
      else if (sortColumn === 'winnerParty') result = (a.winnerParty ?? '').localeCompare(b.winnerParty ?? '')
      else if (sortColumn === 'votePct') result = (a.votePct ?? 0) - (b.votePct ?? 0)
      else if (sortColumn === 'margin') result = (a.margin ?? 0) - (b.margin ?? 0)
      return sortDirection === 'asc' ? result : -result
    })
    return rows
  }, [summaries, sortColumn, sortDirection])

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
          <h2 className="text-2xl font-bold text-slate-900">Election Results</h2>
          <p className="text-sm text-slate-600">All {summaries.length} constituencies — 2021 Assembly Election</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="w-10 px-4 py-3 text-right font-semibold text-slate-700">#</th>
                <SortableHeader align="right" label="AC #" active={sortColumn === 'acNo'} direction={sortDirection} onClick={() => handleSort('acNo')} />
                <SortableHeader align="left" label="Constituency" active={sortColumn === 'acName'} direction={sortDirection} onClick={() => handleSort('acName')} />
                <SortableHeader align="left" label="District" active={sortColumn === 'district'} direction={sortDirection} onClick={() => handleSort('district')} />
                <SortableHeader align="left" label="Winner" active={sortColumn === 'winnerName'} direction={sortDirection} onClick={() => handleSort('winnerName')} />
                <SortableHeader align="left" label="Party" active={sortColumn === 'winnerParty'} direction={sortDirection} onClick={() => handleSort('winnerParty')} />
                <SortableHeader align="right" label="Votes %" active={sortColumn === 'votePct'} direction={sortDirection} onClick={() => handleSort('votePct')} />
                <SortableHeader align="right" label="Margin" active={sortColumn === 'margin'} direction={sortDirection} onClick={() => handleSort('margin')} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, index) => {
                const rowBg = row.winnerParty ? getPartyRowBgClass(row.winnerParty) : ''
                const partyBadge = row.winnerParty ? getPartyColorClass(row.winnerParty) : 'bg-slate-500'
                return (
                  <tr key={row.acNo} className={`border-t border-slate-100 ${rowBg}`}>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-400 text-xs">{index + 1}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500">{row.acNo}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.acName}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.districtName}</td>
                    <td className="px-4 py-2.5 text-slate-900">{row.winnerName ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {row.winnerParty ? (
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold text-white ${partyBadge}`}>
                          {row.winnerParty}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                      {row.votePct != null ? `${row.votePct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                      {row.margin != null ? row.margin.toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
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
