/**
 * AuthContext.jsx
 *
 * Session source-of-truth for the frontend. Manages boot-time restoration,
 * login/register/logout actions, and exposes current user state.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // On mount, try to restore session from stored tokens
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }
    authAPI.me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    await authAPI.login(username, password)
    const me = await authAPI.me()
    setUser(me)
    return me
  }, [])

  const register = useCallback(async (data) => {
    await authAPI.register(data)
    return login(data.username, data.password)
  }, [login])

  const logout = useCallback(() => {
    authAPI.logout()
    setUser(null)
  }, [])

  const setCurrentUser = useCallback((nextUser) => {
    setUser(nextUser)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
