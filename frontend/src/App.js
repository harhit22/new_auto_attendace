/**
 * Main App Component with Routing
 * Two Products: Face Trainer (individuals) + Attendance SaaS (businesses)
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

// Context
import { AuthProvider } from './context/AuthContext';
import { TrainerRoute, AttendanceRoute } from './components/ProtectedRoute';

// Public Pages
import HomePage from './pages/HomePage';
import TransformerTutorialPage from './pages/TransformerTutorialPage';
import ProjectWalkthroughPage from './pages/ProjectWalkthroughPage';

// Trainer Product (Individuals)
import TrainerLogin from './pages/trainer/TrainerLogin';
import TrainerDashboard from './pages/trainer/TrainerDashboard';
import EnrollmentPage from './pages/EnrollmentPage';
import DatasetPage from './pages/DatasetPage';
import RecognitionPage from './pages/RecognitionPage';
import ProRecognitionPage from './pages/ProRecognitionPage';

// Attendance Product (Businesses)
import AttendanceLogin from './pages/attendance/AttendanceLogin';
import AttendanceAdmin from './pages/attendance/AttendanceAdmin';
import AdminAttendancePage from './pages/attendance/AdminAttendancePage';
import AdminEmployeesPage from './pages/attendance/AdminEmployeesPage';
import AdminModelsPage from './pages/attendance/AdminModelsPage';
import LightModelPage from './pages/attendance/LightModelPage';
import HeavyModelPage from './pages/attendance/HeavyModelPage';
import EmployeeLogin from './pages/attendance/EmployeeLogin';
import EmployeeDashboard from './pages/attendance/EmployeeDashboard';
import KioskPage from './pages/KioskPage';
import SelfEnrollPage from './pages/SelfEnrollPage';

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
          <Route path="/learn/transformers" element={<TransformerTutorialPage />} />
          <Route path="/learn/project" element={<ProjectWalkthroughPage />} />

          {/* ===== TRAINER PRODUCT ===== */}
          <Route path="/trainer/login" element={<TrainerLogin />} />
          <Route path="/trainer/dashboard" element={
            <TrainerRoute><TrainerDashboard /></TrainerRoute>
          } />
          {/* These can be accessed after trainer login */}
          <Route path="/trainer/datasets" element={
            <TrainerRoute><DatasetPage /></TrainerRoute>
          } />
          <Route path="/trainer/recognize" element={
            <TrainerRoute><ProRecognitionPage /></TrainerRoute>
          } />
          {/* Legacy routes - redirect or allow open access for now */}
          <Route path="/enroll" element={<EnrollmentPage />} />
          <Route path="/dataset" element={<DatasetPage />} />
          <Route path="/recognize" element={<RecognitionPage />} />
          <Route path="/pro" element={<ProRecognitionPage />} />

          {/* ===== ATTENDANCE PRODUCT ===== */}
          {/* Admin Login */}
          <Route path="/attendance/login" element={<AttendanceLogin />} />
          <Route path="/attendance/admin" element={
            <AttendanceRoute><AttendanceAdmin /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/attendance" element={
            <AttendanceRoute><AdminAttendancePage /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/employees" element={
            <AttendanceRoute><AdminEmployeesPage /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/models" element={
            <AttendanceRoute><AdminModelsPage /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/models/light" element={
            <AttendanceRoute><LightModelPage /></AttendanceRoute>
          } />
          <Route path="/attendance/admin/models/heavy" element={
            <AttendanceRoute><HeavyModelPage /></AttendanceRoute>
          } />

          {/* Employee Individual Login */}
          <Route path="/employee/login" element={<EmployeeLogin />} />
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />

          {/* Public kiosk and enrollment */}
          <Route path="/kiosk" element={<KioskPage />} />
          <Route path="/enroll-face" element={<SelfEnrollPage />} />

          {/* Redirects for old routes */}
          <Route path="/dashboard" element={<Navigate to="/attendance/login" replace />} />
          <Route path="/login" element={<Navigate to="/attendance/login" replace />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
