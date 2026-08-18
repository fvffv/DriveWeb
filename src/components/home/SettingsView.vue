<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElForm, ElFormItem, ElInput } from 'element-plus';
import 'element-plus/es/components/form/style/css';
import 'element-plus/es/components/form-item/style/css';
import 'element-plus/es/components/input/style/css';
import Setting from "@/store/setting.js";
import { UserApi } from "@/commands/user.ts";
import { UserPreferences, UserPasswordEdit, UserInfoEdit } from "@/models/user_models";

const settingStore = Setting();

// --- 头像上传相关状态 ---
const fileInputRef = ref(null);
const isUploadingAvatar = ref(false);

// --- 状态数据 ---
const settingsForm = ref({
  username: '',
  uuid: '',
  createTime: '',
  nickname: 'Admin User',
  bio: '超级管理员',
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

// 偏好设置
const preferences = ref<UserPreferences>({});

const user = ref({
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jone',
});

// --- 新增：密码表单校验逻辑 ---
const passwordFormRef = ref(null);

const validateConfirmPassword = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('请再次输入新密码'));
  } else if (value !== settingsForm.value.newPassword) {
    callback(new Error('两次输入的密码不一致'));
  } else {
    callback();
  }
};

const passwordRules = ref({
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能小于 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPassword, trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'change' }
  ]
});

// --- 逻辑方法 ---

const getUserInfo = async () => {
  try {
    settingsForm.value.nickname = settingStore.userInfo.Nickname;
    settingsForm.value.username = settingStore.userInfo.Username;
    settingsForm.value.uuid = settingStore.userInfo.UserId || '未获取到 ID';
    settingsForm.value.createTime = settingStore.userInfo.CreateTime || '2024-01-01';

    if (settingStore.userInfo.AvatarUrl) {
      user.value.avatarUrl = `${import.meta.env.VITE_APP_ASSETS_API}/avatar/${settingStore.userInfo.AvatarUrl}`
    }
  } catch (error) {
    console.error("获取用户信息失败:", error);
    ElMessage.error("获取用户信息失败");
  }
};

const handleAvatarChange = () => {
  if (isUploadingAvatar.value) return;
  fileInputRef.value.click();
};

const onFileSelected = async (event: any) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片类型的文件');
    event.target.value = '';
    return;
  }

  if (file.size > 2000000) {
    ElMessage.warning('头像图片大小不能超过 2MB');
    event.target.value = '';
    return;
  }

  isUploadingAvatar.value = true;
  try {
    const res = await UserApi.UploadAvatar(file);

    if (res.Status === 0) {
      ElMessage.success('头像上传成功');
      const timeStamp = new Date().getTime();
      user.value.avatarUrl = `${import.meta.env.VITE_APP_ASSETS_API}/avatar/${res.Data}?t=${timeStamp}`;
      settingStore.userInfo.AvatarUrl = `${res.Data}?t=${timeStamp}`;
    } else {
      ElMessage.error('头像上传失败: ' + res.Msg);
    }
  } catch (error) {
    console.error("头像上传请求异常:", error);
    ElMessage.error('头像上传发生异常，请重试');
  } finally {
    isUploadingAvatar.value = false;
    event.target.value = '';
  }
};

const handleSaveProfile = async () => {
  if (settingsForm.value.nickname.length !== 0) {
    const m: UserInfoEdit = { UserNick: settingsForm.value.nickname };
    const info = await UserApi.UpdateUserInfo(m);
    if (info.Status === 0) {
      ElMessage.success("个人资料已更新");
    } else {
      ElMessage.error(`更新失败: ${info.Msg}`);
    }
  }
};

const handleUpdatePassword = async () => {
  if (!passwordFormRef.value) return;

  await passwordFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      const m: UserPasswordEdit = {
        OldPassword: settingsForm.value.oldPassword,
        NewPassword: settingsForm.value.newPassword,
      }
      const info = await UserApi.UpdatePassword(m);
      if (info.Status === 0) {
        ElMessage.success("密码修改成功");
        settingsForm.value.oldPassword = '';
        settingsForm.value.newPassword = '';
        settingsForm.value.confirmPassword = '';
      } else {
        ElMessage.error(`密码修改失败: ${info.Msg}`);
      }
    }
  });
};

