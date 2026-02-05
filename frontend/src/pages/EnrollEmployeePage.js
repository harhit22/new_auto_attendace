/**
 * Employee Face Enrollment Page - Professional Redesign
 * Light Theme, No Scroll, SVG Icons, Premium UX
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { speak } from '../utils/tts';

const API_BASE = '/api/v1/attendance';
const MAX_IMAGES = 50;
const CAPTURE_INTERVAL = 500;

// Professional SVG Icons
const Icons = {
    ArrowLeft: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>,
    ArrowRight: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>,
    ArrowUp: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>,
    ArrowDown: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></svg>,
    Target: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
    Smile: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>,
    ZoomIn: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>,
    ZoomOut: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>,
    Check: () => <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
    Camera: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
    User: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
};

// Prompts with Icons
const POSE_PROMPTS = [
    { hindi: 'सीधे देखें', english: 'Look Straight', icon: Icons.Target, duration: 3500, voice: 'Seedha dekho' },
    { hindi: 'बाएं घूमें', english: 'Turn Left', icon: Icons.ArrowLeft, duration: 3000, voice: 'Baayein ghumo' },
    { hindi: 'दाएं घूमें', english: 'Turn Right', icon: Icons.ArrowRight, duration: 3000, voice: 'Daayein ghumo' },
    { hindi: 'ऊपर देखें', english: 'Look Up', icon: Icons.ArrowUp, duration: 2500, voice: 'Upar dekho' },
    { hindi: 'नीचे देखें', english: 'Look Down', icon: Icons.ArrowDown, duration: 2500, voice: 'Neeche dekho' },
    { hindi: 'थोड़ा हंसें', english: 'Smile', icon: Icons.Smile, duration: 2500, voice: 'Thoda hanso' },
    { hindi: 'कैमरा दूर करें', english: 'Move Back', icon: Icons.ZoomOut, duration: 3000, voice: 'Camera ko dur karo' },
    { hindi: 'कैमरा पास लाएं', english: 'Move Closer', icon: Icons.ZoomIn, duration: 3000, voice: 'Camera ko paas laao' },
    { hindi: 'बहुत अच्छा!', english: 'Perfect!', icon: Icons.Check, duration: 2000, voice: 'Bahut accha! Seedha dekho' },
];

const EnrollEmployeePage = () => {
    const webcamRef = useRef(null);
    const captureIntervalRef = useRef(null);
    const uploadingRef = useRef(false);

    const urlParams = new URLSearchParams(window.location.search);
    const urlOrgCode = urlParams.get('org')?.toUpperCase();
    const urlEmpId = urlParams.get('emp');

    const [selectedOrg, setSelectedOrg] = useState(null);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [capturedImages, setCapturedImages] = useState([]);
    const [capturedEmbeddings, setCapturedEmbeddings] = useState([]);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
    const [step, setStep] = useState('loading');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState('');

    const [faceDetected, setFaceDetected] = useState(false);
    const [flashEffect, setFlashEffect] = useState(false);

    // Video Upload States
    const [captureMode, setCaptureMode] = useState('webcam'); // 'webcam' or 'video'
    const [uploadedVideoFile, setUploadedVideoFile] = useState(null);
    const [extractedFrames, setExtractedFrames] = useState([]);
    const [selectedFrames, setSelectedFrames] = useState([]);
    const [extractionProgress, setExtractionProgress] = useState(0);

    // Load face-api models & Data
    useEffect(() => {
        const init = async () => {
            try {
                // Models
                const MODEL_URL = '/models';
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                setModelsLoaded(true);

                // Data
                if (!urlOrgCode || !urlEmpId) throw new Error('Invalid Link');
                const orgsRes = await fetch(`${API_BASE}/organizations/`);
                const orgsData = await orgsRes.json();
                const org = orgsData.organizations?.find(o => o.org_code === urlOrgCode);
                if (!org) throw new Error('Organization not found');
                setSelectedOrg(org);

                const empRes = await fetch(`${API_BASE}/employees/?organization_id=${org.id}`);
                const empData = await empRes.json();
                // Case-insensitive comparison + trim whitespace to handle URL/DB mismatches
                const normalizedUrlEmpId = urlEmpId?.trim().toLowerCase();
                const emp = empData.employees?.find(e =>
                    e.employee_id?.trim().toLowerCase() === normalizedUrlEmpId
                );
                if (!emp) {
                    console.error('Employee not found. URL emp:', urlEmpId, 'Available:', empData.employees?.map(e => e.employee_id));
                    throw new Error('Employee not found');
                }
                setSelectedEmployee(emp);
                setStep('ready');

            } catch (e) {
                setError(e.message || 'Error loading data');
            }
        };
        init();
    }, [urlOrgCode, urlEmpId]);

    // Prompts Manager
    useEffect(() => {
        if (!isCapturing) return;
        const prompt = POSE_PROMPTS[currentPromptIndex];
        speak(prompt.voice);
        const timer = setTimeout(() => {
            const next = (currentPromptIndex + 1) % POSE_PROMPTS.length;
            setCurrentPromptIndex(next);
        }, prompt.duration);
        return () => clearTimeout(timer);
    }, [isCapturing, currentPromptIndex]);

    // Capture Logic
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
                        setFaceDetected(true);
                        setCapturedImages(p => p.length >= MAX_IMAGES ? p : [...p, img]);
                        setCapturedEmbeddings(p => [...p, Array.from(det.descriptor)]);
                        setFlashEffect(true);
                        setTimeout(() => setFlashEffect(false), 100);
                    } else {
                        setFaceDetected(false);
                    }
                } catch (e) {
                    setFaceDetected(false);
                }
            }, CAPTURE_INTERVAL);
        }
        return () => captureIntervalRef.current && clearInterval(captureIntervalRef.current);
    }, [isCapturing, modelsLoaded, capturedImages.length]);

    // Upload Logic
    const uploadImages = useCallback(async (imagesOverride = null, embeddingsOverride = null) => {
        if (uploadingRef.current) return;
        uploadingRef.current = true;

        // Use overrides if provided, otherwise fallback to state
        const imagesToUpload = imagesOverride || capturedImages;
        const embeddingsToUpload = embeddingsOverride || capturedEmbeddings;

        speak('Photo ho gayi. Upload ho raha hai.');
        setStep('uploading');
        setUploadProgress(0);

        try {
            const batchSize = 10;
            let totalProcessed = 0;

            for (let i = 0; i < imagesToUpload.length; i += batchSize) {
                const batchImgs = imagesToUpload.slice(i, i + batchSize);
                const batchEmbs = embeddingsToUpload.slice(i, i + batchSize);
                const formData = new FormData();
                formData.append('org_code', selectedOrg.org_code);
                formData.append('employee_id', selectedEmployee.employee_id);
                formData.append('light_embeddings', JSON.stringify(batchEmbs));

                for (let j = 0; j < batchImgs.length; j++) {
                    const blob = await (await fetch(batchImgs[j])).blob();
                    formData.append('images', blob, `f_${i + j}.jpg`);
                    totalProcessed++;
                    setUploadProgress(Math.round((totalProcessed / imagesToUpload.length) * 80));
                }

                const res = await fetch(`${API_BASE}/capture-images/`, { method: 'POST', body: formData });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const debugInfo = `(Org: ${selectedOrg?.org_code || 'null'}, Emp: ${selectedEmployee?.employee_id || 'null'})`;
                    throw new Error(`${errData.error || 'Upload Failed'} ${debugInfo}`);
                }

                // Update progress after successful batch upload
                const currentBatchEnd = Math.min(i + batchSize, imagesToUpload.length);
                const uploadPartProgress = Math.round((currentBatchEnd / imagesToUpload.length) * 20);
                setUploadProgress(80 + uploadPartProgress);
            }

            speak('Safal! Photo save ho gayi.');
            setStep('success');
        } catch (e) {
            console.error("Upload error:", e);
            speak('Upload fail ho gaya. ' + (e.message || ''));
            setError(e.message || 'Upload Failed. Please try again.');
            setStep('ready');
        }
        uploadingRef.current = false;
    }, [capturedImages, capturedEmbeddings, selectedOrg, selectedEmployee]);

    useEffect(() => {
        if (capturedImages.length >= MAX_IMAGES && isCapturing) {
            setIsCapturing(false);
            captureIntervalRef.current && clearInterval(captureIntervalRef.current);
            uploadImages();
        }
    }, [capturedImages.length, isCapturing, uploadImages]);

    // Trigger upload for video frames when step is set to 'uploading'
    useEffect(() => {
        if (step === 'uploading' && capturedImages.length > 0 && !uploadingRef.current) {
            uploadImages();
        }
    }, [step, capturedImages.length, uploadImages]);

    const startCapture = () => {
        setCapturedImages([]);
        setCapturedEmbeddings([]);
        setCurrentPromptIndex(0);
        setIsCapturing(true);
        setError('');
        speak('Shuru ho raha hai. Seedha dekho.');
    };

    // Video Upload Handler
    const handleVideoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadedVideoFile(file);
        setStep('extracting');
        setExtractionProgress(0);

        try {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto'; // Ensure metadata loads

            // Wait for metadata with timeout
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
                video.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                video.onerror = (e) => {
                    clearTimeout(timeout);
                    reject(new Error('Video load failed'));
                };
            });

            if (!Number.isFinite(video.duration) || video.duration <= 0) {
                throw new Error('Invalid video duration');
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Use native video size (or cap max dimension to 1280 to save bandwidth)
            const MAX_DIM = 1280;
            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > MAX_DIM || height > MAX_DIM) {
                const ratio = width / height;
                if (width > height) {
                    width = MAX_DIM;
                    height = MAX_DIM / ratio;
                } else {
                    height = MAX_DIM;
                    width = MAX_DIM * ratio;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const frames = [];
            const interval = 0.5; // Slightly slower interval (500ms) for better stability
            const duration = Math.min(video.duration, 60); // Cap at 60 seconds
            let currentTime = 0;

            while (currentTime < duration && frames.length < 100) {
                video.currentTime = currentTime;

                // Seek with timeout safety
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => resolve(), 1000); // Force continue after 1s
                    video.onseeked = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                });

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.95));

                currentTime += interval;
                setExtractionProgress(Math.round((currentTime / duration) * 100));
            }

            URL.revokeObjectURL(video.src);

            if (frames.length === 0) {
                throw new Error('No frames extracted');
            }

            setSelectedFrames(frames);
            setExtractedFrames(frames);
            setStep('frame_selection');
        } catch (err) {
            console.error('Extraction Error:', err);
            setError('Found error extracting frames: ' + err.message);
            setStep('ready');
        }
    };

    const deleteFrame = (index) => {
        setSelectedFrames(prev => prev.filter((_, i) => i !== index));
    };

    const processSelectedFrames = async () => {
        if (selectedFrames.length === 0) {
            setError('No frames selected');
            return;
        }

        setStep('processing');
        setUploadProgress(0);

        try {
            // SKIP Face detection as requested - Upload ALL selected frames directly
            const framesToUpload = selectedFrames;
            const embeddingsToUpload = []; // No client-side embeddings

            // Calculate progress for "preparing" phase
            setUploadProgress(100);

            // Correctly triggered upload using shared function
            setCapturedImages(framesToUpload);
            setCapturedEmbeddings([]); // Empty embeddings as we skipped detection

            // Wait for a tick to allow state to settle, then call upload with explicit data
            // Passing data directly guarantees we don't rely on stale state
            await uploadImages(framesToUpload, embeddingsToUpload);
            return;



        } catch (err) {
            console.error('Error:', err);
            setError(err.message || 'Failed');
            setStep('frame_selection');
        }
    };

    const progress = (capturedImages.length / MAX_IMAGES) * 100;
    const CurrentIcon = POSE_PROMPTS[currentPromptIndex].icon;

    // --- STYLES (Light Theme, Professional) ---
    const styles = {
        container: {
            height: '100vh',
            width: '100vw',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            color: '#1e293b'
        },
        header: {
            padding: '12px 16px',
            background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10
        },
        headerInfo: {
            display: 'flex',
            flexDirection: 'column'
        },
        empName: {
            fontWeight: '600',
            fontSize: '1rem',
            color: '#0f172a'
        },
        orgName: {
            fontSize: '0.8rem',
            color: '#64748b'
        },
        statusBadge: {
            fontSize: '0.75rem',
            padding: '4px 10px',
            borderRadius: '20px',
            background: faceDetected ? '#d1fae5' : '#f1f5f9',
            color: faceDetected ? '#059669' : '#64748b',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        },
        progressBar: {
            height: '4px',
            width: '100%',
            background: '#f1f5f9'
        },
        progressFill: {
            height: '100%',
            background: '#2563eb',
            transition: 'width 0.3s ease'
        },
        mainContent: {
            flex: 1,
            position: 'relative',
            background: '#000',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        webcam: {
            width: '100%',
            height: '100%',
            objectFit: 'cover'
        },
        guidelineFrame: {
            position: 'absolute',
            top: '15%',
            left: '15%',
            right: '15%',
            bottom: '25%',
            border: faceDetected ? '2px solid rgba(16, 185, 129, 0.5)' : '2px dashed rgba(255, 255, 255, 0.3)',
            borderRadius: '24px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)', // Dim outside area
            pointerEvents: 'none',
            transition: 'border-color 0.3s'
        },
        promptContainer: {
            position: 'absolute',
            bottom: '24px',
            left: '0',
            right: '0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            color: 'white',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        },
        promptIcon: {
            marginBottom: '8px',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
        },
        prompTextHi: {
            fontSize: '1.75rem',
            fontWeight: '700',
            marginBottom: '4px'
        },
        promptTextEn: {
            fontSize: '0.9rem',
            opacity: 0.8,
            fontWeight: '500'
        },
        footer: {
            padding: '16px',
            background: '#fff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        },
        startButton: {
            width: '100%',
            maxWidth: '400px',
            height: '56px',
            borderRadius: '12px',
            border: 'none',
            background: '#2563eb',
            color: 'white',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
        },
        flash: {
            position: 'absolute',
            inset: 0,
            background: 'white',
            opacity: flashEffect ? 0.6 : 0,
            pointerEvents: 'none',
            transition: 'opacity 0.1s'
        },
        fullscreenCenter: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '24px',
            textAlign: 'center'
        }
    };

    // --- RENDER STATES ---

    if (step === 'loading') {
        return (
            <div style={styles.container}>
                <div style={styles.fullscreenCenter}>
                    <div className="spinner" style={{
                        width: '40px', height: '40px',
                        border: '3px solid #e2e8f0',
                        borderTop: '3px solid #2563eb',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <h3 style={{ marginTop: '20px', color: '#334155' }}>कृपया प्रतीक्षा करें...</h3>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            </div>
        );
    }

    if (step === 'uploading') {
        return (
            <div style={styles.container}>
                <div style={styles.fullscreenCenter}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>अपलोड हो रहा है</h2>
                    <p style={{ color: '#64748b', marginBottom: '32px' }}>कृपया पेज बंद न करें</p>

                    <div style={{ width: '100%', maxWidth: '300px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ marginTop: '12px', fontWeight: '600', color: '#2563eb' }}>{uploadProgress}%</p>
                </div>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div style={styles.container}>
                <div style={styles.fullscreenCenter}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
                    <h3 style={{ color: '#dc2626', marginBottom: '8px' }}>Error</h3>
                    <p style={{ color: '#64748b' }}>{error || 'Something went wrong'}</p>
                </div>
            </div>
        );
    }

    // Video Upload: Extracting Frames
    if (step === 'extracting') {
        return (
            <div style={styles.container}>
                <div style={styles.fullscreenCenter}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎬</div>
                    <h3 style={{ color: '#334155', marginBottom: ' 8px' }}>Extracting Frames...</h3>
                    <div style={{ width: '300px', background: '#e2e8f0', borderRadius: '8px', height: '8px', overflow: 'hidden', marginTop: '16px' }}>
                        <div style={{ width: `${extractionProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ color: '#64748b', marginTop: '8px' }}>{extractionProgress}%</p>
                </div>
            </div>
        );
    }

    // Video Upload: Frame Selection Gallery
    if (step === 'frame_selection') {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <div style={styles.headerInfo}>
                        <span style={styles.empName}>{selectedEmployee?.name || 'Employee'}</span>
                        <span style={styles.orgName}>Select frames to process ({selectedFrames.length} selected)</span>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                        {selectedFrames.map((frame, idx) => (
                            <div key={idx} style={{ position: 'relative' }}>
                                <img src={frame} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: '8px', background: '#f1f5f9' }} />
                                <button
                                    onClick={() => deleteFrame(idx)}
                                    style={{
                                        position: 'absolute', top: '4px', right: '4px',
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: '#ef4444', color: 'white', border: 'none',
                                        cursor: 'pointer', fontSize: '14px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                        onClick={processSelectedFrames}
                        disabled={selectedFrames.length === 0}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '8px',
                            background: selectedFrames.length > 0 ? '#2563eb' : '#cbd5e1',
                            color: 'white', border: 'none', fontSize: '1rem', fontWeight: '600',
                            cursor: selectedFrames.length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        Process & Upload ({selectedFrames.length} frames)
                    </button>
                </div>
            </div>
        );
    }

    // Video Upload: Processing with Face Detection
    if (step === 'processing') {
        return (
            <div style={styles.container}>
                <div style={styles.fullscreenCenter}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                    <h3 style={{ color: '#334155', marginBottom: '8px' }}>Detecting Faces...</h3>
                    <div style={{ width: '300px', background: '#e2e8f0', borderRadius: '8px', height: '8px', overflow: 'hidden', marginTop: '16px' }}>
                        <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#10b981', transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ color: '#64748b', marginTop: '8px' }}>{uploadProgress}%</p>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div style={styles.container}>
                <div style={styles.fullscreenCenter}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
                    <h3 style={{ color: '#059669', marginBottom: '8px' }}>पूर्ण! (Complete!)</h3>
                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                        Face data uploaded for{' '}
                        <b>{selectedEmployee?.name}</b>
                    </p>
                    <div style={{ padding: '12px 24px', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontSize: '0.9rem' }}>
                        अब आप यह पेज बंद कर सकते हैं
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN CAPTURE UI ---

    return (
        <div style={styles.container}>
            {/* Top Progress Bar */}
            <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }}></div>
            </div>

            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerInfo}>
                    <span style={styles.empName}>{selectedEmployee?.name || 'Employee'}</span>
                    <span style={styles.orgName}>{selectedOrg?.name || 'Organization'}</span>
                </div>
                {/* Status Badge */}
                {isCapturing && (
                    <div style={styles.statusBadge}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: faceDetected ? '#10b981' : '#cbd5e1' }} />
                        {faceDetected ? 'Face Detected' : 'No Face'}
                    </div>
                )}
            </div>

            {/* Main Webcam Area */}
            <div style={styles.mainContent}>
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.8}
                    videoConstraints={{ facingMode: 'user', height: 720 }}
                    style={styles.webcam}
                    mirrored={true}
                />

                {/* Overlays */}
                <div style={styles.flash}></div>
                {isCapturing && <div style={styles.guidelineFrame}></div>}

                {/* Prompts (Only visible when capturing) */}
                {isCapturing && (
                    <div style={styles.promptContainer}>
                        <div style={styles.promptIcon}>
                            <CurrentIcon />
                        </div>
                        <div style={styles.prompTextHi}>{POSE_PROMPTS[currentPromptIndex].hindi}</div>
                        <div style={styles.promptTextEn}>{POSE_PROMPTS[currentPromptIndex].english}</div>
                    </div>
                )}
            </div>

            {/* Footer / Controls */}
            {!isCapturing && (
                <div style={styles.footer}>
                    {/* Mode Toggle */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
                        <button
                            onClick={() => setCaptureMode('webcam')}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                background: captureMode === 'webcam' ? '#2563eb' : 'white',
                                color: captureMode === 'webcam' ? 'white' : '#64748b',
                                fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem'
                            }}
                        >
                            📷 Live Webcam
                        </button>
                        <button
                            onClick={() => setCaptureMode('video')}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0',
                                background: captureMode === 'video' ? '#2563eb' : 'white',
                                color: captureMode === 'video' ? 'white' : '#64748b',
                                fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem'
                            }}
                        >
                            🎬 Upload Video
                        </button>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div style={{
                            padding: '12px',
                            marginBottom: '16px',
                            background: '#fee2e2',
                            border: '1px solid #ef4444',
                            borderRadius: '8px',
                            color: '#b91c1c',
                            width: '100%',
                            textAlign: 'center',
                            fontWeight: '500'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Webcam Mode Button */}
                    {captureMode === 'webcam' && (
                        <>
                            <button onClick={startCapture} style={styles.startButton} disabled={!modelsLoaded}>
                                <Icons.Camera />
                                {modelsLoaded ? 'शुरू करें (Start)' : 'Loading Camera...'}
                            </button>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '16px', textAlign: 'center' }}>
                                Ensure good lighting and remove glasses
                            </p>
                        </>
                    )}

                    {/* Video Upload Mode Button */}
                    {captureMode === 'video' && (
                        <>
                            <input
                                type="file"
                                accept="video/*"
                                onChange={handleVideoUpload}
                                id="video-upload"
                                style={{ display: 'none' }}
                            />
                            <button
                                onClick={() => document.getElementById('video-upload').click()}
                                style={styles.startButton}
                                disabled={!modelsLoaded}
                            >
                                <Icons.Camera />
                                {modelsLoaded ? 'Select Video File' : 'Loading...'}
                            </button>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '16px', textAlign: 'center' }}>
                                Upload a short video (30-60 seconds)
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default EnrollEmployeePage;
