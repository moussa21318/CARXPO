import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { changePassword } from '../db/cloud'

export default function ClientAccount() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok?: string; err?: string } | null>(null)

  const handleChangePassword = async () => {
    if (!user) return
    if (newPw !== confirmPw) { setMsg({ err: t('client_account.password_mismatch') }); return }
    setSaving(true); setMsg(null)
    try {
      await changePassword(user.id, curPw, newPw)
      setMsg({ ok: t('client_account.password_changed') })
      setCurPw(''); setNewPw(''); setConfirmPw('')
    } catch (e) {
      setMsg({ err: t('client_account.wrong_password') })
    }
    setSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('client_account.title')}</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('client_account.username')}</label>
          <input value={user?.username || ''} readOnly
            className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 outline-none cursor-not-allowed" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-lg font-semibold">{t('client_account.change_password')}</h2>

        {msg?.ok && <p className="text-green-600 dark:text-green-400 text-sm">{msg.ok}</p>}
        {msg?.err && <p className="text-red-600 dark:text-red-400 text-sm">{msg.err}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('client_account.current_password')}</label>
          <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)}
            className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('client_account.new_password')}</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('client_account.confirm_password')}</label>
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <button onClick={handleChangePassword} disabled={saving || !curPw || !newPw || !confirmPw}
          className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50">
          {saving ? t('app.loading') : t('app.save')}
        </button>
      </div>
    </div>
  )
}
