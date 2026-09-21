<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { ElTabs, ElTabPane, ElDialog, ElMessage } from 'element-plus';
import Setting from "@/store/setting.js";
import Home from '@/store/home.ts';
import { UserApi } from "@/commands/user.ts";
import axios from 'axios';
import type {CustomView, FileInfo, FolderInfo} from "@/models/user_models";
import {FileApi} from "@/commands/file.js";
// --- 引入子组件 ---
import Sidebar from '@/components/home/Sidebar.vue';
import MainToolbar from '@/components/home/MainToolbar.vue';
import FileGrid from '@/components/home/FileGrid.vue';
import FileBreadcrumb from '@/components/home/FileBreadcrumb.vue';
import SettingsView from '@/components/home/SettingsView.vue';
import ImagePreview from '@/components/home/ImagePreview.vue';
import DocumentPreview from '@/components/home/DocumentPreview.vue';
import TextPreview from '@/components/home/TextPreview.vue';
import ShareDialog from '@/components/home/ShareDialog.vue';
import ShareManager from '@/components/home/ShareManager.vue';
import Statistics from '@/components/home/Statistics.vue';
import AudioPlayer from '@/components/home/AudioPlayer.vue';
import AiChat from '@/components/home/AiChat.vue';
import AdminDashboard from '@/components/home/AdminDashboard.vue';
import AdminUsers from '@/components/home/AdminUsers.vue';
import AdminFiles from '@/components/home/AdminFiles.vue';
import AdminSystem from '@/components/home/AdminSystem.vue';
import AdminLogs from "@/components/home/AdminLogs.vue";
import ExternalDriveView from '@/components/home/ExternalDriveView.vue';
import type { ExternalDriveAccount } from '@/commands/edrive';

/**
 * 初始化状态管理和常量
 */
const settingStore = Setting();
const homeStore = Home();
const isDataReady = ref(false);
//界面状态 (UI State)

const searchTerm = ref('');
const tab = ref('files'); // 'files' 或 'settings' 等
const propsDialogVisible = ref(false); // 属性弹窗
const currentPropItem = ref<FileInfo>({}); // 当前选中的文件属性

// 👇 新增：看板组件的引用，用于触发图表重绘
const adminDashboardRef = ref<InstanceType<typeof AdminDashboard> | null>(null);
const externalDriveViewRef = ref<InstanceType<typeof ExternalDriveView> | null>(null);
const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null);

// 文档预览状态
const docPreviewVisible = ref(false);
const docPreviewUrl = ref('');
const docPreviewFileName = ref('');
//图片预览状态
const imagePreviewVisible = ref(false);
const imagePreviewUrls = ref<string[]>([]);
// 文本预览所需的状态
const textPreviewVisible = ref(false);
const textPreviewUrl = ref('');
const textPreviewFileName = ref('');
// 进度条弹窗状态
const downloadProgressVisible = ref(false);
const downloadPercent = ref(0);
const downloadText = ref('');
// 3.3 业务数据 (Business Data) - 用于 MainToolbar 显示头像等
const user = ref({
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jone',
  name: '加载中...'
});
// --- 音频播放器状态 ---
const audioPlayerVisible = ref(false);
const currentAudioUrl = ref('');
const currentAudioName = ref('');
//分享界面
const shareDialogVisible = ref(false);
const shareTargetId = ref('');
const shareTargetName = ref('');
//搜索框
const searchIsVisible = ref(true);
const isSidebarOpen = ref(false);
const isMobileView = ref(false);
// 记录当前选中的自定义视图对象，如果为 null 则表示处于普通文件夹模式
const currentCustomView = ref<CustomView | null>(null);
// 5.1 API 交互逻辑 - 获取基础信息供 Toolbar 和 Theme 使用
const getUserInfo = async () => {
  try {
    const tmp = await UserApi.GetUserInfo();
    if (tmp.Status===0){
      settingStore.userInfo = tmp.Data;
      homeStore.customMenus =settingStore.userInfo.Preferences.CustomView || [];
      settingStore.refreshTheme();

      // 更新本地 user 对象供 Toolbar 使用
      if (tmp.Data) {
        user.value.name = tmp.Data.Nickname || tmp.Data.Username;
        // 如果 API 返回了头像 URL，在这里更新 user.value.avatarUrl
      }
    }else{
      ElMessage.error("获取用户失败："+tmp.Msg)
    }

  } catch (error) {
    console.error("Home: 获取用户信息失败:", error);
  }
};

