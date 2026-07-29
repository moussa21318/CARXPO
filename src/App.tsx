import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import MainLayout from './layouts/MainLayout'
import AdminRoute from './components/AdminRoute'
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
import CustomersPage from './pages/CustomersPage'
import BrandsPage from './pages/BrandsPage'
import ClientDashboard from './pages/ClientDashboard'
import ClientCarsList from './pages/ClientCarsList'
import ClientCarDetails from './pages/ClientCarDetails'
import ClientAccount from './pages/ClientAccount'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-xl">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-xl">Loading...</div>
  const isClient = user?.role === 'client'
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      {isClient ? (
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/" element={<ClientDashboard />} />
          <Route path="/client/cars" element={<ClientCarsList />} />
          <Route path="/client/cars/:id" element={<ClientCarDetails />} />
          <Route path="/client/account" element={<ClientAccount />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      ) : (
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cars" element={<CarsList />} />
          <Route path="/cars/new" element={<CarForm />} />
          <Route path="/cars/:id" element={<CarDetails />} />
          <Route path="/cars/:id/edit" element={<CarForm />} />
          <Route element={<AdminRoute><PaymentsPage /></AdminRoute>} path="/payments" />
          <Route element={<AdminRoute><ClientsPage /></AdminRoute>} path="/clients" />
          <Route element={<AdminRoute><CustomersPage /></AdminRoute>} path="/customers" />
          <Route element={<AdminRoute><ExportPage /></AdminRoute>} path="/export" />
          <Route element={<AdminRoute><ImportPage /></AdminRoute>} path="/import" />
          <Route element={<AdminRoute><BrandsPage /></AdminRoute>} path="/brands" />
          <Route element={<AdminRoute><UsersPage /></AdminRoute>} path="/users" />
          <Route element={<AdminRoute><ActivityLogPage /></AdminRoute>} path="/activity-log" />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      )}
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
