/**
 * Manager Dashboard - Simplified
 * For operational managers: Attendance & Employees only.
 * No model training, no system settings.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = '/api/v1/attendance';

const ManagerDashboard = () => {
    const navigate = useNavigate();
    const { attendanceOrg, logoutAttendance, rootAdmin } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [todaySummary, setTodaySummary] = useState(null);

    useEffect(() => {
        if (!attendanceOrg) return;
        loadData();
    }, [attendanceOrg]);

    const loadData = async () => {
        if (!attendanceOrg || !attendanceOrg.id) return;
        try {
            const [empRes, summaryRes] = await Promise.all([
                fetch(`${API_BASE}/employees/?organization_id=${attendanceOrg.id}`),
                fetch(`${API_BASE}/records/today_summary/?organization_id=${attendanceOrg.id}`)
            ]);
            const empData = await empRes.json();
            const summaryData = await summaryRes.json();
            setEmployees(empData.employees || []);
            setTodaySummary(summaryData);
        } catch (e) {
            console.error(e);
        }
    };

    const handleLogout = () => {
        logoutAttendance();
        navigate('/admin/login'); // Redirect to unified admin login
    };

    return (
        <div className="container">
            {/* Header */}
            <div className="wave-hero" style={{ minHeight: '200px', paddingBottom: '80px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">🏢</span>
                        <span>{attendanceOrg?.name}</span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.8, marginLeft: '10px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>MANAGER VIEW</span>
                    </div>
                    <nav className="nav" style={{ display: 'flex', gap: '12px' }}>
                        {/* Change Organization button - only show if root admin is managing */}
                        {rootAdmin && (
                            <button
                                onClick={() => navigate('/admin/select-org')}
                                style={{
                                    background: 'rgba(255,255,255,0.25)',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '50px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '0.9rem'
                                }}
                            >
                                🔄 Switch City
                            </button>
                        )}
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
                    <h1 className="page-title">Operations Dashboard</h1>
                    <p className="page-subtitle">Managing: <strong>{attendanceOrg?.name}</strong></p>
                </div>
            </div>

            {/* Main Content - 2 Cards Only */}
            <div className="main-content">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>

                    {/* CARD 1: ATTENDANCE */}
                    <div
                        className="card"
                        onClick={() => navigate('/attendance/admin/attendance')}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s', borderTop: '4px solid #10b981' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Trip Attendance</h3>
                                <p className="card-subtitle">Real-time tracking</p>
                            </div>
                            <div style={{ fontSize: '2rem' }}>🚗</div>
                        </div>
                        <div style={{ padding: '20px', background: '#ecfdf5', borderRadius: '12px', marginTop: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: '#047857' }}>Active Trips</span>
                                <span style={{ fontWeight: 'bold', color: '#047857' }}>{todaySummary?.trips?.active || 0}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#047857' }}>Completed</span>
                                <span style={{ fontWeight: 'bold', color: '#047857' }}>{todaySummary?.trips?.completed || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* CARD 2: EMPLOYEES */}
                    <div
                        className="card"
                        onClick={() => navigate('/attendance/admin/employees')}
                        style={{ cursor: 'pointer', transition: 'transform 0.2s', borderTop: '4px solid #3b82f6' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div className="card-header">
                            <div>
                                <h3 className="card-title">Employees</h3>
                                <p className="card-subtitle">Manage Drivers & Helpers</p>
                            </div>
                            <div style={{ fontSize: '2rem' }}>👥</div>
                        </div>
                        <div style={{ padding: '20px', background: '#eff6ff', borderRadius: '12px', marginTop: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#1e40af' }}>Total Staff</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>
                                    {employees.length}
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;
