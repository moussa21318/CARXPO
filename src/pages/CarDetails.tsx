import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import {
  getCar, updateCar, getCarFees, upsertCarFees,
  getStageLogs, moveToStage,
  getRequestClient, getCustomer, upsertCustomer,
} from '../db/cloud'
import { STAGE_ORDER, STAGE_LABELS, type Car, type CarFees, type CarStage } from '../types'

export default function CarDetails() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { user, canEdit } = useAuth()

  const [car, setCar] = useState<Car | null>(null)
  const [fees, setFees] = useState<CarFees | null>(null)
  const [stageLogs, setStageLogs] = useState<any[]>([])
  const [requestClient, setRequestClient] = useState<any>(null)
  const [customerData, setCustomerData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!id) return
    const [c, f, sl, rc, cust] = await Promise.all([
      getCar(id), getCarFees(id), getStageLogs(id), getRequestClient(id), getCustomer(id),
    ])
    setCar(c)
    setFees(f)
    setStageLogs(sl)
    setRequestClient(rc)
    setCustomerData(cust || {})
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  const handleConfirm = async () => {
    if (!id || !user || !car) return
    await updateCar(id, { confirmed: true, updated_by: user.id })
    loadData()
  }

  const handleMoveStage = async (stage: CarStage) => {
    if (!id || !user) return
    await moveToStage(id, stage, null, '', user.id)
    loadData()
  }

  const handleSaveFees = async (data: Partial<CarFees>) => {
    if (!id) return
    await upsertCarFees({ car_id: id, id: fees?.id, ...data })
    loadData()
  }

  const handleSaveCustomer = async () => {
    if (!id || !user) return
    await upsertCustomer({ car_id: id, id: customerData?.id, ...customerData })
    loadData()
  }

  if (loading) return <div className="text-center py-8 text-gray-500">{t('app.loading')}</div>
  if (!car) return <div className="text-center py-8 text-gray-400">{t('app.no_data')}</div>

  const stageIndex = STAGE_ORDER.indexOf(car.current_stage)
  const nextStage = stageIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIndex + 1] : null
  const blockedToShipping = nextStage === 'shipping_prep' && !(fees && fees.deposit_02 > 0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/cars" className="text-blue-600 hover:underline">{t('app.back')}</Link>
        <h1 className="text-2xl font-bold flex-1">{car.name} ({car.model_year})</h1>
        {canEdit && (
          <Link to={`/cars/${id}/edit`} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm">
            {t('app.edit')}
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {STAGE_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`whitespace-nowrap text-sm px-3 py-1 rounded-full ${
                i < stageIndex ? 'bg-green-100 text-green-700' :
                i === stageIndex ? 'bg-blue-100 text-blue-700 font-medium' :
                'bg-gray-100 text-gray-400'
              }`}>{t(STAGE_LABELS[s])}</span>
              {i < STAGE_ORDER.length - 1 && <div className="w-6 h-0.5 bg-gray-300" />}
            </div>
          ))}
        </div>

        {canEdit && car.current_stage === 'request' && !car.confirmed && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700 mb-3">{t('car.confirm_car_details')}</p>
            <button onClick={handleConfirm} className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 text-sm">
              {t('car.confirm_order')}
            </button>
          </div>
        )}

        {canEdit && car.confirmed && nextStage && !blockedToShipping && (
          <button onClick={() => handleMoveStage(nextStage)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            {t(`car.move_to_${nextStage}`)}
          </button>
        )}
        {canEdit && car.confirmed && blockedToShipping && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
            {t('car.deposit_02_required')}
          </div>
        )}

        {canEdit && car.current_stage === 'deposit' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('car.deposit_amount')}</label>
            <div className="flex gap-3 items-center">
              <input type="number" value={fees?.deposit || 0} min={0} max={car.initial_price}
                onChange={e => handleSaveFees({ deposit: Number(e.target.value) })}
                className="border rounded-lg p-2 w-48 outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-gray-500">{t('car.cannot_exceed_price')}: {car.initial_price}</span>
            </div>
          </div>
        )}

        {canEdit && car.current_stage === 'purchase' && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-800 mb-1">{t('car.deposit_02')}</label>
            <input type="number" value={fees?.deposit_02 || 0} min={0}
              onChange={e => handleSaveFees({ deposit_02: Number(e.target.value) })}
              className="border rounded-lg p-2 w-48 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4">{t('car.info')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">{t('car.serial_number')}:</span> <span className="font-mono">{car.serial_number || '-'}</span></div>
          <div><span className="text-gray-500">{t('car.license_plate')}:</span> <span>{car.license_plate || '-'}</span></div>
          <div><span className="text-gray-500">{t('car.seller_phone')}:</span> <span>{car.seller_phone || '-'}</span></div>
          <div><span className="text-gray-500">{t('car.initial_price')}:</span> <span>{car.initial_price?.toLocaleString() || '-'}</span></div>
          <div><span className="text-gray-500">{t('car.current_stage')}:</span> <span>{t(STAGE_LABELS[car.current_stage])}</span></div>
          <div><span className="text-gray-500">{t('car.confirmed')}:</span>
            <span className={car.confirmed ? 'text-green-600' : 'text-gray-400'}>{car.confirmed ? '✓' : '✗'}</span>
          </div>
        </div>
      </div>

      {requestClient && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.request_client')}</h2>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500">{t('car.client_name')}:</span> {requestClient.name}</p>
            {requestClient.phone && <p><span className="text-gray-500">{t('car.client_phone')}:</span> {requestClient.phone}</p>}
          </div>
        </div>
      )}

      {(car.current_stage === 'purchase' || car.current_stage === 'shipping_prep' || car.current_stage === 'shipping') && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.fees')}</h2>
          <div className="space-y-3">
            {(['deposit', 'deposit_02', 'transport_01', 'parking', 'other_fees', 'transport_02'] as const).map(key => (
              <div key={key} className="flex items-center gap-4">
                <label className="w-32 text-sm text-gray-600">{t(`car.${key}`)}</label>
                <input type="number" value={fees?.[key] || 0} min={0}
                  onChange={e => handleSaveFees({ [key]: Number(e.target.value) })}
                  className="border rounded-lg p-2 w-48 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="text-sm font-medium pt-2 border-t">
              {t('car.total_fees')}: {fees ? (fees.deposit + fees.deposit_02 + fees.transport_01 + fees.parking + fees.other_fees + fees.transport_02).toLocaleString() : 0}
            </div>
          </div>
        </div>
      )}

      {(car.current_stage === 'shipping_prep' || car.current_stage === 'shipping') && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.customer_info')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['full_name_latin', 'national_id', 'address_latin', 'postal_code', 'phone', 'email'] as const).map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t(`car.${key}`)}</label>
                <input value={customerData?.[key] || ''}
                  onChange={e => setCustomerData((prev: any) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          {canEdit && (
            <button onClick={handleSaveCustomer} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
              {t('app.save')}
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4">{t('car.stage_history')}</h2>
        {stageLogs.length === 0 ? (
          <p className="text-gray-400 text-sm">{t('app.no_data')}</p>
        ) : (
          <div className="space-y-2">
            {stageLogs.map(log => (
              <div key={log.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                <span className="text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{t(STAGE_LABELS[log.stage as CarStage])}</span>
                {log.notes && <span className="text-gray-600">{log.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
