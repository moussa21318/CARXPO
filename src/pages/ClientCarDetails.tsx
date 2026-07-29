import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCar, getStageLogs, getAttachments, getCustomerPayments, getClientById, getCustomerById, updateCustomer, upsertCustomer, updateCar, notifyCustomerUpdated } from '../db/cloud'
import { STAGE_ORDER, STAGE_LABELS, PAYMENT_METHOD_LABELS, type Car, type CarStageLog, type CarAttachment, type CustomerPayment, type Client, type Customer } from '../types'
import { formatPrice } from '../utils/format'

export default function ClientCarDetails() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { clientId } = useAuth()

  const [car, setCar] = useState<Car | null>(null)
  const [stageLogs, setStageLogs] = useState<CarStageLog[]>([])
  const [requestClient, setRequestClient] = useState<Client | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [attachments, setAttachments] = useState<(CarAttachment & { publicUrl: string })[]>([])
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [customerModal, setCustomerModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNationalId, setEditNationalId] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editPostal, setEditPostal] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    if (!id || !clientId) { setLoading(false); return }
    const [c, logs, attach, pays] = await Promise.all([
      getCar(id), getStageLogs(id), getAttachments(id), getCustomerPayments(id),
    ])
    if (!c || c.client_id !== clientId || c.deleted) { setLoading(false); return }
    setCar(c)
    setStageLogs(logs)
    setAttachments(attach.map(a => ({ ...a, publicUrl: '' })))
    setPayments(pays)
    if (c.client_id) getClientById(c.client_id).then(cl => setRequestClient(cl)).catch(() => {})
    getCustomerById(c.customer_id || '').then(cu => { setCustomer(cu); setEditName(cu?.full_name_latin || ''); setEditNationalId(cu?.national_id || ''); setEditAddress(cu?.address_latin || ''); setEditPostal(cu?.postal_code || ''); setEditPhone(cu?.phone || ''); setEditEmail(cu?.email || '') }).catch(() => {})
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id, clientId])

  const handleEditCustomer = async () => {
    if (!editName.trim() || !editNationalId.trim() || saving || !car) return
    setSaving(true)
    try {
      let custId = car.customer_id
      if (!custId) {
        const newCust = await upsertCustomer(editName.trim(), editNationalId.trim(), editAddress, editPostal, editPhone, editEmail)
        custId = newCust.id
        await updateCar(car.id, { customer_id: custId })
      } else {
        await updateCustomer(custId, {
          full_name_latin: editName.trim(), national_id: editNationalId.trim(),
          address_latin: editAddress, postal_code: editPostal, phone: editPhone, email: editEmail,
        })
      }
      notifyCustomerUpdated(car.id, car.name, requestClient?.name || '')
      setCustomerModal(false)
      loadData()
    } catch (e) { alert('خطأ: ' + ((e as any)?.message || String(e))) }
    setSaving(false)
  }

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>
  if (!car) return <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('app.no_data')}</div>

  const stageIndex = STAGE_ORDER.indexOf(car.current_stage)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link to="/client/cars" className="text-blue-600 dark:text-blue-400 hover:underline">{t('app.back')}</Link>
        <h1 className="text-2xl font-bold flex-1">{car.name} ({car.model_year})</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {STAGE_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`whitespace-nowrap text-sm px-3 py-1 rounded-full ${
                i < stageIndex ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                i === stageIndex ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium' :
                'bg-gray-100 text-gray-400 dark:text-gray-500'
              }`}>{t(STAGE_LABELS[s])}</span>
              {i < STAGE_ORDER.length - 1 && <div className="w-6 h-0.5 bg-gray-300 dark:bg-gray-600" />}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4">{t('car.info')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.serial_number')}:</span> <span className="font-mono">{car.serial_number || '-'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.license_plate')}:</span> <span>{car.license_plate || '-'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.color')}:</span> <span>{car.color || '-'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.seller_phone')}:</span> <span>{car.seller_phone || '-'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.initial_price')}:</span> <span>{formatPrice(car.initial_price)}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.current_stage')}:</span> <span>{t(STAGE_LABELS[car.current_stage])}</span></div>
        </div>
      </div>

      {requestClient && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.request_client')}</h2>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500 dark:text-gray-400">{t('car.client_name')}:</span> {requestClient.name}</p>
            {requestClient.phone && <p><span className="text-gray-500 dark:text-gray-400">{t('car.client_phone')}:</span> {requestClient.phone}</p>}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t('client_portal.edit_customer')}</h2>
        </div>
        {customer ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500 dark:text-gray-400">{t('customers.name')}:</span> <span>{customer.full_name_latin}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">{t('customers.national_id')}:</span> <span>{customer.national_id}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">{t('customers.address')}:</span> <span>{customer.address_latin || '-'}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">{t('customers.postal_code')}:</span> <span>{customer.postal_code || '-'}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">{t('customers.phone')}:</span> <span>{customer.phone || '-'}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">{t('customers.email')}:</span> <span>{customer.email || '-'}</span></div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('client_portal.no_customer')}</p>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.attachments')}</h2>
          <div className="space-y-2">
            {attachments.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <span>📎</span>
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('payments.car_payments')}</h2>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                <div>
                  <span className="font-medium">{formatPrice(p.amount)}</span>
                  <span className="text-gray-500 dark:text-gray-400 mr-2">{new Date(p.payment_date).toLocaleDateString()}</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400">{t(PAYMENT_METHOD_LABELS[p.payment_method])}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stageLogs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.activity_log')}</h2>
          <div className="space-y-3">
            {stageLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <span className="whitespace-nowrap text-gray-400 dark:text-gray-500 min-w-[80px]">{new Date(log.created_at).toLocaleDateString()}</span>
                <div>
                  <span className="font-medium">{t(STAGE_LABELS[log.stage])}</span>
                  {log.notes && <span className="text-gray-600 dark:text-gray-300 block">{log.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {customerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setCustomerModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('client_portal.edit_customer')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.name')} <span className="text-red-500">*</span></label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.national_id')} <span className="text-red-500">*</span></label>
              <input value={editNationalId} onChange={e => setEditNationalId(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.address')}</label>
              <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.postal_code')}</label>
              <input value={editPostal} onChange={e => setEditPostal(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.phone')}</label>
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.email')}</label>
              <input value={editEmail} onChange={e => setEditEmail(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setCustomerModal(false)}
                className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleEditCustomer} disabled={saving || !editName.trim() || !editNationalId.trim()}
                className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50">
                {saving ? t('app.loading') : t('app.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
