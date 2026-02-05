/**
 * Mobile-First Landing Page
 * Simple, clean, single login button
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center'
        }}>
            {/* Logo/Title */}
            <div style={{
                marginBottom: '40px',
                color: 'white'
            }}>
                <div style={{ fontSize: '4rem', marginBottom: '10px' }}>🚗</div>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    marginBottom: '8px',
                    textShadow: '0 2px 10px rgba(0,0,0,0.2)'
                }}>
                    Driver Duty System
                </h1>
                <p style={{
                    fontSize: '1rem',
                    opacity: 0.9,
                    maxWidth: '280px',
                    margin: '0 auto'
                }}>
                    Face से अपनी Duty दर्ज करें
                </p>
            </div>

            {/* Login Button */}
            <button
                onClick={() => navigate('/employee/login')}
                style={{
                    width: '100%',
                    maxWidth: '300px',
                    padding: '20px 40px',
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    color: '#667eea',
                    background: 'white',
                    border: 'none',
                    borderRadius: '50px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => {
                    e.target.style.transform = 'scale(1.05)';
                    e.target.style.boxShadow = '0 15px 40px rgba(0,0,0,0.4)';
                }}
                onMouseOut={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
                }}
            >
                🔐 Login करें
            </button>

            {/* Footer */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.8rem',
                    padding: '20px'
                }}
            >
                Powered by FaceAI
            </div>

            {/* Admin Link - Hidden in Native App/Mobile via CSS */}
            <div
                className="desktop-only"
                onClick={() => navigate('/admin/login')}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    padding: '8px 16px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.1)'
                }}
            >
                Admin Login
            </div>
        </div>
    );
};

export default HomePage;
