import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    List,
    ListOrdered,
    Quote,
    Heading1,
    Heading2,
    Image as ImageIcon,
    Undo,
    Redo,
} from 'lucide-react';

interface RichTextEditorProps {
    value?: string;
    onChange?: (val: string) => void;
    label?: string;
    error?: string;
    hint?: string;
    minHeight?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    const addImage = useCallback(() => {
        const url = window.prompt('URL ẢNh:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    }, [editor]);

    return (
        <div className="flex flex-wrap gap-1 p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 rounded-t-lg">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-1.5 rounded transition-colors ${
                    editor.isActive('bold')
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Bôi đậm"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded transition-colors ${
                    editor.isActive('italic')
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="In nghiêng"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded transition-colors ${
                    editor.isActive('strike')
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Gạch ngang"
            >
                <Strikethrough className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleCode().run()}
                disabled={!editor.can().chain().focus().toggleCode().run()}
                className={`p-1.5 rounded transition-colors ${
                    editor.isActive('code')
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Mã nội tuyến"
            >
                <Code className="w-4 h-4" />
            </button>
            
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1.5 rounded transition-colors flex items-center ${
                    editor.isActive('heading', { level: 1 })
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Tiêu đề 1"
            >
                <Heading1 className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded transition-colors flex items-center ${
                    editor.isActive('heading', { level: 2 })
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Tiêu đề 2"
            >
                <Heading2 className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded transition-colors ${
                    editor.isActive('bulletList')
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Danh sách dấu chấm"
            >
                <List className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded transition-colors ${
                    editor.isActive('orderedList')
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Danh sách số"
            >
                <ListOrdered className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded transition-colors ${
                    editor.isActive('blockquote')
                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title="Trích dẫn"
            >
                <Quote className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center" />

            <button
                type="button"
                onClick={addImage}
                className="p-1.5 rounded transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Chèn ảnh"
            >
                <ImageIcon className="w-4 h-4" />
            </button>

            <div className="flex-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                className="p-1.5 rounded transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                title="Hoàn tác"
            >
                <Undo className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                className="p-1.5 rounded transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                title="Làm lại"
            >
                <Redo className="w-4 h-4" />
            </button>
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
        ],
        content: value,
        onUpdate: ({ editor }) => {
            if (onChange) {
                onChange(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: `prose prose-slate dark:prose-invert max-w-none focus:outline-none px-4 py-3 min-h-[${minHeight}] text-slate-900 dark:text-slate-100 prose-p:my-2 prose-headings:my-3 !bg-transparent`,
            },
        },
    });

    React.useEffect(() => {
        // Only update if editor is ready and value is different from current editor content
        // This handles cases where data is loaded asynchronously after initial mount
        if (editor && value !== undefined && value !== editor.getHTML()) {
            // Need setTimeout to prevent some edge cases where React complains about setContent during render
            setTimeout(() => {
                if (editor.isDestroyed) return;
                editor.commands.setContent(value);
            }, 0);
        }
    }, [value, editor]);

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
                    border rounded-lg overflow-hidden transition-all duration-200
                    bg-slate-50 dark:bg-slate-800
                    ${hasError 
                        ? 'border-red-500 focus-within:ring-4 focus-within:ring-red-500/20' 
                        : 'border-slate-200 dark:border-slate-800 focus-within:border-orange-500 dark:focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/20'}
                `}
            >
                <MenuBar editor={editor} />
                <div className={`overflow-y-auto cursor-text`} style={{ minHeight }}>
                    <EditorContent editor={editor} />
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
