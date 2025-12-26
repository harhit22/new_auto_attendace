/**
 * Employee Self-Enrollment Page - Auto Capture Mode
 * 
 * Simple URL: /enroll-face?org=ACME&emp=EMP001
 * 
 * Features:
 * - Auto-captures images continuously every 200ms
 * - Shows pose prompts (look left, right, up, down, smile, etc.)
 * - Stops at 1000 images
 * - Fast batch upload
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

const API_BASE = 'http://localhost:8000/api/v1/attendance';
const MAX_IMAGES = 1000;
const CAPTURE_INTERVAL = 200; // ms between captures

// Pose prompts to guide user
const POSE_PROMPTS = [
    { text: '👀 Look straight at camera', duration: 5000 },
    { text: '👈 Turn head LEFT slowly', duration: 4000 },
    { text: '👉 Turn head RIGHT slowly', duration: 4000 },
    { text: '👆 Look UP slightly', duration: 3000 },
    { text: '👇 Look DOWN slightly', duration: 3000 },
    { text: '😊 SMILE!', duration: 3000 },
    { text: '😐 Neutral face', duration: 3000 },
    { text: '🤨 Raise eyebrows', duration: 2000 },
    { text: '😑 Squint eyes slightly', duration: 2000 },
    { text: '🔄 Tilt head LEFT', duration: 3000 },
    { text: '🔄 Tilt head RIGHT', duration: 3000 },
    { text: '📱 Move CLOSER to camera', duration: 3000 },
    { text: '📱 Move BACK from camera', duration: 3000 },
    { text: '💡 Keep going! Great job!', duration: 3000 },
];

const SelfEnrollPage = () => {
    const webcamRef = useRef(null);
    const captureIntervalRef = useRef(null);

    // Get params from URL
    const params = new URLSearchParams(window.location.search);
    const orgCode = params.get('org')?.toUpperCase() || '';
    const employeeId = params.get('emp') || '';

    const [step, setStep] = useState('loading'); // loading, capture, uploading, success, error
    const [employee, setEmployee] = useState(null);
    const [org, setOrg] = useState(null);
    const [capturedImages, setCapturedImages] = useState([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [currentPrompt, setCurrentPrompt] = useState(POSE_PROMPTS[0]);
    const [promptIndex, setPromptIndex] = useState(0);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');

    // Verify employee on load
    useEffect(() => {
        if (!orgCode || !employeeId) {
            setErrorMessage('Invalid link. Ask your admin for the correct enrollment link.');
            setStep('error');
            return;
        }
        verifyEmployee();
    }, []);

    // Rotate pose prompts
    useEffect(() => {
        if (!isCapturing) return;

        const timer = setTimeout(() => {
            const nextIndex = (promptIndex + 1) % POSE_PROMPTS.length;
            setPromptIndex(nextIndex);
            setCurrentPrompt(POSE_PROMPTS[nextIndex]);
        }, currentPrompt.duration);

        return () => clearTimeout(timer);
    }, [isCapturing, promptIndex, currentPrompt]);

    // Auto-capture loop
    useEffect(() => {
        if (isCapturing && capturedImages.length < MAX_IMAGES) {
            captureIntervalRef.current = setInterval(() => {
                if (webcamRef.current) {
                    const img = webcamRef.current.getScreenshot();
                    if (img) {
                        setCapturedImages(prev => {
                            if (prev.length >= MAX_IMAGES) {
                                clearInterval(captureIntervalRef.current);
                                setIsCapturing(false);
                                return prev;
                            }
                            return [...prev, img];
                        });
                    }
                }
            }, CAPTURE_INTERVAL);
        }

        return () => {
            if (captureIntervalRef.current) {
                clearInterval(captureIntervalRef.current);
            }
        };
    }, [isCapturing]);

    // Auto-stop at max images
    useEffect(() => {
        if (capturedImages.length >= MAX_IMAGES) {
            setIsCapturing(false);
            if (captureIntervalRef.current) {
                clearInterval(captureIntervalRef.current);
            }
        }
    }, [capturedImages.length]);

    const verifyEmployee = async () => {
        try {
            const res = await fetch(`${API_BASE}/verify-employee/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: orgCode, employee_id: employeeId })
            });

            const data = await res.json();

            if (res.ok && data.success && data.employee) {
                setEmployee(data.employee);
                setOrg(data.organization);
                setStep('capture');
            } else {
                // Handle error - don't set employee to error object
                const errorMsg = typeof data.error === 'string'
                    ? data.error
                    : (data.message || 'Employee not found. Check with your admin.');
                setErrorMessage(errorMsg);
                setStep('error');
            }
        } catch (e) {
            setErrorMessage('Cannot connect to server. Please try again.');
            setStep('error');
        }
    };

    const base64ToBlob = async (base64) => {
        const res = await fetch(base64);
        return await res.blob();
    };

    const startCapture = () => {
        setCapturedImages([]);
        setIsCapturing(true);
        setPromptIndex(0);
        setCurrentPrompt(POSE_PROMPTS[0]);
    };

    const stopCapture = () => {
        setIsCapturing(false);
        if (captureIntervalRef.current) {
            clearInterval(captureIntervalRef.current);
        }
    };

    const uploadImages = async () => {
        if (capturedImages.length < 10) {
            alert('Capture at least 10 images first!');
            return;
        }

        setStep('uploading');
        setUploadProgress(0);

        try {
            // Upload in batches of 50 to avoid timeout
            const batchSize = 50;
            let uploaded = 0;

            for (let i = 0; i < capturedImages.length; i += batchSize) {
                const batch = capturedImages.slice(i, i + batchSize);
                const formData = new FormData();
                formData.append('org_code', orgCode);
                formData.append('employee_id', employeeId);

                for (let j = 0; j < batch.length; j++) {
                    const blob = await base64ToBlob(batch[j]);
                    formData.append('images', blob, `face_${i + j}.jpg`);
                }

                const res = await fetch(`${API_BASE}/capture-images/`, {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Upload failed');
                }

                uploaded += batch.length;
                setUploadProgress(Math.round((uploaded / capturedImages.length) * 100));
            }

            setStep('success');
        } catch (e) {
            setErrorMessage(`Upload failed: ${e.message}`);
            setStep('error');
        }
    };

    // LOADING
    if (step === 'loading') {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 20px', borderTopColor: 'white' }}></div>
                    <p>Verifying your information...</p>
                </div>
            </div>
        );
    }

    // ERROR
    if (step === 'error') {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}>
                <div className="card" style={{ maxWidth: '450px', textAlign: 'center', padding: '50px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>❌</div>
                    <h2 style={{ marginBottom: '16px', color: 'var(--error)' }}>Error</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>{errorMessage}</p>
                    <a href="/" className="btn btn-outline">← Go Home</a>
                </div>
            </div>
        );
    }

    // UPLOADING
    if (step === 'uploading') {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                color: 'white'
            }}>
                <div className="card" style={{ maxWidth: '450px', textAlign: 'center', padding: '50px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📤</div>
                    <h2 style={{ marginBottom: '16px' }}>Uploading {capturedImages.length} Images...</h2>
                    <div style={{
                        background: 'var(--bg-soft)',
                        borderRadius: '50px',
                        height: '20px',
                        overflow: 'hidden',
                        marginBottom: '16px'
                    }}>
                        <div style={{
                            background: 'var(--primary)',
                            height: '100%',
                            width: `${uploadProgress}%`,
                            transition: 'width 0.3s ease',
                            borderRadius: '50px'
                        }}></div>
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>{uploadProgress}% complete</p>
                </div>
            </div>
        );
    }

    // SUCCESS
    if (step === 'success') {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}>
                <div className="card" style={{ maxWidth: '450px', textAlign: 'center', padding: '50px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✅</div>
                    <h2 style={{ marginBottom: '16px', color: 'var(--success)' }}>Images Saved!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        {capturedImages.length} photos uploaded successfully!
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '30px' }}>
                        Your admin will train the model and notify you when face recognition is ready.
                    </p>
                    <a href="/" className="btn btn-success">Done</a>
                </div>
            </div>
        );
    }

    // CAPTURE MODE
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px'
        }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', color: 'white', marginBottom: '20px' }}>
                    <h1 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>
                        👋 Hi, {employee?.name}!
                    </h1>
                    <p style={{ opacity: 0.9 }}>{org?.name} • Face Registration</p>
                </div>

                {/* Main Card */}
                <div className="card" style={{ padding: '30px' }}>
                    {/* Webcam */}
                    <div style={{
                        borderRadius: '16px',
                        overflow: 'hidden',
                        marginBottom: '20px',
                        position: 'relative'
                    }}>
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            screenshotQuality={0.8}
                            videoConstraints={{
                                width: 640,
                                height: 480,
                                facingMode: 'user',
                                frameRate: 30
                            }}
                            style={{ width: '100%', display: 'block' }}
                            mirrored={true}
                        />

                        {/* Pose Prompt Overlay */}
                        {isCapturing && (
                            <div style={{
                                position: 'absolute',
                                bottom: '20px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'rgba(0,0,0,0.8)',
                                color: 'white',
                                padding: '16px 32px',
                                borderRadius: '50px',
                                fontSize: '1.3rem',
                                fontWeight: '600',
                                animation: 'pulse 1s infinite'
                            }}>
                                {currentPrompt.text}
                            </div>
                        )}

                        {/* Counter Overlay */}
                        <div style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'rgba(0,0,0,0.8)',
                            color: 'white',
                            padding: '12px 20px',
                            borderRadius: '12px',
                            fontSize: '1.5rem',
                            fontWeight: '800'
                        }}>
                            📷 {capturedImages.length} / {MAX_IMAGES}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                        background: 'var(--bg-soft)',
                        borderRadius: '50px',
                        height: '12px',
                        overflow: 'hidden',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            background: capturedImages.length >= MAX_IMAGES ? 'var(--success)' : 'var(--primary)',
                            height: '100%',
                            width: `${(capturedImages.length / MAX_IMAGES) * 100}%`,
                            transition: 'width 0.1s ease',
                            borderRadius: '50px'
                        }}></div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        {!isCapturing ? (
                            <>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={startCapture}
                                    style={{ minWidth: '200px' }}
                                >
                                    🎬 Start Auto-Capture
                                </button>
                                {capturedImages.length >= 10 && (
                                    <button
                                        className="btn btn-success btn-lg"
                                        onClick={uploadImages}
                                    >
                                        ✅ Save {capturedImages.length} Images
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                className="btn btn-outline btn-lg"
                                onClick={stopCapture}
                                style={{ minWidth: '200px' }}
                            >
                                ⏹️ Stop Capture
                            </button>
                        )}
                    </div>

                    {/* Instructions */}
                    <div style={{
                        marginTop: '24px',
                        padding: '20px',
                        background: 'var(--bg-soft)',
                        borderRadius: '12px',
                        textAlign: 'center'
                    }}>
                        <p style={{ fontWeight: '600', marginBottom: '12px' }}>📋 Instructions:</p>
                        <ul style={{
                            textAlign: 'left',
                            display: 'inline-block',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem',
                            lineHeight: '1.8'
                        }}>
                            <li>Click <strong>Start Auto-Capture</strong> to begin</li>
                            <li>Follow the on-screen prompts (turn head, smile, etc.)</li>
                            <li>Move naturally - different angles help accuracy!</li>
                            <li>Capture stops automatically at {MAX_IMAGES} images</li>
                            <li>Click <strong>Save</strong> when done</li>
                        </ul>
                    </div>
                </div>

                {/* Tips */}
                <div style={{
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.8)',
                    marginTop: '20px',
                    fontSize: '0.9rem'
                }}>
                    💡 Tip: Good lighting and varied poses = better recognition accuracy!
                </div>
            </div>

            {/* Pulse Animation CSS */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
};

export default SelfEnrollPage;