// 5.2 导航逻辑
// 5.2 导航逻辑
const handleNavigation = (index:string) => {
  currentCustomView.value = null;
  switch (index) {
    case "我的文件":
      tab.value = 'files';
      searchIsVisible.value = true;
      searchTerm.value = ''; // 🌟 修复 1：顺手清空顶部的搜索输入框，体验更好
      homeStore.FilterFolderInfo =  homeStore.FolderInfo;
      homeStore.FilterFileInfo =  homeStore.FileInfo;
      homeStore.DirRefreshTimestamp = Date.now(); // 🌟 修复 2：更新时间戳，强制通知 FileGrid 重新渲染
      break;
    case "搜索":
      tab.value = 'files';
      searchIsVisible.value = false;
      homeStore.FilterFolderInfo =  homeStore.AiSearchFolderInfo;
      homeStore.FilterFileInfo =  homeStore.AiSearchFileInfo;
      homeStore.DirRefreshTimestamp = Date.now(); // 🌟 同步补充时间戳更新
      break;
    case "分享管理":
      tab.value = 'share';
      break;
    case "统计看板":
      tab.value = 'statistics';
      break;
    case "设置":
      tab.value = 'settings';
      break;
    case "外部网盘":
      tab.value = 'external';
      searchIsVisible.value = false;
      break;

      // ... 下方的管理员菜单逻辑保持不变
    case "主页看板":
      tab.value = 'admin-dashboard';
      searchIsVisible.value = false;
      nextTick(() => {
        adminDashboardRef.value?.resizeCharts();
      });
      break;
    case "用户管理":
      tab.value = 'admin-users';
      searchIsVisible.value = false;
      break;
    case "全局文件管理":
      tab.value = 'admin-files';
      searchIsVisible.value = false;
      break;
    case "系统设置":
      tab.value = 'admin-system';
      searchIsVisible.value = false;
      break;
    case "日志和重启":
      tab.value = 'admin-log';
      searchIsVisible.value = false;
      break;
  }

  homeStore.activeNavItem = index;
  if (isMobileView.value) {
    isSidebarOpen.value = false;
  }
};
// --- 处理侧边栏自定义视图的点击 ---
const handleViewSelect = async (view: CustomView) => {
  // 将关键词数组用逗号拼接成字符串
  const keywordsStr = (view.Keywords && view.Keywords.length > 0) ? view.Keywords.join(',') : '';

  // 1. 构造成新的 SearchInfo 对象格式
  const searchPayload = {
    Keyword: keywordsStr
  };

  // 2. 传入 payload 对象，并将 isAI 设为 false (因为这是精准匹配视图)
  const info = await FileApi.SearchFiles(searchPayload, false);

  if (info.Status === 0) {
    searchIsVisible.value = false;
    currentCustomView.value = view; // 记录当前视图对象
    homeStore.activeNavItem = view.Name; // 让侧边栏高亮显示视图名称

    homeStore.AiSearchFileInfo = info.Data.FileInfos;
    homeStore.FilterFolderInfo = null; // 自定义视图只显示文件
    homeStore.FilterFileInfo = homeStore.AiSearchFileInfo;

    homeStore.DirRefreshTimestamp = Date.now(); // 强制触发 FileGrid 渲染
    homeStore.CurrentPageIndex = 1;
    homeStore.TotalFileCount = info.Data.FileInfos.length;
    tab.value = 'files'; // 确保跳转到文件标签页
  } else {
    ElMessage.error(info.Msg);
  }
}

