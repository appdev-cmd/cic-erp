-- Migration: Add month column to historical_production
-- month = NULL → yearly aggregate (backward compatible)
-- month = 1..12 → monthly data

-- 1. Add month column
ALTER TABLE historical_production ADD COLUMN IF NOT EXISTS month INTEGER;

-- 2. Drop old unique constraint and create new one
ALTER TABLE historical_production DROP CONSTRAINT IF EXISTS historical_production_unit_id_year_key;
ALTER TABLE historical_production ADD CONSTRAINT historical_production_unit_year_month_key UNIQUE(unit_id, year, month);

-- 3. Drop old index, create new one
DROP INDEX IF EXISTS idx_historical_production_unit_year;
CREATE INDEX idx_historical_production_unit_year_month ON historical_production(unit_id, year, month);

-- ============================================================
-- 2025 MONTHLY DATA from Excel "Báo cáo Sản lượng - Doanh Thu - Tiền về 2025.xlsx"
-- Values in triệu đồng. Chi nhánh HCM = PMXD chi nhánh + DCS chi nhánh combined.
-- ============================================================

INSERT INTO historical_production (unit_id, year, month, signing, revenue, admin_profit, rev_profit)
VALUES
  -- PMXD monthly
  ('pmxd', 2025, 1, 8, 10, 8, 10),
  ('pmxd', 2025, 2, 172, 4, 105, 4),
  ('pmxd', 2025, 3, 146, 0, 81, 0),
  ('pmxd', 2025, 4, 30, 30, 30, 30),
  ('pmxd', 2025, 5, 28, 16, 28, 16),
  ('pmxd', 2025, 6, 474, 438, 266, 264),
  ('pmxd', 2025, 7, 19, 21, 19, 21),
  ('pmxd', 2025, 8, 32, 60, 32, 60),
  ('pmxd', 2025, 9, 26, 26, 26, 26),
  ('pmxd', 2025, 10, 340, 26, 208, 26),
  ('pmxd', 2025, 11, 340, 166, 113, 112),
  ('pmxd', 2025, 12, 630, 1301, 359, 706),
  -- DCS monthly
  ('dcs', 2025, 1, 4277, 1451, 1068, 268),
  ('dcs', 2025, 2, 1324, 3942, 249, 992),
  ('dcs', 2025, 3, 6730, 3540, 1855, 972),
  ('dcs', 2025, 4, 6729, 9375, 1276, 2185),
  ('dcs', 2025, 5, 2439, 5050, 874, 1239),
  ('dcs', 2025, 6, 7396, 6003, 1667, 764),
  ('dcs', 2025, 7, 2631, 6368, 730, 1708),
  ('dcs', 2025, 8, 4982, 5115, 1602, 1670),
  ('dcs', 2025, 9, 13047, 9343, 3564, 2477),
  ('dcs', 2025, 10, 10363, 4561, 1311, 1181),
  ('dcs', 2025, 11, 8441, 4858, 1990, 1286),
  ('dcs', 2025, 12, 11337, 22108, 4246, 5151),
  -- HCM = Chi nhánh PMXD + Chi nhánh DCS combined
  ('hcm', 2025, 1, 8540, 7385, 897, 802),
  ('hcm', 2025, 2, 3969, 2475, 845, 553),
  ('hcm', 2025, 3, 9533, 8050, 1828, 1349),
  ('hcm', 2025, 4, 4956, 4951, 714, 1199),
  ('hcm', 2025, 5, 9058, 6429, 1724, 722),
  ('hcm', 2025, 6, 12101, 6452, 2275, 1483),
  ('hcm', 2025, 7, 5139, 12844, 1102, 1925),
  ('hcm', 2025, 8, 8813, 7634, 1630, 1510),
  ('hcm', 2025, 9, 6369, 7034, 1071, 1694),
  ('hcm', 2025, 10, 5286, 9331, 1341, 1866),
  ('hcm', 2025, 11, 3773, 2652, 525, 660),
  ('hcm', 2025, 12, 2715, 3260, 277, 498),
  -- STC monthly
  ('stc', 2025, 1, 3296, 873, 373, 24),
  ('stc', 2025, 2, 613, 0, 130, 0),
  ('stc', 2025, 3, 6862, 3396, 423, 351),
  ('stc', 2025, 4, 989, 10732, 168, 1024),
  ('stc', 2025, 5, 530, 331, 164, 117),
  ('stc', 2025, 6, 3651, 3659, 577, 546),
  ('stc', 2025, 7, 458, 2531, 122, 382),
  ('stc', 2025, 8, 675, 42, 67, 17),
  ('stc', 2025, 9, 11124, 3950, 1457, 566),
  ('stc', 2025, 10, 8936, 9433, 1537, 1845),
  ('stc', 2025, 11, 4214, 4961, 773, 513),
  ('stc', 2025, 12, 2954, 4514, 72, 293),
  -- TVDA monthly
  ('tvda', 2025, 1, 234, 0, 0, 0),
  ('tvda', 2025, 2, 31, 14, 22, 10),
  ('tvda', 2025, 3, 18, 23, 12, 16),
  ('tvda', 2025, 4, 0, 0, 0, 0),
  ('tvda', 2025, 5, 0, 0, 0, 0),
  ('tvda', 2025, 6, 0, 96, 0, 68),
  ('tvda', 2025, 7, 41, 0, 27, 0),
  ('tvda', 2025, 8, 276, 0, 163, 0),
  ('tvda', 2025, 9, 9, 0, 8, 0),
  ('tvda', 2025, 10, 429, 126, 0, 83),
  ('tvda', 2025, 11, 331, 0, 212, 0),
  ('tvda', 2025, 12, 798, 617, 0, 424),
  -- TVTK monthly
  ('tvtk', 2025, 1, 0, 0, 0, 0),
  ('tvtk', 2025, 2, 0, 0, 0, 0),
  ('tvtk', 2025, 3, 1531, 0, 1294, 0),
  ('tvtk', 2025, 4, 0, 0, 0, 0),
  ('tvtk', 2025, 5, 0, 0, 0, 0),
  ('tvtk', 2025, 6, 0, 98, 0, 69),
  ('tvtk', 2025, 7, 0, 0, 0, 0),
  ('tvtk', 2025, 8, 0, 0, 0, 0),
  ('tvtk', 2025, 9, 0, 1750, 0, 1225),
  ('tvtk', 2025, 10, 0, 0, 0, 0),
  ('tvtk', 2025, 11, 0, 0, 0, 0),
  ('tvtk', 2025, 12, 0, 0, 0, 0),
  -- CSS (TMB) monthly
  ('css', 2025, 1, 709, 0, 291, 0),
  ('css', 2025, 2, 296, 0, 110, 0),
  ('css', 2025, 3, 300, 843, 177, 187),
  ('css', 2025, 4, 270, 101, 22, 118),
  ('css', 2025, 5, 98, 68, 56, 75),
  ('css', 2025, 6, 60, 155, -27, 59),
  ('css', 2025, 7, 1835, 301, 164, 74),
  ('css', 2025, 8, 67, 0, 15, 0),
  ('css', 2025, 9, 48, 365, 32, 121),
  ('css', 2025, 10, 483, 724, 27, 328),
  ('css', 2025, 11, 62, 308, 0, 138),
  ('css', 2025, 12, 80, 773, 0, 173),
  -- BIM monthly
  ('bim', 2025, 1, 20, 0, 6, 0),
  ('bim', 2025, 2, 0, 19, 0, 6),
  ('bim', 2025, 3, 4379, 0, 372, 0),
  ('bim', 2025, 4, 1771, 19, 603, 15),
  ('bim', 2025, 5, 1345, 965, 435, 528),
  ('bim', 2025, 6, 975, 1580, 388, 742),
  ('bim', 2025, 7, 15168, 0, 2594, 0),
  ('bim', 2025, 8, 6285, 141, 2815, 91),
  ('bim', 2025, 9, 3655, 2844, 864, 1390),
  ('bim', 2025, 10, 3175, 2013, 377, 729),
  ('bim', 2025, 11, 480, 5422, 0, 2091),
  ('bim', 2025, 12, 7239, 10088, 103, 5097)
ON CONFLICT (unit_id, year, month) DO UPDATE SET
    signing = EXCLUDED.signing,
    revenue = EXCLUDED.revenue,
    admin_profit = EXCLUDED.admin_profit,
    rev_profit = EXCLUDED.rev_profit,
    updated_at = now();
