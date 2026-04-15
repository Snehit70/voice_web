import { distance as levenshteinDistance } from 'fastest-levenshtein'

export type MergeStrategy =
  | 'exact_match'
  | 'single_source'
  | 'normalized_match'
  | 'formatting_only'
  | 'minor_diff'
  | 'single_word_match'
  | 'llm'
  | 'llm_fallback'
  | 'empty'

export type MergeReason =
  | 'both_empty'
  | 'groq_only'
  | 'deepgram_only'
  | 'structured_formatting_cues'
  | 'exact_text_match'
  | 'case_whitespace_match'
  | 'punctuation_stripped_match'
  | 'diff_below_threshold'
  | 'diff_above_threshold'
  | 'single_word_close_match'
  | 'llm_succeeded'
  | 'llm_error_fallback'

export interface MergeResult {
  text: string
  strategy: MergeStrategy
  reason: MergeReason
  accuracy: {
    sourcesMatch: boolean
    editDistance: number
    confidence: number
  }
}

export interface GateDecision {
  strategy: MergeStrategy
  reason: MergeReason
  text?: string
}

const MINOR_DIFF_THRESHOLD = 0.12
const SINGLE_WORD_THRESHOLD = 0.2
const SINGLE_WORD_MIN_LENGTH = 6
const SINGLE_WORD_SHARED_EDGE_CHARS = 4
const ORDINAL_ENUMERATION_PATTERN =
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/g
const NUMBERED_ENUMERATION_PATTERN =
  /\b(step|item|point|issue|reason|problem|question|task|change|fix)\s+(one|two|three|four|five|first|second|third|fourth|fifth)\b/g
const LITERAL_SYMBOL_PATTERNS = [
  /\bopen\s+(?:curly\s+)?(?:brace|bracket)\b/i,
  /\bclose\s+(?:curly\s+)?(?:brace|bracket)\b/i,
  /\bopen\s+(?:square\s+)?bracket\b/i,
  /\bclose\s+(?:square\s+)?bracket\b/i,
  /\bopen\s+(?:paren|parenthesis)\b/i,
  /\bclose\s+(?:paren|parenthesis)\b/i,
  /\b(?:double|single)\s+quote\b/i,
  /\bopen\s+quote\b/i,
  /\bclose\s+quote\b/i,
  /\b(?:add|insert|put)\s+(?:a\s+)?(?:comma|semicolon|colon|slash|backslash|underscore|equals|arrow)\b/i,
  /\bcolon\s+(?:here|there|after|before)\b/i,
  /\bcomma\s+(?:here|there|after|before)\b/i,
  /\bsemicolon\s+(?:here|there|after|before)\b/i,
  /\bnew\s*line\b/i,
]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeCaseWhitespace(text: string): string {
  return normalizeWhitespace(text).toLowerCase()
}

function normalizePunctuation(text: string): string {
  return text
    .replace(/[.,!?;:'"()[\]{}\-–—/\\@#$%]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function countMatches(pattern: RegExp, text: string): number {
  return text.match(pattern)?.length ?? 0
}

function hasEnumerationCue(text: string): boolean {
  const normalized = normalizeCaseWhitespace(text)
  return (
    countMatches(ORDINAL_ENUMERATION_PATTERN, normalized) >= 2 ||
    countMatches(NUMBERED_ENUMERATION_PATTERN, normalized) >= 2
  )
}

function hasLiteralSymbolCue(text: string): boolean {
  return LITERAL_SYMBOL_PATTERNS.some((pattern) => pattern.test(text))
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length)
  let index = 0

  while (index < limit && a[index] === b[index]) {
    index++
  }

  return index
}

function commonSuffixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length)
  let index = 0

  while (index < limit && a[a.length - 1 - index] === b[b.length - 1 - index]) {
    index++
  }

  return index
}

