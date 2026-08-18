<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { UserApi } from '@/commands/user';
import { ElInput, ElButton, ElMessage } from 'element-plus';
import Setting from "@/store/setting.js";
import Home from '@/store/home.ts';
import { marked } from 'marked'; // 引入 marked

// 配置 marked，允许回车直接换行
marked.setOptions({
  breaks: true,
  gfm: true
});

const renderMarkdown = (text: string) => {
  if (!text) return '';
  return marked(text);
};

const settingStore = Setting();
const homeStore = Home();
const isOpen = ref(false);
const messages = ref([
  { role: 'ai', content: '你好！我是你的网盘智能助手，想让我帮你执行什么操作？' }
]);
const inputText = ref('');
const messageListRef = ref<HTMLElement | null>(null);

// ================= 拖拽小球与位置管理 =================
const widgetX = ref(0);
const widgetY = ref(0);
const isDragging = ref(false);
let startMouseX = 0;
let startMouseY = 0;
let startWidgetX = 0;
let startWidgetY = 0;
let hasMoved = false;

const isLeft = computed(() => widgetX.value < window.innerWidth / 2);
const isTop = computed(() => widgetY.value < window.innerHeight / 2);

// ================= 8向自由拉伸逻辑 =================
const winWidth = ref(450);
const winHeight = ref(550);
const winOffsetX = ref(0);
const winOffsetY = ref(0);

let resizeDir = '';
let startRW = 0, startRH = 0, startROX = 0, startROY = 0, startRMX = 0, startRMY = 0;

const chatWindowStyle = computed(() => ({
  width: `${winWidth.value}px`,
  height: `${winHeight.value}px`,
  left: `${winOffsetX.value}px`,
  top: `${winOffsetY.value}px`,
  transformOrigin: `${winOffsetX.value < 0 ? 'right' : 'left'} ${winOffsetY.value < 0 ? 'bottom' : 'top'}`
}));

const startResize = (dir: string, e: MouseEvent | TouchEvent) => {
  resizeDir = dir;
  startRW = winWidth.value;
  startRH = winHeight.value;
  startROX = winOffsetX.value;
  startROY = winOffsetY.value;

  const touch = e.type.includes('touch') ? (e as TouchEvent).touches[0] : (e as MouseEvent);
  startRMX = touch.clientX;
  startRMY = touch.clientY;

  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
  document.addEventListener('touchmove', onResizeMove, { passive: false });
  document.addEventListener('touchend', onResizeEnd);

  document.body.style.userSelect = 'none';
};

const onResizeMove = (e: MouseEvent | TouchEvent) => {
  e.preventDefault();
  const touch = e.type.includes('touch') ? (e as TouchEvent).touches[0] : (e as MouseEvent);
  const dx = touch.clientX - startRMX;
  const dy = touch.clientY - startRMY;

  let newW = startRW;
  let newH = startRH;
  let newOX = startROX;
  let newOY = startROY;

  const MIN_W = 320;
  const MIN_H = 400;
  const MAX_W = window.innerWidth - 40;
  const MAX_H = window.innerHeight - 40;

  if (resizeDir.includes('e')) newW = Math.min(MAX_W, Math.max(MIN_W, startRW + dx));
  if (resizeDir.includes('w')) {
    newW = Math.min(MAX_W, Math.max(MIN_W, startRW - dx));
    newOX = startROX + (startRW - newW);
  }
  if (resizeDir.includes('s')) newH = Math.min(MAX_H, Math.max(MIN_H, startRH + dy));
  if (resizeDir.includes('n')) {
    newH = Math.min(MAX_H, Math.max(MIN_H, startRH - dy));
    newOY = startROY + (startRH - newH);
  }

  winWidth.value = newW;
  winHeight.value = newH;
  winOffsetX.value = newOX;
  winOffsetY.value = newOY;
};

const onResizeEnd = () => {
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend', onResizeEnd);
  document.body.style.userSelect = '';
};

