<template>
  <div class="fluent-share-manager">

    <div class="page-header">
      <div class="header-left">
        <i class="fa-solid fa-share-nodes header-icon"></i>
        <div class="header-text">
          <h2>我的分享管理</h2>
          <p>管理您生成的所有文件分享链接、提取码及有效期。</p>
        </div>
      </div>

      <div class="header-right">
        <div class="fluent-search-box">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索文件名、ID 或描述..."
              class="search-input"
          />
          <i
              v-show="searchQuery"
              class="fa-solid fa-xmark clear-icon"
              @click="searchQuery = ''"
              title="清除搜索"
          ></i>
        </div>

        <button
            class="fluent-action-btn primary-subtle top-refresh-btn"
            @click="refreshShareList"
            title="刷新列表"
            :disabled="isRefreshing"
        >
          <i class="fa-solid fa-rotate-right" :class="{ 'fa-spin': isRefreshing }"></i>
        </button>
      </div>
    </div>

    <div class="share-list-container">
      <div v-if="groupedShareData.length === 0" class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <p v-if="searchQuery">没有找到与 "{{ searchQuery }}" 相关的分享记录</p>
        <p v-else>暂无分享记录</p>
      </div>

      <div
          v-for="group in groupedShareData"
          :key="group.ShareFileId"
          class="share-group-card"
          :class="{ 'is-expanded': expandedGroups.has(group.ShareFileId) }"
      >
        <div class="group-header" @click="toggleExpand(group.ShareFileId)">
          <i :class="homeStore.getFileIconClass(group.FileName)" :style="{ color: homeStore.getFileIconColor(group.FileName) }" class="file-icon"></i>
          <span class="file-name">{{ group.FileName }}</span>

          <div class="group-meta">
            <span class="share-count">{{ group.Shares.length }} 个链接</span>
            <button class="fluent-action-btn primary-subtle" @click.stop="openCreateDialog(group)" title="为此文件新建分享">
              <i class="fa-solid fa-plus"></i>
            </button>
            <i class="fa-solid fa-chevron-down expand-icon"></i>
          </div>
        </div>

        <el-collapse-transition>
          <div v-show="expandedGroups.has(group.ShareFileId)" class="group-body">
            <div class="share-items-wrapper">

              <div v-for="share in group.Shares" :key="share.Id" class="share-item" :class="{ 'is-expired': isExpired(share.EndValidity) }">
                <div class="share-info-main">
                  <div class="info-row">
                    <i class="fa-solid fa-link info-icon"></i>
                    <a :href="'/share/' + share.Id" target="_blank" class="share-id share-link" title="点击访问分享链接">
                      {{ share.Id }}
                    </a>

                    <span class="pwd-tag expired-tag" v-if="isExpired(share.EndValidity)">
                      <i class="fa-solid fa-circle-exclamation"></i> 链接已过期
                    </span>

                    <span class="pwd-tag" v-if="share.Password">
                      <i class="fa-solid fa-lock"></i> 提取码: {{ share.Password }}
                    </span>
                    <span class="pwd-tag public" v-else>
                      <i class="fa-solid fa-earth-americas"></i> 公开分享
                    </span>
                  </div>
                  <div class="info-row secondary">
                    <span><i class="fa-regular fa-clock"></i> {{ formatDate(share.BeginValidity) }} ~ {{ formatDate(share.EndValidity) }}</span>
                    <span v-if="share.Introduction" class="intro-text"><i class="fa-regular fa-comment-dots"></i> {{ share.Introduction }}</span>
                  </div>
                </div>

                <div class="share-actions">
                  <button class="fluent-action-btn" @click="copyLink(share.Id, share.Password)" title="复制链接">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                  <button class="fluent-action-btn" @click="openEditDialog(share, group)" title="编辑设置">
                    <i class="fa-solid fa-sliders"></i>
                  </button>
                  <button class="fluent-action-btn danger" @click="deleteShare(share)" title="取消分享">
                    <i class="fa-solid fa-link-slash"></i>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </el-collapse-transition>
      </div>
    </div>

    <ShareDialog
        v-model="shareDialogVisible"
        :file-id="currentShareTarget.fileId"
        :file-name="currentShareTarget.fileName"
        :edit-data="currentShareTarget.editData"
        @success="handleShareSuccess"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import Setting from "@/store/setting.js";
