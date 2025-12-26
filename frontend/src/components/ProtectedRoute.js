/**
 * Protected Route Component
 * Redirects to login if not authenticated
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// For Trainer routes
export const TrainerRoute = ({ children }) => {
    const { isTrainerLoggedIn, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!isTrainerLoggedIn) {
        return <Navigate to="/trainer/login" replace />;
    }

    return children;
};

// For Attendance admin routes
export const AttendanceRoute = ({ children }) => {
    const { isAttendanceLoggedIn, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!isAttendanceLoggedIn) {
        return <Navigate to="/attendance/login" replace />;
    }

    return children;
};

export default { TrainerRoute, AttendanceRoute };
