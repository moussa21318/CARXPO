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
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')
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
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={stageFilter || ''} onChange={e => setSearchParams(e.target.value ? { stage: e.target.value } : {})}
          className="border rounded-lg px-4 py-2 outline-none">
          <option value="">{t('car.all_stages')}</option>
          {STAGE_ORDER.map(s => (
            <option key={s} value={s}>{t(STAGE_LABELS[s])}</option>
          ))}
        </select>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('table')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            ☰ {t('nav.view_table')}
          </button>
          <button onClick={() => setViewMode('cards')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            ⊞ {t('nav.view_cards')}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('app.loading')}</div>
      ) : cars.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('app.no_data')}</div>
      ) : viewMode === 'table' ? (
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
                    <div className="flex items-center gap-2">
                      <Link to={`/cars/${c.id}`} className="text-blue-600 hover:underline font-medium">{c.name}</Link>
                      <span className="text-xs text-gray-400">{c.license_plate || c.serial_number?.slice(-8) || ''}</span>
                    </div>
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
                  <td className="p-3 text-gray-600">{formatPrice(c.initial_price)}</td>
                  <td className="p-3">
                    {c.confirmed ? (
                      <span className="text-green-600 text-sm">{t('app.yes')}</span>
                    ) : (
                      <span className="text-gray-400 text-sm">{t('app.no')}</span>
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cars.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex items-baseline gap-2 flex-wrap">
                <Link to={`/cars/${c.id}`} className="text-blue-600 hover:underline font-semibold text-lg leading-tight">{c.name}</Link>
                <span className="text-sm text-gray-500">{c.model_year}</span>
              </div>
              <div className="text-sm font-semibold text-gray-700">{c.license_plate || c.serial_number?.slice(-8) || '-'}</div>
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
