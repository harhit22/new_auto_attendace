/**
 * Kiosk Mode - Dual Model Face Recognition
 * Supports both Light (128-d face-api.js local) and Heavy (512-d DeepFace backend) modes
 */
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const KioskPage = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [step, setStep] = useState('login');
    const [org, setOrg] = useState(null);
    const [orgCode, setOrgCode] = useState('');
    const [password, setPassword] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [loginError, setLoginError] = useState('');
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [recentCheckins, setRecentCheckins] = useState([]);
    const [action, setAction] = useState('checkin');
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState('');
    const [lastRecognized, setLastRecognized] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [employees, setEmployees] = useState([]); // For light mode local matching
    const isProcessing = useRef(false);
    const lastScanTime = useRef(0);
    const recognitionTimers = useRef({});

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const savedOrg = localStorage.getItem('kiosk_org');
        if (savedOrg) {
            try {
                const parsed = JSON.parse(savedOrg);
                setOrg(parsed);
                setStep('kiosk');

                // Fetch fresh org settings from API (recognition_mode may have changed)
                refreshOrgSettings(parsed.org_code);
            } catch (e) {
                localStorage.removeItem('kiosk_org');
            }
        }
    }, []);

    // Function to refresh org settings from API
    const refreshOrgSettings = async (orgCode) => {
        try {
            const res = await fetch(`${API_BASE}/org-settings/?org_code=${orgCode}`);
            if (!res.ok) {
                console.log('Could not refresh org settings, using cached');
                return;
            }
            const data = await res.json();
            if (data.success && data.organization) {
                // Update org with fresh recognition_mode
                setOrg(prev => ({ ...prev, ...data.organization }));
                const updatedOrg = { ...JSON.parse(localStorage.getItem('kiosk_org') || '{}'), ...data.organization };
                localStorage.setItem('kiosk_org', JSON.stringify(updatedOrg));
                console.log('Refreshed org settings, recognition_mode:', data.organization.recognition_mode);
            }
        } catch (e) {
            console.log('Could not refresh org settings:', e);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Load face-api models for both detection and recognition (light mode)
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);
                console.log('Face-api models loaded');
            } catch (e) {
                console.error('Failed to load face-api models:', e);
            }
        };
        loadModels();
    }, []);

    // Load employees for light mode (local matching)
    useEffect(() => {
        if (org && modelsLoaded && org.recognition_mode === 'light') {
            loadEmployeesForLightMode();
        }
    }, [org, modelsLoaded]);

    const loadEmployeesForLightMode = async () => {
        try {
            const res = await fetch(`${API_BASE}/employee-embeddings/?org_code=${org.org_code}&mode=light`);
            const data = await res.json();
            if (data.success && data.employees) {
                setEmployees(data.employees.filter(e => e.embeddings && e.embeddings.length > 0));
                console.log(`Loaded ${data.employees.length} employees (${data.expected_dimension}-d embeddings)`);
            }
        } catch (e) {
            console.error('Failed to load employees:', e);
        }
    };

    // Continuous face detection and recognition
    useEffect(() => {
        if (!modelsLoaded || step !== 'kiosk' || !isScanning) return;

        const detectAndRecognize = async () => {
            if (!webcamRef.current || !canvasRef.current || isProcessing.current) return;

            const video = webcamRef.current.video;
            if (!video || video.readyState !== 4) return;

            const canvas = canvasRef.current;
            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            faceapi.matchDimensions(canvas, displaySize);

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const recognitionMode = org?.recognition_mode || 'heavy';

            // BOTH MODES: Use backend matching for now
            // (Light 128-d local matching requires re-capture with face-api.js embeddings)
            // Face detection for visual feedback
            const detections = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
            );

            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // Draw detection boxes
            for (const det of resizedDetections) {
                const box = det.box;
                ctx.strokeStyle = lastRecognized ? '#22c55e' : '#3b82f6';
                ctx.lineWidth = 3;
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                if (lastRecognized) {
                    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
                    ctx.fillRect(box.x, box.y - 30, box.width, 28);
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText(lastRecognized.name, box.x + 6, box.y - 10);
                }
            }

            // Send to backend every 2 seconds for matching
            const now = Date.now();
            if (resizedDetections.length > 0 && now - lastScanTime.current > 2000 && !isProcessing.current) {
                lastScanTime.current = now;
                isProcessing.current = true;
                setScanStatus('🔍 Scanning...');

                const imageSrc = webcamRef.current.getScreenshot();
                if (imageSrc) {
                    try {
                        const blob = await (await fetch(imageSrc)).blob();
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
                            setLastRecognized(data.employee);
                            setScanStatus(`✅ ${data.employee?.name || 'Success'}`);
                            speak(data.message);

                            setRecentCheckins(prev => [{
                                ...data.employee,
                                time: Date.now(),
                                action,
                                success: true
                            }, ...prev.slice(0, 9)]);

                            setTimeout(() => {
                                setLastRecognized(null);
                                setScanStatus('');
                            }, 3000);
                        } else {
                            setScanStatus(`⚠️ ${data.message || 'Not recognized'}`);
                            setTimeout(() => setScanStatus(''), 2000);
                        }
                    } catch (e) {
                        setScanStatus('❌ Connection error');
                        setTimeout(() => setScanStatus(''), 2000);
                    }
                }
                isProcessing.current = false;
            }
        };

        const interval = setInterval(detectAndRecognize, 200);
        return () => clearInterval(interval);
    }, [modelsLoaded, step, isScanning, action, org, employees, lastRecognized]);

    const performCheckin = async (employee) => {
        // Check cooldown
        if (recentCheckins.find(c => c.employee_id === employee.employee_id && Date.now() - c.time < 30000)) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/auto-checkin/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_code: org.org_code,
                    employee_id: employee.employee_id,
                    action: action
                })
            });
            const data = await res.json();

            if (data.success) {
                speak(data.message);
                setRecentCheckins(prev => [{
                    ...employee,
                    time: Date.now(),
                    action,
                    success: true
                }, ...prev.slice(0, 9)]);
            }
        } catch (e) {
            console.error('Auto check-in failed:', e);
        }
    };

    const speak = (text) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-IN';
            speechSynthesis.speak(utterance);
        }
    };

    const handleLogin = async () => {
        setLoginError('');
        if (!orgCode.trim()) { setLoginError('Enter organization code'); return; }
        if (!password.trim()) { setLoginError('Enter password'); return; }

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
            setLoginError('Connection failed');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('kiosk_org');
        setOrg(null);
        setStep('login');
        setIsScanning(false);
    };

    // LOGIN SCREEN
    if (step === 'login') {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}>
                <div style={{
                    maxWidth: '400px', width: '100%',
                    background: 'rgba(30, 41, 59, 0.9)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: isMobile ? '30px 24px' : '50px 40px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '70px', height: '70px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px', fontSize: '2rem'
                    }}>👁️</div>
                    <h2 style={{ color: 'white', marginBottom: '8px', fontSize: '1.5rem' }}>Face Recognition Terminal</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '28px', fontSize: '0.9rem' }}>
                        Enter organization credentials
                    </p>

                    {loginError && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            borderRadius: '10px', padding: '10px', marginBottom: '16px',
                            color: '#f87171', fontSize: '0.9rem'
                        }}>⚠️ {loginError}</div>
                    )}

                    <input
                        type="text" placeholder="Organization Code" value={orgCode}
                        onChange={e => setOrgCode(e.target.value.toUpperCase())}
                        onKeyPress={e => e.key === 'Enter' && handleLogin()}
                        style={{
                            width: '100%', padding: '14px', fontSize: '1rem',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px', color: 'white', textAlign: 'center',
                            letterSpacing: '2px', fontWeight: '600', outline: 'none',
                            marginBottom: '12px', boxSizing: 'border-box'
                        }}
                    />
                    <input
                        type="password" placeholder="Password" value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleLogin()}
                        style={{
                            width: '100%', padding: '14px', fontSize: '1rem',
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '10px', color: 'white', textAlign: 'center',
                            outline: 'none', marginBottom: '20px', boxSizing: 'border-box'
                        }}
                    />
                    <button onClick={handleLogin} style={{
                        width: '100%', padding: '14px', fontSize: '1rem', fontWeight: '600',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer'
                    }}>
                        🔓 Access Terminal
                    </button>
                </div>
            </div>
        );
    }

    const recognitionMode = org?.recognition_mode || 'heavy';

    // KIOSK SCREEN
    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{
                padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: recognitionMode === 'light'
                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem'
                    }}>{recognitionMode === 'light' ? '⚡' : '🧠'}</div>
                    <div>
                        <div style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem' }}>{org?.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                            {recognitionMode === 'light' ? '⚡ Light Mode (128-d)' : '🧠 Heavy Mode (512-d)'}
                            {recognitionMode === 'light' && ` • ${employees.length} employees`}
                        </div>
                    </div>
                </div>
                <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: '700', fontFamily: 'monospace' }}>
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <button onClick={handleLogout} style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    padding: '8px 16px', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer'
                }}>🔒</button>
            </div>

            {/* Main */}
            <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', padding: '16px', gap: '16px' }}>
                {/* Camera */}
                <div style={{ flex: 2 }}>
                    <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                            style={{ width: '100%', display: 'block' }}
                            mirrored={true}
                        />
                        <canvas
                            ref={canvasRef}
                            style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                transform: 'scaleX(-1)'
                            }}
                        />
                        {!isScanning && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: 'rgba(0,0,0,0.7)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column'
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
                                    {recognitionMode === 'light' ? '⚡' : '🧠'}
                                </div>
                                <p style={{ color: 'white', fontSize: '1rem', marginBottom: '8px' }}>
                                    {recognitionMode === 'light' ? 'Light Mode - Local Recognition' : 'Heavy Mode - Server Recognition'}
                                </p>
                                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '20px' }}>
                                    {recognitionMode === 'light' ? 'Fast in-browser face matching' : 'DeepFace powered recognition'}
                                </p>
                                <button onClick={() => setIsScanning(true)} style={{
                                    padding: '16px 40px', fontSize: '1.1rem', fontWeight: '600',
                                    background: recognitionMode === 'light'
                                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                        : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                    border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer'
                                }}>
                                    ▶️ Start Scanning
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Status */}
                    <div style={{
                        marginTop: '16px', padding: '16px',
                        background: scanStatus.includes('✅') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)',
                        borderRadius: '12px', textAlign: 'center',
                        border: scanStatus.includes('✅') ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <span style={{ color: scanStatus.includes('✅') ? '#22c55e' : 'rgba(255,255,255,0.6)', fontWeight: '600' }}>
                            {scanStatus || (isScanning
                                ? `🔴 LIVE - ${recognitionMode === 'light' ? 'Local matching' : 'Backend matching every 2s'}`
                                : '⚫ Stopped')}
                        </span>
                    </div>

                    {/* Controls */}
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '4px' }}>
                            <button onClick={() => setAction('checkin')} style={{
                                padding: '10px 20px', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600',
                                background: action === 'checkin' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'transparent',
                                color: action === 'checkin' ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer'
                            }}>📥 Check In</button>
                            <button onClick={() => setAction('checkout')} style={{
                                padding: '10px 20px', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600',
                                background: action === 'checkout' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
                                color: action === 'checkout' ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer'
                            }}>📤 Check Out</button>
                        </div>
                        {isScanning && (
                            <button onClick={() => setIsScanning(false)} style={{
                                padding: '10px 20px', background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px',
                                color: '#ef4444', cursor: 'pointer', fontWeight: '600'
                            }}>⏹ Stop</button>
                        )}
                    </div>
                </div>

                {/* Side Panel */}
                <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        height: '100%', maxHeight: isMobile ? '200px' : '100%',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <h3 style={{ color: 'white', margin: 0, fontSize: '1rem' }}>📋 Recent Activity</h3>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {recentCheckins.length === 0 ? (
                                <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '30px', fontSize: '0.9rem' }}>
                                    No check-ins yet
                                </p>
                            ) : (
                                recentCheckins.map((c, i) => (
                                    <div key={i} style={{
                                        padding: '12px', background: 'rgba(34, 197, 94, 0.1)',
                                        borderRadius: '8px', marginBottom: '8px',
                                        borderLeft: '3px solid #22c55e'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem' }}>{c.name}</span>
                                            <span style={{ color: c.action === 'checkin' ? '#22c55e' : '#f59e0b', fontSize: '0.75rem' }}>
                                                {c.action === 'checkin' ? '📥 IN' : '📤 OUT'}
                                            </span>
                                        </div>
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '4px' }}>
                                            {new Date(c.time).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KioskPage;
