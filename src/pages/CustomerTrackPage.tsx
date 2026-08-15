import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  findCarBySerialNumber, verifyCustomerPassword, getCar, getCustomerById,
  getAttachments, getStageLogs, updateCustomer, upsertCustomer, updateCar, notifyCustomerUpdated,
} from '../db/cloud'
import { STAGE_ORDER, STAGE_LABELS, type Car, type Customer, type CarStageLog, type CarAttachment } from '../types'
import { storageKey } from '../config/app'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp']
const sessionKey = storageKey('customer_session')

interface TrackSession {
  carId: string
  customerId: string
}

function isImageUrl(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase()
  return IMAGE_EXTS.some(ext => clean.endsWith(`.${ext}`))
}

export default function CustomerTrackPage() {
  const { t, i18n } = useTranslation()
  const [serial, setSerial] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const [session, setSession] = useState<TrackSession | null>(null)
  const [car, setCar] = useState<Car | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [attachments, setAttachments] = useState<(CarAttachment & { publicUrl: string })[]>([])
  const [stageLogs, setStageLogs] = useState<CarStageLog[]>([])
  const [loading, setLoading] = useState(true)

  const [editName, setEditName] = useState('')
  const [editNationalId, setEditNationalId] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editPostal, setEditPostal] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(sessionKey)
      if (raw) {
        const s = JSON.parse(raw) as TrackSession
        if (s?.carId && s?.customerId) { setSession(s); return }
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem(sessionKey)
    setSession(null)
    setCar(null)
    setCustomer(null)
    setAttachments([])
    setStageLogs([])
    setError('')
    setLoading(false)
  }

  useEffect(() => {
    if (!session) { setLoading(false); return }
    setLoading(true)
    const load = async () => {
      const [c, cu, attach, logs] = await Promise.all([
        getCar(session.carId),
        getCustomerById(session.customerId),
        getAttachments(session.carId),
        getStageLogs(session.carId),
      ])
      if (!c || c.deleted) { handleLogout(); return }
      setCar(c)
      setCustomer(cu)
      setAttachments(attach)
      setStageLogs(logs)
      setEditName(cu?.full_name_latin || '')
      setEditNationalId(cu?.national_id || '')
      setEditAddress(cu?.address_latin || '')
      setEditPostal(cu?.postal_code || '')
      setEditPhone(cu?.phone || '')
      setEditEmail(cu?.email || '')
      setLoading(false)
    }
    load()
  }, [session])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setChecking(true)
    setError('')
    try {
      const car = await findCarBySerialNumber(serial.trim())
      if (!car) { setError(t('customer_track.not_found')); setChecking(false); return }
      if (!car.customer_id) { setError(t('customer_track.no_account')); setChecking(false); return }
      const ok = await verifyCustomerPassword(car.customer_id, password)
      if (!ok) { setError(t('customer_track.wrong_password')); setChecking(false); return }
      const sess = { carId: car.id, customerId: car.customer_id }
      localStorage.setItem(sessionKey, JSON.stringify(sess))
      setSession(sess)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('customer_track.not_found'))
    } finally {
      setChecking(false)
    }
  }

  const handleSave = async () => {
    if (!car || !editName.trim() || !editNationalId.trim() || saving) return
    setSaving(true)
    setSavedMsg('')
    setError('')
    try {
      let custId = car.customer_id
      if (custId && customer) {
        await updateCustomer(custId, {
          full_name_latin: editName.trim(), national_id: editNationalId.trim(),
          address_latin: editAddress, postal_code: editPostal, phone: editPhone, email: editEmail,
        })
      } else {
        const { customer: newCust } = await upsertCustomer(editName.trim(), editNationalId.trim(), editAddress, editPostal, editPhone, editEmail)
        custId = newCust.id
        await updateCar(car.id, { customer_id: custId })
      }
      notifyCustomerUpdated(car.id, car.name, '')
      const [c, cu] = await Promise.all([getCar(car.id), custId ? getCustomerById(custId) : Promise.resolve(null)])
      if (c) setCar(c)
      setCustomer(cu)
      setSavedMsg(t('customer_track.save_success'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setSaving(false)
  }

  if (!session) {
    return (
      <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center text-blue-600 mb-1">{t('customer_track.title')}</h1>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-8">{t('customer_track.subtitle')}</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customer_track.serial_label')} <span className="text-red-500">*</span></label>
              <input value={serial} onChange={e => setSerial(e.target.value)} dir="ltr"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customer_track.password_label')} <span className="text-red-500">*</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={checking}
              className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50">
              {checking ? t('app.loading') : t('customer_track.login')}
            </button>
          </form>
          <div className="flex justify-center gap-2 mt-6">
            {(['ar', 'fr', 'en'] as const).map(lang => (
              <button key={lang} onClick={() => { i18n.changeLanguage(lang); localStorage.setItem(storageKey('lang'), lang) }}
                className={`px-3 py-1 text-sm rounded ${i18n.language === lang ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>
                {lang === 'ar' ? 'العربية' : lang === 'fr' ? 'Français' : 'English'}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-gray-500 dark:text-gray-400 text-xl">{t('app.loading')}</div>
      </div>
    )
  }

  if (!car) {
    return (
      <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🚗</div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('customer_track.not_found')}</h1>
          <button onClick={handleLogout}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm">
            {t('customer_track.logout')}
          </button>
        </div>
      </div>
    )
  }

  const stageIndex = STAGE_ORDER.indexOf(car.current_stage)
  const imageAttachments = attachments.filter(a => isImageUrl(a.publicUrl))
  const evidenceImages = stageLogs
    .filter(l => l.evidence_url && isImageUrl(l.evidence_url))
    .map(l => ({ id: `ev_${l.id}`, url: l.evidence_url as string, name: t('car.evidence') }))
  const carImages = [
    ...imageAttachments.map(a => ({ id: `att_${a.id}`, url: a.publicUrl, name: a.name })),
    ...evidenceImages,
  ]

  return (
    <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{car.name} ({car.model_year})</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('customer_track.serial_label')}: <span className="font-mono" dir="ltr">{car.serial_number || '-'}</span></p>
          </div>
          <button onClick={handleLogout}
            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm transition-colors">
            {t('customer_track.logout')}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4 text-gray-800 dark:text-gray-100">{t('customer_track.stage')}</h2>
          <div className="flex items-center gap-2 overflow-x-auto">
            {STAGE_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={`whitespace-nowrap text-sm px-3 py-1 rounded-full ${
                  i < stageIndex ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                  i === stageIndex ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium' :
                  'bg-gray-100 text-gray-400 dark:text-gray-500'
                }`}>{t(STAGE_LABELS[s])}</span>
                {i < STAGE_ORDER.length - 1 && <div className="w-6 h-0.5 bg-gray-300 dark:bg-gray-600" />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4 text-gray-800 dark:text-gray-100">{t('customer_track.images')}</h2>
          {carImages.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm">{t('car.no_image')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {carImages.map(img => (
                <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border dark:border-gray-700 bg-gray-100 dark:bg-gray-700">
                  <img src={img.url} alt={img.name} loading="lazy"
                    className="w-full h-32 object-cover hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4 text-gray-800 dark:text-gray-100">{t('customer_track.your_info')}</h2>
          {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 mb-4">{error}</div>}
          {savedMsg && <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300 mb-4">{savedMsg}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.name')} <span className="text-red-500">*</span></label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.national_id')} <span className="text-red-500">*</span></label>
              <input value={editNationalId} onChange={e => setEditNationalId(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.phone')}</label>
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)} dir="ltr"
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.address')}</label>
              <input value={editAddress} onChange={e => setEditAddress(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.postal_code')}</label>
              <input value={editPostal} onChange={e => setEditPostal(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('customers.email')}</label>
              <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !editName.trim() || !editNationalId.trim()}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50">
            {saving ? t('app.loading') : t('app.save')}
          </button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          {t('customer_track.footer')}
        </p>
      </div>
    </div>
  )
}
