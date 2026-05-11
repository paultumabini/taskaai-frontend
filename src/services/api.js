/**
 * src/services/api.js
 *
 * Single API gateway for the React app.
 * - Configures axios baseURL
 * - Attaches JWT access token on requests
 * - Performs one-shot refresh retry on 401
 * - Exposes typed-by-convention endpoint groups
 */
import axios from 'axios'

// Base API URL strategy:
// - Local dev: keep '/api' so Vite proxy forwards to Django (avoids CORS in dev)
// - Production: set VITE_API_URL to full backend origin, e.g. https://api.example.com/api
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Shared axios instance so headers/interceptors are configured once for all requests.
const api = axios.create({ baseURL: BASE_URL })

// Request interceptor:
// Reads the current access token from localStorage and appends:
//   Authorization: Bearer <token>
// on every outgoing request. Public endpoints still work because header is only
// attached when a token exists.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor:
// If an API call fails with 401, attempt one refresh flow:
// 1) send refresh token to /auth/refresh/
// 2) store new access token
// 3) retry the original request once
// _retry guard prevents infinite loops when refresh also fails.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh })
        localStorage.setItem('access_token', data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        // Refresh failed (expired/invalid refresh token):
        // clear session and force user back to login.
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth/profile API group.
// Convention: each method returns response.data so UI components only handle
// payload objects, not full axios response wrappers.
export const authAPI = {
  // Create account (public endpoint).
  register: (data)           => api.post('/auth/register/', data).then(r => r.data),

  // Login and persist JWT pair for authenticated API usage.
  login: async (username, password) => {
    const { data } = await api.post('/auth/login/', { username, password })
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    return data
  },

  // Local sign-out (token removal); backend is stateless JWT so no server call needed.
  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },

  // Fetch current authenticated user profile.
  me:       ()     => api.get('/auth/me/').then(r => r.data),

  // Update user profile fields (and password flow handled by backend when provided).
  updateMe: (data) => api.patch('/auth/me/', data).then(r => r.data),
}

// Project API group (CRUD).
// List/get/update/delete operate only on projects owned by the logged-in user.
export const projectsAPI = {
  list:   ()        => api.get('/projects/').then(r => r.data),
  create: (data)    => api.post('/projects/', data).then(r => r.data),
  get:    (id)      => api.get(`/projects/${id}/`).then(r => r.data),
  update: (id, data)=> api.patch(`/projects/${id}/`, data).then(r => r.data),
  delete: (id)      => api.delete(`/projects/${id}/`),
}

// Task API group:
// - Standard CRUD endpoints
// - move(): optimized endpoint for kanban column transitions
// - stats(): aggregated counts for dashboard/analytics cards/charts
export const tasksAPI = {
  // Optional filters: project, status, priority, ai_ranked.
  list:   (params={}) => api.get('/tasks/', { params }).then(r => r.data),
  create: (data)      => api.post('/tasks/', data).then(r => r.data),
  get:    (id)        => api.get(`/tasks/${id}/`).then(r => r.data),
  update: (id, data)  => api.patch(`/tasks/${id}/`, data).then(r => r.data),
  delete: (id)        => api.delete(`/tasks/${id}/`),
  // Move a task to another status column without sending full task payload.
  move:   (id, status)=> api.post(`/tasks/${id}/move/`, { status }).then(r => r.data),
  // If projectId is omitted, backend returns stats for all accessible tasks.
  stats:  (projectId) => api.get('/tasks/stats/', {
    params: projectId ? { project: projectId } : {}
  }).then(r => r.data),
}

// AI helper API group.
// Returns suggestion payload used by AddTaskModal to prefill
// priority/suggestion/tags/deadline_days.
export const aiAPI = {
  suggest: (data) => api.post('/tasks/suggest/', data).then(r => r.data),
}

export default api
