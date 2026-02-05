/**
 * Admin Employees Page - For managing employees (add/delete)
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = '/api/v1/attendance';

const AdminEmployeesPage = () => {
    const navigate = useNavigate();
    const { attendanceOrg } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [showAddEmployee, setShowAddEmployee] = useState(false);
    const [newEmployee, setNewEmployee] = useState({ employee_id: '', first_name: '', last_name: '', department: '', role: 'driver' });
    const [status, setStatus] = useState('');
    const [createdEmployee, setCreatedEmployee] = useState(null); // Store newly created employee with password

    useEffect(() => {
        if (!attendanceOrg) return;
        loadEmployees();
    }, [attendanceOrg]);

    const loadEmployees = async () => {
        try {
            const res = await fetch(`${API_BASE}/employees/?organization_id=${attendanceOrg.id}`);
            const data = await res.json();
            setEmployees(data.employees || []);
        } catch (e) {
            console.error(e);
        }
    };

    const addEmployee = async () => {
        try {
            const res = await fetch(`${API_BASE}/employees/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newEmployee, organization_id: attendanceOrg.id })
            });
            const data = await res.json();
            if (res.ok) {
                // Show the password to admin!
                setCreatedEmployee({
                    name: data.name,
                    employee_id: data.employee_id,
                    password: data.password
                });
                loadEmployees();
                setShowAddEmployee(false);
                setNewEmployee({ employee_id: '', first_name: '', last_name: '', department: '', role: 'driver' });
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const deleteEmployee = async (empId) => {
        if (!window.confirm('Delete this employee?')) return;
        try {
            await fetch(`${API_BASE}/employees/${empId}/`, { method: 'DELETE' });
            setStatus('🗑️ Employee deleted');
            loadEmployees();
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const copyEnrollLink = (emp) => {
        const link = `${window.location.origin}/enroll-employee?org=${attendanceOrg.org_code}&emp=${emp.employee_id}`;

        // Fallback for non-HTTPS environments
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(link);
        } else {
            // Fallback using textarea
            const textArea = document.createElement('textarea');
            textArea.value = link;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Copy failed:', err);
            }
            document.body.removeChild(textArea);
        }
        setStatus(`✅ Link copied! Send to ${emp.name || emp.first_name}`);
    };

    return (
        <div className="container">
            {/* Header */}
            <div className="wave-hero" style={{ minHeight: '180px', paddingBottom: '60px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">👥</span>
                        <span>Employees</span>
                    </div>
                    <nav className="nav">
                        <button onClick={() => navigate('/attendance/admin')} className="nav-link">← Back to Dashboard</button>
                    </nav>
                </div>
                <div style={{ textAlign: 'center', padding: '10px' }}>
                    <h1 className="page-title">Employee Management</h1>
                    <p className="page-subtitle">Add, remove, and manage employee records</p>
                </div>
            </div>

            <div className="main-content">
                {status && (
                    <div className={`status-badge ${status.includes('✅') ? 'success' : 'error'}`}
                        style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', padding: '12px 24px' }}>
                        {status}
                    </div>
                )}

                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2>Employees ({employees.length})</h2>
                        <button className="btn btn-success" onClick={() => setShowAddEmployee(true)}>➕ Add Employee</button>
                    </div>

                    {employees.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)' }}>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>No employees yet. Add your first employee!</p>
                            <button className="btn btn-primary" onClick={() => setShowAddEmployee(true)}>➕ Add Employee</button>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--bg-soft)' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Password</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Dept</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Role</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Images</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                                        <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(e => (
                                        <tr key={e.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                            <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '600' }}>{e.employee_id}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    fontFamily: 'monospace',
                                                    fontWeight: '600',
                                                    color: 'var(--primary)',
                                                    background: 'var(--bg-soft)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    letterSpacing: '1px'
                                                }}>
                                                    {e.password || 'N/A'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', fontWeight: '500' }}>{e.name || `${e.first_name} ${e.last_name}`}</td>
                                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{e.department || '-'}</td>
                                            <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '4px',
                                                    background: e.role === 'helper' ? ' #e0f2fe' : '#fef3c7',
                                                    color: e.role === 'helper' ? '#0ea5e9' : '#d97706',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '500'
                                                }}>
                                                    {e.role || 'driver'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    fontWeight: '600',
                                                    color: (e.image_count || 0) >= 100 ? 'var(--success)' : (e.image_count || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)'
                                                }}>
                                                    {e.image_count || 0}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span className={`status-badge ${e.face_enrolled ? 'success' : e.image_status === 'captured' ? 'warning' : ''}`} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                                                    {e.face_enrolled ? '✅ Trained' : e.image_status || 'pending'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => copyEnrollLink(e)}>
                                                    📋 Link
                                                </button>
                                                <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--error)' }} onClick={() => deleteEmployee(e.id)}>
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Add Employee Modal */}
                {showAddEmployee && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="card" style={{ maxWidth: '500px', width: '90%' }}>
                            <h2 style={{ marginBottom: '24px' }}>Add Employee</h2>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Employee ID *</label>
                                    <input type="text" className="form-input" placeholder="EMP001"
                                        value={newEmployee.employee_id}
                                        onChange={e => setNewEmployee({ ...newEmployee, employee_id: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select className="form-input"
                                        value={newEmployee.role || 'driver'}
                                        onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })}>
                                        <option value="driver">Driver</option>
                                        <option value="helper">Helper</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Department</label>
                                    <input type="text" className="form-input" placeholder="Engineering"
                                        value={newEmployee.department}
                                        onChange={e => setNewEmployee({ ...newEmployee, department: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">First Name *</label>
                                    <input type="text" className="form-input" placeholder="John"
                                        value={newEmployee.first_name}
                                        onChange={e => setNewEmployee({ ...newEmployee, first_name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Last Name *</label>
                                    <input type="text" className="form-input" placeholder="Doe"
                                        value={newEmployee.last_name}
                                        onChange={e => setNewEmployee({ ...newEmployee, last_name: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-outline" onClick={() => setShowAddEmployee(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={addEmployee}>Add Employee</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Show Credentials Modal - IMPORTANT: Display password to admin! */}
                {createdEmployee && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="card" style={{ maxWidth: '450px', width: '90%', textAlign: 'center' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
                            <h2 style={{ marginBottom: '8px', color: 'var(--success)' }}>Employee Created!</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                                Share these login credentials with <strong>{createdEmployee.name}</strong>
                            </p>

                            <div style={{ background: 'var(--bg-soft)', padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Employee ID:</span>
                                    <strong style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{createdEmployee.employee_id}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Password:</span>
                                    <strong style={{ fontFamily: 'monospace', fontSize: '1.3rem', color: 'var(--primary)', letterSpacing: '2px' }}>{createdEmployee.password}</strong>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                                ⚠️ This password is shown only once. Make sure to copy it now!
                            </p>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`Employee ID: ${createdEmployee.employee_id}\nPassword: ${createdEmployee.password}`);
                                        setStatus('✅ Credentials copied to clipboard!');
                                    }}
                                >
                                    📋 Copy
                                </button>
                                <button className="btn btn-primary" onClick={() => setCreatedEmployee(null)}>
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminEmployeesPage;

