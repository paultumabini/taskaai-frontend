/**
 * App.jsx — Root application component
 *
 * Architecture overview:
 * ─────────────────────
 * App
 *  └── AuthProvider          (provides useAuth() hook to the entire tree via React Context)
 *       ├── /login  → AuthPage           (public, no auth required)
 *       └── /*      → AppShell           (protected — redirects to /login if not authenticated)
 *                        ├── sidebarWrap  (CSS-animated width: 220px ↔ 0px)
 *                        │    └── Sidebar
 *                        └── main
 *                             ├── BoardPage / AnalyticsPage / etc.
 *                             └── ProjectModal (rendered at shell level to overlay everything)
 *
 * Sidebar toggle strategy:
 * ─────────────────────────
 * State lives in AppShell (not Sidebar) so the main content area can react to
 * the collapse. The sidebarWrap div animates its width via CSS transition;
 * the Sidebar’s close/collapse control handles open state.
 *
 * Project state:
 * ──────────────
 * The project list and activeProject ID live here so they can be shared between
 * the Sidebar (renders the list) and the page components (need the active project ID).
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LogoMark from './components/LogoMark'
import { projectsAPI } from './services/api'
import Sidebar from './components/Sidebar'
import ProjectModal from './components/ProjectModal'
import ProfileModal from './components/ProfileModal'
import DemoNotice from './components/DemoNotice'
import BoardPage from './pages/BoardPage'
import AnalyticsPage from './pages/AnalyticsPage'
import TimelinePage from './pages/TimelinePage'
import AuthPage from './pages/AuthPage'
import styles from './App.module.css'

/**
 * AppShell — authenticated layout wrapper
 *
 * Only rendered when the user is logged in.
 * Manages top-level state: sidebar visibility, project list, active project, modals.
 */
