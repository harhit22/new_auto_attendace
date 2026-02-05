/**
 * Admin Models Hub - Face Model Training with InsightFace
 * Consolidated single model page (previously Light/Heavy - both use same engine)
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = '/api/v1/attendance';

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

    const trainedCount = stats?.light_trained || 0;
    const totalEmployees = stats?.total_employees || 0;
    const pendingCount = totalEmployees - trainedCount;

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
                    <p className="page-subtitle">Train face recognition for {attendanceOrg?.name}</p>
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
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)' }}>{totalEmployees}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>Total Employees</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#8b5cf6' }}>{stats?.total_images || 0}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>Total Images</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>{trainedCount}</div>
                                <div style={{ color: '#10b981' }}>✅ Trained</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#ef4444' }}>{pendingCount}</div>
                                <div style={{ color: '#ef4444' }}>❌ Not Trained</div>
                            </div>
                        </div>

                        {/* Single Face Model Card */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div
                                className="card"
                                onClick={() => navigate('/attendance/admin/models/face')}
                                style={{
                                    cursor: 'pointer', padding: '40px', textAlign: 'center',
                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
                                    border: '2px solid rgba(16, 185, 129, 0.3)',
                                    transition: 'all 0.3s ease',
                                    maxWidth: '500px', width: '100%'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(16, 185, 129, 0.2)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ fontSize: '5rem', marginBottom: '16px' }}>🧠</div>
                                <h2 style={{ color: '#10b981', marginBottom: '8px', fontSize: '1.8rem' }}>Face Recognition Model</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '1rem' }}>
                                    Powered by <strong>InsightFace (ArcFace)</strong><br />
                                    <span style={{ color: '#10b981', fontWeight: '600' }}>~99% accuracy</span> • <span style={{ color: '#3b82f6', fontWeight: '600' }}>512-dim embeddings</span>
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '24px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>{trainedCount}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Trained</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444' }}>{pendingCount}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pending</div>
                                    </div>
                                </div>
                                <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', width: '100%', padding: '14px', fontSize: '1rem' }}>
                                    Open Model Training →
                                </button>
                            </div>
                        </div>

                        {/* Info Section */}
                        <div className="card" style={{ marginTop: '24px', background: 'var(--bg-soft)' }}>
                            <h3 style={{ marginBottom: '16px' }}>ℹ️ About Face Recognition</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                This system uses <strong>InsightFace (ArcFace)</strong> - the industry-leading face recognition engine with 99%+ accuracy.
                                Each employee needs at least <strong>3 face images</strong> for training. More images = better accuracy.
                            </p>
                            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <strong style={{ color: '#10b981' }}>✅ Recommended:</strong>
                                <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>Capture 50+ images per employee for best results</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminModelsPage;
