import React from 'react';
import { JobOpening } from '../../types/hrmTypes';
import { Search } from 'lucide-react';

interface Props {
  jobOpenings: JobOpening[];
}

const RecruitmentKanban: React.FC<Props> = ({ jobOpenings }) => {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center min-h-[400px] flex flex-col items-center justify-center animate-fade-in shadow-inner">
      <div className="w-16 h-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl flex items-center justify-center mb-4 text-indigo-500">
        <Search size={32} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Kanban Pipeline Ứng viên</h3>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        Bảng quản lý quy trình (Pipeline) với tính năng kéo thả (Drag & Drop) thông minh đang được nâng cấp. Chức năng sẽ có mặt trong bản cập nhật tới!
      </p>
    </div>
  );
};

export default RecruitmentKanban;
