/**
 * MergeLeadModal — Tìm lead trùng (theo SĐT/email) và gộp vào lead hiện tại.
 * Lead hiện tại = lead GIỮ LẠI; lead được chọn = lead bị gộp (ẩn đi).
 */

import React, { useEffect, useState } from 'react';
import { X, GitMerge, Loader2, Phone, Mail, Building2, AlertTriangle } from 'lucide-react';
import { CrmLeadService } from '../../../services';
import type { CrmLead } from '../../../types/crm';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onMerged: () => void;
  lead: CrmLead;
}

const MergeLeadModal: React.FC<Props> = ({ isOpen, onClose, onMerged, lead }) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<CrmLead[]>([]);
  const [mergingId, setMergingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      try {
        const dups = await CrmLeadService.checkDuplicates(lead.phone, lead.email);
        setCandidates(dups.filter(d => d.id !== lead.id));
      } catch (err: any) {
        toast.error('Lỗi tìm trùng: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, lead.id, lead.phone, lead.email]);

  const handleMerge = async (candidate: CrmLead) => {
    if (!window.confirm(`Gộp lead "${candidate.title}" vào "${lead.title}"?\nActivities sẽ chuyển sang lead hiện tại, lead trùng sẽ bị ẩn.`)) return;
    try {
      setMergingId(candidate.id);
      await CrmLeadService.mergeLead(lead.id, candidate.id);
      toast.success('Đã gộp lead thành công');
      onMerged();
      onClose();
    } catch (err: any) {
      toast.error('Lỗi gộp lead: ' + err.message);
    } finally {
      setMergingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <GitMerge size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Gộp lead trùng</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Giữ lại: <span className="font-semibold text-slate-800 dark:text-slate-200">{lead.title}</span>
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500">
              Không tìm thấy lead trùng theo SĐT/email.
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-1">
                <AlertTriangle size={13} /> Tìm thấy {candidates.length} lead có thể trùng:
              </div>
              {candidates.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{c.title}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {c.company_name && <span className="flex items-center gap-1"><Building2 size={11} />{c.company_name}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
                      {c.email && <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleMerge(c)}
                    disabled={mergingId === c.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                  >
                    {mergingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <GitMerge size={12} />}
                    Gộp vào đây
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MergeLeadModal;
