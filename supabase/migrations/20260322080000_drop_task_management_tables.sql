-- Migration: Drop all Task Management tables
-- Safe: uses CASCADE and IF EXISTS to avoid errors
-- Run this on Supabase SQL Editor if MCP is unavailable

-- Drop tables in dependency order (children first, then parents)
DROP TABLE IF EXISTS task_watchers CASCADE;
DROP TABLE IF EXISTS task_dependencies CASCADE;
DROP TABLE IF EXISTS task_activities CASCADE;
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS time_entries CASCADE;
DROP TABLE IF EXISTS checklists CASCADE;
DROP TABLE IF EXISTS custom_field_definitions CASCADE;
DROP TABLE IF EXISTS custom_field_values CASCADE;
DROP TABLE IF EXISTS task_assignees CASCADE;
DROP TABLE IF EXISTS task_tags CASCADE;
DROP TABLE IF EXISTS task_statuses CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS task_lists CASCADE;
DROP TABLE IF EXISTS folders CASCADE;
DROP TABLE IF EXISTS spaces CASCADE;
DROP TABLE IF EXISTS space_members CASCADE;
