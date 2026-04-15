const BASE_TRANSCRIPTION_PROMPT = [
  'Technical English dictation about software development, Linux, and AI.',
  'Preserve commands, filenames, acronyms, project names, and code terms exactly.',
  'When the speaker clearly dictates structure, prefer literal symbols for braces, brackets, parentheses, colons, commas, quotes, and slashes.',
  'Preserve numbered list cues like first, second, and third when spoken.',
].join(' ')

const MAX_DEEPGRAM_KEYTERMS = 100

function normalizeBoostWord(word: string): string {
  return word.trim().replace(/\s+/g, ' ')
}

export function sanitizeDeepgramKeyterms(boostWords: string[]): string[] {
  const seen = new Set<string>()
  const keyterms: string[] = []

  for (const rawWord of boostWords) {
    const word = normalizeBoostWord(rawWord)
    if (!word) continue

    const dedupeKey = word.toLowerCase()
    if (seen.has(dedupeKey)) continue

    seen.add(dedupeKey)
    keyterms.push(word)

    if (keyterms.length >= MAX_DEEPGRAM_KEYTERMS) {
      break
    }
  }

  return keyterms
}

export function getTranscriptionPrompt(boostWords: string[] = []): string {
  const sanitizedWords = sanitizeDeepgramKeyterms(boostWords)

  if (sanitizedWords.length === 0) {
    return BASE_TRANSCRIPTION_PROMPT
  }

  return `${BASE_TRANSCRIPTION_PROMPT} Prefer these terms: ${sanitizedWords.join(', ')}.`
}
