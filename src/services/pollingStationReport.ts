import { jsPDF } from 'jspdf'
import type { PollingStationCsvRow, PollingStationLanguage } from './pollingStations'
import { splitPartsCovered } from './pollingStationsView'
import { toInt } from './electors'

type DownloadCategoryReportPdfParams = {
  stateId: string
  acNo: number
  acName: string
  lang: PollingStationLanguage
  categoryLabel: string
  rows: PollingStationCsvRow[]
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }
    lines.push(current)
    current = words[i]
  }
  lines.push(current)
  return lines
}

function buildReportLines(params: DownloadCategoryReportPdfParams): string[] {
  const lines: string[] = [
    `${params.stateId.toUpperCase()} Election - Polling Station Report`,
    `AC ${params.acNo} - ${params.acName}`,
    `Language: ${params.lang.toUpperCase()}`,
    `Category: ${params.categoryLabel}`,
    '',
  ]

  const sortedRows = [...params.rows].sort((a, b) => {
    const bySection = (a.section ?? '').localeCompare(b.section ?? '', undefined, {
      sensitivity: 'base',
      numeric: true,
    })
    if (bySection !== 0) return bySection
    return toInt(a.polling_station_no) - toInt(b.polling_station_no)
  })

  let currentSection = ''
  for (const row of sortedRows) {
    const section = (row.section ?? '').trim() || 'Unsectioned'
    if (section !== currentSection) {
      lines.push(`Section: ${section}`)
      currentSection = section
    }

    lines.push(`PS ${row.polling_station_no}: ${row.polling_station_location}`)
    for (const part of splitPartsCovered(row.parts_covered)) {
      lines.push(`  - ${part}`)
    }
    lines.push(`  Voter Type: ${row.all_voters_covered}`)
    lines.push('')
  }

  return lines
}

export function downloadCategoryReportPdf(params: DownloadCategoryReportPdfParams): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const lines = buildReportLines(params)

  const canvasWidth = 1240
  const canvasHeight = 1754
  const marginX = 48
  const marginY = 58
  const lineHeight = 24
  const usableWidth = canvasWidth - marginX * 2
  const maxLinesPerPage = Math.floor((canvasHeight - marginY * 2) / lineHeight)

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas context unavailable for PDF generation')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.fillStyle = '#0f172a'
  ctx.font = '18px Arial, Noto Sans Tamil, sans-serif'

  const wrappedLines: string[] = []
  for (const line of lines) {
    wrappedLines.push(...wrapLine(ctx, line, usableWidth))
  }

  let pageStart = 0
  let pageNumber = 0
  while (pageStart < wrappedLines.length) {
    if (pageNumber > 0) {
      doc.addPage('a4', 'portrait')
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    ctx.fillStyle = '#0f172a'
    ctx.font = '18px Arial, Noto Sans Tamil, sans-serif'

    const pageLines = wrappedLines.slice(pageStart, pageStart + maxLinesPerPage)
    pageLines.forEach((line, index) => {
      const y = marginY + index * lineHeight
      ctx.fillText(line, marginX, y)
    })

    const image = canvas.toDataURL('image/jpeg', 0.92)
    doc.addImage(image, 'JPEG', 0, 0, 210, 297)
    pageStart += maxLinesPerPage
    pageNumber += 1
  }

  const fileName = `${sanitizeFilePart(params.stateId)}_ac${params.acNo}_${params.lang}_${sanitizeFilePart(params.categoryLabel)}.pdf`
  doc.save(fileName)
}
