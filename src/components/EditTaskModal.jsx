/**
 * EditTaskModal.jsx — Edit or delete an existing task
 *
 * Tag saving fix (same root cause as AddTaskModal):
 * ──────────────────────────────────────────────────
 * React setState is asynchronous. If the user types "backend" in the tag
 * input and clicks "Save Changes" without pressing Enter, `tagInput` holds
 * "backend" but form.tag_names does NOT — setState hasn't flushed yet.
 *
 * Fix: handleSave() builds finalTags synchronously from BOTH sources:
 *   const pendingTags = tagInput.split(',')...   ← raw unconfirmed text
 *   const finalTags   = [...form.tag_names, ...pendingTags]  ← merged
 *
 * This guarantees all tags are captured regardless of how the user interacts
 * with the input (Enter key, comma, blur, or direct Save click).
 *
 * Delete confirmation:
 *   Two-step — first click shows "Sure?" inline, second click calls the API.
 *   This prevents accidental deletes. confirmDel state resets on cancel.
 *
 * PATCH vs PUT:
 *   tasksAPI.update() sends PATCH (partial update). DRF only processes fields
 *   that are present in the request body. tag_names is always included so
 *   tags are always updated (even cleared if all removed).
 *
 * AI suggestion behaviour (two modes):
 * ──────────────────────────────────────────────────
 * Mode 1 — task already has a saved suggestion (task.ai_suggestion is set):
 *   The saved suggestion text is displayed as a read-only info box.
 *   No new AI fetch is triggered — the task was already AI-ranked.
 *
 * Mode 2 — task has no saved suggestion (task.ai_suggestion is empty):
 *   Live AI fetch activates, identical to AddTaskModal — debounced 1.2s
 *   after the user types in the title field (6+ chars). The AI bar shows
 *   priority, deadline, tags, and an Apply button. On apply, aiApplied ref
 *   is set to true so handleSave() includes ai_ranked and ai_suggestion
 *   in the PATCH payload, persisting the AI data to the backend.
 */

import { useState, useEffect, useRef } from 'react'
import { tasksAPI, aiAPI } from '../services/api'
import DemoNotice from './DemoNotice'
import styles from './AddTaskModal.module.css'

