import { useState, useCallback, useEffect } from 'react';
import { useCanvasStore } from '@/lib/store';

// 计算 textarea 中光标位置的辅助函数
const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
  const div = document.createElement('div');
  const computedStyle = getComputedStyle(element);

  // 复制所有相关样式
  for (const prop of computedStyle) {
    div.style.setProperty(prop, computedStyle.getPropertyValue(prop), computedStyle.getPropertyPriority(prop));
  }

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.overflow = 'hidden';

  document.body.appendChild(div);

  // 设置内容到光标位置
  const textContent = element.value.substring(0, position);
  div.textContent = textContent;

  // 添加一个 span 来标记光标位置
  const span = document.createElement('span');
  span.textContent = '|';
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop,
    left: span.offsetLeft,
    height: span.offsetHeight,
  };

  document.body.removeChild(div);
  return coordinates;
};

export function useTextSelection() {
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const { setDraggingText } = useCanvasStore();

  // 清除选中状态
  const clearSelection = useCallback(() => {
    setSelectedText('');
    setSelectionPosition(null);
  }, []);

  // 处理文本选中
  const handleTextSelection = useCallback((e: React.MouseEvent) => {
    // 保存目标元素（必须在 setTimeout 外部获取）
    const target = e.currentTarget as HTMLElement;

    // 使用 setTimeout 确保选中操作完成
    setTimeout(() => {
      // 检查是否是 textarea 或 input
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        const input = target as HTMLTextAreaElement | HTMLInputElement;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;

        if (start !== end) {
          const text = input.value.substring(start, end);

          if (text.length > 0) {
            const inputRect = input.getBoundingClientRect();

            // 对于 textarea，计算选中末尾的位置
            if (target.tagName === 'TEXTAREA') {
              const coords = getCaretCoordinates(input as HTMLTextAreaElement, end);

              setSelectedText(text);
              setSelectionPosition({
                x: inputRect.left + coords.left,
                y: inputRect.top + coords.top + coords.height - input.scrollTop,
              });
            } else {
              // 对于单行 input，简单计算
              setSelectedText(text);
              setSelectionPosition({
                x: inputRect.left + inputRect.width,
                y: inputRect.bottom,
              });
            }
            return;
          }
        }
      }

      // 对于普通元素（如 div），使用 window.getSelection
      const selection = window.getSelection();
      const text = selection?.toString();

      if (text && text.length > 0 && selection && selection.rangeCount > 0) {
        // 获取选中文本的位置 - 定位到选中区域的末尾
        const range = selection.getRangeAt(0);

        // 创建一个新的 range，折叠到选中区域的末尾
        const endRange = range.cloneRange();
        endRange.collapse(false); // false = 折叠到末尾

        const rect = endRange.getBoundingClientRect();

        if (rect) {
          setSelectedText(text);
          setSelectionPosition({
            x: rect.left,
            y: rect.bottom,
          });
        }
      } else {
        // 清除选中状态
        clearSelection();
      }
    }, 50); // 增加延迟以确保选中完成
  }, [clearSelection]);

  // 处理 Add to 按钮点击
  const handleAddToClick = useCallback(() => {
    if (selectedText) {
      setDraggingText(selectedText);
      clearSelection();
      window.getSelection()?.removeAllRanges();
    }
  }, [selectedText, setDraggingText, clearSelection]);

  // 监听全局点击，清除文本选中状态
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (selectedText && !target.closest('[data-add-to-button]')) {
        clearSelection();
      }
    };

    if (selectedText) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [selectedText, clearSelection]);

  return {
    selectedText,
    selectionPosition,
    handleTextSelection,
    handleAddToClick,
    clearSelection,
  };
}