// --- 处理顶部的 AI 搜索 ---
// 注意：因为我们在 SearchBar.vue 里抛出的已经是 SearchInfo 对象了，所以这里直接接收 payload
const AISearch = async (searchPayload: any) => {
  handleNavigation("搜索")

  // 传入 payload 对象，并将 isAI 设为 true (如果是单纯的关键词搜索，也支持在这个对象里加参数)
  const info = await FileApi.SearchFiles(searchPayload, true);

  if (info.Status === 0) {
    homeStore.AiSearchFileInfo =  info.Data.FileInfos;
    homeStore.AiSearchFolderInfo= info.Data.Dirs;
    homeStore.FilterFolderInfo =  homeStore.AiSearchFolderInfo;
    homeStore.FilterFileInfo =  homeStore.AiSearchFileInfo;

    homeStore.DirRefreshTimestamp = Date.now(); // 强制触发 FileGrid 渲染
    homeStore.CurrentPageIndex = 1;
    homeStore.TotalFileCount = info.Data.FileInfos.length;
  } else {
    ElMessage.error(info.Msg);
  }
}
const refreshCurrentList = async () => {
  if (currentCustomView.value) {
    // 如果当前在自定义视图，重新执行视图搜索
    await handleViewSelect(currentCustomView.value);
  } else if (homeStore.activeNavItem === '搜索') {
    // 构造 Payload 对象，保证刷新也能用
    if (searchTerm.value) {
      await AISearch({ Keyword: searchTerm.value });
    }
  } else {
    // 普通文件夹模式
    await homeStore.setUserDirectoryFileInfo(homeStore.currentFolder.Id);
  }
};
//导航自定义过滤器
const customFilterClick=(item)=>{
  console.log(item);
}

const updateViewportState = () => {
  isMobileView.value = window.innerWidth <= 900;
  if (!isMobileView.value) {
    isSidebarOpen.value = false;
  }
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const closeSidebar = () => {
  isSidebarOpen.value = false;
};

const openExternalDriveAdd = () => {
  tab.value = 'external';
  homeStore.activeNavItem = '外部网盘';
  nextTick(() => externalDriveViewRef.value?.openAddDialog());
};

const openExternalDrive = async (drive: ExternalDriveAccount) => {
  tab.value = 'external';
  searchIsVisible.value = false;
  homeStore.activeNavItem = '外部网盘';
  await nextTick();
  await externalDriveViewRef.value?.openDrive(drive);
};

const refreshExternalDriveList = () => sidebarRef.value?.refreshExternalDrives();
const clearExternalDrive = (externalId: string) => externalDriveViewRef.value?.clearDrive(externalId);
//文件操作逻辑
// 文件操作逻辑
const handleOpenFile = async (item: FileInfo) => {
  console.log("准备打开文件:", item);
  // 检测是否支持打开
  if (!homeStore.checkFileExtension(item.FileName)) {
    ElMessage.warning(`暂不支持打开文件: ${item.FileName}`);
    return;
  }

  ElMessage.info(`正在准备预览: ${item.FileName}`);

  try {
    const info = await FileApi.GetFileDownLoadTempKey(item.Id);
    if (info.Status !== 0) {
      ElMessage.error(`获取预览密钥失败: ${info.Msg}`);
      return;
    }

    // 这是原始的远程 URL
    const remoteUrl = `${import.meta.env.VITE_APP_BASE_API}/Files/DownLoadKey/${info.Data}`;
    const ext = homeStore.getExtension(item.FileName)?.toLowerCase();

    // 🌟 1. 开启进度条弹窗
    downloadPercent.value = 0;
    downloadText.value = `正在下载 ${item.FileName} 的预览数据...`;
    downloadProgressVisible.value = true;

    // 🌟 2. 使用 Axios 主动下载文件流，并监听进度
    const response = await axios.get(remoteUrl, {
      responseType: 'blob', // 必须指定为 blob
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          // 计算百分比，保留到整数
          let percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          downloadPercent.value = percent;
        } else {
          // 如果后端没有返回 Content-Length，做一个假进度（比如卡在 99%）
          downloadPercent.value = 99;
        }
      }
    });

    // 🌟 3. 下载完成，将 Blob 转换为本地预览 URL
    const blob = response.data;
    const localBlobUrl = URL.createObjectURL(blob);

    // 🌟 4. 关闭进度条弹窗
    setTimeout(() => { downloadProgressVisible.value = false; }, 300); // 稍微延迟一下，让用户看到 100%

    // 🌟 5. 将生成的本地 URL (localBlobUrl) 分发给预览组件
    if (homeStore.previewConfig.image.includes(ext)) {
      imagePreviewUrls.value = [localBlobUrl];
      imagePreviewVisible.value = true;
    }
    else if (homeStore.previewConfig.doc.includes(ext)) {
      docPreviewUrl.value = localBlobUrl;
      docPreviewFileName.value = item.FileName;
      docPreviewVisible.value = true;
    }
    else if (homeStore.previewConfig.text.includes(ext)) {
      textPreviewUrl.value = localBlobUrl;
      textPreviewFileName.value = item.FileName;
      textPreviewVisible.value = true;
    }
        // 👇👇👇 新增：音频文件分支 👇👇👇
    // 如果你在 homeStore 里面配了 audio 数组就用前面的，如果没有配，我就加了一个 fallback 的数组兼容
    else if (homeStore.previewConfig.audio?.includes(ext) || ['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
      currentAudioUrl.value = localBlobUrl;
      currentAudioName.value = item.FileName;
      audioPlayerVisible.value = true;
    }
    // 👆👆👆 新增结束 👆👆👆
    else {
      ElMessage.warning(`暂无 [${ext}] 格式的预览组件`);
    }

  } catch (error) {
    downloadProgressVisible.value = false; // 出错时关闭进度条
    console.error("预览文件异常:", error);
    ElMessage.error("获取预览数据失败，网络异常或跨域被拦截");
  }
};

