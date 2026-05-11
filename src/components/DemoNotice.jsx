/**
 * DemoNotice.jsx — Read-only demo account restriction overlay
 *
 * Shown whenever a demo user (username: 'testuser') attempts a write action
 * such as creating/editing projects, creating/saving/deleting tasks, or editing
 * their profile. Drag-and-drop column moves are intentionally allowed.
 *
 * Usage: render conditionally and pass onClose to dismiss.
 *   {showDemoNotice && <DemoNotice onClose={() => setShowDemoNotice(false)} />}
 */

import { useNavigate } from 'react-router-dom'
import styles from './DemoNotice.module.css'

export default function DemoNotice({ onClose }) {
  const navigate = useNavigate()
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.box}>

        <div className={styles.iconWrap} aria-hidden="true">👋</div>

        <h2 className={`${styles.title} serif`}>Demo Account</h2>

        <p className={styles.message}>
          You're logged in as a <strong>demo user</strong>. Browsing, viewing
          tasks, and moving cards between columns is fully enabled — but adding,
          editing, or deleting data is restricted to keep the demo intact.
        </p>

        <p className={styles.cta}>
          Want the full experience?
        </p>

        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={onClose}>
            Got it
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => { onClose(); navigate('/login?register=1') }}
          >
            Sign up free
          </button>
        </div>

      </div>
    </div>
  )
}
