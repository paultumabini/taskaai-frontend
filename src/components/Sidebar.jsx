/**
 * Sidebar.jsx — Navigation sidebar
 *
 * Structure:
 *   ┌── Logo row (logo + X close button) ──┐
 *   │  Workspace nav links                  │
 *   │  Projects section (header + list)     │
 *   │    Each project row:                  │
 *   │      [colour dot] [name] [✏ edit btn] │
 *   │  Footer (user info + logout)          │
 *   └───────────────────────────────────────┘
 *
 * Close / open mechanism:
 *   The logo row toggles full width vs a narrow collapsed strip (see AppShell’s
 *   .sidebarOpen / .sidebarClosed). The same control expands the sidebar again;
 *   there is no separate hamburger in the page topbar.
 *
 * Project edit button:
 *   The ✏ edit button is opacity:0 by default and fades in on row hover via CSS.
 *   This keeps the sidebar clean and uncluttered while the feature remains accessible.
 *
 * NavLink active state:
 *   react-router-dom's NavLink automatically applies the `active` class when the
 *   current route matches the `to` prop. The `end` prop on the "/" route prevents
 *   it matching all routes (it would match "/analytics" without `end`).
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LogoMark from './LogoMark';
import styles from './Sidebar.module.css';

/**
 * Sidebar component
 * @param {array}    projects        — list of project objects from the API
 * @param {number}   activeProject   — ID of the currently selected project
 * @param {function} onSelectProject — called when user clicks a project
 * @param {function} onNewProject    — opens the ProjectModal in create mode
 * @param {function} onEditProject   — opens the ProjectModal in edit mode for a project
 * @param {function} onClose         — called when user clicks the X button to hide the sidebar
 */
