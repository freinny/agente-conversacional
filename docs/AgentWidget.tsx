
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { apiClient } from '../utils/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, Trash2, X, MessageCircle, BookOpen, Lock, Volume2 } from 'lucide-react';
import UserBar from './UserBar';
import LearningPath from './LearningPath';
import ResourceViewer from './ResourceViewer';
import ComprehensionLab from './ComprehensionLab';
import { useRealTimeVoice } from '../hooks/useRealTimeVoice';
import { useVoiceTimer } from '../hooks/useVoiceTimer';
import { useLanguage } from '../contexts/LanguageContext';
import Playground from './Playground';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrapedArticle } from '../hooks/useComprehension';
import { useStats } from '../contexts/StatsContext';
import { useUser } from '../contexts/UserContext';

interface Message {
    role: 'user' | 'assistant';
    message: string;
    timestamp: number;
    pronunciationData?: {
        text: string;
        language: string;
        audioUrl: string;
        phonetic: string;
        speed: number;
    };
}

interface UIAction {
    type: string;
    params: any;
}

interface LessonTopic {
    id: string;
    title: string;
    description: string;
}

import { AvatarDisplay } from './AvatarDisplay';

interface AgentWidgetProps {
    onSendMessage: (message: string) => void;
}

interface SelectedResource {
    id: string;
    type: 'news' | 'video';
    title: string;
    description: string;
    url: string;
    thumbnail?: string;
    source: string;
}

