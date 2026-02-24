import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE = '/api/v1/attendance';

function AdminEmployeesPage() {
    const navigate = useNavigate();
    const { attendanceOrg } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [activeEmployee, setActiveEmployee] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [formData, setFormData] = useState({
        employee_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: '',
        designation: '',
        role: 'driver'
    });

    useEffect(() => {
        fetchEmployees();
        const handleResize = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        let filtered = employees;
        if (searchTerm) {
            filtered = filtered.filter(e =>
                e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (roleFilter !== 'all') {
            filtered = filtered.filter(e => e.role === roleFilter);
        }
        setFilteredEmployees(filtered);
    }, [searchTerm, roleFilter, employees]);

    const fetchEmployees = async () => {
        try {
            const res = await fetch(`${API_BASE}/employees/?organization_id=${attendanceOrg.id}`);
            const data = await res.json();
            setEmployees(data.employees || []);
            setFilteredEmployees(data.employees || []);
        } catch (err) {
            console.error('Error fetching employees:', err);
        }
    };

    const openAddModal = () => {
        setModalMode('add');
        setFormData({
            employee_id: '',
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            department: '',
            designation: '',
            role: 'driver'
        });
        setShowModal(true);
    };

    const openEditModal = (emp) => {
        setModalMode('edit');
        setFormData({
            employee_id: emp.employee_id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            email: emp.email || '',
            phone: emp.phone || '',
            department: emp.department || '',
            designation: emp.designation || '',
            role: emp.role || 'driver'
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = modalMode === 'add'
                ? `${API_BASE}/employees/`
                : `${API_BASE}/employees/${activeEmployee.id}/`;

            const method = modalMode === 'add' ? 'POST' : 'PATCH';
            const body = { ...formData, organization_id: attendanceOrg.id };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setShowModal(false);
                fetchEmployees();
                alert(`Employee ${modalMode === 'add' ? 'added' : 'updated'} successfully!`);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error || 'Failed to save employee'}`);
            }
        } catch (err) {
            alert('Error saving employee: ' + err.message);
        }
    };

    const deleteEmployee = async (id) => {
        if (!window.confirm('Delete this employee? This cannot be undone.')) return;
        try {
            const res = await fetch(`${API_BASE}/employees/${id}/`, { method: 'DELETE' });
            if (res.ok) {
                fetchEmployees();
                setActiveEmployee(null);
                alert('Employee deleted');
            }
        } catch (err) {
            alert('Error deleting employee: ' + err.message);
        }
    };

    const copyEnrollLink = (emp) => {
        const link = `${window.location.origin}/enroll?org=${attendanceOrg.org_code}&emp=${emp.employee_id}`;
        navigator.clipboard.writeText(link);
        alert('Enrollment link copied!');
    };

    const stats = {
        total: employees.length,
        enrolled: employees.filter(e => e.face_enrolled).length,
        pending: employees.filter(e => !e.face_enrolled).length,
        drivers: employees.filter(e => e.role === 'driver').length
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <button onClick={() => navigate(-1)} style={styles.backBtn}>
                        ← Back
                    </button>
                    {isMobile && (
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            style={styles.toggleBtn}
                            title="Toggle Sidebar"
                        >
                            ☰
                        </button>
                    )}
                    <h1 style={styles.title}>Employee Management</h1>
                </div>
                <button onClick={openAddModal} style={styles.addBtn}>
                    + Add Employee
                </button>
            </div>

            {/* Stats Cards */}
            <div style={styles.statsContainer}>
                <div style={styles.statCard}>
                    <div style={styles.statIcon}>👥</div>
                    <div>
                        <div style={styles.statValue}>{stats.total}</div>
                        <div style={styles.statLabel}>Total Employees</div>
                    </div>
                </div>
                <div style={{ ...styles.statCard, ...styles.statCardGreen }}>
                    <div style={styles.statIcon}>✓</div>
                    <div>
                        <div style={styles.statValue}>{stats.enrolled}</div>
                        <div style={styles.statLabel}>Face Enrolled</div>
                    </div>
                </div>
                <div style={{ ...styles.statCard, ...styles.statCardOrange }}>
                    <div style={styles.statIcon}>⏳</div>
                    <div>
                        <div style={styles.statValue}>{stats.pending}</div>
                        <div style={styles.statLabel}>Pending</div>
                    </div>
                </div>
                <div style={{ ...styles.statCard, ...styles.statCardPurple }}>
                    <div style={styles.statIcon}>🚗</div>
                    <div>
                        <div style={styles.statValue}>{stats.drivers}</div>
                        <div style={styles.statLabel}>Drivers</div>
                    </div>
                </div>
            </div>

            <div style={styles.content}>
                {/* Sidebar */}
                {(sidebarOpen || !isMobile) && (
                    <div style={{ ...styles.sidebar, ...(isMobile ? styles.sidebarMobile : {}) }}>
                        <div style={styles.searchSection}>
                            <input
                                type="text"
                                placeholder="🔍 Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={styles.searchInput}
                            />
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                style={styles.filterSelect}
                            >
                                <option value="all">All Roles</option>
                                <option value="driver">Drivers Only</option>
                                <option value="helper">Helpers Only</option>
                                <option value="admin">Admins Only</option>
                            </select>
                        </div>

                        <div style={styles.employeeList}>
                            {filteredEmployees.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => {
                                        setActiveEmployee(emp);
                                        if (isMobile) setSidebarOpen(false);
                                    }}
                                    style={{
                                        ...styles.employeeCard,
                                        ...(activeEmployee?.id === emp.id ? styles.employeeCardActive : {})
                                    }}
                                >
                                    <div style={styles.employeeCardHeader}>
                                        <div>
                                            <div style={styles.employeeName}>{emp.name}</div>
                                            <div style={styles.employeeId}>ID: {emp.employee_id}</div>
                                        </div>
                                        <div style={styles.employeeBadges}>
                                            <span style={getRoleBadgeStyle(emp.role)}>{emp.role}</span>
                                            {emp.face_enrolled && (
                                                <span style={styles.enrolledBadge}>✓</span>
                                            )}
                                        </div>
                                    </div>
                                    {emp.designation && (
                                        <div style={styles.employeeDesignation}>{emp.designation}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div style={styles.main}>
                    {activeEmployee ? (
                        <div style={styles.detailCard}>
                            <div style={styles.detailHeader}>
                                <div style={styles.detailHeaderLeft}>
                                    <h2 style={styles.detailName}>{activeEmployee.name}</h2>
                                    <p style={styles.detailSubtitle}>
                                        {activeEmployee.designation || activeEmployee.department || 'Employee'}
                                    </p>
                                </div>
                                <div style={styles.detailBadges}>
                                    <span style={getRoleBadgeStyle(activeEmployee.role, true)}>
                                        {activeEmployee.role}
                                    </span>
                                    {activeEmployee.face_enrolled ? (
                                        <span style={styles.statusEnrolled}>✓ Face Enrolled</span>
                                    ) : (
                                        <span style={styles.statusPending}>⏳ Not Enrolled</span>
                                    )}
                                </div>
                            </div>

                            <div style={styles.infoSection}>
                                <h3 style={styles.sectionTitle}>Employee Details</h3>
                                <div style={styles.infoGrid}>
                                    <InfoItem label="Employee ID" value={activeEmployee.employee_id} />
                                    <InfoItem label="Department" value={activeEmployee.department || '—'} />
                                    <InfoItem label="Designation" value={activeEmployee.designation || '—'} />
                                    <InfoItem
                                        label="Login Password"
                                        value={<code style={styles.passwordCode}>{activeEmployee.password}</code>}
                                    />
                                </div>
                            </div>

                            <div style={styles.infoSection}>
                                <h3 style={styles.sectionTitle}>Contact Information</h3>
                                <div style={styles.infoGrid}>
                                    <InfoItem
                                        label="📧 Email Address"
                                        value={activeEmployee.email || <span style={styles.notProvided}>Not provided</span>}
                                    />
                                    <InfoItem
                                        label="📱 Phone Number"
                                        value={activeEmployee.phone || <span style={styles.notProvided}>Not provided</span>}
                                    />
                                </div>
                            </div>

                            <div style={styles.infoSection}>
                                <h3 style={styles.sectionTitle}>Face Recognition Status</h3>
                                <div style={styles.faceRecognitionCard}>
                                    <div style={styles.faceRecognitionItem}>
                                        <div style={styles.faceRecognitionLabel}>Enrollment Status</div>
                                        <div style={styles.faceRecognitionValue}>
                                            {activeEmployee.face_enrolled ? (
                                                <span style={{ color: '#10b981', fontWeight: '600' }}>✓ Enrolled</span>
                                            ) : (
                                                <span style={{ color: '#f59e0b', fontWeight: '600' }}>⏳ Pending</span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={styles.faceRecognitionItem}>
                                        <div style={styles.faceRecognitionLabel}>Images Captured</div>
                                        <div style={styles.faceRecognitionValue}>
                                            <span style={{ fontSize: '20px', fontWeight: '700', color: '#2563eb' }}>
                                                {activeEmployee.image_count || 0}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={styles.faceRecognitionItem}>
                                        <div style={styles.faceRecognitionLabel}>Image Status</div>
                                        <div style={styles.faceRecognitionValue}>
                                            <span style={styles.imageStatusBadge}>
                                                {activeEmployee.image_status || 'pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={styles.actionSection}>
                                <button style={styles.primaryActionBtn} onClick={() => copyEnrollLink(activeEmployee)}>
                                    📋 Copy Enrollment Link
                                </button>
                                <button style={styles.secondaryActionBtn} onClick={() => openEditModal(activeEmployee)}>
                                    ✏️ Edit Employee
                                </button>
                                <button style={styles.dangerActionBtn} onClick={() => deleteEmployee(activeEmployee.id)}>
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={styles.emptyState}>
                            <div style={styles.emptyIcon}>👥</div>
                            <h2 style={styles.emptyTitle}>No Employee Selected</h2>
                            <p style={styles.emptyText}>Select an employee from the list to view their details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div style={styles.modalHeader}>
                            <h2 style={styles.modalTitle}>
                                {modalMode === 'add' ? '➕ Add New Employee' : '✏️ Edit Employee'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={styles.modalClose}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} style={styles.form}>
                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Employee ID *</label>
                                <input
                                    type="text"
                                    value={formData.employee_id}
                                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                    style={styles.formInput}
                                    required
                                    disabled={modalMode === 'edit'}
                                />
                            </div>

                            <div style={styles.formRow}>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>First Name *</label>
                                    <input
                                        type="text"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        style={styles.formInput}
                                        required
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>Last Name *</label>
                                    <input
                                        type="text"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        style={styles.formInput}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    style={styles.formInput}
                                />
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Phone</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    style={styles.formInput}
                                />
                            </div>

                            <div style={styles.formRow}>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>Department</label>
                                    <input
                                        type="text"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        style={styles.formInput}
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label style={styles.formLabel}>Designation</label>
                                    <input
                                        type="text"
                                        value={formData.designation}
                                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                        style={styles.formInput}
                                    />
                                </div>
                            </div>

                            <div style={styles.formGroup}>
                                <label style={styles.formLabel}>Role *</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    style={styles.formInput}
                                >
                                    <option value="driver">Driver</option>
                                    <option value="helper">Helper</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div style={styles.modalActions}>
                                <button type="button" onClick={() => setShowModal(false)} style={styles.cancelBtn}>
                                    Cancel
                                </button>
                                <button type="submit" style={styles.submitBtn}>
                                    {modalMode === 'add' ? 'Add Employee' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper component for info items
const InfoItem = ({ label, value }) => (
    <div style={styles.infoItem}>
        <div style={styles.infoLabel}>{label}</div>
        <div style={styles.infoValue}>{value}</div>
    </div>
);

// Helper function for role badge styles
const getRoleBadgeStyle = (role, large = false) => {
    const baseStyle = large ? styles.roleBadgeLarge : styles.roleBadge;
    const colors = {
        driver: { bg: '#dbeafe', color: '#1e40af' },
        helper: { bg: '#dcfce7', color: '#15803d' },
        admin: { bg: '#fef3c7', color: '#92400e' }
    };
    const roleColors = colors[role] || colors.driver;
    return { ...baseStyle, background: roleColors.bg, color: roleColors.color };
};

const styles = {
    container: {
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    },
    header: {
        background: 'white',
        padding: '18px 24px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 10
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    backBtn: {
        padding: '10px 18px',
        background: 'white',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        color: '#475569'
    },
    toggleBtn: {
        padding: '10px 14px',
        background: '#3b82f6',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '18px',
        color: 'white',
        fontWeight: '600'
    },
    title: {
        margin: 0,
        fontSize: '20px',
        fontWeight: '600',
        color: '#1e293b'
    },
    addBtn: {
        padding: '10px 20px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(59,130,246,0.25)'
    },
    statsContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        padding: '20px 24px',
        maxWidth: '1400px',
        margin: '0 auto'
    },
    statCard: {
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        borderLeft: '4px solid #3b82f6'
    },
    statCardGreen: {
        borderLeft: '4px solid #10b981'
    },
    statCardOrange: {
        borderLeft: '4px solid #f59e0b'
    },
    statCardPurple: {
        borderLeft: '4px solid #8b5cf6'
    },
    statIcon: {
        fontSize: '32px',
        opacity: 0.8
    },
    statValue: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: 1
    },
    statLabel: {
        fontSize: '13px',
        color: '#64748b',
        marginTop: '4px'
    },
    content: {
        display: 'flex',
        gap: '20px',
        padding: '20px 24px',
        maxWidth: '1400px',
        margin: '0 auto'
    },
    sidebar: {
        width: '350px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        height: 'fit-content',
        maxHeight: 'calc(100vh - 300px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    sidebarMobile: {
        position: 'fixed',
        left: '20px',
        top: '180px',
        zIndex: 20,
        width: 'calc(100% - 40px)',
        maxHeight: 'calc(100vh - 200px)'
    },
    searchSection: {
        padding: '16px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    searchInput: {
        width: '100%',
        padding: '12px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '14px',
        boxSizing: 'border-box'
    },
    filterSelect: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '14px',
        boxSizing: 'border-box',
        background: 'white'
    },
    employeeList: {
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
    },
    employeeCard: {
        padding: '14px',
        marginBottom: '6px',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        border: '1px solid transparent'
    },
    employeeCardActive: {
        background: '#eff6ff',
        borderColor: '#3b82f6',
        boxShadow: '0 2px 4px rgba(59,130,246,0.12)'
    },
    employeeCardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '6px'
    },
    employeeName: {
        fontSize: '15px',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '2px'
    },
    employeeId: {
        fontSize: '12px',
        color: '#64748b'
    },
    employeeBadges: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        alignItems: 'flex-end'
    },
    roleBadge: {
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '500',
        textTransform: 'capitalize'
    },
    roleBadgeLarge: {
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        textTransform: 'capitalize'
    },
    enrolledBadge: {
        fontSize: '14px',
        color: '#10b981'
    },
    employeeDesignation: {
        fontSize: '12px',
        color: '#64748b',
        fontStyle: 'italic'
    },
    main: {
        flex: 1
    },
    detailCard: {
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    detailHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        paddingBottom: '20px',
        borderBottom: '2px solid #f1f5f9'
    },
    detailHeaderLeft: {},
    detailName: {
        margin: '0 0 6px 0',
        fontSize: '24px',
        fontWeight: '700',
        color: '#1e293b'
    },
    detailSubtitle: {
        margin: 0,
        fontSize: '15px',
        color: '#64748b'
    },
    detailBadges: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end'
    },
    statusEnrolled: {
        padding: '6px 14px',
        background: '#d1fae5',
        color: '#065f46',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600'
    },
    statusPending: {
        padding: '6px 14px',
        background: '#fef3c7',
        color: '#92400e',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600'
    },
    infoSection: {
        marginBottom: '24px'
    },
    sectionTitle: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid #f1f5f9'
    },
    infoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '14px'
    },
    infoItem: {
        padding: '14px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #f1f5f9'
    },
    infoLabel: {
        fontSize: '12px',
        color: '#64748b',
        marginBottom: '6px',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    infoValue: {
        fontSize: '15px',
        color: '#1e293b',
        fontWeight: '500'
    },
    passwordCode: {
        background: '#1e293b',
        color: '#93c5fd',
        padding: '4px 10px',
        borderRadius: '6px',
        fontFamily: 'monospace',
        fontSize: '14px',
        fontWeight: '600'
    },
    notProvided: {
        color: '#94a3b8',
        fontStyle: 'italic',
        fontWeight: '400'
    },
    faceRecognitionCard: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
    },
    faceRecognitionItem: {
        textAlign: 'center'
    },
    faceRecognitionLabel: {
        fontSize: '12px',
        color: '#64748b',
        marginBottom: '8px',
        fontWeight: '500'
    },
    faceRecognitionValue: {
        fontSize: '16px',
        fontWeight: '600'
    },
    imageStatusBadge: {
        padding: '4px 12px',
        background: '#e0e7ff',
        color: '#3730a3',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '500',
        textTransform: 'capitalize'
    },
    actionSection: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        marginTop: '24px',
        paddingTop: '20px',
        borderTop: '2px solid #f1f5f9'
    },
    primaryActionBtn: {
        padding: '12px 20px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(59,130,246,0.25)'
    },
    secondaryActionBtn: {
        padding: '12px 20px',
        background: 'white',
        color: '#3b82f6',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
    },
    dangerActionBtn: {
        padding: '12px 20px',
        background: 'white',
        color: '#ef4444',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
    },
    emptyState: {
        textAlign: 'center',
        padding: '80px 24px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    emptyIcon: {
        fontSize: '80px',
        opacity: 0.2,
        marginBottom: '16px'
    },
    emptyTitle: {
        fontSize: '20px',
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: '8px'
    },
    emptyText: {
        fontSize: '15px',
        color: '#94a3b8',
        margin: 0
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: 'white',
        borderRadius: '12px',
        padding: '28px',
        maxWidth: '560px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
    },
    modalTitle: {
        margin: 0,
        fontSize: '20px',
        fontWeight: '700',
        color: '#1e293b'
    },
    modalClose: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#94a3b8',
        padding: '4px'
    },
    form: {},
    formGroup: {
        marginBottom: '16px'
    },
    formRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '14px'
    },
    formLabel: {
        display: 'block',
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#475569'
    },
    formInput: {
        width: '100%',
        padding: '12px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '14px',
        boxSizing: 'border-box'
    },
    modalActions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '24px',
        paddingTop: '20px',
        borderTop: '1px solid #f1f5f9'
    },
    cancelBtn: {
        padding: '10px 20px',
        background: 'white',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        color: '#64748b'
    },
    submitBtn: {
        padding: '10px 24px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 2px 4px rgba(59,130,246,0.25)'
    }
};

export default AdminEmployeesPage;
