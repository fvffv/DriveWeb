<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  ElMenu, ElMenuItem, ElDialog, ElForm, ElFormItem,
  ElInput, ElButton, ElMessage, ElMessageBox, ElTooltip, ElRadioGroup, ElRadio, type FormInstance
} from 'element-plus';

import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/form/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/tooltip/style/css';
import 'element-plus/es/components/radio/style/css';
import 'element-plus/es/components/radio-group/style/css';

import Home from '@/store/home.ts';
import Setting from "@/store/setting.js";
import { UserApi } from "@/commands/user";
import { CustomView } from "@/models/user_models";
import { CloudDriveType, EdriveApi, type ExternalDriveAccount } from "@/commands/edrive";

const settingStore = Setting();
const homeStore = Home();

const props = defineProps<{ activeNavItem: string }>();
const emit = defineEmits(['navigate', 'custom-filter','selectView', 'external-add', 'external-select', 'external-deleted', 'close']);

const externalDrives = ref<ExternalDriveAccount[]>([]);
const externalDrivesLoading = ref(false);
const externalTokenVersion = ref(0);
const selectedExternalDriveId = ref('');

const externalDriveId = (drive: ExternalDriveAccount) => String(drive.external_id || '');
const externalDriveType = (drive: ExternalDriveAccount) => Number(drive.drive_type ?? 0);
const externalDriveName = (drive: ExternalDriveAccount) => drive.display_name || '外部网盘';
const externalDriveTypeName = (type: number) => {
  if (type === CloudDriveType.Baidu) return '百度网盘';
  if (type === CloudDriveType.Aliyun) return '阿里云盘';
  if (type === CloudDriveType.OneDrive) return 'OneDrive';
  return `网盘 ${type}`;
};
const externalTokenKey = (id: string) => `external-drive-access-token:${id}`;
const hasExternalToken = (drive: ExternalDriveAccount) => {
  externalTokenVersion.value;
  return Boolean(localStorage.getItem(externalTokenKey(externalDriveId(drive))));
};

const loadExternalDrives = async () => {
  externalDrivesLoading.value = true;
  try {
    const response = await EdriveApi.GetExternalDriveList();
    if (response.Status === 0) externalDrives.value = Array.isArray(response.Data) ? response.Data : [];
    else ElMessage.error(response.Msg || '获取外部网盘列表失败');
  } catch {
    ElMessage.error('获取外部网盘列表失败');
  } finally {
    externalDrivesLoading.value = false;
  }
};

const refreshExternalDrives = async () => {
  externalTokenVersion.value++;
  await loadExternalDrives();
};
defineExpose({ refreshExternalDrives });

const externalMenuIndex = (drive: ExternalDriveAccount) => `external-drive:${externalDriveId(drive)}`;

const removeExternalDrive = async (drive: ExternalDriveAccount, event?: Event) => {
  event?.stopPropagation();
  const id = externalDriveId(drive);
  if (!id) return;
  try {
    await ElMessageBox.confirm(`确定删除“${externalDriveName(drive)}”吗？`, '删除外部网盘', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    });
    const response = await EdriveApi.DeleteExternalDrive(id);
    if (response.Status !== 0) {
      ElMessage.error(response.Msg || '删除失败');
      return;
    }
    localStorage.removeItem(externalTokenKey(id));
    externalDrives.value = externalDrives.value.filter(item => externalDriveId(item) !== id);
    if (selectedExternalDriveId.value === id) selectedExternalDriveId.value = '';
    externalTokenVersion.value++;
    emit('external-deleted', id);
    ElMessage.success('外部网盘已删除');
  } catch (error: any) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('删除外部网盘失败');
  }
};

onMounted(loadExternalDrives);

