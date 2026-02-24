import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Webcam from 'react-webcam';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_BASE = '/api/v1/attendance';

const styles = {
    // 1. Full Screen Layout
    container: {
        width: '100%',
        minHeight: '100vh',
        background: '#fff1f2', // Reddish tint
        display: 'flex',
        justifyContent: 'center',
        padding: 0
    },
    phoneFrame: {
        backgroundColor: 'white',
        width: '100%',
        maxWidth: '450px',
        minHeight: '100vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
    },
    header: {
        background: '#be123c', // Red
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
        paddingBottom: '100px'
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
        borderColor: '#be123c',
        background: '#fff1f2'
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
        background: '#be123c', // Red action
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
        color: '#be123c',
        border: '1px solid #be123c',
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
        border: '2px dashed #fda4af', // Red dashed
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#be123c',
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
        borderRadius: '14px',
        border: 'none',
        background: '#be123c', // Deep Red
        color: 'white',
        fontSize: '1.25rem',
        fontWeight: '700',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        boxShadow: '0 4px 6px -1px rgba(190, 18, 60, 0.3)'
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

const UnifiedCheckout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Expect tripId and initial data from Dashboard
    const { tripId, driverName, driverId, helperName, helperId: initialHelperId, routeName, orgCode, substituteMode, isSubstituteDriver, isSubstituteHelper } = location.state || {};

    const [step, setStep] = useState('idle');
    const [isLoading, setIsLoading] = useState(false);
    const [locationCoords, setLocationCoords] = useState(null);

    // Data State (Stored locally until final atomic submit)
    const isSubDriver = substituteMode || isSubstituteDriver;
    const isSubHelper = substituteMode || isSubstituteHelper;
    const [driverData, setDriverData] = useState({ verified: isSubDriver ? false : false, frames: [], challenge: null });

    // Helper logic: If trip has helper, we force verify. If not, hidden.
    const hasHelper = !!initialHelperId;
    const [helperData, setHelperData] = useState({ verified: !hasHelper, frames: [], challenge: null });

    const [vehicleData, setVehicleData] = useState({ captured: false, file: null, preview: null });

    // Substitute photo state
    const [subDriverPhoto, setSubDriverPhoto] = useState(null);
    const [subDriverPhotoPreview, setSubDriverPhotoPreview] = useState(null);
    const [subHelperPhoto, setSubHelperPhoto] = useState(null);
    const [subHelperPhotoPreview, setSubHelperPhotoPreview] = useState(null);

    // Camera & Burst State
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
            utterance.rate = 0.9; utterance.pitch = 1.1;
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
        if (!tripId) {
            alert("No Active Trip ID Provided");
            navigate('/employee/dashboard');
        }
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocationCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.error("GPS Error", err)
            );
        }
    }, [tripId, navigate]);

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
            // Safety Check
            if (!webcamRef.current || !webcamRef.current.getScreenshot) {
                clearInterval(interval); return;
            }

            const frame = webcamRef.current.getScreenshot();
            if (frame) {
                // Compress frame immediately (80% data savings)
                compressImage(frame, 0.5).then(compressed => {
                    capturedFramesRef.current.push(compressed);
                });
                frameCountRef.current += 1;
                const count = frameCountRef.current;

                if (count === 1) { setGuidanceText("Look Straight 😐"); }
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
        const { orgCode } = location.state || {};

        formData.append('org_code', orgCode);
        formData.append('employee_id', role === 'driver' ? driverId : initialHelperId);
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

    // --- VEHICLE ---
    const handleVehicleCapture = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVehicleData({ captured: true, file: file, preview: URL.createObjectURL(file) });
        }
    };

    // --- SUBSTITUTE PHOTO CAPTURE ---
    const handleSubPhoto = (role, e) => {
        const file = e.target.files[0];
        if (!file) return;
        const preview = URL.createObjectURL(file);
        if (role === 'driver') {
            setSubDriverPhoto(file);
            setSubDriverPhotoPreview(preview);
            setDriverData(prev => ({ ...prev, verified: true }));
        } else {
            setSubHelperPhoto(file);
            setSubHelperPhotoPreview(preview);
            setHelperData(prev => ({ ...prev, verified: true }));
        }
    };

    // --- FINAL SUBMIT ---
    const handleFinalSubmit = async () => {
        if (!window.confirm("Are you sure you want to END DUTY?")) return;

        setIsLoading(true);
        speak("Ending trip, please wait");

        const formData = new FormData();

        if (locationCoords) {
            formData.append('latitude', locationCoords.lat);
            formData.append('longitude', locationCoords.lng);
        }

        if (isSubDriver) {
            // SUBSTITUTE: Send single photo
            if (subDriverPhoto) {
                formData.append('driver_photo', subDriverPhoto);
            }
        } else {
            // NORMAL: Send face frames
            formData.append('driver_challenge_frame', driverData.challenge);
            await Promise.all(driverData.frames.map(async (frame, i) => {
                const res = await fetch(frame);
                const blob = await res.blob();
                formData.append('driver_frames', blob, `driver_${i}.jpg`);
            }));
        }

        if (hasHelper) {
            if (isSubHelper) {
                // SUBSTITUTE: Send single photo
                if (subHelperPhoto) {
                    formData.append('helper_photo', subHelperPhoto);
                }
            } else {
                // NORMAL: Send face frames
                formData.append('helper_challenge_frame', helperData.challenge);
                await Promise.all(helperData.frames.map(async (frame, i) => {
                    const res = await fetch(frame);
                    const blob = await res.blob();
                    formData.append('helper_frames', blob, `helper_${i}.jpg`);
                }));
            }
        }

        formData.append('vehicle_image', vehicleData.file);

        try {
            const res = await fetch(`${API_BASE}/trips/${tripId}/unified-checkout/`, {
                method: 'POST', body: formData
            });
            const data = await res.json();

            if (res.ok && data.success) {
                speak("Duty Ended Successfully");
                navigate('/employee/dashboard');
            } else {
                alert("Error: " + (data.error || "Checkout failed"));
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
                    <button
                        onClick={() => setStep('idle')}
                        style={{ marginTop: '30px', background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '1rem', textDecoration: 'underline' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // --- RENDER MAIN ---
    return (
        <div style={styles.container}>
            <LoadingOverlay isVisible={isLoading} message="Duty खत्म हो रही है..." />
            <div style={styles.phoneFrame}>
                <div style={styles.header}>
                    <h1 style={styles.headerTitle}>End Your Duty</h1>
                    <div style={styles.headerSubtitle}>{routeName}</div>
                </div>

                <div style={styles.content}>

                    {/* DRIVER SECTION */}
                    <div style={{ ...styles.card, ...(driverData.verified ? styles.cardVerified : {}) }}>
                        <div style={styles.avatar}>
                            {subDriverPhotoPreview ? (
                                <img src={subDriverPhotoPreview} alt="Sub" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <img
                                    src={`https://ui-avatars.com/api/?name=${driverName}&background=random`}
                                    alt="Driver"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            )}
                        </div>
                        <div style={styles.info}>
                            <div style={styles.label}>{isSubDriver ? '🔄 बदली Driver' : 'Driver'}</div>
                            <div style={styles.value}>{driverName}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {driverId}</div>
                        </div>
                        {driverData.verified ? (
                            <div style={styles.verifiedBadge}>{isSubDriver ? '📷 Photo Taken' : '✅ Verified'}</div>
                        ) : isSubDriver ? (
                            <>
                                <button style={styles.actionBtn} onClick={() => document.getElementById('subDriverPhotoOut').click()}>
                                    📷 Photo
                                </button>
                                <input type="file" id="subDriverPhotoOut" accept="image/*" capture="user"
                                    style={{ display: 'none' }} onChange={(e) => handleSubPhoto('driver', e)}
                                />
                            </>
                        ) : (
                            <button style={styles.actionBtn} onClick={() => startFaceCapture('driver')}>
                                Verify Face
                            </button>
                        )}
                    </div>

                    {/* HELPER SECTION */}
                    {hasHelper && (
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                            <div style={styles.sectionTitle}>
                                <span>👷 {isSubHelper ? '🔄 बदली Helper' : 'Helper Checkout'}</span>
                            </div>
                            <div style={{ ...styles.card, ...(helperData.verified ? styles.cardVerified : {}) }}>
                                <div style={styles.avatar}>
                                    {subHelperPhotoPreview ? (
                                        <img src={subHelperPhotoPreview} alt="Sub" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${helperName}&background=random`}
                                            alt="Helper"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}
                                </div>
                                <div style={styles.info}>
                                    <div style={styles.label}>{isSubHelper ? '🔄 बदली Helper' : 'Helper'}</div>
                                    <div style={styles.value}>{helperName}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {initialHelperId}</div>
                                </div>
                                {helperData.verified ? (
                                    <div style={styles.verifiedBadge}>{isSubHelper ? '📷 Photo Taken' : '✅ Verified'}</div>
                                ) : isSubHelper ? (
                                    <>
                                        <button style={styles.actionBtn} onClick={() => document.getElementById('subHelperPhotoOut').click()}>
                                            📷 Photo
                                        </button>
                                        <input type="file" id="subHelperPhotoOut" accept="image/*" capture="user"
                                            style={{ display: 'none' }} onChange={(e) => handleSubPhoto('helper', e)}
                                        />
                                    </>
                                ) : (
                                    <button style={styles.actionBtn} onClick={() => startFaceCapture('helper')}>
                                        Verify Helper
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

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
                                    <div style={{ color: '#be123c', fontWeight: '600' }}>Snap Vehicle Photo</div>
                                </div>
                            )}
                        </div>
                        <input type="file" id="vehicleInput" accept="image/*" capture="environment"
                            style={{ display: 'none' }} onChange={handleVehicleCapture}
                        />
                    </div>
                </div>

                <div style={styles.footer}>
                    <button
                        style={{ ...styles.submitBtn, ...((isLoading || !(driverData.verified && helperData.verified && vehicleData.captured)) ? styles.submitBtnDisabled : {}) }}
                        onClick={handleFinalSubmit}
                        disabled={isLoading || !driverData.verified || !helperData.verified || !vehicleData.captured}
                    >
                        {isLoading ? 'CLOSING TRIP...' : 'END DUTY'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnifiedCheckout;
