import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'error' | 'success' | 'info' | 'warning'
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  const addToast = (message: string, type: 'error' | 'success' | 'info' | 'warning' = 'info') => {
    const id = nextId++
    toasts.value.push({ id, message, type })
    
    setTimeout(() => {
      removeToast(id)
    }, 5000)
  }

  const removeToast = (id: number) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    addToast,
    removeToast
  }
}
