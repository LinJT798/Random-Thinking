'use client';

interface ScreenTextConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  perspective: number;
  fontSize: number;
  color: string;
}

interface ScreenTextDebuggerProps {
  config: ScreenTextConfig;
  onChange: (config: ScreenTextConfig) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  { name: '经典绿', value: '#00FF41' },
  { name: '琥珀绿', value: '#33FF00' },
  { name: '青柠绿', value: '#39FF14' },
  { name: '矩阵绿', value: '#00FF00' },
  { name: '薄荷绿', value: '#00FFA3' },
];

export default function ScreenTextDebugger({ config, onChange, onClose }: ScreenTextDebuggerProps) {
  const handleChange = (key: keyof ScreenTextConfig, value: number | string) => {
    onChange({ ...config, [key]: value });
  };

  const copyConfig = () => {
    const configText = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(configText);
    alert('配置已复制到剪贴板！');
  };

  return (
    <div
      className="fixed right-6 top-6 w-80 rounded-2xl glass-effect p-6 z-[3000] animate-in fade-in-0 slide-in-from-right-5"
      style={{
        background: 'rgba(237, 228, 213, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(61, 52, 44, 0.2)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold" style={{ color: '#3D342C' }}>
          屏幕文字调试
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: '#7A6F67' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(122, 111, 103, 0.1)';
            e.currentTarget.style.color = '#3D342C';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#7A6F67';
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 控制项 */}
      <div className="space-y-5">

        {/* 水平位置 */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            水平位置 (Left): {config.left}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={config.left}
            onChange={(e) => handleChange('left', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${config.left}%, rgba(122, 111, 103, 0.2) ${config.left}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
        </div>

        {/* 垂直位置 */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            垂直位置 (Top): {config.top}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={config.top}
            onChange={(e) => handleChange('top', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${config.top}%, rgba(122, 111, 103, 0.2) ${config.top}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
        </div>

        {/* 宽度 */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            文字区域宽度: {config.width}%
          </label>
          <input
            type="range"
            min="10"
            max="80"
            step="1"
            value={config.width}
            onChange={(e) => handleChange('width', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${(config.width - 10) / 70 * 100}%, rgba(122, 111, 103, 0.2) ${(config.width - 10) / 70 * 100}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
        </div>

        {/* 高度 */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            文字区域高度: {config.height}%
          </label>
          <input
            type="range"
            min="5"
            max="60"
            step="1"
            value={config.height}
            onChange={(e) => handleChange('height', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${(config.height - 5) / 55 * 100}%, rgba(122, 111, 103, 0.2) ${(config.height - 5) / 55 * 100}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
        </div>

        {/* 分隔线 - 3D 旋转区域 */}
        <div className="pt-3" style={{ borderTop: '1px solid rgba(122, 111, 103, 0.15)' }}>
          <h4 className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: '#8B8E63' }}>
            3D 旋转（透视效果）
          </h4>
        </div>

        {/* 透视距离 */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            透视距离: {config.perspective}px
          </label>
          <input
            type="range"
            min="200"
            max="2000"
            step="50"
            value={config.perspective}
            onChange={(e) => handleChange('perspective', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${(config.perspective - 200) / 1800 * 100}%, rgba(122, 111, 103, 0.2) ${(config.perspective - 200) / 1800 * 100}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
          <p className="text-xs mt-1" style={{ color: '#7A6F67' }}>
            越小透视越强，越大越接近平面
          </p>
        </div>

        {/* X 轴旋转（上下倾斜） */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            X 轴旋转（上下倾斜）: {config.rotateX}°
          </label>
          <input
            type="range"
            min="-90"
            max="90"
            step="0.5"
            value={config.rotateX}
            onChange={(e) => handleChange('rotateX', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${(config.rotateX + 90) / 180 * 100}%, rgba(122, 111, 103, 0.2) ${(config.rotateX + 90) / 180 * 100}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
          <p className="text-xs mt-1" style={{ color: '#7A6F67' }}>
            正值向后倾斜，负值向前倾斜
          </p>
        </div>

        {/* Y 轴旋转（左右倾斜） */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            Y 轴旋转（左右倾斜）: {config.rotateY}°
          </label>
          <input
            type="range"
            min="-90"
            max="90"
            step="0.5"
            value={config.rotateY}
            onChange={(e) => handleChange('rotateY', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${(config.rotateY + 90) / 180 * 100}%, rgba(122, 111, 103, 0.2) ${(config.rotateY + 90) / 180 * 100}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
          <p className="text-xs mt-1" style={{ color: '#7A6F67' }}>
            正值向右倾斜，负值向左倾斜
          </p>
        </div>

        {/* Z 轴旋转（平面旋转） */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            Z 轴旋转（平面旋转）: {config.rotateZ}°
          </label>
          <input
            type="range"
            min="-45"
            max="45"
            step="0.5"
            value={config.rotateZ}
            onChange={(e) => handleChange('rotateZ', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${(config.rotateZ + 45) / 90 * 100}%, rgba(122, 111, 103, 0.2) ${(config.rotateZ + 45) / 90 * 100}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
          <p className="text-xs mt-1" style={{ color: '#7A6F67' }}>
            顺时针/逆时针旋转
          </p>
        </div>

        {/* 字体大小 */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            字体大小: {config.fontSize}px
          </label>
          <input
            type="range"
            min="8"
            max="32"
            step="1"
            value={config.fontSize}
            onChange={(e) => handleChange('fontSize', parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #8B8E63 0%, #8B8E63 ${(config.fontSize - 8) / 24 * 100}%, rgba(122, 111, 103, 0.2) ${(config.fontSize - 8) / 24 * 100}%, rgba(122, 111, 103, 0.2) 100%)`,
            }}
          />
        </div>

        {/* 颜色选择 */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3D342C' }}>
            文字颜色
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleChange('color', preset.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                style={{
                  background: config.color === preset.value ? preset.value + '20' : 'transparent',
                  borderColor: config.color === preset.value ? preset.value : 'rgba(122, 111, 103, 0.2)',
                  color: preset.value,
                }}
                title={preset.name}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* 自定义颜色 */}
          <div className="flex items-center gap-2 mt-3">
            <input
              type="color"
              value={config.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="w-12 h-8 rounded cursor-pointer"
            />
            <input
              type="text"
              value={config.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="flex-1 px-2 py-1 rounded text-xs font-mono"
              style={{
                background: 'rgba(248, 244, 239, 0.5)',
                border: '1px solid rgba(122, 111, 103, 0.2)',
                color: '#3D342C',
              }}
            />
          </div>
        </div>

        {/* 分隔线 */}
        <div style={{ borderTop: '1px solid rgba(122, 111, 103, 0.15)' }} />

        {/* 操作按钮 */}
        <div className="space-y-2">
          <button
            onClick={copyConfig}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'rgba(139, 142, 99, 0.15)',
              border: '1px solid rgba(139, 142, 99, 0.3)',
              color: '#8B8E63',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 142, 99, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(139, 142, 99, 0.15)';
            }}
          >
            📋 复制配置 JSON
          </button>

          <button
            onClick={() => {
              // 重置为默认值
              onChange({
                left: 50,
                top: 35,
                width: 40,
                height: 20,
                rotateX: 0,
                rotateY: 0,
                rotateZ: 0,
                perspective: 1000,
                fontSize: 16,
                color: '#00FF41',
              });
            }}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'rgba(122, 111, 103, 0.1)',
              border: '1px solid rgba(122, 111, 103, 0.2)',
              color: '#7A6F67',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(122, 111, 103, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(122, 111, 103, 0.1)';
            }}
          >
            🔄 重置为默认值
          </button>
        </div>
      </div>

      {/* 快捷键提示 */}
      <div
        className="mt-4 pt-4 text-xs text-center"
        style={{
          borderTop: '1px solid rgba(122, 111, 103, 0.15)',
          color: '#7A6F67',
        }}
      >
        按 Ctrl/Cmd + D 关闭面板
      </div>
    </div>
  );
}