// --- 常量配置 ---
const availableIcons = [
  'fa-solid fa-filter', 'fa-solid fa-folder', 'fa-solid fa-image',
  'fa-solid fa-film', 'fa-solid fa-music', 'fa-solid fa-file-lines',
  'fa-solid fa-file-zipper', 'fa-solid fa-file-word', 'fa-solid fa-file-excel',
  'fa-solid fa-file-pdf', 'fa-solid fa-code', 'fa-solid fa-database',
  'fa-solid fa-star', 'fa-solid fa-heart', 'fa-solid fa-tag', 'fa-solid fa-bookmark',
  'fa-solid fa-plane', 'fa-solid fa-gamepad', 'fa-solid fa-book'
];

const defaultMenu = [{Name:'我的文件'},{Name:'搜索'},{Name:'分享管理'},{Name:'统计看板'},{Name:'设置'}]

const adminMenu = [
  {Name:'主页看板', Icon: 'fa-chart-pie'},
  {Name:'用户管理', Icon: 'fa-users'},
  {Name:'全局文件管理', Icon: 'fa-folder-tree'},
  {Name:'系统设置', Icon: 'fa-sliders'},
  {Name:'日志和重启', Icon: 'fa-server'}
];

const standardCategories = [
  { Name: '所有文档', keywordsInput: '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.txt,.md', Icon: 'fa-file-lines' },
  { Name: '所有图片', keywordsInput: '.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.ico,.tiff', Icon: 'fa-image' },
  { Name: '所有视频', keywordsInput: '.mp4,.avi,.mkv,.mov,.wmv', Icon: 'fa-film' },
  { Name: '所有音频', keywordsInput: '.mp3,.wav,.flac,.aac', Icon: 'fa-music' },
  { Name: '压缩文件', keywordsInput: '.zip,.rar,.7z,.tar,.gz', Icon: 'fa-file-zipper' },
  { Name: '前端代码', keywordsInput: '.js,.ts,.vue,.html,.css,.json', Icon: 'fa-code' },
  { Name: '后端代码', keywordsInput: '.cs,.py,.java,.cpp,.go,.sql', Icon: 'fa-database' }
];

const UsedSpaceInGB = computed(() =>
    Number((homeStore.sci.UsedSpaceInBytes / 1024 / 1024 / 1024).toFixed(2))
);
const TotalSpaceInGB = computed(() =>
    Number((homeStore.sci.TotalSpaceInBytes / 1024 / 1024 / 1024).toFixed(2))
);

// 解析关键词：中英文逗号替换，分割去空
const parseKeywords = (input: string): string[] => {
  if (!input) return [];
  return input.replace(/，/g, ',').split(',').map(k => k.trim()).filter(k => k !== '');
};

// --- 弹窗与表单状态 ---
const dialogVisible = ref(false);
const formRef = ref<FormInstance>();
const isEditMode = ref(false);
const editingMenuId = ref<any>(null);

const newMenuForm = ref({
  Name: '',
  Type: 0, // 0:关键字, 1:路径快捷方式
  keywordsInput: '',
  Icon: 'fa-solid fa-filter'
});

// 自定义表单验证器 (动态适应Type)
const validateKeywords = (rule: any, value: string, callback: Function) => {
  if (!value) return callback(new Error(newMenuForm.value.Type === 0 ? '请输入包含关键字' : '请输入文件夹绝对路径'));

  if (newMenuForm.value.Type === 0) {
    const arr = parseKeywords(value);
    if (arr.length === 0) return callback(new Error('请输入有效的关键字'));
    if (arr.length > 20) return callback(new Error(`关键词最多不超过20个，当前有${arr.length}个`));
    const overLengthItem = arr.find(k => k.length > 10);
    if (overLengthItem) return callback(new Error(`单个关键词长度不能超过10，"${overLengthItem}" 超长了`));
  } else {
    // 校验路径格式
    if (!value.startsWith('/')) return callback(new Error('文件夹路径必须以 / 开头，例如: /图片/二次元'));
  }
  callback();
};

const rules = {
  Name: [
    { required: true, message: '请输入视图名称', trigger: 'blur' },
    { max: 20, message: '视图名称长度不能超过20个字符', trigger: 'blur' }
  ],
  keywordsInput: [
    { required: true, validator: validateKeywords, trigger: 'blur' }
  ]
};

