import os
import sys
import json
import time
import requests
from datetime import datetime, timezone, timedelta
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

# Validate required environment variables
if not os.getenv("DISCOURSE_URL"):
    raise EnvironmentError(
        "\n❌ Missing DISCOURSE_URL environment variable.\n"
        "   Please set it in your .env file (e.g., https://discourse.example.com)\n"
    )

if not os.getenv("DISCOURSE_ALL_COOKIES"):
    raise EnvironmentError(
        "\n❌ Missing DISCOURSE_ALL_COOKIES environment variable.\n"
        "   This is required to authenticate with the Discourse forum.\n"
        "   See backend/.env.example for setup instructions.\n"
    )

BASE_URL = os.getenv("DISCOURSE_URL")
ALL_COOKIES = os.getenv("DISCOURSE_ALL_COOKIES")
DATA_FILE = "discourse_data.json"
SYNC_STATE_FILE = "sync_state.json"


def get_headers():
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    if ALL_COOKIES:
        headers["Cookie"] = ALL_COOKIES
    return headers


def parse_discourse_date(date_str):
    if not date_str:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)


def get_term_info(date=None):
    if date is None:
        date = datetime.now(timezone.utc)
    
    year, month = date.year, date.month
    
    if 1 <= month <= 4:
        return {
            "name": f"Jan-May {year}",
            "start": datetime(year, 1, 1, tzinfo=timezone.utc),
            "end": datetime(year, 4, 30, 23, 59, 59, tzinfo=timezone.utc),
            "priority": 1
        }
    elif 5 <= month <= 8:
        return {
            "name": f"May-Sept {year}",
            "start": datetime(year, 5, 1, tzinfo=timezone.utc),
            "end": datetime(year, 8, 31, 23, 59, 59, tzinfo=timezone.utc),
            "priority": 1
        }
    return {
        "name": f"Sept-Dec {year}",
        "start": datetime(year, 9, 1, tzinfo=timezone.utc),
        "end": datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc),
        "priority": 1
    }


def get_previous_term(current_term):
    prev_date = current_term["start"] - timedelta(days=1)
    prev_term = get_term_info(prev_date)
    prev_term["priority"] = current_term["priority"] + 1
    return prev_term


def load_sync_state():
    if os.path.exists(SYNC_STATE_FILE):
        with open(SYNC_STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"last_sync": None, "current_term": None, "post_count": 0}


