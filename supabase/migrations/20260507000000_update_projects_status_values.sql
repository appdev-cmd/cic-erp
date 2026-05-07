-- Migration: Update projects status values from old format to new simplified format
-- Old: 10_XUCTIEN, 20_BAOGIA, 30_CHUANBI, 40_TRINHTHAMDINH/40_THAMDINH, 45_KIEMTRA,
--      50_HOTROQLDA, 60_THANHQUYETTOAN, 70_LUUTRU, cancelled
-- New: new, active, paused, done, cancelled

-- 1. Drop old check constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- 2. Migrate existing rows to new status values
UPDATE projects SET status = 'new'       WHERE status IN ('10_XUCTIEN', '20_BAOGIA');
UPDATE projects SET status = 'active'    WHERE status IN ('30_CHUANBI', '40_TRINHTHAMDINH', '40_THAMDINH', '45_KIEMTRA', '50_HOTROQLDA');
UPDATE projects SET status = 'done'      WHERE status IN ('60_THANHQUYETTOAN', '70_LUUTRU');

-- 3. Add new check constraint
ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('new', 'active', 'paused', 'done', 'cancelled'));
