import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import axios from 'axios';

const Avatar = () => (
    <div className="relative w-10 h-10 mr-4 flex-shrink-0 mt-0.5 select-none">
        <div className="absolute inset-0 rounded-full bg-amber-600/20 blur-xl animate-pulse"></div>

        <div className="relative w-full h-full rounded-full border border-amber-500/20 bg-[#0a0a0a] overflow-hidden shadow-[inset_0_0_15px_rgba(245,158,11,0.1)]">

            <div
                className="absolute top-1/2 left-1/2 w-[200%] h-[200%] opacity-50 mix-blend-overlay"
                style={{
                    background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(217,119,6,0.5) 90deg, transparent 180deg)',
                    animation: 'orbSwirl 6s linear infinite',
                    transform: 'translate(-50%, -50%)'
                }}
            ></div>

            <div
                className="absolute top-1/2 left-1/2 w-[200%] h-[200%] opacity-30 mix-blend-color-dodge"
                style={{
                    background: 'conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(251,191,36,0.3) 60deg, transparent 120deg)',
                    animation: 'orbSwirl 10s linear infinite reverse',
                }}
            ></div>

            <div
                className="absolute inset-[25%] rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 blur-sm"
                style={{ animation: 'corePulse 4s ease-in-out infinite' }}
            ></div>

            <div className="absolute top-0 inset-x-0 h-[40%] bg-gradient-to-b from-white/10 to-transparent opacity-80 rounded-t-full"></div>
        </div>
    </div>
);

