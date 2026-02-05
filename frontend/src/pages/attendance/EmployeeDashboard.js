/**
 * Employee Dashboard Page
 * Shows employee's attendance history, today's status, and enrollment options
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { speak } from '../../utils/tts';  // Cross-platform TTS

const API_BASE = '/api/v1/attendance';


// Hindi Messages
const HINDI = {
    welcome: 'स्वागत है',
    dutyIn: 'Duty शुरू करें',
    dutyOut: 'Duty खत्म करें',
    logout: 'बाहर जाएं',
    scanFace: 'अपना चेहरा दिखाएं',
    scanning: 'चेहरा स्कैन हो रहा है...',
    faceDetected: 'चेहरा मिल गया! जांच हो रही है...',
    turnHead: 'Chehra mil gaya. Ab gardan ko dheere se dayein baayein ghumayein.',
    success: 'आपकी duty दर्ज कर ली गई है!',
    noFace: 'चेहरा नहीं मिला। कृपया कैमरे की ओर देखें।',
    error: 'कुछ गड़बड़ हो गई',
    cancel: 'रद्द करें',
    dutyStart: 'DUTY शुरू',
    dutyEnd: 'DUTY खत्म',
    voiceCheckin: 'Driver, apna chehra dikhaye',
    voiceCheckout: 'Checkout ke liye chehra dikhaye',
    voiceSuccess: 'Aapki duty darj kar li gayi hai',
    voiceSuccessOut: 'Checkout ho gaya. Dhanyavaad.',
    // Specific error messages
    turnHeadError: 'Please turn your head slightly',
    rigidEyes: 'Fake eyes detected'
};

// Debug logging
console.log('[EmployeeDashboard] API_BASE:', API_BASE);

const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const [employee, setEmployee] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Face check-in state
    const [showCheckin, setShowCheckin] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [checkinStatus, setCheckinStatus] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [checkinAction, setCheckinAction] = useState('checkin');
    const [flashActive, setFlashActive] = useState(false); // Active flash for liveness

    useEffect(() => {
        const storedEmployee = sessionStorage.getItem('employee');
        if (!storedEmployee) {
            navigate('/employee/login');
            return;
        }

        const emp = JSON.parse(storedEmployee);
        setEmployee(emp);
        loadDashboard(emp);
    }, []);

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
                console.error('Failed to load face models:', e);
            }
        };
        if (showCheckin) loadModels();
    }, [showCheckin]);

    // State to store GPS coordinates (captured early when camera opens)
    const [gpsLocation, setGpsLocation] = useState({ latitude: null, longitude: null });

    // Capture GPS as soon as camera opens (before face detection)
    useEffect(() => {
        if (!showCheckin) return;

        // Start GPS capture immediately when camera opens
        if ('geolocation' in navigator) {
            console.log('[GPS] Starting early capture...');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('[GPS] Early capture success:', position.coords.latitude, position.coords.longitude);
                    setGpsLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn('[GPS] Early capture failed:', error.message);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,  // 15 seconds - plenty of time
                    maximumAge: 30000  // Cache for 30 seconds
                }
            );
        }
    }, [showCheckin]);

    // Auto-detect face and submit when detected
    // ONLY starts when GPS is ready (gpsLocation is set)
    useEffect(() => {
        // Wait for GPS before starting face detection
        if (!showCheckin || !modelsLoaded || isVerifying) return;

        // If GPS not ready, show waiting message
        if (!gpsLocation.latitude || !gpsLocation.longitude) {
            setCheckinStatus('📍 Location ढूंढ रहे हैं...');
            return; // Don't start face detection until GPS is ready
        }

        let isMounted = true;
        let timeoutId;

        const detectAndSubmit = async () => {
            if (!isMounted || !webcamRef.current || isVerifying) return;

            try {
                const screenshot = webcamRef.current.getScreenshot();
                if (!screenshot) {
                    timeoutId = setTimeout(detectAndSubmit, 500);
                    return;
                }

                // Create image element for face detection
                const imgElement = document.createElement('img');
                imgElement.src = screenshot;
                await new Promise(r => imgElement.onload = r);

                // Simple face detection without landmarks
                const detection = await faceapi
                    .detectSingleFace(imgElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }));

                if (detection && isMounted) {

                    // Face detected! Auto-submit
                    setCheckinStatus(HINDI.faceDetected);
                    speak('Chehra mil gaya, jaanch ho rahi hai');
                    verifyAndCheckin();
                } else if (isMounted) {
                    // No face detected, continue scanning
                    setCheckinStatus(HINDI.scanning);
                    timeoutId = setTimeout(detectAndSubmit, 500);
                }
            } catch (e) {
                console.error('Auto-detect error:', e);
                if (isMounted) {
                    timeoutId = setTimeout(detectAndSubmit, 1000);
                }
            }
        };

        // Start detection after 1 second to give camera time to initialize
        timeoutId = setTimeout(detectAndSubmit, 1000);

        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [showCheckin, modelsLoaded, isVerifying, gpsLocation]);

    const loadDashboard = async (emp) => {
        setIsLoading(true);
        const url = `${API_BASE}/employee-dashboard/?org_code=${emp.org_code}&employee_id=${emp.employee_id}`;
        console.log('[loadDashboard] Fetching:', url);
        console.log('[loadDashboard] Full URL:', window.location.origin + url);

        try {
            const res = await fetch(url);
            console.log('[loadDashboard] Response status:', res.status);
            const data = await res.json();
            console.log('[loadDashboard] Response data:', data);
            if (res.ok) {
                setDashboard(data);
            } else {
                console.error('[loadDashboard] API Error:', data);
            }
        } catch (e) {
            console.error('[loadDashboard] Network Error:', e.message);
        }
        setIsLoading(false);
    };

    const logout = () => {
        sessionStorage.removeItem('employee');
        navigate('/employee/login');
    };

    // ========== FRAME BURST CAPTURE (Active Liveness) ==========
    const captureFrameBurst = async () => {
        console.log('[Frame Burst] Function called');
        if (!webcamRef.current) {
            console.error('[Frame Burst] No webcam ref');
            return null;
        }

        const frames = [];
        const FRAME_COUNT = 30; // 30 frames over 3 seconds (Slower, easier for users)
        const INTERVAL_MS = 100; // 10 FPS

        // Random challenge frame for blink (12-18) - approx 1.2s to 1.8s
        const challengeFrame = Math.floor(Math.random() * 7) + 12;

        console.log('[Frame Burst] Starting capture...');
        console.log(`[Challenge] Blink prompt at frame ${challengeFrame}`);

        try {
            for (let i = 0; i < FRAME_COUNT; i++) {
                // UI Prompts for Liveness
                if (i === 0) setCheckinStatus('🔍 Verifying Liveness...');

                // INSTRUCTION: Turn head at 0.5s (Frame 5)
                if (i === 5) {
                    setCheckinStatus(HINDI.turnHead);
                    speak('Chehra mil gaya. Ab gardan ko dheere se dayein baayein ghumayein.');
                }

                if (i === 20) setCheckinStatus('📸 Hold Steady...');

                const screenshot = webcamRef.current.getScreenshot();
                if (!screenshot) {
                    console.warn(`[Frame Burst] Failed to capture frame ${i}`);
                    continue;
                }

                // Convert base64 to blob
                const blob = await (await fetch(screenshot)).blob();
                frames.push(blob);

                // Wait for next frame
                if (i < FRAME_COUNT - 1) {
                    await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
                }
            }

            console.log(`[Frame Burst] Captured ${frames.length} frames`);
            return { frames, challengeFrame };
        } catch (error) {
            console.error('[Frame Burst] Error during capture:', error);
            return null;
        }
    };


    // Face verification and check-in (now uses Trip API for check-in)
    const verifyAndCheckin = async () => {
        if (!webcamRef.current || !modelsLoaded || isVerifying) return;

        setIsVerifying(true);
        setCheckinStatus(HINDI.scanning);

        try {
            // ========== CAPTURE FRAME BURST ==========
            setCheckinStatus('📸 Capturing frames...');
            const captureResult = await captureFrameBurst();

            if (!captureResult || !captureResult.frames || captureResult.frames.length < 8) {
                // Frame burst failed - show error and retry
                console.error('[verifyAndCheckin] Frame burst failed');
                setCheckinStatus('❌ Camera error. Please try again.');
                setIsVerifying(false);
                return;
            }

            const { frames, challengeFrame } = captureResult;


            setCheckinStatus('🔍 Analyzing liveness...');

            // Detect face using face-api.js (on first frame for pre-check)
            const firstFrameBase64 = webcamRef.current.getScreenshot();
            const imgElement = document.createElement('img');
            imgElement.src = firstFrameBase64;
            await new Promise(r => imgElement.onload = r);

            const detection = await faceapi
                .detectSingleFace(imgElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                setCheckinStatus(HINDI.noFace);
                setIsVerifying(false);
                return;
            }

            setCheckinStatus(HINDI.faceDetected);

            // Use pre-captured GPS from state
            const latitude = gpsLocation.latitude;
            const longitude = gpsLocation.longitude;
            console.log('[GPS] Using pre-captured location:', latitude, longitude);

            // Create form data WITH FRAMES
            const formData = new FormData();

            // Add all frames
            frames.forEach((blob, index) => {
                formData.append('frames', blob, `frame_${index}.jpg`);
            });
            // Add SYNCHRONIZED challenge frame
            formData.append('challenge_frame', challengeFrame);


            formData.append('org_code', employee.org_code);
            formData.append('employee_id', employee.employee_id);

            // Add route_id if available
            const routeId = employee.route?.id;
            console.log('[CHECK-IN] Employee data:', employee);
            console.log('[CHECK-IN] Route ID:', routeId);
            if (routeId) {
                console.log('[CHECK-IN] Adding route_id to form:', routeId);
                formData.append('route_id', routeId);
            } else {
                console.warn('[CHECK-IN] No route_id found in employee data!');
            }
            if (latitude && longitude) {
                formData.append('latitude', latitude);
                formData.append('longitude', longitude);
            }

            if (checkinAction === 'checkin') {
                // Use Trip API for check-in - starts a new trip
                const checkinUrl = `${API_BASE}/trips/driver-checkin/`;
                console.log('[verifyAndCheckin] CHECK-IN URL:', checkinUrl);
                console.log('[verifyAndCheckin] Full URL:', window.location.origin + checkinUrl);

                const res = await fetch(checkinUrl, {
                    method: 'POST',
                    body: formData
                });

                console.log('[verifyAndCheckin] CHECK-IN Response status:', res.status);
                const data = await res.json();
                console.log('[verifyAndCheckin] CHECK-IN Response data:', data);

                if (res.ok && data.success) {
                    setCheckinStatus(HINDI.success);
                    speak(HINDI.voiceSuccess);
                    setTimeout(() => {
                        navigate(`/employee/helper-login?trip=${data.trip_id}`);
                    }, 2000);
                    return; // Return early to keep 'isVerifying' true (prevents auto-scan loop)
                } else {
                    console.error('[verifyAndCheckin] CHECK-IN Failed:', data.error);
                    setCheckinStatus(`❌ ${data.error || HINDI.error}`);
                }
            } else {
                // 1. Get Active Trip
                const tripRes = await fetch(`${API_BASE}/trips/active-trip/?org_code=${employee.org_code}&employee_id=${employee.employee_id}`);
                const tripData = await tripRes.json();

                if (!tripRes.ok || !tripData.found) {
                    setCheckinStatus('❌ No active trip found.');
                    setIsVerifying(false);
                    return;
                }

                // 2. Perform Driver Checkout
                const res = await fetch(`${API_BASE}/trips/${tripData.trip_id}/driver-checkout/`, {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    setCheckinStatus(HINDI.success);
                    speak(HINDI.voiceSuccessOut);

                    setTimeout(() => {
                        if (data.next_step === 'helper-checkout') {
                            navigate(`/employee/helper-checkout?trip=${tripData.trip_id}`);
                        } else if (data.next_step === 'vehicle-checkout') {
                            navigate(`/employee/vehicle-capture?trip=${tripData.trip_id}&action=checkout`);
                        } else {
                            loadDashboard(employee);
                            setShowCheckin(false);
                        }
                    }, 2000);
                    return; // Return early to keep 'isVerifying' true
                } else {
                    // Smart error handling - if checkout already started, redirect to next step
                    const errorMsg = data.error || '';
                    if (errorMsg.includes('Checkout already started') || errorMsg.includes('checkout')) {
                        setCheckinStatus('आगे बढ़ रहे हैं...');
                        speak('Checkout jaari hai');
                        setTimeout(() => {
                            // Check if trip has helper for proper redirect
                            if (tripData.has_helper && !tripData.helper_skipped) {
                                navigate(`/employee/helper-checkout?trip=${tripData.trip_id}`);
                            } else {
                                navigate(`/employee/vehicle-capture?trip=${tripData.trip_id}&action=checkout`);
                            }
                        }, 1500);
                        return; // Return early to keep 'isVerifying' true
                    } else {
                        setCheckinStatus(`❌ ${errorMsg || HINDI.error}`);
                    }
                }
            }
        } catch (e) {
            console.error(e);
            setCheckinStatus('❌ Error during verification');
        }

        setIsVerifying(false);
    };

    if (isLoading || !employee) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
            {/* Header - Worker Friendly */}
            <div style={{
                background: '#10b981',
                padding: '20px 16px',
                color: 'white',
                borderBottom: '4px solid #047857'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '1.6rem', margin: 0, fontWeight: '800' }}>
                            👋 {HINDI.welcome}
                        </h1>
                        <div style={{ fontSize: '1.2rem', marginTop: '4px', fontWeight: '600' }}>
                            {employee.name}
                        </div>
                        <div style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: '2px' }}>
                            {employee.org_name}
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        style={{
                            background: 'rgba(255,255,255,0.25)',
                            border: 'none',
                            color: 'white',
                            padding: '14px 20px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: '700'
                        }}
                    >
                        🚪 {HINDI.logout}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '16px' }}>

                {/* Face Check-in Card */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <h3 style={{ marginBottom: '16px', textAlign: 'center', fontSize: '1.4rem', fontWeight: '800' }}>📷 Duty दर्ज करें</h3>

                    {!showCheckin ? (
                        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                            {/* Check-in Button */}
                            <button
                                onClick={() => {
                                    setCheckinAction('checkin');
                                    setShowCheckin(true);
                                    setCheckinStatus('');
                                    speak(HINDI.voiceCheckin);
                                }}
                                disabled={!employee.face_enrolled || (dashboard?.today?.checked_in && !dashboard?.today?.checked_out)}
                                style={{
                                    width: '100%',
                                    padding: '24px 20px',
                                    fontSize: '1.4rem',
                                    fontWeight: '800',
                                    background: (dashboard?.today?.checked_in && !dashboard?.today?.checked_out) ? '#cbd5e1' : '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '16px',
                                    cursor: (dashboard?.today?.checked_in && !dashboard?.today?.checked_out) ? 'not-allowed' : 'pointer',
                                    boxShadow: (dashboard?.today?.checked_in && !dashboard?.today?.checked_out) ? 'none' : '0 6px 0 #047857',
                                    opacity: (dashboard?.today?.checked_in && !dashboard?.today?.checked_out) ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px'
                                }}
                            >
                                📥 {HINDI.dutyIn}
                            </button>

                            {/* Check-out Button */}
                            <button
                                onClick={() => {
                                    setCheckinAction('checkout');
                                    setShowCheckin(true);
                                    setCheckinStatus('');
                                    speak(HINDI.voiceCheckout);
                                }}
                                disabled={!employee.face_enrolled || !dashboard?.today?.checked_in || dashboard?.today?.checked_out}
                                style={{
                                    width: '100%',
                                    padding: '24px 20px',
                                    fontSize: '1.4rem',
                                    fontWeight: '800',
                                    background: (!dashboard?.today?.checked_in || dashboard?.today?.checked_out) ? '#cbd5e1' : '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '16px',
                                    cursor: (!dashboard?.today?.checked_in || dashboard?.today?.checked_out) ? 'not-allowed' : 'pointer',
                                    boxShadow: (!dashboard?.today?.checked_in || dashboard?.today?.checked_out) ? 'none' : '0 6px 0 #d97706',
                                    opacity: (!dashboard?.today?.checked_in || dashboard?.today?.checked_out) ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px'
                                }}
                            >
                                📤 {HINDI.dutyOut}
                            </button>

                            {!employee.face_enrolled && (
                                <p style={{ textAlign: 'center', color: '#f59e0b', marginTop: '12px', fontSize: '1rem', fontWeight: '600' }}>
                                    ⚠️ पहले अपना चेहरा दर्ज करें
                                </p>
                            )}
                        </div>
                    ) : (
                        <div>
                            {/* CSS Keyframes for scanning animation */}
                            <style>{`
                                @keyframes scanLine {
                                    0%, 100% { top: 10%; }
                                    50% { top: 90%; }
                                }
                                @keyframes pulse {
                                    0%, 100% { opacity: 1; }
                                    50% { opacity: 0.5; }
                                }
                                @keyframes cornerPulse {
                                    0%, 100% { box-shadow: 0 0 10px rgba(34, 197, 94, 0.5); }
                                    50% { box-shadow: 0 0 25px rgba(34, 197, 94, 0.8); }
                                }
                            `}</style>

                            {/* Webcam with scanning overlay */}
                            <div style={{
                                borderRadius: '20px',
                                overflow: 'hidden',
                                marginBottom: '16px',
                                position: 'relative',
                                border: '3px solid rgba(34, 197, 94, 0.5)',
                                boxShadow: '0 0 30px rgba(34, 197, 94, 0.2)'
                            }}>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    screenshotQuality={0.8}
                                    videoConstraints={{
                                        width: { ideal: 480 },
                                        height: { ideal: 360 },
                                        facingMode: { ideal: 'user' }
                                    }}
                                    style={{ width: '100%', display: 'block' }}
                                    mirrored={true}
                                    onUserMediaError={(error) => {
                                        console.error('Camera Error:', error);
                                        alert(`📷 Camera Error!\n\nReason: ${error.name || 'Unknown'}\n\nMessage: ${error.message || JSON.stringify(error)}`);
                                    }}
                                />


                                {/* Scanning line */}
                                <div style={{
                                    position: 'absolute',
                                    left: '5%',
                                    width: '90%',
                                    height: '3px',
                                    background: 'linear-gradient(90deg, transparent, #22c55e, #22c55e, transparent)',
                                    boxShadow: '0 0 15px #22c55e, 0 0 30px #22c55e',
                                    animation: 'scanLine 2s ease-in-out infinite',
                                    zIndex: 10
                                }} />

                                {/* Corner brackets - Top Left */}
                                <div style={{
                                    position: 'absolute', top: '10px', left: '10px',
                                    width: '40px', height: '40px',
                                    borderTop: '4px solid #22c55e',
                                    borderLeft: '4px solid #22c55e',
                                    animation: 'cornerPulse 1.5s ease-in-out infinite'
                                }} />
                                {/* Top Right */}
                                <div style={{
                                    position: 'absolute', top: '10px', right: '10px',
                                    width: '40px', height: '40px',
                                    borderTop: '4px solid #22c55e',
                                    borderRight: '4px solid #22c55e',
                                    animation: 'cornerPulse 1.5s ease-in-out infinite 0.2s'
                                }} />
                                {/* Bottom Left */}
                                <div style={{
                                    position: 'absolute', bottom: '10px', left: '10px',
                                    width: '40px', height: '40px',
                                    borderBottom: '4px solid #22c55e',
                                    borderLeft: '4px solid #22c55e',
                                    animation: 'cornerPulse 1.5s ease-in-out infinite 0.4s'
                                }} />
                                {/* Bottom Right */}
                                <div style={{
                                    position: 'absolute', bottom: '10px', right: '10px',
                                    width: '40px', height: '40px',
                                    borderBottom: '4px solid #22c55e',
                                    borderRight: '4px solid #22c55e',
                                    animation: 'cornerPulse 1.5s ease-in-out infinite 0.6s'
                                }} />

                                {/* Status badge */}
                                <div style={{
                                    position: 'absolute', top: '15px', left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: checkinAction === 'checkin' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(245, 158, 11, 0.9)',
                                    color: 'white', padding: '10px 24px', borderRadius: '50px',
                                    fontSize: '1rem', fontWeight: '700',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                    animation: 'pulse 2s ease-in-out infinite'
                                }}>
                                    {checkinAction === 'checkin' ? HINDI.dutyStart : HINDI.dutyEnd}
                                </div>

                                {/* ACTIVE FLASH OVERLAY */}
                                {flashActive && (
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0,
                                        width: '100%', height: '100%',
                                        background: 'rgba(255, 255, 255, 0.95)',
                                        zIndex: 20,
                                        animation: 'flashFade 0.2s ease-in-out',
                                        pointerEvents: 'none'
                                    }} />
                                )}

                                {/* Scan status at bottom */}
                                <div style={{
                                    position: 'absolute', bottom: '15px', left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'rgba(0,0,0,0.7)',
                                    color: '#22c55e', padding: '10px 24px', borderRadius: '50px',
                                    fontSize: '1rem', fontWeight: '600',
                                    animation: 'pulse 1.5s ease-in-out infinite'
                                }}>
                                    🔍 {HINDI.scanFace}
                                </div>
                            </div>

                            {/* Status */}
                            {checkinStatus && (
                                <div style={{
                                    padding: '12px', textAlign: 'center', marginBottom: '16px',
                                    background: checkinStatus.includes('🎉') ? 'rgba(34, 197, 94, 0.1)' :
                                        checkinStatus.includes('❌') || checkinStatus.includes('⚠️') ? 'rgba(239, 68, 68, 0.1)' :
                                            'rgba(59, 130, 246, 0.1)',
                                    borderRadius: '10px', fontSize: '1rem'
                                }}>
                                    {checkinStatus}
                                </div>
                            )}

                            {/* Auto-submit indicator */}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
                                {isVerifying ? (
                                    <div style={{
                                        padding: '12px 24px',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        borderRadius: '12px',
                                        fontWeight: '600'
                                    }}>
                                        ⏳ जांच हो रही है...
                                    </div>
                                ) : modelsLoaded ? (
                                    <div style={{
                                        padding: '12px 24px',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        borderRadius: '12px',
                                        color: 'var(--success)',
                                        fontWeight: '600'
                                    }}>
                                        🔄 चेहरा ढूंढ रहे हैं...
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '12px 24px',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        borderRadius: '12px',
                                        fontWeight: '600'
                                    }}>
                                        ⏳ लोड हो रहा है...
                                    </div>
                                )}
                                <button
                                    onClick={() => { setShowCheckin(false); setCheckinStatus(''); }}
                                    className="btn btn-outline"
                                    style={{ padding: '12px 24px', fontSize: '1rem' }}
                                >
                                    {HINDI.cancel}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Today's Status */}
                <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px', textAlign: 'center' }}>📅 आज की स्थिति</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{
                            padding: '20px',
                            background: dashboard?.today?.checked_in ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-soft)',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                                {dashboard?.today?.checked_in ? '✅' : '⏳'}
                            </div>
                            <div style={{ fontWeight: '600' }}>{dashboard?.today?.checked_in ? 'Duty दर्ज हो गयी' : 'Duty शुरू नहीं'}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {dashboard?.today?.checked_in || 'अभी तक नहीं'}
                            </div>
                        </div>
                        <div style={{
                            padding: '20px',
                            background: dashboard?.today?.checked_out ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-soft)',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                                {dashboard?.today?.checked_out ? '✅' : '⏳'}
                            </div>
                            <div style={{ fontWeight: '600' }}>{dashboard?.today?.checked_out ? 'Duty खत्म हो गयी' : 'Duty चालू है'}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {dashboard?.today?.checked_out || 'अभी तक नहीं'}
                            </div>
                        </div>
                    </div>
                </div>


                {/* Attendance History */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px' }}>📊 Attendance History (Last 30 Days)</h3>

                    {dashboard?.attendance?.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            color: 'var(--text-muted)'
                        }}>
                            No attendance records yet
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--bg-soft)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Check In</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Check Out</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dashboard?.attendance?.map((record, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                            <td style={{ padding: '12px' }}>
                                                {new Date(record.date).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {record.check_in || '-'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {record.check_out || '-'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '50px',
                                                    fontSize: '0.8rem',
                                                    background: record.status === 'present' ? 'rgba(16, 185, 129, 0.1)' :
                                                        record.status === 'late' ? 'rgba(245, 158, 11, 0.1)' :
                                                            'rgba(239, 68, 68, 0.1)',
                                                    color: record.status === 'present' ? 'var(--success)' :
                                                        record.status === 'late' ? 'var(--warning)' :
                                                            'var(--error)'
                                                }}>
                                                    {record.status || 'present'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeDashboard;