import Home from "@/store/home.ts";
import ShareDialog from './ShareDialog.vue';
import { FileApi } from "@/commands/file";
// 删除了错误导入的 node:async_hooks

const settingStore = Setting();
const homeStore = Home();

// --- 类型定义 ---
interface FileShareInfo {
  Id: string;
  ShareFileId: string;
  FileName?: string;
  BeginValidity: string;
  EndValidity: string;
  Password?: string | null;
  Introduction?: string | null;
  CreationTime: string;
}

interface GroupedShare {
  ShareFileId: string;
  FileName: string;
  Shares: FileShareInfo[];
}

// --- 状态数据 ---
const rawData = ref<FileShareInfo[]>([]);
const expandedGroups = ref<Set<string>>(new Set());
const searchQuery = ref('');
const isRefreshing = ref(false); // 【新增】刷新状态标志

// 弹窗状态管理
const shareDialogVisible = ref(false);
const currentShareTarget = ref({
  fileId: '',
  fileName: '',
  editData: null as FileShareInfo | null
});

// --- 计算属性：先搜索过滤，再按文件分组 ---
const groupedShareData = computed<GroupedShare[]>(() => {
  let filteredData = rawData.value;
  if (searchQuery.value.trim() !== '') {
    const keyword = searchQuery.value.toLowerCase().trim();
    filteredData = rawData.value.filter(item => {
      const matchName = item.FileName?.toLowerCase().includes(keyword);
      const matchId = item.Id.toLowerCase().includes(keyword);
      const matchIntro = item.Introduction?.toLowerCase().includes(keyword);
      return matchName || matchId || matchIntro;
    });
  }

  const map = new Map<string, GroupedShare>();
  filteredData.forEach(item => {
    if (!map.has(item.ShareFileId)) {
      map.set(item.ShareFileId, {
        ShareFileId: item.ShareFileId,
        FileName: item.FileName || '未知文件',
        Shares: []
      });
    }
    map.get(item.ShareFileId)!.Shares.push(item);
  });

  return Array.from(map.values());
});

watch(searchQuery, (newVal) => {
  if (newVal.trim() !== '') {
    groupedShareData.value.forEach(group => {
      expandedGroups.value.add(group.ShareFileId);
    });
  }
});

// --- 方法 ---
const toggleExpand = (fileId: string) => {
  if (expandedGroups.value.has(fileId)) expandedGroups.value.delete(fileId);
  else expandedGroups.value.add(fileId);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm');
};

const isExpired = (endValidityStr: string) => {
  if (!endValidityStr) return false;
  return dayjs().isAfter(dayjs(endValidityStr));
};

const copyLink = (shareId: string, password?: string | null) => {
  const link = `${window.location.origin}/share/${shareId}`;
  let text = `分享链接: ${link}`;
  if (password) text += `\n提取码: ${password}`;

  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('分享链接及提取码已复制');
  }).catch(() => ElMessage.error('复制失败，请手动操作'));
};

const deleteShare = async (shareId: FileShareInfo) => {
  const info = await FileApi.UpdateShareFileInfo(shareId.Id, null, true)
  if (info.Status === 0) {
    ElMessage.success('已取消分享');
    rawData.value = rawData.value.filter(x => x.Id !== shareId.Id);
  } else {
    ElMessage.error('取消失败：' + info.Msg);
  }
};

const openCreateDialog = (group: GroupedShare) => {
  currentShareTarget.value = {
    fileId: group.ShareFileId,
    fileName: group.FileName,
    editData: null
  };
  shareDialogVisible.value = true;
};

