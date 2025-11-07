'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  typing?: boolean; // 是否正在打字显示
}

interface TerminalChatProps {
  config: {
    fontSize: number;
    color: string;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
  };
  showDebugger: boolean;
}

export default function TerminalChat({ config, showDebugger }: TerminalChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Thinking starts from here' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 自动聚焦到输入框（用户可以直接输入）
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 1000); // 延迟 1 秒，等动画完成

    return () => clearTimeout(timer);
  }, []);

  // 点击终端区域时重新聚焦输入框
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  // 防止输入框失去焦点
  const handleInputBlur = () => {
    // 短暂延迟后重新聚焦（避免与其他操作冲突）
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // 自动滚动到底部（程序控制）
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  // 消息变化时自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);




  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // 构建对话历史（跳过初始的 system 消息）
      const chatHistory = messages.slice(1).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 调用 AI API
      const response = await fetch('/api/ai/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: chatHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', response.status, errorData);
        throw new Error(`AI request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('AI Response:', data);

      // 添加 AI 回复（带打字机效果）
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content,
        typing: true,
      }]);

      // 打字机效果完成后移除 typing 标记
      setTimeout(() => {
        setMessages(prev => prev.map((msg, idx) =>
          idx === prev.length - 1 ? { ...msg, typing: false } : msg
        ));
      }, data.content.length * 80); // 80ms 每个字符，与打字速度匹配

    } catch (error) {
      console.error('Failed to get AI response:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，我遇到了一些问题。请稍后再试或直接开始使用吧！'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col font-mono text-left overflow-hidden relative"
      style={{
        fontSize: `${config.fontSize}px`,
        color: config.color,
      }}
      onClick={handleContainerClick}
    >
      {/* 静态显示区域（支持程序滚动，完全禁止用户滚动） */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-2 space-y-1 relative z-20 terminal-scroll pointer-events-none"
        style={{
          // 隐藏滚动条
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          // 底部添加少量内边距，确保文字不会被截断
          paddingBottom: `${config.fontSize * 0.25}px`,
        }}
      >
        {/* 初始消息 - 打字机效果 */}
        <div className="flex items-start gap-1">
          <span className="opacity-60">{'>'}</span>
          <TypewriterText
            text="Thinking starts from here"
            speed={80}
            color={config.color}
            onCharAdded={scrollToBottom}
          />
        </div>

        {/* 显示对话历史 */}
        {messages.slice(1).map((msg, idx) => (
          <div key={idx}>
            {msg.role === 'user' && (
              <div className="flex items-start gap-1 mt-2">
                <span className="opacity-60">{'>'}</span>
                <span className="whitespace-pre-wrap break-words">{msg.content}</span>
              </div>
            )}
            {msg.role === 'assistant' && (
              <div className="flex items-start gap-1 mt-1">
                <span className="opacity-60">{'>'}</span>
                {msg.typing ? (
                  <TypewriterText
                    text={msg.content}
                    speed={80}
                    color={config.color}
                    onCharAdded={scrollToBottom}
                  />
                ) : (
                  <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                )}
              </div>
            )}
          </div>
        ))}

        {/* 加载中提示 */}
        {isLoading && (
          <div className="flex items-start gap-1 mt-2">
            <span className="opacity-60">{'>'}</span>
            <span className="animate-pulse">思考中...</span>
          </div>
        )}
      </div>

      {/* 输入区域 - CLI 单行输入（固定高度，自动换行但只显示最后一行） */}
      <div className="relative z-20 p-2 flex items-center gap-1 pointer-events-auto">
        <span className="opacity-60 flex-shrink-0">{'>'}</span>
        <div className="flex-1 relative overflow-hidden" style={{ height: `${config.fontSize * 1.5}px` }}>
          {/* 隐藏输入框，只用于功能 */}
          <textarea
            ref={inputRef as any}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleInputBlur}
            rows={1}
            className="w-full h-auto bg-transparent border-none outline-none font-mono resize-none overflow-hidden absolute bottom-0 left-0 opacity-0"
            style={{
              fontSize: `${config.fontSize}px`,
              lineHeight: '1.5',
            }}
            disabled={false}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
          {/* 显示层：文字 + 粗光标 */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <div
              className="font-mono whitespace-pre-wrap break-words"
              style={{
                fontSize: `${config.fontSize}px`,
                color: config.color,
                lineHeight: '1.5',
              }}
            >
              {input}
              {/* 粗光标（紧跟文字末尾，inline 显示） */}
              {!isLoading && (
                <span
                  className="inline-block align-bottom ml-0.5"
                  style={{
                    width: `${config.fontSize * 0.5}px`,
                    height: `${config.fontSize * 1.2}px`,
                    background: config.color,
                    animation: 'blink 1s step-end infinite',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 打字机文字组件
function TypewriterText({ text, speed, color, onCharAdded }: { text: string; speed: number; color: string; onCharAdded?: () => void }) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
        // 每打一个字就滚动
        onCharAdded?.();
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, speed, onCharAdded]);

  return (
    <span className="whitespace-pre-wrap break-words">
      {displayText}
      {currentIndex < text.length && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 align-middle"
          style={{
            background: color,
            animation: 'blink 0.5s step-end infinite',
          }}
        />
      )}
    </span>
  );
}
