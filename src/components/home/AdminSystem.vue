<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import Setting from "@/store/setting.js";
import { AdminApi } from "@/commands/admin.ts";
import type { SystemConfig } from '@/models/user_models'; // 引入接口

const settingStore = Setting();
const isSaving = ref(false);
const isLoading = ref(true);

const systemConfig = ref<SystemConfig>();

// 获取服务器当前配置
const fetchSystemConfig = async () => {
  isLoading.value = true;
  try {
    const res = await AdminApi.GetConfigs();
    if (res.Status === 0 && res.Data) {
      const d = res.Data;

      // 核心修复：在这里进行数据字段映射。
      // 兼容后端返回的大写 Config 结构，映射到前端绑定的小写 Setting 结构上。
      systemConfig.value = {
        jwtSetting: d.JwtConfig || d.jwtSetting || {},
        dbSetting: d.DbConfig || d.dbSetting || {},
        cacheSetting: d.CacheConfig || d.cacheSetting || {},
        fileSetting: d.FileConfig || d.fileSetting || {},
        userSetting: d.UserConfig || d.userSetting || {},
        emailSetting: d.EmailConfig || d.emailSetting || {},
        mqSetting: d.MQConfig || d.mqSetting || {},
        aiSetting: d.AIConfig || d.aiSetting || {},
        basicInformation: d.BasicInformation || d.basicInformation || {},
        serverSettings: {
          IPv4: d.ServerSettings?.IPv4 || d.serverSettings?.IPv4 || {},
          IPv6: d.ServerSettings?.IPv6 || d.serverSettings?.IPv6 || {}
        }
      } as SystemConfig;

    } else {
      ElMessage.error('加载系统配置失败：' + (res.Msg || '未知错误'));
    }
  } catch (error) {
    console.error('获取配置异常:', error);
    ElMessage.error('获取配置请求发生异常');
  } finally {
    isLoading.value = false;
  }
};

// 保存配置到服务器
const handleSaveConfig = async () => {
  if (!systemConfig.value) return; // 判空拦截

  isSaving.value = true;
  try {
    const res = await AdminApi.UpdateSystemConfig(systemConfig.value);
    if (res.Status === 0) {
      ElMessage.success(res.Msg);
      await fetchSystemConfig(); // 刷新数据，重新获取脱敏后的状态
    } else {
      ElMessage.error('保存失败：' + (res.Msg || '未知错误'));
    }
  } catch (error) {
    console.error('保存配置异常:', error);
    ElMessage.error('提交请求发生异常');
  } finally {
    isSaving.value = false;
  }
};

// 组件挂载时获取数据
onMounted(() => {
  fetchSystemConfig();
});
</script>

