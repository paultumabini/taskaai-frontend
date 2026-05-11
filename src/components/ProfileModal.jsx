/**
 * ProfileModal.jsx
 *
 * Account settings modal for profile updates and optional password change.
 * Password update path requires current_password + new_password pair.
 */
import { useState } from 'react'
import { authAPI } from '../services/api'
import styles from './ProfileModal.module.css'

export default function ProfileModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    current_password: '',
    new_password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      }
      const wantsPasswordChange = form.current_password || form.new_password
      if (wantsPasswordChange) {
        payload.current_password = form.current_password
        payload.new_password = form.new_password
      }
      const updated = await authAPI.updateMe(payload)
      onSaved(updated)
      onClose()
    } catch (err) {
      const msg = err.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Failed to update profile.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h2 className={`${styles.title} serif`}>Edit Profile</h2>
        {error && <div className={styles.errorBox}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className={styles.grid2}>
            <Field label="Username" value={form.username} onChange={set('username')} required />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className={styles.grid2}>
            <Field label="First name" value={form.first_name} onChange={set('first_name')} />
            <Field label="Last name" value={form.last_name} onChange={set('last_name')} />
          </div>

          <p className={styles.sectionLabel}>Change password (optional)</p>
          <div className={styles.grid2}>
            <Field
              label="Current password"
              type="password"
              value={form.current_password}
              onChange={set('current_password')}
              placeholder="Enter current password"
            />
            <Field
              label="New password"
              type="password"
              value={form.new_password}
              onChange={set('new_password')}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, ...props }) {
  return (
    <div className={styles.row}>
      <label className={styles.label}>{label}</label>
      <input {...props} />
    </div>
  )
}
