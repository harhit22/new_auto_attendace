import React from 'react';
import './ArchitecturePage.css';

const ArchitecturePage = () => {
    return (
        <div className="arch-container">
            <div className="arch-header">
                <h1>Frontend Application Architecture</h1>
                <p style={{ color: '#94a3b8' }}>Visualizing the routing, state, and component hierarchy</p>
            </div>

            {/* High Level Flow */}
            <div className="flow-chart">
                <div className="flow-step" style={{ borderColor: '#f472b6' }}>index.js</div>
                <div className="flow-arrow">→</div>
                <div className="flow-step" style={{ borderColor: '#c084fc' }}>App.js</div>
                <div className="flow-arrow">→</div>
                <div className="flow-step" style={{ borderColor: '#60a5fa' }}>AuthContext</div>
                <div className="flow-arrow">→</div>
                <div className="flow-step" style={{ borderColor: '#4ade80' }}>Router</div>
            </div>

            <div className="arch-grid">
                {/* Core State Section */}
                <div className="arch-section section-core">
                    <div className="section-title">
                        <span>⚡ Core State (AuthContext)</span>
                    </div>
                    <div className="node-list">
                        <div className="node-item" style={{ borderLeftColor: '#f472b6' }}>
                            <span className="node-name">Trainer User State</span>
                            <span className="node-desc">Manages individual user sessions for the Trainer product.</span>
                            <span className="node-route">localStorage: trainer_user</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#c084fc' }}>
                            <span className="node-name">Attendance Org State</span>
                            <span className="node-desc">Manages business organization sessions for the Attendance product.</span>
                            <span className="node-route">localStorage: attendance_org</span>
                        </div>
                    </div>
                </div>

                {/* Public Routes */}
                <div className="arch-section section-public">
                    <div className="section-title">
                        <span>🌐 Public Routes</span>
                    </div>
                    <div className="node-list">
                        <div className="node-item" style={{ borderLeftColor: '#60a5fa' }}>
                            <span className="node-name">HomePage</span>
                            <span className="node-route">/</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#60a5fa' }}>
                            <span className="node-name">TransformerTutorialPage</span>
                            <span className="node-route">/learn/transformers</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#60a5fa' }}>
                            <span className="node-name">ProjectWalkthroughPage</span>
                            <span className="node-route">/learn/project</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#60a5fa' }}>
                            <span className="node-name">KioskPage</span>
                            <span className="node-desc">Public automated attendance taking</span>
                            <span className="node-route">/kiosk</span>
                        </div>
                    </div>
                </div>

                {/* Trainer Product */}
                <div className="arch-section section-trainer">
                    <div className="section-title">
                        <span>👤 Trainer Product</span>
                        <span className="badge badge-auth">Protected</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                        Requires Trainer Login
                    </p>
                    <div className="node-list">
                        <div className="node-item" style={{ borderLeftColor: '#4ade80' }}>
                            <span className="node-name">TrainerLogin</span>
                            <span className="node-route">/trainer/login</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#4ade80' }}>
                            <span className="node-name">TrainerDashboard</span>
                            <span className="node-route">/trainer/dashboard</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#4ade80' }}>
                            <span className="node-name">DatasetPage</span>
                            <span className="node-desc">Manage face datasets</span>
                            <span className="node-route">/trainer/datasets</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#4ade80' }}>
                            <span className="node-name">ProRecognitionPage</span>
                            <span className="node-route">/trainer/recognize</span>
                        </div>
                    </div>
                </div>

                {/* Attendance Product */}
                <div className="arch-section section-attendance">
                    <div className="section-title">
                        <span>🏢 Attendance SaaS</span>
                        <span className="badge badge-auth">Protected</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                        Requires Org Login
                    </p>
                    <div className="node-list">
                        <div className="node-item" style={{ borderLeftColor: '#fbbf24' }}>
                            <span className="node-name">AttendanceLogin</span>
                            <span className="node-route">/attendance/login</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#fbbf24' }}>
                            <span className="node-name">AttendanceAdmin</span>
                            <span className="node-desc">Main Admin Dashboard</span>
                            <span className="node-route">/attendance/admin</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#fbbf24' }}>
                            <span className="node-name">AdminEmployeesPage</span>
                            <span className="node-desc">Manage Employee Records</span>
                            <span className="node-route">/attendance/admin/employees</span>
                        </div>
                        <div className="node-item" style={{ borderLeftColor: '#fbbf24' }}>
                            <span className="node-name">EmployeeLogin</span>
                            <span className="node-desc">Individual Employee Access</span>
                            <span className="node-route">/employee/login</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArchitecturePage;
