/**
 * Employee Face Enrollment Page
 * Captures face images for an employee and enrolls them in the system
 */
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const EnrollEmployeePage = () => {
    const webcamRef = useRef(null);
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [capturedImages, setCapturedImages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [step, setStep] = useState(1); // 1: Select, 2: Capture, 3: Done

    // Load organizations
    useEffect(() => {
        fetch(`${API_BASE}/organizations/`)
            .then(r => r.json())
            .then(data => {
                setOrganizations(data.organizations || []);
                if (data.organizations?.length > 0) {
                    setSelectedOrg(data.organizations[0]);
                }
            })
            .catch(e => console.error(e));
    }, []);

    // Load employees when org changes
    useEffect(() => {
        if (!selectedOrg) return;

        fetch(`${API_BASE}/employees/?organization_id=${selectedOrg.id}`)
            .then(r => r.json())
            .then(data => {
                // Filter only employees without face enrolled
                setEmployees(data.employees || []);
            })
            .catch(e => console.error(e));
    }, [selectedOrg]);

    const base64ToBlob = async (base64) => {
        const res = await fetch(base64);
        return await res.blob();
    };

    const captureImage = () => {
        if (!webcamRef.current) return;
        const img = webcamRef.current.getScreenshot();
        if (img) {
            setCapturedImages(prev => [...prev, img]);
            setStatus(`📸 Captured ${capturedImages.length + 1} images`);
        }
    };

    const enrollFace = async () => {
        if (!selectedEmployee || capturedImages.length < 3) {
            setStatus('⚠️ Need at least 3 face images');
            return;
        }

        setIsLoading(true);
        setStatus('🔄 Enrolling face with ArcFace...');

        try {
            const formData = new FormData();
            for (let i = 0; i < capturedImages.length; i++) {
                const blob = await base64ToBlob(capturedImages[i]);
                formData.append('images', blob, `face_${i}.jpg`);
            }

            const res = await fetch(`${API_BASE}/employees/${selectedEmployee.id}/enroll-face/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                setStatus(`✅ Face enrolled! ${data.embeddings_count} embeddings created`);
                setStep(3);
                // Update employee in list
                setEmployees(prev => prev.map(e =>
                    e.id === selectedEmployee.id ? { ...e, face_enrolled: true } : e
                ));
            } else {
                setStatus(`❌ Error: ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const resetEnrollment = () => {
        setSelectedEmployee(null);
        setCapturedImages([]);
        setStatus('');
        setStep(1);
    };

    return (
        <div className="container">
            {/* Wave Hero */}
            <div className="wave-hero" style={{ minHeight: '250px', paddingBottom: '100px' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">👤</span>
                        <span>Face Enrollment</span>
                    </div>
                    <nav className="nav">
                        <a href="/" className="nav-link">Home</a>
                        <a href="/dashboard" className="nav-link">Dashboard</a>
                        <a href="/enroll-employee" className="nav-link active">Enroll Face</a>
                        <a href="/kiosk" className="nav-link">Kiosk</a>
                    </nav>
                </div>

                <div style={{ textAlign: 'center', padding: '20px', position: 'relative', zIndex: 1 }}>
                    <h1 className="page-title">Employee Face Enrollment</h1>
                    <p className="page-subtitle">Capture face images to enable check-in/out</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                {status && (
                    <div className={`status-badge ${status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : 'warning'}`}
                        style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', padding: '14px 28px' }}>
                        {status}
                    </div>
                )}

                {/* Step 1: Select Employee */}
                {step === 1 && (
                    <div className="card fade-in">
                        <h2 style={{ marginBottom: '24px' }}>Select Employee to Enroll</h2>

                        {organizations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                    No organizations found. Create one first.
                                </p>
                                <a href="/dashboard" className="btn btn-primary">Go to Dashboard</a>
                            </div>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Organization</label>
                                    <select
                                        className="form-input"
                                        value={selectedOrg?.id || ''}
                                        onChange={e => setSelectedOrg(organizations.find(o => o.id === e.target.value))}
                                    >
                                        {organizations.map(o => (
                                            <option key={o.id} value={o.id}>{o.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ marginTop: '24px' }}>
                                    <h3 style={{ marginBottom: '16px' }}>Employees</h3>
                                    {employees.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '30px', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)' }}>
                                            <p style={{ color: 'var(--text-secondary)' }}>No employees found. Add some first.</p>
                                            <a href="/dashboard" className="btn btn-outline" style={{ marginTop: '12px' }}>Add Employees</a>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                                            {employees.map(emp => (
                                                <div
                                                    key={emp.id}
                                                    onClick={() => {
                                                        if (!emp.face_enrolled) {
                                                            setSelectedEmployee(emp);
                                                            setStep(2);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '20px',
                                                        background: emp.face_enrolled ? 'var(--bg-soft)' : 'var(--bg-white)',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: emp.face_enrolled ? '2px solid var(--bg-soft)' : '2px solid var(--primary)',
                                                        cursor: emp.face_enrolled ? 'default' : 'pointer',
                                                        opacity: emp.face_enrolled ? 0.7 : 1,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{
                                                            width: '50px', height: '50px',
                                                            borderRadius: '50%',
                                                            background: emp.face_enrolled ? 'var(--gradient-success)' : 'var(--gradient-primary)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            color: 'white', fontSize: '1.5rem'
                                                        }}>
                                                            {emp.face_enrolled ? '✓' : '👤'}
                                                        </div>
                                                        <div>
                                                            <strong>{emp.name || `${emp.first_name} ${emp.last_name}`}</strong>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                {emp.employee_id} • {emp.department || 'No dept'}
                                                            </div>
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                color: emp.face_enrolled ? 'var(--success)' : 'var(--warning)'
                                                            }}>
                                                                {emp.face_enrolled ? '✅ Face enrolled' : '⚠️ Not enrolled'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Step 2: Capture Images */}
                {step === 2 && selectedEmployee && (
                    <div className="grid-2">
                        <div className="card fade-in">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                <div style={{
                                    width: '60px', height: '60px',
                                    borderRadius: '50%',
                                    background: 'var(--gradient-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '1.8rem'
                                }}>👤</div>
                                <div>
                                    <h2 style={{ marginBottom: '4px' }}>{selectedEmployee.name || `${selectedEmployee.first_name} ${selectedEmployee.last_name}`}</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        {selectedEmployee.employee_id} • {selectedEmployee.department || 'No department'}
                                    </p>
                                </div>
                            </div>

                            <div className="webcam-container" style={{ marginBottom: '16px' }}>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                                    style={{ width: '100%' }}
                                    mirrored={true}
                                />
                            </div>

                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <span style={{
                                    display: 'inline-block',
                                    padding: '8px 20px',
                                    background: capturedImages.length >= 3 ? 'var(--gradient-success)' : 'var(--bg-soft)',
                                    borderRadius: 'var(--radius-full)',
                                    fontWeight: '600',
                                    color: capturedImages.length >= 3 ? 'white' : 'var(--text-secondary)'
                                }}>
                                    {capturedImages.length} / 3+ images
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button className="btn btn-secondary" onClick={captureImage} disabled={isLoading}>
                                    📷 Capture
                                </button>
                                <button className="btn btn-success" onClick={enrollFace}
                                    disabled={isLoading || capturedImages.length < 3}>
                                    ✅ Enroll Face
                                </button>
                                <button className="btn btn-outline" onClick={resetEnrollment} disabled={isLoading}>
                                    ← Back
                                </button>
                            </div>
                        </div>

                        <div className="card fade-in delay-1">
                            <h3 style={{ marginBottom: '16px' }}>Captured Images</h3>
                            {capturedImages.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)' }}>
                                    <p style={{ color: 'var(--text-secondary)' }}>
                                        Capture at least 3 images from different angles
                                    </p>
                                </div>
                            ) : (
                                <div className="images-grid">
                                    {capturedImages.map((img, i) => (
                                        <div key={i} className="image-thumb">
                                            <img src={img} alt={`Capture ${i + 1}`} />
                                            <span className="index">{i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)' }}>
                                <h4 style={{ marginBottom: '8px' }}>📋 Tips for best results:</h4>
                                <ul style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginLeft: '20px' }}>
                                    <li>Look directly at camera</li>
                                    <li>Turn slightly left and right</li>
                                    <li>Good lighting on face</li>
                                    <li>Remove glasses/hat if possible</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Done */}
                {step === 3 && (
                    <div className="card fade-in" style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ fontSize: '5rem', marginBottom: '20px' }}>🎉</div>
                        <h2 style={{ marginBottom: '16px', color: 'var(--success)' }}>Face Enrolled Successfully!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', maxWidth: '400px', margin: '0 auto 30px' }}>
                            {selectedEmployee?.name || `${selectedEmployee?.first_name} ${selectedEmployee?.last_name}`} can now check in/out using face recognition.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={resetEnrollment}>
                                👤 Enroll Another
                            </button>
                            <a href="/kiosk" className="btn btn-success">
                                🖥️ Go to Kiosk
                            </a>
                            <a href="/dashboard" className="btn btn-outline">
                                📊 Dashboard
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnrollEmployeePage;
