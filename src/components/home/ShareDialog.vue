<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { ElDialog, ElForm, ElFormItem, ElInput, ElDatePicker, ElButton, ElMessage, ElSwitch } from 'element-plus';
import QrcodeVue from 'qrcode.vue';
import { useClipboard } from '@vueuse/core';
import Setting from "@/store/setting.js";
import { FileShareData } from "@/models/user_models";
import { FileApi } from "@/commands/file";
import dayjs from 'dayjs';

// --- Props & Emits ---
const props = defineProps<{
  modelValue: boolean;
  fileId: string;
  fileName: string;
  editData?: any;      // 【新增】：如果传入此项，则说明是“编辑模式”
}>();

const emit = defineEmits(['update:modelValue', 'success']);

const settingStore = Setting();
const isCreated = ref(false);
const loading = ref(false);

const resultData = reactive({ shareUrl: '', password: '' });

const formData = reactive({
  validityRange: [] as Date[],
  isPrivate: true,
  password: '',
  introduction: ''
});

const rules = {
  validityRange: [{ required: true, message: '请选择有效期范围', trigger: 'change' }],
  password: [{ max: 10, message: '密码长度最多10个字符', trigger: 'blur' }],
  introduction: [{ max: 150, message: '简介最多150个字符', trigger: 'blur' }]
};

const formRef = ref();
const { copy } = useClipboard();

// --- 计算属性：当前是否为编辑模式 ---
const isEditMode = computed(() => !!props.editData);

// --- 初始化/重置逻辑 ---
const resetForm = () => {
  isCreated.value = false;
  loading.value = false;

  if (isEditMode.value && props.editData) {
    // 编辑模式：回显数据
    formData.validityRange = [new Date(props.editData.BeginValidity), new Date(props.editData.EndValidity)];
    formData.isPrivate = !!props.editData.Password;
    formData.password = props.editData.Password || '';
    formData.introduction = props.editData.Introduction || '';
  } else {
    // 新建模式：初始化默认值
    formData.isPrivate = false;
    formData.password = '';
    formData.introduction = '';
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);
    formData.validityRange = [start, end];
  }
};

watch(() => props.modelValue, (newVal) => {
  if (newVal) resetForm();
});

// --- 生成 / 保存分享链接逻辑 ---
const handleCreateOrUpdateShare = () => {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;

    loading.value = true;
    try {
      const payload: FileShareData = {
        ShareFileId: props.fileId,
        BeginValidity: dayjs(formData.validityRange[0]).format('YYYY-MM-DDTHH:mm:ss'),
        EndValidity: dayjs(formData.validityRange[1]).format('YYYY-MM-DDTHH:mm:ss'),
        Password: formData.isPrivate ? formData.password : null,
        Introduction: formData.introduction
      };

      if (isEditMode.value) {
        const currentShareId = props.editData?.Id;

        if (!currentShareId) {
          ElMessage.error("获取分享链接ID失败");
          return;
        }


        const info = await FileApi.UpdateShareFileInfo(currentShareId,payload)
        if (info.Status===0) {
          ElMessage.success('分享设置修改成功！');
          emit('success');
          handleClose(); // 编辑成功后直接关闭，不需要显示二维码步骤
        }else{
          ElMessage.error('分享设置修改失败：'+info.Msg);
          return
        }

      } else {
        // --- 走新建 API ---
        const res = await FileApi.CreateShareKey(payload);
        if (res.Status === 0) {
          resultData.shareUrl = `${window.location.origin}/share/${res.Data}`;
          resultData.password = payload.Password;
          isCreated.value = true;
          ElMessage.success('分享链接创建成功！');
          emit('success', res.Msg);
        } else {
          ElMessage.error('创建失败: ' + res.Msg);
        }
      }
    } catch (error) {
      console.error(error);
      ElMessage.error('操作发生异常');
    } finally {
      loading.value = false;
    }
  });
};

const handleCopyLink = async () => {
  let textToCopy = `分享文件：${props.fileName}\n链接：${resultData.shareUrl}`;
  if (resultData.password) textToCopy += `\n提取码：${resultData.password}`;
  await copy(textToCopy);
  ElMessage.success('链接及密码已复制到剪贴板');
};

