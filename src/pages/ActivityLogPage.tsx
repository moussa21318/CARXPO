import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getChangeLogs } from '../db/cloud'

export default function ActivityLogPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChangeLogs(100).then(data => { setLogs(data); setLoading(false) })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('activity.title')}</h1>
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('app.loading')}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('activity.no_logs')}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('activity.table')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('activity.operation')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('activity.user')}</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">{t('activity.timestamp')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-gray-600">{l.table_name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      l.operation === 'insert' ? 'bg-green-100 text-green-700' :
                      l.operation === 'update' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>{t(`activity.${l.operation}`)}</span>
                  </td>
                  <td className="p-3 text-gray-600">{l.user_id?.slice(0, 8)}</td>
                  <td className="p-3 text-gray-500 text-sm">{new Date(l.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
