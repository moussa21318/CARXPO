import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCars, getAllRequestClients, getAllCarFees, getCustomerPayments, getGeneralPayments, createCustomerPayment, updateCustomerPayment, deleteCustomerPayment, getClient } from '../db/cloud'
import { PAYMENT_METHOD_LABELS, type Car, type CarFees, type RequestClient, type CustomerPayment, type PaymentMethod } from '../types'
import { formatPrice } from '../utils/format'
import { uploadFile } from '../utils/upload'

interface CustomerAccount {
  requestClient: RequestClient | null
  car: Car | null
  fees: CarFees | null
  payments: CustomerPayment[]
  totalFees: number
  totalPaid: number
  debt: number
  notes: string
}

export default function PaymentsPage() {
  const { t } = useTranslation()
  const { user, canEdit } = useAuth()
  const [accounts, setAccounts] = useState<CustomerAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [quickPayOpen, setQuickPayOpen] = useState(false)
  const [quickPayClientName, setQuickPayClientName] = useState('')
  const [quickPayCarId, setQuickPayCarId] = useState('')
  const [quickPayAmount, setQuickPayAmount] = useState(0)
  const [quickPayDate, setQuickPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [quickPayMethod, setQuickPayMethod] = useState<PaymentMethod>('cash')
  const [quickPayReceipt, setQuickPayReceipt] = useState<File | null>(null)
  const [quickPayNotes, setQuickPayNotes] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailAccount, setDetailAccount] = useState<CustomerAccount | null>(null)
  const [editPayment, setEditPayment] = useState<CustomerPayment | null>(null)
  const [editAmount, setEditAmount] = useState(0)
  const [editDate, setEditDate] = useState('')
  const [editMethod, setEditMethod] = useState<PaymentMethod>('cash')
  const [editNotes, setEditNotes] = useState('')
  const [editReceipt, setEditReceipt] = useState<File | null>(null)

  // Filter states
  const [filterClient, setFilterClient] = useState('')
  const [filterCar, setFilterCar] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      if (filterClient && acc.requestClient?.name) {
        if (!acc.requestClient.name.toLowerCase().includes(filterClient.toLowerCase())) return false
      }
      if (filterCar && acc.car?.name) {
        if (!acc.car.name.toLowerCase().includes(filterCar.toLowerCase())) return false
      }
      if (filterStatus === 'in_debt' && acc.debt <= 0) return false
      if (filterStatus === 'settled' && acc.debt > 0) return false
      if (filterStatus === 'general' && acc.car) return false
      if (filterDateFrom || filterDateTo) {
        const hasPaymentInRange = acc.payments.some(p => {
          if (filterDateFrom && p.payment_date < filterDateFrom) return false
          if (filterDateTo && p.payment_date > filterDateTo) return false
          return true
        })
        if (!hasPaymentInRange) return false
      }
      return true
    })
  }, [accounts, filterClient, filterCar, filterStatus, filterDateFrom, filterDateTo])

  const loadData = async () => {
    setLoading(true)
    const [cars, requestClients, allFees] = await Promise.all([
      getCars(), getAllRequestClients(), getAllCarFees(),
    ])
    const allAccounts: CustomerAccount[] = []
    for (const rc of requestClients) {
      const car = cars.find(c => c.id === rc.car_id)
      if (!car) continue
      const fees = allFees.find(f => f.car_id === car.id) || null
      const payments = await getCustomerPayments(car.id)
      const totalFees = fees ? fees.deposit + fees.deposit_02 + fees.transport_01 + fees.parking + fees.other_fees + fees.transport_02 : 0
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
      allAccounts.push({ requestClient: rc, car, fees, payments, totalFees, totalPaid, debt: totalFees - totalPaid, notes: '' })
    }
    const generalPayments = await getGeneralPayments()
    if (generalPayments.length > 0) {
      const totalPaid = generalPayments.reduce((s, p) => s + p.amount, 0)
      const combinedNotes = generalPayments.map(p => p.notes).filter(Boolean).join('; ')
      allAccounts.push({
        requestClient: null,
        car: null,
        fees: null,
        payments: generalPayments,
        totalFees: 0,
        totalPaid,
        debt: -totalPaid,
        notes: combinedNotes || t('payments.general_settlement'),
      })
    }
    setAccounts(allAccounts)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleQuickPay = async () => {
    if (!user || !quickPayClientName || quickPayAmount <= 0) return
    let receiptUrl: string | null = null
    const carId = quickPayCarId || null
    if (quickPayReceipt) {
      const result = await uploadFile('car_attachments', carId ? `receipts/${carId}` : 'receipts/general', quickPayReceipt)
      receiptUrl = result.storagePath
    }
    await createCustomerPayment({
      car_id: carId,
      amount: quickPayAmount,
      payment_date: quickPayDate,
      payment_method: quickPayMethod,
      receipt_url: receiptUrl,
      notes: quickPayNotes,
      created_by: user.id,
    })
    setQuickPayOpen(false)
    setQuickPayClientName('')
    setQuickPayCarId('')
    setQuickPayAmount(0)
    setQuickPayDate(new Date().toISOString().slice(0, 10))
    setQuickPayMethod('cash')
    setQuickPayReceipt(null)
    setQuickPayNotes('')
    loadData()
  }

  const clientNames = [...new Set(accounts.filter(a => a.requestClient).map(a => a.requestClient!.name))]
  const filteredCars = quickPayClientName
    ? accounts.filter(a => a.requestClient?.name === quickPayClientName && a.car)
    : []

  const openDetail = async (acc: CustomerAccount) => {
    if (acc.car) {
      const payments = await getCustomerPayments(acc.car.id)
      setDetailAccount({ ...acc, payments })
    } else {
      setDetailAccount(acc)
    }
    setDetailOpen(true)
  }

  const openEditPayment = (payment: CustomerPayment) => {
    setEditPayment(payment)
    setEditAmount(payment.amount)
    setEditDate(payment.payment_date)
    setEditMethod(payment.payment_method)
    setEditNotes(payment.notes)
    setEditReceipt(null)
  }

  const handleUpdatePayment = async () => {
    if (!editPayment) return
    let receiptUrl = editPayment.receipt_url
    if (editReceipt) {
      const receiptPath = editPayment.car_id ? `receipts/${editPayment.car_id}` : 'receipts/general'
      const result = await uploadFile('car_attachments', receiptPath, editReceipt)
      receiptUrl = result.storagePath
    }
    await updateCustomerPayment(editPayment.id, {
      amount: editAmount,
      payment_date: editDate,
      payment_method: editMethod,
      notes: editNotes,
      receipt_url: receiptUrl,
    })
    setEditPayment(null)
    loadData()
  }

  const handleDeletePayment = async (payment: CustomerPayment) => {
    await deleteCustomerPayment(payment.id, payment.receipt_url || undefined)
    loadData()
    if (detailOpen && detailAccount) {
      if (detailAccount.car) {
        const payments = await getCustomerPayments(detailAccount.car.id)
        setDetailAccount({ ...detailAccount, payments })
      } else {
        setDetailAccount({ ...detailAccount, payments: detailAccount.payments.filter(p => p.id !== payment.id) })
      }
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{t('payments.title')}</h1>
        {canEdit && (
          <button onClick={() => { setQuickPayClientName(''); setQuickPayCarId(''); setQuickPayAmount(0); setQuickPayDate(new Date().toISOString().slice(0, 10)); setQuickPayMethod('cash'); setQuickPayReceipt(null); setQuickPayNotes(''); setQuickPayOpen(true) }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
            + {t('payments.quick_add')}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <input type="text" value={filterClient} onChange={e => setFilterClient(e.target.value)}
          placeholder={t('payments.filter_client')}
          className="flex-1 min-w-[160px] p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <input type="text" value={filterCar} onChange={e => setFilterCar(e.target.value)}
          placeholder={t('payments.filter_car')}
          className="flex-1 min-w-[160px] p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="min-w-[130px] p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="all">{t('payments.filter_all')}</option>
          <option value="in_debt">{t('payments.filter_in_debt')}</option>
          <option value="settled">{t('payments.filter_settled')}</option>
          <option value="general">{t('payments.filter_general')}</option>
        </select>
        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
          title={t('payments.filter_from_date')}
          className="min-w-[140px] p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
          title={t('payments.filter_to_date')}
          className="min-w-[140px] p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
      </div>

      {filteredAccounts.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('app.no_data')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.request_client')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.name')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.total_fees')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.total_paid')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.debt')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.notes_column')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('app.details')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map(acc => (
                <tr key={acc.car?.id || 'general'} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-3 text-right text-sm text-gray-700 dark:text-gray-300">
                    {acc.requestClient ? (
                      <span className="font-medium">{acc.requestClient.name}</span>
                    ) : (
                      <span className="text-gray-400">{t('payments.no_client')}</span>
                    )}
                  </td>
                  <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300">{acc.car ? `${acc.car.name} (${acc.car.model_year})` : '—'}</td>
                  <td className="p-3 text-right text-sm text-gray-700 dark:text-gray-300">{acc.car ? formatPrice(acc.totalFees) : '—'}</td>
                  <td className="p-3 text-right text-sm text-green-600 dark:text-green-400">{formatPrice(acc.totalPaid)}</td>
                  <td className="p-3 text-right text-sm">
                    <span className={`font-semibold ${acc.debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {acc.debt > 0 ? formatPrice(acc.debt) : acc.debt < 0 ? `-${formatPrice(Math.abs(acc.debt))}` : '₩0'}
                    </span>
                  </td>
                  <td className="p-3 text-right text-sm text-gray-500 dark:text-gray-400 max-w-[150px] truncate">{acc.notes || '—'}</td>
                  <td className="p-3 text-right text-sm">
                    <button onClick={() => openDetail(acc)}
                      className="text-blue-600 dark:text-blue-400 hover:underline">{t('app.details')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {quickPayOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setQuickPayOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('payments.quick_add')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.client_name')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
              <select value={quickPayClientName} onChange={e => { setQuickPayClientName(e.target.value); setQuickPayCarId('') }}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                <option value="">{t('app.select')}</option>
                {clientNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.name')}</label>
              <select value={quickPayCarId} onChange={e => setQuickPayCarId(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                <option value="">{t('payments.general_settlement')}</option>
                {filteredCars.map(acc => (
                  <option key={acc.car!.id} value={acc.car!.id}>{acc.car!.name} ({acc.car!.model_year})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.amount')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
              <input type="number" value={quickPayAmount || ''} onChange={e => setQuickPayAmount(Number(e.target.value))} min={0}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.date')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
              <input type="date" value={quickPayDate} onChange={e => setQuickPayDate(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.method')}</label>
              <select value={quickPayMethod} onChange={e => setQuickPayMethod(e.target.value as PaymentMethod)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                {(['cash', 'bank_transfer', 'check', 'credit_card'] as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>{t(PAYMENT_METHOD_LABELS[m])}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.receipt')}</label>
              <input type="file" onChange={e => setQuickPayReceipt(e.target.files?.[0] || null)}
                accept="image/*,.pdf" className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.notes')}</label>
              <textarea value={quickPayNotes} onChange={e => setQuickPayNotes(e.target.value)}
                rows={2} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setQuickPayOpen(false)}
                className="flex-1 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleQuickPay} disabled={!quickPayClientName || quickPayAmount <= 0}
                className="flex-1 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm transition-colors disabled:opacity-50">
                {t('app.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && detailAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setDetailOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-lg p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{detailAccount.requestClient ? detailAccount.requestClient.name : (detailAccount.car ? detailAccount.car.name : t('payments.general_settlement'))}</h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">{detailAccount.car ? `${detailAccount.car.name} (${detailAccount.car.model_year})` : detailAccount.notes}</div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('car.total_fees')}</div>
                <div className="font-semibold">{detailAccount.car ? formatPrice(detailAccount.totalFees) : '—'}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('payments.total_paid')}</div>
                <div className="font-semibold text-green-700 dark:text-green-300">{formatPrice(detailAccount.totalPaid)}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('payments.debt')}</div>
                <div className={`font-semibold ${detailAccount.debt > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                  {formatPrice(detailAccount.debt)}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t('payments.payment_history')}</h3>
              {detailAccount.payments.length === 0 ? (
                <p className="text-gray-400 text-sm">{t('app.no_data')}</p>
              ) : (
                detailAccount.payments.map(p => (
                  <div key={p.id} className="flex items-center gap-3 text-sm border-b dark:border-gray-700 pb-2 flex-wrap">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">{p.payment_date}</span>
                    <span className="font-semibold text-green-700 dark:text-green-300">{formatPrice(p.amount)}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{t(PAYMENT_METHOD_LABELS[p.payment_method])}</span>
                    {p.receipt_url && (
                      <a href={getClient().storage.from('car_attachments').getPublicUrl(p.receipt_url).data.publicUrl}
                        target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs">{t('payments.receipt')}</a>
                    )}
                    {p.notes && <span className="text-gray-500 dark:text-gray-400 text-xs">{p.notes}</span>}
                    {user?.role === 'admin' && (
                      <>
                        <button onClick={() => openEditPayment(p)}
                          className="text-blue-500 hover:text-blue-700 text-xs px-1">✎</button>
                        <button onClick={() => handleDeletePayment(p)}
                          className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setDetailOpen(false)}
              className="w-full p-3 bg-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-sm transition-colors">
              {t('app.close')}
            </button>
          </div>
        </div>
      )}

      {editPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setEditPayment(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('payments.edit')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.amount')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
              <input type="number" value={editAmount || ''} onChange={e => setEditAmount(Number(e.target.value))} min={0}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.date')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.method')}</label>
              <select value={editMethod} onChange={e => setEditMethod(e.target.value as PaymentMethod)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                {(['cash', 'bank_transfer', 'check', 'credit_card'] as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>{t(PAYMENT_METHOD_LABELS[m])}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.receipt')}</label>
              <input type="file" onChange={e => setEditReceipt(e.target.files?.[0] || null)}
                accept="image/*,.pdf" className="w-full text-sm" />
              {editPayment.receipt_url && (
                <p className="text-xs text-gray-500 mt-1">{t('payments.current_receipt')}: <a href={getClient().storage.from('car_attachments').getPublicUrl(editPayment.receipt_url).data.publicUrl}
                  target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t('payments.receipt')}</a></p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.notes')}</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                rows={2} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditPayment(null)}
                className="flex-1 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleUpdatePayment} disabled={editAmount <= 0}
                className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50">
                {t('app.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}