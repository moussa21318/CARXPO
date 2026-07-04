import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../db/cloud'
import type { Notification } from '../types'

export default function NotificationsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!user) return
    setLoading(true)
    const data = await getNotifications(user.id)
    setNotifications(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    load()
  }

  const handleMarkAll = async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
        {notifications.some(n => !n.is_read) && (
          <button onClick={handleMarkAll} className="text-blue-600 hover:underline dark:text-blue-400 text-sm">{t('notifications.mark_all_read')}</button>
        )}
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('notifications.no_notifications')}</div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <div key={n.id} onClick={async () => { await markNotificationRead(n.id); if (n.car_id) navigate('/cars/' + n.car_id) }}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${!n.is_read ? 'border-r-4 border-blue-500' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`font-medium ${!n.is_read ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>{n.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{n.body}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{new Date(n.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
