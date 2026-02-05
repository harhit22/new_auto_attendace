/**
 * YOLO Model Management Page
 * Admin can upload, configure, and manage custom YOLO models
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = '/api/v1/detection';  // Uses relative path for nginx proxy

const YoloModelsPage = () => {
    const { attendanceOrg } = useAuth();
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        name: '',
        description: '',
        file: null
    });
    const [message, setMessage] = useState({ type: '', text: '' });

    // Get org from auth context  
    const orgCode = attendanceOrg?.org_code || 'ACME';

    useEffect(() => {
        loadModels();
    }, []);

    const loadModels = async () => {
        try {
            const res = await fetch(`${API_BASE}/yolo-models/?org_code=${orgCode}`);
            const data = await res.json();
            setModels(data.models || []);
        } catch (e) {
            console.error('Failed to load models:', e);
        }
        setLoading(false);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!uploadForm.name || !uploadForm.file) {
            setMessage({ type: 'error', text: 'Name and model file are required' });
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('org_code', orgCode);
        formData.append('name', uploadForm.name);
        formData.append('description', uploadForm.description);
        formData.append('model_file', uploadForm.file);

        try {
            const res = await fetch(`${API_BASE}/yolo-models/upload/`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                setUploadForm({ name: '', description: '', file: null });
                loadModels();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Upload failed' });
        }
        setUploading(false);
    };

    const toggleRequirement = async (modelId, className, currentRequired) => {
        try {
            await fetch(`${API_BASE}/yolo-models/${modelId}/requirements/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requirements: [{ class_name: className, is_required: !currentRequired }]
                })
            });
            loadModels();
        } catch (e) {
            console.error('Failed to update requirement:', e);
        }
    };

    const addClass = async (modelId, className) => {
        if (!className.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/yolo-models/${modelId}/add-class/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_name: className.trim(),
                    is_required: true
                })
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: data.message });
                loadModels();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (e) {
            console.error('Failed to add class:', e);
        }
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <Link to="/attendance/admin" style={styles.backLink}>← Back to Admin</Link>
                <h1 style={styles.title}>🎯 YOLO Model Management</h1>
                <p style={styles.subtitle}>Upload custom object detection models</p>
            </div>

            {/* Message */}
            {message.text && (
                <div style={{
                    ...styles.message,
                    background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: message.type === 'success' ? '#166534' : '#dc2626'
                }}>
                    {message.text}
                </div>
            )}

            {/* Upload Form */}
            <div style={styles.card}>
                <h2 style={styles.cardTitle}>📤 Upload New Model</h2>
                <form onSubmit={handleUpload} style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Model Name</label>
                        <input
                            type="text"
                            value={uploadForm.name}
                            onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                            placeholder="e.g., Safety Gear Detector"
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Description (optional)</label>
                        <input
                            type="text"
                            value={uploadForm.description}
                            onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                            placeholder="Detects helmets, vests, badges..."
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>YOLO Model File (.pt)</label>
                        <input
                            type="file"
                            accept=".pt"
                            onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                            style={styles.fileInput}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={uploading}
                        style={styles.uploadBtn}
                    >
                        {uploading ? '⏳ Uploading...' : '🚀 Upload Model'}
                    </button>
                </form>
            </div>

            {/* Models List */}
            <div style={styles.card}>
                <h2 style={styles.cardTitle}>📋 Your Models</h2>
                {loading ? (
                    <p>Loading...</p>
                ) : models.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>📦</div>
                        <h3 style={styles.emptyTitle}>No YOLO models uploaded yet</h3>
                        <p style={styles.emptyText}>
                            Upload your custom YOLO model (.pt file) above.
                            After upload, the system will automatically:
                        </p>
                        <ul style={styles.emptyList}>
                            <li>✅ Extract all detectable classes from your model</li>
                            <li>✅ Show them below for you to configure</li>
                            <li>✅ Let you mark which classes are <strong>required</strong> for check-in</li>
                        </ul>
                        <div style={styles.exampleBox}>
                            <strong>Example:</strong> If your YOLO model detects [helmet, vest, badge],
                            you can require "helmet" and "vest" but make "badge" optional.
                        </div>
                    </div>
                ) : (
                    <div style={styles.modelsList}>
                        {models.map(model => (
                            <div key={model.id} style={styles.modelCard}>
                                <div style={styles.modelHeader}>
                                    <h3 style={styles.modelName}>{model.name}</h3>
                                    <span style={styles.classesBadge}>
                                        {model.classes.length} classes
                                    </span>
                                </div>
                                {model.description && (
                                    <p style={styles.modelDesc}>{model.description}</p>
                                )}

                                {/* Detection Requirements */}
                                <div style={styles.requirements}>
                                    <h4 style={styles.reqTitle}>Detection Requirements</h4>
                                    {model.requirements.length === 0 ? (
                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                            No classes defined yet. Add classes below:
                                        </p>
                                    ) : (
                                        <div style={styles.reqGrid}>
                                            {model.requirements.map(req => (
                                                <div
                                                    key={req.class_name}
                                                    style={{
                                                        ...styles.reqItem,
                                                        background: req.is_required ? '#dcfce7' : '#f3f4f6'
                                                    }}
                                                    onClick={() => toggleRequirement(model.id, req.class_name, req.is_required)}
                                                >
                                                    <span style={styles.reqCheck}>
                                                        {req.is_required ? '✅' : '⬜'}
                                                    </span>
                                                    <span style={styles.reqName}>{req.display_name}</span>
                                                    <span style={styles.reqStatus}>
                                                        {req.is_required ? 'Required' : 'Optional'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Add Class Form */}
                                    <div style={styles.addClassForm}>
                                        <input
                                            type="text"
                                            placeholder="Enter class name (e.g., helmet, vest)"
                                            id={`addClass-${model.id}`}
                                            style={styles.addClassInput}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    addClass(model.id, e.target.value);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                        <button
                                            style={styles.addClassBtn}
                                            onClick={() => {
                                                const input = document.getElementById(`addClass-${model.id}`);
                                                addClass(model.id, input.value);
                                                input.value = '';
                                            }}
                                        >
                                            + Add Class
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Link to Multi-Login */}
            <div style={styles.card}>
                <h2 style={styles.cardTitle}>🚀 Test Multi-Login</h2>
                <p>Test face recognition with object detection:</p>
                <Link to="/multi-login" style={styles.testBtn}>
                    Open Multi-Login Camera →
                </Link>
            </div>
        </div>
    );
};

const styles = {
    container: {
        maxWidth: '900px',
        margin: '0 auto',
        padding: '2rem'
    },
    header: {
        marginBottom: '2rem'
    },
    backLink: {
        color: '#6366f1',
        textDecoration: 'none',
        fontSize: '0.9rem'
    },
    title: {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#1e293b',
        marginTop: '0.5rem'
    },
    subtitle: {
        color: '#64748b',
        marginTop: '0.25rem'
    },
    message: {
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1rem'
    },
    card: {
        background: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    },
    cardTitle: {
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '1rem'
    },
    form: {
        display: 'grid',
        gap: '1rem'
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
    },
    label: {
        fontWeight: '500',
        color: '#374151'
    },
    input: {
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '1rem'
    },
    fileInput: {
        padding: '0.5rem'
    },
    uploadBtn: {
        padding: '0.75rem 1.5rem',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer'
    },
    empty: {
        color: '#64748b',
        textAlign: 'center',
        padding: '2rem'
    },
    emptyState: {
        textAlign: 'center',
        padding: '2rem',
        background: '#f8fafc',
        borderRadius: '12px'
    },
    emptyIcon: {
        fontSize: '3rem',
        marginBottom: '1rem'
    },
    emptyTitle: {
        fontSize: '1.2rem',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '0.5rem'
    },
    emptyText: {
        color: '#64748b',
        marginBottom: '1rem'
    },
    emptyList: {
        textAlign: 'left',
        maxWidth: '400px',
        margin: '0 auto 1rem',
        color: '#374151',
        lineHeight: '1.8'
    },
    exampleBox: {
        background: '#e0e7ff',
        padding: '1rem',
        borderRadius: '8px',
        color: '#4338ca',
        fontSize: '0.9rem',
        maxWidth: '500px',
        margin: '0 auto'
    },
    modelsList: {
        display: 'grid',
        gap: '1rem'
    },
    modelCard: {
        background: '#f8fafc',
        borderRadius: '8px',
        padding: '1rem',
        border: '1px solid #e2e8f0'
    },
    modelHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    modelName: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#1e293b'
    },
    classesBadge: {
        background: '#6366f1',
        color: 'white',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.8rem'
    },
    modelDesc: {
        color: '#64748b',
        fontSize: '0.9rem',
        marginTop: '0.5rem'
    },
    requirements: {
        marginTop: '1rem'
    },
    reqTitle: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '0.5rem'
    },
    reqGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '0.5rem'
    },
    reqItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    reqCheck: {
        fontSize: '1rem'
    },
    reqName: {
        flex: 1,
        fontWeight: '500'
    },
    reqStatus: {
        fontSize: '0.75rem',
        color: '#64748b'
    },
    testBtn: {
        display: 'inline-block',
        padding: '0.75rem 1.5rem',
        background: '#22c55e',
        color: 'white',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: '600',
        marginTop: '0.5rem'
    },
    addClassForm: {
        display: 'flex',
        gap: '0.5rem',
        marginTop: '1rem'
    },
    addClassInput: {
        flex: 1,
        padding: '0.5rem 0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '0.9rem'
    },
    addClassBtn: {
        padding: '0.5rem 1rem',
        background: '#6366f1',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '0.9rem'
    }
};

export default YoloModelsPage;
