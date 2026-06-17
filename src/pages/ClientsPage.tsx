import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAllClients, upsertClient, updateClient, deleteClient, getCars } from '../db/cloud'
import type { Client } from '../types'

export default function ClientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [clients, setClients] = useState<(Client & { carCount?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalPhone, setModalPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const loadClients = async () => {
    const [cl, cars] = await Promise.all([getAllClients(), getCars()])
    const carCounts = new Map<string, number>()
    for (const car of cars) {
      if (car.client_id) carCounts.set(car.client_id, (carCounts.get(car.client_id) || 0) + 1)
    }
    setClients(cl.map(c => ({ ...c, carCount: carCounts.get(c.id) || 0 })))
    setLoading(false)
  }

  useEffect(() => { loadClients() }, [])

  const openAdd = () => {
    setEditId(null); setModalName(''); setModalPhone(''); setModalOpen(true)
  }

  const openEdit = (cl: Client) => {
    setEditId(cl.id); setModalName(cl.name); setModalPhone(cl.phone); setModalOpen(true)
  }

  const handleSave = async () => {
    if (!modalName.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await updateClient(editId, { name: modalName.trim(), phone: modalPhone })
      } else {
        await upsertClient(modalName.trim(), modalPhone)
      }
      setModalOpen(false)
      await loadClients()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleDelete = async (cl: Client) => {
    if (!window.confirm(t('clients.delete_confirm', `${t('app.delete')} ${cl.name}?`))) return
    await deleteClient(cl.id)
    await loadClients()
  }

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) || (c.code && c.code.includes(search))
  )

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">{t('clients.title')}</h1>
        <button onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + {t('clients.add')}
        </button>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder={t('clients.search')}
        className="w-full sm:w-80 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('clients.no_data')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('clients.code')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('clients.name')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('clients.phone')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('clients.created_at')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('clients.cars_count')}</th>
                <th className="text-center p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('app.edit')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(cl => (
                <tr key={cl.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-3 text-right text-sm font-mono text-gray-600 dark:text-gray-300">{cl.code || '—'}</td>
                  <td className="p-3 text-right text-sm text-gray-700 dark:text-gray-300">{cl.name}</td>
                  <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300" dir="ltr">{cl.phone || '—'}</td>
                  <td className="p-3 text-right text-sm text-gray-500 dark:text-gray-400">{new Date(cl.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right text-sm">
                    <button onClick={() => navigate(`/cars`)}
                      className="text-blue-600 dark:text-blue-400 hover:underline">
                      {cl.carCount}
                    </button>
                  </td>
                  <td className="p-3 text-center text-sm whitespace-nowrap">
                    <button onClick={() => openEdit(cl)}
                      className="text-blue-500 hover:text-blue-700 text-xs px-1">✎</button>
                    <button onClick={() => handleDelete(cl)}
                      className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{editId ? t('clients.edit') : t('clients.add')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('clients.name')} <span className="text-red-500">*</span></label>
              <input value={modalName} onChange={e => setModalName(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('clients.phone')}</label>
              <input value={modalPhone} onChange={e => setModalPhone(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleSave} disabled={saving || !modalName.trim()}
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
