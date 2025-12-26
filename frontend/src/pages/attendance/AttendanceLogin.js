/**
 * Attendance Login/Register Page
 * For organizations to access admin dashboard or create new organization
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const AttendanceLogin = () => {
    const navigate = useNavigate();
    const { loginAttendance } = useAuth();
    const [isRegister, setIsRegister] = useState(false);

    // Login fields
    const [orgCode, setOrgCode] = useState('');
    const [password, setPassword] = useState('');

    // Register fields
    const [orgName, setOrgName] = useState('');
    const [newOrgCode, setNewOrgCode] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [createdOrg, setCreatedOrg] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (!orgCode.trim() || !password.trim()) {
            setError('Organization code and password required');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE}/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_code: orgCode.toUpperCase().trim(),
                    password: password.trim()
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                loginAttendance(data.organization);
                navigate('/attendance/admin');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (e) {
            setError('Cannot connect to server');
        }

        setIsLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (!orgName.trim() || !newOrgCode.trim()) {
            setError('Organization name and code are required');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE}/organizations/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: orgName.trim(),
                    org_code: newOrgCode.toUpperCase().trim(),
                    password: newPassword.trim() || '1234'
                })
            });

            const data = await res.json();

            if (res.ok) {
                setCreatedOrg(data);
            } else {
                setError(data.error || 'Registration failed');
            }
        } catch (e) {
            setError('Cannot connect to server');
        }

        setIsLoading(false);
    };

    const loginWithNewOrg = () => {
        loginAttendance(createdOrg);
        navigate('/attendance/admin');
    };

    // Show success screen after registration
    if (createdOrg) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}>
                <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '50px 40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
                    <h2 style={{ marginBottom: '8px', color: 'var(--success)' }}>Organization Created!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
                        Save these credentials - you'll need them to login
                    </p>

                    <div style={{
                        background: 'var(--bg-soft)',
                        padding: '24px',
                        borderRadius: '16px',
                        marginBottom: '30px',
                        textAlign: 'left'
                    }}>
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Organization Code
                            </div>
                            <div style={{
                                fontSize: '1.8rem',
                                fontWeight: '700',
                                letterSpacing: '3px',
                                color: 'var(--success)'
                            }}>
                                {createdOrg.org_code}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Password
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: '600' }}>
                                {createdOrg.password}
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-success btn-lg w-full" onClick={loginWithNewOrg}>
                        🚀 Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '50px 40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🏢</div>
                    <h1 style={{ marginBottom: '8px', fontSize: '1.8rem' }}>Attendance System</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {isRegister ? 'Create your organization' : 'Login to your organization'}
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid #ef4444',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        color: '#ef4444',
                        marginBottom: '20px',
                        fontSize: '0.9rem'
                    }}>
                        ❌ {error}
                    </div>
                )}

                {isRegister ? (
                    /* REGISTER FORM */
                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label className="form-label">Organization Name *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Acme Inc."
                                value={orgName}
                                onChange={e => setOrgName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Organization Code * <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(for login)</span></label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="ACME"
                                value={newOrgCode}
                                onChange={e => setNewOrgCode(e.target.value.toUpperCase())}
                                style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(default: 1234)</span></label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="1234"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-success btn-lg w-full"
                            disabled={isLoading}
                            style={{ marginTop: '16px' }}
                        >
                            {isLoading ? '⏳ Creating...' : '🚀 Create Organization'}
                        </button>
                    </form>
                ) : (
                    /* LOGIN FORM */
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">Organization Code</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. ACME"
                                value={orgCode}
                                onChange={e => setOrgCode(e.target.value.toUpperCase())}
                                style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600' }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-success btn-lg w-full"
                            disabled={isLoading}
                            style={{ marginTop: '16px' }}
                        >
                            {isLoading ? '⏳ Logging in...' : '🔓 Login'}
                        </button>
                    </form>
                )}

                {/* Toggle Login/Register */}
                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <button
                        onClick={() => { setIsRegister(!isRegister); setError(''); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--success)',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: '500'
                        }}
                    >
                        {isRegister ? '← Already have organization? Login' : "Don't have organization? Create one →"}
                    </button>
                </div>

                {/* Quick Access */}
                {!isRegister && (
                    <div style={{
                        marginTop: '30px',
                        padding: '16px 20px',
                        background: 'var(--bg-soft)',
                        borderRadius: '12px'
                    }}>
                        <Link to="/kiosk" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>
                            🖥️ Go to Employee Kiosk
                        </Link>
                    </div>
                )}

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <Link to="/" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AttendanceLogin;
