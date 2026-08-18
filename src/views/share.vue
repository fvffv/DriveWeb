<template>
  <div class="share-container" :data-theme="settingStore.theme">

    <!-- 流动渐变光斑背景 -->
    <div class="blob-container">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <!-- 主题切换按钮 -->
    <button class="theme-toggle-btn" @click="settingStore.toggleTheme()" aria-label="切换主题">
      <i v-if="settingStore.theme === 'light'" class="fa-solid fa-moon"></i>
      <i v-else class="fa-solid fa-sun"></i>
    </button>

    <!-- 1. 加载中状态 -->
    <div v-if="pageStatus === 'loading'" class="status-window">
      <i class="fa-solid fa-spinner fa-spin loading-icon"></i>
      <p>正在获取分享信息，请稍候...</p>
    </div>

    <!-- 2. 错误/失效状态 -->
    <div v-else-if="pageStatus === 'error'" class="status-window error-window">
      <i class="fa-solid fa-link-slash error-icon"></i>
      <h2>分享链接出了点问题</h2>
      <p class="error-msg">{{ errorMessage }}</p>
      <button class="back-home-btn" @click="goHome">返回首页</button>
    </div>

    <!-- 3. 正常显示状态 (采用左右布局) -->
    <div v-else-if="pageStatus === 'success'" class="share-wrapper">

      <!-- 左侧：文件信息与下载操作 -->
      <div class="share-window">
        <!-- 分享者信息 -->
        <header class="sharer-info">
          <img :src="sharer.avatarUrl" alt="分享者头像" class="sharer-avatar">
          <div class="sharer-details">
            <span class="sharer-name">{{ sharer.name }}</span>
            <span class="sharer-action">分享了一个文件给您</span>
          </div>
          <!-- 标志：如果是加密分享，右上角显示一把小锁 -->
          <div v-if="share.isEncrypted" class="encrypted-badge" title="私密分享">
            <i class="fa-solid fa-lock"></i>
          </div>
        </header>

        <!-- 文件核心信息 -->
        <main class="file-info">
          <div class="file-icon">
            <i :class="file.icon" :style="{ color: file.iconColor }"></i>
          </div>
          <h1 class="file-name" :title="file.name">{{ file.name }}</h1>
          <p class="file-meta">{{ file.type }} · {{ file.size }}</p>
        </main>

        <!-- 下载与附加信息 -->
        <footer class="actions-footer">
          <!-- 触发下载的按钮 -->
          <button class="download-btn" @click="handleDownloadClick" :disabled="isDownloading">
            <i v-if="isDownloading" class="fa-solid fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-download"></i>
            <span>{{ isDownloading ? '准备下载中...' : '下载文件' }}</span>
          </button>

          <div class="extra-info">
            <div class="qr-code">
              <qrcode-vue
                  :value="share.qrCodeUrl"
                  :size="80"
                  level="M"
                  :background="settingStore.theme === 'dark' ? '#182235' : '#ffffff'"
                  :foreground="settingStore.theme === 'dark' ? '#f9fafb' : '#1f2937'"
              />
              <span>手机扫码</span>
            </div>
            <div class="expiry-info">
              <i class="fa-regular fa-clock"></i>
              <span>到期时间: {{ share.expiresIn }}</span>
            </div>
          </div>
        </footer>
      </div>

      <!-- 右侧：文件介绍面板 (有 introduction 且不为空时显示) -->
      <div v-if="share.introduction" class="intro-window">
        <div class="intro-header">
          <i class="fa-regular fa-comment-dots"></i>
          <span>分享者留言</span>
        </div>
        <div class="intro-content">
          <p>{{ share.introduction }}</p>
        </div>
      </div>

    </div>

    <!-- 提取码输入弹窗 (利用 Element Plus 的 Dialog) -->
    <el-dialog
        v-model="passwordDialogVisible"
        title="需要提取码"
        width="380px"
        align-center
        append-to-body
        :class="'custom-dialog share-dialog ' + settingStore.theme"
    >
      <div class="password-dialog-content">
        <p class="pwd-tip">该分享文件被加密，请输入提取码进行下载。</p>
        <el-input
            v-model="inputPassword"
            placeholder="请输入提取码"
            prefix-icon="Lock"
            show-password
            @keyup.enter="submitPasswordAndDownload"
        />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="passwordDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitPasswordAndDownload" :loading="isDownloading">
            确定并下载
          </el-button>
        </span>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElDialog, ElInput, ElButton } from 'element-plus';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/button/style/css';
