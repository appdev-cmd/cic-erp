// @ts-nocheck
import { dataClient as supabase } from '../lib/dataClient';
import { DocumentRegistryService } from './documentRegistryService';

// Helper to sanitize filename for S3 storage
const sanitizeFileName = (fileName: string): string => {
    // 1. Separate extension
    const parts = fileName.split('.');
    const ext = parts.length > 1 ? parts.pop() : '';
    const name = parts.join('.');

    // 2. Transliterate Vietnamese & Remove special chars
    const safeName = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9_-]/g, '_'); // Replace non-alphanumeric with underscore

    // 3. Truncate to avoid "Invalid Key" (max 100 chars, safe limit)
    const truncatedName = safeName.slice(0, 100);

    return ext ? `${truncatedName}.${ext}` : truncatedName;
};

/**
 * Generate standard file name: [PREFIX]_[CONTRACT_CODE]_[YYYYMMDD]_[ORIGINAL_NAME]
 */
const generateStandardFileName = (contractId: string, originalName: string, docType: string = 'HD'): string => {
    // 1. Sanitize Contract ID (remove special chars)
    // Assuming contractId is human readable like "HĐ_001/BIM_..."
    // We want "HD_001-BIM..."
    const safeContractId = contractId.replace(/[/\\?%*:|"<>]/g, '-');

    // 2. Get Date YYYYMMDD
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 3. Sanitize Original Name
    // Remove extension first
    const parts = originalName.split('.');
    const ext = parts.length > 1 ? parts.pop() : '';
    const nameWithoutExt = parts.join('.');

    const safeOriginalName = nameWithoutExt
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9_-]/g, '_'); // Replace non-alphanumeric with underscore

    // 4. Combine
    const prefix = docType.toUpperCase();
    const newName = `${prefix}_${safeContractId}_${date}_${safeOriginalName}`;

    return ext ? `${newName}.${ext}` : newName;
};

