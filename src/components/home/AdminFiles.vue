<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import Setting from "@/store/setting.js";
import Home from "@/store/home.ts";
import { AdminApi } from "@/commands/admin.ts";
import { FileApi } from "@/commands/file.ts"; // 🌟 引入文件 API 用于获取下载 Key
import { useClipboard } from '@vueuse/core';

const settingStore = Setting();
const homeStore = Home();
const { copy } = useClipboard();

const searchQuery = ref('');
// 🌟 绑定后端 IsDeleted 参数 (0: 所有, 1: 软删除, 2: 未软删除)
const deleteStatusFilter = ref(0);

const filesData = ref<any[]>([]);
const isLoading = ref(false);
const selectedFiles = ref<any[]>([]);

// --- 分页状态管理 ---
const currentPage = ref(1);
const pageSize = ref(10);
const totalFiles = ref(0);

// --- 格式化与文本截取工具 ---
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const shortenText = (text: string, frontLen = 8, backLen = 4) => {
  if (!text) return '-';
  if (text.length <= frontLen + backLen) return text;
  return `${text.substring(0, frontLen)}...${text.substring(text.length - backLen)}`;
};

const shortenPath = (path: string) => {
  if (!path) return '-';
  if (path.length <= 25) return path;
  const fileName = path.split('\\').pop()?.split('/').pop() || '';
  if (fileName.length >= 20) return `...${fileName.substring(fileName.length - 20)}`;
  return `${path.substring(0, 8)}...\\${fileName}`;
};

// --- 支持分页的获取列表函数 ---
const fetchGlobalFiles = async () => {
  isLoading.value = true;
  try {
    const res = await AdminApi.GetGlobalFiles(
        currentPage.value,
        pageSize.value,
        searchQuery.value,
        deleteStatusFilter.value
    );

    if (res.Status === 0 && res.Data) {
      filesData.value = res.Data.Items;
      totalFiles.value = res.Data.TotalCount;
    } else {
      ElMessage.warning(res.Msg || "获取数据失败");
    }

  } catch (error) {
    console.error("获取文件列表失败", error);
    ElMessage.error("网络请求异常，获取文件列表失败");
  } finally {
    isLoading.value = false;
  }
};

// --- 搜索/筛选时重置回第一页 ---
const handleSearch = () => {
  currentPage.value = 1;
  fetchGlobalFiles();
};

const handleSelectionChange = (val: any[]) => {
  selectedFiles.value = val;
};

// 复制路径或ID快捷方法
const handleCopy = async (text: string, name: string) => {
  if (!text) return;
  try {
    await copy(text);
    ElMessage.success(`${name} 已复制到剪贴板`);
  } catch (err) {
    ElMessage.error(`复制失败`);
  }
};

// 下载审查
const handleDownload = async (row: any) => {
  ElMessage.info(`正在请求下载密钥: ${row.FileName}`);

  try {
    const info = await AdminApi.GetTempDownLoadKey(row.UserId, row.Id);

    if (info.Status === 0) {
      const downloadUrl = `${import.meta.env.VITE_APP_BASE_API}/Files/DownLoadKey/${info.Data}`;
      window.open(downloadUrl, '_blank');
      ElMessage.success(`开始下载: ${row.FileName}`);
    } else {
      ElMessage.error(`获取下载密钥失败: ${info.Msg}`);
    }
  } catch (error) {
    console.error("请求下载异常", error);
    ElMessage.error("下载请求异常");
  }
};

// 强制删除（按 UserId 分类处理）
const handleDelete = (row?: any) => {
  const isBatch = !row;
  const filesToDelete = isBatch ? selectedFiles.value : [row];

  if (filesToDelete.length === 0) return;

  const confirmMsg = isBatch
      ? `确定要强制物理删除选中的 ${filesToDelete.length} 个文件吗？此操作不可逆！`
      : `确定要强制物理删除文件 "${row.FileName}" 吗？此操作不可逆！`;

  ElMessageBox.confirm(confirmMsg, '危险操作', {
    confirmButtonText: '物理删除',
    cancelButtonText: '取消',
    type: 'error',
    customClass: settingStore.theme === 'dark' ? 'action-dialog dark' : 'action-dialog'
  }).then(async () => {

    const userFileMap = new Map<string, string[]>();

    filesToDelete.forEach(file => {
      const uid = file.UserId;
      const fid = file.Id;

      if (!userFileMap.has(uid)) {
        userFileMap.set(uid, []);
      }
      userFileMap.get(uid)?.push(fid);
    });

    const requestPayload = Array.from(userFileMap.entries()).map(([userId, fileIds]) => {
      return {
        UserId: userId,
        FileIds: fileIds
      };
    });

    try {
      const res = await AdminApi.RemoveFiles(requestPayload);

      if (res.Status === 0) {
        ElMessage.success('文件物理删除指令已下发');
        fetchGlobalFiles();
      } else {
        ElMessage.error(res.Msg || '删除失败');
      }
    } catch (e) {
      console.error(e);
      ElMessage.error('请求删除时发生网络异常');
    }

  }).catch(() => {});
};

