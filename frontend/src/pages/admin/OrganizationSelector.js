/**
 * Organization Selector - Root Admin
 * Shows ALL organizations as cards for admin to select which one to manage
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = '/api/v1/attendance';

const OrganizationSelector = () => {
    const navigate = useNavigate();
    const { rootAdmin, selectOrganization, logoutRootAdmin } = useAuth();

    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!rootAdmin) {
            navigate('/admin/login');
            return;
        }
        fetchOrganizations();
    }, [rootAdmin]);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/organizations-list/`);
            const data = await res.json();
            if (data.success) {
                setOrganizations(data.organizations || []);
            } else {
                setError(data.error || 'Failed to load organizations');
            }
        } catch (e) {
            setError('Server connection failed');
        }
        setLoading(false);
    };

    const handleSelectOrg = (org) => {
        if (!org || !org.id) {
            console.error('Organization object missing ID:', org);
            setError('Selected organization data is invalid (missing ID)');
            return;
        }

        // Store full org object
        selectOrganization({
            id: org.id,
            org_code: org.org_code,
            name: org.name,
            logo: org.logo
        });

        // Smart Redirection based on Role
        // If superuser -> Full Admin Dashboard (Models, Settings, etc.)
        // If standard manager -> Manager Dashboard (Attendance, Employees only)
        if (rootAdmin?.is_superuser) {
            navigate('/attendance/admin');
        } else {
            navigate('/attendance/manager');
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-muted)' }}>
                <div style={{ fontSize: '3rem' }}>⏳</div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-muted)' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '30px 20px',
                color: 'white'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '2rem' }}>🏢</span>
                                <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
                                    Root Admin Dashboard
                                </h1>
                            </div>
                            <p style={{ opacity: 0.9, margin: 0 }}>
                                Welcome, <strong>{rootAdmin?.username}</strong> • Select an organization to manage
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                logoutRootAdmin();
                                navigate('/admin/login');
                            }}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600'
                            }}
                        >
                            🚪 Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
                {error && (
                    <div style={{
                        marginBottom: '24px',
                        padding: '16px',
                        background: '#FEE2E2',
                        borderRadius: '12px',
                        color: '#DC2626',
                        textAlign: 'center'
                    }}>
                        ❌ {error}
                    </div>
                )}

                {organizations.length === 0 ? (
                    <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🏢</div>
                        <h3 style={{ marginBottom: '8px' }}>No Organizations Yet</h3>
                        <p style={{ color: 'var(--text-muted)' }}>
                            Create organizations in Django admin first
                        </p>
                    </div>
                ) : (
                    <>
                        <h2 style={{ marginBottom: '24px', fontSize: '1.3rem' }}>
                            Select Organization ({organizations.length})
                        </h2>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '24px'
                        }}>
                            {organizations.map((org) => (
                                <div
                                    key={org.org_code}
                                    className="card"
                                    onClick={() => handleSelectOrg(org)}
                                    style={{
                                        padding: '24px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        border: '2px solid transparent'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.borderColor = '#667eea';
                                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.borderColor = 'transparent';
                                        e.currentTarget.style.boxShadow = '';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                        <div style={{
                                            width: '64px',
                                            height: '64px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '2rem',
                                            flexShrink: 0
                                        }}>
                                            🏙️
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: '1.3rem',
                                                fontWeight: '700',
                                                color: 'var(--text-primary)',
                                                marginBottom: '4px'
                                            }}>
                                                {org.name}
                                            </div>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                color: 'var(--text-muted)',
                                                fontFamily: 'monospace',
                                                fontWeight: '600'
                                            }}>
                                                {org.org_code}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '6px 12px',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            color: '#10b981',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600'
                                        }}>
                                            📊 Manage Data
                                        </span>
                                    </div>

                                    <div style={{
                                        marginTop: '16px',
                                        padding: '12px',
                                        background: 'var(--bg-soft)',
                                        borderRadius: '8px',
                                        textAlign: 'center',
                                        color: '#667eea',
                                        fontWeight: '600',
                                        fontSize: '0.95rem'
                                    }}>
                                        Click to Manage →
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default OrganizationSelector;
