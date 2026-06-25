import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { createCar, getCar, updateCar, getClientById, getAllClients, upsertClient, getLastCarCode, generateNextCode } from '../db/cloud'
import { MODEL_YEARS, STAGE_ORDER, STAGE_LABELS, BRANDS, type Client } from '../types'

export default function CarForm() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, canEdit } = useAuth()
  const isEdit = !!id

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [trim, setTrim] = useState('')
  const [modelYear, setModelYear] = useState(MODEL_YEARS[0])
  const [serialNumber, setSerialNumber] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')
  const [initialPrice, setInitialPrice] = useState(0)
  const [notes, setNotes] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [currentStage, setCurrentStage] = useState('request')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [allClients, setAllClients] = useState<Client[]>([])
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientAddMode, setClientAddMode] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [addingClient, setAddingClient] = useState(false)

  useEffect(() => {
    getAllClients().then(setAllClients).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    getCar(id).then(car => {
      if (!car) return
      setName(car.name)
      setBrand(car.brand || '')
      setModel(car.model || '')
      setTrim(car.trim || '')
      setModelYear(car.model_year)
      setSerialNumber(car.serial_number || '')
      setLicensePlate(car.license_plate || '')
      setSellerPhone(car.seller_phone || '')
      setInitialPrice(car.initial_price)
      setNotes(car.notes || '')
      setCurrentStage(car.current_stage)
      setCode(car.code || '')
      if (car.client_id) {
        setClientId(car.client_id)
        getClientById(car.client_id).then(cl => {
          if (cl) { setClientName(cl.name); setClientPhone(cl.phone) }
        }).catch(() => {})
      }
    }).catch(() => setError(t('car.load_error')))
  }, [id])

  useEffect(() => {
    if (id) return
    getLastCarCode().then(last => setCode(generateNextCode(last)))
  }, [id])

  const openClientModal = () => {
    setClientSearch('')
    setClientModalOpen(true)
  }

  const pickClient = (cl: Client) => {
    setClientId(cl.id)
    setClientName(cl.name)
    setClientPhone(cl.phone)
    setClientModalOpen(false)
  }

  const addNewClient = () => {
    setNewClientName('')
    setNewClientPhone('')
    setClientAddMode(true)
  }

  const handleAddClient = async () => {
    if (!newClientName.trim()) return
    setAddingClient(true)
    try {
      const cl = await upsertClient(newClientName.trim(), newClientPhone)
      setClientAddMode(false)
      setClientModalOpen(false)
      setClientId(cl.id)
      setClientName(cl.name)
      setClientPhone(cl.phone)
    } catch { /* ignore */ }
    setAddingClient(false)
  }

  const pickContact = async () => {
    if (!('contacts' in navigator)) return
    try {
      const props = ['name', 'tel'] as const
      const contacts = await (navigator as any).contacts.select(props, { multiple: false })
      if (contacts && contacts.length > 0) {
        const c = contacts[0]
        if (c.name && !clientName) setClientName(c.name)
        if (c.tel && c.tel.length > 0) setClientPhone(c.tel[0])
      }
    } catch (err) { console.error('Contact picker error:', err) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !canEdit) return
    setSaving(true)
    setError('')
    try {
      if (isEdit && id) {
        const payload: any = {
          name, brand: brand || null, model: model || null, trim: trim || null,
          model_year: modelYear, serial_number: serialNumber || null,
          license_plate: licensePlate || null, seller_phone: sellerPhone,
          initial_price: initialPrice, notes, updated_by: user.id,
        }
        if (user.role === 'admin') payload.current_stage = currentStage
        await updateCar(id, payload)
        if (clientId) {
          await updateCar(id, { client_id: clientId })
        } else if (clientName) {
          const cl = await upsertClient(clientName, clientPhone)
          await updateCar(id, { client_id: cl.id })
        }
      } else {
        const car = await createCar({
          name, brand: brand || null, model: model || null, trim: trim || null,
          model_year: modelYear, code, notes, created_by: user.id, updated_by: user.id,
        })
        if (clientId) {
          await updateCar(car.id, { client_id: clientId })
        } else if (clientName) {
          const cl = await upsertClient(clientName, clientPhone)
          await updateCar(car.id, { client_id: cl.id })
        }
        navigate(`/cars/${car.id}`)
        return
      }
      navigate(`/cars/${id}`)
    } catch (err: any) {
      setError(err?.message || t('app.error'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!brand && !model) return
    setName(brand && model ? `${brand} ${model}` : brand || model || '')
  }, [brand, model])

  const filteredClients = allClients.filter(c =>
    !clientSearch ||
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch) ||
    (c.code && c.code.includes(clientSearch))
  )

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('car.edit') : t('car.add')}</h1>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.brand')} <span className="text-red-500">*</span></label>
            <select value={brand} onChange={e => { setBrand(e.target.value); setModel('') }} required
              className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">{t('car.select_brand')}</option>
              {Object.keys(BRANDS).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.model')} <span className="text-red-500">*</span></label>
            <select value={model} onChange={e => setModel(e.target.value)} required disabled={!brand}
              className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50">
              <option value="">{t('car.select_model')}</option>
              {brand && BRANDS[brand].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.trim')}</label>
            <input value={trim} onChange={e => setTrim(e.target.value)}
              className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.model_year')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
          <select value={modelYear} onChange={e => setModelYear(Number(e.target.value))}
            className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            {MODEL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
          {code && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.code')}</label>
              <div className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg text-sm font-mono bg-gray-100 dark:bg-gray-700 select-all">{code}</div>
            </div>
          )}
          <input type="hidden" value={name} />
        {isEdit && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.serial_number')}</label>
              <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} maxLength={17}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.license_plate')}</label>
              <input value={licensePlate} onChange={e => setLicensePlate(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.seller_phone')}</label>
              <input value={sellerPhone} onChange={e => setSellerPhone(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.initial_price')}</label>
              <input type="number" value={initialPrice || ''} onChange={e => setInitialPrice(Number(e.target.value))} min={0}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.notes')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            {user?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.current_stage')}</label>
                <select value={currentStage} onChange={e => setCurrentStage(e.target.value)}
                  className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  {STAGE_ORDER.map(s => <option key={s} value={s}>{t(STAGE_LABELS[s])}</option>)}
                </select>
              </div>
            )}
          </>
        )}
        <div className="border-t dark:border-gray-700 pt-4">
          <h3 className="font-medium mb-3">{t('car.request_client')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.client_name')}</label>
              <div className="relative">
                <input value={clientName} onChange={e => setClientName(e.target.value)}
                  onFocus={openClientModal}
                  readOnly={!!clientId}
                  className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                {clientId && (
                  <button type="button" onClick={() => { setClientId(null); setClientName(''); setClientPhone('') }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-sm">✕</button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.client_phone')}</label>
              <div className="flex gap-2">
                <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                  onFocus={!clientId ? openClientModal : undefined}
                  className="flex-1 p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                {('contacts' in navigator) && (
                  <button type="button" onClick={pickContact} title={t('car.pick_contact')}
                    className="px-3 py-3 bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">📇</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {clientModalOpen && !clientAddMode && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
               onClick={() => setClientModalOpen(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md max-h-[80vh] flex flex-col"
                 onClick={e => e.stopPropagation()}>
              <div className="p-5 sm:p-6 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-3">{t('car.request_client')}</h2>
                <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                  placeholder={t('clients.search')}
                  className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" autoFocus />
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">{t('clients.no_data')}</div>
                ) : (
                  filteredClients.map(cl => (
                    <div key={cl.id} onClick={() => pickClient(cl)}
                      className="grid grid-cols-[60px_1fr_120px] gap-3 items-center px-5 sm:px-6 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b dark:border-gray-700/50 last:border-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono text-left">{cl.code || '—'}</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{cl.name}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ltr text-right" dir="ltr">{cl.phone || '—'}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="p-5 sm:p-6 pt-3 border-t dark:border-gray-700">
                <button type="button" onClick={addNewClient}
                  className="w-full p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm transition-colors font-medium">
                  + {t('clients.add')}
                </button>
              </div>
            </div>
          </div>
        )}

        {clientModalOpen && clientAddMode && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
               onClick={() => { setClientAddMode(false); setClientModalOpen(false) }}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
                 onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold">{t('clients.add')}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('clients.name')} <span className="text-red-500">*</span></label>
                <input value={newClientName} onChange={e => setNewClientName(e.target.value)}
                  className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('clients.phone')}</label>
                <input value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)}
                  className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setClientAddMode(false)}
                  className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors">
                  {t('app.cancel')}
                </button>
                <button type="button" onClick={handleAddClient} disabled={addingClient || !newClientName.trim()}
                  className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50">
                  {addingClient ? t('app.loading') : t('app.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? t('app.loading') : t('app.save')}
          </button>
          <button type="button" onClick={() => navigate(isEdit && id ? `/cars/${id}` : '/cars')}
            className="bg-gray-200 dark:bg-gray-600 px-6 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
            {t('app.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
