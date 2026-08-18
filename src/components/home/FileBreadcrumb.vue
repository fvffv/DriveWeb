<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { ElInput, ElMessage } from 'element-plus';
import 'element-plus/es/components/input/style/css';
import Setting from "@/store/setting.js";
import Home from '@/store/home.ts';

const settingStore = Setting();
const homeStore = Home(); // 使用 homeStore 获取当前路径信息

// 定义事件：当路径改变时通知父组件 (虽然主要逻辑可能直接操作 store，但保持组件独立性是个好习惯)
const emit = defineEmits(['navigate']);

// --- 状态 ---
const isEditMode = ref(false); // 是否处于编辑模式 (输入框模式)
const inputPath = ref('');     // 输入框绑定的路径字符串
const inputRef = ref<InstanceType<typeof ElInput> | null>(null);

// --- 计算属性 ---

// 将当前路径对象转换为面包屑数组
// 假设 homeStore.currentPath 结构包含 Path 属性 (例如 "/Project/Docs")
// 如果你的后端返回的是 ID 链，这里需要根据 store 的逻辑调整。
// 这里假设路径是基于字符串的 '/folder/subfolder' 或者是链表结构。
// 为了通用性，我们假设可以从 homeStore 获取面包屑列表。
// 如果 store 没有现成的面包屑数据，我们需要自己解析 currentPath.Path。
const breadcrumbs = computed(() => {
  const pathStr = homeStore.currentPath || '/';
  if (pathStr === '/' || !pathStr) return [{ name: '首页', path: '/' }];

  const parts = pathStr.split('/').filter(p => p);
  const crumbs = [{ name: '首页', path: '/' }];

  let currentAccumulatedPath = '';
  parts.forEach(part => {
    currentAccumulatedPath += '/' + part;
    crumbs.push({
      name: part,
      path: currentAccumulatedPath
    });
  });
  return crumbs;
});

// --- 方法 ---

// 1. 点击面包屑某一级，跳转
const handleBreadcrumbClick = async (crumb) => {
  if (crumb.path === homeStore.currentPath) return; // 点击当前页不刷新

  console.log('跳转到:', crumb.path);
  // 调用 Store 的方法加载新路径
  // 假设 store 有个方法叫 loadPath 或者 setUserDirectoryFileInfo(path)
  // 如果是 ID 驱动的，这里可能需要查找 ID，或者后端支持 Path 查询

  if(crumb.path==='/'){
    await homeStore.setUserDirectoryFileInfo(homeStore.rootFolder.Id);
    homeStore.currentPath = '/'
  }else{
      const fid = await homeStore.getPullPathToFolderId(crumb.path);
      if(fid.Status!=0){
        ElMessage.error('路径不存在或无法访问');
        await homeStore.setUserDirectoryFileInfo(homeStore.rootFolder.Id);
        homeStore.currentPath = '/'
      }else{
        await homeStore.setUserDirectoryFileInfo(fid.Data);
        homeStore.currentPath =crumb.path;
      }

  }
  homeStore.clearSelection();
  emit('navigate', crumb.path);
};

// 2. 进入编辑模式
const enableEditMode = () => {
  inputPath.value = homeStore.currentPath || '/';
  isEditMode.value = true;
  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select(); // 全选文本方便修改
  });
};

// 3. 退出编辑模式 (失焦或按下 Esc)
const disableEditMode = () => {
  isEditMode.value = false;
};

// 4. 提交手动输入的路径 (按下 Enter)
const handlePathSubmit = async () => {
  const targetPath = inputPath.value.trim();
  if (!targetPath) return;

  if (targetPath === homeStore.currentPath) {
    isEditMode.value = false;
    return;
  }
  if (targetPath === '/') {
    isEditMode.value = false;
    homeStore.currentPath = '/'
    await homeStore.setUserDirectoryFileInfo(homeStore.rootFolder.Id);

    return;
  }


  const fid = await homeStore.getPullPathToFolderId(targetPath);
  if(fid.Status!=0){
    ElMessage.error('路径不存在或无法访问');
    return;
  }
  const jg =  await homeStore.setUserDirectoryFileInfo(fid.Data);
  if (jg.Status==0){
    isEditMode.value = false;
    homeStore.currentPath = targetPath;
    emit('navigate', targetPath);
  }else{
    ElMessage.error('路径不存在或无法访问');
    // 保持编辑模式，让用户修改
    inputRef.value?.focus();
  }

};

</script>

