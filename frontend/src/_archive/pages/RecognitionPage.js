/**
 * Face Recognition Page with Export/Import
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import faceRecognitionService from '../services/faceRecognition';

const RecognitionPage = () => {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecognizing, setIsRecognizing] = useState(false);
    const [recognition, setRecognition] = useState(null);
    const [trainedPersons, setTrainedPersons] = useState([]);
    const [status, setStatus] = useState('Loading models...');
    const [lastRecognition, setLastRecognition] = useState(null);
    const [importResult, setImportResult] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                await faceRecognitionService.loadModels();
                setTrainedPersons(faceRecognitionService.getTrainedPersons());
                setStatus('Ready to recognize');
                setIsLoading(false);
            } catch (error) {
                setStatus('Error: ' + error.message);
                setIsLoading(false);
            }
        };
        init();
    }, []);

    const runRecognition = useCallback(async () => {
        if (!webcamRef.current?.video || !isRecognizing) return;

        const video = webcamRef.current.video;
        if (video.readyState !== 4) {
            setTimeout(runRecognition, 200);
            return;
        }

        try {
            const result = await faceRecognitionService.recognizeFace(video);
            setRecognition(result);

            if (result.matched) {
                setLastRecognition({ ...result, timestamp: new Date() });
                setStatus(`✓ ${result.personName} (${result.confidence}%)`);
            } else if (result.detection) {
                setStatus(result.message);
            } else {
                setStatus('Looking for faces...');
            }

            if (result.detection && canvasRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const { box } = result.detection.detection;
                ctx.strokeStyle = result.matched ? '#10b981' : '#f59e0b';
                ctx.lineWidth = 3;
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                if (result.matched) {
                    ctx.fillStyle = '#10b981';
                    ctx.font = 'bold 16px Inter, sans-serif';
                    ctx.fillRect(box.x, box.y - 25, ctx.measureText(`${result.personName} ${result.confidence}%`).width + 10, 22);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(`${result.personName} ${result.confidence}%`, box.x + 5, box.y - 8);
                }
            }
        } catch (error) {
            console.error('Recognition error:', error);
        }

        if (isRecognizing) setTimeout(runRecognition, 200);
    }, [isRecognizing]);

    useEffect(() => {
        if (isRecognizing) runRecognition();
    }, [isRecognizing, runRecognition]);

    const toggleRecognition = () => {
        setIsRecognizing(!isRecognizing);
        if (!isRecognizing) setStatus('Starting...');
        else setStatus('Stopped');
    };

    const deletePerson = (label) => {
        faceRecognitionService.deleteTrainedPerson(label);
        setTrainedPersons(faceRecognitionService.getTrainedPersons());
    };

    const exportModel = () => {
        faceRecognitionService.exportModel();
        setStatus('Model exported!');
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const result = await faceRecognitionService.importModel(file);
            setImportResult(result);
            setTrainedPersons(faceRecognitionService.getTrainedPersons());
            setStatus(`Imported ${result.personsImported} person(s)!`);
        } catch (error) {
            setStatus('Import failed: ' + error.message);
        }
        e.target.value = '';
    };

    const clearAll = () => {
        if (window.confirm('Delete ALL trained faces?')) {
            faceRecognitionService.clearAllData();
            setTrainedPersons([]);
            setLastRecognition(null);
            setStatus('All data cleared');
        }
    };

    return (
        <div className="container">
            <div className="header">
                <div className="logo">
                    <span className="logo-icon">👁️</span>
                    <span>Face Recognition</span>
                </div>
                <nav className="nav">
                    <a href="/" className="nav-link">Home</a>
                    <a href="/enroll" className="nav-link">Train Face</a>
                    <a href="/recognize" className="nav-link active">Recognize</a>
                </nav>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
                {/* Webcam */}
                <div className="card">
                    <h1 className="page-title">Live Face Recognition</h1>
                    <p className="page-subtitle">Works from any distance with high accuracy!</p>

                    <div className="webcam-container" style={{ marginTop: '20px', position: 'relative' }}>
                        {isLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '480px', gap: '16px' }}>
                                <div className="spinner"></div>
                                <p>{status}</p>
                            </div>
                        ) : (
                            <>
                                <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                                    videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
                                    style={{ width: '100%' }} />
                                <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
                            </>
                        )}
                    </div>

                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <div className={`status-badge ${recognition?.matched ? 'success' : 'warning'}`}>
                            {isRecognizing ? '🔴' : '⚪'} {status}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                        <button
                            className={`btn ${isRecognizing ? 'btn-outline' : 'btn-primary'} btn-lg`}
                            onClick={toggleRecognition}
                            disabled={isLoading || trainedPersons.length === 0}
                        >
                            {isRecognizing ? '⏹️ Stop' : '▶️ Start'}
                        </button>
                    </div>

                    {trainedPersons.length === 0 && !isLoading && (
                        <div style={{ marginTop: '20px', padding: '20px', background: 'var(--bg-light)', borderRadius: '10px', textAlign: 'center' }}>
                            <p style={{ color: 'var(--warning-color)' }}>⚠️ No trained faces!</p>
                            <a href="/enroll" className="btn btn-primary" style={{ marginTop: '10px' }}>Train Faces</a>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div>
                    {/* Last Recognition */}
                    {lastRecognition && (
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <h3>✅ Recognized</h3>
                            <div style={{ marginTop: '15px', padding: '20px', background: 'var(--gradient-success)', borderRadius: '12px', textAlign: 'center' }}>
                                <div style={{ fontSize: '48px' }}>👤</div>
                                <h2 style={{ margin: '10px 0 5px' }}>{lastRecognition.personName}</h2>
                                <div>ID: {lastRecognition.personId}</div>
                                <div style={{ marginTop: '15px', fontSize: '28px', fontWeight: 'bold' }}>
                                    {lastRecognition.confidence}%
                                </div>
                                <div style={{ fontSize: '12px', marginTop: '10px', opacity: 0.8 }}>
                                    {lastRecognition.timestamp.toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trained Faces */}
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <h3>👥 Trained ({trainedPersons.length})</h3>
                        {trainedPersons.length > 0 ? (
                            <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto' }}>
                                {trainedPersons.map((p) => {
                                    const [id, ...nameParts] = p.label.split('_');
                                    return (
                                        <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-light)', borderRadius: '8px', marginBottom: '6px' }}>
                                            <div>
                                                <div style={{ fontWeight: '500' }}>{nameParts.join(' ') || p.label}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    {id} • {p.count} embeddings
                                                </div>
                                            </div>
                                            <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => deletePerson(p.label)}>🗑️</button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', marginTop: '15px' }}>No faces trained</p>
                        )}
                    </div>

                    {/* Export/Import */}
                    <div className="card">
                        <h3>📦 Model Data</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                            Export to use on other devices or backup
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
                            <button
                                className="btn btn-primary"
                                onClick={exportModel}
                                disabled={trainedPersons.length === 0}
                            >
                                📥 Export Model (JSON)
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".json"
                                onChange={handleImport}
                                style={{ display: 'none' }}
                            />
                            <button
                                className="btn btn-outline"
                                onClick={() => fileInputRef.current.click()}
                            >
                                📤 Import Model
                            </button>

                            <button
                                className="btn btn-outline"
                                onClick={clearAll}
                                disabled={trainedPersons.length === 0}
                                style={{ color: 'var(--error-color)' }}
                            >
                                🗑️ Clear All
                            </button>
                        </div>

                        {importResult && (
                            <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-light)', borderRadius: '8px', fontSize: '12px' }}>
                                ✓ Imported {importResult.personsImported} person(s)
                            </div>
                        )}

                        <div style={{ marginTop: '15px', padding: '12px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <strong>How to use exported model:</strong><br />
                                1. Export downloads a JSON file<br />
                                2. Import on any device/browser<br />
                                3. Or parse JSON in Python/Node.js
                            </div>
                        </div>
                    </div>

                    <a href="/enroll" className="btn btn-outline" style={{ width: '100%', marginTop: '15px' }}>
                        ➕ Train New Face
                    </a>
                </div>
            </div>
        </div>
    );
};

export default RecognitionPage;
