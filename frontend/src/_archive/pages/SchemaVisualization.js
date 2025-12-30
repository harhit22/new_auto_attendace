/**
 * Database Schema Visualization - Interactive ERD
 * Shows all tables and their relationships with animations
 */
import React, { useState, useEffect, useRef } from 'react';

// Schema data with relationships
const SCHEMA = {
    groups: [
        {
            name: 'Core Utilities',
            color: '#8b5cf6',
            tables: [
                {
                    id: 'organization',
                    name: 'Organization',
                    icon: '🏢',
                    fields: ['id', 'org_code', 'name', 'plan', 'recognition_mode'],
                    description: 'Company/Business using the system'
                },
                {
                    id: 'saas_employee',
                    name: 'SaaS Employee',
                    icon: '👤',
                    fields: ['id', 'organization_id', 'employee_id', 'name', 'face_embeddings'],
                    description: 'Employees enrolled for attendance'
                },
                {
                    id: 'saas_attendance',
                    name: 'SaaS Attendance',
                    icon: '📅',
                    fields: ['id', 'organization_id', 'employee_id', 'check_in', 'check_out'],
                    description: 'Daily attendance records'
                }
            ]
        },
        {
            name: 'Users & Departments',
            color: '#3b82f6',
            tables: [
                {
                    id: 'user',
                    name: 'User',
                    icon: '👨‍💼',
                    fields: ['id', 'email', 'employee_id', 'department_id', 'role'],
                    description: 'System users (Admin/Manager/Employee)'
                },
                {
                    id: 'department',
                    name: 'Department',
                    icon: '🏛️',
                    fields: ['id', 'name', 'code', 'parent_id'],
                    description: 'Organizational departments'
                },
                {
                    id: 'audit_log',
                    name: 'Audit Log',
                    icon: '📝',
                    fields: ['id', 'user_id', 'action', 'resource_type'],
                    description: 'Track all system changes'
                },
                {
                    id: 'device_log',
                    name: 'Device Log',
                    icon: '📱',
                    fields: ['id', 'user_id', 'device_id', 'event_type'],
                    description: 'Device activity logs'
                }
            ]
        },
        {
            name: 'Face Recognition',
            color: '#10b981',
            tables: [
                {
                    id: 'face_image',
                    name: 'Face Image',
                    icon: '🖼️',
                    fields: ['id', 'user_id', 'image', 'quality_score', 'purpose'],
                    description: 'Stored face images for training'
                },
                {
                    id: 'face_embedding',
                    name: 'Face Embedding',
                    icon: '🧬',
                    fields: ['id', 'user_id', 'face_image_id', 'embedding_vector'],
                    description: '512-dim vector representations'
                },
                {
                    id: 'enrollment_session',
                    name: 'Enrollment Session',
                    icon: '📸',
                    fields: ['id', 'user_id', 'status', 'images_captured'],
                    description: 'Track enrollment progress'
                }
            ]
        },
        {
            name: 'ML Models',
            color: '#f59e0b',
            tables: [
                {
                    id: 'model_version',
                    name: 'Model Version',
                    icon: '🤖',
                    fields: ['id', 'version_tag', 'model_type', 'accuracy'],
                    description: 'ML model versions (Light/Heavy)'
                },
                {
                    id: 'training_job',
                    name: 'Training Job',
                    icon: '⚙️',
                    fields: ['id', 'model_version_id', 'status', 'epochs'],
                    description: 'Model training executions'
                },
                {
                    id: 'training_log',
                    name: 'Training Log',
                    icon: '📊',
                    fields: ['id', 'training_job_id', 'epoch', 'loss', 'accuracy'],
                    description: 'Per-epoch training metrics'
                }
            ]
        },
        {
            name: 'Attendance System',
            color: '#ef4444',
            tables: [
                {
                    id: 'attendance_record',
                    name: 'Attendance Record',
                    icon: '⏰',
                    fields: ['id', 'user_id', 'check_in_time', 'face_match_score'],
                    description: 'Check-in/out records with validation'
                },
                {
                    id: 'validation_rule',
                    name: 'Validation Rule',
                    icon: '✅',
                    fields: ['id', 'name', 'code', 'threshold'],
                    description: 'Configurable attendance rules'
                },
                {
                    id: 'attendance_override',
                    name: 'Attendance Override',
                    icon: '🔧',
                    fields: ['id', 'attendance_id', 'performed_by', 'reason'],
                    description: 'Manual attendance corrections'
                }
            ]
        }
    ],
    relationships: [
        { from: 'organization', to: 'saas_employee', label: 'has many' },
        { from: 'organization', to: 'saas_attendance', label: 'has many' },
        { from: 'saas_employee', to: 'saas_attendance', label: 'has many' },
        { from: 'department', to: 'user', label: 'has many' },
        { from: 'department', to: 'department', label: 'parent' },
        { from: 'user', to: 'face_image', label: 'has many' },
        { from: 'user', to: 'face_embedding', label: 'has many' },
        { from: 'user', to: 'enrollment_session', label: 'has many' },
        { from: 'user', to: 'attendance_record', label: 'has many' },
        { from: 'user', to: 'device_log', label: 'has many' },
        { from: 'user', to: 'audit_log', label: 'has many' },
        { from: 'face_image', to: 'face_embedding', label: 'has many' },
        { from: 'face_image', to: 'attendance_record', label: 'captured for' },
        { from: 'model_version', to: 'face_embedding', label: 'generates' },
        { from: 'model_version', to: 'training_job', label: 'has many' },
        { from: 'training_job', to: 'training_log', label: 'has many' },
        { from: 'attendance_record', to: 'attendance_override', label: 'has many' },
        { from: 'validation_rule', to: 'department', label: 'applies to' },
    ]
};

