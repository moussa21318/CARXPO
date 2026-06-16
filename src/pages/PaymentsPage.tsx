import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCars, getCustomers, getAllCarFees, getCustomerPayments, createCustomerPayment, getClient } from '../db/cloud'
import { PAYMENT_METHOD_LABELS, type Car, type CarFees, type Customer, type CustomerPayment, type PaymentMethod } from '../types'
import { formatPrice } from '../utils/format'
import { uploadFile } from '../utils/upload'

interface CustomerAccount {
  customer: Customer
  car: Car
  fees: CarFees | null
  payments: CustomerPayment[]
  totalFees: number
  totalPaid: number
  debt: number
}

export default function PaymentsPage() {
  const { t } = useTranslation()
  const { user, canEdit } = useAuth()
  const [accounts, setAccounts] = useState<CustomerAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [quickPayOpen, setQuickPayOpen] = useState(false)
  const [quickPayCarId, setQuickPayCarId] = useState('')
  const [quickPayAmount, setQuickPayAmount] = useState(0)
  const [quickPayDate, setQuickPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [quickPayMethod, setQuickPayMethod] = useState<PaymentMethod>('cash')
  const [quickPayReceipt, setQuickPayReceipt] = useState<File | null>(null)
  const [quickPayNotes, setQuickPayNotes] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailAccount, setDetailAccount] = useState<CustomerAccount | null>(null)

  const loadData = async () => {
    setLoading(true)
    const [cars, customers, allFees] = await Promise.all([
      getCars(), getCustomers(), getAllCarFees(),
    ])
    const allAccounts: CustomerAccount[] = []
    for (const cust of customers) {
      const car = cars.find(c => c.id === cust.car_id)
      if (!car) continue
      const fees = allFees.find(f => f.car_id === car.id) || null
      const payments = await getCustomerPayments(car.id)
      const totalFees = fees ? fees.deposit + fees.deposit_02 + fees.transport_01 + fees.parking + fees.other_fees + fees.transport_02 : 0
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
      allAccounts.push({ customer: cust, car, fees, payments, totalFees, totalPaid, debt: totalFees - totalPaid })
    }
    setAccounts(allAccounts)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleQuickPay = async () => {
    if (!user || !quickPayCarId || quickPayAmount <= 0) return
    let receiptUrl: string | null = null
    if (quickPayReceipt) {
      const result = await uploadFile('car_attachments', `receipts/${quickPayCarId}`, quickPayReceipt)
      receiptUrl = result.storagePath
    }
    await createCustomerPayment({
      car_id: quickPayCarId,
      amount: quickPayAmount,
      payment_date: quickPayDate,
      payment_method: quickPayMethod,
      receipt_url: receiptUrl,
      notes: quickPayNotes,
      created_by: user.id,
    })
    setQuickPayOpen(false)
    setQuickPayCarId('')
    setQuickPayAmount(0)
    setQuickPayDate(new Date().toISOString().slice(0, 10))
    setQuickPayMethod('cash')
    setQuickPayReceipt(null)
    setQuickPayNotes('')
    loadData()
  }

  const openDetail = async (acc: CustomerAccount) => {
    const payments = await getCustomerPayments(acc.car.id)
    setDetailAccount({ ...acc, payments })
    setDetailOpen(true)
  }

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{t('payments.title')}</h1>
        {canEdit && (
          <button onClick={() => setQuickPayOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
            + {t('payments.quick_add')}
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('app.no_data')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.customer_info')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.name')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('car.total_fees')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.total_paid')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.debt')}</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('app.details')}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.customer.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-3">
                    <div className="text-sm font-medium">{acc.customer.full_name_latin}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{acc.customer.phone}</div>
                  </td>
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-300">{acc.car.name} ({acc.car.model_year})</td>
                  <td className="p-3 text-sm">{formatPrice(acc.totalFees)}</td>
                  <td className="p-3 text-sm text-green-600 dark:text-green-400">{formatPrice(acc.totalPaid)}</td>
                  <td className="p-3 text-sm">
                    <span className={`font-semibold ${acc.debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {acc.debt > 0 ? formatPrice(acc.debt) : '₩0'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button onClick={() => openDetail(acc)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm">{t('app.details')}</button>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.name')}</label>
              <select value={quickPayCarId} onChange={e => setQuickPayCarId(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                <option value="">{t('app.select')}</option>
                {accounts.map(acc => (
                  <option key={acc.car.id} value={acc.car.id}>{acc.car.name} — {acc.customer.full_name_latin}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.amount')}</label>
              <input type="number" value={quickPayAmount || ''} onChange={e => setQuickPayAmount(Number(e.target.value))} min={0}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.date')}</label>
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
              <button onClick={handleQuickPay} disabled={!quickPayCarId || quickPayAmount <= 0}
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
            <h2 className="text-lg font-semibold">{detailAccount.customer.full_name_latin}</h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">{detailAccount.car.name} ({detailAccount.car.model_year})</div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('car.total_fees')}</div>
                <div className="font-semibold">{formatPrice(detailAccount.totalFees)}</div>
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
    </div>
  )
}