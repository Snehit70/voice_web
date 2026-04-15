import { randomUUID } from 'crypto'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import consola from 'consola'
import { getConfig } from '~/server/utils/config'
import { Transcriber, TranscriptionError } from '~/server/utils/transcribe'
import { NonEnglishError } from '~/server/utils/groq'
import { LLMService } from '~/server/utils/llm'
import { process } from '~/server/utils/postprocess'

let transcriber: Transcriber | null = null
let llm: LLMService | null = null

function getAudioSuffix(contentType: string, filename?: string): string {
  const normalizedType = contentType.toLowerCase()
  const normalizedFileName = filename?.toLowerCase() || ''

  if (normalizedType.includes('wav') || normalizedFileName.endsWith('.wav')) return '.wav'
  if (normalizedType.includes('mpeg') || normalizedType.includes('mp3') || normalizedFileName.endsWith('.mp3')) return '.mp3'
  if (normalizedType.includes('ogg') || normalizedFileName.endsWith('.ogg')) return '.ogg'
  if (normalizedType.includes('mp4') || normalizedType.includes('m4a') || normalizedFileName.endsWith('.m4a') || normalizedFileName.endsWith('.mp4')) return '.m4a'
  return '.webm'
}

function initTranscriber() {
  if (!transcriber) {
    const config = getConfig()
    llm = new LLMService(config.llm)
    transcriber = new Transcriber(config, llm)
  }
  return transcriber
}

function buildSafePreview(text: string, previewLength: number = 32): string {
  if (!text) return ''

  const preview = text.slice(0, previewLength).replace(/\s+/g, ' ').trim()
  return text.length > previewLength ? `${preview}… [redacted]` : `${preview} [redacted]`
}

export default defineEventHandler(async (event) => {
  const t = initTranscriber()
  
  if (!t) {
    throw createError({
      statusCode: 503,
      message: 'Transcriber not initialized. Check server logs.',
    })
  }

  const form = await readMultipartFormData(event)
  
  if (!form || form.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No file uploaded',
    })
  }

  const fileData = form.find((item) => item.name === 'file')
  
  if (!fileData || !fileData.data) {
    throw createError({
      statusCode: 400,
      message: 'No file data found',
    })
  }

  let keywords: string[] = []
  const keywordsData = form.find((item) => item.name === 'keywords')
  if (keywordsData && keywordsData.data) {
    try {
      const keywordsString = keywordsData.data.toString()
      const parsed = JSON.parse(keywordsString)
      keywords = Array.isArray(parsed)
        ? parsed
            .filter((value: unknown): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : []
    } catch {
      keywords = []
    }
  }

  const contentType = fileData.type || ''
  const suffix = getAudioSuffix(contentType, fileData.filename)

  const tempPath = join(tmpdir(), `voice_web_${randomUUID()}${suffix}`)

  try {
    await writeFile(tempPath, fileData.data)

    consola.info('transcription_request', {
      filename: fileData.filename,
      sizeKb: Math.floor(fileData.data.length / 1024),
      contentType,
      keywordsCount: keywords.length,
    })

    const start = performance.now()
    const result = await t.transcribeWithFallback(tempPath, keywords)
    const elapsedMs = Math.round(performance.now() - start)

    const processedText = process(result.text)
    const llmImproved = result.mergeStrategy === 'llm'

    consola.info('transcription_complete', {
      model: result.model,
      mergeStrategy: result.mergeStrategy,
      mergeReason: result.mergeReason,
      fallbackUsed: result.fallbackUsed,
      durationMs: elapsedMs,
      textLength: processedText.length,
      originalPreview: buildSafePreview(result.text),
      finalPreview: buildSafePreview(processedText),
      llmImproved,
    })

    return {
      text: processedText,
      model: result.model,
      duration_ms: elapsedMs,
      llm_improved: llmImproved,
      merge_strategy: result.mergeStrategy,
      merge_reason: result.mergeReason,
      fallback_used: result.fallbackUsed,
      warnings: result.warnings,
    }
  } catch (error: any) {
    if (error instanceof NonEnglishError) {
      consola.warn('non_english_audio', { language: error.language })
      throw createError({
        statusCode: 422,
        message: error.message,
      })
    }

    if (error instanceof TranscriptionError) {
      consola.error('transcription_failed', { error: error.message })
      throw createError({
        statusCode: 500,
        message: error.message,
      })
    }

    consola.error('transcription_error', { error: error.message })
    throw createError({
      statusCode: 500,
      message: `Transcription failed: ${error.message}`,
    })
  } finally {
    try {
      await unlink(tempPath)
    } catch {}
  }
})
