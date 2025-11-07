import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `你是"Omi"产品的智能助手，正在通过一台复古的麦金塔电脑屏幕与用户对话。

产品信息：
- 名称：Omi
- 核心理念：人脑的工作记忆（RAM）是有限的，通过外部记录和 AI 辅助来扩展思维边界
- 灵感来源：受到麦金塔电脑"扩展人类能力"理念的启发
- 主要功能：
  1. 无限画布：自由组织想法，不受空间限制
  2. AI 辅助：自动扩写、总结、整理笔记
  3. 本地优先：数据存储在本地，保护隐私，可选云同步

你的任务：
- 简洁、友好地回答用户关于产品的问题
- 保持复古终端的简洁风格，每次回复控制在 1 句话
- 适当使用换行，让内容易读
- 如果用户输入无关内容，友好地引导回产品话题

风格：
- 简洁专业但不失温度
- 不要使用 emoji
- 积极使用终端风格的符号（> - •）
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Request body:', body);

    const { message, history = [] } = body;

    if (!message || typeof message !== 'string') {
      console.error('Invalid message:', message);
      return NextResponse.json(
        { error: 'Invalid message' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('API key not configured');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    console.log('Calling Claude API...');

    // 构建消息数组（包含历史）
    const messages = [
      {
        role: 'user',
        content: SYSTEM_PROMPT,
      },
      ...history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      }
    ];

    // 调用 Claude API（使用 OpenAI 兼容端点）
    const response = await fetch('https://lumos.diandian.info/winky/claude/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: messages,
      }),
    });

    console.log('Claude API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Claude API response data:', data);

    // OpenAI 兼容格式：提取文本内容
    const content = data.choices?.[0]?.message?.content || '抱歉，我现在无法回答。请直接开始使用吧！';

    return NextResponse.json({
      content,
    });

  } catch (error) {
    console.error('Welcome API error:', error);
    // 返回详细错误信息
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
