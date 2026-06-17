import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getUnreadCount } from '../db/cloud'
import { useTheme } from '../context/ThemeContext'
import { storageKey } from '../config/app'

export default function MainLayout() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    getUnreadCount(user.id).then(setUnread)
    const interval = setInterval(() => getUnreadCount(user.id).then(setUnread), 30000)
    return () => clearInterval(interval)
  }, [user])

  const isRtl = i18n.language === 'ar'

  const links = [
    { to: '/', label: 'nav.dashboard', icon: '📊' },
    { to: '/cars', label: 'nav.cars', icon: '🚗' },
    { to: '/payments', label: 'nav.payments', icon: '💰' },
    { to: '/clients', label: 'nav.clients', icon: '👤' },
    { to: '/customers', label: 'nav.customers', icon: '👥' },
    { to: '/export', label: 'nav.export', icon: '📤' },
    { to: '/notifications', label: 'nav.notifications', icon: '🔔', badge: unread },
  ]

  if (user?.role === 'admin') {
    links.push({ to: '/users', label: 'nav.users', icon: '👥' })
    links.push({ to: '/activity-log', label: 'nav.activity_log', icon: '📋' })
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed md:sticky top-0 h-screen bg-white dark:bg-gray-800 shadow-lg z-50 transition-transform duration-200 ${isRtl ? 'right-0' : 'left-0'} ${sidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'} md:translate-x-0 w-64 overflow-y-auto`}>
        <div className="p-4 border-b dark:border-gray-700">
          <h1 className="text-xl font-bold text-blue-600">{t('app.name')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('auth.welcome', { name: user?.full_name })}</p>
        </div>
        <nav className="p-2">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-2 p-3 rounded-lg mb-1 transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <span>{l.icon}</span>
              <span>{t(l.label)}</span>
              {l.badge !== undefined && l.badge > 0 && (
                <span className="mr-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{l.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t dark:border-gray-700 mt-auto">
          <div className="flex items-center gap-2 mb-3">
            {(['ar', 'fr', 'en'] as const).map(lang => (
              <button key={lang} onClick={() => { i18n.changeLanguage(lang); localStorage.setItem(storageKey('lang'), lang) }}
                className={`px-2 py-1 text-xs rounded ${i18n.language === lang ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 dark:text-gray-200'}`}>
                {lang === 'ar' ? 'العربية' : lang === 'fr' ? 'Français' : 'English'}
              </button>
            ))}
          </div>
          <button onClick={toggleTheme}
            className="w-full p-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors mb-2">
            {theme === 'dark' ? `☀️ ${t('theme.light')}` : `🌙 ${t('theme.dark')}`}
          </button>
          <button onClick={() => { logout(); navigate('/login') }}
            className="w-full p-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex items-center gap-4 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-2xl p-1 dark:text-white">☰</button>
          <h1 className="text-lg font-bold text-blue-600">{t('app.name')}</h1>
        </header>
        <div className="p-4 md:p-6 dark:text-gray-200">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
