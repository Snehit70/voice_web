import { getConfig } from './config'

const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'vs',
  'etc',
  'fig',
  'eg',
  'ie',
  'st',
])

const HALLUCINATED_PHRASES = [
  'Thank you\\.',
  'Thanks for watching!?',
  'Thank you for watching\\.',
  '\\(dramatic music\\)',
  '\\(static\\)',
  '\\(upbeat music\\)',
  '\\(soft music\\)',
  'Subtitles by the Amara\\.org community',
  'Subtitles by the Amara\\. Org community',
  'Amara\\.org',
  'Subtitles by',
]

const COMPILED_HALLUCINATIONS = new RegExp(
  `(${HALLUCINATED_PHRASES.join('|')})`,
  'gi'
)

export function stripHallucinations(text: string): string {
  if (!text) return text
  
  text = text.replace(COMPILED_HALLUCINATIONS, '')
  return text.trim()
}

const GRAMMAR_FIXES: Array<[string, string]> = [
  ['\\bi\\b', 'I'],
  ['\\bi m\\b', "I'm"],
  ['\\bi ve\\b', "I've"],
  ['\\bi ll\\b', "I'll"],
  ['\\bi d\\b', "I'd"],
  ['\\bwont\\b', "won't"],
  ['\\bdont\\b', "don't"],
  ['\\bcant\\b', "can't"],
  ['\\bwouldnt\\b', "wouldn't"],
  ['\\bcouldnt\\b', "couldn't"],
  ['\\bshouldnt\\b', "shouldn't"],
  ['\\bdidnt\\b', "didn't"],
  ['\\bisnt\\b', "isn't"],
  ['\\barent\\b', "aren't"],
  ['\\bwasnt\\b', "wasn't"],
  ['\\bwerent\\b', "weren't"],
  ['\\bhasnt\\b', "hasn't"],
  ['\\bhavent\\b', "haven't"],
  ['\\bhadnt\\b', "hadn't"],
  ['\\bits\\b(?!\\s+(?:own|self))', "it's"],
  ['\\bthats\\b', "that's"],
  ['\\bwhats\\b', "what's"],
  ['\\bheres\\b', "here's"],
  ['\\btheres\\b', "there's"],
  ['\\blets\\b', "let's"],
  ['\\bgonna\\b', 'going to'],
  ['\\bwanna\\b', 'want to'],
  ['\\bgotta\\b', 'got to'],
  ['\\bonly\\s+na\\b', ''],
  ['\\bactually\\s+', ''],
  ['\\bbasically\\s+', ''],
  ['\\bG\\s*i\\s*t\\s*H\\s*u\\s*b\\b', 'GitHub'],
  ['\\btype\\s*script\\b', 'TypeScript'],
  ['\\bjava\\s*script\\b', 'JavaScript'],
  ['\\bfast\\s*api\\b', 'FastAPI'],
  ['\\bsupabase\\b', 'Supabase'],
  ['\\bpython\\b', 'Python'],
]

const COMPILED_GRAMMAR_FIXES: Array<[RegExp, string]> = GRAMMAR_FIXES.map(
  ([pattern, replacement]) => [new RegExp(pattern, 'gi'), replacement]
)

export function applyGrammarFixes(text: string): string {
  if (!text) return text
  
  for (const [pattern, replacement] of COMPILED_GRAMMAR_FIXES) {
    text = text.replace(pattern, replacement)
  }
  
  return text
}

export function applyPunctuation(text: string): string {
  const config = getConfig()
  
  if (!config.punctuation.enabled) {
    return text
  }
  
  const mappings = config.punctuation.mappings
  if (!mappings || mappings.length === 0) {
    return text
  }
  
  const sortedMappings = [...mappings].sort((a, b) => b[0].length - a[0].length)
  const mappingDict = new Map(
    sortedMappings.map(([k, v]) => [k.toLowerCase(), v])
  )
  
  const patternStr = sortedMappings
    .map(([k]) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const pattern = new RegExp(`\\b(${patternStr})\\b`, 'gi')
  
  return text.replace(pattern, (match) => {
    const key = match.toLowerCase()
    const val = mappingDict.get(key)
    return val !== undefined ? val : match
  })
}

export function smartPunctuation(text: string): string {
  if (!text) return text
  
  text = text.replace(/\.\.\./g, '…')
  text = text.replace(/ -- /g, ' — ')
  
  return text
}

export function cleanupText(text: string): string {
  if (!text) return ''
  
  text = text.trim()
  text = text.replace(/\s+/g, ' ')
  text = text.replace(/\s+([.,!?;:])/g, '$1')
  text = text.replace(/([.,!?;:])(?=[a-zA-Z])/g, '$1 ')
  
  text = text.replace(/(\b\w+)([.!?]\s+)([a-z])/g, (match, word, punctSpace, letter) => {
    if (ABBREVIATIONS.has(word.toLowerCase())) {
      return `${word}${punctSpace}${letter}`
    }
    return `${word}${punctSpace}${letter.toUpperCase()}`
  })
  
  if (text && text[0] && text[0].toLowerCase() === text[0] && /[a-z]/.test(text[0])) {
    text = text[0].toUpperCase() + text.slice(1)
  }
  
  return text
}

export function process(text: string): string {
  text = stripHallucinations(text)
  text = applyGrammarFixes(text)
  text = applyPunctuation(text)
  text = cleanupText(text)
  text = smartPunctuation(text)
  return text
}
