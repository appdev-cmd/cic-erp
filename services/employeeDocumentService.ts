import { dataClient as supabase } from '../lib/dataClient';
import { DocumentRegistryService } from './documentRegistryService';

export interface EmployeeDocument {
    id: string;
    employeeId: string;
    name: string;
    docType: 'certificate' | 'degree' | 'contract' | 'id_card' | 'other';
    description: string;
    url: string;
    issuedDate: string;
    expiryDate: string;
    createdAt: string;
    updatedAt: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
    certificate: 'Chứng chỉ',
    degree: 'Bằng cấp',
    contract: 'Hợp đồng lao động',
    id_card: 'Giấy tờ tùy thân',
    other: 'Khác',
};

const mapDoc = (d: any): EmployeeDocument => ({
    id: d.id,
    employeeId: d.employee_id,
    name: d.name || '',
    docType: d.doc_type || 'other',
    description: d.description || '',
    url: d.url || '',
    issuedDate: d.issued_date || '',
    expiryDate: d.expiry_date || '',
    createdAt: d.created_at || '',
    updatedAt: d.updated_at || '',
});

export const EmployeeDocumentService = {
    DOC_TYPE_LABELS,

    getByEmployeeId: async (employeeId: string): Promise<EmployeeDocument[]> => {
        const { data, error } = await supabase
            .from('employee_documents')
            .select('*')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDoc);
    },

    create: async (payload: Omit<EmployeeDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeDocument> => {
        const { data, error } = await supabase
            .from('employee_documents')
            .insert({
                employee_id: payload.employeeId,
                name: payload.name,
                doc_type: payload.docType,
                description: payload.description || null,
                url: payload.url || null,
                issued_date: payload.issuedDate || null,
                expiry_date: payload.expiryDate || null,
            })
            .select()
            .single();
        if (error) throw error;

        // Auto-register vào Document Registry
        try {
            await DocumentRegistryService.create({
                title: payload.name,
                docCategory: 'hr',
                sourceType: payload.url ? 'external_link' : 'pasted_text',
                sourceUrl: payload.url || undefined,
                fileName: payload.name,
                entityType: 'employee',
                entityId: payload.employeeId,
            });
        } catch (regErr) {
            console.warn('[EmployeeDocService] Auto-register failed:', regErr);
        }

        return mapDoc(data);
    },

    update: async (id: string, payload: Partial<EmployeeDocument>): Promise<EmployeeDocument> => {
        const dbPayload: any = {};
        if (payload.name !== undefined) dbPayload.name = payload.name;
        if (payload.docType !== undefined) dbPayload.doc_type = payload.docType;
        if (payload.description !== undefined) dbPayload.description = payload.description;
        if (payload.url !== undefined) dbPayload.url = payload.url;
        if (payload.issuedDate !== undefined) dbPayload.issued_date = payload.issuedDate || null;
        if (payload.expiryDate !== undefined) dbPayload.expiry_date = payload.expiryDate || null;

        const { data, error } = await supabase
            .from('employee_documents')
            .update(dbPayload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapDoc(data);
    },

    delete: async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('employee_documents').delete().eq('id', id);
        if (error) throw error;
        return true;
    },
};
