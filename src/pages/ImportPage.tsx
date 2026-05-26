import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { bulkInsertCars, bulkInsertCustomers } from '../db/cloud'
import * as XLSX from 'xlsx'

type TableType = 'cars' | 'customers'

const CAR_COLUMNS = ['name', 'model_year', 'serial_number', 'license_plate', 'seller_phone', 'initial_price', 'notes']
const CUSTOMER_COLUMNS = ['full_name_latin', 'national_id', 'address_latin', 'postal_code', 'phone', 'email']

export default function ImportPage() {
  const { t } = useTranslation()
  const { canEdit } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<any[][]>([])
  const [table, setTable] = useState<TableType>('cars')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
      if (json.length > 0) {
        setHeaders(json[0] as string[])
        setRows(json.slice(1, 11))
        const autoMap: Record<string, string> = {}
        const cols = table === 'cars' ? CAR_COLUMNS : CUSTOMER_COLUMNS
        ;(json[0] as string[]).forEach(h => {
          const match = cols.find(c => h.toLowerCase().includes(c.replace('_', '')))
          if (match) autoMap[h] = match
        })
        setMapping(autoMap)
      }
    }
    reader.readAsArrayBuffer(f)
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setResult(null)
    try {
      const reader = new FileReader()
      reader.onload = async e => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
        const colMap = headers.map(h => mapping[h]).filter(Boolean)
        const colIdx = headers.map((h, i) => mapping[h] ? i : -1).filter(i => i >= 0)
        const records = json.slice(1).filter((row: any[]) => row.some((c: any) => c !== undefined && c !== null && c !== '')).map((row: any[]) => {
          const rec: any = {}
          colIdx.forEach((idx, i) => { rec[colMap[i]] = row[idx] })
          return rec
        })
        if (table === 'cars') {
          await bulkInsertCars(records.map(r => ({ name: String(r.name || ''), model_year: Number(r.model_year) || 2024, ...r })))
        } else {
          await bulkInsertCustomers(records)
        }
        setResult(t('import.success', { count: records.length }))
      }
      reader.readAsArrayBuffer(file)
    } catch {
      setResult(t('import.error'))
    } finally {
      setImporting(false)
    }
  }

  const columns = table === 'cars' ? CAR_COLUMNS : CUSTOMER_COLUMNS

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('import.title')}</h1>
      {!canEdit ? (
        <p className="text-gray-500">{t('auth.no_permission')}</p>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('import.select_table')}</label>
              <select value={table} onChange={e => setTable(e.target.value as TableType)}
                className="border rounded-lg px-4 py-2 outline-none">
                <option value="cars">{t('import.cars')}</option>
                <option value="customers">{t('import.customers')}</option>
              </select>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}>
              <input id="file-input" type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <p className="text-gray-500">{file ? file.name : t('import.drop_hint')}</p>
            </div>
            {headers.length > 0 && (
              <>
                <div>
                  <h3 className="font-medium mb-3">{t('import.column_mapping')}</h3>
                  <div className="space-y-2">
                    {headers.map(h => (
                      <div key={h} className="flex items-center gap-3">
                        <span className="w-40 text-sm text-gray-600 truncate">{h}</span>
                        <select value={mapping[h] || ''} onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                          className="border rounded-lg px-3 py-1 text-sm outline-none flex-1">
                          <option value="">--</option>
                          {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-3">{t('import.preview')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border">
                      <thead>
                        <tr className="bg-gray-50">
                          {headers.map(h => <th key={h} className="p-2 border text-right">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-t">
                            {row.map((cell: any, j: number) => <td key={j} className="p-2 border">{String(cell ?? '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <button onClick={handleImport} disabled={importing}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {importing ? t('app.loading') : t('import.import_btn')}
                </button>
                {result && <p className="text-sm text-green-600">{result}</p>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