export default function Sidebar({
  projects = [],
  activeProject,
  collapsed = false,
  onSelectProject,
  onNewProject,
  onEditProject,
  onClose,
  onOpenProfile,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /** Logout — clears tokens from localStorage then redirects to /login */
  function handleLogout() {
    logout();
    navigate('/login');
  }

  /**
   * User initials for the avatar circle.
   * Tries first + last name initials first, falls back to first two chars of username.
   * Both are uppercased for display.
   */
  const initials = user
    ? (
        (user.first_name?.[0] || '') + (user.last_name?.[0] || '')
      ).toUpperCase() || user.username.slice(0, 2).toUpperCase()
    : '??';
  const isStaffUser =
    user?.is_staff ||
    user?.is_superuser ||
    user?.staff ||
    user?.superuser ||
    user?.status === 'Staff' ||
    user?.status === 'staff' ||
    user?.status === 'Super' ||
    user?.status === 'super';
  const userRole = isStaffUser ? 'admin' : 'user';

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* ── Logo row ── */}
      <div className={styles.logoRow}>
        <div className={styles.logoIcon}>
          <LogoMark size={18} />
        </div>
        {!collapsed && (
          <span className={`${styles.logoName} serif`}>
            Taska<span>AI</span>
          </span>
        )}

        {/**
         * X close button — hides the sidebar by calling onClose() in App.jsx
         * which sets sidebarOpen=false, animating the wrapper width to 0.
         * aria-label provided for screen reader accessibility.
         */}
        <button
          className={styles.closeBtn}
          onClick={onClose}
          title="Collapse sidebar"
          aria-label="Collapse navigation sidebar"
        >
          {/* Toggle icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {collapsed ? (
              <>
                <polyline points="6 3 11 8 6 13" />
              </>
            ) : (
              <>
                <polyline points="10 3 5 8 10 13" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* ── Workspace navigation ── */}
      {!collapsed && <p className={styles.sectionLabel}>Workspace</p>}

      {/**
       * NavLink — react-router-dom component that adds an `active` class
       * automatically when the current URL matches the `to` prop.
       * The `end` prop on "/" prevents it from matching /analytics etc.
       */}
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `${styles.navItem} ${isActive ? styles.active : ''}`
        }
      >
        <BoardIcon />
        {!collapsed && 'Board'}
      </NavLink>
      <NavLink
        to="/analytics"
        className={({ isActive }) =>
          `${styles.navItem} ${isActive ? styles.active : ''}`
        }
      >
        <ChartIcon />
        {!collapsed && 'Analytics'}
      </NavLink>
      <NavLink
        to="/timeline"
        className={({ isActive }) =>
          `${styles.navItem} ${isActive ? styles.active : ''}`
        }
      >
        <ClockIcon />
        {!collapsed && 'Timeline'}
      </NavLink>

      {/* ── Projects section ── */}
      {!collapsed && (
        <div className={styles.projectsHeader}>
          <p className={styles.sectionLabel} style={{ margin: 0 }}>
            Projects
          </p>
          {/**
           * + button to create a new project.
           * Opens ProjectModal in create mode via onNewProject callback.
           */}
          <button
            className={styles.addProjectBtn}
            onClick={onNewProject}
            title="Create new project"
            aria-label="Create new project"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a1 1 0 011 1v4h4a1 1 0 010 2H9v4a1 1 0 01-2 0V9H3a1 1 0 010-2h4V3a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
      )}

      {/* Project list */}
      {!collapsed && projects.map(p => (
        <div
          key={p.id}
          className={`${styles.projectItem} ${activeProject === p.id ? styles.active : ''}`}
        >
          {/* Left: colour dot + project name — clicking selects the project */}
          <button
            className={styles.projectBtn}
            onClick={() => onSelectProject(p.id)}
          >
            <span className={styles.colorDot} style={{ background: p.color }} />
            <span className={styles.projectName}>{p.name}</span>
          </button>

          {/**
           * Edit button — opacity:0 by default, revealed on row hover via CSS.
           * Calls onEditProject with the full project object so ProjectModal
           * can pre-populate its form fields.
           */}
          <button
            className={styles.editProjectBtn}
            onClick={() => onEditProject(p)}
            title={`Edit ${p.name}`}
            aria-label={`Edit project ${p.name}`}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.5 1.5a2.121 2.121 0 013 3L5 14H2v-3L11.5 1.5z" />
            </svg>
          </button>
        </div>
      ))}

      {/* Empty state — shown when user has no projects yet */}
      {!collapsed && projects.length === 0 && (
        <button className={styles.emptyProjects} onClick={onNewProject}>
          + Create your first project
        </button>
      )}

      {/* ── Footer — user info + logout ── */}
      <div className={styles.footer}>
        <div className={styles.userRow}>
          {/**
           * Avatar circle — shows user initials on a gradient background.
           * The gradient uses CSS custom properties so it follows the theme.
           */}
          <button
            className={styles.avatarBtn}
            onClick={onOpenProfile}
            title="Edit profile"
            aria-label="Edit profile"
          >
            <div className={styles.avatar} aria-hidden="true">
              {initials}
            </div>
          </button>
          {!collapsed && (
            <div className={styles.userInfo}>
              <p className={styles.userName}>{user?.username}</p>
              <p className={styles.userRole}>{userRole}</p>
            </div>
          )}
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            {/* Right-arrow-out-of-door logout icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ── Icon components ── */

/** Board/kanban icon for the Board nav item */
function BoardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="14" rx="1.5" />
      <rect x="9" y="1" width="6" height="9" rx="1.5" />
    </svg>
  );
}
/** Bar chart icon for the Analytics nav item */
function ChartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="9" width="3" height="6" rx="1" />
      <rect x="6" y="5" width="3" height="10" rx="1" />
      <rect x="11" y="2" width="3" height="13" rx="1" />
    </svg>
  );
}
/** Clock icon for the Timeline nav item */
function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 2a5 5 0 100 10A5 5 0 008 3zm0 2a1 1 0 011 1v2.586l1.707 1.707a1 1 0 01-1.414 1.414l-2-2A1 1 0 017 10V6a1 1 0 011-1z" />
    </svg>
  );
}