const handleSwitchChange = async () => {
  const info = await UserApi.UpdateUserPreferences(settingStore.userInfo.Preferences);
  if (info.Status !== 0) {
    ElMessage.error(`更新失败: ${info.Msg}`);
  }
};

onMounted(() => {
  getUserInfo();
});
</script>

<template>
  <div class="scroll-area settings-view">
    <div class="settings-header">
      <h2>应用设置</h2>
      <p>管理您的个人资料、安全凭证与偏好选项</p>
    </div>

    <div class="settings-grid">
      <div class="settings-col left-col">

        <div class="setting-section">
          <h3 class="section-title"><i class="fa-regular fa-id-card"></i> 个人资料</h3>
          <div class="fluent-card profile-card">

            <div class="avatar-section">
              <div class="avatar-wrapper" @click="handleAvatarChange" :class="{ 'is-uploading': isUploadingAvatar }">
                <input type="file" ref="fileInputRef" style="display: none" accept="image/png, image/jpeg, image/gif, image/webp" @change="onFileSelected">
                <img :src="user.avatarUrl" alt="Avatar" class="setting-avatar">
                <div class="avatar-overlay">
                  <i v-if="isUploadingAvatar" class="fa-solid fa-spinner fa-spin"></i>
                  <i v-else class="fa-solid fa-camera"></i>
                </div>
              </div>
              <div class="avatar-tips">点击修改头像</div>
            </div>

            <div class="form-grid">
              <div class="readonly-group">
                <div class="form-item">
                  <label>用户账号</label>
                  <input type="text" v-model="settingsForm.username" disabled class="fluent-input disabled-input">
                </div>
                <div class="form-row">
                  <div class="form-item">
                    <label>用户 ID</label>
                    <input type="text" v-model="settingsForm.uuid" disabled class="fluent-input disabled-input">
                  </div>
                  <div class="form-item">
                    <label>注册时间</label>
                    <input type="text" v-model="settingsForm.createTime" disabled class="fluent-input disabled-input">
                  </div>
                </div>
              </div>

              <div class="divider"></div>

              <div class="form-item">
                <label>用户昵称</label>
                <input type="text" v-model="settingsForm.nickname" placeholder="请输入您的名字" class="fluent-input">
              </div>

              <div class="form-action right-align">
                <button class="fluent-primary-btn" @click="handleSaveProfile">保存个人资料</button>
              </div>
            </div>
          </div>
        </div>

        <div class="setting-section">
          <h3 class="section-title"><i class="fa-solid fa-shield-halved"></i> 账号安全</h3>
          <div class="fluent-card security-card">
            <el-form ref="passwordFormRef" :model="settingsForm" :rules="passwordRules" label-position="top" class="full-width-form">

              <el-form-item label="当前密码" prop="oldPassword">
                <el-input type="password" v-model="settingsForm.oldPassword" placeholder="验证当前密码" show-password />
              </el-form-item>

              <div class="form-row el-form-row">
                <el-form-item label="新密码" prop="newPassword" class="flex-item">
                  <el-input type="password" v-model="settingsForm.newPassword" placeholder="设置新密码" show-password />
                </el-form-item>

                <el-form-item label="确认密码" prop="confirmPassword" class="flex-item">
                  <el-input type="password" v-model="settingsForm.confirmPassword" placeholder="再次输入新密码" show-password />
                </el-form-item>
              </div>

              <div class="form-action right-align">
                <button type="button" class="fluent-primary-btn" @click="handleUpdatePassword">更新密码</button>
              </div>
            </el-form>
          </div>
        </div>

      </div>

      <div class="settings-col right-col">
        <div class="setting-section">
          <h3 class="section-title"><i class="fa-solid fa-globe"></i> 网络与连接</h3>

          <div class="fluent-card system-list-card">

            <div class="setting-list-item">
              <div class="setting-info">
                <span class="setting-name">直连模式</span>
                <span class="setting-desc">开启后将可通过文件GUID直接进行高速下载。</span>
              </div>
              <div class="setting-control">
                <label class="fluent-switch">
                  <input type="checkbox" v-model="settingStore.userInfo.Preferences.IsDirectLinkEnabled" @change="handleSwitchChange">
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <div class="divider inset"></div>

            <div class="setting-list-item">
              <div class="setting-info">
                <span class="setting-name">WebDAV 访问</span>
                <span class="setting-desc">允许使用第三方客户端通过 WebDAV 协议挂载网盘。</span>
              </div>
              <div class="setting-control">
                <label class="fluent-switch">
                  <input type="checkbox" v-model="settingStore.userInfo.Preferences.IsWebDAVEnabled" @change="handleSwitchChange">
                  <span class="slider"></span>
                </label>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* 基础重置与滚动条 */
