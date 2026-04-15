import { ofetch } from 'ofetch'
import consola from 'consola'
import type { LLMConfig } from './config'
import {
  buildGatedMergeResult,
  buildSingleSourceMergeResult,
  decideMerge,
  type MergeResult,
} from './merge'

const POLISH_PROMPT = `You are a final-pass proofreader. Make ONLY these fixes:
- Add missing commas and periods
- Fix capitalization at sentence starts
- Fix obvious typos
NEVER change word order. NEVER rephrase. NEVER remove content.
Output must be 95%+ identical to input. Output text only.`

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

export class LLMService {
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  get isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiKey
  }

  private async callLLM(messages: Message[], temperature: number = 0.1): Promise<string> {
    if (!this.isAvailable) {
      return ''
    }

    const baseUrl = this.config.baseUrl.replace(/\/$/, '')
    const apiUrl = `${baseUrl}/chat/completions`

    try {
      const result = await ofetch<LLMResponse>(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: {
          model: this.config.model,
          messages,
          temperature,
        },
        timeout: this.config.timeoutMs,
      })

      const content = result.choices[0]?.message?.content
      return content ? content.trim() : ''
    } catch (error: any) {
      consola.error('llm_call_failed', {
        model: this.config.model,
        error: error.message,
      })
      return ''
    }
  }

  async improveText(text: string, multiPass: boolean = false): Promise<string> {
    if (!text) {
      return ''
    }

    if (multiPass && text.length < 50) {
      return text
    }

    const messages: Message[] = [
      {
        role: 'system',
        content:
          'You are a verbatim speech-to-text corrector. ' +
          'ALLOWED changes: ' +
          '(1) Fix spelling, punctuation, capitalization. ' +
          '(2) Remove filler words: um, uh, er, like, you know, so basically, I mean. ' +
          '(3) Remove stutters/repetitions: \'the the\' -> \'the\', \'I I think\' -> \'I think\'. ' +
          'FORBIDDEN changes: Do NOT rephrase. Do NOT reorder words. Do NOT summarize. Do NOT add words. Do NOT change sentence structure. ' +
          'Keep the EXACT word order and phrasing. Only fix errors, remove fillers, and fix stutters. ' +
          'Output the corrected text only.',
      },
      { role: 'user', content: text },
    ]

    consola.debug('llm_pass_1_start', { textLen: text.length })
    const result = await this.callLLM(messages)
    const pass1Result = result || text

    if (!multiPass) {
      return pass1Result
    }

    if (text.length > 100) {
      consola.debug('llm_pass_2_start', { textLen: pass1Result.length })

      const pass2Messages: Message[] = [
        { role: 'system', content: POLISH_PROMPT },
        { role: 'user', content: pass1Result },
      ]

      const pass2Result = await this.callLLM(pass2Messages, 0.3)

      if (pass2Result) {
        consola.info('llm_improvement_complete', { passes: 2 })
        return pass2Result
      }
    }

    consola.info('llm_improvement_complete', { passes: 1 })
    return pass1Result
  }

  async editSelection(selection: string, instruction: string): Promise<string> {
    if (!selection || !instruction) {
      return ''
    }

    const messages: Message[] = [
      {
        role: 'system',
        content:
          'You are a text editing assistant. ' +
          'Apply the user\'s instruction to the provided text. ' +
          'Output ONLY the result. Do not add markdown blocks, quotes, or explanations.',
      },
      {
        role: 'user',
        content: `Text:\n${selection}\n\nInstruction: ${instruction}`,
      },
    ]

    const result = await this.callLLM(messages)
    return result || selection
  }

  async mergeTranscripts(
    textA: string,
    textB: string,
    sourceAName: string,
    sourceBName: string
  ): Promise<MergeResult> {
    if (!textA && !textB) {
      return buildSingleSourceMergeResult('', 'empty', 'both_empty')
    }
    if (!textA) {
      return buildSingleSourceMergeResult(textB, 'single_source', 'deepgram_only')
    }
    if (!textB) {
      return buildSingleSourceMergeResult(textA, 'single_source', 'groq_only')
    }

    const gateDecision = decideMerge(textA, textB)
    if (gateDecision.text !== undefined) {
      consola.debug('merge_gate_skipped_llm', {
        strategy: gateDecision.strategy,
        reason: gateDecision.reason,
        groqLength: textA.length,
        deepgramLength: textB.length,
      })
      return buildGatedMergeResult(textA, textB, gateDecision)
    }

    const systemPrompt =
      'You are an expert transcription editor resolving conflicts between two STT engines.\n' +
      `Source A (${sourceAName}): High verbatim accuracy. Trust its WORDS and technical vocabulary (e.g. 'Kubernetes', 'Nginx').\n` +
      `Source B (${sourceBName}): High formatting intelligence. Trust its FORMATTING (punctuation, capitalization, numbers, code symbols).\n` +
      'MERGE GOAL: Combine A\'s content accuracy with B\'s formatting style.\n\n' +
      'Rules:\n' +
      '1. Use Source A\'s words if there is a conflict in meaning or vocabulary.\n' +
      '2. Use Source B\'s punctuation, numbers, and symbols (e.g. \':\' instead of \'colon\').\n' +
      '3. If Source B missed words or stuttered, use Source A\'s version.\n' +
      '4. REMOVE self-corrections: "sorry", "I mean", "actually", "no wait", "oops".\n' +
      '5. REMOVE spelling clarifications: "with an I", "with a Y", "spelled S-M-I-T-H", "that\'s capital".\n' +
      '6. REMOVE pronunciation meta-commentary: keep only the final corrected word, not the correction process.\n' +
      '7. Output ONLY the final message content. No meta-commentary, no correction markers.'

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Source A:\n${textA}\n\nSource B:\n${textB}`,
      },
    ]

    const result = await this.callLLM(messages, 0.0)
    const finalText = result || textA || textB

    if (!result) {
      return {
        text: finalText,
        strategy: 'llm_fallback',
        reason: 'llm_error_fallback',
        accuracy: {
          sourcesMatch: textA.trim() === textB.trim(),
          editDistance: 0,
          confidence: 0.5,
        },
      }
    }

    return {
      text: finalText,
      strategy: 'llm',
      reason: 'llm_succeeded',
      accuracy: {
        sourcesMatch: textA.trim() === textB.trim(),
        editDistance: 0,
        confidence: 0.75,
      },
    }
  }
}
