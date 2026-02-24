/**
 * LoadingOverlay Component
 * Full-screen loading overlay with Hindi messages for duty save operations
 */
import React from 'react';

const LoadingOverlay = ({ isVisible, message = "डेटा सेव हो रहा है..." }) => {
    if (!isVisible) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.content}>
                {/* Spinning Loader */}
                <div style={styles.spinner}>
                    <div style={styles.spinnerInner}></div>
                </div>

                {/* Message */}
                <div style={styles.message}>{message}</div>
                <div style={styles.subMessage}>कृपया प्रतीक्षा करें...</div>

                {/* Animated dots */}
                <div style={styles.dots}>
                    <span style={styles.dot}>●</span>
                    <span style={{ ...styles.dot, animationDelay: '0.2s' }}>●</span>
                    <span style={{ ...styles.dot, animationDelay: '0.4s' }}>●</span>
                </div>
            </div>

            {/* CSS Keyframes */}
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.3s ease-out'
    },
    content: {
        textAlign: 'center',
        color: 'white',
        padding: '40px'
    },
    spinner: {
        width: '80px',
        height: '80px',
        margin: '0 auto 24px auto',
        borderRadius: '50%',
        border: '4px solid rgba(255, 255, 255, 0.2)',
        borderTop: '4px solid #10b981',
        animation: 'spin 1s linear infinite'
    },
    spinnerInner: {
        width: '100%',
        height: '100%'
    },
    message: {
        fontSize: '1.5rem',
        fontWeight: '700',
        marginBottom: '8px',
        color: '#10b981'
    },
    subMessage: {
        fontSize: '1rem',
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: '20px'
    },
    dots: {
        display: 'flex',
        justifyContent: 'center',
        gap: '8px'
    },
    dot: {
        fontSize: '1.2rem',
        color: '#10b981',
        animation: 'pulse 1.4s ease-in-out infinite'
    }
};

export default LoadingOverlay;