<template>
  <div class="fade-in panel-content scroll-area custom-form-container" v-loading="isLoading">

    <!-- 顶部标题与操作栏 -->
    <div class="page-header mb-20">
      <div class="header-text">
        <h2 style="margin: 0; font-size: 20px; color: var(--text-primary);">系统核心配置</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: var(--text-secondary);">管理网盘基础运行参数、数据库、存储、服务与网络监听等底层信息。</p>
      </div>
      <!-- 禁用逻辑：数据还没加载完时不许保存 -->
      <el-button type="primary" color="var(--accent-color)" @click="handleSaveConfig" :loading="isSaving" :disabled="!systemConfig">
        <i class="fa-solid fa-floppy-disk mr-8"></i> 保存应用配置
      </el-button>
    </div>

    <!-- 必须加上 v-if="systemConfig" 兜底值 -->
    <div class="settings-grid" v-if="systemConfig">

      <!-- ================= 左列 ================= -->
      <div class="settings-col">

        <!-- 基础与 AI 设​​置 -->
        <div class="setting-section">
          <h3 class="section-title"><i class="fa-solid fa-sliders"></i> 基础与 AI 设定</h3>
          <div class="fluent-card">
            <el-form :model="systemConfig" label-position="top">
              <el-row :gutter="20">
                <el-col :span="24">
                  <el-form-item label="项目名称">
                    <el-input v-model="systemConfig.basicInformation.ProjectName" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="启用 AI 搜图功能">
                    <el-switch v-model="systemConfig.aiSetting.Enable" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="图片相似度阈值 (0-1)">
                    <el-input-number v-model="systemConfig.aiSetting.ImageCosineThreshold" :min="0" :max="1" :step="0.05" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>

                <el-col :span="24">
                  <el-form-item label="接口地址 (BaseURL)">
                    <el-input
                        v-model="systemConfig.aiSetting.BaseURL"
                        placeholder="例如：https://api.openai.com/v1/"
                        clearable
                    />
                  </el-form-item>
                </el-col>

                <el-col :xs="24" :sm="12">
                  <el-form-item label="API 密钥 (ApiKey)">
                    <el-input
                        v-model="systemConfig.aiSetting.ApiKey"
                        type="password"
                        show-password
                        placeholder="请输入你的 API Key"
                        clearable
                    />
                  </el-form-item>
                </el-col>

                <el-col :xs="24" :sm="12">
                  <el-form-item label="模型名称 (Model)">
                    <el-input
                        v-model="systemConfig.aiSetting.Model"
                        placeholder="例如：gpt-4o, gpt-3.5-turbo 等"
                        clearable
                    />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </div>

        <!-- 文件与存储配置 -->
        <div class="setting-section">
          <h3 class="section-title"><i class="fa-regular fa-folder-open"></i> 文件与存储规则</h3>
          <div class="fluent-card">
            <el-form :model="systemConfig.fileSetting" label-position="top">
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="名称长度限制">
                    <el-input-number v-model="systemConfig.fileSetting.FileOrDirNameLengthLimit" :min="1" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="单文件最大上传限制 (Bytes)">
                    <el-input-number v-model="systemConfig.fileSetting.MaxFileSize" :min="0" :step="1048576" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>

              <!-- ======== 新增：分片与清理机制 ======== -->
              <el-divider content-position="left">分片上传与任务清理</el-divider>
              <el-row :gutter="20">
                <el-col :span="24">
                  <el-form-item label="分块上传单片大小 (Bytes)">
                    <el-input-number v-model="systemConfig.fileSetting.FileChunkSizeBytes" :min="0" :step="1048576" style="width: 100%;" placeholder="默认 10485760 (10MB)" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="分片任务超时清理 (秒)">
                    <el-input-number v-model="systemConfig.fileSetting.CleanupChunkFilesWorkerTimeOutSecond" :min="0" :step="60" style="width: 100%;" placeholder="默认 3600" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="清理循环检测周期 (秒)">
                    <el-input-number v-model="systemConfig.fileSetting.CleanupChunkFilesWorkerLoopTimeSecond" :min="0" :step="60" style="width: 100%;" placeholder="默认 600" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">过滤与物理路径策略</el-divider>
              <!-- ======================================== -->

              <el-form-item label="名称黑名单 (使用 | 隔开)">
                <el-input v-model="systemConfig.fileSetting.FileOrDirNameBlacklist" placeholder="例如：a|b|c (留空则不更改)" />
              </el-form-item>

              <el-form-item label="名称黑名单正则表达式">
                <el-input v-model="systemConfig.fileSetting.FileOrDirNameBlacklistRegExp" placeholder="留空则不更改 (匹配到则拦截)" />
              </el-form-item>

              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="本地物理存储路径 (使用 | 隔开)">
                    <el-input v-model="systemConfig.fileSetting.LocalFilePath" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="临时文件存储路径">
                    <el-input v-model="systemConfig.fileSetting.TempFilePath" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-form-item label="是否启用软删除">
                <el-switch v-model="systemConfig.fileSetting.IsSoftDelete" active-text="开启" inactive-text="关闭 (直接物理删除)" />
              </el-form-item>
            </el-form>
          </div>
        </div>

        <!-- 服务器监听配置 -->
        <div class="setting-section">
          <h3 class="section-title"><i class="fa-solid fa-network-wired"></i> 网络与监听设置</h3>
          <div class="fluent-card">
            <el-form label-position="top">
              <el-divider content-position="left">IPv4 监听配置</el-divider>
              <el-row :gutter="15">
                <el-col :span="10">
                  <el-form-item label="IP 地址">
                    <el-input v-model="systemConfig.serverSettings.IPv4.Ip" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="6">
                  <el-form-item label="端口">
                    <el-input-number v-model="systemConfig.serverSettings.IPv4.Port" :controls="false" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="启用 SSL">
                    <el-switch v-model="systemConfig.serverSettings.IPv4.EnableSsl" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="15" v-if="systemConfig.serverSettings.IPv4.EnableSsl">
                <el-col :span="12">
                  <el-form-item label="证书路径">
                    <el-input v-model="systemConfig.serverSettings.IPv4.CertPath" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="证书密码">
                    <el-input v-model="systemConfig.serverSettings.IPv4.CertPassword" type="password" show-password placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">IPv6 监听配置</el-divider>
              <el-row :gutter="15">
                <el-col :span="10">
                  <el-form-item label="IP 地址">
                    <el-input v-model="systemConfig.serverSettings.IPv6.Ip" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="6">
                  <el-form-item label="端口">
                    <el-input-number v-model="systemConfig.serverSettings.IPv6.Port" :controls="false" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="启用 SSL">
                    <el-switch v-model="systemConfig.serverSettings.IPv6.EnableSsl" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="15" v-if="systemConfig.serverSettings.IPv6.EnableSsl">
                <el-col :span="12">
                  <el-form-item label="证书路径">
                    <el-input v-model="systemConfig.serverSettings.IPv6.CertPath" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="证书密码">
                    <el-input v-model="systemConfig.serverSettings.IPv6.CertPassword" type="password" show-password placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </div>

      </div>

      <!-- ================= 右列 ================= -->
      <div class="settings-col">

        <!-- 数据库与缓存 -->
        <div class="setting-section">
          <h3 class="section-title"><i class="fa-solid fa-database"></i> 数据库与缓存</h3>
          <div class="fluent-card">
            <el-form label-position="top">
              <el-divider content-position="left" style="margin-top: 0;">数据库配置 (DB)</el-divider>
              <el-row :gutter="20">
                <el-col :span="10">
                  <el-form-item label="数据库类型">
                    <el-select v-model="systemConfig.dbSetting.DbType" style="width: 100%" placeholder="留空则不更改">
                      <el-option label="MySql (0)" :value="0" />
                      <el-option label="SqlServer (1)" :value="1" />
                      <el-option label="PostgreSql (4)" :value="4" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="14">
                  <el-form-item label="系统日志">
                    <el-switch v-model="systemConfig.dbSetting.LogWriteToDB" active-text="写入数据库" inactive-text="仅文件" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="连接字符串 (Connection String)">
                <el-input v-model="systemConfig.dbSetting.ConnectionString" type="password" show-password placeholder="留空则不更改" />
              </el-form-item>

              <el-divider content-position="left">缓存引擎 (Cache)</el-divider>
              <el-row :gutter="20">
                <el-col :span="10">
                  <el-form-item label="缓存类型">
                    <el-select v-model="systemConfig.cacheSetting.CacheType" style="width: 100%" placeholder="留空则不更改">
                      <el-option label="内部集成 (MemoryCache)" value="MemoryCache" />
                      <el-option label="Redis" value="Redis" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="14" v-if="systemConfig.cacheSetting.CacheType === 'Redis'">
                  <el-form-item label="Redis 连接串">
                    <el-input v-model="systemConfig.cacheSetting.ConnectionString" type="password" show-password placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="默认有效期 (天)">
                    <el-input-number v-model="systemConfig.cacheSetting.ValidityPeriod" :min="1" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="临时下载密钥有效期 (分钟)">
                    <el-input-number v-model="systemConfig.cacheSetting.TempDownLoadKeyValidityPeriod" :min="1" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </div>

        <!-- 认证与授权 (JWT) -->
        <div class="setting-section">
          <h3 class="section-title"><i class="fa-solid fa-shield-halved"></i> 认证与安全 (JWT)</h3>
          <div class="fluent-card">
            <el-form :model="systemConfig.jwtSetting" label-position="top">
              <el-form-item label="密钥 (SigningKey)">
                <el-input v-model="systemConfig.jwtSetting.SigningKey" type="password" show-password placeholder="留空则不更改" />
              </el-form-item>
              <el-row :gutter="20">
                <el-col :span="8">
                  <el-form-item label="颁发者 (Issuer)">
                    <el-input v-model="systemConfig.jwtSetting.Issuer" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="接收者 (Audience)">
                    <el-input v-model="systemConfig.jwtSetting.Audience" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="过期时间 (秒)">
                    <el-input-number v-model="systemConfig.jwtSetting.ExpireSeconds" :min="60" style="width: 100%;" :controls="false" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </div>

        <!-- 默认用户配置 -->
        <div class="setting-section">
          <h3 class="section-title"><i class="fa-solid fa-users-gear"></i> 默认用户与配额</h3>
          <div class="fluent-card">
            <el-form :model="systemConfig.userSetting" label-position="top">
              <el-form-item label="默认用户头像地址 (URL)">
                <el-input v-model="systemConfig.userSetting.DefaultUserAvatar" placeholder="留空则不更改" />
              </el-form-item>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="新用户默认容量 (GB)">
                    <el-input-number v-model="systemConfig.userSetting.DefaultTotalStorageGb" :min="1" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="用户名最大长度">
                    <el-input-number v-model="systemConfig.userSetting.UserNameMaxLength" :min="2" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="密码最小长度">
                    <el-input-number v-model="systemConfig.userSetting.UserPassWordMinLength" :min="4" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="密码最大长度">
                    <el-input-number v-model="systemConfig.userSetting.UserPassWordMaxLength" :min="6" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </div>

        <!-- 邮件与消息队列 -->
        <div class="setting-section">
          <h3 class="section-title"><i class="fa-solid fa-envelope-open-text"></i> 邮件与消息队列</h3>
          <div class="fluent-card">
            <el-form label-position="top">
              <el-divider content-position="left" style="margin-top: 0;">SMTP 邮件服务</el-divider>
              <el-row :gutter="20">
                <el-col :span="16">
                  <el-form-item label="SMTP 地址">
                    <el-input v-model="systemConfig.emailSetting.SmtpServer" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="端口">
                    <el-input-number v-model="systemConfig.emailSetting.SmtpPort" :min="1" :controls="false" style="width: 100%;" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="发件人邮箱">
                    <el-input v-model="systemConfig.emailSetting.Email" placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="邮箱密码/授权码">
                    <el-input v-model="systemConfig.emailSetting.PassWord" type="password" show-password placeholder="留空则不更改" />
                  </el-form-item>
                </el-col>
              </el-row>

              <el-divider content-position="left">消息队列 (MQ)</el-divider>
              <el-row :gutter="20">
                <el-col :span="10">
                  <el-form-item label="队列类型">
                    <el-select v-model="systemConfig.mqSetting.MqType" style="width: 100%" placeholder="留空则不更改">
                      <el-option label="内部内存 (MemoryMQ)" value="MemoryMQ" />
                      <el-option label="RabbitMQ" value="RabbitMQ" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="14">
                  <el-form-item label="连接字符串" v-if="systemConfig.mqSetting.MqType === 'RabbitMQ'">
                    <el-input v-model="systemConfig.mqSetting.ConnectionString" type="password" show-password placeholder="留空则不更改" />
                  </el-form-item>
                  <el-form-item label="连接字符串" v-else>
                    <el-input disabled placeholder="留空则不更改 (Memory模式无需配置)" />
                  </el-form-item>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
