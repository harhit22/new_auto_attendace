/**
 * Root Admin Login
 * Single admin login to manage ALL organizations
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = '/api/v1/attendance';

const RootAdminLogin = () => {
    const navigate = useNavigate();
    const { loginRootAdmin } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE}/admin-login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                loginRootAdmin(data.admin);
                navigate('/admin/select-org');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (e) {
            setError('Server connection failed');
        }

        setIsLoading(false);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxWidth: '450px',
                width: '100%',
                padding: '40px'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔐</div>
                    <h1 style={{ fontSize: '1.75rem', marginBottom: '8px', color: '#1a1a2e' }}>
                        Root Admin Login
                    </h1>
                    <p style={{ color: '#6B7280', fontSize: '0.95rem' }}>
                        Manage all organizations from one dashboard
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        marginBottom: '20px',
                        padding: '12px 16px',
                        background: '#FEE2E2',
                        borderRadius: '10px',
                        color: '#DC2626',
                        textAlign: 'center',
                        fontSize: '0.9rem'
                    }}>
                        ❌ {error}
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: '#374151'
                        }}>
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter admin username"
                            required
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                border: '2px solid #D1D5DB',
                                borderRadius: '10px',
                                fontSize: '1rem',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#667eea'}
                            onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                        />
                    </div>

                    <div style={{ marginBottom: '28px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '8px',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: '#374151'
                        }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                border: '2px solid #D1D5DB',
                                borderRadius: '10px',
                                fontSize: '1rem',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#667eea'}
                            onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: isLoading
                                ? '#9CA3AF'
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '10px',
                            color: 'white',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            boxShadow: isLoading ? 'none' : '0 4px 15px rgba(102, 126, 234, 0.4)',
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => !isLoading && (e.target.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    >
                        {isLoading ? '⏳ Logging in...' : '🚀 Login to Dashboard'}
                    </button>
                </form>

                {/* Footer */}
                <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    background: '#F9FAFB',
                    borderRadius: '10px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>
                        <strong>For Drivers:</strong> Visit <a href="/employee/login" style={{ color: '#667eea', textDecoration: 'none' }}>/employee/login</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RootAdminLogin;
