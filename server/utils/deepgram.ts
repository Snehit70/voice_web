import { readFile } from 'fs/promises'
import { ofetch } from 'ofetch'
import consola from 'consola'
import type { DeepgramConfig } from './config'
import { sanitizeDeepgramKeyterms } from './vocabulary'

export class DeepgramTranscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeepgramTranscriptionError'
  }
}

export class DeepgramTranscriber {
  private config: DeepgramConfig

  constructor(config: DeepgramConfig) {
    this.config = config
  }

  get isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiKey
  }

  async transcribe(audioPath: string, customKeywords: string[] = []): Promise<string> {
    if (!this.isAvailable) {
      throw new DeepgramTranscriptionError('Deepgram API key not configured')
    }

    const url = 'https://api.deepgram.com/v1/listen'

    const params = new URLSearchParams([
      ['model', this.config.model],
      ['smart_format', 'true'],
      ['punctuate', 'true'],
      ['paragraphs', 'true'],
      ['utterances', 'true'],
      ['dictation', 'true'],
      ['filler_words', 'false'],
      ['replace', 'voice web:Voice Web'],
      ['replace', 'snehit:Snehit'],
    ])

    // Base system keywords (Priority 1)
    const systemKeyterms = [
      'Voice Web',
      'Snehit',
      'Kubernetes',
      'Nginx',
      'Vue',
      'FastAPI',
      'Python',
      'Bun',
      'Pydantic',
      'Deepgram',
      'Groq',
      'LLM',
      'PostgreSQL',
      'Supabase',
      'Docker',
      'Git',
      'GitHub',
    ]

    const sanitizedKeywords = sanitizeDeepgramKeyterms(customKeywords)

    // Merge and Truncate logic to respect 500 token limit
    // Estimation: 1 token ~= 4 characters. We leave buffer.
    const MAX_TOKENS = 450 // Buffer of 50
    let currentTokens = 0
    const finalKeyterms: string[] = []

    // 1. Add System Keywords first
    for (const term of systemKeyterms) {
      const tokens = Math.ceil(term.length / 4) + 1
      if (currentTokens + tokens < MAX_TOKENS) {
        finalKeyterms.push(term)
        currentTokens += tokens
      }
    }

    // 2. Add User Keywords (if space remains)
    for (const term of sanitizedKeywords) {
      const tokens = Math.ceil(term.length / 4) + 1
      if (currentTokens + tokens < MAX_TOKENS) {
        finalKeyterms.push(term)
        currentTokens += tokens
      } else {
        consola.warn('deepgram_keyterm_limit_hit', { term, currentTokens })
        break
      }
    }

    for (const term of finalKeyterms) {
      params.append('keyterm', term)
    }

    try {
      const content = await readFile(audioPath)

      let mimeType = 'audio/wav'
      if (audioPath.endsWith('.mp3')) {
        mimeType = 'audio/mpeg'
      } else if (audioPath.endsWith('.webm')) {
        mimeType = 'audio/webm'
      } else if (audioPath.endsWith('.ogg')) {
        mimeType = 'audio/ogg'
      }

      const data = await ofetch<{
        results: {
          channels: Array<{
            alternatives: Array<{
              transcript: string
            }>
          }>
        }
      }>(`${url}?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.config.apiKey}`,
          'Content-Type': mimeType,
        },
        body: content,
        timeout: this.config.timeoutMs,
      })

      try {
        const transcript = data.results.channels[0].alternatives[0].transcript
        return transcript
      } catch (e) {
        throw new DeepgramTranscriptionError(
          `Unexpected response format: ${JSON.stringify(data)}`
        )
      }
    } catch (error: any) {
      consola.error('deepgram_transcription_failed', { error: error.message })
      
      if (error instanceof DeepgramTranscriptionError) {
        throw error
      }

      throw new DeepgramTranscriptionError(
        `Deepgram request failed: ${error.message}`
      )
    }
  }
}
