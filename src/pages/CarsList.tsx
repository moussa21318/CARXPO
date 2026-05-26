import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCars } from '../db/cloud'
import { STAGE_ORDER, STAGE_LABELS, type Car, type CarStage } from '../types'

export default function CarsList() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)
  const stageFilter = (searchParams.get('stage') as CarStage) || undefined

  const loadCars = async () => {
    setLoading(true)
    const data = await getCars(stageFilter ? { stage: stageFilter } : {})
    setCars(data)
    setLoading(false)
  }

  useEffect(() => { loadCars() }, [stageFilter])

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{t('nav.cars')}</h1>
        <Link to="/cars/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          + {t('car.add')}
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select value={stageFilter || ''} onChange={e => setSearchParams(e.target.value ? { stage: e.target.value } : {})}
          className="border rounded-lg px-4 py-2 outline-none">
          <option value="">{t('car.all_stages')}</option>
          {STAGE_ORDER.map(s => (
            <option key={s} value={s}>{t(STAGE_LABELS[s])}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('app.loading')}</div>
      ) : cars.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('app.no_data')}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('car.name')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('car.model_year')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('car.current_stage')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('car.initial_price')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('car.confirmed')}</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">{t('app.details')}</th>
              </tr>
            </thead>
            <tbody>
              {cars.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <Link to={`/cars/${c.id}`} className="text-blue-600 hover:underline font-medium">{c.name}</Link>
                  </td>
                  <td className="p-3 text-gray-600">{c.model_year}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.current_stage === 'shipping' ? 'bg-green-100 text-green-700' :
                      c.current_stage === 'purchase' ? 'bg-blue-100 text-blue-700' :
                      c.current_stage === 'deposit' ? 'bg-yellow-100 text-yellow-700' :
                      c.current_stage === 'shipping_prep' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{t(STAGE_LABELS[c.current_stage])}</span>
                  </td>
                  <td className="p-3 text-gray-600">{c.initial_price?.toLocaleString()}</td>
                  <td className="p-3">
                    {c.confirmed ? (
                      <span className="text-green-600 text-sm">{t('car.confirmed')}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">{t('car.not_confirmed')}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Link to={`/cars/${c.id}`} className="text-blue-600 hover:text-blue-800 text-sm">{t('app.details')}</Link>
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
