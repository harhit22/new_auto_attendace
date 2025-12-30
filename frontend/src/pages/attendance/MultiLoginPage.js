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

const API_BASE = 'http://localhost:8000/api/v1/detection';

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

    // Get org from session
    const org = JSON.parse(sessionStorage.getItem('attendanceOrg') || '{}');
    const orgCode = org?.org_code || 'ACME';

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

            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                canvasRef.current.width = video.videoWidth;
                canvasRef.current.height = video.videoHeight;
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                // Draw Faces
                for (const det of detections) {
                    const { x, y, width, height } = det.box;
                    const lineLen = 20;
                    ctx.strokeStyle = lastResult?.success ? '#10b981' : 'white';
                    ctx.lineWidth = 3;

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
            }
        }, 100);

        // -- Slower Loop (Optimized 1.2s refresh) --
        const previewLoop = setInterval(async () => {
            if (isProcessing || !webcamRef.current) return;
            // Prevent stacking requests
            if (window.previewPending) return;

            const video = webcamRef.current.video;
            if (!video || video.readyState !== 4) return;

            window.previewPending = true;

            try {
                // Client-side Compression & Resizing (Optimization)
                const smallCanvas = document.createElement('canvas');
                const ratio = video.videoHeight / video.videoWidth;
                smallCanvas.width = 480; // Small width is enough for YOLO
                smallCanvas.height = 480 * ratio;
                const ctx = smallCanvas.getContext('2d');
                ctx.drawImage(video, 0, 0, smallCanvas.width, smallCanvas.height);

                // Convert to lightweight JPEG Blob
                smallCanvas.toBlob(async (blob) => {
                    if (!blob) { window.previewPending = false; return; }

                    const formData = new FormData();
                    formData.append('org_code', orgCode);
                    formData.append('image', blob, 'preview.jpg');

                    try {
                        const res = await fetch(`${API_BASE}/preview/`, { method: 'POST', body: formData });
                        const d = await res.json();

                        window.previewBoxes = d.boxes || [];
                        if (d.boxes) {
                            const classes = new Set(d.boxes.map(b => b.class));
                            setDetectedClasses(classes);
                        }
                    } catch (e) {
                        // Ignore network errors for preview
                    } finally {
                        window.previewPending = false;
                    }
                }, 'image/jpeg', 0.5); // 50% Quality

            } catch (e) {
                window.previewPending = false;
            }
        }, 1200);

        return () => {
            clearInterval(renderLoop);
            clearInterval(previewLoop);
            window.previewPending = false;
        };
    }, [modelsLoaded, isProcessing, lastResult, orgCode]);

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

                        {/* LIVE CHECKLIST OVERLAY */}
                        {requirements.length > 0 && (
                            <div style={styles.checklist}>
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

// --- Styles ---
const styles = {
    container: {
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex', flexDirection: 'column'
    },
    header: {
        height: '60px', background: 'white', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px'
    },
    brand: { display: 'flex', alignItems: 'center', gap: '10px' },
    brandIcon: { fontSize: '24px' },
    brandName: { fontWeight: '600', fontSize: '18px', color: '#334155' },
    navLink: { textDecoration: 'none', color: '#64748b', fontSize: '14px', fontWeight: '500' },

    main: {
        flex: 1, display: 'flex', padding: '32px', gap: '32px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box'
    },
    card: {
        flex: 2, background: 'white', borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '24px',
        display: 'flex', flexDirection: 'column', gap: '24px'
    },
    cameraWrapper: {
        flex: 1, background: '#000', borderRadius: '12px', position: 'relative', overflow: 'hidden', minHeight: '400px',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    },
    video: { width: '100%', height: '100%', objectFit: 'cover' },
    canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

    statusBar: {
        position: 'absolute', top: '16px', left: '16px', background: 'rgba(255,255,255,0.95)',
        padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', color: '#334155',
        display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    statusDot: { width: '8px', height: '8px', borderRadius: '50%' },

    // Checklist Styles
    checklist: {
        position: 'absolute', top: '16px', right: '16px',
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
        borderLeft: '5px solid #10b981'
    },
    resTitle: { margin: 0, fontSize: '20px', fontWeight: '700' },
    resSub: { margin: '4px 0 0 0', color: '#64748b', fontSize: '14px', fontWeight: '500' },

    controls: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', height: '80px' },
    btn: {
        border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: '700', cursor: 'pointer',
        transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    },
    btnPrimary: { background: '#10b981', color: 'white' },
    btnSecondary: { background: '#ef4444', color: 'white' },

    sidebar: { flex: 1, maxWidth: '350px', display: 'flex', flexDirection: 'column' },
    sideTitle: { margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: '700' },
    logList: { background: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1, overflowY: 'auto', padding: '16px' },
    logItem: { display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid #f1f5f9' },
    logIcon: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' },
    logName: { fontWeight: '600', fontSize: '15px' },
    logMeta: { fontSize: '12px', color: '#64748b', marginTop: '2px' },
    emptyTxt: { textAlign: 'center', color: '#94a3b8', marginTop: '40px', fontSize: '14px' }
};

export default MultiLoginPage;
