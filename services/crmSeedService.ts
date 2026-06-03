import { dataClient as supabase } from '../lib/dataClient';
import { CrmLead, CrmActivity } from '../types';

export const CrmSeedService = {
  /**
   * Seed high-quality mock data for testing the CRM module.
   * Cleans up any existing [CRM-TEST] mock data before inserting new data.
   */
  seedMockData: async (currentUserId: string, currentUnitId?: string): Promise<{ count: number }> => {
    try {
      console.log('Starting CRM mock data seeding...', { currentUserId, currentUnitId });

      // 1. Resolve a valid Unit ID (RLS compatibility)
      let targetUnitId: string | null = null;
      
      // Fetch current user's profile to get their unit_id (crucial for RLS bypass/match)
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('unit_id')
        .eq('id', currentUserId)
        .single();
        
      if (!profileError && userProfile && userProfile.unit_id) {
        targetUnitId = userProfile.unit_id;
      } else if (currentUnitId && currentUnitId !== 'all') {
        targetUnitId = currentUnitId;
      } else {
        const { data: units, error: unitError } = await supabase
          .from('units')
          .select('id')
          .limit(1);
        if (!unitError && units && units.length > 0) {
          targetUnitId = units[0].id;
        }
      }

      if (!targetUnitId) {
        throw new Error('Không thể xác định đơn vị (Unit ID) hợp lệ để tạo dữ liệu mẫu.');
      }

      // 2. Clean up previous [CRM-TEST] data in correct dependency order
      // (ON DELETE CASCADE will automatically handle crm_activities when leads are deleted)
      
      // Step A: Find mock leads to delete
      const { data: mockLeadsToDelete } = await supabase
        .from('crm_leads')
        .select('id')
        .or('title.ilike.%[CRM-TEST]%,title.ilike.%Bùi Quang Hùng - Homepage CIC%');

      if (mockLeadsToDelete && mockLeadsToDelete.length > 0) {
        const leadIds = mockLeadsToDelete.map(l => l.id);
        await supabase.from('crm_leads').delete().in('id', leadIds);
      }

      // Step B: Find and delete mock customer contacts
      const { data: mockContactsToDelete } = await supabase
        .from('customer_contacts')
        .select('id')
        .ilike('name', '%[CRM-TEST]%');

      if (mockContactsToDelete && mockContactsToDelete.length > 0) {
        const contactIds = mockContactsToDelete.map(c => c.id);
        await supabase.from('customer_contacts').delete().in('id', contactIds);
      }

      // Step C: Find and delete mock customers
      const { data: mockCustomersToDelete } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', '%[CRM-TEST]%');

      if (mockCustomersToDelete && mockCustomersToDelete.length > 0) {
        const customerIds = mockCustomersToDelete.map(c => c.id);
        await supabase.from('customers').delete().in('id', customerIds);
      }

      console.log('CRM mock cleanup completed.');

      // 3. Create mock Customers and Contacts (prefixed with [CRM-TEST] and clearly annotated)
      
      // Customer 1: CIC Company
      const { data: customer1, error: cust1Err } = await supabase
        .from('customers')
        .insert({
          name: '[CRM-TEST] CIC Company',
          short_name: 'CIC Co',
          industry: JSON.stringify(['Công nghệ']),
          phone: '0241234567',
          email: 'info@cic.com.vn',
          address: 'Tòa nhà CIC, Cầu Giấy, Hà Nội',
          notes: 'Dữ liệu CRM giả định phục vụ kiểm thử',
          type: 'Customer',
          rating: 'Gold',
          source: 'Website'
        })
        .select()
        .single();

      if (cust1Err) throw new Error('Lỗi tạo khách hàng mẫu 1: ' + cust1Err.message);

      // Customer Contact 1: Bùi Quang Hùng
      const { data: contact1, error: cont1Err } = await supabase
        .from('customer_contacts')
        .insert({
          customer_id: customer1.id,
          name: '[CRM-TEST] Bùi Quang Hùng',
          phone: '0912345678',
          email: 'hung.bq@cic.com',
          position: 'Trưởng phòng Công nghệ',
          department: 'R&D',
          is_primary: true,
          notes: 'Dữ liệu CRM giả định phục vụ kiểm thử'
        })
        .select()
        .single();

      if (cont1Err) throw new Error('Lỗi tạo liên hệ mẫu 1: ' + cont1Err.message);

      // Customer 2: Vintech Solutions
      const { data: customer2 } = await supabase
        .from('customers')
        .insert({
          name: '[CRM-TEST] Giải pháp Vintech',
          short_name: 'Vintech',
          industry: JSON.stringify(['Công nghệ', 'Dịch vụ']),
          phone: '0249998888',
          email: 'contact@vintech.vn',
          address: 'Tòa nhà Vintech, Cầu Giấy, Hà Nội',
          notes: 'Dữ liệu CRM giả định phục vụ kiểm thử',
          type: 'Customer',
          rating: 'Standard',
          source: 'Event'
        })
        .select()
        .single();

      // Customer 3: Delta Construction Group
      const { data: customer3 } = await supabase
        .from('customers')
        .insert({
          name: '[CRM-TEST] Tập đoàn Xây dựng Delta',
          short_name: 'Delta',
          industry: JSON.stringify(['Xây dựng']),
          phone: '0281234432',
          email: 'office@delta.com.vn',
          address: 'Tòa nhà Delta, Quận 3, TP.HCM',
          notes: 'Dữ liệu CRM giả định phục vụ kiểm thử',
          type: 'Customer',
          rating: 'VIP',
          source: 'Partner'
        })
        .select()
        .single();

      // Customer 4: Tam Anh General Hospital
      const { data: customer4 } = await supabase
        .from('customers')
        .insert({
          name: '[CRM-TEST] Bệnh viện Đa khoa Tâm Anh',
          short_name: 'Tâm Anh Hospital',
          industry: JSON.stringify(['Y tế']),
          phone: '0289999000',
          email: 'info@tamanh.vn',
          address: 'Phổ Quang, Tân Bình, TP.HCM',
          notes: 'Dữ liệu CRM giả định phục vụ kiểm thử',
          type: 'Customer',
          rating: 'Standard',
          source: 'Website'
        })
        .select()
        .single();

      // 4. Resolve Stage IDs from templates
      const { data: stages, error: stagesError } = await supabase
        .from('crm_stage_templates')
        .select('id, name')
        .eq('entity_type', 'lead');

      if (stagesError || !stages) {
        throw new Error('Không thể lấy danh sách trạng thái của Leads: ' + (stagesError?.message || 'Không có trạng thái nào.'));
      }

      const stageNew = stages.find(s => s.name.includes('khởi tạo'))?.id || stages[0].id;
      const stageLow = stages.find(s => s.name.includes('tiềm năng thấp'))?.id || stages[0].id;
      const stageHigh = stages.find(s => s.name.includes('tiềm năng cao'))?.id || stages[0].id;

      // 5. Insert mock Leads
      
      // Lead 1: Bùi Quang Hùng (from mockup)
      const { data: lead1, error: lead1Err } = await supabase
        .from('crm_leads')
        .insert({
          title: 'Bùi Quang Hùng - Homepage CIC',
          name: '[CRM-TEST] Bùi Quang Hùng',
          company_name: '[CRM-TEST] CIC Company',
          phone: '0912345678',
          email: 'hung.bq@cic.com',
          source: 'Live chat - Open Channel',
          stage_id: stageNew,
          expected_value: 0,
          assigned_to: currentUserId,
          created_by: currentUserId,
          unit_id: targetUnitId
        })
        .select()
        .single();

      if (lead1Err) throw new Error('Lỗi tạo lead mẫu 1: ' + lead1Err.message);

      // Generate 19 additional mock leads
      const firstNames = ['Trần', 'Phạm', 'Nguyễn', 'Lê', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
      const middleNames = ['Thị', 'Văn', 'Quốc', 'Minh', 'Hữu', 'Đức', 'Thu', 'Thanh', 'Hải', 'Ngọc'];
      const lastNames = ['Anh', 'Hoàng', 'Mai', 'Linh', 'Sơn', 'Dũng', 'Lan', 'Hoa', 'Tùng', 'Đạt', 'Hùng', 'Cường', 'Nam', 'Trang'];
      
      const sources = ['Webinar Form', 'Google Ads', 'Facebook Campaign', 'Cold Call', 'Referral', 'Partner', 'Website', 'Event'];
      const mockStages = [stageNew, stageLow, stageHigh];
      
      const companiesData = [
        { name: customer2 ? customer2.name : '[CRM-TEST] Giải pháp Vintech', id: customer2?.id || null },
        { name: customer3 ? customer3.name : '[CRM-TEST] Tập đoàn Xây dựng Delta', id: customer3?.id || null },
        { name: customer4 ? customer4.name : '[CRM-TEST] Bệnh viện Đa khoa Tâm Anh', id: customer4?.id || null },
        { name: '[CRM-TEST] Techcombank', id: null },
        { name: '[CRM-TEST] FPT Software', id: null },
        { name: '[CRM-TEST] VNG Corporation', id: null },
        { name: '[CRM-TEST] Viettel Solutions', id: null },
        { name: '[CRM-TEST] Tập đoàn Masan', id: null }
      ];
      
      const productCatalog = [
        { id: '1', product_name: 'Giấy phép ERP v2.0 (License)', unit: 'Gói', unit_price: 50000000 },
        { id: '2', product_name: 'Dịch vụ Tư vấn Triển khai', unit: 'Man-day', unit_price: 2500000 },
        { id: '3', product_name: 'Máy chủ Cloud (12 tháng)', unit: 'Gói', unit_price: 15000000 },
        { id: '4', product_name: 'Module Kế toán nâng cao', unit: 'Module', unit_price: 30000000 },
        { id: '5', product_name: 'Phí bảo trì hệ thống (Năm 2)', unit: 'Năm', unit_price: 18000000 },
        { id: '6', product_name: 'Đào tạo nhân sự sử dụng', unit: 'Buổi', unit_price: 1500000 }
      ];
      
      const additionalLeads: Partial<CrmLead>[] = [];
      for (let i = 0; i < 19; i++) {
        const name = `[CRM-TEST] ${firstNames[i % firstNames.length]} ${middleNames[i % middleNames.length]} ${lastNames[i % lastNames.length]}`;
        const source = sources[i % sources.length];
        const title = `${name} - Yêu cầu từ ${source}`;
        const companyObj = companiesData[i % companiesData.length];
        const company_name = companyObj.name;
        const customer_id = companyObj.id;
        const stage_id = mockStages[Math.floor(Math.random() * mockStages.length)];
        
        // Random created_at between 1 and 15 days ago
        const daysAgo = Math.floor(Math.random() * 15) + 1;
        const createdAtDate = new Date();
        createdAtDate.setDate(createdAtDate.getDate() - daysAgo);
        createdAtDate.setHours(Math.floor(Math.random() * 8) + 8, Math.floor(Math.random() * 60)); // 8am - 4pm

        // Assign products for some leads (~40% of them)
        let products: any[] | undefined = undefined;
        let expected_value = 0;
        
        if (i % 3 === 0 || i % 5 === 0) {
           products = [];
           const numProducts = Math.floor(Math.random() * 4) + 1; // 1 to 4 products
           const shuffledCatalog = [...productCatalog].sort(() => 0.5 - Math.random());
           const selectedCatalog = shuffledCatalog.slice(0, numProducts);
           
           for (const item of selectedCatalog) {
             let quantity = 1;
             if (item.unit === 'Man-day') quantity = Math.floor(Math.random() * 20) + 5; // 5 to 24
             if (item.unit === 'Buổi') quantity = Math.floor(Math.random() * 10) + 2; // 2 to 11
             if (item.unit === 'Gói' && item.id === '3') quantity = Math.floor(Math.random() * 3) + 1; // 1 to 3 years
             
             products.push({
               id: item.id + '_' + Date.now().toString().slice(-4),
               product_name: item.product_name,
               unit: item.unit,
               unit_price: item.unit_price,
               quantity: quantity,
               total_price: item.unit_price * quantity
             });
           }
           expected_value = products.reduce((sum, p) => sum + p.total_price, 0);
        }
        
        // Random phone number
        const phone = '09' + Math.floor(10000000 + Math.random() * 90000000).toString();
        // Generate email from name
        const email = `test_lead_${i}@example.com`;

        additionalLeads.push({
          title,
          name,
          company_name,
          customer_id: customer_id || undefined,
          phone,
          email,
          source,
          stage_id,
          expected_value,
          assigned_to: currentUserId,
          created_by: currentUserId,
          unit_id: targetUnitId,
          created_at: createdAtDate.toISOString(),
          products
        });
      }
      
      // Batch insert the additional leads
      const { error: batchErr } = await supabase.from('crm_leads').insert(additionalLeads);
      if (batchErr) {
        console.error('Lỗi khi batch insert leads:', batchErr);
      }

      // 6. Seed mock Activities for Lead 1 (Bùi Quang Hùng - Homepage CIC)
      
      // Activity A: Lead created yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(13, 36, 0, 0); // 01:36 pm

      await supabase
        .from('crm_activities')
        .insert({
          lead_id: lead1.id,
          activity_type: 'Note',
          description: `Lead created\nBùi Quang Hùng - Homepage CIC\nSource: Live chat - Open Channel CIC Company`,
          created_by: currentUserId,
          created_at: yesterday.toISOString()
        });

      // Activity B: Planned Live chat (marked as Telegram for DB enum validation)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 44, 0, 0); // 12:44 pm

      await supabase
        .from('crm_activities')
        .insert({
          lead_id: lead1.id,
          activity_type: 'Telegram',
          description: `Open Channel chat: 'Bùi Quang Hùng - Homepage CIC' (Live chat)\n[Bùi Quang Hùng]: Alo\n[Hệ thống]: Form submitted\n[Hệ thống]: Form submitted\nWith: Quang Hùng Bùi`,
          created_by: currentUserId,
          created_at: tomorrow.toISOString()
        });

      console.log('CRM mock data seeding completed successfully!');
      return { count: 20 };
    } catch (error: any) {
      console.error('Error seeding CRM mock data:', error);
      throw error;
    }
  }
};