//文件夹操作逻辑
const handleOpenFolder = (item: FolderInfo) => {
  ElMessage.info(`正在进入文件夹 ${item.FolderName}`);
  if (homeStore.activeNavItem.value ==='搜索'){
    homeStore.activeNavItem.value='我的文件'
    searchIsVisible.value = true;
    homeStore.currentPath=item.FolderName
  }else{
    if (homeStore.currentPath.slice(-1)==='/'){
      homeStore.currentPath= homeStore.currentPath+item.FolderName
    }else{
      homeStore.currentPath= homeStore.currentPath+'/'+item.FolderName
    }
  }

  homeStore.setUserDirectoryFileInfo(item.Id);
  homeStore.clearSelection();


};
const handleFolderCommand =async ({ item, command, callback,newName}) => {
  console.log(newName);
  console.log(`对 [${item}] 执行命令: ${command}`);
  let info;
  switch (command) {
    case 'rename':
      info = await FileApi.RenameFileOrDir({Type:1,Id:item.Id,NewName:newName});
      if (info.Status===0){
        callback(true);
        ElMessage.success(`修改文件夹名称成功`);
        await refreshCurrentList();
      }else{
        callback(false);
        ElMessage.error(`修改名称失败:`+info.Msg);
      }
      break;
    case 'delete':
      info = await FileApi.DeleteUserFolder([item.Id]);
      if (info.Status===0){
        callback(true);
        ElMessage.success(`删除成功`);
        await refreshCurrentList();
      }else{
        callback(false);
        ElMessage.error(`删除失败:`+info.Msg);
      }
      break;
    default: console.warn('未知指令:', command);
  }
};
const handleFileCommand =async ({ item, command ,callback,newName}) => {
  console.log(`对 [${item.name}] 执行命令: ${command}`);
  let info;
  switch (command) {
    case 'open': handleOpenFile(item); break;
    case 'download': ElMessage.success(`开始下载: ${item.FileName}`);
      info = await FileApi.GetFileDownLoadTempKey(item.Id);
      if (info.Status===0){
        window.open(`${import.meta.env.VITE_APP_BASE_API}/Files/DownLoadKey/${info.Data}`)
      }else{
        callback(false);
        ElMessage.error(`下载失败:`+info.Msg);
      }
      break;
    case 'copy-link':
      const link = `${window.location.origin}/Files/DirectLink/${item.Id}`;
      // 1. 优先使用现代 Clipboard API (仅在 HTTPS 或 localhost 可用)
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(link)
            .then(() => ElMessage.success('直连链接已复制'))
            .catch(() => ElMessage.error('复制失败'));
      } else {
        // 2. 降级方案：使用传统 execCommand 兼容 HTTP 环境
        const textArea = document.createElement("textarea");
        textArea.value = link;

        // 避免出现滚动条及影响页面布局
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand('copy');
          if (successful) {
            ElMessage.success('直连链接已复制');
          } else {
            ElMessage.error('复制失败，请手动复制');
          }
        } catch (err) {
          console.error('Fallback: Oops, unable to copy', err);
          ElMessage.error('复制失败，浏览器不支持');
        }
        // 用完后移除该元素
        document.body.removeChild(textArea);
      }
      break;
    case 'properties':
      currentPropItem.value = item;
      propsDialogVisible.value = true;
      break;
    case 'rename':
      info = await FileApi.RenameFileOrDir({Type:0,Id:item.Id,NewName:newName});
      if (info.Status===0){
        callback(true);
        ElMessage.success(`修改文件名称成功`);
        await refreshCurrentList();
      }else{
        callback(false);
        ElMessage.error(`修改名称失败:`+info.Msg);
      }
      break;
    case 'move': ElMessage.info('触发移动文件逻辑'); break;
    case 'delete':
      info = await FileApi.DeleteUserFile([item.Id]);
      if (info.Status===0){
        callback(true);
        ElMessage.success(`删除成功`);
        await refreshCurrentList();
        homeStore.selectedFiles=homeStore.selectedFiles.filter(x=>x.Id!==item.Id)
      }else{
        callback(false);
        ElMessage.error(`删除失败:`+info.Msg);
      }
      break;
    case 'share':
      shareTargetId.value = item.Id;
      shareTargetName.value = item.FileName;
      shareDialogVisible.value = true;
      break;
    default: console.warn('未知指令:', command);
  }
};

