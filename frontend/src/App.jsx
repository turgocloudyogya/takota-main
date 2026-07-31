import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
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

export default function App() {
  return (
    <>
      {/* Error / status messages, centered top, per spec */}
      <Toaster position="top-center" richColors closeButton />

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/main" element={<Main />} />
        <Route path="/absence" element={<Absence />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/photos" element={<Photos />} />

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