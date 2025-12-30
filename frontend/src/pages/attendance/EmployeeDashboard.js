/**
 * Employee Dashboard Page
 * Shows employee's attendance history, today's status, face check-in, and enrollment options
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const [employee, setEmployee] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Face check-in state
    const [showCheckin, setShowCheckin] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [checkinStatus, setCheckinStatus] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [checkinAction, setCheckinAction] = useState('checkin');

    useEffect(() => {
        const storedEmployee = sessionStorage.getItem('employee');
        if (!storedEmployee) {
            navigate('/employee/login');
            return;
        }

        const emp = JSON.parse(storedEmployee);
        setEmployee(emp);
        loadDashboard(emp);
    }, []);

    // Load face-api models
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);
            } catch (e) {
                console.error('Failed to load face models:', e);
            }
        };
        if (showCheckin) loadModels();
    }, [showCheckin]);

    const loadDashboard = async (emp) => {
        setIsLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/employee-dashboard/?org_code=${emp.org_code}&employee_id=${emp.employee_id}`
            );
            const data = await res.json();
            if (res.ok) {
                setDashboard(data);
            }
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    const logout = () => {
        sessionStorage.removeItem('employee');
        navigate('/employee/login');
    };

    // Face verification and check-in
    const verifyAndCheckin = async () => {
        if (!webcamRef.current || !modelsLoaded || isVerifying) return;

        setIsVerifying(true);
        setCheckinStatus('🔍 Detecting face...');

        try {
            const screenshot = webcamRef.current.getScreenshot();
            if (!screenshot) {
                setCheckinStatus('❌ Could not capture image');
                setIsVerifying(false);
                return;
            }

            // Detect face using face-api.js
            const imgElement = document.createElement('img');
            imgElement.src = screenshot;
            await new Promise(r => imgElement.onload = r);

            const detection = await faceapi
                .detectSingleFace(imgElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setCheckinStatus('⚠️ No face detected. Please look at the camera.');
                setIsVerifying(false);
                return;
            }

            setCheckinStatus('✅ Face detected! Verifying...');

            // Send to backend for verification and check-in
            const formData = new FormData();
            const blob = await (await fetch(screenshot)).blob();
            formData.append('image', blob, 'face.jpg');
            formData.append('org_code', employee.org_code);
            formData.append('employee_id', employee.employee_id);
            formData.append('action', checkinAction);

            const res = await fetch(`${API_BASE}/employee-face-checkin/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setCheckinStatus(`🎉 ${data.message}`);
                // Reload dashboard to show new status
                setTimeout(() => {
                    loadDashboard(employee);
                    setShowCheckin(false);
                }, 2000);
            } else {
                setCheckinStatus(`❌ ${data.error || 'Verification failed'}`);
            }
        } catch (e) {
            console.error(e);
            setCheckinStatus('❌ Error during verification');
        }

        setIsVerifying(false);
    };

    if (isLoading || !employee) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-muted)' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '30px 20px',
                color: 'white'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                                👋 Welcome, {employee.name}
                            </h1>
                            <p style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                                {employee.org_name} • {employee.department || 'Employee'}
                            </p>
                        </div>
                        <button
                            onClick={logout}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>

                {/* Face Check-in Card */}
                <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px' }}>📷 Face Check-In</h3>

                    {!showCheckin ? (
                        <div style={{
                            display: 'flex', gap: '12px', flexWrap: 'wrap',
                            justifyContent: 'center', padding: '20px 0'
                        }}>
                            <button
                                onClick={() => { setCheckinAction('checkin'); setShowCheckin(true); setCheckinStatus(''); }}
                                className="btn btn-primary btn-lg"
                                disabled={!employee.face_enrolled}
                                style={{ minWidth: '140px' }}
                            >
                                📥 Check In
                            </button>
                            <button
                                onClick={() => { setCheckinAction('checkout'); setShowCheckin(true); setCheckinStatus(''); }}
                                className="btn btn-success btn-lg"
                                disabled={!employee.face_enrolled}
                                style={{ minWidth: '140px', background: '#f59e0b' }}
                            >
                                📤 Check Out
                            </button>
                            {!employee.face_enrolled && (
                                <p style={{ width: '100%', textAlign: 'center', color: 'var(--warning)', marginTop: '12px' }}>
                                    ⚠️ Please enroll your face first to use face check-in
                                </p>
                            )}
                        </div>
                    ) : (
                        <div>
                            {/* Webcam */}
                            <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '16px', position: 'relative' }}>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    screenshotQuality={0.8}
                                    videoConstraints={{ width: 480, height: 360, facingMode: 'user' }}
                                    style={{ width: '100%', display: 'block' }}
                                    mirrored={true}
                                />
                                {/* Overlay */}
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '150px', height: '180px',
                                    border: '3px dashed rgba(255,255,255,0.5)',
                                    borderRadius: '50%'
                                }}></div>
                                <div style={{
                                    position: 'absolute', top: '10px', right: '10px',
                                    background: checkinAction === 'checkin' ? '#22c55e' : '#f59e0b',
                                    color: 'white', padding: '6px 14px', borderRadius: '50px',
                                    fontSize: '0.85rem', fontWeight: '600'
                                }}>
                                    {checkinAction === 'checkin' ? '📥 CHECK IN' : '📤 CHECK OUT'}
                                </div>
                            </div>

                            {/* Status */}
                            {checkinStatus && (
                                <div style={{
                                    padding: '12px', textAlign: 'center', marginBottom: '16px',
                                    background: checkinStatus.includes('🎉') ? 'rgba(34, 197, 94, 0.1)' :
                                        checkinStatus.includes('❌') || checkinStatus.includes('⚠️') ? 'rgba(239, 68, 68, 0.1)' :
                                            'rgba(59, 130, 246, 0.1)',
                                    borderRadius: '10px', fontSize: '1rem'
                                }}>
                                    {checkinStatus}
                                </div>
                            )}

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={verifyAndCheckin}
                                    disabled={!modelsLoaded || isVerifying}
                                    className="btn btn-primary btn-lg"
                                    style={{ minWidth: '180px' }}
                                >
                                    {isVerifying ? '⏳ Verifying...' : modelsLoaded ? '✅ Verify & Submit' : '⏳ Loading...'}
                                </button>
                                <button
                                    onClick={() => { setShowCheckin(false); setCheckinStatus(''); }}
                                    className="btn btn-outline"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Today's Status */}
                <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px' }}>📅 Today's Status</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{
                            padding: '20px',
                            background: dashboard?.today?.checked_in ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-soft)',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                                {dashboard?.today?.checked_in ? '✅' : '⏳'}
                            </div>
                            <div style={{ fontWeight: '600' }}>Check In</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {dashboard?.today?.checked_in || 'Not yet'}
                            </div>
                        </div>
                        <div style={{
                            padding: '20px',
                            background: dashboard?.today?.checked_out ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-soft)',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                                {dashboard?.today?.checked_out ? '✅' : '⏳'}
                            </div>
                            <div style={{ fontWeight: '600' }}>Check Out</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {dashboard?.today?.checked_out || 'Not yet'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Face Status */}
                <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px' }}>🎯 Face Recognition Status</h3>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        background: employee.face_enrolled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        borderRadius: '12px'
                    }}>
                        <div>
                            <div style={{
                                fontWeight: '600',
                                color: employee.face_enrolled ? 'var(--success)' : 'var(--warning)',
                                marginBottom: '4px'
                            }}>
                                {employee.face_enrolled ? '✅ Face Enrolled' : '⚠️ Face Not Enrolled'}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {employee.image_count} images captured • Status: {employee.image_status}
                            </div>
                        </div>
                        <a
                            href={`/enroll-employee?org=${employee.org_code}&emp=${employee.employee_id}`}
                            className="btn btn-primary"
                        >
                            {employee.face_enrolled ? '📷 Update Face' : '📷 Enroll Face'}
                        </a>
                    </div>
                </div>

                {/* Attendance History */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px' }}>📊 Attendance History (Last 30 Days)</h3>

                    {dashboard?.attendance?.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            color: 'var(--text-muted)'
                        }}>
                            No attendance records yet
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--bg-soft)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Check In</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Check Out</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dashboard?.attendance?.map((record, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                            <td style={{ padding: '12px' }}>
                                                {new Date(record.date).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {record.check_in || '-'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {record.check_out || '-'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '50px',
                                                    fontSize: '0.8rem',
                                                    background: record.status === 'present' ? 'rgba(16, 185, 129, 0.1)' :
                                                        record.status === 'late' ? 'rgba(245, 158, 11, 0.1)' :
                                                            'rgba(239, 68, 68, 0.1)',
                                                    color: record.status === 'present' ? 'var(--success)' :
                                                        record.status === 'late' ? 'var(--warning)' :
                                                            'var(--error)'
                                                }}>
                                                    {record.status || 'present'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeDashboard;
