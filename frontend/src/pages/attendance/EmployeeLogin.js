/**
 * MOBILE-FIRST Driver Login - Premium Clean Theme
 * Flow: City → Area → Ward → Route → Employee ID (Auto Login)
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = '/api/v1/attendance';

const EmployeeLogin = () => {
    const navigate = useNavigate();

    // Step management (1-4)
    // 1: Enter ID (Auto Detects Org)
    // 1.5: Select Profile (If duplicates found)
    // 2: Select Area
    // 3: Select Ward
    // 4: Select Route -> Auto Login
    const [step, setStep] = useState(1);

    // Selections
    const [idMatches, setIdMatches] = useState([]); // For duplicate ID handling
    const [areas, setAreas] = useState([]);
    const [wards, setWards] = useState([]);
    const [routes, setRoutes] = useState([]);

    const [selectedOrg, setSelectedOrg] = useState(null); // Auto-set from ID
    const [selectedArea, setSelectedArea] = useState(null);
    const [selectedWard, setSelectedWard] = useState(null);
    const [selectedRoute, setSelectedRoute] = useState(null);

    // User Context
    const [employeeId, setEmployeeId] = useState('');
    const [employeeName, setEmployeeName] = useState(''); // Persisted for welcome

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [loadingData, setLoadingData] = useState(false);

    // Removed initial fetchOrganizations() since we detect from ID now

    // Check for existing session (Duty ON persistence)
    useEffect(() => {
        const storedEmployee = sessionStorage.getItem('employee');
        if (storedEmployee) {
            navigate('/employee/dashboard');
        }
    }, [navigate]);

    const handleIdSubmit = async (e) => {
        e.preventDefault();
        if (!employeeId.trim()) return;

        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/check-employee-id/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ employee_id: employeeId.toUpperCase() })
            });
            const data = await res.json();

            if (res.ok && data.exists) {
                if (data.count === 1) {
                    const match = data.matches[0];
                    if (match.is_active_duty) {
                        // AUTO-LOGIN (Active Duty)
                        autoLogin(match);
                    } else {
                        // Regular Flow
                        selectProfile(match);
                    }
                } else {
                    // Multiple Matches - Let user pick
                    setIdMatches(data.matches);
                    setStep(1.5);
                }
            } else {
                setError('ID nahi mili / Invalid ID');
            }
        } catch (err) {
            setError('Internet problem. Phir se try karein.');
        }
        setIsLoading(false);
    };

    const autoLogin = (match) => {
        // Construct session object directly from backend "full_details"
        const sessionData = {
            ...match.full_details,
            route: match.route,
            route_id: match.route?.id
        };
        sessionStorage.setItem('employee', JSON.stringify(sessionData));
        navigate('/employee/dashboard');
    };

    const selectProfile = (match) => {
        if (match.is_active_duty) {
            autoLogin(match);
            return;
        }

        // Set Context
        setSelectedOrg({ org_code: match.org_code, name: match.org_name });
        setEmployeeName(match.employee_name);
        setEmployeeId(match.employee_id); // Ensure ID is consistent

        // Proceed to fetch Areas for this Org
        fetchAreas(match.org_code);
        setStep(2); // Go to Area Selection
    };

    const fetchAreas = async (orgCode) => {
        setLoadingData(true);
        try {
            const res = await fetch(`${API_BASE}/areas/?org_code=${orgCode}`);
            const data = await res.json();
            if (data.success) {
                setAreas(data.areas);
            } else {
                setError(data.error || 'Area load nahi hua');
            }
        } catch (e) {
            setError('Connection failed');
        }
        setLoadingData(false);
    };

    const fetchWards = async (areaId) => {
        setLoadingData(true);
        try {
            const res = await fetch(`${API_BASE}/wards/?area_id=${areaId}`);
            const data = await res.json();
            if (data.success) {
                setWards(data.wards);
            } else {
                setError(data.error || 'Ward load nahi hua');
            }
        } catch (e) {
            setError('Connection failed');
        }
        setLoadingData(false);
    };

    const fetchRoutes = async (wardId) => {
        setLoadingData(true);
        try {
            const res = await fetch(`${API_BASE}/routes/?ward_id=${wardId}`);
            const data = await res.json();
            if (data.success) {
                setRoutes(data.routes);
            } else {
                setError(data.error || 'Route load nahi hua');
            }
        } catch (e) {
            setError('Connection failed');
        }
        setLoadingData(false);
    };

    const selectArea = (area) => {
        setSelectedArea(area);
        setError('');
        fetchWards(area.id);
        setStep(3);
    };

    const selectWard = (ward) => {
        setSelectedWard(ward);
        setError('');
        fetchRoutes(ward.id);
        setStep(4);
    };

    const selectRoute = (route) => {
        setSelectedRoute(route);
        setError('');
        // DIRECT LOGIN after selection
        handleFinalLogin(route);
    };

    const handleFinalLogin = async (route) => {
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/employee-login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_code: selectedOrg.org_code,
                    employee_id: employeeId,
                    route_id: route.id
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                sessionStorage.setItem('employee', JSON.stringify({
                    ...data.employee,
                    org_code: data.organization.org_code,
                    org_name: data.organization.name,
                    route: route,
                    route_id: route.id
                }));
                navigate('/employee/dashboard');
            } else {
                setError(data.error || 'Login failed');
                setIsLoading(false);
            }
        } catch (e) {
            setError('Connection failed');
            setIsLoading(false);
        }
    };

    const goBack = () => {
        setError('');
        if (step === 1.5) {
            setStep(1);
            setIdMatches([]);
        } else if (step === 2) {
            setStep(1); // Back to ID Entry (clear context)
            setEmployeeId('');
            setSelectedOrg(null);
            setAreas([]);
        } else if (step === 3) {
            setSelectedArea(null);
            setWards([]);
            setStep(2);
        } else if (step === 4) {
            setSelectedWard(null);
            setRoutes([]);
            setStep(3);
        }
    };

    const stepInfo = {
        1: { title: 'DRIVER APNI ID DAALEIN', subtitle: 'ड्राइवर अपनी आईडी डालें' },
        1.5: { title: 'PROFILE CHUNEIN', subtitle: 'Ek se zyada account mile' },
        2: { title: 'AREA CHUNEIN', subtitle: `Swaagat hai, ${employeeName.split(' ')[0]}` },
        3: { title: 'WARD CHUNEIN', subtitle: `${selectedArea?.name || 'Area'} Ward` },
        4: { title: 'ROUTE CHUNEIN', subtitle: `Ward ${selectedWard?.number || ''} Route` },
    };

    const currentStep = stepInfo[step];

    // "Rugged / High Visibility" Styles for Workers
    // Optimized for "Rusty Thumbs" & Outdoor Use
    const styles = {
        container: {
            minHeight: '100vh',
            background: '#f1f5f9', // Light grey simple background
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            fontFamily: 'sans-serif' // Standard robust font
        },
        // Mobile-First Card: Full width on mobile, max-width on desktop
        card: {
            width: '100%',
            maxWidth: '600px', // Wider max-width for "Kiosk" feel
            background: 'white',
            minHeight: '100vh', // Full height on mobile
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'none', // Removed delicate shadows
            borderRight: '1px solid #e2e8f0',
            borderLeft: '1px solid #e2e8f0'
        },
        header: {
            padding: '24px',
            background: '#1e293b', // Dark header for contrast
            color: 'white',
            borderBottom: '4px solid #10b981' // Green accent line
        },
        progressContainer: {
            height: '8px', // Thicker progress bar
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '4px',
            marginBottom: '16px',
            overflow: 'hidden'
        },
        progressBar: {
            height: '100%',
            background: '#10b981', // Bright green
            width: `${(step / 4) * 100}%`,
            transition: 'width 0.3s ease'
        },
        title: {
            fontSize: '1.8rem',
            fontWeight: '800',
            margin: 0,
            marginBottom: '4px',
            letterSpacing: '0.5px'
        },
        subtitle: {
            fontSize: '1.2rem', // Slightly larger for Hindi
            opacity: 0.9,
            margin: 0,
            fontWeight: '600',
            color: '#cbd5e1'
        },
        content: {
            flex: 1,
            padding: '0',
            overflowY: 'auto',
            background: 'white'
        },
        listContainer: {
            padding: '16px' // Consistent padding
        },
        // FAT BUTTONS for Rusty Thumbs
        listItem: {
            width: '100%',
            padding: '24px 20px', // HUGE padding
            background: 'white',
            border: '2px solid #cbd5e1', // Thicker border
            borderRadius: '12px',
            marginBottom: '16px', // More space between items
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'background 0.1s',
            // Disable shadow for flat "tactile" feel
            boxShadow: '0 4px 0 #cbd5e1', // "Pressed" button style shadow
            position: 'relative',
            top: 0
        },
        listItemActive: {
            borderColor: '#10b981',
            background: '#f0fdf4',
            boxShadow: '0 4px 0 #10b981'
        },
        itemName: {
            fontSize: '1.3rem', // Large text
            fontWeight: '700',
            color: '#0f172a'
        },
        itemMeta: {
            fontSize: '1rem',
            color: '#64748b',
            marginTop: '4px',
            fontWeight: '500'
        },
        icon: {
            color: '#94a3b8',
            fontSize: '1.8rem', // Large arrow
            fontWeight: 'bold'
        },
        formContainer: {
            padding: '40px 24px'
        },
        inputGroup: {
            marginBottom: '32px'
        },
        label: {
            display: 'block',
            fontSize: '1.3rem',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '16px'
        },
        // MASSIVE INPUT
        input: {
            width: '100%',
            padding: '20px',
            fontSize: '2rem', // Huge font for typing
            border: '3px solid #cbd5e1', // Thick border
            borderRadius: '16px',
            textAlign: 'center',
            fontWeight: '700',
            color: '#0f172a',
            background: '#f8fafc',
            outline: 'none',
            letterSpacing: '4px' // Spaced out characters
        },
        inputFocus: {
            borderColor: '#10b981',
            background: 'white'
        },
        // MASSIVE PRIMARY BUTTON
        primaryButton: {
            width: '100%',
            padding: '24px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            fontSize: '1.5rem',
            fontWeight: '800', // Extra bold
            cursor: 'pointer',
            boxShadow: '0 6px 0 #047857', // 3D clicky feel
            textTransform: 'uppercase',
            letterSpacing: '1px'
        },
        // BIG BACK BUTTON
        backButton: {
            width: '100%',
            padding: '16px',
            background: '#e2e8f0',
            color: '#475569',
            border: 'none',
            borderRadius: '0', // Full width strip
            fontSize: '1.1rem',
            fontWeight: '700',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: '0',
            display: 'block'
        },
        errorBox: {
            margin: '16px',
            padding: '20px',
            background: '#fee2e2',
            color: '#991b1b',
            border: '2px solid #fca5a5',
            borderRadius: '12px',
            fontSize: '1.1rem',
            textAlign: 'center',
            fontWeight: '700'
        }
    };

    const renderSelectionList = (items, onSelect, nameKey = 'name') => {
        if (loadingData) {
            return (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 20px', width: '50px', height: '50px', borderWidth: '5px', borderColor: '#cbd5e1', borderTopColor: '#10b981' }}></div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>Load ho raha hai...</div>
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Koi item nahi mila</div>
                </div>
            );
        }

        return (
            <div style={styles.listContainer}>
                {items.map((item) => (
                    <button
                        key={item.id || item.org_code || item.code}
                        onClick={() => onSelect(item)}
                        style={styles.listItem}
                        // Click effect simulation
                        onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'translateY(4px)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = '#10b981';
                        }}
                        onMouseUp={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 0 #cbd5e1';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                        // No hover needed for touch, but good for feedback
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#94a3b8';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                    >
                        <div>
                            <div style={styles.itemName}>{item[nameKey]}</div>
                            <div style={styles.itemMeta}>
                                {item.name_hindi && `${item.name_hindi} `}
                                {item.org_code || item.code || (item.number ? `Ward ${item.number}` : '')}
                            </div>
                        </div>
                        <span className="arrow-icon" style={styles.icon}>➜</span>
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>

                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.progressContainer}>
                        <div style={styles.progressBar}></div>
                    </div>
                    <h1 style={styles.title}>{currentStep.title}</h1>
                    <p style={styles.subtitle}>{currentStep.subtitle}</p>
                </div>

                {/* Big full-width Back Button at TOP for easy reach or context switching */}
                {step > 1 && (
                    <button onClick={goBack} style={styles.backButton}>
                        ⬅ WAPIS / BACK
                    </button>
                )}

                {/* Error Banner */}
                {error && <div style={styles.errorBox}>{error}</div>}

                {/* Content Area */}
                <div style={styles.content}>

                    {/* STEP 1: ID Input (NOW FIRST) */}
                    {step === 1 && (
                        <form onSubmit={handleIdSubmit} style={styles.formContainer}>
                            <div style={styles.inputGroup}>
                                <label style={styles.label}>DRIVER ID</label>
                                <input
                                    type="text"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                                    placeholder="ID here..."
                                    required
                                    autoFocus
                                    style={styles.input}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#10b981';
                                        e.target.style.background = 'white';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#cbd5e1';
                                        e.target.style.background = '#f8fafc';
                                    }}
                                />
                            </div>

                            <button
                                type="submit"
                                style={{
                                    ...styles.primaryButton,
                                    opacity: isLoading ? 0.8 : 1,
                                    background: isLoading ? '#64748b' : styles.primaryButton.background,
                                    boxShadow: isLoading ? 'none' : styles.primaryButton.boxShadow
                                }}
                                disabled={isLoading}
                                onMouseDown={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(6px)', e.currentTarget.style.boxShadow = 'none')}
                                onMouseUp={(e) => !isLoading && (e.currentTarget.style.transform = 'none', e.currentTarget.style.boxShadow = '0 6px 0 #047857')}
                            >
                                {isLoading ? 'KHOJ RAHE HAIN ➜' : 'AAGE BADHEIN ➜'}
                            </button>
                        </form>
                    )}

                    {/* STEP 1.5: Select Profile (Collisions) */}
                    {step === 1.5 && (
                        <div style={styles.listContainer}>
                            {idMatches.map((match) => (
                                <button
                                    key={match.org_code}
                                    onClick={() => selectProfile(match)}
                                    style={styles.listItem}
                                >
                                    <div>
                                        <div style={styles.itemName}>{match.employee_name}</div>
                                        <div style={styles.itemMeta}>{match.org_name} ({match.org_code})</div>
                                        <div style={{ ...styles.itemMeta, fontSize: '0.9rem', color: '#10b981' }}>
                                            {match.designation || 'Employee'}
                                        </div>
                                    </div>
                                    <span style={styles.icon}>➜</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* STEP 2: Area */}
                    {step === 2 && renderSelectionList(areas, selectArea, 'name')}

                    {/* STEP 3: Ward */}
                    {step === 3 && renderSelectionList(wards, selectWard, 'name')}

                    {/* STEP 4: Route */}
                    {step === 4 && renderSelectionList(routes, selectRoute, 'name')}

                </div>
            </div>
        </div>
    );
};

export default EmployeeLogin;
