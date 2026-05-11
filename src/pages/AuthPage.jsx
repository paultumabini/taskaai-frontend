/**
 * AuthPage.jsx
 *
 * Combined login/register route with mode toggle. Delegates auth operations
 * to AuthContext and routes authenticated users into the app shell.
 */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LogoMark from '../components/LogoMark'
import styles from './AuthPage.module.css'

export default function AuthPage() {
  const [searchParams]        = useSearchParams()
  // Allow deep-linking directly to the register form via ?register=1
  const [mode, setMode]       = useState(searchParams.get('register') ? 'register' : 'login')
  const [form, setForm]       = useState({ username: '', email: '', password: '', password_confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register }   = useAuth()
  const navigate              = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.username, form.password)
      } else {
        await register(form)
      }
      navigate('/')
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msg = Object.values(data).flat().join(' ')
        setError(msg)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <LogoMark size={18} />
          </div>
          <span className={`${styles.logoName} serif`}>Taska<span>AI</span></span>
        </div>

        <h1 className={`${styles.title} serif`}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className={styles.sub}>
          {mode === 'login'
            ? 'Sign in to your workspace'
            : 'Start organising smarter'}
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>Username</label>
          <input
            value={form.username}
            onChange={set('username')}
            placeholder="your_username"
            autoComplete="username"
            required
          />

          {mode === 'register' && (
            <>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                required
              />
            </>
          )}

          <label className={styles.label}>Password</label>
          <div className={styles.passwordWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            <button
              type="button"
              className={styles.showPwdBtn}
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {mode === 'register' && (
            <>
              <label className={styles.label}>Confirm password</label>
              <div className={styles.passwordWrap}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.password_confirm}
                  onChange={set('password_confirm')}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.showPwdBtn}
                  onClick={() => setShowConfirmPassword(v => !v)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </>
          )}

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className={styles.switchText}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            className={styles.switchBtn}
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M1.7 10s3-5 8.3-5 8.3 5 8.3 5-3 5-8.3 5-8.3-5-8.3-5z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M1.7 10s3-5 8.3-5 8.3 5 8.3 5-3 5-8.3 5-8.3-5-8.3-5z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 17L17 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