<template>
  <div class="breadcrumb-bar" :class="settingStore.theme">
    <!-- 图标 -->
    <div class="bar-icon">
      <i class="fa-solid fa-folder-open"></i>
    </div>

    <!-- 容器：根据模式切换显示 -->
    <div class="address-container" @click.self="enableEditMode">

      <!-- 模式 A: 面包屑显示 -->
      <div v-if="!isEditMode" class="breadcrumb-list">
        <div
            v-for="(crumb, index) in breadcrumbs"
            :key="crumb.path"
            class="crumb-item"
            :class="{ 'is-active': index === breadcrumbs.length - 1 }"
            @click.stop="handleBreadcrumbClick(crumb)"
        >
          <span class="crumb-text">{{ crumb.name }}</span>
          <span v-if="index < breadcrumbs.length - 1" class="crumb-separator">
            <i class="fa-solid fa-angle-right"></i>
          </span>
        </div>

        <!-- 剩余空白区域点击也能触发编辑 -->
        <div class="click-trigger" @click="enableEditMode"></div>
      </div>

      <!-- 模式 B: 输入框编辑 -->
      <div v-else class="path-input-wrapper">
        <el-input
            ref="inputRef"
            v-model="inputPath"
            class="path-input"
            @blur="disableEditMode"
            @keyup.enter="handlePathSubmit"
            @keyup.esc="disableEditMode"
        >
          <template #prefix>
            <i class="fa-solid fa-laptop-code" style="margin-left: 2px;"></i>
          </template>
        </el-input>
      </div>

    </div>

    <!-- 刷新按钮 (可选) -->
    <button class="refresh-btn" @click="homeStore.setUserDirectoryFileInfo(homeStore.currentFolder.Id)" title="刷新">
      <i class="fa-solid fa-rotate-right"></i>
    </button>
  </div>
</template>

<style scoped>
/* 容器样式 */
.breadcrumb-bar {
  display: flex;
  align-items: center;
  height: 40px;
  background-color: var(--bg-hover); /* 使用父级定义的变量，或者自己定义 */
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0 8px;

  transition: all 0.2s ease;
}

/* 聚焦/激活状态 */
.breadcrumb-bar:focus-within,
.breadcrumb-bar:hover {
  background-color: var(--main-content-bg);
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.1); /* 需要定义 accent-rgb */
}

/* 左侧图标 */
.bar-icon {
  color: var(--text-secondary);
  margin-right: 10px;
  font-size: 14px;
  display: flex;
  align-items: center;
}

/* 地址栏核心区域 */
.address-container {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: text; /* 提示用户可输入 */
  overflow: hidden;
  position: relative;
}

/* --- 面包屑模式 --- */
.breadcrumb-list {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
}

.crumb-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.2s;
  white-space: nowrap;
}

.crumb-item:hover {
  background-color: var(--bg-active);
}

.crumb-text {
  font-weight: 500;
}

/* 分隔符 */
.crumb-separator {
  margin: 0 4px;
  color: var(--text-secondary);
  font-size: 10px;
  display: flex; /* 防止对齐问题 */
  align-items: center;
}
.crumb-separator:hover {
  background: none; /* 分隔符本身不响应 hover 背景 */
}

/* 最后一个面包屑高亮 */
.crumb-item.is-active .crumb-text {
  font-weight: 600;
  color: var(--text-primary);
}

/* 填充剩余空间的点击触发器 */
.click-trigger {
  flex: 1;
  height: 100%;
}

/* --- 输入框模式 --- */
.path-input-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
}

.path-input {
  width: 100%;
  --el-input-border-color: transparent;
  --el-input-hover-border-color: transparent;
  --el-input-focus-border-color: transparent;
  --el-input-bg-color: transparent;
  height: 30px;
  font-size: 13px;
}
/* 去除 Element Input 自带的边框和阴影，使其融入地址栏 */
:deep(.el-input__wrapper) {
  box-shadow: none !important;
  padding: 0;
  background-color: transparent;
}
:deep(.el-input__inner) {
  color: var(--text-primary);
  font-family: Consolas, "Courier New", monospace; /* 输入路径时用等宽字体更专业 */
}

/* --- 刷新按钮 --- */
.refresh-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.refresh-btn i {
  transition: transform 0.4s ease;
}

.refresh-btn:active i {
  transform: rotate(360deg); /* 建议改为360度，顺时针转一圈效果更好 */
}

.refresh-btn:active {
  background-color: var(--bg-active);
}

@media (max-width: 640px) {
  .breadcrumb-bar {
    height: 38px;
    padding: 0 6px;
  }

  .crumb-item {
    font-size: 12px;
    max-width: 120px;
  }

  .crumb-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
