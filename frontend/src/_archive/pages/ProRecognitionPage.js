/**
 * Pro Recognition Page - Uses DeepFace/ArcFace (99% accuracy)
 * Backend-powered face recognition
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

const API_BASE = 'http://localhost:8000/api/v1/faces/deepface';

const ProRecognitionPage = () => {
    const webcamRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [trainedPersons, setTrainedPersons] = useState([]);
    const [recognition, setRecognition] = useState(null);
    const [status, setStatus] = useState('Ready');
    const [mode, setMode] = useState('recognize'); // 'recognize' or 'train'

    // Training state
    const [trainName, setTrainName] = useState('');
    const [trainId, setTrainId] = useState('');
    const [trainImages, setTrainImages] = useState([]);
    const [trainingProgress, setTrainingProgress] = useState(null);

    // Load trained persons
    const loadPersons = async () => {
        try {
            const res = await fetch(`${API_BASE}/persons/`);
            const data = await res.json();
            setTrainedPersons(data.persons || []);
        } catch (e) {
            console.error('Failed to load persons:', e);
        }
    };

    useEffect(() => {
        loadPersons();
    }, []);

    // Capture image for training
    const captureForTraining = () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
            setTrainImages(prev => [...prev, imageSrc]);
            setStatus(`Captured ${trainImages.length + 1} images`);
        }
    };

    // Convert base64 to blob
    const base64ToBlob = async (base64) => {
        const res = await fetch(base64);
        return await res.blob();
    };

    // Train with DeepFace
    const trainWithDeepFace = async () => {
        if (!trainName || !trainId) {
            setStatus('Please enter name and ID');
            return;
        }
        if (trainImages.length < 5) {
            setStatus('Please capture at least 5 images');
            return;
        }

        setIsLoading(true);
        setTrainingProgress({ message: 'Uploading images...' });

        try {
            const formData = new FormData();
            formData.append('person_id', trainId);
            formData.append('person_name', trainName);

            for (let i = 0; i < trainImages.length; i++) {
                const blob = await base64ToBlob(trainImages[i]);
                formData.append('images', blob, `face_${i}.jpg`);
            }

            setTrainingProgress({ message: 'Training with ArcFace model (this may take a minute)...' });

            const res = await fetch(`${API_BASE}/train/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                setStatus(`✅ Training complete! ${data.embeddings_count} embeddings created`);
                setTrainImages([]);
                setTrainName('');
                setTrainId('');
                loadPersons();
                setMode('recognize');
            } else {
                setStatus(`❌ Training failed: ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ Error: ${e.message}`);
        } finally {
            setIsLoading(false);
            setTrainingProgress(null);
        }
    };

    // Recognize with DeepFace
    const recognizeNow = useCallback(async () => {
        if (!webcamRef.current || !isRecognizing) return;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
            setTimeout(recognizeNow, 500);
            return;
        }

        try {
            const blob = await base64ToBlob(imageSrc);
            const formData = new FormData();
            formData.append('image', blob, 'face.jpg');

            const res = await fetch(`${API_BASE}/recognize/`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            setRecognition(data);

            if (data.matched) {
                setStatus(`✅ ${data.person_name} (${data.confidence}% match)`);
            } else {
                setStatus(data.message || 'No match found');
            }
        } catch (e) {
            console.error('Recognition error:', e);
        }

        if (isRecognizing) {
            setTimeout(recognizeNow, 1000); // Check every 1 second
        }
    }, [isRecognizing]);

    useEffect(() => {
        if (isRecognizing) recognizeNow();
    }, [isRecognizing, recognizeNow]);

    const deletePerson = async (label) => {
        if (!window.confirm(`Delete ${label}?`)) return;
        try {
            await fetch(`${API_BASE}/persons/${label}/`, { method: 'DELETE' });
            loadPersons();
            setStatus('Deleted');
        } catch (e) {
            setStatus('Delete failed');
        }
    };

    return (
        <div className="container">
            <div className="header">
                <div className="logo">
                    <span className="logo-icon">🎯</span>
                    <span>Pro Recognition (99%)</span>
                </div>
                <nav className="nav">
                    <a href="/" className="nav-link">Home</a>
                    <a href="/enroll" className="nav-link">Basic (Browser)</a>
                    <a href="/recognize" className="nav-link">Basic Recognition</a>
                    <a href="/pro" className="nav-link active">Pro (ArcFace)</a>
                </nav>
            </div>

            {/* Model badge */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <span style={{
                    background: 'var(--gradient-success)',
                    padding: '8px 20px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}>
                    🧠 ArcFace Model - 99.83% Accuracy (LFW Benchmark)
                </span>
            </div>

            {/* Mode tabs */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                <button
                    className={`btn ${mode === 'recognize' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setMode('recognize'); setIsRecognizing(false); }}
                >
                    👁️ Recognize
                </button>
                <button
                    className={`btn ${mode === 'train' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setMode('train'); setIsRecognizing(false); }}
                >
                    📸 Train New
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
                {/* Main area */}
                <div className="card">
                    {mode === 'recognize' ? (
                        <>
                            <h2>Live Recognition</h2>
                            <div className="webcam-container" style={{ marginTop: '20px' }}>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                <div className={`status-badge ${recognition?.matched ? 'success' : 'warning'}`}>
                                    {status}
                                </div>
                            </div>

                            {recognition?.matched && (
                                <div style={{
                                    marginTop: '20px',
                                    padding: '20px',
                                    background: 'var(--gradient-success)',
                                    borderRadius: '12px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '48px' }}>👤</div>
                                    <h2>{recognition.person_name}</h2>
                                    <div>ID: {recognition.person_id}</div>
                                    <div style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '10px' }}>
                                        {recognition.confidence}% Match
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                                <button
                                    className={`btn ${isRecognizing ? 'btn-outline' : 'btn-primary'} btn-lg`}
                                    onClick={() => setIsRecognizing(!isRecognizing)}
                                    disabled={trainedPersons.length === 0}
                                >
                                    {isRecognizing ? '⏹️ Stop' : '▶️ Start Recognition'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2>Train New Person (ArcFace)</h2>

                            <div style={{ marginTop: '20px' }}>
                                <div className="form-group">
                                    <label className="form-label">Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={trainName}
                                        onChange={e => setTrainName(e.target.value)}
                                        placeholder="Enter name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">ID *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={trainId}
                                        onChange={e => setTrainId(e.target.value)}
                                        placeholder="EMP001"
                                    />
                                </div>
                            </div>

                            <div className="webcam-container" style={{ marginTop: '20px' }}>
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                                    style={{ width: '100%' }}
                                    mirrored={true}
                                />
                            </div>

                            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                <p>{trainImages.length} images captured (min 5 required)</p>
                            </div>

                            {trainImages.length > 0 && (
                                <div className="images-grid" style={{ maxWidth: '400px', margin: '10px auto' }}>
                                    {trainImages.slice(-6).map((img, i) => (
                                        <div key={i} className="image-thumb">
                                            <img src={img} alt={`Capture ${i}`} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {trainingProgress && (
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                                    <p>{trainingProgress.message}</p>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={captureForTraining}
                                    disabled={isLoading}
                                >
                                    📸 Capture
                                </button>
                                <button
                                    className="btn btn-success btn-lg"
                                    onClick={trainWithDeepFace}
                                    disabled={isLoading || trainImages.length < 5}
                                >
                                    🧠 Train with ArcFace
                                </button>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => setTrainImages([])}
                                    disabled={isLoading}
                                >
                                    🗑️ Clear
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Sidebar */}
                <div>
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <h3>🎯 Model Info</h3>
                        <div style={{ marginTop: '15px', fontSize: '13px' }}>
                            <p><strong>Model:</strong> ArcFace (InsightFace)</p>
                            <p><strong>Accuracy:</strong> 99.83% (LFW)</p>
                            <p><strong>Embedding:</strong> 512 dimensions</p>
                            <p><strong>Detection:</strong> RetinaFace</p>
                        </div>
                    </div>

                    <div className="card">
                        <h3>👥 Trained ({trainedPersons.length})</h3>
                        {trainedPersons.length > 0 ? (
                            <div style={{ marginTop: '15px', maxHeight: '300px', overflowY: 'auto' }}>
                                {trainedPersons.map(p => (
                                    <div key={p.label} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px',
                                        background: 'var(--bg-light)',
                                        borderRadius: '8px',
                                        marginBottom: '6px'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: '500' }}>{p.person_name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                {p.person_id} • {p.embeddings_count} embeddings
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '4px 8px', fontSize: '11px' }}
                                            onClick={() => deletePerson(p.label)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', marginTop: '15px' }}>
                                No trained faces yet
                            </p>
                        )}
                    </div>

                    <div className="card" style={{ marginTop: '20px' }}>
                        <h3>📌 Comparison</h3>
                        <table style={{ width: '100%', marginTop: '15px', fontSize: '12px' }}>
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Basic</th>
                                    <th style={{ color: 'var(--success-color)' }}>Pro</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Accuracy</td>
                                    <td>~92%</td>
                                    <td style={{ color: 'var(--success-color)' }}>99%</td>
                                </tr>
                                <tr>
                                    <td>Model</td>
                                    <td>face-api</td>
                                    <td style={{ color: 'var(--success-color)' }}>ArcFace</td>
                                </tr>
                                <tr>
                                    <td>Processing</td>
                                    <td>Browser</td>
                                    <td>Server</td>
                                </tr>
                                <tr>
                                    <td>Embedding</td>
                                    <td>128-d</td>
                                    <td style={{ color: 'var(--success-color)' }}>512-d</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProRecognitionPage;
