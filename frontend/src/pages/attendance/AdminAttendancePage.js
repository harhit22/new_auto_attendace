/**
 * Admin Attendance Page - Detailed Records View
 * Shows: Departments, Employee photos, Check-in/out times, Attendance log
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const AdminAttendancePage = () => {
    const navigate = useNavigate();
    const { attendanceOrg, isLoading: authLoading } = useAuth();
    const [todaySummary, setTodaySummary] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [records, setRecords] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('all');
    const [loading, setLoading] = useState(true);

    // Debug log
    useEffect(() => {
        console.log('AdminAttendancePage - attendanceOrg:', attendanceOrg);
    }, [attendanceOrg]);

    useEffect(() => {
        if (authLoading) return; // Wait for auth to load
        if (!attendanceOrg) {
            console.error('No attendanceOrg found - redirecting to login');
            navigate('/attendance/login');
            return;
        }
        loadAllData();
    }, [attendanceOrg, authLoading]);

    const loadAllData = async () => {
        if (!attendanceOrg?.id) {
            console.error('attendanceOrg.id is missing');
            return;
        }

        setLoading(true);
        console.log('Loading data for org:', attendanceOrg.id);

        try {
            const [summaryRes, empRes, recordsRes] = await Promise.all([
                fetch(`${API_BASE}/records/today_summary/?organization_id=${attendanceOrg.id}`),
                fetch(`${API_BASE}/employees/?organization_id=${attendanceOrg.id}`),
                fetch(`${API_BASE}/records/?organization_id=${attendanceOrg.id}`)
            ]);

            const summaryData = await summaryRes.json();
            const empData = await empRes.json();
            const recordsData = await recordsRes.json();

            console.log('Loaded employees:', empData);
            console.log('Loaded records:', recordsData);

            setTodaySummary(summaryData);
            setEmployees(empData.employees || []);

            // Get today's records - now using 'records' key from updated API
            const today = new Date().toISOString().split('T')[0];
            const allRecords = recordsData.records || recordsData.results || recordsData || [];
            const todayRecords = allRecords.filter(r =>
                r.date === today || (r.check_in && r.check_in.startsWith(today))
            );
            setRecords(todayRecords);
            console.log('Today records:', todayRecords);

            // Extract unique departments
            const depts = [...new Set((empData.employees || []).map(e => e.department).filter(Boolean))];
            setDepartments(depts);

        } catch (e) {
            console.error('Failed to load data:', e);
        } finally {
            setLoading(false);
        }
    };

    const exportAttendance = () => {
        const today = new Date().toISOString().split('T')[0];
        window.open(`${API_BASE}/records/export_excel/?organization_id=${attendanceOrg.id}&start_date=${today}&end_date=${today}`);
    };

    // Filter employees by department
    const filteredEmployees = selectedDept === 'all'
        ? employees
        : employees.filter(e => e.department === selectedDept);

    // Get attendance status for employee
    const getEmployeeStatus = (empId) => {
        // Debug: log all records and what we're searching for
        console.log('Looking for employee:', empId, 'in records:', records);

        const record = records.find(r => {
            // Match by employee_id (could be string ID like "EMP001")
            return r.employee_id === empId;
        });

        console.log('Found record:', record);

        if (!record) return { status: 'absent', checkIn: null, checkOut: null };
        return {
            status: record.check_out ? 'left' : record.check_in ? 'present' : 'absent',
            checkIn: record.check_in,
            checkOut: record.check_out
        };
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="container">
            {/* Header */}
            <div className="wave-hero" style={{ minHeight: '180px', paddingBottom: '60px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">✓</span>
                        <span>Attendance</span>
                    </div>
                    <nav className="nav">
                        <button onClick={() => navigate('/attendance/admin')} className="nav-link">← Dashboard</button>
                        <a href="/kiosk" className="nav-link">🖥️ Kiosk</a>
                    </nav>
                </div>
                <div style={{ textAlign: 'center', padding: '10px' }}>
                    <h1 className="page-title">Today's Attendance</h1>
                    <p className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="main-content">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⏳</div>
                        <p style={{ color: 'var(--text-secondary)' }}>Loading attendance data...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        {todaySummary && (
                            <div className="stats-grid mb-lg" style={{ padding: 0 }}>
                                <div className="card" style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)' }}>
                                        {todaySummary.total_employees}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Total</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981' }}>
                                        {todaySummary.present}
                                    </div>
                                    <div style={{ color: '#10b981' }}>Present</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#ef4444' }}>
                                        {todaySummary.absent}
                                    </div>
                                    <div style={{ color: '#ef4444' }}>Absent</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--warning)' }}>
                                        {todaySummary.late}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Late</div>
                                </div>
                            </div>
                        )}

                        {/* Department Filter & Actions */}
                        <div className="card" style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Filter by Department</label>
                                    <select
                                        value={selectedDept}
                                        onChange={e => setSelectedDept(e.target.value)}
                                        className="form-input"
                                        style={{ maxWidth: '250px' }}
                                    >
                                        <option value="all">All Departments ({employees.length})</option>
                                        {departments.map(d => (
                                            <option key={d} value={d}>{d} ({employees.filter(e => e.department === d).length})</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <a href="/kiosk" className="btn btn-primary">🖥️ Open Kiosk</a>
                                    <button className="btn btn-secondary" onClick={exportAttendance}>📊 Export Report</button>
                                    <button className="btn btn-outline" onClick={loadAllData}>🔄 Refresh</button>
                                </div>
                            </div>
                        </div>

                        {/* Employee Attendance Grid */}
                        <div className="card">
                            <h2 style={{ marginBottom: '20px' }}>Employee Status ({filteredEmployees.length})</h2>

                            {filteredEmployees.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                    No employees found{selectedDept !== 'all' ? ` in ${selectedDept}` : ''}.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--bg-soft)', textAlign: 'left' }}>
                                                <th style={{ padding: '12px' }}>Employee</th>
                                                <th style={{ padding: '12px' }}>Department</th>
                                                <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                                                <th style={{ padding: '12px', textAlign: 'center' }}>Check In</th>
                                                <th style={{ padding: '12px', textAlign: 'center' }}>Check Out</th>
                                                <th style={{ padding: '12px', textAlign: 'center' }}>Photos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEmployees.map(emp => {
                                                const { status, checkIn, checkOut } = getEmployeeStatus(emp.employee_id);
                                                return (
                                                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                                        <td style={{ padding: '12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <div style={{
                                                                    width: '40px', height: '40px', borderRadius: '50%',
                                                                    background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '1rem', fontWeight: '600', color: 'var(--text-secondary)'
                                                                }}>
                                                                    {(emp.name || emp.first_name || '?')[0].toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: '600' }}>{emp.name || `${emp.first_name} ${emp.last_name}`}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.employee_id}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{emp.department || '-'}</td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            <span style={{
                                                                padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                                                                background: status === 'present' ? 'rgba(16, 185, 129, 0.1)' :
                                                                    status === 'left' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                                color: status === 'present' ? '#10b981' :
                                                                    status === 'left' ? '#3b82f6' : '#ef4444'
                                                            }}>
                                                                {status === 'present' ? '✅ Present' : status === 'left' ? '👋 Left' : '❌ Absent'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: '500', color: checkIn ? '#10b981' : 'var(--text-muted)' }}>
                                                            {formatTime(checkIn)}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: '500', color: checkOut ? '#3b82f6' : 'var(--text-muted)' }}>
                                                            {formatTime(checkOut)}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            <span style={{
                                                                color: emp.image_count > 0 ? 'var(--success)' : 'var(--text-muted)',
                                                                fontWeight: '600'
                                                            }}>
                                                                {emp.image_count || 0} 📷
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminAttendancePage;
