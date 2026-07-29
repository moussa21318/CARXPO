import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCars } from '../db/cloud'
import { STAGE_LABELS, type Car } from '../types'
import { formatPrice } from '../utils/format'

export default function ClientCarsList() {
  const { t } = useTranslation()
  const { clientId } = useAuth()
  const navigate = useNavigate()
  const [cars, setCars] = useState<Car[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) { setLoading(false); return }
    getCars().then(all => {
      setCars(all.filter(c => c.client_id === clientId && !c.deleted))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [clientId])

  const filtered = cars.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.serial_number && c.serial_number.includes(search)) ||
    (c.license_plate && c.license_plate.includes(search))
  )

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('client_portal.my_cars')}</h1>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder={t('car.search_placeholder')}
        className="w-full sm:w-80 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('client_portal.no_cars')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.name')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.serial_number')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.license_plate')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.model_year')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.current_stage')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.initial_price')}</th>
                <th className="text-center p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('app.details')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => navigate('/client/cars/' + c.id)}>
                  <td className="p-3 text-right text-sm text-gray-700 dark:text-gray-300">{c.name}</td>
                  <td className="p-3 text-right text-sm font-mono text-gray-600 dark:text-gray-300">{c.serial_number || '-'}</td>
                  <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300">{c.license_plate || '-'}</td>
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
      )}
    </div>
  )
}
