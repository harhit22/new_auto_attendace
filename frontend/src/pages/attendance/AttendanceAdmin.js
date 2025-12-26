/**
 * Attendance Admin Dashboard - 3-Card Navigation Hub
 * Links to separate pages for: Attendance, Employees, Model Training
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const AttendanceAdmin = () => {
    const navigate = useNavigate();
    const { attendanceOrg, logoutAttendance } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [todaySummary, setTodaySummary] = useState(null);
    const [recognitionMode, setRecognitionMode] = useState('light');
    const [status, setStatus] = useState('');
    const [trainingStats, setTrainingStats] = useState({ light_count: 0, heavy_count: 0, total: 0 });

    useEffect(() => {
        if (!attendanceOrg) return;
        setRecognitionMode(attendanceOrg.recognition_mode || 'light');
        loadData();
    }, [attendanceOrg]);

    const loadData = async () => {
        try {
            const [empRes, summaryRes, trainingRes] = await Promise.all([
                fetch(`${API_BASE}/employees/?organization_id=${attendanceOrg.id}`),
                fetch(`${API_BASE}/records/today_summary/?organization_id=${attendanceOrg.id}`),
                fetch(`${API_BASE}/training-status/?org_code=${attendanceOrg.org_code}`)
            ]);
            const empData = await empRes.json();
            const summaryData = await summaryRes.json();
            const trainingData = await trainingRes.json();
            setEmployees(empData.employees || []);
            setTodaySummary(summaryData);
            // Count trained employees
            const emps = trainingData.employees || [];
            setTrainingStats({
                light_count: emps.filter(e => e.light_trained).length,
                heavy_count: emps.filter(e => e.heavy_trained).length,
                total: emps.length
            });
        } catch (e) {
            console.error(e);
        }
    };

    const toggleRecognitionMode = async (mode) => {
        try {
            const res = await fetch(`${API_BASE}/update-settings/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: attendanceOrg.org_code, recognition_mode: mode })
            });
            const data = await res.json();
            if (data.success) {
                setRecognitionMode(mode);
                setStatus(`✅ Kiosk will now use ${mode === 'heavy' ? 'Heavy (DeepFace)' : 'Light (Quick)'} model`);
            }
        } catch (e) {
            setStatus(`❌ Error: ${e.message}`);
        }
    };

    const handleLogout = () => {
        logoutAttendance();
        navigate('/attendance/login');
    };

    return (
        <div className="container">
            {/* Header */}
            <div className="wave-hero" style={{ minHeight: '200px', paddingBottom: '80px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">🏢</span>
                        <span>{attendanceOrg?.name}</span>
                    </div>
                    <nav className="nav">
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '50px',
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Logout
                        </button>
                    </nav>
                </div>

                <div style={{ textAlign: 'center', padding: '20px', position: 'relative', zIndex: 1 }}>
                    <h1 className="page-title">Admin Dashboard</h1>
                    <p className="page-subtitle">Organization Code: <strong>{attendanceOrg?.org_code}</strong></p>
                </div>
            </div>

            {/* Main Content - 3 Cards */}
            <div className="main-content">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

                    {/* CARD 1: ATTENDANCE */}
                    <div
                        className="card"
                        style={{ padding: '30px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        onClick={() => navigate('/attendance/admin/attendance')}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem'
                            }}>
                                ✓
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>Attendance</h2>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Check-ins & Kiosk</p>
                            </div>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                            View today's attendance, open the check-in kiosk, and export reports.
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                                ✅ {todaySummary?.present || 0} Present
                            </span>
                            <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                                ❌ {todaySummary?.absent || 0} Absent
                            </span>
                        </div>
                        <div style={{ marginTop: '20px', color: '#34d399', fontWeight: '600' }}>
                            Open Attendance →
                        </div>
                    </div>

                    {/* CARD 2: EMPLOYEES */}
                    <div
                        className="card"
                        style={{ padding: '30px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        onClick={() => navigate('/attendance/admin/employees')}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.1))',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem'
                            }}>
                                👥
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>Employees</h2>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Add & Manage</p>
                            </div>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                            Add new employees, remove records, and send enrollment links.
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                                👥 {employees.length} Total
                            </span>
                        </div>
                        <div style={{ marginTop: '20px', color: '#a78bfa', fontWeight: '600' }}>
                            Manage Employees →
                        </div>
                    </div>

                    {/* CARD 3: MODEL TRAINING */}
                    <div
                        className="card"
                        style={{ padding: '30px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                        onClick={() => navigate('/attendance/admin/models')}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '16px',
                                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem'
                            }}>
                                🧠
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>Model Training</h2>
                                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Train AI Models</p>
                            </div>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                            Capture employee faces, train recognition models, and test accuracy.
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                                🎯 ArcFace
                            </span>
                            <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                                📁 Datasets
                            </span>
                        </div>
                        <div style={{ marginTop: '20px', color: '#60a5fa', fontWeight: '600' }}>
                            Open Training Center →
                        </div>
                    </div>

                </div>

                {/* Status Message */}
                {status && (
                    <div className={`status-badge ${status.includes('✅') ? 'success' : 'error'}`}
                        style={{ display: 'flex', justifyContent: 'center', margin: '20px 0', padding: '12px 24px' }}>
                        {status}
                    </div>
                )}

                {/* SETTINGS CARD - Model Selection */}
                <div className="card" style={{ marginTop: '24px', padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ⚙️ Kiosk Settings
                    </h3>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ color: 'var(--text-secondary)', marginBottom: '12px', display: 'block' }}>
                            Face Recognition Model for Check-in
                        </label>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {/* Light Model Option */}
                            <button
                                className={`btn ${recognitionMode === 'light' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => trainingStats.light_count > 0 && toggleRecognitionMode('light')}
                                disabled={trainingStats.light_count === 0}
                                style={{
                                    padding: '16px 24px',
                                    background: recognitionMode === 'light' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : undefined,
                                    opacity: trainingStats.light_count === 0 ? 0.5 : 1,
                                    cursor: trainingStats.light_count === 0 ? 'not-allowed' : 'pointer',
                                    position: 'relative',
                                    minWidth: '180px'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '1.3rem' }}>⚡</span>
                                    <span style={{ fontWeight: '600' }}>Light Model</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Fast • ~85% accuracy</div>
                                <div style={{
                                    marginTop: '8px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600',
                                    background: trainingStats.light_count > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    color: trainingStats.light_count > 0 ? '#10b981' : '#ef4444'
                                }}>
                                    {trainingStats.light_count > 0
                                        ? `✅ ${trainingStats.light_count}/${trainingStats.total} trained`
                                        : '❌ No employees trained'
                                    }
                                </div>
                            </button>

                            {/* Heavy Model Option */}
                            <button
                                className={`btn ${recognitionMode === 'heavy' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => trainingStats.heavy_count > 0 && toggleRecognitionMode('heavy')}
                                disabled={trainingStats.heavy_count === 0}
                                style={{
                                    padding: '16px 24px',
                                    background: recognitionMode === 'heavy' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : undefined,
                                    opacity: trainingStats.heavy_count === 0 ? 0.5 : 1,
                                    cursor: trainingStats.heavy_count === 0 ? 'not-allowed' : 'pointer',
                                    position: 'relative',
                                    minWidth: '180px'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '1.3rem' }}>🧠</span>
                                    <span style={{ fontWeight: '600' }}>Heavy Model</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>DeepFace • ~99% accuracy</div>
                                <div style={{
                                    marginTop: '8px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600',
                                    background: trainingStats.heavy_count > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    color: trainingStats.heavy_count > 0 ? '#10b981' : '#ef4444'
                                }}>
                                    {trainingStats.heavy_count > 0
                                        ? `✅ ${trainingStats.heavy_count}/${trainingStats.total} trained`
                                        : '❌ No employees trained'
                                    }
                                </div>
                            </button>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>
                            💡 Only models with trained employees can be selected for kiosk check-in.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AttendanceAdmin;

