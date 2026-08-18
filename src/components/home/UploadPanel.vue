<script setup>
import { ref, reactive, computed } from 'vue';
import { ElUpload, ElMessage, ElButton, ElDialog, ElInput } from 'element-plus';
import 'element-plus/es/components/upload/style/css';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/input/style/css';
import Setting from "@/store/setting.js";
import Home from '@/store/home.ts';
// ⚠️ 请确保 FileApi 已经正确实现：
// CreateMultipartUpload 和 MergeFiles 必须是 JSON 请求
// UploadChunk 必须是 FormData (multipart/form-data) 请求
import { FileApi } from "@/commands/file.ts";
import { createSHA256 } from 'hash-wasm';

const settingStore = Setting();
const homeStore = Home();

// --- 状态引用 ---
const hashState = reactive({});
const uploadRef = ref(null);
const folderInputRef = ref(null);

// ==========================================
// ====== 视图刷新防抖控制 (性能优化核心) =======
// ==========================================
let refreshTimer = null;

const debouncedRefreshView = (targetPathId) => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(async () => {
    homeStore.setUserStorageCapacityInfo();
    if (targetPathId === homeStore.currentFolder.Id) {
      await homeStore.setUserDirectoryFileInfo(targetPathId);
    }
    homeStore.selectedFolders.length = 0;
    homeStore.selectedFiles.length = 0;
  }, 500);
};

// ==========================================
// ====== 全局总进度管理器 =============
// ==========================================
const overallStatus = reactive({
  isUploading: false,
  totalFiles: 0,
  completedFiles: 0
});

const overallProgress = computed(() => {
  if (overallStatus.totalFiles === 0) return 0;
  return Math.floor((overallStatus.completedFiles / overallStatus.totalFiles) * 100);
});

const markFileCompleted = (targetPathId) => {
  overallStatus.completedFiles++;
  debouncedRefreshView(targetPathId);

  if (overallStatus.completedFiles >= overallStatus.totalFiles) {
    setTimeout(() => {
      overallStatus.isUploading = false;
      overallStatus.totalFiles = 0;
      overallStatus.completedFiles = 0;
      ElMessage.success('所有队列中的文件已处理完毕！');
    }, 1500);
  }
};

// ==========================================
// ====== 轻量级并发控制器 (信号量) =======
// ==========================================
class Semaphore {
  constructor(max) {
    this.max = max;
    this.count = 0;
    this.waiting = [];
  }

