/**
 * Employee Face Enrollment Page - Premium Design
 * Auto-capture with modern UI and face scanning animation
 */
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const API_BASE = 'http://localhost:8000/api/v1/attendance';
const MAX_IMAGES = 200;
const CAPTURE_INTERVAL = 200;

const POSE_PROMPTS = [
    { text: '👀 Look straight', icon: '🎯', duration: 4000 },
    { text: '👈 Turn left', icon: '↩️', duration: 3000 },
    { text: '👉 Turn right', icon: '↪️', duration: 3000 },
    { text: '👆 Look up', icon: '⬆️', duration: 2500 },
    { text: '👇 Look down', icon: '⬇️', duration: 2500 },
    { text: '😊 Smile!', icon: '😄', duration: 2000 },
    { text: '😐 Neutral', icon: '😐', duration: 2000 },
    { text: '🔄 Tilt left', icon: '↖️', duration: 2500 },
    { text: '🔄 Tilt right', icon: '↗️', duration: 2500 },
    { text: '✨ Great job!', icon: '🌟', duration: 2000 },
];

// Styles
const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
        padding: '16px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    },
    wrapper: {
        maxWidth: '500px',
        margin: '0 auto'
    },
    header: {
        textAlign: 'center',
        marginBottom: '20px',
        color: 'white'
    },
    title: {
        fontSize: 'clamp(1.3rem, 5vw, 1.8rem)',
        fontWeight: '700',
        margin: '0 0 4px 0',
        background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
    },
    subtitle: {
        fontSize: '0.9rem',
        opacity: 0.7,
        margin: 0
    },
    card: {
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
    },
    webcamContainer: {
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        marginBottom: '16px',
        background: '#000'
    },
    webcam: {
        width: '100%',
        display: 'block',
        borderRadius: '20px'
    },
    scanOverlay: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none'
    },
    scanLine: {
        position: 'absolute',
        left: '10%',
        right: '10%',
        height: '3px',
        background: 'linear-gradient(90deg, transparent, #00d4ff, #7c3aed, transparent)',
        boxShadow: '0 0 20px #00d4ff',
        animation: 'scanMove 2s ease-in-out infinite'
    },
    faceGuide: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '60%',
        maxWidth: '200px',
        aspectRatio: '3/4',
        border: '3px dashed rgba(0,212,255,0.5)',
        borderRadius: '50%',
        animation: 'facePulse 2s ease-in-out infinite'
    },
    cornerTL: { position: 'absolute', top: 12, left: 12, width: 30, height: 30, borderTop: '3px solid #00d4ff', borderLeft: '3px solid #00d4ff', borderRadius: '4px 0 0 0' },
    cornerTR: { position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderTop: '3px solid #7c3aed', borderRight: '3px solid #7c3aed', borderRadius: '0 4px 0 0' },
    cornerBL: { position: 'absolute', bottom: 12, left: 12, width: 30, height: 30, borderBottom: '3px solid #7c3aed', borderLeft: '3px solid #7c3aed', borderRadius: '0 0 0 4px' },
    cornerBR: { position: 'absolute', bottom: 12, right: 12, width: 30, height: 30, borderBottom: '3px solid #00d4ff', borderRight: '3px solid #00d4ff', borderRadius: '0 0 4px 0' },
    promptBadge: {
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.85)',
        color: 'white',
        padding: '10px 24px',
        borderRadius: '50px',
        fontSize: 'clamp(0.9rem, 4vw, 1.1rem)',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        border: '1px solid rgba(0,212,255,0.3)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
    },
    statsBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        background: 'rgba(0,0,0,0.85)',
        color: 'white',
        padding: '8px 14px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        fontWeight: '700',
        border: '1px solid rgba(0,212,255,0.3)'
    },
    progressContainer: {
        marginBottom: '16px'
    },
    progressBar: {
        height: '8px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '50px',
        overflow: 'hidden'
    },
    progressFill: (pct) => ({
        height: '100%',
        background: 'linear-gradient(90deg, #00d4ff, #7c3aed)',
        borderRadius: '50px',
        width: `${pct}%`,
        transition: 'width 0.2s ease'
    }),
    progressText: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '0.8rem',
        color: 'rgba(255,255,255,0.6)'
    },
    buttonRow: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        justifyContent: 'center'
    },
    btnPrimary: {
        flex: '1 1 auto',
        minWidth: '140px',
        padding: '14px 20px',
        background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
        border: 'none',
        borderRadius: '14px',
        color: 'white',
        fontSize: '1rem',
        fontWeight: '700',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s'
    },
    btnSuccess: {
        flex: '1 1 auto',
        minWidth: '140px',
        padding: '14px 20px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        border: 'none',
        borderRadius: '14px',
        color: 'white',
        fontSize: '1rem',
        fontWeight: '700',
        cursor: 'pointer'
    },
    btnOutline: {
        padding: '14px 20px',
        background: 'transparent',
        border: '2px solid rgba(255,255,255,0.3)',
        borderRadius: '14px',
        color: 'white',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer'
    },
    statusBadge: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: 'rgba(0,212,255,0.1)',
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: '12px',
        color: '#00d4ff',
        fontSize: '0.85rem',
        fontWeight: '600',
        marginBottom: '16px'
    }
};

