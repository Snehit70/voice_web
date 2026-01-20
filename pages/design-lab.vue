<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import BarVisualizer from '~/components/BarVisualizer.vue'
import LiveWaveform from '~/components/LiveWaveform.vue'

// Simulation Logic
const volume = ref(0.1)
const autoMode = ref(true)
let animationFrame: number

const updateSimulation = () => {
  if (!autoMode.value) return

  const time = Date.now() / 1000
  // Speech pattern: Bursts of activity separated by pauses
  // Fast sine wave (syllables) * Slow sine wave (phrases)
  const syllables = Math.abs(Math.sin(time * 10))
  const phrases = (Math.sin(time * 2) + 1) / 2
  
  // Random jitter
  const noise = Math.random() * 0.2

  const target = syllables * phrases * 0.8 + 0.1
  
  // Smooth interpolation
  volume.value += (target - volume.value) * 0.1
  
  animationFrame = requestAnimationFrame(updateSimulation)
}

onMounted(() => {
  updateSimulation()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
})

const toggleAuto = () => {
  autoMode.value = !autoMode.value
  if (autoMode.value) updateSimulation()
  else cancelAnimationFrame(animationFrame)
}
</script>

<template>
  <div class="min-h-screen bg-black text-white p-8 font-mono flex flex-col items-center">
    <header class="mb-12 text-center space-y-4">
      <h1 class="text-2xl font-bold">VISUALIZER SHOWDOWN</h1>
      
      <!-- Controls -->
      <div class="flex items-center gap-4 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
        <button 
          @click="toggleAuto"
          class="px-4 py-2 rounded text-xs font-bold transition-colors"
          :class="autoMode ? 'bg-green-500 text-black' : 'bg-zinc-700 text-zinc-300'"
        >
          {{ autoMode ? 'AUTO: ON' : 'AUTO: OFF' }}
        </button>
        
        <div class="flex items-center gap-2">
          <span class="text-xs text-zinc-500">VOLUME</span>
          <input 
            type="range" 
            min="0" max="1" step="0.01" 
            v-model.number="volume"
            :disabled="autoMode"
            class="accent-white"
          />
        </div>
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
      
      <!-- OPTION 1 -->
      <div class="space-y-4">
        <h2 class="text-zinc-400 text-sm text-center">OPTION 1: BAR VISUALIZER (CSS)</h2>
        <BarVisualizer :volume="volume" />
        <p class="text-xs text-zinc-600 text-center">
          Pros: Simple, clean, minimal.<br>
          Cons: Less fluid than canvas.
        </p>
      </div>

      <!-- OPTION 2 -->
      <div class="space-y-4 flex flex-col items-center">
        <h2 class="text-zinc-400 text-sm text-center">OPTION 2: LIVE WAVEFORM (STANDING)</h2>
        <!-- Constrain width to 300px -->
        <div class="w-[300px]">
          <LiveWaveform :volume="volume" />
        </div>
        <p class="text-xs text-zinc-600 text-center">
          Pros: High fidelity, buttery smooth.<br>
          Cons: More complex code.
        </p>
      </div>

    </div>
  </div>
</template>