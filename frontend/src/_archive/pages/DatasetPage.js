/**
 * Dataset Management Page - Premium Light Theme
 */
import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import faceRecognitionService from '../services/faceRecognition';

const API_BASE = 'http://127.0.0.1:8000/api/v1/faces';
const DEEPFACE_API_BASE = 'http://127.0.0.1:8000/api/v1/faces/deepface';

const DatasetPage = () => {
    const webcamRef = useRef(null);
    const [datasets, setDatasets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [capturedImages, setCapturedImages] = useState([]);
    const [personName, setPersonName] = useState('');
    const [personId, setPersonId] = useState('');
    const [activeTab, setActiveTab] = useState('create'); // create, repo, models
    const [captureMode, setCaptureMode] = useState('webcam'); // webcam, upload
    const [uploadFiles, setUploadFiles] = useState([]);
    const [trainedPersons, setTrainedPersons] = useState([]);
    const [trainingModel, setTrainingModel] = useState(null);

    const fetchDatasets = async () => {
        try {
            const res = await axios.get(`${API_BASE}/dataset/`);
            setDatasets(res.data.datasets || []);
        } catch (e) {
            console.error('Failed to load datasets:', e);
        }
    };

    const fetchTrainedModels = async () => {
        try {
            const res = await axios.get(`${DEEPFACE_API_BASE}/persons/`);
            setTrainedPersons(res.data.persons || []);
        } catch (err) {
            console.error("Error fetching models", err);
        }
    };

    useEffect(() => {
        fetchDatasets();
        fetchTrainedModels();
    }, []);

    const base64ToBlob = async (base64) => {
        const res = await fetch(base64);
        return await res.blob();
    };

    const captureImage = () => {
        if (!webcamRef.current) return;
        const img = webcamRef.current.getScreenshot();
        if (img) {
            setCapturedImages(prev => [...prev, img]);
            setStatus(`✅ Captured ${capturedImages.length + 1} images`);
        }
    };

    const saveDataset = async () => {
        if (!personName || !personId) {
            setStatus('⚠️ Please enter name and ID');
            return;
        }
        if (capturedImages.length < 5) {
            setStatus('⚠️ Please capture at least 5 images');
            return;
        }

        setIsLoading(true);
        setStatus('💾 Saving images to server...');

        try {
            const formData = new FormData();
            formData.append('person_id', personId);
            formData.append('person_name', personName);

            for (let i = 0; i < capturedImages.length; i++) {
                const blob = await base64ToBlob(capturedImages[i]);
                formData.append('images', blob, `face_${i}.jpg`);
            }

            const res = await fetch(`${API_BASE}/dataset/save/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                setStatus(`✅ Saved ${data.image_count} images for ${data.person_name}`);
                setCapturedImages([]);
                setPersonName('');
                setPersonId('');
                fetchDatasets(); // Use fetchDatasets
            } else {
                setStatus(`❌ Error: ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e) => {
        setUploadFiles(Array.from(e.target.files));
    };

    const saveUploadedDataset = async () => {
        if (!personName || !personId || uploadFiles.length === 0) {
            setStatus('⚠️ Please enter name, ID, and select files.');
            return;
        }
        setIsLoading(true);
        setStatus('⏳ Uploading images...');

        try {
            const formData = new FormData();
            formData.append('person_id', personId);
            formData.append('person_name', personName);
            uploadFiles.forEach(file => {
                formData.append('images', file);
            });

            await axios.post(`${API_BASE}/dataset/save/`, formData, { // Use API_BASE
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setStatus('✅ Dataset uploaded successfully!');
            fetchDatasets();
            setPersonName('');
            setPersonId('');
            setUploadFiles([]);
            setTimeout(() => setStatus(''), 3000);
        } catch (err) {
            setStatus('❌ Upload failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsLoading(false);
        }
    };

    const trainWithLite = async (label) => {
        setTrainingModel('lite');
        setIsLoading(true);
        setStatus('🔄 Loading images for Lite training...');

        try {
            const res = await fetch(`${API_BASE}/dataset/${label}/images/`);
            const data = await res.json();

            if (!data.images || data.images.length === 0) {
                setStatus('❌ No images found');
                return;
            }

            setStatus('🧠 Training with face-api.js...');
            await faceRecognitionService.loadModels();

            const files = await Promise.all(data.images.map(async (img, i) => {
                const blob = await base64ToBlob(img.data);
                return new File([blob], img.filename, { type: 'image/jpeg' });
            }));

            await faceRecognitionService.trainPerson(label, files, (progress) => {
                setStatus(`🧠 ${progress.message}`);
            });

            await fetch(`${API_BASE}/dataset/${label}/train/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'lite' })
            });

            setStatus(`✅ Lite training complete!`);
            fetchDatasets(); // Use fetchDatasets
        } catch (e) {
            setStatus(`❌ Error: ${e.message}`);
        } finally {
            setIsLoading(false);
            setTrainingModel(null);
        }
    };

    const trainWithDeep = async (label) => {
        setTrainingModel('deep');
        setIsLoading(true);
        setStatus('🧠 Training with ArcFace (this may take a minute)...');

        try {
            const res = await fetch(`${API_BASE}/dataset/${label}/train/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'deep' })
            });

            const data = await res.json();

            if (res.ok) {
                setStatus(`✅ Deep training complete! ${data.embeddings_count} embeddings created`);
                fetchDatasets(); // Use fetchDatasets
                fetchTrainedModels(); // Refresh trained models after deep training
            } else {
                setStatus(`❌ Error: ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ Error: ${e.message}`);
        } finally {
            setIsLoading(false);
            setTrainingModel(null);
        }
    };

    const deleteDataset = async (label) => {
        if (!window.confirm(`Delete dataset for ${label}?`)) return;
        try {
            await fetch(`${API_BASE}/dataset/${label}/`, { method: 'DELETE' });
            setStatus('🗑️ Deleted');
            fetchDatasets(); // Use fetchDatasets
        } catch (e) {
            setStatus('❌ Delete failed');
        }
    };

    const deleteTrainedPerson = async (label) => {
        if (!window.confirm(`Remove ${label} from the trained model? This will not delete their dataset.`)) return;
        try {
            await axios.delete(`${DEEPFACE_API_BASE}/persons/${label}/`);
            fetchTrainedModels();
            setStatus(`🗑️ Removed ${label} from active models.`);
        } catch (err) {
            setStatus('❌ Failed to delete model entry: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="container" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
            {/* COMPACT Wave Hero - Individual Focus */}
            <div className="wave-hero" style={{ minHeight: '160px', paddingBottom: '50px', paddingTop: '10px' }}>
                <div className="header" style={{ padding: '10px 20px' }}>
                    <div className="logo">
                        <span className="logo-icon" style={{ animation: 'none' }}>👤</span>
                        <span style={{ fontSize: '1.2rem' }}>My Studio</span>
                    </div>
                    <nav className="nav">
                        <a href="/" className="nav-link" style={{ fontSize: '0.9rem' }}>Home</a>
                        <button className={`nav-link ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Create</button>
                        <button className={`nav-link ${activeTab === 'repo' ? 'active' : ''}`} onClick={() => setActiveTab('repo')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Repository</button>
                        <button className={`nav-link ${activeTab === 'models' ? 'active' : ''}`} onClick={() => setActiveTab('models')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Models</button>
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content" style={{ marginTop: '-60px', paddingTop: '0' }}>
                {status && (
                    <div className={`status-badge ${status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : 'warning'}`}
                        style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', padding: '10px 20px', fontSize: '0.9rem' }}>
                        {status}
                    </div>
                )}

                {/* TAB 1: CREATE DATASET */}
                {activeTab === 'create' && (
                    <div className="card" style={{ animation: 'none', padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Create New Dataset</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>Add a new person to your personal collection.</p>
                        </div>

                        <div className="grid-2" style={{ marginBottom: '24px' }}>
                            <div className="form-group">
                                <label className="form-label">Person Name</label>
                                <input type="text" className="form-input" value={personName} onChange={e => setPersonName(e.target.value)} placeholder="e.g. Alice Smith" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Unique ID</label>
                                <input type="text" className="form-input" value={personId} onChange={e => setPersonId(e.target.value)} placeholder="e.g. ID-001" />
                            </div>
                        </div>

                        {/* Toggle Mode */}
                        <div style={{ display: 'flex', background: 'var(--bg-soft)', padding: '4px', borderRadius: '8px', marginBottom: '24px' }}>
                            <button
                                onClick={() => setCaptureMode('webcam')}
                                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: captureMode === 'webcam' ? 'var(--primary)' : 'transparent', color: captureMode === 'webcam' ? 'white' : 'var(--text-secondary)', fontWeight: '600' }}
                            >
                                📸 Webcam Capture
                            </button>
                            <button
                                onClick={() => setCaptureMode('upload')}
                                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: captureMode === 'upload' ? 'var(--primary)' : 'transparent', color: captureMode === 'upload' ? 'white' : 'var(--text-secondary)', fontWeight: '600' }}
                            >
                                📤 Upload Folder
                            </button>
                        </div>

                        {captureMode === 'webcam' ? (
                            <div className="fade-in">
                                <div className="webcam-container" style={{ marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                                    <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" videoConstraints={{ width: 480, height: 360, facingMode: 'user' }} style={{ width: '100%', height: 'auto', display: 'block' }} mirrored={true} />
                                </div>
                                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                    <span style={{ padding: '6px 16px', background: 'var(--bg-soft)', borderRadius: '20px', fontSize: '0.9rem' }}>
                                        {capturedImages.length} images captured
                                    </span>
                                </div>
                                {capturedImages.length > 0 && (
                                    <div className="images-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))' }}>
                                        {capturedImages.slice(-6).map((img, i) => (
                                            <div key={i} className="image-thumb" style={{ height: '60px' }}><img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                    <button className="btn btn-secondary" onClick={captureImage} disabled={isLoading}>📸 Snap</button>
                                    <button className="btn btn-success" onClick={saveDataset} disabled={isLoading || capturedImages.length < 1}>💾 Save Dataset</button>
                                    <button className="btn btn-outline" onClick={() => setCapturedImages([])}>🗑️ Clear</button>
                                </div>
                            </div>
                        ) : (
                            <div className="fade-in" style={{ textAlign: 'center', padding: '40px', border: '2px dashed var(--border-color)', borderRadius: '12px' }}>
                                <input type="file" multiple accept="image/*" onChange={handleFileUpload} id="file-upload" style={{ display: 'none' }} />
                                <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📂</div>
                                    <h3 style={{ marginBottom: '8px' }}>Click to Select Images</h3>
                                    <p style={{ color: 'var(--text-secondary)' }}>Select multiple face images from your computer</p>
                                </label>
                                {uploadFiles.length > 0 && (
                                    <div style={{ marginTop: '20px' }}>
                                        <div style={{ marginBottom: '16px', color: 'var(--success)', fontWeight: '600' }}>
                                            {uploadFiles.length} files selected
                                        </div>
                                        <button className="btn btn-success" onClick={saveUploadedDataset} disabled={isLoading}>
                                            🚀 Upload & Save
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: REPOSITORY */}
                {activeTab === 'repo' && (
                    <div className="card" style={{ animation: 'none', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.4rem' }}>My Datasets ({datasets.length})</h2>
                            <button className="btn btn-outline" onClick={fetchDatasets} style={{ fontSize: '0.9rem' }}>🔄 Refresh</button>
                        </div>

                        {datasets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No datasets found. Go to 'Create' to add one.</div>
                        ) : (
                            <div className="grid-2">
                                {datasets.map(ds => (
                                    <div key={ds.label} style={{ background: 'var(--bg-soft)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                            <div>
                                                <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{ds.person_name}</h3>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{ds.person_id}</span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{ds.image_count} 🖼️</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                                            <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }} onClick={() => trainWithDeep(ds.label)} disabled={isLoading}>
                                                🎯 Train Model
                                            </button>
                                            <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '8px' }} onClick={() => deleteDataset(ds.label)}>
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: MODEL REGISTRY */}
                {activeTab === 'models' && (
                    <div className="card" style={{ animation: 'none', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.4rem' }}>Active Models</h2>
                            <button className="btn btn-outline" onClick={fetchTrainedModels} style={{ fontSize: '0.9rem' }}>🔄 Refresh Registry</button>
                        </div>

                        {trainedPersons.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                The AI model hasn't learned any faces yet. Go to 'Repository' and click 'Train'.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                            <th style={{ padding: '12px' }}>Person</th>
                                            <th style={{ padding: '12px' }}>Status</th>
                                            <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trainedPersons.map((p, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '12px', fontWeight: '600' }}>{p.person_name || p.label}</td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>
                                                        ● Active
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                    <button onClick={() => deleteTrainedPerson(p.label)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }} title="Remove from Model">
                                                        ❌
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DatasetPage;

