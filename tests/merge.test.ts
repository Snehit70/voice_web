import { describe, expect, it } from 'vitest'
import {
  buildGatedMergeResult,
  decideMerge,
  hasStructuredFormattingIntent,
} from '../server/utils/merge'

describe('decideMerge', () => {
  it('returns exact_match for identical text', () => {
    const result = decideMerge('hello world', 'hello world')
    expect(result.strategy).toBe('exact_match')
    expect(result.reason).toBe('exact_text_match')
    expect(result.text).toBe('hello world')
  })

  it('prefers deepgram formatting for case-only differences', () => {
    const result = decideMerge('Hello World', 'hello world')
    expect(result.strategy).toBe('normalized_match')
    expect(result.text).toBe('hello world')
  })

  it('prefers deepgram formatting for punctuation-only differences', () => {
    const result = decideMerge('hello world', 'hello world!')
    expect(result.strategy).toBe('formatting_only')
    expect(result.text).toBe('hello world!')
  })

  it('keeps Groq wording for small technical token diffs', () => {
    const result = decideMerge('update config path', 'update konfig path')
    expect(result.strategy).toBe('minor_diff')
    expect(result.text).toBe('update config path')
  })

  it('prefers exact matches before structured-formatting heuristics', () => {
    const result = decideMerge('open curly bracket foo colon bar', 'open curly bracket foo colon bar')
    expect(result.strategy).toBe('exact_match')
    expect(result.reason).toBe('exact_text_match')
  })

  it('routes meaningful disagreement to the llm', () => {
    const result = decideMerge('the cat sat on the mat', 'the dog sat on the mat')
    expect(result.strategy).toBe('llm')
    expect(result.reason).toBe('diff_above_threshold')
    expect(result.text).toBeUndefined()
  })

  it('routes split proper nouns to the llm', () => {
    const result = decideMerge('set up the Hyprland config', 'set up the hyper land config')
    expect(result.strategy).toBe('llm')
    expect(result.reason).toBe('diff_above_threshold')
  })

  it('uses single-word conservative correction for technical terms', () => {
    const result = decideMerge('config', 'konfig')
    expect(result.strategy).toBe('single_word_match')
    expect(result.text).toBe('config')
  })

  it('routes literal symbol dictation to the llm', () => {
    const result = decideMerge('open curly bracket foo colon bar', 'open curly brace foo colon bar')
    expect(result.strategy).toBe('llm')
    expect(result.reason).toBe('structured_formatting_cues')
  })
})

describe('hasStructuredFormattingIntent', () => {
  it('detects enumerated issue phrasing', () => {
    expect(
      hasStructuredFormattingIntent('the first issue is config and the second issue is auth')
    ).toBe(true)
  })

  it('does not flag ordinary prose', () => {
    expect(
      hasStructuredFormattingIntent('we should update the config path later')
    ).toBe(false)
  })
})

describe('buildGatedMergeResult', () => {
  it('preserves provider disagreement metrics for minor diffs', () => {
    const decision = decideMerge('update config path', 'update konfig path')
    const result = buildGatedMergeResult('update config path', 'update konfig path', decision)

    expect(result.strategy).toBe('minor_diff')
    expect(result.accuracy.editDistance).toBeGreaterThan(0)
    expect(result.accuracy.confidence).toBeLessThan(1)
  })
})
