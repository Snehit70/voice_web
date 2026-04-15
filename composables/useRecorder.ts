import { ref, onUnmounted } from 'vue'
import { useToast } from './useToast'

const PREFERRED_AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

function getPreferredRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined
  }

  return PREFERRED_AUDIO_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
}

function getAudioExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase()

  if (normalized.includes('webm')) return 'webm'
  if (normalized.includes('ogg')) return 'ogg'
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3'
  if (normalized.includes('wav')) return 'wav'
  if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a'

  return 'webm'
}

export interface TranscriptionDiagnostics {
  model: string
  llmImproved: boolean
  mergeStrategy: string
  mergeReason: string
  fallbackUsed: boolean
  warnings: string[]
}

export function useRecorder() {
  const isRecording = ref(false)
  const isProcessing = ref(false)
  const processingStage = ref<'uploading' | 'transcribing' | 'finalizing' | null>(null)
  const transcript = ref('')
  const error = ref<string | null>(null)
  const errorType = ref<'error' | 'warning' | null>(null)
  const audioData = ref<Uint8Array>(new Uint8Array(0))
  const customKeywords = ref<string[]>([])
  const diagnostics = ref<TranscriptionDiagnostics | null>(null)
  const { addToast } = useToast()

  let mediaRecorder: MediaRecorder | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let animationFrameId: number | null = null
  let stream: MediaStream | null = null
  let audioChunks: Blob[] = []
  let recorderMimeType = ''

  const updateVisualizer = () => {
    if (!analyser || !isRecording.value) return
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)
    audioData.value = dataArray
    
    animationFrameId = requestAnimationFrame(updateVisualizer)
  }

  const startRecording = async () => {
    try {
      error.value = null
      errorType.value = null
      transcript.value = ''
      diagnostics.value = null
      audioChunks = []
      recorderMimeType = ''

      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      audioContext = new AudioContext()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const preferredMimeType = getPreferredRecorderMimeType()
      mediaRecorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)
      recorderMimeType = mediaRecorder.mimeType || preferredMimeType || ''
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const mimeType = recorderMimeType || audioChunks[0]?.type || 'audio/webm'
        const audioBlob = new Blob(audioChunks, { type: mimeType })
        const fileName = `recording.${getAudioExtension(mimeType)}`
        await processAudio(audioBlob, customKeywords.value, fileName)
      }

      mediaRecorder.start()
      isRecording.value = true
      updateVisualizer()

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start recording'
      console.error(err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      isRecording.value = false
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    if (audioContext) {
      audioContext.close()
      audioContext = null
    }
    
    audioData.value = new Uint8Array(0)
  }

  const processAudio = async (blob: Blob, keywords: string[] = [], fileName?: string) => {
    isProcessing.value = true
    processingStage.value = 'uploading'
    try {
      const formData = new FormData()
      const resolvedFileName = fileName || `recording.${getAudioExtension(blob.type)}`
      formData.append('file', blob, resolvedFileName)
      if (keywords.length > 0) {
        formData.append('keywords', JSON.stringify(keywords))
      }

      processingStage.value = 'transcribing'

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || errorData.detail || `Server error: ${response.status}`
        
        if (response.status === 422) {
          error.value = errorMessage
          errorType.value = 'warning'
          return
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      processingStage.value = 'finalizing'
      if (typeof data.text === 'string') {
        transcript.value = data.text
      } else {
        transcript.value = JSON.stringify(data)
      }

      diagnostics.value = {
        model: typeof data.model === 'string' ? data.model : 'unknown',
        llmImproved: Boolean(data.llm_improved),
        mergeStrategy: typeof data.merge_strategy === 'string' ? data.merge_strategy : 'unknown',
        mergeReason: typeof data.merge_reason === 'string' ? data.merge_reason : 'unknown',
        fallbackUsed: Boolean(data.fallback_used),
        warnings: Array.isArray(data.warnings)
          ? data.warnings.filter((warning: unknown): warning is string => typeof warning === 'string')
          : [],
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Upload failed'
      errorType.value = 'error'
      addToast(error.value!, 'error')
      console.error(err)
    } finally {
      isProcessing.value = false
      processingStage.value = null
    }
  }

  onUnmounted(() => {
    if (isRecording.value) {
      stopRecording()
    }
  })

  return {
    isRecording,
    isProcessing,
    processingStage,
    transcript,
    diagnostics,
    error,
    errorType,
    audioData,
    customKeywords,
    startRecording,
    stopRecording,
    processAudio
  }
}
