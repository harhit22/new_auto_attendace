/**
 * Vehicle Capture Page - WORKER FRIENDLY (Rusty Thumbs)
 * Mobile-first, Hindi labels, Large touch targets
 */
import React, { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';

const API_BASE = '/api/v1/attendance';

const VehicleCapturePage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const tripId = searchParams.get('trip');
    const action = searchParams.get('action') || 'checkin';

    const webcamRef = useRef(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [complianceResult, setComplianceResult] = useState(null);

    const driver = JSON.parse(sessionStorage.getItem('employee') || '{}');

    const capture = useCallback(() => {
        if (webcamRef.current) {
            const screenshot = webcamRef.current.getScreenshot();
            setCapturedImage(screenshot);
            setStatus('');
            setComplianceResult(null);
        }
    }, [webcamRef]);

    const retake = () => {
        setCapturedImage(null);
        setStatus('');
        setComplianceResult(null);
    };

    const submitForCompliance = async () => {
        if (!capturedImage) {
            setStatus('❌ पहले फोटो लें');
            return;
        }

        setIsLoading(true);
        setStatus('⏳ चेक हो रहा है...');

        try {
            const formData = new FormData();
            const blob = await (await fetch(capturedImage)).blob();
            formData.append('image', blob, 'vehicle.jpg');

            const endpoint = action === 'checkout'
                ? `${API_BASE}/trips/${tripId}/vehicle-checkout/`
                : `${API_BASE}/trips/${tripId}/vehicle-checkin/`;

            const res = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                setComplianceResult(data);
                setStatus(data.compliance_passed ? '✅ सब ठीक है!' : '❌ समस्या है');
            } else {
                setStatus(`❌ ${data.error || 'गड़बड़ी हुई'}`);
            }
        } catch (e) {
            console.error(e);
            setStatus('❌ नेटवर्क एरर');
        }

        setIsLoading(false);
    };

    const goToDashboard = () => {
        navigate('/employee/dashboard');
    };

    // Styles - Worker Friendly
    const styles = {
        container: {
            minHeight: '100vh',
            background: '#f1f5f9',
            display: 'flex',
            flexDirection: 'column'
        },
        header: {
            background: '#10b981',
            padding: '20px 16px',
            color: 'white',
            textAlign: 'center',
            borderBottom: '4px solid #047857'
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
            padding: '16px',
            display: 'flex',
            flexDirection: 'column'
        },
        cameraBox: {
            background: '#000',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '4px solid #10b981',
            marginBottom: '16px'
        },
        capturedImage: {
            width: '100%',
            display: 'block',
            borderRadius: '12px',
            border: '4px solid #10b981',
            marginBottom: '16px'
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
            background: '#10b981',
            color: 'white',
            boxShadow: '0 6px 0 #047857'
        },
        secondaryBtn: {
            background: '#3b82f6',
            color: 'white',
            boxShadow: '0 6px 0 #1d4ed8'
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
        resultBox: {
            padding: '24px',
            borderRadius: '16px',
            textAlign: 'center',
            marginBottom: '16px'
        },
        issueItem: {
            padding: '16px',
            background: '#fee2e2',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            marginBottom: '10px',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: '#dc2626',
            textAlign: 'left'
        }
    };

    // Render Compliance Result
    const renderComplianceDetails = () => {
        if (!complianceResult) return null;

        const { checks } = complianceResult;
        const passed = complianceResult.compliance_passed;

        const issues = [];
        if (checks?.required && !checks.required.passed) {
            const missing = checks.required.missing || [];
            if (missing.some(m => m.toLowerCase().includes('hooter'))) issues.push('🔔 Hooter नहीं दिखा');
            if (missing.some(m => m.toLowerCase().includes('nagar') || m.toLowerCase().includes('nigam'))) issues.push('🏛️ नगर निगम नहीं दिखा');
            if (missing.some(m => m.toLowerCase().includes('logo'))) issues.push('🎯 Logo नहीं दिखा');
        }
        if (checks?.number_plate && !checks.number_plate.passed) {
            issues.push('🔢 Number Plate नहीं दिखी');
        }

        return (
            <div style={{ padding: '0' }}>
                {/* Big Result */}
                <div style={{
                    ...styles.resultBox,
                    background: passed ? '#10b981' : '#dc2626',
                    color: 'white'
                }}>
                    <div style={{ fontSize: '4rem', marginBottom: '8px' }}>
                        {passed ? '✅' : '❌'}
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: '800' }}>
                        {passed ? 'सब ठीक है!' : 'समस्या है'}
                    </div>
                </div>

                {/* Issues */}
                {!passed && issues.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        {issues.map((issue, idx) => (
                            <div key={idx} style={styles.issueItem}>{issue}</div>
                        ))}
                    </div>
                )}

                {/* Action Button */}
                <button
                    onClick={goToDashboard}
                    style={{
                        ...styles.bigButton,
                        ...(passed ? styles.primaryBtn : styles.outlineBtn),
                        color: passed ? 'white' : '#64748b'
                    }}
                >
                    {passed ? '✅ आगे बढ़ें' : 'ठीक है, बंद करें'}
                </button>
            </div>
        );
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.headerTitle}>
                    🚗 गाड़ी की फोटो
                </h1>
                <div style={styles.headerSub}>
                    {action === 'checkout' ? 'Duty Out' : 'Duty In'} • {driver.name || driver.first_name || 'Driver'}
                </div>
            </div>

            {/* Content */}
            <div style={styles.content}>
                {!complianceResult ? (
                    <>
                        {!capturedImage ? (
                            <>
                                {/* Camera */}
                                <div style={styles.cameraBox}>
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        videoConstraints={{ facingMode: 'environment' }}
                                        style={{ width: '100%', display: 'block' }}
                                    />
                                </div>

                                {/* Capture Button */}
                                <button
                                    onClick={capture}
                                    style={{ ...styles.bigButton, ...styles.primaryBtn }}
                                >
                                    📸 फोटो लें
                                </button>

                                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '1rem' }}>
                                    गाड़ी पर कैमरा करें और बटन दबाएं
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Preview */}
                                <img
                                    src={capturedImage}
                                    alt="Captured"
                                    style={styles.capturedImage}
                                />

                                {/* Status */}
                                {status && (
                                    <div style={{
                                        ...styles.statusBox,
                                        background: status.includes('ठीक') ? '#dcfce7' : status.includes('समस्या') || status.includes('❌') ? '#fee2e2' : '#e0f2fe',
                                        color: status.includes('ठीक') ? '#166534' : status.includes('समस्या') || status.includes('❌') ? '#991b1b' : '#075985'
                                    }}>
                                        {status}
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    onClick={submitForCompliance}
                                    disabled={isLoading}
                                    style={{
                                        ...styles.bigButton,
                                        ...styles.secondaryBtn,
                                        opacity: isLoading ? 0.7 : 1
                                    }}
                                >
                                    {isLoading ? '⏳ चेक हो रहा है...' : '✅ सबमिट करें'}
                                </button>

                                {/* Retake Button */}
                                <button
                                    onClick={retake}
                                    style={{ ...styles.bigButton, ...styles.outlineBtn }}
                                >
                                    🔄 दोबारा फोटो लें
                                </button>
                            </>
                        )}
                    </>
                ) : (
                    renderComplianceDetails()
                )}
            </div>
        </div>
    );
};

export default VehicleCapturePage;
