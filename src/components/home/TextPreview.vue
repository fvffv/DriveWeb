<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElDialog, ElMessage } from 'element-plus';
import VueMonacoEditor, { loader } from '@guolao/vue-monaco-editor';
import Setting from "@/store/setting.ts";
import jschardet from 'jschardet';
import { marked } from 'marked'; // 引入 Markdown 解析库

loader.config({
  paths: {
    vs: '/monaco-editor/min/vs'
  },
});

const props = defineProps<{
  visible: boolean;
  url: string;
  fileName: string;
}>();
const settingStore = Setting();
const emit = defineEmits(['update:visible', 'close']);

const theme = ref(settingStore.theme === 'dark' ? 'vs-dark' : 'vs');
const textContent = ref('');
const loading = ref(false);
const editorLanguage = ref('plaintext');

// 新增：用于 Markdown 预览的状态控制
const isMarkdown = ref(false);
const viewMode = ref<'source' | 'preview'>('source');
const htmlContent = ref('');

const getLanguageFromExtension = (filename: string) => {
  if (!filename) return 'plaintext';
  const ext = filename.split('.').pop()?.toLowerCase();

  const map: Record<string, string> = {
    'json': 'json', 'js': 'javascript', 'ts': 'typescript',
    'vue': 'html', 'html': 'html', 'css': 'css', 'less': 'less',
    'scss': 'scss', 'xml': 'xml', 'cs': 'csharp', 'sql': 'sql',
    'py': 'python', 'java': 'java', 'md': 'markdown', 'yml': 'yaml',
    'yaml': 'yaml', 'sh': 'shell', 'bash': 'shell', 'ini': 'ini'
  };
  return ext && map[ext] ? map[ext] : 'plaintext';
};

const fetchTextContent = async () => {
  if (!props.url) return;
  loading.value = true;
  try {
    const response = await fetch(props.url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();

    const uint8Array = new Uint8Array(buffer);
    const detectSize = Math.min(uint8Array.length, 4096);
    let binaryString = '';
    for (let i = 0; i < detectSize; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    const detectResult = jschardet.detect(binaryString);
    console.log(`[TextPreview] 探测到文件编码:`, detectResult);

    let encoding = 'utf-8';
    if (detectResult && detectResult.encoding) {
      encoding = detectResult.encoding.toLowerCase();
      if (encoding === 'ascii') encoding = 'utf-8';
    }

    let decodedText = '';
    try {
      const decoder = new TextDecoder(encoding);
      decodedText = decoder.decode(buffer);
    } catch (decodeErr) {
      console.warn(`[TextPreview] 不支持的编码格式: ${encoding}，回退到 UTF-8`);
      const fallbackDecoder = new TextDecoder('utf-8');
      decodedText = fallbackDecoder.decode(buffer);
    }

    try {
      if (props.fileName.endsWith('.json')) {
        const jsonObj = JSON.parse(decodedText);
        decodedText = JSON.stringify(jsonObj, null, 2);
      }
    } catch (e) {}

    textContent.value = decodedText;
    editorLanguage.value = getLanguageFromExtension(props.fileName);

    // ==========================================
    // 新增逻辑：判断并处理 Markdown 文件
    // ==========================================
    if (props.fileName.toLowerCase().endsWith('.md')) {
      isMarkdown.value = true;
      viewMode.value = 'preview'; // 如果是 md 文件，默认开启“预览效果”
      // 将 Markdown 转换为 HTML (兼容旧版 marked 返回字符串，新版可能需要 await)
      const parsed = marked.parse(decodedText);
      htmlContent.value = parsed instanceof Promise ? await parsed : parsed;
    }

  } catch (error) {
    console.error("读取文本文件失败:", error);
    ElMessage.error(`读取文件失败: ${props.fileName}`);
    textContent.value = '// 文件加载失败或跨域被拦截...';
    editorLanguage.value = 'plaintext';
  } finally {
    loading.value = false;
  }
};

watch(() => props.visible, (newVal) => {
  if (newVal) {
    textContent.value = '';
    htmlContent.value = '';
    isMarkdown.value = false;
    viewMode.value = 'source'; // 重置为源码模式
    fetchTextContent();
  }
});

watch(() => settingStore.theme, (newVal) => {
  theme.value = newVal === 'dark' ? 'vs-dark' : 'vs';
});

const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};
</script>

<template>
  <el-dialog
      :model-value="visible"
      width="70%"
      top="5vh"
      @close="handleClose"
      destroy-on-close
      append-to-body
  >
    <!-- 使用 slot 自定义头部，加入切换按钮 -->
    <template #header>
      <div class="dialog-header">
        <span class="el-dialog__title">文本预览: {{ fileName }}</span>
        <!-- 如果是 Markdown 文件，显示模式切换按钮 -->
        <el-radio-group v-if="isMarkdown" v-model="viewMode" size="small">
          <el-radio-button value="preview">预览效果</el-radio-button>
          <el-radio-button value="source">Markdown 源码</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <div class="monaco-container" v-loading="loading" element-loading-text="正在加载代码/文本...">

      <!-- 源码模式：显示 Monaco 编辑器 -->
      <vue-monaco-editor
          v-if="viewMode === 'source'"
          v-model:value="textContent"
          :theme="theme"
          :language="editorLanguage"
          :options="{
            readOnly: true,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontSize: 14,
            wordWrap: 'on'
          }"
          style="height: 100%; width: 100%;"
      />

      <!-- 预览模式：显示渲染后的 HTML 效果 -->
      <div v-else-if="viewMode === 'preview'" class="markdown-preview" v-html="htmlContent"></div>

    </div>
  </el-dialog>
</template>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 20px; /* 留出右上角关闭按钮的空间 */
}

.monaco-container {
  height: 65vh;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--el-bg-color); /* 适配 Element 主题背景 */
}

/* ================================
   Markdown 预览的内置样式
   使用了 Element Plus 的 CSS 变量以自动适配深浅色模式
================================ */
.markdown-preview {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  padding: 20px 30px;
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  box-sizing: border-box;
  line-height: 1.6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}

.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4) {
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding-bottom: 0.3em;
  margin-top: 1.5em;
  margin-bottom: 16px;
  font-weight: 600;
}

.markdown-preview :deep(p),
.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-preview :deep(li) {
  margin-left: 20px;
}

.markdown-preview :deep(pre) {
  background-color: var(--el-fill-color-light);
  padding: 16px;
  overflow: auto;
  border-radius: 6px;
  margin-bottom: 16px;
}

.markdown-preview :deep(code) {
  font-family: Consolas, Monaco, monospace;
  background-color: var(--el-fill-color-light);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 85%;
}

.markdown-preview :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.markdown-preview :deep(blockquote) {
  margin: 0 0 16px 0;
  padding: 0 1em;
  color: var(--el-text-color-secondary);
  border-left: 0.25em solid var(--el-border-color-dark);
}

.markdown-preview :deep(img) {
  max-width: 100%;
  box-sizing: border-box;
}

:deep(.el-dialog__body) {
  padding: 10px 20px 20px 20px !important;
}
</style>