  acquire() {
    return new Promise(resolve => {
      if (this.count < this.max) {
        this.count++;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  release() {
    this.count--;
    if (this.waiting.length > 0) {
      this.count++;
      const nextResolve = this.waiting.shift();
      nextResolve();
    }
  }
}
// 控制同时上传文件的数量（可根据服务器承载力调整）
const uploadSemaphore = new Semaphore(10);

// ==========================================
// ====== 网络链接本地下载与上传 =======
// ==========================================
const networkUploadVisible = ref(false);
const networkUrl = ref('');
const isDownloadingNetwork = ref(false);
const networkDownloadProgress = ref(0);
const networkFileStep = ref(1); // 1: 填链接, 2: 确认文件名
const networkFileInfo = reactive({
  blob: null,
  fileName: '',
  fileSize: 0
});

const openNetworkUpload = () => {
  networkUrl.value = '';
  networkFileStep.value = 1;
  networkDownloadProgress.value = 0;
  networkUploadVisible.value = true;
};

const startDownloadNetworkFile = () => {
  if (!networkUrl.value) {
    ElMessage.warning('请输入有效的文件直链 URL');
    return;
  }

  isDownloadingNetwork.value = true;
  networkDownloadProgress.value = 0;

  const xhr = new XMLHttpRequest();
  xhr.open('GET', networkUrl.value, true);
  xhr.responseType = 'blob';

  xhr.onprogress = (event) => {
    if (event.lengthComputable) {
      networkDownloadProgress.value = Math.floor((event.loaded / event.total) * 100);
    } else {
      networkDownloadProgress.value = 99;
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const blob = xhr.response;

      let filename = networkUrl.value.split('/').pop().split('?')[0] || '未知文件';
      const disposition = xhr.getResponseHeader('Content-Disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
        }
      }

      networkFileInfo.blob = blob;
      networkFileInfo.fileName = decodeURIComponent(filename);
      networkFileInfo.fileSize = blob.size;

      isDownloadingNetwork.value = false;
      networkFileStep.value = 2;
    } else {
      isDownloadingNetwork.value = false;
      ElMessage.error(`下载失败: 服务器返回状态码 ${xhr.status}`);
    }
  };

  xhr.onerror = () => {
    isDownloadingNetwork.value = false;
    ElMessage.error('下载失败！可能是链接无效或遭到了目标服务器跨域 (CORS) 拦截');
  };

  xhr.send();
};

const confirmNetworkUpload = () => {
  const newFile = new File([networkFileInfo.blob], networkFileInfo.fileName, { type: networkFileInfo.blob.type });

  newFile.targetFolderId = homeStore.currentFolder.Id || homeStore.rootFolder.Id;
  newFile.uid = Date.now() + Math.random();

  if (uploadRef.value) {
    uploadRef.value.handleStart(newFile);
    uploadRef.value.submit();
  }

  networkUploadVisible.value = false;
  ElMessage.success(`"${networkFileInfo.fileName}" 已加入上传队列`);
};

// ==========================================
// ====== 常规上传与分片断点续传逻辑 =======
// ==========================================

const onBeforeUpload = (file) => {
  const limitBytes = homeStore.FileMaxUploadSizeLimit;
  if (limitBytes && file.size > limitBytes) {
    const limitGB = (limitBytes / (1024 * 1024 * 1024)).toFixed(2);
    ElMessage.error(`文件大小超过限制，最大允许上传 ${limitGB} GB: ${file.name}`);
    return false;
  }

  overallStatus.isUploading = true;
  overallStatus.totalFiles++;
  return true;
};

const calculateSHA256 = async (file, onHashProgress) => {
  const hasher = await createSHA256();
  hasher.init();
  const chunkSize = 100 * 1024 * 1024;
  const chunks = Math.ceil(file.size / chunkSize);
  let currentChunk = 0;

  const readChunk = (start, end) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file.slice(start, end));
    });
  };

  while (currentChunk < chunks) {
    const start = currentChunk * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const buffer = await readChunk(start, end);
    const view = new Uint8Array(buffer);
    hasher.update(view);
    currentChunk++;
    const progress = Math.floor((currentChunk / chunks) * 100);
    if (onHashProgress) {
      onHashProgress(progress);
    }
  }
  return hasher.digest();
};

