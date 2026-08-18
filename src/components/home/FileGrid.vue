<script setup>
import { computed, ref, watch, toRaw, onMounted, onUnmounted ,nextTick} from 'vue';
import FileItem from './FileItem.vue';
import Home from '@/store/home.ts';
// 增一个锁，防止滚动过快触发多次重复请求
const isLoadingFromServer = ref(false);
// 1. 定义 Props
const props = defineProps({
  title: String,
  type: Number, // 0: Folder, 1: File
});

const homeStore = Home();
const emit = defineEmits(['open-folder', 'open-file', 'file-command']);

// --- 🌟 性能优化：滚动加载 + 丝滑过渡逻辑 ---
const displayList = ref([]); // 渲染到页面的浅层数组
const sentinelRef = ref(null); // 触底监听的 DOM 节点
const pageSize = 60; // 每次加载数量
let observer = null; // 观察器实例

// 新增：导航加载状态与防御版本号
const isNavigating = ref(false);
let navVersion = 0;

// 获取当前原始数据源，并切断深层响应式，极大提升性能
const rawSourceList = computed(() => {
  const source = props.type === 0 ? homeStore.FilterFolderInfo : homeStore.FilterFileInfo;
  return source ? toRaw(source) : [];
});

// 🌟 新增：判断是否整个目录全空（既没有文件夹也没有文件）
const isDirectoryEmpty = computed(() => {
  const folderCount = homeStore.FilterFolderInfo ? homeStore.FilterFolderInfo.length : 0;
  const fileCount = homeStore.FilterFileInfo ? homeStore.FilterFileInfo.length : 0;
  return folderCount === 0 && fileCount === 0;
});

// 计算是否还有更多数据没有加载
const hasMore = computed(() => {
  if (props.type === 0) {
    // 文件夹：看本地是否还有未渲染的
    return rawSourceList.value.length > displayList.value.length;
  } else {
    // 文件：本地有未渲染的 OR 本地总数小于服务端真实总数
    return (rawSourceList.value.length > displayList.value.length) ||
        (rawSourceList.value.length < homeStore.TotalFileCount);
  }
});
const displayTotalCount = computed(() => {
  // 如果是文件类型，并且后端总数大于0，就展示后端的真实总数
  if (props.type === 1 && homeStore.TotalFileCount > 0) {
    return homeStore.TotalFileCount;
  }
  // 文件夹或者后端总数没拿到的情况，直接展示当前缓存的长度
  return rawSourceList.value.length;
});
// 加载下一批数据的方法（纯同步，非常快）
const loadNextBatch = async () => {
  const source = rawSourceList.value;
  const currentLength = displayList.value.length;

  // 情况 A：本地(Pinia)里还有未渲染到屏幕上的数据
  if (currentLength < source.length) {
    const nextBatch = source.slice(currentLength, currentLength + pageSize);
    displayList.value.push(...nextBatch);
    return;
  }

  // 情况 B：本地所有数据都已经渲染完了，需要去后端拉取下一页
  if (props.type === 1 && source.length < homeStore.TotalFileCount && !isLoadingFromServer.value) {
    isLoadingFromServer.value = true;
    try {
      await homeStore.setUserDirectoryFileInfo(
          homeStore.currentFolder.Id,
          homeStore.CurrentPageIndex + 1,
          homeStore.PageSize
      );

      // 【关键修复点】：后端数据拉取成功并放入 store 后，
      // 主动再调一次自己，让他去走上面的“情况 A”，把刚拿到的数据立刻渲染到屏幕上！
      nextTick(() => {
        loadNextBatch();
      });

    } finally {
      isLoadingFromServer.value = false;
    }
  }
};

