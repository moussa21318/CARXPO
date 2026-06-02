import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCars, getCustomers, getAllCarFees, getAllRequestClients } from '../db/cloud'
import { STAGE_LABELS, type CarStage } from '../types'
import * as XLSX from 'xlsx'

interface ColumnDef {
  key: string
  labelKey: string
  group: string
  groupLabelKey: string
  getValue: (car: any, rc: any, cust: any, fees: any) => any
}

const GROUPS: ColumnDef[] = [
  // Car fields
  { key: 'name', labelKey: 'car.name', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.name },
  { key: 'model_year', labelKey: 'car.model_year', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.model_year },
  { key: 'serial_number', labelKey: 'car.serial_number', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.serial_number },
  { key: 'license_plate', labelKey: 'car.license_plate', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.license_plate },
  { key: 'seller_phone', labelKey: 'car.seller_phone', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.seller_phone },
  { key: 'initial_price', labelKey: 'car.initial_price', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.initial_price },
  { key: 'current_stage', labelKey: 'car.current_stage', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.current_stage },
  { key: 'confirmed', labelKey: 'car.confirmed', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.confirmed },
  { key: 'notes', labelKey: 'car.notes', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.notes },
  { key: 'created_at', labelKey: 'activity.timestamp', group: 'car', groupLabelKey: 'export.group_car', getValue: (c) => c?.created_at },

  // Request client
  { key: 'client_name', labelKey: 'car.client_name', group: 'rc', groupLabelKey: 'export.group_rc', getValue: (_, rc) => rc?.name },
  { key: 'client_phone', labelKey: 'car.client_phone', group: 'rc', groupLabelKey: 'export.group_rc', getValue: (_, rc) => rc?.phone },

  // Customer
  { key: 'full_name_latin', labelKey: 'car.full_name_latin', group: 'cust', groupLabelKey: 'export.group_cust', getValue: (_, __, cust) => cust?.full_name_latin },
  { key: 'national_id', labelKey: 'car.national_id', group: 'cust', groupLabelKey: 'export.group_cust', getValue: (_, __, cust) => cust?.national_id },
  { key: 'address_latin', labelKey: 'car.address_latin', group: 'cust', groupLabelKey: 'export.group_cust', getValue: (_, __, cust) => cust?.address_latin },
  { key: 'postal_code', labelKey: 'car.postal_code', group: 'cust', groupLabelKey: 'export.group_cust', getValue: (_, __, cust) => cust?.postal_code },
  { key: 'customer_phone', labelKey: 'car.phone', group: 'cust', groupLabelKey: 'export.group_cust', getValue: (_, __, cust) => cust?.phone },
  { key: 'email', labelKey: 'car.email', group: 'cust', groupLabelKey: 'export.group_cust', getValue: (_, __, cust) => cust?.email },

  // Fees
  { key: 'deposit', labelKey: 'car.deposit', group: 'fees', groupLabelKey: 'export.group_fees', getValue: (_, __, ___, fees) => fees?.deposit },
  { key: 'deposit_02', labelKey: 'car.deposit_02', group: 'fees', groupLabelKey: 'export.group_fees', getValue: (_, __, ___, fees) => fees?.deposit_02 },
  { key: 'transport_01', labelKey: 'car.transport_01', group: 'fees', groupLabelKey: 'export.group_fees', getValue: (_, __, ___, fees) => fees?.transport_01 },
  { key: 'parking', labelKey: 'car.parking', group: 'fees', groupLabelKey: 'export.group_fees', getValue: (_, __, ___, fees) => fees?.parking },
  { key: 'other_fees', labelKey: 'car.other_fees', group: 'fees', groupLabelKey: 'export.group_fees', getValue: (_, __, ___, fees) => fees?.other_fees },
  { key: 'transport_02', labelKey: 'car.transport_02', group: 'fees', groupLabelKey: 'export.group_fees', getValue: (_, __, ___, fees) => fees?.transport_02 },
]

const UNIQUE_GROUPS = Array.from(new Set(GROUPS.map(g => g.group)))