// --- 分页改变时的处理函数 ---
const handleSizeChange = (val: number) => {
  pageSize.value = val;
  currentPage.value = 1;
  fetchGlobalFiles();
};

const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  fetchGlobalFiles();
};

onMounted(() => {
  fetchGlobalFiles();
});
</script>

<template>
  <div class="fade-in panel-content">
    <div class="fluent-card p-20">

      <div class="toolbar-actions mb-20">
        <div class="left-actions">
          <el-button
              type="danger"
              class="fluent-btn"
              :disabled="selectedFiles.length === 0"
              @click="handleDelete()"
          >
            <i class="fa-solid fa-trash-can mr-8"></i> 批量强制物理删除
          </el-button>
          <span v-if="selectedFiles.length > 0" class="selected-count">
            已选 {{ selectedFiles.length }} 项
          </span>
        </div>

        <div class="right-actions">
          <el-select
              v-model="deleteStatusFilter"
              class="fluent-select"
              style="width: 140px;"
              @change="handleSearch"
          >
            <el-option label="所有文件" :value="0" />
            <el-option label="软删" :value="1" />
            <el-option label="正常文件" :value="2" />
          </el-select>

          <el-input
              v-model="searchQuery"
              placeholder="搜索文件名、用户 ID 或 Hash"
              class="fluent-input"
              style="width: 280px;"
              clearable
              @keyup.enter="handleSearch"
              @clear="handleSearch"
          >
            <template #prefix><i class="fa-solid fa-search"></i></template>
          </el-input>
        </div>
      </div>

      <!-- 表格区域 -->
      <el-table
          v-loading="isLoading"
          :data="filesData"
          style="width: 100%"
          class="fluent-table"
          @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" fixed="left" />

        <el-table-column label="文件名" min-width="200" show-overflow-tooltip fixed="left">
          <template #default="scope">
            <div class="file-name-col" :class="{ 'is-deleted': scope.row.IsDeleted }">
              <i
                  :class="homeStore.getFileIconClass(scope.row.FileName)"
                  :style="{ color: homeStore.getFileIconColor(scope.row.FileName) }"
                  class="file-icon"
              ></i>
              <span>{{ scope.row.FileName }}</span>
              <el-tag v-if="scope.row.IsDeleted" type="danger" size="small" effect="plain" class="ml-8">逻辑删除</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="文件 ID" width="150">
          <template #default="scope">
            <el-tooltip effect="dark" :content="scope.row.Id" placement="top-start" :show-after="300">
              <div class="copyable-text" @click="handleCopy(scope.row.Id, '文件 ID')">
                <span>{{ shortenText(scope.row.Id, 8, 4) }}</span>
                <i class="fa-regular fa-copy copy-icon"></i>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column label="物理存储路径" min-width="180">
          <template #default="scope">
            <el-tooltip effect="dark" :content="scope.row.StoragePath" placement="top-start" :show-after="300">
              <div class="copyable-text" @click="handleCopy(scope.row.StoragePath, '物理路径')">
                <span>{{ shortenPath(scope.row.StoragePath) }}</span>
                <i class="fa-regular fa-copy copy-icon"></i>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column prop="FileSizeInBytes" label="大小" width="100">
          <template #default="scope">
            <span style="color: var(--text-secondary); font-size: 13px;">
              {{ formatBytes(scope.row.FileSizeInBytes) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="所属用户 ID" width="160">
          <template #default="scope">
            <el-tooltip effect="dark" :content="scope.row.UserId" placement="top-start" :show-after="300">
              <div class="copyable-text" @click="handleCopy(scope.row.UserId, '用户 ID')">
                <i class="fa-solid fa-user-circle mr-8" style="color: var(--text-secondary)"></i>
                <span>{{ shortenText(scope.row.UserId, 8, 4) }}</span>
                <i class="fa-regular fa-copy copy-icon"></i>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column label="SHA-256" width="180">
          <template #default="scope">
            <el-tooltip effect="dark" :content="scope.row.FileHash" placement="top-start" :show-after="300">
              <div class="copyable-text" @click="handleCopy(scope.row.FileHash, 'Hash指纹')">
                <span>{{ shortenText(scope.row.FileHash, 6, 6) }}</span>
                <i class="fa-regular fa-copy copy-icon"></i>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="160">
          <template #default="scope">
            <span style="font-size: 13px">{{ formatDate(scope.row.CreationTime) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" align="right" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="handleDownload(scope.row)" title="下载审查" :disabled="scope.row.IsDeleted">
              <i class="fa-solid fa-download"></i>
            </el-button>
            <el-button link type="danger" @click="handleDelete(scope.row)" title="强制物理删除">
              <i class="fa-solid fa-fire"></i>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container mt-20">
        <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100, 500, 1000]"
            :background="true"
            layout="total, sizes, prev, pager, next, jumper"
            :total="totalFiles"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
        />
      </div>

    </div>
  </div>
</template>

<style scoped>
.fluent-card { background-color: var(--main-content-bg); border: 1px solid var(--border-color); border-radius: var(--radius); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); transition: border-color 0.3s, background-color 0.3s; }
.toolbar-actions { display: flex; justify-content: space-between; align-items: center; }
.left-actions { display: flex; align-items: center; gap: 15px; }

.right-actions { display: flex; align-items: center; gap: 10px; }

.selected-count { font-size: 13px; color: var(--text-secondary); }

.fluent-input :deep(.el-input__wrapper),
.fluent-select :deep(.el-input__wrapper) {
  background-color: var(--input-bg);
  box-shadow: 0 0 0 1px var(--border-color) inset;
  border-radius: var(--radius);
}
.fluent-input :deep(.el-input__wrapper.is-focus),
.fluent-select :deep(.el-input__wrapper.is-focus) {
  background-color: var(--main-content-bg);
  box-shadow: 0 0 0 1px var(--accent-color) inset !important;
}

.fluent-table { --el-table-border-color: var(--border-color); --el-table-header-bg-color: var(--bg-hover); --el-table-tr-bg-color: transparent; --el-table-row-hover-bg-color: var(--bg-hover); --el-table-text-color: var(--text-primary); --el-table-header-text-color: var(--text-secondary); background: transparent !important; }
.fluent-table :deep(th.el-table__cell), .fluent-table :deep(td.el-table__cell) { background: transparent !important; border-bottom: 1px solid var(--border-color); }

.file-name-col { display: flex; align-items: center; gap: 10px; font-weight: 500; }
.file-name-col.is-deleted { opacity: 0.6; text-decoration: line-through; }
.file-icon { font-size: 18px; }

/* 交互式复制文本样式 */
.copyable-text {
  display: inline-flex;
  align-items: center;
  font-family: Consolas, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  max-width: 100%;
}
.copyable-text:hover {
  background-color: var(--bg-active);
  color: var(--accent-color);
}
.copy-icon {
  margin-left: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}
.copyable-text:hover .copy-icon {
  opacity: 1;
}

.p-20 { padding: 20px; }
.mb-20 { margin-bottom: 20px; }
.mt-20 { margin-top: 20px; }
.mr-8 { margin-right: 8px; }
.ml-8 { margin-left: 8px; }
.fade-in { animation: fadeIn 0.3s ease-in-out; }

.pagination-container { display: flex; justify-content: flex-end; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 900px) {
  .toolbar-actions,
  .left-actions,
  .right-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-container {
    justify-content: center;
  }
}
</style>

<style>
/* 适配 Element Plus 分页组件在暗黑模式下的样式 */
.dark .el-pagination.is-background .el-pager li:not(.is-disabled).is-active {
  background-color: var(--accent-color);
  color: #fff;
}
.dark .el-pagination.is-background .btn-next,
.dark .el-pagination.is-background .btn-prev,
.dark .el-pagination.is-background .el-pager li {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}
.dark .el-pagination__total,
.dark .el-pagination__jump {
  color: var(--text-secondary);
}

/* 适配 Select 下拉列表的暗黑模式 */
.dark .el-select-dropdown {
  background-color: #1d2129 !important;
  border: 1px solid #374151 !important;
}
.dark .el-select-dropdown__item {
  color: #E5EAF3 !important;
}
.dark .el-select-dropdown__item.hover,
.dark .el-select-dropdown__item:hover {
  background-color: #2b2f3a !important;
}
</style>
