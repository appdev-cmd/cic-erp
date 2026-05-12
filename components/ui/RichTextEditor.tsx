import React, { useCallback, useState } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import {
    Bold,
    Italic,
    Strikethrough,
    List,
    ListOrdered,
    Quote,
    Heading1,
    Heading2,
    Image as ImageIcon,
    Undo,
    Redo,
    Code2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Table as TableIcon,
    Trash2,
    Palette,
    Highlighter,
    Plus
} from 'lucide-react';

interface RichTextEditorProps {
    value?: string;
    onChange?: (val: string) => void;
    label?: string;
    error?: string;
    hint?: string;
    minHeight?: string;
}

// Custom Extension for Font Size
const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() { return { types: ['textStyle'] }; },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
                        renderHTML: attributes => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: fontSize => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
            unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
        };
    },
});

const MenuBar = ({ editor, isHtmlMode, toggleHtmlMode }: { editor: any, isHtmlMode: boolean, toggleHtmlMode: () => void }) => {
    if (!editor) {
        return null;
    }

    const addImage = useCallback(() => {
        const url = window.prompt('Nhập URL hoặc đường dẫn ảnh (VD: /images/news/abc.jpg):');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }, [editor]);

    const activeClass = "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400";
    const inactiveClass = "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700";

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 rounded-t-lg">
            {/* HTML Toggle */}
            <button
                type="button"
                onClick={toggleHtmlMode}
                className={`p-1.5 rounded transition-colors ${isHtmlMode ? activeClass : inactiveClass}`}
                title="Mã HTML (Nâng cao)"
            >
                <Code2 className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />

            {!isHtmlMode && (
                <>
                    {/* Basic Formatting */}
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        disabled={!editor.can().chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? activeClass : inactiveClass}`}
                        title="Bôi đậm"
                    >
                        <Bold className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        disabled={!editor.can().chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? activeClass : inactiveClass}`}
                        title="In nghiêng"
                    >
                        <Italic className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        disabled={!editor.can().chain().focus().toggleStrike().run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive('strike') ? activeClass : inactiveClass}`}
                        title="Gạch ngang"
                    >
                        <Strikethrough className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />

                    {/* Font & Color */}
                    <select 
                        onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()} 
                        className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 outline-none"
                    >
                        <option value="">Font mặc định</option>
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times</option>
                        <option value="Courier New">Courier</option>
                        <option value="Tahoma">Tahoma</option>
                        <option value="Verdana">Verdana</option>
                    </select>

                    <select 
                        onChange={e => editor.chain().focus().setFontSize(e.target.value).run()} 
                        className="text-xs px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 outline-none"
                    >
                        <option value="">Cỡ chữ</option>
                        <option value="12px">12px</option>
                        <option value="14px">14px</option>
                        <option value="16px">16px</option>
                        <option value="18px">18px</option>
                        <option value="20px">20px</option>
                        <option value="24px">24px</option>
                    </select>

                    <div className="flex items-center gap-1 ml-1 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900">
                        <Palette className="w-3.5 h-3.5 text-slate-400" />
                        <input 
                            type="color" 
                            onInput={e => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()} 
                            className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer" 
                            title="Màu chữ" 
                        />
                    </div>
                    <div className="flex items-center gap-1 ml-1 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-900">
                        <Highlighter className="w-3.5 h-3.5 text-slate-400" />
                        <input 
                            type="color" 
                            onInput={e => editor.chain().focus().setHighlight({ color: (e.target as HTMLInputElement).value }).run()} 
                            className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer" 
                            title="Màu nền chữ" 
                        />
                    </div>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />

                    {/* Alignment */}
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive({ textAlign: 'left' }) ? activeClass : inactiveClass}`}
                        title="Căn trái"
                    >
                        <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive({ textAlign: 'center' }) ? activeClass : inactiveClass}`}
                        title="Căn giữa"
                    >
                        <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive({ textAlign: 'right' }) ? activeClass : inactiveClass}`}
                        title="Căn phải"
                    >
                        <AlignRight className="w-4 h-4" />
                    </button>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />

                    {/* Lists & Headings */}
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive('bulletList') ? activeClass : inactiveClass}`}
                        title="Danh sách dấu chấm"
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive('orderedList') ? activeClass : inactiveClass}`}
                        title="Danh sách số"
                    >
                        <ListOrdered className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 1 }) ? activeClass : inactiveClass}`}
                        title="Tiêu đề 1"
                    >
                        <Heading1 className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`p-1.5 rounded transition-colors ${editor.isActive('heading', { level: 2 }) ? activeClass : inactiveClass}`}
                        title="Tiêu đề 2"
                    >
                        <Heading2 className="w-4 h-4" />
                    </button>
                    
                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />

                    {/* Table */}
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        className={`p-1.5 rounded transition-colors ${inactiveClass}`}
                        title="Chèn bảng"
                    >
                        <TableIcon className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                        disabled={!editor.can().addColumnAfter()}
                        className={`p-1.5 rounded transition-colors ${inactiveClass} disabled:opacity-30 flex items-center gap-1 text-[10px] font-medium`}
                        title="Thêm cột"
                    >
                        <Plus className="w-3 h-3" /> Cột
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        disabled={!editor.can().addRowAfter()}
                        className={`p-1.5 rounded transition-colors ${inactiveClass} disabled:opacity-30 flex items-center gap-1 text-[10px] font-medium`}
                        title="Thêm dòng"
                    >
                        <Plus className="w-3 h-3" /> Dòng
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().deleteTable().run()}
                        disabled={!editor.can().deleteTable()}
                        className={`p-1.5 rounded transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-300 disabled:opacity-30 flex items-center gap-1 text-[10px] font-medium`}
                        title="Xóa bảng"
                    >
                        <Trash2 className="w-3 h-3 text-red-500" /> Bảng
                    </button>

                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />

                    {/* Media */}
                    <button
                        type="button"
                        onClick={addImage}
                        className={`p-1.5 rounded transition-colors ${inactiveClass}`}
                        title="Chèn ảnh"
                    >
                        <ImageIcon className="w-4 h-4" />
                    </button>

                    <div className="flex-1" />

                    {/* History */}
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().chain().focus().undo().run()}
                        className={`p-1.5 rounded transition-colors ${inactiveClass} disabled:opacity-50`}
                        title="Hoàn tác"
                    >
                        <Undo className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().chain().focus().redo().run()}
                        className={`p-1.5 rounded transition-colors ${inactiveClass} disabled:opacity-50`}
                        title="Làm lại"
                    >
                        <Redo className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
    value = '',
    onChange,
    label,
    error,
    hint,
    minHeight = '300px',
}) => {
    const [isHtmlMode, setIsHtmlMode] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({
                inline: true,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'rounded-lg max-w-full h-auto object-cover my-4',
                },
            }),
            TextStyle,
            Color,
            FontFamily,
            FontSize,
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'min-w-full border-collapse border border-slate-300 dark:border-slate-700 my-4',
                },
            }),
            TableRow.configure({
                HTMLAttributes: { class: 'border-b border-slate-300 dark:border-slate-700' },
            }),
            TableHeader.configure({
                HTMLAttributes: { class: 'border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-2 font-bold text-left' },
            }),
            TableCell.configure({
                HTMLAttributes: { class: 'border border-slate-300 dark:border-slate-700 p-2' },
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            if (onChange) {
                onChange(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: `prose prose-slate dark:prose-invert max-w-none focus:outline-none px-4 py-3 min-h-[${minHeight}] text-slate-900 dark:text-slate-100 prose-p:my-2 prose-headings:my-3 !bg-transparent prose-td:border-slate-300 dark:prose-td:border-slate-700`,
            },
        },
    });

    React.useEffect(() => {
        // Only update if editor is ready and value is different from current editor content
        if (editor && value !== undefined && value !== editor.getHTML()) {
            setTimeout(() => {
                if (editor.isDestroyed) return;
                editor.commands.setContent(value);
            }, 0);
        }
    }, [value, editor]);

    const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        if (onChange) onChange(val);
        editor?.commands.setContent(val);
    };

    const hasError = !!error;

    return (
        <div className="w-full">
            {label && (
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                    {label}
                </label>
            )}

            <div
                className={`
                    border rounded-lg overflow-hidden transition-all duration-200 flex flex-col
                    bg-slate-50 dark:bg-slate-800
                    ${hasError 
                        ? 'border-red-500 focus-within:ring-4 focus-within:ring-red-500/20' 
                        : 'border-slate-200 dark:border-slate-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/20'}
                `}
            >
                <MenuBar editor={editor} isHtmlMode={isHtmlMode} toggleHtmlMode={() => setIsHtmlMode(!isHtmlMode)} />
                <div className="relative flex-1" style={{ minHeight }}>
                    {isHtmlMode ? (
                        <textarea
                            value={value}
                            onChange={handleHtmlChange}
                            className="absolute inset-0 w-full h-full p-4 bg-slate-900 text-emerald-400 font-mono text-sm outline-none resize-none"
                            spellCheck={false}
                            placeholder="Nhập mã HTML vào đây..."
                        />
                    ) : (
                        <div className="overflow-y-auto cursor-text h-full" onClick={() => editor?.commands.focus()}>
                            <EditorContent editor={editor} />
                        </div>
                    )}
                </div>
            </div>

            {(error || hint) && (
                <p className={`mt-1.5 text-xs font-medium ${hasError ? 'text-red-500' : 'text-slate-400'}`}>
                    {error || hint}
                </p>
            )}
        </div>
    );
};

export default RichTextEditor;
