<script setup lang="ts">
import { computed } from 'vue';
import type { SearchInfo } from '@/models/user_models'; // 引入刚才建好的模型

// 定义接收的属性 (保持接收字符串，方便双向绑定输入框)
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
});

// 定义向外抛出的事件
const emit = defineEmits(['update:modelValue', 'search', 'handleSearch']);

// 利用计算属性实现数据的双向绑定透传
const searchValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// 触发搜索（供按钮点击或回车键使用）
const handleSearch = () => {
  const keywordStr = searchValue.value.trim();
  if (keywordStr) {
    // 构造符合后端 [FromBody] 要求的 SearchInfo 对象，未填写的字段将默认为 undefined/空
    const searchPayload: SearchInfo = {
      Keyword: keywordStr
    };

    // 将包装好的对象直接抛给父组件
    emit('search', searchPayload);
    emit('handleSearch', searchPayload);
  }
};
</script>

<template>
  <div class="search-container" :class="{ 'is-active': searchValue.length > 0 }">
    <!-- AI 风格的流光边框层 (聚焦时显示) -->
    <div class="ai-glow-border"></div>

    <div class="input-wrapper">
      <!-- 左侧图标：放大镜 -->
      <div class="icon-group">
        <i class="fa-solid fa-magnifying-glass search-icon"></i>
        <i class="fa-solid fa-sparkles ai-sparkle"></i>
      </div>

      <!-- 搜索输入框 -->
      <input
          id="search-input"
          type="text"
          class="search-input"
          placeholder="AI搜索文件..."
          v-model="searchValue"
          @keyup.enter="handleSearch"
      >

      <!-- 右侧：确定搜索按钮 (仅在有内容或聚焦时显眼) -->
      <button class="ai-search-btn" @click="handleSearch" :disabled="!searchValue">
        <span class="btn-text">搜索</span>
        <svg class="return-icon ai-star-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 17.373 12 24 12C17.373 12 12 6.627 12 0Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-container {
  position: relative;
  width: 300px; /* 稍微加宽一点以容纳按钮和更长的提示词 */
  border-radius: 6px;
  transition: all 0.3s ease;
  z-index: 1;
}
.return-icon.ai-star-svg {
  width: 14px;
  height: 14px;
  margin-left: 4px;
  transition: transform 0.3s ease;
}

/* 鼠标悬浮时，四角星微微旋转发光，AI感拉满 */
.search-container.is-active .ai-search-btn:hover .ai-star-svg {
  transform: rotate(90deg) scale(1.1);
}
/* --- AI 流光边框效果 --- */
.ai-glow-border {
  position: absolute;
  inset: -1px;
  border-radius: 7px;
  background: linear-gradient(90deg, #409eff, #a855f7, #ec4899, #409eff);
  background-size: 300% 100%;
  opacity: 0;
  z-index: -1;
  transition: opacity 0.3s ease;
  animation: ai-gradient-shift 3s linear infinite;
}

/* 聚焦或有输入内容时显示流光边框 */
.search-container:focus-within .ai-glow-border {
  opacity: 1;
}

@keyframes ai-gradient-shift {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}

/* --- 内部输入框包装器 --- */
.input-wrapper {
  display: flex;
  align-items: center;
  background: var(--bg-hover);
  border-radius: 6px;
  padding: 4px 6px 4px 12px;
  height: 38px;
  box-sizing: border-box;
  transition: background 0.2s;
}

.search-container:focus-within .input-wrapper {
  background: var(--main-content-bg);
}

/* --- 左侧图标组 --- */
.icon-group {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  margin-right: 8px;
}

.search-icon {
  color: var(--text-secondary);
  font-size: 13px;
  transition: color 0.3s, opacity 0.3s;
}

.ai-sparkle {
  position: absolute;
  top: -4px;
  right: -6px;
  font-size: 10px;
  color: transparent;
  background: linear-gradient(135deg, #a855f7, #ec4899);
  background-clip: text;
  -webkit-background-clip: text;
  opacity: 0;
  transform: scale(0.5);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 聚焦时点亮 AI 星火图标 */
.search-container:focus-within .search-icon {
  color: var(--accent-color);
}
.search-container:focus-within .ai-sparkle,
.search-container.is-active .ai-sparkle {
  opacity: 1;
  transform: scale(1);
}

/* --- 输入框主体 --- */
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  outline: none;
  font-size: 13px;
  width: 100%;
  padding: 0;
}

.search-input::placeholder {
  color: var(--text-secondary);
  font-size: 13px;
  transition: color 0.2s;
}

.search-input:focus::placeholder {
  color: transparent; /* 聚焦时隐藏占位符，更清爽 */
}

/* --- 右侧：AI 搜索确认按钮 --- */
.ai-search-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0.6;
}

.return-icon {
  font-size: 10px;
  transform: scaleY(-1); /* 翻转做成类似回车键的效果 */
}

/* 当有输入内容时，按钮高亮并呈现渐变 AI 风格 */
.search-container.is-active .ai-search-btn {
  opacity: 1;
  color: #fff;
  background: linear-gradient(135deg, #409eff, #a855f7);
  box-shadow: 0 2px 6px rgba(168, 85, 247, 0.3);
}

.search-container.is-active .ai-search-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(168, 85, 247, 0.4);
}

.ai-search-btn:disabled {
  cursor: not-allowed;
}

/* 点击按下的反馈动画 */
.search-container.is-active .ai-search-btn:active {
  transform: translateY(1px) scale(0.94); /* 按钮往下沉并轻微缩小 */
  box-shadow: 0 1px 2px rgba(168, 85, 247, 0.2); /* 阴影收缩，模拟贴近屏幕 */
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1); /* 让按下的瞬间更干脆快速 */
}

/* 给里面的星星也加一个点击缩放，反馈更细腻 */
.search-container.is-active .ai-search-btn:active .ai-star-svg {
  transform: scale(0.85);
}

@media (max-width: 900px) {
  .search-container {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .input-wrapper {
    padding-left: 10px;
  }

  .btn-text {
    display: none;
  }

  .ai-search-btn {
    padding: 6px 8px;
  }
}
</style>