import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCars } from '../db/cloud'
import { STAGE_LABELS, type Car, type CarStage } from '../types'
import { formatPrice } from '../utils/format'

export default function ClientDashboard() {
  const { t } = useTranslation()
  const { user, clientId } = useAuth()
  const navigate = useNavigate()
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) { setLoading(false); return }
    getCars().then(all => {
      setCars(all.filter(c => c.client_id === clientId && !c.deleted))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clientId])

  const stageCounts: Partial<Record<CarStage, number>> = {}
  for (const c of cars) {
    stageCounts[c.current_stage] = (stageCounts[c.current_stage] || 0) + 1
  }

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('client_portal.title')}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">{t('client_portal.welcome', { name: user?.full_name })}</p>

      {cars.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">{t('client_portal.no_cars')}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {(['request', 'deposit', 'purchase', 'shipping_prep', 'shipping'] as CarStage[]).map(s => (
              <div key={s} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{stageCounts[s] || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t(STAGE_LABELS[s])}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                <tr>
                  <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.name')}</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.model_year')}</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.current_stage')}</th>
                  <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.initial_price')}</th>
                  <th className="text-center p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('app.details')}</th>
                </tr>
              </thead>
              <tbody>
                {cars.map(c => (
                  <tr key={c.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => navigate('/client/cars/' + c.id)}>
                    <td className="p-3 text-right text-sm text-gray-700 dark:text-gray-300">{c.name}</td>
                    <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300">{c.model_year}</td>
                    <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300">{t(STAGE_LABELS[c.current_stage])}</td>
                    <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300">{formatPrice(c.initial_price)}</td>
                    <td className="p-3 text-center text-sm">
                      <button className="text-blue-600 dark:text-blue-400 hover:underline text-xs">{t('app.view')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