export const DocumentService = {
    getByContractId: async (contractId: string) => {
        const { data, error } = await supabase.from('contract_documents').select('*').eq('contract_id', contractId);
        if (error) throw error;
        return data.map((d: any) => ({
            id: d.id,
            contractId: d.contract_id,
            name: d.name,
            url: d.url,
            filePath: d.file_path,
            type: d.type,
            size: d.size,
            uploadedAt: d.uploaded_at
        }));
    },

    upload: async (contractId: string, file: File) => {
        // 1. Upload to Storage
        const safeName = sanitizeFileName(file.name);
        // Ensure unique path with timestamp
        const filePath = `${contractId}/${Date.now()}_${safeName}`;
        const { error: storageError } = await supabase.storage
            .from('contract_docs')
            .upload(filePath, file);

        if (storageError) throw storageError;

        // 2. Insert into DB
        const { data: dbData, error: dbError } = await supabase.from('contract_documents').insert({
            contract_id: contractId,
            name: file.name,
            file_path: filePath,
            url: filePath,
            type: file.type,
            size: file.size
        }).select().single();

        if (dbError) throw dbError;

        // Auto-register vào Document Registry
        try {
            await DocumentRegistryService.create({
                title: file.name,
                docCategory: 'contract',
                sourceType: 'supabase_storage',
                storagePath: filePath,
                fileName: file.name,
                mimeType: file.type,
                fileSize: file.size,
                entityType: 'contract',
                entityId: contractId,
            });
        } catch (regErr) {
            console.warn('[DocumentService] Auto-register to registry failed:', regErr);
        }

        return {
            id: dbData.id,
            contractId: dbData.contract_id,
            name: dbData.name,
            url: dbData.url,
            filePath: dbData.file_path,
            type: dbData.type,
            size: dbData.size,
            uploadedAt: dbData.uploaded_at
        };
    },

    delete: async (id: string, filePath: string) => {
        // 1. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('contract_docs')
            .remove([filePath]);

        if (storageError) console.error("Storage delete error", storageError);

        // 2. Delete from DB
        const { error: dbError } = await supabase.from('contract_documents').delete().eq('id', id);
        if (dbError) throw dbError;
        return true;
    },

    download: async (filePath: string) => {
        const { data, error } = await supabase.storage.from('contract_docs').download(filePath);
        if (error) throw error;
        return data;
    },

    /**
     * Add external link (Google Drive/Doc/Sheet) as document
     */
    addLink: async (contractId: string, doc: { name: string; url: string; type: string }) => {
        const { data, error } = await supabase.from('contract_documents').insert({
            contract_id: contractId,
            name: doc.name,
            url: doc.url,
            file_path: null, // No file path for external links
            type: doc.type,
            size: 0
        }).select().single();

        if (error) throw error;

        // Auto-register vào Document Registry
        try {
            await DocumentRegistryService.create({
                title: doc.name,
                docCategory: 'contract',
                sourceType: 'external_link',
                sourceUrl: doc.url,
                fileName: doc.name,
                mimeType: doc.type,
                fileSize: 0,
                entityType: 'contract',
                entityId: contractId,
            });
        } catch (regErr) {
            console.warn('[DocumentService] Auto-register link to registry failed:', regErr);
        }

        return {
            id: data.id,
            contractId: data.contract_id,
            name: data.name,
            url: data.url,
            filePath: data.file_path,
            type: data.type,
            size: data.size,
            uploadedAt: data.uploaded_at
        };
    },

    /**
     * Delete link document (no storage cleanup needed)
     */
    deleteLink: async (id: string) => {
        const { error } = await supabase.from('contract_documents').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    /**
     * Upload file to Google Drive (instead of Supabase Storage).
     * Auto-creates contract folder on Drive if needed.
     * Falls back to Supabase Storage if Drive token is unavailable.
     */
    uploadToDrive: async (
        contractId: string,
        file: File,
        unitId: string,
        projectName: string,
        docType: string = '' // Empty = keep original name; 'HD'|'PAKD'|'HDON' = rename with prefix
    ) => {
        const { getGoogleAccessToken } = await import('../contexts/AuthContext');
        const token = getGoogleAccessToken();

        // Fallback to Supabase if no Drive token
        if (!token) {
            console.warn('[DocumentService] No Drive token, falling back to Supabase Storage');
            return DocumentService.upload(contractId, file);
        }

        const { GoogleDriveService } = await import('./googleDriveService');
        const { DriveInitService } = await import('./driveInitService');

        // All files go to the contract's main HopDong folder
        const { folderId } = await DriveInitService.createContractFolder(
            contractId, unitId, projectName
        );

        // If docType is specified, generate standard name with prefix
        // Otherwise keep original file name
        const uploadName = docType
            ? generateStandardFileName(contractId, file.name, docType, projectName)
            : file.name;

        // Upload to Drive
        const driveFile = await GoogleDriveService.uploadFile(file, folderId, uploadName);

        // Record in DB as external link (Google Drive)
        const { data, error } = await supabase.from('contract_documents').insert({
            contract_id: contractId,
            name: file.name,
            url: driveFile.webViewLink || GoogleDriveService.getFolderUrl(driveFile.id),
            file_path: null, // No Supabase storage path
            type: `drive:${file.type || 'application/octet-stream'}`,
            size: file.size
        }).select().single();

        if (error) throw error;

        // Auto-register vào Document Registry
        try {
            const driveUrl = driveFile.webViewLink || '';
            await DocumentRegistryService.create({
                title: file.name,
                docCategory: 'contract',
                sourceType: 'drive',
                sourceUrl: driveUrl,
                driveFileId: driveFile.id,
                fileName: uploadName,
                mimeType: file.type,
                fileSize: file.size,
                entityType: 'contract',
                entityId: contractId,
            });
        } catch (regErr) {
            console.warn('[DocumentService] Auto-register to registry failed:', regErr);
        }

        return {
            id: data.id,
            contractId: data.contract_id,
            name: data.name,
            url: data.url,
            filePath: data.file_path,
            type: data.type,
            size: data.size,
            uploadedAt: data.uploaded_at
        };
    },

    /**
     * Upload a generated blob (PDF / Excel) to Google Drive.
     */
    uploadBlobToDrive: async (
        contractId: string,
        blob: Blob,
        fileName: string,
        unitId: string,
        projectName: string,
        folderType: 'HopDong' | 'PAKD' | 'HoaDon' | 'BaoCao' = 'HopDong'
    ) => {
        const { GoogleDriveService } = await import('./googleDriveService');
        const { DriveInitService } = await import('./driveInitService');

        // All files go to the contract's main HopDong folder
        const result = await DriveInitService.createContractFolder(contractId, unitId, projectName);
        const folderId = result.folderId;

        // Map folder type to doc type prefix for naming
        let docType = 'HD';
        if (folderType === 'PAKD') docType = 'PAKD';
        else if (folderType === 'HoaDon') docType = 'HDON';
        else if (folderType === 'BaoCao') docType = 'BC';

        // Generate standard name
        const standardName = generateStandardFileName(contractId, fileName, docType, projectName);

        const driveFile = await GoogleDriveService.uploadBlob(blob, standardName, folderId);

        // Record in DB
        const { data, error } = await supabase.from('contract_documents').insert({
            contract_id: contractId,
            name: standardName,
            url: driveFile.webViewLink || GoogleDriveService.getFolderUrl(driveFile.id),
            file_path: null,
            type: `drive:${blob.type || 'application/octet-stream'}`,
            size: blob.size
        }).select().single();

        if (error) throw error;

        // Auto-register vào Document Registry
        try {
            const docCategoryMap: Record<string, string> = { HopDong: 'contract', PAKD: 'invoice', HoaDon: 'invoice', BaoCao: 'report' };
            const driveUrl = driveFile.webViewLink || '';
            await DocumentRegistryService.create({
                title: standardName,
                docCategory: (docCategoryMap[folderType] || 'general') as any,
                sourceType: 'drive',
                sourceUrl: driveUrl,
                driveFileId: driveFile.id,
                fileName: standardName,
                mimeType: blob.type,
                fileSize: blob.size,
                entityType: 'contract',
                entityId: contractId,
            });
        } catch (regErr) {
            console.warn('[DocumentService] Auto-register blob to registry failed:', regErr);
        }

        return {
            id: data.id,
            contractId: data.contract_id,
            name: data.name,
            url: data.url,
            filePath: data.file_path,
            type: data.type,
            size: data.size,
            uploadedAt: data.uploaded_at
        };
    }
};
