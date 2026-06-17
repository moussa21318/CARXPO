import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import {
  getCar, updateCar, deleteCar, getCarFees, upsertCarFees,
  getStageLogs, moveToStage,
  getRequestClient, getCustomer, upsertCustomer,
  getAttachments, addAttachment, deleteAttachment,
  getDeleteRequests, createDeleteRequest, reviewDeleteRequest,
  getCustomerPayments, createCustomerPayment, updateCustomerPayment, deleteCustomerPayment,
  getClient,
} from '../db/cloud'
import { uploadFile } from '../utils/upload'
import { STAGE_ORDER, STAGE_LABELS, MODEL_YEARS, PAYMENT_METHOD_LABELS, type Car, type CarFees, type CarStageLog, type RequestClient, type Customer, type CarAttachment, type CarStage, type DeleteRequest, type CustomerPayment, type PaymentMethod } from '../types'
import { formatPrice } from '../utils/format'

export default function CarDetails() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, canEdit } = useAuth()

  const [car, setCar] = useState<Car | null>(null)
  const [fees, setFees] = useState<CarFees | null>(null)
  const [stageLogs, setStageLogs] = useState<CarStageLog[]>([])
  const [requestClient, setRequestClient] = useState<RequestClient | null>(null)
  const [customerData, setCustomerData] = useState<Partial<Customer>>({})
  const [attachments, setAttachments] = useState<(CarAttachment & { publicUrl: string })[]>([])
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [evidencePublicUrl, setEvidencePublicUrl] = useState('')
  const [newAttachFile, setNewAttachFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false)
  const [deleteRequestReason, setDeleteRequestReason] = useState('')
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([])
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null)
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentEdit, setPaymentEdit] = useState<CustomerPayment | null>(null)
  const [editAmount, setEditAmount] = useState(0)
  const [editDate, setEditDate] = useState('')
  const [editMethod, setEditMethod] = useState<PaymentMethod>('cash')
  const [editNotes, setEditNotes] = useState('')
  const [editReceipt, setEditReceipt] = useState<File | null>(null)
  const [modalLp, setModalLp] = useState('')
  const [modalMy, setModalMy] = useState(0)
  const [modalPrice, setModalPrice] = useState(0)

  const loadData = useCallback(async () => {
    if (!id) return
    const [c, f, sl, rc, cust, att, dr, p] = await Promise.all([
      getCar(id), getCarFees(id), getStageLogs(id), getRequestClient(id), getCustomer(id), getAttachments(id), getDeleteRequests(id), getCustomerPayments(id),
    ])
    setCar(c)
    setFees(f)
    setStageLogs(sl)
    setRequestClient(rc)
    setCustomerData(cust || {})
    setAttachments(att)
    setDeleteRequests(dr)
    setPayments(p)
    const lastWithEvidence = sl?.find((log: CarStageLog) => log.evidence_url)
    if (lastWithEvidence) setEvidencePublicUrl(lastWithEvidence.evidence_url || '')
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [id])

  const handleOpenConfirm = () => {
    if (!car) return
    setModalLp(car.license_plate || '')
    setModalMy(car.model_year)
    setModalPrice(car.initial_price)
    setConfirmOpen(true)
  }

  const handleConfirmSave = async () => {
    if (!id || !user || !car) return
    await updateCar(id, {
      license_plate: modalLp || null,
      model_year: modalMy,
      initial_price: modalPrice,
      confirmed: true,
      updated_by: user.id,
    })
    setConfirmOpen(false)
    loadData()
  }

  const handleDeleteCar = async () => {
    if (!id) return
    await deleteCar(id)
    navigate('/cars')
  }

  const handleUnconfirm = async () => {
    if (!id || !user) return
    await updateCar(id, { confirmed: false, updated_by: user.id })
    loadData()
  }

  const handleMoveStage = async (stage: CarStage, evUrl?: string | null) => {
    if (!id || !user) return
    await moveToStage(id, stage, evUrl ?? null, '', user.id)
    loadData()
  }

  const handleSaveFees = async (data: Partial<CarFees>) => {
    if (!id) return
    await upsertCarFees({ car_id: id, id: fees?.id, ...data })
    loadData()
  }

  const handleSaveCustomer = async () => {
    if (!id || !user) return
    await upsertCustomer({ car_id: id, id: (customerData as any).id, ...customerData })
    loadData()
  }

  const handleUploadEvidence = async () => {
    if (!id || !evidenceFile) return
    setUploading(true)
    setUploadError('')
    try {
      const { publicUrl } = await uploadFile('car_attachments', `evidence/${id}`, evidenceFile)
      setEvidencePublicUrl(publicUrl)
      setEvidenceFile(null)
      loadData()
    } catch (err: any) {
      setUploadError(err?.message || t('app.error'))
    } finally {
      setUploading(false)
    }
  }

  const handleAddAttachment = async () => {
    if (!id || !newAttachFile) return
    setUploading(true)
    setUploadError('')
    try {
      const { storagePath } = await uploadFile('car_attachments', `attachments/${id}`, newAttachFile)
      await addAttachment({ car_id: id, name: newAttachFile.name, storage_path: storagePath })
      setNewAttachFile(null)
      loadData()
    } catch (err: any) {
      setUploadError(err?.message || t('app.error'))
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAttachment = async (att: CarAttachment & { publicUrl: string }) => {
    await deleteAttachment(att.id, att.storage_path)
    loadData()
  }

  const handleRequestDelete = async () => {
    if (!id || !user) return
    await createDeleteRequest({ car_id: id, requested_by: user.id, reason: deleteRequestReason })
    setDeleteRequestOpen(false)
    setDeleteRequestReason('')
    loadData()
  }

  const handleReviewDelete = async (reqId: string, status: 'approved' | 'rejected') => {
    if (!user) return
    const deletedCarId = await reviewDeleteRequest(reqId, status, user.id)
    if (status === 'approved' && deletedCarId) {
      navigate('/cars')
    } else {
      loadData()
    }
  }

  const handleAddPayment = async () => {
    if (!id || !user || paymentAmount <= 0) return
    let receiptUrl: string | null = null
    if (paymentReceipt) {
      const result = await uploadFile('car_attachments', `receipts/${id}`, paymentReceipt)
      receiptUrl = result.storagePath
    }
    await createCustomerPayment({
      car_id: id,
      amount: paymentAmount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      receipt_url: receiptUrl,
      notes: paymentNotes,
      created_by: user.id,
    })
    setPaymentOpen(false)
    setPaymentAmount(0)
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentMethod('cash')
    setPaymentReceipt(null)
    setPaymentNotes('')
    loadData()
  }

  const handleDeletePayment = async (payment: CustomerPayment) => {
    await deleteCustomerPayment(payment.id, payment.receipt_url || undefined)
    loadData()
  }

  const openEditPayment = (payment: CustomerPayment) => {
    setPaymentEdit(payment)
    setEditAmount(payment.amount)
    setEditDate(payment.payment_date)
    setEditMethod(payment.payment_method)
    setEditNotes(payment.notes)
    setEditReceipt(null)
  }

  const handleUpdatePayment = async () => {
    if (!paymentEdit) return
    let receiptUrl = paymentEdit.receipt_url
    if (editReceipt) {
      const result = await uploadFile('car_attachments', `receipts/${paymentEdit.car_id}`, editReceipt)
      receiptUrl = result.storagePath
    }
    await updateCustomerPayment(paymentEdit.id, {
      amount: editAmount,
      payment_date: editDate,
      payment_method: editMethod,
      notes: editNotes,
      receipt_url: receiptUrl,
    })
    setPaymentEdit(null)
    loadData()
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

  if (loading) return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('app.loading')}</div>
  if (!car) return <div className="text-center py-8 text-gray-400 dark:text-gray-500">{t('app.no_data')}</div>

  const stageIndex = STAGE_ORDER.indexOf(car.current_stage)
  const nextStage = stageIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIndex + 1] : null
  const blockedToShipping = nextStage === 'shipping_prep' && !(fees && fees.deposit_02 > 0)
  const hasDeposit = fees && fees.deposit > 0
  const evidenceRequired = car.current_stage === 'deposit' && hasDeposit
  const evidenceBlocked = evidenceRequired && !evidencePublicUrl

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link to="/cars" className="text-blue-600 dark:text-blue-400 hover:underline">{t('app.back')}</Link>
        <h1 className="text-2xl font-bold flex-1">{car.name} ({car.model_year}) {car.code ? <span className="text-sm font-mono text-gray-400 dark:text-gray-500">[{car.code}]</span> : ''}</h1>
        {canEdit && (
          <Link to={`/cars/${id}/edit`} className="bg-gray-200 dark:bg-gray-600 px-4 py-2 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm">
            {t('app.edit')}
          </Link>
        )}
        {user?.role === 'admin' && (
          <button onClick={() => setDeleteConfirmOpen(true)}
            className="bg-red-50 dark:bg-red-900/300 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm">
            🗑 {t('car.delete_car')}
          </button>
        )}
        {user?.role === 'employee' && !deleteRequests.find(r => r.status === 'pending') && !deleteRequests.find(r => r.status === 'approved') && (
          <button onClick={() => setDeleteRequestOpen(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 text-sm">
            {t('car.delete_request')}
          </button>
        )}
        {user?.role === 'employee' && deleteRequests.find(r => r.status === 'pending') && (
          <span className="text-yellow-600 dark:text-yellow-400 text-sm flex items-center gap-1">
            ⏳ {t('car.delete_request_pending')}
          </span>
        )}
        {user?.role === 'employee' && deleteRequests.find(r => r.status === 'approved') && (
          <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
            ✓ {t('car.delete_request_sent')}
          </span>
        )}
        {user?.role === 'employee' && deleteRequests.find(r => r.status === 'rejected') && (
          <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
            ✗ {t('car.delete_request_rejected')}
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
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

        {canEdit && car.current_stage === 'request' && !car.confirmed && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-700 mb-3">{t('car.confirm_car_details')}</p>
            <button onClick={handleOpenConfirm} className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 text-sm">
              {t('car.confirm_order')}
            </button>
          </div>
        )}

        {canEdit && car.current_stage === 'request' && car.confirmed && nextStage && (
          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={handleUnconfirm}
              className="bg-red-100 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 text-sm">
              {t('car.undo_confirm')}
            </button>
            <button onClick={() => handleMoveStage(nextStage)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
              {t(`car.move_to_${nextStage}`)}
            </button>
          </div>
        )}

        {canEdit && car.current_stage === 'deposit' && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.deposit_amount')}</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <input type="number" value={fees?.deposit || 0} min={0} max={car.initial_price}
                  onChange={e => handleSaveFees({ deposit: Number(e.target.value) })}
                  className="border rounded-lg p-2 w-full sm:w-48 outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('car.cannot_exceed_price')}: {formatPrice(car.initial_price)}</span>
              </div>
            </div>
            {hasDeposit && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-blue-800 dark:text-blue-300">{t('car.evidence')}</label>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-sm text-gray-500 dark:text-gray-400">
                    <span>📎</span>
                    <span className={evidenceFile ? 'text-gray-800 dark:text-gray-200 font-medium' : ''}>
                      {evidenceFile ? evidenceFile.name : t('car.select_file')}
                    </span>
                    <input type="file" onChange={e => setEvidenceFile(e.target.files?.[0] || null)}
                      accept="image/*,.pdf" className="hidden" />
                  </label>
                  <button onClick={handleUploadEvidence} disabled={!evidenceFile || uploading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap">
                    {uploading ? t('car.uploading') : t('car.upload_evidence')}
                  </button>
                </div>
                {uploadError && <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
                {evidencePublicUrl ? (
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                    <span>✓ {t('car.evidence_uploaded')}</span>
                    <button onClick={() => handleMoveStage('purchase', evidencePublicUrl)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm ml-auto">
                      {t('car.move_to_purchase')}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-orange-600 dark:text-orange-300">{t('car.evidence_required')}</p>
                )}
              </div>
            )}
          </div>
        )}

        {canEdit && car.confirmed && nextStage && nextStage !== 'deposit' && nextStage !== 'purchase' && !evidenceBlocked && !blockedToShipping && (
          <button onClick={() => handleMoveStage(nextStage)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            {t(`car.move_to_${nextStage}`)}
          </button>
        )}
        {canEdit && car.confirmed && blockedToShipping && (
          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-sm text-orange-700">
            {t('car.deposit_02_required')}
          </div>
        )}

        {canEdit && car.current_stage === 'purchase' && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">{t('car.deposit_02')}</label>
            <input type="number" value={fees?.deposit_02 || 0} min={0}
              onChange={e => handleSaveFees({ deposit_02: Number(e.target.value) })}
              className="border rounded-lg p-2 w-full sm:w-48 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4">{t('car.info')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.serial_number')}:</span> <span className="font-mono">{car.serial_number || '-'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.license_plate')}:</span> <span>{car.license_plate || '-'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.seller_phone')}:</span> <span>{car.seller_phone || '-'}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.initial_price')}:</span> <span>{formatPrice(car.initial_price)}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.current_stage')}:</span> <span>{t(STAGE_LABELS[car.current_stage])}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">{t('car.confirmed')}:</span>
            <span className={car.confirmed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>{car.confirmed ? t('app.yes') : t('app.no')}</span>
          </div>
        </div>
      </div>

      {requestClient && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.request_client')}</h2>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-500 dark:text-gray-400">{t('car.client_name')}:</span> {requestClient.name}</p>
            {requestClient.phone && <p><span className="text-gray-500 dark:text-gray-400">{t('car.client_phone')}:</span> {requestClient.phone}</p>}
          </div>
        </div>
      )}

      {(car.current_stage === 'purchase' || car.current_stage === 'shipping_prep' || car.current_stage === 'shipping') && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.fees')}</h2>
          <div className="space-y-3 max-w-full overflow-hidden">
            {(['deposit', 'deposit_02', 'transport_01', 'parking', 'other_fees', 'transport_02'] as const).map(key => {
              const dateKey = `${key}_date` as keyof CarFees
              return (
                <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <label className="sm:w-28 text-sm text-gray-600 dark:text-gray-300">{t(`car.${key}`)}</label>
                  <input type="number" value={fees?.[key] || 0} min={0}
                    onChange={e => handleSaveFees({ [key]: Number(e.target.value) })}
                    className="border rounded-lg p-2 w-full sm:w-36 outline-none focus:ring-2 focus:ring-blue-500" />
                  <input type="date" value={fees?.[dateKey] as string || ''}
                    onChange={e => handleSaveFees({ [key]: fees?.[key] || 0, [dateKey]: e.target.value || null } as any)}
                    className="border rounded-lg p-2 w-full sm:w-36 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )
            })}
            <div className="text-sm font-medium pt-2 border-t dark:border-gray-700">
              {t('car.total_fees')}: {fees ? formatPrice(fees.deposit + fees.deposit_02 + fees.transport_01 + fees.parking + fees.other_fees + fees.transport_02) : '₩0'}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4">{t('car.attachments')}</h2>
        {attachments.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-3">{t('app.no_data')}</p>
        ) : (
          <div className="space-y-2 mb-4">
             {attachments.map(att => (
              <div key={att.id} className="flex items-center gap-3 text-sm border-b dark:border-gray-700 pb-2">
                <a href={att.publicUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1">{att.name}</a>
                {canEdit && (
                  <button onClick={() => handleDeleteAttachment(att)}
                    className="text-red-500 dark:text-red-400 hover:text-red-700 dark:text-red-300 text-xs px-2">✕</button>
                )}
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <label className="flex-1 flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-sm text-gray-500 dark:text-gray-400">
              <span>📎</span>
              <span className={newAttachFile ? 'text-gray-800 dark:text-gray-200 font-medium' : ''}>
                {newAttachFile ? newAttachFile.name : t('car.select_file')}
              </span>
              <input type="file" onChange={e => setNewAttachFile(e.target.files?.[0] || null)}
                className="hidden" />
            </label>
            <button onClick={handleAddAttachment} disabled={!newAttachFile || uploading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap">
              {uploading ? t('car.uploading') : t('car.add_attachment')}
            </button>
          </div>
        )}
        {uploadError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{uploadError}</p>}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t('payments.car_payments')}</h2>
          {canEdit && (
            <button onClick={() => setPaymentOpen(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
              + {t('payments.add')}
            </button>
          )}
        </div>
        {payments.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm">{t('app.no_data')}</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 text-sm border-b dark:border-gray-700 pb-2 flex-wrap">
                <span className="text-gray-500 dark:text-gray-400 text-xs">{p.payment_date}</span>
                <span className="font-semibold text-green-700 dark:text-green-300">{formatPrice(p.amount)}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{t(PAYMENT_METHOD_LABELS[p.payment_method])}</span>
                {p.receipt_url && (
                  <a href={getClient().storage.from('car_attachments').getPublicUrl(p.receipt_url).data.publicUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs">{t('payments.receipt')}</a>
                )}
                {p.notes && <span className="text-gray-500 dark:text-gray-400 text-xs">{p.notes}</span>}
                {user?.role === 'admin' && (
                  <>
                    <button onClick={() => openEditPayment(p)}
                      className="text-blue-500 hover:text-blue-700 text-xs px-1">✎</button>
                    <button onClick={() => handleDeletePayment(p)}
                      className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                  </>
                )}
              </div>
            ))}
            <div className="pt-2 text-sm font-medium border-t dark:border-gray-700">
              {t('payments.total')}: {formatPrice(totalPaid)}
            </div>
          </div>
        )}
      </div>

      {(car.current_stage === 'shipping_prep' || car.current_stage === 'shipping') && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.customer_info')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['full_name_latin', 'national_id', 'address_latin', 'postal_code', 'phone', 'email'] as const).map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t(`car.${key}`)}{key !== 'email' && <> <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></>}</label>
                <input value={customerData?.[key] || ''}
                  onChange={e => setCustomerData((prev: Partial<Customer>) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          {canEdit && (
            <button onClick={handleSaveCustomer} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
              {t('app.save')}
            </button>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4">{t('car.stage_history')}</h2>
        {stageLogs.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm">{t('app.no_data')}</p>
        ) : (
          <div className="space-y-2">
            {stageLogs.map((log: CarStageLog) => (
              <div key={log.id} className="flex items-center gap-3 text-sm border-b dark:border-gray-700 pb-2 last:border-0 flex-wrap">
                <span className="text-gray-500 dark:text-gray-400 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs">{t(STAGE_LABELS[log.stage as CarStage])}</span>
                {log.evidence_url && (
                  <a href={log.evidence_url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs">{t('car.evidence')}</a>
                )}
                {log.notes && <span className="text-gray-600 dark:text-gray-300">{log.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {user?.role === 'admin' && deleteRequests.filter(r => r.status === 'pending').length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-4">{t('car.manage_delete_requests')}</h2>
          {deleteRequests.filter(r => r.status === 'pending').map(dr => (
            <div key={dr.id} className="border dark:border-gray-700 rounded-lg p-4 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('car.delete_request_reason')}: {dr.reason || '-'}</p>
              <div className="flex gap-2">
                <button onClick={() => handleReviewDelete(dr.id, 'approved')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                  {t('car.approve_delete')}
                </button>
                <button onClick={() => handleReviewDelete(dr.id, 'rejected')}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm">
                  {t('car.reject_delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setConfirmOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('car.confirm_car_details')}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.license_plate')}</label>
              <input value={modalLp} onChange={e => setModalLp(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.model_year')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
              <select value={modalMy} onChange={e => setModalMy(Number(e.target.value))}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                {MODEL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.initial_price')} (₩)</label>
              <input type="number" value={modalPrice || ''} onChange={e => setModalPrice(Number(e.target.value))} min={0}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setConfirmOpen(false)}
                className="flex-1 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleConfirmSave}
                className="flex-1 p-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm transition-colors">
                {t('app.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRequestOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setDeleteRequestOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('car.delete_request')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('car.delete_request_reason')}</label>
              <textarea value={deleteRequestReason} onChange={e => setDeleteRequestReason(e.target.value)}
                rows={3} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteRequestOpen(false)}
                className="flex-1 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-sm transition-colors">
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

      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setDeleteConfirmOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('car.delete_confirm_title')}</h2>
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
              <span className="text-lg">⚠️</span>
              <p>{t('car.delete_confirm_text')}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleDeleteCar}
                className="flex-1 p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition-colors">
                {t('car.delete_car')}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setPaymentOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 space-y-4"
               onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{t('payments.add')}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.amount')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
              <input type="number" value={paymentAmount || ''} onChange={e => setPaymentAmount(Number(e.target.value))} min={0}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.date')} <span className="text-red-500">*</span> <span className="text-xs text-gray-400">{t('app.required')}</span></label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.method')}</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                {(['cash', 'bank_transfer', 'check', 'credit_card'] as PaymentMethod[]).map(m => (
                  <option key={m} value={m}>{t(PAYMENT_METHOD_LABELS[m])}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.receipt')}</label>
              <input type="file" onChange={e => setPaymentReceipt(e.target.files?.[0] || null)}
                accept="image/*,.pdf" className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.notes')}</label>
              <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)}
                rows={2} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPaymentOpen(false)}
                className="flex-1 p-3 bg-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-600 text-sm transition-colors">
                {t('app.cancel')}
              </button>
              <button onClick={handleAddPayment} disabled={paymentAmount <= 0}
                className="flex-1 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm transition-colors disabled:opacity-50">
                {t('app.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => setPaymentEdit(null)}>
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
              {paymentEdit.receipt_url && (
                <p className="text-xs text-gray-500 mt-1">{t('payments.current_receipt')}: <a href={getClient().storage.from('car_attachments').getPublicUrl(paymentEdit.receipt_url).data.publicUrl}
                  target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t('payments.receipt')}</a></p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('payments.notes')}</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                rows={2} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPaymentEdit(null)}
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
