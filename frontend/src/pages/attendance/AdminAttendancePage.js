/**
 * Admin Attendance Page - Hierarchical Card Selection
 * Area → Ward → Route → Trips
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = '/api/v1/attendance';
const MEDIA_BASE = '';

const AdminAttendancePage = () => {
    const navigate = useNavigate();
    const { attendanceOrg, rootAdmin } = useAuth();

    // Hierarchy selection state
    const [step, setStep] = useState(1); // 1=Areas, 2=Wards, 3=Routes, 4=Trips
    const [areas, setAreas] = useState([]);
    const [wards, setWards] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [trips, setTrips] = useState([]);

    const [selectedArea, setSelectedArea] = useState(null);
    const [selectedWard, setSelectedWard] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [viewingWardTrips, setViewingWardTrips] = useState(false);
    const [loadingTrips, setLoadingTrips] = useState(false);
    const [loadingWards, setLoadingWards] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Date filter state
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [datePreset, setDatePreset] = useState('today');
    const [showCalendar, setShowCalendar] = useState(false);

    // Date helper functions
    const formatDateForAPI = (date) => {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    const formatDateForDisplay = (date) => {
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const handleDatePreset = (preset) => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'yesterday':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'week':
                start.setDate(today.getDate() - 6); // Last 7 days including today
                end = new Date(today);
                break;
            case 'month':
                start.setDate(today.getDate() - 29); // Last 30 days including today
                end = new Date(today);
                break;
            default: // today
                start = new Date(today);
                end = new Date(today);
        }

        setStartDate(start);
        setEndDate(end);
        setDatePreset(preset);
        setShowCalendar(false);
        // Reload trips if ward is selected
        if (selectedWard) {
            handleSelectWard(selectedWard, start, end);
        }
    };

    const handleCustomDate = (e) => {
        const date = new Date(e.target.value);
        setStartDate(date);
        setEndDate(date);
        setDatePreset('custom');
        setShowCalendar(false);
        if (selectedWard) {
            handleSelectWard(selectedWard, date, date);
        }
    };

    useEffect(() => {
        if (attendanceOrg) {
            loadAreas();
        }
    }, [attendanceOrg]);

    const loadAreas = async () => {
        setLoading(true);
        setError('');
        try {
            if (!attendanceOrg?.id) {
                setError('Organization ID missing');
                setLoading(false);
                return;
            }
            const res = await fetch(`${API_BASE}/areas/?organization_id=${attendanceOrg.id}`);
            const data = await res.json();
            if (data.success) {
                setAreas(data.areas || []);
            } else {
                setError(data.error || 'Failed to load areas');
            }
        } catch (e) {
            setError('Server error');
        }
        setLoading(false);
    };

    const handleSelectArea = async (area) => {
        setSelectedArea(area);
        setSelectedWard(null); // Reset ward selection when area changes
        setTrips([]);
        setLoadingWards(true);
        try {
            const res = await fetch(`${API_BASE}/wards/?area_id=${area.id}`);
            const data = await res.json();
            if (data.success) {
                setWards(data.wards || []);
            }
        } catch (e) {
            console.error('Failed to load wards', e);
        }
        setLoadingWards(false);
    };

    const handleSelectWard = async (ward, startOverride = null, endOverride = null) => {
        setSelectedWard(ward);
        setLoadingTrips(true);
        const start = startOverride || startDate;
        const end = endOverride || endDate;
        try {
            // Fetch trips for this ward filtered by date range
            const startParam = formatDateForAPI(start);
            const endParam = formatDateForAPI(end);
            const res = await fetch(`${API_BASE}/trips/?ward_id=${ward.id}&start_date=${startParam}&end_date=${endParam}`);
            const data = await res.json();
            if (res.ok) {
                setTrips(data.trips || []);
            }
        } catch (e) {
            console.error('Failed to load trips', e);
        }
        setLoadingTrips(false);
    };

    const closeWardPopup = () => {
        setViewingWardTrips(false);
        setSelectedWard(null);
        setTrips([]);
    };

    const handleSelectRoute = async (route) => {
        setSelectedRoute(route);
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/trips/?route_id=${route.id}`);
            const data = await res.json();
            if (res.ok) {
                setTrips(data.trips || []);
                setStep(4);
            }
        } catch (e) {
            setError('Failed to load trips');
        }
        setLoading(false);
    };

    const handleBack = () => {
        if (step === 3) {
            setStep(2);
            setSelectedWard(null);
        } else if (step === 2) {
            setStep(1);
            setSelectedArea(null);
        }
    };

    const handleReset = () => {
        setStep(1);
        setSelectedArea(null);
        setSelectedWard(null);
        setSelectedRoute(null);
        loadAreas();
    };

    // Breadcrumb text
    const getBreadcrumb = () => {
        const parts = [attendanceOrg?.name];
        if (selectedArea) parts.push(selectedArea.name);
        if (selectedWard) parts.push(selectedWard.name);
        return parts.join(' > ');
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-muted)', overflow: 'hidden' }}>
            {/* Clean Professional Header */}
            <div style={{
                background: '#ffffff',
                padding: '12px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 50,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>🚗</span>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                            Trip Attendance
                        </h1>
                    </div>

                    {/* Integrated Breadcrumb */}
                    <div style={{
                        height: '24px',
                        width: '1px',
                        background: '#cbd5e1'
                    }}></div>

                    <div style={{
                        fontSize: '0.9rem',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>{attendanceOrg?.name}</span>
                        {selectedArea && (
                            <>
                                <span style={{ color: '#cbd5e1' }}>/</span>
                                <span style={{ color: '#0f172a', fontWeight: '500' }}>{selectedArea.name}</span>
                            </>
                        )}
                        {selectedWard && (
                            <>
                                <span style={{ color: '#cbd5e1' }}>/</span>
                                <span style={{ color: '#0f172a', fontWeight: '500' }}>{selectedWard.name}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Date Filter Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', marginRight: '16px' }}>
                    {['today', 'yesterday', 'week', 'month'].map((preset) => (
                        <button
                            key={preset}
                            onClick={() => handleDatePreset(preset)}
                            style={{
                                padding: '6px 12px',
                                background: datePreset === preset ? '#059669' : '#f1f5f9',
                                color: datePreset === preset ? 'white' : '#64748b',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                        >
                            {preset === 'today' ? 'Today' : preset === 'yesterday' ? 'Yesterday' : preset === 'week' ? '7 Days' : '30 Days'}
                        </button>
                    ))}

                    {/* Custom Date Picker */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            style={{
                                padding: '6px 12px',
                                background: datePreset === 'custom' ? '#059669' : '#f1f5f9',
                                color: datePreset === 'custom' ? 'white' : '#64748b',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            📅 {datePreset === 'custom' ? formatDateForDisplay(startDate) : 'Custom'}
                        </button>

                        {showCalendar && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                zIndex: 100
                            }}>
                                <input
                                    type="date"
                                    value={formatDateForAPI(startDate)}
                                    onChange={handleCustomDate}
                                    max={formatDateForAPI(new Date())}
                                    style={{
                                        padding: '8px 12px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Current Date Display */}
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '8px' }}>
                        {datePreset === 'today' || datePreset === 'yesterday' || datePreset === 'custom'
                            ? formatDateForDisplay(startDate)
                            : `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`
                        }
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {selectedArea && (
                        <button
                            onClick={handleReset}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                background: '#fff1f2',
                                border: '1px solid #fecdd3',
                                color: '#e11d48',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#ffe4e6'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff1f2'}
                        >
                            <span>↺</span> Reset
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/attendance/admin')}
                        style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#475569',
                            padding: '6px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.color = '#0f172a';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.color = '#475569';
                        }}
                    >
                        Dashboard
                    </button>
                </div>
            </div>

            {/* Content Body - Fill remaining height */}
            <div style={{ flex: 1, width: '100%', padding: '24px', overflow: 'hidden' }}>
                {error && (
                    <div style={{
                        marginBottom: '20px',
                        padding: '12px 16px',
                        background: '#FEE2E2',
                        borderRadius: '10px',
                        color: '#DC2626'
                    }}>
                        ❌ {error}
                    </div>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '24px', height: '100%' }}>

                        {/* UNIFIED SIDEBAR: AREAS + WARDS */}
                        <div style={{
                            display: 'flex',
                            background: 'white',
                            borderRadius: '16px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            overflow: 'hidden',
                            height: '100%'
                        }}>
                            {/* COLUMN 1: AREAS */}
                            <div style={{
                                width: '200px',
                                display: 'flex', flexDirection: 'column',
                                borderRight: '1px solid #e2e8f0'
                            }}>
                                <div style={{ padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>Areas ({areas.length})</h2>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {areas.map(area => (
                                        <div
                                            key={area.id}
                                            onClick={() => handleSelectArea(area)}
                                            style={{
                                                padding: '16px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9',
                                                background: selectedArea?.id === area.id ? '#eff6ff' : 'white',
                                                borderLeft: selectedArea?.id === area.id ? '4px solid #3b82f6' : '4px solid transparent',
                                                transition: 'all 0.1s'
                                            }}
                                        >
                                            <div style={{ fontWeight: '600', color: '#1e293b' }}>{area.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{area.code}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* COLUMN 2: WARDS */}
                            <div style={{
                                width: '220px',
                                display: 'flex', flexDirection: 'column',
                                background: selectedArea ? 'white' : '#f9fafb'
                            }}>
                                {selectedArea ? (
                                    <>
                                        <div style={{ padding: '16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>Wards</h2>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>in {selectedArea.name}</div>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            {loadingWards ? (
                                                <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner"></div></div>
                                            ) : wards.length === 0 ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No wards found</div>
                                            ) : (
                                                wards.map(ward => (
                                                    <div
                                                        key={ward.id}
                                                        onClick={() => handleSelectWard(ward)}
                                                        style={{
                                                            padding: '12px 16px',
                                                            cursor: 'pointer',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            background: selectedWard?.id === ward.id ? '#ecfdf5' : 'white',
                                                            borderLeft: selectedWard?.id === ward.id ? '4px solid #10b981' : '4px solid transparent',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            transition: 'all 0.1s'
                                                        }}
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: '600', color: '#1e293b' }}>{ward.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{ward.code}</div>
                                                        </div>
                                                        {selectedWard?.id === ward.id && <span style={{ color: '#10b981' }}>➤</span>}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.5 }}>👈</div>
                                            <div>Select an Area</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 3: TRIPS */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {selectedWard ? (
                                <>
                                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h2 style={{ fontSize: '1.4rem', margin: 0, color: '#1e293b' }}>Trips: {selectedWard.name}</h2>
                                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontWeight: '600', fontSize: '0.9rem' }}>
                                            {trips.length} Total
                                        </span>
                                    </div>

                                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                                        {loadingTrips ? (
                                            <div style={{ textAlign: 'center', padding: '60px' }}>
                                                <div className="spinner"></div>
                                                <p style={{ marginTop: '16px', color: '#64748b' }}>Loading trips...</p>
                                            </div>
                                        ) : trips.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
                                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                                                <h3 style={{ color: '#475569', margin: 0 }}>No Data for this Ward</h3>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                {trips.map(trip => (
                                                    <TripCard key={trip.id} trip={trip} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '16px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>👈</div>
                                        <h3>Select a Ward</h3>
                                        <p>Trips will appear here</p>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

// Expanded Trip Card Component - Check-in LEFT, Checkout RIGHT
// Redesigned Trip Card - Large Vehicle Image, Small Avatars, Clear Compliance
// Simple, Functional Trip Card - Maximized for Visibility
const TripCard = ({ trip }) => {
    const formatTime = (isoString) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', weekday: 'short'
        });
    };

    // Compact Compliance Badge
    const ComplianceBadge = ({ label, passed }) => (
        <span style={{
            fontSize: '12px', padding: '2px 6px', borderRadius: '4px', margin: '0 4px 4px 0',
            border: passed ? '1px solid #16a34a' : '1px solid #dc2626',
            color: passed ? '#16a34a' : '#dc2626', background: passed ? '#f0fdf4' : '#fef2f2',
            display: 'inline-block', fontWeight: '600'
        }}>
            {passed ? '✓' : '✕'} {label.replace(/_/g, ' ')}
        </span>
    );

    // Simple Image Box
    // Enhanced Image Box with "Premium" Feel
    const ImageBox = ({ src, label, name, height = '120px', fit = 'cover', isPerson = false }) => (
        <div style={{
            display: 'flex', flexDirection: 'column',
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            height: '100%'
        }}>
            <div style={{ position: 'relative', height: height, background: '#f3f4f6' }}>
                {src ? (
                    <img
                        src={src}
                        alt={label}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: fit,
                            display: 'block'
                        }}
                    />
                ) : (
                    <div style={{
                        height: '100%',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        color: '#9ca3af',
                        background: '#f9fafb'
                    }}>
                        <div style={{ fontSize: '24px', opacity: 0.5 }}>{isPerson ? '👤' : '🚌'}</div>
                        <div style={{ fontSize: '11px', marginTop: '4px' }}>No {label}</div>
                    </div>
                )}
            </div>
            {/* Footer with clean typography */}
            <div style={{ padding: '8px 10px', borderTop: '1px solid #f3f4f6', background: 'white' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.3px', fontWeight: '600' }}>
                    {label}
                </div>
                {name && (
                    <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#111827',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px'
                    }}>
                        {name}
                    </div>
                )}
            </div>
        </div>
    );

    // Helper to format class names: "painted_number_plate" -> "Painted Number Plate"
    const formatClassName = (name) => {
        return name
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    };

    const ComplianceAnalysis = ({ detections, compliancePassed, complianceDetails }) => {
        if (!detections || Object.keys(detections).length === 0) {
            return <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', marginTop: '8px' }}>No detection data</div>;
        }

        // Format and filter detected items
        const detectedItems = Object.entries(detections)
            .filter(([key, value]) => value && value > 0)
            .map(([key]) => formatClassName(key));

        // Get and format missing items - consolidate Number Plate variants
        let missingItems = (complianceDetails?.checks?.required?.missing || [])
            .map(item => formatClassName(item));

        // Consolidate Number Plate variants into single entry
        const hasNumberPlateVariant = missingItems.some(item =>
            item.toLowerCase().includes('number plate')
        );
        if (hasNumberPlateVariant) {
            missingItems = missingItems.filter(item =>
                !item.toLowerCase().includes('number plate')
            );
            missingItems.push('Number Plate');
        }
        missingItems = [...new Set(missingItems)];

        // Build unified checklist: all detected + all missing
        const allItems = [
            ...detectedItems.map(item => ({ name: item, found: true })),
            ...missingItems.map(item => ({ name: item, found: false }))
        ];

        return (
            <div style={{ marginTop: '10px' }}>
                {/* Status Header - Subtle */}
                <div style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    marginBottom: '8px',
                    color: compliancePassed ? '#16a34a' : '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: compliancePassed ? '#16a34a' : '#dc2626'
                    }}></span>
                    {compliancePassed ? 'All Checks Passed' : 'Items Missing'}
                </div>

                {/* Clean Vertical Checklist */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '4px 12px',
                    fontSize: '12px'
                }}>
                    {allItems.map(item => (
                        <div key={item.name} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 0',
                            color: item.found ? '#15803d' : '#dc2626'
                        }}>
                            <span style={{ fontSize: '12px' }}>
                                {item.found ? '✓' : '✕'}
                            </span>
                            <span style={{
                                fontWeight: item.found ? '500' : '600',
                                textDecoration: item.found ? 'none' : 'none'
                            }}>
                                {item.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const TripSection = ({ title, time, location, color, driverImg, helperImg, vehicleImg, driverName, helperName, detections, compliancePassed, complianceDetails, isPending }) => (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{
                padding: '12px 20px', borderBottom: `2px solid ${color}`,
                background: isPending ? '#fffbeb' : '#ffffff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: color, letterSpacing: '1px' }}>{title}</div>
                {!isPending ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#1f2937' }}>{time}</div>
                        {location && (
                            <a href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer"
                                style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: '500' }}>📍 Map</a>
                        )}
                    </div>
                ) : <div style={{ fontSize: '13px', fontWeight: '700', color: '#d97706' }}>⚠️ PENDING</div>}
            </div>

            <div style={{ padding: '20px', background: isPending ? '#fffbeb' : '#ffffff', flex: 1 }}>
                {!isPending ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Adaptive People Layout */}
                        {helperName || helperImg ? (
                            // WITH Helper: 2-column grid
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <ImageBox src={driverImg} label="Driver" name={driverName} height="140px" isPerson={true} />
                                <ImageBox src={helperImg} label="Helper" name={helperName} height="140px" isPerson={true} />
                            </div>
                        ) : (
                            // SOLO Driver: Centered with badge
                            <div style={{ display: 'flex', alignItems: 'stretch', gap: '16px' }}>
                                <div style={{ flex: '0 0 auto', maxWidth: '200px' }}>
                                    <ImageBox src={driverImg} label="Driver" name={driverName} height="140px" isPerson={true} />
                                </div>
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#9ca3af',
                                    fontSize: '12px',
                                    background: '#fafafa',
                                    borderRadius: '8px',
                                    border: '1px dashed #e5e7eb'
                                }}>
                                    <span style={{ opacity: 0.7 }}>Solo Trip (No Helper)</span>
                                </div>
                            </div>
                        )}
                        <div>
                            <ImageBox src={vehicleImg} label="Vehicle Scan" height="220px" fit="contain" />
                            <ComplianceAnalysis detections={detections} compliancePassed={compliancePassed} complianceDetails={complianceDetails} />
                        </div>
                    </div>
                ) : (
                    <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#92400e' }}>Waiting for Checkout...</div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div style={{
            background: 'white', borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            marginBottom: '32px', overflow: 'hidden', border: '1px solid #f3f4f6'
        }}>
            <div style={{
                padding: '16px 24px', background: '#ffffff', borderBottom: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: '700' }}>
                        {trip.route?.code || 'NO-ROUTE'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{trip.route?.name || 'Unknown Route'}</span>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>📅 {formatDate(trip.date)}</span>
                    </div>
                </div>
                <div style={{ padding: '6px 16px', borderRadius: '20px', background: trip.status === 'completed' ? '#dcfce7' : '#fef3c7', color: trip.status === 'completed' ? '#166534' : '#b45309', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase' }}>
                    {trip.status.replace(/_/g, ' ')}
                </div>
            </div>

            <div style={{ display: 'flex', borderTop: '1px solid #e5e7eb' }}>
                <TripSection
                    title="DUTY IN" color="#16a34a"
                    time={formatTime(trip.checkin_time)} location={trip.checkin_location}
                    driverImg={trip.checkin_driver_image} driverName={trip.driver?.name}
                    helperImg={trip.checkin_helper_image} helperName={trip.helper?.name}
                    vehicleImg={trip.checkin_vehicle_image} detections={trip.checkin_vehicle_detections}
                    compliancePassed={trip.checkin_compliance_passed}
                    complianceDetails={trip.checkin_compliance_details}
                    isPending={false}
                />
                <div style={{ width: '1px', background: '#e5e7eb' }}></div>
                <TripSection
                    title="DUTY OUT" color="#f59e0b"
                    time={formatTime(trip.checkout_time)} location={trip.checkout_location}
                    driverImg={trip.checkout_driver_image} driverName={trip.driver?.name}
                    helperImg={trip.checkout_helper_image} helperName={trip.helper?.name}
                    vehicleImg={trip.checkout_vehicle_image} detections={trip.checkout_vehicle_detections}
                    compliancePassed={trip.checkout_compliance_passed}
                    complianceDetails={trip.checkout_compliance_details}
                    isPending={!trip.checkout_time}
                />
            </div>
        </div>
    );
};

export default AdminAttendancePage;
