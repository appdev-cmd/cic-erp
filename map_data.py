import json
import uuid

def map_fs_news_to_cms_posts():
    with open('fs_news_parsed_sample.json', 'r', encoding='utf-8') as f:
        records = json.load(f)
        
    mapped_records = []
    for r in records:
        if len(r) < 14:
            continue
            
        summary = r[1]
        content = r[2]
        title = r[10]
        alias = r[11]
        image = r[12]
        created_time = r[16]
        
        try:
            hits = r[23]
            published = r[24]
        except IndexError:
            hits = 0
            published = 0
        
        # Clean quotes if any
        def clean(s):
            if isinstance(s, str) and len(s) >= 2 and s.startswith("'") and s.endswith("'"):
                return s[1:-1].replace("''", "'") 
            if s == "NULL":
                return None
            return s
            
        title = clean(title)
        alias = clean(alias)
        image = clean(image)
        summary = clean(summary)
        content = clean(content)
        published_at = clean(created_time)
        try:
            is_published = int(clean(published) or 0) > 0
        except:
            is_published = False
            
        try:
            view_count = int(clean(hits) or 0)
        except:
            view_count = 0
            
        # Create mapped post
        post = {
            "id": str(uuid.uuid4()), # Need a UUID since Supabase cms_posts uses UUID
            "title_vi": title,
            "slug": alias or title[:50] if title else "post", # fallback
            "excerpt_vi": summary,
            "content_vi": content or "",
            "thumbnail_url": image,
            # Assigning a default category or leaving empty if not mapped
            # category_id: category_id,
            "is_published": is_published,
            "published_at": published_at if published_at and published_at != "NULL" else None,
            "status": "published" if is_published else "draft",
            "view_count": view_count
        }
        
        # Some basic cleanup for slug
        if post["slug"]:
            post["slug"] = post["slug"].lower().replace(' ', '-')
            
        mapped_records.append(post)
        
    with open('mapped_cms_posts.json', 'w', encoding='utf-8') as out:
        json.dump(mapped_records, out, indent=2, ensure_ascii=False)
        print("Mapped", len(mapped_records), "records.")

map_fs_news_to_cms_posts()
