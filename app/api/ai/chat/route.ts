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
    const systemPrompt = `你是一位深思熟虑的思考者，擅长阅读与理解复杂内容。
你会仔细分析用户提供的上下文，并基于这些内容展开有深度的思考与讨论。

你关注逻辑、背景、推理、假设和可能的多种视角，而不是仅仅给出表面答案。
你擅长提出启发性的问题，帮助用户更清晰地表达、推演或验证自己的想法。

当用户提问或讨论时：

你先理解用户当前的研究主题与目的。

结合画布中的信息，分析关键概念、假设与潜在含义。

用有条理的方式回应，展现批判性思考与创造性洞见。

在必要时引用画布中的相关内容，以保持讨论的连贯性。

鼓励深入探讨，而非匆忙下结论。

表达风格：

语气冷静、理性，但富有共鸣。

使用清晰的逻辑结构（例如“首先…其次…最后…”）。

当合适时，可以提出反思性或发人深省的问题，引导进一步讨论。

避免空洞的赞美或模糊的表述。用中文回复。`;

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

    // 构建 API 请求体
    const requestBody: Record<string, unknown> = {
      model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5
      max_tokens: 4096,
      system: systemPrompt, // System prompt 作为独立参数
      messages: contextMessages, // 只包含 user 和 assistant 消息
      stream: true, // 启用流式响应
    };

    // 调用 Claude API
    const apiResponse = await fetch('https://lumos.diandian.info/winky/claude/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      let errorData;
      const contentType = apiResponse.headers.get('content-type');

      try {
        if (contentType && contentType.includes('application/json')) {
          errorData = await apiResponse.json();
        } else {
          errorData = { message: await apiResponse.text() };
        }
      } catch (e) {
        errorData = { message: 'Failed to parse error response' };
      }

      console.error('API Error:', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        errorData,
        requestBody: JSON.stringify(requestBody, null, 2)
      });

      return new Response(
        JSON.stringify({
          error: errorData.msg || errorData.message || errorData.error || 'API request failed',
          details: errorData
        }),
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

            // 解析 SSE 格式的数据（Anthropic 原生格式）
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]' || !data) {
                  continue;
                }

                try {
                  const event = JSON.parse(data);

                  // 支持两种格式：
                  // 1. Anthropic 原生格式: { type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } }
                  // 2. OpenAI 格式: { choices: [{ delta: { content: '...' } }] }

                  if (event.type === 'content_block_delta') {
                    // Anthropic 原生格式
                    if (event.delta?.type === 'text_delta') {
                      const textContent = event.delta.text;
                      if (textContent) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: textContent })}\n\n`));
                      }
                    }
                  } else if (event.choices && event.choices[0]?.delta?.content) {
                    // OpenAI 格式
                    const textContent = event.choices[0].delta.content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: textContent })}\n\n`));
                  }
                } catch (e) {
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
