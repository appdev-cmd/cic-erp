import React from 'react';
import { User, Upload } from 'lucide-react';

interface AvatarSectionProps {
    previewUrl: string;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    readOnly?: boolean;
}

const AvatarSection: React.FC<AvatarSectionProps> = ({ previewUrl, onFileChange, readOnly }) => {
    return (
        <div className="w-1/4 flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800 relative group">
                {previewUrl ? (
                    <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <User size={48} className="text-slate-400" />
                )}
                {!readOnly && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <label htmlFor="avatar-upload" className="cursor-pointer text-white text-xs flex flex-col items-center">
                            <Upload size={16} className="mb-1" />
                            <span>Tải ảnh</span>
                        </label>
                    </div>
                )}
                {!readOnly && (
                    <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onFileChange}
                    />
                )}
            </div>
            <p className="text-xs text-slate-500 text-center">Ảnh định dạng .jpg, .png</p>
        </div>
    );
};

export default AvatarSection;
