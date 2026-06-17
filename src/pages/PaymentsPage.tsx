import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCars, getAllRequestClients, getAllCarFees, getGeneralPayments, getAllCustomerPayments, createCustomerPayment, updateCustomerPayment, deleteCustomerPayment, getClient } from '../db/cloud'
import { PAYMENT_METHOD_LABELS, FEE_LABELS, type Car, type CustomerPayment, type PaymentMethod } from '../types'
import { formatPrice } from '../utils/format'
import { uploadFile } from '../utils/upload'
import * as XLSX from 'xlsx'

interface TransactionRow {
  id: string
  date: string
  clientName: string
  clientId: string | null
  carId: string | null
  carCode: string | null
  designation: string
  debit: number
  credit: number
  paymentMethod?: string
  paymentNotes?: string
  paymentReceipt?: string
  isGeneral: boolean
  sourcePayment?: CustomerPayment
}

interface ClientDetail {
  clientName: string
  clientId: string | null
  car: Car | null
  rows: TransactionRow[]
}

export default function PaymentsPage() {
  const { t, i18n } = useTranslation()
  const { user, canEdit } = useAuth()
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
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
  const [detailClient, setDetailClient] = useState<ClientDetail | null>(null)
  const [editPayment, setEditPayment] = useState<CustomerPayment | null>(null)
  const [editAmount, setEditAmount] = useState(0)
  const [editDate, setEditDate] = useState('')
  const [editMethod, setEditMethod] = useState<PaymentMethod>('cash')
  const [editNotes, setEditNotes] = useState('')
  const [editReceipt, setEditReceipt] = useState<File | null>(null)

  const [filterClient, setFilterClient] = useState('')
  const [filterCar, setFilterCar] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const [exportDateFrom, setExportDateFrom] = useState('')
  const [exportDateTo, setExportDateTo] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [cars, requestClients, allFees, allPayments, generalPayments] = await Promise.all([
      getCars(), getAllRequestClients(), getAllCarFees(), getAllCustomerPayments(), getGeneralPayments(),
    ])
    const rcMap = new Map(requestClients.map(rc => [rc.car_id, rc]))
    const feeMap = new Map(allFees.map(f => [f.car_id, f]))
    const carMap = new Map(cars.map(c => [c.id, c]))
    const rows: TransactionRow[] = []

    const addFeeRow = (date: string, clientName: string, clientId: string | null, carId: string, carCode: string | null, designation: string, amount: number) => {
      if (amount <= 0) return
      rows.push({
        id: `fee-${carId}-${designation}-${date}`,
        date: date || new Date().toISOString().slice(0, 10),
        clientName,
        clientId,
        carId,
        carCode,
        designation: carCode ? `${designation} (${carCode})` : designation,
        debit: amount,
        credit: 0,
        isGeneral: false,
      })
    }

    const addPaymentRow = (payment: CustomerPayment) => {
      const rc = payment.car_id ? rcMap.get(payment.car_id) : null
      const car = payment.car_id ? carMap.get(payment.car_id) : null
      const clientName = rc?.name || (payment as any).client_name || ''
      const paymentLabel = payment.car_id ? (car?.code ? `${t('payments.add')} (${car.code})` : t('payments.add')) : t('payments.general_settlement')
      rows.push({
        id: `pay-${payment.id}`,
        date: payment.payment_date,
        clientName,
        clientId: rc?.id || null,
        carId: payment.car_id,
        carCode: car?.code || null,
        designation: paymentLabel,
        debit: 0,
        credit: payment.amount,
        paymentMethod: payment.payment_method,
        paymentNotes: payment.notes,
        paymentReceipt: payment.receipt_url || undefined,
        isGeneral: !payment.car_id,
        sourcePayment: payment,
      })
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

    for (const rc of requestClients) {
      const car = carMap.get(rc.car_id)
      if (!car) continue
      const fees = feeMap.get(rc.car_id)
      if (!fees) continue
      for (const key of FEE_LABELS) {
        const amount = fees[key] as number
        if (amount <= 0) continue
        const dateKey = feeDateKeys[key]
        const date = (fees as any)[dateKey] as string | null
        addFeeRow(date || new Date().toISOString().slice(0, 10), rc.name, rc.id, car.id, car.code, t(feeKeyLabels[key] || key), amount)
      }
    }

    for (const payment of allPayments) {
      addPaymentRow(payment)
    }
    for (const payment of generalPayments) {
      addPaymentRow(payment)
    }

    rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    setTransactions(rows)
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

  const clientNames = [...new Set(transactions.filter(r => r.clientName).map(r => r.clientName))]
  const clientCars = quickPayClientName
    ? [...new Map(transactions.filter(r => r.clientName === quickPayClientName && r.carId).map(r => [r.carId, { id: r.carId!, code: r.carCode }])).values()]
    : []

  const openDetail = (row: TransactionRow) => {
    const clientRows = transactions.filter(r => r.clientId === row.clientId && (!row.clientId || r.carId === row.carId))
    setDetailClient({ clientName: row.clientName, clientId: row.clientId, car: null, rows: clientRows })
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
    if (detailOpen && detailClient) {
      setDetailClient({
        ...detailClient,
        rows: detailClient.rows.filter(r => r.sourcePayment?.id !== payment.id),
      })
    }
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter(r => {
      if (filterClient && !r.clientName.toLowerCase().includes(filterClient.toLowerCase())) return false
      if (filterCar && r.carCode && !r.carCode.toLowerCase().includes(filterCar.toLowerCase())) return false
      if (filterCar && !r.carCode && !r.designation.toLowerCase().includes(filterCar.toLowerCase())) return false
      if (filterStatus === 'in_debt' && r.debit <= 0) return false
      if (filterStatus === 'settled' && r.credit <= 0) return false
      if (filterStatus === 'general' && !r.isGeneral) return false
      if (filterDateFrom && r.date < filterDateFrom) return false
      if (filterDateTo && r.date > filterDateTo) return false
      return true
    })
  }, [transactions, filterClient, filterCar, filterStatus, filterDateFrom, filterDateTo])

  const rowsWithBalance = useMemo(() => {
    let balance = 0
    return filteredTransactions.map(r => {
      balance = balance - r.debit + r.credit
      return { ...r, avoir: balance }
    })
  }, [filteredTransactions])

  const isRtl = i18n.language === 'ar'

  const colDefs = [
    { key: 'date', label: t('payments.date') },
    { key: 'designation', label: t('payments.designation') },
    { key: 'client', label: t('car.request_client') },
    { key: 'debit', label: t('payments.debit') },
    { key: 'credit', label: t('payments.credit') },
    { key: 'avoir', label: t('payments.avoir') },
  ]
  const displayCols = isRtl ? [...colDefs].reverse() : colDefs

  const detailCols = isRtl
    ? [
        { key: 'avoir', label: t('payments.avoir') },
        { key: 'credit', label: t('payments.credit') },
        { key: 'debit', label: t('payments.debit') },
        { key: 'designation', label: t('payments.designation') },
        { key: 'date', label: t('payments.date') },
      ]
    : [
        { key: 'date', label: t('payments.date') },
        { key: 'designation', label: t('payments.designation') },
        { key: 'debit', label: t('payments.debit') },
        { key: 'credit', label: t('payments.credit') },
        { key: 'avoir', label: t('payments.avoir') },
      ]

  const handleExportExcel = () => {
    const header = displayCols.map(c => c.label)
    const data = rowsWithBalance.map(r => displayCols.map(c => {
      if (c.key === 'date') return r.date
      if (c.key === 'designation') return r.designation
      if (c.key === 'client') return r.clientName
      if (c.key === 'debit') return r.debit || ''
      if (c.key === 'credit') return r.credit || ''
      if (c.key === 'avoir') return r.avoir
      return ''
    }))
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Statement')
    XLSX.writeFile(wb, `statement-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleExportPdf = () => {
    const rowsHtml = rowsWithBalance.map(r => `
      <tr>
        ${displayCols.map(c => {
          let val = ''
          if (c.key === 'date') val = r.date
          else if (c.key === 'designation') val = r.designation
          else if (c.key === 'client') val = r.clientName
          else if (c.key === 'debit') val = r.debit ? formatPrice(r.debit) : ''
          else if (c.key === 'credit') val = r.credit ? formatPrice(r.credit) : ''
          else if (c.key === 'avoir') val = formatPrice(r.avoir)
          return `<td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${val}</td>`
        }).join('')}
      </tr>
    `).join('')
    const printWin = window.open('', '_blank')
    if (!printWin) return
    const pdfDir = isRtl ? 'rtl' : 'ltr'
    printWin.document.write(`
      <!DOCTYPE html><html dir="${pdfDir}"><head><meta charset="utf-8"><title>${t('payments.title')}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:30px;direction:${pdfDir}}
        h2{margin-bottom:20px}
        table{width:100%;border-collapse:collapse}
        th{background:#eee;padding:8px;border:1px solid #ddd;text-align:center;font-size:13px}
        td{font-size:12px}
      </style></head><body>
      <h2>${t('payments.title')}</h2>
      <table>
        <thead><tr>
          ${displayCols.map(c => `<th>${c.label}</th>`).join('')}
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="${displayCols.length}" style="text-align:center;color:#999;padding:20px">${t('app.no_data')}</td></tr>`}</tbody>
      </table>
      <script>window.onload=function(){setTimeout(function(){window.print();window.close()},500)}<\/script>
    </body></html>`)
    printWin.document.close()
  }

  const handleExportDetailExcel = (client: ClientDetail) => {
    let rows = client.rows
    if (exportDateFrom) rows = rows.filter(r => r.date >= exportDateFrom)
    if (exportDateTo) rows = rows.filter(r => r.date <= exportDateTo)
    let balance = 0
    const header = detailCols.map(c => c.label)
    const data = rows.map(r => {
      balance = balance - r.debit + r.credit
      return detailCols.map(c => {
        if (c.key === 'date') return r.date
        if (c.key === 'designation') return r.designation
        if (c.key === 'debit') return r.debit || ''
        if (c.key === 'credit') return r.credit || ''
        if (c.key === 'avoir') return balance
        return ''
      })
    })
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Client')
    XLSX.writeFile(wb, `client-${client.clientName || 'general'}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleExportDetailPdf = (client: ClientDetail) => {
    let rows = client.rows
    if (exportDateFrom) rows = rows.filter(r => r.date >= exportDateFrom)
    if (exportDateTo) rows = rows.filter(r => r.date <= exportDateTo)
    let balance = 0
    const rowsHtml = rows.map(r => {
      balance = balance - r.debit + r.credit
      return `<tr>
        ${detailCols.map(c => {
          let val = ''
          if (c.key === 'date') val = r.date
          else if (c.key === 'designation') val = r.designation
          else if (c.key === 'debit') val = r.debit ? formatPrice(r.debit) : ''
          else if (c.key === 'credit') val = r.credit ? formatPrice(r.credit) : ''
          else if (c.key === 'avoir') val = formatPrice(balance)
          return `<td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${val}</td>`
        }).join('')}
      </tr>`
    }).join('')
    const printWin = window.open('', '_blank')
    if (!printWin) return
    const pdfDir = isRtl ? 'rtl' : 'ltr'
    printWin.document.write(`
      <!DOCTYPE html><html dir="${pdfDir}"><head><meta charset="utf-8"><title>${client.clientName}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:30px;direction:${pdfDir}}
        h2{margin:0;font-size:20px}
        .sub{color:#666;margin:4px 0 20px;font-size:14px}
        table{width:100%;border-collapse:collapse}
        th{background:#eee;padding:8px;border:1px solid #ddd;text-align:center;font-size:13px}
        td{font-size:12px}
      </style></head><body>
      <h2>${client.clientName}</h2>
      <table>
        <thead><tr>
          ${detailCols.map(c => `<th>${c.label}</th>`).join('')}
        </tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="${detailCols.length}" style="text-align:center;color:#999;padding:20px">${t('app.no_data')}</td></tr>`}</tbody>
      </table>
      <script>window.onload=function(){setTimeout(function(){window.print();window.close()},500)}<\/script>
    </body></html>`)
    printWin.document.close()
  }

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">{t('payments.title')}</h1>
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={() => { setQuickPayClientName(''); setQuickPayCarId(''); setQuickPayAmount(0); setQuickPayDate(new Date().toISOString().slice(0, 10)); setQuickPayMethod('cash'); setQuickPayReceipt(null); setQuickPayNotes(''); setQuickPayOpen(true) }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
              + {t('payments.quick_add')}
            </button>
          )}
          <button onClick={handleExportExcel}
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 text-sm">
            {t('payments.export_excel')}
          </button>
          <button onClick={handleExportPdf}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
            {t('payments.export_pdf')}
          </button>
        </div>
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

      {rowsWithBalance.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('app.no_data')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[800px]" dir={isRtl ? 'rtl' : 'ltr'}>
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                {displayCols.map(c => (
                  <th key={c.key} className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsWithBalance.map(r => (
                <tr key={r.id} onClick={() => openDetail(r)}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  {displayCols.map(c => {
                    let val: React.ReactNode = ''
                    if (c.key === 'date') val = r.date
                    else if (c.key === 'designation') val = r.designation
                    else if (c.key === 'client') val = r.clientName || '—'
                    else if (c.key === 'debit') val = <span className="text-red-600 dark:text-red-400">{r.debit ? formatPrice(r.debit) : ''}</span>
                    else if (c.key === 'credit') val = <span className="text-green-600 dark:text-green-400">{r.credit ? formatPrice(r.credit) : ''}</span>
                    else if (c.key === 'avoir') val = <span className="font-semibold text-gray-800 dark:text-gray-200">{formatPrice(r.avoir)}</span>
                    return <td key={c.key} className="p-3 text-right text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{val}</td>
                  })}
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
                {clientCars.map(c => (
                  <option key={c.id} value={c.id}>{c.code || c.id}</option>
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

      {detailOpen && detailClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setDetailOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-lg p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{detailClient.clientName || t('payments.general_settlement')}</h2>
            <div className="border-t dark:border-gray-700 pt-3">
              <h3 className="text-sm font-medium mb-2">{t('export.title')}</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <input type="date" value={exportDateFrom} onChange={e => setExportDateFrom(e.target.value)}
                  title={t('payments.export_from')}
                  className="flex-1 min-w-[100px] p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <input type="date" value={exportDateTo} onChange={e => setExportDateTo(e.target.value)}
                  title={t('payments.export_to')}
                  className="flex-1 min-w-[100px] p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                <button onClick={() => handleExportDetailExcel(detailClient)}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                  {t('payments.export_excel')}
                </button>
                <button onClick={() => handleExportDetailPdf(detailClient)}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                  {t('payments.export_pdf')}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]" dir={isRtl ? 'rtl' : 'ltr'}>
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                  <tr>
                    {detailCols.map(c => (
                      <th key={c.key} className="text-right p-2 text-sm font-medium text-gray-600 dark:text-gray-300">{c.label}</th>
                    ))}
                    {user?.role === 'admin' && <th className="text-center p-2 text-sm font-medium text-gray-600 dark:text-gray-300">{t('app.edit')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let balance = 0
                    let rows = detailClient.rows
                    if (exportDateFrom) rows = rows.filter(r => r.date >= exportDateFrom)
                    if (exportDateTo) rows = rows.filter(r => r.date <= exportDateTo)
                    return rows.map(r => {
                      balance = balance - r.debit + r.credit
                      return (
                        <tr key={r.id} className="border-b dark:border-gray-700">
                          {detailCols.map(c => {
                            let val: React.ReactNode = ''
                            if (c.key === 'date') val = <span className="whitespace-nowrap">{r.date}</span>
                            else if (c.key === 'designation') val = r.designation
                            else if (c.key === 'debit') val = <span className="text-red-600 dark:text-red-400">{r.debit ? formatPrice(r.debit) : ''}</span>
                            else if (c.key === 'credit') val = <span className="text-green-600 dark:text-green-400">{r.credit ? formatPrice(r.credit) : ''}</span>
                            else if (c.key === 'avoir') val = <span className="font-semibold">{formatPrice(balance)}</span>
                            return <td key={c.key} className="p-2 text-right text-sm text-gray-600 dark:text-gray-300">{val}</td>
                          })}
                          {user?.role === 'admin' && (
                            <td className="p-2 text-center text-sm whitespace-nowrap">
                              {r.sourcePayment && (
                                <>
                                  <button onClick={() => openEditPayment(r.sourcePayment!)}
                                    className="text-blue-500 hover:text-blue-700 text-xs px-1">✎</button>
                                  <button onClick={() => handleDeletePayment(r.sourcePayment!)}
                                    className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
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
