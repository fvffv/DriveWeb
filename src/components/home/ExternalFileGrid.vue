<script setup lang="ts">
import { computed } from 'vue';
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus';
import Home from '@/store/home.ts';

const homeStore = Home();

export interface ExternalFileItem {
  fsId: string;
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  modifiedAt: number;
}

const props = defineProps<{
  folders: ExternalFileItem[];
  files: ExternalFileItem[];
  loading?: boolean;
  path: string;
  selectedKeys: string[];
}>();

const emit = defineEmits<{
  (event: 'open-folder', item: ExternalFileItem): void;
  (event: 'download', item: ExternalFileItem): void;
  (event: 'toggle-selection', item: ExternalFileItem): void;
  (event: 'toggle-all', items: ExternalFileItem[]): void;
  (event: 'command', command: 'download' | 'rename' | 'move' | 'delete', item: ExternalFileItem): void;
}>();

const itemKey = (item: ExternalFileItem) => item.path || item.fsId;
const isSelected = (item: ExternalFileItem) => props.selectedKeys.includes(itemKey(item));
const isAllSelected = (items: ExternalFileItem[]) => items.length > 0 && items.every(isSelected);
const isIndeterminate = (items: ExternalFileItem[]) => items.some(isSelected) && !isAllSelected(items);

