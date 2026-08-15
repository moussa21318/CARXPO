import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAllCustomers, upsertCustomer, updateCustomer, deleteCustomer, getCars, resetCustomerPassword, getCarsByCustomerId } from '../db/cloud'
import type { Customer, Car } from '../types'

export default function CustomersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<(Customer & { carCount?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalNationalId, setModalNationalId] = useState('')
  const [modalAddress, setModalAddress] = useState('')
  const [modalPostal, setModalPostal] = useState('')
  const [modalPhone, setModalPhone] = useState('')
  const [modalEmail, setModalEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [credModal, setCredModal] = useState<{ customer: Customer; password: string; cars: Car[] } | null>(null)

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* ignore */ }
  }

  const loadCustomers = async () => {
    const [cl, cars] = await Promise.all([getAllCustomers(), getCars()])
    const carCounts = new Map<string, number>()
    for (const car of cars) {
      if (car.customer_id) carCounts.set(car.customer_id, (carCounts.get(car.customer_id) || 0) + 1)
    }
    setCustomers(cl.map(c => ({ ...c, carCount: carCounts.get(c.id) || 0 })))
    setLoading(false)
  }

  useEffect(() => { loadCustomers() }, [])

  const openAdd = () => {
    setEditId(null); setModalName(''); setModalNationalId(''); setModalAddress(''); setModalPostal(''); setModalPhone(''); setModalEmail(''); setModalOpen(true)
  }

  const openEdit = (c: Customer) => {
    setEditId(c.id); setModalName(c.full_name_latin); setModalNationalId(c.national_id); setModalAddress(c.address_latin); setModalPostal(c.postal_code); setModalPhone(c.phone); setModalEmail(c.email); setModalOpen(true)
  }

  const handleSave = async () => {
    if (!modalName.trim() || !modalNationalId.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await updateCustomer(editId, { full_name_latin: modalName.trim(), national_id: modalNationalId.trim(), address_latin: modalAddress, postal_code: modalPostal, phone: modalPhone, email: modalEmail })
      } else {
        const { customer, password } = await upsertCustomer(modalName.trim(), modalNationalId.trim(), modalAddress, modalPostal, modalPhone, modalEmail)
        if (password) {
          const cars = await getCarsByCustomerId(customer.id)
          setCredModal({ customer, password, cars })
        }
      }
      setModalOpen(false)
      await loadCustomers()
    } catch (e) { alert('خطأ: ' + ((e as any)?.message || String(e))) }
    setSaving(false)
  }

  const handleSetPassword = async (c: Customer) => {
    setSaving(true)
    try {
      const password = await resetCustomerPassword(c.id)
      const cars = await getCarsByCustomerId(c.id)
      setCredModal({ customer: c, password, cars })
    } catch (e) { alert('خطأ: ' + (e instanceof Error ? e.message : String(e))) }
    setSaving(false)
  }

  const handleDelete = async (c: Customer) => {
    if (!window.confirm(t('customers.delete_confirm', `${t('app.delete')} ${c.full_name_latin}?`))) return
    await deleteCustomer(c.id)
    await loadCustomers()
  }

  const filtered = customers.filter(c =>
    !search || c.full_name_latin.toLowerCase().includes(search.toLowerCase()) ||
    c.national_id.includes(search) || c.phone.includes(search) ||
    (c.code && c.code.includes(search))
  )

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold">{t('customers.title')}</h1>
        <button onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + {t('customers.add')}
        </button>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder={t('customers.search')}
        className="w-full sm:w-80 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('customers.no_data')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('customers.code')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('customers.name')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('customers.national_id')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('customers.phone')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('customers.created_at')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('customers.cars_count')}</th>
                <th className="text-center p-3 text-sm font-medium text-gray-600 dark:text-gray-300">{t('app.edit')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-3 text-right text-sm font-mono text-gray-600 dark:text-gray-300">{c.code || '—'}</td>
                  <td className="p-3 text-right text-sm text-gray-700 dark:text-gray-300">{c.full_name_latin}</td>
                  <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300" dir="ltr">{c.national_id || '—'}</td>
                  <td className="p-3 text-right text-sm text-gray-600 dark:text-gray-300" dir="ltr">{c.phone || '—'}</td>
                  <td className="p-3 text-right text-sm text-gray-500 dark:text-gray-400">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right text-sm">
                    <button onClick={() => navigate(`/cars`)}
                      className="text-blue-600 dark:text-blue-400 hover:underline">
                      {c.carCount}
                    </button>
                  </td>
                  <td className="p-3 text-center text-sm whitespace-nowrap">
                    <button onClick={() => handleSetPassword(c)}
                      className="text-orange-500 hover:text-orange-700 text-xs px-1" title={t('customers.reset_password')}>🔑</button>
                    <button onClick={() => openEdit(c)}
                      className="text-blue-500 hover:text-blue-700 text-xs px-1">✎</button>
                    <button onClick={() => handleDelete(c)}
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
            <h2 className="text-lg font-semibold">{editId ? t('customers.edit') : t('customers.add')}</h2>            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.name')} <span className="text-red-500">*</span></label>
              <input value={modalName} onChange={e => setModalName(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.national_id')} <span className="text-red-500">*</span></label>
              <input value={modalNationalId} onChange={e => setModalNationalId(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.address')}</label>
              <input value={modalAddress} onChange={e => setModalAddress(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.postal_code')}</label>
              <input value={modalPostal} onChange={e => setModalPostal(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.phone')}</label>
              <input value={modalPhone} onChange={e => setModalPhone(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.email')}</label>
              <input value={modalEmail} onChange={e => setModalEmail(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleSave} disabled={saving || !modalName.trim() || !modalNationalId.trim()}
                className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50">
                {saving ? t('app.loading') : t('app.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {credModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">{t('client_portal.credentials_modal_title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('client_portal.credentials_for', { name: credModal.customer.full_name_latin })}</p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-500 dark:text-gray-400">{t('client_portal.password_label')}:</span>
                <span className="font-mono font-medium flex items-center gap-2" dir="ltr">
                  {credModal.password}
                  <button onClick={() => handleCopy(credModal.password, 'cred-pwd')}
                    className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                    {copied === 'cred-pwd' ? '✓' : t('app.copy')}
                  </button>
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('customers.linked_cars')}</p>
              {credModal.cars.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">{t('customers.no_linked_cars')}</p>
              ) : (
                <div className="space-y-1">
                  {credModal.cars.map(car => (
                    <div key={car.id} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{car.name}</span>
                      <span className="text-gray-500 dark:text-gray-400" dir="ltr">
                        {t('customers.serial')}: {car.serial_number || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">{t('client_portal.save_credentials')}</p>
            <button onClick={() => setCredModal(null)}
              className="w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm transition-colors">
              {t('app.ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
