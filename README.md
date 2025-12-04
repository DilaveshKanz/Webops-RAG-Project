# 🎓 Discourse RAG Q&A Assistant

> An intelligent Question-Answering system powered by Retrieval-Augmented Generation (RAG) for Discourse forums

A full-stack web application that helps students and instructors find answers from Discourse forum discussions using advanced AI and vector search technology.

---

## ✨ Features

- 🔍 **Semantic Search** - Find relevant forum posts using AI-powered embeddings
- 🤖 **AI-Powered Answers** - Generate contextual responses using LLM via OpenRouter/AIPipe
- 📚 **Multi-Source Knowledge** - Indexes both forum posts and official documents
- 🔄 **Auto-Sync** - Automatically fetches new forum content
- ⚡ **Real-time Responses** - Fast vector search with ChromaDB
- 🎨 **Modern UI** - Clean, responsive React interface with glassmorphism design
- 📊 **Source Citations** - Every answer includes clickable source links

---

## 🛠️ Tech Stack

### Backend
- **Framework:** FastAPI
- **Vector Database:** ChromaDB
- **Embeddings:** Sentence Transformers (`all-MiniLM-L6-v2`)
- **LLM:** OpenRouter models via AIPipe
- **Web Scraping:** BeautifulSoup4

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios

---

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn
- AIPipe account ([https://aipipe.org](https://aipipe.org))
- Access to a Discourse forum

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/DilaveshKanz/Webops-RAG-Project
cd Discourse_RAG_Project
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create environment file
cp backend/.env.example backend/.env
```

**Edit `backend/.env` with your credentials:**

```env
DISCOURSE_URL=https://your-discourse-forum.com
DISCOURSE_ALL_COOKIES=your_discourse_cookies_here
AIPIPE_TOKEN=your_aipipe_token_here
LLM_MODEL=openai/gpt-4.1-nano
LLM_BASE_URL=https://aipipe.org/openrouter/v1
AUTO_SYNC=true
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

---

## 🔧 Configuration

### Getting Discourse Cookies

1. Log in to your Discourse forum
2. Open browser DevTools (F12)
3. Go to Network tab
4. Refresh the page
5. Click any request and copy the `Cookie` header value
6. Paste into `DISCOURSE_ALL_COOKIES` in `.env`

### Getting AIPipe Token

1. Sign up at [https://aipipe.org](https://aipipe.org)
2. Create a new pipeline with OpenRouter integration
3. Copy your API token
4. Paste into `AIPIPE_TOKEN` in `.env`

---

## 📊 Database Setup

### Initial Data Ingestion

Fetch forum posts and create the vector database:

```bash
# Navigate to backend/app directory
cd backend/app

# Fetch forum posts (minimum 500 posts)
python ingestion.py term

# Index posts into ChromaDB
python rag.py
```

This will create:
- `discourse_data.json` - Raw forum data
- `chroma_db/` - Vector database
- `sync_state.json` - Sync tracking

### Incremental Updates

```bash
python ingestion.py incremental
```

---

## ▶️ Running the Application

### Start Backend Server

```bash
# From project root
cd backend/app
uvicorn main:app --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`

### Start Frontend Development Server

```bash
# From project root
cd frontend
npm run dev
```

Frontend will be available at: `http://localhost:5173`

---

## 📁 Project Structure

```
Discourse_RAG_Project/
├── backend/
│   ├── .env.example          # Environment variables template
│   └── app/
│       ├── main.py           # FastAPI application & RAG logic
│       ├── ingestion.py      # Discourse data fetching
│       ├── rag.py            # Vector database indexing
│       ├── gdocs_sync.py     # Google Docs sync utility
│       └── data/             # Official documents (markdown)
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   ├── index.css         # Global styles
│   │   └── components/       # React components
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite configuration
├── requirements.txt          # Python dependencies
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

---

## 🔌 API Endpoints

### `POST /ask`

Ask a question and get an AI-generated answer with sources.

**Request:**
```json
{
  "question": "What is the grading formula for MLT?"
}
```

**Response:**
```json
{
  "answer": "The grading formula for MLT is...",
  "contexts": [
    {
      "post_id": "12345",
      "topic_title": "MLT Grading Discussion",
      "url": "https://forum.example.com/t/...",
      "excerpt": "...",
      "score": 0.87,
      "term": "Jan-May 2025"
    }
  ]
}
```

### `GET /health`

Check API health status.

**Response:**
```json
{
  "status": "ok",
  "auto_sync": true
}
```

### `POST /sync`

Manually trigger forum data sync.

