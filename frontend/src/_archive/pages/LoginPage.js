/**
 * Login Page
 */
import React, { useState } from 'react';
import { authAPI } from '../services/api';

const LoginPage = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await authAPI.login(email, password);
            const { access_token, refresh_token, user } = response.data;

            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            localStorage.setItem('user', JSON.stringify(user));

            if (onLogin) {
                onLogin(user);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container" style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div className="logo-icon" style={{
                        width: '60px',
                        height: '60px',
                        fontSize: '28px',
                        margin: '0 auto 16px'
                    }}>
                        🔐
                    </div>
                    <h1 className="page-title">Welcome Back</h1>
                    <p className="page-subtitle">Sign in to AI Attendance System</p>
                </div>

                {error && (
                    <div className="status-badge error" style={{
                        display: 'block',
                        marginBottom: '20px',
                        padding: '12px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        style={{ width: '100%' }}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <span className="spinner" style={{ width: '18px', height: '18px' }}></span>
                                Signing in...
                            </>
                        ) : (
                            '→ Sign In'
                        )}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    <p>Demo credentials:</p>
                    <p><strong>admin@example.com</strong> / <strong>admin123</strong></p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
