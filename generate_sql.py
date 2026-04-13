import json

with open('mapped_cms_posts.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

# Group into parts if needed, but 1463 isn't too huge, we'll just write one file
with open('import_legacy_news.sql', 'w', encoding='utf-8') as out:
    out.write('BEGIN;\n\n')
    
    def escape(val):
        if val is None:
            return 'NULL'
        if isinstance(val, bool):
            return 'true' if val else 'false'
        if isinstance(val, int):
            return str(val)
        # string
        return "'" + str(val).replace("'", "''") + "'"
        
    for r in records:
        cols = ['id', 'title_vi', 'slug', 'excerpt_vi', 'content_vi', 'thumbnail_url', 'is_published', 'status', 'view_count', 'published_at']
        
        vals_dict = {
            'id': r.get('id'),
            'title_vi': r.get('title_vi'),
            'slug': r.get('slug'),
            'excerpt_vi': r.get('excerpt_vi'),
            'content_vi': r.get('content_vi'),
            'thumbnail_url': r.get('thumbnail_url'),
            'is_published': r.get('is_published'),
            'status': r.get('status'),
            'view_count': r.get('view_count'),
            'published_at': r.get('published_at')
        }
        
        # Omit 'published_at' if it's strictly not valid, but our mapping handles it
        
        vals = [escape(vals_dict[c]) for c in cols]
        
        # In Supabase, if slug is unique: ON CONFLICT (slug) DO NOTHING;
        # Since I don't know the exact unique constraint name on slug in this DB, using ON CONFLICT (id) DO NOTHING is safest
        # But wait, my IDs are purely random. The slugs might overlap with the 231 existing posts!
        # If ID is UUID, ON CONFLICT (id) won't prevent duplicate slug errors!
        # Let's assume slug might have a unique constraint. Let's do `ON CONFLICT (slug) DO NOTHING` but if slug is NOT unique key, Postgres will complain.
        # Alternatively, since we just have the SQL file, we don't include ON CONFLICT because we want normal failure on duplicate slugs if there is a constraint. We'll let the user see them.
        
        sql = f"INSERT INTO public.cms_posts ({', '.join(cols)}) VALUES ({', '.join(vals)});\n"
        out.write(sql)
        
    out.write('\nCOMMIT;\n')
print("Generated import_legacy_news.sql with", len(records), "records.")