// 监听数据源变化，加入骨架屏过渡缓冲
watch(
    () => [homeStore.currentFolder.Id, homeStore.DirRefreshTimestamp],
    (newValues, oldValues) => {
      const newId = newValues[0];
      const newTime = newValues[1];
      const oldId = oldValues?.[0];
      const oldTime = oldValues?.[1];

      // 如果文件夹没变，且刷新时间戳也没变（比如只是单纯追加下一页数据），则忽略
      if (newId === oldId && newTime === oldTime) return;

      navVersion++;
      const currentVersion = navVersion;
      isNavigating.value = true;
      displayList.value = [];

      setTimeout(() => {
        if (currentVersion !== navVersion) return;

        if (rawSourceList.value && rawSourceList.value.length > 0) {
          // 只截取前 pageSize 个放到 displayList 中
          const nextBatch = rawSourceList.value.slice(0, pageSize);
          displayList.value.push(...nextBatch);
        }
        isNavigating.value = false;
      }, 150);
    },
    { immediate: true }
);

// 组件挂载时，初始化交叉观察器
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    const sentinel = entries[0];
    if (sentinel.isIntersecting && hasMore.value && !isNavigating.value) {
      loadNextBatch();
    }
  }, {
    root: null,
    rootMargin: '300px',
  });

  if (sentinelRef.value) {
    observer.observe(sentinelRef.value);
  }
});

// 组件卸载时清理观察器
onUnmounted(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});

// --- 核心业务逻辑 ---

const currentSelectedList = computed(() => {
  return props.type === 0 ? homeStore.selectedFolders : homeStore.selectedFiles;
});

const isAllSelected = computed(() => {
  const source = rawSourceList.value;
  const selected = currentSelectedList.value;
  if (source.length === 0) return false;
  return source.length > 0 && source.length === selected.length;
});

const isIndeterminate = computed(() => {
  const source = rawSourceList.value;
  const selected = currentSelectedList.value;
  if (source.length === 0 || selected.length === 0) return false;
  return selected.length > 0 && selected.length < source.length;
});

const toggleSelectAll = () => {
  const source = rawSourceList.value;
  const targetList = props.type === 0 ? homeStore.selectedFolders : homeStore.selectedFiles;

  if (isAllSelected.value) {
    targetList.length = 0;
  } else {
    targetList.length = 0;
    targetList.push(...source);
  }
};

const toggleFileSelection = (item) => {
  const list = props.type === 0 ? homeStore.selectedFolders : homeStore.selectedFiles;
  const index = list.findIndex(selectedItem => toRaw(selectedItem) === toRaw(item));

  if (index > -1) {
    list.splice(index, 1);
  } else {
    list.push(item);
  }
};

const handleOpenFolder = (folder) => emit('open-folder', folder);
const handleOpenFile = (fileName) => emit('open-file', fileName);
const handleFileCommand = (payload) => emit('file-command', payload);
</script>

<template>
  <div class="file-grid-wrapper">
    <div class="section-header" v-show="rawSourceList.length > 0 || isNavigating">
      <div class="section-label">
        {{ title }}
        <span class="count-tag" v-if="rawSourceList.length > 0">
          ({{ displayTotalCount }})
        </span>
      </div>

      <div
          class="select-all-chip"
          :class="{
          'is-active': isAllSelected,
          'is-indeterminate': isIndeterminate && !isAllSelected
        }"
          @click="toggleSelectAll"
          v-if="rawSourceList.length > 0"
      >
        <div class="icon-box">
          <i v-if="isAllSelected" class="fa-solid fa-check icon-symbol"></i>
          <i v-else-if="isIndeterminate" class="fa-solid fa-minus icon-symbol"></i>
          <div v-else class="circle-outline"></div>
        </div>
        <span class="chip-text">{{ isAllSelected ? '已全选' : '全选' }}</span>
      </div>
    </div>

    <div class="grid-container" :class="{ 'fade-in-active': !isNavigating }" v-show="rawSourceList.length > 0 || isNavigating">
      <FileItem
          v-for="item in displayList"
          :key="item.Id"
          :item="item"
          :type="props.type"
          :is-selected="currentSelectedList.includes(item)"
          @toggle-select="toggleFileSelection(item)"
          @open-file="props.type === 0 ? handleOpenFolder(item) : handleOpenFile(item)"
          @file-command="handleFileCommand"
      />

      <template v-if="isNavigating">
        <div v-for="i in 15" :key="'nav-skeleton-' + i" class="skeleton-item">
          <div class="skeleton-icon"></div>
          <div class="skeleton-text"></div>
        </div>
      </template>

      <template v-else-if="hasMore">
        <div v-for="i in 5" :key="'scroll-skeleton-' + i" class="skeleton-item">
          <div class="skeleton-icon"></div>
          <div class="skeleton-text"></div>
        </div>
      </template>

      <div ref="sentinelRef" class="sentinel-node"></div>
    </div>

    <div class="empty-state" v-if="!isNavigating && isDirectoryEmpty && props.type === 1">
      <div class="empty-icon">
        <i class="fa-solid fa-box-open"></i>
      </div>
      <div class="empty-text">这里空空如也</div>
      <div class="empty-subtext">当前目录下没有任何文件或文件夹</div>
    </div>
  </div>