/* 容器及滚动条设置 */
.scroll-area {
  overflow-y: auto;
  padding: 20px 30px 40px 30px;
  height: 100%;
}
.scroll-area::-webkit-scrollbar { width: 8px; }
.scroll-area::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.15); border-radius: 8px; }
.scroll-area::-webkit-scrollbar-thumb:hover { background-color: rgba(0, 0, 0, 0.3); }

/* 页面顶部栏 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-color);
}

.mr-8 { margin-right: 8px; }
.mb-20 { margin-bottom: 20px; }

/* 核心网格布局 */
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 25px;
  align-items: start;
  padding-bottom: 40px;
}
@media (max-width: 1100px) {
  .settings-grid { grid-template-columns: 1fr; }
}
.settings-col {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

/* 标题样式 */
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title i { color: var(--accent-color); font-size: 18px; }

/* Fluent 卡片风格 */
.fluent-card {
  background-color: var(--main-content-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius, 12px);
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  transition: border-color 0.3s, background-color 0.3s, box-shadow 0.3s ease;
}
.fluent-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04); }
:global([data-theme='dark']) .fluent-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15); }

/* 渐显动画 */
.fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .scroll-area {
    padding: 14px 14px 24px;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .fluent-card {
    padding: 18px;
  }
}
</style>

