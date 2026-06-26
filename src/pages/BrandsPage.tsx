import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getBrands, createBrand, updateBrand, deleteBrand, getModels, createModel, deleteModel } from '../db/cloud'
import type { Brand, Model } from '../types'

export default function BrandsPage() {
  const { t } = useTranslation()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [models, setModels] = useState<Record<string, Model[]>>({})
  const [brandModal, setBrandModal] = useState(false)
  const [editBrandId, setEditBrandId] = useState<string | null>(null)
  const [brandName, setBrandName] = useState('')
  const [savingBrand, setSavingBrand] = useState(false)
  const [modelInputs, setModelInputs] = useState<Record<string, string>>({})
  const [addingModel, setAddingModel] = useState<Record<string, boolean>>({})

  const loadBrands = async () => {
    setLoading(true)
    const data = await getBrands()
    setBrands(data)
    setLoading(false)
  }

  useEffect(() => { loadBrands() }, [])

  const loadModels = async (brandId: string) => {
    const data = await getModels(brandId)
    setModels(prev => ({ ...prev, [brandId]: data }))
  }

  const toggleExpand = (brandId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(brandId)) next.delete(brandId); else next.add(brandId)
      return next
    })
    if (!models[brandId]) loadModels(brandId)
  }

  const openAddBrand = () => {
    setEditBrandId(null)
    setBrandName('')
    setBrandModal(true)
  }

  const openEditBrand = (b: Brand) => {
    setEditBrandId(b.id)
    setBrandName(b.name)
    setBrandModal(true)
  }

  const handleSaveBrand = async () => {
    if (!brandName.trim()) return
    setSavingBrand(true)
    try {
      if (editBrandId) {
        await updateBrand(editBrandId, brandName.trim())
      } else {
        await createBrand(brandName.trim())
      }
      setBrandModal(false)
      await loadBrands()
    } catch { /* ignore */ }
    setSavingBrand(false)
  }

  const handleDeleteBrand = async (b: Brand) => {
    if (!window.confirm(t('brands.delete_confirm', `${t('app.delete')} ${b.name}?`))) return
    await deleteBrand(b.id)
    setModels(prev => { const next = { ...prev }; delete next[b.id]; return next })
    await loadBrands()
  }

  const handleAddModel = async (brandId: string) => {
    const name = modelInputs[brandId]?.trim()
    if (!name) return
    setAddingModel(prev => ({ ...prev, [brandId]: true }))
    try {
      await createModel(brandId, name)
      setModelInputs(prev => ({ ...prev, [brandId]: '' }))
      await loadModels(brandId)
    } catch { /* ignore */ }
    setAddingModel(prev => ({ ...prev, [brandId]: false }))
  }

  const handleDeleteModel = async (id: string, brandId: string) => {
    await deleteModel(id)
    await loadModels(brandId)
  }

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>

  return (
    <div>
      <div className="flex justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">{t('brands.title')}</h1>
        <button onClick={openAddBrand}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
          + {t('brands.add_brand')}
        </button>
      </div>

      {brands.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('app.no_data')}</div>
      ) : (
        <div className="space-y-3">
          {brands.map(b => (
            <div key={b.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleExpand(b.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-sm w-5">
                    {expanded.has(b.id) ? '▼' : '▶'}
                  </button>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{b.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {models[b.id] ? `(${models[b.id].length})` : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditBrand(b)}
                    className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30">✎</button>
                  <button onClick={() => handleDeleteBrand(b)}
                    className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30">✕</button>
                </div>
              </div>

              {expanded.has(b.id) && (
                <div className="border-t dark:border-gray-700 px-4 pb-4 pt-3 space-y-2">
                  {(!models[b.id] || models[b.id].length === 0) ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">{t('brands.no_models')}</p>
                  ) : (
                    models[b.id].map(m => (
                      <div key={m.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{m.name}</span>
                        <button onClick={() => handleDeleteModel(m.id, b.id)}
                          className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </div>
                    ))
                  )}
                  <div className="flex gap-2 pt-1">
                    <input value={modelInputs[b.id] || ''} onChange={e => setModelInputs(prev => ({ ...prev, [b.id]: e.target.value }))}
                      placeholder={t('brands.model_name')}
                      className="flex-1 p-2 border dark:border-gray-600 dark:bg-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    <button onClick={() => handleAddModel(b.id)} disabled={addingModel[b.id] || !modelInputs[b.id]?.trim()}
                      className="px-3 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 text-sm disabled:opacity-50">
                      + {t('brands.add_model')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {brandModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setBrandModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{editBrandId ? t('brands.edit_brand') : t('brands.add_brand')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('brands.brand_name')} <span className="text-red-500">*</span></label>
              <input value={brandName} onChange={e => setBrandName(e.target.value)}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setBrandModal(false)}
                className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleSaveBrand} disabled={savingBrand || !brandName.trim()}
                className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50">
                {savingBrand ? t('app.loading') : t('app.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
