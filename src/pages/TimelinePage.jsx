/**
 * TimelinePage.jsx — Gantt-style task timeline view
 *
 * What it shows:
 *   A horizontal calendar grid spanning the current month ± 1 month (9 weeks).
 *   Each task with a due_date appears as a coloured bar positioned on its due date.
 *   Tasks without a due_date are listed separately in an "Unscheduled" section.
 *
 * Layout:
 *   ┌─ topbar ─────────────────────────────────────────┐
 *   │ Timeline  <project>  [theme]  priority legend    │
 *   ├─ today banner ────────────────────────────────────┤
 *   ├─ grid header (day columns) ───────────────────────┤
 *   │  Mon  Tue  Wed  Thu  Fri  Sat  Sun  │
 *   ├─ task rows ────────────────────────────────────────┤
 *   │  [████████ task bar ████] title     │
 *   │  [██ task bar] title                │
 *   ├─ unscheduled section ──────────────────────────────┤
 *   │  Tasks without a due date listed as pills          │
 *   └────────────────────────────────────────────────────┘
 *
 * Gantt bar positioning:
 *   Each bar spans from the task's created_at date to its due_date.
 *   Position is calculated as a percentage of the visible date range:
 *     left%  = (start_day - range_start) / total_days * 100
 *     width% = (due_day - start_day + 1) / total_days * 100
 *   This makes bars scale automatically with any viewport width.
 *
 * No backend changes needed:
 *   Uses existing tasksAPI.list({ project }) — due_date and created_at
 *   are already returned by the TaskSerializer.
 *
 * Colour coding:
 *   Bars are coloured by priority: high=red, med=amber, low=green.
 *   Overdue tasks (due_date < today and status !== 'done') have a red border.
 *   Done tasks are rendered with reduced opacity to visually de-emphasise them.
 */

import { useState, useEffect, useRef } from 'react'
import { tasksAPI } from '../services/api'
import { SunIcon, MoonIcon } from '../components/icons/ThemeIcons'
import styles from './TimelinePage.module.css'

/** Priority → bar colour mapping (matches task card priority colours) */
const PRI_COLOR = {
  high: { bg: 'rgba(248,113,113,.85)', border: '#f87171' },
  med:  { bg: 'rgba(251,191,36,.85)',  border: '#fbbf24' },
  low:  { bg: 'rgba(74,222,128,.75)',  border: '#4ade80' },
}

/** Status labels for the legend */
const STATUS_COLORS = {
  backlog:    '#5a5a75',
  todo:       '#60a5fa',
  inprogress: '#fbbf24',
  review:     '#c084fc',
  done:       '#4ade80',
}

/**
 * Build an array of Date objects representing every day in the visible range.
 * The range starts on Monday of the week containing (today - 14 days)
 * and spans 63 days (9 weeks) so there's always context before and after today.
 *
 * @returns {{ days: Date[], rangeStart: Date, rangeEnd: Date }}
 */
function buildDateRange() {
  const today      = new Date()
  today.setHours(0, 0, 0, 0)

  // Go back 14 days from today, then back to the nearest Monday
  const anchor = new Date(today)
  anchor.setDate(anchor.getDate() - 14)
  const dayOfWeek = anchor.getDay()                          // 0=Sun, 1=Mon…
  const daysToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek   // shift to Monday
  anchor.setDate(anchor.getDate() + daysToMon)

  const days = []
  for (let i = 0; i < 63; i++) {                            // 9 weeks × 7 days
    const d = new Date(anchor)
    d.setDate(anchor.getDate() + i)
    days.push(d)
  }

  return { days, rangeStart: days[0], rangeEnd: days[days.length - 1] }
}

/**
 * parseLocalDate — converts a 'YYYY-MM-DD' string to a local Date at midnight.
 * Using new Date('YYYY-MM-DD') interprets as UTC which shifts by timezone offset.
 * Adding 'T12:00:00' pins to noon local time to avoid off-by-one day issues.
 */
function parseLocalDate(str) {
  if (!str) return null
  const d = new Date(str + 'T12:00:00')
  d.setHours(0, 0, 0, 0)
  return d
}

/** Clamp a date to within [min, max] range */
function clamp(date, min, max) {
  if (date < min) return min
  if (date > max) return max
  return date
}

