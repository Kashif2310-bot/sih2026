import { describe, expect, it } from 'vitest'
import { translationResources } from '../i18n'

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') return flattenKeys(v, path)
    return [path]
  })
}

describe('i18n EN/KN key parity', () => {
  it('has identical key trees for en and kn', () => {
    const en = flattenKeys(translationResources.en.translation).sort()
    const kn = flattenKeys(translationResources.kn.translation).sort()
    expect(kn).toEqual(en)
  })
})
