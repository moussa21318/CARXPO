import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { createCar, getCar, updateCar, getClientById, getAllClients, upsertClient, getLastCarCode, generateNextCode } from '../db/cloud'
import { MODEL_YEARS, STAGE_ORDER, STAGE_LABELS } from '../types'

export default function CarForm() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, canEdit } = useAuth()
  const isEdit = !!id

  const [name, setName] = useState('')
  const [modelYear, setModelYear] = useState(MODEL_YEARS[0])
  const [serialNumber, setSerialNumber] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [sellerPhone, setSellerPhone] = useState('')
  const [initialPrice, setInitialPrice] = useState(0)
  const [notes, setNotes] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [currentStage, setCurrentStage] = useState('request')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allClientsRef = useRef<{name: string; phone: string}[]>([])
  const [nameSugs, setNameSugs] = useState<{name: string; phone: string}[]>([])
  const [phoneSugs, setPhoneSugs] = useState<{name: string; phone: string}[]>([])

  useEffect(() => {
    getAllClients().then(data => {
      allClientsRef.current = data.map(r => ({ name: r.name, phone: r.phone }))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    getCar(id).then(car => {
      if (!car) return
      setName(car.name)
      setModelYear(car.model_year)
      setSerialNumber(car.serial_number || '')
      setLicensePlate(car.license_plate || '')
      setSellerPhone(car.seller_phone || '')
      setInitialPrice(car.initial_price)
      setNotes(car.notes || '')
      setCurrentStage(car.current_stage)
      setCode(car.code || '')
      if (car.client_id) {
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

  const highlightText = (text: string, query: string) => {
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <strong>{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    )
  }

  const handleNameInput = (val: string) => {
    setClientName(val)
    if (!val) { setNameSugs([]); return }
    setNameSugs(allClientsRef.current.filter(c => c.name.toLowerCase().includes(val.toLowerCase())))
  }

  const handlePhoneInput = (val: string) => {
    setClientPhone(val)
    if (!val) { setPhoneSugs([]); return }
    setPhoneSugs(allClientsRef.current.filter(c => c.phone.includes(val)))
  }

  const pickSuggestion = (s: {name: string; phone: string}) => {
    setClientName(s.name)
    setClientPhone(s.phone)
    setNameSugs([])
    setPhoneSugs([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !canEdit) return
    setSaving(true)
    setError('')
    try {
      if (isEdit && id) {
        const payload: any = {
          name, model_year: modelYear, serial_number: serialNumber || null,
          license_plate: licensePlate || null, seller_phone: sellerPhone,
          initial_price: initialPrice, notes, updated_by: user.id,
        }
        if (user.role === 'admin') payload.current_stage = currentStage
        await updateCar(id, payload)
        if (clientName) {
          const cl = await upsertClient(clientName, clientPhone)
          await updateCar(id, { client_id: cl.id })
        }
      } else {
        const car = await createCar({
          name, model_year: modelYear, code, notes, created_by: user.id, updated_by: user.id,
        })
        if (clientName) {
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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('car.edit') : t('car.add')}</h1>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.name')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          {code && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.code')}</label>
              <div className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg text-sm font-mono bg-gray-100 dark:bg-gray-700 select-all">{code}</div>
            </div>
          )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.model_year')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
          <select value={modelYear} onChange={e => setModelYear(Number(e.target.value))}
            className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            {MODEL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
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
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.client_name')}</label>
              <input value={clientName} onChange={e => handleNameInput(e.target.value)}
                onBlur={() => setTimeout(() => setNameSugs([]), 200)}
                onKeyDown={e => { if (e.key === 'Escape') setNameSugs([]) }}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              {nameSugs.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {nameSugs.map((s, i) => (
                    <li key={i} onClick={() => pickSuggestion(s)}
                      className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-sm flex justify-between gap-2">
                      <span>{highlightText(s.name, clientName)}</span>
                      <span className="text-gray-400 dark:text-gray-500 text-xs ltr">{s.phone}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.client_phone')}</label>
              <div className="relative flex gap-2">
                <input value={clientPhone} onChange={e => handlePhoneInput(e.target.value)}
                  onBlur={() => setTimeout(() => setPhoneSugs([]), 200)}
                  onKeyDown={e => { if (e.key === 'Escape') setPhoneSugs([]) }}
                  className="flex-1 p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                {('contacts' in navigator) && (
                  <button type="button" onClick={pickContact} title={t('car.pick_contact')}
                    className="px-3 py-3 bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">📇</button>
                )}
                {phoneSugs.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 top-full bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {phoneSugs.map((s, i) => (
                      <li key={i} onClick={() => pickSuggestion(s)}
                        className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-sm flex justify-between gap-2">
                        <span>{highlightText(s.phone, clientPhone)}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs truncate max-w-[120px]">{s.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
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
