/**
 * Employee Dashboard Page
 * Shows employee's attendance history, today's status, and enrollment options
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const EmployeeDashboard = () => {
    const navigate = useNavigate();
    const [employee, setEmployee] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedEmployee = sessionStorage.getItem('employee');
        if (!storedEmployee) {
            navigate('/employee/login');
            return;
        }

        const emp = JSON.parse(storedEmployee);
        setEmployee(emp);
        loadDashboard(emp);
    }, []);

    const loadDashboard = async (emp) => {
        setIsLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/employee-dashboard/?org_code=${emp.org_code}&employee_id=${emp.employee_id}`
            );
            const data = await res.json();
            if (res.ok) {
                setDashboard(data);
            }
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    const logout = () => {
        sessionStorage.removeItem('employee');
        navigate('/employee/login');
    };

    if (isLoading || !employee) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-muted)' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '30px 20px',
                color: 'white'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                                👋 Welcome, {employee.name}
                            </h1>
                            <p style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                                {employee.org_name} • {employee.department || 'Employee'}
                            </p>
                        </div>
                        <button
                            onClick={logout}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
                {/* Today's Status */}
                <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px' }}>📅 Today's Status</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{
                            padding: '20px',
                            background: dashboard?.today?.checked_in ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-soft)',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                                {dashboard?.today?.checked_in ? '✅' : '⏳'}
                            </div>
                            <div style={{ fontWeight: '600' }}>Check In</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {dashboard?.today?.checked_in || 'Not yet'}
                            </div>
                        </div>
                        <div style={{
                            padding: '20px',
                            background: dashboard?.today?.checked_out ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-soft)',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                                {dashboard?.today?.checked_out ? '✅' : '⏳'}
                            </div>
                            <div style={{ fontWeight: '600' }}>Check Out</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {dashboard?.today?.checked_out || 'Not yet'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Face Status */}
                <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '16px' }}>🎯 Face Recognition Status</h3>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px',
                        background: employee.face_enrolled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        borderRadius: '12px'
                    }}>
                        <div>
                            <div style={{
                                fontWeight: '600',
                                color: employee.face_enrolled ? 'var(--success)' : 'var(--warning)',
                                marginBottom: '4px'
                            }}>
                                {employee.face_enrolled ? '✅ Face Enrolled' : '⚠️ Face Not Enrolled'}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {employee.image_count} images captured • Status: {employee.image_status}
                            </div>
                        </div>
                        <a
                            href={`/enroll-face?org=${employee.org_code}&emp=${employee.employee_id}`}
                            className="btn btn-primary"
                        >
                            {employee.face_enrolled ? '📷 Update Face' : '📷 Enroll Face'}
                        </a>
                    </div>
                </div>

                {/* Attendance History */}
                <div className="card" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px' }}>📊 Attendance History (Last 30 Days)</h3>

                    {dashboard?.attendance?.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            color: 'var(--text-muted)'
                        }}>
                            No attendance records yet
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--bg-soft)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Check In</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Check Out</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dashboard?.attendance?.map((record, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                            <td style={{ padding: '12px' }}>
                                                {new Date(record.date).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {record.check_in || '-'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {record.check_out || '-'}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '50px',
                                                    fontSize: '0.8rem',
                                                    background: record.status === 'present' ? 'rgba(16, 185, 129, 0.1)' :
                                                        record.status === 'late' ? 'rgba(245, 158, 11, 0.1)' :
                                                            'rgba(239, 68, 68, 0.1)',
                                                    color: record.status === 'present' ? 'var(--success)' :
                                                        record.status === 'late' ? 'var(--warning)' :
                                                            'var(--error)'
                                                }}>
                                                    {record.status || 'present'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeDashboard;
