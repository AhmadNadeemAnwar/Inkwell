import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, setToken } from '../api/client'
import type { CurrentUser } from '../api/types'

interface AuthContextValue {
  user: CurrentUser | null
  /** True until the stored token has been checked, so guarded routes do not flash the login page. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; handle: string; displayName: string; password: string }) => Promise<void>
  logout: () => void
  setUser: (user: CurrentUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }

    // Restore the session on load. A rejected token means it expired or was revoked.
    api.me()
      .then(setUserState)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login({ email, password })
    setToken(response.token)
    setUserState(response.user)
  }, [])

  const register = useCallback(async (input: { email: string; handle: string; displayName: string; password: string }) => {
    const response = await api.register(input)
    setToken(response.token)
    setUserState(response.user)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUserState(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser: setUserState }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