export default function EditTaskModal({ task, projectId, onClose, onUpdated, onDeleted, isDemo }) {
  // Demo notice shown when testuser attempts to save or delete
  const [showDemoNotice, setShowDemoNotice] = useState(false)

  // Pre-populate form with existing task data
  const [form, setForm] = useState({
    title:       task.title       || '',
    description: task.description || '',
    status:      task.status      || 'backlog',
    priority:    task.priority    || 'med',
    due_date:    task.due_date    || '',
    // Convert Tag objects [{id, name}] to plain strings for the form
    tag_names:   task.tags?.map(t => t.name) || [],
  })

  // Raw unconfirmed text in the tag input field
  const [tagInput,   setTagInput]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [error,      setError]      = useState('')

  // true when the task was originally saved with an AI suggestion — drives which
  // AI mode renders: read-only display (Mode 1) vs live fetch (Mode 2).
  const hasExistingSuggestion = !!task.ai_suggestion

  // Mode 2 state — only used when hasExistingSuggestion is false
  const [aiData,    setAiData]    = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  // aiApplied tracks whether the user clicked "Apply suggestions" in this
  // edit session. Used in handleSave() to decide whether to write ai_ranked
  // and ai_suggestion into the PATCH payload.
  const aiApplied = useRef(false)
  const aiTimer   = useRef(null)

  /**
   * Debounced AI fetch (Mode 2 only).
   * Mirrors the same logic in AddTaskModal — waits 1.2s after the user stops
   * typing in the title field before calling the suggest endpoint.
   * Guard: returns immediately when hasExistingSuggestion is true so Mode 1
   * tasks never trigger a redundant network request.
   */
  useEffect(() => {
    if (hasExistingSuggestion) return
    clearTimeout(aiTimer.current)
    if (form.title.trim().length < 6) { setAiData(null); return }
    setAiLoading(true)
    aiTimer.current = setTimeout(async () => {
      try {
        const res = await aiAPI.suggest({ title: form.title, description: form.description })
        setAiData(res)
      } catch { setAiData(null) }
      finally  { setAiLoading(false) }
    }, 1200)
    return () => clearTimeout(aiTimer.current)
  }, [form.title, form.description])

  /**
   * applyAI — fills priority, due_date, and merges AI tags into existing tags.
   * Sets aiApplied so handleSave() knows to persist ai_ranked/ai_suggestion.
   * Identical pattern to AddTaskModal.applyAI().
   */
  function applyAI() {
    if (!aiData) return
    const due = aiData.deadline_days
      ? (() => { const d = new Date(); d.setDate(d.getDate() + aiData.deadline_days); return d.toISOString().split('T')[0] })()
      : form.due_date
    setForm(f => ({
      ...f,
      priority:  aiData.priority || f.priority,
      due_date:  due,
      tag_names: aiData.tags?.length ? [...new Set([...f.tag_names, ...aiData.tags])] : f.tag_names,
    }))
    aiApplied.current = true
    setTagInput('')
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  /**
   * commitTagInput — converts raw tagInput string to committed tag pills.
   * Called on Enter, comma key, and onBlur (when input loses focus).
   * Handles comma-separated: "frontend, backend" → ['frontend','backend']
   */
  function commitTagInput(raw) {
    const vals = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    if (!vals.length) return
    setForm(f => ({ ...f, tag_names: [...new Set([...f.tag_names, ...vals])] }))
    setTagInput('')
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTagInput(tagInput)
    }
  }

  function removeTag(tag) {
    setForm(f => ({ ...f, tag_names: f.tag_names.filter(t => t !== tag) }))
  }

  /**
   * handleSave — PATCH the task with updated fields.
   *
   * Key tag fix:
   *   finalTags is built synchronously from both committed pills (form.tag_names)
   *   AND any raw text still in the input (tagInput). This prevents losing tags
   *   that the user typed but didn't press Enter on before clicking Save.
   */
  async function handleSave(e) {
    e.preventDefault()
    if (isDemo) { setShowDemoNotice(true); return }
    setError('')

    // Merge committed pills + any unconfirmed raw text synchronously
    const pendingTags = tagInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    const finalTags   = [...new Set([...form.tag_names, ...pendingTags])]

    console.log('[EditTaskModal] Saving with tag_names:', finalTags) // debug

    setSaving(true)
    try {
      const payload = {
        title:         form.title,
        description:   form.description,
        status:        form.status,
        priority:      form.priority,
        due_date:      form.due_date || null,
        tag_names:     finalTags,
        project:       projectId,
        // Preserve existing ai_ranked flag, or promote to true if user applied
        // a new suggestion in this edit session.
        ai_ranked:     aiApplied.current || task.ai_ranked,
        // Persist the new suggestion text if applied, otherwise keep the
        // original saved suggestion so it is never accidentally cleared.
        ai_suggestion: aiApplied.current ? (aiData?.suggestion || '') : (task.ai_suggestion || ''),
      }
      const updated = await tasksAPI.update(task.id, payload)
      console.log('[EditTaskModal] Updated task response:', updated) // debug
      onUpdated(updated)
    } catch (err) {
      console.error('[EditTaskModal] Update error:', err.response?.data || err)
      const msg = err.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Failed to save changes. Please try again.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  /**
   * handleDelete — permanently deletes the task.
   * Requires two clicks (confirmDel must be true) to prevent accidents.
   * On success, calls onDeleted(task.id) so the parent removes it from state.
   */
  async function handleDelete() {
    if (isDemo) { setShowDemoNotice(true); return }
    setDeleting(true)
    try {
      await tasksAPI.delete(task.id)
      onDeleted(task.id)
    } catch {
      setError('Failed to delete task. Please try again.')
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  return (
    <>
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h2 className={`${styles.title} serif`}>Edit Task</h2>


        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSave}>

          {/* Title */}
          <div className={styles.row}>
            <label className={styles.label}>Task title</label>
            <input value={form.title} onChange={set('title')} required autoFocus />
          </div>

          {/* Description */}
          <div className={styles.row}>
            <label className={styles.label}>Description</label>
            <textarea rows={3} value={form.description} onChange={set('description')} placeholder="Add details…" />
          </div>

          {/* Status + Due date */}
          <div className={styles.grid2}>
            <div className={styles.row}>
              <label className={styles.label}>Status</label>
              <select value={form.status} onChange={set('status')}>
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>Due date</label>
              <input type="date" value={form.due_date} onChange={set('due_date')} />
            </div>
          </div>

          {/* Priority + Tag input */}
          <div className={styles.grid2}>
            <div className={styles.row}>
              <label className={styles.label}>Priority</label>
              <select value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>Tags — Enter or comma to add</label>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => commitTagInput(tagInput)}
                placeholder="e.g. frontend"
              />
            </div>
          </div>

          {/* Committed tag pills */}
          {form.tag_names.length > 0 && (
            <div className={styles.tagPills}>
              {form.tag_names.map(t => (
                <span key={t} className={styles.tagPill}>
                  {t}
                  <button type="button" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`}>×</button>
                </span>
              ))}
            </div>
          )}

          {/* ── Mode 1: read-only saved suggestion ──────────────────────────────
              Shown when the task was originally saved with an AI suggestion.
              Purely informational — no Apply button, no new fetch. */}
          {hasExistingSuggestion && (
            <div className={styles.aiBar}>
              <div className={styles.aiBarLabel}><StarIcon /> AI Suggestion (saved)</div>
              <p className={styles.aiText}>{task.ai_suggestion}</p>
            </div>
          )}

          {/* ── Mode 2: live AI suggestion bar ───────────────────────────────────
              Shown only when the task has no saved suggestion. Activates after
              the user types 6+ chars in the title (debounced 1.2s). Identical
              UI to AddTaskModal — loading dots, suggestion text, Apply button. */}
          {!hasExistingSuggestion && (aiLoading || aiData) && (
            <div className={styles.aiBar}>
              <div className={styles.aiBarLabel}><StarIcon /> AI Suggestion</div>
              {aiLoading
                ? <div className={styles.dots}><span/><span/><span/></div>
                : <>
                    <p className={styles.aiText}>{aiData.suggestion}</p>
                    <div className={styles.aiMeta}>
                      <span className={styles.aiMetaItem}>
                        Priority: <strong>{(aiData.priority || 'med').toUpperCase()}</strong>
                      </span>
                      {typeof aiData.deadline_days === 'number' && (
                        <span className={styles.aiMetaItem}>
                          Deadline: <strong>{aiData.deadline_days} day{aiData.deadline_days === 1 ? '' : 's'}</strong>
                        </span>
                      )}
                    </div>
                    {Array.isArray(aiData.tags) && aiData.tags.length > 0 && (
                      <div className={styles.aiTags}>
                        {aiData.tags.map(tag => (
                          <span key={tag} className={styles.aiTag}>#{tag}</span>
                        ))}
                      </div>
                    )}
                    <button type="button" className={styles.applyBtn} onClick={applyAI}>
                      Apply suggestions ↗
                    </button>
                  </>
              }
            </div>
          )}

          {/* Footer: delete on left, cancel+save on right */}
          <div className={styles.footer}>

            {/* Delete — two-step confirmation */}
            {!confirmDel ? (
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => setConfirmDel(true)}
              >
                Delete
              </button>
            ) : (
              <div className={styles.confirmRow}>
                <span className={styles.confirmText}>Delete this task?</span>
                <button
                  type="button"
                  className={styles.btnDanger}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => setConfirmDel(false)}
                >
                  No
                </button>
              </div>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button type="button" className={styles.btnGhost} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
    {showDemoNotice && <DemoNotice onClose={() => setShowDemoNotice(false)} />}
    </>
  )
}

function StarIcon() {
  return <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor"><path d="M5 0l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>
}
