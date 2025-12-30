/**
 * Admin Attendance Page - Scalable Table View
 * Designed for 1000+ employees with:
 * - Pagination (20 per page)
 * - Large check-in/check-out images side by side
 * - Detection verification capability (mark correct/incorrect)
 * - Clear time distinctions with colors
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = 'http://localhost:8000/api/v1/attendance';
const DETECTION_API = 'http://localhost:8000/api/v1/detection';
const ITEMS_PER_PAGE = 20;

const AdminAttendancePage = () => {
    const navigate = useNavigate();
    const { attendanceOrg, isLoading: authLoading } = useAuth();
    const [todaySummary, setTodaySummary] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [logs, setLogs] = useState([]);
    const [records, setRecords] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('all');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    // Expanded row for verification
    const [expandedEmployee, setExpandedEmployee] = useState(null);

    // Verification status
    const [verificationStatus, setVerificationStatus] = useState({});

    useEffect(() => {
        if (authLoading) return;
        if (!attendanceOrg) {
            navigate('/attendance/login');
            return;
        }
        loadAllData();
    }, [attendanceOrg, authLoading]);

    const loadAllData = async () => {
        if (!attendanceOrg?.id) return;
        setLoading(true);

        try {
            const [summaryRes, empRes, recordsRes, logsRes] = await Promise.all([
                fetch(`${API_BASE}/records/today_summary/?organization_id=${attendanceOrg.id}`),
                fetch(`${API_BASE}/employees/?organization_id=${attendanceOrg.id}`),
                fetch(`${API_BASE}/records/?organization_id=${attendanceOrg.id}`),
                fetch(`${DETECTION_API}/logs/?org_code=${attendanceOrg.org_code}&limit=500`)
            ]);

            const summaryData = await summaryRes.json();
            const empData = await empRes.json();
            const recordsData = await recordsRes.json();
            const logsData = await logsRes.json();

            setTodaySummary(summaryData);
            setEmployees(empData.employees || []);
            setLogs(logsData.logs || []);

            const today = new Date().toISOString().split('T')[0];
            const allRecords = recordsData.records || recordsData.results || recordsData || [];
            const todayRecords = allRecords.filter(r =>
                r.date === today || (r.check_in && r.check_in.startsWith(today))
            );
            setRecords(todayRecords);

            const depts = [...new Set((empData.employees || []).map(e => e.department).filter(Boolean))];
            setDepartments(depts);
        } catch (e) {
            console.error('Failed to load data:', e);
        } finally {
            setLoading(false);
        }
    };

    // Filter employees
    const filteredEmployees = employees.filter(e => {
        const matchesDept = selectedDept === 'all' || e.department === selectedDept;
        const matchesSearch = !searchQuery ||
            e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.employee_id?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesDept && matchesSearch;
    });

    // Pagination
    const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
    const paginatedEmployees = filteredEmployees.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Get employee logs (check-in and check-out separately)
    const getEmployeeLogs = useCallback((employeeId) => {
        const empLogs = logs.filter(log =>
            log.employee_id === employeeId ||
            log.employee?.toLowerCase().includes(employeeId?.toLowerCase())
        );
        // Sort by timestamp
        empLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return {
            checkIn: empLogs[0] || null,
            checkOut: empLogs.length > 1 ? empLogs[empLogs.length - 1] : null,
            allLogs: empLogs
        };
    }, [logs]);

    // Handle verification
    const handleVerification = async (logId, isCorrect) => {
        setVerificationStatus(prev => ({
            ...prev,
            [logId]: isCorrect ? 'correct' : 'incorrect'
        }));

        // TODO: Send to backend
        try {
            await fetch(`${DETECTION_API}/verify/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    log_id: logId,
                    is_correct: isCorrect,
                    org_code: attendanceOrg.org_code
                })
            });
        } catch (e) {
            console.error('Verification failed:', e);
        }
    };

    const exportAttendance = () => {
        const today = new Date().toISOString().split('T')[0];
        window.open(`${API_BASE}/records/export_excel/?organization_id=${attendanceOrg.id}&start_date=${today}&end_date=${today}`);
    };

    // Status badge component
    const StatusBadge = ({ status }) => {
        const config = {
            present: { bg: '#dcfce7', color: '#166534', text: '✓ PRESENT' },
            left: { bg: '#dbeafe', color: '#1e40af', text: '→ LEFT' },
            absent: { bg: '#fee2e2', color: '#991b1b', text: '✗ ABSENT' }
        };
        const c = config[status] || config.absent;
        return (
            <span style={{
                background: c.bg, color: c.color, padding: '6px 14px',
                borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem',
                display: 'inline-block'
            }}>
                {c.text}
            </span>
        );
    };

    // Image with loading state
    const LazyImage = ({ src, alt, size = 120, onClick }) => {
        const [loaded, setLoaded] = useState(false);
        const [error, setError] = useState(false);

        return (
            <div
                onClick={onClick}
                style={{
                    width: size, height: size,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: src ? 'pointer' : 'default',
                    border: '3px solid #e2e8f0',
                    position: 'relative'
                }}
            >
                {!loaded && !error && <span style={{ color: '#94a3b8' }}>⏳</span>}
                {error && <span style={{ color: '#94a3b8', fontSize: '2rem' }}>👤</span>}
                {src && (
                    <img
                        src={src}
                        alt={alt}
                        onLoad={() => setLoaded(true)}
                        onError={() => setError(true)}
                        style={{
                            width: '100%', height: '100%',
                            objectFit: 'cover',
                            display: loaded ? 'block' : 'none'
                        }}
                    />
                )}
                {!src && <span style={{ color: '#94a3b8', fontSize: '2.5rem' }}>👤</span>}
            </div>
        );
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '16px 24px',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1400px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button
                            onClick={() => navigate('/attendance/admin')}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '10px 20px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600' }}
                        >
                            ← Back
                        </button>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>📋 Attendance Review</h1>
                            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={loadAllData} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '10px 20px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600' }}>
                            🔄 Refresh
                        </button>
                        <button onClick={exportAttendance} style={{ background: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', color: '#059669', cursor: 'pointer', fontWeight: '600' }}>
                            📊 Export Excel
                        </button>
                        <a href="/kiosk" style={{ background: 'rgba(255,255,255,0.9)', padding: '10px 20px', borderRadius: '8px', color: '#059669', textDecoration: 'none', fontWeight: '600' }}>
                            🖥️ Open Kiosk
                        </a>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '100px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Loading attendance data...</p>
                </div>
            ) : (
                <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
                    {/* Stats Row */}
                    {todaySummary && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#3b82f6' }}>{todaySummary.total_employees}</div>
                                <div style={{ color: '#64748b', fontWeight: '500' }}>Total Employees</div>
                            </div>
                            <div style={{ background: '#dcfce7', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '2px solid #bbf7d0' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#166534' }}>{todaySummary.present}</div>
                                <div style={{ color: '#166534', fontWeight: '600' }}>✓ Present</div>
                            </div>
                            <div style={{ background: '#fee2e2', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '2px solid #fecaca' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#991b1b' }}>{todaySummary.absent}</div>
                                <div style={{ color: '#991b1b', fontWeight: '600' }}>✗ Absent</div>
                            </div>
                            <div style={{ background: '#fef3c7', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '2px solid #fde68a' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#92400e' }}>{logs.filter(l => !l.compliance_passed).length}</div>
                                <div style={{ color: '#92400e', fontWeight: '600' }}>⚠️ Compliance Issues</div>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="🔍 Search by name or ID..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            style={{ padding: '12px 20px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1rem', minWidth: '300px', background: 'white' }}
                        />
                        <select
                            value={selectedDept}
                            onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
                            style={{ padding: '12px 20px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1rem', background: 'white', cursor: 'pointer' }}
                        >
                            <option value="all">All Departments</option>
                            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                        </select>
                        <div style={{ flex: 1 }}></div>
                        <span style={{ color: '#64748b', fontWeight: '500' }}>
                            Page {currentPage} of {totalPages} • Showing {paginatedEmployees.length} of {filteredEmployees.length} employees
                        </span>
                    </div>

                    {/* Main Table */}
                    <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Employee</th>
                                    <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Status</th>
                                    <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>
                                        <span style={{ color: '#10b981' }}>📥 CHECK IN</span>
                                    </th>
                                    <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>
                                        <span style={{ color: '#3b82f6' }}>📤 CHECK OUT</span>
                                    </th>
                                    <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Compliance</th>
                                    <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>👤</div>
                                            No employees found
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedEmployees.map(emp => {
                                        const record = records.find(r => r.employee_id === emp.employee_id);
                                        const status = record ? (record.check_out ? 'left' : 'present') : 'absent';
                                        const empLogs = getEmployeeLogs(emp.employee_id);
                                        const isExpanded = expandedEmployee === emp.id;

                                        return (
                                            <React.Fragment key={emp.id}>
                                                <tr style={{ borderBottom: '1px solid #f1f5f9', background: isExpanded ? '#f8fafc' : 'white' }}>
                                                    {/* Employee Info */}
                                                    <td style={{ padding: '16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div>
                                                                <div style={{ fontWeight: '700', fontSize: '1rem', color: '#1e293b' }}>{emp.name}</div>
                                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>ID: {emp.employee_id}</div>
                                                                {emp.department && (
                                                                    <span style={{
                                                                        background: '#f1f5f9', color: '#475569',
                                                                        padding: '2px 8px', borderRadius: '4px',
                                                                        fontSize: '0.75rem', marginTop: '4px', display: 'inline-block'
                                                                    }}>
                                                                        {emp.department}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Status */}
                                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                                        <StatusBadge status={status} />
                                                    </td>

                                                    {/* Check In - Large Image */}
                                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                            <LazyImage
                                                                src={empLogs.checkIn?.image_url ? `http://localhost:8000${empLogs.checkIn.image_url}` : null}
                                                                alt="Check In"
                                                                size={120}
                                                                onClick={() => empLogs.checkIn?.image_url && setSelectedImage(`http://localhost:8000${empLogs.checkIn.image_url}`)}
                                                            />
                                                            <div style={{
                                                                background: '#dcfce7', color: '#166534',
                                                                padding: '6px 14px', borderRadius: '8px',
                                                                fontWeight: '700', fontSize: '1rem'
                                                            }}>
                                                                {record?.check_in
                                                                    ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                    : '—'}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Check Out - Large Image */}
                                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                            <LazyImage
                                                                src={empLogs.checkOut?.image_url ? `http://localhost:8000${empLogs.checkOut.image_url}` : null}
                                                                alt="Check Out"
                                                                size={120}
                                                                onClick={() => empLogs.checkOut?.image_url && setSelectedImage(`http://localhost:8000${empLogs.checkOut.image_url}`)}
                                                            />
                                                            <div style={{
                                                                background: '#dbeafe', color: '#1e40af',
                                                                padding: '6px 14px', borderRadius: '8px',
                                                                fontWeight: '700', fontSize: '1rem'
                                                            }}>
                                                                {record?.check_out
                                                                    ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                    : '—'}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Compliance */}
                                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                                        {empLogs.checkIn ? (
                                                            <div style={{
                                                                padding: '8px 16px', borderRadius: '8px',
                                                                background: empLogs.checkIn.compliance_passed ? '#dcfce7' : '#fee2e2',
                                                                color: empLogs.checkIn.compliance_passed ? '#166534' : '#991b1b',
                                                                fontWeight: '700'
                                                            }}>
                                                                {empLogs.checkIn.compliance_passed ? '✓ PASSED' : '✗ FAILED'}
                                                                <div style={{ fontSize: '0.8rem', fontWeight: '500', marginTop: '4px' }}>
                                                                    {empLogs.checkIn.face_confidence}% match
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#94a3b8' }}>—</span>
                                                        )}
                                                    </td>

                                                    {/* Actions */}
                                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                                        {empLogs.checkIn && (
                                                            <button
                                                                onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                                                                style={{
                                                                    background: isExpanded ? '#3b82f6' : '#f1f5f9',
                                                                    color: isExpanded ? 'white' : '#475569',
                                                                    border: 'none',
                                                                    padding: '10px 16px',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    fontWeight: '600'
                                                                }}
                                                            >
                                                                {isExpanded ? '▲ Hide' : '▼ Verify Detections'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>

                                                {/* Expanded Row for Detection Verification */}
                                                {isExpanded && (empLogs.checkIn || empLogs.checkOut) && (
                                                    <tr>
                                                        <td colSpan="6" style={{ padding: '0', background: '#f8fafc' }}>
                                                            <div style={{ padding: '20px 40px', borderBottom: '2px solid #e2e8f0' }}>
                                                                <h4 style={{ margin: '0 0 16px', color: '#1e293b' }}>
                                                                    🔍 Compliance Details for {emp.name}
                                                                </h4>

                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                                                    {/* CHECK-IN Compliance */}
                                                                    <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '3px solid #10b981' }}>
                                                                        <h5 style={{ margin: '0 0 12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            📥 CHECK-IN Compliance
                                                                        </h5>
                                                                        {empLogs.checkIn ? (
                                                                            <>
                                                                                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                                                                                    <LazyImage
                                                                                        src={empLogs.checkIn?.image_url ? `http://localhost:8000${empLogs.checkIn.image_url}` : null}
                                                                                        alt="Check In"
                                                                                        size={120}
                                                                                        onClick={() => empLogs.checkIn?.image_url && setSelectedImage(`http://localhost:8000${empLogs.checkIn.image_url}`)}
                                                                                    />
                                                                                    <div style={{ flex: 1 }}>
                                                                                        <div style={{
                                                                                            padding: '8px 12px', borderRadius: '8px', marginBottom: '8px',
                                                                                            background: empLogs.checkIn.compliance_passed ? '#dcfce7' : '#fee2e2',
                                                                                            color: empLogs.checkIn.compliance_passed ? '#166534' : '#991b1b',
                                                                                            fontWeight: '700'
                                                                                        }}>
                                                                                            {empLogs.checkIn.compliance_passed ? '✅ PASSED' : '❌ FAILED'}
                                                                                        </div>
                                                                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                                                            Face Match: {empLogs.checkIn.face_confidence}%
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                {/* Detection Grid */}
                                                                                {empLogs.checkIn.detections && Object.keys(empLogs.checkIn.detections).length > 0 && (
                                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                                                                                        {['hooter', 'logo', 'nagar nigam', 'number plate', 'painted number plate', 'wevois uniform', 'improper uniform'].map(key => {
                                                                                            const detected = empLogs.checkIn.detections?.[key] || empLogs.checkIn.detections?.[key.replace(/ /g, '_')];
                                                                                            if (detected === undefined && !empLogs.checkIn.detections?.[key.replace(/ /g, '_')]) return null;
                                                                                            return (
                                                                                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                                                    <span style={{ textTransform: 'capitalize' }}>{key}</span>
                                                                                                    <span style={{ color: detected ? '#166534' : '#991b1b', fontWeight: '700' }}>
                                                                                                        {detected ? '✓' : '✗'}
                                                                                                    </span>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No check-in data</p>
                                                                        )}
                                                                    </div>

                                                                    {/* CHECK-OUT Compliance */}
                                                                    <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '3px solid #3b82f6' }}>
                                                                        <h5 style={{ margin: '0 0 12px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            📤 CHECK-OUT Compliance
                                                                        </h5>
                                                                        {empLogs.checkOut ? (
                                                                            <>
                                                                                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                                                                                    <LazyImage
                                                                                        src={empLogs.checkOut?.image_url ? `http://localhost:8000${empLogs.checkOut.image_url}` : null}
                                                                                        alt="Check Out"
                                                                                        size={120}
                                                                                        onClick={() => empLogs.checkOut?.image_url && setSelectedImage(`http://localhost:8000${empLogs.checkOut.image_url}`)}
                                                                                    />
                                                                                    <div style={{ flex: 1 }}>
                                                                                        <div style={{
                                                                                            padding: '8px 12px', borderRadius: '8px', marginBottom: '8px',
                                                                                            background: empLogs.checkOut.compliance_passed ? '#dcfce7' : '#fee2e2',
                                                                                            color: empLogs.checkOut.compliance_passed ? '#166534' : '#991b1b',
                                                                                            fontWeight: '700'
                                                                                        }}>
                                                                                            {empLogs.checkOut.compliance_passed ? '✅ PASSED' : '❌ FAILED'}
                                                                                        </div>
                                                                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                                                            Face Match: {empLogs.checkOut.face_confidence}%
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                {/* Detection Grid */}
                                                                                {empLogs.checkOut.detections && Object.keys(empLogs.checkOut.detections).length > 0 && (
                                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                                                                                        {['hooter', 'logo', 'nagar nigam', 'number plate', 'painted number plate', 'wevois uniform', 'improper uniform'].map(key => {
                                                                                            const detected = empLogs.checkOut.detections?.[key] || empLogs.checkOut.detections?.[key.replace(/ /g, '_')];
                                                                                            if (detected === undefined && !empLogs.checkOut.detections?.[key.replace(/ /g, '_')]) return null;
                                                                                            return (
                                                                                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                                                                                                    <span style={{ textTransform: 'capitalize' }}>{key}</span>
                                                                                                    <span style={{ color: detected ? '#166534' : '#991b1b', fontWeight: '700' }}>
                                                                                                        {detected ? '✓' : '✗'}
                                                                                                    </span>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        ) : (
                                                                            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No check-out yet</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '10px 16px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: currentPage === 1 ? '#f1f5f9' : 'white',
                                    color: currentPage === 1 ? '#94a3b8' : '#475569',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                            >
                                ⟪ First
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '10px 20px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: currentPage === 1 ? '#f1f5f9' : 'white',
                                    color: currentPage === 1 ? '#94a3b8' : '#475569',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                            >
                                ← Prev
                            </button>

                            {/* Page Numbers */}
                            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        style={{
                                            padding: '10px 16px',
                                            border: 'none',
                                            borderRadius: '8px',
                                            background: currentPage === pageNum ? '#10b981' : 'white',
                                            color: currentPage === pageNum ? 'white' : '#475569',
                                            cursor: 'pointer',
                                            fontWeight: '700',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '10px 20px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: currentPage === totalPages ? '#f1f5f9' : 'white',
                                    color: currentPage === totalPages ? '#94a3b8' : '#475569',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                            >
                                Next →
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '10px 16px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: currentPage === totalPages ? '#f1f5f9' : 'white',
                                    color: currentPage === totalPages ? '#94a3b8' : '#475569',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                    fontWeight: '600',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                            >
                                Last ⟫
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Image Modal */}
            {selectedImage && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.9)', zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: '40px'
                    }}
                    onClick={() => setSelectedImage(null)}
                >
                    <div style={{ position: 'relative' }}>
                        <img
                            src={selectedImage}
                            alt="Full size"
                            style={{
                                maxWidth: '90vw',
                                maxHeight: '85vh',
                                borderRadius: '16px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
                            style={{
                                position: 'absolute', top: '-15px', right: '-15px',
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'white', border: 'none', cursor: 'pointer',
                                fontSize: '1.2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAttendancePage;
