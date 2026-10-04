import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, loadSession, saveSession, setSessionLostHandler } from '../api/client'
import type { Session } from '../api/types'

interface AuthContextValue {
  session: Session | null
  /** True until a stored session has been confirmed with the server, so the sign-in page does not flash. */
  checking: boolean
  login: (email: string, password: string, code: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [checking, setChecking] = useState(() => loadSession() !== null)

  const logout = useCallback(() => {
    saveSession(null)
    setSession(null)
  }, [])

  // Any 401/403 from the API (expired session, admin removed) ends the session at once.
  useEffect(() => {
    setSessionLostHandler(logout)
    return () => setSessionLostHandler(null)
  }, [logout])

  // A stored session is only trusted once the server agrees it is still valid.
  useEffect(() => {
    if (!loadSession()) return
    api.me()
      .catch(() => logout())
      .finally(() => setChecking(false))
  }, [logout])

  // Sign out by the clock too, so a left-open tab does not keep showing data after the session ends.
  useEffect(() => {
    if (!session) return
    const remaining = new Date(session.expiresAt).getTime() - Date.now()
    const timer = setTimeout(logout, Math.max(remaining, 0))
    return () => clearTimeout(timer)
  }, [session, logout])

  const login = useCallback(async (email: string, password: string, code: string) => {
    const next = await api.login(email, password, code)
    saveSession(next)
    setSession(next)
  }, [])

  const value = useMemo(() => ({ session, checking, login, logout }), [session, checking, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