const onDragStart = (e: MouseEvent | TouchEvent) => {
  if (isOpen.value) return;
  const touch = e.type.includes('touch') ? (e as TouchEvent).touches[0] : (e as MouseEvent);
  startMouseX = touch.clientX;
  startMouseY = touch.clientY;
  startWidgetX = widgetX.value;
  startWidgetY = widgetY.value;
  hasMoved = false;

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
};

const onDragMove = (e: MouseEvent | TouchEvent) => {
  const touch = e.type.includes('touch') ? (e as TouchEvent).touches[0] : (e as MouseEvent);
  const dx = touch.clientX - startMouseX;
  const dy = touch.clientY - startMouseY;

  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    hasMoved = true;
    isDragging.value = true;
  }

  if (hasMoved) {
    e.preventDefault();
    widgetX.value = Math.max(30, Math.min(window.innerWidth - 30, startWidgetX + dx));
    widgetY.value = Math.max(30, Math.min(window.innerHeight - 30, startWidgetY + dy));
  }
};

const onDragEnd = () => {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  setTimeout(() => { isDragging.value = false; }, 0);
};

const handleResize = () => {
  widgetX.value = Math.min(widgetX.value, window.innerWidth - 30);
  widgetY.value = Math.min(widgetY.value, window.innerHeight - 30);
};

onMounted(() => {
  widgetX.value = window.innerWidth - 60;
  widgetY.value = window.innerHeight - 60;
  window.addEventListener('resize', handleResize);
});
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (recognition) recognition.stop();
});

const handleToggle = () => {
  if (!isDragging.value && !hasMoved) {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
      winOffsetX.value = isLeft.value ? -28 : 28 - winWidth.value;
      winOffsetY.value = isTop.value ? 40 : -40 - winHeight.value;
      scrollToBottom();
    }
  }
  hasMoved = false;
};

const scrollToBottom = async () => {
  await nextTick();
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
};

// ================= 语音输入逻辑 =================
const isRecording = ref(false);
let recognition: any = null;
let textBeforeRecording = '';

const initSpeechRecognition = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    ElMessage.warning('抱歉，您当前的浏览器不支持语音输入功能，建议使用 Chrome 或 Edge 浏览器。');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onstart = () => {
    isRecording.value = true;
    textBeforeRecording = inputText.value;
  };

  recognition.onresult = (event: any) => {
    let currentTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      currentTranscript += event.results[i][0].transcript;
    }
    inputText.value = textBeforeRecording + currentTranscript;
  };

  recognition.onerror = (event: any) => {
    console.error('语音识别错误:', event.error);
    if (event.error === 'not-allowed') {
      ElMessage.error('请允许浏览器使用麦克风权限');
    }
    isRecording.value = false;
  };

  recognition.onend = () => {
    isRecording.value = false;
  };

  return true;
};

const toggleVoice = () => {
  if (isRecording.value) {
    recognition?.stop();
  } else {
    if (!recognition) {
      if (!initSpeechRecognition()) return;
    }
    recognition.start();
  }
};

// ================= 发送消息 =================
// 锁状态，防止用户在 AI 正在回答时频繁点击发送
const isFetching = ref(false);