function AppShell() {
  const { user, loading, setCurrentUser } = useAuth()

  /** Full list of projects owned by the current user — loaded once on mount */
  const [projects,      setProjects]      = useState([])

  /** ID of the currently selected project — drives which tasks are shown on the board */
  const [activeProject, setActiveProject] = useState(null)

  /**
   * projectModal state:
   *   null        → modal hidden
   *   'new'       → ProjectModal open in create mode
   *   {…project}  → ProjectModal open in edit mode with this project pre-filled
   */
  const [projectModal, setProjectModal] = useState(null)

  /**
   * sidebarOpen — drives the CSS width animation on .sidebarWrap
   *   true  → full width (see .sidebarOpen in App.module.css)
   *   false → collapsed / narrow (see .sidebarClosed)
   */
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  // Demo mode — testuser sees all data but cannot write anything.
  // showDemoNotice is raised at the shell level so project/profile guards
  // can trigger it without prop-drilling into deep child components.
  const isDemo = user?.username === 'testuser'
  const [showDemoNotice, setShowDemoNotice] = useState(false)

  useEffect(() => {
    const next = theme === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }, [theme])

  /** Fetch the user's projects once authentication is confirmed */
  useEffect(() => {
    if (!user) return
    projectsAPI.list()
      .then(data => {
        const list = data.results ?? data  // handle both paginated and plain array responses
        setProjects(list)
        // Auto-select first project so the board isn't blank on first load
        if (list.length > 0) setActiveProject(list[0].id)
      })
      .catch(() => {})
  }, [user])

  // Auth is still being checked (reading token from localStorage) — show spinner
  if (loading) return <LoadingScreen />
  // No valid token — send to login page
  if (!user)   return <Navigate to="/login" replace />

  /** Resolve the full project object for the currently active ID */
  const activeProjectObj = projects.find(p => p.id === activeProject) || null

  /**
   * handleProjectSaved — called by ProjectModal on successful save
   * @param {object}  saved  — the project returned by the API
   * @param {boolean} isEdit — true = update existing, false = append new
   */
  function handleProjectSaved(saved, isEdit) {
    if (isEdit) {
      // Replace the old entry in-place so the sidebar updates immediately
      setProjects(prev => prev.map(p => p.id === saved.id ? saved : p))
    } else {
      // Append new project and switch to it automatically
      setProjects(prev => [...prev, saved])
      setActiveProject(saved.id)
    }
    setProjectModal(null)
  }

  /**
   * handleProjectDeleted — called by ProjectModal on successful delete
   * Falls back to the first remaining project (or null if none left).
   */
  function handleProjectDeleted(id) {
    const remaining = projects.filter(p => p.id !== id)
    setProjects(remaining)
    setActiveProject(remaining[0]?.id || null)
    setProjectModal(null)
  }

  return (
    <div className={styles.shell}>
      {/**
       * sidebarWrap — animates between 220px and 0 via CSS transition
       * overflow:hidden is essential — it clips the 220px-wide Sidebar content
       * during the collapse animation so it doesn't spill into the main area.
       */}
      <div className={`${styles.sidebarWrap} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
        <Sidebar
          projects={projects}
          activeProject={activeProject}
          collapsed={!sidebarOpen}
          onSelectProject={setActiveProject}
          onNewProject={() => isDemo ? setShowDemoNotice(true) : setProjectModal('new')}
          onEditProject={(p) => isDemo ? setShowDemoNotice(true) : setProjectModal(p)}
          onClose={() => setSidebarOpen(v => !v)}
          onOpenProfile={() => isDemo ? setShowDemoNotice(true) : setShowProfile(true)}
        />
      </div>

      {/**
       * Main content area — flex:1 fills all space not occupied by the sidebar.
       * min-width:0 prevents flex children from overflowing their container.
       */}
      <div className={styles.main}>
        <Routes>
          <Route
            path="/"
            element={
              <BoardPage
                projectId={activeProject}
                projectName={activeProjectObj?.name || ''}
                theme={theme}
                onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
                isDemo={isDemo}
              />
            }
          />
          <Route
            path="/analytics"
            element={
              <AnalyticsPage
                projectId={activeProject}
                theme={theme}
                onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              />
            }
          />
          <Route
            path="/timeline"
            element={
              <TimelinePage
                projectId={activeProject}
                projectName={activeProjectObj?.name || ''}
                theme={theme}
                onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* ProjectModal is at shell level so it overlays both sidebar and main */}
      {projectModal && (
        <ProjectModal
          project={projectModal === 'new' ? null : projectModal}
          onClose={() => setProjectModal(null)}
          onSaved={handleProjectSaved}
          onDeleted={handleProjectDeleted}
        />
      )}
      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onSaved={setCurrentUser}
        />
      )}

      {/* Demo notice — shown when testuser attempts any write action */}
      {showDemoNotice && <DemoNotice onClose={() => setShowDemoNotice(false)} />}
    </div>
  )
}

/**
 * App — the root component
 *
 * AuthProvider must wrap Routes so that every route component can call useAuth().
 * The /login route is public; all other routes go through AppShell which enforces auth.
 */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/*"     element={<AppShell />} />
      </Routes>
    </AuthProvider>
  )
}

/** Full-screen loading spinner — shown while AuthProvider checks localStorage for a stored token */
function LoadingScreen() {
  return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', flexDirection:'column', gap:18 }}>
      <div style={{ position:'relative', width:62, height:62, display:'grid', placeItems:'center' }}>
        <svg
          width="62"
          height="62"
          viewBox="0 0 62 62"
          fill="none"
          aria-hidden="true"
          style={{ position:'absolute', inset:0 }}
        >
          <circle cx="31" cy="31" r="26" stroke="var(--border2)" strokeWidth="3.5" opacity=".35" />
          <path
            d="M31 5a26 26 0 0 1 24.2 16.6"
            stroke="var(--accent)"
            strokeWidth="3.5"
            strokeLinecap="round"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 31 31"
              to="360 31 31"
              dur="1.1s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
        <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg, var(--accent), var(--accent2))', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px rgba(124,106,247,.25)' }}>
          <LogoMark size={20} />
        </div>
      </div>
      <p style={{ color:'var(--txt3)', fontSize:14, letterSpacing:'.02em' }}>Loading TaskaAI…</p>
    </div>
  )
}