import Setting from "@/store/setting.js";
import {FileApi} from "@/commands/file.js";
import {ShareDetailInfo} from  "@/models/user_models"
import QrcodeVue from 'qrcode.vue';
import Home from "@/store/home";

// --- 状态管理 ---
const settingStore = Setting();
const homeStore = Home();
const route = useRoute();
const router = useRouter();

// 页面主要状态
const pageStatus = ref('loading'); // 'loading' | 'error' | 'success'
const errorMessage = ref('');

// --- 数据模型 ---
const sharer = ref({ name: '', avatarUrl: '' });
const file = ref({ name: '', size: '', type: '', icon: '', iconColor: '' });
const share = ref({
  expiresIn: '',
  qrCodeUrl: '',
  introduction: '',
  isEncrypted: false // 核心字段：标记该分享是否需要密码
});

// --- 下载与密码状态 ---
const passwordDialogVisible = ref(false);
const inputPassword = ref('');
const isDownloading = ref(false);
let currentShareId = '';

// --- 方法 ---

// 1. 获取分享界面的基础信息
const fetchShareInfo = async (shareId) => {
  pageStatus.value = 'loading';
  currentShareId = shareId;

  try {
    const res = await FileApi.GetShareInfo(shareId);
    if (res.Status===0){
      const mockRes:ShareDetailInfo = res.Data;
      sharer.value = {
        name: mockRes.Nickname,
        avatarUrl: `${import.meta.env.VITE_APP_ASSETS_API}/avatar/${mockRes.AvatarUrl}`
      };
      file.value = {
        name: mockRes.Name,
        size: homeStore.formatFileSize(mockRes.SizeInBytes),
        type: homeStore.getExtension(mockRes.Name),
        icon: homeStore.getFileIconClass(mockRes.Name),
        iconColor: homeStore.getFileIconColor(mockRes.Name)
      };
      share.value = {
        expiresIn: mockRes.EndValidity,
        introduction: mockRes.Introduction,
        isEncrypted: mockRes.IsPassword,
        qrCodeUrl: window.location.href
      };
      pageStatus.value = 'success';
    }else{
      errorMessage.value = res.Msg;
      pageStatus.value = 'error';
    }

  } catch (error) {
    console.error("获取分享信息失败:", error);
    errorMessage.value = '网络异常或分享已取消';
    pageStatus.value = 'error';
  }
};

// 2. 用户点击页面主按钮“下载文件”
const handleDownloadClick = () => {
  if (share.value.isEncrypted) {
    // 如果有密码，清空输入框并弹窗
    inputPassword.value = '';
    passwordDialogVisible.value = true;
  } else {
    // 没密码直接发请求下载
    executeDownload('');
  }
};

// 3. 提交密码并触发最终下载逻辑
const submitPasswordAndDownload = () => {
  if (!inputPassword.value.trim()) {
    ElMessage.warning('请输入提取码');
    return;
  }
  executeDownload(inputPassword.value.trim());
};

// 4. 执行真实下载 API
const executeDownload = async (password) => {
  isDownloading.value = true;

  try {
    console.log(`正在请求下载 -> ShareId: ${currentShareId}, Password: ${password}`);


    const res = await FileApi.GetShareTempDownLoadKey(currentShareId, password);



    if (res.Status === 0) {
      ElMessage.success('正在下载..');
      passwordDialogVisible.value = false; // 关闭弹窗
      window.open(`${import.meta.env.VITE_APP_BASE_API}/Files/DownLoadKey/${res.Data}`);
    } else {
      ElMessage.error(res.Msg);
    }
  } catch (error) {
    console.error("下载请求异常", error);
    ElMessage.error('下载失败，请稍后重试');
  } finally {
    isDownloading.value = false;
  }
};

