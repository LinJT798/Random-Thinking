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

当用户提问或讨论时：

你先理解用户当前的研究主题与目的。

结合画布中的信息，分析关键概念、假设与潜在含义。

用有条理的方式回应，展现批判性思考与创造性洞见。

在必要时引用画布中的相关内容，以保持讨论的连贯性。

鼓励深入探讨，而非匆忙下结论。

表达风格：

语气冷静、理性，但富有共鸣。

使用清晰的逻辑结构（例如“首先…其次…最后…”）。

避免空洞的赞美或模糊的表述。不要滥用各种符号，尽量使用简练的文本表达；

使用简洁、有力的回复，切忌过于冗长，用中文回复。`;

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

    // 构建 API 请求体（Anthropic 原生格式）
    // System prompt 作为 messages 数组的第一条消息
    const requestBody = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        ...contextMessages
      ],
      stream: true,
    };

    // 调试日志
    console.log('=== API Request Debug ===');
    console.log('Model:', requestBody.model);
    console.log('Messages count:', requestBody.messages.length);
    console.log('First message role:', requestBody.messages[0].role);
    console.log('=========================');

    // 调用 Claude API（OpenAI 兼容格式）
    // 注意：虽然使用 OpenAI 格式端点，但 system prompt 仍然放在 messages 数组第一位
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

            // 解析 SSE 格式的数据（OpenAI 兼容格式）
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

                  // OpenAI 兼容格式的流式事件
                  // 格式: { choices: [{ delta: { content: "..." } }] }
                  if (event.choices && event.choices.length > 0) {
                    const delta = event.choices[0].delta;
                    if (delta && delta.content) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`));
                    }
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
