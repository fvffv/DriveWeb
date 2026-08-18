  <script setup lang="ts">
  import {ref, computed} from 'vue';
  import Setting from "@/store/setting.js";
  import Home from '@/store/home.ts';
  import {
    ElPopover, ElDialog, ElRadioGroup, ElRadio, ElDropdown,
    ElDropdownMenu, ElDropdownItem, ElButton, ElMessage, ElInput, ElScrollbar
  } from 'element-plus';
  import 'element-plus/es/components/popover/style/css';
  import 'element-plus/es/components/dialog/style/css';
  import 'element-plus/es/components/radio/style/css';
  import 'element-plus/es/components/input/style/css';
  import 'element-plus/es/components/scrollbar/style/css';
  import {useRouter} from "vue-router";
  import UploadPanel from './UploadPanel.vue';
  import {FileApi} from "@/commands/file.js";
  import MoveFileDialog from './MoveFileDialog.vue';
  import type {FolderInfo} from "@/models/user_models";

  // 引入刚刚分离出来的搜索组件
  import SearchBar from './SearchBar.vue';

  let $router = useRouter();
  const settingStore = Setting();
  const homeStore = Home();

  const props = defineProps({
    activeNavItem: String,
    user: Object,
    searchTerm: String,
    isMobile: Boolean,
  });

  const emit = defineEmits(['update:searchTerm','handleSearch', 'toggle-sidebar']);
  const assetsApi = import.meta.env.VITE_APP_ASSETS_API;
  // --- 弹窗状态 ---
  const moveDialogVisible = ref(false);
  const deleteDialogVisible = ref(false);
  const newFolderDialogVisible = ref(false);
  const newFolderName = ref('');
  const isDeleting = ref(false);

  const openMoveDialog = () => {
    moveDialogVisible.value = true;
  };

  // --- “新建文件夹” 相关方法 ---
  const openNewFolderDialog = () => {
    newFolderName.value = '';
    newFolderDialogVisible.value = true;
  };
  const avatarBgUrl = computed(() => {
    const baseUrl = import.meta.env.VITE_APP_ASSETS_API;
    const avatarName = settingStore.userInfo?.AvatarUrl || 'default.jpg'; // 最好给个默认值防空指针
    return `${baseUrl}/avatar/${avatarName}`;
  });
  const handleCreateFolder = async () => {
    if (!newFolderName.value.trim()) {
      ElMessage.warning('请输入文件夹名称');
      return;
    }
    const jg = await FileApi.CreateFolder(homeStore.currentFolder.Id, newFolderName.value)

    if (jg.Status === 0) {
      ElMessage.success(`文件夹 "${newFolderName.value}" 创建成功`);
    } else {
      ElMessage.error(`文件夹 "${newFolderName.value}" 创建失败:` + jg.Msg);
    }
    homeStore.setUserDirectoryFileInfo(homeStore.currentFolder.Id)
    homeStore.selectedFolders.length = 0
    homeStore.selectedFiles.length = 0
    newFolderDialogVisible.value = false;
  };

  // --- “删除” 弹窗方法 ---
  const openDeleteDialog = () => {
    deleteDialogVisible.value = true;
  };

  const handleConfirmDelete = async () => {
    isDeleting.value = true;
    const fileIds = homeStore.selectedFiles.map(f => f.Id);
    const folderIds = homeStore.selectedFolders.map(f => f.Id);
    console.log('正在请求删除:', fileIds, folderIds);

    let res1 = { Status: -1 }, res2 = { Status: -1 };

    //删除文件
    if (fileIds.length !== 0) {
      res1 = await FileApi.DeleteUserFile(fileIds);
      if (res1.Status === 0) {
        ElMessage.success('文件删除成功');
        await homeStore.setUserDirectoryFileInfo(homeStore.currentFolder.Id);
        deleteDialogVisible.value = false;
      } else {
        ElMessage.error('文件删除失败: ' + res1.Msg);
      }
    }
    //删除文件夹
    if (folderIds.length !== 0) {
      res2 = await FileApi.DeleteUserFolder(folderIds);
      if (res2.Status === 0) {
        ElMessage.success('文件夹删除成功');
        await homeStore.setUserDirectoryFileInfo(homeStore.currentFolder.Id);
        deleteDialogVisible.value = false;
      } else {
        ElMessage.error('文件夹删除失败: ' + res2.Msg);
      }
    }

    if (res2.Status === 0 || res1.Status === 0) {
      homeStore.clearSelection();
      homeStore.setUserStorageCapacityInfo()
    }
    isDeleting.value = false;
  };

  // --- 搜索逻辑 ---
  const localSearchTerm = computed({
    get: () => props.searchTerm,
    set: (value) => emit('update:searchTerm', value),
  });
