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

    if (action !== 'expand') {
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

    // 调用代理服务的 Claude API 进行扩写（使用 OpenAI 兼容接口）
    const apiResponse = await fetch('https://lumos.diandian.info/winky/claude/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `请对以下简短的想法或笔记进行续写，扩展成更详细、更完整的内容。保持已有原文内容，但增加后续，仅续写一句内容，用中文回复。

原始内容：
${content}

请直接输出扩展后的内容，不要添加任何前言或解释。`
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
    const expandedContent = message.choices?.[0]?.message?.content || '';

    const successResponse: AIResponse = {
      success: true,
      content: expandedContent
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error('Error in expand API:', error);

    const errorResponse: AIResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
