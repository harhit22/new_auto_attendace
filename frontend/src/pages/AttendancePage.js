/**
 * Attendance Page
 * Face-verified check-in and check-out
 */
import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { attendanceAPI } from '../services/api';

const AttendancePage = () => {
    const webcamRef = useRef(null);
    const [status, setStatus] = useState('ready'); // ready, capturing, processing, success, error
    const [message, setMessage] = useState('Click the button below to mark your attendance');
    const [lastAttendance, setLastAttendance] = useState(null);
    const [attendanceHistory, setAttendanceHistory] = useState([]);

    const captureAndCheckIn = useCallback(async () => {
        if (!webcamRef.current) return;

        setStatus('capturing');
        setMessage('Capturing your face...');

        // Capture image
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
            setStatus('error');
            setMessage('Failed to capture image. Please try again.');
            return;
        }

        setStatus('processing');
        setMessage('Verifying your identity...');

        try {
            // Convert base64 to blob
            const response = await fetch(imageSrc);
            const blob = await response.blob();
            const file = new File([blob], 'checkin.jpg', { type: 'image/jpeg' });

            // Get location if available
            let location = {};
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                });
                location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
            } catch (e) {
                console.log('Location not available');
            }

            // Call check-in API
            const result = await attendanceAPI.checkIn(file, {
                device_id: navigator.userAgent.substring(0, 100),
                ...location,
            });

            setLastAttendance(result.data);
            setStatus('success');
            setMessage(`Welcome, ${result.data.employee?.name || 'User'}! Check-in successful.`);

            // Fetch history
            fetchHistory();

        } catch (error) {
            console.error('Check-in error:', error);
            setStatus('error');
            // Handle error object properly
            const errorData = error.response?.data?.error;
            const errorMsg = typeof errorData === 'object' ? (errorData.message || 'Check-in failed') : (errorData || error.message || 'Check-in failed. Please try again.');
            setMessage(errorMsg);
        }
    }, []);

    const handleCheckOut = async () => {
        if (!lastAttendance?.attendance_id) {
            setMessage('No active check-in found for today.');
            return;
        }

        setStatus('processing');
        setMessage('Processing check-out...');

        try {
            const result = await attendanceAPI.checkOut(lastAttendance.attendance_id);
            setLastAttendance(null);
            setStatus('success');
            setMessage(`Check-out successful! Total hours: ${result.data.total_hours?.toFixed(2) || 'N/A'}`);
            fetchHistory();
        } catch (error) {
            setStatus('error');
            // Handle error object properly
            const errorData = error.response?.data?.error;
            const errorMsg = typeof errorData === 'object' ? (errorData.message || 'Check-out failed') : (errorData || 'Check-out failed.');
            setMessage(errorMsg);
        }
    };

    const fetchHistory = async () => {
        try {
            const response = await attendanceAPI.getHistory({ page: 1, per_page: 5 });
            setAttendanceHistory(response.data.data || response.data || []);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    };

    const resetStatus = () => {
        setStatus('ready');
        setMessage('Click the button below to mark your attendance');
    };

    const videoConstraints = {
        width: 480,
        height: 360,
        facingMode: 'user',
    };

    return (
        <div className="container">
            <div className="header">
                <div className="logo">
                    <span className="logo-icon">⏰</span>
                    <span>AI Attendance</span>
                </div>
                <nav className="nav">
                    <a href="/" className="nav-link">Home</a>
                    <a href="/attendance" className="nav-link active">Attendance</a>
                    <a href="/enroll" className="nav-link">Enroll</a>
                </nav>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                {/* Left: Webcam and Actions */}
                <div className="card">
                    <h2 className="page-title">Mark Attendance</h2>
                    <p className="page-subtitle">Look at the camera and click to verify your identity</p>

                    <div className="webcam-container" style={{ marginTop: '20px' }}>
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            style={{ width: '100%', borderRadius: '12px' }}
                        />
                        <div className="face-guide"></div>
                    </div>

                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <div className={`status-badge ${status === 'success' ? 'success' : status === 'error' ? 'error' : 'warning'}`}>
                            {status === 'processing' && <span className="spinner" style={{ width: '16px', height: '16px' }}></span>}
                            {message}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={captureAndCheckIn}
                            disabled={status === 'processing' || status === 'capturing'}
                        >
                            {status === 'processing' ? '⏳ Processing...' : '📸 Check In'}
                        </button>

                        {lastAttendance && (
                            <button
                                className="btn btn-success btn-lg"
                                onClick={handleCheckOut}
                                disabled={status === 'processing'}
                            >
                                🏁 Check Out
                            </button>
                        )}

                        {(status === 'success' || status === 'error') && (
                            <button className="btn btn-outline" onClick={resetStatus}>
                                Try Again
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Today's Status & History */}
                <div>
                    {/* Current Status */}
                    {lastAttendance && (
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <h3>Today's Attendance</h3>
                            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '15px' }}>
                                <div className="stat-card">
                                    <div className="stat-label">Check-in Time</div>
                                    <div className="stat-value" style={{ fontSize: '20px' }}>
                                        {new Date(lastAttendance.check_in_time).toLocaleTimeString()}
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Status</div>
                                    <div className="stat-value" style={{ fontSize: '20px', color: 'var(--success-color)' }}>
                                        {lastAttendance.status}
                                    </div>
                                </div>
                            </div>

                            {lastAttendance.validation && (
                                <div style={{ marginTop: '15px', padding: '12px', background: 'var(--bg-light)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        Face Match Score: <strong>{(lastAttendance.validation.face_match_score * 100).toFixed(1)}%</strong>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* History */}
                    <div className="card">
                        <h3>Recent Attendance</h3>
                        {attendanceHistory.length > 0 ? (
                            <div style={{ marginTop: '15px' }}>
                                {attendanceHistory.map((record, index) => (
                                    <div
                                        key={record.id || index}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px',
                                            background: 'var(--bg-light)',
                                            borderRadius: '10px',
                                            marginBottom: '8px'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '500' }}>
                                                {new Date(record.check_in_time).toLocaleDateString()}
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                {new Date(record.check_in_time).toLocaleTimeString()} - {
                                                    record.check_out_time
                                                        ? new Date(record.check_out_time).toLocaleTimeString()
                                                        : 'Active'
                                                }
                                            </div>
                                        </div>
                                        <div className={`status-badge ${record.status === 'approved' ? 'success' : 'warning'}`}>
                                            {record.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', marginTop: '15px' }}>
                                No attendance records yet
                            </p>
                        )}
                        <button
                            className="btn btn-outline"
                            style={{ width: '100%', marginTop: '15px' }}
                            onClick={fetchHistory}
                        >
                            🔄 Refresh History
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendancePage;
