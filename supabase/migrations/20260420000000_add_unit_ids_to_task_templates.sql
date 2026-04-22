-- Add unit_ids to restrict templates to specific units
ALTER TABLE task_templates 
ADD COLUMN IF NOT EXISTS unit_ids text[] DEFAULT '{}';

-- Create sample BIM templates based on the official guidelines
INSERT INTO task_templates (id, name, description, category, unit_ids, applicable_entity_types, tasks_json) VALUES
-- AM Tasks
(gen_random_uuid(), '[BIM - AM] Tiếp cận & Thiết lập quan hệ CĐT', 'Lọc và kết nối với CĐT/Nhà thầu. Phân tích sơ đồ tổ chức để tiếp cận đúng người quyết định.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Tiếp cận & Thiết lập quan hệ CĐT", "description": "Là đầu mối chính, tìm kiếm & kết nối với CĐT/Nhà thầu. Phân tích sơ đồ tổ chức để tiếp cận đúng người quyết định. Duy trì quan hệ sau dự án (Up-sell/Cross-sell).", "task_type": "Chung", "priority": "high", "assignee_role": "AM"}]'::jsonb),

(gen_random_uuid(), '[BIM - AM] Xây dựng chiến lược & Thuyết trình', 'Quyết định hướng chào thầu (cạnh tranh giá hay công nghệ). Trực tiếp thuyết trình giải pháp.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Xây dựng chiến lược & Thuyết trình", "description": "Quyết định hướng chào thầu (cạnh tranh giá hay công nghệ). Trực tiếp thuyết trình giải pháp tổng thể cho khách hàng, chốt định hướng hợp tác.", "task_type": "Chung", "priority": "high", "assignee_role": "AM"}]'::jsonb),

(gen_random_uuid(), '[BIM - AM] Đàm phán TM & Ký hợp đồng', 'Đàm phán giá cả, điều khoản thanh toán, bảo lãnh HĐ. Ký hợp đồng.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Đàm phán thương mại & Ký kết hợp đồng", "description": "Quyết định mức giá chào, điều khoản thanh toán, bảo lãnh hợp đồng. Chịu trách nhiệm chính trong đàm phán và trực tiếp ký kết hợp đồng với khách hàng.", "task_type": "Chung", "priority": "high", "assignee_role": "AM"}]'::jsonb),

(gen_random_uuid(), '[BIM - AM] Quản trị rủi ro dòng tiền', 'Bám sát tiến độ giải ngân của khách hàng, xử lý vướng mắc thủ tục thanh toán.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Quản trị rủi ro dòng tiền", "description": "Bám sát tiến độ giải ngân của khách hàng, xử lý vướng mắc thủ tục thanh toán, đảm bảo tiền về tài khoản Công ty đúng hạn.", "task_type": "Chung", "priority": "high", "assignee_role": "AM"}]'::jsonb),

