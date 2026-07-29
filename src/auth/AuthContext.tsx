import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '../types'
import { getUserByUsername, getUsers, createUser, getClientByUserId } from '../db/cloud'
import { hash, verify } from '../utils/hash'
import { storageKey } from '../config/app'

interface AuthContextType {
  user: User | null
  clientId: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => void
  canEdit: boolean
  canEditCustomer: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const seedAdmin = useCallback(async () => {
    try {
      const existing = await getUsers()
      if (existing.length === 0) {
        const pw = await hash('admin')
        await createUser({ username: 'admin', password_hash: pw, role: 'admin', full_name: 'Administrator', is_active: true })
      }
    } catch (e) {
      console.error('seedAdmin error:', e)
    }
  }, [])

  useEffect(() => {
    const savedId = localStorage.getItem(storageKey('user_id'))
    if (savedId) {
      getUsers().then(async all => {
        const u = all.find(x => x.id === savedId && x.is_active)
        if (u) {
          setUser(u)
          if (u.role === 'client') {
            const cl = await getClientByUserId(u.id)
            if (cl) setClientId(cl.id)
          }
        }
        setLoading(false)
      }).catch(() => setLoading(false))
    } else {
      seedAdmin().finally(() => setLoading(false))
    }
  }, [seedAdmin])

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const found = await getUserByUsername(username)
      if (!found || !found.is_active) return 'Invalid credentials'
      const ok = await verify(password, found.password_hash)
      if (!ok) return 'Invalid credentials'
      setUser(found)
      if (found.role === 'client') {
        const cl = await getClientByUserId(found.id)
        if (cl) setClientId(cl.id)
      }
      localStorage.setItem(storageKey('user_id'), found.id)
      return null
    } catch (e) {
      console.error('login error:', e)
      return 'Server connection error'
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setClientId(null)
    localStorage.removeItem(storageKey('user_id'))
  }, [])

  return (
    <AuthContext.Provider value={{
      user, clientId, loading, login, logout,
      canEdit: user?.role === 'admin' || user?.role === 'employee',
      canEditCustomer: user?.role === 'client',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
