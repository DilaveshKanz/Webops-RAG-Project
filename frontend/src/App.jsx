/**
 * File: App.jsx
 * Purpose: Main React component for ZASKY chat interface
 * Features: Message display, chat input, API integration, animated UI
 */

// React hooks for state management, refs, effects, and memoization
import React, { useState, useRef, useEffect, useCallback } from 'react';
// Icon component from lucide-react library
import { ArrowUp } from 'lucide-react';
// HTTP client for API requests
import axios from 'axios';

// API URL configuration: uses environment variable in production, localhost fallback for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Avatar Component
 * Renders animated orb/avatar icon for assistant messages
 * Uses CSS animations for glowing, swirling effects
 */
const Avatar = () => (
    // Container with fixed size, positioned relative for absolute children
    <div className="relative w-10 h-10 mr-4 flex-shrink-0 mt-0.5 select-none">
        {/* Outer glow effect - pulsing amber blur */}
        <div className="absolute inset-0 rounded-full bg-amber-600/20 blur-xl animate-pulse"></div>

        {/* Main orb container with border and inner shadow */}
        <div className="relative w-full h-full rounded-full border border-amber-500/20 bg-[#0a0a0a] overflow-hidden shadow-[inset_0_0_15px_rgba(245,158,11,0.1)]">

            {/* First swirl layer - conic gradient rotating clockwise */}
            <div
                className="absolute top-1/2 left-1/2 w-[200%] h-[200%] opacity-50 mix-blend-overlay"
                style={{
                    background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(217,119,6,0.5) 90deg, transparent 180deg)',
                    animation: 'orbSwirl 6s linear infinite',
                    transform: 'translate(-50%, -50%)'
                }}
            ></div>

            {/* Second swirl layer - counter-rotating for depth effect */}
            <div
                className="absolute top-1/2 left-1/2 w-[200%] h-[200%] opacity-30 mix-blend-color-dodge"
                style={{
                    background: 'conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(251,191,36,0.3) 60deg, transparent 120deg)',
                    animation: 'orbSwirl 10s linear infinite reverse',
                }}
            ></div>

            {/* Core glow - pulsing center of the orb */}
            <div
                className="absolute inset-[25%] rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 blur-sm"
                style={{ animation: 'corePulse 4s ease-in-out infinite' }}
            ></div>

            {/* Highlight reflection on top for 3D glass effect */}
            <div className="absolute top-0 inset-x-0 h-[40%] bg-gradient-to-b from-white/10 to-transparent opacity-80 rounded-t-full"></div>
        </div>
    </div>
);

/**
 * MessageBubble Component
 * Renders a single chat message with styling based on sender
 * Props:
 *   - message: { id, content, sender, timestamp, contexts? }
 *   - isNew: boolean - triggers entrance animation
 */
