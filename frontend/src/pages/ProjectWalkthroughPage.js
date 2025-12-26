/**
 * PROJECT MASTER CLASS - Interactive Documentation
 * 
 * A split-screen learning experience:
 * - Left: Visual Explanation / Concepts
 * - Right: Real Code Walkthrough
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ============ VISUAL COMPONENTS ============

const CodeBlock = ({ code, language = 'javascript', highlightLines = [] }) => {
    return (
        <div style={{
            background: '#1e1e1e',
            borderRadius: '12px',
            padding: '20px',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: '#d4d4d4',
            overflowX: 'auto',
            height: '100%',
            whiteSpace: 'pre',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            border: '1px solid #333'
        }}>
            {code.trim().split('\n').map((line, i) => {
                const lineNum = i + 1;
                const isHighlighted = highlightLines.includes(lineNum);
                return (
                    <div key={i} style={{
                        display: 'flex',
                        background: isHighlighted ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                        borderLeft: isHighlighted ? '3px solid #60a5fa' : '3px solid transparent'
                    }}>
                        <span style={{
                            color: '#555',
                            textAlign: 'right',
                            width: '30px',
                            marginRight: '16px',
                            userSelect: 'none'
                        }}>{lineNum}</span>
                        <span style={{
                            color: isHighlighted ? '#fff' : 'inherit'
                        }}>{line}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ============ SLIDE DATA ============

const SLIDES = [
    {
        id: 'intro',
        title: "Welcome to the Master Class",
        subtitle: "How this Face Attendance System works under the hood.",
        content: (
            <div>
                <p>We built a <strong>Full-Stack SaaS Application</strong>.</p>
                <ul style={{ lineHeight: '1.8', marginTop: '20px' }}>
                    <li>🎨 <strong>Frontend:</strong> React.js (User Interface)</li>
                    <li>⚙️ <strong>Backend:</strong> Django REST Framework (Business Logic)</li>
                    <li>🧠 <strong>AI:</strong> DeepFace + face-api.js (Recognition)</li>
                    <li>🗄️ <strong>Database:</strong> SQLite/MySQL (Data Storage)</li>
                </ul>
            </div>
        ),
        code: `
# The High-Level Stack

Frontend (React)
   ⬇️ HTTP Requests (JSON)
Backend (Django)
   ⬇️ ORM Queries
Database (SQL)
   ⬇️ Vectors
AI Model (DeepFace)
        `,
        highlightLines: [4, 6, 8, 10]
    },
    {
        id: 'models-1',
        title: "Database Models (The Foundation)",
        subtitle: "Everything starts with how we store data.",
        content: (
            <div>
                <p>We use 3 main models to structure our application:</p>
                <ol style={{ marginTop: '16px', gap: '10px', display: 'flex', flexDirection: 'column' }}>
                    <li><strong>Organization:</strong> The tenant (Company). Includes settings like `recognition_mode`.</li>
                    <li><strong>SaaSEmployee:</strong> The user. Stores generic info AND face embeddings.</li>
                    <li><strong>AttendanceRecord:</strong> The log. Links employee + time + status.</li>
                </ol>
            </div>
        ),
        code: `
class Organization(models.Model):
    name = models.CharField(max_length=100)
    org_code = models.CharField(unique=True)
    recognition_mode = models.CharField(
        choices=[('light', 'Light'), ('heavy', 'Heavy')]
    )

class SaaSEmployee(models.Model):
    organization = models.ForeignKey(Organization)
    employee_id = models.CharField(max_length=50)
    face_embeddings = models.JSONField(default=list) 
    # ^ This is where the AI Magic lives!
        `,
        highlightLines: [4, 5, 11, 12]
    },
    {
        id: 'api-1',
        title: "The API Layer (Views)",
        subtitle: "How the Frontend talks to the Backend.",
        content: (
            <div>
                <p>We use <strong>Class-Based Views (CBVs)</strong> in Django REST Framework.</p>
                <p style={{ marginTop: '12px' }}>This `VerifyEmployeeView` handles the initial check when someone tries to self-enroll.</p>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
                    <strong>Logic Flow:</strong>
                    <br />1. Receive `org_code` & `employee_id`
                    <br />2. Find Organization (404 if missing)
                    <br />3. Find Employee (404 if missing)
                    <br />4. Return generic employee info (no sensitive data)
                </div>
            </div>
        ),
        code: `
class VerifyEmployeeView(APIView):
    permission_classes = [AllowAny] # Public access
    
    def post(self, request):
        code = request.data.get('org_code')
        emp_id = request.data.get('employee_id')
        
        # 1. ORM Lookup
        org = Organization.objects.get(org_code=code)
        employee = Employee.objects.get(
            organization=org, 
            employee_id=emp_id
        )
        
        # 2. Return JSON
        return Response({
            'success': True,
            'name': employee.full_name,
            'face_enrolled': employee.face_enrolled
        })
        `,
        highlightLines: [2, 5, 6, 9, 10, 19]
    },
    {
        id: 'ai-training',
        title: "AI Training Logic",
        subtitle: "How we turn images into numbers.",
        content: (
            <div>
                <p>This is the most critical part of the system.</p>
                <p style={{ marginTop: '12px' }}>When an admin clicks "Train Model", we don't train a neural network from scratch. We <strong>extract embeddings</strong>.</p>
                <p style={{ marginTop: '12px' }}>**Heavy Mode** uses DeepFace (backend python). It opens every image, finds the face, and calculates a 512-dimensional vector.</p>
            </div>
        ),
        code: `
# backend/apps/attendance/views.py

if mode == 'heavy':
    # Loop through all captured images
    for img_path in image_paths:
        
        # DeepFace magic
        embedding = DeepFace.represent(
            img_path, 
            model_name="ArcFace"
        )[0]["embedding"]
        
        # Store in list
        all_embeddings.append(embedding)

    # Save to Database
    employee.face_embeddings = all_embeddings
    employee.save()
        `,
        highlightLines: [4, 8, 9, 10, 16, 17]
    },
    {
        id: 'recognition',
        title: "Face Recognition (Check-In)",
        subtitle: "Finding the needle in the haystack.",
        content: (
            <div>
                <p>When a user scans their face at the Kiosk:</p>
                <ol style={{ marginTop: '16px' }}>
                    <li>Frontend sends the webcam image to Backend.</li>
                    <li>Backend extracts the vector (embedding) of the incoming face.</li>
                    <li>Backend compares this vector against <strong>ALL</strong> employees in that organization.</li>
                    <li>If distance &lt; Threshold (0.6), it's a match!</li>
                </ol>
            </div>
        ),
        code: `
# The Math behind Recognition
# Euclidean Distance

def find_best_match(target_vector, all_employees):
    best_score = float('inf')
    best_match = None
    
    for employee in all_employees:
        for stored_vector in employee.face_embeddings:
            
            # Calculate distance
            dist = numpy.linalg.norm(
                target_vector - stored_vector
            )
            
            if dist < best_score:
                best_score = dist
                best_match = employee
                
    return best_match if best_score < 0.6 else None
        `,
        highlightLines: [11, 12, 13, 16]
    }
];

// ============ MAIN PAGE COMPONENT ============

const ProjectWalkthroughPage = () => {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = () => {
        if (currentSlide < SLIDES.length - 1) setCurrentSlide(prev => prev + 1);
    };

    const prevSlide = () => {
        if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Space') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentSlide]);

    const slide = SLIDES[currentSlide];

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            background: '#0f172a',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                height: '60px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 30px',
                background: '#1e293b'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.5rem' }}>🎓</span>
                    <span style={{ fontWeight: '600', letterSpacing: '0.5px' }}>MASTER CLASS</span>
                </div>
                <div>
                    <span style={{ color: '#94a3b8', marginRight: '20px', fontSize: '0.9rem' }}>
                        Slide {currentSlide + 1} / {SLIDES.length}
                    </span>
                    <button
                        onClick={() => navigate('/')}
                        className="btn btn-outline"
                        style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                    >
                        Exit
                    </button>
                </div>
            </div>

            {/* Split Content */}
            <div style={{ flex: 1, display: 'flex', position: 'relative' }}>

                {/* LEFT: EXPLANATION */}
                <div style={{
                    flex: '0 0 45%',
                    padding: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    background: 'linear-gradient(to bottom right, #0f172a, #1e293b)'
                }}>
                    <h1 style={{
                        fontSize: '2.5rem',
                        fontWeight: '800',
                        marginBottom: '16px',
                        background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        {slide.title}
                    </h1>
                    <h3 style={{
                        fontSize: '1.2rem',
                        color: '#94a3b8',
                        marginBottom: '40px',
                        fontWeight: '400'
                    }}>
                        {slide.subtitle}
                    </h3>

                    <div style={{ fontSize: '1.1rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                        {slide.content}
                    </div>

                    {/* Navigation Controls */}
                    <div style={{ marginTop: 'auto', paddingTop: '40px', display: 'flex', gap: '16px' }}>
                        <button
                            onClick={prevSlide}
                            disabled={currentSlide === 0}
                            className="btn"
                            style={{
                                background: currentSlide === 0 ? '#334155' : '#475569',
                                color: currentSlide === 0 ? '#64748b' : 'white',
                                width: '50px', height: '50px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem'
                            }}
                        >
                            ←
                        </button>
                        <button
                            onClick={nextSlide}
                            disabled={currentSlide === SLIDES.length - 1}
                            className="btn btn-primary"
                            style={{
                                width: '50px', height: '50px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.2rem',
                                boxShadow: '0 0 20px rgba(96, 165, 250, 0.4)'
                            }}
                        >
                            →
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', marginLeft: '16px', color: '#64748b', fontSize: '0.9rem' }}>
                            Use Arrow Keys
                        </span>
                    </div>
                </div>

                {/* RIGHT: CODE */}
                <div style={{
                    flex: '1',
                    padding: '40px',
                    background: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{ width: '100%', height: '80%', maxWidth: '800px' }}>
                        <div style={{
                            marginBottom: '12px',
                            display: 'flex',
                            gap: '8px',
                            paddingLeft: '12px'
                        }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></div>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fbbf24' }}></div>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></div>
                        </div>
                        <CodeBlock
                            code={slide.code}
                            highlightLines={slide.highlightLines}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectWalkthroughPage;