const handleSearch=(text)=>{
  emit('handleSearch', text);
}
  const logout = () => {
    settingStore.token = ""
    $router.push("/login")
    ElMessage.success('退出登陆成功')
  }
  </script>

  <template>
    <header class="toolbar">
      <div class="toolbar-title-row">
        <button v-if="isMobile" class="mobile-menu-btn" @click="emit('toggle-sidebar')">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div class="breadcrumb">{{ activeNavItem }}</div>
      </div>

      <!-- 批量操作按钮 -->
      <div class="batch-actions" v-if="homeStore.selectedFiles.length + homeStore.selectedFolders.length > 0">
        <span class="selected-count">已选 {{
            homeStore.selectedFiles.length + homeStore.selectedFolders.length
          }} 项</span>
        <button class="batch-btn move-btn" @click="openMoveDialog">
          <i class="fa-solid fa-folder-tree"></i> 移动
        </button>
        <button class="batch-btn delete-btn" @click="openDeleteDialog">
          <i class="fa-solid fa-trash-can"></i> 删除
        </button>
      </div>

      <!-- 右侧工具组 -->
      <div class="actions-group">

        <!-- 替换为独立的搜索组件 -->
        <SearchBar v-model="localSearchTerm" @handleSearch="handleSearch" />

        <!-- 新建文件夹按钮 -->
        <button class="action-btn" @click="openNewFolderDialog">
          <i class="fa-solid fa-folder-plus"></i> 新建文件夹
        </button>

        <!-- 上传 Popover -->
        <el-popover
            placement="bottom"
            :width="400"
            trigger="click"
            :popper-class="'upload-popper-container ' + settingStore.theme"
        >
          <template #reference>
            <button class="action-btn">
              <i class="fa-solid fa-cloud-arrow-up"></i> 上传
            </button>
          </template>
          <UploadPanel/>
        </el-popover>

        <!-- 主题切换 -->
        <button class="theme-toggle-btn" @click="settingStore.toggleTheme">
          <i v-if="settingStore.theme === 'light'" class="fa-solid fa-moon"></i>
          <i v-else class="fa-solid fa-sun"></i>
        </button>

        <!-- 用户菜单 -->
        <el-dropdown :popper-class="'file-menu-popper ' + settingStore.theme">
          <img class="user-avatar" :src="avatarBgUrl"></img>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="logout">退出登陆</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <!-- 其他 Dialog 代码保持不变 ... -->
    <el-dialog v-model="newFolderDialogVisible" title="新建文件夹" width="400px" align-center :class="'action-dialog ' + settingStore.theme" append-to-body>
      <div class="dialog-content" style="padding-top: 10px; padding-bottom: 10px;">
        <el-input v-model="newFolderName" placeholder="请输入文件夹名称" clearable @keyup.enter="handleCreateFolder" ref="folderInput"/>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="newFolderDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleCreateFolder">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <MoveFileDialog v-model="moveDialogVisible"></MoveFileDialog>

    <el-dialog v-model="deleteDialogVisible" title="删除确认" width="420px" align-center :class="'action-dialog ' + settingStore.theme" append-to-body :close-on-click-modal="!isDeleting" :show-close="!isDeleting">
      <div class="delete-dialog-content">
        <i class="fa-solid fa-triangle-exclamation warning-icon"></i>
        <div class="text-content">
          <h3>确认删除</h3>
          <p>您确定要删除选中的 {{ homeStore.selectedFiles.length + homeStore.selectedFolders.length }} 个项目吗？此操作将无法恢复。</p>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="deleteDialogVisible = false" :disabled="isDeleting">取消</el-button>
          <el-button type="danger" @click="handleConfirmDelete" :loading="isDeleting">确认删除</el-button>
        </span>
      </template>
    </el-dialog>
  </template>

  <style scoped>
  /* Toolbar 基础样式 */
  .toolbar {
    height: 60px;
    padding: 0 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    transition: border-color 0.3s ease;
  }

  .breadcrumb {
    font-size: 20px;
    font-weight: 600;
  }

  .toolbar-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .mobile-menu-btn {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: transparent;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }

  .actions-group {
    display: flex;
    gap: 15px;
    align-items: center;
  }

  /* 这里删除了 search 相关的 CSS，因为它已经被移动到了 SearchBar.vue 中 */

  .action-btn {
    background: var(--accent-color);
    color: #fff;
    border: none;
    padding: 8px 20px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .action-btn:hover {
    background: var(--accent-hover);
  }

  .theme-toggle-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 16px;
    padding: 6px;
    border-radius: 50%;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease, background-color 0.2s ease;
  }

  .theme-toggle-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #ccc;
    background-size: cover;
    cursor: pointer;
    object-fit: cover;
  }

  /* 批量操作按钮样式 */
  .batch-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    margin-right: 20px;
    background-color: var(--bg-hover);
    padding: 4px 10px;
    border-radius: 6px;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .selected-count {
    font-size: 13px;
    color: var(--text-secondary);
    margin-right: 5px;
    font-weight: 500;
  }

  .batch-btn {
    border: 1px solid transparent;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .move-btn {
    background-color: transparent;
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  .move-btn:hover {
    background-color: var(--bg-active);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .delete-btn {
    background-color: transparent;
    color: #f56c6c;
    border-color: rgba(245, 108, 108, 0.3);
  }

  .delete-btn:hover {
    background-color: #fef0f0;
    border-color: #f56c6c;
  }

  /* 删除弹窗内容样式 */
  .delete-dialog-content {
    display: flex;
    align-items: flex-start;
    gap: 20px;
  }

  .warning-icon {
    font-size: 24px;
    color: #e6a23c;
    margin-top: 5px;
  }

  .text-content h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px;
  }

  .text-content p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  @media (max-width: 900px) {
    .toolbar {
      height: auto;
      min-height: 60px;
      padding: 12px 14px;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }

    .breadcrumb {
      font-size: 18px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .batch-actions {
      order: 3;
      width: 100%;
      margin: 0;
      flex-wrap: wrap;
      justify-content: space-between;
    }

    .actions-group {
      order: 2;
      width: 100%;
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      gap: 10px;
      align-items: center;
    }

    .action-btn {
      padding: 8px 12px;
      justify-content: center;
      white-space: nowrap;
    }
  }

  @media (max-width: 640px) {
    .actions-group {
      grid-template-columns: 1fr 1fr;
    }

    .theme-toggle-btn,
    .user-avatar {
      justify-self: end;
    }

    .action-btn {
      width: 100%;
    }
  }
  </style>

  <style>
  /* ... 全局样式保持不变 ... */
  </style>