const goHome = () => router.push('/');

onMounted(() => {
  const shareId = route.params.shareId;
  if (!shareId) {
    errorMessage.value = '分享链接不合法';
    pageStatus.value = 'error';
    return;
  }
  fetchShareInfo(shareId);
});
</script>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');

/* --- 主题与基础样式 --- */
.share-container {
  --accent-color: #0078d4;
  --accent-hover: #106ebe;
  --app-bg: #f3f5f9;
  --acrylic-base: rgba(252, 252, 252, 0.7);
  --border-color: #eef0f3;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.15);
  --bg-hover: rgba(0, 0, 0, 0.04);
  --blob-color-1: #a7f3d0;
  --blob-color-2: #bae6fd;
  --blob-color-3: #fbcfe8;

  &[data-theme='dark'] {
    --app-bg: #111827;
    --acrylic-base: rgba(26, 35, 51, 0.7);
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.3);
    --bg-hover: rgba(255, 255, 255, 0.05);
    --blob-color-1: #0d3446;
    --blob-color-2: #221b44;
    --blob-color-3: #3a193f;
  }

  --glass-blur: blur(25px);
  --radius: 12px;

  background-color: var(--app-bg);
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei', sans-serif;
  transition: background-color 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* --- 流动渐变光斑 --- */
.blob-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; filter: blur(100px); opacity: 0.8; pointer-events: none;}
.blob { position: absolute; border-radius: 50%; mix-blend-mode: screen; animation: blob-move 30s infinite alternate; transition: background-color 0.5s ease; }
.blob-1 { width: 450px; height: 450px; background-color: var(--blob-color-1); top: -150px; left: -150px; }
.blob-2 { width: 350px; height: 350px; background-color: var(--blob-color-2); top: -100px; right: -100px; animation-duration: 25s; animation-delay: -10s; }
.blob-3 { width: 400px; height: 400px; background-color: var(--blob-color-3); bottom: -200px; left: 20%; animation-duration: 35s; animation-delay: -5s; }
@keyframes blob-move {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30vw, -20vh) scale(1.2); }
  66% { transform: translate(-25vw, 15vh) scale(0.8); }
  100% { transform: translate(0, 0) scale(1); }
}

