import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Settings,
  BrainCircuit,
  PieChart,
  Users,
  Building2,
  Package,
  HelpCircle,
  FolderOpen,
  Wrench,
  MessageCircle
} from 'lucide-react';
import { Contract, Unit, ImplementationStage, ContractType, Employee, Customer, Product, ProductCategory, Payment, PaymentStatus, PaymentMethod, UserRole, PlanStatus } from './types';

export const ROLE_LABELS: Record<UserRole, string> = {
  'NVKD': 'Nhân viên Kinh doanh',
  'UnitLeader': 'Lãnh đạo Đơn vị',
  'AdminUnit': 'Quản trị Đơn vị',
  'Accountant': 'Kế toán Viễn thông',
  'ChiefAccountant': 'Kế toán trưởng',
  'Legal': 'Ban Pháp chế',
  'Leadership': 'Ban Lãnh đạo',
  'Admin': 'Quản trị viên'
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  'Draft': 'Nháp (Soạn thảo)',
  'Pending_Unit': 'Chờ Đơn vị duyệt',
  'Pending_Finance': 'Chờ Kế toán duyệt',
  'Pending_Board': 'Chờ Lãnh đạo duyệt',
  'Approved': 'Đã phê duyệt',
  'Rejected': 'Từ chối'
};

export const NON_BUSINESS_UNIT_CODES = ['HCNS', 'TCKT'];

export const INDUSTRIES = [
  'Xây dựng', 'Bất động sản', 'Năng lượng', 'Công nghệ', 'Sản xuất',
  'Thương mại', 'Dịch vụ', 'Giáo dục', 'Y tế', 'Khác'
] as const;

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  'Processing': 'Đang thực hiện',
  'Suspended': 'Tạm dừng',
  'Acceptance': 'Nghiệm thu',
  'Liquidated': 'Thanh lý',
  'Completed': 'Hoàn thành',
  // Legacy statuses (for backward compatibility with old data)
  'Active': 'Đang thực hiện',
  'Pending': 'Đang thực hiện',
  'Reviewing': 'Đang thực hiện',
  'Expired': 'Hoàn thành',
  'Draft': 'Đang thực hiện',
  'Terminated': 'Hoàn thành',
  'Cancelled': 'Hoàn thành',
};

