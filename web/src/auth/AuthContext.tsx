import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getToken, setToken } from '../api/client'
import type { CurrentUser } from '../api/types'

interface AuthContextValue {
  user: CurrentUser | null
  /** True until the stored token has been checked, so guarded routes do not flash the login page. */
  loading: boolean
  /**
   * Whether visitors may create accounts. Set by the API, which also enforces it. While unknown, or if the
   * API cannot be reached, this is false so no sign-in or sign-up prompt flashes up on a closed site.
   */
  allowPublicSignUp: boolean
  /** True once the API has answered, so the sign-up page does not briefly show "not found" while waiting. */
  signUpPolicyKnown: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; handle: string; displayName: string; password: string; turnstileToken?: string }) => Promise<void>
  logout: () => void
  setUser: (user: CurrentUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [allowPublicSignUp, setAllowPublicSignUp] = useState(false)
  const [signUpPolicyKnown, setSignUpPolicyKnown] = useState(false)

  useEffect(() => {
    api.authOptions()
      .then((options) => setAllowPublicSignUp(options.allowPublicSignUp))
      .catch(() => setAllowPublicSignUp(false))
      .finally(() => setSignUpPolicyKnown(true))
  }, [])

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

  const register = useCallback(async (input: { email: string; handle: string; displayName: string; password: string; turnstileToken?: string }) => {
    const response = await api.register(input)
    setToken(response.token)
    setUserState(response.user)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUserState(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, allowPublicSignUp, signUpPolicyKnown, login, register, logout, setUser: setUserState }),
    [user, loading, allowPublicSignUp, signUpPolicyKnown, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}