const handleClose = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <el-dialog
      :model-value="modelValue"
      :title="isEditMode ? '修改分享设置' : (isCreated ? '分享成功' : '创建分享链接')"
      width="480px"
      @close="handleClose"
      align-center
      append-to-body
      :class="'custom-dialog share-dialog ' + settingStore.theme"
  >
    <div class="share-container">

      <div v-if="!isCreated" class="form-step">
        <div class="file-info-header">
          <i class="fa-solid fa-link link-icon"></i>
          <span class="file-name" :title="fileName">{{ fileName }}</span>
        </div>

        <el-form ref="formRef" :model="formData" :rules="rules" label-position="top" class="share-form">
          <el-form-item label="有效期设置" prop="validityRange">
            <el-date-picker
                v-model="formData.validityRange"
                type="datetimerange"
                range-separator="至"
                start-placeholder="开始时间"
                end-placeholder="结束时间"
                format="YYYY-MM-DD HH:mm"
                style="width: 100%;"
            />
          </el-form-item>

          <div class="inline-switch-item">
            <span class="label-text">私密分享 (提取码)</span>
            <el-switch v-model="formData.isPrivate" />
          </div>

          <el-collapse-transition>
            <div v-show="formData.isPrivate">
              <el-form-item prop="password" style="margin-bottom: 20px;">
                <el-input v-model="formData.password" placeholder="请输入提取码 (留空将自动生成)" maxlength="10" show-word-limit clearable />
              </el-form-item>
            </div>
          </el-collapse-transition>

          <el-form-item label="留言 / 简介 (选填)" prop="introduction">
            <el-input v-model="formData.introduction" type="textarea" :rows="3" placeholder="给接收者留句言或者介绍一下文件内容..." maxlength="150" show-word-limit />
          </el-form-item>
        </el-form>

        <div class="dialog-footer">
          <el-button @click="handleClose">取消</el-button>
          <el-button type="primary" @click="handleCreateOrUpdateShare" :loading="loading">
            {{ isEditMode ? '保存修改' : '生成分享链接' }}
          </el-button>
        </div>
      </div>

      <div v-else class="result-step">
        <div class="success-header">
          <i class="fa-solid fa-circle-check success-icon"></i>
          <h3>分享链接已生成</h3>
          <p class="subtitle">{{ fileName }}</p>
        </div>

        <div class="qrcode-box">
          <qrcode-vue :value="resultData.shareUrl" :size="150" level="M" :background="settingStore.theme === 'dark' ? '#182235' : '#ffffff'" :foreground="settingStore.theme === 'dark' ? '#f9fafb' : '#1f2937'" />
          <span class="qr-tip">扫码直接访问</span>
        </div>

        <div class="link-info-box">
          <div class="info-row">
            <span class="label">链接：</span>
            <div class="value-box"><input type="text" readonly :value="resultData.shareUrl" class="readonly-input"></div>
          </div>
          <div v-if="resultData.password" class="info-row" style="margin-top: 10px;">
            <span class="label">提取码：</span>
            <div class="value-box pwd-box"><span class="pwd-text">{{ resultData.password }}</span></div>
          </div>
        </div>

        <div class="dialog-footer center-footer">
          <el-button @click="handleClose">关闭</el-button>
          <el-button type="primary" @click="handleCopyLink">
            <i class="fa-regular fa-copy" style="margin-right: 6px;"></i> 复制链接及提取码
          </el-button>
        </div>
      </div>

    </div>
  </el-dialog>
</template>

<style scoped>
/* 保持你的原样CSS，不用动 */
.share-container { padding: 0 10px 10px 10px; }
.file-info-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background-color: var(--bg-hover); border-radius: 6px; margin-bottom: 20px; }
.link-icon { color: var(--accent-color); font-size: 16px; }
.file-name { font-weight: 600; color: var(--text-primary); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.inline-switch-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.label-text { font-size: 14px; color: var(--text-secondary); }
.dialog-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 30px; }
.center-footer { justify-content: center; margin-top: 20px; }
.result-step { display: flex; flex-direction: column; align-items: center; }
.success-header { text-align: center; margin-bottom: 20px; }
.success-icon { font-size: 48px; color: #67c23a; margin-bottom: 10px; }
.success-header h3 { margin: 0 0 5px 0; color: var(--text-primary); font-size: 18px; }
.subtitle { margin: 0; color: var(--text-secondary); font-size: 13px; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qrcode-box { display: flex; flex-direction: column; align-items: center; background-color: var(--main-content-bg); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 20px; }
.qr-tip { margin-top: 10px; font-size: 12px; color: var(--text-secondary); }
.link-info-box { width: 100%; background-color: var(--bg-hover); padding: 15px; border-radius: 8px; }
.info-row { display: flex; align-items: center; }
.info-row .label { width: 65px; font-size: 13px; color: var(--text-secondary); flex-shrink: 0; }
.value-box { flex: 1; min-width: 0; }
.readonly-input { width: 100%; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background-color: var(--main-content-bg); color: var(--text-primary); font-size: 13px; outline: none; }
.pwd-box { display: flex; }
.pwd-text { background-color: rgba(64, 158, 255, 0.1); color: var(--accent-color); padding: 4px 12px; border-radius: 4px; font-weight: 600; letter-spacing: 1px; }
</style>

<style>
.share-dialog .el-form-item__label { color: var(--text-primary) !important; }

/* --- 【修改】普通状态：让输入框底色和弹窗底色产生色差 --- */
.share-dialog .el-input__wrapper,
.share-dialog .el-textarea__inner {
  background-color: var(--bg-hover) !important;
  box-shadow: 0 0 0 1px var(--border-color) inset !important;
  transition: all 0.2s;
}

/* 聚焦状态：边框高亮 */
.share-dialog .el-input__wrapper.is-focus,
.share-dialog .el-textarea__inner:focus {
  box-shadow: 0 0 0 1px var(--accent-color) inset !important;
  background-color: transparent !important;
}

.share-dialog .el-input__inner,
.share-dialog .el-textarea__inner {
  color: var(--text-primary) !important;
}

/* --- 【新增】针对暗黑模式的强力兜底 --- */
.share-dialog.dark .el-input__wrapper,
.share-dialog.dark .el-textarea__inner {
  /* 垫一层极淡的白色，让输入框在黑底上浮现出来 */
  background-color: rgba(255, 255, 255, 0.04) !important;
  box-shadow: 0 0 0 1px #374151 inset !important;
}

.share-dialog.dark .el-input__wrapper.is-focus,
.share-dialog.dark .el-textarea__inner:focus {
  box-shadow: 0 0 0 1px var(--accent-color) inset !important;
}

/* --- 【新增】修复字数统计 (x/150) 的底色遮挡问题 --- */
.share-dialog .el-input__count,
.share-dialog .el-input__count .el-input__count-inner {
  background: transparent !important;
  color: var(--text-secondary) !important;
}

/* 时间选择器暗黑模式修正 */
.dark .el-picker-panel { background-color: #1d2129; border-color: #374151; color: #f9fafb; }
.dark .el-date-range-picker__content.is-left { border-right: 1px solid #374151; }
.dark .el-date-table th { color: #f9fafb; }
</style>