/**
 * Heavy Model Page - DeepFace/ArcFace Training
 * Dedicated page for Heavy model training and management (high accuracy)
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Webcam from 'react-webcam';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const HeavyModelPage = () => {
    const navigate = useNavigate();
    const { attendanceOrg } = useAuth();
    const webcamRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [selectedDept, setSelectedDept] = useState('all');
    const [departments, setDepartments] = useState([]);
    const [status, setStatus] = useState('');
    const [isTraining, setIsTraining] = useState(false);
    const [testingEmployee, setTestingEmployee] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [expandedEmployee, setExpandedEmployee] = useState(null);
    const [employeeImages, setEmployeeImages] = useState({});

    useEffect(() => {
        if (!attendanceOrg) return;
        loadAllData();
    }, [attendanceOrg]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/training-status/?org_code=${attendanceOrg.org_code}`);
            const data = await res.json();
            setEmployees(data.employees || []);
            const depts = [...new Set((data.employees || []).map(e => e.department).filter(Boolean))];
            setDepartments(depts);
        } catch (e) {
            console.error('Failed to load:', e);
            setStatus('❌ Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const loadEmployeeImages = async (empId) => {
        try {
            const res = await fetch(`${API_BASE}/employee-images/?org_code=${attendanceOrg.org_code}&employee_id=${empId}`);
            const data = await res.json();
            setEmployeeImages(prev => ({ ...prev, [empId]: data.images || [] }));
        } catch (e) {
            console.error('Failed to load images:', e);
        }
    };

    const trainHeavyModel = async () => {
        setIsTraining(true);
        setStatus('🔄 Training Heavy Model (DeepFace/ArcFace)... This may take a few minutes.');

        try {
            const res = await fetch(`${API_BASE}/train-model/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: attendanceOrg.org_code, mode: 'heavy' })
            });
            const data = await res.json();

            if (data.success) {
                setStatus(`✅ ${data.message}`);
                loadAllData();
            } else {
                setStatus(`❌ ${data.error || 'Training failed'}`);
            }
        } catch (e) {
            setStatus(`❌ Training error: ${e.message}`);
        } finally {
            setIsTraining(false);
        }
    };

    const testEmployee = async () => {
        if (!webcamRef.current || !testingEmployee) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setStatus('🔄 Testing...');
        try {
            const res = await fetch(imageSrc);
            const blob = await res.blob();

            const formData = new FormData();
            formData.append('org_code', attendanceOrg.org_code);
            formData.append('employee_id', testingEmployee.employee_id);
            formData.append('image', blob, 'test.jpg');

            const testRes = await fetch(`${API_BASE}/test-model/`, { method: 'POST', body: formData });
            const data = await testRes.json();

            setTestResult(data);
            setStatus(data.success ? `✅ ${data.confidence}% confidence` : `❌ ${data.error}`);
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    // Train single employee (for new employees or retraining)
    const trainSingleEmployee = async (emp) => {
        setStatus(`🔄 Training ${emp.name} with Heavy model...`);
        try {
            const res = await fetch(`${API_BASE}/train-employee/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_code: attendanceOrg.org_code,
                    employee_id: emp.employee_id,
                    mode: 'heavy'
                })
            });
            const data = await res.json();
            if (data.success) {
                setStatus(`✅ ${data.message}`);
                loadAllData();
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const filteredEmployees = selectedDept === 'all' ? employees : employees.filter(e => e.department === selectedDept);
    const trainedCount = employees.filter(e => e.heavy_trained).length;
    const readyCount = employees.filter(e => !e.heavy_trained && e.ready_for_heavy).length;
    const notReadyCount = employees.filter(e => !e.ready_for_heavy).length;

    return (
        <div className="container">
            {/* Header - Purple for Heavy Model */}
            <div className="wave-hero" style={{ minHeight: '180px', paddingBottom: '60px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">🧠</span>
                        <span>Heavy Model</span>
                    </div>
                    <nav className="nav">
                        <button onClick={() => navigate('/attendance/admin/models')} className="nav-link">← Back to Models</button>
                    </nav>
                </div>
                <div style={{ textAlign: 'center', padding: '10px' }}>
                    <h1 className="page-title">Heavy Model Training</h1>
                    <p className="page-subtitle">DeepFace/ArcFace • ~99% accuracy • Requires 100+ images</p>
                </div>
            </div>

            <div className="main-content">
                {status && (
                    <div className={`status-badge ${status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : ''}`}
                        style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', padding: '12px 24px' }}>
                        {status}
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>⏳ Loading...</div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="stats-grid mb-lg" style={{ padding: 0 }}>
                            <div className="card" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#8b5cf6' }}>{employees.length}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>Total Employees</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>{trainedCount}</div>
                                <div style={{ color: '#10b981' }}>🧠 Heavy Trained</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#f59e0b' }}>{readyCount}</div>
                                <div style={{ color: '#f59e0b' }}>⏳ Ready to Train</div>
                            </div>
                            <div className="card" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-muted)' }}>{notReadyCount}</div>
                                <div style={{ color: 'var(--text-secondary)' }}>Need 100+ Images</div>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="card" style={{ marginBottom: '24px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
                                <div>
                                    <strong style={{ color: '#8b5cf6' }}>Heavy Model Requirements</strong>
                                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
                                        Each employee needs <strong>100+ face images</strong> for DeepFace training.
                                        This model takes longer to train but provides <strong>~99% accuracy</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Train Button */}
                        <div className="card" style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={trainHeavyModel}
                                    disabled={isTraining || readyCount === 0}
                                    style={{ padding: '16px 32px', fontSize: '1.1rem', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
                                >
                                    🧠 Train All Heavy Models
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>Slow (~2 min) • Uses DeepFace/ArcFace</div>
                                </button>
                                <button className="btn btn-outline" onClick={loadAllData} disabled={isTraining}>🔄 Refresh</button>
                            </div>
                            {isTraining && (
                                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="spinner"></div>
                                    <span>Training in progress... This may take several minutes.</span>
                                </div>
                            )}
                        </div>

                        {/* Department Filter */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                            <button className={`btn ${selectedDept === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSelectedDept('all')}>
                                All ({employees.length})
                            </button>
                            {departments.map(d => (
                                <button key={d} className={`btn ${selectedDept === d ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSelectedDept(d)}>
                                    {d} ({employees.filter(e => e.department === d).length})
                                </button>
                            ))}
                        </div>

                        {/* Employee Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                            {filteredEmployees.map(emp => (
                                <div key={emp.id} className="card" style={{ padding: '16px', opacity: emp.ready_for_heavy ? 1 : 0.6 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                        <div style={{
                                            width: '45px', height: '45px', borderRadius: '50%',
                                            background: emp.heavy_trained ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'var(--bg-soft)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1rem', fontWeight: '600', color: emp.heavy_trained ? 'white' : 'var(--text-secondary)'
                                        }}>
                                            {emp.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600' }}>{emp.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.employee_id}</div>
                                        </div>
                                        <span style={{
                                            padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                                            background: emp.heavy_trained ? 'rgba(16, 185, 129, 0.1)' :
                                                emp.ready_for_heavy ? 'rgba(245, 158, 11, 0.1)' : 'rgba(100, 100, 100, 0.1)',
                                            color: emp.heavy_trained ? '#10b981' :
                                                emp.ready_for_heavy ? '#f59e0b' : 'var(--text-muted)'
                                        }}>
                                            {emp.heavy_trained ? '✅ Trained' :
                                                emp.ready_for_heavy ? '⏳ Ready' : '❌ Need 100+ img'}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                        📷 <span style={{ fontWeight: '600', color: emp.ready_for_heavy ? '#10b981' : '#ef4444' }}>{emp.image_count || 0}</span>/100 images
                                        • {emp.department || 'No Dept'}
                                        {emp.heavy_accuracy && <span style={{ marginLeft: '8px', color: '#8b5cf6' }}>🎯 {emp.heavy_accuracy}%</span>}
                                    </div>

                                    {/* Progress bar for images */}
                                    <div style={{ height: '6px', background: 'var(--bg-soft)', borderRadius: '3px', marginBottom: '12px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${Math.min(100, (emp.image_count / 100) * 100)}%`,
                                            height: '100%',
                                            background: emp.ready_for_heavy ? '#10b981' : 'linear-gradient(90deg, #ef4444, #f59e0b)',
                                            borderRadius: '3px',
                                            transition: 'width 0.3s'
                                        }}></div>
                                    </div>

                                    {expandedEmployee === emp.employee_id && employeeImages[emp.employee_id] && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '12px', maxHeight: '150px', overflowY: 'auto' }}>
                                            {employeeImages[emp.employee_id].slice(0, 15).map((img, idx) => (
                                                <img key={idx} src={`http://localhost:8000${img.url}`} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px' }} />
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {emp.image_count > 0 && (
                                            <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                                onClick={() => {
                                                    if (expandedEmployee === emp.employee_id) setExpandedEmployee(null);
                                                    else { setExpandedEmployee(emp.employee_id); if (!employeeImages[emp.employee_id]) loadEmployeeImages(emp.employee_id); }
                                                }}>
                                                {expandedEmployee === emp.employee_id ? 'Hide' : '📷 Images'}
                                            </button>
                                        )}
                                        {/* Train/Retrain button - only for employees with 100+ images */}
                                        {emp.ready_for_heavy && (
                                            <button
                                                className="btn"
                                                style={{
                                                    fontSize: '0.75rem',
                                                    padding: '4px 10px',
                                                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                                    color: 'white',
                                                    border: 'none'
                                                }}
                                                onClick={() => trainSingleEmployee(emp)}
                                            >
                                                🧠 {emp.heavy_trained ? 'Retrain' : 'Train'}
                                            </button>
                                        )}
                                        {emp.heavy_trained && (
                                            <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setTestingEmployee(emp)}>
                                                🎯 Test
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Test Modal */}
                {testingEmployee && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                        <div className="card" style={{ maxWidth: '450px', width: '100%' }}>
                            <h3>🎯 Test: {testingEmployee.name}</h3>
                            <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ width: 400, height: 300, facingMode: 'user' }} style={{ width: '100%', borderRadius: '8px', marginTop: '12px' }} mirrored={true} />
                            {testResult && (
                                <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: testResult.is_correct_match ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem' }}>{testResult.is_correct_match ? '✅' : '❌'}</div>
                                    <div style={{ fontWeight: '600', color: testResult.is_correct_match ? '#10b981' : '#ef4444' }}>{testResult.confidence}%</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                                <button className="btn btn-outline" onClick={() => { setTestingEmployee(null); setTestResult(null); }}>Close</button>
                                <button className="btn btn-primary" onClick={testEmployee}>📸 Test</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HeavyModelPage;
