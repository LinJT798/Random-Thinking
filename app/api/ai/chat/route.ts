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

使用清晰的逻辑结构（例如"首先…其次…最后…"）。

避免空洞的赞美或模糊的表述。不要滥用各种符号，尽量使用简练的文本表达；

使用简洁、有力的回复，切忌过于冗长，用中文回复。


- 优先使用文本框(add_text_node)和便签(add_sticky_note)，只在明确需要层级关系时才用思维导图`;

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

    // 定义工具（Tools）
    const tools = [
      {
        type: 'function',
        function: {
          name: 'add_text_node',
          description: '在画布上创建一个文本框节点。适用于需要展示结构化信息、要点总结、概念解释等场景。',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: '文本框的内容'
              },
              position: {
                type: 'object',
                description: '节点在画布上的位置（可选），如果不指定则自动放置在合适位置',
                properties: {
                  x: { type: 'number', description: 'X坐标' },
                  y: { type: 'number', description: 'Y坐标' }
                }
              }
            },
            required: ['content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'add_sticky_note',
          description: '在画布上创建一个彩色便签节点。适用于快速记录想法、临时笔记、提醒事项等场景。',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: '便签的内容'
              },
              color: {
                type: 'string',
                enum: ['yellow', 'pink', 'blue', 'green', 'purple'],
                description: '便签的颜色，默认为黄色'
              }
            },
            required: ['content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_mindmap',
          description: '在画布上创建一个思维导图网络。适用于展示层级关系、知识结构、概念分解等场景。会自动布局并连接各个节点。',
          parameters: {
            type: 'object',
            properties: {
              root: {
                type: 'string',
                description: '根节点（中心主题）的内容'
              },
              children: {
                type: 'array',
                description: '子节点列表，每个子节点可以有自己的子节点（支持多层嵌套）',
                items: {
                  type: 'object',
                  properties: {
                    content: {
                      type: 'string',
                      description: '子节点的内容'
                    },
                    children: {
                      type: 'array',
                      description: '该子节点的子节点列表（可选）',
                      items: {
                        type: 'object'
                      }
                    }
                  },
                  required: ['content']
                }
              }
            },
            required: ['root', 'children']
          }
        }
      }
    ];

    // 构建 API 请求体（OpenAI 兼容格式）
    // System prompt 作为 messages 数组的第一条消息
    const requestBody = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192, // 增加 token 限制以支持工具调用
      messages: [
        { role: 'system', content: systemPrompt },
        ...contextMessages
      ],
      tools, // 添加工具定义
      stream: true,
    };


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

          let currentToolCall: { id?: string; name?: string; arguments?: string } | null = null;
          let buffer = ''; // 用于存储跨 chunk 的不完整行

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }

            // 解析 SSE 格式的数据（OpenAI 兼容格式）
            const chunk = decoder.decode(value, { stream: true });

            // 将新数据添加到 buffer
            buffer += chunk;

            // 按行分割，但保留最后一个可能不完整的行
            const lines = buffer.split('\n');
            // 最后一行可能不完整，保留在 buffer 中
            buffer = lines.pop() || '';

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

                    // 处理文本内容
                    if (delta && delta.content) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`));
                    }

                    // 处理工具调用
                    if (delta && delta.tool_calls && delta.tool_calls.length > 0) {
                      const toolCall = delta.tool_calls[0];

                      // 开始新的工具调用
                      if (toolCall.id || toolCall.function?.name) {
                        if (!currentToolCall) {
                          currentToolCall = {
                            id: toolCall.id,
                            name: toolCall.function?.name,
                            arguments: ''
                          };
                        }
                      }

                      // 累积工具参数
                      if (toolCall.function?.arguments) {
                        if (currentToolCall) {
                          currentToolCall.arguments = (currentToolCall.arguments || '') + toolCall.function.arguments;
                        }
                      }
                    }

                    // finish_reason 表示响应结束，此时必须处理工具调用
                    if (event.choices[0].finish_reason === 'tool_calls' && currentToolCall) {
                      try {
                        const toolInput = JSON.parse(currentToolCall.arguments || '{}');

                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                          type: 'tool_use',
                          tool: currentToolCall.name,
                          input: toolInput
                        })}\n\n`));

                        currentToolCall = null;
                      } catch (e) {
                        console.error('Failed to parse tool arguments:', e);
                        currentToolCall = null;
                      }
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