</template>

<style scoped>
.file-grid-wrapper {
  margin-bottom: 20px;
}

/* 标题栏、胶囊按钮等样式保持完全不变 */
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 0 2px; }
.section-label { font-size: 15px; font-weight: 700; color: var(--text-primary); letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }
.count-tag { font-size: 12px; color: var(--text-secondary); font-weight: normal; }
.select-all-chip { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 20px; background-color: var(--bg-hover, #f2f3f5); cursor: pointer; transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1); border: 1px solid transparent; user-select: none; }
.select-all-chip:hover { background-color: #e5e6eb; transform: translateY(-1px); }
.select-all-chip:active { transform: translateY(0); }
.select-all-chip.is-active { background-color: rgba(64, 158, 255, 0.1); color: var(--accent-color, #409eff); border-color: rgba(64, 158, 255, 0.2); }
.select-all-chip.is-indeterminate { background-color: rgba(144, 147, 153, 0.15); color: var(--text-secondary); border-color: rgba(144, 147, 153, 0.2); }
.icon-box { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; }
.circle-outline { width: 13px; height: 13px; border: 1.5px solid #c0c4cc; border-radius: 50%; transition: border-color 0.2s; }
.select-all-chip:hover .circle-outline { border-color: #909399; }
.icon-symbol { font-size: 12px; animation: scaleIn 0.2s ease-out; }
.chip-text { font-size: 13px; font-weight: 500; color: var(--text-secondary); transition: color 0.2s; }
.select-all-chip.is-active .chip-text { color: var(--accent-color, #409eff); font-weight: 600; }
@keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* 网格与渐现动画 */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  opacity: 0.6;
  transition: opacity 0.3s ease-out;
}
.fade-in-active {
  opacity: 1;
}

/* 骨架屏样式保持不变 */
.skeleton-item {
  height: 120px;
  border-radius: 8px;
  background-color: var(--bg-hover, #f5f7fa);
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  animation: pulse 1.5s infinite ease-in-out;
}
.skeleton-icon { width: 40px; height: 40px; border-radius: 8px; background-color: rgba(144, 147, 153, 0.2); }
.skeleton-text { width: 80%; height: 12px; border-radius: 4px; background-color: rgba(144, 147, 153, 0.2); }
@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

/* 哨兵节点 */
.sentinel-node {
  height: 1px;
  width: 100%;
  pointer-events: none;
  visibility: hidden;
}

/* 🌟 新增：空状态样式 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--text-secondary);
  animation: scaleIn 0.3s ease-out;
}

.empty-icon {
  font-size: 54px;
  margin-bottom: 16px;
  opacity: 0.5;
  color: var(--accent-color);
}

.empty-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-subtext {
  font-size: 13px;
  color: var(--text-secondary);
  opacity: 0.8;
}

@media (max-width: 640px) {
  .section-header {
    gap: 10px;
    align-items: flex-start;
    flex-direction: column;
  }

  .grid-container {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}
</style>
