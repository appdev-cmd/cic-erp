import json
import urllib.request
import urllib.error
import time

PROJECT_REF = 'jyohocjsnsyfgfsmjfqx'
SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2hvY2pzbnN5Zmdmc21qZnF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQxMTE4MywiZXhwIjoyMDg0OTg3MTgzfQ.7r3xY99EiPXiIFh6K7ctR8Xw05NJT0pwJVn0cQrPxyU'
URL = f'https://{PROJECT_REF}.supabase.co/rest/v1/cms_posts?on_conflict=slug'

HEADERS = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal, resolution=ignore-duplicates'
}

with open('mapped_cms_posts.json', 'r', encoding='utf-8') as f:
    posts = json.load(f)

print(f"Total posts to migrate: {len(posts)}")

BATCH_SIZE = 100
total_success = 0
total_failed = 0

for i in range(0, len(posts), BATCH_SIZE):
    batch = posts[i : i + BATCH_SIZE]
    data = json.dumps(batch).encode('utf-8')
    
    req = urllib.request.Request(URL, data=data, headers=HEADERS, method='POST')
    try:
        response = urllib.request.urlopen(req)
        if response.status in (200, 201):
            total_success += len(batch)
            print(f"Successfully processed batch {i} to {i + len(batch)}")
        else:
            print(f"Warning: Batch {i} returned status {response.status}")
    except urllib.error.HTTPError as e:
        # If there's an error, it might be due to constraint violations.
        # Let's read the error.
        error_msg = e.read().decode('utf-8')
        print(f"Error on batch {i} to {i + len(batch)}: {e.code} - {error_msg}")
        total_failed += len(batch)
    except Exception as e:
        print(f"Exception on batch {i} to {i + len(batch)}: {e}")
        total_failed += len(batch)
    
    time.sleep(0.5)

print(f"Finished. Success batch rows: {total_success}, Failed batch rows: {total_failed}")
