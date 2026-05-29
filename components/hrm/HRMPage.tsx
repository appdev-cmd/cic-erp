// ============================================================
// HRM Hub Page — Landing page for HRM module
// Grid links to Leave, Recruitment, Requests
// ============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canViewEmployees } from '../../lib/permissions';
import {
  CalendarDays,
  UserSearch,
  FileEdit,
  ArrowRight,
  Users,
  Clock,
  Briefcase,
  Settings,
  Calculator,
  ShieldAlert,
  GraduationCap,
  Target,
  UserCircle,
  BarChart3
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
    id: 'personnel-records',
    title: 'Quản lý hồ sơ nhân sự',
    description: 'Quản lý thông tin chi tiết nhân viên, hợp đồng lao động, quá trình công tác và sơ đồ tổ chức.',
    icon: <Users size={28} />,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50',
    darkBgColor: 'dark:bg-orange-900/20',
    path: '/personnel',
    status: 'active',
  },
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
  {
    id: 'overtime',
    title: 'Duyệt Tăng ca',
    description: 'Quản lý phiếu đăng ký tăng ca ngày Thứ 7, Chủ Nhật và Lễ/Tết.',
    icon: <Clock size={28} />,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50',
    darkBgColor: 'dark:bg-rose-900/20',
    path: '/hrm/overtime',
    status: 'active',
  },
  {
    id: 'attendance_settings',
    title: 'Cài đặt Chấm công',
    description: 'Thiết lập giờ làm chuẩn, ngưỡng đi trễ, và hệ số tăng ca (OT).',
    icon: <Settings size={28} />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100',
    darkBgColor: 'dark:bg-slate-800',
    path: '/hrm/attendance-settings',
    status: 'active',
  },
  {
    id: 'payroll',
    title: 'Bảng lương (Payroll)',
    description: 'Tính lương tự động, phiếu lương chi tiết, quản lý kỳ lương, thuế TNCN.',
    icon: <Calculator size={28} />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50',
    darkBgColor: 'dark:bg-emerald-900/20',
    path: '/hrm/payroll',
    status: 'active',
  },
  {
    id: 'insurance',
    title: 'Báo cáo Bảo hiểm',
    description: 'Thống kê tình hình đóng BHXH, BHYT, BHTN theo tháng của công ty.',
    icon: <ShieldAlert size={28} />,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50',
    darkBgColor: 'dark:bg-cyan-900/20',
    path: '/hrm/insurance',
    status: 'active',
  },
  {
    id: 'onboarding',
    title: 'Hội nhập (Onboarding)',
    description: 'Bố trí lộ trình công việc, setup thiết bị cho nhân sự mới theo vị trí.',
    icon: <GraduationCap size={28} />,
    color: 'text-fuchsia-600 dark:text-fuchsia-400',
    bgColor: 'bg-fuchsia-50',
    darkBgColor: 'dark:bg-fuchsia-900/20',
    path: '/hrm/onboarding',
    status: 'active',
  },
  {
    id: 'performance',
    title: 'Đánh giá KPI & OKR',
    description: 'Quản lý chu kỳ đánh giá hiệu suất, phiếu chấm điểm cá nhân của manager.',
    icon: <Target size={28} />,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50',
    darkBgColor: 'dark:bg-rose-900/20',
    path: '/hrm/performance',
    status: 'active',
  },
  {
    id: 'self-service',
    title: 'Hồ sơ cá nhân',
    description: 'Cổng tra cứu phiếu lương, phép năm và thông tin cá nhân dành riêng cho user.',
    icon: <UserCircle size={28} />,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50',
    darkBgColor: 'dark:bg-violet-900/20',
    path: '/hrm/self-service',
    status: 'active',
  },
  {
    id: 'analytics',
    title: 'Phân tích nhân sự',
    description: 'Dashboard báo cáo chi phí nhân sự, tỷ lệ biến động (turnover) và tăng trưởng.',
    icon: <BarChart3 size={28} />,
    color: 'text-fuchsia-600 dark:text-fuchsia-400',
    bgColor: 'bg-fuchsia-50',
    darkBgColor: 'dark:bg-fuchsia-900/20',
    path: '/hrm/analytics',
    status: 'active',
  },
  {
    id: 'facilities',
    title: 'Cơ sở vật chất',
    description: 'Danh mục tài sản, cấu hình phòng họp, xe công tác và trang thiết bị (Admin).',
    icon: <Settings size={28} />,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100',
    darkBgColor: 'dark:bg-slate-800',
    path: '/hrm/facilities',
    status: 'active',
  },
];

const HRMPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile: currentEmployee } = useAuth();

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
        {modules.map(mod => {
          // Hide personnel-records card if the user doesn't have permission to view employees
          if (mod.id === 'personnel-records') {
            const hasAccess = currentEmployee?.role && canViewEmployees(currentEmployee.role, currentEmployee.unitCode);
            if (!hasAccess) return null;
          }

          // Hide facilities card if not Admin/AdminUnit
          if (mod.id === 'facilities' && currentEmployee?.role !== 'Admin' && currentEmployee?.role !== 'AdminUnit') {
            return null;
          }
          return (
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
          );
        })}
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
