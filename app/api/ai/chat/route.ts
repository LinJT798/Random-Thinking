import { NextRequest } from 'next/server';
import type { ChatMessage, CanvasNode, NodeChanges } from '@/types';
import { buildInitialContext, buildIncrementalContext } from '@/lib/context-builder';

interface ChatRequest {
  userMessage: string;
  initialNodes: CanvasNode[];
  nodeChanges: NodeChanges | null;
  chatHistory: ChatMessage[];
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { userMessage, initialNodes, nodeChanges, chatHistory } = body;

    if (!userMessage || !userMessage.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查 API 密钥
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 构建系统 prompt
    const systemPrompt = `你是一个思维扩展助手，帮助用户在无限画布上整理和扩展想法。

你的能力：
1. 基于画布内容生成新的想法和扩展点
2. 回答关于画布内容的问题
3. 进行通用对话，提供建议和指导

用户的画布内容会作为上下文提供。请结合画布内容和用户需求给出有价值的回答。用中文回复。`;

    // 构建上下文消息
    const contextMessages: Array<{ role: string; content: string }> = [];

    // 1. 如果是第一次对话，添加初始画布内容
    const isFirstMessage = chatHistory.length === 0;
    if (isFirstMessage && initialNodes.length > 0) {
      const initialContext = buildInitialContext(initialNodes);
      contextMessages.push({
        role: 'user',
        content: `[画布初始内容]\n${initialContext}`
      });
      contextMessages.push({
        role: 'assistant',
        content: '我已经了解画布上的内容。请问有什么我可以帮助你的？'
      });
    }

    // 2. 历史对话（包含所有历史消息以保持上下文连续性）
    chatHistory.forEach(msg => {
      if (msg.role !== 'system') {
        contextMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });

    // 3. 节点变化（如果有）
    if (nodeChanges) {
      const hasChanges =
        nodeChanges.newNodes.length > 0 ||
        nodeChanges.modifiedNodes.length > 0 ||
        nodeChanges.deletedNodeIds.length > 0;

      if (hasChanges) {
        const changeContext = buildIncrementalContext(nodeChanges);
        if (changeContext) {
          contextMessages.push({
            role: 'user',
            content: `[画布内容更新]\n${changeContext}`
          });
        }
      }
    }

    // 4. 当前用户消息
    contextMessages.push({
      role: 'user',
      content: userMessage
    });

    // 调用 Claude API（使用 OpenAI 兼容接口，模型使用 Sonnet 4.5）
    const apiResponse = await fetch('https://lumos.diandian.info/winky/claude/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...contextMessages
        ],
        stream: true, // 启用流式响应
      }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('API Error:', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        errorData
      });
      return new Response(
        JSON.stringify({ error: errorData.msg || errorData.error || 'API request failed' }),
        { status: apiResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 返回流式响应
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = apiResponse.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }

            // 解析 SSE 格式的数据
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    // 转发内容给客户端
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
