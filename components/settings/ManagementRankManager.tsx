import React, { useState, useEffect, useCallback } from 'react';
import { Crown, Building2, Save, Search, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { dataClient as supabase } from '../../lib/dataClient';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  position: string;
  unit_id: string;
  management_rank: number;
  managed_unit_ids: string[];
}

interface UnitOption {
  id: string;
  name: string;
  code: string;
}

const RANK_PRESETS = [
  { rank: 100, label: 'CT/TGĐ', desc: 'Xem được tất cả công việc', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  { rank: 80, label: 'Phó TGĐ', desc: 'Xem công việc thuộc đơn vị quản lý', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { rank: 50, label: 'Trưởng ĐV', desc: 'Xem công việc trong đơn vị', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { rank: 0, label: 'Nhân viên', desc: 'Chỉ xem công việc liên quan', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
];

// ═══════════════════════════════════════
// EMPLOYEE ROW
// ═══════════════════════════════════════
const EmployeeRankRow: React.FC<{
  emp: EmployeeRow;
  units: UnitOption[];
  onSave: (id: string, rank: number, unitIds: string[]) => Promise<void>;
}> = ({ emp, units, onSave }) => {
  const [rank, setRank] = useState(emp.management_rank);
  const [unitIds, setUnitIds] = useState<string[]>(emp.managed_unit_ids || []);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = rank !== emp.management_rank || JSON.stringify(unitIds) !== JSON.stringify(emp.managed_unit_ids || []);
  const preset = RANK_PRESETS.find(p => p.rank === rank) || RANK_PRESETS[3];
  const showUnitSelect = rank >= 50 && rank < 100;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(emp.id, rank, unitIds);
    } finally {
      setSaving(false);
    }
  };

  const toggleUnit = (uid: string) => {
    setUnitIds(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
  };

  return (
    <div className={`rounded-xl border transition-all ${isDirty ? 'border-indigo-300 dark:border-indigo-600 shadow-sm' : 'border-slate-200 dark:border-slate-700'}`}>
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {emp.name.charAt(0)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{emp.name}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500">{emp.position || '—'} · {units.find(u => u.id === emp.unit_id)?.name || '—'}</div>
        </div>

        {/* Rank badge */}
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${preset.bg} ${preset.color}`}>
          {preset.label} ({rank})
        </span>

        {isDirty && (
          <button
            onClick={e => { e.stopPropagation(); handleSave(); }}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save size={12} /> Lưu
          </button>
        )}

        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-700/50 pt-4">
          {/* Rank selector */}
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Cấp quản lý</label>
            <div className="grid grid-cols-4 gap-2">
              {RANK_PRESETS.map(p => (
                <button
                  key={p.rank}
                  onClick={() => setRank(p.rank)}
                  className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    rank === p.rank
                      ? 'border-indigo-500 dark:border-indigo-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`text-sm font-black ${p.color}`}>{p.label}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">rank {p.rank}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">Hoặc nhập tùy chỉnh:</span>
              <input
                type="number"
                min={0}
                max={200}
                value={rank}
                onChange={e => setRank(parseInt(e.target.value) || 0)}
                className="w-16 text-xs text-center px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              />
            </div>
          </div>

          {/* Unit select (only for rank 50-99) */}
          {showUnitSelect && (
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                Đơn vị quản lý
                {rank >= 80 && <span className="text-orange-500 ml-1">(Phó TGĐ: chọn đơn vị phụ trách)</span>}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {units.map(unit => (
                  <button
                    key={unit.id}
                    onClick={() => toggleUnit(unit.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all cursor-pointer ${
                      unitIds.includes(unit.id)
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 dark:border-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Building2 size={14} />
                    <span className="font-semibold truncate">{unit.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className={`text-xs p-3 rounded-lg ${preset.bg} ${preset.color} flex items-start gap-2`}>
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            {preset.desc}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
const ManagementRankManager: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [empResult, unitResult] = await Promise.all([
        supabase.from('employees').select('id, name, email, position, unit_id, management_rank, managed_unit_ids').order('name'),
        supabase.from('units').select('id, name, code').order('name'),
      ]);

      if (empResult.error) throw empResult.error;
      if (unitResult.error) throw unitResult.error;

      setEmployees((empResult.data || []).map(e => ({
        ...e,
        management_rank: e.management_rank || 0,
        managed_unit_ids: e.managed_unit_ids || [],
      })));
      setUnits(unitResult.data || []);
    } catch (err: any) {
      toast.error('Lỗi tải dữ liệu: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (id: string, rank: number, unitIds: string[]) => {
    try {
      const { error } = await supabase.from('employees').update({
        management_rank: rank,
        managed_unit_ids: unitIds,
      }).eq('id', id);

      if (error) throw error;
      toast.success('Đã cập nhật cấp quản lý');

      // Update local state
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, management_rank: rank, managed_unit_ids: unitIds } : e));
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const filtered = employees.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort by rank desc → name asc
  const sorted = [...filtered].sort((a, b) => b.management_rank - a.management_rank || a.name.localeCompare(b.name));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {RANK_PRESETS.map(p => (
          <span key={p.rank} className={`text-xs font-bold px-2.5 py-1 rounded-lg ${p.bg} ${p.color}`}>
            {p.label} = rank {p.rank}
          </span>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm nhân viên..."
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Employee list */}
      <div className="space-y-2">
        {sorted.map(emp => (
          <EmployeeRankRow key={emp.id} emp={emp} units={units} onSave={handleSave} />
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">Không tìm thấy nhân viên</div>
        )}
      </div>
    </div>
  );
};

export default ManagementRankManager;
