const ABSOLUTE_SCHEME_RE = /^[a-z][a-z\d+\-.]*:/i

function normalizeBasePath(basePath: string): string {
  const trimmed = (basePath || '/').trim()
  if (!trimmed || trimmed === '/') return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export function resolvePublicAssetPath(path: string, basePath: string = '/'): string {
  const input = (path || '').trim()
  if (!input) return normalizeBasePath(basePath)
  if (ABSOLUTE_SCHEME_RE.test(input) || input.startsWith('//')) return input

  const normalizedBase = normalizeBasePath(basePath)
  const basePrefix = normalizedBase === '/' ? '' : normalizedBase.slice(0, -1)

  if (input.startsWith('/')) {
    return `${basePrefix}${input}`
  }

  return `${normalizedBase}${input}`.replace(/\/{2,}/g, '/')
}

export function getAppBasePath(): string {
  return (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
}
