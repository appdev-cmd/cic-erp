-- Thêm cột content_vi: bản dịch TOÀN VĂN nội dung bài viết sang tiếng Việt.
-- Sau khi AI phân tích, chi tiết tin bài hiển thị tiếng Việt là chính (title_vi,
-- summary_vi, content_vi); nội dung gốc (content) chỉ để đối chiếu tham khảo.
ALTER TABLE tech_articles ADD COLUMN IF NOT EXISTS content_vi TEXT;
