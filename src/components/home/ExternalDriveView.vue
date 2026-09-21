<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElMessage, ElMessageBox,
  ElOption, ElSelect
} from 'element-plus';
import QrcodeVue from 'qrcode.vue';
import Setting from '@/store/setting';
import { CloudDriveType, DriveTokenAction, EdriveApi, type DriveParams, type ExternalDriveAccount, type ExternalDriveAuthorization, type ExternalDriveItem } from '@/commands/edrive';
import ExternalFileGrid, { type ExternalFileItem } from './ExternalFileGrid.vue';

const settingStore = Setting();
const emit = defineEmits<{
  (event: 'drive-connected', externalId: string): void;
  (event: 'drive-list-changed'): void;
}>();

const typeOptions = [
  { value: CloudDriveType.Baidu, label: '百度网盘', icon: 'fa-cloud' },
  { value: CloudDriveType.Aliyun, label: '阿里云盘', icon: 'fa-cloud-arrow-up' },
  { value: CloudDriveType.OneDrive, label: 'OneDrive', icon: 'fa-cloud' },
];
const selectedDrive = ref<ExternalDriveAccount | null>(null);
const tokenVersion = ref(0);
const currentPath = ref('/');
const folders = ref<ExternalFileItem[]>([]);
const files = ref<ExternalFileItem[]>([]);
const loadingDirectory = ref(false);
const selectedItems = ref<ExternalFileItem[]>([]);

const renameDialogVisible = ref(false);
const renameTarget = ref<ExternalFileItem | null>(null);
const renameValue = ref('');
const renameLoading = ref(false);

const moveDialogVisible = ref(false);
const moveItems = ref<ExternalFileItem[]>([]);
const moveBrowsingPath = ref('/');
const moveTargetPath = ref('/');
const moveFolders = ref<ExternalFileItem[]>([]);
const moveLoading = ref(false);
const moveSubmitting = ref(false);

const addDialogVisible = ref(false);
const addLoading = ref(false);
const addType = ref<CloudDriveType>(CloudDriveType.Baidu);
const displayName = ref('');
const driveParams = ref<DriveParams[]>([]);
const credentialFields = ref<Record<string, string>>({});

const authDialogVisible = ref(false);
const authLoading = ref(false);
const authInfo = ref<ExternalDriveAuthorization | null>(null);
const authMessage = ref('');

const driveId = (drive: ExternalDriveAccount | null) => drive?.external_id || '';
const driveName = (drive: ExternalDriveAccount) => drive.display_name || '外部网盘';
const driveType = (drive: ExternalDriveAccount) => Number(drive.drive_type ?? 0);
const typeName = (type: number) => typeOptions.find(item => item.value === type)?.label || `网盘 ${type}`;
const tokenKey = (id: string) => `external-drive-access-token:${id}`;
const credentialKey = (id: string) => `external-drive-credential:${id}`;
const credentialData = (drive: ExternalDriveAccount | null) => {
  const id = driveId(drive);
  return id ? localStorage.getItem(credentialKey(id)) || '' : '';
};
const selectedToken = computed(() => { tokenVersion.value; return selectedDrive.value ? localStorage.getItem(tokenKey(driveId(selectedDrive.value))) || '' : ''; });
const selectedTypeName = computed(() => selectedDrive.value ? typeName(driveType(selectedDrive.value)) : '');
const isSecretField = (param: DriveParams) => /secret|password|token|key/i.test(param.Target || '');

const selectionKey = (item: ExternalFileItem) => item.path || item.fsId;
const selectedItemKeys = computed(() => selectedItems.value.map(selectionKey));
const resetDirectory = () => { currentPath.value = '/'; folders.value = []; files.value = []; selectedItems.value = []; };

const loadDriveParams = async () => {
  credentialFields.value = {};
  driveParams.value = [];
  try {
    const response = await EdriveApi.GetAddExternalDriveParams(addType.value);
    if (response.Status !== 0) { ElMessage.error(response.Msg || '获取网盘参数失败'); return; }
    driveParams.value = Array.isArray(response.Data) ? response.Data as DriveParams[] : [];
    credentialFields.value = Object.fromEntries(driveParams.value.map((param: DriveParams) => [param.Target, '']));
  } catch { ElMessage.error('获取网盘参数失败'); }
};

const openAddDialog = async () => {
  displayName.value = '';
  addType.value = CloudDriveType.Baidu;
  addDialogVisible.value = true;
  await loadDriveParams();
};
watch(addType, () => { if (addDialogVisible.value) loadDriveParams(); });

