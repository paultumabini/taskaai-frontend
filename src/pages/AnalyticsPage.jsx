/**
 * AnalyticsPage.jsx
 *
 * Route-level analytics dashboard for project task insights. This page computes
 * chart-ready data from API responses and keeps visualization setup localized.
 */
import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  ArcElement, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Doughnut, Bar, Line } from 'react-chartjs-2'
import { tasksAPI } from '../services/api'
import { SunIcon, MoonIcon } from '../components/icons/ThemeIcons'
import styles from './AnalyticsPage.module.css'

ChartJS.register(
  ArcElement, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler
)

/**
 * Bar center labels plugin:
 * Renders "Task: N" centered inside each bar for quick value scanning.
 */
const barCenterLabelPlugin = {
  id: 'barCenterLabelPlugin',
  afterDatasetsDraw(chart) {
    const { ctx, data } = chart
    const meta = chart.getDatasetMeta(0)
    const values = data.datasets?.[0]?.data ?? []
    if (!meta?.data?.length || !values.length) return

    ctx.save()
    ctx.font = '600 11px "DM Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    meta.data.forEach((bar, i) => {
      const value = Number(values[i] ?? 0)
      if (!Number.isFinite(value)) return

      // For very short bars, place label just above so it remains visible.
      const isShortBar = Math.abs(bar.base - bar.y) < 22
      ctx.fillStyle = isShortBar ? '#c6c6dc' : 'rgba(16,16,24,.92)'
      const labelY = isShortBar ? bar.y - 10 : (bar.y + bar.base) / 2
      ctx.fillText(`${value <= 1 ? 'Task' : 'Tasks'}: ${value}`, bar.x, labelY)
    })

    ctx.restore()
  },
}

const CHART_COLORS = {
  accent:  'rgba(124, 106, 247, 0.85)',
  green:   'rgba(74, 222, 128, 0.85)',
  amber:   'rgba(251, 191, 36, 0.85)',
  red:     'rgba(248, 113, 113, 0.85)',
  blue:    'rgba(96, 165, 250, 0.85)',
  purple:  'rgba(192, 132, 252, 0.85)',
}

const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e1e28',
      borderColor: '#3a3a50',
      borderWidth: 1,
      titleColor: '#e8e8f0',
      bodyColor: '#9898b0',
      padding: 10,
      cornerRadius: 8,
    },
  },
}

