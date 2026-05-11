# TaskaAI Frontend

**Live app:** [https://taskaai.vercel.app/](https://taskaai.vercel.app/)

**Demo login:** username `testuser`, password `testuser123`

React + Vite SPA for TaskaAI.

## Tech Stack

- React 18 + React Router v6
- Vite
- Axios (JWT + refresh interceptor)
- Chart.js + react-chartjs-2
- @hello-pangea/dnd
- CSS Modules

## Project Structure

```text
src/
├── components/
│   ├── AddTaskModal.jsx
│   ├── EditTaskModal.jsx
│   ├── ProfileModal.jsx
│   ├── ProjectModal.jsx
│   ├── Sidebar.jsx
│   ├── TaskCard.jsx
│   └── icons/ThemeIcons.jsx
├── contexts/
│   └── AuthContext.jsx
├── pages/
│   ├── AuthPage.jsx
│   ├── BoardPage.jsx
│   ├── AnalyticsPage.jsx
│   └── TimelinePage.jsx
├── services/
│   └── api.js
├── App.jsx
├── main.jsx
└── index.css
```

## Quick Start

1) Install dependencies:

```bash
cd taskaai_frontend
npm install
```

2) Create env file:

```bash
cp .env.example .env.local
```

3) Run dev server:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend expected at: `http://localhost:8000` (via Vite `/api` proxy)

## Routes

- `/login` — login + register
- `/` — board (kanban + drag/drop + task CRUD + AI suggest)
- `/analytics` — charts/KPI dashboard
- `/timeline` — timeline view for due-date planning

## Theme + Icons

- Theme state lives in `App.jsx` and persists in `localStorage`.
- Shared sun/moon icons are centralized in `src/components/icons/ThemeIcons.jsx`.

## Build

```bash
npm run build
```

Output is written to `dist/`.

## Deployment Note

For this repository, recommended portfolio deployment is:

- Frontend: Vercel
- Backend: Render
- Database: Neon or Supabase

Set:

```bash
VITE_API_URL=https://your-backend.onrender.com/api
```

Full deployment steps (Vercel + Render + Neon) are documented in the [backend repo](https://github.com/paultumabini/taskaai-backend).
