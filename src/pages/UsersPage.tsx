import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { getUsers, createUser, updateUser, deleteUser } from '../db/cloud'
import { hash } from '../utils/hash'
import type { User, UserRole } from '../types'

export default function UsersPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'employee' as UserRole })

  const loadUsers = async () => {
    setLoading(true)
    const data = await getUsers()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ username: '', password: '', full_name: '', role: 'employee' })
    setShowModal(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.username || !form.full_name) return
    if (editing) {
      const payload: Partial<User> = { username: form.username, full_name: form.full_name, role: form.role }
      if (form.password) payload.password_hash = await hash(form.password)
      await updateUser(editing.id, payload)
    } else {
      if (!form.password) return
      const pw = await hash(form.password)
      await createUser({ username: form.username, password_hash: pw, full_name: form.full_name, role: form.role, is_active: true })
    }
    setShowModal(false)
    loadUsers()
  }

  const handleToggleActive = async (u: User) => {
    if (!u.is_active && currentUser?.role !== 'admin') return
    if (u.id === currentUser?.id) { alert(t('users.cannot_deactivate_self')); return }
    if (u.is_active && u.role === 'admin' && users.filter(x => x.role === 'admin' && x.is_active).length <= 1) {
      alert(t('users.cannot_deactivate_last_admin')); return
    }
    await updateUser(u.id, { is_active: !u.is_active })
    loadUsers()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.id === currentUser?.id) { alert(t('users.cannot_delete_self')); setDeleteTarget(null); return }
    if (deleteTarget.role === 'admin' && users.filter(x => x.role === 'admin').length <= 1) {
      alert(t('users.cannot_delete_last_admin')); setDeleteTarget(null); return
    }
    await deleteUser(deleteTarget.id)
    setDeleteTarget(null)
    loadUsers()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('users.title')}</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + {t('users.add')}
        </button>
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('app.loading')}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('users.username')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('users.full_name')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('users.role')}</th>
                <th className="text-right p-3 text-sm font-medium text-gray-600">{t('users.is_active')}</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">{t('app.edit')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{u.username}</td>
                  <td className="p-3">{u.full_name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {t(`users.${u.role}`)}
                    </span>
                  </td>
                  <td className="p-3">
                    <button onClick={() => handleToggleActive(u)} disabled={currentUser?.role !== 'admin'}
                      className={`px-3 py-1 rounded text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} disabled:opacity-50`}>
                      {u.is_active ? 'Yes' : 'No'}
                    </button>
                  </td>
                  <td className="p-3">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:text-blue-800 text-sm ml-3">{t('app.edit')}</button>
                    <button onClick={() => setDeleteTarget(u)} className="text-red-600 hover:text-red-800 text-sm">{t('app.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{editing ? t('users.edit') : t('users.add')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.username')}</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.full_name')}</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.password')} {editing ? '(leave empty to keep)' : ''}</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('users.role')}</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="employee">{t('users.employee')}</option>
                  <option value="admin">{t('users.admin')}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">{t('app.save')}</button>
                <button onClick={() => setShowModal(false)} className="bg-gray-200 px-6 py-2 rounded-lg hover:bg-gray-300">{t('app.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2 text-red-600">{t('app.delete')}</h2>
            <p className="mb-6">{t('users.confirm_delete', { username: deleteTarget.username, full_name: deleteTarget.full_name })}</p>
            <div className="flex gap-3">
              <button onClick={handleDelete} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">{t('app.delete')}</button>
              <button onClick={() => setDeleteTarget(null)} className="bg-gray-200 px-6 py-2 rounded-lg hover:bg-gray-300">{t('app.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
