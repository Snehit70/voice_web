import { describe, expect, it } from 'vitest'
import {
  applyGrammarFixes,
  applyPunctuation,
  cleanupText,
  process,
  stripHallucinations,
} from '../server/utils/postprocess'

Object.assign(globalThis, {
  useRuntimeConfig: () => ({
    groqApiKey: '',
    deepgramApiKey: '',
  }),
})

describe('stripHallucinations', () => {
  it('removes known subtitle and music artifacts', () => {
    expect(stripHallucinations('Thank you for watching. (dramatic music)')).toBe('')
  })
})

describe('applyGrammarFixes', () => {
  it('normalizes common contractions and product names', () => {
    expect(applyGrammarFixes('i dont use java script with git hub')).toBe(
      "I don't use JavaScript with GitHub"
    )
  })
})

describe('applyPunctuation', () => {
  it('converts spoken punctuation cues into symbols', () => {
    expect(applyPunctuation('hello comma world question mark')).toBe('hello , world ?')
  })
})

describe('cleanupText', () => {
  it('normalizes whitespace and sentence capitalization', () => {
    expect(cleanupText('hello   world. this is fine')).toBe('Hello world. This is fine')
  })
})

describe('process', () => {
  it('runs the full cleanup pipeline', () => {
    expect(process('thank you for watching. i dont know comma but java script works')).toBe(
      "I don't know, but JavaScript works"
    )
  })
})