const sendMessage = async () => {
  if (isRecording.value) {
    recognition?.stop();
  }

  const text = inputText.value.trim();
  if (!text || isFetching.value) return;

  const historyToSend = messages.value
      .filter(m => m.content && m.content.trim() !== '')
      .map(m => ({ Role: m.role, Content: m.content }));

  const recentHistory = historyToSend.slice(-10);

  // 1. 推入用户消息
  messages.value.push({ role: 'user', content: text });
  inputText.value = '';

  // 2. 立即推入一个空的 AI 气泡，它会因为内容为空而在页面上显示 "思考中..." 动画
  messages.value.push({ role: 'ai', content: '' });
  const currentMsgIndex = messages.value.length - 1;
  isFetching.value = true;
  await scrollToBottom();

  try {
    const response = await fetch(`${import.meta.env.VITE_APP_BASE_API}/User/ProcessCommandStream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settingStore.token}`
      },
      body: JSON.stringify({
        userInput: text,
        history: recentHistory,
        context: {
          currentFolderId: homeStore.currentFolder.Id || homeStore.rootFolder.Id,
          currentPath: homeStore.currentPath || '/',
          currentDomain: window.location.origin,
          client: 'web',
          backEnd: `${import.meta.env.VITE_APP_ASSETS_API}`

        }
      })
    });

    if (!response.ok) throw new Error(`请求失败，状态码: ${response.status}`);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });

        // 追加流内容，Vue 监听到 content 变化会自动渲染出 Markdown 并且替换掉 "思考中..."
        messages.value[currentMsgIndex].content += chunkText;
        await scrollToBottom();
      }
    }
  } catch (error) {
    messages.value[currentMsgIndex].content = '❌ 网络异常，无法连接到 AI 服务。';
  } finally {
    isFetching.value = false;
    await scrollToBottom();
  }
};
</script>

<template>
  <div class="ai-floating-widget" :style="{ left: widgetX + 'px', top: widgetY + 'px' }">
    <transition name="chat-fade-slide">
      <div v-show="isOpen" :class="['chat-window', 'custom-dialog', settingStore.theme]" :style="chatWindowStyle">

        <div class="resize-handle n" @mousedown.prevent="startResize('n', $event)" @touchstart.prevent="startResize('n', $event)"></div>
        <div class="resize-handle s" @mousedown.prevent="startResize('s', $event)" @touchstart.prevent="startResize('s', $event)"></div>
        <div class="resize-handle e" @mousedown.prevent="startResize('e', $event)" @touchstart.prevent="startResize('e', $event)"></div>
        <div class="resize-handle w" @mousedown.prevent="startResize('w', $event)" @touchstart.prevent="startResize('w', $event)"></div>
        <div class="resize-handle nw" @mousedown.prevent="startResize('nw', $event)" @touchstart.prevent="startResize('nw', $event)"></div>
        <div class="resize-handle ne" @mousedown.prevent="startResize('ne', $event)" @touchstart.prevent="startResize('ne', $event)"></div>
        <div class="resize-handle sw" @mousedown.prevent="startResize('sw', $event)" @touchstart.prevent="startResize('sw', $event)"></div>
        <div class="resize-handle se" @mousedown.prevent="startResize('se', $event)" @touchstart.prevent="startResize('se', $event)"></div>

        <div class="chat-header">
          <div class="header-title">
            <span class="icon">✨</span> 智能网盘助手
          </div>
          <div class="close-btn" @click="handleToggle">✕</div>
        </div>

        <div class="chat-messages scroll-area" ref="messageListRef">
          <div v-for="(msg, index) in messages" :key="index" :class="['message-bubble', msg.role]">

            <div v-if="msg.role === 'ai' && !msg.content" class="content thinking">
              思考中<span>.</span><span>.</span><span>.</span>
            </div>

            <div
                v-else-if="msg.role === 'ai'"
                class="content markdown-body"
                v-html="renderMarkdown(msg.content)">
            </div>

            <div v-else class="content">{{ msg.content }}</div>

          </div>
        </div>

        <div class="chat-input-area">
          <el-input
              v-model="inputText"
              type="textarea"
              :rows="2"
              :placeholder="isRecording ? '正在聆听，请说话...' : '输入指令，按 Enter 发送...'"
              resize="none"
              @keyup.enter.native.prevent="sendMessage"
          />

          <div class="input-actions">
            <el-button
                class="voice-btn"
                :class="{ 'is-recording': isRecording }"
                circle
                @click="toggleVoice"
                :title="isRecording ? '点击停止语音输入' : '点击开始语音输入'"
            >
              🎤
            </el-button>
            <div class="action-right">
              <span class="tip-text">按 Enter 发送</span>
              <el-button type="primary" size="small" @click="sendMessage" :loading="isFetching">发送</el-button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <div class="floating-btn"
         :class="{ 'is-active': isOpen, 'is-dragging': isDragging }"
         @mousedown.prevent="onDragStart"
         @touchstart="onDragStart"
         @click="handleToggle">
      ✨
    </div>
  </div>