// --- 核心业务逻辑 ---

const handleAutoCategorize = async () => {
  let addedCount = 0;
  standardCategories.forEach(cat => {
    if (!homeStore.customMenus.some((m: any) => m.Name === cat.Name)) {
      homeStore.customMenus.push({
        Name: cat.Name,
        Keywords: parseKeywords(cat.keywordsInput), // 适配新字段名
        Type: 0,
        Icon: cat.Icon
      });
      addedCount++;
    }
  });

  if (addedCount === 0) {
    return ElMessage.info('常用分类均已存在，无需重复添加');
  }

  try {
    const info = await UserApi.UpdateUserView(homeStore.customMenus);
    if (info.Status === 0) {
      ElMessage.success(`智能扫描完成！已自动为您添加 ${addedCount} 个常用分类视图`);
    } else {
      ElMessage.error(`分类失败: ${info.Msg}`);
    }
  } catch (error) {
    ElMessage.error('网络请求异常，请稍后重试');
  }
};

const openAddDialog = () => {
  isEditMode.value = false;
  editingMenuId.value = null;
  newMenuForm.value = { Name: '', Type: 0, keywordsInput: '', Icon: 'fa-solid fa-filter' };
  dialogVisible.value = true;
};

const openEditDialog = (item: any, event: Event) => {
  event.stopPropagation();
  isEditMode.value = true;
  editingMenuId.value = item.Name;

  newMenuForm.value = {
    Name: item.Name,
    Type: item.Type ?? 0,
    keywordsInput: item.Keywords ? item.Keywords.join(',') : '', // 适配新字段名
    Icon: item.Icon || 'fa-solid fa-filter'
  };
  dialogVisible.value = true;
};

const submitViewUpdate = async (successMsg: string) => {
  try {
    const info = await UserApi.UpdateUserView(homeStore.customMenus);
    if (info.Status === 0) {
      ElMessage.success(successMsg);
      dialogVisible.value = false;
    } else {
      ElMessage.error(`操作失败: ${info.Msg}`);
    }
  } catch (error) {
    ElMessage.error('服务器请求失败');
  }
};

const handleSaveMenu = () => {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;

    // 根据 Type 决定存储方式 (Type 1 时不分割路径里的逗号)
    const parsedKeywords = newMenuForm.value.Type === 0
        ? parseKeywords(newMenuForm.value.keywordsInput)
        : [newMenuForm.value.keywordsInput.trim()];

    if (isEditMode.value) {
      const index = homeStore.customMenus.findIndex((item: any) => item.Name === editingMenuId.value);
      if (index !== -1) {
        homeStore.customMenus[index].Name = newMenuForm.value.Name;
        homeStore.customMenus[index].Type = newMenuForm.value.Type;
        homeStore.customMenus[index].Keywords = parsedKeywords;
        homeStore.customMenus[index].Icon = newMenuForm.value.Icon;
        await submitViewUpdate('自定义视图修改成功');
      }
    } else {
      homeStore.customMenus.push({
        Name: newMenuForm.value.Name,
        Type: newMenuForm.value.Type,
        Keywords: parsedKeywords,
        Icon: newMenuForm.value.Icon
      });
      await submitViewUpdate('自定义视图添加成功');
    }
  });
};

const removeCustomMenu = async (name: string, event: Event) => {
  event.stopPropagation();
  homeStore.customMenus = homeStore.customMenus.filter((item: any) => item.Name !== name);
  try {
    const info = await UserApi.UpdateUserView(homeStore.customMenus);
    if (info.Status === 0) ElMessage.success('已删除自定义视图');
    else ElMessage.error(`自定义视图删除失败: ${info.Msg}`);
  } catch (error) {
    ElMessage.error('服务器请求失败');
  }
};