const formatSize = (value: number) => {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const formatDate = (value: number) => value ? new Date(value * 1000).toLocaleString() : '—';

const empty = computed(() => !props.loading && !props.folders.length && !props.files.length);
</script>

<template>
  <div class="external-grid-shell">
    <div v-if="loading" class="external-grid-state">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>正在读取网盘目录…</span>
    </div>

    <template v-else>
      <section v-if="folders.length" class="external-grid-section">
        <div class="section-header">
          <span class="section-label">文件夹 <span class="count-tag">({{ folders.length }})</span></span>
          <button class="select-all-chip" :class="{ 'is-active': isAllSelected(folders), 'is-indeterminate': isIndeterminate(folders) }" @click="emit('toggle-all', folders)">
            <span class="icon-box"><i v-if="isAllSelected(folders)" class="fa-solid fa-check"></i><i v-else-if="isIndeterminate(folders)" class="fa-solid fa-minus"></i><span v-else class="circle-outline"></span></span>
            {{ isAllSelected(folders) ? '已全选' : '全选' }}
          </button>
        </div>

        <div class="external-grid">
          <article v-for="item in folders" :key="itemKey(item)" class="external-file-card" :class="{ 'is-selected': isSelected(item) }" @dblclick="emit('open-folder', item)">
            <button class="select-check" :aria-label="`选择 ${item.name}`" @click.stop="emit('toggle-selection', item)"><i v-if="isSelected(item)" class="fa-solid fa-check"></i></button>
            <el-dropdown class="more-actions-dropdown" trigger="click" placement="bottom-end" @command="(command: 'rename' | 'move' | 'delete') => emit('command', command, item)" @click.stop>
              <button class="more-actions-btn" title="更多操作" @click.stop><i class="fa-solid fa-ellipsis-vertical"></i></button>
              <template #dropdown><el-dropdown-menu><el-dropdown-item command="rename"><i class="fa-solid fa-pen-to-square"></i>重命名</el-dropdown-item><el-dropdown-item command="move"><i class="fa-solid fa-folder-tree"></i>移动</el-dropdown-item><el-dropdown-item command="delete" divided class="external-delete-command"><i class="fa-solid fa-trash-can"></i>删除</el-dropdown-item></el-dropdown-menu></template>
            </el-dropdown>
            <span class="external-card-icon folder"><i class="fa-solid fa-folder"></i></span>
            <span class="external-card-name" :title="item.name">{{ item.name }}</span>
            <span class="external-card-meta">{{ formatDate(item.modifiedAt) }}</span>
          </article>
        </div>
      </section>

      <section v-if="files.length" class="external-grid-section">
        <div class="section-header">
          <span class="section-label">文件 <span class="count-tag">({{ files.length }})</span></span>
          <button class="select-all-chip" :class="{ 'is-active': isAllSelected(files), 'is-indeterminate': isIndeterminate(files) }" @click="emit('toggle-all', files)">
            <span class="icon-box"><i v-if="isAllSelected(files)" class="fa-solid fa-check"></i><i v-else-if="isIndeterminate(files)" class="fa-solid fa-minus"></i><span v-else class="circle-outline"></span></span>
            {{ isAllSelected(files) ? '已全选' : '全选' }}
          </button>
        </div>

        <div class="external-grid">
          <article v-for="item in files" :key="itemKey(item)" class="external-file-card" :class="{ 'is-selected': isSelected(item) }" @dblclick="emit('download', item)">
            <button class="select-check" :aria-label="`选择 ${item.name}`" @click.stop="emit('toggle-selection', item)"><i v-if="isSelected(item)" class="fa-solid fa-check"></i></button>
            <el-dropdown class="more-actions-dropdown" trigger="click" placement="bottom-end" @command="(command: 'download' | 'rename' | 'move' | 'delete') => emit('command', command, item)" @click.stop>
              <button class="more-actions-btn" title="更多操作" @click.stop><i class="fa-solid fa-ellipsis-vertical"></i></button>
              <template #dropdown><el-dropdown-menu><el-dropdown-item command="download"><i class="fa-solid fa-download"></i>下载</el-dropdown-item><el-dropdown-item command="rename" divided><i class="fa-solid fa-pen-to-square"></i>重命名</el-dropdown-item><el-dropdown-item command="move"><i class="fa-solid fa-folder-tree"></i>移动</el-dropdown-item><el-dropdown-item command="delete" divided class="external-delete-command"><i class="fa-solid fa-trash-can"></i>删除</el-dropdown-item></el-dropdown-menu></template>
            </el-dropdown>
            <span class="external-card-icon" :style="{ color: homeStore.getFileIconColor(item.name) }"><i :class="homeStore.getFileIconClass(item.name)"></i></span>
            <span class="external-card-name" :title="item.name">{{ item.name }}</span>
            <span class="external-card-meta">{{ formatSize(item.size) }} · {{ formatDate(item.modifiedAt) }}</span>
          </article>
        </div>
      </section>

      <div v-if="empty" class="external-grid-state empty"><i class="fa-solid fa-box-open"></i><strong>当前目录为空</strong><span>{{ path }}</span></div>
    </template>
  </div>
</template>

<style scoped>
.external-grid-shell { min-height:220px; }
.external-grid-section { margin-bottom:22px; }
.section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:15px; padding:0 2px; }
.section-label { display:flex; align-items:center; gap:8px; color:var(--text-primary); font-size:15px; font-weight:700; letter-spacing:.5px; }
.count-tag { color:var(--text-secondary); font-size:12px; font-weight:400; }
.select-all-chip { display:flex; align-items:center; gap:7px; padding:6px 11px; border:1px solid transparent; border-radius:20px; color:var(--text-secondary); background:var(--bg-hover); cursor:pointer; font-size:13px; transition:all .2s ease; }
.select-all-chip:hover { border-color:rgba(64,158,255,.2); color:var(--accent-color); transform:translateY(-1px); }
.select-all-chip.is-active { border-color:rgba(64,158,255,.25); color:var(--accent-color); background:rgba(64,158,255,.1); }
.select-all-chip.is-indeterminate { color:var(--text-secondary); background:rgba(144,147,153,.14); }
.icon-box { display:flex; width:14px; height:14px; align-items:center; justify-content:center; font-size:11px; }
.circle-outline { width:12px; height:12px; border:1.5px solid currentColor; border-radius:50%; }
.external-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:12px; }
.external-file-card { position:relative; display:flex; padding:20px 10px; flex-direction:column; align-items:center; border:1px solid transparent; border-radius:8px; color:var(--text-primary); background:transparent; cursor:default; text-align:center; user-select:none; transition:all .2s ease-in-out; }
.external-file-card:hover { border-color:var(--border-color); background:var(--bg-hover); }
.external-file-card.is-selected { border-color:color-mix(in srgb,var(--accent-color),transparent 70%); background:var(--bg-active); }
.external-file-card.is-selected:hover { background:color-mix(in srgb,var(--bg-active),#000 5%); }
.external-card-icon { display:flex; width:42px; height:42px; align-items:center; justify-content:center; margin-bottom:14px; color:var(--accent-color); font-size:42px; transition:transform .2s ease; }
.external-file-card:hover .external-card-icon { transform:scale(1.05); }
.external-card-icon.folder { color:#fdd835; }
.external-card-name,.external-card-meta { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.external-card-name { width:100%; padding:0 4px; font-size:13px; }
.external-card-meta { margin-top:6px; color:var(--text-secondary); font-size:11px; }
.select-check { position:absolute; top:8px; left:8px; display:flex; width:20px; height:20px; align-items:center; justify-content:center; border:1px solid var(--border-color); border-radius:5px; color:#fff; background:var(--main-content-bg); cursor:pointer; opacity:0; transition:all .2s ease; }
.external-file-card:hover .select-check,.external-file-card.is-selected .select-check { opacity:1; }
.external-file-card.is-selected .select-check { border-color:var(--accent-color); background:var(--accent-color); }
.select-check i { font-size:12px; }
.more-actions-dropdown { position:absolute; top:8px; right:8px; z-index:2; opacity:0; transition:opacity .2s ease; }
.external-file-card:hover .more-actions-dropdown { opacity:1; }
.more-actions-btn { display:flex; width:24px; height:24px; align-items:center; justify-content:center; border:1px solid var(--border-color); border-radius:6px; color:var(--text-secondary); background:var(--main-content-bg); cursor:pointer; }
.more-actions-btn:hover { color:var(--accent-color); background:var(--bg-hover); }
.external-grid-state { display:flex; min-height:220px; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:var(--text-secondary); }
.external-grid-state i { color:var(--accent-color); font-size:30px; }
.external-grid-state.empty i { opacity:.55; font-size:48px; }
.external-grid-state strong { color:var(--text-primary); font-size:15px; }
@media (max-width:640px) { .external-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; } .select-check,.more-actions-dropdown { opacity:1; } }
</style>

<style>
.external-delete-command { color:#f56c6c !important; }
.external-delete-command:hover { color:#f56c6c !important; background:rgba(245,108,108,.1) !important; }
</style>
