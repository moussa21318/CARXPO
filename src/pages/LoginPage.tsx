import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { storageKey } from '../config/app'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const err = await login(username, password)
    if (err) setError(err)
    else navigate('/')
  }

  return (
    <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-2">{t('app.name')}</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">{t('auth.login')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('auth.username')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('auth.password')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
            {t('auth.login')}
          </button>
        </form>
        <div className="flex justify-center gap-2 mt-6">
          {(['ar', 'fr', 'en'] as const).map(lang => (
            <button key={lang} onClick={() => { i18n.changeLanguage(lang); localStorage.setItem(storageKey('lang'), lang) }}
              className={`px-3 py-1 text-sm rounded ${i18n.language === lang ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
              {lang === 'ar' ? 'العربية' : lang === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
