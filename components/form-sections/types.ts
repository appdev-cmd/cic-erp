// Shared types for PersonnelForm sections
import { Unit } from '../../types';

export interface FormData {
    name: string;
    unitId: string;
    employeeCode: string;
    position: string;
    email: string;
    phone: string;
    telegram: string;
    telegram_verified?: boolean;
    dateJoined: string;
    avatar_url: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other' | '';
    address: string;
    education: string;
    specialization: string;
    certificates: string;
    idNumber: string;
    bankAccount: string;
    bankName: string;
    maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | '';
    emergencyContact: string;
    emergencyPhone: string;
    contractType: string;
    contractEndDate: string;
    target: { signing: number; revenue: number; adminProfit: number; revProfit: number; cash: number };
}

export interface FormSectionProps {
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    units?: Unit[];
    readOnly?: boolean; // When true, most fields are disabled (used in Personal Settings)
    isPersonalSettings?: boolean; // Special mode for Personal Settings dialog
}
