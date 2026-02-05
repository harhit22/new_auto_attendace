/**
 * Image Gallery Component
 * Shows all captured images for an employee
 */
import React, { useState, useEffect } from 'react';

const API_BASE = '/api/v1/attendance';  // Uses relative path for nginx proxy
const MEDIA_BASE = '';  // Uses relative path for nginx proxy

const ImageGallery = ({ orgCode, employeeId, onClose }) => {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        loadImages();
    }, [orgCode, employeeId]);

    const loadImages = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/employee-images/?org_code=${orgCode}&employee_id=${employeeId}`);
            const result = await res.json();
            if (res.ok) {
                setData(result);
            }
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading images...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Failed to load images</p>
            </div>
        );
    }

    return (
        <div className="card" style={{ padding: '30px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ marginBottom: '4px' }}>📷 {data.employee.name}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        ID: {data.employee.employee_id} • {data.employee.department || 'No department'}
                    </p>
                </div>
                <button className="btn btn-outline" onClick={onClose}>✕ Close</button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div style={{
                    padding: '16px 24px',
                    background: 'var(--bg-soft)',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>
                        {data.total}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Images</div>
                </div>
                <div style={{
                    padding: '16px 24px',
                    background: 'var(--bg-soft)',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '1.2rem',
                        fontWeight: '600',
                        color: data.employee.face_enrolled ? 'var(--success)' : 'var(--warning)'
                    }}>
                        {data.employee.image_status}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</div>
                </div>
                <div style={{
                    padding: '16px 24px',
                    background: data.total >= 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    borderRadius: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: data.total >= 100 ? 'var(--success)' : 'var(--warning)'
                    }}>
                        {data.total >= 100 ? '✅ Ready' : `${100 - data.total} more needed`}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>For Heavy Training</div>
                </div>
            </div>

            {/* Image Grid */}
            {data.images.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '60px',
                    background: 'var(--bg-soft)',
                    borderRadius: '16px'
                }}>
                    <p style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</p>
                    <p style={{ color: 'var(--text-muted)' }}>No images captured yet</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                    gap: '12px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '8px'
                }}>
                    {data.images.map((img, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedImage(img)}
                            style={{
                                aspectRatio: '1',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '3px solid transparent',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => e.target.style.borderColor = 'var(--primary)'}
                            onMouseLeave={e => e.target.style.borderColor = 'transparent'}
                        >
                            <img
                                src={`${MEDIA_BASE}${img.url}`}
                                alt={img.filename}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Full Image Modal */}
            {selectedImage && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000
                    }}
                    onClick={() => setSelectedImage(null)}
                >
                    <img
                        src={`${MEDIA_BASE}${selectedImage.url}`}
                        alt={selectedImage.filename}
                        style={{
                            maxWidth: '90%',
                            maxHeight: '90%',
                            borderRadius: '16px',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: '40px',
                        color: 'white',
                        background: 'rgba(0,0,0,0.6)',
                        padding: '12px 24px',
                        borderRadius: '50px'
                    }}>
                        {selectedImage.filename}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageGallery;
