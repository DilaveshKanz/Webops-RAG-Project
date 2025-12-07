import { useState } from "react";
import axios from "axios";

function App() {
  const [content, setContent] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_URL = import.meta.env.VITE_API_URL;

  const handleAsk = async () => {
    if (!content.trim()) return;

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const response = await axios.post(
        `${API_URL}/ask`,
        { question: content },
        { timeout: 30000 }
      );

      setAnswer(response.data.answer);
    } catch (err) {
      console.error(err);

      if (err.response) {
        setError(`Server error: ${err.response.status}`);
      } else if (err.request) {
        setError("Cannot reach backend. Is the Space running?");
      } else {
        setError("Unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>ZASKY AI</h1>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ask your question..."
        rows={5}
        style={{ width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
      />

      <button
        onClick={handleAsk}
        disabled={loading}
        style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
      >
        {loading ? "Thinking..." : "Ask"}
      </button>

      {error && (
        <div style={{ marginTop: "1rem", color: "red" }}>
          {error}
        </div>
      )}

      {answer && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Answer:</h3>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}

export default App;
