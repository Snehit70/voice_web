<script setup lang="ts">
const props = defineProps<{
  text: string
  duration?: number
  delay?: number
  className?: string
  shimmerColor?: string
}>()

const duration = props.duration || 2.5
const shimmerColor = props.shimmerColor || '#ffffff' // White shimmer
</script>

<template>
  <span 
    class="shimmer-text inline-block bg-clip-text text-transparent bg-gradient-to-r from-zinc-500 via-white to-zinc-500 bg-[length:200%_100%]"
    :class="className"
    :style="{ 
      animationDuration: `${duration}s`,
      '--shimmer-color': shimmerColor 
    }"
  >
    {{ text }}
  </span>
</template>

<style scoped>
.shimmer-text {
  animation: shimmer linear infinite;
  /* Define gradient stops explicitly if needed for custom colors */
  background-image: linear-gradient(
    90deg,
    var(--tw-gradient-from) 0%,
    var(--tw-gradient-from) 40%,
    var(--shimmer-color) 50%,
    var(--tw-gradient-to) 60%,
    var(--tw-gradient-to) 100%
  );
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>