<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElDialog, ElMessage } from 'element-plus';
import { AdminApi } from "@/commands/admin.ts";
import Setting from "@/store/setting.js"

const searchQuery = ref('');
const usersData = ref<any[]>([]);
const isLoading = ref(false);
const settingStore = Setting();

// 弹窗相关的状态
const dialogVisible = ref(false);
const isEditMode = ref(false); // 区分是新增还是编辑
const formModel = ref<any>(null); // 表单绑定的数据

// 仅记录 GB 容量
const storageGB = ref(0);

// 格式化字节大小 (用于表格显示)
const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 解析角色
const getRoleString = (status: number) => {
  if (status === 2) return '管理员';
  return '普通用户';
};

// 解析账号状态
const getStatusString = (status: number) => {
  if (status === 1) return '封禁';
  return '正常';
};

// 获取用户列表
const fetchUsers = async () => {
  isLoading.value = true;
  try {
    const res = await AdminApi.GetUsers();
    // 根据提供的 JSON 结构，真实数据在 item.Result 中
    if (res.Status === 0 && res.Data) {


      usersData.value = res.Data;
    }
  } catch (error) {
    console.error("获取用户列表失败", error);
    ElMessage.error("获取用户列表失败");
  } finally {
    isLoading.value = false;
  }
};

// 搜索过滤计算属性
const filteredUsersData = computed(() => {
  if (!searchQuery.value) return usersData.value;
  const query = searchQuery.value.toLowerCase();
  return usersData.value.filter(user =>
      user.Username?.toLowerCase().includes(query) ||
      user.Nickname?.toLowerCase().includes(query) ||
      user.UserId?.toLowerCase().includes(query)
  );
});

// 新增用户
const handleAddUser = () => {
  isEditMode.value = false;
  // 初始化空表单
  formModel.value = {
    Username: '',
    Password: '',
    Email: '',
    Nickname: '',
    Status: 0,
    Preferences: { DarkMode: false, IsWebDAVEnabled: true, IsDirectLinkEnabled: false, CustomView: [] }
  };
  storageGB.value = 10; // 默认 10GB

  dialogVisible.value = true;
};

// 打开编辑窗口
const handleEditUser = (row: any) => {
  isEditMode.value = true;
  // 深拷贝数据
  formModel.value = JSON.parse(JSON.stringify(row));

  // 初始化一个空的用于装载新密码的字段
  formModel.value.NewPassword = '';

  // 回显容量（将字节转换为 GB 展示在输入框）
  const bytes = formModel.value.Sci?.TotalSpaceInBytes || 0;
  storageGB.value = Number((bytes / (1024 * 1024 * 1024)).toFixed(2));

  dialogVisible.value = true;
};

// 保存用户修改或新增
const handleSave = async () => {
  try {
    if (isEditMode.value) {
      // 严格按照带 UserId 的 UpdateUserModel 构造请求载荷
      const updatePayload = {
        UserId: formModel.value.UserId,
        UserName: formModel.value.Username,
        Email: formModel.value.Email,
        Password: formModel.value.NewPassword || "",
        NickName: formModel.value.Nickname,
        Status: formModel.value.Status,
        TotalStorageGB: storageGB.value,
        Preferences: {
          DarkMode: formModel.value.Preferences.DarkMode,
          IsDirectLinkEnabled: formModel.value.Preferences.IsDirectLinkEnabled,
          IsWebDAVEnabled: formModel.value.Preferences.IsWebDAVEnabled,
          CustomView: formModel.value.Preferences.CustomView || []
        }
      };

      // 调用后端接口
      const res = await AdminApi.UpdateUserInfo(updatePayload);
      if (res.Status === 0) {
        ElMessage.success(`用户 ${updatePayload.UserName} 信息已保存`);
        dialogVisible.value = false;
        fetchUsers(); // 保存成功后重新拉取列表
      } else {
        ElMessage.error(res.Msg || '保存失败');
      }

    } else {
      // 表单验证
      if (!formModel.value.Username || !formModel.value.Username.trim()) {
        ElMessage.warning('用户名不能为空');
        return;
      }
      if (!formModel.value.Password || !formModel.value.Password.trim()) {
        ElMessage.warning('初始密码不能为空');
        return;
      }
      if (!formModel.value.Email || !formModel.value.Email.trim()) {
        ElMessage.warning('邮箱不能为空');
        return;
      }

      // 组装新增用户的数据格式，严格匹配 RegUserModel 字段名大小写
      const registerPayload = {
        UserName: formModel.value.Username,
        Email: formModel.value.Email,
        Password: formModel.value.Password,
        NickName: formModel.value.Nickname,
        TotalStorageGB: storageGB.value,
        Status: formModel.value.Status
      };

      const res = await AdminApi.RegisterUser(registerPayload);
      if (res.Status === 0) {
        ElMessage.success(`用户 ${registerPayload.UserName} 创建成功`);
        dialogVisible.value = false;
        fetchUsers();
      } else {
        ElMessage.error(res.Msg || '创建失败');
      }
    }
  } catch (error) {
    console.error("保存失败:", error);
    ElMessage.error("操作发生异常");
  }
};


onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="fade-in panel-content">
    <div class="fluent-card p-20">
      <div class="toolbar-actions mb-20">
        <el-button type="primary" color="var(--accent-color)" class="fluent-btn" @click="handleAddUser">
          <i class="fa-solid fa-user-plus mr-8"></i> 新增用户
        </el-button>
        <el-input v-model="searchQuery" placeholder="搜索用户名、昵称或 ID..." class="fluent-input" style="width: 280px;" clearable>
          <template #prefix><i class="fa-solid fa-search"></i></template>
        </el-input>
      </div>

      <el-table v-loading="isLoading" :data="filteredUsersData" style="width: 100%" class="fluent-table">
        <el-table-column prop="UserId" label="UID" width="280" show-overflow-tooltip />
        <el-table-column prop="Username" label="用户名" width="150" />
        <el-table-column prop="Nickname" label="昵称" width="150" />
        <el-table-column label="权限角色" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.Status === 2 ? 'danger' : 'info'" size="small">
              {{ getRoleString(scope.row.Status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="空间使用情况 (已用/总容量)" width="220">
          <template #default="scope">
            <div style="font-size: 12px; color: var(--text-secondary)">
              {{ formatBytes(scope.row.Sci?.UsedSpaceInBytes) }} / {{ formatBytes(scope.row.Sci?.TotalSpaceInBytes) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="账号状态" width="100">
          <template #default="scope">
            <span class="status-dot" :class="scope.row.Status !== 1 ? 'success' : 'danger'"></span>
            {{ getStatusString(scope.row.Status) }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="scope">
            <span style="font-size: 13px">{{ formatDate(scope.row.CreatedAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="160">
          <template #default="scope">
            <span style="font-size: 13px">{{ formatDate(scope.row.LastLoginAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="120" align="right" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="handleEditUser(scope.row)" title="编辑"><i class="fa-solid fa-pen-to-square"></i></el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEditMode ? '编辑用户' : '新增用户'" width="600px" :class="'action-dialog ' + settingStore.theme" append-to-body>
      <el-form v-if="formModel" :model="formModel" label-width="100px" label-position="left">
        <el-divider content-position="left">基础信息</el-divider>

        <template v-if="isEditMode">
          <el-form-item label="UID">
            <el-input v-model="formModel.UserId" disabled />
          </el-form-item>
          <el-form-item label="用户名">
            <el-input v-model="formModel.Username"  />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="formModel.Email"  />
          </el-form-item>
          <el-form-item label="修改密码">
            <el-input v-model="formModel.NewPassword" type="password" show-password placeholder="不修改请留空" />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="用户名" required>
            <el-input v-model="formModel.Username" placeholder="请输入用户名" />
          </el-form-item>
          <el-form-item label="初始密码" required>
            <el-input v-model="formModel.Password" type="password" show-password placeholder="请输入初始密码" />
          </el-form-item>
          <el-form-item label="邮箱" required>
            <el-input v-model="formModel.Email" placeholder="请输入邮箱地址" />
          </el-form-item>
        </template>

        <el-form-item label="昵称">
          <el-input v-model="formModel.Nickname" />
        </el-form-item>
        <el-form-item label="账号状态">
          <el-select v-model="formModel.Status" style="width: 100%">
            <el-option label="正常用户" :value="0" />
            <el-option label="封禁用户" :value="1" />
            <el-option label="管理员" :value="2" />
          </el-select>
        </el-form-item>

        <el-form-item label="总存储容量">
          <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
            <el-input-number v-model="storageGB" :min="0" :precision="2" :step="1" style="flex: 1;" />
            <span style="width: 40px; color: var(--text-primary);">GB</span>
          </div>
        </el-form-item>

        <el-form-item label="根目录 ID" v-if="isEditMode">
          <el-input v-model="formModel.RootFolderId" placeholder="这是文件夹id" />
        </el-form-item>

        <template v-if="isEditMode">
          <el-divider content-position="left">偏好设置 (Preferences)</el-divider>
          <el-form-item label="暗黑模式">
            <el-switch v-model="formModel.Preferences.DarkMode" />
          </el-form-item>
          <el-form-item label="WebDAV支持">
            <el-switch v-model="formModel.Preferences.IsWebDAVEnabled" />
          </el-form-item>
          <el-form-item label="直链分享">
            <el-switch v-model="formModel.Preferences.IsDirectLinkEnabled" />
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave" :loading="isLoading">
            {{ isEditMode ? '保存更改' : '添加用户' }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.fluent-card { background-color: var(--main-content-bg); border: 1px solid var(--border-color); border-radius: var(--radius); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); transition: border-color 0.3s, background-color 0.3s; }
.toolbar-actions { display: flex; justify-content: space-between; }
.fluent-input :deep(.el-input__wrapper) { background-color: var(--input-bg); box-shadow: 0 0 0 1px var(--border-color) inset; border-radius: var(--radius); }
.fluent-input :deep(.el-input__wrapper.is-focus) { background-color: var(--main-content-bg); box-shadow: 0 0 0 1px var(--accent-color) inset !important; }
.fluent-table { --el-table-border-color: var(--border-color); --el-table-header-bg-color: var(--bg-hover); --el-table-tr-bg-color: transparent; --el-table-row-hover-bg-color: var(--bg-hover); --el-table-text-color: var(--text-primary); --el-table-header-text-color: var(--text-secondary); background: transparent !important; }
.fluent-table :deep(th.el-table__cell), .fluent-table :deep(td.el-table__cell) { background: transparent !important; border-bottom: 1px solid var(--border-color); }
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.status-dot.success { background-color: #107c10; }
.status-dot.danger { background-color: #d83b01; }

.p-20 { padding: 20px; }
.mb-20 { margin-bottom: 20px; }
.mr-8 { margin-right: 8px; }
.fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 900px) {
  .toolbar-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
}

</style>
<style>
.el-divider__text {
  background-color: transparent !important;
}
</style>
