import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User } from '../types'
import { getUserByUsername, getUsers, createUser } from '../db/cloud'
import { hash, verify } from '../utils/hash'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => void
  canEdit: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const seedAdmin = useCallback(async () => {
    const existing = await getUsers()
    if (existing.length === 0) {
      const pw = await hash('admin')
      await createUser({ username: 'admin', password_hash: pw, role: 'admin', full_name: 'Administrator', is_active: true })
    }
  }, [])

  useEffect(() => {
    const savedId = localStorage.getItem('carxpo_user_id')
    if (savedId) {
      getUsers().then(all => {
        const u = all.find(x => x.id === savedId && x.is_active)
        if (u) setUser(u)
        setLoading(false)
      }).catch(() => setLoading(false))
    } else {
      seedAdmin().finally(() => setLoading(false))
    }
  }, [seedAdmin])

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    const found = await getUserByUsername(username)
    if (!found || !found.is_active) return 'Invalid credentials'
    const ok = await verify(password, found.password_hash)
    if (!ok) return 'Invalid credentials'
    setUser(found)
    localStorage.setItem('carxpo_user_id', found.id)
    return null
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('carxpo_user_id')
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canEdit: user?.role === 'admin' || user?.role === 'employee' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
