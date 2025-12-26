/**
 * Admin Dashboard - Attendance Overview
 * Employee management, attendance reports, exports
 */
import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000/api/v1/attendance';

const DashboardPage = () => {
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [todaySummary, setTodaySummary] = useState(null);
    const [showAddEmployee, setShowAddEmployee] = useState(false);
    const [showCreateOrg, setShowCreateOrg] = useState(false);
    const [newEmployee, setNewEmployee] = useState({ employee_id: '', first_name: '', last_name: '', department: '' });
    const [newOrg, setNewOrg] = useState({ name: '', org_code: '', password: '1234' });
    const [createdOrg, setCreatedOrg] = useState(null);
    const [status, setStatus] = useState('');

    // Load organizations
    useEffect(() => {
        fetch(`${API_BASE}/organizations/`)
            .then(r => r.json())
            .then(data => {
                setOrganizations(data.organizations || []);
                if (data.organizations?.length > 0) {
                    setSelectedOrg(data.organizations[0]);
                }
            })
            .catch(e => console.error(e));
    }, []);

    // Load employees and summary when org changes
    useEffect(() => {
        if (!selectedOrg) return;

        fetch(`${API_BASE}/employees/?organization_id=${selectedOrg.id}`)
            .then(r => r.json())
            .then(data => setEmployees(data.employees || []))
            .catch(e => console.error(e));

        fetch(`${API_BASE}/records/today_summary/?organization_id=${selectedOrg.id}`)
            .then(r => r.json())
            .then(data => setTodaySummary(data))
            .catch(e => console.error(e));
    }, [selectedOrg]);

    const createOrganization = async () => {
        if (!newOrg.name || !newOrg.org_code) {
            setStatus('❌ Enter organization name and code');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/organizations/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOrg)
            });
            const data = await res.json();
            if (res.ok) {
                setCreatedOrg(data);
                setOrganizations([...organizations, data]);
                setSelectedOrg(data);
                setNewOrg({ name: '', org_code: '', password: '1234' });
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const addEmployee = async () => {
        try {
            const res = await fetch(`${API_BASE}/employees/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newEmployee, organization_id: selectedOrg.id })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`✅ ${data.name} added!`);
                setEmployees([...employees, { id: data.id, ...newEmployee, face_enrolled: false }]);
                setShowAddEmployee(false);
                setNewEmployee({ employee_id: '', first_name: '', last_name: '', department: '' });
            } else {
                setStatus(`❌ ${data.error}`);
            }
        } catch (e) {
            setStatus(`❌ ${e.message}`);
        }
    };

    const exportAttendance = () => {
        const today = new Date().toISOString().split('T')[0];
        window.open(`${API_BASE}/records/export_excel/?organization_id=${selectedOrg.id}&start_date=${today}&end_date=${today}`);
    };

    return (
        <div className="container">
            {/* Wave Hero */}
            <div className="wave-hero" style={{ minHeight: '250px', paddingBottom: '100px' }}>
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">📊</span>
                        <span>Admin Dashboard</span>
                    </div>
                    <nav className="nav">
                        <a href="/" className="nav-link">Home</a>
                        <a href="/dashboard" className="nav-link active">Dashboard</a>
                        <a href="/kiosk" className="nav-link">Kiosk</a>
                        <a href="/dataset" className="nav-link">Datasets</a>
                    </nav>
                </div>

                <div style={{ textAlign: 'center', padding: '20px', position: 'relative', zIndex: 1 }}>
                    <h1 className="page-title">Attendance Dashboard</h1>
                    <p className="page-subtitle">Manage employees, view attendance, export reports</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                {status && (
                    <div className={`status-badge ${status.includes('✅') ? 'success' : 'error'}`}
                        style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                        {status}
                    </div>
                )}

                {/* No organization */}
                {organizations.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🏢</div>
                        <h2 style={{ marginBottom: '16px' }}>Create Your Organization</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
                            Get started by creating your company
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowCreateOrg(true)}>
                            ➕ Create Organization
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Organization selector */}
                        <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                                value={selectedOrg?.id || ''}
                                onChange={e => setSelectedOrg(organizations.find(o => o.id === e.target.value))}
                                className="form-input"
                                style={{ maxWidth: '300px' }}
                            >
                                {organizations.map(o => (
                                    <option key={o.id} value={o.id}>{o.name} ({o.org_code})</option>
                                ))}
                            </select>
                            <button className="btn btn-outline" onClick={() => setShowCreateOrg(true)}>
                                ➕ New Organization
                            </button>
                            <a href="/kiosk" className="btn btn-primary">
                                🖥️ Open Kiosk
                            </a>
                        </div>

                        {/* Stats Cards */}
                        {todaySummary && (
                            <div className="stats-grid mb-lg" style={{ padding: 0 }}>
                                <div className="card" style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', fontWeight: '800', color: 'var(--primary)' }}>
                                        {todaySummary.total_employees}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Total Employees</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', fontWeight: '800', color: 'var(--success)' }}>
                                        {todaySummary.present}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Present Today</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', fontWeight: '800', color: 'var(--warning)' }}>
                                        {todaySummary.late}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Late Arrivals</div>
                                </div>
                                <div className="card" style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', fontWeight: '800', color: 'var(--error)' }}>
                                        {todaySummary.absent}
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)' }}>Absent</div>
                                </div>
                            </div>
                        )}

                        {/* Employees */}
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2>Employees ({employees.length})</h2>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="btn btn-outline" onClick={exportAttendance}>
                                        📥 Export Today
                                    </button>
                                    <button className="btn btn-primary" onClick={() => setShowAddEmployee(true)}>
                                        ➕ Add Employee
                                    </button>
                                </div>
                            </div>

                            {employees.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)' }}>
                                    <p style={{ color: 'var(--text-secondary)' }}>No employees yet. Add your first employee!</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--bg-soft)' }}>
                                                <th style={{ padding: '12px', textAlign: 'left' }}>Employee ID</th>
                                                <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                                                <th style={{ padding: '12px', textAlign: 'left' }}>Department</th>
                                                <th style={{ padding: '12px', textAlign: 'left' }}>Face</th>
                                                <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employees.map(e => (
                                                <tr key={e.id} style={{ borderBottom: '1px solid var(--bg-soft)' }}>
                                                    <td style={{ padding: '12px' }}>{e.employee_id}</td>
                                                    <td style={{ padding: '12px', fontWeight: '500' }}>{e.name || `${e.first_name} ${e.last_name}`}</td>
                                                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{e.department || '-'}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <span className={`status-badge ${e.face_enrolled ? 'success' : 'warning'}`} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                                                            {e.face_enrolled ? '✅ Enrolled' : '⚠️ Not enrolled'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        {!e.face_enrolled && (
                                                            <button
                                                                className="btn btn-outline"
                                                                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                                onClick={() => {
                                                                    const link = `${window.location.origin}/enroll-face?org=${selectedOrg.org_code}&emp=${e.employee_id}`;
                                                                    navigator.clipboard.writeText(link);
                                                                    setStatus(`✅ Link copied! Send to ${e.name || e.first_name}`);
                                                                }}
                                                            >
                                                                📋 Copy Enrollment Link
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="card" style={{ marginTop: '24px' }}>
                            <h3 style={{ marginBottom: '16px' }}>Quick Actions</h3>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <a href="/kiosk" className="btn btn-primary">
                                    🖥️ Open Kiosk Mode
                                </a>
                                <button className="btn btn-outline" onClick={exportAttendance}>
                                    📊 Export Attendance
                                </button>
                                <a href="/enroll-employee" className="btn btn-success">
                                    📸 Enroll Employee Faces
                                </a>
                            </div>
                        </div>
                    </>
                )}

                {/* Create Organization Modal */}
                {showCreateOrg && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div className="card" style={{ maxWidth: '500px', width: '90%' }}>
                            {createdOrg ? (
                                <>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉</div>
                                        <h2 style={{ marginBottom: '8px', color: 'var(--success)' }}>Organization Created!</h2>
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Save these credentials for Kiosk login:</p>
                                    </div>
                                    <div style={{ background: 'var(--bg-soft)', padding: '24px', borderRadius: '12px', marginBottom: '24px' }}>
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Organization Code</label>
                                            <div style={{ fontSize: '1.8rem', fontWeight: '700', letterSpacing: '3px', color: 'var(--primary)' }}>
                                                {createdOrg.org_code}
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Password</label>
                                            <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                                                {createdOrg.password}
                                            </div>
                                        </div>
                                    </div>
                                    <button className="btn btn-primary w-full" onClick={() => { setShowCreateOrg(false); setCreatedOrg(null); }}>
                                        ✅ Got it!
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h2 style={{ marginBottom: '24px' }}>Create Organization</h2>
                                    <div className="form-group">
                                        <label className="form-label">Organization Name *</label>
                                        <input type="text" className="form-input" placeholder="Acme Inc."
                                            value={newOrg.name} onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Organization Code * <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(for Kiosk login)</span></label>
                                        <input type="text" className="form-input" placeholder="ACME or OFFICE1" style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
                                            value={newOrg.org_code} onChange={e => setNewOrg({ ...newOrg, org_code: e.target.value.toUpperCase() })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Password <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(default: 1234)</span></label>
                                        <input type="text" className="form-input" placeholder="1234"
                                            value={newOrg.password} onChange={e => setNewOrg({ ...newOrg, password: e.target.value })} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-outline" onClick={() => setShowCreateOrg(false)}>Cancel</button>
                                        <button className="btn btn-primary" onClick={createOrganization}>Create</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

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
            </div>
        </div>
    );
};

export default DashboardPage;
