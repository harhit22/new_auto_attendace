/**
 * Trainer Login Page
 * For individual users who want to train face recognition models
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TrainerLogin = () => {
    const navigate = useNavigate();
    const { loginTrainer } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // For demo: simple localStorage auth (replace with API later)
        try {
            if (isRegister) {
                if (!name || !email || !password) {
                    setError('All fields are required');
                    setIsLoading(false);
                    return;
                }
                // Save new user
                const user = { id: Date.now(), name, email };
                const users = JSON.parse(localStorage.getItem('trainer_users') || '[]');
                users.push({ ...user, password });
                localStorage.setItem('trainer_users', JSON.stringify(users));
                loginTrainer(user);
                navigate('/trainer/dashboard');
            } else {
                if (!email || !password) {
                    setError('Email and password required');
                    setIsLoading(false);
                    return;
                }
                // Check user
                const users = JSON.parse(localStorage.getItem('trainer_users') || '[]');
                const user = users.find(u => u.email === email && u.password === password);
                if (user) {
                    loginTrainer({ id: user.id, name: user.name, email: user.email });
                    navigate('/trainer/dashboard');
                } else {
                    setError('Invalid email or password');
                }
            }
        } catch (e) {
            setError(e.message);
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
            <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '50px 40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🤖</div>
                    <h1 style={{ marginBottom: '8px', fontSize: '1.8rem' }}>Face Trainer</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {isRegister ? 'Create your account' : 'Login to train face models'}
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

                <form onSubmit={handleSubmit}>
                    {isRegister && (
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="John Doe"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
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
                        className="btn btn-primary btn-lg w-full"
                        disabled={isLoading}
                        style={{ marginTop: '16px' }}
                    >
                        {isLoading ? '⏳ Loading...' : isRegister ? '🚀 Create Account' : '🔓 Login'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <button
                        onClick={() => { setIsRegister(!isRegister); setError(''); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '0.95rem'
                        }}
                    >
                        {isRegister ? 'Already have account? Login' : "Don't have account? Register"}
                    </button>
                </div>

                <div style={{
                    marginTop: '30px',
                    paddingTop: '20px',
                    borderTop: '1px solid var(--bg-soft)',
                    textAlign: 'center'
                }}>
                    <a href="/" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        ← Back to Home
                    </a>
                </div>
            </div>
        </div>
    );
};

export default TrainerLogin;
