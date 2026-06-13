import React from 'react';
import { MonitorSmartphone, ArrowLeft } from 'lucide-react';
import { useIsMobile } from '../../hooks';

/**
 * MobileFormGuard — chặn các form nhập liệu phức tạp trên màn hình điện thoại.
 *
 * Định hướng mobile (plans/mobile-responsive-plan.md): "điện thoại là nơi XEM,
 * desktop là nơi NHẬP". Các form nặng (tạo/sửa hợp đồng 4 bước, phiếu thu-chi,
 * dự án, import Excel…) không thể dùng tử tế trên 375px — thay vì để người dùng
 * vật lộn với ô nhập tí hon, hiện màn hình hướng dẫn mở trên thiết bị lớn hơn.
 *
 * Dùng bọc nội dung form. Trên ≥ md render children bình thường; < md hiện chắn.
 *
 * @example
 * return (
 *   <MobileFormGuard title="Tạo hợp đồng" onBack={onCancel}>
 *     <ContractFormBody ... />
 *   </MobileFormGuard>
 * );
 */
interface MobileFormGuardProps {
    /** Nội dung form (render trên ≥md). Bỏ trống khi dùng làm chắn độc lập (early-return). */
    children?: React.ReactNode;
    /** Tên chức năng để hiển thị trong thông báo. */
    title?: string;
    /** Mô tả ngắn (mặc định gợi ý dùng máy tính/tablet ngang). */
    message?: string;
    /** Nút quay lại (vd đóng panel/modal). Ẩn nếu không truyền. */
    onBack?: () => void;
    /** Cho phép vượt qua (hiếm dùng) — render form dù đang ở mobile. */
    allowMobile?: boolean;
}

export const MobileFormGuard: React.FC<MobileFormGuardProps> = ({
    children, title, message, onBack, allowMobile = false,
}) => {
    const isMobile = useIsMobile();

    if (!isMobile || allowMobile) return <>{children}</>;

    return (
        <div className="flex flex-col items-center justify-center text-center px-6 py-12 min-h-[60vh]">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-5">
                <MonitorSmartphone size={30} className="text-orange-500 dark:text-orange-400" />
            </div>
            <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
                {title ? `"${title}" cần màn hình lớn hơn` : 'Chức năng này cần màn hình lớn hơn'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                {message || 'Nhập liệu chi tiết được tối ưu cho máy tính hoặc máy tính bảng (xoay ngang). Vui lòng mở trên thiết bị có màn hình rộng hơn để thao tác chính xác.'}
            </p>
            {onBack && (
                <button
                    onClick={onBack}
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    <ArrowLeft size={16} /> Quay lại
                </button>
            )}
        </div>
    );
};

export default MobileFormGuard;
