import { dataClient as supabase } from '../lib/dataClient';
import { Employee } from '../types';
import { removeDiacritics } from '../utils/formatters';

// Helper to map DB Employee to Frontend Employee
const mapEmployee = (s: any): Employee => {
    if (!s) return {
        id: 'unknown',
        name: 'Unknown',
        unitId: '',
        target: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
    } as Employee;

    return {
        id: s.id || 'unknown',
        name: s.name || 'Unknown',
        unitId: s.unit_id || '',
        employeeCode: s.employee_code || '',
        email: s.email || '',
        phone: s.phone || '',
        position: s.position || '',
        department: s.department || '',
        roleCode: s.role_code || '',
        dateJoined: s.date_joined || '',
        avatar: s.avatar || '',
        target: s.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
        slug: s.slug || '',
        // HR fields
        dateOfBirth: s.date_of_birth || '',
        gender: s.gender || '',
        address: s.address || '',
        education: s.education || '',
        idNumber: s.id_number || '',
        bankAccount: s.bank_account || '',
        bankName: s.bank_name || '',
        maritalStatus: s.marital_status || '',
        emergencyContact: s.emergency_contact || '',
        emergencyPhone: s.emergency_phone || '',
        contractType: s.contract_type || '',
        contractEndDate: s.contract_end_date || '',
        // Additional fields
        telegram: s.telegram || '',
        specialization: s.specialization || '',
        certificates: s.certificates || ''
    };
};

