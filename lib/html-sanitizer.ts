/**
 * HTML 内容清理器
 * 用于清理 contentEditable 生成的 HTML，防止 XSS 攻击
 */

// 允许的标签白名单
const ALLOWED_TAGS = new Set([
  'B', 'STRONG',      // 粗体
  'I', 'EM',          // 斜体
  'U',                // 下划线
  'S', 'STRIKE',      // 删除线
  'SPAN',             // 样式容器
  'FONT',             // 字体（兼容旧版）
  'BR',               // 换行
  'DIV', 'P',         // 段落
]);

// 允许的属性白名单
const ALLOWED_ATTRIBUTES = new Set([
  'style',   // 内联样式
  'color',   // 字体颜色（font 标签）
]);

// 允许的 CSS 属性白名单
const ALLOWED_STYLES = new Set([
  'color',           // 文字颜色
  'background-color', // 背景色
  'font-size',       // 字体大小
  'font-weight',     // 字体粗细
  'font-style',      // 字体样式
  'text-decoration', // 文本装饰
]);

/**
 * 清理 HTML 内容
 * @param html - 原始 HTML 字符串
 * @returns 清理后的安全 HTML 字符串
 */
export function sanitizeHTML(html: string): string {
  // 空内容直接返回
  if (!html || html.trim() === '') return '';

  // 使用 DOMParser 解析 HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 递归清理节点
  const cleanNode = (node: Node): Node | null => {
    // 文本节点：直接保留
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }

    // 元素节点：检查是否在白名单
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toUpperCase();

      // 不在白名单：返回其子节点的内容
      if (!ALLOWED_TAGS.has(tagName)) {
        // 创建文档片段包含所有子节点
        const fragment = document.createDocumentFragment();
        Array.from(element.childNodes).forEach(child => {
          const cleanedChild = cleanNode(child);
          if (cleanedChild) {
            fragment.appendChild(cleanedChild);
          }
        });
        return fragment;
      }

      // 创建新的干净元素
      const cleanElement = document.createElement(tagName.toLowerCase());

      // 清理属性
      Array.from(element.attributes).forEach(attr => {
        if (ALLOWED_ATTRIBUTES.has(attr.name.toLowerCase())) {
          if (attr.name.toLowerCase() === 'style') {
            // 清理 style 属性
            const cleanedStyle = sanitizeStyle(element.style);
            if (cleanedStyle) {
              cleanElement.setAttribute('style', cleanedStyle);
            }
          } else {
            // 其他允许的属性
            cleanElement.setAttribute(attr.name, attr.value);
          }
        }
      });

      // 递归清理子节点
      Array.from(element.childNodes).forEach(child => {
        const cleanedChild = cleanNode(child);
        if (cleanedChild) {
          cleanElement.appendChild(cleanedChild);
        }
      });

      return cleanElement;
    }

    // 其他类型节点：忽略
    return null;
  };

  // 清理 body 中的所有子节点
  const cleanedFragment = document.createDocumentFragment();
  Array.from(doc.body.childNodes).forEach(child => {
    const cleanedChild = cleanNode(child);
    if (cleanedChild) {
      cleanedFragment.appendChild(cleanedChild);
    }
  });

  // 创建临时容器并转换为 HTML 字符串
  const tempContainer = document.createElement('div');
  tempContainer.appendChild(cleanedFragment);

  return tempContainer.innerHTML;
}

/**
 * 清理 CSS 样式
 * @param style - CSSStyleDeclaration 对象
 * @returns 清理后的样式字符串
 */
function sanitizeStyle(style: CSSStyleDeclaration): string {
  const cleanedStyles: string[] = [];

  ALLOWED_STYLES.forEach(prop => {
    const value = style.getPropertyValue(prop);
    if (value) {
      // 检查值是否安全（不包含 url() 或 expression()）
      if (!value.includes('url(') && !value.includes('expression(')) {
        cleanedStyles.push(`${prop}: ${value}`);
      }
    }
  });

  return cleanedStyles.join('; ');
}

/**
 * 转换纯文本为 HTML（保留换行）
 * @param text - 纯文本
 * @returns HTML 字符串
 */
export function textToHTML(text: string): string {
  if (!text) return '';

  // 转义 HTML 特殊字符
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 将换行符转换为 <br>
  return escaped.replace(/\n/g, '<br>');
}

/**
 * 提取 HTML 中的纯文本
 * @param html - HTML 字符串
 * @returns 纯文本字符串
 */
export function htmlToText(html: string): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  return doc.body.textContent || '';
}