export default function ExportPage() {
  const { t } = useTranslation()
  const { canEdit } = useAuth()
  const [selected, setSelected] = useState<string[]>(GROUPS.map(c => c.key))
  const [order, setOrder] = useState<string[]>(GROUPS.map(c => c.key))
  const [cars, setCars] = useState<any[]>([])
  const [preview, setPreview] = useState<any[][]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [carData, rcData, custData, feesData] = await Promise.all([
        getCars(), getAllRequestClients(), getCustomers(), getAllCarFees(),
      ])
      const rcMap = new Map(rcData.map(r => [r.car_id, r]))
      const custMap = new Map(custData.map(c => [c.car_id, c]))
      const feesMap = new Map(feesData.map(f => [f.car_id, f]))
      const merged = carData.map(car => ({ car, rc: rcMap.get(car.id), cust: custMap.get(car.id), fees: feesMap.get(car.id) }))
      setCars(merged)
      const active = order.filter(k => selected.includes(k))
      setPreview(merged.slice(0, 10).map(row => active.map(key => {
        const col = GROUPS.find(c => c.key === key)
        let val = col ? col.getValue(row.car, row.rc, row.cust, row.fees) : ''
        if (key === 'current_stage' && val) val = t(STAGE_LABELS[val as CarStage])
        if (key === 'confirmed') val = val ? t('app.yes') : t('app.no')
        return val ?? ''
      })))
    } finally {
      setLoading(false)
    }
  }

  const toggleColumn = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const allKeys = GROUPS.map(c => c.key)

  const selectAll = () => setSelected([...allKeys])
  const deselectAll = () => setSelected([])

  const selectGroup = (g: string) => {
    const keys = GROUPS.filter(c => c.group === g).map(c => c.key)
    setSelected(prev => [...new Set([...prev, ...keys])])
  }
  const deselectGroup = (g: string) => {
    const keys = GROUPS.filter(c => c.group === g).map(c => c.key)
    setSelected(prev => prev.filter(k => !keys.includes(k)))
  }

  const moveUp = (key: string) => {
    setOrder(prev => {
      const idx = prev.indexOf(key)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (key: string) => {
    setOrder(prev => {
      const idx = prev.indexOf(key)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const handleExport = () => {
    setExporting(true)
    try {
      const active = order.filter(k => selected.includes(k))
      const rows = cars.map(row => {
        const obj: Record<string, any> = {}
        active.forEach(key => {
          const col = GROUPS.find(c => c.key === key)
          if (!col) return
          let val = col.getValue(row.car, row.rc, row.cust, row.fees)
          if (key === 'current_stage' && val) val = t(STAGE_LABELS[val as CarStage])
          if (key === 'confirmed') val = val ? t('app.yes') : t('app.no')
          obj[t(col.labelKey)] = val ?? ''
        })
        return obj
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'export')
      XLSX.writeFile(wb, `export_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('export.title')}</h1>
      {!canEdit ? (
        <p className="text-gray-500 dark:text-gray-400">{t('auth.no_permission')}</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={loadData} disabled={loading}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? t('app.loading') : t('export.load')}
            </button>
            {cars.length > 0 && <span className="text-sm text-gray-500 dark:text-gray-400">{cars.length} {t('export.records')}</span>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{t('export.columns')}</h3>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200">{t('export.select_all')}</button>
                <button onClick={deselectAll} className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200">{t('export.deselect_all')}</button>
              </div>
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
              {UNIQUE_GROUPS.map(g => {
                const groupCols = GROUPS.filter(c => c.group === g)
                const labelKey = groupCols[0]?.groupLabelKey || ''
                return (
                  <div key={g}>
                    <div className="flex items-center justify-between border-b dark:border-gray-700 pb-1 mb-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t(labelKey)}</h4>
                      <div className="flex gap-2">
                        <button onClick={() => selectGroup(g)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">{t('export.select_all')}</button>
                        <button onClick={() => deselectGroup(g)} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">{t('export.deselect_all')}</button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {order.filter(k => groupCols.some(c => c.key === k)).map(key => {
                        const col = groupCols.find(c => c.key === key)
                        if (!col) return null
                        return (
                          <div key={key} className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800/50 rounded min-w-0">
                            <input type="checkbox" checked={selected.includes(key)}
                              onChange={() => toggleColumn(key)} className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1 text-sm truncate min-w-0">{t(col.labelKey)}</span>
                            <button onClick={() => moveUp(key)}
                              disabled={order.indexOf(key) === 0}
                              className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 disabled:opacity-30 flex-shrink-0">↑</button>
                            <button onClick={() => moveDown(key)}
                              disabled={order.indexOf(key) >= order.length - 1}
                              className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 disabled:opacity-30 flex-shrink-0">↓</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {preview.length > 0 && (
            <>
              <div>
                <h3 className="font-medium mb-3">{t('export.preview')}</h3>
                <div className="overflow-x-auto max-h-72 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                      <tr>
                        {order.filter(k => selected.includes(k)).map(key => {
                          const col = GROUPS.find(c => c.key === key)
                          return col ? <th key={key} className="p-2 border text-right whitespace-nowrap">{t(col.labelKey)}</th> : null
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800/50">
                          {row.map((cell, j) => <td key={j} className="p-2 border">{String(cell)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button onClick={handleExport} disabled={exporting}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {exporting ? t('app.loading') : t('export.download')}
              </button>
            </>
          )}

          {cars.length === 0 && !loading && (
            <p className="text-gray-400 dark:text-gray-500 text-center py-4">{t('export.load_hint')}</p>
          )}
        </div>
      )}
    </div>
  )
}