* { box-sizing: border-box; }
.scroll-area { flex: 1; overflow-y: auto; padding: 10px 30px 40px 30px; }
.scroll-area::-webkit-scrollbar { width: 8px; }
.scroll-area::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.15); border-radius: 8px; }
.scroll-area::-webkit-scrollbar-thumb:hover { background-color: rgba(0, 0, 0, 0.3); }

/* 页面布局 */
.settings-view { max-width: 1100px; margin: 0 auto; width: 100%; }
.settings-header { margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid var(--border-color); }
.settings-header h2 { font-size: 24px; font-weight: 600; color: var(--text-primary); margin: 0 0 8px 0; }
.settings-header p { font-size: 14px; color: var(--text-secondary); margin: 0; }

.settings-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 35px; align-items: start; }
@media (max-width: 950px) { .settings-grid { grid-template-columns: 1fr; } }
.settings-col { display: flex; flex-direction: column; gap: 35px; }

/* 标题样式 */
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
.section-title i { color: var(--accent-color); font-size: 18px; }

/* Fluent 卡片基类 */
.fluent-card {
  background-color: var(--main-content-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
  transition: box-shadow 0.3s ease;
}
.fluent-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04); }
:global([data-theme='dark']) .fluent-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); }

/* 卡片内部布局 */
.profile-card { display: flex; gap: 30px; }
@media (max-width: 600px) { .profile-card { flex-direction: column; align-items: center; } }

/* 头像区域 */
.avatar-section { display: flex; flex-direction: column; align-items: center; gap: 12px; flex-shrink: 0; }
.avatar-wrapper { position: relative; width: 110px; height: 110px; cursor: pointer; border-radius: 50%; overflow: hidden; border: 3px solid var(--main-content-bg); box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition: transform 0.2s; }
.avatar-wrapper:hover { transform: scale(1.02); }
.setting-avatar { width: 100%; height: 100%; object-fit: cover; }
.avatar-overlay { position: absolute; inset: 0; background-color: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; opacity: 0; transition: all 0.2s; color: white; font-size: 24px; }
.avatar-wrapper:hover .avatar-overlay { opacity: 1; backdrop-filter: blur(2px); }
.avatar-wrapper.is-uploading { cursor: not-allowed; }
.avatar-wrapper.is-uploading .avatar-overlay { opacity: 1; background-color: rgba(0,0,0,0.6); }
.avatar-tips { font-size: 12px; color: var(--text-secondary); }

