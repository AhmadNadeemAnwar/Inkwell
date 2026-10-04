import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

// ---- Confirmation dialog --------------------------------------------------------------------

export interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel: string
  /** Styles the confirm button as destructive. */
  danger?: boolean
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<Confirm | null>(null)

/** Asks before anything destructive. Resolves true if confirmed; false on cancel, Escape or backdrop click. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm must be used inside FeedbackProvider')
  return confirm
}

// ---- Toasts -------------------------------------------------------------------------------

type ToastKind = 'success' | 'error'
interface Toast { id: number; kind: ToastKind; message: string }
type Notify = (message: string, kind?: ToastKind) => void

const ToastContext = createContext<Notify | null>(null)

export function useToast(): Notify {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('useToast must be used inside FeedbackProvider')
  return notify
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  const nextId = useRef(1)

  const confirm = useCallback<Confirm>(
    (options) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  )

  const notify = useCallback<Notify>((message, kind = 'success') => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, kind, message }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), kind === 'error' ? 8000 : 4500)
  }, [])

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (pending && !element.open) element.showModal()
    if (!pending && element.open) element.close()
  }, [pending])

  function settle(ok: boolean) {
    pending?.resolve(ok)
    setPending(null)
  }

  const confirmValue = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={confirmValue}>
      <ToastContext.Provider value={notify}>
        {children}

        <dialog
          ref={dialog}
          className="dialog"
          aria-labelledby="confirm-title"
          // Escape closes a native dialog without a click, so it is treated as "cancel".
          onCancel={(event) => { event.preventDefault(); settle(false) }}
          onClick={(event) => { if (event.target === dialog.current) settle(false) }}
        >
          {pending && (
            <div className="dialog__body">
              <h2 id="confirm-title">{pending.options.title}</h2>
              <div className="dialog__message">{pending.options.message}</div>
              <div className="dialog__actions">
                <button className="btn" onClick={() => settle(false)} autoFocus>Cancel</button>
                <button className={`btn ${pending.options.danger ? 'btn--danger-solid' : 'btn--primary'}`} onClick={() => settle(true)}>
                  {pending.options.confirmLabel}
                </button>
              </div>
            </div>
          )}
        </dialog>

        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast--${toast.kind}`}>{toast.message}</div>
          ))}
        </div>
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  )
}