export const MOCK_UNITS: Unit[] = [
  {
    id: 'all',
    name: 'Toàn công ty',
    type: 'Company',
    code: 'ALL',
    target: { signing: 250e9, revenue: 200e9, adminProfit: 70e9, revProfit: 60e9, cash: 180e9 },
    lastYearActual: { signing: 220e9, revenue: 180e9, adminProfit: 62e9, revProfit: 55e9, cash: 165e9 }
  },
  {
    id: 'dcs',
    name: 'Trung tâm DCS',
    type: 'Center',
    code: 'DCS',
    target: { signing: 45e9, revenue: 38e9, adminProfit: 14e9, revProfit: 12e9, cash: 35e9 },
    lastYearActual: { signing: 40e9, revenue: 34e9, adminProfit: 12.5e9, revProfit: 10.5e9, cash: 30e9 }
  },
  {
    id: 'stc',
    name: 'Trung tâm STC',
    type: 'Center',
    code: 'STC',
    target: { signing: 35e9, revenue: 28e9, adminProfit: 10e9, revProfit: 8.5e9, cash: 25e9 },
    lastYearActual: { signing: 30e9, revenue: 25e9, adminProfit: 9e9, revProfit: 7.8e9, cash: 22e9 }
  },
  {
    id: 'css',
    name: 'Trung tâm CSS',
    type: 'Center',
    code: 'CSS',
    target: { signing: 40e9, revenue: 32e9, adminProfit: 11e9, revProfit: 9.5e9, cash: 30e9 },
    lastYearActual: { signing: 36e9, revenue: 30e9, adminProfit: 10e9, revProfit: 8.8e9, cash: 28e9 }
  },
  {
    id: 'bim',
    name: 'Trung tâm BIM',
    type: 'Center',
    code: 'BIM',
    target: { signing: 25e9, revenue: 20e9, adminProfit: 8e9, revProfit: 7e9, cash: 18e9 },
    lastYearActual: { signing: 22e9, revenue: 18e9, adminProfit: 7e9, revProfit: 6.2e9, cash: 16e9 }
  },
  {
    id: 'pmxd',
    name: 'Trung tâm PMXD',
    type: 'Center',
    code: 'PMXD',
    target: { signing: 30e9, revenue: 25e9, adminProfit: 9e9, revProfit: 8e9, cash: 22e9 },
    lastYearActual: { signing: 28e9, revenue: 22e9, adminProfit: 8e9, revProfit: 7e9, cash: 20e9 }
  },
  {
    id: 'tvtk',
    name: 'Trung tâm TVTK',
    type: 'Center',
    code: 'TVTK',
    target: { signing: 20e9, revenue: 16e9, adminProfit: 6e9, revProfit: 5e9, cash: 14e9 },
    lastYearActual: { signing: 18e9, revenue: 14e9, adminProfit: 5.5e9, revProfit: 4.5e9, cash: 12e9 }
  },
  {
    id: 'tvda',
    name: 'Trung tâm TVDA',
    type: 'Center',
    code: 'TVDA',
    target: { signing: 25e9, revenue: 20e9, adminProfit: 7.5e9, revProfit: 6.5e9, cash: 18e9 },
    lastYearActual: { signing: 23e9, revenue: 19e9, adminProfit: 7e9, revProfit: 6e9, cash: 17e9 }
  },
  {
    id: 'hcm',
    name: 'Chi nhánh HCM',
    type: 'Branch',
    code: 'HCM',
    target: { signing: 30e9, revenue: 21e9, adminProfit: 8.5e9, revProfit: 7.5e9, cash: 18e9 },
    lastYearActual: { signing: 25e9, revenue: 18e9, adminProfit: 7.5e9, revProfit: 6.5e9, cash: 15e9 }
  },
];

