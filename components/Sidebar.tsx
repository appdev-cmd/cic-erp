
import React, { useMemo, useState } from 'react';
import { NAV_ITEMS } from '../constants';
import { X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import CICLogo, { CICLogoIcon } from './CICLogo';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { getHiddenNavItems } from '../lib/permissions';
import { usePermissionCheck } from '../hooks/usePermissions';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onClose: () => void;
}

interface NavItemProps {
  item: typeof NAV_ITEMS[0];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  onClose: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ item, activeTab, setActiveTab, isCollapsed, onClose }) => (
  <button
    onClick={() => {
      setActiveTab(item.id);
      if (window.innerWidth < 768) onClose();
    }}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all mb-1 ${activeTab === item.id
      ? 'bg-orange-50 dark:bg-slate-800 text-orange-700 dark:text-orange-300 shadow-sm dark:shadow-orange-500/5 border-l-[3px] border-l-orange-500 dark:border-l-orange-400'
      : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
      } ${isCollapsed ? 'md:px-0 md:justify-center' : ''}`}
    title={isCollapsed ? item.label : ''}
  >
    <span className={`transition-all ${activeTab === item.id ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'} ${isCollapsed ? 'md:scale-110' : ''}`}>
      {item.icon}
    </span>
    <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${isCollapsed ? 'md:w-0 md:opacity-0' : 'w-auto opacity-100'}`}>
      {item.label}
    </span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  isCollapsed,
  setIsCollapsed,
  onClose,
}) => {
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();
  const { permissions } = usePermissionCheck();
  
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar_category_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleCategoryExpanded = () => {
    const newValue = !isCategoryExpanded;
    setIsCategoryExpanded(newValue);
    localStorage.setItem('sidebar_category_expanded', String(newValue));
  };

  // Use impersonated role for nav filtering when impersonating
  const effectiveProfile = isImpersonating && impersonatedUser ? impersonatedUser : profile;

  // Build DB permission map for nav visibility
  const dbPermissions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        map.set(p.resource, new Set(p.actions));
      }
    }
    return map.size > 0 ? map : undefined; // undefined = DB not loaded yet
  }, [permissions]);

  const hiddenItems = effectiveProfile ? getHiddenNavItems(effectiveProfile.role, effectiveProfile.unitCode, effectiveProfile.email, dbPermissions) : new Set<string>();

  // Hide devOnly items on production (only show on localhost)
  const isDevLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const managementItems = NAV_ITEMS.filter(item => ['dashboard', 'website', 'tasks', 'projects', 'contracts', 'payments', 'analytics', 'documents', 'hrm', 'ai-assistant', 'tools'].includes(item.id) && !hiddenItems.has(item.id) && (!item.devOnly || isDevLocal));
  const categoryItems = NAV_ITEMS.filter(item => ['units', 'personnel', 'products', 'customers', 'agent-manager', 'user-guide'].includes(item.id) && !hiddenItems.has(item.id) && (!item.devOnly || isDevLocal));
  const settingsItem = NAV_ITEMS.find(item => item.id === 'settings' && !hiddenItems.has(item.id));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed left-0 top-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 ease-in-out
        ${isCollapsed ? 'md:w-20' : 'md:w-52'} 
        ${isOpen ? 'translate-x-0 w-52' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header & Logo - Modern Professional Style */}
        <div className={`relative p-4 flex items-center justify-between ${isCollapsed ? 'md:px-3 md:justify-center' : ''}`}>
          {/* Subtle gradient accent line at bottom */}
          <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

          {/* Logo - Expanded state */}
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${isCollapsed ? 'md:hidden' : 'w-auto'}`}>
            <CICLogo size="sm" variant="full" />
          </div>

          {/* Logo - Collapsed state (icon only) */}
          <div className={`hidden transition-all duration-300 ${isCollapsed ? 'md:flex justify-center' : ''}`}>
            <CICLogoIcon size={40} />
          </div>

          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`hidden md:flex p-2 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all duration-200 ${isCollapsed ? 'w-full justify-center mt-2' : ''}`}
            title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          {/* Mobile Close */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className={`flex-1 overflow-y-auto p-4 ${isCollapsed ? 'md:px-2' : ''}`}>

          {/* Group: Quản trị */}
          <div className="mb-6">
            {!isCollapsed && <p className="px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Quản trị</p>}
            <nav>
              {managementItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  isCollapsed={isCollapsed}
                  onClose={onClose}
                />
              ))}
            </nav>
          </div>

          <div className="w-full h-px bg-slate-100 dark:bg-slate-800 my-4 md:hidden"></div>

          {/* Group: Danh mục */}
          <div className="mb-2 text-left">
            {!isCollapsed && (
              <button
                onClick={toggleCategoryExpanded}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg group mb-1 transition-colors"
                title="Thu gọn/Mở rộng Danh mục"
              >
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider group-hover:text-slate-600 dark:group-hover:text-slate-300">Danh mục</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isCategoryExpanded ? '' : '-rotate-90'}`} />
              </button>
            )}
            
            <div className={`grid transition-all duration-300 ease-in-out ${isCategoryExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <nav>
                  {categoryItems.map((item) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      isCollapsed={isCollapsed}
                      onClose={onClose}
                    />
                  ))}
                </nav>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom: Settings */}
        <div className={`p-4 border-t border-slate-100 dark:border-slate-800 ${isCollapsed ? 'md:px-2' : ''}`}>
          {settingsItem && (
            <NavItem
              item={settingsItem}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isCollapsed={isCollapsed}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
