/**
 * Authentication Context
 * Manages session state for both Trainer and Attendance products
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Trainer user (individual account)
    const [trainerUser, setTrainerUser] = useState(null);

    // Attendance organization (business account)
    const [attendanceOrg, setAttendanceOrg] = useState(null);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const savedTrainer = localStorage.getItem('trainer_user');
            const savedOrg = localStorage.getItem('attendance_org');

            if (savedTrainer) {
                setTrainerUser(JSON.parse(savedTrainer));
            }
            if (savedOrg) {
                setAttendanceOrg(JSON.parse(savedOrg));
            }
        } catch (e) {
            console.error('Error loading auth state:', e);
        }
        setIsLoading(false);
    }, []);

    // Trainer login
    const loginTrainer = (user) => {
        setTrainerUser(user);
        localStorage.setItem('trainer_user', JSON.stringify(user));
    };

    // Trainer logout
    const logoutTrainer = () => {
        setTrainerUser(null);
        localStorage.removeItem('trainer_user');
    };

    // Attendance org login
    const loginAttendance = (org) => {
        setAttendanceOrg(org);
        localStorage.setItem('attendance_org', JSON.stringify(org));
    };

    // Attendance org logout
    const logoutAttendance = () => {
        setAttendanceOrg(null);
        localStorage.removeItem('attendance_org');
    };

    const value = {
        // Trainer
        trainerUser,
        isTrainerLoggedIn: !!trainerUser,
        loginTrainer,
        logoutTrainer,

        // Attendance
        attendanceOrg,
        isAttendanceLoggedIn: !!attendanceOrg,
        loginAttendance,
        logoutAttendance,

        // General
        isLoading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export default AuthContext;
