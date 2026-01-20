export interface GroqConfig {
  enabled: boolean
  apiKey: string
  model: string
  timeout: number
}

export interface DeepgramConfig {
  enabled: boolean
  apiKey: string
  model: string
  timeout: number
}

export interface LLMConfig {
  enabled: boolean
  apiKey: string
  baseUrl: string
  model: string
  timeout: number
}

export interface PunctuationConfig {
  enabled: boolean
  mappings: Array<[string, string]>
}

export interface Config {
  groq: GroqConfig
  deepgram: DeepgramConfig
  llm: LLMConfig
  punctuation: PunctuationConfig
}

let configInstance: Config | null = null

export function getConfig(): Config {
  if (configInstance) {
    return configInstance
  }

  const runtimeConfig = useRuntimeConfig()

  configInstance = {
    groq: {
      enabled: true,
      apiKey: runtimeConfig.groqApiKey || '',
      model: 'whisper-large-v3',
      timeout: 30000
    },
    deepgram: {
      enabled: true,
      apiKey: runtimeConfig.deepgramApiKey || '',
      model: 'nova-3',
      timeout: 30000
    },
    llm: {
      enabled: true,
      apiKey: runtimeConfig.groqApiKey || '',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
      timeout: 30000
    },
    punctuation: {
      enabled: true,
      mappings: [
        ['new line', '\n'],
        ['next line', '\n'],
        ['stop', '.'],
        ['period', '.'],
        ['comma', ','],
        ['question mark', '?'],
        ['exclamation mark', '!']
      ]
    }
  }

  return configInstance
}
