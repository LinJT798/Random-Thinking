import { NextRequest, NextResponse } from 'next/server';
import type { AIRequest, AIResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: AIRequest = await request.json();
    const { content, action } = body;

    if (!content) {
      const errorResponse: AIResponse = {
        success: false,
        error: 'Content is required'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (action !== 'summarize') {
      const errorResponse: AIResponse = {
        success: false,
        error: 'Invalid action'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // 检查 API 密钥
    if (!process.env.ANTHROPIC_API_KEY) {
      const errorResponse: AIResponse = {
        success: false,
        error: 'ANTHROPIC_API_KEY is not configured'
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    // 调用代理服务的 Claude API 进行总结（使用 OpenAI 兼容接口）
    const apiResponse = await fetch('https://lumos.diandian.info/winky/claude/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `请将以下内容总结成简短、精炼的要点。提取核心思想和关键信息。用中文回复。

原始内容：
${content}

请直接输出总结内容，不要添加任何前言或解释。如果内容较长，请用要点列表的形式总结。`
          }
        ],
      }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('API Error:', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        errorData
      });
      throw new Error(errorData.msg || errorData.error || `API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const message = await apiResponse.json();

    // OpenAI 兼容格式：提取文本内容
    const summarizedContent = message.choices?.[0]?.message?.content || '';

    const successResponse: AIResponse = {
      success: true,
      content: summarizedContent
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error('Error in summarize API:', error);

    const errorResponse: AIResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
