/**
 * Guided Face Scanner with Voice Instructions (Hindi)
 * Uses Web Speech API for voice prompts
 */
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

// Face angles with Hindi voice instructions
const FACE_ANGLES = [
    { id: 'front', label: 'Look Straight', icon: '😊', instruction: 'Look directly at the camera', voice: 'Seedha dekho', count: 5 },
    { id: 'left', label: 'Turn Left', icon: '👈', instruction: 'Turn your face to the LEFT', voice: 'Left dekho', count: 4 },
    { id: 'right', label: 'Turn Right', icon: '👉', instruction: 'Turn your face to the RIGHT', voice: 'Right dekho', count: 4 },
    { id: 'up', label: 'Look Up', icon: '👆', instruction: 'Tilt your head UP', voice: 'Uper dekho', count: 4 },
    { id: 'down', label: 'Look Down', icon: '👇', instruction: 'Tilt your head DOWN', voice: 'Niche dekho', count: 4 },
];

// Text-to-Speech function
const speak = (text) => {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'hi-IN'; // Hindi
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Try to find a Hindi voice
        const voices = window.speechSynthesis.getVoices();
        const hindiVoice = voices.find(v => v.lang.includes('hi')) || voices.find(v => v.lang.includes('en'));
        if (hindiVoice) utterance.voice = hindiVoice;

        window.speechSynthesis.speak(utterance);
    }
};