const SchemaVisualization = () => {
    const [selectedTable, setSelectedTable] = useState(null);
    const [hoveredGroup, setHoveredGroup] = useState(null);
    const [animatingConnections, setAnimatingConnections] = useState([]);
    const canvasRef = useRef(null);

    // Animate connections when a table is selected
    useEffect(() => {
        if (selectedTable) {
            const related = SCHEMA.relationships
                .filter(r => r.from === selectedTable || r.to === selectedTable)
                .map(r => r.from === selectedTable ? r.to : r.from);
            setAnimatingConnections(related);
        } else {
            setAnimatingConnections([]);
        }
    }, [selectedTable]);

    const styles = {
        container: {
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
            padding: '24px',
            fontFamily: "'Inter', -apple-system, sans-serif"
        },
        header: {
            textAlign: 'center',
            marginBottom: '40px'
        },
        title: {
            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px'
        },
        subtitle: {
            color: 'rgba(255,255,255,0.6)',
            fontSize: '1rem'
        },
        statsRow: {
            display: 'flex',
            gap: '20px',
            justifyContent: 'center',
            marginTop: '20px',
            flexWrap: 'wrap'
        },
        stat: {
            background: 'rgba(255,255,255,0.05)',
            padding: '12px 24px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center'
        },
        statNumber: {
            fontSize: '1.8rem',
            fontWeight: '700',
            color: 'white'
        },
        statLabel: {
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
            maxWidth: '1400px',
            margin: '0 auto'
        },
        group: (color, isHovered) => ({
            background: isHovered
                ? `linear-gradient(135deg, ${color}20, ${color}10)`
                : 'rgba(255,255,255,0.02)',
            borderRadius: '20px',
            border: `2px solid ${isHovered ? color : 'rgba(255,255,255,0.08)'}`,
            padding: '24px',
            transition: 'all 0.3s ease',
            transform: isHovered ? 'translateY(-4px)' : 'none',
            boxShadow: isHovered ? `0 20px 40px ${color}30` : 'none'
        }),
        groupHeader: (color) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: `2px solid ${color}40`
        }),
        groupDot: (color) => ({
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 12px ${color}`
        }),
        groupTitle: {
            color: 'white',
            fontSize: '1.1rem',
            fontWeight: '700',
            margin: 0
        },
        tableCard: (color, isSelected, isAnimating) => ({
            background: isSelected
                ? `${color}20`
                : isAnimating
                    ? `${color}15`
                    : 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '12px',
            cursor: 'pointer',
            border: `1px solid ${isSelected ? color : isAnimating ? `${color}60` : 'rgba(255,255,255,0.08)'}`,
            transition: 'all 0.3s ease',
            transform: isAnimating ? 'scale(1.02)' : 'none'
        }),
        tableHeader: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '8px'
        },
        tableIcon: {
            fontSize: '1.4rem'
        },
        tableName: {
            color: 'white',
            fontWeight: '600',
            fontSize: '0.95rem'
        },
        tableDesc: {
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.8rem',
            marginBottom: '12px'
        },
        fieldList: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px'
        },
        field: (color) => ({
            background: `${color}20`,
            color: color,
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            fontFamily: 'monospace'
        }),
        detailPanel: {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '20px 30px',
            maxWidth: '600px',
            width: '90%',
            zIndex: 100,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        },
        relationList: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '12px'
        },
        relationBadge: (color) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: `${color}20`,
            border: `1px solid ${color}50`,
            color: color,
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '0.8rem'
        }),
        closeBtn: {
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem'
        }
    };

    const totalTables = SCHEMA.groups.reduce((sum, g) => sum + g.tables.length, 0);
    const totalRelations = SCHEMA.relationships.length;

    const getTableGroup = (tableId) => {
        for (const group of SCHEMA.groups) {
            const table = group.tables.find(t => t.id === tableId);
            if (table) return { table, group };
        }
        return null;
    };

    const selectedInfo = selectedTable ? getTableGroup(selectedTable) : null;
    const relatedTables = selectedTable
        ? SCHEMA.relationships
            .filter(r => r.from === selectedTable || r.to === selectedTable)
            .map(r => ({
                ...r,
                target: r.from === selectedTable ? r.to : r.from,
                direction: r.from === selectedTable ? 'outgoing' : 'incoming'
            }))
        : [];

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>🗄️ Database Schema Explorer</h1>
                <p style={styles.subtitle}>Interactive visualization of all system tables and relationships</p>

                <div style={styles.statsRow}>
                    <div style={styles.stat}>
                        <div style={styles.statNumber}>{SCHEMA.groups.length}</div>
                        <div style={styles.statLabel}>Groups</div>
                    </div>
                    <div style={styles.stat}>
                        <div style={styles.statNumber}>{totalTables}</div>
                        <div style={styles.statLabel}>Tables</div>
                    </div>
                    <div style={styles.stat}>
                        <div style={styles.statNumber}>{totalRelations}</div>
                        <div style={styles.statLabel}>Relationships</div>
                    </div>
                </div>
            </div>

            {/* Groups Grid */}
            <div style={styles.grid}>
                {SCHEMA.groups.map(group => (
                    <div
                        key={group.name}
                        style={styles.group(group.color, hoveredGroup === group.name)}
                        onMouseEnter={() => setHoveredGroup(group.name)}
                        onMouseLeave={() => setHoveredGroup(null)}
                    >
                        <div style={styles.groupHeader(group.color)}>
                            <div style={styles.groupDot(group.color)}></div>
                            <h3 style={styles.groupTitle}>{group.name}</h3>
                        </div>

                        {group.tables.map(table => (
                            <div
                                key={table.id}
                                style={styles.tableCard(
                                    group.color,
                                    selectedTable === table.id,
                                    animatingConnections.includes(table.id)
                                )}
                                onClick={() => setSelectedTable(selectedTable === table.id ? null : table.id)}
                            >
                                <div style={styles.tableHeader}>
                                    <span style={styles.tableIcon}>{table.icon}</span>
                                    <span style={styles.tableName}>{table.name}</span>
                                </div>
                                <div style={styles.tableDesc}>{table.description}</div>
                                <div style={styles.fieldList}>
                                    {table.fields.map(field => (
                                        <span key={field} style={styles.field(group.color)}>{field}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Detail Panel */}
            {selectedInfo && (
                <div style={styles.detailPanel}>
                    <button style={styles.closeBtn} onClick={() => setSelectedTable(null)}>×</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '2rem' }}>{selectedInfo.table.icon}</span>
                        <div>
                            <h3 style={{ color: 'white', margin: 0 }}>{selectedInfo.table.name}</h3>
                            <span style={{ color: selectedInfo.group.color, fontSize: '0.85rem' }}>{selectedInfo.group.name}</span>
                        </div>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', margin: '0 0 12px 0' }}>
                        {selectedInfo.table.description}
                    </p>

                    {relatedTables.length > 0 && (
                        <>
                            <h4 style={{ color: 'rgba(255,255,255,0.8)', margin: '16px 0 8px 0', fontSize: '0.9rem' }}>
                                🔗 Relationships ({relatedTables.length})
                            </h4>
                            <div style={styles.relationList}>
                                {relatedTables.map((rel, i) => {
                                    const targetInfo = getTableGroup(rel.target);
                                    return (
                                        <div
                                            key={i}
                                            style={styles.relationBadge(targetInfo?.group.color || '#888')}
                                            onClick={() => setSelectedTable(rel.target)}
                                        >
                                            <span>{rel.direction === 'outgoing' ? '→' : '←'}</span>
                                            <span>{targetInfo?.table.icon}</span>
                                            <span>{targetInfo?.table.name}</span>
                                            <span style={{ opacity: 0.7 }}>({rel.label})</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* CSS Animations */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
                    50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.6); }
                }
            `}</style>
        </div>
    );
};

export default SchemaVisualization;
