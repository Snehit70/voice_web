<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  audioData?: Uint8Array
  volume?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationFrame: number

// Configuration
const BAR_WIDTH = 3
const GAP = 2
const COLOR = '#ef4444' // Red-500

const draw = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const centerY = height / 2

  // Clear
  ctx.clearRect(0, 0, width, height)

  // Draw Bars
  const barCount = Math.floor(width / (BAR_WIDTH + GAP))
  const data = props.audioData || new Uint8Array(0)
  const hasData = data.length > 0
  
  ctx.fillStyle = COLOR
  
  for (let i = 0; i < barCount; i++) {
    // Symmetrical wave pattern
    const x = i * (BAR_WIDTH + GAP)
    const centerDist = Math.abs(x - width / 2) / (width / 2) // 0 to 1
    
    // Calculate Height from Frequency Data
    let barHeight = 4

    if (hasData) {
      // Symmetrize: If we are on the left side, map backwards?
      // Actually, standard is low freq on left, high on right.
      // But for "Standing Wave", we want symmetry.
      // Let's map center bars to low freq, outer bars to high freq.
      const symmetricIndex = Math.floor((1 - centerDist) * (data.length * 0.4))
      const value = data[symmetricIndex] || 0
      
      // Scale height
      // Falloff at edges to make it look contained
      const falloff = 1 - Math.pow(centerDist, 3) 
      const rawHeight = (value / 255) * height * 0.8 * falloff
      barHeight = Math.max(4, rawHeight)
    } else {
      const time = Date.now() / 1000
      const pulse = (Math.sin(time * 10 + i * 0.4) + 1) * 0.5
      const simulatedVolume = typeof props.volume === 'number'
        ? Math.max(0, Math.min(1, props.volume))
        : 0
      barHeight = 4 + simulatedVolume * 24 * pulse
    }

    const y = centerY - barHeight / 2
    
    // Draw rounded rect
    if (ctx.roundRect) {
      ctx.beginPath()
      ctx.roundRect(x, y, BAR_WIDTH, barHeight, 50)
      ctx.fill()
    } else {
      ctx.fillRect(x, y, BAR_WIDTH, barHeight)
    }
  }

  animationFrame = requestAnimationFrame(draw)
}

onMounted(() => {
  if (canvasRef.value) {
    // Handle HiDPI
    const dpr = window.devicePixelRatio || 1
    const rect = canvasRef.value.getBoundingClientRect()
    canvasRef.value.width = rect.width * dpr
    canvasRef.value.height = rect.height * dpr
    const ctx = canvasRef.value.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }
  draw()
})

onUnmounted(() => {
  cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center overflow-hidden">
    <canvas ref="canvasRef" class="w-full h-full opacity-80"></canvas>
  </div>
</template>
