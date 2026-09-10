import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { checkAuth, clearSession } from './lib/authGate.js'
import { useTheme } from './lib/useTheme.js'
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Main from './pages/Main.jsx'
import Absence from './pages/Absence.jsx'
import Attendance from './pages/Attendance.jsx'
import Photos from './pages/Photos.jsx'
import TwoFactor from './pages/TwoFactor.jsx'
import AdminLayout from './admin/AdminLayout.jsx'
import AdminDashboard from './admin/pages/AdminDashboard.jsx'
import AdminUsers from './admin/pages/AdminUsers.jsx'
import AdminAttendance from './admin/pages/AdminAttendance.jsx'
import AdminAbsence from './admin/pages/AdminAbsence.jsx'
import AdminPhotos from './admin/pages/AdminPhotos.jsx'
import AdminReports from './admin/pages/AdminReports.jsx'
import AdminSettings from './admin/pages/AdminSettings.jsx'

// Page title map: pathname → browser tab title
const PAGE_TITLES = {
  '/': 'Login • Absensi',
  '/change-password': 'Change Password • Absensi',
  '/main': 'Home • Absensi',
  '/attendance': 'Attendance • Absensi',
  '/absence': 'Absence • Absensi',
  '/photos': 'Photos • Absensi',
  '/main/2fa': 'Authentication Security • Absensi',
  '/admin/dashboard': 'Dashboard • Takota Admin',
  '/admin/users': 'Users • Takota Admin',
  '/admin/attendance': 'Attendance • Takota Admin',
  '/admin/absence': 'Leave & Sick • Takota Admin',
  '/admin/photos': 'Photo Gallery • Takota Admin',
  '/admin/reports': 'Reports & Export • Takota Admin',
  '/admin/settings': 'Settings • Takota Admin',
}

// Validates the JWT through GET /api/all/info on every route change.
// Invalid sessions are sent back to "/"; valid sessions sitting on "/"
// are forwarded to the backend-provided redirect_home. Also enforces
// role-based access: admins may only use /admin pages, regular users may
// only use the user pages (/main, /attendance, /absence, /photos).
const USER_ONLY_PATHS = ['/main', '/main/2fa', '/attendance', '/absence', '/photos']

function AuthGate() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    async function validateAndRoute() {
      const cookieBefore = typeof document !== 'undefined' ? document.cookie : ''
      const result = await checkAuth()
      if (cancelled) return

      // Invalid session: force logout and redirect to login.
      // Skip the wipe if the session changed while we were checking
      // (e.g. the user just logged in) so we never delete a fresh cookie.
      if (result.valid === false) {
        const cookieAfter = typeof document !== 'undefined' ? document.cookie : ''
        if (cookieAfter === cookieBefore) {
          clearSession()
        }
        if (location.pathname !== '/') {
          toast.error("Session invalid, please login again")
          navigate('/', { replace: true })
        }
        return
      }

      // Valid session
      if (result.valid === true) {
        const isAdmin = result.role === 'admin'
        const onUserPage = USER_ONLY_PATHS.includes(location.pathname)
        const onAdminPage = location.pathname === '/admin' || location.pathname.startsWith('/admin/')

        // Role mismatch: redirect to appropriate home
        if ((isAdmin && onUserPage) || (!isAdmin && onAdminPage)) {
          navigate(isAdmin ? '/admin/dashboard' : '/main', { replace: true })
          return
        }

        // On login page: redirect to home
        if (location.pathname === '/') {
          navigate(result.redirectHome, { replace: true })
          return
        }
      }
    }

    validateAndRoute()
    return () => {
      cancelled = true
    }
  }, [location.pathname, navigate]) // Re-validate on every route change

  return null
}

export default function App() {
  const { theme } = useTheme()
  const location = useLocation()

  // Update browser tab title based on current route
  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || 'Absensi'
  }, [location.pathname])

  return (
    <>
      {/* Error / status messages, centered top, per spec */}
      <Toaster position="top-center" richColors closeButton theme={theme} />

      <AuthGate />

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/main" element={<Main />} />
        <Route path="/main/2fa" element={<TwoFactor />} />
        <Route path="/absence" element={<Absence />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/photos" element={<Photos />} />

        {/* Backend redirect_home for admins is "/admin" (index redirects to /admin/dashboard) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="absence" element={<AdminAbsence />} />
          <Route path="photos" element={<AdminPhotos />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}