// --- 菜单交互核心逻辑 ---
const handleMenuSelect = (index: any) => {
  const menuIndex = String(index);
  if (menuIndex.startsWith('external-drive:')) {
    const id = menuIndex.slice('external-drive:'.length);
    const drive = externalDrives.value.find(item => externalDriveId(item) === id);
    if (drive) {
      selectedExternalDriveId.value = id;
      emit('external-select', drive);
    }
    emit('close');
    return;
  }
  // 外部网盘使用独立的选中状态；切换到任何其他导航时必须清除，确保全侧栏仅有一个选中项。
  selectedExternalDriveId.value = '';
  homeStore.menuName = index; // 更新可能用到此状态的依赖
  emit('navigate', index);
  emit('close');
};

// 关键：拦截点击自定义视图事件并处理文件夹跳转
const handleViewSelect = async (view: CustomView) => {
  if (view.Type === 1) {
    // === 类型 1：文件夹绝对路径跳转 ===
    const path = (view.Keywords && view.Keywords.length > 0) ? view.Keywords[0] : '/';

    try {
      // 1. 获取路径对应的文件夹 ID
      const res = await homeStore.getPullPathToFolderId(path);
      if (res.Status === 0 && res.Data) {
        const targetFolderId = res.Data;

        // 2. 加载该目录的最新文件列表 (当前 currentFolder.Id 会同步更新)
        await homeStore.setUserDirectoryFileInfo(targetFolderId);

        // 3. 强制更新当前所在路径 (这会直接驱动面包屑导航组件重新渲染)
        homeStore.currentPath = path;

        // 4. 通知父级将界面切回到文件列表看板
        emit('navigate', '我的文件');
        homeStore.menuName = '我的文件';
        emit('close');

      } else {
        ElMessage.error(`找不到指定路径，可能已被移动或删除: ${path}`);
      }
    } catch (error) {
      ElMessage.error('快捷跳转异常，请重试');
    }
  } else {
    // === 类型 0：普通的关键字筛选 ===
    emit('selectView', view);
    emit('close');
  }
};
</script>

