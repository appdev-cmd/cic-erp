import type { KPIPlan } from './common';

export interface Employee {
  id: string;
  name: string;
  unitId: string;
  avatar?: string;
  target: KPIPlan;
  // General info
  email?: string;
  phone?: string;
  telegram?: string; // Tài khoản Telegram
  telegram_verified?: boolean;
  position?: string; // Chức vụ
  department?: string; // Phòng ban / Khối
  roleCode?: string; // Mã role hệ thống
  dateJoined?: string; // Ngày vào công ty
  employeeCode?: string; // Mã nhân viên
  slug?: string; // URL-friendly slug (auto-generated from name)
  // HR fields
  dateOfBirth?: string; // Ngày sinh
  gender?: 'male' | 'female' | 'other';
  address?: string; // Địa chỉ
  education?: string; // Trình độ học vấn
  specialization?: string; // Chuyên ngành
  certificates?: string; // Chứng chỉ
  idNumber?: string; // CCCD/CMND
  bankAccount?: string; // Số tài khoản (thuộc hợp đồng)
  bankName?: string; // Tên ngân hàng (thuộc hợp đồng)
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  emergencyContact?: string; // Người liên hệ khẩn cấp
  emergencyPhone?: string; // SĐT khẩn cấp
  contractType?: string; // Loại hợp đồng LĐ
  contractEndDate?: string; // Ngày hết hạn HĐ
}

export interface Unit {
  id: string;
  name: string;
  type: 'Company' | 'Branch' | 'Center' | 'BackOffice';
  code: string;
  target: KPIPlan;
  lastYearActual?: KPIPlan; // Dữ liệu năm trước để so sánh YoY
  functions?: string; // Chức năng nhiệm vụ
  // New fields from Phase 2 enhancement
  managerId?: string; // ID of unit manager (references employees)
  logoUrl?: string; // URL to unit logo/avatar
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  parentId?: string; // Parent unit for org chart hierarchy
  sortOrder?: number;
  isActive?: boolean;
  targetMembers?: string[]; // Employee IDs assigned to KPI/signing tab
  createdAt?: string;
  updatedAt?: string;
}
