<script setup lang="ts">
import { computed, ref, type PropType } from 'vue';
import {
  ElDropdown, ElDropdownMenu, ElDropdownItem, ElTooltip,
  ElDialog, ElButton, ElInput
} from 'element-plus';
import 'element-plus/es/components/tooltip/style/css';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/input/style/css'; // 新增 Input 样式
import Setting from "@/store/setting.js";
import type { FileInfo, FolderInfo } from "@/models/user_models";
import Home from "@/store/home";

const homeStore = Home();
const settingStore = Setting();

// --- 1. Props & Emits ---
const props = defineProps({
  item: {
    type: Object as PropType<FileInfo | FolderInfo>,
    required: true
  },
  type: Number,
  isSelected: { type: Boolean, default: false },
});

const emit = defineEmits(['toggle-select', 'open-file', 'file-command']);

// --- 2. Local State ---
const deleteDialogVisible = ref(false); // 控制删除弹窗显示
const isDeleting = ref(false);          // 控制确认按钮的 Loading 状态

const renameDialogVisible = ref(false); // 控制重命名弹窗显示
const isRenaming = ref(false);          // 控制重命名按钮的 Loading 状态
const newName = ref("");                // 绑定的新名称

// --- === 新增：缩略图相关状态 === ---
const imageLoadFailed = ref(false);     // 图片是否加载失败

// 判断是否为文件夹
const isFolder = computed(() => {
  return props.type === 0;
});

// 获取当前文件/文件夹名称
const currentName = computed(() => {
  return isFolder.value ? (props.item as FolderInfo).FolderName : (props.item as FileInfo).FileName;
});

// --- === 新增：缩略图相关计算属性 === ---
// 判断是否为常见图片格式
const isImage = computed(() => {
  if (isFolder.value) return false;
  const ext = currentName.value.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext);
});

// 拼接缩略图请求地址
const imageUrl = computed(() => {
  if (isFolder.value || !isImage.value) return '';
  const fileInfo = props.item as FileInfo;
  // 确保 FileHash 存在
  if (!fileInfo.FileHash) return '';
  return `${import.meta.env.VITE_APP_ASSETS_API}/imgcomp/${fileInfo.FileHash}.jpg`;
});


// --- 3. Handlers ---
// 处理下拉菜单命令
const handleCommand = (command: string) => {
  if (command === 'delete') {
    deleteDialogVisible.value = true;
  } else if (command === 'rename') {
    newName.value = currentName.value;
    renameDialogVisible.value = true;
  } else {
    emit('file-command', { item: props.item, command: command });
  }
};

// 确认删除逻辑
const confirmDelete = () => {
  isDeleting.value = true;
  emit('file-command', {
    item: props.item,
    command: 'delete',
    callback: (success: boolean, msg?: string) => {
      if (!success) {
        isDeleting.value = false;
      } else {
        deleteDialogVisible.value = false;
        isDeleting.value = false;
      }
    }
  });
};

// 确认重命名逻辑
const confirmRename = () => {
  if (!newName.value.trim() || newName.value === currentName.value) {
    renameDialogVisible.value = false;
    return;
  }

  isRenaming.value = true;
  emit('file-command', {
    item: props.item,
    command: 'rename',
    callback: (success: boolean, msg?: string) => {
      if (!success) {
        isRenaming.value = false;
      } else {
        renameDialogVisible.value = false;
        isRenaming.value = false;
      }
    },
    newName: newName.value.trim(),
  });
};

// --- === 新增：缩略图加载失败处理 === ---
const handleImageError = () => {
  imageLoadFailed.value = true; // 加载失败后回退到默认图标
};

</script>

