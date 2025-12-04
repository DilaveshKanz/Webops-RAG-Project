import os
import json
import uvicorn
import threading
import schedule
import time
import traceback
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import chromadb
from chromadb.utils import embedding_functions
import requests
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Validate required environment variables
REQUIRED_ENV_VARS = {
    "DISCOURSE_URL": "Discourse forum URL (e.g., https://discourse.example.com)",
    "DISCOURSE_ALL_COOKIES": "Discourse authentication cookies",
    "AIPIPE_TOKEN": "AIPipe API token for LLM access"
}

missing_vars = []
for var, description in REQUIRED_ENV_VARS.items():
    if not os.getenv(var):
        missing_vars.append(f"  - {var}: {description}")

if missing_vars:
    error_msg = "\n❌ Missing required environment variables:\n" + "\n".join(missing_vars)
    error_msg += "\n\n💡 Please create a .env file in the backend/ directory."
    error_msg += "\n   See backend/.env.example for the template.\n"
    print(error_msg)
    raise EnvironmentError(error_msg)

DB_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")
COLLECTION_NAME = "discourse_posts"
LLM_API_KEY = os.getenv("AIPIPE_TOKEN", "").strip()
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://aipipe.org/openrouter/v1").strip().rstrip('/')
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-4.1-nano")
AUTO_SYNC_ENABLED = os.getenv("AUTO_SYNC", "true").lower() == "true"

client = chromadb.PersistentClient(path=DB_PATH)
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

COURSE_ABBREVIATIONS = {
    "mlt": "Machine Learning Techniques",
    "mlf": "Machine Learning Foundations",
    "mlp": "Machine Learning Practice",
    "bdm": "Business Data Management",
    "ba": "Business Analytics",
    "tds": "Tools in Data Science",
    "pdsa": "Programming Data Structures and Algorithms",
    "dbms": "Database Management System",
    "appdev": "Application Development",
    "appdev1": "Application Development 1",
    "appdev2": "Application Development 2",
    "sc": "System Commands",
    "ct": "Computational Thinking",
    "stats1": "Statistics for Data Science 1",
    "stats2": "Statistics for Data Science 2",
    "mad1": "Modern Application Development 1",
    "mad2": "Modern Application Development 2",
    "se": "Software Engineering",
    "st": "Software Testing",
    "dl": "Deep Learning",
    "dlcv": "Deep Learning for Computer Vision",
    "llm": "Large Language Models",
    "ai": "AI Search Methods for Problem Solving",
    "spg": "Strategies for Professional Growth",
    "bigdata": "Introduction to Big Data",
    "cprog": "Programming in C",
    "java": "Programming Concepts using Java",
    "mlops": "MLOPS",
    "oppe": "Online Programming Proctored Exam",
    "gaa": "Graded Assignment Average",
    "et": "End Term",
    "f": "Final Exam",
}

GREETINGS = frozenset([
    "hi", "hello", "hey", "hii", "hiii", "heya", "hola", "yo", "sup",
    "good morning", "good afternoon", "good evening", "good night",
    "how are you", "how are you?", "what's up", "whats up", "wassup",
    "hi there", "hello there", "hey there", "thanks", "thank you", "ok", "okay"
])

LATEST_KEYWORDS = frozenset(["latest", "recent", "newest", "new posts", "today", "this week"])
RELEVANCE_THRESHOLD = 0.25

app = FastAPI(title="ZASKY API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str

class Context(BaseModel):
    post_id: str
    topic_title: str
    url: str
    excerpt: str
    score: float
    term: Optional[str] = None

class AskResponse(BaseModel):
    answer: str
    contexts: List[Context]


def get_collection():
    return client.get_collection(name=COLLECTION_NAME, embedding_function=embed_fn)

def get_current_term_name():
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month
    if 1 <= month <= 4:
        return f"Jan-May {year}"
    elif 5 <= month <= 8:
        return f"May-Sept {year}"
    return f"Sept-Dec {year}"

def expand_abbreviations(text):
    words = text.lower().split()
    return " ".join(COURSE_ABBREVIATIONS.get(w.strip(".,?!"), w) for w in words)

def detect_special_query(q):
    if any(w in q for w in ["what can you do", "help me", "how do you work", "your capabilities"]):
        return "help"
    if any(w in q for w in ["about iitm", "what is zasky", "who are you", "about you"]):
        return "about"
    if any(w in q for w in ["how many courses", "list of courses", "all courses"]):
        return "courses_list"
    return None

def get_help_response():
    return """I'm ZASKY, your AI assistant for IITM BS Data Science. I can help with:

- Course Info: Ask about any course (MLT, BDM, PDSA, etc.)
- Grading: "What's the grading equation for MLT?"
- Dates: "When is Quiz 1?" or "OPPE dates"
- Forum: "Latest discussions" or course-specific questions
- Handbook: Policies, eligibility, etc.

Just ask naturally!"""

def get_about_response():
    return """I'm ZASKY, an AI assistant for IITM BS Data Science students.

I have access to:
- Student forum discussions (5000+ posts)
- Official grading documents
- Student handbook

I prioritize official documents for academic info and can summarize forum discussions."""

def query_llm(prompt: str):
    if not LLM_API_KEY:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    headers = {"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": "You are ZASKY, a concise AI assistant for IITM students. Only use information from provided sources. Never make up information."},
            {"role": "user", "content": prompt}
        ]
    }
    
    try:
        response = requests.post(f"{LLM_BASE_URL}/chat/completions", headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"AI service error: {e.response.status_code}")
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="AI service timeout")
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Cannot connect to AI service")
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


