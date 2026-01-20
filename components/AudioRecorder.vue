<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRecorder } from '../composables/useRecorder'
import LiveWaveform from './LiveWaveform.vue'
import StreamingText from './StreamingText.vue'

const { isRecording, isProcessing, transcript, error, errorType, audioData, customKeywords, startRecording, stopRecording } = useRecorder()

const copied = ref(false)
const showSettings = ref(false)
const keywordsInput = ref('')

onMounted(() => {
  const saved = localStorage.getItem('voice_web_keywords')
  if (saved) {
    keywordsInput.value = saved
    updateKeywords()
  }
})

const updateKeywords = () => {
  const words = keywordsInput.value
    .split(',')
    .map(w => w.trim())
    .filter(w => w.length > 0)
  customKeywords.value = words
  localStorage.setItem('voice_web_keywords', keywordsInput.value)
}

const toggleSettings = () => {
  showSettings.value = !showSettings.value
}

const toggleRecording = () => {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

const copyToClipboard = async () => {
  if (!transcript.value) return
  await navigator.clipboard.writeText(transcript.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<template>
  <!-- Settings Button (Top Right) -->
  <button 
    @click="toggleSettings" 
    class="fixed top-8 right-8 z-40 text-zinc-600 hover:text-zinc-300 transition-colors focus:outline-none p-2 rounded-full hover:bg-zinc-900" 
    title="Custom Vocabulary"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  </button>

  <div class="flex flex-col items-center justify-center w-full max-w-2xl mx-auto space-y-12">
    
    <div class="flex items-center space-x-2 font-mono text-sm tracking-widest uppercase">
      <div 
        class="w-2 h-2 rounded-full"
        :class="{
          'bg-red-500 animate-pulse': isRecording,
          'bg-yellow-500 animate-bounce': isProcessing,
          'bg-yellow-500': error && errorType === 'warning',
          'bg-red-900': error && errorType === 'error',
          'bg-green-500': !isRecording && !isProcessing && !error
        }"
      ></div>
      <span v-if="error && errorType === 'warning'" class="text-yellow-500">WARNING</span>
      <span v-else-if="error && errorType === 'error'" class="text-red-500">ERROR</span>
      <span v-else-if="isProcessing" class="text-yellow-500">PROCESSING</span>
      <span v-else-if="isRecording" class="text-red-500">RECORDING</span>
      <span v-else class="text-zinc-500">READY</span>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" @click.self="showSettings = false">
      <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-2xl">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-bold text-white">Custom Vocabulary</h3>
          <button @click="showSettings = false" class="text-zinc-500 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="space-y-2">
          <label class="text-xs text-zinc-400 uppercase tracking-widest">Boost Words (Comma Separated)</label>
          <textarea 
            v-model="keywordsInput" 
            @input="updateKeywords"
            class="w-full h-32 bg-black border border-zinc-700 rounded-lg p-3 text-zinc-200 focus:border-white focus:ring-0 text-sm font-mono placeholder:text-zinc-700"
            placeholder="E.g. Voice Web, Snehit, Kubernetes, API"
          ></textarea>
          <p class="text-xs text-zinc-500">
            These words will be boosted in the transcription engine. Useful for names, products, and technical terms.
          </p>
        </div>

        <button @click="showSettings = false" class="w-full py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors">
          Done
        </button>
      </div>
    </div>

    <div class="relative flex items-center justify-center w-80 h-32">
      
      <!-- Live Waveform Visualizer -->
      <div class="absolute inset-0 z-0 opacity-60">
         <LiveWaveform :audioData="audioData" />
      </div>

      <button 
        @click="toggleRecording"
        class="relative z-10 flex items-center justify-center w-20 h-20 transition-all duration-300 rounded-full hover:scale-105 focus:outline-none focus:ring-4 focus:ring-zinc-800"
        :class="isRecording ? 'bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.5)]' : 'bg-zinc-100 hover:bg-white text-black'"
      >
        <span v-if="isRecording" class="w-8 h-8 bg-white rounded shadow-sm"></span>
        <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8 text-black">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
        
        <span 
          v-if="isRecording" 
          class="absolute inset-0 rounded-full animate-ping bg-red-500 opacity-20"
        ></span>
      </button>
    </div>

    <div class="w-full space-y-4">
      <div class="p-6 overflow-hidden border border-zinc-800 bg-zinc-900/50 rounded-xl min-h-[200px] relative group">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        
        <button
          v-if="transcript"
          @click="copyToClipboard"
          class="absolute top-4 right-4 p-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors"
          :class="copied ? 'text-green-400' : 'text-zinc-400'"
        >
          <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </button>

        <div v-if="transcript" class="text-lg leading-relaxed text-zinc-100 font-sans pr-12 min-h-[60px]">
          <StreamingText :text="transcript" />
        </div>
        <p v-else-if="error && errorType === 'warning'" class="text-sm font-mono text-yellow-400">
          {{ error }}
        </p>
        <p v-else-if="error && errorType === 'error'" class="text-sm font-mono text-red-400">
          {{ error }}
        </p>
        <p v-else class="text-sm font-mono text-zinc-600 uppercase tracking-widest text-center mt-16">
          // Waiting for input...
        </p>
      </div>
    </div>

  </div>
</template>