const openEditDialog = (share: FileShareInfo, group: GroupedShare) => {
  currentShareTarget.value = {
    fileId: group.ShareFileId,
    fileName: group.FileName,
    editData: share
  };
  shareDialogVisible.value = true;
};

const handleShareSuccess = () => {
  refreshShareList();
  console.log("操作成功，刷新列表");
};

// 【修改】加入防抖与动画状态的刷新方法
const refreshShareList = async () => {
  if (isRefreshing.value) return; // 防止重复点击
  isRefreshing.value = true;

  try {
    const info = await FileApi.GetShareFilesInfoPrivate();
    if (info && info.Data) {
      rawData.value = info.Data;
    }
  } catch (error) {
    console.error("刷新列表失败:", error);
    ElMessage.error("刷新列表失败");
  } finally {
    // 强制延迟至少300ms，保证刷新动画能让用户看清楚
    setTimeout(() => {
      isRefreshing.value = false;
    }, 300);
  }
}

// 初始化
onMounted(async () => {
  await refreshShareList()
  if (groupedShareData.value.length > 0) expandedGroups.value.add(groupedShareData.value[0].ShareFileId);
});
</script>

<style scoped>
/* Fluent 风格容器及头部 */
.fluent-share-manager { max-width: 1100px; margin: 0 auto; padding: 10px; }

/* 头部布局 */
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; }
.header-left { display: flex; align-items: center; gap: 15px; }
.header-icon { font-size: 32px; color: var(--accent-color); background: color-mix(in srgb, var(--accent-color), transparent 85%); padding: 12px; border-radius: 12px; }
.header-text h2 { font-size: 20px; font-weight: 600; margin: 0 0 4px 0; color: var(--text-primary); }
.header-text p { margin: 0; font-size: 13px; color: var(--text-secondary); }

/* --- 【修改】右侧容器加入 Flex 与间距适配刷新按钮 --- */
.header-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 搜索框样式 */
.fluent-search-box {
  display: flex;
  align-items: center;
  background-color: var(--main-content-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0 12px;
  height: 38px;
  width: 280px;
  transition: all 0.2s;
}
.fluent-search-box:focus-within {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color), transparent 80%);
}
.fluent-search-box .search-icon { color: var(--text-secondary); font-size: 14px; margin-right: 8px; }
.fluent-search-box .search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  width: 100%;
}
.fluent-search-box .search-input::placeholder { color: color-mix(in srgb, var(--text-secondary), transparent 30%); }
.fluent-search-box .clear-icon { color: var(--text-secondary); cursor: pointer; font-size: 14px; padding: 4px; border-radius: 50%; transition: background-color 0.2s; }
.fluent-search-box .clear-icon:hover { background-color: var(--bg-hover); color: var(--text-primary); }

/* 头部独立刷新按钮样式 */
.top-refresh-btn {
  height: 38px;
  width: 38px;
  border-radius: 6px;
  font-size: 15px;
}

@media (max-width: 600px) {
  .header-right { width: 100%; }
  .fluent-search-box { flex: 1; width: auto; }
}

/* 列表容器 */
.share-list-container { display: flex; flex-direction: column; gap: 12px; }
.empty-state { text-align: center; padding: 60px 0; color: var(--text-secondary); }
.empty-state i { font-size: 40px; margin-bottom: 10px; opacity: 0.5;}

/* 分组卡片 (Fluent 卡片效果) */
.share-group-card { background-color: var(--main-content-bg); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; transition: all 0.2s ease; }
.share-group-card:hover { border-color: color-mix(in srgb, var(--border-color), var(--text-secondary) 20%); }
.share-group-card.is-expanded { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border-color: var(--border-color); }
:global([data-theme='dark']) .share-group-card.is-expanded { box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); }