/* 表单网格 */
.form-grid { flex: 1; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.form-row { display: flex; gap: 20px; width: 100%; }
.form-row .form-item { flex: 1; min-width: 0; }
.form-item label { display: block; font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px; }

/* 统一的原生输入框样式 (仿 Element Plus) */
.fluent-input {
  width: 100%; padding: 0 15px; height: 36px; border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg, #f3f5f9);
  color: var(--text-primary); font-size: 14px;
  outline: none; transition: all 0.2s;
}
.fluent-input:focus { border-color: var(--accent-color); background-color: var(--main-content-bg); box-shadow: 0 0 0 1px var(--accent-color) inset; }
:global([data-theme='dark']) .fluent-input { background-color: #1e293b; }

.readonly-group { display: flex; flex-direction: column; gap: 18px; width: 100%; }
.disabled-input { background-color: rgba(0, 0, 0, 0.03) !important; color: var(--text-secondary) !important; cursor: not-allowed; border-color: var(--border-color) !important; }
:global([data-theme='dark']) .disabled-input { background-color: rgba(255, 255, 255, 0.03) !important; }

/* 分割线 */
.divider { height: 1px; background-color: var(--border-color); width: 100%; margin: 5px 0; }
.divider.inset { margin: 15px 0; opacity: 0.6; }

/* 操作按钮 */
.right-align { display: flex; justify-content: flex-end; margin-top: 10px; }
.fluent-primary-btn {
  padding: 9px 24px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;
  transition: all 0.2s; background-color: var(--accent-color); color: white; border: none;
  box-shadow: 0 2px 6px rgba(0, 120, 212, 0.3);
}
.fluent-primary-btn:hover { background-color: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 120, 212, 0.4); }
.fluent-primary-btn:active { transform: translateY(0); box-shadow: 0 2px 4px rgba(0, 120, 212, 0.3); }

/* 右侧列表布局 */
.system-list-card { padding: 15px 24px; }
.setting-list-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; }
.setting-info { display: flex; flex-direction: column; gap: 6px; padding-right: 20px; }
.setting-name { font-weight: 600; font-size: 15px; color: var(--text-primary); }
.setting-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.4; }

/* Win11 风格 Switch 开关 */
.fluent-switch { position: relative; display: inline-block; width: 44px; height: 22px; flex-shrink: 0; }
.fluent-switch input { opacity: 0; width: 0; height: 0; }
.fluent-switch .slider { position: absolute; cursor: pointer; inset: 0; background-color: #8c8c8c; border-radius: 22px; transition: 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
.fluent-switch .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
.fluent-switch input:checked + .slider { background-color: var(--accent-color); }
.fluent-switch input:checked + .slider:before { transform: translateX(22px); }
:global([data-theme='dark']) .fluent-switch .slider { background-color: #4b5563; }
:global([data-theme='dark']) .fluent-switch input:checked + .slider { background-color: var(--accent-color); }

/* Element Plus 覆盖 */
.full-width-form { width: 100%; }
.el-form-row { align-items: flex-start; }
.flex-item { flex: 1; min-width: 0; }

@media (max-width: 768px) {
  .scroll-area {
    padding: 10px 14px 24px;
  }

  .settings-header {
    margin-bottom: 20px;
  }

  .settings-col,
  .settings-grid {
    gap: 20px;
  }

  .fluent-card {
    padding: 18px;
  }

  .form-row,
  .setting-list-item,
  .right-align {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-info {
    padding-right: 0;
  }
}
</style>

<style>
/* 深度穿透：使 Element Plus 与左侧原生风格完美一致 */
.security-card .el-form-item__label {
  color: var(--text-primary) !important;
  font-weight: 500;
  font-size: 13px;
  padding-bottom: 8px !important;
}

.security-card .el-input__wrapper {
  background-color: var(--input-bg, #f3f5f9) !important;
  box-shadow: 0 0 0 1px var(--border-color) inset !important;
  border-radius: 6px;
  height: 36px;
  padding: 0 15px;
}
.dark .security-card .el-input__wrapper {
  background-color: #1e293b !important;
}

.security-card .el-input__wrapper.is-focus {
  background-color: var(--main-content-bg) !important;
  box-shadow: 0 0 0 1px var(--accent-color) inset !important;
}

.security-card .el-input__inner {
  color: var(--text-primary) !important;
  font-size: 14px;
}

.security-card .el-form-item__error {
  padding-top: 4px;
}
</style>
