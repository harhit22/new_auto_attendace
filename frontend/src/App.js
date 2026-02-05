/**
 * Main App Component with Routing
 * Simplified: Attendance SaaS Product Only
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

// Context
import { AuthProvider } from './context/AuthContext';
import { AttendanceRoute } from './components/ProtectedRoute';

// Public Pages
import HomePage from './pages/HomePage';

// Attendance Product (Businesses)
import AttendanceLogin from './pages/attendance/AttendanceLogin';
import AttendanceAdmin from './pages/attendance/AttendanceAdmin';
import ManagerDashboard from './pages/attendance/ManagerDashboard';
import AdminAttendancePage from './pages/attendance/AdminAttendancePage';
import AdminEmployeesPage from './pages/attendance/AdminEmployeesPage';
import AdminModelsPage from './pages/attendance/AdminModelsPage';
import FaceModelPage from './pages/attendance/FaceModelPage';
import YoloModelsPage from './pages/attendance/YoloModelsPage';
import MultiLoginPage from './pages/attendance/MultiLoginPage';
import EmployeeLogin from './pages/attendance/EmployeeLogin';
import EmployeeDashboard from './pages/attendance/EmployeeDashboard';
import HelperLoginPage from './pages/attendance/HelperLoginPage';
import VehicleCapturePage from './pages/attendance/VehicleCapturePage';
import DriverCheckoutPage from './pages/attendance/DriverCheckoutPage';
import HelperCheckoutPage from './pages/attendance/HelperCheckoutPage';
import EnrollEmployeePage from './pages/EnrollEmployeePage';
import TripDetailPage from './pages/attendance/TripDetailPage';

// Root Admin Pages
import RootAdminLogin from './pages/admin/RootAdminLogin';
import OrganizationSelector from './pages/admin/OrganizationSelector';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 100);
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8fafc'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public - Landing */}
          <Route path="/" element={<HomePage />} />

          {/* ===== ROOT ADMIN ===== */}
          <Route path="/admin/login" element={<RootAdminLogin />} />
          <Route path="/admin/select-org" element={<OrganizationSelector />} />

          {/* ===== ATTENDANCE PRODUCT ===== */}
          {/* Admin */}
          {/* <Route path="/attendance/login" element={<AttendanceLogin />} /> */}
          <Route path="/attendance/admin" element={
            <AttendanceRoute><AttendanceAdmin /></AttendanceRoute>
          } />
          <Route path="/attendance/manager" element={
            <AttendanceRoute><ManagerDashboard /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/attendance" element={
            <AttendanceRoute><AdminAttendancePage /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/trip/:tripId" element={
            <AttendanceRoute><TripDetailPage /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/employees" element={
            <AttendanceRoute><AdminEmployeesPage /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/models" element={
            <AttendanceRoute><AdminModelsPage /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/models/face" element={
            <AttendanceRoute><FaceModelPage /></AttendanceRoute>
          } />
          {/* Redirect old URLs to new face model page */}
          <Route path="/attendance/admin/models/light" element={<Navigate to="/attendance/admin/models/face" replace />} />
          <Route path="/attendance/admin/models/heavy" element={<Navigate to="/attendance/admin/models/face" replace />} />
          <Route path="/attendance/admin/yolo" element={
            <AttendanceRoute><YoloModelsPage /></AttendanceRoute>
          } />

          {/* Multi-Login with Detection */}
          <Route path="/multi-login" element={<MultiLoginPage />} />

          {/* Employee Trip Workflow */}
          <Route path="/employee/login" element={<EmployeeLogin />} />
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/employee/helper-login" element={<HelperLoginPage />} />
          <Route path="/employee/vehicle-capture" element={<VehicleCapturePage />} />
          <Route path="/employee/driver-checkout" element={<DriverCheckoutPage />} />
          <Route path="/employee/helper-checkout" element={<HelperCheckoutPage />} />

          {/* Enrollment */}
          <Route path="/enroll-employee" element={<EnrollEmployeePage />} />

          {/* Redirects */}
          <Route path="/kiosk" element={<Navigate to="/employee/login" replace />} />

          {/* Redirects */}
          {/* <Route path="/login" element={<Navigate to="/attendance/login" replace />} /> */}
          <Route path="/dashboard" element={<Navigate to="/attendance/admin" replace />} />
          <Route path="/enroll" element={<Navigate to="/enroll-employee" replace />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
