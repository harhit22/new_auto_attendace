/**
 * Interactive ERD (Entity Relationship Diagram)
 * Draggable table nodes with SVG connection lines
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

// Complete schema with all fields and types
const TABLES = {
    organization: {
        name: 'Organization',
        color: '#8b5cf6',
        x: 100, y: 50,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'org_code', type: 'VARCHAR(20)', unique: true },
            { name: 'password', type: 'VARCHAR(50)' },
            { name: 'name', type: 'VARCHAR(200)' },
            { name: 'plan', type: 'ENUM' },
            { name: 'recognition_mode', type: 'ENUM' },
            { name: 'is_active', type: 'BOOLEAN' }
        ]
    },
    saas_employee: {
        name: 'SaaS Employee',
        color: '#3b82f6',
        x: 400, y: 50,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'organization_id', type: 'UUID', fk: 'organization' },
            { name: 'employee_id', type: 'VARCHAR(50)' },
            { name: 'first_name', type: 'VARCHAR(100)' },
            { name: 'last_name', type: 'VARCHAR(100)' },
            { name: 'face_enrolled', type: 'BOOLEAN' },
            { name: 'light_trained', type: 'BOOLEAN' },
            { name: 'heavy_trained', type: 'BOOLEAN' }
        ]
    },
    saas_attendance: {
        name: 'SaaS Attendance',
        color: '#10b981',
        x: 700, y: 50,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'organization_id', type: 'UUID', fk: 'organization' },
            { name: 'employee_id', type: 'UUID', fk: 'saas_employee' },
            { name: 'date', type: 'DATE' },
            { name: 'check_in', type: 'DATETIME' },
            { name: 'check_out', type: 'DATETIME' },
            { name: 'status', type: 'ENUM' }
        ]
    },
    user: {
        name: 'User',
        color: '#f59e0b',
        x: 100, y: 320,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'email', type: 'VARCHAR(255)', unique: true },
            { name: 'employee_id', type: 'VARCHAR(50)' },
            { name: 'name', type: 'VARCHAR(255)' },
            { name: 'department_id', type: 'UUID', fk: 'department' },
            { name: 'role', type: 'ENUM' },
            { name: 'is_active', type: 'BOOLEAN' }
        ]
    },
    department: {
        name: 'Department',
        color: '#f59e0b',
        x: 100, y: 580,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'name', type: 'VARCHAR(255)' },
            { name: 'code', type: 'VARCHAR(50)', unique: true },
            { name: 'parent_id', type: 'UUID', fk: 'department' },
            { name: 'is_active', type: 'BOOLEAN' }
        ]
    },
    face_image: {
        name: 'Face Image',
        color: '#ec4899',
        x: 400, y: 320,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'user_id', type: 'UUID', fk: 'user' },
            { name: 'image', type: 'FILE' },
            { name: 'file_hash', type: 'VARCHAR(64)', unique: true },
            { name: 'purpose', type: 'ENUM' },
            { name: 'quality_score', type: 'FLOAT' },
            { name: 'face_detected', type: 'BOOLEAN' }
        ]
    },
    face_embedding: {
        name: 'Face Embedding',
        color: '#ec4899',
        x: 700, y: 320,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'user_id', type: 'UUID', fk: 'user' },
            { name: 'face_image_id', type: 'UUID', fk: 'face_image' },
            { name: 'model_version_id', type: 'UUID', fk: 'model_version' },
            { name: 'embedding_vector', type: 'BINARY' },
            { name: 'embedding_size', type: 'INT' }
        ]
    },
    model_version: {
        name: 'Model Version',
        color: '#06b6d4',
        x: 400, y: 580,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'version_tag', type: 'VARCHAR(50)', unique: true },
            { name: 'model_type', type: 'ENUM' },
            { name: 'accuracy', type: 'FLOAT' },
            { name: 'is_active', type: 'BOOLEAN' }
        ]
    },
    training_job: {
        name: 'Training Job',
        color: '#06b6d4',
        x: 700, y: 580,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'model_version_id', type: 'UUID', fk: 'model_version' },
            { name: 'status', type: 'ENUM' },
            { name: 'epochs', type: 'INT' },
            { name: 'final_accuracy', type: 'FLOAT' }
        ]
    },
    attendance_record: {
        name: 'Attendance Record',
        color: '#ef4444',
        x: 1000, y: 50,
        fields: [
            { name: 'id', type: 'UUID', pk: true },
            { name: 'user_id', type: 'UUID', fk: 'user' },
            { name: 'face_image_id', type: 'UUID', fk: 'face_image' },
            { name: 'check_in_time', type: 'DATETIME' },
            { name: 'check_out_time', type: 'DATETIME' },
            { name: 'face_match_score', type: 'FLOAT' },
            { name: 'status', type: 'ENUM' }
        ]
    }
};

// Define relationships
const RELATIONSHIPS = [
    { from: 'saas_employee', fromField: 'organization_id', to: 'organization', toField: 'id' },
    { from: 'saas_attendance', fromField: 'organization_id', to: 'organization', toField: 'id' },
    { from: 'saas_attendance', fromField: 'employee_id', to: 'saas_employee', toField: 'id' },
    { from: 'user', fromField: 'department_id', to: 'department', toField: 'id' },
    { from: 'department', fromField: 'parent_id', to: 'department', toField: 'id' },
    { from: 'face_image', fromField: 'user_id', to: 'user', toField: 'id' },
    { from: 'face_embedding', fromField: 'user_id', to: 'user', toField: 'id' },
    { from: 'face_embedding', fromField: 'face_image_id', to: 'face_image', toField: 'id' },
    { from: 'face_embedding', fromField: 'model_version_id', to: 'model_version', toField: 'id' },
    { from: 'training_job', fromField: 'model_version_id', to: 'model_version', toField: 'id' },
    { from: 'attendance_record', fromField: 'user_id', to: 'user', toField: 'id' },
    { from: 'attendance_record', fromField: 'face_image_id', to: 'face_image', toField: 'id' },
];

const InteractiveERD = () => {
    const containerRef = useRef(null);
    const [tables, setTables] = useState(TABLES);
    const [dragging, setDragging] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [selectedTable, setSelectedTable] = useState(null);
    const [hoveredRelation, setHoveredRelation] = useState(null);
    const [zoom, setZoom] = useState(0.85);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // Handle drag start
    const handleMouseDown = (e, tableId) => {
        if (e.button !== 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setDragging(tableId);
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setSelectedTable(tableId);
        e.preventDefault();
    };

    // Handle drag move
    const handleMouseMove = useCallback((e) => {
        if (!dragging || !containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newX = (e.clientX - containerRect.left - pan.x) / zoom - dragOffset.x;
        const newY = (e.clientY - containerRect.top - pan.y) / zoom - dragOffset.y;

        setTables(prev => ({
            ...prev,
            [dragging]: { ...prev[dragging], x: Math.max(0, newX), y: Math.max(0, newY) }
        }));
    }, [dragging, dragOffset, zoom, pan]);

    // Handle drag end
    const handleMouseUp = useCallback(() => {
        setDragging(null);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // Calculate connection line path
    const getConnectionPath = (rel) => {
        const fromTable = tables[rel.from];
        const toTable = tables[rel.to];
        if (!fromTable || !toTable) return null;

        const tableWidth = 240;
        const tableHeaderHeight = 36;
        const fieldHeight = 28;

        const fromFieldIndex = fromTable.fields.findIndex(f => f.name === rel.fromField);
        const toFieldIndex = toTable.fields.findIndex(f => f.name === rel.toField);

        const fromX = fromTable.x;
        const fromY = fromTable.y + tableHeaderHeight + (fromFieldIndex + 0.5) * fieldHeight;
        const toX = toTable.x + tableWidth;
        const toY = toTable.y + tableHeaderHeight + (toFieldIndex + 0.5) * fieldHeight;

        // Determine connection side
        const midX = (fromX + toX + tableWidth) / 2;

        // Create curved path
        const startX = fromX < toX ? fromX + tableWidth : fromX;
        const endX = fromX < toX ? toX : toX + tableWidth;

        const controlOffset = Math.abs(endX - startX) * 0.4;

        return {
            path: `M ${startX} ${fromY} 
                   C ${startX + controlOffset} ${fromY}, 
                     ${endX - controlOffset} ${toY}, 
                     ${endX} ${toY}`,
            startX, startY: fromY,
            endX, endY: toY
        };
    };

    // Render table node
    const renderTable = (id, table) => {
        const isSelected = selectedTable === id;
        const relatedRelations = RELATIONSHIPS.filter(r => r.from === id || r.to === id);
        const isInHoveredRelation = hoveredRelation &&
            (hoveredRelation.from === id || hoveredRelation.to === id);

        return (
            <div
                key={id}
                style={{
                    position: 'absolute',
                    left: table.x,
                    top: table.y,
                    width: 240,
                    background: 'rgba(30, 30, 40, 0.95)',
                    borderRadius: '8px',
                    border: `2px solid ${isSelected || isInHoveredRelation ? table.color : 'rgba(255,255,255,0.15)'}`,
                    boxShadow: isSelected
                        ? `0 0 30px ${table.color}50`
                        : '0 4px 20px rgba(0,0,0,0.4)',
                    cursor: dragging === id ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    transition: dragging === id ? 'none' : 'border-color 0.2s, box-shadow 0.2s',
                    zIndex: isSelected ? 100 : 1
                }}
                onMouseDown={(e) => handleMouseDown(e, id)}
            >
                {/* Header */}
                <div style={{
                    background: table.color,
                    padding: '8px 12px',
                    borderRadius: '6px 6px 0 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span style={{ fontWeight: '700', color: 'white', fontSize: '0.85rem' }}>
                        {table.name}
                    </span>
                    <span style={{
                        fontSize: '0.65rem',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: 'rgba(255,255,255,0.8)'
                    }}>
                        {table.fields.length} fields
                    </span>
                </div>

                {/* Fields */}
                <div style={{ padding: '4px 0' }}>
                    {table.fields.map((field, i) => (
                        <div
                            key={field.name}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                borderBottom: i < table.fields.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                background: field.fk ? 'rgba(255,255,255,0.03)' : 'transparent'
                            }}
                        >
                            {/* Icon */}
                            <span style={{
                                width: '16px',
                                marginRight: '6px',
                                fontSize: '0.7rem',
                                color: field.pk ? '#fbbf24' : field.fk ? '#60a5fa' : '#6b7280'
                            }}>
                                {field.pk ? '🔑' : field.fk ? '🔗' : field.unique ? '✦' : '○'}
                            </span>

                            {/* Name */}
                            <span style={{
                                flex: 1,
                                color: field.fk ? '#60a5fa' : 'rgba(255,255,255,0.9)',
                                fontFamily: 'monospace'
                            }}>
                                {field.name}
                            </span>

                            {/* Type */}
                            <span style={{
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '0.65rem',
                                fontFamily: 'monospace'
                            }}>
                                {field.type}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Header */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '16px 24px',
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.3rem',
                        fontWeight: '700',
                        background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        🗄️ Database Schema - Interactive ERD
                    </h1>
                    <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                        Drag tables to rearrange • Click to select • {Object.keys(TABLES).length} tables • {RELATIONSHIPS.length} relationships
                    </p>
                </div>

                {/* Zoom Controls */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '6px',
                            width: '32px',
                            height: '32px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1.1rem'
                        }}
                    >−</button>
                    <span style={{ color: 'white', fontSize: '0.8rem', width: '50px', textAlign: 'center' }}>
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '6px',
                            width: '32px',
                            height: '32px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '1.1rem'
                        }}
                    >+</button>
                    <button
                        onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }); }}
                        style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            marginLeft: '8px'
                        }}
                    >Reset</button>
                </div>
            </div>

            {/* Grid Background */}
            <svg
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
                <defs>
                    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Canvas */}
            <div
                ref={containerRef}
                style={{
                    position: 'absolute',
                    top: 80,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'auto'
                }}
            >
                <div style={{
                    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                    transformOrigin: 'top left',
                    position: 'relative',
                    width: '2000px',
                    height: '1500px',
                    padding: '20px'
                }}>
                    {/* Connection Lines */}
                    <svg
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            overflow: 'visible'
                        }}
                    >
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.4)" />
                            </marker>
                            <marker
                                id="arrowhead-active"
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" />
                            </marker>
                        </defs>

                        {RELATIONSHIPS.map((rel, i) => {
                            const pathData = getConnectionPath(rel);
                            if (!pathData) return null;

                            const isActive = selectedTable && (rel.from === selectedTable || rel.to === selectedTable);
                            const isHovered = hoveredRelation === rel;

                            return (
                                <g key={i}>
                                    <path
                                        d={pathData.path}
                                        fill="none"
                                        stroke={isActive || isHovered ? '#60a5fa' : 'rgba(255,255,255,0.25)'}
                                        strokeWidth={isActive || isHovered ? 2.5 : 1.5}
                                        strokeDasharray={isActive ? 'none' : '5,5'}
                                        markerEnd={isActive || isHovered ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                                        style={{
                                            transition: 'stroke 0.2s, stroke-width 0.2s',
                                            pointerEvents: 'stroke',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={() => setHoveredRelation(rel)}
                                        onMouseLeave={() => setHoveredRelation(null)}
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Table Nodes */}
                    {Object.entries(tables).map(([id, table]) => renderTable(id, table))}
                </div>
            </div>

            {/* Legend */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(10px)',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>LEGEND</div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'white' }}>
                        <span>🔑</span> Primary Key
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa' }}>
                        <span>🔗</span> Foreign Key
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.6)' }}>
                        <span>✦</span> Unique
                    </span>
                </div>
            </div>

            {/* Selected Table Info */}
            {selectedTable && (
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(10px)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: `2px solid ${tables[selectedTable].color}`,
                    maxWidth: '300px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            background: tables[selectedTable].color
                        }}></div>
                        <span style={{ color: 'white', fontWeight: '700' }}>{tables[selectedTable].name}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                        <strong>Relationships:</strong>
                        {RELATIONSHIPS.filter(r => r.from === selectedTable || r.to === selectedTable)
                            .map((r, i) => (
                                <div key={i} style={{ marginTop: '4px', paddingLeft: '8px' }}>
                                    {r.from === selectedTable
                                        ? `→ ${tables[r.to]?.name} (${r.fromField})`
                                        : `← ${tables[r.from]?.name} (${r.toField})`
                                    }
                                </div>
                            ))
                        }
                    </div>
                    <button
                        onClick={() => setSelectedTable(null)}
                        style={{
                            marginTop: '12px',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                        }}
                    >Close</button>
                </div>
            )}
        </div>
    );
};

export default InteractiveERD;
