import os
import json
import re
import chromadb
from chromadb.utils import embedding_functions

DB_PATH = "./chroma_db"
COLLECTION_NAME = "discourse_posts"
DATA_FILE = "discourse_data.json"
DOCS_FOLDER = "./data"

BATCH_SIZE = 5000

COURSE_PATTERNS = [
    r'Machine Learning (?:Techniques|Foundations|Practice)',
    r'Business Data [Mm]anagement',
    r'Business Analytics',
    r'Tools in Data Science',
    r'PDSA|Programming Data structures',
    r'DBMS|Database [Mm]anagement',
    r'Application [Dd]evelopment',
    r'Java|Python|C prog',
    r'System [Cc]ommands',
    r'Statistics for [Dd]ata [Ss]cience',
    r'Computational [Tt]hinking',
    r'Deep Learning',
    r'Software Testing|Engineering',
    r'Big Data',
    r'MLT|MLP|MLF|BDM|BA|TDS|SC',
]


def get_db_client():
    client = chromadb.PersistentClient(path=DB_PATH)
    embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    return client.get_or_create_collection(name=COLLECTION_NAME, embedding_function=embed_fn)


def split_text_by_sections(text, chunk_size=1500):
    lines = text.split('\n')
    chunks = []
    current_chunk = []
    current_section = ""
    current_size = 0
    
    for line in lines:
        if re.match(r'^#{1,4}\s+.+$', line):
            if current_chunk and current_size > 100:
                chunk_text = '\n'.join(current_chunk)
                if current_section:
                    chunk_text = f"Section: {current_section}\n\n{chunk_text}"
                chunks.append(chunk_text)
                current_chunk = current_chunk[-5:] if len(current_chunk) > 5 else current_chunk
                current_size = sum(len(l) for l in current_chunk)
            current_section = line.strip('#').strip()
        
        current_chunk.append(line)
        current_size += len(line)
        
        if current_size >= chunk_size:
            chunk_text = '\n'.join(current_chunk)
            if current_section:
                chunk_text = f"Section: {current_section}\n\n{chunk_text}"
            chunks.append(chunk_text)
            current_chunk = current_chunk[-5:] if len(current_chunk) > 5 else current_chunk
            current_size = sum(len(l) for l in current_chunk)
    
    if current_chunk:
        chunk_text = '\n'.join(current_chunk)
        if current_section:
            chunk_text = f"Section: {current_section}\n\n{chunk_text}"
        chunks.append(chunk_text)
    
    return [c.strip() for c in chunks if c.strip()]


def extract_course_names(text):
    found = []
    for pattern in COURSE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            found.append(match.group())
    return ', '.join(found[:3]) if found else ""


def index_markdown_docs():
    if not os.path.exists(DOCS_FOLDER):
        return
    
    collection = get_db_client()
    documents, metadatas, ids = [], [], []
    
    print(f"Indexing documents from {DOCS_FOLDER}")
    
    for filename in os.listdir(DOCS_FOLDER):
        if not (filename.endswith(".md") or filename.endswith(".txt")):
            continue
        if filename.endswith(".json"):
            continue
            
        filepath = os.path.join(DOCS_FOLDER, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        chunks = split_text_by_sections(content)
        print(f"  {filename}: {len(chunks)} chunks")
        
        for i, chunk in enumerate(chunks):
            courses = extract_course_names(chunk)
            doc_text = f"Source: {filename}\n"
            if courses:
                doc_text += f"Courses: {courses}\n"
            doc_text += f"Content:\n{chunk}"
            
            documents.append(doc_text)
            ids.append(f"doc_{filename}_{i}")
            metadatas.append({
                "topic_title": f"Official: {filename.replace('.md', '').replace('_', ' ').title()}",
                "author": "Official Document",
                "url": "#",
                "created_at": "",
                "type": "document",
                "term": "all",
                "term_priority": 0,
                "courses": courses
            })
    
    if documents:
        collection.upsert(documents=documents, metadatas=metadatas, ids=ids)
        print(f"Indexed {len(documents)} document chunks")


def index_forum_posts(posts=None):
    if posts is None:
        if not os.path.exists(DATA_FILE):
            print("No discourse_data.json found")
            return
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            posts = json.load(f)
    
    if not posts:
        return
    
    print(f"Indexing {len(posts)} forum posts")
    collection = get_db_client()
    
    documents, metadatas, ids = [], [], []
    for post in posts:
        documents.append(f"Title: {post['topic_title']}\nContent: {post['content']}")
        ids.append(str(post['post_id']))
        metadatas.append({
            "topic_title": post['topic_title'],
            "author": post['author'],
            "url": post['url'],
            "created_at": post['created_at'],
            "type": "forum_post",
            "term": post.get('term', 'Unknown'),
            "term_priority": post.get('term_priority', 99)
        })
    
    for i in range(0, len(documents), BATCH_SIZE):
        batch_end = min(i + BATCH_SIZE, len(documents))
        collection.upsert(
            documents=documents[i:batch_end],
            metadatas=metadatas[i:batch_end],
            ids=ids[i:batch_end]
        )
        print(f"  Batch {i//BATCH_SIZE + 1}: {batch_end - i} posts")
    
    print(f"Indexed {len(documents)} posts")


def main():
    index_markdown_docs()
    index_forum_posts()


if __name__ == "__main__":
    main()