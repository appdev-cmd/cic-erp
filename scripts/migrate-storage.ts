import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load variables from .env
dotenv.config();

// Configuration for migration
// Vui lòng điền thông tin chi tiết hoặc cấu hình trong file .env
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || 'https://jyohocjsnsyfgfsmjfqx.supabase.co';
const OLD_SUPABASE_SERVICE_ROLE_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY || '';

const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || '';
const NEW_SUPABASE_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || '';

// Danh sách các bucket cần di chuyển
const BUCKETS_TO_MIGRATE = ['documents']; // Có thể bổ sung thêm ví dụ: 'avatars', 'images'...

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_SERVICE_ROLE_KEY || !NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Lỗi: Vui lòng cấu hình đầy đủ biến môi trường để di chuyển storage:');
  console.error('  - OLD_SUPABASE_URL');
  console.error('  - OLD_SUPABASE_SERVICE_ROLE_KEY');
  console.error('  - NEW_SUPABASE_URL');
  console.error('  - NEW_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Khởi tạo Supabase Clients với Service Role Key để có quyền đọc/ghi tối cao
const oldClient = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const newClient = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function migrateFolder(bucketName: string, folderPath: string = '') {
  console.log(`📂 Đang quét thư mục: ${bucketName}/${folderPath || '(gốc)'}`);

  // 1. Liệt kê các tệp và thư mục con trong folderPath
  const { data: items, error } = await oldClient.storage
    .from(bucketName)
    .list(folderPath, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    console.error(`❌ Không thể liệt kê nội dung trong ${bucketName}/${folderPath}:`, error.message);
    return;
  }

  if (!items || items.length === 0) {
    return;
  }

  for (const item of items) {
    const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;

    if (item.id === undefined) {
      // Đây là một thư mục con (folder)
      await migrateFolder(bucketName, itemPath);
    } else {
      // Đây là một tệp tin (file)
      console.log(`   📄 Đang di chuyển tệp: ${itemPath} (${(item.metadata?.size / 1024).toFixed(2)} KB)...`);
      
      try {
        // Tải tệp từ Supabase cũ
        const { data: fileData, error: downloadError } = await oldClient.storage
          .from(bucketName)
          .download(itemPath);

        if (downloadError) {
          console.error(`      ❌ Lỗi tải tệp ${itemPath}:`, downloadError.message);
          continue;
        }

        if (fileData) {
          // Upload tệp lên Supabase mới
          const { error: uploadError } = await newClient.storage
            .from(bucketName)
            .upload(itemPath, fileData, {
              cacheControl: '3600',
              upsert: true, // Ghi đè nếu đã tồn tại
              contentType: item.metadata?.mimetype
            });

          if (uploadError) {
            console.error(`      ❌ Lỗi tải lên tệp ${itemPath}:`, uploadError.message);
          } else {
            console.log(`      ✅ Thành công: ${itemPath}`);
          }
        }
      } catch (err: any) {
        console.error(`      ❌ Lỗi không xác định khi xử lý tệp ${itemPath}:`, err.message || err);
      }
    }
  }
}

async function startMigration() {
  console.log('🚀 Bắt đầu quá trình di chuyển Supabase Storage...');
  console.log(`🔗 Nguồn: ${OLD_SUPABASE_URL}`);
  console.log(`🔗 Đích : ${NEW_SUPABASE_URL}`);

  for (const bucketName of BUCKETS_TO_MIGRATE) {
    console.log(`-----------------------------------------------`);
    console.log(`📦 Bắt đầu xử lý Bucket: ${bucketName}`);
    
    // 1. Kiểm tra/Tạo bucket mới ở Supabase đích nếu chưa có
    const { data: bucketInfo, error: checkError } = await newClient.storage.getBucket(bucketName);
    
    if (checkError) {
      console.log(`   ℹ️ Bucket '${bucketName}' chưa tồn tại ở Supabase đích. Đang tiến hành tạo mới...`);
      // Lấy cấu hình bucket cũ
      const { data: oldBucketInfo } = await oldClient.storage.getBucket(bucketName);
      
      const { error: createError } = await newClient.storage.createBucket(bucketName, {
        public: oldBucketInfo?.public ?? false,
        fileSizeLimit: oldBucketInfo?.file_size_limit ?? undefined,
        allowedMimeTypes: oldBucketInfo?.allowed_mime_types ?? undefined
      });

      if (createError) {
        console.error(`   ❌ Không thể tạo Bucket '${bucketName}' ở đích:`, createError.message);
        continue;
      }
      console.log(`   ✅ Đã tạo Bucket '${bucketName}' thành công.`);
    } else {
      console.log(`   ✅ Bucket '${bucketName}' đã tồn tại ở đích.`);
    }

    // 2. Chạy đệ quy di chuyển toàn bộ tệp tin
    await migrateFolder(bucketName);
  }

  console.log(`-----------------------------------------------`);
  console.log('🎉 Quá trình di chuyển Storage hoàn tất!');
}

startMigration().catch((err) => {
  console.error('❌ Lỗi nghiêm trọng khi chạy script:', err);
});
