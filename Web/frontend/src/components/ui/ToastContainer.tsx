import { useEffect, useState } from 'react'
import { useToastStore, type Toast } from '@/stores/toast.store'

const toastIcons: Record<Toast['type'], string> = {
  success: 'bi-check-circle-fill',
  error: 'bi-exclamation-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
}

const toastColors: Record<Toast['type'], string> = {
  success: 'text-bg-success',
  error: 'text-bg-danger',
  warning: 'text-bg-warning',
  info: 'text-bg-info',
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore()
  const [, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      removeToast(toast.id)
    }, toast.duration)
    return () => clearTimeout(timer)
  }, [toast, removeToast])

  return (
    <div className={`toast show ${toastColors[toast.type]} mb-2`} role="alert">
      <div className="d-flex align-items-start p-3">
        <i className={`${toastIcons[toast.type]} fs-4 me-2 flex-shrink-0`}></i>
        <div className="flex-grow-1">
          <div className="fw-bold">{toast.title}</div>
          <div className="small opacity-90">{toast.message}</div>
        </div>
        <button
          type="button"
          className="btn-close btn-close-white btn-sm ms-2"
          onClick={() => removeToast(toast.id)}
          aria-label="Fermer"
        />
      </div>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      id="toast-container"
      className="position-fixed top-0 end-0 p-3"
      style={{ zIndex: 9999, maxWidth: '420px' }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