const customUploadRequest = async (options) => {
  const { file, onProgress, onSuccess, onError } = options;

  // 🌟 核心防御：防止 Element Plus 传递的包装对象导致 .size 丢失或为 0
  const actualFile = file.raw || file;
  const fileSize = Number(actualFile.size) || 0;
  const fileName = actualFile.name || '未知文件';

  const targetPathId = actualFile.targetFolderId || homeStore.currentFolder.Id || homeStore.rootFolder.Id;
  hashState[actualFile.uid] = { computing: true, progress: 0, waiting: true };

  await uploadSemaphore.acquire();
  hashState[actualFile.uid].waiting = false;

  try {
    // 1. 计算文件哈希
    const fileHash = await calculateSHA256(actualFile, (percent) => {
      if (hashState[actualFile.uid]) {
        hashState[actualFile.uid].progress = percent;
      }
    });

    if (hashState[actualFile.uid]) {
      hashState[actualFile.uid].computing = false;
      hashState[actualFile.uid].progress = 100;
    }

    // 2. 传统极速秒传鉴定 (原逻辑保持不变)[cite: 5]
    const checkResponse = await FileApi.SaveToFile(targetPathId, '', fileHash);

    if (checkResponse.Status === 0) {
      onProgress({ percent: 100 });
      onSuccess(checkResponse);
      ElMessage.success(`${fileName} 秒传成功`);
      return;
    }

    // === 开始大文件分片任务机制 ===

    // 🌟 获取动态分片大小：从全局 basicInfo 中读取后端返回的 FileChunkSizeBytes，兜底 10MB
    const chunkSize = settingStore.basicInfo?.FileChunkSizeBytes || 10485760;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    // 3. 握手：创建分片任务，注意 payload 字段名大小写严格匹配后端 C# Record
    const initRes = await FileApi.CreateMultipartUpload({
      FileName: fileName,
      FileSizeInBytes: fileSize, // 这里安全读取并发送真实的字节大小
      FileHash: fileHash
    });

    if (initRes.Status !== 0) {
      throw new Error(`初始化分片失败: ${initRes.Msg}`);
    }
    const uploadId = initRes.Data;

    // 4. 获取已上传的分片信息，为断点续传做准备
    const chunkInfoRes = await FileApi.GetFileChunkInfo(uploadId);
    const uploadedIndices = new Set();

    if (chunkInfoRes.Status === 0 && chunkInfoRes.Data) {
      const taskModel = chunkInfoRes.Data; // 后端返回的 UploadTaskModel

      // 容错鉴定：如果在并发或刷新间隙文件已经处理完，直接标记成功
      if (taskModel.status === 'END') {
        onProgress({ percent: 100 });
        onSuccess(chunkInfoRes);
        return;
      }

      // 提取我们究竟还需要传哪几片
      if (taskModel.uploaded_chunks && Array.isArray(taskModel.uploaded_chunks)) {
        taskModel.uploaded_chunks.forEach(chunk => {
          uploadedIndices.add(chunk.index);
        });
      }
    }

    // 5. 将剩余分片推入并发池
    let completedChunksCount = uploadedIndices.size;

    const updateProgress = () => {
      let percent = Math.floor((completedChunksCount / totalChunks) * 100);
      if (percent === 100) percent = 99; // 预留1%进度等待后端合并文件
      onProgress({ percent });
    };
    updateProgress();

    // 控制单个文件内部分片的并发数 (一般 3-5 最佳)，防止同时塞满浏览器连接池
    const chunkSemaphore = new Semaphore(4);
    const uploadPromises = [];

    for (let i = 0; i < totalChunks; i++) {
      // 命中已上传的集合，直接放行（断点续传核心逻辑）
      if (uploadedIndices.has(i)) continue;

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);

      // 切片并伪装成 File 对象，供 FormData 传输
      const chunkBlob = actualFile.slice(start, end);
      const chunkFile = new File([chunkBlob], fileName, { type: actualFile.type });

      const task = async () => {
        await chunkSemaphore.acquire();
        try {
          const uploadRes = await FileApi.UploadChunk(uploadId, i, chunkFile);
          if (uploadRes.Status !== 0) {
            throw new Error(`分片 ${i} 上传失败: ${uploadRes.Msg}`);
          }
          completedChunksCount++;
          updateProgress();
        } finally {
          chunkSemaphore.release();
        }
      };

      uploadPromises.push(task());
    }

    // 挂起，等待当前文件的所有分片全部长传完毕
    await Promise.all(uploadPromises);

    // 6. 收网：请求后端将所有碎片合并为一个完整文件
    const mergeRes = await FileApi.MergeFiles(uploadId, targetPathId);
    if (mergeRes.Status !== 0) {
      throw new Error(`文件合并处理失败: ${mergeRes.Msg}`);
    }

    onProgress({ percent: 100 });
    onSuccess(mergeRes);

  } catch (error) {
    console.error('上传过程遭遇异常:', error);
    onError(error);
    ElMessage.error(`${actualFile.name} 上传失败: ${error.message || '未知错误'}`);
  } finally {
    uploadSemaphore.release();
    markFileCompleted(targetPathId);
    setTimeout(() => delete hashState[actualFile.uid], 1000);
  }
};

