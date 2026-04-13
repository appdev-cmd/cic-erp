import { dataClient } from './lib/dataClient';

async function test() {
    console.log("Testing update...");
    const { data, error } = await dataClient
        .from('web_posts')
        .update({ is_published: true })
        .eq('id', '316cb833-c5f1-4208-b7b3-659264af893b')
        .select(`
            *,
            author:author_id(name),
            post_categories(id, name, slug)
        `)
        .single();
    
    console.log("Data:", data);
    if (error) console.error("Error:", error);
}

test();
