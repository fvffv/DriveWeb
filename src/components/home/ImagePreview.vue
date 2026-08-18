<script setup lang="ts">
import { ElImageViewer } from 'element-plus';

const props = defineProps<{
  visible: boolean;
  urlList: string[];
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
}>();

// 关闭预览弹窗
const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};
</script>

<template>
  <!--
    ElImageViewer 是 Element-Plus 内部专门用于图片全屏预览的组件
    自带放大、缩小、旋转、拖拽等完整功能
  -->
  <el-image-viewer
      v-if="visible"
      :url-list="urlList"
      @close="handleClose"
      teleported
      hide-on-click-modal
  />
</template>

<style scoped>
/* 可以在这里覆盖默认的 z-index 等样式如果需要 */
</style>
