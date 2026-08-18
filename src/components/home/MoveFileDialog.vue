<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElDialog, ElButton, ElScrollbar, ElRadioGroup, ElRadio, ElMessage } from 'element-plus';
import Home from '@/store/home.ts';
import Setting from "@/store/setting.js";
import { FileApi } from "@/commands/file.js";
import { FileOrDirMoveInfo, FolderInfo } from "@/models/user_models";

// 接收 v-model 控制显示隐藏
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'success']);

const homeStore = Home();
const settingStore = Setting();

// --- 弹窗内部状态 ---
const targetFolderId = ref<string | null>(null);
const currentDialogFolderList = ref<FolderInfo[]>([]);

// --- 核心导航状态 ---
const currentViewingId = ref<string>("");
const currentViewingPathStr = ref<string>("/");

// 计算属性处理 v-model
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// --- 核心工具方法 ---

// 1. 加载文件列表
const loadFilesForDialog = async (folderId: string) => {
  try {
    currentDialogFolderList.value = []; // 清空显示 loading

    const res = await FileApi.GetUserDirectoryFileInfo(folderId);

    if (res.Status === 0 && res.Data && res.Data.Dirs) {
      // 过滤逻辑：
      // 1. 排除掉被选中的文件夹（不能把文件夹移到自己里面）
      // 2. 排除掉当前进入的文件夹自身（防止自己包含自己）
      // 3. 排除掉根目录（防止根目录出现在列表中）
      currentDialogFolderList.value = res.Data.Dirs.filter((f: FolderInfo) =>
          !homeStore.selectedFolders.some(selected => selected.Id === f.Id) &&
          f.Id !== folderId &&
          f.Id !== homeStore.rootFolder.Id
      );
    } else {
      if (res.Status !== 0) ElMessage.warning(res.Msg || "无法获取文件夹内容");
    }
  } catch (e) {
    console.error(e);
    ElMessage.error('无法加载目录');
  }
};

// 2. 通过路径字符串获取 ID
const getFolderIdByPath = async (pathStr: string): Promise<string | null> => {
  // 根目录特殊处理
  if (pathStr === '/' || pathStr === '') {
    return homeStore.rootFolder.Id;
  }

  try {
    const res = await homeStore.getPullPathToFolderId(pathStr);
    if (res.Status === 0 && res.Data) {
      return res.Data as string;
    }
  } catch (e) {
    console.error("获取路径ID失败", e);
  }
  return null;
};

// --- 初始化逻辑 ---
watch(() => props.modelValue, async (val) => {
  if (val) {
    // 初始化状态：从主界面当前状态开始
    if (homeStore.currentFolder) {
      currentViewingId.value = homeStore.currentFolder.Id;
      currentViewingPathStr.value = homeStore.currentPath || "/";
    } else {
      currentViewingId.value = homeStore.rootFolder.Id;
      currentViewingPathStr.value = "/";
    }

    // 【核心修复】：默认目标 ID 直接设为当前正在查看的目录 ID
    targetFolderId.value = currentViewingId.value;

    // 初始列表：直接复用 Store 数据 (优化体验)
    currentDialogFolderList.value = homeStore.FolderInfo.filter(f =>
        !homeStore.selectedFolders.some(selected => selected.Id === f.Id) &&
        f.Id !== homeStore.rootFolder.Id
    );
  }
});

// --- 导航操作 ---

// 1. 进入子目录
const enterDirectory = async (folder: FolderInfo) => {
  currentViewingId.value = folder.Id;

  // 更新路径字符串
  const parentPath = currentViewingPathStr.value === '/' ? '' : currentViewingPathStr.value;
  currentViewingPathStr.value = `${parentPath}/${folder.FolderName}`;

  // 【核心修复】：双击进入新目录后，默认把当前新目录设为移动目标
  targetFolderId.value = currentViewingId.value;

  await loadFilesForDialog(folder.Id);
};

// 2. 返回上一级
const goBackDirectory = async () => {
  if (currentViewingPathStr.value === '/' || currentViewingId.value === homeStore.rootFolder.Id) return;

  // 计算父级路径
  const lastSlashIndex = currentViewingPathStr.value.lastIndexOf('/');
  let newPath = currentViewingPathStr.value.substring(0, lastSlashIndex);
  if (newPath === '') newPath = '/';

  console.log(`正在返回上一级: ${currentViewingPathStr.value} -> ${newPath}`);

  // 获取父级 ID
  const parentId = await getFolderIdByPath(newPath);

  if (parentId) {
    // 更新状态
    currentViewingPathStr.value = newPath;
    currentViewingId.value = parentId;

    // 【核心修复】：返回上一级后，默认目标设为这个上一级目录
    targetFolderId.value = currentViewingId.value;

    // 加载列表
    if (parentId === homeStore.currentFolder?.Id) {
      currentDialogFolderList.value = homeStore.FolderInfo.filter(f =>
          !homeStore.selectedFolders.some(selected => selected.Id === f.Id) &&
          f.Id !== homeStore.rootFolder.Id
      );
    } else {
      await loadFilesForDialog(parentId);
    }
  } else {
    ElMessage.error("无法定位上级目录");
  }
};

