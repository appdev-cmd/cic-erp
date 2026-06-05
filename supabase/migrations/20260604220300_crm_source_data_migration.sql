-- Migrate source data cũ sang enum mới
UPDATE crm_leads SET source = 'social' WHERE source IN ('Zalo', 'zalo');
UPDATE crm_leads SET source = 'social' WHERE source IN ('Telegram', 'telegram');
UPDATE crm_leads SET source = 'email' WHERE source IN ('Email');
UPDATE crm_leads SET source = 'phone' WHERE source IN ('Điện thoại', 'Call', 'call');
UPDATE crm_leads SET source = 'website' WHERE source IN ('Website', 'website');
UPDATE crm_leads SET source = 'referral' WHERE source IN ('Giới thiệu', 'referral');
UPDATE crm_leads SET source = 'event' WHERE source IN ('Sự kiện', 'event');
UPDATE crm_leads SET source = 'other' WHERE source NOT IN ('website','email','phone','referral','social','event','import','api','other') AND source IS NOT NULL;
