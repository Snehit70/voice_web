<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  // 0 to 1 float
  volume: number 
}>()

const bars = computed(() => {
  // Generate symmetrical bars
  // Center is highest, edges are lower
  const count = 7
  return Array.from({ length: count }).map((_, i) => {
    // Distance from center (0 to 3)
    const dist = Math.abs(i - 3)
    // Base height decreases with distance
    const baseHeight = 1 - (dist * 0.2)
    // Add dynamic movement based on volume
    const height = Math.max(0.15, baseHeight * props.volume * (0.8 + Math.random() * 0.4))
    return height * 100 // percent
  })
})
</script>

<template>
  <div class="flex items-center justify-center gap-1.5 h-32 w-full bg-black rounded-xl border border-zinc-900">
    <div 
      v-for="(h, i) in bars" 
      :key="i"
      class="w-3 bg-white rounded-full transition-all duration-75 ease-out"
      :class="volume > 0.1 ? 'shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'opacity-30'"
      :style="{ height: `${h}%` }"
    ></div>
  </div>
</template>