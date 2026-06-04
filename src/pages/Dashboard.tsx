import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCars, getChangeLogs } from '../db/cloud'
import { STAGE_ORDER, STAGE_LABELS, type Car, type ChangeLog } from '../types'

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [cars, setCars] = useState<Car[]>([])
  const [logs, setLogs] = useState<ChangeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchVal, setSearchVal] = useState('')

  useEffect(() => {
    Promise.all([getCars(), getChangeLogs(50)]).then(([c, l]) => {
      setCars(c)
      setLogs(l)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  const stageCounts = STAGE_ORDER.map(s => ({
    stage: s,
    label: t(STAGE_LABELS[s]),
    count: cars.filter(c => c.current_stage === s).length,
  }))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchVal.trim()) navigate(`/cars?search=${encodeURIComponent(searchVal.trim())}`)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('dashboard.title')}</h1>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2 max-w-md">
          <input value={searchVal} onChange={e => setSearchVal(e.target.value)}
            placeholder={t('dashboard.search_placeholder')}
            className="flex-1 p-3 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800" />
          <button type="submit"
            className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            {t('app.search')}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-3 mb-8">
        <Link to="/cars/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm transition-colors">
          + {t('car.add')}
        </Link>
        <Link to="/export"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm transition-colors">
          📤 {t('nav.export')}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.total_cars')}</p>
          <p className="text-3xl font-bold text-blue-600">{cars.length}</p>
        </div>
        {stageCounts.map(s => (
          <Link key={s.stage} to={`/cars?stage=${s.stage}`}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{s.count}</p>
          </Link>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.recent_activity')}</h2>
        {logs.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500">{t('activity.no_logs')}</p>
        ) : (
          <div className="space-y-3">
            {logs.map(l => (
              <div key={l.id} className="flex items-center gap-3 text-sm border-b dark:border-gray-700 pb-2 last:border-0">
                <span className="text-gray-500 dark:text-gray-400">{new Date(l.timestamp).toLocaleDateString()}</span>
                <span className="font-medium">{t(`activity.${l.operation}`)}</span>
                <span className="text-gray-600 dark:text-gray-300">{l.table_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
