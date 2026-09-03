import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message: string
  duration: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { duration: 5000, ...toast, id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}` },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

export const useToast = () => {
  const { addToast } = useToastStore()
  const showToast = (
    type: ToastType,
    title: string,
    message: string,
    duration = 5000,
  ) => {
    addToast({ type, title, message, duration })
  }
  return { showToast }
}
