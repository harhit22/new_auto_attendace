/**
 * Trip Detail Page - Shows complete trip information
 * Images, timeline, compliance, GPS, etc.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE = '/api/v1/attendance';

const TripDetailPage = () => {
    const navigate = useNavigate();
    const { tripId } = useParams();
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadTripDetails();
    }, [tripId]);

    const loadTripDetails = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/trips/${tripId}/`);
            const data = await res.json();
            if (res.ok) {
                setTrip(data);
            } else {
                setError('Failed to load trip details');
            }
        } catch (e) {
            setError('Server error');
        }
        setLoading(false);
    };

    const formatTime = (isoString) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (error || !trip) {
        return (
            <div style={{ minHeight: '100vh', background: 'var(--bg-muted)', padding: '40px' }}>
                <div className="card" style={{ padding: '40px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>❌</div>
                    <h2>{error || 'Trip not found'}</h2>
                    <button onClick={() => navigate(-1)} className="btn btn-primary" style={{ marginTop: '20px' }}>
                        ← Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-muted)' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px',
                color: 'white'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginBottom: '12px'
                        }}
                    >
                        ← Back
                    </button>
                    <h1 style={{ fontSize: '1.5rem', margin: '8px 0' }}>
                        🚗 Trip Details
                    </h1>
                    <p style={{ opacity: 0.9 }}>
                        {formatDate(trip.date)} • Status: {trip.status.replace(/_/g, ' ').toUpperCase()}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>

                {/* Driver & Helper Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                    {/* Driver Card */}
                    <div className="card" style={{ padding: '20px' }}>
                        <h3 style={{ marginBottom: '16px' }}>👨‍✈️ Driver</h3>
                        <div style={{ fontWeight: '700', fontSize: '1.2rem', marginBottom: '8px' }}>
                            {trip.driver?.name}
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                            ID: {trip.driver?.id}
                        </div>

                        {/* Driver Check-in Image */}
                        {trip.checkin_driver_image && (
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>Check-in Photo</div>
                                <img
                                    src={trip.checkin_driver_image}
                                    alt="Driver Check-in"
                                    style={{ width: '100%', borderRadius: '12px', marginBottom: '8px' }}
                                />
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {formatTime(trip.checkin_time)}
                                </div>
                            </div>
                        )}

                        {/* Driver Checkout Image */}
                        {trip.checkout_driver_image && (
                            <div style={{ marginTop: '16px' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>Checkout Photo</div>
                                <img
                                    src={trip.checkout_driver_image}
                                    alt="Driver Checkout"
                                    style={{ width: '100%', borderRadius: '12px', marginBottom: '8px' }}
                                />
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {formatTime(trip.checkout_time)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Helper Card */}
                    {trip.helper && !trip.helper_skipped ? (
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ marginBottom: '16px' }}>👷 Helper</h3>
                            <div style={{ fontWeight: '700', fontSize: '1.2rem', marginBottom: '8px' }}>
                                {trip.helper?.name}
                            </div>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                                ID: {trip.helper?.id}
                            </div>

                            {trip.checkin_helper_image && (
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>Check-in Photo</div>
                                    <img
                                        src={trip.checkin_helper_image}
                                        alt="Helper Check-in"
                                        style={{ width: '100%', borderRadius: '12px', marginBottom: '8px' }}
                                    />
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {formatTime(trip.checkin_time)}
                                    </div>
                                </div>
                            )}

                            {trip.checkout_helper_image && (
                                <div style={{ marginTop: '16px' }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>Checkout Photo</div>
                                    <img
                                        src={trip.checkout_helper_image}
                                        alt="Helper Checkout"
                                        style={{ width: '100%', borderRadius: '12px', marginBottom: '8px' }}
                                    />
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {formatTime(trip.checkout_time)}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card" style={{ padding: '20px', background: 'var(--bg-soft)' }}>
                            <h3 style={{ marginBottom: '16px' }}>👷 Helper</h3>
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⏭️</div>
                                <div>Helper Skipped</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Vehicle Images */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                    {/* Check-in Vehicle */}
                    {trip.checkin_vehicle_image && (
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ marginBottom: '16px' }}>🚚 Vehicle Check-in</h3>
                            <img
                                src={trip.checkin_vehicle_image}
                                alt="Vehicle Check-in"
                                style={{ width: '100%', borderRadius: '12px', marginBottom: '12px' }}
                            />
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {formatTime(trip.checkin_time)}
                            </div>
                            {trip.checkin_vehicle_detections && (
                                <div style={{ marginTop: '12px', fontSize: '0.9rem' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Compliance:</div>
                                    <pre style={{
                                        background: 'var(--bg-soft)',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        overflow: 'auto'
                                    }}>
                                        {JSON.stringify(trip.checkin_vehicle_detections, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Checkout Vehicle */}
                    {trip.checkout_vehicle_image && (
                        <div className="card" style={{ padding: '20px' }}>
                            <h3 style={{ marginBottom: '16px' }}>🚚 Vehicle Checkout</h3>
                            <img
                                src={trip.checkout_vehicle_image}
                                alt="Vehicle Checkout"
                                style={{ width: '100%', borderRadius: '12px', marginBottom: '12px' }}
                            />
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {formatTime(trip.checkout_time)}
                            </div>
                            {trip.checkout_vehicle_detections && (
                                <div style={{ marginTop: '12px', fontSize: '0.9rem' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>Compliance:</div>
                                    <pre style={{
                                        background: 'var(--bg-soft)',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        overflow: 'auto'
                                    }}>
                                        {JSON.stringify(trip.checkout_vehicle_detections, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* GPS Locations */}
                {(trip.checkin_location || trip.checkout_location) && (
                    <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
                        <h3 style={{ marginBottom: '16px' }}>📍 GPS Locations</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                            {trip.checkin_location && (
                                <div>
                                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Check-in Location</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                        Lat: {trip.checkin_location.latitude}<br />
                                        Lng: {trip.checkin_location.longitude}
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps?q=${trip.checkin_location.latitude},${trip.checkin_location.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-block',
                                            marginTop: '8px',
                                            color: '#667eea',
                                            textDecoration: 'none',
                                            fontWeight: '600'
                                        }}
                                    >
                                        View on Map →
                                    </a>
                                </div>
                            )}
                            {trip.checkout_location && (
                                <div>
                                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Checkout Location</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                        Lat: {trip.checkout_location.latitude}<br />
                                        Lng: {trip.checkout_location.longitude}
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps?q=${trip.checkout_location.latitude},${trip.checkout_location.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-block',
                                            marginTop: '8px',
                                            color: '#667eea',
                                            textDecoration: 'none',
                                            fontWeight: '600'
                                        }}
                                    >
                                        View on Map →
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Timeline */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ marginBottom: '16px' }}>⏱️ Timeline</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '120px', fontWeight: '600' }}>Check-in:</div>
                            <div>{formatTime(trip.checkin_time)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '120px', fontWeight: '600' }}>Checkout:</div>
                            <div>{trip.checkout_time ? formatTime(trip.checkout_time) : 'Pending'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '120px', fontWeight: '600' }}>Status:</div>
                            <div style={{
                                padding: '4px 12px',
                                borderRadius: '50px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                background: trip.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                color: trip.status === 'completed' ? '#22c55e' : '#f59e0b'
                            }}>
                                {trip.status.replace(/_/g, ' ').toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TripDetailPage;
