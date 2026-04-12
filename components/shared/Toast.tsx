'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'
import { X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'default'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

function borderClass(type: ToastType): string {
  if (type === 'success') return 'border-l-[#22c55e]'
  if (type === 'error') return 'border-l-[#ef4444]'
  return 'border-l-[#6366f1]'
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'default') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 md:bottom-6 z-[200] flex flex-col gap-2 w-[calc(100vw-2rem)] md:w-auto md:max-w-[360px] pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast-enter bg-[#111111] border border-[#1f1f1f] border-l-4 ${borderClass(t.type)} rounded-xl px-4 py-3 shadow-2xl flex items-center justify-between gap-3 pointer-events-auto`}
          >
            <span className="text-sm text-[#f1f5f9]">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-[#475569] hover:text-[#f1f5f9] transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
