import { useState, useRef, useEffect } from 'react'
import styles from './TaskCard.module.css'

const PRI_LABEL = { high: 'High', med: 'Med', low: 'Low' }

export default function TaskCard({ task, columns, onMove, onEdit, onDelete, onDragStart, onDragEnd, draggable = true }) {
  const [showMove, setShowMove] = useState(false)
  const [menuUp,   setMenuUp]   = useState(false)
  const btnRef  = useRef(null)
  const menuRef = useRef(null)

  const today   = new Date().toISOString().split('T')[0]
  const overdue = task.due_date && task.due_date < today && task.status !== 'done'

  // Decide whether menu should open upward or downward
  function handleMoveClick() {
    if (!showMove && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setMenuUp(spaceBelow < 220)
    }
    setShowMove(v => !v)
  }

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMove) return
    function handleClick(e) {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setShowMove(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMove])

  function handleMove(colId) {
    setShowMove(false)
    if (colId !== task.status) onMove(task.id, colId)
  }

  return (
    <div
      className={`${styles.card} ${task.ai_ranked ? styles.aiHighlight : ''} ${showMove ? styles.menuOpen : ''}`}
      draggable={draggable}
      onDragStart={e => {
        if (!draggable) return
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('taskId', String(task.id))
        onDragStart?.(task.id)
        // slight delay so browser renders ghost before we add dragging class
        setTimeout(() => e.target.classList.add(styles.dragging), 0)
      }}
      onDragEnd={e => {
        if (!draggable) return
        e.target.classList.remove(styles.dragging)
        onDragEnd?.()
      }}
    >
      {task.ai_ranked && (
        <div className={styles.aiBadge}><StarIcon /> AI Ranked</div>
      )}

      <div className={styles.header}>
        <p className={styles.title}>{task.title}</p>
        <span className={`${styles.pri} ${styles[task.priority]}`}>
          <span className={styles.priDot} />
          {PRI_LABEL[task.priority]}
        </span>
      </div>

      {task.description && <p className={styles.desc}>{task.description}</p>}

      {task.tags?.length > 0 && (
        <div className={styles.tags}>
          {task.tags.map(t => <span key={t.id} className={styles.tag}>{t.name}</span>)}
        </div>
      )}

      <div className={styles.footer}>
        {task.due_date && (
          <span className={`${styles.due} ${overdue ? styles.overdue : ''}`}>
            <CalIcon />
            {formatDate(task.due_date)}{overdue ? ' · overdue' : ''}
          </span>
        )}

        <div className={styles.actions}>
          {/* Move dropdown */}
          <div className={styles.moveWrap}>
            <button ref={btnRef} className={styles.actionBtn} title="Move to column" onClick={handleMoveClick}>
              <MoveIcon />
            </button>
            {showMove && (
              <div ref={menuRef} className={`${styles.moveMenu} ${menuUp ? styles.menuUp : styles.menuDown}`}>
                {columns.map(col => (
                  <button
                    key={col.id}
                    className={`${styles.moveItem} ${col.id === task.status ? styles.moveItemActive : ''}`}
                    onClick={() => handleMove(col.id)}
                  >
                    <span className={styles.moveDot} style={{ background: col.color }} />
                    {col.label}
                    {col.id === task.status && <span className={styles.currentLabel}>current</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Edit */}
          <button className={styles.actionBtn} title="Edit task" onClick={() => onEdit(task)}>
            <EditIcon />
          </button>
          {/* Quick delete */}
          <button className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Delete task" onClick={() => onDelete?.(task)}>
            <DeleteIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

function StarIcon() { return <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 0l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg> }
function CalIcon()  { return <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M10 1H9V0H7v1H5V0H3v1H2a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1V2a1 1 0 00-1-1zM2 4h8v6H2V4z"/></svg> }
function MoveIcon() { return <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2.5 3H9v3h3l-3 2.5L6 7H4.5L8 4V1zM1 8l3-2.5V7h3v3H5.5L8 13.5 10.5 10H9V7h3v1.5L15 8l-3 2.5V9h-3v3H7.5L5 15.5 2.5 12H4V9H1V8z" opacity=".7"/></svg> }
function EditIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 1.5a2.121 2.121 0 013 3L5 14H2v-3L11.5 1.5z"/></svg> }
function DeleteIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2h4l1 1h3v2H2V3h3l1-1zm-2 4h8l-.7 8.2A1 1 0 0110.3 15H5.7a1 1 0 01-1-.8L4 6z"/></svg> }
