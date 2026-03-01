-- ============================================
-- CHAT NỘI BỘ CIC ERP
-- Migration: chat_rooms, chat_members, chat_messages
-- ============================================

-- 1. Bảng phòng chat
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'contract')),
  avatar_url TEXT,
  contract_id UUID,
  unit_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Thành viên phòng chat
CREATE TABLE IF NOT EXISTS public.chat_members (
  room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- 3. Tin nhắn
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'file', 'image', 'system')),
  metadata JSONB DEFAULT '{}',
  reply_to UUID REFERENCES public.chat_messages(id),
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON public.chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON public.chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 6. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_updated_at();

CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_updated_at();

-- 7. Update room's updated_at when new message arrives
CREATE OR REPLACE FUNCTION public.update_room_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_rooms SET updated_at = now() WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_room_last_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_room_on_message();

-- 8. RLS Policies
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- chat_rooms: chỉ members mới xem được
CREATE POLICY "Members can read rooms" ON public.chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE room_id = chat_rooms.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create rooms" ON public.chat_rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Room admins can update" ON public.chat_rooms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE room_id = chat_rooms.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- chat_members: chỉ members trong cùng room mới xem được nhau
CREATE POLICY "Members can read members" ON public.chat_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members AS cm
      WHERE cm.room_id = chat_members.room_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can join" ON public.chat_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own membership" ON public.chat_members
  FOR UPDATE USING (user_id = auth.uid());

-- chat_messages: chỉ members mới đọc/gửi được
CREATE POLICY "Members can read messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE room_id = chat_messages.room_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE room_id = chat_messages.room_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Senders can edit own messages" ON public.chat_messages
  FOR UPDATE USING (sender_id = auth.uid());
