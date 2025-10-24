import { NextRequest } from 'next/server';
import type { ChatMessage, CanvasNode, NodeChanges, ToolResult } from '@/types';
import { buildInitialContext, buildIncrementalContext } from '@/lib/context-builder';

interface ChatRequest {
  userMessage?: string; // 首次消息时必须，工具返回时可选
  initialNodes: CanvasNode[];
  nodeChanges: NodeChanges | null;
  chatHistory: ChatMessage[];
  toolResults?: ToolResult[]; // 工具执行结果（多轮对话）
}

// OpenAI 兼容的消息类型
interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { userMessage, initialNodes, nodeChanges, chatHistory } = body;

    // 验证：userMessage 可以为空（用于工具调用后的总结请求）
    // 但如果为空，chatHistory 必须有内容
    if (!userMessage?.trim() && chatHistory.length === 0) {
      return new Response(
        JSON.stringify({ error: 'userMessage is required for first message' }),
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
    const systemPrompt = `角色定位
你是一位深思熟虑的思考者，与用户共同基于画布内容进行有条理的对话。
你关注逻辑、结构与前提，而非表层信息。
你喜欢从底层原理与事物本质出发思考问题，追求洞见的清晰与内在一致性。
当需要阐明复杂概念或结构关系时，你可以在画布上创建文本、便签或思维导图，以更准确地传达思想。
你厌恶冗杂与修饰，偏好简洁、精确与必要。

工作原则
1. 取材与分析：从画布或对话中筛选核心信息，辨析假设与逻辑链条。
2. 推理与判断：在有限信息下，给出清晰的推理路径与多种可能性。

表达风格

语言冷静、克制，不夸张、不渲染。

不使用多余符号（如###、**、>等），只依靠自然段落组织内容。

不滥用比喻。若确有助于理解，可使用一次精准而深刻的比喻，但不延展。

不为形式制造结构感，而让逻辑自然呈现。

语句力求简洁，避免重复与空洞的修辞。

在未获用户许可时，不展开冗长的理论阐述或哲学推演。

对复杂问题，允许留白，不以冗长填充不确定性。

工具使用原则

可在必要时使用文本框、便签或思维导图等方式呈现信息，帮助用户更清晰地理解逻辑关系。

一切可视化工具的使用必须有实质价值：要么澄清结构，要么总结重点。

不以形式吸引注意，不输出无内容的装饰性元素。

工具的作用是辅助理解，而非表现创造力。

若问题可用文字清楚表达，则优先使用文字。`;

    // 构建上下文消息
    const contextMessages: OpenAIMessage[] = [];

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
        // 如果是包含工具调用的助手消息，需要构建 tool_calls 格式
        if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
          contextMessages.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.toolCalls.map(tc => ({
              id: tc.tool_use_id,
              type: 'function' as const,
              function: {
                name: tc.tool,
                arguments: JSON.stringify(tc.input) // 使用保存的输入参数
              }
            }))
          });
        } else if (msg.role === 'tool') {
          // tool 消息需要包含 tool_call_id
          contextMessages.push({
            role: 'tool',
            tool_call_id: msg.tool_call_id,
            content: msg.content
          });
        } else {
          contextMessages.push({
            role: msg.role,
            content: msg.content
          });
        }
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

    // 4. 工具执行结果（已经通过历史消息中的 tool 角色处理，这里不再重复添加）
    // toolResults 参数已废弃，tool 消息直接保存在数据库的 chatHistory 中

    // 5. 当前用户消息（如果有）
    if (userMessage && userMessage.trim()) {
      contextMessages.push({
        role: 'user',
        content: userMessage
      });
    }

    // 如果没有新的用户消息，检查最后一条是否是 tool 消息
    // 如果是，AI 会自动基于 tool 结果继续对话

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
          description: '在画布上创建一个便签节点（淡黄色背景）。适用于快速记录想法、临时笔记、提醒事项等场景。',
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: '便签的内容'
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
                          tool_use_id: currentToolCall.id || `tool_${Date.now()}`, // 工具调用唯一ID
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