<style>
/* 穿透修改 Element Plus 原生表单组件样式，适配 Fluent UI 与暗黑模式 */
.custom-form-container .el-form-item__label {
  color: var(--text-primary) !important;
  font-weight: 500;
  font-size: 13px;
  padding-bottom: 4px !important;
}

.custom-form-container .el-input__wrapper,
.custom-form-container .el-textarea__inner {
  background-color: var(--input-bg, #f3f5f9) !important;
  box-shadow: 0 0 0 1px var(--border-color) inset !important;
  border-radius: 6px;
  transition: all 0.2s;
}

.custom-form-container .el-input__inner,
.custom-form-container .el-textarea__inner {
  color: var(--text-primary) !important;
  font-size: 14px;
}

/* 焦点状态高亮 */
.custom-form-container .el-input__wrapper.is-focus,
.custom-form-container .el-textarea__inner:focus {
  background-color: var(--main-content-bg) !important;
  box-shadow: 0 0 0 1px var(--accent-color) inset !important;
}

/* 暗黑模式强行注入 */
.dark .custom-form-container .el-input__wrapper,
.dark .custom-form-container .el-textarea__inner {
  background-color: #1e293b !important;
}
.dark .custom-form-container .el-input__wrapper.is-focus,
.dark .custom-form-container .el-textarea__inner:focus {
  background-color: #182235 !important;
}

.custom-form-container .el-divider__text {
  background-color: var(--main-content-bg) !important;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: bold;
}
.custom-form-container .el-divider {
  border-top-color: var(--border-color);
  margin-top: 10px;
  margin-bottom: 20px;
}

/* 适配 Select 下拉与 Input Number 样式 */
.custom-form-container .el-select .el-input__wrapper {
  cursor: pointer;
}
.custom-form-container .el-input-number__decrease,
.custom-form-container .el-input-number__increase {
  background-color: var(--bg-hover) !important;
  border-color: var(--border-color) !important;
  color: var(--text-primary) !important;
}
</style>