function isConservativeSingleWordMatch(
  groqText: string,
  deepgramText: string,
  normalizedDistance: number
): boolean {
  const groqNormalized = normalizeCaseWhitespace(groqText)
  const deepgramNormalized = normalizeCaseWhitespace(deepgramText)
  const minLength = Math.min(groqNormalized.length, deepgramNormalized.length)

  if (minLength < SINGLE_WORD_MIN_LENGTH || normalizedDistance >= SINGLE_WORD_THRESHOLD) {
    return false
  }

  const sharedPrefix = commonPrefixLength(groqNormalized, deepgramNormalized)
  const sharedSuffix = commonSuffixLength(groqNormalized, deepgramNormalized)

  return (
    sharedPrefix >= SINGLE_WORD_SHARED_EDGE_CHARS ||
    sharedSuffix >= SINGLE_WORD_SHARED_EDGE_CHARS
  )
}

export function hasStructuredFormattingIntent(...texts: string[]): boolean {
  return texts.some((text) => hasEnumerationCue(text) || hasLiteralSymbolCue(text))
}

export function decideMerge(groqText: string, deepgramText: string): GateDecision {
  if (groqText === deepgramText) {
    return {
      strategy: 'exact_match',
      reason: 'exact_text_match',
      text: deepgramText,
    }
  }

  if (hasStructuredFormattingIntent(groqText, deepgramText)) {
    return {
      strategy: 'llm',
      reason: 'structured_formatting_cues',
    }
  }

  if (normalizeCaseWhitespace(groqText) === normalizeCaseWhitespace(deepgramText)) {
    return {
      strategy: 'normalized_match',
      reason: 'case_whitespace_match',
      text: deepgramText,
    }
  }

  if (normalizePunctuation(groqText) === normalizePunctuation(deepgramText)) {
    return {
      strategy: 'formatting_only',
      reason: 'punctuation_stripped_match',
      text: deepgramText,
    }
  }

  const maxLength = Math.max(groqText.length, deepgramText.length)
  const rawDistance = levenshteinDistance(groqText, deepgramText)
  const normalizedDistance = rawDistance / (maxLength || 1)
  const groqWordCount = groqText.trim().split(/\s+/).length
  const deepgramWordCount = deepgramText.trim().split(/\s+/).length

  if (normalizedDistance < MINOR_DIFF_THRESHOLD && groqWordCount === deepgramWordCount) {
    return {
      strategy: 'minor_diff',
      reason: 'diff_below_threshold',
      text: groqText,
    }
  }

  if (
    groqWordCount === 1 &&
    deepgramWordCount === 1 &&
    isConservativeSingleWordMatch(groqText, deepgramText, normalizedDistance)
  ) {
    return {
      strategy: 'single_word_match',
      reason: 'single_word_close_match',
      text: groqText,
    }
  }

  return {
    strategy: 'llm',
    reason: 'diff_above_threshold',
  }
}

export function buildGatedMergeResult(groqText: string, deepgramText: string, decision: GateDecision): MergeResult {
  const sourcesMatch = groqText.trim() === deepgramText.trim()
  const gatedText = decision.text || ''

  let distanceSource = groqText
  let distanceTarget = deepgramText

  if (decision.strategy === 'normalized_match') {
    distanceSource = normalizeCaseWhitespace(groqText)
    distanceTarget = normalizeCaseWhitespace(deepgramText)
  } else if (decision.strategy === 'formatting_only') {
    distanceSource = normalizePunctuation(groqText)
    distanceTarget = normalizePunctuation(deepgramText)
  }

  const distance = levenshteinDistance(distanceSource, distanceTarget)
  const maxLength = Math.max(distanceSource.length, distanceTarget.length) || 1
  const normalizedDistance = distance / maxLength

  return {
    text: gatedText,
    strategy: decision.strategy,
    reason: decision.reason,
    accuracy: {
      sourcesMatch,
      editDistance: Math.round(normalizedDistance * 100),
      confidence: Math.round(Math.max(0, 1 - normalizedDistance) * 100) / 100,
    },
  }
}

export function buildSingleSourceMergeResult(
  text: string,
  strategy: MergeStrategy,
  reason: MergeReason
): MergeResult {
  return {
    text,
    strategy,
    reason,
    accuracy: {
      sourcesMatch: false,
      editDistance: 0,
      confidence: text ? 0.5 : 0,
    },
  }
}
