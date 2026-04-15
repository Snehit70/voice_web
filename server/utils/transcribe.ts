import { stat } from 'fs/promises'
import consola from 'consola'
import type { Config } from './config'
import { GroqTranscriber, NonEnglishError } from './groq'
import { DeepgramTranscriber } from './deepgram'
import { LLMService } from './llm'
import type { MergeResult } from './merge'

export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TranscriptionError'
  }
}

interface TranscriptionResult {
  provider: string
  text: string
  error?: string
}

export interface TranscriptionOutcome {
  text: string
  model: string
  mergeStrategy: MergeResult['strategy'] | 'single_provider'
  mergeReason: MergeResult['reason'] | 'provider_fallback'
  fallbackUsed: boolean
  warnings: string[]
}

export class Transcriber {
  private config: Config
  private llm: LLMService | null
  private groq: GroqTranscriber
  private deepgram: DeepgramTranscriber
  public useGroq: boolean
  public useDeepgram: boolean

  constructor(config: Config, llmService: LLMService | null = null) {
    this.config = config
    this.llm = llmService

    this.groq = new GroqTranscriber(config.groq)
    this.deepgram = new DeepgramTranscriber(config.deepgram)

    this.useGroq = this.groq.isAvailable
    this.useDeepgram = this.deepgram.isAvailable

    consola.info('transcriber_init', {
      groqEnabled: this.useGroq,
      deepgramEnabled: this.useDeepgram,
    })
  }

  get activeModelName(): string {
    const models: string[] = []
    if (this.useGroq) {
      models.push(`groq:${this.config.groq.model}`)
    }
    if (this.useDeepgram) {
      models.push(`deepgram:${this.config.deepgram.model}`)
    }
    return models.join(' + ')
  }

  private async runGroq(audioPath: string, customKeywords: string[]): Promise<TranscriptionResult> {
    try {
      const text = await this.groq.transcribe(audioPath, customKeywords)
      return { provider: 'groq', text }
    } catch (error: any) {
      return { provider: 'groq', text: '', error: error.message }
    }
  }

  private async runDeepgram(audioPath: string, customKeywords: string[]): Promise<TranscriptionResult> {
    try {
      const text = await this.deepgram.transcribe(audioPath, customKeywords)
      return { provider: 'deepgram', text }
    } catch (error: any) {
      return { provider: 'deepgram', text: '', error: error.message }
    }
  }

  async transcribeWithFallback(audioPath: string, customKeywords: string[] = []): Promise<TranscriptionOutcome> {
    try {
      await stat(audioPath)
    } catch {
      throw new Error(`Audio file not found: ${audioPath}`)
    }

    const tasks: Promise<TranscriptionResult>[] = []
    if (this.useGroq) {
      tasks.push(this.runGroq(audioPath, customKeywords))
    }
    if (this.useDeepgram) {
      tasks.push(this.runDeepgram(audioPath, customKeywords))
    }

    if (tasks.length === 0) {
      throw new TranscriptionError('No transcription services configured.')
    }

    const results = await Promise.all(tasks)

    const logCtx: Record<string, any> = {}
    const successful: TranscriptionResult[] = []
    const warnings: string[] = []

    for (const res of results) {
      if (res.error) {
        logCtx[`${res.provider}_error`] = res.error
        warnings.push(`${res.provider} failed: ${res.error}`)
      } else {
        logCtx[`${res.provider}_text_len`] = res.text.length
        logCtx[`${res.provider}_text`] = res.text
        successful.push(res)
      }
    }

    if (successful.length === 0) {
      consola.error('all_providers_failed', logCtx)
      throw new TranscriptionError(`All providers failed: ${JSON.stringify(logCtx)}`)
    }

    const groqError = results.find(
      (r) => r.provider === 'groq' && r.error && r.error.includes('Please speak English')
    )?.error

    if (groqError) {
      consola.warn('guardrail_blocked', {
        reason: groqError,
        deepgramText: logCtx['deepgram_text'] || '',
      })
      const languageMatch = groqError.match(/Detected (\w+)/)
      const language = languageMatch ? languageMatch[1] : 'non-English'
      throw new NonEnglishError(language)
    }

    const groqRes = successful.find((r) => r.provider === 'groq')
    const deepgramRes = successful.find((r) => r.provider === 'deepgram')

    let finalText = ''
    let modelUsed = 'merged'
    let mergeResult: MergeResult | null = null
    let mergeStrategy: MergeResult['strategy'] | 'single_provider' = 'single_provider'
    let mergeReason: MergeResult['reason'] | 'provider_fallback' = 'provider_fallback'
    let fallbackUsed = false

    if (groqRes && deepgramRes && this.llm && this.llm.isAvailable) {
      consola.info('merging_transcripts_with_llm')
      try {
        mergeResult = await this.llm.mergeTranscripts(
          groqRes.text,
          deepgramRes.text,
          'Groq/Whisper',
          'Deepgram/Nova-3'
        )
        finalText = mergeResult.text
        mergeStrategy = mergeResult.strategy
        mergeReason = mergeResult.reason
        fallbackUsed = mergeResult.strategy === 'llm_fallback'
        logCtx['winner'] = mergeResult.strategy
        logCtx['merge_reason'] = mergeResult.reason
      } catch (error: any) {
        consola.error('merge_failed', { error: error.message })
        const winner = successful.reduce((a, b) => (a.text.length > b.text.length ? a : b))
        finalText = winner.text
        mergeStrategy = 'single_provider'
        mergeReason = 'provider_fallback'
        fallbackUsed = true
        warnings.push(`merge failed: ${error.message}`)
        logCtx['winner'] = `${winner.provider}_fallback`
      }
    } else {
      const winner = successful.reduce((a, b) => (a.text.length > b.text.length ? a : b))
      finalText = winner.text
      logCtx['winner'] = winner.provider
      fallbackUsed = successful.length === 1
      mergeStrategy = 'single_provider'
      mergeReason = 'provider_fallback'

      if (winner.provider === 'groq') {
        modelUsed = `groq:${this.config.groq.model}`
      } else if (winner.provider === 'deepgram') {
        modelUsed = `deepgram:${this.config.deepgram.model}`
      }
    }

    logCtx['final_len'] = finalText.length
    logCtx['fallback_used'] = fallbackUsed
    consola.info('transcription_comparison', logCtx)

    return {
      text: finalText,
      model: modelUsed,
      mergeStrategy,
      mergeReason,
      fallbackUsed,
      warnings,
    }
  }
}
