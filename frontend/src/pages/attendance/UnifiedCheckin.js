import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Webcam from 'react-webcam';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_BASE = '/api/v1/attendance';

const styles = {
    // 1. Remove Outer Padding & Make Full Screen
    container: {
        width: '100%',
        minHeight: '100vh',
        background: '#f1f5f9',
        display: 'flex',
        justifyContent: 'center',
        padding: 0 // Removed padding per user request
    },
    // 2. Adjust PhoneFrame to fill screen on mobile
    phoneFrame: {
        backgroundColor: 'white',
        width: '100%',
        maxWidth: '450px', // Slightly wider
        minHeight: '100vh', // Full height
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
    },
    header: {
        background: '#10b981',
        color: 'white',
        padding: '24px',
        textAlign: 'center'
    },
    headerTitle: {
        margin: 0,
        fontSize: '1.4rem',
        fontWeight: '700'
    },
    headerSubtitle: {
        fontSize: '0.95rem',
        opacity: 0.9,
        marginTop: '6px'
    },
    content: {
        padding: '20px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        paddingBottom: '100px' // Space for footer
    },
    card: {
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        transition: 'all 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    },
    cardVerified: {
        borderColor: '#10b981',
        background: '#ecfdf5'
    },
    avatar: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        overflow: 'hidden',
        border: '3px solid white',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        flexShrink: 0
    },
    info: {
        flex: 1
    },
    label: {
        fontSize: '0.875rem',
        color: '#64748b',
        fontWeight: '600',
        marginBottom: '4px'
    },
    value: {
        fontSize: '1.1rem',
        color: '#0f172a',
        fontWeight: '700'
    },
    actionBtn: {
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        padding: '10px 16px',
        borderRadius: '99px',
        fontWeight: '600',
        fontSize: '0.875rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
    },
    verifiedBadge: {
        background: 'white',
        color: '#10b981',
        border: '1px solid #10b981',
        pointerEvents: 'none',
        padding: '8px 14px',
        borderRadius: '99px',
        fontWeight: '600',
        fontSize: '0.85rem',
        whiteSpace: 'nowrap'
    },
    sectionTitle: {
        fontWeight: '700',
        color: '#334155',
        marginBottom: '12px',
        fontSize: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    },
    vehiclePreview: {
        width: '100%',
        height: '180px',
        background: '#f8fafc',
        border: '2px dashed #cbd5e1',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        cursor: 'pointer',
        marginTop: '0px',
        overflow: 'hidden'
    },
    footer: {
        padding: '20px',
        background: 'white',
        borderTop: '1px solid #e2e8f0',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.05)'
    },
    submitBtn: {
        width: '100%',
        maxWidth: '450px',
        padding: '18px',
        background: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '14px',
        fontSize: '1.25rem',
        fontWeight: '700',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
    },
    submitBtnDisabled: {
        background: '#cbd5e1',
        cursor: 'not-allowed',
        boxShadow: 'none'
    },
    // Modal for Camera
    modal: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'black',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column'
    },
    webcamFrame: {
        flex: 1,
        width: '100%',
        position: 'relative'
    },
    guidanceOverlay: {
        position: 'absolute',
        bottom: '100px',
        left: 0,
        right: 0,
        textAlign: 'center',
        color: 'white',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
        zIndex: 10
    }
};

