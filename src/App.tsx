import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import CarsList from './pages/CarsList'
import CarForm from './pages/CarForm'
import CarDetails from './pages/CarDetails'
import UsersPage from './pages/UsersPage'
import NotificationsPage from './pages/NotificationsPage'
import ActivityLogPage from './pages/ActivityLogPage'
import ExportPage from './pages/ExportPage'
import ImportPage from './pages/ImportPage'
import PaymentsPage from './pages/PaymentsPage'
import ClientsPage from './pages/ClientsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-xl">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-xl">Loading...</div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cars" element={<CarsList />} />
        <Route path="/cars/new" element={<CarForm />} />
        <Route path="/cars/:id" element={<CarDetails />} />
        <Route path="/cars/:id/edit" element={<CarForm />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/activity-log" element={<ActivityLogPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/clients" element={<ClientsPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}
