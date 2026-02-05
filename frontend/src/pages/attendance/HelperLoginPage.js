/**
 * Helper Login Page - WORKER FRIENDLY
 * Part of the trip check-in flow: Driver checked in -> Helper login -> Vehicle capture
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
    title: 'Helper की Duty',
    enterDetails: 'Helper की ID डालें',
    helperId: 'Helper ID',
    continue: 'आगे बढ़ें',
    skip: 'Helper नहीं है (Skip)',
    scanning: 'चेहरा स्कैन हो रहा है...',
    faceDetected: 'चेहरा मिल गया! जांच हो रही है...',
    success: 'Helper की duty दर्ज हो गई!',
    noFace: 'चेहरा नहीं मिला। कैमरे की ओर देखें।',
    error: 'कुछ गड़बड़ हो गई',
    back: 'वापस',
    verify: 'चेहरा जांचें',
    voiceStart: 'Helper, apna chehra dikhaye',
    voiceSuccess: 'Helper ki duty darj ho gayi'
};

// Worker-Friendly Styles
const styles = {
    container: {
        minHeight: '100vh',
        background: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column'
    },
    header: {
        background: '#f59e0b',
        padding: '20px 16px',
        color: 'white',
        textAlign: 'center',
        borderBottom: '4px solid #d97706'
    },
    headerTitle: {
        fontSize: '1.8rem',
        fontWeight: '800',
        margin: 0
    },
    headerSub: {
        fontSize: '1rem',
        opacity: 0.9,
        marginTop: '4px'
    },
    content: {
        flex: 1,
        padding: '16px'
    },
    card: {
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    },
    bigInput: {
        width: '100%',
        padding: '20px 16px',
        fontSize: '1.3rem',
        border: '3px solid #e2e8f0',
        borderRadius: '14px',
        marginBottom: '16px',
        fontWeight: '600'
    },
    bigButton: {
        width: '100%',
        padding: '24px 20px',
        fontSize: '1.4rem',
        fontWeight: '800',
        border: 'none',
        borderRadius: '16px',
        cursor: 'pointer',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
    },
    primaryBtn: {
        background: '#f59e0b',
        color: 'white',
        boxShadow: '0 6px 0 #d97706'
    },
    outlineBtn: {
        background: 'white',
        color: '#64748b',
        border: '3px solid #cbd5e1'
    },
    statusBox: {
        padding: '16px',
        borderRadius: '12px',
        textAlign: 'center',
        fontSize: '1.2rem',
        fontWeight: '700',
        marginBottom: '16px'
    },
    cameraBox: {
        background: '#000',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '4px solid #f59e0b',
        marginBottom: '16px'
    }
};

const HelperLoginPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tripId = searchParams.get('trip');

    const webcamRef = useRef(null);
    const [employeeId, setEmployeeId] = useState('');
    const [step, setStep] = useState('login'); // login | face
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [employee, setEmployee] = useState(null);
    const [tripDetails, setTripDetails] = useState(null);

    const sessionDriver = JSON.parse(sessionStorage.getItem('employee') || '{}');

    useEffect(() => {
        if (!tripId) {
            navigate('/employee/dashboard');
            return;
        }
        const fetchTrip = async () => {
            try {
                const res = await fetch(`${API_BASE}/trips/${tripId}/`);
                if (res.ok) {
                    const data = await res.json();
                    setTripDetails(data);
                }
            } catch (e) {
                console.error("Failed to load trip", e);
            }
        };
        fetchTrip();
    }, [tripId, navigate]);

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
        if (step === 'face') loadModels();
    }, [step]);

    // AUTO-SCAN
    useEffect(() => {
        let scanInterval;

        const autoScan = async () => {
            if (!webcamRef.current || !modelsLoaded || isLoading || step !== 'face') return;

            try {
                const screenshot = webcamRef.current.getScreenshot();
                if (!screenshot) return;

                const imgElement = document.createElement('img');
                imgElement.src = screenshot;
                await new Promise(r => imgElement.onload = r);

                const detection = await faceapi
                    .detectSingleFace(imgElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    clearInterval(scanInterval);
                    setStatus(HINDI.faceDetected);
                    speak(HINDI.voiceStart);

                    setIsLoading(true);
                    const formData = new FormData();
                    const blob = await (await fetch(screenshot)).blob();
                    formData.append('image', blob, 'face.jpg');
                    formData.append('employee_id', employee.employee_id);

                    const res = await fetch(`${API_BASE}/trips/${tripId}/helper-checkin/`, {
                        method: 'POST',
                        body: formData
                    });

                    const data = await res.json();

                    if (res.ok && data.success) {
                        setStatus(HINDI.success);
                        speak(HINDI.voiceSuccess);
                        setTimeout(() => {
                            navigate(`/employee/vehicle-capture?trip=${tripId}`);
                        }, 2000);
                    } else {
                        setStatus(`❌ ${data.error || HINDI.error}`);
                        setTimeout(() => setIsLoading(false), 2000);
                    }
                }
            } catch (e) {
                console.error('Auto-scan error:', e);
            }
        };

        if (step === 'face' && modelsLoaded && employee) {
            setStatus(HINDI.scanning);
            scanInterval = setInterval(autoScan, 1500);
        }

        return () => {
            if (scanInterval) clearInterval(scanInterval);
        };
    }, [step, modelsLoaded, employee, isLoading, navigate, tripId]);

    const handleSkip = async () => {
        setIsLoading(true);
        setStatus('⏳ Skip हो रहा है...');

        try {
            const res = await fetch(`${API_BASE}/trips/${tripId}/skip-helper/`, { method: 'POST' });
            const data = await res.json();

            if (res.ok && data.success) {
                navigate(`/employee/vehicle-capture?trip=${tripId}`);
            } else {
                setStatus(`❌ ${data.error || 'Failed to skip'}`);
            }
        } catch (e) {
            setStatus('❌ Network error');
        }
        setIsLoading(false);
    };

    const handleLoginSubmit = (e) => {
        e.preventDefault();
        if (!employeeId.trim()) {
            setStatus('❌ Helper ID डालें');
            speak('Helper ki ID daalein');
            return;
        }

        const driverId = tripDetails?.driver?.id || sessionDriver.employee_id;
        if (driverId && employeeId.trim() === driverId) {
            setStatus('❌ Driver और Helper एक नहीं हो सकते');
            return;
        }

        setEmployee({ employee_id: employeeId.trim() });
        setStep('face');
        setStatus('');
        speak(HINDI.voiceStart);
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.headerTitle}>👷 {HINDI.title}</h1>
                <div style={styles.headerSub}>
                    Driver: {tripDetails?.driver?.name || sessionDriver.name || 'Unknown'}
                </div>
            </div>

            {/* Content */}
            <div style={styles.content}>
                <div style={styles.card}>
                    {step === 'login' ? (
                        <>
                            <h3 style={{ marginBottom: '20px', textAlign: 'center', fontSize: '1.4rem', fontWeight: '800' }}>
                                🪪 {HINDI.enterDetails}
                            </h3>

                            <form onSubmit={handleLoginSubmit}>
                                <input
                                    type="text"
                                    value={employeeId}
                                    onChange={e => setEmployeeId(e.target.value.toUpperCase())}
                                    placeholder="Helper की ID यहां डालें"
                                    style={styles.bigInput}
                                    autoFocus
                                />

                                {status && (
                                    <div style={{
                                        ...styles.statusBox,
                                        background: status.includes('❌') ? '#fee2e2' : '#e0f2fe',
                                        color: status.includes('❌') ? '#dc2626' : '#0369a1'
                                    }}>
                                        {status}
                                    </div>
                                )}

                                <button type="submit" style={{ ...styles.bigButton, ...styles.primaryBtn }}>
                                    ➜ {HINDI.continue}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    disabled={isLoading}
                                    style={{ ...styles.bigButton, ...styles.outlineBtn }}
                                >
                                    {isLoading ? '⏳ रुकें...' : `⏭️ ${HINDI.skip}`}
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <h3 style={{ marginBottom: '12px', textAlign: 'center', fontSize: '1.4rem', fontWeight: '800' }}>
                                📷 {HINDI.verify}
                            </h3>
                            <p style={{ textAlign: 'center', marginBottom: '16px', fontSize: '1.1rem', color: '#64748b' }}>
                                Helper ID: <strong style={{ color: '#f59e0b' }}>{employee?.employee_id}</strong>
                            </p>

                            {/* Camera */}
                            <div style={styles.cameraBox}>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    screenshotQuality={0.8}
                                    videoConstraints={{ width: 480, height: 360, facingMode: 'user' }}
                                    style={{ width: '100%', display: 'block' }}
                                    mirrored={true}
                                />
                            </div>

                            {/* Status */}
                            {status && (
                                <div style={{
                                    ...styles.statusBox,
                                    background: status.includes('दर्ज') ? '#dcfce7' : status.includes('❌') ? '#fee2e2' : '#e0f2fe',
                                    color: status.includes('दर्ज') ? '#166534' : status.includes('❌') ? '#dc2626' : '#0369a1'
                                }}>
                                    {status}
                                </div>
                            )}

                            <button
                                onClick={() => { setStep('login'); setStatus(''); }}
                                style={{ ...styles.bigButton, ...styles.outlineBtn }}
                            >
                                🔙 {HINDI.back}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HelperLoginPage;
