-- ============================================
-- CHAT NỘI BỘ CIC ERP - BỔ SUNG
-- Migration: Thêm RPC xoá phòng chat (delete_chat_room)
-- Cập nhật: Hỗ trợ truyền p_user_id cho Dev Bypass (khi auth.uid() is null)
-- ============================================

-- Drop hàm cũ nếu sai schema do thay đổi số lượng param
DROP FUNCTION IF EXISTS public.delete_chat_room(UUID);

CREATE OR REPLACE FUNCTION public.delete_chat_room(p_room_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
   v_role TEXT;
   v_type TEXT;
   v_caller_id UUID;
BEGIN
   -- Lấy user_id thực tế (auth.uid trong prod, p_user_id trong Dev Bypass)
   v_caller_id := COALESCE(auth.uid(), p_user_id);

   IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'User ID is missing';
   END IF;

   -- 1. Lấy thông tin phòng và quyền của người gọi hàm
   SELECT r.type, m.role INTO v_type, v_role
   FROM public.chat_rooms r
   JOIN public.chat_members m ON m.room_id = r.id AND m.user_id = v_caller_id
   WHERE r.id = p_room_id;

   -- 2. Nếu không tìm thấy (không tồn tại hoặc không phải thành viên)
   IF NOT FOUND THEN
      RAISE EXCEPTION 'Not authorized or room not found for user: %', v_caller_id;
   END IF;

   -- 3. Kiểm tra quyền:
   -- - Nhóm 1-1 (direct): Bất kỳ thành viên nào cũng có quyền xoá.
   -- - Nhóm nhóm/hợp đồng (group/contract): Chỉ Admin mới có quyền xoá.
   IF v_type = 'direct' OR v_role = 'admin' THEN
      DELETE FROM public.chat_rooms WHERE id = p_room_id;
   ELSE
      RAISE EXCEPTION 'You must be an admin to delete this chat room';
   END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
