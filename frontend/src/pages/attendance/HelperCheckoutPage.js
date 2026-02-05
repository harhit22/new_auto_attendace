/**
 * Helper Checkout Page
 * Step 5 of Trip Workflow: Helper Face Verification for Checkout
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const API_BASE = '/api/v1/attendance';

// Hindi Voice System
const speak = (text) => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'hi-IN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
};

// Hindi Messages
const HINDI = {
    title: 'Helper की Duty खत्म',
    verifyHelper: 'Helper का चेहरा जांचें',
    scanning: 'चेहरा स्कैन हो रहा है...',
    faceDetected: 'चेहरा मिल गया! जांच हो रही है...',
    success: 'Helper का checkout हो गया!',
    noFace: 'चेहरा नहीं मिला। कृपया कैमरे की ओर देखें।',
    error: 'कुछ गड़बड़ हो गई',
    skip: 'Helper Skip करें',
    ready: 'तैयार है',
    voiceStart: 'Helper, checkout ke liye chehra dikhaye',
    voiceSuccess: 'Helper ka checkout ho gaya'
};

const HelperCheckoutPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tripId = searchParams.get('trip');

    const webcamRef = useRef(null);
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [tripDetails, setTripDetails] = useState(null);

    // Optional password if face fails or as alternative
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!tripId) {
            navigate('/employee/dashboard');
            return;
        }
        loadTripDetails();
        loadModels();
    }, [tripId, navigate]);

    const loadTripDetails = async () => {
        try {
            const res = await fetch(`${API_BASE}/trips/${tripId}/`);
            if (res.ok) {
                const data = await res.json();
                setTripDetails(data);
                if (!data.helper && !data.helper_skipped) {
                    setStatus('⚠️ No helper found on this trip');
                }
            } else {
                setStatus('❌ Failed to load trip details');
            }
        } catch (e) {
            console.error(e);
            setStatus('❌ Network error loading trip');
        }
    };

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
            console.error(e);
            setStatus('Failed to load recognition models');
        }
    };

    // AUTO-SCAN: Automatically scan for helper face
    useEffect(() => {
        let scanInterval;

        const autoScan = async () => {
            if (!webcamRef.current || !modelsLoaded || isLoading || !tripDetails?.helper) return;

            try {
                const screenshot = webcamRef.current.getScreenshot();
                if (!screenshot) return;

                // Detect face
                const imgEl = document.createElement('img');
                imgEl.src = screenshot;
                await new Promise(r => imgEl.onload = r);

                const detection = await faceapi.detectSingleFace(imgEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }));

                if (detection) {
                    // Face detected - stop scanning and verify
                    clearInterval(scanInterval);
                    setStatus(HINDI.faceDetected);
                    speak(HINDI.voiceStart);

                    // Auto-submit
                    setIsLoading(true);
                    setStatus(`📤 ${tripDetails.helper.name} जांच हो रही है...`);

                    const formData = new FormData();
                    const blob = await (await fetch(screenshot)).blob();
                    formData.append('image', blob, 'helper_face.jpg');
                    formData.append('employee_id', tripDetails.helper.id);
                    if (password) formData.append('password', password);

                    const res = await fetch(`${API_BASE}/trips/${tripId}/helper-checkout/`, {
                        method: 'POST',
                        body: formData
                    });

                    const data = await res.json();

                    if (res.ok && data.success) {
                        setStatus(HINDI.success);
                        speak(HINDI.voiceSuccess);
                        setTimeout(() => {
                            navigate(`/employee/vehicle-capture?trip=${tripId}&action=checkout`);
                        }, 2000);
                    } else {
                        setStatus(`❌ ${data.error || HINDI.error}`);
                        // Resume scanning after error
                        setTimeout(() => {
                            setIsLoading(false);
                        }, 2000);
                    }
                }
            } catch (e) {
                console.error('Auto-scan error:', e);
            }
        };

        if (modelsLoaded && tripDetails?.helper) {
            setStatus(HINDI.ready);
            speak(HINDI.voiceStart);
            scanInterval = setInterval(autoScan, 1500); // Scan every 1.5 seconds
        }

        return () => {
            if (scanInterval) clearInterval(scanInterval);
        };
    }, [modelsLoaded, tripDetails, isLoading, navigate, tripId, password]);

    const handleSkip = async () => {
        if (!window.confirm("Are you sure you want to skip helper checkout?")) return;

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/trips/${tripId}/skip-helper-checkout/`, {
                method: 'POST'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                navigate(`/employee/vehicle-capture?trip=${tripId}&action=checkout`);
            } else {
                setStatus(`❌ ${data.error || 'Failed to skip'}`);
            }
        } catch (e) {
            setStatus('❌ Network error');
        }
        setIsLoading(false);
    };

    const verifyFace = async () => {
        if (!webcamRef.current || !modelsLoaded || isLoading) return;
        if (!tripDetails?.helper) {
            setStatus('❌ No helper to verify');
            return;
        }

        setIsLoading(true);
        setStatus(HINDI.scanning);
        speak(HINDI.voiceStart);

        try {
            const screenshot = webcamRef.current.getScreenshot();
            if (!screenshot) {
                setStatus('❌ Capture failed');
                setIsLoading(false);
                return;
            }

            // Client-side detection check
            const imgEl = document.createElement('img');
            imgEl.src = screenshot;
            await new Promise(r => imgEl.onload = r);

            const detection = await faceapi.detectSingleFace(imgEl, new faceapi.TinyFaceDetectorOptions());
            if (!detection) {
                setStatus(HINDI.noFace);
                setIsLoading(false);
                return;
            }

            setStatus(HINDI.faceDetected);

            setStatus(`📤 Verifying ${tripDetails.helper.name}...`);

            const formData = new FormData();
            const blob = await (await fetch(screenshot)).blob();
            formData.append('image', blob, 'helper_face.jpg');
            // Enforce ID check
            formData.append('employee_id', tripDetails.helper.id);
            if (password) formData.append('password', password);

            const res = await fetch(`${API_BASE}/trips/${tripId}/helper-checkout/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStatus(HINDI.success);
                speak(HINDI.voiceSuccess);
                setTimeout(() => {
                    navigate(`/employee/vehicle-capture?trip=${tripId}&action=checkout`);
                }, 2000);
            } else {
                setStatus(`❌ ${data.error || HINDI.error}`);
            }

        } catch (e) {
            console.error(e);
            setStatus('❌ System Error');
        }
        setIsLoading(false);
    };

    if (!tripDetails) {
        return <div style={{ minHeight: '100vh', background: 'var(--bg-muted)', padding: '40px', textAlign: 'center', fontSize: '1.2rem' }}>लोड हो रहा है...</div>;
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-muted)', padding: '20px' }}>
            <div className="card" style={{ maxWidth: '500px', margin: '20px auto', padding: '30px', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '10px', color: '#f59e0b', fontSize: '1.4rem' }}>👷 {HINDI.title}</h2>

                {tripDetails.helper ? (
                    <div style={{ marginBottom: '20px', background: 'rgba(245, 158, 11, 0.1)', padding: '15px', borderRadius: '12px' }}>
                        <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>{HINDI.verifyHelper}</p>
                        <h3 style={{ margin: '8px 0', color: '#b45309', fontSize: '1.3rem' }}>{tripDetails.helper.name}</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>ID: {tripDetails.helper.id}</p>
                    </div>
                ) : (
                    <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
                        इस trip में helper नहीं है।
                    </p>
                )}

                <div style={{ marginBottom: '20px', borderRadius: '16px', overflow: 'hidden', position: 'relative', border: '3px solid #f59e0b' }}>
                    {modelsLoaded ? (
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: 'user' }}
                            style={{ width: '100%', display: 'block' }}
                            mirrored={true}
                        />
                    ) : (
                        <div style={{ height: '300px', background: '#000', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                            कैमरा लोड हो रहा है...
                        </div>
                    )}
                </div>

                <div style={{
                    padding: '14px',
                    marginBottom: '20px',
                    background: status.includes(HINDI.success) ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                    color: status.includes(HINDI.success) ? '#22c55e' : '#3b82f6',
                    borderRadius: '8px',
                    fontWeight: '500',
                    fontSize: '1rem',
                    minHeight: '48px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {status || HINDI.ready}
                </div>

                {showPassword && (
                    <div style={{ marginBottom: '16px' }}>
                        <input
                            type="password"
                            placeholder={`${tripDetails.helper?.name} का Password`}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem' }}
                        />
                    </div>
                )}

                <button
                    onClick={verifyFace}
                    disabled={isLoading || !modelsLoaded || !tripDetails.helper}
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', marginBottom: '12px', background: '#f59e0b', border: 'none', padding: '16px', fontSize: '1.1rem' }}
                >
                    {isLoading ? '⏳ जांच हो रही है...' : `✅ ${HINDI.verifyHelper}`}
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn btn-outline"
                        style={{ flex: 1, fontSize: '1rem', padding: '14px' }}
                    >
                        {showPassword ? 'Password छुपाएं' : 'Password डालें'}
                    </button>
                    <button
                        onClick={handleSkip}
                        className="btn btn-outline"
                        style={{ flex: 1, fontSize: '1rem', padding: '14px', color: '#ef4444', borderColor: '#ef4444' }}
                    >
                        {HINDI.skip}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default HelperCheckoutPage;