//初始化
onMounted(async () => {
  updateViewportState();
  window.addEventListener('resize', updateViewportState);
  await getUserInfo();
  await homeStore.setFolderRoot()
  homeStore.setUserStorageCapacityInfo();
  homeStore.FileMaxUploadSizeLimit = settingStore.basicInfo.MaxFileSize;
  await homeStore.setUserDirectoryFileInfo(homeStore.rootFolder.Id);
  homeStore.currentFolder.Id=homeStore.rootFolder.Id;
  isDataReady.value = true;
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportState);
});
</script>

<template>
  <div class="file-manager-container" :data-theme="settingStore.theme">

    <div class="app-window" :class="{ 'mobile-layout': isMobileView, 'sidebar-open': isSidebarOpen }" v-if="isDataReady">
      <div v-if="isMobileView && isSidebarOpen" class="mobile-sidebar-mask" @click="closeSidebar"></div>
      <div class="sidebar-shell" :class="{ 'is-open': isSidebarOpen }">
        <Sidebar
            ref="sidebarRef"
            :active-nav-item="homeStore.activeNavItem"
            @navigate="handleNavigation"
            @custom-filter="customFilterClick"
            @selectView="handleViewSelect"
            @external-add="openExternalDriveAdd"
            @external-select="openExternalDrive"
            @external-deleted="clearExternalDrive"
            @close="closeSidebar"
        />
      </div>

      <main class="main-content">
        <MainToolbar
            :active-nav-item="homeStore.activeNavItem"
            :user="user"
            :is-mobile="isMobileView"
            v-model:searchTerm="searchTerm"
            @handleSearch="AISearch"
            @toggle-sidebar="toggleSidebar"
        />

        <el-tabs v-model="tab" class="main-tabs">
          <el-tab-pane name="files" class="content-pane">
            <div class="files-layout-container">
              <div class="breadcrumb-wrapper">
                <FileBreadcrumb v-show="searchIsVisible" />
              </div>
              <div class="scroll-area">
                <FileGrid title="文件夹" :type=0 @open-folder="handleOpenFolder" @file-command="handleFolderCommand"/>
                <FileGrid title="文件" :type=1 @open-file="handleOpenFile" @file-command="handleFileCommand" />
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane name="settings" class="content-pane">
            <SettingsView />
          </el-tab-pane>
          <el-tab-pane name="share" class="content-pane">
            <div class="scroll-area">
              <ShareManager />
            </div>
          </el-tab-pane>
          <el-tab-pane name="statistics" class="content-pane">
            <div class="scroll-area">
              <Statistics />
            </div>
          </el-tab-pane>
          <el-tab-pane name="external" class="content-pane">
            <div class="scroll-area">
              <ExternalDriveView
                  ref="externalDriveViewRef"
                  @drive-connected="refreshExternalDriveList"
                  @drive-list-changed="refreshExternalDriveList"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane name="admin-dashboard" class="content-pane" lazy>
            <div class="scroll-area">
              <AdminDashboard ref="adminDashboardRef" />
            </div>
          </el-tab-pane>
          <el-tab-pane name="admin-users" class="content-pane" lazy>
            <div class="scroll-area">
              <AdminUsers />
            </div>
          </el-tab-pane>
          <el-tab-pane name="admin-files" class="content-pane" lazy>
            <div class="scroll-area">
              <AdminFiles />
            </div>
          </el-tab-pane>
          <el-tab-pane name="admin-system" class="content-pane" lazy>
            <div class="scroll-area">
              <AdminSystem />
            </div>
          </el-tab-pane>
          <el-tab-pane name="admin-log" class="content-pane" lazy>
            <div class="scroll-area">
              <AdminLogs />
            </div>
          </el-tab-pane>

        </el-tabs>
      </main>
    </div>
    <div v-else class="global-loading">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>正在连接网盘，加载数据中...</span>
    </div>
    <el-dialog
        v-model="propsDialogVisible"
        title="属性详情"
        width="420px"
        :class="'custom-dialog ' + settingStore.theme"
        align-center
        append-to-body
    >
      <div class="props-content">
        <div class="props-header">
          <i :class="homeStore.getFileIconClass(currentPropItem.FileName) " :style="{color: homeStore.getFileIconColor(currentPropItem.FileName)}"></i>
          <div class="props-title">{{ currentPropItem.FileName }}</div>
        </div>
        <div class="props-list">
          <div class="prop-row">
            <span class="label">类型:</span>
            <span class="value">{{ homeStore.getFileTypeDetail(currentPropItem.FileName) }}</span>
          </div>
          <div class="prop-row">
            <span class="label">大小:</span>
            <span class="value">{{ homeStore.formatFileSize(currentPropItem.FileSizeInBytes)}}</span>
          </div>
          <div class="prop-row">
            <span class="label">位置:</span>
            <span class="value">{{ homeStore.currentPath }}</span>
          </div>
          <div class="prop-row">
            <span class="label">创建时间:</span>
            <span class="value">{{ currentPropItem.CreationTime }}</span>
          </div>
          <div class="prop-row">
            <span class="label">修改时间:</span>
            <span class="value">{{ currentPropItem.LastModifiedTime }}</span>
          </div>
          <div class="prop-row">
            <span class="label">GUID:</span>
            <span class="value code">{{ currentPropItem.Id }}</span>
          </div>
          <div class="prop-row">
            <span class="label">HASH256:</span>
            <span class="value code">{{ currentPropItem.FileHash }}</span>
          </div>
        </div>
      </div>
    </el-dialog>
    <ImagePreview
        v-model:visible="imagePreviewVisible"
        :url-list="imagePreviewUrls"
    />
    <DocumentPreview
        v-model:visible="docPreviewVisible"
        :url="docPreviewUrl"
        :file-name="docPreviewFileName"
    />
    <TextPreview
        v-model:visible="textPreviewVisible"
        :url="textPreviewUrl"
        :file-name="textPreviewFileName"
    />
    <el-dialog
        v-model="downloadProgressVisible"
        title="准备预览"
        width="400px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
        align-center
        append-to-body
    >
      <div style="text-align: center; padding: 20px 0;">
        <div style="margin-bottom: 15px; color: var(--text-primary);">
          {{ downloadText }}
        </div>
        <el-progress
            :percentage="downloadPercent"
            :stroke-width="18"
            striped
            striped-flow
            :duration="10"
        />
      </div>
    </el-dialog>
    <ShareDialog
        v-model="shareDialogVisible"
        :file-id="shareTargetId"
        :file-name="shareTargetName"
        @success="(data) => { console.log('分享生成成功，返回数据:', data) }"
    />
    <AudioPlayer
        v-model="audioPlayerVisible"
        :audio-url="currentAudioUrl"
        :file-name="currentAudioName"
    />
    <AiChat />
  </div>
