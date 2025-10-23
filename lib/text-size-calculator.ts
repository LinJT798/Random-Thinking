/**
 * 计算文本内容所需的节点尺寸
 * 使用临时DOM元素测量文本渲染后的实际尺寸
 */
export function calculateTextNodeSize(text: string): { width: number; height: number } {
  // 创建临时测量元素
  const measureDiv = document.createElement('div');

  // 应用与 TextNode 相同的样式
  measureDiv.style.position = 'absolute';
  measureDiv.style.visibility = 'hidden';
  measureDiv.style.whiteSpace = 'pre-wrap';
  measureDiv.style.wordWrap = 'break-word';
  measureDiv.style.fontSize = '14px';
  measureDiv.style.fontWeight = 'normal';
  measureDiv.style.fontFamily = 'sans-serif';
  measureDiv.style.lineHeight = '1.6';
  measureDiv.style.padding = '16px'; // 对应 TextNode 的 p-4

  // 设置最大宽度以触发自动换行
  const maxWidth = 600; // 最大宽度限制
  measureDiv.style.maxWidth = `${maxWidth}px`;
  measureDiv.style.width = 'auto';

  // 设置文本内容
  measureDiv.textContent = text;

  // 添加到DOM以进行测量
  document.body.appendChild(measureDiv);

  // 获取测量结果
  const rect = measureDiv.getBoundingClientRect();
  let width = Math.ceil(rect.width);
  let height = Math.ceil(rect.height);

  // 移除临时元素
  document.body.removeChild(measureDiv);

  // 设置最小和最大尺寸
  const minWidth = 200;
  const minHeight = 80;
  const maxHeight = 800;

  width = Math.max(minWidth, Math.min(maxWidth, width));
  height = Math.max(minHeight, Math.min(maxHeight, height));

  // 添加一些额外的边距以确保内容不会被裁剪
  width += 20;
  height += 20;

  return { width, height };
}
