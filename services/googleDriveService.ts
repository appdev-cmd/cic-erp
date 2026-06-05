/**
 * Google Drive Service — CIC ERP
 * 
 * Wrapper for Google Drive API v3 REST endpoints.
 * Uses OAuth access token from sessionStorage (obtained via Supabase Google OAuth).
 * 
 * Scope required: https://www.googleapis.com/auth/drive.file 
 * (allows CRUD only on files/folders created by this app)
 */

import { getGoogleAccessToken } from '../contexts/AuthContext';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ============================================
// Types
// ============================================

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    webContentLink?: string;
    iconLink?: string;
    thumbnailLink?: string;
    size?: string;
    createdTime?: string;
    modifiedTime?: string;
    parents?: string[];
    shared?: boolean;
}

export interface DriveFolderMapping {
    entityType: 'root' | 'unit' | 'contract' | 'customer' | 'doctype' | 'year';
    entityId?: string;
    folderType?: string; // 'PAKD' | 'HopDong' | 'HoaDon' | 'BaoCao' | 'Templates'
    driveFolderId: string;
    driveFolderUrl?: string;
}

export interface DrivePermission {
    role: 'reader' | 'writer' | 'commenter' | 'owner';
    type: 'user' | 'group' | 'domain' | 'anyone';
    emailAddress?: string;
    domain?: string;
}

/** Standard subfolder structure for Business Units */
export const BUSINESS_UNIT_SUBFOLDERS = ['HopDong', 'BaoCao', 'Templates'] as const;

/** Standard subfolder structure for Admin Units (HĐQT, BGĐ, TCKT, HCNS) */
export const ADMIN_UNIT_SUBFOLDERS = ['VanBan', 'BaoCao', 'Templates'] as const;
/** 
 * Maps unit IDs to their folder prefix names 
 * - Admin Units: HĐQT, BGĐ, P-HCNS, P-TCKT
 * - Business Units: Everything else
 */
export const UNIT_FOLDER_MAP: Record<string, string> = {
    'hdqt': 'HDQT',
    'bgd': 'BGD',
    'hcns': 'P-HCNS',
    'tckt': 'P-TCKT',
    'hcm': 'CN-HCM',
    'bim': 'TT-BIM',
    'css': 'TT-CSS',
    'dcs': 'TT-DCS',
    'pmxd': 'TT-PMXD',
    'stc': 'TT-STC',
    'tvda': 'TT-TVDA',
    'tvtk': 'TT-TVTK',
};

/** List of Admin Unit IDs */
export const ADMIN_UNIT_IDS = ['hdqt', 'bgd', 'hcns', 'tckt'];

/** Global (non-unit) folders */
export const GLOBAL_FOLDERS = ['_KhachHang', '_NhanSu', '_BaoCaoTongHop', '_Templates'] as const;

/** Root folder name */
export const ROOT_FOLDER_NAME = 'CIC-Document';

/** Helper to get subfolders for a specific unit */
export function getUnitSubfolders(unitId: string): readonly string[] {
    if (ADMIN_UNIT_IDS.includes(unitId)) {
        return ADMIN_UNIT_SUBFOLDERS;
    }
    return BUSINESS_UNIT_SUBFOLDERS;
}

// ============================================
// Token Helper
// ============================================

function getToken(): string {
    const token = getGoogleAccessToken();
    if (!token) {
        throw new Error(
            'Google Drive token không khả dụng. Vui lòng đăng nhập lại với Google.'
        );
    }
    return token;
}

async function driveRequest<T = any>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error('[GoogleDrive] API Error:', response.status, errorBody);

        if (response.status === 401) {
            // Token expired — clear and prompt re-login
            sessionStorage.removeItem('google_provider_token');
            throw new Error('Google token hết hạn. Vui lòng đăng nhập lại.');
        }

        throw new Error(`Google Drive API error (${response.status}): ${errorBody}`);
    }

    // Some endpoints (delete) return empty body
    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
}

// ============================================
// Folder Operations
// ============================================

