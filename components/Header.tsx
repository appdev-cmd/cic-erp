
import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, LogOut, ChevronDown, User as UserIcon, Building2, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Unit } from '../types';

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarCollapsed: boolean;
  selectedUnit?: Unit;
  onSelectUnit?: (unit: Unit) => void;
  yearFilter?: string;
  onYearChange?: (year: string) => void;
  allUnits?: Unit[];
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, isSidebarCollapsed, selectedUnit, onSelectUnit, yearFilter, onYearChange, allUnits = [] }) => {
  const marginClass = isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64';
  const { signOut, user, profile } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setShowUserMenu(false);
  };

  // Use profile data (linked to employee) first, fallback to Google metadata
  const displayName = profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url || profile?.avatarUrl;
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  // Map role codes to Vietnamese labels
  const roleLabels: Record<string, string> = {
    'Leadership': 'Ban Giám đốc',
    'Admin': 'Quản trị viên',
    'UnitLeader': 'Trưởng phòng',
    'NVKD': 'Nhân viên KD',
    'AdminUnit': 'Admin Đơn vị',
    'Accountant': 'Kế toán',
    'ChiefAccountant': 'Kế toán trưởng',
    'Legal': 'Pháp chế',
  };
  const displayRole = profile?.role ? (roleLabels[profile.role] || profile.role) : '';

  return (
    <header className={`fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-slate-900 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 ${marginClass} z-30 flex items-center justify-between px-4 transition-all duration-300`}>
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>

        {/* Search Trigger - Opens CommandPalette */}
        <button
          onClick={() => {
            // Trigger CommandPalette
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
          }}
          className="flex items-center bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg w-full max-w-[120px] sm:max-w-xs md:max-w-3xl border border-transparent hover:border-orange-300 dark:hover:border-orange-700 transition-all cursor-pointer group"
        >
          <Search size={18} className="text-slate-400 mr-2 flex-shrink-0 group-hover:text-orange-500 transition-colors" />
          <span className="text-sm text-slate-400 text-left flex-1 truncate">Tìm kiếm...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-slate-700 text-[10px] font-bold text-slate-400 rounded border border-slate-200 dark:border-slate-600 ml-2">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 ml-2">
        {/* Filter Buttons (visible on lg+) */}
        {selectedUnit && onSelectUnit && (
          <>
            {/* Unit Filter */}
            <div className="hidden lg:block relative">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent hover:border-orange-300 dark:hover:border-orange-700/50 rounded-lg transition-all group cursor-pointer relative">
                <Building2 size={15} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                  {selectedUnit.name}
                </span>
                <ChevronDown size={13} className="text-slate-400" />
                <select
                  value={selectedUnit.id}
                  onChange={(e) => {
                    const sel = e.target.value === 'all'
                      ? { id: 'all', name: 'Toàn công ty', type: 'Company' } as Unit
                      : allUnits.find(u => u.id === e.target.value);
                    if (sel) onSelectUnit(sel);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  <option value="all">Toàn công ty</option>
                  {allUnits.filter(u => u.name !== 'Toàn công ty' && (u.type === 'Center' || u.type === 'Branch')).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Year Filter */}
            {yearFilter && onYearChange && (
              <div className="hidden lg:block relative">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent hover:border-orange-300 dark:hover:border-orange-700/50 rounded-lg transition-all group cursor-pointer relative">
                  <Calendar size={15} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {yearFilter === 'All' ? 'Tất cả' : yearFilter}
                  </span>
                  <ChevronDown size={13} className="text-slate-400" />
                  <select
                    value={yearFilter}
                    onChange={(e) => onYearChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                    <option value="All">Tất cả năm</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}

        {/* Divider */}
        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 hidden lg:block"></div>
        <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse"></span>
        </button>
        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

        {/* User Menu with Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-200 dark:ring-orange-800"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <span className="text-white text-sm font-bold">{initials}</span>
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-bold text-slate-700 dark:text-white truncate max-w-[150px]">
                {displayName}
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-200">{displayRole}</p>
            </div>
            <ChevronDown size={16} className={`hidden sm:block text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 dark-dropdown-accent">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{initials}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>
                {displayRole && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    {displayRole}
                  </span>
                )}
              </div>
              <div className="py-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
