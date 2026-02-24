/**
 * Face Model Page - InsightFace Training
 * Left: Employee list | Right: Selected employee details + images
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Webcam from 'react-webcam';

const API_BASE = '/api/v1/attendance';

const FaceModelPage = () => {
    const navigate = useNavigate();
    const { attendanceOrg } = useAuth();
    const webcamRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    // const [selectedIds, setSelectedIds] = useState(new Set()); // Removed Employee Multi-select
    const [selectedImageNames, setSelectedImageNames] = useState(new Set()); // Multi-select Images
    const [imageSize, setImageSize] = useState(100); // Image Zoom Size
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [employeeImages, setEmployeeImages] = useState({});
    const [status, setStatus] = useState('');
    const [isTraining, setIsTraining] = useState(false);
    const [testMode, setTestMode] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // Filter states
    const [searchName, setSearchName] = useState('');
    const [filterImages, setFilterImages] = useState('all'); // 'all', 'has', 'none'
    const [filterTrained, setFilterTrained] = useState('all'); // 'all', 'trained', 'untrained'

    // Memoized Filtered List
    const filteredEmployees = useMemo(() => {
        return employees.filter(e => {
            if (searchName) {
                const search = searchName.toLowerCase();
                if (!e.name?.toLowerCase().includes(search) && !e.employee_id?.toLowerCase().includes(search)) return false;
            }
            if (filterImages === 'has' && (e.image_count || 0) <= 0) return false;
            if (filterImages === 'none' && (e.image_count || 0) > 0) return false;
            if (filterTrained === 'trained' && !e.light_trained) return false;
            if (filterTrained === 'untrained' && e.light_trained) return false;
            return true;
        });
    }, [employees, searchName, filterImages, filterTrained]);

    useEffect(() => {
        if (!attendanceOrg) return;
        loadAllData();
    }, [attendanceOrg]);

    useEffect(() => {
        setSelectedImageNames(new Set());
        setTestMode(false);
    }, [selectedEmployee]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/training-status/?org_code=${attendanceOrg.org_code}`);
            const data = await res.json();
            setEmployees(data.employees || []);
        } catch (e) {
            setStatus('❌ Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const selectEmployee = async (emp) => {
        setSelectedEmployee(emp);
        setTestMode(false);
        setTestResult(null);

        // Always fetch to get details (counts) that are now missing from list view
        try {
            const res = await fetch(`${API_BASE}/employee-images/?org_code=${attendanceOrg.org_code}&employee_id=${emp.employee_id}`);
            const data = await res.json();
            setEmployeeImages(prev => ({ ...prev, [emp.employee_id]: data.images || [] }));

            // Merge detailed counts into selected employee object
            if (data.employee) {
                setSelectedEmployee(prev => ({ ...prev, ...data.employee }));
            }
        } catch (e) {
            console.error("Failed to load details", e);
        }
    };


    const toggleSelectImage = (filename) => {
        const next = new Set(selectedImageNames);
        if (next.has(filename)) next.delete(filename);
        else next.add(filename);
        setSelectedImageNames(next);
    };

    const handleBulkDeleteImages = async () => {
        if (!selectedEmployee || !window.confirm(`Delete ${selectedImageNames.size} selected images?`)) return;
        setStatus('🔄 Deleting selected images...');

        const filenames = Array.from(selectedImageNames);
        let successCount = 0;

        for (const fname of filenames) {
            try {
                const res = await fetch(`${API_BASE}/delete-image/`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ org_code: attendanceOrg.org_code, employee_id: selectedEmployee.employee_id, filename: fname })
                });
                if (res.ok) successCount++;
            } catch (e) {
                console.error("Delete failed", e);
            }
        }

        setStatus(`✅ Deleted ${successCount} images`);

        // Update local state
        if (selectedEmployee) {
            setEmployeeImages(prev => ({
                ...prev,
                [selectedEmployee.employee_id]: (prev[selectedEmployee.employee_id] || []).filter(img => !selectedImageNames.has(img.filename))
            }));

            // Update selected employee image_count approximation
            setSelectedEmployee(prev => ({ ...prev, image_count: Math.max(0, (prev.image_count || 0) - successCount) }));
        }

        setSelectedImageNames(new Set());
        loadAllData();
    };

    const deleteImage = async (filename) => {
        if (!selectedEmployee || !window.confirm(`Delete ${filename}?`)) return;
        setStatus('🔄 Deleting...');
        try {
            const res = await fetch(`${API_BASE}/delete-image/`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: attendanceOrg.org_code, employee_id: selectedEmployee.employee_id, filename })
            });
            const data = await res.json();
            if (data.success) {
                setStatus(`✅ Deleted`);
                setEmployeeImages(prev => ({
                    ...prev,
                    [selectedEmployee.employee_id]: (prev[selectedEmployee.employee_id] || []).filter(img => img.filename !== filename)
                }));
                loadAllData();
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const deleteAllImages = async () => {
        if (!selectedEmployee || !window.confirm(`Delete ALL images for ${selectedEmployee.name}?`)) return;
        setStatus('🔄 Deleting all...');
        try {
            const res = await fetch(`${API_BASE}/delete-all-images/`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: attendanceOrg.org_code, employee_id: selectedEmployee.employee_id })
            });
            const data = await res.json();
            if (data.success) {
                setStatus(`✅ ${data.message}`);
                setEmployeeImages(prev => ({ ...prev, [selectedEmployee.employee_id]: [] }));
                setSelectedEmployee(null);
                loadAllData();
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    // Removed resetEmbeddings logic duplication if checking previous files, but it was there, let's keep it.
    const resetEmbeddings = async () => {
        if (!selectedEmployee || !window.confirm(`Reset ALL training for ${selectedEmployee.name}? This will DISABLE their face login.`)) return;
        setStatus('🔄 Resetting ALL embeddings...');
        try {
            const res = await fetch(`${API_BASE}/reset-embeddings/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: attendanceOrg.org_code, employee_id: selectedEmployee.employee_id, model_type: 'all' })
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

    const [trainingProgress, setTrainingProgress] = useState({ current: 0, total: 0, active: false });

    const trainEmployee = async () => {
        if (!selectedEmployee) return;
        setStatus(`🔄 Training ${selectedEmployee.name} (${selectedEmployee.image_count || 0} images)...`);
        setIsTraining(true);
        // Simulate progress for UX (since backend is synchronous)
        setTrainingProgress({ current: 0, total: 1, active: true });
        try {
            const res = await fetch(`${API_BASE}/train-employee/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: attendanceOrg.org_code, employee_id: selectedEmployee.employee_id, mode: 'light' })
            });
            const data = await res.json();
            setStatus(data.success ? `✅ ${data.message}` : `❌ ${data.error}`);
            loadAllData();
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        } finally {
            setIsTraining(false);
        }
    };

    const trainAll = async () => {
        // Filter employees that need training (or just all valid ones)
        // For "Train All", we usually want to ensure everyone is up to date, or maybe just untrained ones?
        // Let's train everyone to be safe, or we can add a prompt. For now, train ALL active employees.
        const employeesToTrain = employees.filter(e => e.image_count > 0);

        if (employeesToTrain.length === 0) {
            setStatus('⚠️ No employees with images to train.');
            return;
        }

        if (!window.confirm(`Start training for ${employeesToTrain.length} employees? This may take a while.`)) return;

        setIsTraining(true);
        setTrainingProgress({ current: 0, total: employeesToTrain.length, active: true });
        setStatus('🚀 Starting batch training...');

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < employeesToTrain.length; i++) {
            const emp = employeesToTrain[i];
            setTrainingProgress({ current: i + 1, total: employeesToTrain.length, active: true });

            try {
                const res = await fetch(`${API_BASE}/train-employee/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ org_code: attendanceOrg.org_code, employee_id: emp.employee_id, mode: 'light' })
                });
                if (res.ok) successCount++;
                else failCount++;
            } catch (e) {
                console.error(`Failed to train ${emp.name}`, e);
                failCount++;
            }
        }

        setStatus(`✅ Batch Training Complete: ${successCount} successes, ${failCount} failures.`);
        setIsTraining(false);
        setTrainingProgress({ current: 0, total: 0, active: false });
        loadAllData();
    };

    const testEmployee = async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        // Convert to blob
        const blob = await fetch(imageSrc).then(r => r.blob());
        const file = new File([blob], "test.jpg", { type: "image/jpeg" });

        const formData = new FormData();
        formData.append('org_code', attendanceOrg.org_code);
        formData.append('employee_id', selectedEmployee.employee_id);
        formData.append('image', file);

        setStatus('🔄 Testing...');
        try {
            const res = await fetch(`${API_BASE}/test-model/`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            setTestResult(data);
            setStatus(data.success ? `✅ Match: ${data.confidence}%` : `❌ ${data.error}`);
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const trainedCount = employees.filter(e => e.light_trained).length;
    const currentImages = selectedEmployee ? (employeeImages[selectedEmployee.employee_id] || []) : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f1f5f9' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '12px 20px', color: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🧠</span>
                        <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Face Recognition Model</span>
                        <span style={{ opacity: 0.8, fontSize: '0.85rem' }}>({trainedCount}/{employees.length} trained)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={trainAll} disabled={isTraining} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                            {isTraining ? '⏳' : '🧠'} Train All
                        </button>
                        <button onClick={() => navigate('/attendance/admin/models')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                            ← Back
                        </button>
                    </div>
                </div>
                {status && <div style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.9 }}>{status}</div>}

                {/* Progress Bar */}
                {trainingProgress.active && (
                    <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${(trainingProgress.current / trainingProgress.total) * 100}%`,
                            height: '100%',
                            background: '#fbbf24', // Amber/Yellow for visibility
                            transition: 'width 0.3s ease-out'
                        }} />
                        <div style={{ textAlign: 'right', fontSize: '0.7rem', marginTop: '4px' }}>
                            {trainingProgress.current} / {trainingProgress.total}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content: Two Panels */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* LEFT: Employee List */}
                <div style={{ width: '360px', borderRight: '1px solid #e2e8f0', background: 'white', display: 'flex', flexDirection: 'column' }}>
                    {/* Filter Controls */}
                    <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        {/* Search Box */}
                        <input
                            type="text"
                            placeholder="🔍 Search by name or ID..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                                borderRadius: '8px', fontSize: '0.9rem', marginBottom: '10px',
                                outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                        {/* Filter Row */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                                value={filterImages}
                                onChange={(e) => setFilterImages(e.target.value)}
                                style={{
                                    flex: 1, padding: '8px', border: '1px solid #e2e8f0',
                                    borderRadius: '6px', fontSize: '0.8rem', background: 'white', cursor: 'pointer',
                                    minWidth: 0
                                }}
                            >
                                <option value="all">📷 All</option>
                                <option value="has">✅ Has Images</option>
                                <option value="none">❌ No Images</option>
                            </select>
                            <select
                                value={filterTrained}
                                onChange={(e) => setFilterTrained(e.target.value)}
                                style={{
                                    flex: 1, padding: '8px', border: '1px solid #e2e8f0',
                                    borderRadius: '6px', fontSize: '0.8rem', background: 'white', cursor: 'pointer',
                                    minWidth: 0
                                }}
                            >
                                <option value="all">🧠 All</option>
                                <option value="trained">✅ Trained</option>
                                <option value="untrained">❌ Not Trained</option>
                            </select>
                        </div>
                        {/* Quick Filters */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => { setSearchName(''); setFilterImages('all'); setFilterTrained('all'); }}
                                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
                            >
                                🔄 Reset
                            </button>
                            <button
                                onClick={() => { setFilterImages('has'); setFilterTrained('untrained'); }}
                                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '12px', border: '1px solid #10b981', background: '#d1fae5', cursor: 'pointer', color: '#059669' }}
                            >
                                ⚠️ Ready to Train
                            </button>
                            <button
                                onClick={() => { setFilterImages('none'); setFilterTrained('all'); }}
                                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '12px', border: '1px solid #ef4444', background: '#fef2f2', cursor: 'pointer', color: '#b91c1c' }}
                            >
                                📷 Need Images
                            </button>
                        </div>
                    </div>

                    {/* Employee Count (Reverted) */}
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#64748b', fontSize: '0.85rem' }}>
                        Showing {filteredEmployees.length} of {employees.length}
                    </div>

                    {/* Employee List (Reverted) */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
                        ) : (
                            filteredEmployees.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No employees match filters</div>
                            ) : (
                                filteredEmployees.map(emp => (
                                    <div
                                        key={emp.id}
                                        onClick={() => selectEmployee(emp)}
                                        style={{
                                            padding: '12px 16px',
                                            borderBottom: '1px solid #f1f5f9',
                                            cursor: 'pointer',
                                            background: selectedEmployee?.id === emp.id ? '#fef3c7' : 'white',
                                            display: 'flex', alignItems: 'center', gap: '12px'
                                        }}
                                    >
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            background: emp.light_trained ? '#10b981' : '#e2e8f0',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: emp.light_trained ? 'white' : '#64748b', fontWeight: '600', fontSize: '0.85rem'
                                        }}>
                                            {emp.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{emp.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                {emp.employee_id} • {emp.image_count || 0} imgs
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
                                            background: emp.light_trained ? '#d1fae5' : '#fef2f2',
                                            color: emp.light_trained ? '#059669' : '#dc2626'
                                        }}>
                                            {emp.light_trained ? '✓' : '✗'}
                                        </span>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </div>

                {/* RIGHT: Selected Employee Detail */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {!selectedEmployee ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                            ← Select an employee to manage
                        </div>
                    ) : (
                        <>
                            {/* Employee Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h2 style={{ margin: 0, color: '#1e293b' }}>{selectedEmployee.name}</h2>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{selectedEmployee.employee_id} • {selectedEmployee.department || 'No Dept'}</div>
                                </div>
                                <span style={{
                                    padding: '6px 14px', borderRadius: '20px', fontWeight: '600',
                                    background: selectedEmployee.light_trained ? '#d1fae5' : '#fef2f2',
                                    color: selectedEmployee.light_trained ? '#059669' : '#dc2626'
                                }}>
                                    {selectedEmployee.light_trained ? '✅ TRAINED' : '❌ NOT TRAINED'}
                                </span>
                            </div>

                            {/* Action Buttons - Simplified */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <button
                                    onClick={trainEmployee}
                                    disabled={isTraining}
                                    style={{
                                        background: isTraining ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
                                        color: 'white',
                                        border: 'none',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: isTraining ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        fontSize: '0.95rem',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        minWidth: '140px', justifyContent: 'center'
                                    }}
                                >
                                    {isTraining ? (
                                        <>
                                            <div className="spinner" style={{
                                                width: '16px', height: '16px',
                                                border: '2px solid white', borderTop: '2px solid transparent',
                                                borderRadius: '50%', animation: 'spin 1s linear infinite'
                                            }} />
                                            <span>Training...</span>
                                            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                                        </>
                                    ) : (
                                        <>
                                            <span>🧠</span> {selectedEmployee.light_trained ? 'Retrain Model' : 'Train Model'}
                                        </>
                                    )}
                                </button>
                                <button onClick={() => setTestMode(!testMode)} style={{ background: testMode ? '#6366f1' : '#e2e8f0', color: testMode ? 'white' : '#475569', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                                    🎯 Test
                                </button>
                                <button onClick={resetEmbeddings} style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                                    🗑️ Reset
                                </button>
                            </div>

                            {/* Embedding Status - Simplified */}
                            <div style={{ padding: '16px', background: 'linear-gradient(135deg, #1e293b, #334155)', borderRadius: '12px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Model Embeddings</div>
                                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>{selectedEmployee.face_embeddings_count || 0}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Images: {selectedEmployee.image_count || 0}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Engine: InsightFace (512-d)</div>
                                    </div>
                                </div>
                            </div>



                            {/* Test Mode */}
                            {testMode && (
                                <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" style={{ width: '100%', maxWidth: '320px', borderRadius: '8px' }} mirrored />
                                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button onClick={testEmployee} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>📸 Capture & Test</button>
                                        {testResult && (
                                            <span style={{ padding: '6px 12px', borderRadius: '6px', background: testResult.is_correct_match ? '#d1fae5' : '#fef2f2', color: testResult.is_correct_match ? '#059669' : '#dc2626' }}>
                                                {testResult.confidence}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Images Grid */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                        📷 {currentImages.length} images (select to delete)
                                    </div>

                                    {/* Zoom Slider */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e2e8f0', padding: '4px 8px', borderRadius: '12px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>🔍</span>
                                        <input
                                            type="range"
                                            min="60" max="300"
                                            value={imageSize}
                                            onChange={(e) => setImageSize(Number(e.target.value))}
                                            style={{ width: '80px', cursor: 'pointer', height: '4px' }}
                                        />
                                    </div>
                                </div>

                                {selectedImageNames.size > 0 && (
                                    <button
                                        onClick={handleBulkDeleteImages}
                                        style={{
                                            background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5',
                                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem',
                                            fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                    >
                                        🗑️ Delete {selectedImageNames.size}
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${imageSize}px, 1fr))`, gap: '8px' }}>
                                {currentImages.map((img, idx) => {
                                    const isSelected = selectedImageNames.has(img.filename);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => toggleSelectImage(img.filename)}
                                            style={{
                                                position: 'relative',
                                                cursor: 'pointer',
                                                border: isSelected ? '3px solid #6366f1' : '3px solid transparent',
                                                borderRadius: '8px',
                                                transition: 'all 0.1s'
                                            }}
                                        >
                                            <img src={img.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '5px', display: 'block' }} />

                                            {/* Top Right: Delete Single */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteImage(img.filename); }}
                                                style={{
                                                    position: 'absolute', top: '4px', right: '4px',
                                                    width: '24px', height: '24px', borderRadius: '50%',
                                                    background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                                                    border: 'none', cursor: 'pointer', fontSize: '12px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                            >✕</button>

                                            {/* Top Left: Checkbox Overlay */}
                                            <div style={{ position: 'absolute', top: '4px', left: '4px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => { }} // Handled by div click
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {currentImages.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No images</div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FaceModelPage;
