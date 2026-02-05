/**
 * Multi-Login Kiosk - Enterprise Edition
 * Optimized for Low Bandwidth.
 * - Client-side image compression (480px, 0.5 quality)
 * - Throttled server polling (1.2s)
 */
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { Link } from 'react-router-dom';

const API_BASE = '/api/v1/detection';  // Uses relative path for nginx proxy

const MultiLoginPage = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [recentLogins, setRecentLogins] = useState([]);
    const [status, setStatus] = useState('System Ready');

    // Compliance State
    const [requirements, setRequirements] = useState([]);
    const [detectedClasses, setDetectedClasses] = useState(new Set());
    const [detectedName, setDetectedName] = useState(null); // Legacy (can keep for now)
    const [faceResults, setFaceResults] = useState([]); // New multi-face results

    // Ref to share detections between loops without re-renders
    const faceDetectionsRef = useRef([]);

    // Get org from session
    const org = JSON.parse(sessionStorage.getItem('attendanceOrg') || '{}');
    const orgCode = org?.org_code || 'ACME';

    // Responsive Hook
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobile = windowWidth <= 900; // Tablet/Mobile cutoff

    // Dynamic Styles (Moved definition to function below, called here)
    const styles = getResponsiveStyles(isMobile);

    // 1. Initial Setup & Fetch Requirements
    useEffect(() => {
        const loadSetup = async () => {
            try {
                // Load Face Models
                await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
                setModelsLoaded(true);

                // Fetch Active YOLO Requirements
                const res = await fetch(`${API_BASE}/yolo-models/?org_code=${orgCode}`);
                const data = await res.json();
                if (data.models) {
                    const activeModel = data.models.find(m => m.requirements && m.requirements.some(r => r.is_required));
                    if (activeModel) {
                        const reqs = activeModel.requirements
                            .filter(r => r.is_required)
                            .map(r => r.class_name);
                        setRequirements(reqs);
                    }
                }
            } catch (e) {
                console.error('Setup Error:', e);
            }
        };
        loadSetup();
    }, [orgCode]);

    // 2. Loop for Visuals & Server Preview
    useEffect(() => {
        if (!modelsLoaded) return;

        // -- Fast Loop (Animation & Face Boxes) --
        const renderLoop = setInterval(async () => {
            if (isProcessing || !webcamRef.current) return;
            const video = webcamRef.current.video;
            if (!video || video.readyState !== 4) return;

            // Draw Face Box (Client Side)
            const detections = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
            );

            // Sort by X (left to right) to match preview loop indices
            detections.sort((a, b) => a.box.x - b.box.x);

            // Store for preview loop
            faceDetectionsRef.current = detections;

            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                canvasRef.current.width = video.videoWidth;
                canvasRef.current.height = video.videoHeight;
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                // Draw Faces
                // Draw Faces
                const serverFaces = faceResults || [];

                for (const det of detections) {
                    const { x, y, width, height } = det.box;
                    const cx = x + width / 2;
                    const cy = y + height / 2;

                    const lineLen = 20;
                    ctx.strokeStyle = lastResult?.success ? '#10b981' : 'white';
                    ctx.lineWidth = 3;

                    // Corner brackets
                    ctx.beginPath(); ctx.moveTo(x, y + lineLen); ctx.lineTo(x, y); ctx.lineTo(x + lineLen, y); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(x + width - lineLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + lineLen); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(x + width, y + height - lineLen); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width - lineLen, y + height); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(x + lineLen, y + height); ctx.lineTo(x, y + height); ctx.lineTo(x, y + height - lineLen); ctx.stroke();


                }

                // Draw Server YOLO Boxes (from window state)
                if (window.previewBoxes) {
                    for (const box of window.previewBoxes) {
                        const [x1, y1, x2, y2] = box.bbox;
                        const color = box.is_required ? '#f59e0b' : '#3b82f6';

                        ctx.strokeStyle = color;
                        ctx.lineWidth = 2;
                        ctx.setLineDash([5, 5]);
                        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                        ctx.setLineDash([]);

                        ctx.fillStyle = color;
                        const text = box.class.toUpperCase();
                        const textWidth = ctx.measureText(text).width + 10;
                        ctx.fillRect(x1, y1 - 20, textWidth, 20);

                        ctx.fillStyle = 'white';
                        ctx.font = 'bold 10px sans-serif';
                        ctx.fillText(text, x1 + 5, y1 - 6);
                    }
                }

                // Helper to draw rounded rect
                function roundRect(ctx, x, y, width, height, radius) {
                    ctx.beginPath();
                    ctx.moveTo(x + radius, y);
                    ctx.arcTo(x + width, y, x + width, y + height, radius);
                    ctx.arcTo(x + width, y + height, x, y + height, radius);
                    ctx.arcTo(x, y + height, x, y, radius);
                    ctx.arcTo(x, y, x + width, y, radius);
                    ctx.closePath();
                }
            }
        }, 100);

        // -- Slower Loop (Optimized 1.2s refresh) --
        const previewLoop = setInterval(async () => {
            if (isProcessing || !webcamRef.current) return;
            if (window.previewPending) return;

            const video = webcamRef.current.video;
            if (!video || video.readyState !== 4) return;

            // Only proceed if we detected a face on client side!
            const currentFaces = faceDetectionsRef.current || [];
            if (currentFaces.length === 0) {
                if (faceResults.length > 0) setFaceResults([]);
                return;
            }

            window.previewPending = true;

            try {
                const formData = new FormData();
                formData.append('org_code', orgCode);

                // 1. Get Full Image (resize to 640px)
                const scale = 640 / video.videoWidth;
                window.previewScale = scale;
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = 640;
                fullCanvas.height = video.videoHeight * scale;
                fullCanvas.getContext('2d').drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

                const fullBlob = await new Promise(r => fullCanvas.toBlob(r, 'image/jpeg', 0.8));
                if (fullBlob) formData.append('image', fullBlob, 'full.jpg');



                try {
                    const res = await fetch(`${API_BASE}/preview/`, { method: 'POST', body: formData });
                    const d = await res.json();

                    window.previewBoxes = d.boxes || [];
                    setFaceResults(d.face_results || []);

                    if (d.boxes) {
                        const classes = new Set(d.boxes.map(b => b.class));
                        setDetectedClasses(classes);
                    }
                } catch (e) {
                    // Ignore network errors
                } finally {
                    window.previewPending = false;
                }

            } catch (e) {
                window.previewPending = false;
            }
        }, 1200);

        return () => {
            clearInterval(renderLoop);
            clearInterval(previewLoop);
            window.previewPending = false;
        };
    }, [modelsLoaded, isProcessing, lastResult, orgCode, detectedName]);

    // 3. Login Action
    const attemptLogin = async (mode) => {
        if (isProcessing) return;
        setIsProcessing(true);
        setStatus(mode === 'check_in' ? 'Processing Check In...' : 'Processing Check Out...');

        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) { setIsProcessing(false); return; }

            const blob = await (await fetch(imageSrc)).blob();
            const formData = new FormData();
            formData.append('org_code', orgCode);
            formData.append('image', blob, 'face.jpg');
            formData.append('action', mode);

            const res = await fetch(`${API_BASE}/multi-login/`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                const resultObj = { success: true, timestamp: Date.now(), mode, ...data };
                setLastResult(resultObj);

                const msg = data.compliance_passed ? 'Verification Successful' : 'Compliance Issue Detected';
                setStatus(msg);

                setRecentLogins(prev => [
                    { ...resultObj, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                    ...prev.slice(0, 7)
                ]);

                if (window.speechSynthesis) {
                    const u = new SpeechSynthesisUtterance(data.compliance_passed ? `Thank you ${data.employee.name}` : `Please check your uniform`);
                    window.speechSynthesis.speak(u);
                }
            } else {
                setStatus(data.message || 'Not Recognized');
                setLastResult({ success: false, timestamp: Date.now() });
            }
        } catch (e) {
            console.error(e);
            setStatus('Connection Error');
        }

        setIsProcessing(false);
        setTimeout(() => setStatus('System Ready'), 3000);
    };

    return (
        <div style={styles.container}>
            {/* Top Bar */}
            <header style={styles.header}>
                <div style={styles.brand}>
                    <div style={styles.brandIcon}>📷</div>
                    <span style={styles.brandName}>SmartTouch Kiosk</span>
                </div>
                <Link to="/attendance/admin" style={styles.navLink}>Exit Kiosk</Link>
            </header>

            <main style={styles.main}>
                {/* Visualizer Card */}
                <div style={styles.card}>
                    <div style={styles.cameraWrapper}>
                        <Webcam
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            screenshotQuality={1.0}
                            videoConstraints={{ facingMode: 'user', width: 1280, height: 720 }}
                            style={styles.video}
                        />
                        <canvas ref={canvasRef} style={styles.canvas} />

                        {/* Status Bar */}
                        <div style={styles.statusBar}>
                            <div style={{
                                ...styles.statusDot,
                                background: status === 'System Ready' ? '#10b981' : '#3b82f6',
                                animation: isProcessing ? 'pulse 1s infinite' : 'none'
                            }} />
                            {status}
                        </div>

                        {/* DETECTED NAMES OVERLAY */}
                        {faceResults.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '60px', left: '16px',
                                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                                padding: '16px', borderRadius: '12px',
                                color: 'white', minWidth: '180px',
                                borderLeft: '4px solid #10b981',
                                zIndex: 100
                            }}>
                                <h3 style={{ margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>Verified Personnel</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {Array.from(new Set(faceResults.map(r => r.name))).filter(Boolean).map((name, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                                            <span style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>{name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Result Overlay */}
                        {lastResult && Date.now() - lastResult.timestamp < 3000 && (
                            <div style={styles.resultValid}>
                                <span style={{ fontSize: '3rem' }}>
                                    {lastResult.compliance_passed ? '✅' : '⚠️'}
                                </span>
                                <div>
                                    <h2 style={styles.resTitle}>{lastResult.employee?.name}</h2>
                                    <p style={styles.resSub}>
                                        {lastResult.mode === 'check_in' ? 'CHECKED IN' : 'CHECKED OUT'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div style={styles.controls}>
                        <button
                            disabled={isProcessing}
                            onClick={() => attemptLogin('check_in')}
                            style={{ ...styles.btn, ...styles.btnPrimary }}
                        >
                            CHECK IN
                        </button>
                        <button
                            disabled={isProcessing}
                            onClick={() => attemptLogin('check_out')}
                            style={{ ...styles.btn, ...styles.btnSecondary }}
                        >
                            CHECK OUT
                        </button>
                    </div>
                </div>

                {/* Sidebar Log */}
                <div style={styles.sidebar}>

                    {/* LIVE CHECKLIST IN SIDEBAR */}
                    {requirements.length > 0 && (
                        <div style={{ ...styles.checklist, position: 'static', marginBottom: '24px', width: 'auto' }}>
                            <h4 style={styles.chkTitle}>Required Uniform</h4>
                            {requirements.map(req => {
                                const isOk = detectedClasses.has(req);
                                return (
                                    <div key={req} style={styles.chkItem}>
                                        <span style={{
                                            ...styles.chkIcon,
                                            color: isOk ? '#10b981' : '#ef4444',
                                            background: isOk ? '#dcfce7' : '#fee2e2',
                                        }}>
                                            {isOk ? '✓' : '✕'}
                                        </span>
                                        <span style={{
                                            color: isOk ? '#0f172a' : '#64748b',
                                            textDecoration: isOk ? 'none' : 'none',
                                            fontWeight: isOk ? '600' : '400'
                                        }}>
                                            {req}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <h3 style={styles.sideTitle}>Session History</h3>
                    <div style={styles.logList}>
                        {recentLogins.length === 0 && <p style={styles.emptyTxt}>No recent activity</p>}

                        {recentLogins.map((log, i) => (
                            <div key={i} style={styles.logItem}>
                                <div style={{
                                    ...styles.logIcon,
                                    background: log.compliance_passed ? '#dcfce7' : '#fee2e2',
                                    color: log.compliance_passed ? '#15803d' : '#b91c1c'
                                }}>
                                    {log.compliance_passed ? '✓' : '!'}
                                </div>
                                <div>
                                    <div style={styles.logName}>{log.employee?.name}</div>
                                    <div style={styles.logMeta}>
                                        {log.mode.replace('_', ' ').toUpperCase()} • {log.time}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

// --- Responsive Styles ---
const getResponsiveStyles = (isMobile) => ({
    container: {
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex', flexDirection: 'column'
    },
    header: {
        height: '60px', background: 'white', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 24px',
        position: 'sticky', top: 0, zIndex: 1000
    },
    brand: { display: 'flex', alignItems: 'center', gap: '10px' },
    brandIcon: { fontSize: '24px' },
    brandName: { fontWeight: '600', fontSize: isMobile ? '16px' : '18px', color: '#334155' },
    navLink: { textDecoration: 'none', color: '#64748b', fontSize: '14px', fontWeight: '500' },

    main: {
        flex: 1, display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        padding: isMobile ? '16px' : '32px',
        gap: isMobile ? '16px' : '32px',
        maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box'
    },
    card: {
        flex: 2, background: 'white', borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        padding: isMobile ? '16px' : '24px',
        display: 'flex', flexDirection: 'column', gap: '24px',
        width: '100%', boxSizing: 'border-box'
    },
    cameraWrapper: {
        flex: 1, background: '#000', borderRadius: '12px', position: 'relative', overflow: 'hidden',
        minHeight: isMobile ? '350px' : '400px',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    video: { width: '100%', height: '100%', objectFit: 'cover' },
    canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

    statusBar: {
        position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.95)',
        padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', color: '#334155',
        display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    statusDot: { width: '8px', height: '8px', borderRadius: '50%' },

    checklist: {
        position: 'absolute', top: '16px', left: '16px', // Move to left on desktop/mobile
        display: isMobile ? 'none' : 'block', // Hide on mobile to save space
        background: 'rgba(255,255,255,0.95)',
        padding: '16px', borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        minWidth: '180px'
    },
    chkTitle: { margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: '#64748b' },
    chkItem: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' },
    chkIcon: {
        width: '24px', height: '24px', borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold'
    },

    resultValid: {
        position: 'absolute', bottom: '24px', left: '24px', right: '24px',
        background: 'rgba(255, 255, 255, 0.95)', padding: '20px', borderRadius: '12px',
        display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        borderLeft: '5px solid #10b981',
        animation: 'slideUp 0.3s ease-out'
    },
    resTitle: { margin: 0, fontSize: isMobile ? '18px' : '20px', fontWeight: '700' },
    resSub: { margin: '4px 0 0 0', color: '#64748b', fontSize: '14px', fontWeight: '500' },

    controls: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
        height: isMobile ? '60px' : '80px',
        marginTop: 'auto'
    },
    btn: {
        border: 'none', borderRadius: '12px',
        fontSize: isMobile ? '16px' : '18px', fontWeight: '700', cursor: 'pointer',
        transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
    },
    btnPrimary: { background: '#10b981', color: 'white' },
    btnSecondary: { background: '#ef4444', color: 'white' },

    sidebar: {
        flex: isMobile ? 'none' : 1,
        width: '100%',
        maxWidth: isMobile ? 'none' : '350px',
        height: isMobile ? 'auto' : 'auto',
        maxHeight: isMobile ? '300px' : 'none',
        display: 'flex', flexDirection: 'column'
    },
    sideTitle: { margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: '700' },
    logList: { background: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1, overflowY: 'auto', padding: '16px' },
    logItem: { display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
    logIcon: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' },
    logName: { fontWeight: '600', fontSize: '15px' },
    logMeta: { fontSize: '12px', color: '#64748b', marginTop: '2px' },
    emptyTxt: { textAlign: 'center', color: '#94a3b8', marginTop: '40px', fontSize: '14px' }
});

export default MultiLoginPage;