export const MOCK_SALESPEOPLE: Employee[] = [
  // DCS
  { id: 's1', name: 'Nguyễn Văn A', unitId: 'dcs', employeeCode: 'NV001', position: 'Trưởng phòng Kinh doanh', email: 'a.nguyen@cic.com.vn', phone: '0912 345 678', dateJoined: '2020-03-15', target: { signing: 15e9, revenue: 12e9, adminProfit: 4.5e9, revProfit: 3.8e9, cash: 11e9 } },
  { id: 's2', name: 'Trần Thị B', unitId: 'dcs', employeeCode: 'NV002', position: 'Chuyên viên Sales', email: 'b.tran@cic.com.vn', phone: '0923 456 789', dateJoined: '2021-06-01', target: { signing: 12e9, revenue: 10e9, adminProfit: 3.5e9, revProfit: 3e9, cash: 9e9 } },
  { id: 's3', name: 'Phạm Văn X', unitId: 'dcs', employeeCode: 'NV003', position: 'Senior Sales Executive', email: 'x.pham@cic.com.vn', phone: '0934 567 890', dateJoined: '2019-01-10', target: { signing: 18e9, revenue: 16e9, adminProfit: 6e9, revProfit: 5.2e9, cash: 15e9 } },
  // STC
  { id: 's4', name: 'Lê Văn C', unitId: 'stc', employeeCode: 'NV004', position: 'Chuyên viên Sales', email: 'c.le@cic.com.vn', phone: '0945 678 901', dateJoined: '2022-02-20', target: { signing: 10e9, revenue: 8e9, adminProfit: 3e9, revProfit: 2.5e9, cash: 7e9 } },
  { id: 's5', name: 'Hoàng Thị D', unitId: 'stc', employeeCode: 'NV005', position: 'Trưởng nhóm Sales', email: 'd.hoang@cic.com.vn', phone: '0956 789 012', dateJoined: '2020-08-05', target: { signing: 15e9, revenue: 12e9, adminProfit: 4.5e9, revProfit: 4e9, cash: 10e9 } },
  // CSS
  { id: 's6', name: 'Vũ Văn E', unitId: 'css', employeeCode: 'NV006', position: 'Giám đốc Kinh doanh', email: 'e.vu@cic.com.vn', phone: '0967 890 123', dateJoined: '2018-05-12', target: { signing: 20e9, revenue: 16e9, adminProfit: 5.5e9, revProfit: 4.8e9, cash: 15e9 } },
  { id: 's7', name: 'Đặng Thị F', unitId: 'css', employeeCode: 'NV007', position: 'Senior Sales Executive', email: 'f.dang@cic.com.vn', phone: '0978 901 234', dateJoined: '2019-11-25', target: { signing: 20e9, revenue: 16e9, adminProfit: 5.5e9, revProfit: 4.8e9, cash: 15e9 } },
  // BIM
  { id: 's8', name: 'Bùi Văn G', unitId: 'bim', employeeCode: 'NV008', position: 'Trưởng phòng BIM Sales', email: 'g.bui@cic.com.vn', phone: '0989 012 345', dateJoined: '2020-04-18', target: { signing: 12e9, revenue: 10e9, adminProfit: 4e9, revProfit: 3.5e9, cash: 9e9 } },
  { id: 's9', name: 'Lý Thị H', unitId: 'bim', employeeCode: 'NV009', position: 'Chuyên viên Sales', email: 'h.ly@cic.com.vn', phone: '0990 123 456', dateJoined: '2021-09-08', target: { signing: 13e9, revenue: 10e9, adminProfit: 4e9, revProfit: 3.5e9, cash: 9e9 } },
  // PMXD
  { id: 's10', name: 'Ngô Văn I', unitId: 'pmxd', employeeCode: 'NV010', position: 'Trưởng nhóm Sales', email: 'i.ngo@cic.com.vn', phone: '0901 234 567', dateJoined: '2019-07-22', target: { signing: 15e9, revenue: 12e9, adminProfit: 4.5e9, revProfit: 4e9, cash: 11e9 } },
  { id: 's11', name: 'Mai Thị K', unitId: 'pmxd', employeeCode: 'NV011', position: 'Chuyên viên Sales', email: 'k.mai@cic.com.vn', phone: '0912 345 679', dateJoined: '2022-01-15', target: { signing: 15e9, revenue: 13e9, adminProfit: 4.5e9, revProfit: 4e9, cash: 11e9 } },
  // TVTK
  { id: 's12', name: 'Trịnh Văn L', unitId: 'tvtk', employeeCode: 'NV012', position: 'Chuyên viên Sales', email: 'l.trinh@cic.com.vn', phone: '0923 456 780', dateJoined: '2021-03-10', target: { signing: 10e9, revenue: 8e9, adminProfit: 3e9, revProfit: 2.5e9, cash: 7e9 } },
  // TVDA
  { id: 's13', name: 'Phan Thị M', unitId: 'tvda', employeeCode: 'NV013', position: 'Trưởng phòng Dự án', email: 'm.phan@cic.com.vn', phone: '0934 567 891', dateJoined: '2019-12-01', target: { signing: 12e9, revenue: 10e9, adminProfit: 3.5e9, revProfit: 3.2e9, cash: 9e9 } },
  { id: 's14', name: 'Hồ Văn N', unitId: 'tvda', employeeCode: 'NV014', position: 'Chuyên viên Sales', email: 'n.ho@cic.com.vn', phone: '0945 678 902', dateJoined: '2020-10-20', target: { signing: 13e9, revenue: 10e9, adminProfit: 4e9, revProfit: 3.3e9, cash: 9e9 } },
  // HCM
  { id: 's15', name: 'Võ Thị O', unitId: 'hcm', employeeCode: 'NV015', position: 'Giám đốc Chi nhánh', email: 'o.vo@cic.com.vn', phone: '0956 789 013', dateJoined: '2018-02-28', target: { signing: 15e9, revenue: 10e9, adminProfit: 4.2e9, revProfit: 3.7e9, cash: 9e9 } },
  { id: 's16', name: 'Đỗ Văn P', unitId: 'hcm', employeeCode: 'NV016', position: 'Senior Sales Executive', email: 'p.do@cic.com.vn', phone: '0967 890 124', dateJoined: '2020-06-15', target: { signing: 15e9, revenue: 11e9, adminProfit: 4.3e9, revProfit: 3.8e9, cash: 9e9 } },
];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard size={20} /> },
  { id: 'contracts', label: 'Hợp đồng', icon: <FileText size={20} /> },
  { id: 'payments', label: 'Tài chính', icon: <Package size={20} /> },
  { id: 'analytics', label: 'Thống kê', icon: <PieChart size={20} /> },
  { id: 'ai-assistant', label: 'AI Phân tích', icon: <BrainCircuit size={20} /> },
  { id: 'tools', label: 'Công cụ', icon: <Wrench size={20} /> },
  { id: 'chat', label: 'Chat', icon: <MessageCircle size={20} /> },
  { id: 'documents', label: 'Tài liệu', icon: <FolderOpen size={20} /> },

  // Danh mục
  { id: 'units', label: 'Đơn vị', icon: <Building2 size={20} /> },
  { id: 'personnel', label: 'Nhân sự', icon: <Users size={20} /> },
  { id: 'products', label: 'Sản phẩm/DV', icon: <Package size={20} /> },
  { id: 'customers', label: 'Khách hàng', icon: <Building2 size={20} /> },
  { id: 'user-guide', label: 'Hướng dẫn', icon: <HelpCircle size={20} /> },

  { id: 'settings', label: 'Cài đặt', icon: <Settings size={20} /> },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'FECON Corporation', shortName: 'FECON', industry: ['Xây dựng'], contactPerson: 'Nguyễn Văn Hùng', phone: '024 3784 5678', email: 'hung.nv@fecon.com.vn', address: 'Tầng 15, Tòa nhà FECON, Cầu Giấy, Hà Nội', taxCode: '0100102030', bankName: 'Vietcombank', bankAccount: '1234567890123' },
  { id: 'c2', name: 'Vingroup JSC', shortName: 'VIN', industry: ['Bất động sản'], contactPerson: 'Trần Minh Đức', phone: '024 3974 9999', email: 'duc.tm@vingroup.net', address: 'Tòa nhà Vinhomes Metropolis, Ba Đình, Hà Nội', taxCode: '0100103040', bankName: 'BIDV', bankAccount: '2345678901234' },
  { id: 'c3', name: 'Sun Group', shortName: 'SUN', industry: ['Bất động sản'], contactPerson: 'Lê Thị Hương', phone: '024 3222 8888', email: 'huong.lt@sungroup.com.vn', address: 'Tầng 25, Sunshine Tower, Hai Bà Trưng, Hà Nội', taxCode: '0100104050', bankName: 'Vietinbank', bankAccount: '3456789012345' },
  { id: 'c4', name: 'COTECCONS Construction', shortName: 'COTEC', industry: ['Xây dựng'], contactPerson: 'Phạm Quốc Bảo', phone: '028 3822 6666', email: 'bao.pq@coteccons.vn', address: 'Tầng 18, Vincom Center, Quận 1, TP.HCM', taxCode: '0302345678', bankName: 'ACB', bankAccount: '4567890123456' },
  { id: 'c5', name: 'Delta Group', shortName: 'DELTA', industry: ['Xây dựng'], contactPerson: 'Hoàng Văn Tiến', phone: '028 3930 5555', email: 'tien.hv@delta.com.vn', address: 'Quận 7, TP.HCM', taxCode: '0302456789', bankName: 'Techcombank', bankAccount: '5678901234567' },
  { id: 'c6', name: 'Novaland Group', shortName: 'NOVA', industry: ['Bất động sản'], contactPerson: 'Vũ Thị Mai', phone: '028 3821 7777', email: 'mai.vt@novaland.com.vn', address: 'Tầng 20, The Manor, Quận Bình Thạnh, TP.HCM', taxCode: '0302567890', bankName: 'MB Bank', bankAccount: '6789012345678' },
  { id: 'c7', name: 'GELEX Group', shortName: 'GELEX', industry: ['Năng lượng'], contactPerson: 'Đặng Minh Tuấn', phone: '024 3512 4444', email: 'tuan.dm@gelex.com.vn', address: 'Tầng 10, Gelex Tower, Hoàng Mai, Hà Nội', taxCode: '0100205060', bankName: 'VPBank', bankAccount: '7890123456789' },
  { id: 'c8', name: 'Ree Corporation', shortName: 'REEE', industry: ['Năng lượng'], contactPerson: 'Bùi Văn Long', phone: '028 3829 3333', email: 'long.bv@reecorp.com', address: 'Quận 4, TP.HCM', taxCode: '0302678901', bankName: 'Sacombank', bankAccount: '8901234567890' },
  { id: 'c9', name: 'MAS Group', shortName: 'MAS', industry: ['Công nghệ'], contactPerson: 'Lý Thị Ngọc', phone: '024 3636 2222', email: 'ngoc.lt@masgroup.vn', address: 'Cầu Giấy, Hà Nội', taxCode: '0100306070', bankName: 'TPBank', bankAccount: '9012345678901' },
  { id: 'c10', name: 'FPT Corporation', shortName: 'FPT', industry: ['Công nghệ'], contactPerson: 'Ngô Văn Khoa', phone: '024 7300 8888', email: 'khoa.nv@fpt.com.vn', address: 'Tòa nhà FPT Tower, Nam Từ Liêm, Hà Nội', taxCode: '0100407080', bankName: 'Vietcombank', bankAccount: '0123456789012' },
  { id: 'c11', name: 'Hòa Phát Group', shortName: 'HPG', industry: ['Sản xuất'], contactPerson: 'Mai Văn Thành', phone: '024 3628 1111', email: 'thanh.mv@hoaphat.com.vn', address: 'Khu CN Phố Nối, Hưng Yên', taxCode: '0500123456', bankName: 'BIDV', bankAccount: '1234509876543' },
  { id: 'c12', name: 'Tập đoàn Xây dựng Hà Nội', shortName: 'HANCORP', industry: ['Xây dựng'], contactPerson: 'Trịnh Công Sơn', phone: '024 3825 0000', email: 'son.tc@hancorp.com.vn', address: 'Đống Đa, Hà Nội', taxCode: '0100508090', bankName: 'Agribank', bankAccount: '2345609876543' },
];

