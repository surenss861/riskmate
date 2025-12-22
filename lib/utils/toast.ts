/**
 * Simple Toast Notification System
 * For enterprise-grade user feedback without external dependencies
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  requestId?: string
  duration?: number
}

let toastListeners: Array<(toasts: Toast[]) => void> = []
let toasts: Toast[] = []

const DEFAULT_DURATION = 4000

export function subscribeToToasts(listener: (toasts: Toast[]) => void) {
  toastListeners.push(listener)
  listener(toasts) // Initial call
  
  return () => {
    toastListeners = toastListeners.filter(l => l !== listener)
  }
}

function notifyListeners() {
  toastListeners.forEach(listener => listener([...toasts]))
}

function addToast(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substring(2, 9)
  const newToast: Toast = {
    id,
    duration: DEFAULT_DURATION,
    ...toast,
  }
  
  toasts.push(newToast)
  notifyListeners()
  
  // Auto-remove after duration
  setTimeout(() => {
    removeToast(id)
  }, newToast.duration)
  
  return id
}

function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id)
  notifyListeners()
}

export const toast = {
  success: (message: string, requestId?: string) => {
    return addToast({ type: 'success', message, requestId })
  },
  error: (message: string, requestId?: string) => {
    return addToast({ type: 'error', message, requestId, duration: 6000 })
  },
  info: (message: string, requestId?: string) => {
    return addToast({ type: 'info', message, requestId })
  },
  warning: (message: string, requestId?: string) => {
    return addToast({ type: 'warning', message, requestId })
  },
  remove: removeToast,
}