const submitAdd = async () => {
  const missing = driveParams.value.find((param: DriveParams) => !String(credentialFields.value[param.Target] || '').trim());
  if (missing) { ElMessage.warning(`请填写${missing.Label || missing.Target}`); return; }
  addLoading.value = true;
  try {
    const data = JSON.stringify(credentialFields.value);
    const response = await EdriveApi.AddExternalDrive(addType.value, displayName.value.trim(), data);
    if (response.Status !== 0) { ElMessage.error(response.Msg || '添加外部网盘失败'); return; }
    const id = driveId(response.Data);
    if (id) localStorage.setItem(credentialKey(id), data);
    ElMessage.success('外部网盘添加成功，请点击账户完成百度登录');
    addDialogVisible.value = false;
    emit('drive-list-changed');
  } catch { ElMessage.error('添加外部网盘失败'); }
  finally { addLoading.value = false; }
};

const requestAuthorizationInfo = async (drive: ExternalDriveAccount) => {
  const id = driveId(drive); if (!id) return;
  const appCredentialData = credentialData(drive);
  if (!appCredentialData) {
    ElMessage.error('当前浏览器没有该网盘的应用凭据，请重新添加该外部网盘。');
    return;
  }
  selectedDrive.value = drive; resetDirectory(); authInfo.value = null; authMessage.value = '正在获取登录信息…'; authDialogVisible.value = true;
  authLoading.value = true;
  try {
    const response = await EdriveApi.GetTokenDrive(driveType(drive) as CloudDriveType, appCredentialData, DriveTokenAction.GetAuthorizationInfo);
    if (response.Status !== 0) { authMessage.value = response.Msg || '获取授权信息失败'; ElMessage.error(authMessage.value); return; }
    authInfo.value = response.Data;
    authMessage.value = '请使用百度 App 扫码，或打开授权网址完成登录。';
  } catch { authMessage.value = '获取授权信息失败，请确认外部网盘配置正确。'; ElMessage.error(authMessage.value); }
  finally { authLoading.value = false; }
};

const openDrive = async (drive: ExternalDriveAccount) => {
  // 已保存的 access_token 仍由百度接口实际校验；存在时直接进入目录，避免每次点击都重复授权。
  selectedDrive.value = drive;
  resetDirectory();
  if (selectedToken.value) {
    await loadDirectory('/');
    return;
  }
  await requestAuthorizationInfo(drive);
};

const clearDrive = (externalId: string) => {
  if (driveId(selectedDrive.value) !== externalId) return;
  selectedDrive.value = null;
  authDialogVisible.value = false;
  authInfo.value = null;
  resetDirectory();
};

const checkAuthorization = async () => {
  const drive = selectedDrive.value; const id = driveId(drive); if (!id || !drive) return;
  const appCredentialData = credentialData(drive);
  const authorizationSessionId = authInfo.value?.authorization_session_id;
  if (!appCredentialData || !authorizationSessionId) { authMessage.value = '授权会话已失效，请重新获取登录信息。'; return; }
  authLoading.value = true; authMessage.value = '正在检查授权状态…';
  try {
    const response = await EdriveApi.GetTokenDrive(driveType(drive) as CloudDriveType, appCredentialData, DriveTokenAction.CheckAuthorization, authorizationSessionId);
    if (response.Status === 2) { authInfo.value = response.Data || authInfo.value; authMessage.value = '还没有检测到授权，请确认百度页面已点击同意，然后再次点击“我已授权”。'; return; }
    if (response.Status !== 0) { authMessage.value = response.Msg || '授权检查失败'; ElMessage.error(authMessage.value); return; }
    const data = response.Data;
    const token = String(data?.access_token || '');
    if (!token) { authMessage.value = '授权成功，但没有收到 access_token。'; ElMessage.error(authMessage.value); return; }
    localStorage.setItem(tokenKey(id), token);
    tokenVersion.value++;
    authDialogVisible.value = false;
    ElMessage.success('百度网盘登录成功');
    emit('drive-connected', id);
    await loadDirectory('/');
  } catch { authMessage.value = '授权检查失败，请稍后重试。'; }
  finally { authLoading.value = false; }
};

const normalizeItem = (item: ExternalDriveItem): ExternalFileItem => ({
  fsId: String(item.id || ''),
  name: String(item.name || '未命名'),
  path: String(item.path || '/'),
  size: Number(item.size || 0),
  isDir: item.is_directory,
  modifiedAt: item.modified_at ? Math.floor(new Date(item.modified_at).getTime() / 1000) : 0
});

