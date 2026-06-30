import React from 'react'
import { Navigate } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
// import DoctorRegister from './pages/auth/DoctorRegister'

import PatientDashboard from './pages/patient/PatientDashboard'
// import PatientProfile from './pages/patient/PatientProfile'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import RequireAuth from './components/auth/RequireAuth';
import PatientHistory from './pages/doctor/DoctorPatientHistoryAccess';

// import ProtectedRoute from './components/auth/ProtectedRoute'
import AuthNavBar from './components/layout/AuthNavBar'
import DoctorScheduleManagement from "./pages/doctor/DoctorScheduleManagement";
import PatientAppointmentBooking from './pages/patient/PatientAppointmentBooking';

export default function App(){
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AuthNavBar />

      <Routes>

        {/* Public Routes */}
        <Route path="/" element={<Landing/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/register" element={<Register/>} />
        {/* <Route path="/register-doctor" element={<DoctorRegister/>} /> */}

        {/* Patient */}
        <Route
          path="/patient-dashboard"
          element={
            <RequireAuth role="patient">
              <PatientDashboard />
            </RequireAuth>
          }
        />
        

        {/* Doctor */}
        <Route
          path="/doctor"
          element={
            <RequireAuth role="doctor">
              <DoctorDashboard />
            </RequireAuth>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RequireAuth role="admin">
              <AdminDashboard />
            </RequireAuth>
          }
        />
        <Route path="/doctor/patient/:id" element={
          <RequireAuth role="doctor">
            <PatientHistory />
          </RequireAuth>
        } />
        <Route path="/patient/book-appointment" element={<PatientAppointmentBooking />} />
        <Route path="/doctor/schedule" element={<DoctorScheduleManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>

    </div>
  )
}
