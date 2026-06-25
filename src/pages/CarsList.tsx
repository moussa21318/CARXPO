import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getCarsPaginated, getAllClients, deleteCars, getDeleteRequests, createDeleteRequest, reviewDeleteRequest } from '../db/cloud'
import { STAGE_ORDER, STAGE_LABELS, type Car, type CarStage, type Client, type DeleteRequest } from '../types'
import { formatPrice } from '../utils/format'

const PAGE_SIZE = 20

export default function CarsList() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cars, setCars] = useState<Car[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteReqOpen, setDeleteReqOpen] = useState(false)
  const [deleteReqReason, setDeleteReqReason] = useState('')
  const [manageDeleteOpen, setManageDeleteOpen] = useState(false)
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const stageFilter = (searchParams.get('stage') as CarStage) || undefined
  const searchFilter = searchParams.get('search') || undefined
  const clientFilter = searchParams.get('client') || undefined

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const loadCars = async () => {
    setLoading(true)
    const { cars: data, total: count } = await getCarsPaginated({ stage: stageFilter, search: searchFilter, clientId: clientFilter, page, pageSize: PAGE_SIZE })
    setCars(data)
    setTotal(count)
    setSelected(new Set())
    setLoading(false)
  }

  useEffect(() => { getAllClients().then(setClients) }, [])

  useEffect(() => { loadCars() }, [stageFilter, searchFilter, clientFilter, page])

  useEffect(() => { setPage(1) }, [stageFilter, searchFilter])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === cars.length) setSelected(new Set())
    else setSelected(new Set(cars.map(c => c.id)))
  }

  const handleDeleteSelected = async () => {
    await deleteCars(Array.from(selected))
    setSelected(new Set())
    setDeleteOpen(false)
    loadCars()
  }

  const handleRequestDelete = async () => {
    if (!user) return
    for (const carId of selected) {
      await createDeleteRequest({ car_id: carId, requested_by: user.id, reason: deleteReqReason })
    }
    setSelected(new Set())
    setDeleteReqOpen(false)
    setDeleteReqReason('')
    loadCars()
  }

  const loadDeleteRequests = async () => {
    const data = await getDeleteRequests()
    setDeleteRequests(data)
  }

  const handleReviewDelete = async (reqId: string, status: 'approved' | 'rejected') => {
    if (!user) return
    await reviewDeleteRequest(reqId, status, user.id)
    loadDeleteRequests()
    loadCars()
  }

  const handleSort = (key: string) => {
    setSortDir(prev => sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc')
    setSortKey(key)
  }

  const carColDefs = [
    { key: 'name', labelKey: 'car.name', sortable: true },
    { key: 'client_code', labelKey: 'clients.code', sortable: true },
    { key: 'model_year', labelKey: 'car.model_year', sortable: true },
    { key: 'current_stage', labelKey: 'car.current_stage', sortable: true },
    { key: 'initial_price', labelKey: 'car.initial_price', sortable: true },
    { key: 'confirmed', labelKey: 'car.confirmed', sortable: true },
    { key: 'details', labelKey: 'app.details', sortable: false },
  ].map(c => ({ ...c, label: t(c.labelKey) }))

  const sortedCars = useMemo(() => {
    if (!sortKey) return cars
    return [...cars].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'client_code') {
        const codeA = clients.find(cl => cl.id === a.client_id)?.code || ''
        const codeB = clients.find(cl => cl.id === b.client_id)?.code || ''
        cmp = codeA.localeCompare(codeB)
      }
      else if (sortKey === 'model_year') cmp = String(a.model_year || '').localeCompare(String(b.model_year || ''))
      else if (sortKey === 'current_stage') cmp = a.current_stage.localeCompare(b.current_stage)
      else if (sortKey === 'initial_price') cmp = a.initial_price - b.initial_price
      else if (sortKey === 'confirmed') cmp = (a.confirmed ? 1 : 0) - (b.confirmed ? 1 : 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [cars, clients, sortKey, sortDir])

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{t('nav.cars')}</h1>
        <Link to="/cars/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          + {t('car.add')}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input value={searchFilter || ''}
          onChange={e => {
            const val = e.target.value
            setSearchParams(prev => {
              if (val) prev.set('search', val); else prev.delete('search')
              return prev
            })
          }}
          placeholder={t('car.search_placeholder')}
          className="border dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] flex-1 max-w-sm" />
        <select value={stageFilter || ''} onChange={e => setSearchParams(e.target.value ? { stage: e.target.value } : {})}
          className="border dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-4 py-2 outline-none">
          <option value="">{t('car.all_stages')}</option>
          {STAGE_ORDER.map(s => (
            <option key={s} value={s}>{t(STAGE_LABELS[s])}</option>
          ))}
        </select>
        <select value={clientFilter || ''} onChange={e => setSearchParams(e.target.value ? { client: e.target.value } : {})}
          className="border dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg px-4 py-2 outline-none min-w-[160px]">
          <option value="">{t('car.all_clients')}</option>
          {clients.map(cl => (
            <option key={cl.id} value={cl.id}>{cl.code} — {cl.name}</option>
          ))}
        </select>
        <div className="flex border dark:border-gray-600 rounded-lg overflow-hidden">
          <button onClick={() => setViewMode('table')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            ☰ {t('nav.view_table')}
          </button>
          <button onClick={() => setViewMode('cards')}
            className={`px-3 py-2 text-sm transition-colors ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            ⊞ {t('nav.view_cards')}
          </button>
        </div>
        {user?.role === 'admin' && selected.size > 0 && (
          <button onClick={() => setDeleteOpen(true)}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm whitespace-nowrap">
            🗑 {t('car.delete_selected', { count: selected.size })}
          </button>
        )}
        {user?.role === 'employee' && selected.size > 0 && (
          <button onClick={() => setDeleteReqOpen(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 text-sm whitespace-nowrap">
            {t('car.delete_request')}
          </button>
        )}
        {user?.role === 'admin' && (
          <button onClick={() => { loadDeleteRequests(); setManageDeleteOpen(true) }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm whitespace-nowrap">
            {t('car.manage_delete_requests')}
          </button>
        )}
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>
      ) : cars.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('app.no_data')}</div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[850px]" dir="rtl">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="p-3 w-10">
                  <input type="checkbox" checked={selected.size === cars.length && cars.length > 0}
                    onChange={toggleAll} className="w-4 h-4" />
                </th>
                {carColDefs.map(c => (
                  <th key={c.key}
                    onClick={() => c.sortable && handleSort(c.key)}
                    aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`p-3 text-sm font-medium transition-colors ${c.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none' : ''} ${sortKey === c.key ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'} ${c.key === 'current_stage' ? 'text-center' : 'text-right'}`}>
                    {c.label}{sortKey === c.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCars.map(c => (
                <tr key={c.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800/50">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)} className="w-4 h-4" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/cars/${c.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{c.name}</Link>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{c.license_plate || c.serial_number?.slice(-8) || ''}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-gray-600 dark:text-gray-300">{clients.find(cl => cl.id === c.client_id)?.code || '—'}</td>
                  <td className="p-3 text-right text-gray-600 dark:text-gray-300">{c.model_year}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.current_stage === 'shipping' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                      c.current_stage === 'purchase' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                      c.current_stage === 'deposit' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                      c.current_stage === 'shipping_prep' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                      'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}>{t(STAGE_LABELS[c.current_stage])}</span>
                  </td>
                  <td className="p-3 text-right text-gray-600 dark:text-gray-300">{formatPrice(c.initial_price)}</td>
                  <td className="p-3 text-right">
                    {c.confirmed ? (
                      <span className="text-green-600 dark:text-green-400 text-sm">{t('app.yes')}</span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">{t('app.no')}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Link to={`/cars/${c.id}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 text-sm">{t('app.details')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cars.map(c => (
            <div key={c.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow ${selected.has(c.id) ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={selected.has(c.id)}
                  onChange={() => toggleSelect(c.id)} className="w-4 h-4 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Link to={`/cars/${c.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-semibold text-lg leading-tight">{c.name}</Link>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{c.model_year}</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.license_plate || c.serial_number?.slice(-8) || '-'}</div>
                  {clients.find(cl => cl.id === c.client_id) && (
                    <div className="text-xs font-mono text-gray-400 dark:text-gray-500">
                      {clients.find(cl => cl.id === c.client_id)!.code} — {clients.find(cl => cl.id === c.client_id)!.name}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm font-medium">{formatPrice(c.initial_price)}</div>
              <div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  c.current_stage === 'shipping' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                  c.current_stage === 'purchase' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                  c.current_stage === 'deposit' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                  c.current_stage === 'shipping_prep' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                  'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}>{t(STAGE_LABELS[c.current_stage])}</span>
              </div>
              <div className="text-sm">{c.confirmed ? t('app.yes') : t('app.no')}</div>
              <Link to={`/cars/${c.id}`}
                className="mt-auto text-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg py-2 text-sm transition-colors">
                {t('app.details')}
              </Link>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm border dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {t('car.prev_page')}
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {t('car.next_page')}
          </button>
        </div>
      )}

      {deleteReqOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setDeleteReqOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('car.delete_request')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('car.delete_request')} ({selected.size})</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.delete_request_reason')}</label>
              <textarea value={deleteReqReason} onChange={e => setDeleteReqReason(e.target.value)}
                rows={3} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteReqOpen(false)}
                className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleRequestDelete}
                className="flex-1 p-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm transition-colors">
                {t('car.delete_request')}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageDeleteOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setManageDeleteOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-lg p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('car.manage_delete_requests')}</h2>
            {deleteRequests.filter(r => r.status === 'pending').length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm">{t('car.no_delete_requests')}</p>
            ) : (
              <div className="space-y-3">
                {deleteRequests.filter(r => r.status === 'pending').map(dr => {
                  const car = cars.find(c => c.id === dr.car_id)
                  return (
                    <div key={dr.id} className="border dark:border-gray-700 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-medium">{car?.name || dr.car_id}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('car.delete_request_reason')}: {dr.reason || '-'}</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleReviewDelete(dr.id, 'approved')}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-xs">
                          {t('car.approve_delete')}
                        </button>
                        <button onClick={() => handleReviewDelete(dr.id, 'rejected')}
                          className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 text-xs">
                          {t('car.reject_delete')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <button onClick={() => setManageDeleteOpen(false)}
              className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors">
              {t('app.cancel')}
            </button>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setDeleteOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('car.delete_confirm_title')}</h2>
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
              <span className="text-lg">⚠️</span>
              <p>{t('car.delete_multiple_confirm', { count: selected.size })}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteOpen(false)}
                className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleDeleteSelected}
                className="flex-1 p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition-colors">
                {t('car.delete_selected', { count: selected.size })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
