-- Tự động thêm trường liên kết thư mục (potential, ongoing) cho bảng projects
alter table public.projects 
  add column if not exists folder_potential_url text,
  add column if not exists folder_ongoing_url text;

-- Cập nhật comment cho cột
comment on column public.projects.folder_potential_url is 'Link lưu trữ hồ sơ tiền dự án (Potential)';
comment on column public.projects.folder_ongoing_url is 'Link lưu trữ hồ sơ triển khai (Ongoing)';
