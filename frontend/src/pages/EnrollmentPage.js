/**
 * Employee Enrollment Page
 * Scans faces, creates augmented dataset, and trains the recognition model
 */
import React, { useState } from 'react';
import FaceScanner from '../components/FaceScanner';
import faceRecognitionService from '../services/faceRecognition';

const EnrollmentPage = () => {
    const [step, setStep] = useState('form'); // form, scanning, training, complete
    const [employeeData, setEmployeeData] = useState({
        name: '',
        employee_id: '',
    });
    const [capturedImages, setCapturedImages] = useState([]);
    const [trainingProgress, setTrainingProgress] = useState(null);
    const [trainingResult, setTrainingResult] = useState(null);
    const [error, setError] = useState('');

    const handleInputChange = (e) => {
        setEmployeeData({
            ...employeeData,
            [e.target.name]: e.target.value,
        });
    };

    const startScanning = (e) => {
        e.preventDefault();

        if (!employeeData.name || !employeeData.employee_id) {
            setError('Please fill in name and employee ID');
            return;
        }

        setError('');
        setStep('scanning');
    };

    const handleCapture = (file, count) => {
        console.log(`Captured image ${count}:`, file.name);
    };

    const handleCaptureComplete = async (images) => {
        setCapturedImages(images);
        setStep('training');

        // Start training automatically
        try {
            // Create label from ID and name
            const label = `${employeeData.employee_id}_${employeeData.name.replace(/\s+/g, '_')}`;

            setTrainingProgress({
                stage: 'loading',
                message: 'Loading face recognition models...'
            });

            await faceRecognitionService.loadModels();

            setTrainingProgress({
                stage: 'training',
                message: 'Starting training with augmentations...'
            });

            const result = await faceRecognitionService.trainPerson(label, images, (progress) => {
                setTrainingProgress(progress);
            });

            setTrainingResult(result);
            setStep('complete');

        } catch (error) {
            console.error('Training error:', error);
            setError(error.message || 'Training failed. Please try again.');
            setStep('form');
        }
    };

    const resetEnrollment = () => {
        setStep('form');
        setEmployeeData({ name: '', employee_id: '' });
        setCapturedImages([]);
        setTrainingProgress(null);
        setTrainingResult(null);
        setError('');
    };

    return (
        <div className="container">
            <div className="header">
                <div className="logo">
                    <span className="logo-icon">📸</span>
                    <span>Face Training</span>
                </div>
                <nav className="nav">
                    <a href="/" className="nav-link">Home</a>
                    <a href="/enroll" className="nav-link active">Train Face</a>
                    <a href="/recognize" className="nav-link">Recognize</a>
                </nav>
            </div>

            <div className="card" style={{ maxWidth: '700px', margin: '0 auto' }}>
                <h1 className="page-title">Train Face Recognition</h1>
                <p className="page-subtitle">
                    Scan your face from multiple angles and train the AI model to recognize you
                </p>

                {error && (
                    <div className="status-badge error" style={{ display: 'block', marginTop: '20px', padding: '12px' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Step 1: Basic Info */}
                {step === 'form' && (
                    <form onSubmit={startScanning} style={{ marginTop: '30px' }}>
                        <div className="form-group">
                            <label className="form-label">Your Name *</label>
                            <input
                                type="text"
                                name="name"
                                className="form-input"
                                value={employeeData.name}
                                onChange={handleInputChange}
                                placeholder="Enter your name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">ID / Identifier *</label>
                            <input
                                type="text"
                                name="employee_id"
                                className="form-input"
                                value={employeeData.employee_id}
                                onChange={handleInputChange}
                                placeholder="EMP-001 or your unique ID"
                                required
                            />
                        </div>

                        <div style={{
                            padding: '16px',
                            background: 'var(--bg-light)',
                            borderRadius: '10px',
                            marginTop: '20px'
                        }}>
                            <h4 style={{ marginBottom: '12px' }}>🎯 What will happen:</h4>
                            <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                                <li>Scan face from <strong>5 angles</strong> (front, left, right, up, down)</li>
                                <li>AI applies <strong>augmentations</strong> (near/far, brightness, flip)</li>
                                <li><strong>Train model</strong> with 50+ face embeddings</li>
                                <li>Ready to <strong>recognize from any distance</strong>!</li>
                            </ol>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '20px' }}>
                            📸 Start Face Scanning
                        </button>
                    </form>
                )}

                {/* Step 2: Face Scanning */}
                {step === 'scanning' && (
                    <div style={{ marginTop: '30px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '20px',
                            padding: '12px',
                            background: 'var(--bg-light)',
                            borderRadius: '10px'
                        }}>
                            <span style={{ fontSize: '24px' }}>👤</span>
                            <div>
                                <strong>{employeeData.name}</strong>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    ID: {employeeData.employee_id}
                                </div>
                            </div>
                        </div>

                        <FaceScanner
                            guided={true}
                            onCapture={handleCapture}
                            onComplete={handleCaptureComplete}
                        />

                        <button
                            className="btn btn-outline"
                            style={{ marginTop: '20px' }}
                            onClick={() => setStep('form')}
                        >
                            ← Back
                        </button>
                    </div>
                )}

                {/* Step 3: Training */}
                {step === 'training' && trainingProgress && (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div className="spinner" style={{ margin: '0 auto 20px', width: '48px', height: '48px' }}></div>
                        <h2>Training AI Model...</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                            {trainingProgress.message}
                        </p>

                        {trainingProgress.current && (
                            <>
                                <div className="progress-container">
                                    <div
                                        className="progress-bar"
                                        style={{
                                            width: `${(trainingProgress.current / trainingProgress.total) * 100}%`
                                        }}
                                    ></div>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    Processed {trainingProgress.current}/{trainingProgress.total} images •
                                    {trainingProgress.descriptorsFound} embeddings created
                                </p>
                            </>
                        )}

                        <div style={{
                            marginTop: '30px',
                            padding: '16px',
                            background: 'var(--bg-light)',
                            borderRadius: '10px',
                            textAlign: 'left'
                        }}>
                            <h4 style={{ marginBottom: '10px' }}>🔄 Processing:</h4>
                            <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.8' }}>
                                <li>Extracting face features from each image</li>
                                <li>Applying scale variations (near/far simulation)</li>
                                <li>Applying brightness variations</li>
                                <li>Creating horizontal flip versions</li>
                                <li>Generating 128-dimension face embeddings</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Step 4: Complete */}
                {step === 'complete' && trainingResult && (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: 'var(--gradient-success)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px',
                            fontSize: '40px'
                        }}>
                            ✓
                        </div>

                        <h2>Training Complete!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
                            {employeeData.name} can now be recognized from any distance
                        </p>

                        <div className="stats-grid" style={{ maxWidth: '400px', margin: '0 auto' }}>
                            <div className="card stat-card">
                                <div className="stat-value">{capturedImages.length}</div>
                                <div className="stat-label">Images Captured</div>
                            </div>
                            <div className="card stat-card">
                                <div className="stat-value" style={{ color: 'var(--success-color)' }}>
                                    {trainingResult.descriptorCount}
                                </div>
                                <div className="stat-label">Face Embeddings</div>
                            </div>
                        </div>

                        <div style={{
                            marginTop: '30px',
                            padding: '20px',
                            background: 'var(--bg-light)',
                            borderRadius: '12px',
                            textAlign: 'left'
                        }}>
                            <h4 style={{ marginBottom: '12px' }}>📊 Training Details:</h4>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                                <p>• Original images: {capturedImages.length}</p>
                                <p>• Augmented versions: {trainingResult.descriptorCount}</p>
                                <p>• Augmentations applied: Scale (4 levels), Brightness (2 levels), Flip</p>
                                <p>• Model: Face Recognition (128-d embeddings)</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '30px' }}>
                            <a href="/recognize" className="btn btn-primary btn-lg">
                                👁️ Try Recognition
                            </a>
                            <button className="btn btn-outline" onClick={resetEnrollment}>
                                ➕ Train Another
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnrollmentPage;
