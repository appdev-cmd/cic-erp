/**
 * Represents a customer/client organization
 */
export interface Customer {
  id: string;
  name: string;
  shortName: string;
  industry: string[];
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxCode?: string;
  website?: string;
  notes?: string;
  // Bank info for payments
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  foundedDate?: string;
  type?: 'Customer' | 'Supplier' | 'Both';
  // Extended info (from masothue/GPKD)
  internationalName?: string;  // Tên quốc tế
  representative?: string;     // Người đại diện pháp luật
  businessType?: string;       // Loại hình DN (Cty CP, TNHH, DNTN...)
  businessStatus?: string;     // Tình trạng (Đang hoạt động, Ngừng...)
  // CRM fields
  rating?: 'VIP' | 'Gold' | 'Standard' | 'Lead';
  source?: string; // Website, Referral, Cold call, Event, Partner
  paymentTerms?: string; // NET30, NET60, COD, Prepaid
  creditLimit?: number;
  stats?: {
    contractCount: number;
    totalValue: number;
    totalRevenue: number;
    activeContracts: number;
  };
}

/**
 * Represents a contact person at a customer/supplier organization
 */
export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  position?: string;
  department?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt?: string;
}

/**
 * Customer bank information (for payments)
 */
export interface CustomerBank {
  bankName: string;
  bankBranch?: string;
  accountNumber: string;
  accountHolder: string;
}