const UnifiedCheckin = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { orgCode, employeeId, route, vehicle, employeeName, substituteMode } = location.state || {};

    const [step, setStep] = useState('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [locationCoords, setLocationCoords] = useState(null);

    // Data State
    const [driverData, setDriverData] = useState({ verified: false, frames: [], challenge: null });

    // Helper State
    const [helperId, setHelperId] = useState('');
    const [helperData, setHelperData] = useState({ verified: false, frames: [], challenge: null });

    const [vehicleData, setVehicleData] = useState({ captured: false, file: null, preview: null });

    // Substitute State
    const [subDriverName, setSubDriverName] = useState('');
    const [subDriverPhone, setSubDriverPhone] = useState('');
    const [subDriverPhoto, setSubDriverPhoto] = useState(null);
    const [subDriverPhotoPreview, setSubDriverPhotoPreview] = useState(null);
    const [subDriverLicense, setSubDriverLicense] = useState(null);
    const [subDriverLicensePreview, setSubDriverLicensePreview] = useState(null);
    const [subHelperPhoto, setSubHelperPhoto] = useState(null);
    const [subHelperPhotoPreview, setSubHelperPhotoPreview] = useState(null);

    // Camera State
    const webcamRef = useRef(null);
    const [guidanceText, setGuidanceText] = useState("Initializing Camera...");
    const [isCapturing, setIsCapturing] = useState(false);
    const frameCountRef = useRef(0);
    const capturedFramesRef = useRef([]);

    // TTS
    const speak = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    };

    // Image Compression (Saves ~80% mobile data!)
    const compressImage = (base64, quality = 0.5) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                // Compress to 50% quality (400KB → 80KB per frame)
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = base64;
        });
    };

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.error("GPS Error", err)
            );
        }
    }, []);

    // --- CAPTURE LOGIC ---
    const startFaceCapture = (role) => {
        setStep(role === 'driver' ? 'capturing_driver' : 'capturing_helper');
        setGuidanceText("Position Face in Center");
        speak("Please position your face in the center");
        setIsCapturing(false);
        frameCountRef.current = 0;
        capturedFramesRef.current = [];
    };

    const handleCameraReady = () => {
        setGuidanceText("Hold Steady...");
        speak("Hold steady");
        setTimeout(startBurst, 1000);
    };

    const startBurst = () => {
        if (!webcamRef.current) return;
        setIsCapturing(true);
        frameCountRef.current = 0;
        capturedFramesRef.current = [];

        const interval = setInterval(() => {
            if (!webcamRef.current || !webcamRef.current.getScreenshot) {
                clearInterval(interval);
                return;
            }

            const frame = webcamRef.current.getScreenshot();
            if (frame) {
                // Compress frame immediately (80% data savings)
                compressImage(frame, 0.5).then(compressed => {
                    capturedFramesRef.current.push(compressed);
                });
                frameCountRef.current += 1;
                const count = frameCountRef.current;

                if (count === 1) setGuidanceText("Look Straight 😐");
                else if (count === 6) { setGuidanceText("Turn Head LEFT ⬅️"); speak("Turn left"); }
                else if (count === 11) { setGuidanceText("Turn Head RIGHT ➡️"); speak("Turn right"); }
                else if (count === 16) { setGuidanceText("Look Straight Again 😐"); speak("Look straight"); }

                if (count >= 20) {
                    clearInterval(interval);
                    completeCapture();
                }
            }
        }, 150);
    };

    const completeCapture = async () => {
        setIsCapturing(false);
        const role = step === 'capturing_driver' ? 'driver' : 'helper';
        const frames = [...capturedFramesRef.current];
        const challenge = Math.floor(Math.random() * 10000);

        setGuidanceText("Verifying Liveness...");
        speak("Verifying, please wait");

        await verifyLivenessStateless(role, frames, challenge);
    };

    const verifyLivenessStateless = async (role, frames, challenge) => {
        const formData = new FormData();
        formData.append('org_code', orgCode);
        formData.append('employee_id', role === 'driver' ? employeeId : helperId);
        formData.append('challenge_frame', challenge);

        for (let i = 0; i < frames.length; i++) {
            const res = await fetch(frames[i]);
            const blob = await res.blob();
            formData.append('frames', blob, `frame_${i}.jpg`);
        }

        try {
            const res = await fetch(`${API_BASE}/trips/verify-liveness/`, {
                method: 'POST', body: formData
            });
            const data = await res.json();

            if (res.ok && data.success) {
                speak("Verified successfully");
                if (role === 'driver') {
                    setDriverData({ verified: true, frames, challenge });
                } else {
                    setHelperData({ verified: true, frames, challenge });
                }
                setStep('idle');
            } else if (data.retry === false || res.status === 400) {
                // Non-retryable error (employee not found, org not found, no embeddings)
                const errorText = data.error || "Employee not found or face not enrolled.";
                setGuidanceText(errorText);
                speak(errorText);
                alert(errorText); // Force user to see the error
                setStep('idle');
            } else {
                // Retryable error (e.g., face verification failed, spoof, proximity)
                const errorMsg = data.error || "Verification Failed. Retrying...";
                setGuidanceText(errorMsg);

                // Speak specific errors for better guidance
                if (errorMsg.includes("Spoof") || errorMsg.includes("Close") || errorMsg.includes("Head") || errorMsg.includes("Face")) {
                    speak(errorMsg);
                } else {
                    speak("Verification failed. Please try again.");
                }

                setTimeout(() => {
                    frameCountRef.current = 0; capturedFramesRef.current = [];
                    startBurst();
                }, 2500); // Increased delay slightly to let user read error
            }
        } catch (err) {
            alert("Network Error: " + err.message);
            setStep('idle');
        }
    };

    // --- SUBSTITUTE PHOTO CAPTURE (Simple click) ---
    const handleSubstitutePhoto = (role, e) => {
        const file = e.target.files[0];
        if (!file) return;
        const preview = URL.createObjectURL(file);
        if (role === 'driver') {
            setSubDriverPhoto(file);
            setSubDriverPhotoPreview(preview);
            setDriverData({ verified: true, frames: [], challenge: null });
        } else {
            setSubHelperPhoto(file);
            setSubHelperPhotoPreview(preview);
            setHelperData({ verified: true, frames: [], challenge: null });
        }
    };

    const handleLicenseCapture = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSubDriverLicense(file);
            setSubDriverLicensePreview(URL.createObjectURL(file));
        }
    };

    // --- VEHICLE ---
    const handleVehicleCapture = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVehicleData({ captured: true, file: file, preview: URL.createObjectURL(file) });
        }
    };

    // --- SUBMIT ---
    const handleFinalSubmit = async () => {
        setIsLoading(true);
        speak("Starting trip, please wait");

        if (substituteMode) {
            // ===== SUBSTITUTE SUBMIT =====
            const formData = new FormData();
            formData.append('org_code', orgCode);
            formData.append('employee_id', employeeId);
            formData.append('is_substitute', 'true');
            formData.append('substitute_name', subDriverName);
            formData.append('substitute_phone', subDriverPhone);
            if (route?.id) formData.append('route_id', route.id);
            if (vehicle?.id) formData.append('vehicle_id', vehicle.id);
            if (locationCoords) {
                formData.append('latitude', locationCoords.lat);
                formData.append('longitude', locationCoords.lng);
            }
            if (subDriverPhoto) formData.append('substitute_photo', subDriverPhoto);
            if (subDriverLicense) formData.append('substitute_license', subDriverLicense);

            try {
                // Step 1: Driver check-in
                const res = await fetch(`${API_BASE}/trips/driver-checkin/`, {
                    method: 'POST', body: formData
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    const tripId = data.trip_id;

                    // Step 2: Helper (if provided)
                    if (helperId && subHelperPhoto) {
                        const helperForm = new FormData();
                        helperForm.append('employee_id', helperId);
                        helperForm.append('is_substitute', 'true');
                        helperForm.append('substitute_photo', subHelperPhoto);
                        await fetch(`${API_BASE}/trips/${tripId}/helper-checkin/`, {
                            method: 'POST', body: helperForm
                        });
                    } else {
                        // Skip helper
                        await fetch(`${API_BASE}/trips/${tripId}/skip-helper/`, { method: 'POST' });
                    }

                    // Step 3: Vehicle
                    if (vehicleData.file) {
                        const vehicleForm = new FormData();
                        vehicleForm.append('image', vehicleData.file);
                        if (vehicle?.id) vehicleForm.append('vehicle_id', vehicle.id);
                        await fetch(`${API_BASE}/trips/${tripId}/vehicle-checkin/`, {
                            method: 'POST', body: vehicleForm
                        });
                    }

                    speak("Trip started successfully");
                    navigate('/employee/dashboard');
                } else {
                    alert("Error: " + (data.error || "Check-in failed"));
                }
            } catch (err) {
                alert("Network Error: " + err.message);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // ===== NORMAL SUBMIT (existing logic) =====
        const formData = new FormData();
        formData.append('org_code', orgCode);
        if (route?.id) formData.append('route_id', route.id);
        if (vehicle?.id) formData.append('vehicle_id', vehicle.id);
        formData.append('driver_id', employeeId);
        formData.append('driver_challenge_frame', driverData.challenge);
        if (locationCoords) {
            formData.append('latitude', locationCoords.lat);
            formData.append('longitude', locationCoords.lng);
        }

        await Promise.all(driverData.frames.map(async (frame, i) => {
            const res = await fetch(frame);
            const blob = await res.blob();
            formData.append('driver_frames', blob, `driver_${i}.jpg`);
        }));

        if (helperId && helperData.verified) {
            formData.append('helper_id', helperId);
            formData.append('helper_challenge_frame', helperData.challenge);
            await Promise.all(helperData.frames.map(async (frame, i) => {
                const res = await fetch(frame);
                const blob = await res.blob();
                formData.append('helper_frames', blob, `helper_${i}.jpg`);
            }));
        }

        formData.append('vehicle_image', vehicleData.file);

        try {
            const res = await fetch(`${API_BASE}/trips/unified-checkin/`, {
                method: 'POST', body: formData
            });
            const data = await res.json();
            if (res.ok && data.success) {
                speak("Trip started successfully");
                navigate('/employee/dashboard');
            } else {
                alert("Error: " + (data.error || "Check-in failed"));
            }
        } catch (err) {
            alert("Network Error: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- RENDER MODAL ---
    if (step.startsWith('capturing')) {
        return (
            <div style={styles.modal}>
                <div style={styles.webcamFrame}>
                    <Webcam
                        ref={webcamRef} screenshotFormat="image/jpeg"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        videoConstraints={{ facingMode: 'user' }}
                        onUserMedia={handleCameraReady}
                        onUserMediaError={(e) => setGuidanceText("Camera Error")}
                    />
                    <div style={styles.guidanceOverlay}>{guidanceText}</div>
                </div>
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <button onClick={() => setStep('idle')} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '10px 20px', borderRadius: '20px' }}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // --- RENDER MAIN ---
    return (
        <div style={styles.container}>
            <LoadingOverlay isVisible={isLoading} message="Duty शुरू हो रही है..." />
            <div style={styles.phoneFrame}>
                <div style={styles.header}>
                    <h1 style={styles.headerTitle}>Start Duty Check-in</h1>
                    <div style={styles.headerSubtitle}>{route?.name ? `Route: ${route.name}` : 'Route Not Selected'}</div>
                </div>

                <div style={styles.content}>

                    {/* DRIVER SECTION */}
                    <div style={{ ...styles.card, ...(driverData.verified ? styles.cardVerified : {}) }}>
                        <div style={styles.avatar}>
                            <img
                                src={subDriverPhotoPreview || `https://ui-avatars.com/api/?name=${employeeName}&background=random`}
                                alt="Driver"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                        <div style={styles.info}>
                            <div style={styles.label}>
                                {substituteMode ? '🔄 Substitute Driver' : 'Driver'}
                            </div>
                            <div style={styles.value}>{substituteMode ? (subDriverName || 'Take Photo') : employeeName}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {employeeId}</div>
                        </div>
                        {driverData.verified ? (
                            <div style={styles.verifiedBadge}>✅ {substituteMode ? 'Photo Taken' : 'Verified'}</div>
                        ) : substituteMode ? (
                            <>
                                <button style={styles.actionBtn} onClick={() => document.getElementById('subDriverPhotoInput').click()}>
                                    📷 Photo
                                </button>
                                <input type="file" id="subDriverPhotoInput" accept="image/*" capture="user" style={{ display: 'none' }}
                                    onChange={(e) => handleSubstitutePhoto('driver', e)} />
                            </>
                        ) : (
                            <button style={styles.actionBtn} onClick={() => startFaceCapture('driver')}>
                                Scan Face
                            </button>
                        )}
                    </div>

                    {/* SUBSTITUTE DRIVER INFO FORM */}
                    {substituteMode && (
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.05)',
                            border: '1px solid #fbbf24',
                            borderRadius: '12px',
                            padding: '16px',
                            marginTop: '-8px',
                            marginBottom: '8px'
                        }}>
                            <div style={{ fontWeight: '700', marginBottom: '12px', color: '#92400e' }}>📋 Substitute Info (Driver)</div>
                            <input
                                placeholder="Substitute Driver Name"
                                value={subDriverName}
                                onChange={(e) => setSubDriverName(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '10px',
                                    border: '1px solid #cbd5e1', marginBottom: '10px',
                                    fontSize: '1rem', boxSizing: 'border-box'
                                }}
                            />
                            <input
                                placeholder="Phone Number"
                                type="tel"
                                value={subDriverPhone}
                                onChange={(e) => setSubDriverPhone(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '10px',
                                    border: '1px solid #cbd5e1', marginBottom: '10px',
                                    fontSize: '1rem', boxSizing: 'border-box'
                                }}
                            />
                            <div
                                onClick={() => document.getElementById('licenseInput').click()}
                                style={{
                                    border: '2px dashed #fbbf24',
                                    borderRadius: '10px',
                                    padding: '16px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: subDriverLicensePreview ? 'transparent' : '#fffbeb'
                                }}
                            >
                                {subDriverLicensePreview ? (
                                    <img src={subDriverLicensePreview} alt="License" style={{ width: '100%', maxHeight: '150px', objectFit: 'contain', borderRadius: '8px' }} />
                                ) : (
                                    <div>
                                        <div style={{ fontSize: '1.5rem' }}>🪪</div>
                                        <div style={{ color: '#92400e', fontWeight: '600', marginTop: '4px' }}>Tap to capture License</div>
                                    </div>
                                )}
                            </div>
                            <input type="file" id="licenseInput" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleLicenseCapture} />
                        </div>
                    )}

                    {/* HELPER SECTION (ALWAYS VISIBLE) */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                        <div style={styles.sectionTitle}>
                            <span>👷 Helper (Optional)</span>
                        </div>

                        <input
                            placeholder="Enter Helper ID (if any)"
                            value={helperId}
                            onChange={(e) => {
                                setHelperId(e.target.value.toUpperCase());
                                // Reset helper data if ID changes
                                if (helperData.verified) setHelperData({ verified: false, frames: [], challenge: null });
                            }}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '12px',
                                border: '1px solid #cbd5e1', marginBottom: '16px',
                                fontSize: '1rem', background: '#fff', boxSizing: 'border-box'
                            }}
                        />

                        {/* Helper Card always shows, but button disabled if no ID */}
                        <div style={{ ...styles.card, opacity: helperId ? 1 : 0.7 }}>
                            <div style={{ ...styles.avatar, borderStyle: 'dashed', borderColor: '#cbd5e1', background: 'white' }}>
                                <span>👤</span>
                            </div>
                            <div style={styles.info}>
                                <div style={styles.label}>Helper Verification</div>
                                <div style={{ ...styles.value, color: helperData.verified ? '#0f172a' : '#94a3b8' }}>
                                    {helperData.verified ? 'Verified' : 'Not Verified'}
                                </div>
                            </div>
                            {helperData.verified ? (
                                <div style={styles.verifiedBadge}>✅ {substituteMode ? 'Photo Taken' : 'Verified'}</div>
                            ) : substituteMode ? (
                                <>
                                    <button
                                        style={{ ...styles.actionBtn, opacity: helperId ? 1 : 0.5 }}
                                        onClick={() => helperId && document.getElementById('subHelperPhotoInput').click()}
                                        disabled={!helperId}
                                    >
                                        📷 Photo
                                    </button>
                                    <input type="file" id="subHelperPhotoInput" accept="image/*" capture="user" style={{ display: 'none' }}
                                        onChange={(e) => handleSubstitutePhoto('helper', e)} />
                                </>
                            ) : (
                                <button
                                    style={{ ...styles.actionBtn, opacity: helperId ? 1 : 0.5 }}
                                    onClick={() => helperId && startFaceCapture('helper')}
                                    disabled={!helperId}
                                >
                                    Scan Face
                                </button>
                            )}
                        </div>
                    </div>

                    {/* VEHICLE SECTION */}
                    <div>
                        <div style={styles.sectionTitle}>
                            <span>🚛 Vehicle Photo</span>
                        </div>
                        <div style={styles.vehiclePreview} onClick={() => document.getElementById('vehicleInput').click()}>
                            {vehicleData.captured ? (
                                <img src={vehicleData.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Vehicle" />
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
                                    <div style={{ color: '#64748b', fontWeight: '600' }}>Tap to Capture Vehicle</div>
                                </div>
                            )}
                        </div>
                        <input type="file" id="vehicleInput" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleVehicleCapture} />
                    </div>
                </div>

                <div style={styles.footer}>
                    <button
                        style={{ ...styles.submitBtn, ...((isLoading || !(driverData.verified && vehicleData.captured)) ? styles.submitBtnDisabled : {}) }}
                        onClick={handleFinalSubmit}
                        disabled={isLoading || !driverData.verified || !vehicleData.captured}
                    >
                        {isLoading ? 'STARTING...' : 'START DUTY'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnifiedCheckin;