export default function AnalyticsPage({ projectId, theme, onToggleTheme }) {
  // stats: aggregated backend counters (by_status, by_priority, completion_rate, etc.)
  // tasks: raw task list (used for the 7-day trend line)
  // loading: route-level fetch state while both requests are in-flight
  const [stats, setStats]   = useState(null)
  const [tasks, setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // No selected project means there is nothing to query.
    if (!projectId) { setLoading(false); return }

    // Fetch chart/KPI aggregates and raw tasks concurrently for faster page load.
    Promise.all([
      tasksAPI.stats(projectId),
      tasksAPI.list({ project: projectId }),
    ]).then(([s, t]) => {
      setStats(s)
      setTasks(t.results ?? t)
    }).finally(() => setLoading(false))
  }, [projectId])

  // ── Chart data ────────────────────────────────────────────────
  // All chart data is guarded by `stats &&` so these never run when stats is
  // null (loading or no project selected). Without the guard, accessing
  // stats.by_status throws a TypeError that crashes the component (blank page).
  const statusLabels = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done']
  const statusKeys   = ['backlog', 'todo', 'inprogress', 'review', 'done']
  const statusColors = [CHART_COLORS.purple, CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.accent, CHART_COLORS.green]
  const statusCounts = stats ? statusKeys.map((k) => stats.by_status?.[k] ?? 0) : []

  // Donut dataset: stable status order + explicit colors for visual consistency.
  const doughnutData = stats ? {
    labels: statusLabels,
    datasets: [{
      data: statusCounts,
      backgroundColor: statusColors,
      borderColor: '#17171e',
      borderWidth: 3,
      hoverOffset: 6,
    }],
  } : null

  const priorityData = stats ? {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      label: 'Tasks',
      data: [stats.by_priority?.high ?? 0, stats.by_priority?.med ?? 0, stats.by_priority?.low ?? 0],
      backgroundColor: [CHART_COLORS.red, CHART_COLORS.amber, CHART_COLORS.green],
      borderRadius: 6,
      borderSkipped: false,
    }],
  } : null

  // Build a simple 7-day completion trend from tasks
  const trend = buildTrend(tasks)
  const trendData = {
    labels: trend.map(d => d.label),
    datasets: [{
      label: 'Tasks created',
      data: trend.map(d => d.created),
      borderColor: CHART_COLORS.accent,
      backgroundColor: 'rgba(124,106,247,.12)',
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: CHART_COLORS.accent,
      tension: 0.4,
      fill: true,
    }, {
      label: 'Tasks done',
      data: trend.map(d => d.done),
      borderColor: CHART_COLORS.green,
      backgroundColor: 'rgba(74,222,128,.08)',
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: CHART_COLORS.green,
      tension: 0.4,
      fill: true,
    }],
  }

  const barOpts = {
    ...BASE_OPTS,
    // Keep default tooltip style while custom plugin draws in-bar values.
    plugins: { ...BASE_OPTS.plugins, tooltip: { ...BASE_OPTS.plugins.tooltip } },
    scales: {
      x: { grid: { color: '#2e2e3e' }, ticks: { color: '#9898b0', font: { family: 'DM Sans' } } },
      y: { grid: { color: '#2e2e3e' }, ticks: { color: '#9898b0', font: { family: 'DM Sans' }, stepSize: 1 }, beginAtZero: true },
    },
  }

  const lineOpts = {
    ...BASE_OPTS,
    plugins: {
      ...BASE_OPTS.plugins,
      legend: {
        display: true,
        labels: { color: '#9898b0', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { family: 'DM Sans', size: 12 } },
      },
    },
    scales: barOpts.scales,
  }

  const doughnutOpts = {
    ...BASE_OPTS,
    cutout: '72%',
    plugins: {
      ...BASE_OPTS.plugins,
      // Hide built-in legend; we render a custom status list on the left side
      // for clearer reading and tighter alignment with KPI copy.
      legend: {
        display: false,
      },
    },
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={`${styles.pageTitle} serif`}>Analytics</h1>
        <button
          className={styles.iconBtn}
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {/* Loading / empty states sit below the topbar so the theme toggle remains
          visible at all times. Previously the component returned early (before
          the topbar rendered) when loading or when no project was selected,
          making the toggle unreachable on Analytics for new users. */}
      {loading && <div className={styles.loading}>Loading analytics…</div>}
      {!loading && !stats && <div className={styles.loading}>No data yet. Create a project and add tasks to see analytics.</div>}

      {/* All chart content is gated behind this fragment — only renders when
          both loading is complete and stats data is available. */}
      {!loading && stats && <>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <KPI label="Completion Rate" value={`${stats.completion_rate}%`} accent="var(--green)" />
        <KPI label="AI Prioritised"  value={stats.ai_ranked}            accent="var(--accent)" />
        <KPI label="Overdue"         value={stats.overdue}              accent="var(--red)" />
        <KPI label="Total"           value={stats.total}                accent="var(--blue)" />
      </div>

      {/* Charts grid */}
      <div className={styles.chartsGrid}>
        {/* Doughnut – status */}
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Tasks by Status</p>
          <div className={styles.statusCardBody}>
            {/* Left legend list: explicitly positioned under title for readability. */}
            <div className={styles.statusLegend} aria-label="Status breakdown labels">
              {statusLabels.map((label, i) => (
                <div key={label} className={styles.statusLegendItem}>
                  <span className={styles.statusLegendLabelWrap}>
                    <span
                      className={styles.statusLegendDot}
                      style={{ background: statusColors[i] }}
                      aria-hidden="true"
                    />
                    <span className={styles.statusLegendText}>{label}</span>
                  </span>
                  <span className={styles.statusLegendValue}>{statusCounts[i]}</span>
                </div>
              ))}
            </div>

            {/* Right donut chart. */}
            <div className={styles.statusDonutWrap}>
              <Doughnut
                data={doughnutData}
                options={doughnutOpts}
              />
            </div>
          </div>
        </div>

        {/* Bar – priority */}
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>Tasks by Priority</p>
          <div className={styles.chartWrap} style={{ height: 260 }}>
            <Bar
              data={priorityData}
              options={barOpts}
              plugins={[barCenterLabelPlugin]}
            />
          </div>
        </div>

        {/* Line – 7-day trend */}
        <div className={`${styles.chartCard} ${styles.wide}`}>
          <p className={styles.chartTitle}>7-day Activity</p>
          <div className={styles.chartWrap} style={{ height: 220 }}>
            <Line data={trendData} options={lineOpts} />
          </div>
        </div>
      </div>

      </>}
    </div>
  )
}

function KPI({ label, value, accent }) {
  return (
    <div className={styles.kpi} style={{ '--kpi-accent': accent }}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiVal}>{value}</p>
    </div>
  )
}

function buildTrend(tasks) {
  // Build fixed 7-day window ending today.
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    days.push({
      key,
      label: d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' }),
      created: 0,
      done: 0,
    })
  }
  // Count created and completed tasks per day by ISO date prefix.
  tasks.forEach(t => {
    const createdDay = days.find(d => t.created_at?.startsWith(d.key))
    if (createdDay) createdDay.created++
    if (t.status === 'done') {
      const doneDay = days.find(d => t.updated_at?.startsWith(d.key))
      if (doneDay) doneDay.done++
    }
  })
  return days
}