const MessageBubble = ({ message, isNew }) => {
    const isUser = message.sender === 'user';
    const isAssistant = message.sender === 'assistant';

    return (
        <div
            className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-8 ${isNew ? 'animate-fadeSlideIn' : ''}`}
        >
            {isAssistant && <Avatar />}

            <div
                className={`max-w-[85%] md:max-w-[70%] relative px-6 py-4 rounded-2xl border backdrop-blur-md transition-all duration-300 ${isUser
                    ? 'bg-[#1a1a1a] border-[#333] text-white rounded-tr-sm hover:border-amber-500/30'
                    : 'bg-[#1a1a1a]/80 border-[#333] text-gray-100 rounded-tl-sm hover:bg-[#1a1a1a]'
                    }`}
            >
                <div className="text-[15px] leading-7 tracking-wide font-normal">
                    {message.content}
                </div>

                {message.contexts && message.contexts.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#333]">
                        <h4 className="text-xs font-bold text-gray-400 mb-2">Sources:</h4>
                        <ul className="space-y-2">
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

                {message.timestamp && (
                    <span className="text-[10px] mt-2 block text-gray-500 font-medium tracking-wider uppercase">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        </div>
    );
};

const ChatInput = ({ onSend, disabled }) => {
    const [value, setValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (!disabled && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [disabled]);

    const handleSubmit = () => {
        if (value.trim() && !disabled) {
            onSend(value.trim());
            setValue('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleInput = (e) => {
        setValue(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
    };

    return (
        <div className="w-full max-w-3xl mx-auto px-4 pb-8 relative z-50">
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
                    style={{ scrollbarWidth: 'none' }}
                    disabled={disabled}
                    autoFocus
                />

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

            <div className="mt-3 text-center">
                <p className="text-[11px] text-[#444] font-medium tracking-wide">
                    ZASKY AI can make mistakes. Consider checking important information.
                </p>
            </div>
        </div>
    );
};

const initialMessages = [
    {
        id: '1',
        content: "Hey there! I'm ZASKY, your AI assistant for the IITM BS. Ask me anything about courses, grades, or policies, I've got everything covered!",
        sender: 'assistant',
        timestamp: new Date(Date.now() - 60000 * 5),
    }
];

export default function App() {
    const [messages, setMessages] = useState(initialMessages);
    const [isTyping, setIsTyping] = useState(false);
    const [newMessageIds, setNewMessageIds] = useState(new Set());
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    useEffect(() => {
        if (newMessageIds.size > 0) {
            const timer = setTimeout(() => {
                setNewMessageIds(new Set());
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [newMessageIds]);

    const handleSend = useCallback(async (content) => {
        const userMessageId = Date.now().toString();
        const userMessage = {
            id: userMessageId,
            content,
            sender: 'user',
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setNewMessageIds(new Set([userMessageId]));
        setIsTyping(true);

        try {
            axios.post(`${import.meta.env.VITE_API_URL}/ask`, { question: content })
            .then(res => { /* ... */ })
            .catch(err => console.error(err));}


            const assistantMessageId = (Date.now() + 1).toString();
            const assistantMessage = {
                id: assistantMessageId,
                content: response.data.answer,
                sender: 'assistant',
                timestamp: new Date(),
                contexts: response.data.contexts
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setNewMessageIds(new Set([assistantMessageId]));
            setIsTyping(false);
        } catch (error) {
            console.error('Backend error:', error);
            let errorContent = 'Sorry, I encountered an error. Please try again.';

            if (error.response) {
                if (error.response.status === 503) {
                    errorContent = 'The AI service is temporarily rate-limited. Please wait a moment and try again, or add your own API key in the backend .env file for higher limits.';
                } else if (error.response.status === 504) {
                    errorContent = 'The request timed out. The AI service might be slow. Please try again.';
                } else {
                    errorContent = `Server error (${error.response.status}). Please try again later.`;
                }
            } else if (error.request) {
                errorContent = 'Cannot connect to the backend server. Please make sure it\'s running on http://localhost:8000';
            }

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
    }, []);

    return (
        <div
            className="fixed inset-0 bg-[#000000] text-white flex flex-col selection:bg-amber-500/30"
            style={{ fontFamily: "'Manrope', sans-serif" }}
        >
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-amber-900/10 blur-[120px] rounded-full mix-blend-screen animate-pulse duration-[4s]" />
                <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-blue-900/5 blur-[100px] rounded-full mix-blend-screen" />
            </div>

            <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
                <div className="absolute inset-0 h-32 bg-gradient-to-b from-black via-black/90 to-transparent" />

                <div className="relative p-8">
                    <span className="text-sm font-bold tracking-[0.2em] text-[#666] uppercase pointer-events-auto cursor-pointer transition-colors duration-300 hover:text-white">
                        Zasky AI
                    </span>
                </div>
            </header>

            <main className="flex-1 w-full max-w-3xl mx-auto pt-24 pb-44 px-6 z-10 overflow-y-scroll overflow-x-hidden scrollbar-hide">
                <div className="pl-4 -ml-4">
                    {messages.map((msg) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isNew={newMessageIds.has(msg.id)}
                        />
                    ))}

                    {isTyping && (
                        <div className="flex items-start mb-8 pl-2">
                            <div className="relative w-10 h-10 mr-4 flex-shrink-0 mt-0.5 flex items-center justify-center">
                                <div className="relative w-8 h-8">
                                    <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-md animate-pulse"></div>

                                    <div
                                        className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full"
                                        style={{
                                            animation: 'amoebaMorph 3s ease-in-out infinite, orbGlow 2s ease-in-out infinite alternate'
                                        }}
                                    ></div>

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
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </main>

            <footer className="fixed bottom-0 left-0 right-0 z-50">
                <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none" />
                <ChatInput onSend={handleSend} disabled={isTyping} />
            </footer>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap');

                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .animate-fadeSlideIn {
                    animation: fadeSlideIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
                
                @keyframes orbSwirl {
                    0% { transform: translate(-50%, -50%) rotate(0deg); }
                    100% { transform: translate(-50%, -50%) rotate(360deg); }
                }
                @keyframes corePulse {
                    0%, 100% { transform: scale(0.8); opacity: 0.6; }
                    50% { transform: scale(1.1); opacity: 1; }
                }
                
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
                
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
