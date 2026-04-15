import { getConfig } from '~/server/utils/config'
import { Transcriber } from '~/server/utils/transcribe'
import { LLMService } from '~/server/utils/llm'

let transcriber: Transcriber | null = null
let llm: LLMService | null = null

function initTranscriber() {
  if (!transcriber) {
    const config = getConfig()
    llm = new LLMService(config.llm)
    transcriber = new Transcriber(config, llm)
  }
  return transcriber
}

export default defineEventHandler(() => {
  const t = initTranscriber()
  
  if (!t) {
    return {
      status: 'degraded',
      groq_available: false,
      deepgram_available: false,
      llm_available: false,
      active_model: 'none',
    }
  }

  return {
    status: 'healthy',
    groq_available: t.useGroq,
    deepgram_available: t.useDeepgram,
    llm_available: llm?.isAvailable || false,
    active_model: t.activeModelName,
    merge_model: llm?.isAvailable ? getConfig().llm.model : 'disabled',
  }
})
