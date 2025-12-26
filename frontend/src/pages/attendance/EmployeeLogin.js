/**
 * Employee Login Page
 * Individual employee login with org_code + employee_id + password
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const EmployeeLogin = () => {
    const navigate = useNavigate();
    const [orgCode, setOrgCode] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE}/employee-login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_code: orgCode.toUpperCase(),
                    employee_id: employeeId,
                    password: password
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Store session
                sessionStorage.setItem('employee', JSON.stringify({
                    ...data.employee,
                    org_code: data.organization.org_code,
                    org_name: data.organization.name
                }));
                navigate('/employee/dashboard');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (e) {
            setError('Cannot connect to server');
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
            <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>👤 Employee Login</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Sign in to view your attendance
                    </p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                            Organization Code
                        </label>
                        <input
                            type="text"
                            value={orgCode}
                            onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                            placeholder="e.g. ACME"
                            required
                            style={{
                                width: '100%',
                                padding: '14px',
                                border: '2px solid var(--bg-soft)',
                                borderRadius: '10px',
                                fontSize: '1rem',
                                textTransform: 'uppercase'
                            }}
                        />
                    </div>

                    <div className="form-group" style={{ marginTop: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                            Employee ID
                        </label>
                        <input
                            type="text"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            placeholder="e.g. EMP001"
                            required
                            style={{
                                width: '100%',
                                padding: '14px',
                                border: '2px solid var(--bg-soft)',
                                borderRadius: '10px',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    <div className="form-group" style={{ marginTop: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            style={{
                                width: '100%',
                                padding: '14px',
                                border: '2px solid var(--bg-soft)',
                                borderRadius: '10px',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '8px',
                            color: 'var(--error)',
                            textAlign: 'center'
                        }}>
                            ❌ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary w-full btn-lg"
                        disabled={isLoading}
                        style={{ marginTop: '24px' }}
                    >
                        {isLoading ? '⏳ Signing in...' : '🔐 Sign In'}
                    </button>
                </form>

                <div style={{
                    marginTop: '24px',
                    textAlign: 'center',
                    paddingTop: '20px',
                    borderTop: '1px solid var(--bg-soft)'
                }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Are you an admin?{' '}
                        <a href="/attendance/login" style={{ color: 'var(--primary)' }}>
                            Admin Login →
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default EmployeeLogin;
