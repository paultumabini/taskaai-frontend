/**
 * AddTaskModal.jsx — Create a new task with optional AI-assisted prioritisation
 *
 * Tag saving explanation (why tags were not saving before):
 * ──────────────────────────────────────────────────────────
 * There were TWO bugs:
 *
 * Bug 1 — tagInput not flushed on submit:
 *   The tag input is a free-text field. The user types "frontend" and might
 *   click "Add Task" without pressing Enter. The text was in `tagInput` state
 *   but NOT in `form.tag_names`. The submit handler now reads `tagInput` directly
 *   as a local variable BEFORE calling setState, so the value is captured
 *   synchronously even if React hasn't re-rendered yet.
 *
 * Bug 2 — tag_names sent as empty array when no tags pressed:
 *   The payload always included tag_names but if the user typed a tag without
 *   pressing Enter and we missed it, we sent [] to Django which called
 *   task.tags.set([]) — clearing any tags. Fixed by the flush above.
 *
 * How tags reach the DB:
 *   Frontend: tag_names: ['frontend', 'backend']
 *   → POST /api/tasks/ with JSON body
 *   → Django TaskSerializer.create() pops tag_names from validated_data
 *   → calls _set_tags(task, ['frontend', 'backend'])
 *   → Tag.objects.get_or_create(name='frontend', project=task.project)
 *   → task.tags.set([tag1, tag2])  ← sets the M2M relation in the DB
 *
 * AI suggestion flow:
 *   Title input (6+ chars) → 1.2s debounce → POST /api/tasks/suggest/
 *   → { priority, suggestion, tags, deadline_days } shown in AI bar
 *   → "Apply" button fills form fields from the AI response
 */

import { useState, useEffect, useRef } from 'react'
import { tasksAPI, aiAPI } from '../services/api'
import styles from './AddTaskModal.module.css'

export default function AddTaskModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({
    title:       '',
    description: '',
    status:      'backlog',
    priority:    'med',
    due_date:    '',
    tag_names:   [],
  })

  // Raw text in the tag input — NOT yet committed to form.tag_names
  const [tagInput,  setTagInput]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [aiData,    setAiData]    = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const aiTimer = useRef(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  // Debounced AI suggestion — fires 1.2s after user stops typing in title
  useEffect(() => {
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

  /** Apply AI suggestion — fills priority, due_date, and tag_names from the response */
  function applyAI() {
    if (!aiData) return
    const due = aiData.deadline_days
      ? (() => { const d = new Date(); d.setDate(d.getDate() + aiData.deadline_days); return d.toISOString().split('T')[0] })()
      : form.due_date
    setForm(f => ({
      ...f,
      priority:  aiData.priority  || f.priority,
      due_date:  due,
      tag_names: aiData.tags?.length ? aiData.tags : f.tag_names,
    }))
    setTagInput('')
  }

  /**
   * commitTagInput — converts the raw tagInput string into tag pills.
   * Handles comma-separated input: "frontend, backend" → ['frontend','backend']
   * Called on Enter, comma, blur, AND before submit.
   * @param {string} raw — the current tagInput value (passed directly to avoid stale closure)
   * @returns {string[]} the new tags that were added (not the full list)
   */
  function commitTagInput(raw) {
    const vals = raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    if (vals.length === 0) return []
    setForm(f => ({ ...f, tag_names: [...new Set([...f.tag_names, ...vals])] }))
    setTagInput('')
    return vals
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
   * handleSubmit — collects all form data and calls tasksAPI.create()
   *
   * CRITICAL tag fix: React setState is asynchronous — calling commitTagInput()
   * before reading form.tag_names would race. Instead we build finalTags
   * synchronously from BOTH form.tag_names (already committed pills) AND the
   * raw tagInput string (anything typed but not yet Enter'd).
   * This guarantees no tag is lost regardless of how the user interacts.
   */
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Build final tag list synchronously — don't rely on setState having flushed
    const pendingTags = tagInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    const finalTags   = [...new Set([...form.tag_names, ...pendingTags])]

    console.log('[AddTaskModal] Submitting with tag_names:', finalTags) // debug

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
        ai_ranked:     !!aiData,
        ai_suggestion: aiData?.suggestion || '',
      }
      const created = await tasksAPI.create(payload)
      console.log('[AddTaskModal] Created task response:', created) // debug
      onCreated(created)
      onClose()
    } catch (err) {
      console.error('[AddTaskModal] Create error:', err.response?.data || err)
      const msg = err.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Failed to create task. Please try again.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <h2 className={`${styles.title} serif`}>New Task</h2>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.row}>
            <label className={styles.label}>Task title</label>
            <input
              value={form.title}
              onChange={set('title')}
              placeholder="What needs to be done?"
              required
              autoFocus
            />
          </div>

          <div className={styles.row}>
            <label className={styles.label}>Description</label>
            <textarea rows={3} value={form.description} onChange={set('description')} placeholder="Add details…" />
          </div>

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
              <label className={styles.label}>Tags — press Enter or comma to add</label>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => commitTagInput(tagInput)}  // flush on click-away
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
                  <button type="button" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>×</button>
                </span>
              ))}
            </div>
          )}

          {/* AI suggestion bar */}
          {(aiLoading || aiData) && (
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

          <div className={styles.footer}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StarIcon() {
  return <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor"><path d="M5 0l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>
}
