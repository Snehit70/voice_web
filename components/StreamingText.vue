<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  text: string
  speed?: number // ms per character
}>()

const displayedText = ref('')
const isTyping = ref(false)

// Formatting: Converts newlines to <br> for simple rendering
// For full markdown, we'd need a library, but text is usually simple here.
const formattedText = (t: string) => t // Simple pass-through for now

const startTyping = () => {
  if (!props.text) {
    displayedText.value = ''
    return
  }

  // If text is very long, speed up
  const baseSpeed = props.speed || 15
  const adaptiveSpeed = props.text.length > 200 ? 5 : baseSpeed

  let currentIndex = 0
  isTyping.value = true
  displayedText.value = ''

  const typeChar = () => {
    if (currentIndex < props.text.length) {
      // Add a chunk of characters (makes it feel more natural/faster)
      const chunk = props.text.slice(currentIndex, currentIndex + 2)
      displayedText.value += chunk
      currentIndex += 2
      
      // Randomize timing slightly for "human" feel
      const jitter = Math.random() * 10
      setTimeout(typeChar, adaptiveSpeed + jitter)
    } else {
      isTyping.value = false
      // Ensure full text is shown at end
      displayedText.value = props.text
    }
  }

  typeChar()
}

watch(() => props.text, (newVal) => {
  if (newVal) startTyping()
})

onMounted(() => {
  if (props.text) startTyping()
})
</script>

<template>
  <div class="relative">
    <p class="whitespace-pre-wrap leading-relaxed">
      {{ displayedText }}<span v-if="isTyping" class="inline-block w-2 h-5 ml-1 align-middle bg-zinc-400 animate-pulse"></span>
    </p>
  </div>
</template>