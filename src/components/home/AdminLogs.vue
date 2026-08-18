<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { AdminApi } from "@/commands/admin.ts";

// 对应后端的真实日志数据结构
interface SystemLog {
  Message: string;
  MessageTemplate: string;
  Level: number; // 2: Info, 3: Warning, 4: Error
  Timestamp: string;
  Exception: string | null;
  LogEvent: string; // 内部包含 JSON
}

const isLoading = ref(true);
const isRestarting = ref(false);

const logList = ref<SystemLog[]>([]);
const currentPage = ref(1);
const totalLogs = ref(0);
const pageSize = ref(20); // 假设后端每页返回 20 条，可按需修改

// 获取日志数据
const fetchLogs = async () => {
  isLoading.value = true;
  try {
    const res = await AdminApi.GetLogs(currentPage.value);

    if (res.Status === 0 && res.Data) {
      // 适配新结构：数据在 res.Data.Log 中，总数在 res.Data.TotalCount 中
      logList.value = res.Data.Log || [];
      totalLogs.value = res.Data.TotalCount || 0;
    } else {
      ElMessage.error('加载日志失败：' + (res.Msg || '未知错误'));
    }
  } catch (error) {
    console.error('获取日志异常:', error);
    ElMessage.error('获取日志请求发生异常');
  } finally {
    isLoading.value = false;
  }
};

// 分页处理
const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  fetchLogs();
};

// 重启服务器操作
const handleRestartServer = () => {
  ElMessageBox.confirm(
      '重启服务器将导致当前所有正在传输的任务和网络连接中断。确定要继续吗？',
      '危险操作确认',
      {
        confirmButtonText: '确认重启',
        cancelButtonText: '取消',
        type: 'warning',
      }
  ).then(async () => {
    isRestarting.value = true;
    try {
      const res = await AdminApi.Restart();

      if (!res || res.Status === 0) {
        ElMessage.success('已发送重启指令，服务器正在重启中...');
        setTimeout(() => {
          ElMessageBox.alert('服务器重启中，请稍后手动刷新页面恢复连接。', '提示', {
            confirmButtonText: '刷新页面',
            callback: () => window.location.reload()
          });
        }, 3000);
      } else {
        ElMessage.error('重启失败：' + (res.Msg || '服务器拒绝了请求'));
      }
    } catch (error) {
      console.log("重启请求捕获到状态 (可能由于断开连接):", error);
      ElMessage.success('重启指令已发送，连接已断开');
    } finally {
      isRestarting.value = false;
    }
  }).catch(() => {});
};

// ----------------- 数据处理工具函数 -----------------

const getLogLevelType = (level: number) => {
  switch (level) {
    case 2: return 'info';
    case 3: return 'warning';
    case 4: return 'danger';
    default: return 'info';
  }
};

const getLogLevelName = (level: number) => {
  switch (level) {
    case 2: return 'Info';
    case 3: return 'Warning';
    case 4: return 'Error';
    default: return 'Unknown';
  }
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  return date.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
};

const getLogSource = (logEventStr: string) => {
  try {
    if (!logEventStr) return 'System';
    const eventObj = JSON.parse(logEventStr);
    const sourceContext = eventObj.Properties?.SourceContext || 'System';
    const parts = sourceContext.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : sourceContext;
  } catch (e) {
    return 'System';
  }
};

onMounted(() => {
  fetchLogs();
});
</script>

<template>
  <div class="fade-in panel-content scroll-area custom-form-container">

    <div class="page-header mb-20">
      <div class="header-text">
        <h2 style="margin: 0; font-size: 20px; color: var(--text-primary);">系统日志与维护</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: var(--text-secondary);">查看网盘后端运行日志、异常报错，并执行服务器重启等高权限维护操作。</p>
      </div>

      <div class="header-actions">
        <el-button @click="fetchLogs" :loading="isLoading">
          <i class="fa-solid fa-rotate-right mr-8"></i> 刷新日志
        </el-button>
        <el-button type="danger" color="#ef4444" @click="handleRestartServer" :loading="isRestarting">
          <i class="fa-solid fa-power-off mr-8"></i> 重启服务器
        </el-button>
      </div>
    </div>

    <div class="fluent-card">

      <div class="log-toolbar">
        <span style="font-size: 14px; font-weight: 500; color: var(--text-primary);">
          <i class="fa-solid fa-rectangle-list" style="color: var(--accent-color); margin-right: 6px;"></i> 运行日志
        </span>
      </div>

      <el-table
          v-loading="isLoading"
          :data="logList"
          style="width: 100%"
          class="log-table"
          stripe
      >
        <el-table-column label="时间" width="180">
          <template #default="scope">
            {{ formatTime(scope.row.Timestamp) }}
          </template>
        </el-table-column>

        <el-table-column label="级别" width="100">
          <template #default="scope">
            <el-tag :type="getLogLevelType(scope.row.Level)" effect="light" size="small">
              {{ getLogLevelName(scope.row.Level) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="来源模块" width="180">
          <template #default="scope">
            <span class="log-source" :title="scope.row.LogEvent">{{ getLogSource(scope.row.LogEvent) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="Message" label="日志内容" min-width="300" show-overflow-tooltip />
      </el-table>

      <div class="pagination-container">
        <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="totalLogs"
            layout="total, prev, pager, next"
            background
            @current-change="handleCurrentChange"
        />
      </div>
    </div>

  </div>
</template>

<style scoped>
.scroll-area {
  overflow-y: auto;
  padding: 20px 30px 40px 30px;
  height: 100%;
}
.scroll-area::-webkit-scrollbar { width: 8px; }
.scroll-area::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.15); border-radius: 8px; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-color);
}
.header-actions { display: flex; gap: 12px; }

.mr-8 { margin-right: 8px; }
.mb-20 { margin-bottom: 20px; }

.fluent-card {
  background-color: var(--main-content-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius, 12px);
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
}
.fluent-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04); }

.log-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.log-source {
  font-family: Consolas, monospace;
  font-size: 13px;
  color: var(--text-secondary);
  background-color: var(--bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: help;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .scroll-area {
    padding: 14px 14px 24px;
  }

  .page-header,
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .fluent-card {
    padding: 18px;
  }

  .pagination-container {
    justify-content: center;
  }
}
</style>

<style>
/* 深度适配 Element Plus 表格颜色，防止出现黑色背景 */
.custom-form-container .el-table {
  background-color: transparent !important;
  --el-table-header-bg-color: var(--bg-hover, #f8f9fb);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
}

.custom-form-container .el-table__cell {
  background-color: transparent !important;
}

.dark .custom-form-container .el-table {
  --el-table-header-bg-color: #1e293b;
}
</style>
