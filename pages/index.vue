<script setup lang="ts">
import ShimmeringText from '~/components/ShimmeringText.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-black selection:bg-white selection:text-black">
    <header class="mb-8 sm:mb-16 text-center space-y-2">
      <h1 class="text-4xl font-bold tracking-tighter text-white sm:text-6xl">
        VOICE<span class="text-zinc-600">WEB</span>
      </h1>
      <ShimmeringText 
        text="Speak. We'll get it right."
        className="font-mono text-sm tracking-widest"
        :duration="4"
        shimmerColor="#ffffff"
      />
    </header>

    <main class="w-full max-w-4xl">
      <AudioRecorder />
    </main>

    <footer class="fixed bottom-4 sm:bottom-8 text-zinc-800 text-xs font-mono">
      SYSTEM STATUS: ONLINE
    </footer>
  </div>
</template>
