// ============================================================
// Core HR Module — TypeScript Types
// Employee Contracts, Salary History, Qualifications, Assets
// ============================================================

// ── Employee Contracts (Hợp đồng lao động) ──

export type ContractType = 'indefinite' | 'definite' | 'seasonal' | 'probation' | 'appendix';
export type ContractStatus = 'active' | 'expired' | 'terminated' | 'renewed';

export interface EmployeeContract {
    id: string;
    employee_id: string;
    contract_number: string | null;
    contract_type: ContractType;
    start_date: string;
    end_date: string | null;
    basic_salary: number;
    allowances: Record<string, number>;
    insurance_salary: number;
    status: ContractStatus;
    signed_date: string | null;
    notes: string | null;
    attachment_url: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    employee_name?: string;
}

export interface CreateContractInput {
    employee_id: string;
    contract_number?: string;
    contract_type: ContractType;
    start_date: string;
    end_date?: string;
    basic_salary?: number;
    allowances?: Record<string, number>;
    insurance_salary?: number;
    signed_date?: string;
    notes?: string;
    attachment_url?: string;
}

// ── Salary History (Lịch sử lương) ──

export type SalaryChangeType = 'initial' | 'promotion' | 'adjust' | 'demotion' | 'review';

export interface SalaryHistory {
    id: string;
    employee_id: string;
    effective_date: string;
    basic_salary: number;
    insurance_salary: number;
    total_salary: number;
    change_type: SalaryChangeType;
    change_reason: string | null;
    approved_by: string | null;
    contract_id: string | null;
    notes: string | null;
    created_at: string;

    // Joined
    employee_name?: string;
    approver_name?: string;
}

export interface CreateSalaryHistoryInput {
    employee_id: string;
    effective_date: string;
    basic_salary: number;
    insurance_salary?: number;
    total_salary?: number;
    change_type: SalaryChangeType;
    change_reason?: string;
    approved_by?: string;
    contract_id?: string;
    notes?: string;
}

// ── Qualifications (Bằng cấp, chứng chỉ) ──

export type QualificationType = 'degree' | 'certificate' | 'license' | 'training';
export type QualificationGrade = 'excellent' | 'good' | 'average' | 'pass';

export interface EmployeeQualification {
    id: string;
    employee_id: string;
    type: QualificationType;
    name: string;
    institution: string | null;
    major: string | null;
    grade: QualificationGrade | null;
    issue_date: string | null;
    expiry_date: string | null;
    credential_id: string | null;
    attachment_url: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateQualificationInput {
    employee_id: string;
    type: QualificationType;
    name: string;
    institution?: string;
    major?: string;
    grade?: QualificationGrade;
    issue_date?: string;
    expiry_date?: string;
    credential_id?: string;
    attachment_url?: string;
    notes?: string;
}

// ── Employee Assets (Tài sản bàn giao) ──

export type AssetType = 'laptop' | 'phone' | 'monitor' | 'vehicle' | 'key' | 'card' | 'software' | 'other';
export type AssetCondition = 'new' | 'good' | 'fair' | 'poor' | 'damaged';
export type AssetStatus = 'assigned' | 'returned' | 'lost' | 'damaged' | 'disposed';

export interface EmployeeAsset {
    id: string;
    employee_id: string;
    asset_type: AssetType;
    asset_name: string;
    asset_code: string | null;
    serial_number: string | null;
    brand: string | null;
    model: string | null;
    purchase_date: string | null;
    purchase_value: number | null;
    handover_date: string;
    return_date: string | null;
    condition: AssetCondition;
    status: AssetStatus;
    assigned_by: string | null;
    notes: string | null;
    attachment_url: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    employee_name?: string;
    assigned_by_name?: string;
}

export interface CreateAssetInput {
    employee_id: string;
    asset_type: AssetType;
    asset_name: string;
    asset_code?: string;
    serial_number?: string;
    brand?: string;
    model?: string;
    purchase_date?: string;
    purchase_value?: number;
    handover_date?: string;
    return_date?: string;
    condition?: AssetCondition;
    assigned_by?: string;
    notes?: string;
    attachment_url?: string;
}
