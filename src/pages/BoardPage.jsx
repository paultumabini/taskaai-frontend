/**
 * BoardPage.jsx — Kanban board view
 *
 * Layout:
 *   ┌─ topbar ─────────────────────────────────────┐
 *   │ [☰] My Board  <project>          [+ Add Task] │  ← hamburger only shown when sidebar closed
 *   ├─ stats row ──────────────────────────────────┤
 *   │  Total │ Completed │ In Progress │ AI Ranked  │
 *   ├─ board (horizontally scrollable) ────────────┤
 *   │ [Backlog] [To Do] [In Progress] [Review] [Done] │
 *   └──────────────────────────────────────────────┘
 *
 * Drag and drop:
 *   Uses the browser's native HTML5 Drag and Drop API (no library needed).
 *   - TaskCard sets draggable=true and writes taskId to dataTransfer on dragstart
 *   - Each column's div listens for onDragOver (enables drop) and onDrop (reads taskId)
 *   - dragOver state tracks which column is being hovered for visual highlight
 *   - moveTask() optimistically updates local state, then calls tasksAPI.move()
 *     If the API call fails, fetchAll() is called to rollback to server state.
 *
 * Task operations:
 *   Create → AddTaskModal → onTaskCreated() appends to local state
 *   Edit   → EditTaskModal → onTaskUpdated() replaces entry in local state
 *   Delete → EditTaskModal → onTaskDeleted() removes entry from local state
 *   Move   → drag-and-drop OR TaskCard move button dropdown
 *   All operations refresh stats after completion.
 */

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { tasksAPI } from '../services/api'
import TaskCard from '../components/TaskCard'
import AddTaskModal from '../components/AddTaskModal'
import EditTaskModal from '../components/EditTaskModal'
import DemoNotice from '../components/DemoNotice'
import { SunIcon, MoonIcon } from '../components/icons/ThemeIcons'
import styles from './BoardPage.module.css'

/**
 * COLUMNS — defines the kanban column order, labels, and dot colours.
 * The id values must match the Task.Status choices in Django's models.py.
 * These are the valid values for task.status and for the move() API call.
 */
const COLUMNS = [
  { id: 'backlog',    label: 'Backlog',     color: '#5a5a75' },
  { id: 'todo',       label: 'To Do',       color: '#60a5fa' },
  { id: 'inprogress', label: 'In Progress', color: '#fbbf24' },
  { id: 'review',     label: 'Review',      color: '#c084fc' },
  { id: 'done',       label: 'Done',        color: '#4ade80' },
]

/**
 * BoardPage component
 * @param {number|null} projectId    — ID of the selected project (from App state)
 * @param {string}      projectName  — Display name shown in the topbar
 * @param {string}      theme         — Current UI theme ("light" | "dark")
 * @param {function}    onToggleTheme — Toggles UI theme
 */