def save_sync_state(state):
    with open(SYNC_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def fetch_posts_for_topic(topic_id, topic_slug, term_info=None):
    url = f"{BASE_URL}/t/{topic_slug}/{topic_id}.json"
    try:
        time.sleep(0.5)
        response = requests.get(url, headers=get_headers())
        
        if response.status_code == 429:
            time.sleep(5)
            response = requests.get(url, headers=get_headers())
        
        if response.status_code != 200:
            return []
        
        data = response.json()
        posts = data.get('post_stream', {}).get('posts', [])
        
        cleaned = []
        for post in posts:
            post_date = parse_discourse_date(post.get('created_at'))
            
            if term_info and (post_date < term_info["start"] or post_date > term_info["end"]):
                continue
            
            soup = BeautifulSoup(post.get('cooked', ''), "html.parser")
            cleaned.append({
                "post_id": post['id'],
                "topic_id": topic_id,
                "topic_title": data.get('title', 'Unknown'),
                "author": post.get('username', 'Unknown'),
                "created_at": post.get('created_at'),
                "content": soup.get_text(separator=" ", strip=True),
                "url": f"{BASE_URL}/t/{topic_slug}/{topic_id}/{post['post_number']}",
                "category_id": data.get('category_id', 'Unknown'),
                "term": term_info["name"] if term_info else "Unknown",
                "term_priority": term_info["priority"] if term_info else 99
            })
        return cleaned
    except Exception:
        return []


def fetch_posts_for_term(term_info, existing_ids=None, min_posts=500):
    print(f"\nFetching: {term_info['name']} ({term_info['start'].date()} to {term_info['end'].date()})")
    
    if existing_ids is None:
        existing_ids = set()
    
    posts_buffer = []
    next_page = "/latest.json?order=created"
    page_count = 0
    
    while next_page and page_count < 50:
        url = next_page if next_page.startswith("http") else f"{BASE_URL}{next_page}"
        
        try:
            resp = requests.get(url, headers=get_headers())
            if resp.status_code != 200:
                time.sleep(10)
                resp = requests.get(url, headers=get_headers())
                if resp.status_code != 200:
                    break
            
            data = resp.json()
            topics = data.get('topic_list', {}).get('topics', [])
            if not topics:
                break
            
            before_term_count = 0
            for topic in topics:
                topic_date = parse_discourse_date(topic.get('created_at'))
                
                if topic_date < term_info["start"]:
                    before_term_count += 1
                    if before_term_count >= 5:
                        next_page = None
                        break
                    continue
                
                if topic.get('posts_count', 0) < 2:
                    continue
                
                for post in fetch_posts_for_topic(topic['id'], topic.get('slug', 'topic'), term_info):
                    if post['post_id'] not in existing_ids:
                        posts_buffer.append(post)
                        existing_ids.add(post['post_id'])
            
            if next_page:
                more_url = data.get('topic_list', {}).get('more_topics_url')
                if more_url:
                    next_page = more_url.replace("latest", "latest.json")
                    time.sleep(3)
                    page_count += 1
                else:
                    next_page = None
                    
        except Exception:
            break
    
    print(f"Found {len(posts_buffer)} posts")
    return posts_buffer


def reindex_chromadb():
    try:
        from rag import main as rag_main
        rag_main()
    except Exception as e:
        print(f"Indexing error: {e}")


def fetch_posts(mode="term"):
    print(f"\n{'='*50}")
    print(f"INGESTION - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {mode.upper()}")
    print(f"{'='*50}")
    
    current_term = get_term_info()
    current_term["end"] = min(current_term["end"], datetime.now(timezone.utc))
    sync_state = load_sync_state()
    
    if mode == "incremental" and sync_state.get("last_sync"):
        existing_data = []
        existing_ids = set()
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
            existing_ids = {p['post_id'] for p in existing_data}
        
        new_posts = fetch_posts_for_term(current_term, existing_ids, min_posts=0)
        
        if new_posts:
            combined = existing_data + new_posts
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(combined, f, indent=2)
            print(f"Added {len(new_posts)} posts. Total: {len(combined)}")
            reindex_chromadb()
        
        sync_state["last_sync"] = datetime.now(timezone.utc).isoformat()
        sync_state["post_count"] = len(existing_data) + len(new_posts)
        save_sync_state(sync_state)
        return new_posts
    
    all_posts = []
    existing_ids = set()
    
    all_posts.extend(fetch_posts_for_term(current_term, existing_ids))
    
    if len(all_posts) < 500:
        prev_term = get_previous_term(current_term)
        all_posts.extend(fetch_posts_for_term(prev_term, existing_ids))
        
        if len(all_posts) < 500:
            all_posts.extend(fetch_posts_for_term(get_previous_term(prev_term), existing_ids))
    
    all_posts.sort(key=lambda x: x['created_at'], reverse=True)
    
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(all_posts, f, indent=2)
    
    save_sync_state({
        "last_sync": datetime.now(timezone.utc).isoformat(),
        "current_term": current_term["name"],
        "post_count": len(all_posts),
        "terms_fetched": list(set(p["term"] for p in all_posts))
    })
    
    print(f"\nTotal: {len(all_posts)} posts")
    reindex_chromadb()
    return all_posts


def main():
    if len(sys.argv) < 2:
        print("Usage: python ingestion.py [term|incremental]")
        return
    
    mode = sys.argv[1].lower()
    if mode in ["term", "incremental"]:
        fetch_posts(mode=mode)
    else:
        print(f"Unknown mode: {mode}")


if __name__ == "__main__":
    main()