/**
 * Light Model Page - Sidebar Layout
 * Left: Employee list | Right: Selected employee details + images
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Webcam from 'react-webcam';

const API_BASE = '/api/v1/attendance';

const LightModelPage = () => {
    const navigate = useNavigate();
    const { attendanceOrg } = useAuth();
    const webcamRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [employeeImages, setEmployeeImages] = useState({});
    const [status, setStatus] = useState('');
    const [isTraining, setIsTraining] = useState(false);
    const [testMode, setTestMode] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [chromaEmbeddings, setChromaEmbeddings] = useState(null); // ChromaDB data
    const [showChromaDB, setShowChromaDB] = useState(false);

    // Filter states
    const [searchName, setSearchName] = useState('');
    const [filterImages, setFilterImages] = useState('all'); // 'all', 'has', 'none'
    const [filterTrained, setFilterTrained] = useState('all'); // 'all', 'trained', 'untrained'
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'approved', 'captured', 'pending'

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
        setChromaEmbeddings(null);
        setShowChromaDB(false);

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

    const loadChromaEmbeddings = async () => {
        if (!selectedEmployee) return;
        setStatus('🔄 Loading ChromaDB...');
        try {
            const res = await fetch(`${API_BASE}/chromadb-embeddings/?org_code=${attendanceOrg.org_code}&employee_id=${selectedEmployee.employee_id}`);
            const data = await res.json();
            setChromaEmbeddings(data);
            setShowChromaDB(true);
            setStatus('');
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const deleteChromaEmbedding = async (modelType, chromaId) => {
        if (!window.confirm(`Delete embedding ${chromaId}?`)) return;
        setStatus('🔄 Deleting...');
        try {
            const res = await fetch(`${API_BASE}/chromadb-embedding/`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: attendanceOrg.org_code, model_type: modelType, chroma_id: chromaId })
            });
            const data = await res.json();
            if (data.success) {
                setStatus(`✅ ${data.message}`);
                loadChromaEmbeddings(); // Refresh
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
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

    const trainEmployee = async () => {
        if (!selectedEmployee) return;
        setStatus(`🔄 Training ${selectedEmployee.name}...`);
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
        }
    };

    const trainAll = async () => {
        setIsTraining(true);
        setStatus('🔄 Training all...');
        try {
            const res = await fetch(`${API_BASE}/train-model/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_code: attendanceOrg.org_code, mode: 'light' })
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

    const approveEmployee = async (newStatus) => {
        if (!selectedEmployee) return;
        setStatus(`🔄 Updating status to ${newStatus}...`);
        try {
            const res = await fetch(`${API_BASE}/approve-images/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_code: attendanceOrg.org_code,
                    employee_id: selectedEmployee.employee_id,
                    status: newStatus
                })
            });
            const data = await res.json();
            if (data.success) {
                setStatus(`✅ ${data.message}`);
                // Update local list
                setEmployees(prev => prev.map(e =>
                    e.id === selectedEmployee.id ? { ...e, image_status: newStatus === 'rejected' ? 'pending' : newStatus } : e
                ));
                setSelectedEmployee(prev => ({ ...prev, image_status: newStatus === 'rejected' ? 'pending' : newStatus }));
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const testEmployee = async () => {
        if (!webcamRef.current || !selectedEmployee) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setStatus('🔄 Testing...');
        const res = await fetch(imageSrc);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append('org_code', attendanceOrg.org_code);
        formData.append('employee_id', selectedEmployee.employee_id);
        formData.append('image', blob, 'test.jpg');

        const testRes = await fetch(`${API_BASE}/test-model/`, { method: 'POST', body: formData });
        const data = await testRes.json();
        setTestResult(data);
        setStatus(data.success ? `✅ Match: ${data.confidence}%` : `❌ ${data.error}`);
    };

    const trainedCount = employees.filter(e => e.light_trained).length;
    const currentImages = selectedEmployee ? (employeeImages[selectedEmployee.employee_id] || []) : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f1f5f9' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '12px 20px', color: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>⚡</span>
                        <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Light Model Training</span>
                        <span style={{ opacity: 0.8, fontSize: '0.85rem' }}>({trainedCount}/{employees.length} trained)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={trainAll} disabled={isTraining} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                            {isTraining ? '⏳' : '⚡'} Train All
                        </button>
                        <button onClick={() => navigate('/attendance/admin/models')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                            ← Back
                        </button>
                    </div>
                </div>
                {status && <div style={{ marginTop: '8px', fontSize: '0.85rem', opacity: 0.9 }}>{status}</div>}
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
                                    borderRadius: '6px', fontSize: '0.8rem', background: 'white', cursor: 'pointer'
                                }}
                            >
                                <option value="all">📷 All Images</option>
                                <option value="has">✅ Has Images</option>
                                <option value="none">❌ No Images</option>
                            </select>
                            <select
                                value={filterTrained}
                                onChange={(e) => setFilterTrained(e.target.value)}
                                style={{
                                    flex: 1, padding: '8px', border: '1px solid #e2e8f0',
                                    borderRadius: '6px', fontSize: '0.8rem', background: 'white', cursor: 'pointer'
                                }}
                            >
                                <option value="all">⚡ All Status</option>
                                <option value="trained">✅ Trained</option>
                                <option value="untrained">❌ Not Trained</option>
                            </select>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                style={{
                                    flex: 1, padding: '8px', border: '1px solid #e2e8f0',
                                    borderRadius: '6px', fontSize: '0.8rem', background: 'white', cursor: 'pointer'
                                }}
                            >
                                <option value="all">📋 Approval</option>
                                <option value="approved">✅ Approved</option>
                                <option value="captured">📷 Pending Approval</option>
                                <option value="pending">⏳ Needs Capture</option>
                            </select>
                        </div>
                        {/* Quick Filters */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => { setSearchName(''); setFilterImages('all'); setFilterTrained('all'); setFilterStatus('all'); }}
                                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
                            >
                                🔄 Reset
                            </button>
                            <button
                                onClick={() => { setFilterStatus('captured'); }}
                                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '12px', border: '1px solid #3b82f6', background: '#eff6ff', cursor: 'pointer', color: '#1d4ed8' }}
                            >
                                🔍 Review (Ready)
                            </button>
                            <button
                                onClick={() => { setFilterImages('has'); setFilterTrained('untrained'); }}
                                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '12px', border: '1px solid #f59e0b', background: '#fef3c7', cursor: 'pointer', color: '#b45309' }}
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

                    {/* Employee Count */}
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#64748b', fontSize: '0.85rem' }}>
                        Showing {(() => {
                            let filtered = employees;
                            if (searchName) {
                                const search = searchName.toLowerCase();
                                filtered = filtered.filter(e =>
                                    e.name?.toLowerCase().includes(search) ||
                                    e.employee_id?.toLowerCase().includes(search)
                                );
                            }
                            if (filterImages === 'has') filtered = filtered.filter(e => (e.image_count || 0) > 0);
                            if (filterImages === 'none') filtered = filtered.filter(e => (e.image_count || 0) === 0);
                            if (filterTrained === 'trained') filtered = filtered.filter(e => e.light_trained);
                            if (filterTrained === 'untrained') filtered = filtered.filter(e => !e.light_trained);
                            if (filterStatus === 'approved') filtered = filtered.filter(e => e.image_status === 'approved');
                            if (filterStatus === 'captured') filtered = filtered.filter(e => e.image_status === 'captured');
                            if (filterStatus === 'pending') filtered = filtered.filter(e => e.image_status === 'pending');
                            return filtered.length;
                        })()} of {employees.length}
                    </div>

                    {/* Employee List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
                        ) : (
                            (() => {
                                // Apply filters
                                let filtered = employees;
                                if (searchName) {
                                    const search = searchName.toLowerCase();
                                    filtered = filtered.filter(e =>
                                        e.name?.toLowerCase().includes(search) ||
                                        e.employee_id?.toLowerCase().includes(search)
                                    );
                                }
                                if (filterImages === 'has') filtered = filtered.filter(e => (e.image_count || 0) > 0);
                                if (filterImages === 'none') filtered = filtered.filter(e => (e.image_count || 0) === 0);
                                if (filterTrained === 'trained') filtered = filtered.filter(e => e.light_trained);
                                if (filterTrained === 'untrained') filtered = filtered.filter(e => !e.light_trained);
                                if (filterStatus === 'approved') filtered = filtered.filter(e => e.image_status === 'approved');
                                if (filterStatus === 'captured') filtered = filtered.filter(e => e.image_status === 'captured');
                                if (filterStatus === 'pending') filtered = filtered.filter(e => e.image_status === 'pending');

                                if (filtered.length === 0) {
                                    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No employees match filters</div>;
                                }

                                return filtered.map(emp => (
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
                                ));
                            })()
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
                                    background: selectedEmployee.image_status === 'approved' ? '#d1fae5' : '#fef3c7',
                                    color: selectedEmployee.image_status === 'approved' ? '#059669' : '#d97706'
                                }}>
                                    {selectedEmployee.image_status?.toUpperCase() || 'UNKNOWN'}
                                </span>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                {selectedEmployee.image_status !== 'approved' && (
                                    <button onClick={() => approveEmployee('approved')} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        ✅ Approve Images
                                    </button>
                                )}
                                <button onClick={() => approveEmployee('rejected')} style={{ background: '#fecaca', color: '#b91c1c', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    ❌ Reject / Retake
                                </button>
                                <button onClick={trainEmployee} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                                    ⚡ {selectedEmployee.light_trained ? 'Retrain' : 'Train'}
                                </button>
                                <button onClick={() => setTestMode(!testMode)} style={{ background: testMode ? '#6366f1' : '#e2e8f0', color: testMode ? 'white' : '#475569', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                                    🎯 Test
                                </button>
                                <button onClick={resetEmbeddings} style={{ background: '#fecaca', color: '#b91c1c', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                                    🗑️ Reset Training
                                </button>
                                <button onClick={deleteAllImages} style={{ background: '#7f1d1d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                                    🔥 Delete All Images
                                </button>
                            </div>

                            {/* Embedding Status */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
                                <div style={{ padding: '12px', background: '#1e293b', borderRadius: '8px', textAlign: 'center', gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b' }}>{selectedEmployee.face_embeddings_count || 0}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Active Embeddings (used for login)</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Mode: {selectedEmployee.training_mode || 'none'}</div>
                                </div>
                                <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#16a34a' }}>{selectedEmployee.light_embeddings_count || 0}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#166534' }}>Light (128d)</div>
                                </div>
                                <div style={{ padding: '10px', background: '#f0f9ff', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0284c7' }}>{selectedEmployee.heavy_embeddings_count || 0}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#0369a1' }}>Heavy (512d)</div>
                                </div>
                                <div style={{ padding: '10px', background: '#fffbeb', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#ca8a04' }}>{(selectedEmployee.captured_light_count || 0) + (selectedEmployee.captured_heavy_count || 0)}</div>
                                    <div style={{ fontSize: '0.65rem', color: '#a16207' }}>Pending</div>
                                </div>
                            </div>

                            {/* ChromaDB Viewer */}
                            <div style={{ marginBottom: '20px', padding: '12px', background: '#1e1e2e', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showChromaDB ? '12px' : 0 }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>🗄️ ChromaDB Embeddings</span>
                                    <button
                                        onClick={showChromaDB ? () => setShowChromaDB(false) : loadChromaEmbeddings}
                                        style={{ background: '#6366f1', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                    >
                                        {showChromaDB ? 'Hide' : 'View'}
                                    </button>
                                </div>

                                {showChromaDB && chromaEmbeddings && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {/* Light Embeddings */}
                                        <div>
                                            <div style={{ color: '#16a34a', fontSize: '0.75rem', marginBottom: '6px', fontWeight: '600' }}>
                                                Light ({chromaEmbeddings.light?.count || 0})
                                            </div>
                                            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                                {(chromaEmbeddings.light?.embeddings || []).map((emb, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#0f0f1a', borderRadius: '4px', marginBottom: '4px' }}>
                                                        <span style={{ color: '#64748b', fontSize: '0.7rem', fontFamily: 'monospace' }}>{emb.chroma_id}</span>
                                                        <button onClick={() => deleteChromaEmbedding('light', emb.chroma_id)} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '0.6rem' }}>✕</button>
                                                    </div>
                                                ))}
                                                {chromaEmbeddings.light?.count === 0 && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>None</div>}
                                            </div>
                                        </div>
                                        {/* Heavy Embeddings */}
                                        <div>
                                            <div style={{ color: '#0284c7', fontSize: '0.75rem', marginBottom: '6px', fontWeight: '600' }}>
                                                Heavy ({chromaEmbeddings.heavy?.count || 0})
                                            </div>
                                            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                                {(chromaEmbeddings.heavy?.embeddings || []).map((emb, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: '#0f0f1a', borderRadius: '4px', marginBottom: '4px' }}>
                                                        <span style={{ color: '#64748b', fontSize: '0.7rem', fontFamily: 'monospace' }}>{emb.chroma_id}</span>
                                                        <button onClick={() => deleteChromaEmbedding('heavy', emb.chroma_id)} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '0.6rem' }}>✕</button>
                                                    </div>
                                                ))}
                                                {chromaEmbeddings.heavy?.count === 0 && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>None</div>}
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                            <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '12px' }}>
                                📷 {currentImages.length} images (click ✕ to delete)
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
                                {currentImages.map((img, idx) => (
                                    <div key={idx} style={{ position: 'relative' }}>
                                        <img src={img.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px' }} />
                                        <button
                                            onClick={() => deleteImage(img.filename)}
                                            style={{
                                                position: 'absolute', top: '4px', right: '4px',
                                                width: '22px', height: '22px', borderRadius: '50%',
                                                background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                                                border: 'none', cursor: 'pointer', fontSize: '11px'
                                            }}
                                        >✕</button>
                                    </div>
                                ))}
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

export default LightModelPage;
