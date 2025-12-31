/**
 * Employee Face Enrollment Page - Premium Design
 * Auto-capture with modern UI and face scanning animation
 */
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1/attendance';
const MAX_IMAGES = 175; // Total images
const DISTANCE_IMAGES = 40; // 4 poses x 10 images each (FIRST)
const CLOSEUP_IMAGES = 135; // 9 poses x 15 images each (SECOND)
const CAPTURE_INTERVAL = 300;
const IMAGES_PER_CLOSEUP_POSE = 15; // Capture 15 images per closeup pose
const IMAGES_PER_DISTANCE_POSE = 10; // Capture 10 images per distance pose

const POSE_PROMPTS = [
    { text: '👀 Look straight', icon: '🎯', validation: 'straight' },
    { text: '👈 Turn left', icon: '↩️', validation: 'left' },
    { text: '👉 Turn right', icon: '↪️', validation: 'right' },
    { text: '👆 Look up', icon: '⬆️', validation: 'up' },
    { text: '👇 Look down', icon: '⬇️', validation: 'down' },
    { text: '😊 Smile!', icon: '😄', validation: 'any' },
    { text: '😐 Neutral', icon: '😐', validation: 'any' },
    { text: '🔄 Tilt left', icon: '↖️', validation: 'tilt-left' },
    { text: '🔄 Tilt right', icon: '↗️', validation: 'tilt-right' },
];

