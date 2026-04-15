import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Config } from '../server/utils/config'
import { NonEnglishError } from '../server/utils/groq'
import type {
  DeepgramTranscriberLike,
  GroqTranscriberLike,
  LLMServiceLike,
} from '../server/utils/transcribe'
import { Transcriber } from '../server/utils/transcribe'

const baseConfig: Config = {
  groq: {
    enabled: true,
    apiKey: 'gsk_test',
    model: 'whisper-large-v3',
    timeoutMs: 30000,
  },
  deepgram: {
    enabled: true,
    apiKey: 'deepgram-test-key',
    model: 'nova-3',
    timeoutMs: 30000,
  },
  llm: {
    enabled: true,
    apiKey: 'gsk_test',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    timeoutMs: 30000,
  },
  punctuation: {
    enabled: true,
    mappings: [],
  },
}

const tempDirs: string[] = []

async function createAudioFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'voice-web-test-'))
  tempDirs.push(dir)
  const filePath = join(dir, 'audio.webm')
  await writeFile(filePath, 'test-audio')
  return filePath
}

function createGroqStub(
  implementation: (audioPath: string, customKeywords?: string[]) => Promise<string> | string,
  isAvailable = true
): GroqTranscriberLike {
  return {
    isAvailable,
    transcribe(audioPath, customKeywords = []) {
      return Promise.resolve(implementation(audioPath, customKeywords))
    },
  }
}

function createDeepgramStub(
  implementation: (audioPath: string, customKeywords?: string[]) => Promise<string> | string,
  isAvailable = true
): DeepgramTranscriberLike {
  return {
    isAvailable,
    transcribe(audioPath, customKeywords = []) {
      return Promise.resolve(implementation(audioPath, customKeywords))
    },
  }
}

function createLLMStub(
  implementation: LLMServiceLike['mergeTranscripts'],
  isAvailable = true
): LLMServiceLike {
  return {
    isAvailable,
    mergeTranscripts: implementation,
  }
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }
})

describe('Transcriber', () => {
  it('uses deterministic merge when llm is unavailable and the transcripts only differ by formatting', async () => {
    const audioPath = await createAudioFixture()
    const transcriber = new Transcriber(baseConfig, null, {
      groq: createGroqStub(() => 'Hello world'),
      deepgram: createDeepgramStub(() => 'hello world!'),
      llm: createLLMStub(async () => {
        throw new Error('should not be called')
      }, false),
    })

    const result = await transcriber.transcribeWithFallback(audioPath)

    expect(result.text).toBe('hello world!')
    expect(result.mergeStrategy).toBe('formatting_only')
    expect(result.mergeReason).toBe('punctuation_stripped_match')
    expect(result.fallbackUsed).toBe(false)
    expect(result.warnings).toContain('llm unavailable: used deterministic merge strategy')
  })

  it('falls back to the longest provider result when llm is unavailable and the transcripts meaningfully disagree', async () => {
    const audioPath = await createAudioFixture()
    const transcriber = new Transcriber(baseConfig, null, {
      groq: createGroqStub(() => 'short text'),
      deepgram: createDeepgramStub(() => 'this is the longer provider transcript'),
      llm: createLLMStub(async () => {
        throw new Error('should not be called')
      }, false),
    })

    const result = await transcriber.transcribeWithFallback(audioPath)

    expect(result.text).toBe('this is the longer provider transcript')
    expect(result.mergeStrategy).toBe('single_provider')
    expect(result.mergeReason).toBe('provider_fallback')
    expect(result.fallbackUsed).toBe(true)
    expect(result.model).toBe('deepgram:nova-3')
    expect(result.warnings).toContain('llm unavailable: fell back to provider transcript')
  })

  it('returns the surviving provider when one provider fails', async () => {
    const audioPath = await createAudioFixture()
    const transcriber = new Transcriber(baseConfig, null, {
      groq: createGroqStub(() => {
        throw new Error('groq exploded')
      }),
      deepgram: createDeepgramStub(() => 'deepgram transcript'),
      llm: createLLMStub(async () => {
        throw new Error('should not be called')
      }),
    })

    const result = await transcriber.transcribeWithFallback(audioPath)

    expect(result.text).toBe('deepgram transcript')
    expect(result.model).toBe('deepgram:nova-3')
    expect(result.mergeStrategy).toBe('single_provider')
    expect(result.fallbackUsed).toBe(true)
    expect(result.warnings).toContain('groq failed: groq exploded')
  })

  it('raises the non-english guardrail even if another provider succeeds', async () => {
    const audioPath = await createAudioFixture()
    const transcriber = new Transcriber(baseConfig, null, {
      groq: createGroqStub(() => {
        throw new NonEnglishError('Spanish')
      }),
      deepgram: createDeepgramStub(() => 'hola mundo'),
      llm: createLLMStub(async () => {
        throw new Error('should not be called')
      }, false),
    })

    await expect(transcriber.transcribeWithFallback(audioPath)).rejects.toBeInstanceOf(NonEnglishError)
  })
})
