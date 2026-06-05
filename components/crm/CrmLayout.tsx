import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../../routes/routes';

export const CrmLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const tabs = [
    { name: 'Đầu mối (Leads)', path: ROUTES.CRM_LEADS },
    { name: 'Khách hàng tổ chức (Companies)', path: ROUTES.CRM_COMPANIES },
    { name: 'Liên hệ (Contacts)', path: ROUTES.CRM_CONTACTS },
    { name: 'Cơ hội (Deals)', path: ROUTES.CRM_DEALS },
    { name: 'Báo giá (Quotes)', path: ROUTES.CRM_QUOTES },
    { name: 'Sản phẩm & Dịch vụ (Products)', path: ROUTES.CRM_PRODUCTS },
    { name: 'Cấu hình', path: ROUTES.CRM_SETTINGS },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Top Navigation Bar */}
      <div className="flex items-center gap-6 px-6 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mr-4">CRM</h1>
        
        <nav className="flex space-x-1">
          {tabs.map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                {tab.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {children || <Outlet />}
      </div>
    </div>
  );
};