/* --- 主题切换按钮 --- */
.theme-toggle-btn { position: absolute; top: 30px; right: 40px; z-index: 2; background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 16px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
.theme-toggle-btn:hover { background-color: var(--bg-hover); color: var(--text-primary); border-color: var(--accent-color); }

/* --- 状态面板 (Loading / Error) --- */
.status-window {
  position: relative; z-index: 1; width: 400px; padding: 40px; background-color: var(--acrylic-base); backdrop-filter: var(--glass-blur); border-radius: var(--radius); border: 1px solid var(--border-color); box-shadow: var(--shadow); display: flex; flex-direction: column; align-items: center; text-align: center; color: var(--text-primary);
}
.loading-icon { font-size: 3rem; color: var(--accent-color); margin-bottom: 20px; }
.error-icon { font-size: 4rem; color: #f56c6c; margin-bottom: 20px; }
.error-window h2 { font-size: 1.25rem; margin-bottom: 10px; }
.error-msg { color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 30px; }
.back-home-btn { padding: 10px 24px; background-color: transparent; color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s; }
.back-home-btn:hover { background-color: var(--bg-hover); border-color: var(--accent-color); color: var(--accent-color); }

/* --- 左右分栏包裹器 --- */
.share-wrapper {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 20px;
  align-items: stretch;
  max-width: 90vw;
}
@media (max-width: 800px) {
  .share-wrapper { flex-direction: column; align-items: center; }
}

/* --- 左侧：分享主卡片 --- */
.share-window {
  width: 420px; padding: 30px 35px; background-color: var(--acrylic-base); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); border-radius: var(--radius); border: 1px solid var(--border-color); box-shadow: var(--shadow); display: flex; flex-direction: column; align-items: center; text-align: center; transition: background-color 0.3s ease, border-color 0.3s ease;
}

.sharer-info { display: flex; align-items: center; width: 100%; padding-bottom: 20px; border-bottom: 1px solid var(--border-color); position: relative;}
.sharer-avatar {object-fit: cover; width: 70px; height: 70px; border-radius: 50%; margin-right: 15px; }
.sharer-details { display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
.sharer-name { font-size: 1rem; font-weight: 600; color: var(--text-primary); }
.sharer-action { font-size: 0.875rem; color: var(--text-secondary); }

.encrypted-badge { position: absolute; right: 0; top: 10px; width: 30px; height: 30px; border-radius: 50%; background-color: rgba(230, 162, 60, 0.1); color: #e6a23c; display: flex; justify-content: center; align-items: center; font-size: 14px; }

.file-info { margin: 35px 0; }
.file-icon { font-size: 4rem; margin-bottom: 20px; }
.file-name { font-size: 1.5rem; font-weight: 600; color: var(--text-primary); word-break: break-all; }
.file-meta { font-size: 0.875rem; color: var(--text-secondary); margin-top: 8px; }

.actions-footer { width: 100%; }
.download-btn { width: 100%; height: 52px; background: var(--accent-color); color: #fff; border: none; border-radius: 6px; font-weight: 600; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: background 0.2s; }
.download-btn:hover { background: var(--accent-hover); }
.download-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.extra-info { display: flex; justify-content: space-between; align-items: center; margin-top: 30px; color: var(--text-secondary); font-size: 0.8rem; gap: 16px; }
.qr-code { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.qr-code img { width: 80px; height: 80px; border-radius: 4px; }
.expiry-info { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background-color: var(--bg-hover); border-radius: 6px; width: fit-content; max-width: calc(100% - 100px); flex: 0 0 auto; align-self: center; }

/* --- 右侧：简介卡片 --- */
.intro-window { width: 300px; padding: 25px; background-color: var(--acrylic-base); backdrop-filter: var(--glass-blur); border-radius: var(--radius); border: 1px solid var(--border-color); box-shadow: var(--shadow); display: flex; flex-direction: column;transition: background-color 0.3s ease, border-color 0.3s ease; }
.intro-header { display: flex; align-items: center; gap: 10px; font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed var(--border-color); }
.intro-header i { color: var(--accent-color); }
.intro-content p { font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; margin: 0; }

/* 密码弹窗内样式 */
.password-dialog-content { padding: 10px 0; }
.pwd-tip { font-size: 14px; color: var(--text-secondary); margin-bottom: 15px; }

@media (max-width: 800px) {
  .share-container {
    min-height: 100vh;
    height: auto;
    align-items: flex-start;
    padding: 72px 16px 24px;
    overflow-y: auto;
  }

  .theme-toggle-btn {
    top: 18px;
    right: 18px;
  }

  .status-window,
  .share-window,
  .intro-window,
  .share-wrapper {
    width: 100%;
    max-width: 100%;
  }

  .share-window {
    padding: 22px 18px;
  }

  .sharer-info {
    align-items: center;
    gap: 12px;
    padding-right: 40px;
  }

  .sharer-avatar {
    width: 60px;
    height: 60px;
    margin-right: 0;
    flex-shrink: 0;
  }

  .sharer-details {
    min-width: 0;
    flex: 1;
  }

  .extra-info {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    flex-wrap: nowrap;
  }

  .qr-code {
    width: auto;
    align-items: center;
  }

  .expiry-info {
    width: fit-content;
    max-width: none;
    justify-content: flex-start;
    align-self: center;
  }

  .encrypted-badge {
    right: 0;
    top: 0;
  }
}
</style>

<style>
/* 适配 Element Dialog 黑暗模式穿透 */
.custom-dialog { border-radius: 8px; }
.custom-dialog.dark { background-color: #1d2129 !important; border: 1px solid #374151; --el-text-color-primary: #f9fafb; --el-dialog-title-font-color: #f9fafb; }
.custom-dialog.dark .el-input__wrapper { background-color: #182235; box-shadow: 0 0 0 1px #374151 inset; }
.custom-dialog.dark .el-input__inner { color: #f9fafb; }
</style>
