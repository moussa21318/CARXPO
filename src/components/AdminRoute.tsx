import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role === 'client') return <Navigate to="/" replace />
  return <>{children}</>
}
