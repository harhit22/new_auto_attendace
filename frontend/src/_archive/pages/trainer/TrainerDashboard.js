/**
 * Trainer Dashboard
 * For individual users to manage their face training models
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TrainerDashboard = () => {
    const navigate = useNavigate();
    const { trainerUser, logoutTrainer } = useAuth();
    const [activeTab, setActiveTab] = useState('train');

    const handleLogout = () => {
        logoutTrainer();
        navigate('/trainer/login');
    };

    return (
        <div className="container">
            {/* Header */}
            <div className="wave-hero" style={{ minHeight: '200px', paddingBottom: '80px' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">🤖</span>
                        <span>Face Trainer</span>
                    </div>
                    <nav className="nav">
                        <a href="/trainer/dashboard" className="nav-link active">Dashboard</a>
                        <a href="/trainer/datasets" className="nav-link">Datasets</a>
                        <a href="/trainer/recognize" className="nav-link">Test</a>
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
                    <h1 className="page-title">Welcome, {trainerUser?.name}!</h1>
                    <p className="page-subtitle">Train face recognition models with 99% accuracy</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                {/* Quick Actions */}
                <div className="stats-grid mb-lg">
                    <a href="/dataset" className="feature-card" style={{ textDecoration: 'none' }}>
                        <div className="live-icon">📁</div>
                        <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Create Dataset</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Capture face images from different angles
                        </p>
                    </a>

                    <a href="/enroll" className="feature-card" style={{ textDecoration: 'none' }}>
                        <div className="live-icon secondary">📸</div>
                        <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Quick Capture</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Voice-guided scanning from 5 angles
                        </p>
                    </a>

                    <a href="/pro" className="feature-card" style={{ textDecoration: 'none', border: '3px solid var(--success)' }}>
                        <div className="live-icon success">🎯</div>
                        <h3 style={{ marginBottom: '12px', color: 'var(--success)' }}>Pro Recognition</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Test with ArcFace (99.83% accuracy)
                        </p>
                    </a>

                    <div className="feature-card" style={{ opacity: 0.6 }}>
                        <div className="live-icon warm">📊</div>
                        <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Export Model</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Coming soon...
                        </p>
                    </div>
                </div>

                {/* Your Models */}
                <div className="card">
                    <h2 style={{ marginBottom: '20px' }}>Your Trained Models</h2>
                    <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            No models trained yet. Start by creating a dataset!
                        </p>
                        <a href="/dataset" className="btn btn-primary">
                            📁 Create Dataset
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrainerDashboard;