// Customer shortName to ID mapping
const customerIdMap: Record<string, string> = {
  'FECON': 'c1', 'VIN': 'c2', 'SUN': 'c3', 'COTEC': 'c4', 'DELTA': 'c5',
  'NOVA': 'c6', 'GELEX': 'c7', 'REEE': 'c8', 'MAS': 'c9', 'FPT': 'c10',
  'HPG': 'c11', 'HANCORP': 'c12'
};

// MOCK_PRODUCTS removed - replaced by ProductsAPI
const generateMockContracts = (): Contract[] => {
  const contracts: Contract[] = [];
  const clients = ['FECON', 'VIN', 'SUN', 'COTEC', 'DELTA', 'NOVA', 'GELEX', 'REEE', 'MAS'];
  const stages: ImplementationStage[] = ['Signed', 'Implementation', 'Completed', 'Invoiced'];
  const units = MOCK_UNITS.filter(u => u.id !== 'all');

  // Generate around 400 contracts spread across all units
  for (let i = 1; i <= 400; i++) {
    const unit = units[i % units.length];
    const unitSales = MOCK_SALESPEOPLE.filter(s => s.unitId === unit.id);
    const salesperson = unitSales.length > 0 ? unitSales[i % unitSales.length] : { id: 'unknown', name: 'N/A' };
    const client = clients[i % clients.length];
    const year = 2024;

    // Scale value based on unit size and random factor
    const baseVal = unit.target.signing / 40;
    const value = baseVal * (0.5 + Math.random() * 1.5);
    const actualRevenue = value * (0.3 + Math.random() * 0.7);

    // Profit calculations
    const margin = 0.2 + Math.random() * 0.3; // 20-50% margin
    const actualCost = actualRevenue * (1 - margin);
    const estimatedCost = value * (1 - (margin + 0.05)); // Admin profit slightly different

    contracts.push({
      id: `HĐ_${i.toString().padStart(3, '0')}/${unit.code}`,
      contractType: i % 10 === 0 ? 'VV' : 'HĐ',
      customerId: customerIdMap[client] || 'c1',
      title: `Cung cấp giải pháp ${unit.name} cho ${client}`,
      partyA: `${client} Corporation`,
      partyB: unit.name,
      clientInitials: client,
      contacts: [],
      content: 'Nội dung chi tiết hợp đồng đã được phê duyệt bởi Ban Pháp chế.',
      signedDate: `2024-0${1 + (i % 9)}-${10 + (i % 15)}`,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      value,
      estimatedCost,
      actualRevenue,
      actualCost,
      status: i % 20 === 0 ? 'Completed' : i % 12 === 0 ? 'Suspended' : i % 7 === 0 ? 'Acceptance' : 'Processing',
      stage: stages[i % stages.length],
      category: 'Chuyên môn',
      unitId: unit.id,
      salespersonId: salesperson.id
    });
  }
  return contracts;
};

