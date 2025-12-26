/**
 * Landing Page - Premium AI Aesthetic
 * Clean, Spacious, Glassmorphic
 */
import React from 'react';
import { Link } from 'react-router-dom';
import sleekRobot from '../assets/sleek_robot.png'; // Premium Robot Image

// SVG Wireframe Face Component for Premium Look
// This component is no longer used in HomePage, but kept if it has other uses.
// If not used elsewhere, it can be safely removed.
const CyberFace = () => (
    <svg viewBox="0 0 200 240" className="cyber-face-svg">
        <defs>
            <linearGradient id="cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        {/* Face Outline */}
        <path d="M100,30 C60,30 30,60 30,110 C30,160 50,190 80,210 C90,216 110,216 120,210 C150,190 170,160 170,110 C170,60 140,30 100,30"
            fill="none" stroke="url(#cyber-grad)" strokeWidth="1.5" filter="url(#glow)" className="face-outline" />

        {/* Horizontal Grid Lines */}
        <path d="M30,110 Q100,130 170,110" fill="none" stroke="rgba(129, 140, 248, 0.3)" strokeWidth="1" />
        <path d="M35,90 Q100,110 165,90" fill="none" stroke="rgba(129, 140, 248, 0.3)" strokeWidth="1" />
        <path d="M40,140 Q100,160 160,140" fill="none" stroke="rgba(129, 140, 248, 0.3)" strokeWidth="1" />
        <path d="M60,180 Q100,190 140,180" fill="none" stroke="rgba(129, 140, 248, 0.3)" strokeWidth="1" />

        {/* Vertical Grid Lines */}
        <path d="M100,30 Q100,110 100,215" fill="none" stroke="rgba(129, 140, 248, 0.4)" strokeWidth="1" />
        <path d="M60,45 Q50,110 70,200" fill="none" stroke="rgba(129, 140, 248, 0.2)" strokeWidth="1" />
        <path d="M140,45 Q150,110 130,200" fill="none" stroke="rgba(129, 140, 248, 0.2)" strokeWidth="1" />

        {/* Tech Nodes (Eyes, etc) */}
        <circle cx="70" cy="100" r="3" fill="#fff" className="tech-node" />
        <circle cx="130" cy="100" r="3" fill="#fff" className="tech-node" style={{ animationDelay: '0.5s' }} />
        <circle cx="100" cy="120" r="2" fill="#818cf8" className="tech-node" style={{ animationDelay: '1s' }} />
        <circle cx="100" cy="30" r="2" fill="#818cf8" />
        <circle cx="100" cy="215" r="2" fill="#818cf8" />

        {/* Scanning Beam */}
        <rect x="20" y="0" width="160" height="2" fill="#fff" opacity="0.5" className="scan-beam" />
    </svg>
);

const HomePage = () => {
    return (
        <div className="modern-home">
            {/* Navbar */}
            <nav className="glass-nav">
                <div className="nav-logo">
                    <span className="logo-symbol">❖</span>
                    <span className="logo-text">FaceAI</span>
                </div>
                <div className="nav-links">
                    <Link to="/trainer/login" className="nav-item">Trainer</Link>
                    <Link to="/attendance/login" className="nav-item">Business</Link>
                    <Link to="/kiosk" className="nav-item">Terminal</Link>
                </div>
            </nav>

            {/* Hero Section - Premium 2D Layout */}
            <header className="hero-section">
                <div className="hero-grid">
                    <div className="hero-text-content">
                        <div className="pill-badge">
                            <span className="dot"></span>
                            v2.0 Enterprise Engine
                        </div>
                        <h1 className="hero-title">
                            Identify. <br />
                            <span className="gradient-text">Verify.</span> <br />
                            Secure.
                        </h1>
                        <p className="hero-subtitle">
                            The complete facial intelligence platform.
                            Deploy bank-grade recognition for attendance, security, and analytics in minutes.
                        </p>
                        <div className="cta-group">
                            <Link to="/attendance/login" className="btn btn-primary btn-glow">
                                Identify Business
                            </Link>
                            <Link to="/trainer/login" className="btn btn-glass">
                                Individual Training
                            </Link>
                        </div>
                    </div>

                    {/* PREMIUM VISUAL - 2D CSS ANIMATED */}
                    <div className="hero-visual-premium">
                        <div className="glow-backdrop"></div>
                        <img src={sleekRobot} alt="FaceAI Core" className="premium-robot-img" />

                        {/* Floating Cards / UI Elements */}
                        <div className="floating-card card-1">
                            <span>🛡️</span> Security Active
                        </div>
                        <div className="floating-card card-2">
                            <span>⚡</span> 99.9% Accuracy
                        </div>
                    </div>
                </div>
            </header>

            {/* Master Class Banner - Redesigned */}
            <section className="learn-section">
                <div className="master-glass-card">
                    <div className="glass-content">
                        <div className="icon-box">🎓</div>
                        <div className="text-box">
                            <h3>Project Master Class</h3>
                            <p>Interactive code walkthrough of the entire architecture.</p>
                        </div>
                        <Link to="/learn/project" className="glass-arrow-btn">
                            Start Learning →
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="features-section">
                <div className="section-header">
                    <h2>Powerhouse Features</h2>
                    <p>Everything you need for facial identity management</p>
                </div>

                <div className="bento-grid">
                    {/* Card 1: Attendance */}
                    <div className="bento-card large">
                        <div className="card-bg-gradient" style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' }}></div>
                        <div className="card-content">
                            <h3>🏢 SaaS Attendance</h3>
                            <p>Complete check-in/out system with organization management.</p>
                            <Link to="/attendance/login" className="text-link">Launch App →</Link>
                        </div>
                    </div>

                    {/* Card 2: Trainer */}
                    <div className="bento-card">
                        <div className="icon-float">🤖</div>
                        <h3>AI Trainer</h3>
                        <p>Teach the model new faces with voice guidance.</p>
                    </div>

                    {/* Card 3: DeepFace */}
                    <div className="bento-card">
                        <div className="icon-float">⚡</div>
                        <h3>DeepFace Core</h3>
                        <p>State-of-the-art accuracy using ArcFace models.</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="simple-footer">
                <p>FaceAI Platform © 2024</p>
            </footer>
        </div>
    );
};

export default HomePage;