</template>

<style scoped>
.ai-floating-widget {
  position: fixed;
  z-index: 9999;
  width: 0;
  height: 0;
}

/* --- 悬浮按钮 --- */
.floating-btn {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-color);
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 120, 212, 0.4);
  transition: background-color 0.3s, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.floating-btn:hover {
  transform: translate(-50%, -50%) scale(1.1);
  background: var(--accent-hover);
}
.floating-btn.is-active {
  transform: translate(-50%, -50%) scale(0.9);
  background: var(--text-secondary);
  box-shadow: none;
}
.floating-btn.is-dragging {
  transition: none;
  transform: translate(-50%, -50%) scale(1.05);
}

/* --- 聊天主窗口 --- */
.chat-window {
  position: absolute;
  background: var(--acrylic-base);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow);
}

/* 8向拉伸热区 CSS */
.resize-handle { position: absolute; z-index: 100; }
.resize-handle.n { top: 0; left: 12px; right: 12px; height: 8px; cursor: ns-resize; }
.resize-handle.s { bottom: 0; left: 12px; right: 12px; height: 8px; cursor: ns-resize; }
.resize-handle.e { right: 0; top: 12px; bottom: 12px; width: 8px; cursor: ew-resize; }
.resize-handle.w { left: 0; top: 12px; bottom: 12px; width: 8px; cursor: ew-resize; }
.resize-handle.nw { top: 0; left: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.resize-handle.ne { top: 0; right: 0; width: 14px; height: 14px; cursor: nesw-resize; }
.resize-handle.sw { bottom: 0; left: 0; width: 14px; height: 14px; cursor: nesw-resize; }
.resize-handle.se { bottom: 0; right: 0; width: 14px; height: 14px; cursor: nwse-resize; }

/* --- 头部 --- */
.chat-header {
  height: 50px;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  background: var(--main-content-bg);
  flex-shrink: 0;
}
.header-title {
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.close-btn {
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 18px;
  transition: color 0.2s;
}
.close-btn:hover { color: var(--accent-color); }

/* --- 消息区 --- */
.chat-messages {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--main-content-bg);
  overflow-y: auto;
}
.chat-messages::-webkit-scrollbar { width: 6px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb { background-color: var(--border-color); border-radius: 10px; }
.chat-messages::-webkit-scrollbar-thumb:hover { background-color: var(--text-secondary); }

.message-bubble { display: flex; max-width: 85%; }
.message-bubble.user { align-self: flex-end; }
.message-bubble.ai { align-self: flex-start; }
.content {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.message-bubble.ai .content {
  background: var(--input-bg);
  color: var(--text-primary);
  border-top-left-radius: 4px;
}
.message-bubble.user .content {
  background: var(--accent-color);
  color: white;
  border-top-right-radius: 4px;
}

/* "思考中" 动画样式 */
.thinking {
  font-style: italic;
  color: var(--text-secondary) !important;
  display: flex;
  align-items: center;
}
@keyframes dot-blink {
  0%, 100% { opacity: 0.2; }
  20% { opacity: 1; }
}
.thinking span {
  animation: dot-blink 1.4s infinite both;
  font-weight: bold;
  margin-left: 2px;
}
.thinking span:nth-child(2) { animation-delay: 0.2s; }
.thinking span:nth-child(3) { animation-delay: 0.4s; }

/* ======================================================== */
/* 👇 针对 Markdown 渲染的内置样式优化 (使用 deep 穿透 v-html) */
/* ======================================================== */
:deep(.markdown-body) {
  font-size: 14px;
  line-height: 1.6;
  white-space: normal !important; /* 防止渲染出来的HTML带有冗余换行 */
  word-break: break-word;
}

/* 恢复正常的段落间距，让空行重新出现 */
:deep(.markdown-body p) {
  margin: 0 0 14px 0;
}
:deep(.markdown-body p:last-child) {
  margin-bottom: 0;
}

/* 列表容器样式 */
:deep(.markdown-body ul), :deep(.markdown-body ol) {
  padding-left: 20px;
  margin: 4px 0 14px 0;
}

/* 每个列表项的间距 */
:deep(.markdown-body li) {
  margin-bottom: 4px;
}

/* 🌟 核心：强制取消列表项内部段落的边距，防止列表松散 🌟 */
:deep(.markdown-body li p) {
  margin: 0 !important;
  display: inline-block;
}

/* 代码块与其他元素 */
:deep(.markdown-body pre) {
  background-color: #282c34;
  color: #abb2bf;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 10px 0;
}
:deep(.markdown-body code) {
  background-color: rgba(175, 184, 193, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
}
:deep(.markdown-body pre code) {
  background-color: transparent;
  padding: 0;
}
:deep(.markdown-body table) {
  border-collapse: collapse;
  width: 100%;
  margin: 10px 0;
}
:deep(.markdown-body th), :deep(.markdown-body td) {
  border: 1px solid var(--border-color);
  padding: 6px 13px;
}
:deep(.markdown-body blockquote) {
  border-left: 4px solid var(--accent-color);
  padding-left: 10px;
  margin: 10px 0;
  color: var(--text-secondary);
  background-color: rgba(0, 120, 212, 0.05);
}

/* --- 输入区及底部操作栏 --- */
.chat-input-area {
  padding: 15px;
  border-top: 1px solid var(--border-color);
  background: var(--main-content-bg);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
:deep(.el-textarea__inner) {
  background-color: var(--input-bg) !important;
  border: none !important;
  box-shadow: none !important;
  color: var(--text-primary) !important;
  padding: 8px 12px;
  border-radius: 8px;
}
:deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px var(--accent-color) inset !important;
}

/* 底部操作栏样式 */
.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.voice-btn {
  background-color: var(--input-bg);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.voice-btn:hover {
  color: var(--accent-color);
  border-color: var(--accent-color);
}

/* 录音中的呼吸灯效果 */
.voice-btn.is-recording {
  background-color: #f56c6c;
  color: white;
  border-color: #f56c6c;
  animation: voicePulse 1.5s infinite;
}

.action-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tip-text {
  font-size: 12px;
  color: var(--text-secondary);
}

/* --- 动画 --- */
.chat-fade-slide-enter-active,
.chat-fade-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.chat-fade-slide-enter-from,
.chat-fade-slide-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(10px);
}

@keyframes voicePulse {
  0% { box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(245, 108, 108, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 108, 108, 0); }
}

/* === 移动端适配 === */
@media (max-width: 900px) {
  .floating-btn {
    width: 50px;
    height: 50px;
    font-size: 22px;
  }

  .chat-window {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    left: 0 !important;
    top: 0 !important;
    border-radius: 0;
  }

  .resize-handle {
    display: none;
  }

  .chat-header {
    height: 56px;
    padding: 0 16px;
  }

  .chat-messages {
    padding: 14px 16px;
    gap: 12px;
  }

  .message-bubble {
    max-width: 90%;
  }

  .chat-input-area {
    padding: 12px;
  }

  .input-actions {
    flex-wrap: wrap;
    gap: 8px;
  }

  .action-right {
    width: 100%;
    justify-content: space-between;
  }

  .tip-text {
    display: none;
  }

  .action-right .el-button {
    flex: 1;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .floating-btn {
    width: 46px;
    height: 46px;
    font-size: 20px;
  }

  .content {
    padding: 8px 12px;
    font-size: 13px;
  }

  :deep(.markdown-body) {
    font-size: 13px;
  }
}
</style>