import { describe, expect, it } from 'vitest'
import { resolvePublicAssetPath } from './url'

describe('resolvePublicAssetPath', () => {
  it('prefixes root-relative paths with the app base path', () => {
    expect(resolvePublicAssetPath('/data/states.json', '/state-election/')).toBe(
      '/state-election/data/states.json',
    )
  })

  it('leaves absolute URLs unchanged', () => {
    expect(resolvePublicAssetPath('https://example.com/data.csv', '/state-election/')).toBe(
      'https://example.com/data.csv',
    )
  })

  it('resolves relative paths against the app base path', () => {
    expect(resolvePublicAssetPath('data/states/tn/electors.csv', '/state-election/')).toBe(
      '/state-election/data/states/tn/electors.csv',
    )
  })
})
