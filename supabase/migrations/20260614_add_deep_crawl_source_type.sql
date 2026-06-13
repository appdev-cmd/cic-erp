-- Migration: Add 'deep_crawl' source type for Crawl4AI deep crawling
-- This allows vendor/tech company websites to be crawled with BFS strategy

-- Update CHECK constraint on tech_sources.type to include 'deep_crawl'
ALTER TABLE tech_sources DROP CONSTRAINT IF EXISTS tech_sources_type_check;
ALTER TABLE tech_sources ADD CONSTRAINT tech_sources_type_check
  CHECK (type IN ('rss', 'google_news', 'web', 'deep_crawl', 'api', 'manual'));

-- Seed some vendor deep_crawl sources (disabled by default — admin activates as needed)
INSERT INTO tech_sources (name, url, type, language, country, category, is_active, crawl_frequency, config)
VALUES
  ('Autodesk Construction Blog', 'https://www.autodesk.com/blogs/construction', 'deep_crawl', 'en', 'US', 'bim', false, 'weekly',
   '{"maxDepth": 2, "maxPages": 30, "includePatterns": ["/blogs/construction/"], "jsEnabled": true, "stealthMode": true, "contentFilter": "pruning"}'::jsonb),
  ('Bentley Systems News', 'https://www.bentley.com/news', 'deep_crawl', 'en', 'US', 'infrastructure', false, 'weekly',
   '{"maxDepth": 2, "maxPages": 30, "includePatterns": ["/news/", "/press-releases/"], "jsEnabled": true, "stealthMode": true, "contentFilter": "pruning"}'::jsonb),
  ('Trimble Resources', 'https://www.trimble.com/en/resources/news', 'deep_crawl', 'en', 'US', 'contech', false, 'weekly',
   '{"maxDepth": 2, "maxPages": 30, "includePatterns": ["/resources/"], "jsEnabled": true, "stealthMode": true, "contentFilter": "pruning"}'::jsonb),
  ('Procore Blog', 'https://www.procore.com/blog', 'deep_crawl', 'en', 'US', 'project_management', false, 'weekly',
   '{"maxDepth": 2, "maxPages": 30, "includePatterns": ["/blog/"], "jsEnabled": true, "stealthMode": true, "contentFilter": "pruning"}'::jsonb),
  ('Hexagon Newsroom', 'https://hexagon.com/newsroom', 'deep_crawl', 'en', 'US', 'geospatial', false, 'weekly',
   '{"maxDepth": 2, "maxPages": 30, "includePatterns": ["/newsroom/"], "jsEnabled": true, "stealthMode": true, "contentFilter": "pruning"}'::jsonb),
  ('Built Robotics News', 'https://www.builtrobotics.com/news', 'deep_crawl', 'en', 'US', 'robotics', false, 'weekly',
   '{"maxDepth": 1, "maxPages": 20, "includePatterns": ["/news/"], "jsEnabled": true, "stealthMode": false, "contentFilter": "pruning"}'::jsonb),
  ('OpenSpace Blog', 'https://www.openspace.ai/blog', 'deep_crawl', 'en', 'US', 'reality_capture', false, 'weekly',
   '{"maxDepth": 2, "maxPages": 20, "includePatterns": ["/blog/"], "jsEnabled": true, "stealthMode": false, "contentFilter": "pruning"}'::jsonb),
  ('PlanRadar Blog', 'https://www.planradar.com/blog', 'deep_crawl', 'en', 'US', 'field_management', false, 'weekly',
   '{"maxDepth": 2, "maxPages": 20, "includePatterns": ["/blog/"], "jsEnabled": true, "stealthMode": false, "contentFilter": "pruning"}'::jsonb)
ON CONFLICT (url) DO NOTHING;
