import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { usePermissionCheck } from '../../hooks/usePermissions';
import { PermissionResource, PermissionAction } from '../../types';
import ErrorBoundary from '../ErrorBoundary';

interface RequirePermissionProps {
    resource: PermissionResource;
    action?: PermissionAction;
    children: React.ReactNode;
}

const RequirePermission: React.FC<RequirePermissionProps> = ({ 
    resource, 
    action = 'view', 
    children 
}) => {
    const { can, isLoading } = usePermissionCheck();
    const navigate = useNavigate();
    const [showSpinner, setShowSpinner] = useState(false);

    // Prevent immediate spinner flash
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isLoading) {
            timer = setTimeout(() => setShowSpinner(true), 150);
        } else {
            setShowSpinner(false);
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

    if (isLoading) {
        if (!showSpinner) return null;
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium text-sm">Đang kiểm tra quyền truy cập...</p>
                </div>
            </div>
        );
    }

    const hasPermission = can(resource, action);

    if (!hasPermission) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert size={40} className="text-rose-600 dark:text-rose-400" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">Truy cập bị từ chối</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 whitespace-pre-line">
                        Tài khoản của bạn không được cấp quyền truy cập vào phân hệ này. Xin vui lòng liên hệ Ban lãnh đạo hoặc Admin để được cấp quyền.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ArrowLeft size={18} />
                            Quay lại trang trước
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
                        >
                            Về trang chủ
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <ErrorBoundary>{children}</ErrorBoundary>;
};

export default RequirePermission;