<template>
  <div
      class="file-item"
      :class="{ 'is-selected': isSelected }"
      @dblclick="emit('open-file')"
  >
    <!-- 选择勾选框 -->
    <div class="select-check" @click.stop="emit('toggle-select')">
      <i v-if="isSelected" class="fa-solid fa-check check-icon"></i>
    </div>

    <!-- 右键/更多菜单 -->
    <el-dropdown
        class="more-actions-dropdown"
        trigger="click"
        @command="handleCommand"
        @click.stop
        :popper-class="'file-menu-popper ' + settingStore.theme"
    >
      <button class="more-actions-btn" @click.stop>
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </button>

      <template #dropdown>
        <el-dropdown-menu>
          <!-- === 文件夹专属菜单 === -->
          <template v-if="isFolder">
            <el-dropdown-item command="rename" >
              <template #icon><i class="fa-solid fa-pen-to-square"></i></template>重命名
            </el-dropdown-item>
            <el-dropdown-item command="delete" divided class="delete-item">
              <template #icon><i class="fa-solid fa-trash-can"></i></template>删除
            </el-dropdown-item>
          </template>

          <!-- === 文件专属菜单 === -->
          <template v-else>
            <el-dropdown-item command="open" v-if="homeStore.checkFileExtension(props.item.FileName)">
              <template #icon ><i class="fa-regular fa-eye"></i></template>打开
            </el-dropdown-item>
            <el-dropdown-item command="download">
              <template #icon><i class="fa-solid fa-download"></i></template>下载
            </el-dropdown-item>
            <el-dropdown-item command="copy-link">
              <template #icon><i class="fa-solid fa-link"></i></template>复制直连地址
            </el-dropdown-item>
            <el-dropdown-item command="share">
              <template #icon><i class="fa-solid fa-share-nodes"></i></template>分享
            </el-dropdown-item>
            <el-dropdown-item command="rename" divided>
              <template #icon><i class="fa-solid fa-pen-to-square"></i></template>重命名
            </el-dropdown-item>
            <el-dropdown-item command="properties">
              <template #icon><i class="fa-solid fa-circle-info"></i></template>属性
            </el-dropdown-item>
            <el-dropdown-item command="delete" divided class="delete-item">
              <template #icon><i class="fa-solid fa-trash-can"></i></template>删除
            </el-dropdown-item>
          </template>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 文件夹 -->
    <template v-if="isFolder">
      <div class="icon-box" style="color: #fdd835">
        <i class="fa-solid fa-folder"></i>
      </div>
      <el-tooltip
          effect="dark"
          :content="currentName"
          placement="bottom"
          :show-after="500"
      >
        <div class="item-name">{{ currentName }}</div>
      </el-tooltip>
      <div class="item-date">{{homeStore.formatShortDate(item.CreationTime)}}</div>
    </template>

    <!-- 文件 -->
    <template v-else>
      <!-- === 修改点：增加图片判定逻辑 === -->
      <!-- 如果是图片且没有加载失败，显示缩略图 -->
      <div v-if="isImage && !imageLoadFailed" class="img-box">
        <img :src="imageUrl" @error="handleImageError" alt="thumbnail" class="thumbnail-img" />
      </div>

      <!-- 如果不是图片，或者图片加载失败，显示原有的默认图标 -->
      <div v-else class="icon-box" :style="{ color: homeStore.getFileIconColor(currentName) }">
        <i :class="homeStore.getFileIconClass(currentName)"></i>
      </div>

      <el-tooltip
          effect="dark"
          :content="currentName"
          placement="bottom"
          :show-after="500"
      >
        <div class="item-name">{{ currentName }}</div>
      </el-tooltip>
      <div class="item-date">{{ homeStore.formatShortDate(item.CreationTime) }}</div>
    </template>

    <!-- 重命名弹窗 -->
    <el-dialog
        v-model="renameDialogVisible"
        title="重命名"
        width="400px"
        align-center
        destroy-on-close
        append-to-body
        :class="'action-dialog ' + settingStore.theme"
    >
      <div class="rename-content">
        <el-input
            v-model="newName"
            placeholder="请输入新名称"
            clearable
            @keyup.enter="confirmRename"
            autofocus
        ></el-input>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="renameDialogVisible = false" :disabled="isRenaming">取消</el-button>
          <el-button
              type="primary"
              @click="confirmRename"
              :loading="isRenaming"
              :disabled="!newName.trim() || newName === currentName"
          >
            确认
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 原有：删除确认弹窗 -->
    <el-dialog
        v-model="deleteDialogVisible"
        title="确认删除"
        width="400px"
        align-center
        destroy-on-close
        append-to-body
        :class="'action-dialog ' + settingStore.theme"
    >
      <div class="delete-confirm-content">
        <i class="fa-solid fa-triangle-exclamation warning-icon"></i>
        <div class="warning-text">
          <p class="main-warn">确定要删除 "{{ currentName }}" 吗？</p>
          <p class="sub-warn">此操作将无法撤销，文件将被永久删除。</p>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="deleteDialogVisible = false" :disabled="isDeleting">取消</el-button>
          <el-button
              type="danger"
              @click="confirmDelete"
              :loading="isDeleting"
          >
            确认删除
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* File Item 基础样式 */
.file-item {
  position: relative;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 20px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: default;
  transition: all 0.2s ease-in-out;
  user-select: none;
}
.file-item:hover { background-color: var(--bg-hover); border-color: var(--border-color); }
.file-item.is-selected { background-color: var(--bg-active); border-color: color-mix(in srgb, var(--accent-color), transparent 70%); }
.file-item.is-selected:hover { background-color: color-mix(in srgb, var(--bg-active), #000 5%); }

.icon-box {
  font-size: 42px;
  margin-bottom: 14px;
  transition: transform 0.2s;
}
.file-item:hover .icon-box { transform: scale(1.05); }

/* === 新增：缩略图容器样式 === */
.img-box {
  width: 46px;
  height: 46px;
  margin-bottom: 10px;
  transition: transform 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.file-item:hover .img-box { transform: scale(1.05); }

/* === 新增：缩略图图片样式 === */
.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 保证图片不变形且填满容器 */
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1); /* 加一点淡淡的阴影提升质感 */
}

.item-name {
  font-size: 13px;
  color: var(--text-primary);
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 4px;
  cursor: help;
}

.item-date { font-size: 11px; color: var(--text-secondary); margin-top: 6px; }

/* 勾选框 */
.select-check {
  position: absolute; top: 8px; left: 8px;
  width: 20px; height: 20px;
  border: 1px solid var(--border-color);
  background-color: var(--main-content-bg);
  border-radius: 5px;
  z-index: 2;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
}
.file-item:hover .select-check, .file-item.is-selected .select-check { opacity: 1; }
.file-item.is-selected .select-check { border-color: var(--accent-color); background-color: var(--accent-color); }
.check-icon { color: #fff; font-size: 12px; }

/* 更多菜单按钮 */
.more-actions-dropdown {
  position: absolute; top: 8px; right: 8px;
  z-index: 2; opacity: 0; transition: opacity 0.2s ease;
}
.file-item:hover .more-actions-dropdown { opacity: 1; }
.more-actions-btn {
  background-color: var(--main-content-bg);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 6px;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.more-actions-btn:hover { background-color: var(--bg-hover); color: var(--accent-color); }

/* 删除弹窗内容样式 */
.delete-confirm-content {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 10px 0;
}
.warning-icon {
  font-size: 24px;
  color: #e6a23c;
  margin-top: 2px;
}
.warning-text {
  flex: 1;
}
.main-warn {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
  line-height: 1.4;
  word-break: break-all;
}
.sub-warn {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

/* 重命名弹窗内容样式 */
.rename-content {
  padding: 10px 0 20px 0;
}

@media (max-width: 640px) {
  .file-item {
    padding: 16px 8px 14px;
  }

  .icon-box {
    font-size: 36px;
    margin-bottom: 10px;
  }

  .img-box {
    width: 40px;
    height: 40px;
  }

  .select-check,
  .more-actions-dropdown {
    opacity: 1;
  }
}
</style>

<style>
/* 全局 Menu 样式 */
.file-menu-popper {
  --menu-bg: #ffffff;
  --menu-border: #e4e7ed;
  --menu-text: #606266;
  --menu-hover-bg: #ecf5ff;
  --menu-hover-text: #409eff;
  --menu-divider: #ebeef5;
}
.file-menu-popper.dark {
  --menu-bg: #1d2129;
  --menu-border: #414243;
  --menu-text: #E5EAF3;
  --menu-hover-bg: #2b2f3a;
  --menu-hover-text: #409eff;
  --menu-divider: #4C4D4F;
}

.el-popper.file-menu-popper {
  background: var(--menu-bg) !important;
  border: 1px solid var(--menu-border) !important;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15) !important;
}

.file-menu-popper .el-popper__arrow::before {
  background: var(--menu-bg) !important;
  border: 1px solid var(--menu-border) !important;
}

.file-menu-popper .el-dropdown-menu {
  background-color: transparent !important;
  padding: 6px 0 !important;
}

.file-menu-popper .el-dropdown-menu__item {
  color: var(--menu-text) !important;
  font-size: 13px !important;
  padding: 8px 20px !important;
}

.file-menu-popper .el-dropdown-menu__item:not(.is-disabled):hover {
  background-color: var(--menu-hover-bg) !important;
  color: var(--menu-hover-text) !important;
}

.file-menu-popper .el-dropdown-menu__item--divided {
  border-top-color: var(--menu-divider) !important;
}

.file-menu-popper .delete-item {
  color: #f56c6c !important;
}

.file-menu-popper .delete-item:hover {
  background-color: rgba(245, 108, 108, 0.1) !important;
  color: #f56c6c !important;
}

.file-menu-popper .fa-solid, .file-menu-popper .fa-regular {
  margin-right: 10px;
  width: 16px;
  text-align: center;
}

/* 弹窗暗色模式适配 */
.action-dialog.dark {
  background-color: #1d2129;
  border: 1px solid #414243;
  --el-text-color-primary: #E5EAF3;
  --el-text-color-regular: #A3A6AD;
}

.action-dialog.dark .el-dialog__title { color: #E5EAF3; }
.action-dialog.dark .el-input__wrapper {
  background-color: #2b2f3a;
  box-shadow: 0 0 0 1px #414243 inset;
}
.action-dialog.dark .el-input__inner { color: #E5EAF3; }
</style>
