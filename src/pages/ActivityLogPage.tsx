import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getChangeLogsWithUsers } from '../db/cloud'

export default function ActivityLogPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChangeLogsWithUsers(100).then(data => { setLogs(data); setLoading(false) })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('activity.title')}</h1>
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('activity.no_logs')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('activity.table')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('activity.operation')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('activity.user')}</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('activity.timestamp')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-3 text-gray-600 dark:text-gray-300">{l.table_name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      l.operation === 'insert' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                      l.operation === 'update' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>{t(`activity.${l.operation}`)}</span>
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">{(l as any).user_name || l.user_id?.slice(0, 8)}</td>
                  <td className="p-3 text-gray-500 dark:text-gray-400 text-sm">{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
