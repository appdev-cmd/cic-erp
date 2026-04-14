import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('cms_banners').insert([
    {
      title_vi: 'BIM',
      subtitle_vi: 'Tư vấn BIM',
      link_url: '/dich-vu/tu-van-bim',
      is_active: true,
      position: 'left',
      sort_order: 1
    },
    {
      title_vi: 'NetZero',
      subtitle_vi: 'LCA và EPD – Hộ chiếu cho phát triển xanh.',
      image_url: '/netzero-banner.jpg',
      link_url: 'https://netzero2050.vn/lca-va-epd-ho-chieu-xanh-cho-doanh-nghiep-phat-trien-ben-vung/',
      is_active: true,
      position: 'right',
      sort_order: 2
    }
  ]);
  if (error) console.error(error);
  else console.log('Banners inserted!');
}
run();