// 确认移动
const handleConfirmMove = async () => {
  if (!targetFolderId.value) return;

  const fileIds = homeStore.selectedFiles.map(f => f.Id);
  const folderIds = homeStore.selectedFolders.map(f => f.Id);
  const info: FileOrDirMoveInfo = {
    folderIds: folderIds,
    fileIds: fileIds,
    newFolderId: targetFolderId.value
  }
  const res = await FileApi.MoveFileOrDir(info);

  if (res.Status === 0) {
    ElMessage.success('移动成功');

    // 判断是否在当前目录下进行的移动操作，如果是，刷新当前目录
    if (homeStore.currentFolder) {
      homeStore.setUserDirectoryFileInfo(homeStore.currentFolder.Id);
    } else {
      homeStore.setUserDirectoryFileInfo(homeStore.rootFolder.Id);
    }

    homeStore.clearSelection();
    visible.value = false;
    emit('success');
  } else {
    ElMessage.error('移动失败: ' + (res.Msg || res.Msg));
  }
};
</script>

<template>
  <el-dialog
      v-model="visible"
      title="移动到"
      width="600px"
      align-center
      :class="'action-dialog ' + settingStore.theme"
      append-to-body
  >
    <div class="move-dialog-layout">
      <!-- 左侧：待移动清单 -->
      <div class="move-source-list">
        <div class="list-header">待移动项目 ({{ homeStore.selectedFiles.length + homeStore.selectedFolders.length }})</div>
        <el-scrollbar>
          <div class="list-content">
            <div v-for="folder in homeStore.selectedFolders" :key="'f-'+folder.Id" class="mini-item">
              <i class="fa-solid fa-folder" style="color: #fdd835; margin-right:8px;"></i>
              <span class="text-truncate" :title="folder.FolderName">{{ folder.FolderName }}</span>
            </div>
            <div v-for="file in homeStore.selectedFiles" :key="'fil-'+file.Id" class="mini-item">
              <i :class="homeStore.getFileIconClass(file.FileName)"
                 :style="{color: homeStore.getFileIconColor(file.FileName)}"
                 style="margin-right:8px; width: 14px; text-align: center;"></i>
              <span class="text-truncate" :title="file.FileName">{{ file.FileName }}</span>
            </div>
          </div>
        </el-scrollbar>
      </div>

      <!-- 右侧：目标选择 -->
      <div class="move-target-box">
        <div class="target-header">
          <!-- 返回上级按钮 -->
          <el-button
              v-if="currentViewingId !== homeStore.rootFolder.Id && currentViewingPathStr !== '/'"
              size="small"
              link
              @click="goBackDirectory"
          >
            <i class="fa-solid fa-arrow-left"></i> 返回上级
          </el-button>

          <!-- 显示当前路径名称 -->
          <span class="current-path-title" :title="currentViewingPathStr">
            {{ currentViewingPathStr === '/' ? '根目录' : currentViewingPathStr.split('/').pop() }}
          </span>
        </div>

        <el-scrollbar class="target-list-container">
          <el-radio-group v-model="targetFolderId" class="folder-list-group">

            <div v-if="currentDialogFolderList.length === 0" class="empty-tip">
              此文件夹为空
            </div>

            <el-radio
                v-for="folder in currentDialogFolderList"
                :key="folder.Id"
                :label="folder.Id"
                size="large"
                border
                class="folder-radio-item"
            >
              <!-- 阻止冒泡，让双击生效进入目录 -->
              <div class="radio-content" @dblclick.stop.prevent="enterDirectory(folder)">
                <div class="folder-info">
                  <i class="fa-regular fa-folder folder-icon"></i>
                  <span class="fname">{{ folder.FolderName }}</span>
                </div>
                <!-- 提示图标 -->
                <i class="fa-solid fa-chevron-right enter-icon"></i>
              </div>
            </el-radio>
          </el-radio-group>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button
            type="primary"
            @click="handleConfirmMove"
            :disabled="!targetFolderId"
        >
          <!-- 动态提示，提升用户体验 -->
          移动到 {{ targetFolderId === currentViewingId ? '当前目录' : '选中的文件夹' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 保持之前的样式完全不变 */
.move-dialog-layout { display: flex; height: 400px; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; margin-top: 5px; }
.move-source-list { width: 200px; background-color: var(--bg-hover); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; }
.list-header { padding: 10px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); background-color: var(--main-content-bg); }
.list-content { padding: 10px; }
.mini-item { display: flex; align-items: center; font-size: 13px; margin-bottom: 8px; color: var(--text-primary); padding: 4px 6px; border-radius: 4px; }
.mini-item:hover { background-color: rgba(0,0,0,0.05); }
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.move-target-box { flex: 1; display: flex; flex-direction: column; background-color: var(--main-content-bg); }
.target-header { padding: 0 10px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px; height: 45px; flex-shrink: 0; }
.current-path-title { font-size: 14px; font-weight: bold; color: var(--text-primary); margin-left: 5px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.target-list-container { flex: 1; padding: 10px; }
.folder-list-group { display: flex; flex-direction: column; gap: 8px; }
.folder-radio-item { width: 100%; margin-right: 0 !important; margin-bottom: 0 !important; padding: 0 10px !important; height: auto !important; min-height: 40px; }
.folder-radio-item :deep(.el-radio__label) { flex: 1; padding-left: 0; width: 100%; }
.radio-content { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 0 10px 10px; }
.folder-info { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.folder-icon { font-size: 16px; color: #fdd835; }
.fname { font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.enter-icon { font-size: 12px; color: var(--text-secondary); opacity: 0; transition: opacity 0.2s; padding-left: 10px; }
.radio-content:hover .enter-icon { opacity: 1; color: var(--accent-color); }
.empty-tip { text-align: center; color: var(--text-secondary); margin-top: 50px; font-size: 13px; }
</style>
