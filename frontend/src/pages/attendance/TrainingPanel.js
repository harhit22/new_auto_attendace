/**
 * Training Panel Component
 * Admin can view image counts, approve images, and train models
 */
import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import ImageGallery from './ImageGallery';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const TrainingPanel = ({ orgCode }) => {
    const webcamRef = useRef(null);
    const testWebcamRef = useRef(null);
    const [trainingStatus, setTrainingStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [capturedImages, setCapturedImages] = useState([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [viewingImages, setViewingImages] = useState(null);
    const [testingEmployee, setTestingEmployee] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [status, setStatus] = useState('');

    // Load training status
    useEffect(() => {
        if (orgCode) loadStatus();
    }, [orgCode]);

    const loadStatus = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/training-status/?org_code=${orgCode}`);
            const data = await res.json();
            if (res.ok) {
                setTrainingStatus(data);
            }
        } catch (e) {
            setStatus('Failed to load status');
        }
        setIsLoading(false);
    };

    const captureImage = () => {
        if (!webcamRef.current) return;
        const img = webcamRef.current.getScreenshot();
        if (img) {
            setCapturedImages(prev => [...prev, img]);
        }
    };

    const base64ToBlob = async (base64) => {
        const res = await fetch(base64);
        return await res.blob();
    };

    const uploadImages = async () => {
        if (!selectedEmployee || capturedImages.length === 0) return;

        setIsLoading(true);
        setStatus('⏳ Uploading images...');

        try {
            const formData = new FormData();
            formData.append('org_code', orgCode);
            formData.append('employee_id', selectedEmployee.employee_id);

            for (let i = 0; i < capturedImages.length; i++) {
                const blob = await base64ToBlob(capturedImages[i]);
                formData.append('images', blob, `face_${i}.jpg`);
            }

            const res = await fetch(`${API_BASE}/capture-images/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStatus(`✅ ${data.message}`);
                setCapturedImages([]);
                setIsCapturing(false);
                setSelectedEmployee(null);
                loadStatus();
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
        setIsLoading(false);
    };

    const approveImages = async (empId) => {
        try {
            const res = await fetch(`${API_BASE}/approve-images/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: empId })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`✅ ${data.message}`);
                loadStatus();
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const trainModel = async (mode) => {
        setIsTraining(true);
        setStatus(`⏳ Training with ${mode} mode...`);

        try {
            const res = await fetch(`${API_BASE}/train-model/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: orgCode, mode })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStatus(`✅ ${data.message}`);
                loadStatus();
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
        setIsTraining(false);
    };

    const copyEnrollLink = (emp) => {
        const link = `${window.location.origin}/enroll-employee?org=${orgCode}&emp=${emp.employee_id}`;
        navigator.clipboard.writeText(link);
        setStatus(`✅ Link copied! Send to ${emp.name}`);
    };

    const deleteEmployeeData = async (emp) => {
        if (!window.confirm(`Delete all images and reset model for ${emp.name}?`)) return;

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/delete-employee-data/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: orgCode, employee_id: emp.employee_id })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setStatus(`✅ ${data.message}`);
                loadStatus();
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
        setIsLoading(false);
    };

    const testModel = async () => {
        if (!testWebcamRef.current || !testingEmployee) return;

        const img = testWebcamRef.current.getScreenshot();
        if (!img) return;

        setIsLoading(true);
        setTestResult(null);

        try {
            const blob = await base64ToBlob(img);
            const formData = new FormData();
            formData.append('org_code', orgCode);
            formData.append('employee_id', testingEmployee.employee_id);
            formData.append('image', blob, 'test.jpg');

            const res = await fetch(`${API_BASE}/test-model/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setTestResult(data);
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
        setIsLoading(false);
    };

    if (isLoading && !trainingStatus) {
        return (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading...</p>
            </div>
        );
    }

    // Viewing Images Mode
    if (viewingImages) {
        return (
            <ImageGallery
                orgCode={orgCode}
                employeeId={viewingImages.employee_id}
                onClose={() => setViewingImages(null)}
            />
        );
    }

    // Test Mode - Test model accuracy
    if (testingEmployee) {
        return (
            <div className="card" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>🎯 Test Model: {testingEmployee.name}</h3>
                    <button className="btn btn-outline" onClick={() => { setTestingEmployee(null); setTestResult(null); }}>
                        ✕ Close
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
                            <Webcam
                                ref={testWebcamRef}
                                audio={false}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ width: 480, height: 360, facingMode: 'user' }}
                                style={{ width: '100%', display: 'block' }}
                                mirrored={true}
                            />
                        </div>
                        <button
                            className="btn btn-primary w-full btn-lg"
                            onClick={testModel}
                            disabled={isLoading}
                        >
                            {isLoading ? '⏳ Testing...' : '🎯 Test Recognition'}
                        </button>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                            Training Mode: <strong>{testingEmployee.training_mode || 'N/A'}</strong>
                        </p>
                    </div>

                    <div style={{ background: 'var(--bg-soft)', borderRadius: '16px', padding: '20px' }}>
                        <h4 style={{ marginBottom: '16px' }}>Test Results</h4>
                        {!testResult ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '40px' }}>
                                Click "Test Recognition" to see results
                            </p>
                        ) : (
                            <div>
                                <div style={{
                                    textAlign: 'center',
                                    padding: '20px',
                                    background: testResult.is_correct_match ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    borderRadius: '12px',
                                    marginBottom: '16px'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '8px' }}>
                                        {testResult.is_correct_match ? '✅' : '❌'}
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: '800', color: testResult.is_correct_match ? 'var(--success)' : 'var(--error)' }}>
                                        {testResult.confidence}%
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Confidence</div>
                                </div>

                                <div style={{ display: 'grid', gap: '8px', fontSize: '0.9rem' }}>
                                    <div><strong>Expected:</strong> {testResult.target_employee}</div>
                                    <div><strong>Matched:</strong> {testResult.matched_employee || 'No match'}</div>
                                    <div><strong>Distance:</strong> {testResult.min_distance} (threshold: {testResult.threshold})</div>
                                    <div><strong>Model:</strong> {testResult.training_mode}</div>
                                    <div><strong>Embeddings:</strong> {testResult.embeddings_count}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (isCapturing && selectedEmployee) {
        return (
            <div className="card" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>📸 Capture: {selectedEmployee.name}</h3>
                    <button className="btn btn-outline" onClick={() => { setIsCapturing(false); setCapturedImages([]); }}>
                        ✕ Cancel
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '16px' }}>
                            <Webcam
                                ref={webcamRef}
                                audio={false}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ width: 480, height: 360, facingMode: 'user' }}
                                style={{ width: '100%', display: 'block' }}
                                mirrored={true}
                            />
                        </div>
                        <button
                            className="btn btn-primary w-full btn-lg"
                            onClick={captureImage}
                        >
                            📷 Capture ({capturedImages.length})
                        </button>
                    </div>

                    <div>
                        <div style={{
                            background: 'var(--bg-soft)',
                            borderRadius: '12px',
                            padding: '16px',
                            height: '320px',
                            overflowY: 'auto'
                        }}>
                            <h4 style={{ marginBottom: '12px' }}>
                                Photos: {capturedImages.length}
                                <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}> (aim for 100+)</span>
                            </h4>
                            {capturedImages.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '60px' }}>
                                    Take photos from different angles
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {capturedImages.map((img, i) => (
                                        <div key={i} style={{
                                            width: '50px',
                                            height: '50px',
                                            borderRadius: '6px',
                                            background: `url(${img}) center/cover`,
                                            border: '2px solid var(--success)'
                                        }} />
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            className="btn btn-success w-full"
                            onClick={uploadImages}
                            disabled={capturedImages.length === 0 || isLoading}
                            style={{ marginTop: '12px' }}
                        >
                            {isLoading ? '⏳ Saving...' : '✅ Save Images (No Training Yet)'}
                        </button>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                            Images will be saved for admin to train later
                        </p>
                    </div>
                </div>

                {status && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-soft)', borderRadius: '8px', textAlign: 'center' }}>
                        {status}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: '30px' }}>
            <h2 style={{ marginBottom: '24px' }}>🎯 Model Training</h2>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-soft)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)' }}>
                        {trainingStatus?.total_employees || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Employees</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-soft)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--warning)' }}>
                        {trainingStatus?.awaiting_training || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Awaiting Train</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-soft)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--success)' }}>
                        {trainingStatus?.trained || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trained</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-soft)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>
                        {trainingStatus?.total_images || 0}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Images</div>
                </div>
            </div>

            {/* Training Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button
                    className="btn btn-primary btn-lg"
                    onClick={() => trainModel('light')}
                    disabled={isTraining || (trainingStatus?.awaiting_training || 0) === 0}
                    style={{ flex: 1 }}
                >
                    ⚡ Light Training (Quick, Fast)
                </button>
                <button
                    className="btn btn-success btn-lg"
                    onClick={() => trainModel('heavy')}
                    disabled={isTraining || (trainingStatus?.awaiting_training || 0) === 0}
                    style={{ flex: 1 }}
                >
                    🎯 Heavy Training (DeepFace, Accurate)
                </button>
            </div>

            {status && (
                <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--bg-soft)', borderRadius: '8px', textAlign: 'center' }}>
                    {status}
                </div>
            )}

            {/* Employee List */}
            <h3 style={{ marginBottom: '16px' }}>Employee Datasets</h3>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid var(--bg-soft)' }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Employee</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Images</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>Model</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trainingStatus?.employees?.map(emp => (
                            <tr key={emp.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                <td style={{ padding: '10px' }}>
                                    <strong>{emp.name}</strong>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.employee_id}</div>
                                </td>
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <span style={{
                                        fontWeight: '600',
                                        color: emp.image_count >= 100 ? 'var(--success)' : emp.image_count > 0 ? 'var(--warning)' : 'var(--text-muted)'
                                    }}>
                                        {emp.image_count}
                                    </span>
                                </td>
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <span className={`status-badge ${emp.image_status === 'trained' ? 'success' :
                                        emp.image_status === 'captured' ? 'warning' : ''
                                        }`} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                                        {emp.image_status}
                                    </span>
                                </td>
                                <td style={{ padding: '10px', textAlign: 'center', fontSize: '0.75rem' }}>
                                    {emp.training_mode ? (
                                        <span style={{
                                            color: emp.training_mode.includes('heavy') ? 'var(--success)' : 'var(--primary)',
                                            fontWeight: '500'
                                        }}>
                                            {emp.training_mode.includes('heavy') ? '🎯 DeepFace' : '⚡ Quick'}
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                                    )}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                        {emp.image_count > 0 && (
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                                onClick={() => setViewingImages(emp)}
                                            >
                                                🖼️
                                            </button>
                                        )}
                                        {emp.image_status === 'pending' && (
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                                onClick={() => copyEnrollLink(emp)}
                                            >
                                                📋
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                            onClick={() => { setSelectedEmployee(emp); setIsCapturing(true); }}
                                        >
                                            📷
                                        </button>
                                        {emp.image_status === 'trained' && (
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--success)' }}
                                                onClick={() => setTestingEmployee(emp)}
                                            >
                                                🎯
                                            </button>
                                        )}
                                        {emp.image_count > 0 && (
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--error)' }}
                                                onClick={() => deleteEmployeeData(emp)}
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TrainingPanel;