</template>

<style scoped>
.global-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  height: 100%;
  width: 100%;
  color: var(--accent-color);
  font-size: 16px;
  font-weight: 500;
}
.global-loading i {
  font-size: 40px;
}
/* 此处保留所有的原生样式 (保持不变) */
.file-manager-container {
  /* 强调色 */
  --accent-color: #0078d4;
  --accent-hover: #106ebe;

  /* 💡 亮色主题：护眼与高对比度优化版 */
  --app-bg: #e3e8f0;
  --acrylic-base: rgba(248, 250, 252, 0.85);
  --sidebar-bg: transparent;
  --main-content-bg: #ffffff;
  --border-color: #dcdfe6;
  --text-primary: #1a1a1c;
  --text-secondary: #5c5f66;
  --bg-hover: rgba(0, 0, 0, 0.05);
  --bg-active: rgba(0, 0, 0, 0.09);
  --input-bg: #f0f2f5;

  /* 通用 */
  --glass-blur: blur(40px);
  --radius: 8px;
  --shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.12);

  background-color: var(--app-bg);
  height: 100vh;
  color: var(--text-primary);
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: "Segoe UI Variable", "Segoe UI", "Microsoft YaHei", sans-serif;
  transition: background-color 0.3s ease;
}

.file-manager-container[data-theme='dark'] {
  --app-bg: #111827;
  --acrylic-base: rgba(26, 35, 51, 0.6);
  --sidebar-bg: #131b2e;
  --main-content-bg: #182235;
  --border-color: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --bg-hover: rgba(255, 255, 255, 0.05);
  --bg-active: rgba(255, 255, 255, 0.08);
  --input-bg: #232d42;
  --shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.3);
}

