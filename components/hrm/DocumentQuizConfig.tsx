import React, { useState, useRef } from 'react';
import { FileText, Loader2, Plus, Trash2, Check, AlertCircle, Edit, FileCode } from 'lucide-react';
import { OnboardingService } from '../../services/onboardingService';
import type { QuizQuestion } from '../../types/onboardingTypes';
import { toast } from 'sonner';

interface DocumentQuizConfigProps {
    documentUrl: string | null;
    documentName: string | null;
    convertedHtml: string | null;
    quizQuestions: QuizQuestion[] | null;
    onChange: (data: {
        documentUrl: string | null;
        documentName: string | null;
        convertedHtml: string | null;
        quizQuestions: QuizQuestion[] | null;
    }) => void;
}

export const DocumentQuizConfig: React.FC<DocumentQuizConfigProps> = ({
    documentUrl,
    documentName,
    convertedHtml,
    quizQuestions,
    onChange
}) => {
    const [loading, setLoading] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [showPasteArea, setShowPasteArea] = useState(false);
    const [isEditingHtml, setIsEditingHtml] = useState(false);
    const [htmlEditVal, setHtmlEditVal] = useState(convertedHtml || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Parse DOCX file client-side using Mammoth
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['docx', 'doc', 'ppt', 'pptx'].includes(ext || '')) {
            toast.error('Định dạng file không hỗ trợ. Vui lòng chọn .docx, .doc, .ppt hoặc .pptx');
            return;
        }

        setLoading(true);
        try {
            if (ext === 'docx') {
                const mammoth = await import('mammoth');
                const reader = new FileReader();

                reader.onload = async (event) => {
                    const arrayBuffer = event.target?.result as ArrayBuffer;
                    try {
                        const result = await mammoth.convertToHtml({ arrayBuffer });
                        const rawHtml = result.value;
                        const plainText = rawHtml.replace(/<[^>]+>/g, '\n').trim();

                        if (!plainText) {
                            throw new Error('Không thể trích xuất văn bản từ file docx.');
                        }

                        // Call local AI
                        toast.info('Đang phân tích và tạo bài test bằng AI Local...');
                        const aiRes = await OnboardingService.generateDocumentAndQuiz(plainText);
                        
                        // Upload file to Supabase Storage
                        const storageRes = await OnboardingService.uploadOnboardingMaterial(file);

                        onChange({
                            documentUrl: storageRes.url,
                            documentName: file.name,
                            convertedHtml: aiRes.html,
                            quizQuestions: aiRes.quiz
                        });
                        setHtmlEditVal(aiRes.html);
                        toast.success('Xử lý và tải lên tài liệu thành công!');
                    } catch (err: any) {
                        console.error(err);
                        toast.error(`Lỗi chuyển đổi bằng AI: ${err.message}`);
                    } finally {
                        setLoading(false);
                    }
                };

                reader.onerror = () => {
                    toast.error('Lỗi khi đọc file.');
                    setLoading(false);
                };

                reader.readAsArrayBuffer(file);
            } else {
                // For legacy .doc, .ppt, .pptx
                setLoading(false);
                toast.warning(`Định dạng .${ext} cần được copy-paste nội dung text trực tiếp để AI local xử lý tốt nhất!`);
                setShowPasteArea(true);
            }
        } catch (err: any) {
            console.error(err);
            toast.error('Lỗi tải lên và xử lý tài liệu.');
            setLoading(false);
        }
    };

    // Convert pasted text
    const handleConvertPasteText = async () => {
        if (!pasteText.trim()) {
            toast.error('Vui lòng nhập nội dung văn bản đào tạo');
            return;
        }

        setLoading(true);
        try {
            toast.info('Đang phân tích và tạo bài test bằng AI Local...');
            const aiRes = await OnboardingService.generateDocumentAndQuiz(pasteText);

            onChange({
                documentUrl: null,
                documentName: 'Văn bản nhập tay',
                convertedHtml: aiRes.html,
                quizQuestions: aiRes.quiz
            });
            setHtmlEditVal(aiRes.html);
            toast.success('AI Local đã phân tích tài liệu và sinh quiz thành công!');
            setShowPasteArea(false);
            setPasteText('');
        } catch (err: any) {
            console.error(err);
            toast.error(`AI local gặp sự cố: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Save edited HTML
    const handleSaveHtml = () => {
        onChange({
            documentUrl,
            documentName,
            convertedHtml: htmlEditVal,
            quizQuestions
        });
        setIsEditingHtml(false);
        toast.success('Đã lưu mã HTML chỉnh sửa!');
    };

    // Quiz Questions changes
    const handleQuestionTextChange = (qIndex: number, text: string) => {
        if (!quizQuestions) return;
        const updated = [...quizQuestions];
        updated[qIndex].question = text;
        onChange({ documentUrl, documentName, convertedHtml, quizQuestions: updated });
    };

    const handleOptionTextChange = (qIndex: number, oIndex: number, text: string) => {
        if (!quizQuestions) return;
        const updated = [...quizQuestions];
        updated[qIndex].options[oIndex] = text;
        onChange({ documentUrl, documentName, convertedHtml, quizQuestions: updated });
    };

    const handleCorrectOptionChange = (qIndex: number, oIndex: number) => {
        if (!quizQuestions) return;
        const updated = [...quizQuestions];
        updated[qIndex].answerIndex = oIndex;
        onChange({ documentUrl, documentName, convertedHtml, quizQuestions: updated });
    };

    const handleDeleteQuestion = (qIndex: number) => {
        if (!quizQuestions) return;
        const updated = quizQuestions.filter((_, idx) => idx !== qIndex);
        onChange({ documentUrl, documentName, convertedHtml, quizQuestions: updated });
    };

    const handleAddQuestion = () => {
        const newQ: QuizQuestion = {
            question: 'Câu hỏi mới?',
            options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'],
            answerIndex: 0
        };
        const updated = quizQuestions ? [...quizQuestions, newQ] : [newQ];
        onChange({ documentUrl, documentName, convertedHtml, quizQuestions: updated });
    };

    return (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
                <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Tài liệu đào tạo & Quiz trắc nghiệm</h4>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5">Thêm tài liệu hướng dẫn và bộ câu hỏi đánh giá kết quả học tập cho nhiệm vụ này.</p>
            </div>

            {loading ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="animate-spin text-fuchsia-500" size={32} />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 animate-pulse">AI Local đang xử lý và tạo quiz...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Document Upload Zone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-4 border-2 border-dashed border-slate-200 hover:border-fuchsia-400 dark:border-slate-800 dark:hover:border-fuchsia-850 rounded-2xl cursor-pointer bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center transition group hover:shadow-md"
                        >
                            <FileText className="text-slate-400 group-hover:text-fuchsia-500 transition mb-2" size={28} />
                            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-350">Tải lên File Tài liệu</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Hỗ trợ .docx để AI tự động parse</span>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                accept=".docx,.doc,.ppt,.pptx" 
                                className="hidden" 
                            />
                        </div>

                        <div 
                            onClick={() => setShowPasteArea(!showPasteArea)}
                            className={`p-4 border-2 border-dashed rounded-2xl cursor-pointer text-center flex flex-col items-center justify-center transition group hover:shadow-md ${showPasteArea ? 'border-fuchsia-500 bg-fuchsia-50/10' : 'border-slate-200 dark:border-slate-800 hover:border-fuchsia-400'}`}
                        >
                            <FileCode className={`mb-2 transition ${showPasteArea ? 'text-fuchsia-500' : 'text-slate-400 group-hover:text-fuchsia-500'}`} size={28} />
                            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-350">Dán Văn bản Trực tiếp</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Dành cho copy text từ .doc, .ppt, .pptx</span>
                        </div>
                    </div>

                    {/* Paste Text Field */}
                    {showPasteArea && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nội dung văn bản quy trình/đào tạo</label>
                            <textarea
                                value={pasteText}
                                onChange={e => setPasteText(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs h-32 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50"
                                placeholder="Sao chép nội dung từ file doc/ppt và dán vào đây..."
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowPasteArea(false)}
                                    className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConvertPasteText}
                                    className="px-4 py-1.5 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg transition"
                                >
                                    Bắt đầu chuyển đổi
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Document Selected Info */}
                    {documentName && (
                        <div className="flex items-center justify-between p-3 bg-fuchsia-50/30 dark:bg-fuchsia-950/10 border border-fuchsia-200/50 dark:border-fuchsia-900/30 rounded-xl">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <FileText className="text-fuchsia-600 dark:text-fuchsia-400 shrink-0" size={18} />
                                <div className="min-w-0">
                                    <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">{documentName}</p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Tài liệu đã được phân tích bằng AI Local</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onChange({ documentUrl: null, documentName: null, convertedHtml: null, quizQuestions: null })}
                                className="text-rose-500 hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-[10px] font-bold uppercase tracking-wider shrink-0"
                            >
                                Gỡ bỏ
                            </button>
                        </div>
                    )}

                    {/* HTML Document Editor & Preview */}
                    {convertedHtml !== null && (
                        <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Xem trước tài liệu (HTML)</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isEditingHtml) {
                                            handleSaveHtml();
                                        } else {
                                            setHtmlEditVal(convertedHtml);
                                            setIsEditingHtml(true);
                                        }
                                    }}
                                    className="text-xs font-bold text-fuchsia-600 dark:text-fuchsia-450 hover:underline flex items-center gap-1"
                                >
                                    {isEditingHtml ? 'Lưu mã HTML' : <><Edit size={12} /> Sửa mã HTML</>}
                                </button>
                            </div>

                            {isEditingHtml ? (
                                <div className="space-y-2">
                                    <textarea
                                        value={htmlEditVal}
                                        onChange={e => setHtmlEditVal(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl font-mono text-[11px] h-48 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingHtml(false)}
                                            className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveHtml}
                                            className="px-3.5 py-1 text-xs font-bold text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg transition"
                                        >
                                            Lưu
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div 
                                    className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto text-xs prose prose-slate dark:prose-invert prose-headings:font-bold prose-p:leading-relaxed prose-table:border prose-table:border-collapse prose-td:border prose-td:p-1.5"
                                    dangerouslySetInnerHTML={{ __html: convertedHtml }} 
                                />
                            )}
                        </div>
                    )}

                    {/* Quiz Questions Config */}
                    {quizQuestions && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center pl-1">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Bộ câu hỏi trắc nghiệm ({quizQuestions.length})</span>
                                <button
                                    type="button"
                                    onClick={handleAddQuestion}
                                    className="text-xs font-bold text-fuchsia-600 dark:text-fuchsia-400 hover:underline flex items-center gap-0.5"
                                >
                                    <Plus size={14} /> Thêm câu hỏi
                                </button>
                            </div>

                            <div className="space-y-4">
                                {quizQuestions.map((q, qIndex) => (
                                    <div 
                                        key={qIndex}
                                        className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative space-y-3 group"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteQuestion(qIndex)}
                                            className="absolute right-3 top-3 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Xóa câu hỏi"
                                        >
                                            <Trash2 size={14} />
                                        </button>

                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Câu hỏi {qIndex + 1}</span>
                                            <input
                                                type="text"
                                                value={q.question}
                                                onChange={e => handleQuestionTextChange(qIndex, e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {q.options.map((opt, oIndex) => {
                                                const isCorrect = q.answerIndex === oIndex;
                                                return (
                                                    <div 
                                                        key={oIndex}
                                                        className={`flex items-center gap-2 p-2 bg-white dark:bg-slate-900 border rounded-xl transition-all ${isCorrect ? 'border-emerald-400 dark:border-emerald-800/80 ring-1 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800'}`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCorrectOptionChange(qIndex, oIndex)}
                                                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'}`}
                                                            title="Đặt làm đáp án đúng"
                                                        >
                                                            {isCorrect && <Check size={12} />}
                                                        </button>
                                                        <input
                                                            type="text"
                                                            value={opt}
                                                            onChange={e => handleOptionTextChange(qIndex, oIndex, e.target.value)}
                                                            className="flex-1 bg-transparent border-none focus:outline-none text-[11px] font-medium text-slate-700 dark:text-slate-300 p-0"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
