import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCarFees, getPaymentsForClient, getClientSettlementsByClientId, getCars } from '../db/cloud'
import { FEE_LABELS, PAYMENT_METHOD_LABELS, type CarFees } from '../types'
import { formatPrice } from '../utils/format'

interface Row {
  date: string
  designation: string
  debit: number
  credit: number
  id: string
}

const feeKeyLabels: Record<string, string> = {
  deposit: 'car.deposit_fee',
  deposit_02: 'car.deposit_02',
  transport_01: 'car.transport_01',
  parking: 'car.parking',
  other_fees: 'car.other_fees',
  transport_02: 'car.transport_02',
}

const feeDateKeys: Record<string, string> = {
  deposit: 'deposit_date',
  deposit_02: 'deposit_02_date',
  transport_01: 'transport_01_date',
  parking: 'parking_date',
  other_fees: 'other_fees_date',
  transport_02: 'transport_02_date',
}

export default function ClientPayments() {
  const { t } = useTranslation()
  const { clientId } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) { setLoading(false); return }
    const load = async () => {
      const [cars, settlements] = await Promise.all([
        getCars(), getClientSettlementsByClientId(clientId),
      ])
      const myCars = cars.filter(c => c.client_id === clientId)
      const carIds = myCars.map(c => c.id)
      const payments = await getPaymentsForClient(clientId, carIds)
      const result: Row[] = []

      for (const car of myCars) {
        if (car.deleted) continue
        const fees: CarFees | null = await getCarFees(car.id)
        if (!fees) continue
        for (const key of FEE_LABELS) {
          const amount = Number(fees[key]) || 0
          if (amount <= 0) continue
          const dateKey = feeDateKeys[key]
          const date = (fees as any)[dateKey] as string | null
          result.push({
            date: date || new Date().toISOString().slice(0, 10),
            designation: `${car.name}${car.code ? ' (' + car.code + ')' : ''} - ${t(feeKeyLabels[key] || key)}`,
            debit: amount,
            credit: 0,
            id: `fee_${car.id}_${key}`,
          })
        }
      }

      for (const p of payments) {
        const car = myCars.find(c => c.id === p.car_id)
        const label = p.car_id ? (car ? car.name : '') : t('payments.general_settlement')
        result.push({
          date: p.payment_date.slice(0, 10),
          designation: label ? `${label} - ${t(PAYMENT_METHOD_LABELS[p.payment_method])}` : t(PAYMENT_METHOD_LABELS[p.payment_method]),
          debit: 0,
          credit: p.amount,
          id: `pay_${p.id}`,
        })
      }

      for (const s of settlements) {
        result.push({
          date: s.created_at.slice(0, 10),
          designation: `تسوية حذف: ${s.car_name || ''} - ${s.fee_type}`,
          debit: s.amount,
          credit: 0,
          id: `stl_${s.id}`,
        })
      }

      result.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      setRows(result)
      setLoading(false)
    }
    load()
  }, [clientId, t])

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const balance = totalCredit - totalDebit

  let running = 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t('payments.title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('payments.debt')}</p>
          <p className="text-xl font-bold text-red-600">{formatPrice(totalDebit)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('payments.total_paid')}</p>
          <p className="text-xl font-bold text-green-600">{formatPrice(totalCredit)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('payments.balance')}</p>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPrice(balance)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('app.no_data')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="p-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.date')}</th>
                <th className="p-3 text-right text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.designation')}</th>
                <th className="p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.debit')}</th>
                <th className="p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.credit')}</th>
                <th className="p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-300">{t('payments.avoir')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                running = running - r.debit + r.credit
                return (
                  <tr key={r.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{r.date}</td>
                    <td className="p-3 text-right text-sm text-gray-700 dark:text-gray-300">{r.designation}</td>
                    <td className="p-3 text-center text-sm text-red-600">{r.debit > 0 ? formatPrice(r.debit) : ''}</td>
                    <td className="p-3 text-center text-sm text-green-600">{r.credit > 0 ? formatPrice(r.credit) : ''}</td>
                    <td className="p-3 text-center text-sm font-mono text-gray-800 dark:text-gray-200">{formatPrice(running)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