.app-window {
  width: 95vw;
  height: 92vh;
  background-color: var(--acrylic-base);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow);
  display: flex;
  overflow: hidden;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
.sidebar-shell {
  display: flex;
  height: 100%;
  flex-shrink: 0;
}
* { box-sizing: border-box; }

/* --- 主布局样式 --- */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--main-content-bg);
  transition: background-color 0.3s ease;
}

/* --- Tabs 布局修复 --- */
.main-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 删掉了 height: 100%; */
  min-height: 0; /* 关键点：防止内容过长撑破 Flex 容器 */
}

.content-pane {
  flex: 1; /* 替代原来的 height: 100% */
  display: flex;
  flex-direction: column;
  min-height: 0; /* 关键点 */
}

.files-layout-container {
  flex: 1; /* 替代原来的 height: 100% */
  display: flex;
  flex-direction: column;
  min-height: 0; /* 关键点 */
  overflow: hidden;
}

/* --- 样式穿透 (Deep Selectors) --- */
:deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  display: flex;          /* 新增：让内部的 pane 也支持 flex 拉伸 */
  flex-direction: column; /* 新增 */
  min-height: 0;          /* 关键点 */
  border-top: none !important;
}

.breadcrumb-wrapper {
  padding: 10px 30px 0 30px;
  flex-shrink: 0;
}
.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 10px 30px 30px 30px;
}
.mobile-sidebar-mask {
  display: none;
}

/* --- 滚动条样式 --- */
.scroll-area::-webkit-scrollbar { width: 10px; }
.scroll-area::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.2); border-radius: 10px; border: 3px solid transparent; background-clip: content-box; }
.scroll-area::-webkit-scrollbar-thumb:hover { background-color: rgba(0, 0, 0, 0.4); }

