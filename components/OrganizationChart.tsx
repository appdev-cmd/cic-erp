import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Building2, Users, ChevronDown, ChevronUp, Crown, Edit2, Plus, Minus, Maximize2, GripVertical } from 'lucide-react';
import { Unit, Employee } from '../types';
import { UnitService, EmployeeService } from '../services';
import { toast } from 'sonner';

interface OrgNode extends Unit {
    children: OrgNode[];
    manager?: Employee;
    employeeCount?: number;
}

interface OrganizationChartProps {
    onSelectUnit?: (unit: Unit) => void;
    onEditUnit?: (unit: Unit) => void;
    onAddChild?: (parentId: string) => void;
}

// ─── Drag State ──────────────────────────────────────────────
interface DragState {
    draggingId: string | null;
    overId: string | null;
}

// ─── Node Card Component ─────────────────────────────────────
const OrgNodeCard: React.FC<{
    node: OrgNode;
    isCollapsed: boolean;
    isDragging: boolean;
    isDragOver: boolean;
    onToggleCollapse: (id: string) => void;
    onSelectUnit?: (unit: Unit) => void;
    onEditUnit?: (unit: Unit) => void;
    onAddChild?: (parentId: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onDragOver: (id: string) => void;
    onDragLeave: () => void;
    onDrop: (targetId: string) => void;
}> = ({
    node, isCollapsed, isDragging, isDragOver,
    onToggleCollapse, onSelectUnit, onEditUnit, onAddChild,
    onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop
}) => {
    const hasChildren = node.children.length > 0;

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Company': return 'from-amber-500 to-orange-600';
            case 'Branch': return 'from-blue-500 to-indigo-600';
            case 'BackOffice': return 'from-slate-500 to-slate-600';
            default: return 'from-emerald-500 to-teal-600';
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'Company': return { text: 'CTY', bg: 'bg-amber-200/80 text-amber-900' };
            case 'Branch': return { text: 'CN', bg: 'bg-blue-200/80 text-blue-900' };
            case 'BackOffice': return { text: 'PB', bg: 'bg-slate-200/80 text-slate-900' };
            default: return { text: 'TT', bg: 'bg-emerald-200/80 text-emerald-900' };
        }
    };

    const colorClass = getTypeColor(node.type);
    const badge = getTypeBadge(node.type);

    return (
        <div
            className={`
                relative bg-gradient-to-br ${colorClass} text-white rounded-xl
                min-w-[170px] max-w-[210px] cursor-pointer group
                transition-all duration-200 select-none
                ${isDragging ? 'opacity-40 scale-95 ring-2 ring-white/50' : 'hover:scale-[1.03] hover:shadow-xl'}
                ${isDragOver ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-slate-900 scale-105 shadow-2xl shadow-yellow-400/20' : 'shadow-lg'}
            `}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', node.id);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(node.id);
            }}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                onDragOver(node.id);
            }}
            onDragLeave={onDragLeave}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop(node.id);
            }}
            onClick={() => onSelectUnit?.(node)}
        >
            {/* Drag handle */}
            <div className="absolute top-1.5 left-1.5 p-0.5 rounded opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
                <GripVertical size={12} />
            </div>

            {/* Main content */}
            <div className="px-4 py-3 text-center">
                <div className="font-bold text-sm leading-tight mb-1.5 line-clamp-2">{node.name}</div>
                <div className="flex items-center justify-center gap-1.5 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${badge.bg}`}>
                        {badge.text}
                    </span>
                    <span className="opacity-75 text-[11px]">{node.code}</span>
                </div>
                {node.manager && (
                    <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-90 flex items-center justify-center gap-1">
                        <Crown size={11} />
                        <span className="truncate max-w-[130px]">{node.manager.name}</span>
                    </div>
                )}
                <div className="text-[10px] opacity-70 mt-1 flex items-center justify-center gap-0.5">
                    <Users size={10} />
                    {node.employeeCount || 0} NV
                </div>
            </div>

            {/* Action buttons on hover */}
            <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEditUnit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditUnit(node); }}
                        className="p-1 rounded bg-white/20 hover:bg-white/40 transition-colors"
                        title="Chỉnh sửa"
                    >
                        <Edit2 size={11} />
                    </button>
                )}
                {onAddChild && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
                        className="p-1 rounded bg-white/20 hover:bg-white/40 transition-colors"
                        title="Thêm đơn vị con"
                    >
                        <Plus size={11} />
                    </button>
                )}
            </div>

            {/* Collapse/Expand button */}
            {hasChildren && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
                    className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white dark:bg-slate-700 shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 z-10 transition-colors"
                >
                    {isCollapsed
                        ? <ChevronDown size={14} />
                        : <ChevronUp size={14} />
                    }
                    {isCollapsed && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[8px] font-bold flex items-center justify-center">
                            {node.children.length}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
};

// ─── Recursive Tree Renderer ─────────────────────────────────
const TreeBranch: React.FC<{
    nodes: OrgNode[];
    collapsedNodes: Set<string>;
    dragState: DragState;
    onToggleCollapse: (id: string) => void;
    onSelectUnit?: (unit: Unit) => void;
    onEditUnit?: (unit: Unit) => void;
    onAddChild?: (parentId: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onDragOver: (id: string) => void;
    onDragLeave: () => void;
    onDrop: (targetId: string) => void;
    isRoot?: boolean;
}> = ({
    nodes, collapsedNodes, dragState,
    onToggleCollapse, onSelectUnit, onEditUnit, onAddChild,
    onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
    isRoot = false
}) => {
    if (nodes.length === 0) return null;

    return (
        <div className={`flex ${isRoot ? 'flex-col items-center gap-0' : 'gap-6'}`}>
            {nodes.map((node, index) => {
                const hasChildren = node.children.length > 0;
                const isCollapsed = collapsedNodes.has(node.id);
                const showChildren = hasChildren && !isCollapsed;
                const isDragging = dragState.draggingId === node.id;
                const isDragOver = dragState.overId === node.id && dragState.draggingId !== node.id;

                return (
                    <div key={node.id} className="flex flex-col items-center">
                        {/* Vertical connector from horizontal line (for non-first-level nodes in a group) */}
                        {!isRoot && nodes.length > 0 && (
                            <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />
                        )}

                        {/* The node card */}
                        <OrgNodeCard
                            node={node}
                            isCollapsed={isCollapsed}
                            isDragging={isDragging}
                            isDragOver={isDragOver}
                            onToggleCollapse={onToggleCollapse}
                            onSelectUnit={onSelectUnit}
                            onEditUnit={onEditUnit}
                            onAddChild={onAddChild}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                        />

                        {/* Children section */}
                        {showChildren && (
                            <div className="flex flex-col items-center mt-4">
                                {/* Vertical line down from parent */}
                                <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600" />

                                {/* Horizontal connector + children */}
                                {node.children.length === 1 ? (
                                    // Single child — straight line
                                    <TreeBranch
                                        nodes={node.children}
                                        collapsedNodes={collapsedNodes}
                                        dragState={dragState}
                                        onToggleCollapse={onToggleCollapse}
                                        onSelectUnit={onSelectUnit}
                                        onEditUnit={onEditUnit}
                                        onAddChild={onAddChild}
                                        onDragStart={onDragStart}
                                        onDragEnd={onDragEnd}
                                        onDragOver={onDragOver}
                                        onDragLeave={onDragLeave}
                                        onDrop={onDrop}
                                    />
                                ) : (
                                    // Multiple children — horizontal connector
                                    <div className="relative">
                                        {/* Horizontal line spanning from first to last child center */}
                                        <div className="flex gap-6">
                                            {node.children.map((child, ci) => {
                                                const childHasChildren = child.children.length > 0;
                                                const childIsCollapsed = collapsedNodes.has(child.id);
                                                const childShowChildren = childHasChildren && !childIsCollapsed;

                                                return (
                                                    <div key={child.id} className="flex flex-col items-center relative">
                                                        {/* Vertical connector down from horizontal line */}
                                                        <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />

                                                        {/* Horizontal line segment */}
                                                        {ci === 0 && (
                                                            <div
                                                                className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600"
                                                                style={{
                                                                    left: '50%',
                                                                    right: '-12px',
                                                                }}
                                                            />
                                                        )}
                                                        {ci === node.children.length - 1 && (
                                                            <div
                                                                className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600"
                                                                style={{
                                                                    right: '50%',
                                                                    left: '-12px',
                                                                }}
                                                            />
                                                        )}
                                                        {ci > 0 && ci < node.children.length - 1 && (
                                                            <div
                                                                className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600"
                                                                style={{
                                                                    left: '-12px',
                                                                    right: '-12px',
                                                                }}
                                                            />
                                                        )}

                                                        {/* Child node card */}
                                                        <OrgNodeCard
                                                            node={child}
                                                            isCollapsed={childIsCollapsed}
                                                            isDragging={dragState.draggingId === child.id}
                                                            isDragOver={dragState.overId === child.id && dragState.draggingId !== child.id}
                                                            onToggleCollapse={onToggleCollapse}
                                                            onSelectUnit={onSelectUnit}
                                                            onEditUnit={onEditUnit}
                                                            onAddChild={onAddChild}
                                                            onDragStart={onDragStart}
                                                            onDragEnd={onDragEnd}
                                                            onDragOver={onDragOver}
                                                            onDragLeave={onDragLeave}
                                                            onDrop={onDrop}
                                                        />

                                                        {/* Recursive children */}
                                                        {childShowChildren && (
                                                            <div className="flex flex-col items-center mt-4">
                                                                <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600" />
                                                                {child.children.length === 1 ? (
                                                                    <TreeBranch
                                                                        nodes={child.children}
                                                                        collapsedNodes={collapsedNodes}
                                                                        dragState={dragState}
                                                                        onToggleCollapse={onToggleCollapse}
                                                                        onSelectUnit={onSelectUnit}
                                                                        onEditUnit={onEditUnit}
                                                                        onAddChild={onAddChild}
                                                                        onDragStart={onDragStart}
                                                                        onDragEnd={onDragEnd}
                                                                        onDragOver={onDragOver}
                                                                        onDragLeave={onDragLeave}
                                                                        onDrop={onDrop}
                                                                    />
                                                                ) : (
                                                                    <div className="relative">
                                                                        <div className="flex gap-6">
                                                                            {child.children.map((gc, gci) => (
                                                                                <div key={gc.id} className="flex flex-col items-center relative">
                                                                                    <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />
                                                                                    {gci === 0 && (
                                                                                        <div className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600" style={{ left: '50%', right: '-12px' }} />
                                                                                    )}
                                                                                    {gci === child.children.length - 1 && (
                                                                                        <div className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600" style={{ right: '50%', left: '-12px' }} />
                                                                                    )}
                                                                                    {gci > 0 && gci < child.children.length - 1 && (
                                                                                        <div className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600" style={{ left: '-12px', right: '-12px' }} />
                                                                                    )}

                                                                                    {/* Recursively render grandchild and deeper */}
                                                                                    <RecursiveNode
                                                                                        node={gc}
                                                                                        collapsedNodes={collapsedNodes}
                                                                                        dragState={dragState}
                                                                                        onToggleCollapse={onToggleCollapse}
                                                                                        onSelectUnit={onSelectUnit}
                                                                                        onEditUnit={onEditUnit}
                                                                                        onAddChild={onAddChild}
                                                                                        onDragStart={onDragStart}
                                                                                        onDragEnd={onDragEnd}
                                                                                        onDragOver={onDragOver}
                                                                                        onDragLeave={onDragLeave}
                                                                                        onDrop={onDrop}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Helper: render a single row of children with horizontal connector ──
const ChildrenRow: React.FC<{
    children: OrgNode[];
    parentProps: RecursiveNodeProps;
}> = ({ children: nodes, parentProps }) => {
    if (nodes.length === 1) {
        return (
            <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />
                <RecursiveNode {...parentProps} node={nodes[0]} />
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="flex gap-5">
                {nodes.map((child, ci) => (
                    <div key={child.id} className="flex flex-col items-center relative">
                        <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />
                        {ci === 0 && (
                            <div className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600" style={{ left: '50%', right: '-10px' }} />
                        )}
                        {ci === nodes.length - 1 && (
                            <div className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600" style={{ right: '50%', left: '-10px' }} />
                        )}
                        {ci > 0 && ci < nodes.length - 1 && (
                            <div className="absolute top-0 h-0.5 bg-slate-300 dark:bg-slate-600" style={{ left: '-10px', right: '-10px' }} />
                        )}
                        <RecursiveNode {...parentProps} node={child} />
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Shared props interface for RecursiveNode ────────────────
interface RecursiveNodeProps {
    node: OrgNode;
    collapsedNodes: Set<string>;
    dragState: DragState;
    onToggleCollapse: (id: string) => void;
    onSelectUnit?: (unit: Unit) => void;
    onEditUnit?: (unit: Unit) => void;
    onAddChild?: (parentId: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onDragOver: (id: string) => void;
    onDragLeave: () => void;
    onDrop: (targetId: string) => void;
}

// ─── Fully Recursive Single Node (for deep nesting) ─────────
const MAX_PER_ROW = 5;

const RecursiveNode: React.FC<RecursiveNodeProps> = (props) => {
    const { node, collapsedNodes, dragState } = props;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);
    const showChildren = hasChildren && !isCollapsed;

    // Split children into rows of MAX_PER_ROW
    const childRows = useMemo(() => {
        if (node.children.length <= MAX_PER_ROW) return [node.children];
        const rows: OrgNode[][] = [];
        for (let i = 0; i < node.children.length; i += MAX_PER_ROW) {
            rows.push(node.children.slice(i, i + MAX_PER_ROW));
        }
        return rows;
    }, [node.children]);

    return (
        <div className="flex flex-col items-center">
            <OrgNodeCard
                node={node}
                isCollapsed={isCollapsed}
                isDragging={dragState.draggingId === node.id}
                isDragOver={dragState.overId === node.id && dragState.draggingId !== node.id}
                onToggleCollapse={props.onToggleCollapse}
                onSelectUnit={props.onSelectUnit}
                onEditUnit={props.onEditUnit}
                onAddChild={props.onAddChild}
                onDragStart={props.onDragStart}
                onDragEnd={props.onDragEnd}
                onDragOver={props.onDragOver}
                onDragLeave={props.onDragLeave}
                onDrop={props.onDrop}
            />

            {showChildren && (
                <div className="flex flex-col items-center mt-4">
                    {/* Vertical line from parent */}
                    <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600" />

                    {childRows.length === 1 ? (
                        /* Single row — use standard horizontal connector */
                        <ChildrenRow children={childRows[0]} parentProps={props} />
                    ) : (
                        /* Multiple rows — vertical trunk with horizontal branches */
                        <div className="flex flex-col items-center gap-0">
                            {childRows.map((row, ri) => (
                                <div key={ri} className="flex flex-col items-center">
                                    {ri > 0 && (
                                        <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600" />
                                    )}
                                    <ChildrenRow children={row} parentProps={props} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


// ─── Main OrganizationChart Component ────────────────────────
const OrganizationChart: React.FC<OrganizationChartProps> = ({ onSelectUnit, onEditUnit, onAddChild }) => {
    const [units, setUnits] = useState<Unit[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(100);
    const [dragState, setDragState] = useState<DragState>({ draggingId: null, overId: null });
    const canvasRef = useRef<HTMLDivElement>(null);

    // ─── Pan state ───
    const [isPanning, setIsPanning] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [unitsData, employeesData] = await Promise.all([
                UnitService.getAll(),
                EmployeeService.list({ page: 1, pageSize: 200 })
            ]);
            setUnits(unitsData);
            const empList = Array.isArray(employeesData) ? employeesData : (employeesData as any).data || [];
            setEmployees(empList);
        } catch (error) {
            console.error('Error fetching org data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Build tree structure from flat units list
    const orgTree = useMemo(() => {
        const unitMap = new Map<string, OrgNode>();

        // First pass: create nodes with enriched data
        units.forEach(unit => {
            const manager = employees.find(e => e.id === unit.managerId);
            const employeeCount = employees.filter(e => e.unitId === unit.id).length;

            unitMap.set(unit.id, {
                ...unit,
                children: [],
                manager,
                employeeCount
            });
        });

        // Second pass: build parent-child relationships
        const rootNodes: OrgNode[] = [];
        units.forEach(unit => {
            const node = unitMap.get(unit.id)!;
            if (unit.parentId && unit.parentId !== 'all' && unitMap.has(unit.parentId)) {
                unitMap.get(unit.parentId)!.children.push(node);
            } else {
                rootNodes.push(node);
            }
        });

        // Sort children by sortOrder
        const sortChildren = (nodes: OrgNode[]) => {
            nodes.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            nodes.forEach(node => sortChildren(node.children));
        };
        sortChildren(rootNodes);

        return rootNodes;
    }, [units, employees]);

    // ─── Collapse/Expand ─────────────────
    const toggleCollapse = useCallback((id: string) => {
        setCollapsedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // ─── Drag & Drop Handlers ────────────
    const isDescendant = useCallback((parentId: string, childId: string): boolean => {
        // Check if childId is a descendant of parentId in the tree
        const findNode = (nodes: OrgNode[], id: string): OrgNode | null => {
            for (const node of nodes) {
                if (node.id === id) return node;
                const found = findNode(node.children, id);
                if (found) return found;
            }
            return null;
        };

        const parent = findNode(orgTree, parentId);
        if (!parent) return false;

        const checkDescendant = (node: OrgNode): boolean => {
            if (node.id === childId) return true;
            return node.children.some(child => checkDescendant(child));
        };
        return checkDescendant(parent);
    }, [orgTree]);

    const handleDragStart = useCallback((id: string) => {
        setDragState({ draggingId: id, overId: null });
    }, []);

    const handleDragEnd = useCallback(() => {
        setDragState({ draggingId: null, overId: null });
    }, []);

    const handleDragOver = useCallback((id: string) => {
        setDragState(prev => ({ ...prev, overId: id }));
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragState(prev => ({ ...prev, overId: null }));
    }, []);

    const handleDrop = useCallback(async (targetId: string) => {
        const sourceId = dragState.draggingId;
        if (!sourceId || sourceId === targetId) {
            setDragState({ draggingId: null, overId: null });
            return;
        }

        // Prevent dropping a parent onto its own descendant (circular reference)
        if (isDescendant(sourceId, targetId)) {
            toast.error('Không thể di chuyển đơn vị vào đơn vị con của nó');
            setDragState({ draggingId: null, overId: null });
            return;
        }

        try {
            await UnitService.update(sourceId, { parentId: targetId });
            toast.success('Đã di chuyển đơn vị thành công');
            await fetchData(); // Refresh the tree
        } catch (error) {
            console.error('Error moving unit:', error);
            toast.error('Có lỗi khi di chuyển đơn vị');
        } finally {
            setDragState({ draggingId: null, overId: null });
        }
    }, [dragState.draggingId, isDescendant, fetchData]);

    // ─── Zoom Controls ───────────────────
    const handleZoomIn = () => setZoom(z => Math.min(150, z + 10));
    const handleZoomOut = () => setZoom(z => Math.max(40, z - 10));
    const handleFitScreen = () => { setZoom(80); setPanOffset({ x: 0, y: 0 }); };

    // ─── Mouse wheel zoom ────────────────
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -5 : 5;
            setZoom(z => Math.max(40, Math.min(150, z + delta)));
        }
    }, []);

    // ─── Pan handlers ────────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only pan with middle mouse or when holding space key (we track via panning)
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            e.preventDefault();
            setIsPanning(true);
            panStart.current = {
                x: e.clientX,
                y: e.clientY,
                offsetX: panOffset.x,
                offsetY: panOffset.y,
            };
        }
    }, [panOffset]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPanOffset({
            x: panStart.current.offsetX + dx,
            y: panStart.current.offsetY + dy,
        });
    }, [isPanning]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // ─── Total stats ─────────────────────
    const totalUnits = units.filter(u => u.id !== 'all').length;
    const totalEmployees = employees.length;

    // ─── Loading Skeleton ────────────────
    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 flex items-center justify-center min-h-[500px]">
                <div className="animate-pulse flex flex-col items-center gap-6">
                    <div className="w-40 h-20 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="w-0.5 h-8 bg-slate-200 dark:bg-slate-700" />
                    <div className="flex gap-6">
                        <div className="w-32 h-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
                        <div className="w-32 h-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
                        <div className="w-32 h-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    </div>
                    <p className="text-sm text-slate-400 dark:text-slate-500 font-medium mt-2">Đang tải sơ đồ tổ chức...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Sơ đồ Tổ chức</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{totalUnits} đơn vị · {totalEmployees} nhân viên</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-1">Alt+Drag để kéo canvas</span>
                    <button
                        onClick={handleZoomOut}
                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                        title="Thu nhỏ"
                    >
                        <Minus size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-10 text-center tabular-nums">{zoom}%</span>
                    <button
                        onClick={handleZoomIn}
                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                        title="Phóng to"
                    >
                        <Plus size={16} />
                    </button>
                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button
                        onClick={handleFitScreen}
                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                        title="Vừa màn hình"
                    >
                        <Maximize2 size={16} />
                    </button>
                </div>
            </div>

            {/* Chart Canvas */}
            <div
                ref={canvasRef}
                className={`overflow-auto bg-slate-50 dark:bg-slate-900 ${isPanning ? 'cursor-grabbing' : ''}`}
                style={{ maxHeight: '75vh', minHeight: '500px' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    className="inline-block min-w-full p-10"
                    style={{
                        transform: `scale(${zoom / 100}) translate(${panOffset.x / (zoom / 100)}px, ${panOffset.y / (zoom / 100)}px)`,
                        transformOrigin: 'top center',
                        transition: isPanning ? 'none' : 'transform 0.2s ease',
                    }}
                >
                    {orgTree.length === 0 ? (
                        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-bold text-lg">Chưa có dữ liệu sơ đồ tổ chức</p>
                            <p className="text-sm mt-1">Thiết lập "Đơn vị cha" (parent_id) cho các đơn vị để hiển thị cây tổ chức</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            {orgTree.map((rootNode) => (
                                <RecursiveNode
                                    key={rootNode.id}
                                    node={rootNode}
                                    collapsedNodes={collapsedNodes}
                                    dragState={dragState}
                                    onToggleCollapse={toggleCollapse}
                                    onSelectUnit={onSelectUnit}
                                    onEditUnit={onEditUnit}
                                    onAddChild={onAddChild}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                    Kéo thả node để di chuyển · Hover để chỉnh sửa/thêm nhánh · Ctrl+Scroll để zoom · Alt+Drag để pan
                </p>
            </div>
        </div>
    );
};

export default OrganizationChart;