const toggleSelection = (item: ExternalFileItem) => {
  const key = selectionKey(item);
  const index = selectedItems.value.findIndex(selected => selectionKey(selected) === key);
  if (index >= 0) selectedItems.value.splice(index, 1);
  else selectedItems.value.push(item);
};

const toggleAllSelection = (items: ExternalFileItem[]) => {
  const keys = new Set(items.map(selectionKey));
  const allSelected = items.length > 0 && items.every(item => selectedItems.value.some(selected => selectionKey(selected) === selectionKey(item)));
  if (allSelected) {
    selectedItems.value = selectedItems.value.filter(item => !keys.has(selectionKey(item)));
    return;
  }
  const selectedKeys = new Set(selectedItems.value.map(selectionKey));
  selectedItems.value.push(...items.filter(item => !selectedKeys.has(selectionKey(item))));
};

const clearSelection = () => { selectedItems.value = []; };

const parentPath = (path: string) => {
  if (!path || path === '/') return '/';
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join('/')}` : '/';
};

const childPath = (parent: string, name: string) => parent === '/' ? `/${name}` : `${parent.replace(/\/$/, '')}/${name}`;

const updateDirectoryItem = (item: ExternalFileItem, update: Partial<ExternalFileItem>) => {
  const key = selectionKey(item);
  const updateItem = (candidate: ExternalFileItem) => selectionKey(candidate) === key ? { ...candidate, ...update } : candidate;
  folders.value = folders.value.map(updateItem);
  files.value = files.value.map(updateItem);
};

const removeDirectoryItems = (items: ExternalFileItem[]) => {
  const keys = new Set(items.map(selectionKey));
  folders.value = folders.value.filter(item => !keys.has(selectionKey(item)));
  files.value = files.value.filter(item => !keys.has(selectionKey(item)));
};

const loadDirectory = async (path: string) => {
  const drive = selectedDrive.value; const token = selectedToken.value;
  if (!drive || !token) { ElMessage.warning('请先完成百度网盘登录'); return; }
  loadingDirectory.value = true; currentPath.value = path || '/';
  try {
    const response = await EdriveApi.GetUserDirectoryFileInfo(driveType(drive) as CloudDriveType, currentPath.value, token, 0, 1000);
    if (response.Status !== 0) { ElMessage.error(response.Msg || '读取目录失败'); return; }
    const list = response.Data?.items || [];
    folders.value = list.filter(item => item.is_directory).map(normalizeItem);
    files.value = list.filter(item => !item.is_directory).map(normalizeItem);
  } catch { ElMessage.error('读取百度网盘目录失败'); }
  finally { loadingDirectory.value = false; }
};

const goParent = () => {
  if (currentPath.value === '/') return;
  clearSelection();
  loadDirectory(parentPath(currentPath.value));
};

const openFolder = (item: ExternalFileItem) => {
  clearSelection();
  loadDirectory(item.path);
};

const downloadFile = async (item: ExternalFileItem) => {
  const drive = selectedDrive.value; const token = selectedToken.value; if (!drive || !token) return;
  try {
    const response = await EdriveApi.DownLoadFile(driveType(drive) as CloudDriveType, item.fsId || item.path, token);
    if (response.Status !== 0) { ElMessage.error(response.Msg || '获取下载地址失败'); return; }
    const url = response.Data?.download_url;
    if (!url) { ElMessage.error('百度未返回下载地址'); return; }
    window.open(String(url), '_blank', 'noopener');
  } catch { ElMessage.error('获取下载地址失败'); }
};

const resolveOperationContext = () => {
  const drive = selectedDrive.value;
  const token = selectedToken.value;
  return drive && token ? { drive, token } : null;
};

const operationTarget = (item: ExternalFileItem) => item.path || item.fsId;
const commandItems = (item: ExternalFileItem) => selectedItems.value.some(selected => selectionKey(selected) === selectionKey(item))
  ? [...selectedItems.value]
  : [item];

const openRename = (item: ExternalFileItem) => {
  renameTarget.value = item;
  renameValue.value = item.name;
  renameDialogVisible.value = true;
};

const confirmRename = async () => {
  const context = resolveOperationContext();
  const item = renameTarget.value;
  const newName = renameValue.value.trim();
  if (!context || !item || !newName || newName === item.name) {
    renameDialogVisible.value = false;
    return;
  }

  renameLoading.value = true;
  try {
    const response = await EdriveApi.RenameFileOrDir(
      driveType(context.drive) as CloudDriveType,
      operationTarget(item),
      newName,
      context.token
    );
    if (response.Status !== 0) {
      ElMessage.error(response.Msg || '重命名失败');
      return;
    }
    renameDialogVisible.value = false;
    updateDirectoryItem(item, { name: newName, path: childPath(parentPath(item.path), newName) });
    clearSelection();
    ElMessage.success('重命名成功');
  } catch {
    ElMessage.error('重命名失败');
  } finally {
    renameLoading.value = false;
  }
};

const deleteItems = async (items: ExternalFileItem[]) => {
  const context = resolveOperationContext();
  if (!context || !items.length) return;
  const message = items.length === 1 ? `确定删除“${items[0].name}”吗？` : `确定删除选中的 ${items.length} 个项目吗？`;
  try {
    await ElMessageBox.confirm(message, '确认删除', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消'
    });
    for (const item of items) {
      const response = item.isDir
        ? await EdriveApi.DeleteUserFolderAsync(driveType(context.drive) as CloudDriveType, operationTarget(item), context.token)
        : await EdriveApi.DeleteFileAsync(driveType(context.drive) as CloudDriveType, operationTarget(item), context.token);
      if (response.Status !== 0) throw new Error(response.Msg || `删除“${item.name}”失败`);
    }
    removeDirectoryItems(items);
    clearSelection();
    ElMessage.success('删除成功');
  } catch (error: unknown) {
    const reason = String(error instanceof Error ? error.message : error);
    if (reason !== 'cancel' && reason !== 'close') ElMessage.error(reason || '删除失败');
  }
};

const isMoveDestinationAllowed = (folder: ExternalFileItem) => !moveItems.value.some(item => {
  if (!item.isDir) return false;
  const sourcePath = item.path.endsWith('/') ? item.path : `${item.path}/`;
  return folder.path === item.path || folder.path.startsWith(sourcePath);
});

const loadMoveFolders = async (path: string) => {
  const context = resolveOperationContext();
  if (!context) return;
  moveLoading.value = true;
  moveFolders.value = [];
  try {
    const response = await EdriveApi.GetUserDirectoryFileInfo(
      driveType(context.drive) as CloudDriveType,
      path,
      context.token,
      0,
      1000
    );
    if (response.Status !== 0) {
      ElMessage.error(response.Msg || '读取目标文件夹失败');
      return;
    }
    moveFolders.value = (response.Data?.items || [])
      .filter(item => item.is_directory)
      .map(normalizeItem)
      .filter(isMoveDestinationAllowed);
  } catch {
    ElMessage.error('读取目标文件夹失败');
  } finally {
    moveLoading.value = false;
  }
};

const openMove = async (items: ExternalFileItem[]) => {
  if (!items.length) return;
  moveItems.value = [...items];
  moveBrowsingPath.value = currentPath.value;
  moveTargetPath.value = currentPath.value;
  moveDialogVisible.value = true;
  await loadMoveFolders(moveBrowsingPath.value);
};

const enterMoveFolder = async (folder: ExternalFileItem) => {
  moveBrowsingPath.value = folder.path;
  moveTargetPath.value = folder.path;
  await loadMoveFolders(folder.path);
};

const goMoveParent = async () => {
  if (moveBrowsingPath.value === '/') return;
  moveBrowsingPath.value = parentPath(moveBrowsingPath.value);
  moveTargetPath.value = moveBrowsingPath.value;
  await loadMoveFolders(moveBrowsingPath.value);
};

const confirmMove = async () => {
  const context = resolveOperationContext();
  if (!context || !moveItems.value.length || !moveTargetPath.value) return;
  if (moveTargetPath.value === currentPath.value) {
    moveDialogVisible.value = false;
    clearSelection();
    return;
  }
  moveSubmitting.value = true;
  try {
    const response = await EdriveApi.MoveFileOrDir({
      driveType: driveType(context.drive) as CloudDriveType,
      fileIdOrPaths: moveItems.value.map(operationTarget),
      targetFolderIdOrPath: moveTargetPath.value,
      accessToken: context.token
    });
    if (response.Status !== 0) throw new Error(response.Msg || '移动失败');

    moveDialogVisible.value = false;
    removeDirectoryItems(moveItems.value);
    clearSelection();
    ElMessage.success('移动成功');
  } catch (error: unknown) {
    ElMessage.error(String(error instanceof Error ? error.message : error) || '移动失败');
  } finally {
    moveSubmitting.value = false;
  }
};

const createFolder = async () => {
  const context = resolveOperationContext();
  if (!context) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', {
      confirmButtonText: '创建', cancelButtonText: '取消', inputPlaceholder: '文件夹名称', inputValidator: value => Boolean(value?.trim()) || '文件夹名称不能为空'
    });
    const response = await EdriveApi.CreateFolder(
      driveType(context.drive) as CloudDriveType,
      currentPath.value,
      value.trim(),
      context.token
    );
    if (response.Status !== 0) {
      ElMessage.error(response.Msg || '创建文件夹失败');
      return;
    }
    const path = String(response.Data?.path || childPath(currentPath.value, value.trim()));
    folders.value.push({
      fsId: String(response.Data?.file_id || path),
      name: value.trim(),
      path,
      size: 0,
      isDir: true,
      modifiedAt: Math.floor(Date.now() / 1000)
    });
    ElMessage.success('文件夹已创建');
  } catch (error: unknown) {
    const reason = String(error instanceof Error ? error.message : error);
    if (reason !== 'cancel' && reason !== 'close') ElMessage.error(reason || '创建文件夹失败');
  }
};

const handleGridCommand = (command: 'download' | 'rename' | 'move' | 'delete', item: ExternalFileItem) => {
  if (command === 'download') downloadFile(item);
  else if (command === 'rename') openRename(item);
  else if (command === 'move') openMove(commandItems(item));
  else deleteItems(commandItems(item));
};

defineExpose({ openAddDialog, openDrive, clearDrive });
</script>

<template>
  <div class="external-drive-view">
    <section v-if="selectedDrive && selectedToken" class="external-files-panel">
      <div class="external-files-header">
        <div class="external-drive-heading"><strong>{{ driveName(selectedDrive) }}</strong><span>{{ selectedTypeName }}</span></div>
        <div class="external-selection-actions">
          <template v-if="selectedItems.length">
            <div class="external-batch-actions">
              <span class="external-selected-count">已选 {{ selectedItems.length }} 项</span>
              <button class="external-batch-btn external-rename-btn" :disabled="selectedItems.length !== 1" @click="selectedItems.length === 1 && openRename(selectedItems[0])">
                <i class="fa-solid fa-pen-to-square"></i><span>重命名</span>
              </button>
              <button class="external-batch-btn external-move-btn" @click="openMove(selectedItems)">
                <i class="fa-solid fa-folder-tree"></i><span>移动</span>
              </button>
              <button class="external-batch-btn external-delete-btn" @click="deleteItems(selectedItems)">
                <i class="fa-solid fa-trash-can"></i><span>删除</span>
              </button>
              <button class="external-clear-selection" title="取消选择" @click="clearSelection">
                <i class="fa-solid fa-xmark"></i><span>取消</span>
              </button>
            </div>
          </template>
          <button class="external-action-btn" @click="createFolder">
            <i class="fa-solid fa-folder-plus"></i><span>新建文件夹</span>
          </button>
        </div>
        <div class="external-path-actions"><el-button text @click="goParent" :disabled="currentPath === '/'">上一级</el-button><code>{{ currentPath }}</code><el-button text @click="loadDirectory(currentPath)"><i class="fa-solid fa-rotate-right"></i></el-button></div>
      </div>
      <ExternalFileGrid
          :folders="folders"
          :files="files"
          :loading="loadingDirectory"
          :path="currentPath"
          :selected-keys="selectedItemKeys"
          @open-folder="openFolder"
          @download="downloadFile"
          @toggle-selection="toggleSelection"
          @toggle-all="toggleAllSelection"
          @command="handleGridCommand"
      />
    </section>
    <div v-else class="external-login-hint"><i class="fa-solid fa-cloud-arrow-up"></i><span>请从左侧“外部网盘”列表选择一个账户。</span></div>
  </div>

  <el-dialog v-model="addDialogVisible" title="添加外部网盘" width="460px" :class="['custom-dialog', settingStore.theme]" align-center destroy-on-close>
    <el-form label-position="top" @submit.prevent="submitAdd">
      <el-form-item label="网盘类型"><el-select v-model="addType" style="width:100%"><el-option v-for="item in typeOptions" :key="item.value" :value="item.value" :label="item.label" /></el-select></el-form-item>
      <el-form-item label="显示名称"><el-input v-model="displayName" placeholder="例如：我的百度网盘" maxlength="30" /></el-form-item>
      <el-form-item v-for="param in driveParams" :key="param.Target" :label="param.Label || param.Target" :required="true">
        <el-input v-model="credentialFields[param.Target]" :type="isSecretField(param) ? 'password' : 'text'" :placeholder="param.Description" autocomplete="off" />
      </el-form-item>
      <p v-if="addType === CloudDriveType.Baidu" class="form-tip"><i class="fa-solid fa-circle-info"></i> 添加只保存应用参数；完成添加后还需要点击账户进行设备码登录。</p>
    </el-form>
    <template #footer><el-button @click="addDialogVisible = false">取消</el-button><el-button type="primary" :loading="addLoading" @click="submitAdd">添加</el-button></template>
  </el-dialog>

  <el-dialog v-model="authDialogVisible" :title="`登录 ${selectedDrive ? driveName(selectedDrive) : ''}`" width="520px" :class="['custom-dialog', settingStore.theme]" align-center :close-on-click-modal="false">
    <div class="auth-content">
      <div v-if="authLoading && !authInfo" class="auth-loading"><i class="fa-solid fa-circle-notch fa-spin"></i><span>正在获取授权信息…</span></div>
      <template v-else-if="authInfo">
        <div class="auth-intro">{{ authMessage }}</div>
        <div class="auth-layout">
          <div v-if="authInfo.qrcode_url" class="auth-qr"><QrcodeVue :value="String(authInfo.qrcode_url)" :size="190" level="H" /><small>扫码登录</small></div>
          <div class="auth-details">
            <div v-if="authInfo.user_code" class="user-code"><span>用户码</span><code>{{ authInfo.user_code }}</code></div>
            <a v-if="authInfo.verification_url_complete || authInfo.verification_url" class="auth-link" :href="String(authInfo.verification_url_complete || authInfo.verification_url)" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> 打开百度授权网址</a>
            <p class="auth-tip">授权完成后回到这里，点击“我已授权”。</p>
          </div>
        </div>
        <div class="auth-message" :class="{ pending: authMessage.includes('还没有') }">{{ authMessage }}</div>
      </template>
      <div v-else class="auth-message">{{ authMessage }}</div>
    </div>
    <template #footer><el-button @click="authDialogVisible = false">取消</el-button><el-button type="primary" :loading="authLoading" :disabled="!authInfo" @click="checkAuthorization">我已授权</el-button></template>
  </el-dialog>

  <el-dialog v-model="renameDialogVisible" title="重命名" width="420px" :class="['custom-dialog', settingStore.theme]" align-center destroy-on-close>
    <el-form @submit.prevent="confirmRename">
      <el-form-item label="新名称"><el-input v-model="renameValue" maxlength="255" autofocus @keyup.enter="confirmRename" /></el-form-item>
    </el-form>
    <template #footer><el-button :disabled="renameLoading" @click="renameDialogVisible = false">取消</el-button><el-button type="primary" :loading="renameLoading" :disabled="!renameValue.trim() || renameValue.trim() === renameTarget?.name" @click="confirmRename">确认</el-button></template>
  </el-dialog>

  <el-dialog
      v-model="moveDialogVisible"
      title="移动到"
      width="600px"
      align-center
      :class="'action-dialog ' + settingStore.theme"
      append-to-body
  >
    <div class="move-dialog-layout">
      <div class="move-source-list">
        <div class="list-header">待移动项目 ({{ moveItems.length }})</div>
        <el-scrollbar>
          <div class="list-content">
            <div v-for="item in moveItems" :key="selectionKey(item)" class="mini-item">
              <i
                  :class="['fa-solid', item.isDir ? 'fa-folder' : 'fa-file-lines']"
                  :style="{ color: item.isDir ? '#fdd835' : 'var(--accent-color)', marginRight: '8px', width: '14px', textAlign: 'center' }"
              ></i>
              <span class="text-truncate" :title="item.name">{{ item.name }}</span>
            </div>
          </div>
        </el-scrollbar>
      </div>

      <div class="move-target-box">
        <div class="target-header">
          <el-button
              v-if="moveBrowsingPath !== '/'"
              size="small"
              link
              @click="goMoveParent"
          >
            <i class="fa-solid fa-arrow-left"></i> 返回上级
          </el-button>

          <span class="current-path-title" :title="moveBrowsingPath">
            {{ moveBrowsingPath === '/' ? '根目录' : moveBrowsingPath.split('/').pop() }}
          </span>
        </div>

        <el-scrollbar class="target-list-container">
          <el-radio-group v-if="!moveLoading" v-model="moveTargetPath" class="folder-list-group">
            <div v-if="moveFolders.length === 0" class="empty-tip">
              此文件夹为空
            </div>

            <el-radio
                v-for="folder in moveFolders"
                :key="selectionKey(folder)"
                :label="folder.path"
                size="large"
                border
                class="folder-radio-item"
            >
              <div class="radio-content" @dblclick.stop.prevent="enterMoveFolder(folder)">
                <div class="folder-info">
                  <i class="fa-regular fa-folder folder-icon"></i>
                  <span class="fname">{{ folder.name }}</span>
                </div>
                <i class="fa-solid fa-chevron-right enter-icon"></i>
              </div>
            </el-radio>
          </el-radio-group>
          <div v-else class="empty-tip"><i class="fa-solid fa-circle-notch fa-spin"></i> 正在读取目录…</div>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button :disabled="moveSubmitting" @click="moveDialogVisible = false">取消</el-button>
        <el-button
            type="primary"
            :loading="moveSubmitting"
            :disabled="!moveTargetPath"
            @click="confirmMove"
        >
          移动到 {{ moveTargetPath === moveBrowsingPath ? '当前目录' : '选中的文件夹' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.external-drive-view { padding: 8px 2px 26px; color: var(--text-primary); }
.external-empty { display:flex; flex-direction:column; align-items:center; padding:28px 0 20px; }
.external-files-panel { margin-top:24px; padding-top:20px; border-top:1px solid var(--border-color); }
.external-files-header { display:grid; grid-template-columns:minmax(150px,auto) 1fr auto; align-items:center; gap:12px; margin-bottom:18px; }
.external-drive-heading { min-width:0; }
.external-drive-heading strong { margin-right:10px; font-size:16px; }
.external-drive-heading span { color:var(--text-secondary); font-size:12px; }
.external-selection-actions { display:flex; min-width:0; align-items:center; justify-content:flex-end; gap:12px; }
.external-action-btn { display:flex; align-items:center; gap:6px; padding:8px 20px; border:0; border-radius:4px; color:#fff; background:var(--accent-color); font-size:13px; font-weight:600; cursor:pointer; transition:background .2s, transform .2s; white-space:nowrap; }
.external-action-btn:hover { background:var(--accent-hover); transform:translateY(-1px); }
.external-action-btn:active { transform:translateY(0); }
.external-batch-actions { display:flex; align-items:center; gap:10px; padding:4px 10px; border-radius:6px; background:var(--bg-hover); animation:externalBatchFadeIn .2s ease-out; }
@keyframes externalBatchFadeIn { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:translateY(0); } }
.external-selected-count { margin-right:5px; color:var(--text-secondary); font-size:13px; font-weight:500; white-space:nowrap; }
.external-batch-btn { display:flex; align-items:center; gap:6px; padding:6px 12px; border:1px solid transparent; border-radius:4px; color:var(--text-primary); background:transparent; font-size:13px; font-weight:500; cursor:pointer; transition:all .2s; white-space:nowrap; }
.external-batch-btn:hover:not(:disabled) { border-color:var(--accent-color); color:var(--accent-color); background:var(--bg-active); }
.external-batch-btn:disabled { opacity:.45; cursor:not-allowed; }
.external-rename-btn,.external-move-btn { border-color:var(--border-color); }
.external-delete-btn { border-color:rgba(245,108,108,.3); color:#f56c6c; }
.external-delete-btn:hover { border-color:#f56c6c; color:#f56c6c; background:rgba(245,108,108,.1); }
.external-clear-selection { display:flex; align-items:center; gap:5px; padding:6px 4px; border:0; color:var(--text-secondary); background:transparent; font-size:13px; cursor:pointer; white-space:nowrap; }
.external-clear-selection:hover { color:var(--text-primary); }
.external-path-actions { display:flex; align-items:center; gap:6px; justify-content:flex-end; color:var(--text-secondary); }
.external-path-actions code { max-width:260px; overflow:hidden; padding:4px 8px; border-radius:5px; background:var(--bg-hover); color:var(--text-primary); text-overflow:ellipsis; white-space:nowrap; }
.external-login-hint { display:flex; align-items:center; justify-content:center; gap:10px; min-height:220px; color:var(--text-secondary); font-size:13px; }
.external-login-hint i { color:var(--accent-color); font-size:20px; }
.form-tip { margin:4px 0 0; color:var(--text-secondary); font-size:12px; }
.form-tip i { margin-right:5px; color:var(--accent-color); }
.auth-content { min-height:240px; }
.auth-loading { display:flex; min-height:240px; flex-direction:column; align-items:center; justify-content:center; gap:14px; color:var(--text-secondary); }
.auth-loading i { color:var(--accent-color); font-size:30px; }
.auth-intro { margin-bottom:16px; color:var(--text-secondary); font-size:13px; }
.auth-layout { display:flex; align-items:center; gap:24px; }
.auth-qr { display:flex; flex:0 0 204px; flex-direction:column; align-items:center; gap:8px; }
.auth-qr canvas { max-width:190px; border-radius:8px; }
.auth-qr small { color:var(--text-secondary); }
.auth-details { display:flex; flex:1; flex-direction:column; gap:14px; }
.user-code { display:flex; align-items:center; gap:10px; color:var(--text-secondary); }
.user-code code { padding:7px 11px; border:1px solid var(--border-color); border-radius:6px; color:var(--text-primary); background:var(--bg-hover); font-size:18px; letter-spacing:2px; }
.auth-link { color:var(--accent-color); font-size:13px; text-decoration:none; }
.auth-link:hover { text-decoration:underline; }
.auth-tip { margin:0; color:var(--text-secondary); font-size:12px; line-height:1.6; }
.auth-message { margin-top:18px; padding:9px 11px; border-radius:6px; color:var(--text-secondary); background:var(--bg-hover); font-size:12px; line-height:1.5; }
.auth-message.pending { color:#b7791f; background:rgba(230,162,60,.12); }
.move-dialog-layout { display: flex; height: 400px; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; margin-top: 5px; }
.move-source-list { width: 200px; min-width: 200px; flex: 0 0 200px; background-color: var(--bg-hover); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; }
.list-header { padding: 10px; font-size: 12px; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); background-color: var(--main-content-bg); }
.list-content { padding: 10px; }
.mini-item { display: flex; align-items: center; font-size: 13px; margin-bottom: 8px; color: var(--text-primary); padding: 4px 6px; border-radius: 4px; }
.mini-item:hover { background-color: rgba(0,0,0,0.05); }
.text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.move-target-box { min-width: 0; flex: 1; display: flex; flex-direction: column; background-color: var(--main-content-bg); }
.target-header { padding: 0 10px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px; height: 45px; flex-shrink: 0; }
.current-path-title { font-size: 14px; font-weight: bold; color: var(--text-primary); margin-left: 5px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.target-list-container { flex: 1; padding: 10px; }
.folder-list-group { display: flex; flex-direction: column; gap: 8px; }
.folder-radio-item { width: 100%; min-width: 0; margin-right: 0 !important; margin-bottom: 0 !important; padding: 0 10px !important; height: auto !important; min-height: 40px; }
.folder-radio-item :deep(.el-radio__label) { flex: 1; padding-left: 0; width: 100%; }
.radio-content { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 0 10px 10px; }
.folder-info { min-width: 0; flex: 1; display: flex; align-items: center; gap: 8px; overflow: hidden; }
.folder-icon { font-size: 16px; color: #fdd835; }
.fname { min-width: 0; flex: 1; font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.enter-icon { font-size: 12px; color: var(--text-secondary); opacity: 0; transition: opacity 0.2s; padding-left: 10px; }
.radio-content:hover .enter-icon { opacity: 1; color: var(--accent-color); }
.empty-tip { text-align: center; color: var(--text-secondary); margin-top: 50px; font-size: 13px; }
@media (max-width: 760px) { .external-files-header { display:flex; align-items:stretch; flex-direction:column; gap:10px; } .external-selection-actions { justify-content:flex-start; } .external-batch-actions { width:100%; margin:0; flex-wrap:wrap; justify-content:flex-start; } .external-action-btn { width:100%; justify-content:center; } .external-path-actions { justify-content:space-between; } }
@media (max-width: 460px) { .external-batch-actions { gap:6px; padding:4px 6px; } .external-batch-btn { padding:6px 8px; } .external-selected-count { width:100%; margin:0 0 2px; } }
@media (max-width: 640px) { .auth-layout { flex-direction:column; gap:16px; } .auth-details { width:100%; } }
</style>