export default function BoardPage({ projectId, projectName, theme, onToggleTheme, isDemo }) {
  const [tasks,           setTasks]           = useState([])
  const [stats,           setStats]           = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [showAdd,         setShowAdd]         = useState(false)
  const [editTask,        setEditTask]        = useState(null)
  // Demo notice shown when testuser clicks Add Task or quick-delete
  const [showDemoNotice,  setShowDemoNotice]  = useState(false)

  /** Re-fetch tasks and stats whenever the selected project changes */
  useEffect(() => {
    if (!projectId) { setLoading(false); return }
    fetchAll()
  }, [projectId])

  /**
   * fetchAll — loads tasks and stats in parallel using Promise.all.
   * Using Promise.all means both requests fire simultaneously, halving wait time
   * compared to awaiting them sequentially.
   */
  async function fetchAll() {
    setLoading(true)
    try {
      const [taskData, statsData] = await Promise.all([
        tasksAPI.list({ project: projectId }),
        tasksAPI.stats(projectId),
      ])
      // Handle both paginated (data.results) and plain array responses
      setTasks(taskData.results ?? taskData)
      setStats(statsData)
    } catch (e) {
      console.error('Failed to fetch board data:', e)
    } finally {
      setLoading(false)
    }
  }

  // ── Task operations ───────────────────────────────────────────────────────

  /**
   * moveTask — moves a task to a new status column.
   *
   * Optimistic update strategy:
   *   1. Immediately update local state (UI feels instant)
   *   2. Call the API in the background
   *   3. If API fails, call fetchAll() to rollback to server state
   *
   * This pattern is preferred over waiting for the API because board interactions
   * should feel immediate to the user.
   */
  async function moveTask(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return  // no-op if already in target column

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

    try {
      await tasksAPI.move(taskId, newStatus)
      // Refresh stats silently — don't block the UI
      tasksAPI.stats(projectId).then(setStats).catch(() => {})
    } catch {
      // Rollback on failure
      fetchAll()
    }
  }

  /** Called by AddTaskModal after successful creation — prepends to task list */
  function onTaskCreated(task) {
    setTasks(prev => [task, ...prev])
    tasksAPI.stats(projectId).then(setStats).catch(() => {})
  }

  /** Called by EditTaskModal after successful update — replaces old task in list */
  function onTaskUpdated(updated) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    tasksAPI.stats(projectId).then(setStats).catch(() => {})
    setEditTask(null)
  }

  /** Called by EditTaskModal after successful delete — removes task from list */
  function onTaskDeleted(taskId) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    tasksAPI.stats(projectId).then(setStats).catch(() => {})
    setEditTask(null)
  }

  /**
   * Quick delete entrypoint from task cards.
   * Uses native confirm for a fast, low-risk destructive action.
   */
  async function handleQuickDelete(task) {
    if (isDemo) { setShowDemoNotice(true); return }
    const ok = window.confirm(`Delete task "${task.title}"? This cannot be undone.`)
    if (!ok) return
    try {
      await tasksAPI.delete(task.id)
      onTaskDeleted(task.id)
    } catch {
      window.alert('Failed to delete task. Please try again.')
    }
  }

  /** Filter helper — returns only tasks belonging to the given column */
  const colTasks = (colId) => tasks.filter(t => t.status === colId)

  function reorderTaskState(prev, source, destination) {
    const sourceCol = source.droppableId
    const destCol = destination.droppableId
    const bucket = Object.fromEntries(COLUMNS.map(col => [col.id, prev.filter(t => t.status === col.id)]))
    const sourceItems = [...bucket[sourceCol]]
    const [moved] = sourceItems.splice(source.index, 1)
    if (!moved) return prev

    if (sourceCol === destCol) {
      sourceItems.splice(destination.index, 0, moved)
      bucket[sourceCol] = sourceItems
    } else {
      const destItems = [...bucket[destCol]]
      destItems.splice(destination.index, 0, { ...moved, status: destCol })
      bucket[sourceCol] = sourceItems
      bucket[destCol] = destItems
    }
    return COLUMNS.flatMap(col => bucket[col.id] || [])
  }

  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result
    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return

    const taskId = Number(draggableId)
    const newStatus = destination.droppableId

    setTasks(prev => reorderTaskState(prev, source, destination))

    if (source.droppableId !== destination.droppableId) {
      try {
        await tasksAPI.move(taskId, newStatus)
        tasksAPI.stats(projectId).then(setStats).catch(() => {})
      } catch {
        fetchAll()
      }
    }
  }

  // ── Empty state — no project selected ────────────────────────────────────
  // Theme toggle is included here so it is always reachable regardless of
  // whether a project exists. Previously the topbar was empty in this state,
  // hiding the toggle from new users who hadn't created a project yet.
  if (!projectId) {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <h1 className={`${styles.pageTitle} serif`}>My Board</h1>
          <button
            className={styles.iconBtn}
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <div className={styles.empty}>
          <p className="serif" style={{ fontSize: 22, marginBottom: 8 }}>No project selected</p>
          <p className="muted">Select or create a project from the sidebar</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>

      {/* ── Topbar ── */}
      <div className={styles.topbar}>
        <h1 className={`${styles.pageTitle} serif`}>
          My Board <span className={styles.projectBadge}>{projectName}</span>
        </h1>
        <button
          className={styles.iconBtn}
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          className={styles.btnPrimary}
          onClick={() => isDemo ? setShowDemoNotice(true) : setShowAdd(true)}
        >
          <PlusIcon /> Add Task
        </button>
      </div>

      {/* ── Stats row ── */}
      {stats && (
        <div className={styles.statsRow}>
          <StatCard label="Total Tasks"    value={stats.total}                      accent="var(--accent)" />
          <StatCard label="Completed"      value={stats.by_status?.done ?? 0}       accent="var(--green)"  sub={`${stats.completion_rate}% done`} />
          <StatCard label="In Progress"    value={stats.by_status?.inprogress ?? 0} accent="var(--amber)" />
          <StatCard label="AI Prioritised" value={stats.ai_ranked}                  accent="var(--blue)" />
          {stats.overdue > 0 && <StatCard label="Overdue" value={stats.overdue} accent="var(--red)" />}
        </div>
      )}

      {/* ── Board ── */}
      {loading ? (
        /* Skeleton columns shown while data loads */
        <div className={styles.loadingRow}>
          {COLUMNS.map(c => <div key={c.id} className={styles.skeletonCol} />)}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.boardArea}>
            <div className={styles.board}>
              {COLUMNS.map(col => (
                <div key={col.id} className={styles.col}>
                  <div className={styles.colHeader}>
                    <span className={styles.colDot} style={{ background: col.color }} />
                    <span className={styles.colTitle}>{col.label}</span>
                    <span className={styles.colCount}>{colTasks(col.id).length}</span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`${styles.colBody} ${snapshot.isDraggingOver ? styles.dragOver : ''}`}
                      >
                        {colTasks(col.id).map((task, index) => (
                          <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                            {(draggableProvided) => (
                              <div
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                {...draggableProvided.dragHandleProps}
                              >
                                <TaskCard
                                  task={task}
                                  columns={COLUMNS}
                                  onMove={moveTask}
                                  onEdit={setEditTask}
                                  onDelete={handleQuickDelete}
                                  draggable={false}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colTasks(col.id).length === 0 && (
                          <div className={`${styles.colEmpty} ${snapshot.isDraggingOver ? styles.colEmptyDrag : ''}`}>
                            Drop tasks here
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Modals — rendered outside the board so they're not clipped by overflow:hidden */}
      {showAdd && (
        <AddTaskModal
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onCreated={onTaskCreated}
        />
      )}
      {editTask && (
        <EditTaskModal
          task={editTask}
          projectId={projectId}
          onClose={() => setEditTask(null)}
          onUpdated={onTaskUpdated}
          onDeleted={onTaskDeleted}
          isDemo={isDemo}
        />
      )}

      {showDemoNotice && <DemoNotice onClose={() => setShowDemoNotice(false)} />}
    </div>
  )
}

/**
 * StatCard — single KPI tile in the stats row
 * @param {string} label   — metric name (uppercase, small)
 * @param {number} value   — the number to display large
 * @param {string} accent  — CSS color for the top border stripe
 * @param {string} [sub]   — optional sub-text below the value
 *
 * The ::before pseudo-element in CSS draws the coloured top stripe
 * using the --accent-c CSS variable injected via inline style.
 */
function StatCard({ label, value, accent, sub }) {
  return (
    <div className={styles.statCard} style={{ '--accent-c': accent }}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statVal}>{value}</p>
      {sub && <p className={styles.statSub}>{sub}</p>}
    </div>
  )
}

/** Plus icon for the Add Task button */
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2a1 1 0 011 1v4h4a1 1 0 010 2H9v4a1 1 0 01-2 0V9H3a1 1 0 010-2h4V3a1 1 0 011-1z"/>
    </svg>
  )
}
