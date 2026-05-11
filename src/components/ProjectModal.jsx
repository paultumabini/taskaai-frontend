/**
 * ProjectModal.jsx
 *
 * Handles project create/edit/delete in a single modal.
 * Uses two-step confirmation for destructive delete actions.
 */
import { useState } from 'react'
import { projectsAPI } from '../services/api'
import styles from './AddTaskModal.module.css'

const COLORS = [
  '#7c6af7', '#4ade80', '#fbbf24', '#f87171',
  '#60a5fa', '#c084fc', '#34d399', '#fb923c',
]

export default function ProjectModal({ project, onClose, onSaved, onDeleted }) {
  const isEdit = !!project
  const [form, setForm]       = useState({
    name:        project?.name        || '',
    description: project?.description || '',
    color:       project?.color       || '#7c6af7',
  })
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error,      setError]      = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = isEdit
        ? await projectsAPI.update(project.id, form)
        : await projectsAPI.create(form)
      onSaved(saved, isEdit)
    } catch {
      setError('Failed to save project. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await projectsAPI.delete(project.id)
      onDeleted(project.id)
    } catch {
      setError('Failed to delete project.')
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h2 className={`${styles.title} serif`}>
          {isEdit ? 'Edit Project' : 'New Project'}
        </h2>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSave}>
          <div className={styles.row}>
            <label className={styles.label}>Project name</label>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Portfolio App"
              required
            />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={set('description')}
              placeholder="What is this project about?"
            />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Colour</label>
            <div className={styles.colorGrid}>
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorSwatch} ${form.color === c ? styles.colorSwatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                />
              ))}
            </div>
          </div>

          <div className={styles.footer}>
            {isEdit && !confirmDel && (
              <button type="button" className={styles.btnDanger} onClick={() => setConfirmDel(true)}>
                Delete
              </button>
            )}
            {isEdit && confirmDel && (
              <div className={styles.confirmRow}>
                <span className={styles.confirmText}>Delete project and all its tasks?</span>
                <button type="button" className={styles.btnDanger} onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => setConfirmDel(false)}>
                  No
                </button>
              </div>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