export const EmployeeService = {
    getAll: async (): Promise<Employee[]> => {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        return data.map(mapEmployee);
    },

    getById: async (id: string): Promise<Employee | undefined> => {
        const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
        if (error) return undefined;
        return mapEmployee(data);
    },

    getBySlug: async (slug: string): Promise<Employee | undefined> => {
        const { data, error } = await supabase.from('employees').select('*').eq('slug', slug).single();
        if (error) return undefined;
        return mapEmployee(data);
    },

    /** Resolve by UUID or slug — auto-detect format */
    getBySlugOrId: async (idOrSlug: string): Promise<Employee | undefined> => {
        // UUID pattern: 8-4-4-4-12 hex chars
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
        if (isUUID) {
            return EmployeeService.getById(idOrSlug);
        }
        return EmployeeService.getBySlug(idOrSlug);
    },

    getByUnitId: async (unitId: string): Promise<Employee[]> => {
        let query = supabase.from('employees').select('*');
        if (unitId !== 'all') {
            query = query.eq('unit_id', unitId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapEmployee);
    },

    list: async (params: { page?: number; pageSize?: number; search?: string; unitId?: string }): Promise<{ data: Employee[]; total: number }> => {
        let query = supabase.from('employees').select('*', { count: 'exact' });

        if (params.unitId && params.unitId !== 'all') {
            query = query.eq('unit_id', params.unitId);
        }
        if (params.search) {
            // Vietnamese diacritics-insensitive search via RPC
            let matchedIds: string[] | undefined;
            try {
                const { data: rpcData } = await supabase.rpc('search_employees_unaccent', { search_term: params.search });
                if (rpcData && rpcData.length > 0) {
                    matchedIds = rpcData.map((r: any) => r.id);
                } else if (rpcData) {
                    matchedIds = []; // RPC ok, no results
                }
            } catch (e) {
                console.warn('[EmployeeService] unaccent RPC failed, falling back to ilike:', e);
            }
            if (matchedIds && matchedIds.length > 0) {
                query = query.in('id', matchedIds);
            } else if (matchedIds && matchedIds.length === 0) {
                return { data: [], total: 0 };
            } else {
                query = query.ilike('name', `%${params.search}%`);
            }
        }

        const page = params.page || 1;
        const limit = params.pageSize || 10;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.range(from, to).order('name', { ascending: true });

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            data: data.map(mapEmployee),
            total: count || 0
        };
    },

    create: async (payload: Omit<Employee, 'id'>): Promise<Employee> => {
        // Map frontend back to DB - include all HR fields
        const dbPayload: any = {
            name: payload.name,
            unit_id: payload.unitId || null,
            employee_code: payload.employeeCode,
            email: payload.email,
            phone: payload.phone,
            position: payload.position,
            department: payload.department,
            role_code: payload.roleCode,
            date_joined: payload.dateJoined,
            avatar: payload.avatar,
            target: payload.target,
            // HR fields
            date_of_birth: payload.dateOfBirth || null,
            gender: payload.gender || null,
            address: payload.address,
            education: payload.education,
            id_number: payload.idNumber,
            bank_account: payload.bankAccount,
            bank_name: payload.bankName,
            marital_status: payload.maritalStatus || null,
            emergency_contact: payload.emergencyContact,
            emergency_phone: payload.emergencyPhone,
            contract_type: payload.contractType,
            contract_end_date: payload.contractEndDate || null,
            // Additional fields
            telegram: payload.telegram,
            specialization: payload.specialization,
            certificates: payload.certificates
        };

        const { data, error } = await supabase.from('employees').insert(dbPayload).select().single();
        if (error) throw error;
        return mapEmployee(data);
    },

    update: async (id: string, payload: Partial<Employee>): Promise<Employee> => {
        // Map frontend camelCase to DB snake_case
        const dbPayload: any = {};

        if (payload.name !== undefined) dbPayload.name = payload.name;
        if (payload.unitId !== undefined) dbPayload.unit_id = payload.unitId || null;
        if (payload.employeeCode !== undefined) dbPayload.employee_code = payload.employeeCode;
        if (payload.email !== undefined) dbPayload.email = payload.email;
        if (payload.phone !== undefined) dbPayload.phone = payload.phone;
        if (payload.position !== undefined) dbPayload.position = payload.position;
        if (payload.department !== undefined) dbPayload.department = payload.department;
        if (payload.roleCode !== undefined) dbPayload.role_code = payload.roleCode;
        if (payload.dateJoined !== undefined) dbPayload.date_joined = payload.dateJoined;
        if (payload.avatar !== undefined) dbPayload.avatar = payload.avatar;
        if (payload.target !== undefined) dbPayload.target = payload.target;
        // HR fields
        if (payload.dateOfBirth !== undefined) dbPayload.date_of_birth = payload.dateOfBirth || null;
        if (payload.gender !== undefined) dbPayload.gender = payload.gender || null;
        if (payload.address !== undefined) dbPayload.address = payload.address;
        if (payload.education !== undefined) dbPayload.education = payload.education;
        if (payload.idNumber !== undefined) dbPayload.id_number = payload.idNumber;
        if (payload.bankAccount !== undefined) dbPayload.bank_account = payload.bankAccount;
        if (payload.bankName !== undefined) dbPayload.bank_name = payload.bankName;
        if (payload.maritalStatus !== undefined) dbPayload.marital_status = payload.maritalStatus || null;
        if (payload.emergencyContact !== undefined) dbPayload.emergency_contact = payload.emergencyContact;
        if (payload.emergencyPhone !== undefined) dbPayload.emergency_phone = payload.emergencyPhone;
        if (payload.contractType !== undefined) dbPayload.contract_type = payload.contractType;
        if (payload.contractEndDate !== undefined) dbPayload.contract_end_date = payload.contractEndDate || null;
        // Additional fields
        if (payload.telegram !== undefined) dbPayload.telegram = payload.telegram;
        if (payload.specialization !== undefined) dbPayload.specialization = payload.specialization;
        if (payload.certificates !== undefined) dbPayload.certificates = payload.certificates;

        if (Object.keys(dbPayload).length === 0) {
            throw new Error('No fields to update');
        }

        const { data, error } = await supabase.from('employees').update(dbPayload).eq('id', id).select().single();
        if (error) throw error;
        return mapEmployee(data);
    },

    delete: async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    getStats: async (id: string, year?: number | null): Promise<any> => {
        try {
            const employee = await EmployeeService.getById(id);
            
            // Fetch KPI target from dedicated employee_targets table (per year)
            const effectiveYear = year !== undefined && year !== null ? year : new Date().getFullYear();
            let target = { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
            
            if (employee?.unitId) {
                const { data: targetData } = await supabase
                    .from('employee_targets')
                    .select('*')
                    .eq('employee_id', id)
                    .eq('year', effectiveYear)
                    .maybeSingle();
                
                if (targetData) {
                    target = {
                        signing: Number(targetData.signing) || 0,
                        revenue: Number(targetData.revenue) || 0,
                        adminProfit: Number(targetData.admin_profit) || 0,
                        revProfit: Number(targetData.rev_profit) || 0,
                        cash: Number(targetData.cash) || 0,
                    };
                }
            }
            
            // Fallback to old employees.target if employee_targets has no data
            if (target.signing === 0 && target.revenue === 0 && employee?.target) {
                const legacyTarget = employee.target;
                if (legacyTarget.signing > 0 || legacyTarget.revenue > 0) {
                    target = legacyTarget;
                }
            }
            
            // If revProfit target not set, fallback to adminProfit target
            if (target.revProfit === 0 && target.adminProfit > 0) {
                target.revProfit = target.adminProfit;
            }

            // Fetch contracts where this employee is primary or in allocations
            let query = supabase
                .from('contracts')
                .select('id, value, actual_revenue, admin_profit, rev_profit, estimated_cost, status, employee_id, employee_allocations, signed_date');

            if (effectiveYear) {
                query = query.gte('signed_date', `${effectiveYear}-01-01`)
                             .lte('signed_date', `${effectiveYear}-12-31`);
            }

            const { data: contracts, error } = await query;
            if (error) throw error;

            // Filter to contracts involving this employee, compute allocation fraction
            let totalSigning = 0;
            let totalRevenue = 0;
            let totalProfit = 0;
            let totalRevenueProfit = 0;
            let contractCount = 0;
            let activeContracts = 0;
            let completedContracts = 0;

            (contracts || []).forEach((c: any) => {
                let fraction = 0;

                // Check if primary employee
                if (c.employee_id === id) {
                    // Check if allocations exist
                    const allocs: any[] = c.employee_allocations || [];
                    if (allocs.length > 0) {
                        const myAlloc = allocs.find((a: any) => a.employeeId === id);
                        fraction = myAlloc ? (myAlloc.percent || 0) / 100 : 0;
                    } else {
                        fraction = 1; // No allocations, 100% for primary
                    }
                } else {
                    // Check in allocations as member
                    const allocs: any[] = c.employee_allocations || [];
                    const myAlloc = allocs.find((a: any) => a.employeeId === id);
                    if (myAlloc) {
                        fraction = (myAlloc.percent || 0) / 100;
                    }
                }

                if (fraction <= 0) return;

                contractCount++;
                totalSigning += (c.value || 0) * fraction;
                totalRevenue += (c.actual_revenue || 0) * fraction;
                totalProfit += (c.admin_profit || 0) * fraction;
                totalRevenueProfit += (c.rev_profit || 0) * fraction;

                if (c.status === 'Processing') activeContracts++;
                if (c.status === 'Completed') completedContracts++;
            });

            return {
                contractCount,
                totalSigning,
                totalRevenue,
                totalProfit,
                totalRevenueProfit,
                activeContracts,
                completedContracts,
                target, // Return the resolved target so UI can display it
                signingProgress: target.signing > 0 ? (totalSigning / target.signing) * 100 : 0,
                revenueProgress: target.revenue > 0 ? (totalRevenue / target.revenue) * 100 : 0,
                profitProgress: target.adminProfit > 0 ? (totalProfit / target.adminProfit) * 100 : 0,
                revProfitProgress: target.revProfit > 0 ? (totalRevenueProfit / target.revProfit) * 100 : 0
            };
        } catch (error) {
            console.error('Error in getStats:', error);
            return {
                contractCount: 0,
                totalSigning: 0,
                totalRevenue: 0,
                totalProfit: 0,
                totalRevenueProfit: 0,
                activeContracts: 0,
                completedContracts: 0,
                signingProgress: 0,
                revenueProgress: 0,
                profitProgress: 0,
                revProfitProgress: 0
            };
        }
    },

    getWithStats: async (unitId?: string, search?: string, year?: number | null): Promise<Employee[]> => {
        try {
            const { data, error } = await supabase.rpc('get_employees_with_stats', {
                p_unit_id: unitId === 'all' ? null : unitId,
                p_year: year !== undefined ? year : new Date().getFullYear(),
                p_search: search || null
            });

            if (error) {
                // Fallback to regular getAll
                let employees: Employee[];
                if (unitId && unitId !== 'all') {
                    employees = await EmployeeService.getByUnitId(unitId);
                } else {
                    employees = await EmployeeService.getAll();
                }
                if (search) {
                    const lowerSearch = removeDiacritics(search.toLowerCase());
                    employees = employees.filter(e => removeDiacritics(e.name.toLowerCase()).includes(lowerSearch));
                }
                return employees.map(e => ({
                    ...e,
                    stats: { contractCount: 0, totalSigning: 0, totalRevenue: 0 }
                }));
            }

            return data.map((e: any) => ({
                ...mapEmployee(e),
                stats: {
                    totalSigning: e.total_signing,
                    totalRevenue: e.total_revenue,
                    totalProfit: e.total_profit,
                    totalRevenueProfit: e.total_revenue_profit || 0,
                    totalCash: e.total_cash
                }
            }));
        } catch (error) {
            console.error('[EmployeeService.getWithStats] Fallback to getAll:', error);
            let employees: Employee[];
            if (unitId && unitId !== 'all') {
                employees = await EmployeeService.getByUnitId(unitId);
            } else {
                employees = await EmployeeService.getAll();
            }
            return employees.map(e => ({
                ...e,
                stats: { contractCount: 0, totalSigning: 0, totalRevenue: 0 }
            }));
        }
    }
};