/**
 * TimelinePage component
 * @param {number|null} projectId    — active project ID from App state
 * @param {string}      projectName  — display name for topbar
 * @param {string}      theme        — "light" | "dark"
 * @param {function}    onToggleTheme — toggles light/dark (same as Board / Analytics)
 */
export default function TimelinePage({ projectId, projectName, theme, onToggleTheme }) {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [hoveredTask, setHoveredTask] = useState(null)   // task ID being hovered
  const todayRef = useRef(null)   // ref to scroll today into view on mount

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { days, rangeStart, rangeEnd } = buildDateRange()
  const totalDays = days.length

  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    tasksAPI.list({ project: projectId })
      .then(data => setTasks(data.results ?? data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  // Scroll so today's column is visible on mount
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [loading])

  // Separate tasks into scheduled (have due_date) and unscheduled
  const scheduled   = tasks.filter(t => t.due_date)
  const unscheduled = tasks.filter(t => !t.due_date)

  /**
   * Calculate the left% and width% for a task bar within the visible range.
   * - Start of bar: task's created_at date (or rangeStart if created before range)
   * - End of bar: task's due_date (or rangeEnd if due after range)
   * Both are clamped so bars never extend outside the grid.
   *
   * @param {object} task — task object from the API
   * @returns {{ left: string, width: string, clippedLeft: boolean, clippedRight: boolean }}
   */
  function getBarStyle(task) {
    const due     = parseLocalDate(task.due_date)
    const created = parseLocalDate(task.created_at?.split('T')[0])

    // Bar starts at created_at or rangeStart, whichever is later
    const barStart = clamp(created || rangeStart, rangeStart, rangeEnd)
    // Bar ends at due_date or rangeEnd, whichever is earlier
    const barEnd   = clamp(due, rangeStart, rangeEnd)

    const startOffset = Math.round((barStart - rangeStart) / 86400000)  // ms → days
    const endOffset   = Math.round((barEnd   - rangeStart) / 86400000)
    const spanDays    = Math.max(endOffset - startOffset + 1, 1)         // at least 1 day wide

    const left  = (startOffset / totalDays) * 100
    const width = (spanDays   / totalDays) * 100

    const isOverdue = due < today && task.status !== 'done'
    const isDone    = task.status === 'done'
    const colors    = PRI_COLOR[task.priority] || PRI_COLOR.med

    return {
      left:        `${left}%`,
      width:       `${width}%`,
      background:  colors.bg,
      borderColor: isOverdue ? '#f87171' : colors.border,
      opacity:     isDone ? 0.45 : 1,
      clippedLeft:  created < rangeStart,
      clippedRight: due > rangeEnd,
    }
  }

  if (!projectId) {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <div className={styles.topbarSpacer} aria-hidden="true" />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <div className={styles.empty}>
          <p className="serif" style={{ fontSize: 22 }}>No project selected</p>
          <p className="muted">Pick a project from the sidebar</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>

      {/* ── Topbar ── */}
      <div className={styles.topbar}>
        <h1 className={`${styles.pageTitle} serif`}>
          Timeline <span className={styles.projectBadge}>{projectName}</span>
        </h1>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Legend */}
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#f87171' }}/>High</span>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#fbbf24' }}/>Med</span>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#4ade80' }}/>Low</span>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'var(--border2)', border: '2px solid #f87171' }}/>Overdue</span>
          <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: 'var(--border2)', border: '2px solid #4ade80' }}/>Done</span>
        </div>
      </div>

      {/* ── Today banner ── */}
      <div className={styles.todayBanner}>
        <CalIcon />
        Today is <strong>{today.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
        &nbsp;·&nbsp; {scheduled.length} scheduled task{scheduled.length !== 1 ? 's' : ''}, {unscheduled.length} unscheduled
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <div className={styles.loadingPulse} />
          <p className={styles.loadingText}>Loading timeline…</p>
        </div>
      ) : (
        <div className={styles.scrollArea}>
          <div className={styles.gantt}>

            {/* ── Week header row ── */}
            <div className={styles.headerRow}>
              {/* Task label column header */}
              <div className={styles.labelColHeader}>Task</div>

              {/* Day columns header */}
              <div className={styles.daysHeader}>
                {days.map((day, i) => {
                  const isToday    = day.getTime() === today.getTime()
                  const isWeekend  = day.getDay() === 0 || day.getDay() === 6
                  const isMonday   = day.getDay() === 1
                  return (
                    <div
                      key={i}
                      ref={isToday ? todayRef : null}
                      className={`${styles.dayCell} ${isToday ? styles.todayCell : ''} ${isWeekend ? styles.weekendCell : ''} ${isMonday ? styles.mondayCell : ''}`}
                    >
                      {/* Show month name on 1st of month or first visible day */}
                      {(day.getDate() === 1 || i === 0) && (
                        <span className={styles.monthLabel}>
                          {day.toLocaleDateString('en-AU', { month: 'short' })}
                        </span>
                      )}
                      <span className={styles.dayNum}>{day.getDate()}</span>
                      <span className={styles.dayName}>{day.toLocaleDateString('en-AU', { weekday: 'narrow' })}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Task rows ── */}
            {scheduled.length === 0 && (
              <div className={styles.noScheduled}>
                No tasks have due dates yet — add a due date when creating or editing a task.
              </div>
            )}

            {scheduled.map(task => {
              const barStyle   = getBarStyle(task)
              const isOverdue  = parseLocalDate(task.due_date) < today && task.status !== 'done'
              const isDone     = task.status === 'done'
              const isHovered  = hoveredTask === task.id
              const statusColor = STATUS_COLORS[task.status] || '#5a5a75'

              return (
                <div
                  key={task.id}
                  className={`${styles.taskRow} ${isHovered ? styles.taskRowHovered : ''}`}
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
                >
                  {/* Left label column — task title + status badge */}
                  <div className={styles.labelCol}>
                    <span className={styles.statusDot} style={{ background: statusColor }} />
                    <span className={styles.taskLabel}>
                      {task.ai_ranked && <span className={styles.aiStar}>✦</span>}
                      {task.title}
                    </span>
                    {isOverdue && <span className={styles.overduePill}>overdue</span>}
                    {isDone && <span className={styles.donePill}>done</span>}
                  </div>

                  {/* Right gantt bar area */}
                  <div className={styles.barArea}>
                    {/* Today vertical line */}
                    <div
                      className={styles.todayLine}
                      style={{
                        left: `${((today.getTime() - rangeStart.getTime()) / 86400000 / totalDays) * 100}%`,
                      }}
                    />

                    {/* Weekend shading */}
                    {days.map((day, i) => (
                      (day.getDay() === 0 || day.getDay() === 6) && (
                        <div
                          key={i}
                          className={styles.weekendShade}
                          style={{ left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
                        />
                      )
                    ))}

                    {/* ── The Gantt bar ── */}
                    <div
                      className={`${styles.bar} ${isOverdue ? styles.barOverdue : ''}`}
                      style={{
                        left:       barStyle.left,
                        width:      barStyle.width,
                        background: barStyle.background,
                        borderColor: barStyle.borderColor,
                        opacity:    barStyle.opacity,
                      }}
                    >
                      {/* Clipped indicators — arrows if bar extends beyond visible range */}
                      {barStyle.clippedLeft  && <span className={styles.clipLeft}>◀</span>}
                      <span className={styles.barLabel}>{task.title}</span>
                      {barStyle.clippedRight && <span className={styles.clipRight}>▶</span>}
                    </div>

                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div className={styles.tooltip}>
                        <strong>{task.title}</strong>
                        <span>Due: {new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span>Status: {task.status}</span>
                        <span>Priority: {task.priority}</span>
                        {task.tags?.length > 0 && (
                          <span>Tags: {task.tags.map(t => t.name).join(', ')}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* ── Unscheduled tasks ── */}
            {unscheduled.length > 0 && (
              <div className={styles.unscheduledSection}>
                <div className={styles.unscheduledHeader}>
                  <UnscheduledIcon /> Unscheduled ({unscheduled.length})
                  <span className={styles.unscheduledHint}>— add a due date to place these on the timeline</span>
                </div>
                <div className={styles.unscheduledList}>
                  {unscheduled.map(task => (
                    <div key={task.id} className={styles.unscheduledPill}>
                      <span className={styles.statusDot} style={{ background: STATUS_COLORS[task.status] }} />
                      <span>{task.title}</span>
                      <span className={`${styles.priTag} ${styles[task.priority]}`}>{task.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

function CalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M13 2h-1V0h-2v2H6V0H4v2H3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2zM3 14V6h10v8H3z" />
    </svg>
  )
}

function UnscheduledIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 2a5 5 0 100 10A5 5 0 008 3zm0 2a1 1 0 011 1v3h2a1 1 0 010 2H8a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  )
}