const AgentWidget: React.FC<AgentWidgetProps> = ({ onSendMessage }) => {
    const { t } = useLanguage();
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeContext, setActiveContext] = useState<LessonTopic | null>(null);
    const [voiceState, setVoiceState] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
    const [progressRefreshTrigger, setProgressRefreshTrigger] = useState(0);
    const [pronunciationData, setPronunciationData] = useState<any>(null);
    const [selectedResource, setSelectedResource] = useState<SelectedResource | null>(null);
    const [viewMode, setViewMode] = useState<'chat' | 'resource'>('chat');
    const [scrapedArticle, setScrapedArticle] = useState<ScrapedArticle | null>(null);

    // Feature access check
    const { hasFeature, user: currentUser } = useUser();
    // Voice access requires conversation_practice feature only
    const hasVoiceAccess = hasFeature('conversation_practice');

    // Get target language from current user
    const targetLanguage = currentUser?.targetLanguage || 'en';

    // Use the new RealTime Voice hook
    const {
        isConnected,
        isRecording,
        isPlaying,
        avatarStream,
        isAvatarConnecting,
        avatarError,
        connect,
        disconnect
    } = useRealTimeVoice({
        onStateChange: setVoiceState,
        onPronunciationAnalysis: (data) => {
            console.log('[AgentWidget] Received pronunciation analysis:', data);
            setPronunciationData(data);
            // Record stats immediately
            if (data.overallSimilarity !== undefined) {
                recordPronunciation(data.overallSimilarity);
            }
        },
        targetLanguage  // Pass user's target language to voice
    });

    // Stats hook
    const { recordPronunciation } = useStats();

    // Get user ID for voice timer
    const [userId, setUserId] = useState<number | null>(null);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            setUserId(user.id);
        }
    }, []);

    // Track voice practice time
    useVoiceTimer({
        userId: userId || 0,
        topicId: activeContext?.id || null,
        isConnected
    });

    // Listen for copilot voice chat trigger
    useEffect(() => {
        const handleStartVoiceChat = () => {
            console.log('[AgentWidget] Received startVoiceChat event from copilot');
            if (!isConnected && hasVoiceAccess) {
                console.log('[AgentWidget] Starting voice chat...');
                connect(activeContext?.title);
            }
        };

        window.addEventListener('startVoiceChat', handleStartVoiceChat);
        return () => window.removeEventListener('startVoiceChat', handleStartVoiceChat);
    }, [isConnected, hasVoiceAccess, activeContext, connect]);

    // Refresh progress bar when voice disconnects
    const prevConnectedRef = useRef(isConnected);
    useEffect(() => {
        if (prevConnectedRef.current && !isConnected) {
            // Voice just disconnected, refresh progress
            setProgressRefreshTrigger(prev => prev + 1);
        }
        prevConnectedRef.current = isConnected;
    }, [isConnected]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const location = useLocation();
    const navigate = useNavigate();

    const initRef = useRef(false);

    // Unified initialization effect
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const initializeWidget = async () => {
            const state = location.state as any;

            // Check for practice mode in the initial state
            if (state?.practiceMode === 'fix-error' && state?.focusArea) {
                const { focusArea, context } = state;

                let contextStr = '';
                if (context) {
                    contextStr = ' Context: ' + context;
                }

                const initMessage = 'I want to practice correcting my errors related to "' + focusArea + '".' + contextStr + ' Please generate a practice sentence for me to correct.';

                try {
                    // Show the user intent optimisticly
                    const optimisticMsg: Message = { role: 'user', message: initMessage, timestamp: Date.now() };
                    setMessages([optimisticMsg]); // Start fresh for practice
                    setIsLoading(true);

                    const data = await apiClient.post<any>('/api/chat/message', {
                        message: initMessage,
                        history: [], // Start fresh history for this specific practice
                        context: {
                            topic: 'Error Fix: ' + focusArea,
                            topicId: 'error-fix',
                            description: context || 'Targeted error practice session'
                        }
                    });

                    // Add response
                    const botMsg: Message = {
                        role: 'assistant',
                        message: data.botMessage.message,
                        timestamp: data.botMessage.timestamp
                    };
                    setMessages(prev => [...prev, botMsg]);

                    // Handle UI actions if present
                    if (data.uiActions && Array.isArray(data.uiActions) && data.uiActions.length > 0) {
                        executeUIActions(data.uiActions);
                    }

                    // Clear state to prevent re-running on refresh, but this won't re-trigger this effect due to [] deps
                    navigate(location.pathname, { replace: true, state: {} });
                } catch (error) {
                    console.error('Failed to init practice session', error);
                    // Fallback to history if failed
                    loadChatHistory(targetLanguage);
                } finally {
                    setIsLoading(false);
                }
            } else {
                // Standard load - fetch history
                loadChatHistory(targetLanguage);
            }
        };

        initializeWidget();
    }, []); // Empty dependency array ensures this runs only once on mount

    // Reload history when targetLanguage changes
    useEffect(() => {
        if (initRef.current) {
            console.log(`[AgentWidget] targetLanguage changed to ${targetLanguage}, reloading history...`);
            loadChatHistory(targetLanguage);
        }
    }, [targetLanguage]);

    const loadChatHistory = async (lang: string) => {
        try {
            const data = await apiClient.get<any>(`/api/chat/history?language=${lang}`);
            setMessages(data.messages || []);
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    };

    const clearHistory = async () => {
        if (!confirm(t('common.confirmClearHistory', { defaultValue: 'Are you sure you want to clear all chat history?' }))) return;

        try {
            await apiClient.delete('/api/chat/history');
            setMessages([]);
        } catch (error) {
            console.error('Error clearing chat history:', error);
        }
    };

    const handleTopicSelect = async (topic: LessonTopic) => {
        setActiveContext(topic);

        // Better formatted context message
        const contextMessage = `${t('common.learning')}: **${topic.title}**\n\n${topic.description}`;

        // Optimistic UI for topic selection
        const timestamp = Date.now();
        const userMsg: Message = {
            role: 'user',
            message: `${t('common.learning')}: ${topic.title}`, // Shorter version for the bubble
            timestamp
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const data = await apiClient.post<any>('/api/chat/message', {
                message: contextMessage,
                context: {
                    topic: topic.title,
                    topicId: topic.id,
                    description: topic.description
                },
                targetLanguage
            });

            // Backend returns { userMessage, botMessage }
            // We use the bot message and update the user message if needed
            const botMsg: Message = {
                role: 'assistant',
                message: data.botMessage.message,
                timestamp: data.botMessage.timestamp || (timestamp + 100)
            };

            setMessages(prev => [...prev, botMsg]);

            // Handle UI actions if present
            if (data.uiActions && Array.isArray(data.uiActions) && data.uiActions.length > 0) {
                executeUIActions(data.uiActions);
            }
        } catch (error) {
            console.error('Error setting context:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const clearContext = () => {
        setActiveContext(null);
    };

    const toggleVoiceChat = () => {
        if (isConnected) {
            disconnect();
        } else {
            connect(activeContext?.title, undefined, user?.voiceServiceMode || 'mic');
        }
    };

    const handleSend = async () => {
        if (inputValue.trim()) {
            const messageText = inputValue;

            // Optimistic UI: Add user message immediately
            const timestamp = Date.now();
            const optimisticUserMessage: Message = {
                role: 'user',
                message: messageText,
                timestamp: timestamp
            };

            setMessages(prev => [...prev, optimisticUserMessage]);
            setInputValue('');
            setIsLoading(true);

            try {
                const data = await apiClient.post<any>('/api/chat/message', {
                    message: messageText,
                    history: messages.map(m => ({ role: m.role, message: m.message })), // Use 'message' property
                    context: activeContext ? {
                        topic: activeContext.title,
                        topicId: activeContext.id,
                        description: activeContext.description
                    } : undefined,
                    targetLanguage // Pass current language context
                });

                // Backend returns { userMessage, botMessage, uiActions }
                const botMessage: Message = {
                    role: 'assistant',
                    message: data.botMessage.message,
                    timestamp: data.botMessage.timestamp
                };
                setMessages(prev => [...prev, botMessage]);

                // Handle UI actions if present
                if (data.uiActions && Array.isArray(data.uiActions) && data.uiActions.length > 0) {
                    executeUIActions(data.uiActions);
                }

                onSendMessage(messageText);
            } catch (error) {
                console.error('Error sending message:', error);
                // Remove optimistic message on error
                setMessages(prev => prev.filter(msg => msg.timestamp !== timestamp));
            } finally {
                setIsLoading(false);
            }
        }
    };

    const executeUIActions = (actions: UIAction[]) => {
        console.log('[AgentWidget] Executing UI actions:', actions);

        actions.forEach(action => {
            switch (action.type) {
                case 'pronunciation':
                    console.log('[AgentWidget] Pronunciation action:', action.params);
                    // Update the last assistant message with pronunciation data
                    setMessages(prev => {
                        const updated = [...prev];
                        const lastAssistantIdx = updated.map((m, i) => m.role === 'assistant' ? i : -1)
                            .filter(i => i !== -1)
                            .pop();

                        if (lastAssistantIdx !== undefined) {
                            updated[lastAssistantIdx] = {
                                ...updated[lastAssistantIdx],
                                pronunciationData: action.params
                            };
                        }
                        return updated;
                    });
                    break;

                default:
                    console.warn('[AgentWidget] Unknown UI action type:', action.type);
            }
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const userName = user?.name || user?.email || 'User';

    return (
        <>
            <UserBar userName={userName} onLogout={handleLogout} />
            <div className="flex h-screen" data-tour="chat-interface">
                {/* Left Sidebar - Learning Path */}
                <div className="w-80 flex-shrink-0 border-r border-main bg-surface">
                    <LearningPath
                        onTopicSelect={handleTopicSelect}
                        activeTopicId={activeContext?.id || null}
                        refreshTrigger={progressRefreshTrigger}
                        onResourceSelect={(resource) => {
                            setSelectedResource(resource);
                            setViewMode('resource');
                        }}
                    />
                </div>

                {/* Center - Resource Viewer or Chat */}
                {viewMode === 'resource' && selectedResource ? (
                    <ResourceViewer
                        resource={selectedResource}
                        onClose={() => {
                            setSelectedResource(null);
                            setScrapedArticle(null);
                            setViewMode('chat');
                        }}
                        onArticleLoaded={(article) => setScrapedArticle(article)}
                    />
                ) : (
                    <div className="flex-1 flex flex-col bg-main text-primary min-w-0 border-r border-main transition-colors duration-300" data-tour="chat-center">
                        {/* Header */}
                        <div className="p-4 border-b border-main flex justify-between items-center bg-glass-bg backdrop-blur z-10 transition-colors duration-300">
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                    {t('agentWidget.aiTutor')}
                                </h1>
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className={'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ' + (isConnected ? 'bg-green-400' : 'bg-gray-400')}></span>
                                        <span className={'relative inline-flex rounded-full h-2 w-2 ' + (isConnected ? 'bg-green-500' : 'bg-gray-500')}></span>
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {isConnected
                                            ? (voiceState === 'speaking' ? t('agentWidget.speaking') : t('agentWidget.listening'))
                                            : t('agentWidget.readyToChat')}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={clearHistory}
                                    className="p-2 hover:bg-surface-hover rounded-full transition-colors text-secondary hover:text-red-400"
                                    title={t('common.delete')}
                                >
                                    <Trash2 size={20} />
                                </button>
                                {activeContext && (
                                    <button
                                        onClick={() => setActiveContext(null)}
                                        className="p-2 hover:bg-surface-hover rounded-full transition-colors text-secondary hover:text-primary"
                                        title={t('common.close')}
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Context banner */}
                        <AnimatePresence>
                            {activeContext && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-900/10 to-purple-900/10 border-b border-main"
                                >
                                    <p className="text-sm text-primary">
                                        <span className="text-secondary opacity-70">{t('common.learning')}:</span>{' '}
                                        <span className="font-semibold text-blue-500">{activeContext.title}</span>
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={'flex ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}
                                >
                                    <div
                                        className={'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ' + (
                                            msg.role === 'user'
                                                ? 'bg-blue-600 text-white border border-blue-500/20 shadow-blue-500/10'
                                                : 'bg-surface text-primary border border-main'
                                        )}
                                    >
                                        {msg.role === 'assistant' ? (
                                            <>
                                                <div className="prose prose-sm prose-invert max-w-none text-[13px] leading-relaxed">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.message}
                                                    </ReactMarkdown>
                                                </div>

                                                {/* Pronunciation Player */}
                                                {msg.pronunciationData && (
                                                    <div className="mt-3 p-3 bg-gray-100 border border-gray-300 rounded-lg shadow-sm">
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <Volume2 className="w-4 h-4 text-gray-700 mt-0.5 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-gray-900 mb-1">
                                                                    Pronunciation: "{msg.pronunciationData.text}"
                                                                </p>
                                                                <p className="text-[10px] text-gray-600 font-mono break-all font-medium">
                                                                    {msg.pronunciationData.phonetic}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <audio
                                                            controls
                                                            className="w-full h-8 mt-2"
                                                            style={{
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            <source src={msg.pronunciationData.audioUrl} type="audio/mpeg" />
                                                        </audio>
                                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 font-medium">
                                                            <span>Speed: {msg.pronunciationData.speed}x</span>
                                                            <span>•</span>
                                                            <span>{msg.pronunciationData.language.toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-[13px] leading-relaxed">{msg.message}</p>
                                        )}
                                        <p className="text-[10px] opacity-50 mt-2">
                                            {(() => {
                                                if (!msg.timestamp) return new Date().toLocaleTimeString();
                                                const d = new Date(msg.timestamp);
                                                return isNaN(d.getTime()) ? new Date().toLocaleTimeString() : d.toLocaleTimeString();
                                            })()}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-surface rounded-2xl px-4 py-3 border border-main">
                                        <div className="flex gap-1.5">
                                            <span className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Voice Chat Full-Screen Overlay */}
                        <AnimatePresence>
                            {isConnected && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-8"
                                >
                                    <div className="text-center w-full max-w-4xl">
                                        {currentUser?.voiceServiceMode === 'avatar' ? (
                                            <div className="w-full aspect-video max-w-2xl mx-auto mb-8">
                                                <AvatarDisplay
                                                    stream={avatarStream}
                                                    isConnecting={isAvatarConnecting}
                                                    error={avatarError}
                                                />
                                            </div>
                                        ) : (
                                            /* Circular Pulse Animation */
                                            <div className="relative w-64 h-64 mx-auto mb-8">
                                                {/* Outer rings */}
                                                {[...Array(3)].map((_, i) => (
                                                    <motion.div
                                                        key={i}
                                                        className="absolute inset-0 rounded-full border-2 border-blue-400/30"
                                                        animate={{
                                                            scale: voiceState === 'listening' ? [1, 1.5, 1.8] : [1, 1.2, 1.4],
                                                            opacity: [0.6, 0.3, 0],
                                                        }}
                                                        transition={{
                                                            duration: 2,
                                                            repeat: Infinity,
                                                            delay: i * 0.4,
                                                            ease: "easeOut"
                                                        }}
                                                    />
                                                ))}

                                                {/* Center circle with icon */}
                                                <motion.div
                                                    className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl"
                                                    animate={{
                                                        scale: voiceState === 'listening' ? [1, 1.05, 1] : [1, 1.02, 1],
                                                    }}
                                                    transition={{
                                                        duration: 1.5,
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                >
                                                    <Mic className="w-24 h-24 text-white" />
                                                </motion.div>

                                                {/* Audio wave bars around circle */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    {[...Array(12)].map((_, i) => (
                                                        <motion.div
                                                            key={i}
                                                            className="absolute w-1 bg-blue-400 rounded-full"
                                                            style={{
                                                                left: '50%',
                                                                top: '50%',
                                                                transformOrigin: 'center',
                                                                transform: 'rotate(' + (i * 30) + 'deg) translateY(-140px)',
                                                            }}
                                                            animate={{
                                                                height: voiceState === 'listening'
                                                                    ? [16, 32, 16]
                                                                    : voiceState === 'speaking'
                                                                        ? [8, 24, 8]
                                                                        : [8, 8, 8],
                                                            }}
                                                            transition={{
                                                                duration: 0.6,
                                                                repeat: Infinity,
                                                                delay: i * 0.05,
                                                                ease: "easeInOut"
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Status Text */}
                                        <motion.div
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.2 }}
                                        >
                                            <h2 className="text-3xl font-bold text-white mb-4">
                                                {voiceState === 'speaking' ? `🎤 ${t('agentWidget.speaking')}` : `👂 ${t('agentWidget.listening')}`}
                                            </h2>
                                            <p className="text-lg text-gray-300 mb-8">
                                                {voiceState === 'speaking'
                                                    ? t('agentWidget.aiResponding')
                                                    : t('agentWidget.speakClearly')}
                                            </p>

                                            {/* Close button */}
                                            <button
                                                onClick={toggleVoiceChat}
                                                className="px-8 py-4 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30 transition-all border-2 border-red-500/50 font-semibold text-lg shadow-lg hover:shadow-red-500/25"
                                            >
                                                {t('agentWidget.endSession')}
                                            </button>
                                        </motion.div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Input Area */}
                        <div className="p-6 border-t border-main bg-glass-bg backdrop-blur transition-colors duration-300">
                            <div className="relative flex items-center gap-2 max-w-4xl mx-auto">
                                <button
                                    onClick={hasVoiceAccess ? toggleVoiceChat : undefined}
                                    disabled={!hasVoiceAccess}
                                    className={'p-3 rounded-full transition-all ' + (
                                        !hasVoiceAccess
                                            ? 'bg-main text-secondary opacity-50 cursor-not-allowed'
                                            : isConnected
                                                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 ring-2 ring-red-500/30'
                                                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg hover:shadow-blue-500/25'
                                    )}
                                    title={
                                        !hasVoiceAccess
                                            ? t('agentWidget.voiceNotAvailable')
                                            : isConnected
                                                ? t('agentWidget.endSession')
                                                : t('agentWidget.startConversation')
                                    }
                                    data-tour="voice-mic"
                                >
                                    {isConnected ? <X size={20} /> : <Mic size={20} />}
                                </button>
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={isConnected ? t('agentWidget.voiceActive') : t('agentWidget.typePlaceholder')}
                                    disabled={isConnected}
                                    className="w-full bg-surface text-primary rounded-full pl-6 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-main disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    data-tour="chat-input"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim() || isLoading || isConnected}
                                    className="absolute right-2 p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                            <p className="text-center text-xs text-secondary mt-2 opacity-70">
                                {isConnected ? t('agentWidget.speakClearly') : t('agentWidget.inputHelp')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Right Sidebar - Changes based on mode */}
                <div className="w-[380px] flex-shrink-0 bg-surface border-l border-main">
                    {viewMode === 'resource' && selectedResource ? (
                        hasFeature('comprehension_lab') ? (
                            <ComprehensionLab
                                article={scrapedArticle}
                                resourceTitle={selectedResource?.title}
                                resourceUrl={selectedResource?.url}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center p-6">
                                <div className="text-center">
                                    <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-white font-semibold mb-2">Comprehension Lab Locked</h3>
                                    <p className="text-gray-400 text-sm">
                                        This feature is not included in your subscription.
                                    </p>
                                    <p className="text-gray-500 text-xs mt-2">
                                        Current tier: {currentUser?.tier.name || 'free'}
                                    </p>
                                </div>
                            </div>
                        )
                    ) : (
                        <Playground
                            pronunciationData={pronunciationData}
                            onTryAgain={() => setPronunciationData(null)}
                            onNextWord={() => setPronunciationData(null)}
                            voiceState={voiceState}
                            activeTopic={activeContext?.title}
                            topicId={activeContext?.id}
                        />
                    )}
                </div>
            </div>
        </>
    );
};

export default AgentWidget;