def run_sync():
    try:
        from ingestion import fetch_posts
        fetch_posts(mode="incremental")
        global collection
        collection = get_collection()
    except Exception as e:
        print(f"[SYNC ERROR] {e}")

def scheduler_thread():
    schedule.every().day.at("06:00").do(run_sync)
    schedule.every().day.at("21:00").do(run_sync)
    while True:
        schedule.run_pending()
        time.sleep(60)


@app.on_event("startup")
def startup_event():
    if AUTO_SYNC_ENABLED:
        threading.Thread(target=scheduler_thread, daemon=True).start()

@app.get("/health")
def health_check():
    return {"status": "ok", "auto_sync": AUTO_SYNC_ENABLED}

@app.post("/sync")
def manual_sync():
    run_sync()
    return {"status": "ok", "message": "Sync completed"}

@app.post("/ask", response_model=AskResponse)
def ask_question(request: AskRequest):
    try:
        question_lower = request.question.lower().strip()
        is_course_abbrev = question_lower in COURSE_ABBREVIATIONS
        is_greeting = (question_lower in GREETINGS or len(question_lower) < 3) and not is_course_abbrev
        
        if is_greeting:
            prompt = f'The student said: "{request.question}". Respond warmly in 1 sentence, then ask how you can help with studies.'
            return AskResponse(answer=query_llm(prompt), contexts=[])
        
        special = detect_special_query(question_lower)
        if special == "help":
            return AskResponse(answer=get_help_response(), contexts=[])
        if special == "about":
            return AskResponse(answer=get_about_response(), contexts=[])
        if special == "courses_list":
            courses = ", ".join(sorted(set(COURSE_ABBREVIATIONS.values())))
            return AskResponse(answer=f"Courses I know about:\n\n{courses}", contexts=[])
        
        if any(kw in question_lower for kw in LATEST_KEYWORDS):
            data_file = os.path.join(os.path.dirname(__file__), "discourse_data.json")
            if os.path.exists(data_file):
                with open(data_file, "r", encoding="utf-8") as f:
                    posts = json.load(f)
                posts_sorted = sorted(posts, key=lambda x: x.get('created_at', ''), reverse=True)[:5]
                
                contexts = []
                context_str = ""
                for i, post in enumerate(posts_sorted):
                    contexts.append(Context(
                        post_id=str(post['post_id']),
                        topic_title=post['topic_title'],
                        url=post['url'],
                        excerpt=post['content'][:200] + "...",
                        score=1.0,
                        term=post.get('term', 'Unknown')
                    ))
                    context_str += f"\n{i+1}. {post['topic_title']} ({post['created_at'][:10]})\n{post['content'][:400]}\n"
                
                prompt = f"Summarize these latest forum discussions in 2-3 sentences:\n{context_str}"
                return AskResponse(answer=query_llm(prompt), contexts=contexts)
            return AskResponse(answer="Forum data not loaded.", contexts=[])
        
        current_term = get_current_term_name()
        expanded_query = expand_abbreviations(request.question)
        collection = get_collection()
        
        try:
            results = collection.query(
                query_texts=[expanded_query],
                n_results=5,
                where={"$or": [{"term": current_term}, {"term": "all"}]}
            )
            texts = results['documents'][0] if results['documents'] else []
            if len(texts) < 2:
                results = collection.query(query_texts=[expanded_query], n_results=5)
        except Exception:
            results = collection.query(query_texts=[expanded_query], n_results=5)
        
        texts = results['documents'][0]
        metas = results['metadatas'][0]
        dists = results['distances'][0]
        ids = results['ids'][0]
        
        combined = sorted(
            zip(texts, metas, dists, ids),
            key=lambda x: (0 if x[1].get('type') == 'document' else 1, x[1].get('term_priority', 99), x[2])
        )
        
        contexts = []
        context_str = ""
        for i, (text, meta, dist, doc_id) in enumerate(combined[:5]):
            score = 1 - dist
            if score < RELEVANCE_THRESHOLD or len(contexts) >= 3:
                continue
            contexts.append(Context(
                post_id=doc_id,
                topic_title=meta.get('topic_title', 'Unknown'),
                url=meta.get('url', '#'),
                excerpt=text[:200] + "...",
                score=score,
                term=meta.get('term', 'Unknown')
            ))
            context_str += f"\n=== {meta.get('topic_title', 'Document')} ===\n{text[:2000]}\n"
        
        if not contexts:
            return AskResponse(answer="I couldn't find relevant information for your question.", contexts=[])
        
        prompt = f"""Answer based on sources. Be specific with dates, formulas, numbers.
Quiz 1: Oct 26, 2025. Quiz 2: Nov 23, 2025. End Term: Dec 21, 2025.

SOURCES:
{context_str}

QUESTION: {request.question}

ANSWER:"""
        
        return AskResponse(answer=query_llm(prompt), contexts=contexts)
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


collection = get_collection()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