export const GoogleDriveService = {
    /**
     * Create a folder in Google Drive
     */
    async createFolder(name: string, parentId?: string): Promise<DriveFile> {
        const metadata: any = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentId) {
            metadata.parents = [parentId];
        }

        return driveRequest<DriveFile>(`${DRIVE_API}/files?fields=id,name,mimeType,webViewLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata),
        });
    },

    /**
     * Find a folder by name inside a parent folder.
     * Returns the first match or null.
     */
    async findFolder(name: string, parentId?: string): Promise<DriveFile | null> {
        let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        if (parentId) {
            q += ` and '${parentId}' in parents`;
        }

        const result = await driveRequest<{ files: DriveFile[] }>(
            `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink)&pageSize=1`
        );

        return result.files?.[0] || null;
    },

    /**
     * Get or create a folder — ensures it exists.
     * Returns the folder's Drive file ID.
     */
    async getOrCreateFolder(name: string, parentId?: string): Promise<DriveFile> {
        const existing = await this.findFolder(name, parentId);
        if (existing) return existing;
        return this.createFolder(name, parentId);
    },

    /**
     * Create an entire folder path, returning the leaf folder.
     * Example: getOrCreatePath(['CIC-Document', 'TT-BIM', 'HopDong', '2026'])
     */
    async getOrCreatePath(pathSegments: string[]): Promise<DriveFile> {
        let parentId: string | undefined;
        let lastFolder: DriveFile | null = null;

        for (const segment of pathSegments) {
            lastFolder = await this.getOrCreateFolder(segment, parentId);
            parentId = lastFolder.id;
        }

        if (!lastFolder) {
            throw new Error('Path segments cannot be empty');
        }

        return lastFolder;
    },

    // ============================================
    // File Operations
    // ============================================

    /**
     * Upload a file to Google Drive using multipart upload.
     */
    async uploadFile(
        file: File,
        folderId: string,
        customName?: string
    ): Promise<DriveFile> {
        const metadata = {
            name: customName || file.name,
            parents: [folderId],
        };

        // Build multipart body
        const boundary = '-------DriveUploadBoundary';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;

        const fileArrayBuffer = await file.arrayBuffer();

        // Combine parts
        const encoder = new TextEncoder();
        const metadataBytes = encoder.encode(metadataPart);
        const fileHeaderBytes = encoder.encode(
            `${delimiter}Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`
        );
        const closeBytes = encoder.encode(closeDelimiter);

        const body = new Uint8Array(
            metadataBytes.length + fileHeaderBytes.length + fileArrayBuffer.byteLength + closeBytes.length
        );
        body.set(metadataBytes, 0);
        body.set(fileHeaderBytes, metadataBytes.length);
        body.set(new Uint8Array(fileArrayBuffer), metadataBytes.length + fileHeaderBytes.length);
        body.set(closeBytes, metadataBytes.length + fileHeaderBytes.length + fileArrayBuffer.byteLength);

        return driveRequest<DriveFile>(
            `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                },
                body: body,
            }
        );
    },

    /**
     * Upload a Blob (e.g., generated PDF/Excel) to Drive.
     */
    async uploadBlob(
        blob: Blob,
        fileName: string,
        folderId: string,
        mimeType?: string
    ): Promise<DriveFile> {
        const file = new File([blob], fileName, { type: mimeType || blob.type });
        return this.uploadFile(file, folderId, fileName);
    },

    /**
     * List files in a folder.
     */
    async listFiles(
        folderId: string,
        options?: { pageSize?: number; query?: string; orderBy?: string }
    ): Promise<DriveFile[]> {
        const pageSize = options?.pageSize || 100;
        let q = `'${folderId}' in parents and trashed=false`;
        if (options?.query) {
            q += ` and ${options.query}`;
        }

        const orderBy = options?.orderBy || 'folder,name';
        const fields = 'files(id,name,mimeType,webViewLink,webContentLink,iconLink,thumbnailLink,size,createdTime,modifiedTime,parents,shared)';

        const result = await driveRequest<{ files: DriveFile[] }>(
            `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${fields}&pageSize=${pageSize}&orderBy=${orderBy}`
        );

        return result.files || [];
    },

    /**
     * Get a single file's metadata.
     */
    async getFile(fileId: string): Promise<DriveFile> {
        return driveRequest<DriveFile>(
            `${DRIVE_API}/files/${fileId}?fields=id,name,mimeType,webViewLink,webContentLink,iconLink,thumbnailLink,size,createdTime,modifiedTime,parents`
        );
    },

    /**
     * Delete a file or folder (move to trash).
     */
    async deleteFile(fileId: string): Promise<void> {
        // Trash instead of permanent delete for safety
        await driveRequest(`${DRIVE_API}/files/${fileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true }),
        });
    },

    /**
     * Move a file to a different folder.
     */
    async moveFile(fileId: string, newParentId: string, currentParentId?: string): Promise<DriveFile> {
        let url = `${DRIVE_API}/files/${fileId}?addParents=${newParentId}&fields=id,name,webViewLink,parents`;
        if (currentParentId) {
            url += `&removeParents=${currentParentId}`;
        }
        return driveRequest<DriveFile>(url, { method: 'PATCH' });
    },

    // ============================================
    // Sharing / Permissions
    // ============================================

    /**
     * Share a file/folder with a specific user.
     */
    async shareWithUser(
        fileId: string,
        email: string,
        role: 'reader' | 'writer' | 'commenter' = 'reader',
        sendNotification = false
    ): Promise<void> {
        await driveRequest(
            `${DRIVE_API}/files/${fileId}/permissions?sendNotificationEmail=${sendNotification}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role,
                    type: 'user',
                    emailAddress: email,
                }),
            }
        );
    },

    /**
     * Share with an entire domain (Workspace).
     */
    async shareWithDomain(
        fileId: string,
        domain: string,
        role: 'reader' | 'writer' | 'commenter' = 'reader'
    ): Promise<void> {
        await driveRequest(
            `${DRIVE_API}/files/${fileId}/permissions`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role,
                    type: 'domain',
                    domain,
                }),
            }
        );
    },

    /**
     * List permissions for a file/folder.
     */
    async listPermissions(fileId: string): Promise<any[]> {
        const result = await driveRequest<{ permissions: any[] }>(
            `${DRIVE_API}/files/${fileId}/permissions?fields=permissions(id,role,type,emailAddress,domain,displayName)`
        );
        return result.permissions || [];
    },

    /**
     * Remove a permission from a file/folder.
     */
    async removePermission(fileId: string, permissionId: string): Promise<void> {
        await driveRequest(`${DRIVE_API}/files/${fileId}/permissions/${permissionId}`, {
            method: 'DELETE',
        });
    },

    // ============================================
    // Path Builders (CIC-Document specific)
    // ============================================

    /**
     * Build the folder path segments for a contract.
     * Result: ['CIC-Document', '{UnitPrefix}', 'HopDong', '{Year}', '{ContractFolder}']
     */
    buildContractFolderPath(
        unitId: string,
        contractId: string,
        projectName: string,
        year?: number
    ): string[] {
        const unitPrefix = UNIT_FOLDER_MAP[unitId] || unitId.toUpperCase();
        const y = year || new Date().getFullYear();
        const sanitized = projectName.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 80);
        return [ROOT_FOLDER_NAME, unitPrefix, 'HopDong', String(y), `${contractId}_${sanitized}`];
    },

    /**
     * Build path for PAKD folder (Nested inside Contract).
     * Path: .../HopDong/{Year}/{Contract}/PAKD
     */
    buildPAKDFolderPath(
        unitId: string,
        contractId: string,
        contractName: string, // Changed from customerName for consistency with Contract Folder
        year?: number
    ): string[] {
        const contractPath = this.buildContractFolderPath(unitId, contractId, contractName, year);
        return [...contractPath, 'PAKD'];
    },

    /**
     * Build path for Invoice (HoaDon) folder (Nested inside Contract).
     * Path: .../HopDong/{Year}/{Contract}/HoaDon
     */
    buildInvoiceFolderPath(
        unitId: string,
        contractId: string,
        contractName: string,
        year?: number
    ): string[] {
        const contractPath = this.buildContractFolderPath(unitId, contractId, contractName, year);
        return [...contractPath, 'HoaDon'];
    },

    /**
     * Build path for employee folder.
     * Path: ['CIC-Document', '_NhanSu', '{employee_id}_{employee_name}']
     */
    buildEmployeeFolderPath(employeeId: string, employeeName: string): string[] {
        const sanitized = employeeName.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 80);
        return [ROOT_FOLDER_NAME, '_NhanSu', `${employeeId}_${sanitized}`];
    },

    /**
     * Build path for unit root folder.
     */
    buildUnitFolderPath(unitId: string): string[] {
        const unitPrefix = UNIT_FOLDER_MAP[unitId] || unitId.toUpperCase();
        return [ROOT_FOLDER_NAME, unitPrefix];
    },

    /**
     * Get the Drive URL for a folder.
     */
    getFolderUrl(folderId: string): string {
        return `https://drive.google.com/drive/folders/${folderId}`;
    },
};

export default GoogleDriveService;