const DISTANCE_PROMPTS = [
    { text: '🚶 Step back 3-5 feet', icon: '↔️', validation: 'distance' },
    { text: '👀 Look straight (far)', icon: '🎯', validation: 'straight' },
    { text: '👈 Turn left (far)', icon: '↩️', validation: 'left' },
    { text: '👉 Turn right (far)', icon: '↪️', validation: 'right' },
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
    faceGuide: (capturePhase) => ({
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: capturePhase === 'distance' ? '40%' : '60%', // Smaller circle for distance
        maxWidth: capturePhase === 'distance' ? '140px' : '200px',
        aspectRatio: '3/4',
        border: `3px dashed ${capturePhase === 'distance' ? 'rgba(16,185,129,0.6)' : 'rgba(0,212,255,0.5)'}`,
        borderRadius: '50%',
        animation: 'facePulse 2s ease-in-out infinite'
    }),
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

// Pose Validation Helper Function
const validatePose = (landmarks, validationType, baseFaceSize = null, currentFaceSize = null) => {
    if (!landmarks) return false;

    // Calculate head pose angles from landmarks
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const jawline = landmarks.getJawOutline();

    if (!nose || !leftEye || !rightEye || !jawline) return false;

    // Calculate yaw (left/right rotation)
    const eyeCenter = [(leftEye[0].x + rightEye[3].x) / 2, (leftEye[0].y + rightEye[3].y) / 2];
    const noseCenter = [nose[3].x, nose[3].y];
    const yaw = (noseCenter[0] - eyeCenter[0]) * 0.5; // Rough yaw approximation

    // Calculate pitch (up/down)
    const noseTip = nose[3];
    const noseBridge = nose[0];
    const pitch = (noseTip.y - noseBridge.y) * 0.3; // Rough pitch approximation

    // Calculate roll (tilt)
    const eyeAngle = Math.atan2(rightEye[3].y - leftEye[0].y, rightEye[3].x - leftEye[0].x) * (180 / Math.PI);

    // Validation logic - TEMPORARILY DISABLED FOR TESTING (always returns true)
    // This ensures enrollment progresses smoothly
    return true; // TODO: Re-enable with better thresholds later

    /* Original validation - currently disabled
    switch (validationType) {
        case 'straight':
            return Math.abs(yaw) < 15 && Math.abs(pitch) < 15 && Math.abs(eyeAngle) < 15;
        case 'left':
            return yaw > 2; // Very lenient - slight movement triggers
        case 'right':
            return yaw < -2; // Very lenient
        case 'up':
            return pitch < -2; // Very lenient
        case 'down':
            return pitch > 2; // Very lenient - slight nod triggers
        case 'tilt-left':
            return eyeAngle > 3; // Very lenient
        case 'tilt-right':
            return eyeAngle < -3; // Very lenient
        case 'distance':
            // Check if face is smaller (user stepped back)
            if (!baseFaceSize || !currentFaceSize) return false;
            const sizeRatio = currentFaceSize / baseFaceSize;
            return sizeRatio < 0.75; // More lenient - 25% smaller
        case 'any':
            return true; // No specific pose required (smile, neutral)
        default:
            return false;
    }
    */
};

const EnrollEmployeePage = () => {
    const webcamRef = useRef(null);
    const captureIntervalRef = useRef(null);
    const baseFaceSizeRef = useRef(null); // Store initial face size for distance validation
    const poseHoldTimerRef = useRef(null); // Debounce pose validation

    const urlParams = new URLSearchParams(window.location.search);
    const urlOrgCode = urlParams.get('org')?.toUpperCase();
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8000/api/v1/detection'
        : '/api/v1/detection';
    const urlEmpId = urlParams.get('emp');

    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [capturedImages, setCapturedImages] = useState([]);
    const [capturedEmbeddings, setCapturedEmbeddings] = useState([]);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [currentPrompt, setCurrentPrompt] = useState(DISTANCE_PROMPTS[0]); // Start with distance
    const [promptIndex, setPromptIndex] = useState(0);
    const [step, setStep] = useState('select');
    const [status, setStatus] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [capturePhase, setCapturePhase] = useState('distance'); // Start with distance, then closeup
    const [poseValid, setPoseValid] = useState(false); // Track if current pose is valid
    const [validationMessage, setValidationMessage] = useState(''); // Feedback message
    const [poseImageCount, setPoseImageCount] = useState(0); // Images captured for current pose
    const [waitingForNext, setWaitingForNext] = useState(false); // Waiting for user to click next

    // Load face-api models
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Better for distant faces
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

    // No automatic prompt rotation - manual control only

    // Auto-capture with per-pose quota
    useEffect(() => {
        if (!isCapturing || waitingForNext || !modelsLoaded) return;

        const imagesPerPose = capturePhase === 'closeup' ? IMAGES_PER_CLOSEUP_POSE : IMAGES_PER_DISTANCE_POSE;

        // Check if quota reached
        if (poseImageCount >= imagesPerPose) {
            setIsCapturing(false);
            setWaitingForNext(true);
            setValidationMessage(`✅ Pose complete! Click "Next Pose"`);
            return;
        }

        captureIntervalRef.current = setInterval(async () => {
            if (!webcamRef.current) return;

            // Double-check quota hasn't been reached
            if (poseImageCount >= imagesPerPose) {
                clearInterval(captureIntervalRef.current);
                setIsCapturing(false);
                setWaitingForNext(true);
                return;
            }

            const img = webcamRef.current.getScreenshot();
            if (!img) return;

            try {
                const imgEl = document.createElement('img');
                imgEl.src = img;
                await new Promise(r => imgEl.onload = r);

                const det = await faceapi.detectSingleFace(
                    imgEl,
                    new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }) // Better distant detection
                ).withFaceLandmarks().withFaceDescriptor();

                if (det) {
                    const currentFaceSize = det.detection.box.width * det.detection.box.height;

                    // DISTANCE PHASE VALIDATION: Use absolute size threshold (no baseline yet)
                    if (capturePhase === 'distance') {
                        // Face should be VERY small (user at good distance)
                        // Typical closeup: 50000-80000 pixels
                        // Desired distance (5-7 feet): 8000-15000 pixels
                        const MAX_DISTANCE_FACE_SIZE = 12000; // VERY STRICT - must be far back

                        if (currentFaceSize > MAX_DISTANCE_FACE_SIZE) {
                            setPoseValid(false);
                            setValidationMessage(`🚶 STEP BACK MORE! (${Math.round(currentFaceSize)} > ${MAX_DISTANCE_FACE_SIZE})`);
                            return;
                        }

                        // Store base face size in DISTANCE phase (for later closeup validation)
                        if (!baseFaceSizeRef.current) {
                            baseFaceSizeRef.current = currentFaceSize;
                        }
                    }

                    // CLOSEUP VALIDATION: Face must be larger than distance baseline
                    if (capturePhase === 'closeup') {
                        if (!baseFaceSizeRef.current) {
                            setPoseValid(false);
                            setValidationMessage('⚠️ Error - please restart');
                            return;
                        }

                        const sizeRatio = currentFaceSize / baseFaceSizeRef.current;

                        // Face should be at least 40% larger (step closer)
                        if (sizeRatio < 1.4) {
                            setPoseValid(false);
                            setValidationMessage(`📍 Step closer! (${Math.round((sizeRatio - 1) * 100)}% of 40%)`);
                            return;
                        }
                    }

                    setPoseValid(true);
                    const nextCount = poseImageCount + 1;
                    setValidationMessage(`✓ Capturing... ${nextCount}/${imagesPerPose}`);

                    // Capture immediately
                    setCapturedImages(p => [...p, img]);
                    setCapturedEmbeddings(p => [...p, Array.from(det.descriptor)]);
                    setPoseImageCount(nextCount);
                } else {
                    setPoseValid(false);
                    setValidationMessage('⚠️ No face detected');
                }
            } catch (e) {
                console.error('Capture error:', e);
            }
        }, CAPTURE_INTERVAL);

        return () => {
            captureIntervalRef.current && clearInterval(captureIntervalRef.current);
        };
    }, [isCapturing, waitingForNext, modelsLoaded, poseImageCount, capturePhase]);

    useEffect(() => {
        if (capturedImages.length >= MAX_IMAGES) {
            setIsCapturing(false);
            captureIntervalRef.current && clearInterval(captureIntervalRef.current);
        }
    }, [capturedImages.length]);

    const base64ToBlob = async (b64) => (await fetch(b64)).blob();

    const startCapture = () => {
        setPoseImageCount(0); // Reset pose counter
        setWaitingForNext(false);
        setIsCapturing(true);
        setPoseValid(false);
        setValidationMessage('');
    };

    const nextPose = () => {
        // Move to next prompt
        const prompts = capturePhase === 'closeup' ? POSE_PROMPTS : DISTANCE_PROMPTS;
        const next = (promptIndex + 1) % prompts.length;

        // Check if we need to transition to closeup phase
        if (capturedImages.length >= DISTANCE_IMAGES && capturePhase === 'distance') {
            setCapturePhase('closeup');
            setPromptIndex(0);
            setCurrentPrompt(POSE_PROMPTS[0]);
            baseFaceSizeRef.current = null; // Reset base face size for distance
        } else {
            setPromptIndex(next);
            setCurrentPrompt(prompts[next]);
        }

        // Reset and start capturing for next pose
        setPoseImageCount(0);
        setWaitingForNext(false);
        setIsCapturing(true);
        setValidationMessage('');
    };

    const resetEnrollment = () => {
        setCapturedImages([]);
        setCapturedEmbeddings([]);
        setCapturePhase('distance'); // Reset to distance (start)
        baseFaceSizeRef.current = null;
        setPromptIndex(0);
        setCurrentPrompt(DISTANCE_PROMPTS[0]);
        setPoseImageCount(0);
        setWaitingForNext(false);
        setIsCapturing(false);
        setPoseValid(false);
        setValidationMessage('');
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
                            <div style={styles.faceGuide(capturePhase)}></div>
                            <div style={styles.cornerTL}></div>
                            <div style={styles.cornerTR}></div>
                            <div style={styles.cornerBL}></div>
                            <div style={styles.cornerBR}></div>
                        </div>

                        {/* Stats and Phase */}
                        <div style={styles.statsBadge}>
                            {capturePhase === 'closeup' ? '📷' : '🚶'} {capturedImages.length}
                            {capturePhase === 'distance' && <span style={{ marginLeft: '6px', opacity: 0.7 }}>/ Distance</span>}
                        </div>

                        {/* Phase Indicator */}
                        {isCapturing && (
                            <div style={{
                                position: 'absolute',
                                top: '12px',
                                left: '12px',
                                background: capturePhase === 'closeup' ? 'rgba(124,58,237,0.85)' : 'rgba(16,185,129,0.85)',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                border: `1px solid ${capturePhase === 'closeup' ? '#7c3aed' : '#10b981'}`,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Phase {capturePhase === 'distance' ? '1: Distance' : '2: Close-up'}
                            </div>
                        )}

                        {/* Validation Status */}
                        {isCapturing && validationMessage && (
                            <div style={{
                                position: 'absolute',
                                top: '50px',
                                left: '12px',
                                background: poseValid ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',
                                color: 'white',
                                padding: '8px 14px',
                                borderRadius: '10px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                border: `2px solid ${poseValid ? '#10b981' : '#ef4444'}`,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}>
                                {validationMessage}
                            </div>
                        )}

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
                        {waitingForNext ? (
                            <>
                                <button style={styles.btnPrimary} onClick={nextPose}>
                                    ▶️ Next Pose
                                </button>
                                {capturedImages.length >= 10 && (
                                    <button style={styles.btnSuccess} onClick={uploadImages}>
                                        ✅ Save ({capturedImages.length})
                                    </button>
                                )}
                            </>
                        ) : !isCapturing ? (
                            <>
                                <button style={styles.btnPrimary} onClick={startCapture} disabled={!modelsLoaded}>
                                    {modelsLoaded ? '📸 Capture' : '⏳ Loading...'}
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
                        <button style={styles.btnOutline} onClick={resetEnrollment}>
                            🔄 Reset
                        </button>
                    </div>

                    {status && <p style={{ textAlign: 'center', color: '#ef4444', marginTop: '12px', fontSize: '0.9rem' }}>{status}</p>}
                </div>
            </div>
        </div>
    );
};

export default EnrollEmployeePage;
