import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { checkAuth, clearSession } from './lib/authGate.js'
import Login from './pages/Login.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Main from './pages/Main.jsx'
import Absence from './pages/Absence.jsx'
import Attendance from './pages/Attendance.jsx'
import Photos from './pages/Photos.jsx'
import AdminLayout from './admin/AdminLayout.jsx'
import AdminDashboard from './admin/pages/AdminDashboard.jsx'
import AdminUsers from './admin/pages/AdminUsers.jsx'
import AdminAttendance from './admin/pages/AdminAttendance.jsx'
import AdminAbsence from './admin/pages/AdminAbsence.jsx'
import AdminPhotos from './admin/pages/AdminPhotos.jsx'
import AdminReports from './admin/pages/AdminReports.jsx'

// Validates the JWT through GET /api/all/info on every route change.
// Invalid sessions are sent back to "/"; valid sessions sitting on "/"
// are forwarded to the backend-provided redirect_home.
function AuthGate() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    async function run() {
      const result = await checkAuth()
      if (cancelled) return

      if (result.valid === false) {
        clearSession()
        if (location.pathname !== '/') {
          toast.error("Unvalid session, please login!")
          navigate('/', { replace: true })
        }
        return
      }

      if (result.valid === true && location.pathname === '/') {
        navigate(result.redirectHome, { replace: true })
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [location.pathname, navigate])

  return null
}

export default function App() {
  return (
    <>
      {/* Error / status messages, centered top, per spec */}
      <Toaster position="top-center" richColors closeButton />

      <AuthGate />

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/main" element={<Main />} />
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}