const MessageBubble = ({ message, isNew }) => {
    // Determine message type for conditional styling
    const isUser = message.sender === 'user';
    const isAssistant = message.sender === 'assistant';

    return (
        // Flex container - aligns user messages right, assistant left
        <div
            className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-8 ${isNew ? 'animate-fadeSlideIn' : ''}`}
        >
            {/* Show avatar only for assistant messages */}
            {isAssistant && <Avatar />}

            {/* Message bubble with glassmorphism effect */}
            <div
                className={`max-w-[85%] md:max-w-[70%] relative px-6 py-4 rounded-2xl border backdrop-blur-md transition-all duration-300 ${isUser
                    ? 'bg-[#1a1a1a] border-[#333] text-white rounded-tr-sm hover:border-amber-500/30'
                    : 'bg-[#1a1a1a]/80 border-[#333] text-gray-100 rounded-tl-sm hover:bg-[#1a1a1a]'
                    }`}
            >
                {/* Message text content */}
                <div className="text-[15px] leading-7 tracking-wide font-normal">
                    {message.content}
                </div>

                {/* Sources/contexts section - shown if contexts array exists */}
                {message.contexts && message.contexts.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#333]">
                        <h4 className="text-xs font-bold text-gray-400 mb-2">Sources:</h4>
                        <ul className="space-y-2">
                            {/* Map through each context and render as clickable link */}
                            {message.contexts.map((context) => (
                                <li key={context.post_id}>
                                    <a
                                        href={context.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-amber-500 hover:underline text-sm"
                                    >
                                        {context.topic_title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Timestamp display - formatted as HH:MM */}
                {message.timestamp && (
                    <span className="text-[10px] mt-2 block text-gray-500 font-medium tracking-wider uppercase">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        </div>
    );
};

/**
 * ChatInput Component
 * Renders the text input area and send button
 * Props:
 *   - onSend: (content: string) => void - callback when message is sent
 *   - disabled: boolean - disables input during loading
 */
const ChatInput = ({ onSend, disabled }) => {
    // Input value state
    const [value, setValue] = useState('');
    // Focus state for visual feedback
    const [isFocused, setIsFocused] = useState(false);
    // Ref for textarea element (for focus and height control)
    const textareaRef = useRef(null);

    // Auto-focus textarea when not disabled
    useEffect(() => {
        if (!disabled && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [disabled]);

    // Handle form submission
    const handleSubmit = () => {
        // Only submit if value is not empty and not disabled
        if (value.trim() && !disabled) {
            onSend(value.trim());
            setValue('');  // Clear input
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    // Handle Enter key (submit), Shift+Enter (new line)
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Handle input change with auto-resize
    const handleInput = (e) => {
        setValue(e.target.value);
        // Auto-resize textarea to content (max 200px)
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
    };

    return (
        // Input container with max width and centering
        <div className="w-full max-w-3xl mx-auto px-4 pb-8 relative z-50">
            {/* Input wrapper with focus state styling */}
            <div
                className={`
                    relative flex items-end gap-2 bg-[#1a1a1a] 
                    border transition-all duration-300 ease-out
                    rounded-[16px] p-2 pr-2
                    ${isFocused
                        ? 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                        : 'border-[#333333] hover:border-[#444]'}
                `}
            >
                {/* Textarea for multi-line input */}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Type a message..."
                    rows={1}
                    className="w-full bg-transparent text-white placeholder-gray-500 text-[16px] resize-none focus:outline-none max-h-[200px] overflow-y-auto py-3 pl-4 font-medium"
                    style={{ scrollbarWidth: 'none' }}  // Hide scrollbar
                    disabled={disabled}
                    autoFocus
                />

                {/* Send button with conditional styling */}
                <button
                    onClick={handleSubmit}
                    disabled={disabled || !value.trim()}
                    className={`
                        mb-1 mr-1 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                        ${value.trim() && !disabled
                            ? 'bg-gradient-to-tr from-amber-600 to-amber-400 text-black shadow-lg hover:scale-105 active:scale-95'
                            : 'bg-[#2a2a2a] text-gray-600 cursor-not-allowed'}
                    `}
                >
                    <ArrowUp size={20} strokeWidth={2.5} />
                </button>
            </div>

            {/* Disclaimer text */}
            <div className="mt-3 text-center">
                <p className="text-[11px] text-[#444] font-medium tracking-wide">
                    ZASKY AI can make mistakes. Consider checking important information.
                </p>
            </div>
        </div>
    );
};

// Initial welcome message shown when app loads
const initialMessages = [
    {
        id: '1',
        content: "Hey there! I'm ZASKY, your AI assistant for the IITM BS. Ask me anything about courses, grades, or policies, I've got everything covered!",
        sender: 'assistant',
        timestamp: new Date(Date.now() - 60000 * 5),  // 5 minutes ago
    }
];

/**
 * App Component (default export)
 * Main application component managing chat state and UI
 */
export default function App() {
    // Array of message objects
    const [messages, setMessages] = useState(initialMessages);
    // Loading state when waiting for API response
    const [isTyping, setIsTyping] = useState(false);
    // Set of message IDs that are "new" (for entrance animation)
    const [newMessageIds, setNewMessageIds] = useState(new Set());
    // Ref for scroll-to-bottom element
    const messagesEndRef = useRef(null);

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Auto-scroll when messages change or typing indicator appears
    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Clear "new" animation class after 600ms
    useEffect(() => {
        if (newMessageIds.size > 0) {
            const timer = setTimeout(() => {
                setNewMessageIds(new Set());
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [newMessageIds]);

    /**
     * Handle sending a message
     * Adds user message to state, calls API, adds response
     * Memoized with useCallback to prevent unnecessary re-renders
     */
    const handleSend = useCallback(async (content) => {
        // Create user message object
        const userMessageId = Date.now().toString();
        const userMessage = {
            id: userMessageId,
            content,
            sender: 'user',
            timestamp: new Date(),
        };
        // Add user message to state
        setMessages((prev) => [...prev, userMessage]);
        setNewMessageIds(new Set([userMessageId]));
        setIsTyping(true);  // Show typing indicator

        try {
            // Call backend API with question
            const response = await axios.post(`${API_URL}/ask`, {
                question: content
            });

            // Create assistant message from response
            const assistantMessageId = (Date.now() + 1).toString();
            const assistantMessage = {
                id: assistantMessageId,
                content: response.data.answer,
                sender: 'assistant',
                timestamp: new Date(),
                contexts: response.data.contexts  // Source references
            };
            // Add assistant message to state
            setMessages((prev) => [...prev, assistantMessage]);
            setNewMessageIds(new Set([assistantMessageId]));
            setIsTyping(false);
        } catch (error) {
            // Log error for debugging
            console.error('Backend error:', error);
            // Default error message
            let errorContent = 'Sorry, I encountered an error. Please try again.';

            // Customize error message based on error type
            if (error.response) {
                // Server responded with error status
                if (error.response.status === 503) {
                    errorContent = 'The AI service is temporarily rate-limited. Please wait a moment and try again, or add your own API key in the backend .env file for higher limits.';
                } else if (error.response.status === 504) {
                    errorContent = 'The request timed out. The AI service might be slow. Please try again.';
                } else {
                    errorContent = `Server error (${error.response.status}). Please try again later.`;
                }
            } else if (error.request) {
                // Request made but no response (network error)
                errorContent = 'Cannot connect to the backend server. Please make sure it\'s running on http://localhost:8000';
            }

            // Add error message to chat
            const errorMessageId = (Date.now() + 1).toString();
            const errorMessage = {
                id: errorMessageId,
                content: errorContent,
                sender: 'assistant',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            setNewMessageIds(new Set([errorMessageId]));
            setIsTyping(false);
        }
    }, []);  // No dependencies - function doesn't depend on external state

    return (
        // Full-screen container with dark background
        <div
            className="fixed inset-0 bg-[#000000] text-white flex flex-col selection:bg-amber-500/30"
            style={{ fontFamily: "'Manrope', sans-serif" }}
        >
            {/* Background decorative blur elements */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                {/* Top-left amber glow */}
                <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-amber-900/10 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[4s]" />
                {/* Bottom-right blue glow */}
                <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-blue-900/5 blur-[100px] rounded-full mix-blend-screen" />
            </div>

            {/* Fixed header with brand name */}
            <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
                {/* Gradient fade for smooth header transition */}
                <div className="absolute inset-0 h-32 bg-gradient-to-b from-black via-black/90 to-transparent" />

                <div className="relative p-8">
                    <span className="text-sm font-bold tracking-[0.2em] text-[#666] uppercase pointer-events-auto cursor-pointer transition-colors duration-300 hover:text-white">
                        Zasky AI
                    </span>
                </div>
            </header>

            {/* Main scrollable message area */}
            <main className="flex-1 w-full max-w-3xl mx-auto pt-24 pb-44 px-6 z-10 overflow-y-scroll overflow-x-hidden scrollbar-hide">
                <div className="pl-4 -ml-4">
                    {/* Render all messages */}
                    {messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isNew={newMessageIds.has(msg.id)}
                        />
                    ))}

                    {/* Typing indicator - animated orb shown while waiting for response */}
                    {isTyping && (
                        <div className="flex items-start mb-8 pl-2">
                            <div className="relative w-10 h-10 mr-4 flex-shrink-0 mt-0.5 flex items-center justify-center">
                                <div className="relative w-8 h-8">
                                    {/* Glow behind orb */}
                                    <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-md animate-pulse"></div>

                                    {/* Morphing orb shape */}
                                    <div
                                        className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full"
                                        style={{
                                            animation: 'amoebaMorph 3s ease-in-out infinite, orbGlow 2s ease-in-out infinite alternate'
                                        }}
                                    ></div>

                                    {/* Core highlight */}
                                    <div
                                        className="absolute inset-[30%] bg-amber-200 rounded-full blur-[2px]"
                                        style={{
                                            animation: 'coreShift 2.5s ease-in-out infinite'
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Scroll anchor element */}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </main>

            {/* Fixed footer with chat input */}
            <footer className="fixed bottom-0 left-0 right-0 z-50">
                {/* Gradient fade above input */}
                <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none" />
                <ChatInput onSend={handleSend} disabled={isTyping} />
            </footer>

            {/* Inline CSS for custom animations (can't be done with Tailwind) */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap');

                /* Message entrance animation */
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .animate-fadeSlideIn {
                    animation: fadeSlideIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
                
                /* Avatar swirl rotation */
                @keyframes orbSwirl {
                    0% { transform: translate(-50%, -50%) rotate(0deg); }
                    100% { transform: translate(-50%, -50%) rotate(360deg); }
                }
                
                /* Avatar core pulsing */
                @keyframes corePulse {
                    0%, 100% { transform: scale(0.8); opacity: 0.6; }
                    50% { transform: scale(1.1); opacity: 1; }
                }
                
                /* Typing indicator organic morph animation */
                @keyframes amoebaMorph {
                    0%, 100% { 
                        border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
                        transform: scale(1) rotate(0deg);
                    }
                    25% {
                        border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
                        transform: scale(1.1) rotate(5deg);
                    }
                    50% {
                        border-radius: 50% 60% 30% 60% / 30% 60% 70% 40%;
                        transform: scale(0.95) rotate(-5deg);
                    }
                    75% {
                        border-radius: 60% 40% 60% 40% / 70% 30% 50% 60%;
                        transform: scale(1.05) rotate(3deg);
                    }
                }
                
                /* Typing indicator glow animation */
                @keyframes orbGlow {
                    0% { 
                        box-shadow: 0 0 15px rgba(251, 191, 36, 0.5),
                                    0 0 30px rgba(251, 191, 36, 0.3),
                                    inset 0 0 15px rgba(251, 191, 36, 0.2);
                    }
                    100% { 
                        box-shadow: 0 0 25px rgba(251, 191, 36, 0.8),
                                    0 0 50px rgba(251, 191, 36, 0.5),
                                    inset 0 0 25px rgba(251, 191, 36, 0.4);
                    }
                }
                
                /* Typing indicator core movement */
                @keyframes coreShift {
                    0%, 100% { 
                        transform: translate(0, 0) scale(1);
                        opacity: 0.8;
                    }
                    33% {
                        transform: translate(-2px, 1px) scale(1.2);
                        opacity: 1;
                    }
                    66% {
                        transform: translate(2px, -1px) scale(0.9);
                        opacity: 0.7;
                    }
                }
                
                /* Hide scrollbar across browsers */
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
