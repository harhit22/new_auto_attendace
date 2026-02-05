/**
 * Driver Checkout Page
 * Step 4 of Trip Workflow: Driver Face Verification for Checkout
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const API_BASE = '/api/v1/attendance';  // Uses relative path for nginx proxy

const DriverCheckoutPage = () => {
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const [employee, setEmployee] = useState(null);
    const [status, setStatus] = useState('Checking for active trip...');
    const [error, setError] = useState('');
    const [tripId, setTripId] = useState(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        const stored = sessionStorage.getItem('employee');
        if (!stored) {
            navigate('/employee/login');
            return;
        }
        const emp = JSON.parse(stored);
        setEmployee(emp);
        checkActiveTrip(emp);
        loadModels();
    }, []);

    const loadModels = async () => {
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/models')
            ]);
            setModelsLoaded(true);
        } catch (e) {
            console.error(e);
            setError('Failed to load recognition models');
        }
    };

    const checkActiveTrip = async (emp) => {
        try {
            const res = await fetch(`${API_BASE}/trips/active-trip/?org_code=${emp.org_code}&employee_id=${emp.employee_id}`);
            const data = await res.json();

            if (data.found) {
                setTripId(data.trip_id);
                setStatus('📸 Please verify your face to check out');
            } else {
                setError('No active trip found to check out from.');
                setStatus('Redirecting...');
                setTimeout(() => navigate('/employee/dashboard'), 3000);
            }
        } catch (e) {
            setError('Connection error');
        }
    };

    const verifyAndCheckout = async () => {
        if (!webcamRef.current || !modelsLoaded || isVerifying || !tripId) return;

        setIsVerifying(true);
        setStatus('🔍 Detecting face...');

        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) {
                setStatus('❌ Capture failed');
                setIsVerifying(false);
                return;
            }

            // Client-side detection Check
            const imgEl = document.createElement('img');
            imgEl.src = imageSrc;
            await new Promise(r => imgEl.onload = r);

            const detection = await faceapi.detectSingleFace(imgEl, new faceapi.TinyFaceDetectorOptions());
            if (!detection) {
                setStatus('⚠️ No face detected. Please try again.');
                setIsVerifying(false);
                return;
            }

            // Backend verification
            setStatus('📤 Verifying with server...');
            const formData = new FormData();
            const blob = await (await fetch(imageSrc)).blob();
            formData.append('image', blob, 'checkout_face.jpg');

            const res = await fetch(`${API_BASE}/trips/${tripId}/driver-checkout/`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setStatus('✅ Checkout Verified!');
                setTimeout(() => {
                    if (data.next_step === 'helper-checkout') {
                        navigate(`/employee/helper-checkout?trip=${tripId}`);
                    } else if (data.next_step === 'vehicle-checkout') {
                        navigate(`/employee/vehicle-capture?trip=${tripId}&action=checkout`);
                    } else {
                        navigate('/employee/dashboard');
                    }
                }, 1500);
            } else {
                setStatus(`❌ ${data.error || 'Verification Failed'}`);
                setError(data.error);
            }

        } catch (e) {
            console.error(e);
            setStatus('❌ System Error');
        }
        setIsVerifying(false);
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-muted)', padding: '20px' }}>
            <div className="card" style={{ maxWidth: '500px', margin: '40px auto', padding: '30px', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>📤 Driver Checkout</h2>

                {error ? (
                    <div style={{ padding: '20px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '10px' }}>
                        {error}
                        <button onClick={() => navigate('/employee/dashboard')} className="btn btn-outline" style={{ marginTop: '16px', width: '100%' }}>
                            Back to Dashboard
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: '20px', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
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
                                <div style={{ height: '300px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    Loading Camera...
                                </div>
                            )}
                        </div>

                        <div style={{
                            padding: '12px',
                            marginBottom: '20px',
                            background: status.includes('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                            color: status.includes('✅') ? '#22c55e' : '#3b82f6',
                            borderRadius: '8px',
                            fontWeight: '500'
                        }}>
                            {status}
                        </div>

                        <button
                            onClick={verifyAndCheckout}
                            disabled={isVerifying || !tripId || !modelsLoaded}
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%' }}
                        >
                            {isVerifying ? 'Verifying...' : 'Verify to Checkout'}
                        </button>

                        <button
                            onClick={() => navigate('/employee/dashboard')}
                            className="btn btn-outline"
                            style={{ width: '100%', marginTop: '12px' }}
                        >
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default DriverCheckoutPage;