/* 分组头部 */
.group-header { display: flex; align-items: center; padding: 14px 20px; cursor: pointer; background-color: transparent; transition: background-color 0.2s; }
.group-header:hover { background-color: var(--bg-hover); }
.file-icon { font-size: 20px; margin-right: 15px; }
.file-name { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.group-meta { display: flex; align-items: center; gap: 15px; }
.share-count { font-size: 13px; color: var(--text-secondary); background: var(--bg-active); padding: 2px 10px; border-radius: 12px; }
.expand-icon { font-size: 12px; color: var(--text-secondary); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.is-expanded .expand-icon { transform: rotate(180deg); }

/* 分组内容区 */
.group-body { border-top: 1px solid var(--border-color); background-color: var(--bg-hover); }
.share-items-wrapper { padding: 15px; display: flex; flex-direction: column; gap: 10px; }

/* 单个分享链接卡片 */
.share-item { display: flex; justify-content: space-between; align-items: center; background-color: var(--main-content-bg); border: 1px solid var(--border-color); padding: 12px 15px; border-radius: 6px; transition: all 0.2s; }
.share-item:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); transform: translateY(-1px); }
:global([data-theme='dark']) .share-item:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); }

/* 分享项信息布局 */
.share-info-main { display: flex; flex-direction: column; gap: 8px; }
.info-row { display: flex; align-items: center; gap: 12px; font-size: 14px; }
.info-icon { color: var(--text-secondary); font-size: 14px; }
/* 修改 share-id 的基础样式，去除默认下划线 */
.share-id.share-link {
  font-family: Consolas, monospace;
  color: var(--text-primary);
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s;
  cursor: pointer;
}

/* 鼠标悬浮时变成主题色，并显示下划线提示可点击 */
.share-id.share-link:hover {
  color: var(--accent-color);
  text-decoration: underline;
}

/* 适配过期状态：过期后不能点击，恢复普通的灰色和删除线 */
.share-item.is-expired .share-id.share-link {
  color: var(--text-secondary);
  text-decoration: line-through;
  pointer-events: none; /* 禁用点击事件 */
  cursor: not-allowed;
}
.pwd-tag { font-size: 12px; background-color: rgba(230, 162, 60, 0.1); color: #e6a23c; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
.pwd-tag.public { background-color: rgba(103, 194, 58, 0.1); color: #67c23a; }
.info-row.secondary { font-size: 12px; color: var(--text-secondary); gap: 20px; }
.intro-text { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 操作按钮体系 */
.share-actions { display: flex; gap: 8px; }
.fluent-action-btn { background-color: transparent; border: 1px solid transparent; color: var(--text-secondary); width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
.fluent-action-btn:hover { background-color: var(--bg-hover); color: var(--accent-color); border-color: var(--border-color); }
.fluent-action-btn.primary-subtle:hover { background-color: rgba(64, 158, 255, 0.1); color: var(--accent-color); border-color: rgba(64, 158, 255, 0.2); }
.fluent-action-btn.danger:hover { color: #f56c6c; background-color: #fef0f0; border-color: #fbc4c4; }
:global([data-theme='dark']) .fluent-action-btn.danger:hover { background-color: rgba(245, 108, 108, 0.1); border-color: rgba(245, 108, 108, 0.2); }

/* 过期相关的样式 */
.pwd-tag.expired-tag { background-color: rgba(245, 108, 108, 0.1); color: #f56c6c; border: 1px solid rgba(245, 108, 108, 0.2); }
.share-item.is-expired { opacity: 0.65; background-color: var(--bg-hover); }
.share-item.is-expired .share-id { text-decoration: line-through; color: var(--text-secondary); }
.share-item.is-expired:hover { opacity: 0.9; }

@media (max-width: 768px) {
  .fluent-share-manager {
    padding: 0;
  }

  .page-header,
  .header-left,
  .group-header,
  .share-item,
  .info-row,
  .group-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-icon {
    font-size: 24px;
    padding: 10px;
  }

  .header-right,
  .fluent-search-box {
    width: 100%;
  }

  .group-header,
  .share-item {
    gap: 10px;
  }

  .share-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .info-row.secondary {
    gap: 8px;
  }

  .intro-text {
    max-width: 100%;
  }
}
</style>
