<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElDialog, ElMessage, ElResult, ElButton } from 'element-plus';

// 引入 vue-office 组件
import VueOfficeDocx from '@vue-office/docx';
import VueOfficeExcel from '@vue-office/excel';
import VueOfficePdf from '@vue-office/pdf';
import VueOfficePptx from '@vue-office/pptx';
// 引入相关的样式
import '@vue-office/docx/lib/index.css';
import '@vue-office/excel/lib/index.css';

const props = defineProps<{
  visible: boolean;
  url: string;
  fileName: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
}>();

// 状态管理
const loading = ref(true);
const hasError = ref(false);

// 🌟 新增：专门用于实际传给组件的渲染 URL
const renderUrl = ref('');

// 监听弹窗打开，重置状态，但⚠️不要立刻赋 url 值
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loading.value = true;
    hasError.value = false;
    renderUrl.value = ''; // 打开时先置空，防止用旧尺寸渲染
  } else {
    renderUrl.value = ''; // 关闭时清空缓存，释放内存
  }
});

// 🌟 新增：监听 Dialog 完全打开后的事件
const handleDialogOpened = () => {
  // 只有当弹窗完全展开，尺寸固定后，才把真正的 url 赋值给组件去渲染
  renderUrl.value = props.url;
};

// 计算文件类型，以决定加载哪个组件
const fileType = computed(() => {
  if (!props.fileName) return '';
  const ext = props.fileName.substring(props.fileName.lastIndexOf('.')).toLowerCase();
  if (['.docx'].includes(ext)) return 'docx';
  if (['.xlsx', '.xls'].includes(ext)) return 'excel'; // 注意：vue-office 官方主要支持 xlsx，旧版 xls 可能会报错
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.pptx'].includes(ext)) return 'pptx';
  return 'unknown';
});

// 事件处理：渲染完成
const handleRendered = () => {
  loading.value = false;
  hasError.value = false;
  console.log(`[DocumentPreview] ${props.fileName} 渲染成功`);
};

// 事件处理：渲染失败
const handleError = (e: any) => {
  loading.value = false;
  hasError.value = true;
  console.error(`[DocumentPreview] ${props.fileName} 渲染失败:`, e);
  ElMessage.error(`无法正常读取或渲染文件：${props.fileName}`);
};

// 关闭弹窗
const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};

// 重新加载
const handleRetry = () => {
  loading.value = true;
  hasError.value = false;
  // 稍微延迟一下触发重新渲染
  setTimeout(() => {
    loading.value = false; // 触发视图更新的 hack
    setTimeout(() => { loading.value = true; }, 50);
  }, 100);
};
</script>

<template>
  <el-dialog
      :model-value="visible"
      :title="`正在预览: ${fileName}`"
      fullscreen
      custom-class="doc-preview-dialog"
      destroy-on-close
      @close="handleClose"
      @opened="handleDialogOpened"
      align-center
  >
    <div class="preview-container" v-loading="loading" element-loading-text="文档加载中，请稍候...">

      <!-- 正常渲染区域 -->
      <template v-if="!hasError">
        <vue-office-docx
            v-if="fileType === 'docx' && renderUrl"
            :src="renderUrl"
            @rendered="handleRendered"
            @error="handleError"
            class="office-viewer"
        />

        <vue-office-excel
            v-else-if="fileType === 'excel' && renderUrl"
            :src="renderUrl"
            @rendered="handleRendered"
            @error="handleError"
            class="office-viewer"
        />

        <vue-office-pdf
            v-else-if="fileType === 'pdf' && renderUrl"
            :src="renderUrl"
            @rendered="handleRendered"
            @error="handleError"
            class="office-viewer"
        />
        <vue-office-pptx
            v-else-if="fileType === 'pptx' && renderUrl"
            :src="renderUrl"
            @rendered="handleRendered"
            @error="handleError"
            class="office-viewer"
        />
        <div v-else-if="!loading" class="unsupported-type">
          <el-result
              icon="warning"
              title="暂不支持预览此类型"
              :sub-title="`文件类型不受支持: ${fileName}`"
          >
            <template #extra>
              <el-button type="primary" @click="handleClose">关闭</el-button>
            </template>
          </el-result>
        </div>
      </template>

      <!-- 错误提示区域 -->
      <div v-else class="error-container">
        <el-result
            icon="error"
            title="文档加载或渲染失败"
            sub-title="文件可能已损坏、格式不支持（如旧版 .doc/.xls）或跨域被拦截。"
        >
          <template #extra>
            <el-button @click="handleRetry">重试</el-button>
            <el-button type="primary" @click="handleClose">关闭</el-button>
          </template>
        </el-result>
      </div>

    </div>
  </el-dialog>
</template>

<style scoped>
.preview-container {
  height: calc(100vh - 120px); /* 减去弹窗头部和边距的高度 */
  width: 100%;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}

.office-viewer {
  width: 100%;
  height: 100%;
  overflow: auto;
}

/* 如果需要在暗黑模式下调整背景色，可以加上类似下面的样式 */
:global(.doc-preview-dialog.dark .preview-container) {
  background-color: #1d2129;
}

.unsupported-type, .error-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #ffffff;
}
</style>

<style>
/* 覆盖 ElDialog 全屏默认的 body padding，让文档占满整个可视区域 */
.doc-preview-dialog .el-dialog__body {
  padding: 10px 20px 20px 20px !important;
  height: calc(100% - 54px);
  box-sizing: border-box;
}
</style>