/* --- 属性弹窗内容样式 --- */
.props-content {
  padding: 0 10px;
}
.props-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}
.props-header i {
  font-size: 50px;
  margin-bottom: 15px;
}
.props-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  word-break: break-all;
}
.prop-row {
  display: flex;
  margin-bottom: 12px;
  font-size: 0.9rem;
  align-items: flex-start;
}
.prop-row .label {
  width: 70px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.prop-row .value {
  flex: 1;
  color: var(--text-primary);
  word-break: break-all;
}
.prop-row .value.code {
  font-family: Consolas, monospace;
  background: var(--bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85rem;
}

/* --- 样式穿透 (Deep Selectors) --- */
:deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  border-top: none !important;
}
:deep(.el-tabs__header) {
  display: none !important;
}
:deep(.el-menu-item) {
  height: 40px; line-height: 40px; border-radius: var(--radius); margin-bottom: 4px; color: var(--text-primary); font-family: inherit; font-size: 14px; padding-left: 16px !important; position: relative; transition: background-color 0.2s ease;
}
:deep(.el-menu-item i) { width: 24px; font-size: 16px; margin-right: 12px; color: var(--text-secondary); transition: color 0.2s ease; }
:deep(.el-menu-item:hover) { background-color: var(--bg-hover); }
:deep(.el-menu-item.is-active) { background-color: var(--bg-active); font-weight: 600; color: var(--text-primary) !important; }
:deep(.el-menu-item.is-active i) { color: var(--accent-color); }
:deep(.el-menu-item.is-active::before) { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: 16px; width: 3px; background-color: var(--accent-color); border-radius: 2px; }

/* 适配 Element Dialog 的暗黑模式 */
:deep(.custom-dialog.dark) {
  background-color: #1d2129;
  --el-text-color-primary: #f9fafb;
  --el-dialog-title-font-color: #f9fafb;
}
:deep(.custom-dialog.dark .el-dialog__title) {
  color: #f9fafb;
}
</style>
<style>
/* === 全局样式补丁 === */

/* 1. 基础弹窗样式 (亮色模式) */
.custom-dialog {
  background-color: #fcfcfd !important;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);
}
/* 强制加深 Element 弹窗内部输入框的边框 */
.custom-dialog:not(.dark) .el-input__wrapper,
.custom-dialog:not(.dark) .el-textarea__inner {
  background-color: #f0f2f5 !important;
  box-shadow: 0 0 0 1px #dcdfe6 inset !important;
  transition: all 0.2s ease;
}

.custom-dialog:not(.dark) .el-input__wrapper.is-focus,
.custom-dialog:not(.dark) .el-textarea__inner:focus {
  background-color: #ffffff !important;
  box-shadow: 0 0 0 1px var(--accent-color) inset !important;
}
/* 2. 暗黑模式适配 (当 class 中包含 dark 时) */
.custom-dialog.dark {
  /* 显式指定暗色背景 */
  background-color: #1d2129 !important;
  border: 1px solid #374151;

  /* 修复文字颜色变量 */
  --el-text-color-primary: #f9fafb;
  --el-text-color-regular: #d1d5db;
  --el-dialog-title-font-color: #f9fafb;
}

/* 修复标题颜色 */
.custom-dialog.dark .el-dialog__title {
  color: #f9fafb !important;
}

/* 修复关闭按钮颜色 */
.custom-dialog.dark .el-dialog__headerbtn .el-dialog__close {
  color: #9ca3af;
}
.custom-dialog.dark .el-dialog__headerbtn:hover .el-dialog__close {
  color: #fff;
}

@media (max-width: 900px) {
  .file-manager-container {
    min-height: 100vh;
    height: auto;
    align-items: stretch;
    justify-content: flex-start;
    overflow: auto;
  }

  .app-window {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
    border: none;
  }

  .app-window.mobile-layout {
    position: relative;
  }

  .sidebar-shell {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(84vw, 320px);
    z-index: 30;
    transform: translateX(-100%);
    transition: transform 0.28s ease;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
    background-color: var(--main-content-bg);
  }

  .sidebar-shell.is-open {
    transform: translateX(0);
  }

  .mobile-sidebar-mask {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.42);
    z-index: 20;
  }

  .main-content {
    min-width: 0;
  }

  .breadcrumb-wrapper {
    padding: 10px 14px 0;
  }

  .scroll-area {
    padding: 10px 14px 20px;
  }

  .prop-row {
    flex-direction: column;
    gap: 4px;
  }

  .prop-row .label {
    width: auto;
  }
}
</style>