const EnrollEmployeePage = () => {
    const webcamRef = useRef(null);
    const captureIntervalRef = useRef(null);

    const urlParams = new URLSearchParams(window.location.search);
    const urlOrgCode = urlParams.get('org')?.toUpperCase();
    const urlEmpId = urlParams.get('emp');

    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [capturedImages, setCapturedImages] = useState([]);
    const [capturedEmbeddings, setCapturedEmbeddings] = useState([]);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [currentPrompt, setCurrentPrompt] = useState(POSE_PROMPTS[0]);
    const [promptIndex, setPromptIndex] = useState(0);
    const [step, setStep] = useState('select');
    const [status, setStatus] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);

    // Load face-api models
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
            } catch (e) {
                console.error('Failed to load models:', e);
            }
        };
        loadModels();
    }, []);

    // Load organizations
    useEffect(() => {
        fetch(`${API_BASE}/organizations/`)
            .then(r => r.json())
            .then(data => {
                setOrganizations(data.organizations || []);
                if (urlOrgCode && data.organizations) {
                    const match = data.organizations.find(o => o.org_code === urlOrgCode);
                    if (match) setSelectedOrg(match);
                    else if (data.organizations.length > 0) setSelectedOrg(data.organizations[0]);
                } else if (data.organizations?.length > 0) {
                    setSelectedOrg(data.organizations[0]);
                }
            }).catch(console.error);
    }, []);

    // Load employees
    useEffect(() => {
        if (!selectedOrg) return;
        fetch(`${API_BASE}/employees/?organization_id=${selectedOrg.id}`)
            .then(r => r.json())
            .then(data => {
                setEmployees(data.employees || []);
                if (urlEmpId && data.employees) {
                    const match = data.employees.find(e => e.employee_id === urlEmpId);
                    if (match) { setSelectedEmployee(match); setStep('capture'); }
                }
            }).catch(console.error);
    }, [selectedOrg]);

    // Rotate prompts
    useEffect(() => {
        if (!isCapturing) return;
        const timer = setTimeout(() => {
            const next = (promptIndex + 1) % POSE_PROMPTS.length;
            setPromptIndex(next);
            setCurrentPrompt(POSE_PROMPTS[next]);
        }, currentPrompt.duration);
        return () => clearTimeout(timer);
    }, [isCapturing, promptIndex, currentPrompt]);

    // Auto-capture with 128-d embedding
    useEffect(() => {
        if (isCapturing && capturedImages.length < MAX_IMAGES && modelsLoaded) {
            captureIntervalRef.current = setInterval(async () => {
                if (!webcamRef.current) return;
                const img = webcamRef.current.getScreenshot();
                if (!img) return;
                try {
                    const imgEl = document.createElement('img');
                    imgEl.src = img;
                    await new Promise(r => imgEl.onload = r);
                    const det = await faceapi.detectSingleFace(imgEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
                        .withFaceLandmarks().withFaceDescriptor();
                    if (det) {
                        setCapturedImages(p => p.length >= MAX_IMAGES ? p : [...p, img]);
                        setCapturedEmbeddings(p => [...p, Array.from(det.descriptor)]);
                    }
                } catch (e) { }
            }, CAPTURE_INTERVAL);
        }
        return () => captureIntervalRef.current && clearInterval(captureIntervalRef.current);
    }, [isCapturing, modelsLoaded]);

    useEffect(() => {
        if (capturedImages.length >= MAX_IMAGES) {
            setIsCapturing(false);
            captureIntervalRef.current && clearInterval(captureIntervalRef.current);
        }
    }, [capturedImages.length]);

    const base64ToBlob = async (b64) => (await fetch(b64)).blob();

    const startCapture = () => {
        setCapturedImages([]); setCapturedEmbeddings([]);
        setIsCapturing(true); setPromptIndex(0);
        setCurrentPrompt(POSE_PROMPTS[0]);
    };

    const stopCapture = () => {
        setIsCapturing(false);
        captureIntervalRef.current && clearInterval(captureIntervalRef.current);
    };

    const uploadImages = async () => {
        if (capturedImages.length < 10) { setStatus('Need at least 10 images'); return; }
        setStep('uploading'); setUploadProgress(0);
        try {
            const batchSize = 50;
            for (let i = 0; i < capturedImages.length; i += batchSize) {
                const batchImgs = capturedImages.slice(i, i + batchSize);
                const batchEmbs = capturedEmbeddings.slice(i, i + batchSize);
                const formData = new FormData();
                formData.append('org_code', selectedOrg.org_code);
                formData.append('employee_id', selectedEmployee.employee_id);
                formData.append('light_embeddings', JSON.stringify(batchEmbs));
                for (let j = 0; j < batchImgs.length; j++) {
                    formData.append('images', await base64ToBlob(batchImgs[j]), `f_${i + j}.jpg`);
                }
                const res = await fetch(`${API_BASE}/capture-images/`, { method: 'POST', body: formData });
                if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
                setUploadProgress(Math.round(((i + batchImgs.length) / capturedImages.length) * 100));
            }
            setStep('success');
        } catch (e) { setStatus(`Error: ${e.message}`); setStep('capture'); }
    };

    // CSS keyframes
    const keyframes = `
        @keyframes scanMove { 0%, 100% { top: 10%; } 50% { top: 85%; } }
        @keyframes facePulse { 0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.02); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(0,212,255,0.3); } 50% { box-shadow: 0 0 40px rgba(124,58,237,0.5); } }
    `;

    // SELECT EMPLOYEE
    if (step === 'select') {
        return (
            <div style={styles.container}>
                <style>{keyframes}</style>
                <div style={styles.wrapper}>
                    <div style={styles.header}>
                        <h1 style={styles.title}>📸 Face Enrollment</h1>
                        <p style={styles.subtitle}>Select employee to begin</p>
                    </div>
                    <div style={styles.card}>
                        <div style={styles.statusBadge}>
                            {modelsLoaded ? '⚡ AI Ready' : '⏳ Loading AI...'}
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Organization</label>
                            <select style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem' }}
                                value={selectedOrg?.id || ''} onChange={e => setSelectedOrg(organizations.find(o => o.id === e.target.value))}>
                                {organizations.map(o => <option key={o.id} value={o.id} style={{ color: '#000' }}>{o.name}</option>)}
                            </select>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '10px' }}>Employees</div>
                        {employees.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '20px' }}>No employees found</p>
                        ) : (
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {employees.map(emp => (
                                    <div key={emp.id} onClick={() => { setSelectedEmployee(emp); setStep('capture'); }}
                                        style={{ padding: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '14px', border: '1px solid rgba(0,212,255,0.3)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        <div style={{ fontWeight: '600', color: 'white' }}>{emp.name || `${emp.first_name} ${emp.last_name}`}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{emp.employee_id} • {emp.image_count || 0} images</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // UPLOADING
    if (step === 'uploading') {
        return (
            <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <style>{keyframes}</style>
                <div style={{ ...styles.card, maxWidth: '400px', textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🚀</div>
                    <h2 style={{ color: 'white', margin: '0 0 8px 0' }}>Uploading...</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 20px 0' }}>{capturedImages.length} images + {capturedEmbeddings.length} embeddings</p>
                    <div style={styles.progressBar}><div style={styles.progressFill(uploadProgress)}></div></div>
                    <p style={{ color: '#00d4ff', marginTop: '12px', fontWeight: '600' }}>{uploadProgress}%</p>
                </div>
            </div>
        );
    }

    // SUCCESS
    if (step === 'success') {
        return (
            <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ ...styles.card, maxWidth: '400px', textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
                    <h2 style={{ color: '#10b981', margin: '0 0 8px 0' }}>Success!</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 24px 0' }}>
                        {capturedImages.length} photos saved for <strong style={{ color: 'white' }}>{selectedEmployee?.name}</strong>
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a href="/attendance/admin/models" style={{ ...styles.btnPrimary, textDecoration: 'none', textAlign: 'center' }}>🎯 Train Model</a>
                        <a href="/kiosk" style={{ ...styles.btnSuccess, textDecoration: 'none', textAlign: 'center' }}>🖥️ Kiosk</a>
                    </div>
                </div>
            </div>
        );
    }

    // CAPTURE MODE
    const progress = (capturedImages.length / MAX_IMAGES) * 100;

    return (
        <div style={styles.container}>
            <style>{keyframes}</style>
            <div style={styles.wrapper}>
                <div style={styles.header}>
                    <h1 style={styles.title}>{selectedEmployee?.name || 'Face Capture'}</h1>
                    <p style={styles.subtitle}>{selectedOrg?.name}</p>
                </div>

                <div style={styles.card}>
                    {/* Webcam with scanning overlay */}
                    <div style={styles.webcamContainer}>
                        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" screenshotQuality={0.8}
                            videoConstraints={{ width: 480, height: 640, facingMode: 'user' }}
                            style={styles.webcam} mirrored={true} />

                        {/* Scanning overlay */}
                        <div style={styles.scanOverlay}>
                            {isCapturing && <div style={styles.scanLine}></div>}
                            <div style={styles.faceGuide}></div>
                            <div style={styles.cornerTL}></div>
                            <div style={styles.cornerTR}></div>
                            <div style={styles.cornerBL}></div>
                            <div style={styles.cornerBR}></div>
                        </div>

                        {/* Stats */}
                        <div style={styles.statsBadge}>📷 {capturedImages.length}</div>

                        {/* Prompt */}
                        {isCapturing && <div style={styles.promptBadge}>{currentPrompt.icon} {currentPrompt.text}</div>}
                    </div>

                    {/* Progress */}
                    <div style={styles.progressContainer}>
                        <div style={styles.progressBar}><div style={styles.progressFill(progress)}></div></div>
                        <div style={styles.progressText}>
                            <span>⚡ {capturedEmbeddings.length} AI embeddings</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div style={styles.buttonRow}>
                        {!isCapturing ? (
                            <>
                                <button style={styles.btnPrimary} onClick={startCapture} disabled={!modelsLoaded}>
                                    {modelsLoaded ? '▶️ Start' : '⏳ Loading...'}
                                </button>
                                {capturedImages.length >= 10 && (
                                    <button style={styles.btnSuccess} onClick={uploadImages}>
                                        ✅ Save ({capturedImages.length})
                                    </button>
                                )}
                            </>
                        ) : (
                            <button style={styles.btnOutline} onClick={stopCapture}>⏹️ Stop</button>
                        )}
                        <button style={styles.btnOutline} onClick={() => { setStep('select'); setCapturedImages([]); setCapturedEmbeddings([]); }}>
                            ← Back
                        </button>
                    </div>

                    {status && <p style={{ textAlign: 'center', color: '#ef4444', marginTop: '12px', fontSize: '0.9rem' }}>{status}</p>}
                </div>
            </div>
        </div>
    );
};

export default EnrollEmployeePage;
