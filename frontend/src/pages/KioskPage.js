/**
 * Kiosk Mode - Simple Face Check-in/out
 * Easy login with Organization Code + Password
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const KioskPage = () => {
    const webcamRef = useRef(null);
    const [step, setStep] = useState('login'); // login, kiosk
    const [org, setOrg] = useState(null);
    const [orgCode, setOrgCode] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState('idle'); // idle, scanning, success, error
    const [action, setAction] = useState('checkin'); // checkin or checkout
    const [result, setResult] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loginError, setLoginError] = useState('');

    // Check for saved org
    useEffect(() => {
        const savedOrg = localStorage.getItem('kiosk_org');
        if (savedOrg) {
            try {
                setOrg(JSON.parse(savedOrg));
                setStep('kiosk');
            } catch (e) {
                localStorage.removeItem('kiosk_org');
            }
        }
    }, []);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Login with org code + password
    const handleLogin = async () => {
        setLoginError('');

        if (!orgCode.trim()) {
            setLoginError('Enter organization code');
            return;
        }
        if (!password.trim()) {
            setLoginError('Enter password');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: orgCode.toUpperCase(), password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setOrg(data.organization);
                localStorage.setItem('kiosk_org', JSON.stringify(data.organization));
                setStep('kiosk');
            } else {
                setLoginError(data.error || 'Login failed');
            }
        } catch (e) {
            setLoginError('Connection failed. Is server running?');
        }
    };

    // Convert base64 to blob
    const base64ToBlob = async (base64) => {
        const res = await fetch(base64);
        return await res.blob();
    };

    // Perform check-in or check-out
    const performScan = useCallback(async () => {
        if (!webcamRef.current || mode === 'scanning' || !org) return;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setMode('scanning');

        try {
            const blob = await base64ToBlob(imageSrc);
            const formData = new FormData();
            formData.append('org_code', org.org_code);
            formData.append('image', blob, 'face.jpg');

            const endpoint = action === 'checkin' ? 'checkin' : 'checkout';
            const res = await fetch(`${API_BASE}/${endpoint}/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (data.success) {
                setResult(data);
                setMode('success');
                speak(data.message);
                setTimeout(() => {
                    setMode('idle');
                    setResult(null);
                }, 5000);
            } else {
                setResult({ message: data.message || 'Face not recognized' });
                setMode('error');
                setTimeout(() => {
                    setMode('idle');
                    setResult(null);
                }, 3000);
            }
        } catch (e) {
            setResult({ message: 'Connection error' });
            setMode('error');
            setTimeout(() => {
                setMode('idle');
                setResult(null);
            }, 3000);
        }
    }, [mode, action, org]);

    // Text to speech
    const speak = (text) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-IN';
            utterance.rate = 0.9;
            speechSynthesis.speak(utterance);
        }
    };

    // Logout
    const handleLogout = () => {
        localStorage.removeItem('kiosk_org');
        setOrg(null);
        setOrgCode('');
        setPassword('');
        setStep('login');
    };

    // LOGIN SCREEN
    if (step === 'login') {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}>
                <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '50px 40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🏢</div>
                    <h2 style={{ marginBottom: '8px' }}>Attendance Terminal</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                        Enter your organization credentials
                    </p>

                    {loginError && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid #ef4444',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            color: '#ef4444',
                            marginBottom: '20px',
                            fontSize: '0.9rem'
                        }}>
                            ❌ {loginError}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" style={{ textAlign: 'left' }}>Organization Code</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. ACME or OFFICE1"
                            value={orgCode}
                            onChange={e => setOrgCode(e.target.value.toUpperCase())}
                            style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: '600', letterSpacing: '2px' }}
                            onKeyPress={e => e.key === 'Enter' && handleLogin()}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ textAlign: 'left' }}>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{ textAlign: 'center', fontSize: '1.1rem' }}
                            onKeyPress={e => e.key === 'Enter' && handleLogin()}
                        />
                    </div>

                    <button className="btn btn-primary btn-lg w-full" onClick={handleLogin} style={{ marginTop: '16px' }}>
                        🔓 Login to Terminal
                    </button>

                    <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--bg-soft)' }}>
                        <a href="/" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            ← Back to Home
                        </a>
                        <span style={{ margin: '0 12px', color: 'var(--text-muted)' }}>|</span>
                        <a href="/dashboard" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Create Organization
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // KIOSK SCREEN
    return (
        <div style={{
            minHeight: '100vh',
            background: mode === 'success'
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : mode === 'error'
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            transition: 'background 0.5s ease',
            display: 'flex',
            flexDirection: 'column',
            color: 'white'
        }}>
            {/* Header with clock */}
            <div style={{
                padding: '24px 30px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{org?.name}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Code: {org?.org_code}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: '800', fontFamily: 'Outfit' }}>
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: '0.95rem', opacity: 0.9 }}>
                        {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '10px 20px', borderRadius: '50px', color: 'white', cursor: 'pointer' }}
                >
                    🔒 Logout
                </button>
            </div>

            {/* Main content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
                {mode === 'success' && result ? (
                    <div style={{ textAlign: 'center', animation: 'scaleIn 0.4s ease-out' }}>
                        <div style={{ fontSize: '6rem', marginBottom: '20px' }}>✅</div>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
                            {result.employee?.name || 'Success'}
                        </h1>
                        <p style={{ fontSize: '1.3rem', opacity: 0.9 }}>{result.message}</p>
                        {result.work_hours && (
                            <p style={{ fontSize: '1.1rem', marginTop: '16px', opacity: 0.8 }}>
                                Work hours: {result.work_hours.toFixed(1)}h
                            </p>
                        )}
                    </div>
                ) : mode === 'error' ? (
                    <div style={{ textAlign: 'center', animation: 'scaleIn 0.4s ease-out' }}>
                        <div style={{ fontSize: '6rem', marginBottom: '20px' }}>❌</div>
                        <h1 style={{ fontSize: '1.8rem' }}>{result?.message || 'Not Recognized'}</h1>
                        <p style={{ fontSize: '1.1rem', opacity: 0.9, marginTop: '12px' }}>Please try again</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', alignItems: 'center', maxWidth: '1100px' }}>
                        {/* Webcam */}
                        <div>
                            <div style={{
                                borderRadius: '24px',
                                overflow: 'hidden',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                                border: '4px solid rgba(255,255,255,0.2)'
                            }}>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                                    style={{ width: '100%', display: 'block' }}
                                    mirrored={true}
                                />
                            </div>
                            {mode === 'scanning' && (
                                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                    <div className="spinner" style={{ margin: '0 auto', borderTopColor: 'white' }}></div>
                                    <p style={{ marginTop: '10px' }}>Scanning...</p>
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ fontSize: '1.8rem', marginBottom: '30px', opacity: 0.95 }}>Face Attendance</h2>

                            {/* Toggle */}
                            <div style={{
                                display: 'flex',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '50px',
                                padding: '6px',
                                marginBottom: '35px'
                            }}>
                                <button
                                    onClick={() => setAction('checkin')}
                                    style={{
                                        flex: 1,
                                        padding: '14px 28px',
                                        border: 'none',
                                        borderRadius: '50px',
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        background: action === 'checkin' ? 'white' : 'transparent',
                                        color: action === 'checkin' ? '#667eea' : 'white',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    📥 Check In
                                </button>
                                <button
                                    onClick={() => setAction('checkout')}
                                    style={{
                                        flex: 1,
                                        padding: '14px 28px',
                                        border: 'none',
                                        borderRadius: '50px',
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        background: action === 'checkout' ? 'white' : 'transparent',
                                        color: action === 'checkout' ? '#667eea' : 'white',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    📤 Check Out
                                </button>
                            </div>

                            {/* Scan button */}
                            <button
                                onClick={performScan}
                                disabled={mode === 'scanning'}
                                style={{
                                    width: '180px',
                                    height: '180px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: 'white',
                                    color: '#667eea',
                                    fontSize: '1.3rem',
                                    fontWeight: '700',
                                    cursor: mode === 'scanning' ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span style={{ fontSize: '2.5rem' }}>👤</span>
                                <span>SCAN</span>
                            </button>

                            <p style={{ marginTop: '25px', opacity: 0.7, fontSize: '0.95rem' }}>
                                Look at camera → Press SCAN
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.8); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default KioskPage;