<template>
  <nav class="sidebar">
    <div class="app-header">
      <i class="fa-solid fa-cloud" :style="{ color: 'var(--accent-color)' }"></i>
      <span>{{ settingStore.basicInfo.Name }}</span>
    </div>

    <el-menu
        @select="handleMenuSelect"
        class="fluent-menu"
        :default-active="activeNavItem"
    >
      <template v-if="settingStore.userInfo?.Status === 2">
        <div class="menu-group admin-group">
          <div class="group-header">
            <span class="group-title">管理员</span>
          </div>
          <el-menu-item v-for="item in adminMenu" :key="item.Name" :index="item.Name">
            <i :class="['fa-solid', item.Icon]"></i>
            <span>{{ item.Name }}</span>
          </el-menu-item>
        </div>
        <div class="menu-separator"></div>
      </template>

      <div class="menu-group">
        <el-menu-item :index="defaultMenu[0].Name">
          <i class="fa-solid fa-folder-closed"></i>
          <span>我的文件</span>
        </el-menu-item>
        <el-menu-item :index="defaultMenu[1].Name">
          <i class="fa-solid fa-magnifying-glass"></i>
          <span>搜索</span>
        </el-menu-item>
      </div>

      <div class="menu-separator"></div>

      <div class="menu-group custom-group">
        <div class="group-header">
          <span class="group-title">自定义视图与快捷方式</span>
          <div class="group-header-actions">
            <el-tooltip content="智能生成常用文件分类" placement="top" :show-after="300">
              <i class="fa-solid fa-wand-magic-sparkles action-btn magic-btn" @click="handleAutoCategorize"></i>
            </el-tooltip>
            <el-tooltip content="手动添加视图/快捷方式" placement="top" :show-after="300">
              <i class="fa-solid fa-plus action-btn add-btn" @click="openAddDialog"></i>
            </el-tooltip>
          </div>
        </div>

        <el-menu-item
            v-for="item in homeStore.customMenus"
            :key="item.Name"
            :index="item.Name"
            @click="handleViewSelect(item)"
        >
          <i :class="['fa-solid', item.Icon]" :style="{ color: item.Type === 1 ? '#e6a23c' : 'inherit' }"></i>
          <span class="menu-text">{{ item.Name }}</span>

          <div class="action-icons">
            <i class="fa-solid fa-pen edit-icon" @click="(e) => openEditDialog(item, e)" title="编辑"></i>
            <i class="fa-solid fa-xmark delete-icon" @click="(e) => removeCustomMenu(item.Name, e)" title="删除"></i>
          </div>
        </el-menu-item>

        <div v-if="homeStore.customMenus.length === 0" class="empty-tip">
          暂无数据，点击右上角 "魔棒" 或 "+" 添加
        </div>

        <div class="external-drive-menu-group">
          <div class="group-header">
            <span class="group-title">外部网盘</span>
            <div class="group-header-actions">
              <el-tooltip content="添加外部网盘" placement="top" :show-after="300">
                <i class="fa-solid fa-plus action-btn external-add-icon" @click.stop="emit('external-add')"></i>
              </el-tooltip>
            </div>
          </div>

          <div v-if="externalDrivesLoading" class="empty-tip">正在加载外部网盘…</div>
          <template v-else>
            <el-menu-item
                v-for="drive in externalDrives"
                :key="externalDriveId(drive)"
                :index="externalMenuIndex(drive)"
                class="external-drive-item"
                :class="{ 'external-drive-selected': selectedExternalDriveId === externalDriveId(drive) }"
            >
              <i :class="['fa-solid', externalDriveType(drive) === CloudDriveType.Baidu ? 'fa-cloud' : 'fa-cloud-arrow-up']"></i>
              <span class="external-drive-label">
                <span class="menu-text">{{ externalDriveName(drive) }}</span>
                <small>{{ externalDriveTypeName(externalDriveType(drive)) }}</small>
              </span>
              <span class="external-drive-status" :class="{ connected: hasExternalToken(drive) }" :title="hasExternalToken(drive) ? '已登录' : '未登录'"></span>
              <i class="fa-solid fa-xmark delete-icon external-delete-icon" title="删除" @click.stop="removeExternalDrive(drive, $event)"></i>
            </el-menu-item>
            <div v-if="externalDrives.length === 0" class="empty-tip">暂无数据，点击右上角 "+" 添加</div>
          </template>
        </div>
      </div>

      <div class="menu-separator"></div>

      <div class="menu-group">
        <el-menu-item :index="defaultMenu[2].Name">
          <i class="fa-solid fa-share-nodes"></i>
          <span>{{defaultMenu[2].Name}}</span>
        </el-menu-item>
        <el-menu-item :index="defaultMenu[3].Name">
          <i class="fa-solid fa-chart-simple"></i>
          <span>{{defaultMenu[3].Name}}</span>
        </el-menu-item>
        <el-menu-item :index="defaultMenu[4].Name">
          <i class="fa fa-cog" aria-hidden="true" />
          <span>{{defaultMenu[4].Name}}</span>
        </el-menu-item>
      </div>

    </el-menu>

    <div class="storage-widget">
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary);">
        <span>{{ UsedSpaceInGB }}GB / {{ TotalSpaceInGB }}GB</span>
      </div>
      <div class="progress-bar">
        <div class="progress-value" :style="{ width: (UsedSpaceInGB / TotalSpaceInGB) * 100 + '%' }"></div>
      </div>
    </div>
  </nav>

  <el-dialog
      v-model="dialogVisible"
      :title="isEditMode ? '编辑侧边栏视图' : '添加侧边栏视图'"
      width="420px"
      :class="['custom-sidebar-dialog', settingStore.theme]"
      align-center
      append-to-body
      destroy-on-close
  >
    <el-form :model="newMenuForm" :rules="rules" ref="formRef" label-position="top">
      <el-form-item label="视图名称" prop="Name">
        <el-input
            v-model="newMenuForm.Name"
            placeholder="例如：我的 PDF 报表 (最多20字符)"
            clearable
            maxlength="20"
            show-word-limit
        />
      </el-form-item>

      <el-form-item label="视图类型">
        <el-radio-group v-model="newMenuForm.Type">
          <el-radio :label="0">文件类型/关键字过滤</el-radio>
          <el-radio :label="1">文件夹快捷跳转</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item :label="newMenuForm.Type === 0 ? '包含关键字' : '目标文件夹路径'" prop="keywordsInput">
        <el-input
            v-model="newMenuForm.keywordsInput"
            :placeholder="newMenuForm.Type === 0 ? '多关键字用逗号隔开 (例如: .pdf, 报告) 不超过20个' : '请输入绝对路径，例如: /图片/二次元'"
            clearable
        />
      </el-form-item>

      <el-form-item label="选择图标">
        <div class="icon-picker-grid">
          <div
              v-for="icon in availableIcons"
              :key="icon"
              class="icon-picker-item"
              :class="{ 'is-selected': newMenuForm.Icon === icon }"
              @click="newMenuForm.Icon = icon"
          >
            <i :class="icon"></i>
          </div>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveMenu">
          {{ isEditMode ? '保存修改' : '确定添加' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 原有的侧边栏 CSS 样式全部保持不变 */
.sidebar { width: 280px; padding: 0 10px 20px 10px; display: flex; flex-direction: column; background-color: var(--sidebar-bg); flex-shrink: 0; transition: background-color 0.3s ease; height: 100%; }
.app-header { padding: 20px 15px; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 12px; }
.fluent-menu { background-color: transparent; border-right: none; flex: 1; overflow-y: auto; }
.fluent-menu::-webkit-scrollbar { width: 0px; }
.external-drive-menu-group { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color); }
.external-add-icon { width: auto !important; margin: 0 !important; }
.menu-separator { height: 1px; background-color: var(--border-color); margin: 10px 16px; transition: background-color 0.3s ease; }
.group-header { display: flex; justify-content: space-between; align-items: center; padding: 0 16px; margin-bottom: 8px; margin-top: 4px; }
.group-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); letter-spacing: 0.5px; }
.group-header-actions { display: flex; align-items: center; gap: 6px; }
.action-btn { font-size: 13px; color: var(--text-secondary); cursor: pointer; padding: 5px; border-radius: 4px; transition: all 0.2s; }
.action-btn:hover { background-color: var(--bg-hover); }
.magic-btn:hover { color: #9c27b0; }
.add-btn:hover { color: var(--accent-color); }
.empty-tip { font-size: 12px; color: var(--text-secondary); padding: 8px 16px; text-align: center; opacity: 0.7; }
.custom-group .el-menu-item { display: flex; align-items: center; padding-right: 12px !important; }
.external-drive-item { display: flex; align-items: center; gap: 0 !important; padding-right: 12px !important; }
.external-drive-item.external-drive-selected { color: var(--el-menu-active-color, var(--accent-color)); background-color: var(--bg-hover); }
.external-drive-item.external-drive-selected > i:first-child { color: var(--accent-color); }
.external-drive-item > i:first-child { color: var(--accent-color); }
.external-drive-label { display: flex; min-width: 0; flex: 1; flex-direction: column; justify-content: center; line-height: 1.2; }
.external-drive-label small { margin-top: 2px; color: var(--text-secondary); font-size: 11px; }
.external-drive-status { width: 7px; height: 7px; flex: 0 0 7px; margin: 0 11px 0 6px; border-radius: 50%; background: var(--text-secondary); opacity: .55; }
.external-drive-status.connected { background: #67c23a; opacity: 1; box-shadow: 0 0 0 3px rgba(103, 194, 58, .12); }
.menu-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-icons { display: flex; align-items: center; gap: 10px; opacity: 0; transition: opacity 0.2s; }
.custom-group .el-menu-item:hover .action-icons { opacity: 1; }
.edit-icon, .delete-icon { font-size: 12px; color: var(--text-secondary); transition: color 0.2s, transform 0.1s; }
.external-delete-icon { opacity: 0; }
.external-drive-item:hover .external-delete-icon { opacity: 1; }
.edit-icon:hover { color: var(--accent-color); transform: scale(1.1); }
.delete-icon:hover { color: #f56c6c; transform: scale(1.1); }
.storage-widget { margin-top: auto; padding: 16px; background: var(--bg-hover); border-radius: var(--radius, 8px); margin-left: 10px; margin-right: 10px; transition: background-color 0.3s ease; }
.progress-bar { height: 4px; background: var(--border-color); border-radius: 2px; margin-top: 8px; overflow: hidden; }
.progress-value { height: 100%; background-color: var(--accent-color); transition: width 0.5s ease-out; }
.icon-picker-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; width: 100%; margin-top: 5px; }
.icon-picker-item { display: flex; justify-content: center; align-items: center; height: 36px; border-radius: 6px; border: 1px solid var(--border-color, #dcdfe6); cursor: pointer; color: var(--text-secondary); transition: all 0.2s ease; background-color: var(--input-bg, #ffffff); }
.icon-picker-item:hover { background-color: var(--bg-hover, #f5f7fa); transform: scale(1.05); }
.icon-picker-item.is-selected { border-color: var(--accent-color, #409eff); color: var(--accent-color, #409eff); background-color: rgba(64, 158, 255, 0.1); }
:root[data-theme='dark'] .icon-picker-item { border-color: #374151; background-color: #232d42; }
</style>

<style>
/* 全局暗色与输入框适配 CSS 样式全部保持不变 */
.custom-sidebar-dialog.light { --el-dialog-bg-color: #ffffff; --el-text-color-primary: #303133; --el-text-color-regular: #606266; --el-border-color: #dcdfe6; border: 1px solid #e4e7ed; box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.15); }
.custom-sidebar-dialog.light .el-input__wrapper { background-color: #ffffff; box-shadow: 0 0 0 1px var(--el-border-color) inset; }
.custom-sidebar-dialog.light .el-input__inner { color: #303133; }

.custom-sidebar-dialog.dark { background-color: #1d2129 !important; border: 1px solid #374151; --el-text-color-primary: #f9fafb; --el-text-color-regular: #d1d5db; --el-dialog-title-font-color: #f9fafb; }
.custom-sidebar-dialog.dark .el-dialog__headerbtn:hover .el-dialog__close { color: #409eff; }
.custom-sidebar-dialog.dark .el-input__wrapper { background-color: #2b2f3a; box-shadow: 0 0 0 1px #4C4D4F inset; }
.custom-sidebar-dialog.dark .el-input__wrapper.is-focus { box-shadow: 0 0 0 1px #409eff inset; }
.custom-sidebar-dialog.dark .el-input__inner { color: #E5EAF3; }
.custom-sidebar-dialog.dark .el-input__inner::placeholder { color: #6c6e72; }
.custom-sidebar-dialog.dark .icon-picker-item { border-color: #4C4D4F; background-color: #2b2f3a; color: #A3A6AD; }
.custom-sidebar-dialog.dark .icon-picker-item:hover { background-color: #363b46; border-color: #606266; color: #E5EAF3; }
.custom-sidebar-dialog.dark .icon-picker-item.is-selected { border-color: #409eff; color: #409eff; background-color: rgba(64, 158, 255, 0.15); }

@media (max-width: 900px) {
  .sidebar {
    width: 100%;
    padding: 0 8px 16px;
  }

  .app-header {
    padding: 18px 14px 16px;
  }

  .group-header,
  .empty-tip {
    padding-left: 14px;
    padding-right: 14px;
  }

  .storage-widget {
    margin-left: 6px;
    margin-right: 6px;
  }

  .icon-picker-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
