import { ref, onUnmounted } from 'vue'
import { useToast } from './useToast'

export function useRecorder() {
  const isRecording = ref(false)
  const isProcessing = ref(false)
  const transcript = ref('')
  const error = ref<string | null>(null)
  const errorType = ref<'error' | 'warning' | null>(null)
  const audioData = ref<Uint8Array>(new Uint8Array(0))
  const customKeywords = ref<string[]>([])
  const { addToast } = useToast()

  let mediaRecorder: MediaRecorder | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let animationFrameId: number | null = null
  let stream: MediaStream | null = null
  let audioChunks: Blob[] = []

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
      audioChunks = []

      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      audioContext = new AudioContext()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      mediaRecorder = new MediaRecorder(stream)
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        await processAudio(audioBlob, customKeywords.value)
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

  const processAudio = async (blob: Blob, keywords: string[] = []) => {
    isProcessing.value = true
    try {
      const formData = new FormData()
      formData.append('file', blob, 'recording.wav')
      if (keywords.length > 0) {
        formData.append('keywords', JSON.stringify(keywords))
      }

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
      if (typeof data.text === 'string') {
        transcript.value = data.text
      } else {
        transcript.value = JSON.stringify(data)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Upload failed'
      errorType.value = 'error'
      addToast(error.value!, 'error')
      console.error(err)
    } finally {
      isProcessing.value = false
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
    transcript,
    error,
    errorType,
    audioData,
    customKeywords,
    startRecording,
    stopRecording,
    processAudio
  }
}