const handleChange = () => {
  setTimeout(() => {
    const listEl = document.querySelector('.custom-uploader .el-upload-list');
    if (listEl) {
      listEl.scrollTop = 0;
      const lastItem = listEl.lastElementChild;
      if (lastItem) {
        lastItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, 100);
};

const handleSelectFolder = () => {
  if (folderInputRef.value) {
    folderInputRef.value.click();
  }
};

const createFolderWithRetry = async (parentId, originalName) => {
  let attemptName = originalName;
  let res = await FileApi.CreateFolder(parentId, attemptName);

  if (res.Status === 0) {
    return typeof res.Data === 'string' ? res.Data : res.Data?.Id;
  } else {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    attemptName = `原名不可用_${randomNum}`;

    res = await FileApi.CreateFolder(parentId, attemptName);
    if (res.Status === 0) {
      return typeof res.Data === 'string' ? res.Data : res.Data?.Id;
    } else {
      return null;
    }
  }
};

const onFolderSelected = async (event) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  ElMessage.info(`开始解析文件夹，共 ${files.length} 个文件，请稍候...`);

  const folderIdMap = new Map();
  const rootParentId = homeStore.currentFolder.Id || homeStore.rootFolder.Id;

  overallStatus.isUploading = true;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = file.webkitRelativePath;

    if (!relativePath) continue;

    const pathParts = relativePath.split('/');
    const pureFileName = pathParts[pathParts.length - 1];
    const folderNames = pathParts.slice(0, pathParts.length - 1);

    let currentParentId = rootParentId;
    let currentPath = '';

    for (const folderName of folderNames) {
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

      if (folderIdMap.has(currentPath)) {
        currentParentId = folderIdMap.get(currentPath);
      } else {
        const newFolderId = await createFolderWithRetry(currentParentId, folderName);
        if (!newFolderId) break;
        folderIdMap.set(currentPath, newFolderId);
        currentParentId = newFolderId;
      }
    }

    if (currentParentId) {
      const cleanFile = new File([file], pureFileName, {
        type: file.type,
        lastModified: file.lastModified
      });

      cleanFile.targetFolderId = currentParentId;
      cleanFile.uid = Date.now() + i;

      if (uploadRef.value) {
        uploadRef.value.handleStart(cleanFile);
      }
    }
  }

  if (uploadRef.value) {
    uploadRef.value.submit();
  }

  debouncedRefreshView(rootParentId);
  event.target.value = '';
};
</script>

<template>
  <div class="upload-panel">
    <div class="panel-header">
      <span>上传文件</span>

      <div style="display: flex; gap: 8px;">
        <el-button size="small" type="primary" plain @click="openNetworkUpload">
          <i class="fa-solid fa-link" style="margin-right: 4px;"></i> 网络链接
        </el-button>

        <input
            type="file"
            ref="folderInputRef"
            style="display: none"
            webkitdirectory
            directory
            @change="onFolderSelected"
        >
        <el-button size="small" type="primary" plain @click="handleSelectFolder">
          <i class="fa-solid fa-folder-tree" style="margin-right: 4px;"></i> 传文件夹
        </el-button>
      </div>
    </div>

    <div v-if="overallStatus.isUploading" class="overall-progress-container">
      <div class="overall-progress-info">
        <span class="overall-title">总任务进度</span>
        <span class="overall-count">
          {{ overallStatus.completedFiles }} / {{ overallStatus.totalFiles }} 项 ({{ overallProgress }}%)
        </span>
      </div>
      <div class="overall-progress-track">
        <div class="overall-progress-fill" :style="{ width: overallProgress + '%' }"></div>
      </div>
    </div>

    <el-upload
        ref="uploadRef"
        class="custom-uploader"
        drag
        action="#"
        multiple
        :http-request="customUploadRequest"
        :on-change="handleChange"
        :before-upload="onBeforeUpload"
    >
      <i class="el-icon--upload fa-solid fa-cloud-arrow-up"></i>
      <div class="el-upload__text">拖拽文件到此处或 <em>点击上传文件</em></div>

      <template #file="{ file }">
        <div class="custom-file-item">
          <div class="file-info-row">
            <i class="fa-regular fa-file file-type-icon"></i>
            <span class="file-name" :title="file.name">{{ file.name }}</span>

            <div v-if="hashState[file.uid] && hashState[file.uid].waiting" class="hash-computing-status" style="color: var(--text-secondary);">
              <i class="fa-solid fa-hourglass-half"></i> 排队中
            </div>

            <div v-else-if="hashState[file.uid] && hashState[file.uid].computing" class="hash-computing-status">
              <i class="fa-solid fa-circle-notch fa-spin hash-spinner"></i>
              <span class="hash-text">校验中 {{ hashState[file.uid].progress }}%</span>
            </div>

            <i v-else-if="file.status === 'success'" class="fa-solid fa-circle-check status-icon success"></i>
            <i v-else-if="file.status === 'fail'" class="fa-solid fa-circle-xmark status-icon fail"></i>

            <span v-else-if="file.status === 'uploading'" class="upload-percentage">
              {{ file.percentage ? file.percentage.toFixed(0) : 0 }}%
            </span>
          </div>

          <div v-if="file.status === 'uploading' || (hashState[file.uid] && hashState[file.uid].computing)" class="custom-progress-box">
            <div class="custom-progress-track">
              <div class="custom-progress-fill"
                   :class="{ 'is-hashing': hashState[file.uid] && hashState[file.uid].computing && !hashState[file.uid].waiting }"
                   :style="{ width: ((hashState[file.uid] && hashState[file.uid].computing) ? hashState[file.uid].progress : (file.percentage || 0)) + '%' }">
              </div>
            </div>
          </div>

        </div>
      </template>
    </el-upload>

    <el-dialog v-model="networkUploadVisible" title="网络直链转存" width="450px" append-to-body destroy-on-close :close-on-click-modal="false">

      <div v-if="networkFileStep === 1">
        <el-input v-model="networkUrl" placeholder="请输入有效的文件下载直链 (http/https...)" clearable></el-input>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
          <i class="fa-solid fa-circle-info"></i> 提示：下载取决于目标网站是否允许跨域 (CORS) 访问
        </div>

        <div v-if="isDownloadingNetwork" style="margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
            <span>正在将资源拉取到浏览器内存...</span>
            <span style="color: var(--accent-color); font-weight: bold;">{{ networkDownloadProgress }}%</span>
          </div>
          <div class="custom-progress-track" style="height: 6px; border-radius: 3px;">
            <div class="custom-progress-fill" :style="{ width: networkDownloadProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <div v-if="networkFileStep === 2">
        <div style="margin-bottom: 12px; font-size: 14px; font-weight: bold; color: var(--text-primary);">
          文件拉取成功！请核对文件名并确认上传：
        </div>
        <el-input v-model="networkFileInfo.fileName" placeholder="输入文件名（包含后缀）"></el-input>
        <div style="margin-top: 12px; font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-hard-drive"></i> 文件体积:
          <span style="color: var(--accent-color); font-weight: bold;">
            {{ (networkFileInfo.fileSize / 1024 / 1024).toFixed(2) }} MB
          </span>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="networkUploadVisible = false" :disabled="isDownloadingNetwork">取消</el-button>

          <el-button v-if="networkFileStep === 1" type="primary" @click="startDownloadNetworkFile" :loading="isDownloadingNetwork">
            <i class="fa-solid fa-cloud-arrow-down" style="margin-right: 5px;"></i> 开始解析
          </el-button>

          <el-button v-if="networkFileStep === 2" type="primary" @click="confirmNetworkUpload">
            <i class="fa-solid fa-check" style="margin-right: 5px;"></i> 确认加入队列
          </el-button>
        </span>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.upload-panel { display: flex; flex-direction: column; gap: 15px; }

.panel-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 16px; color: var(--popper-text-primary); }

