// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  
  modules: ['@nuxtjs/tailwindcss'],
  
  css: ['~/assets/css/main.css'],
  
  app: {
    head: {
      title: 'Voice Web - AI Transcription',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ],
      meta: [
        { name: 'description', content: 'AI-powered speech-to-text transcription with dual STT engines' }
      ]
    }
  },
  
  runtimeConfig: {
    groqApiKey: process.env.GROQ_API_KEY || '',
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
    public: {
      apiBase: ''
    }
  },
  
  nitro: {
    preset: 'vercel'
  }
})
