ALTER TABLE cms_posts 
DROP CONSTRAINT IF EXISTS cms_posts_status_check;

ALTER TABLE cms_posts 
ADD CONSTRAINT cms_posts_status_check 
CHECK (status IN ('draft', 'published', 'archived', 'pending_approval', 'approved'));