/* === 全局总进度条样式 === */
.overall-progress-container {
  background-color: var(--popper-bg-hover);
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  margin-bottom: 5px;
}
.overall-progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}
.overall-title { font-weight: 600; color: var(--popper-text-primary); }
.overall-count { color: var(--accent-color); font-weight: bold; }
.overall-progress-track { width: 100%; height: 6px; background-color: var(--progress-bg-color); border-radius: 3px; overflow: hidden; }
.overall-progress-fill { height: 100%; background-color: var(--accent-color); transition: width 0.4s ease; border-radius: 3px; }

/* === 列表与各项进度 === */
.custom-uploader :deep(.el-upload-list) { display: flex; flex-direction: column-reverse; max-height: 250px; overflow-y: auto; margin-top: 10px; padding-right: 5px; width: 100%; }
.custom-uploader :deep(.el-upload-list)::-webkit-scrollbar { width: 6px; }
.custom-uploader :deep(.el-upload-list)::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.2); border-radius: 4px; }
.custom-uploader :deep(.el-upload-list)::-webkit-scrollbar-track { background: transparent; }
:global(.dark) .custom-uploader :deep(.el-upload-list)::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.2); }

.custom-file-item { display: flex; flex-direction: column; justify-content: center; gap: 6px; margin-bottom: 5px; padding: 8px 12px; background-color: var(--popper-bg-hover); border-radius: 4px; width: 100%; box-sizing: border-box; position: relative; flex-shrink: 0; }
.file-info-row { display: flex; align-items: center; gap: 10px; width: 100%; }
.file-type-icon { color: var(--popper-text-secondary); }
.file-name { flex: 1; font-size: 13px; color: var(--popper-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.status-icon { font-size: 14px; }
.success { color: #67c23a; }
.fail { color: #f56c6c; }
.upload-percentage { font-size: 12px; color: var(--accent-color); font-weight: bold; }
.custom-progress-box { width: 100%; padding-left: 24px; padding-right: 0; box-sizing: border-box; }
.custom-progress-track { width: 100%; height: 4px; background-color: var(--progress-bg-color); border-radius: 2px; overflow: hidden; }
.custom-progress-fill { height: 100%; background-color: var(--accent-color); transition: width 0.3s ease; border-radius: 2px; }

.hash-computing-status { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 12px; }
.hash-spinner { color: var(--accent-color); animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.custom-progress-fill.is-hashing { background-color: var(--accent-color); opacity: 0.7; }
</style>