export const MOCK_CONTRACTS: Contract[] = generateMockContracts();

// Generate mock payments
const generateMockPayments = (): Payment[] => {
  const payments: Payment[] = [];
  const methods: PaymentMethod[] = ['Chuyển khoản', 'Chuyển khoản', 'Chuyển khoản', 'Tiền mặt', 'LC'];
  const activeContracts = MOCK_CONTRACTS.filter(c => c.status === 'Processing' || c.status === 'Completed');

  activeContracts.slice(0, 100).forEach((contract, i) => {
    // Create 1-3 payment records per contract
    const numPayments = 1 + (i % 3);
    const paymentAmount = contract.value / numPayments;

    for (let j = 0; j < numPayments; j++) {
      const isCashReceived = j < numPayments - 1 || contract.status === 'Completed';
      const dueDate = new Date(contract.signedDate);
      dueDate.setMonth(dueDate.getMonth() + (j + 1) * 2);

      const paymentDate = new Date(dueDate);
      paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 10));

      // Status: Tiền về (cash received) or Đã xuất HĐ (invoiced)
      let status: PaymentStatus;
      if (isCashReceived) {
        status = 'Tiền về';
      } else {
        status = 'Đã xuất HĐ';
      }

      payments.push({
        id: `PAY_${(i * 3 + j + 1).toString().padStart(4, '0')}`,
        contractId: contract.id,
        customerId: contract.customerId,
        paymentDate: isCashReceived ? paymentDate.toISOString().split('T')[0] : '',
        dueDate: dueDate.toISOString().split('T')[0],
        amount: paymentAmount,
        paidAmount: isCashReceived ? paymentAmount : 0,
        status,
        paymentType: 'Revenue',
        method: methods[i % methods.length],
        reference: isCashReceived ? `UNC${Date.now()}${i}${j}` : undefined,
        invoiceNumber: `HĐ${contract.id.split('_')[1]?.split('/')[0] || i}-${j + 1}`,
      });
    }
  });

  return payments;
};

export const MOCK_PAYMENTS: Payment[] = generateMockPayments();

