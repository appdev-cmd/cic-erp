// ============================================================
// HRM Hub Page — Landing page for HRM module
// Grid links to Leave, Recruitment, Requests
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  UserSearch,
  FileEdit,
  ArrowRight,
  Users,
  Clock,
  Briefcase,
} from 'lucide-react';

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  darkBgColor: string;
  path: string;
  status: 'active' | 'coming_soon';
  stats?: string;
}

const modules: ModuleCard[] = [
  {
    id: 'leave',
    title: 'Quản lý Nghỉ phép',
    description: 'Tạo đơn nghỉ, duyệt phép, theo dõi số phép còn lại, lịch nghỉ team.',
    icon: <CalendarDays size={28} />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
    path: '/hrm/leave',
    status: 'active',
  },
  {
    id: 'recruitment',
    title: 'Quản lý Tuyển dụng',
    description: 'Tạo YCTD, pipeline ứng viên, Kanban tracking, ngân hàng CV.',
    icon: <UserSearch size={28} />,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50',
    darkBgColor: 'dark:bg-indigo-900/20',
    path: '/hrm/recruitment',
    status: 'active',
  },
  {
    id: 'requests',
    title: 'Quản lý Đề xuất',
    description: 'Đặt phòng họp, điều xe, mua sắm VPP, đề xuất khác với quy trình duyệt.',
    icon: <FileEdit size={28} />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50',
    darkBgColor: 'dark:bg-amber-900/20',
    path: '/hrm/requests',
    status: 'active',
  },
];

const HRMPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
            <Users className="text-orange-600 dark:text-orange-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Nhân sự HR
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Quản lý nhân sự tổng hợp — Nghỉ phép, Tuyển dụng, Đề xuất nội bộ
            </p>
          </div>
        </div>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map(mod => (
          <button
            key={mod.id}
            onClick={() => mod.status === 'active' && navigate(mod.path)}
            disabled={mod.status === 'coming_soon'}
            className={`
              group relative text-left p-6 rounded-2xl border transition-all duration-200
              ${mod.status === 'active'
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg dark:hover:shadow-slate-900/50 cursor-pointer'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
              }
            `}
          >
            {/* Coming Soon Badge */}
            {mod.status === 'coming_soon' && (
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                Sắp ra mắt
              </span>
            )}

            {/* Icon */}
            <div className={`w-12 h-12 ${mod.bgColor} ${mod.darkBgColor} rounded-xl flex items-center justify-center mb-4`}>
              <span className={mod.color}>{mod.icon}</span>
            </div>

            {/* Content */}
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              {mod.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {mod.description}
            </p>

            {/* Footer */}
            {mod.status === 'active' && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 group-hover:gap-2.5 transition-all">
                Truy cập <ArrowRight size={14} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickStat
          icon={<Clock size={18} />}
          label="Đơn chờ duyệt"
          value="—"
          color="text-amber-600 dark:text-amber-400"
          bgColor="bg-amber-50 dark:bg-amber-900/20"
        />
        <QuickStat
          icon={<CalendarDays size={18} />}
          label="Nghỉ hôm nay"
          value="—"
          color="text-blue-600 dark:text-blue-400"
          bgColor="bg-blue-50 dark:bg-blue-900/20"
        />
        <QuickStat
          icon={<Briefcase size={18} />}
          label="Vị trí đang tuyển"
          value="—"
          color="text-indigo-600 dark:text-indigo-400"
          bgColor="bg-indigo-50 dark:bg-indigo-900/20"
        />
      </div>
    </div>
  );
};

interface QuickStatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}

const QuickStat: React.FC<QuickStatProps> = ({ icon, label, value, color, bgColor }) => (
  <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
    <div className={`p-2 ${bgColor} rounded-lg`}>
      <span className={color}>{icon}</span>
    </div>
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  </div>
);

export default HRMPage;
