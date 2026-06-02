import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCars } from '../db/cloud'
import { STAGE_ORDER, STAGE_LABELS, type Car, type CarStage } from '../types'
import { formatPrice } from '../utils/format'

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cars.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <Link to={`/cars/${c.id}`} className="text-blue-600 hover:underline font-semibold text-lg leading-tight">{c.name}</Link>
              <div className="text-sm text-gray-500">{c.model_year}</div>
              <div className="text-xs text-gray-400">{c.license_plate || c.serial_number?.slice(-8) || '-'}</div>
              <div className="text-sm font-medium">{formatPrice(c.initial_price)}</div>
              <div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  c.current_stage === 'shipping' ? 'bg-green-100 text-green-700' :
                  c.current_stage === 'purchase' ? 'bg-blue-100 text-blue-700' :
                  c.current_stage === 'deposit' ? 'bg-yellow-100 text-yellow-700' :
                  c.current_stage === 'shipping_prep' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{t(STAGE_LABELS[c.current_stage])}</span>
              </div>
              <div className="text-sm">{c.confirmed ? t('app.yes') : t('app.no')}</div>
              <Link to={`/cars/${c.id}`}
                className="mt-auto text-center bg-gray-100 hover:bg-gray-200 rounded-lg py-2 text-sm transition-colors">
                {t('app.details')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
