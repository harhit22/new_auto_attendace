/**
 * Admin Models Hub - Choose Light or Heavy Model Training
 * Links to dedicated pages for each model type
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const AdminModelsPage = () => {
    const navigate = useNavigate();
    const { attendanceOrg } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!attendanceOrg) return;
        loadStats();
    }, [attendanceOrg]);

    const loadStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/training-status/?org_code=${attendanceOrg.org_code}`);
            const data = await res.json();
            setStats(data);
        } catch (e) {
            console.error('Failed to load stats:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            {/* Header */}
            <div className="wave-hero" style={{ minHeight: '180px', paddingBottom: '60px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">🧠</span>
                        <span>Model Training</span>
                    </div>
                    <nav className="nav">
                        <button onClick={() => navigate('/attendance/admin')} className="nav-link">← Dashboard</button>
                    </nav>
                </div>
                <div style={{ textAlign: 'center', padding: '10px' }}>
                    <h1 className="page-title">Model Training Center</h1>
                    <p className="page-subtitle">Choose a model type to train for {attendanceOrg?.name}</p>
                </div>
            </div>

            <div className="main-content">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>⏳ Loading...</div>
                ) : (
                    <>
                        {/* Overview Stats */}
                        <div className="stats-grid mb-lg" style={{ padding: 0 }}>
                            <div className="card" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)' }}>{stats?.total_employees || 0}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>Total Employees</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#8b5cf6' }}>{stats?.total_images || 0}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>Total Images</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#f59e0b' }}>{stats?.light_trained || 0}</div>
                                <div style={{ color: '#f59e0b' }}>⚡ Light Trained</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#8b5cf6' }}>{stats?.heavy_trained || 0}</div>
                                <div style={{ color: '#8b5cf6' }}>🧠 Heavy Trained</div>
                            </div>
                        </div>

                        {/* Two Model Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            {/* Light Model Card */}
                            <div
                                className="card"
                                onClick={() => navigate('/attendance/admin/models/light')}
                                style={{
                                    cursor: 'pointer', padding: '32px', textAlign: 'center',
                                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1))',
                                    border: '2px solid rgba(245, 158, 11, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(245, 158, 11, 0.2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>⚡</div>
                                <h2 style={{ color: '#f59e0b', marginBottom: '8px' }}>Light Model</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                    Fast training with face-api.js<br />
                                    <strong>~5 seconds</strong> • <strong>~85% accuracy</strong>
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>{stats?.light_trained || 0}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trained</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>{(stats?.total_employees || 0) - (stats?.light_trained || 0)}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Not Trained</div>
                                    </div>
                                </div>
                                <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', width: '100%' }}>
                                    Open Light Model Page →
                                </button>
                            </div>

                            {/* Heavy Model Card */}
                            <div
                                className="card"
                                onClick={() => navigate('/attendance/admin/models/heavy')}
                                style={{
                                    cursor: 'pointer', padding: '32px', textAlign: 'center',
                                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1))',
                                    border: '2px solid rgba(139, 92, 246, 0.3)',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(139, 92, 246, 0.2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🧠</div>
                                <h2 style={{ color: '#8b5cf6', marginBottom: '8px' }}>Heavy Model</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                    DeepFace/ArcFace training<br />
                                    <strong>~2 minutes</strong> • <strong>~99% accuracy</strong>
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '16px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>{stats?.heavy_trained || 0}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Trained</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>{(stats?.total_employees || 0) - (stats?.heavy_trained || 0)}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Not Trained</div>
                                    </div>
                                </div>
                                <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', width: '100%' }}>
                                    Open Heavy Model Page →
                                </button>
                            </div>
                        </div>

                        {/* Info Section */}
                        <div className="card" style={{ marginTop: '24px', background: 'var(--bg-soft)' }}>
                            <h3 style={{ marginBottom: '16px' }}>📋 Model Comparison</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--bg-soft)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Feature</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: '#f59e0b' }}>⚡ Light</th>
                                        <th style={{ padding: '12px', textAlign: 'center', color: '#8b5cf6' }}>🧠 Heavy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                        <td style={{ padding: '12px' }}>Training Speed</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontWeight: '600' }}>~5 seconds</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#f59e0b' }}>~2 minutes</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                        <td style={{ padding: '12px' }}>Accuracy</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#f59e0b' }}>~85%</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontWeight: '600' }}>~99%</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                        <td style={{ padding: '12px' }}>Min. Images Required</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#10b981', fontWeight: '600' }}>3 images</td>
                                        <td style={{ padding: '12px', textAlign: 'center', color: '#f59e0b' }}>100 images</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '12px' }}>Engine</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>face-api.js</td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>DeepFace/ArcFace</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminModelsPage;