-- PA Tasks
(gen_random_uuid(), '[BIM - PA] Lập Pre-BEP, PPL & Số hóa quy trình', 'Viết Pre-BEP (Kế hoạch thực hiện BIM sơ bộ) & Phương pháp luận (PPL).', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Lập Pre-BEP, PPL & Số hóa quy trình", "description": "Viết Pre-BEP (Kế hoạch thực hiện BIM sơ bộ) & Phương pháp luận (PPL) theo yêu cầu riêng từng dự án phục vụ giai đoạn chào thầu.", "task_type": "Chung", "priority": "medium", "assignee_role": "PA"}]'::jsonb),

(gen_random_uuid(), '[BIM - PA] Hỗ trợ báo giá & Dự toán nhân sự', 'Phối hợp tính toán man-day, định mức nhân sự; lập bảng giá sát thực tế.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Hỗ trợ báo giá & Dự toán nhân sự", "description": "Phối hợp kỹ thuật tính toán man-day, định mức nhân sự; lập bảng giá sát thực tế & khả thi. Là đầu vào để tính TCFNC.", "task_type": "Chung", "priority": "medium", "assignee_role": "PA"}]'::jsonb),

(gen_random_uuid(), '[BIM - PA] Quản lý tiến độ & Điều phối thông tin', 'Thiết lập & theo dõi task. Điều phối dòng thông tin từ CĐT tới team dự án.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Quản lý tiến độ & Điều phối thông tin", "description": "Thiết lập & theo dõi task trên hệ thống. Là đầu mối nhận thông tin từ CĐT (Zalo/Email), lập & truyền đạt chính xác cho nội bộ đúng deadline.", "task_type": "Chung", "priority": "high", "assignee_role": "PA"}]'::jsonb),

(gen_random_uuid(), '[BIM - PA] Quản lý CDE & Kiểm soát phiên bản', 'Sắp xếp thư mục CDE, kiểm soát phiên bản thông tin chào thầu.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Quản lý CDE & Kiểm soát phiên bản", "description": "Sắp xếp cấu trúc thư mục Drive/CDE, kiểm soát version tài liệu bàn giao, đảm bảo không nhầm lẫn dữ liệu trong giai đoạn chào thầu.", "task_type": "Chung", "priority": "medium", "assignee_role": "PA"}]'::jsonb),

-- Pre-Sales Tasks
(gen_random_uuid(), '[BIM - PreSales] Phân tích yêu cầu kỹ thuật (EIR)', 'Đọc hiểu EIR, tư vấn LOD phù hợp, phần mềm tối ưu.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Phân tích yêu cầu kỹ thuật (EIR)", "description": "Đọc hiểu sâu EIR từ CĐT, tư vấn LOD phù hợp, đề xuất phần mềm tối ưu, xác định phạm vi ứng dụng BIM cho từng loại dự án.", "task_type": "Chung", "priority": "medium", "assignee_role": "BIM Consultant"}]'::jsonb),

(gen_random_uuid(), '[BIM - PreSales] Trình diễn công nghệ (Demo)', 'Trực tiếp thao tác Revit, Navisworks, Twinmotion... mô phỏng cho khách hàng.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Trình diễn công nghệ (Demo)", "description": "Trực tiếp thao tác Revit, Navisworks, BIMCollab, Twinmotion... Chứng minh năng lực xử lý xung đột, mô phỏng 4D/5D cho khách hàng.", "task_type": "Chung", "priority": "high", "assignee_role": "BIM Consultant"}]'::jsonb),

(gen_random_uuid(), '[BIM - PreSales] Giải đáp kỹ thuật & Bảo vệ phương án', 'Tham gia họp chuyên gia, bảo vệ phương án kỹ thuật.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Giải đáp kỹ thuật & Bảo vệ phương án", "description": "Tham gia họp chuyên gia, thuyết phục TVGS/Hội đồng nghiệm thu, xử lý thắc mắc kỹ thuật chuyên sâu từ phía CĐT và tư vấn giám sát.", "task_type": "Chung", "priority": "high", "assignee_role": "BIM Consultant"}]'::jsonb),

(gen_random_uuid(), '[BIM - PreSales] Đào tạo & Chuyển giao công nghệ', 'Đào tạo sử dụng BIM/CDE cho CĐT.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Đào tạo & Chuyển giao công nghệ", "description": "Đào tạo đội ngũ khách hàng sử dụng mô hình BIM/CDE. Hỗ trợ cài đặt & xử lý lỗi phần mềm trong giai đoạn chuyển giao.", "task_type": "Chung", "priority": "medium", "assignee_role": "BIM Consultant"}]'::jsonb),

-- Admin Tasks
(gen_random_uuid(), '[BIM - Admin] Chuẩn bị hồ sơ thầu & Pháp lý', 'Soạn HS năng lực, pháp lý, biểu mẫu đấu thầu.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Chuẩn bị hồ sơ thầu & Pháp lý", "description": "Soạn hồ sơ năng lực (Profile), bằng cấp nhân sự, chứng chỉ số, biểu mẫu theo Luật Đấu thầu hoặc yêu cầu riêng của CĐT.", "task_type": "Chung", "priority": "medium", "assignee_role": "Admin"}]'::jsonb),

(gen_random_uuid(), '[BIM - Admin] Soạn thảo & Quản lý hợp đồng', 'Soạn thảo, quản lý ký kết và lưu trữ HĐ.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Soạn thảo & Quản lý hợp đồng", "description": "Soạn thảo, theo dõi ký kết, lưu trữ hợp đồng. Cảnh báo điều khoản phạt chậm tiến độ hoặc thay đổi phụ lục hợp đồng.", "task_type": "Chung", "priority": "high", "assignee_role": "Admin"}]'::jsonb),

(gen_random_uuid(), '[BIM - Admin] Nghiệm thu, Thanh quyết toán & Công nợ', 'Làm biên bản nghiệm thu, theo dõi nhắc nợ hợp đồng.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Nghiệm thu, Thanh quyết toán & Công nợ", "description": "Làm biên bản nghiệm thu/bàn giao, tạo cơ sở xuất hóa đơn. Theo dõi & nhắc nợ đúng hạn phối hợp với AM và PA.", "task_type": "Chung", "priority": "high", "assignee_role": "Admin"}]'::jsonb),

(gen_random_uuid(), '[BIM - Admin] Hậu cần & Gửi nhận hồ sơ', 'In ấn, gửi phát nhanh, theo dõi ký nhận từ CĐT.', 'general', ARRAY['bim'], ARRAY['project', 'contract'], 
'[{"title": "Hậu cần & Gửi nhận hồ sơ", "description": "In ấn hồ sơ, đóng quyển, gửi chuyển phát nhanh, theo dõi ký nhận phản hồi từ khách hàng.", "task_type": "Chung", "priority": "low", "assignee_role": "Admin"}]'::jsonb);

-- Refresh schema cache if needed
NOTIFY pgrst, 'reload schema';
