/**
 * TRANSFORMER TUTORIAL - Video-Style Slideshow (DETAILED VERSION)
 * - Full-screen slides with animated transitions
 * - DETAILED content: Basic → Intermediate → Advanced
 * - Proper intro explaining WHY transformers matter
 * - More slides, more depth, like a real lecture
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============ ANIMATED COMPONENTS ============

const AnimatedText = ({ text, delay = 0, className = '' }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);
    return <span className={`animated-text ${visible ? 'visible' : ''} ${className}`}>{text}</span>;
};

const Typewriter = ({ text, speed = 40, delay = 0 }) => {
    const [displayText, setDisplayText] = useState('');
    const [started, setStarted] = useState(false);

    useEffect(() => {
        const startTimer = setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(startTimer);
    }, [delay]);

    useEffect(() => {
        if (!started || displayText.length >= text.length) return;
        const timer = setTimeout(() => {
            setDisplayText(text.slice(0, displayText.length + 1));
        }, speed);
        return () => clearTimeout(timer);
    }, [displayText, text, speed, started]);

    return <span className="typewriter">{displayText}<span className="cursor">|</span></span>;
};

const FloatingParticles = ({ count = 20 }) => {
    const particles = Array.from({ length: count }, (_, i) => ({
        id: i, size: Math.random() * 6 + 2, x: Math.random() * 100, y: Math.random() * 100,
        duration: Math.random() * 10 + 10, delay: Math.random() * 5,
    }));
    return (
        <div className="particles-container">
            {particles.map(p => (
                <div key={p.id} className="particle" style={{
                    width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%`,
                    animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
                }} />
            ))}
        </div>
    );
};

// ============ DETAILED ANIMATIONS ============

// Binary Number Animation
const BinaryAnimation = ({ isActive }) => {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) { setStep(0); return; }
        const timers = [
            setTimeout(() => setStep(1), 800),
            setTimeout(() => setStep(2), 2000),
            setTimeout(() => setStep(3), 3500),
        ];
        return () => timers.forEach(clearTimeout);
    }, [isActive]);

    return (
        <div className="binary-animation">
            <div className="binary-visual">
                {step >= 1 && (
                    <div className="binary-row fade-in">
                        <span className="binary-label">Letter 'A':</span>
                        <span className="binary-value">01000001</span>
                        <span className="binary-decimal">= 65</span>
                    </div>
                )}
                {step >= 2 && (
                    <div className="binary-row fade-in">
                        <span className="binary-label">Letter 'B':</span>
                        <span className="binary-value">01000010</span>
                        <span className="binary-decimal">= 66</span>
                    </div>
                )}
                {step >= 3 && (
                    <div className="binary-row fade-in highlight">
                        <span className="binary-label">"Hello":</span>
                        <span className="binary-value">72 101 108 108 111</span>
                        <span className="binary-note">Each character = a number!</span>
                    </div>
                )}
            </div>
            <div className="animation-labels">
                {step === 0 && <p className="label fade-in">Computers only understand NUMBERS (0s and 1s)</p>}
                {step === 1 && <p className="label fade-in">Every character has a number code (ASCII)</p>}
                {step === 2 && <p className="label fade-in">But these numbers don't capture MEANING...</p>}
                {step >= 3 && <p className="label fade-in">We need something smarter! → Embeddings</p>}
            </div>
        </div>
    );
};

// Tokenization with Details
const DetailedTokenization = ({ isActive }) => {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) { setStep(0); return; }
        const timers = [
            setTimeout(() => setStep(1), 500),
            setTimeout(() => setStep(2), 1500),
            setTimeout(() => setStep(3), 2800),
            setTimeout(() => setStep(4), 4200),
        ];
        return () => timers.forEach(clearTimeout);
    }, [isActive]);

    const sentence = "The cat sat on the mat";
    const tokens = ["The", " cat", " sat", " on", " the", " mat"];

    return (
        <div className="detailed-tokenization">
            {/* Step 0: Show sentence */}
            <div className="token-stage">
                {step === 0 && (
                    <div className="sentence-display fade-in">
                        <span className="big-text">"{sentence}"</span>
                        <p className="helper-text">A simple sentence in natural language</p>
                    </div>
                )}

                {/* Step 1: Highlight that it's just characters */}
                {step === 1 && (
                    <div className="character-view fade-in">
                        <div className="char-boxes">
                            {sentence.split('').map((char, i) => (
                                <div key={i} className="char-box" style={{ animationDelay: `${i * 0.03}s` }}>
                                    {char === ' ' ? '␣' : char}
                                </div>
                            ))}
                        </div>
                        <p className="helper-text">To the computer, this is just 22 characters</p>
                    </div>
                )}

                {/* Step 2: Show tokenization */}
                {step === 2 && (
                    <div className="token-view fade-in">
                        <div className="tokens-row">
                            {tokens.map((token, i) => (
                                <div key={i} className="token-chip" style={{ animationDelay: `${i * 0.15}s` }}>
                                    <span className="token-content">{token}</span>
                                </div>
                            ))}
                        </div>
                        <p className="helper-text">Tokenizer splits into meaningful pieces (tokens)</p>
                    </div>
                )}

                {/* Step 3: Show token IDs */}
                {step === 3 && (
                    <div className="token-ids-view fade-in">
                        <div className="tokens-row">
                            {tokens.map((token, i) => (
                                <div key={i} className="token-with-id" style={{ animationDelay: `${i * 0.15}s` }}>
                                    <span className="token-content">{token}</span>
                                    <span className="token-id-badge">{[464, 3797, 3332, 319, 262, 2603][i]}</span>
                                </div>
                            ))}
                        </div>
                        <p className="helper-text">Each token gets a unique ID from a vocabulary (e.g., GPT-2 has 50,257 tokens)</p>
                    </div>
                )}

                {/* Step 4: Summary */}
                {step >= 4 && (
                    <div className="token-summary fade-in">
                        <div className="summary-flow">
                            <div className="flow-box">Text</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-box">Characters</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-box">Tokens</div>
                            <span className="flow-arrow">→</span>
                            <div className="flow-box highlight">Token IDs</div>
                        </div>
                        <p className="helper-text success">Now we have numbers the model can work with!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Embedding Explanation (Basic to Advanced)
const EmbeddingExplanation = ({ isActive, level = 'basic' }) => {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) { setStep(0); return; }
        const timers = level === 'basic'
            ? [setTimeout(() => setStep(1), 600), setTimeout(() => setStep(2), 1800), setTimeout(() => setStep(3), 3200)]
            : [setTimeout(() => setStep(1), 500), setTimeout(() => setStep(2), 1500), setTimeout(() => setStep(3), 2800), setTimeout(() => setStep(4), 4000)];
        return () => timers.forEach(clearTimeout);
    }, [isActive, level]);

    if (level === 'basic') {
        return (
            <div className="embedding-explanation">
                {step >= 0 && (
                    <div className="concept-card fade-in">
                        <h3>The Problem</h3>
                        <p>Token ID "3797" for "cat" tells us nothing about what a cat IS!</p>
                    </div>
                )}
                {step >= 1 && (
                    <div className="concept-card fade-in">
                        <h3>The Solution</h3>
                        <p>Convert each token ID into a VECTOR of numbers that captures meaning</p>
                    </div>
                )}
                {step >= 2 && (
                    <div className="vector-preview fade-in">
                        <span className="token-label">"cat"</span>
                        <span className="arrow">→</span>
                        <span className="vector-display">[0.23, -0.45, 0.89, 0.12, -0.67, ...]</span>
                    </div>
                )}
                {step >= 3 && (
                    <div className="concept-card highlight fade-in">
                        <h3>Key Insight</h3>
                        <p>Similar words → Similar vectors → Close in vector space!</p>
                    </div>
                )}
            </div>
        );
    }

    // Advanced level
    return (
        <div className="embedding-explanation advanced">
            {step >= 0 && (
                <div className="dimension-visual">
                    <h3>Embedding Dimensions</h3>
                    <div className="dimension-bars">
                        <div className="dim-bar"><span>Gender:</span><div className="bar" style={{ width: '70%' }}></div><span>0.7</span></div>
                        <div className="dim-bar"><span>Royalty:</span><div className="bar" style={{ width: '90%' }}></div><span>0.9</span></div>
                        <div className="dim-bar"><span>Age:</span><div className="bar" style={{ width: '50%' }}></div><span>0.5</span></div>
                        <div className="dim-bar"><span>Animal:</span><div className="bar" style={{ width: '10%' }}></div><span>0.1</span></div>
                    </div>
                    <p className="helper-text">Each dimension might capture a different concept (learned, not programmed!)</p>
                </div>
            )}
            {step >= 1 && (
                <div className="dimension-example fade-in">
                    <div className="word-comparison">
                        <div className="word-vec">
                            <span className="word">king</span>
                            <span className="dims">[0.9, 0.9, 0.6, 0.1]</span>
                        </div>
                        <div className="word-vec">
                            <span className="word">queen</span>
                            <span className="dims">[0.9, 0.1, 0.5, 0.1]</span>
                        </div>
                    </div>
                    <p className="helper-text">king and queen: similar royalty, different gender dimension!</p>
                </div>
            )}
            {step >= 2 && (
                <div className="famous-equation fade-in">
                    <div className="equation">
                        <span className="eq-part">king</span>
                        <span className="eq-op">−</span>
                        <span className="eq-part">man</span>
                        <span className="eq-op">+</span>
                        <span className="eq-part">woman</span>
                        <span className="eq-op">≈</span>
                        <span className="eq-part result">queen</span>
                    </div>
                    <p className="helper-text">Vector arithmetic captures semantic relationships!</p>
                </div>
            )}
            {step >= 3 && (
                <div className="model-sizes fade-in">
                    <h3>Real Model Embedding Sizes</h3>
                    <div className="size-list">
                        <div className="size-item"><span>Word2Vec:</span><span>300 dimensions</span></div>
                        <div className="size-item"><span>BERT:</span><span>768 dimensions</span></div>
                        <div className="size-item"><span>GPT-3:</span><span>12,288 dimensions</span></div>
                        <div className="size-item highlight"><span>GPT-4:</span><span>~16,000+ dimensions</span></div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Interactive 2D Vector Space
const VectorSpace2D = ({ isActive }) => {
    const [step, setStep] = useState(0);

    const words = [
        { word: "king", x: 75, y: 15, color: "#a78bfa" },
        { word: "queen", x: 70, y: 20, color: "#f472b6" },
        { word: "man", x: 80, y: 50, color: "#60a5fa" },
        { word: "woman", x: 75, y: 55, color: "#34d399" },
        { word: "prince", x: 85, y: 25, color: "#fbbf24" },
        { word: "princess", x: 80, y: 30, color: "#fb7185" },
        { word: "cat", x: 20, y: 70, color: "#f97316" },
        { word: "dog", x: 25, y: 65, color: "#84cc16" },
        { word: "puppy", x: 30, y: 60, color: "#22d3ee" },
    ];

    useEffect(() => {
        if (!isActive) { setStep(0); return; }
        const timers = [
            setTimeout(() => setStep(1), 500),
            setTimeout(() => setStep(2), 1500),
            setTimeout(() => setStep(3), 2800),
        ];
        return () => timers.forEach(clearTimeout);
    }, [isActive]);

    return (
        <div className="vector-space-2d-container">
            <div className="vector-space-2d large">
                {/* Grid */}
                <svg className="grid-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <pattern id="grid2" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(124,58,237,0.15)" strokeWidth="0.3" />
                        </pattern>
                    </defs>
                    <rect width="100" height="100" fill="url(#grid2)" />
                </svg>

                {/* Words */}
                {step >= 1 && words.map((w, i) => (
                    <div
                        key={w.word}
                        className="space-point"
                        style={{
                            left: `${w.x}%`, top: `${w.y}%`, backgroundColor: w.color,
                            animationDelay: `${i * 0.1}s`
                        }}
                    >
                        <span className="point-label">{w.word}</span>
                    </div>
                ))}

                {/* Cluster boxes */}
                {step >= 2 && (
                    <>
                        <div className="cluster-box" style={{ left: '62%', top: '8%', width: '32%', height: '55%' }}>
                            <span className="cluster-label">Royalty Cluster</span>
                        </div>
                        <div className="cluster-box" style={{ left: '12%', top: '52%', width: '28%', height: '30%' }}>
                            <span className="cluster-label">Animals Cluster</span>
                        </div>
                    </>
                )}

                {/* Relationship arrows */}
                {step >= 3 && (
                    <svg className="relationship-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#a78bfa" />
                            </marker>
                        </defs>
                        <line x1="75" y1="15" x2="80" y2="50" stroke="#a78bfa" strokeWidth="0.5" strokeDasharray="2,2" markerEnd="url(#arrowhead)" />
                        <line x1="70" y1="20" x2="75" y2="55" stroke="#a78bfa" strokeWidth="0.5" strokeDasharray="2,2" markerEnd="url(#arrowhead)" />
                    </svg>
                )}
            </div>

            <div className="animation-labels">
                {step === 0 && <p className="label fade-in">Each word becomes a point in multi-dimensional space...</p>}
                {step === 1 && <p className="label fade-in">Similar words appear close together!</p>}
                {step === 2 && <p className="label fade-in">Words form semantic clusters</p>}
                {step >= 3 && <p className="label fade-in">king→man ≈ queen→woman (parallel relationships!)</p>}
            </div>
        </div>
    );
};

// 3D Vector Space Interactive
const VectorSpace3D = ({ isActive }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const rotationRef = useRef({ x: 0.3, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });

    const embeddings = {
        'king': { pos: [0.8, 0.9, 0.2], color: '#a78bfa' },
        'queen': { pos: [0.7, 0.85, 0.3], color: '#f472b6' },
        'man': { pos: [0.6, 0.3, -0.1], color: '#60a5fa' },
        'woman': { pos: [0.5, 0.35, 0.0], color: '#34d399' },
        'cat': { pos: [-0.5, 0.2, 0.6], color: '#fbbf24' },
        'dog': { pos: [-0.4, 0.3, 0.5], color: '#fb923c' },
        'happy': { pos: [0.1, -0.5, 0.3], color: '#22d3ee' },
        'sad': { pos: [0.15, -0.6, 0.25], color: '#818cf8' },
    };

    const project = useCallback((point, width, height, rotation) => {
        let { x, y, z } = point;
        const cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y);
        let newX = x * cosY - z * sinY, newZ = x * sinY + z * cosY;
        x = newX; z = newZ;
        const cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x);
        let newY = y * cosX - z * sinX;
        z = y * sinX + z * cosX;
        y = newY;
        const fov = 500, scale = fov / (fov + z + 3);
        return { x: width / 2 + x * scale * 180, y: height / 2 - y * scale * 180, scale, z };
    }, []);

    useEffect(() => {
        if (!isActive) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width, height = canvas.height;

        const draw = () => {
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(0, 0, width, height);

            // Grid
            ctx.strokeStyle = 'rgba(124,58,237,0.12)';
            ctx.lineWidth = 1;
            for (let i = -3; i <= 3; i++) {
                const p1 = project({ x: i, y: 0, z: -3 }, width, height, rotationRef.current);
                const p2 = project({ x: i, y: 0, z: 3 }, width, height, rotationRef.current);
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                const p3 = project({ x: -3, y: 0, z: i }, width, height, rotationRef.current);
                const p4 = project({ x: 3, y: 0, z: i }, width, height, rotationRef.current);
                ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
            }

            // Axes
            const axisColors = ['#ef4444', '#22c55e', '#3b82f6'];
            const axes = [[2, 0, 0], [0, 2, 0], [0, 0, 2]];
            const axisLabels = ['X', 'Y', 'Z'];
            axes.forEach((axis, i) => {
                const origin = project({ x: 0, y: 0, z: 0 }, width, height, rotationRef.current);
                const end = project({ x: axis[0], y: axis[1], z: axis[2] }, width, height, rotationRef.current);
                ctx.strokeStyle = axisColors[i];
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(end.x, end.y); ctx.stroke();
                ctx.fillStyle = axisColors[i];
                ctx.font = '14px Poppins';
                ctx.fillText(axisLabels[i], end.x + 5, end.y);
            });

            // Sort by z for proper depth rendering
            const sortedEmbeddings = Object.entries(embeddings)
                .map(([word, data]) => ({ word, ...data, projected: project({ x: data.pos[0] * 2, y: data.pos[1] * 2, z: data.pos[2] * 2 }, width, height, rotationRef.current) }))
                .sort((a, b) => a.projected.z - b.projected.z);

            // Draw tokens
            sortedEmbeddings.forEach(({ word, color, projected }) => {
                const r = 12 * projected.scale;
                const grad = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, r * 1.5);
                grad.addColorStop(0, color);
                grad.addColorStop(1, color + '00');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(projected.x, projected.y, r * 1.5, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(projected.x, projected.y, r, 0, Math.PI * 2); ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.font = `${Math.max(12, 14 * projected.scale)}px Poppins`;
                ctx.textAlign = 'center';
                ctx.fillText(word, projected.x, projected.y + r + 18);
            });

            if (!isDragging) rotationRef.current.y += 0.003;
            animationRef.current = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animationRef.current);
    }, [isActive, isDragging, project]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        rotationRef.current.y += dx * 0.01;
        rotationRef.current.x += dy * 0.01;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => setIsDragging(false);

    return (
        <div className="vector-3d-container">
            <canvas
                ref={canvasRef}
                width={600}
                height={380}
                className="vector-3d-canvas interactive"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
            <p className="interactive-hint">🎮 Drag to rotate! Watch how words cluster by meaning</p>
        </div>
    );
};

// Attention Mechanism Detailed
const AttentionDetailed = ({ isActive, stage = 1 }) => {
    const [step, setStep] = useState(0);
    const words = ["The", "cat", "sat", "on", "the", "mat"];

    useEffect(() => {
        if (!isActive) { setStep(0); return; }
        const timers = [
            setTimeout(() => setStep(1), 600),
            setTimeout(() => setStep(2), 1800),
            setTimeout(() => setStep(3), 3200),
            setTimeout(() => setStep(4), 4500),
        ];
        return () => timers.forEach(clearTimeout);
    }, [isActive]);

    if (stage === 1) {
        return (
            <div className="attention-detailed">
                <div className="attention-concept">
                    {step >= 0 && (
                        <div className="concept-intro fade-in">
                            <h3>The Key Question</h3>
                            <p className="big-question">"When processing one word, which other words should I pay attention to?"</p>
                        </div>
                    )}
                    {step >= 1 && (
                        <div className="example-sentence fade-in">
                            <p className="sentence-display">
                                The <span className="highlight-word">bank</span> was closed because of the flood.
                            </p>
                            <p className="helper-text">What kind of "bank"? River bank or financial bank?</p>
                        </div>
                    )}
                    {step >= 2 && (
                        <div className="attention-answer fade-in">
                            <p className="sentence-display">
                                The <span className="highlight-word">bank</span> was closed because of the <span className="highlight-word related">flood</span>.
                            </p>
                            <p className="helper-text">"flood" tells us this is a RIVER bank! Attention connects these words.</p>
                        </div>
                    )}
                    {step >= 3 && (
                        <div className="key-insight fade-in">
                            <div className="insight-box">
                                <span className="icon">💡</span>
                                <p>Attention allows each word to "look at" all other words and decide which are relevant!</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Stage 2: Query, Key, Value
    return (
        <div className="attention-detailed qkv">
            {step >= 0 && (
                <div className="qkv-intro fade-in">
                    <h3>How Attention Works: Q, K, V</h3>
                    <p>Each word creates THREE vectors:</p>
                </div>
            )}
            {step >= 1 && (
                <div className="qkv-boxes fade-in">
                    <div className="qkv-box query">
                        <span className="qkv-letter">Q</span>
                        <span className="qkv-name">Query</span>
                        <span className="qkv-desc">"What am I looking for?"</span>
                    </div>
                    <div className="qkv-box key">
                        <span className="qkv-letter">K</span>
                        <span className="qkv-name">Key</span>
                        <span className="qkv-desc">"What do I contain?"</span>
                    </div>
                    <div className="qkv-box value">
                        <span className="qkv-letter">V</span>
                        <span className="qkv-name">Value</span>
                        <span className="qkv-desc">"What info do I provide?"</span>
                    </div>
                </div>
            )}
            {step >= 2 && (
                <div className="qkv-formula fade-in">
                    <div className="formula-box">
                        <span>Attention(Q, K, V) = softmax(</span>
                        <span className="fraction">
                            <span className="num">Q · K<sup>T</sup></span>
                            <span className="denom">√d<sub>k</sub></span>
                        </span>
                        <span>) · V</span>
                    </div>
                </div>
            )}
            {step >= 3 && (
                <div className="qkv-visual fade-in">
                    <div className="attention-matrix">
                        <div className="matrix-row header">
                            <span></span>
                            {words.map(w => <span key={w} className="matrix-col-head">{w}</span>)}
                        </div>
                        {words.slice(0, 3).map((word, i) => (
                            <div key={word} className="matrix-row">
                                <span className="matrix-row-head">{word}</span>
                                {words.map((_, j) => (
                                    <span key={j} className="matrix-cell" style={{
                                        backgroundColor: `rgba(167, 139, 250, ${Math.random() * 0.8 + 0.2})`
                                    }}>
                                        {(Math.random() * 0.5 + 0.1).toFixed(2)}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                    <p className="helper-text">Each cell shows how much word i attends to word j</p>
                </div>
            )}
        </div>
    );
};

// Transformer Architecture Animation
const TransformerArchitecture = ({ isActive }) => {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!isActive) { setStep(0); return; }
        const timers = [
            setTimeout(() => setStep(1), 500),
            setTimeout(() => setStep(2), 1500),
            setTimeout(() => setStep(3), 2500),
            setTimeout(() => setStep(4), 3500),
            setTimeout(() => setStep(5), 4500),
        ];
        return () => timers.forEach(clearTimeout);
    }, [isActive]);

    return (
        <div className="transformer-architecture">
            <div className="architecture-visual">
                {/* Input */}
                <div className={`arch-layer input ${step >= 1 ? 'active' : ''}`}>
                    <span className="layer-label">Input Text</span>
                    <div className="layer-content">"The cat sat"</div>
                </div>

                {/* Tokenization */}
                {step >= 1 && (
                    <div className="arch-arrow fade-in">↓</div>
                )}
                <div className={`arch-layer tokenize ${step >= 1 ? 'active' : ''}`}>
                    <span className="layer-label">Tokenization</span>
                    <div className="layer-content">[464, 3797, 3332]</div>
                </div>

                {/* Embedding */}
                {step >= 2 && (
                    <div className="arch-arrow fade-in">↓</div>
                )}
                <div className={`arch-layer embed ${step >= 2 ? 'active' : ''}`}>
                    <span className="layer-label">Embedding + Position</span>
                    <div className="layer-content">768-dim vectors</div>
                </div>

                {/* Transformer Block */}
                {step >= 3 && (
                    <div className="arch-arrow fade-in">↓</div>
                )}
                <div className={`arch-block transformer ${step >= 3 ? 'active' : ''}`}>
                    <span className="block-label">Transformer Block × N</span>
                    <div className="block-content">
                        <div className="sub-layer">Multi-Head Attention</div>
                        <div className="sub-layer">Feed Forward</div>
                        <div className="sub-layer">Layer Norm</div>
                    </div>
                </div>

                {/* Output */}
                {step >= 4 && (
                    <div className="arch-arrow fade-in">↓</div>
                )}
                <div className={`arch-layer output ${step >= 4 ? 'active' : ''}`}>
                    <span className="layer-label">Output</span>
                    <div className="layer-content">Next token prediction</div>
                </div>

                {/* Stats */}
                {step >= 5 && (
                    <div className="model-stats fade-in">
                        <div className="stat"><span>GPT-3:</span><span>96 blocks, 175B params</span></div>
                        <div className="stat"><span>GPT-4:</span><span>120 blocks, ~1.8T params</span></div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============ SLIDE DEFINITIONS ============
const SLIDES = [
    // ===== INTRO SECTION =====
    {
        id: 'intro-1',
        section: 'intro',
        render: (isActive) => (
            <div className="slide-content intro-slide">
                <FloatingParticles count={30} />
                <div className="intro-content">
                    <h1 className="mega-title gradient-text">
                        <AnimatedText text="TRANSFORMERS" delay={300} />
                    </h1>
                    <p className="subtitle">
                        <Typewriter text="The revolutionary architecture behind ChatGPT, Claude, Gemini, and all modern AI" delay={1000} speed={25} />
                    </p>
                    <div className="intro-stats">
                        <div className="stat-box"><span className="stat-num">2017</span><span>Year invented</span></div>
                        <div className="stat-box"><span className="stat-num">1.8T</span><span>GPT-4 parameters</span></div>
                        <div className="stat-box"><span className="stat-num">$100B+</span><span>Industry created</span></div>
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: 'intro-2',
        section: 'intro',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title center">
                    <AnimatedText text="But first... How do computers understand text?" delay={300} />
                </h2>
                <BinaryAnimation isActive={isActive} />
            </div>
        ),
    },

    // ===== TOKENIZATION SECTION =====
    {
        id: 'token-1',
        section: 'tokenization',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title">
                    <span className="step-number">01</span>
                    <AnimatedText text="TOKENIZATION" delay={200} />
                </h2>
                <div className="concept-subtitle">Breaking text into pieces the model can understand</div>
                <DetailedTokenization isActive={isActive} />
            </div>
        ),
    },

    // ===== EMBEDDING SECTION =====
    {
        id: 'embed-1',
        section: 'embedding',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title">
                    <span className="step-number">02</span>
                    <AnimatedText text="WORD EMBEDDINGS" delay={200} />
                </h2>
                <div className="concept-subtitle">From numbers to meaning</div>
                <EmbeddingExplanation isActive={isActive} level="basic" />
            </div>
        ),
    },
    {
        id: 'embed-2',
        section: 'embedding',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title">
                    <span className="step-number">02+</span>
                    <AnimatedText text="EMBEDDING DIMENSIONS" delay={200} />
                </h2>
                <div className="concept-subtitle">What do those numbers mean?</div>
                <EmbeddingExplanation isActive={isActive} level="advanced" />
            </div>
        ),
    },
    {
        id: 'embed-3',
        section: 'embedding',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title">
                    <span className="step-number">02+</span>
                    <AnimatedText text="VISUALIZE: 2D Vector Space" delay={200} />
                </h2>
                <VectorSpace2D isActive={isActive} />
            </div>
        ),
    },
    {
        id: 'embed-4',
        section: 'embedding',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title">
                    <span className="step-number">02+</span>
                    <AnimatedText text="EXPLORE: 3D Vector Space" delay={200} />
                </h2>
                <VectorSpace3D isActive={isActive} />
            </div>
        ),
    },

    // ===== ATTENTION SECTION =====
    {
        id: 'attention-1',
        section: 'attention',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title">
                    <span className="step-number">03</span>
                    <AnimatedText text="ATTENTION MECHANISM" delay={200} />
                </h2>
                <div className="concept-subtitle">The breakthrough innovation</div>
                <AttentionDetailed isActive={isActive} stage={1} />
            </div>
        ),
    },
    {
        id: 'attention-2',
        section: 'attention',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title">
                    <span className="step-number">03+</span>
                    <AnimatedText text="QUERY, KEY, VALUE" delay={200} />
                </h2>
                <div className="concept-subtitle">The mathematics behind attention</div>
                <AttentionDetailed isActive={isActive} stage={2} />
            </div>
        ),
    },

    // ===== ARCHITECTURE SECTION =====
    {
        id: 'arch-1',
        section: 'architecture',
        render: (isActive) => (
            <div className="slide-content">
                <h2 className="section-title">
                    <span className="step-number">04</span>
                    <AnimatedText text="THE FULL ARCHITECTURE" delay={200} />
                </h2>
                <div className="concept-subtitle">Putting it all together</div>
                <TransformerArchitecture isActive={isActive} />
            </div>
        ),
    },

    // ===== SUMMARY =====
    {
        id: 'summary',
        section: 'summary',
        render: (isActive) => (
            <div className="slide-content intro-slide">
                <FloatingParticles count={25} />
                <div className="summary-content">
                    <h2 className="mega-title small gradient-text">
                        <AnimatedText text="THAT'S A TRANSFORMER! 🎉" delay={300} />
                    </h2>
                    <div className="summary-pipeline">
                        <div className="pipe-step"><span className="num">1</span><span className="name">Text → Tokens</span></div>
                        <div className="pipe-arrow">→</div>
                        <div className="pipe-step"><span className="num">2</span><span className="name">Tokens → Vectors</span></div>
                        <div className="pipe-arrow">→</div>
                        <div className="pipe-step"><span className="num">3</span><span className="name">Attention</span></div>
                        <div className="pipe-arrow">→</div>
                        <div className="pipe-step"><span className="num">4</span><span className="name">Output</span></div>
                    </div>
                    <div className="final-note">
                        <p>Stack these layers 100+ times and train on trillions of tokens...</p>
                        <p className="highlight">= ChatGPT, Claude, Gemini, and more!</p>
                    </div>
                </div>
            </div>
        ),
    },
];

// ============ MAIN COMPONENT ============
const TransformerTutorialPage = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState('right');
    const [isTransitioning, setIsTransitioning] = useState(false);

    const goToSlide = (index) => {
        if (isTransitioning || index === currentSlide || index < 0 || index >= SLIDES.length) return;
        setIsTransitioning(true);
        setDirection(index > currentSlide ? 'right' : 'left');
        setTimeout(() => {
            setCurrentSlide(index);
            setTimeout(() => setIsTransitioning(false), 500);
        }, 300);
    };

    const nextSlide = () => goToSlide(currentSlide + 1);
    const prevSlide = () => goToSlide(currentSlide - 1);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    });

    const currentSection = SLIDES[currentSlide]?.section;
    const sections = ['intro', 'tokenization', 'embedding', 'attention', 'architecture', 'summary'];

    return (
        <div className="video-tutorial">
            {/* Fixed Header */}
            <header className="tutorial-header">
                <span className="tutorial-logo">🤖 Transformer Tutorial</span>
                <div className="section-indicator">
                    {sections.map((sec, i) => (
                        <div
                            key={sec}
                            className={`section-dot ${currentSection === sec ? 'active' : ''} ${sections.indexOf(currentSection) > i ? 'done' : ''}`}
                        >
                            <span className="section-label">{sec}</span>
                        </div>
                    ))}
                </div>
                <span className="current-section">{currentSection?.toUpperCase()}</span>
            </header>

            {/* Slides */}
            <div className="slides-container">
                {SLIDES.map((slide, index) => (
                    <div
                        key={slide.id}
                        className={`slide ${index === currentSlide ? 'visible slide-active' : ''} ${index < currentSlide ? 'slide-exit-right' : index > currentSlide ? 'slide-enter-right' : ''
                            }`}
                    >
                        {slide.render(index === currentSlide)}
                    </div>
                ))}
            </div>

            {/* Navigation */}
            <nav className="video-nav">
                <button className="nav-btn prev" onClick={prevSlide} disabled={currentSlide === 0 || isTransitioning}>
                    ← PREV
                </button>
                <div className="progress-info">
                    <span className="slide-counter">{currentSlide + 1} / {SLIDES.length}</span>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%` }}></div>
                    </div>
                </div>
                <button className="nav-btn next" onClick={nextSlide} disabled={currentSlide === SLIDES.length - 1 || isTransitioning}>
                    NEXT →
                </button>
            </nav>
        </div>
    );
};

export default TransformerTutorialPage;
