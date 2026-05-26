import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCars, getChangeLogs } from '../db/cloud'
import { STAGE_ORDER, STAGE_LABELS, type Car } from '../types'

export default function Dashboard() {
  const { t } = useTranslation()
  const [cars, setCars] = useState<Car[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCars(), getChangeLogs(10)]).then(([c, l]) => {
      setCars(c)
      setLogs(l)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-8 text-gray-500">{t('app.loading')}</div>

  const stageCounts = STAGE_ORDER.map(s => ({
    stage: s,
    label: t(STAGE_LABELS[s]),
    count: cars.filter(c => c.current_stage === s).length,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('dashboard.title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-500">{t('dashboard.total_cars')}</p>
          <p className="text-3xl font-bold text-blue-600">{cars.length}</p>
        </div>
        {stageCounts.map(s => (
          <Link key={s.stage} to={`/cars?stage=${s.stage}`}
            className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-800">{s.count}</p>
          </Link>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.recent_activity')}</h2>
        {logs.length === 0 ? (
          <p className="text-gray-400">{t('activity.no_logs')}</p>
        ) : (
          <div className="space-y-3">
            {logs.slice(0, 10).map(l => (
              <div key={l.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                <span className="text-gray-500">{new Date(l.timestamp).toLocaleDateString()}</span>
                <span className="font-medium">{t(`activity.${l.operation}`)}</span>
                <span className="text-gray-600">{l.table_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