const FaceScanner = ({ onCapture, onComplete, guided = true }) => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const timerRef = useRef(null);
    const lastSpokenAngle = useRef(-1);

    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isFaceDetected, setIsFaceDetected] = useState(false);
    const [capturedImages, setCapturedImages] = useState([]);
    const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
    const [countdown, setCountdown] = useState(null);
    const [isComplete, setIsComplete] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(true);

    const currentAngle = FACE_ANGLES[currentAngleIndex];
    const totalImages = FACE_ANGLES.reduce((sum, a) => sum + a.count, 0);
    const angleProgress = capturedImages.filter(img => img.angle === currentAngle?.id).length;

    // Initialize voices
    useEffect(() => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    }, []);

    // Speak when angle changes
    useEffect(() => {
        if (voiceEnabled && currentAngle && lastSpokenAngle.current !== currentAngleIndex && !isComplete) {
            lastSpokenAngle.current = currentAngleIndex;
            // Delay slightly to ensure previous speech is cancelled
            setTimeout(() => speak(currentAngle.voice), 300);
        }
    }, [currentAngleIndex, currentAngle, voiceEnabled, isComplete]);

    // Speak completion
    useEffect(() => {
        if (isComplete && voiceEnabled) {
            speak('Bahut acha! Scanning complete ho gaya.');
        }
    }, [isComplete, voiceEnabled]);

    // Load models
    useEffect(() => {
        const load = async () => {
            try {
                const urls = ['/models', 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'];
                for (const url of urls) {
                    try {
                        await faceapi.nets.tinyFaceDetector.loadFromUri(url);
                        console.log('Loaded from:', url);
                        break;
                    } catch (e) { console.log('Failed:', url); }
                }
                setModelsLoaded(true);
                setIsLoading(false);
                // Initial voice instruction
                if (voiceEnabled) {
                    setTimeout(() => speak('Seedha dekho'), 500);
                }
            } catch (e) {
                console.error(e);
                setIsLoading(false);
            }
        };
        load();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            window.speechSynthesis.cancel();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Face detection loop
    useEffect(() => {
        if (!modelsLoaded || isLoading || isComplete) return;

        let running = true;
        const detect = async () => {
            if (!running || !webcamRef.current?.video) {
                if (running) setTimeout(detect, 300);
                return;
            }
            const video = webcamRef.current.video;
            if (video.readyState === 4) {
                try {
                    const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
                    setIsFaceDetected(!!result);

                    if (canvasRef.current && result) {
                        const ctx = canvasRef.current.getContext('2d');
                        canvasRef.current.width = video.videoWidth;
                        canvasRef.current.height = video.videoHeight;
                        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                        ctx.strokeStyle = '#10b981';
                        ctx.lineWidth = 3;
                        ctx.strokeRect(result.box.x, result.box.y, result.box.width, result.box.height);
                    }
                } catch (e) { console.error(e); }
            }
            if (running) setTimeout(detect, 300);
        };
        detect();
        return () => { running = false; };
    }, [modelsLoaded, isLoading, isComplete]);

    // Auto-capture with countdown
    useEffect(() => {
        if (!isFaceDetected || isComplete || countdown !== null) return;
        if (angleProgress >= currentAngle?.count) return;

        let count = 3;
        setCountdown(count);

        const tick = () => {
            count--;
            if (count <= 0) {
                setCountdown(null);
                captureNow();
            } else {
                setCountdown(count);
                timerRef.current = setTimeout(tick, 400);
            }
        };

        timerRef.current = setTimeout(tick, 400);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFaceDetected, isComplete, currentAngleIndex, capturedImages.length]);

    // Reset countdown if face lost
    useEffect(() => {
        if (!isFaceDetected && countdown !== null) {
            if (timerRef.current) clearTimeout(timerRef.current);
            setCountdown(null);
        }
    }, [isFaceDetected, countdown]);

    // Capture function
    const captureNow = async () => {
        if (!webcamRef.current || isComplete) return;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        const res = await fetch(imageSrc);
        const blob = await res.blob();
        const file = new File([blob], `face_${currentAngle.id}_${Date.now()}.jpg`, { type: 'image/jpeg' });

        const newImage = { src: imageSrc, file, angle: currentAngle.id };
        const newImages = [...capturedImages, newImage];
        setCapturedImages(newImages);

        if (onCapture) onCapture(file, newImages.length);

        const newProgress = newImages.filter(img => img.angle === currentAngle.id).length;

        if (newProgress >= currentAngle.count) {
            if (currentAngleIndex < FACE_ANGLES.length - 1) {
                setTimeout(() => setCurrentAngleIndex(i => i + 1), 600);
            } else {
                setIsComplete(true);
                if (onComplete) onComplete(newImages.map(img => img.file));
            }
        }
    };

    const reset = () => {
        setCapturedImages([]);
        setCurrentAngleIndex(0);
        setIsComplete(false);
        setCountdown(null);
        lastSpokenAngle.current = -1;
        if (voiceEnabled) speak('Seedha dekho');
    };

    const toggleVoice = () => {
        setVoiceEnabled(!voiceEnabled);
        if (!voiceEnabled && currentAngle) {
            speak(currentAngle.voice);
        } else {
            window.speechSynthesis.cancel();
        }
    };

    return (
        <div className="face-scanner">
            {/* Voice toggle */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                <button
                    className={`btn ${voiceEnabled ? 'btn-primary' : 'btn-outline'}`}
                    onClick={toggleVoice}
                    style={{ padding: '8px 16px' }}
                >
                    {voiceEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
                </button>
            </div>

            {/* Progress indicators */}
            {guided && !isComplete && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {FACE_ANGLES.map((angle, i) => {
                        const prog = capturedImages.filter(img => img.angle === angle.id).length;
                        const active = i === currentAngleIndex;
                        const done = prog >= angle.count;
                        return (
                            <div key={angle.id} style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                padding: '8px 16px', borderRadius: '10px',
                                background: active ? 'var(--primary-color)' : done ? 'var(--success-color)' : 'var(--bg-light)',
                                opacity: i < currentAngleIndex ? 1 : active ? 1 : 0.5
                            }}>
                                <span style={{ fontSize: '24px' }}>{angle.icon}</span>
                                <span style={{ fontSize: '12px', marginTop: '4px' }}>{angle.label}</span>
                                <span style={{ fontSize: '10px', opacity: 0.8 }}>{prog}/{angle.count}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Current instruction with voice text */}
            {guided && !isComplete && currentAngle && (
                <div style={{ textAlign: 'center', marginBottom: '20px', padding: '20px', background: 'var(--gradient-primary)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>{currentAngle.icon}</div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '28px' }}>{currentAngle.voice}</h2>
                    <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>{currentAngle.instruction}</p>
                </div>
            )}

            {/* Webcam */}
            <div className={`webcam-container ${isFaceDetected ? 'face-detected' : ''}`}>
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '480px', gap: '16px' }}>
                        <div className="spinner"></div>
                        <p>Loading...</p>
                    </div>
                ) : (
                    <>
                        <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                            videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                            style={{ width: '100%' }} mirrored={true} />
                        <canvas ref={canvasRef} className="webcam-overlay" />
                        <div className="face-guide"></div>

                        {countdown && (
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                fontSize: '100px', fontWeight: 'bold', color: '#fff', textShadow: '0 0 30px rgba(99, 102, 241, 0.8)'
                            }}>
                                {countdown}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Status */}
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <div className={`status-badge ${isFaceDetected ? 'success' : 'warning'}`}>
                    {isComplete ? '✅ Complete!' : isFaceDetected
                        ? (countdown ? `📸 ${countdown}...` : '✓ Hold still!') : '○ Position your face'}
                </div>
            </div>

            {/* Progress */}
            <div className="progress-container">
                <div className="progress-bar" style={{ width: `${(capturedImages.length / totalImages) * 100}%` }}></div>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                {capturedImages.length} of {totalImages} images
            </div>

            {/* Thumbnails */}
            {capturedImages.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h4 style={{ marginBottom: '12px' }}>Captured</h4>
                    <div className="images-grid">
                        {capturedImages.map((img, i) => (
                            <div key={i} className="image-thumb fade-in">
                                <img src={img.src} alt={`${img.angle}`} />
                                <span className="index">{img.angle.charAt(0).toUpperCase()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reset */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                <button className="btn btn-outline" onClick={reset} disabled={capturedImages.length === 0}>
                    🔄 Start Over
                </button>
            </div>
        </div>
    );
};

export default FaceScanner;
