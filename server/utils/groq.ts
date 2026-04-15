import { readFile, stat } from 'fs/promises'
import { ofetch } from 'ofetch'
import consola from 'consola'
import type { GroqConfig } from './config'
import { stripHallucinations } from './postprocess'
import { getTranscriptionPrompt } from './vocabulary'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

function getMimeTypeForPath(audioPath: string): string {
  if (audioPath.endsWith('.mp3')) return 'audio/mpeg'
  if (audioPath.endsWith('.ogg')) return 'audio/ogg'
  if (audioPath.endsWith('.webm')) return 'audio/webm'
  if (audioPath.endsWith('.m4a') || audioPath.endsWith('.mp4')) return 'audio/mp4'
  return 'audio/wav'
}

export class GroqTranscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GroqTranscriptionError'
  }
}

export class NonEnglishError extends Error {
  language: string

  constructor(language: string) {
    super(`Detected ${language}. Please speak English.`)
    this.name = 'NonEnglishError'
    this.language = language
  }
}

export class GroqTranscriber {
  private config: GroqConfig

  constructor(config: GroqConfig) {
    this.config = config

    if (!config.apiKey) {
      consola.warn('groq_api_key_missing', {
        hint: 'Set GROQ_API_KEY env var',
      })
    }
  }

  get isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiKey
  }

  async transcribe(audioPath: string, customKeywords: string[] = []): Promise<string> {
    if (!this.isAvailable) {
      throw new GroqTranscriptionError(
        'Groq API not available (disabled or no API key)'
      )
    }

    consola.debug('groq_transcription_start', {
      model: this.config.model,
      file: audioPath,
    })

    const startTime = performance.now()
    const maxAttempts = 2
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const connectStart = performance.now()
        
        const fileBuffer = await readFile(audioPath)
        const fileStats = await stat(audioPath)
        const fileName = audioPath.split('/').pop() || 'audio.wav'
        const mimeType = getMimeTypeForPath(audioPath)
        
        const connectTime = performance.now() - connectStart

        const formData = new FormData()
        const blob = new Blob([fileBuffer], { type: mimeType })
        formData.append('file', blob, fileName)
        formData.append('model', this.config.model)
        formData.append('response_format', 'verbose_json')
        formData.append('prompt', getTranscriptionPrompt(customKeywords))

        const uploadStart = performance.now()
        
        const data = await ofetch<{
          text: string
          language?: string
        }>(GROQ_API_URL, {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          timeout: this.config.timeoutMs,
        })

        const uploadProcessTime = performance.now() - uploadStart

        const detectedLanguage = data.language || 'unknown'
        let text = (data.text || '').trim()

        if (detectedLanguage.toLowerCase() !== 'english') {
          consola.warn('non_english_detected', {
            language: detectedLanguage,
            textPreview: text.slice(0, 50),
          })
          throw new NonEnglishError(detectedLanguage)
        }

        const cleanedText = stripHallucinations(text)
        if (text && !cleanedText) {
          consola.info('hallucination_filtered', { text })
        }

        text = cleanedText

        const elapsed = performance.now() - startTime
        consola.info('groq_transcription_complete', {
          model: this.config.model,
          totalMs: Math.round(elapsed),
          connectMs: Math.round(connectTime),
          apiMs: Math.round(uploadProcessTime),
          sizeKb: Math.round(fileStats.size / 1024),
          textLength: text.length,
        })

        return text
      } catch (error: any) {
        if (error instanceof NonEnglishError) {
          throw error
        }

        if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
          consola.error('groq_transcription_timeout', {
            timeoutMs: this.config.timeoutMs,
          })
          throw new GroqTranscriptionError(
            `Groq API timeout after ${Math.round(this.config.timeoutMs / 1000)}s`
          )
        }

        if (error.statusCode || error.status) {
          const statusCode = error.statusCode || error.status
          const errorDetail = error.data
            ? JSON.stringify(error.data).slice(0, 200)
            : error.message

          consola.error('groq_transcription_http_error', {
            statusCode,
            detail: errorDetail,
          })

          throw new GroqTranscriptionError(
            `Groq API error ${statusCode}: ${errorDetail}`
          )
        }

        lastError = error
        consola.warn('groq_request_error_retry', {
          attempt: attempt + 1,
          error: error.message,
        })
        continue
      }
    }

    throw new GroqTranscriptionError(
      `Groq API failed after ${maxAttempts} attempts: ${lastError?.message}`
    )
  }
}
