<template>
  <div class="auth-container" :data-theme="settingStore.theme">

    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
      <div class="shape shape-4"></div>
      <div class="shape shape-5"></div>
    </div>

    <div class="auth-window">
      <div class="left-pane">
        <div class="image-overlay">
          <i class="fa-solid fa-cloud overlay-logo"></i>
          <h2>您的专属云端空间</h2>
          <p>安全、高效，随时随地访问您的文件。</p>
        </div>
      </div>

      <div class="right-pane">
        <button class="theme-toggle-btn" @click="settingStore.toggleTheme" aria-label="切换主题">
          <i v-if="settingStore.theme === 'light'" class="fa-solid fa-moon"></i>
          <i v-else class="fa-solid fa-sun"></i>
        </button>

        <div class="form-wrapper">
          <Transition name="fade" mode="out-in">
            <div v-if="formMode === 'login'" key="login">
              <form @submit.prevent="handleLogin" class="auth-form">
                <h1>欢迎回来</h1>
                <p class="subtitle">登录以继续</p>
                <div class="input-group">
                  <i class="fa-solid fa-user"></i>
                  <input type="text" placeholder="电子邮箱/用户名" v-model="loginForm.account" required>
                </div>
                <div class="input-group">
                  <i class="fa-solid fa-lock"></i>
                  <input type="password" placeholder="密码" v-model="loginForm.password" required>
                </div>
                <button type="submit" class="submit-btn">登 录</button>
                <p class="toggle-form-link">
                  还没有账户？ <a href="#" @click.prevent="toggleFormMode">立即注册</a>
                </p>
              </form>
            </div>

            <div v-else key="register">
              <form @submit.prevent="handleRegister" class="auth-form">
                <h1>创建账户</h1>
                <p class="subtitle">开启您的云端之旅</p>
                <div class="input-group">
                  <i class="fa-solid fa-user"></i>
                  <input type="text" placeholder="用户名" v-model="registerForm.username" required>
                </div>

                <div class="input-group">
                  <i class="fa-solid fa-envelope"></i>
                  <input type="email" placeholder="电子邮箱" v-model="registerForm.email" required>
                </div>

                <div class="verify-row">
                  <div class="input-group verify-input">
                    <i class="fa-solid fa-shield-halved"></i>
                    <input type="text" placeholder="验证码" v-model="registerForm.code" required>
                  </div>
                  <button
                      type="button"
                      class="verify-btn"
                      :disabled="countdown > 0"
                      @click="handleSendCode"
                  >
                    {{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
                  </button>
                </div>

                <div class="input-group">
                  <i class="fa-solid fa-lock"></i>
                  <input type="password" placeholder="设置密码" v-model="registerForm.password" required>
                </div>
                <button type="submit" class="submit-btn">注 册</button>
                <p class="toggle-form-link">
                  已有账户？ <a href="#" @click.prevent="toggleFormMode">返回登录</a>
                </p>
              </form>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import Setting from "@/store/setting.ts";
import {UserApi} from "@/commands/user.ts";
import {ElMessage} from "element-plus";
import {useRouter} from "vue-router";
let $router = useRouter();
const settingStore  = Setting();


// --- 组件内部状态 ---
const formMode = ref('login');
// 修改：将 email 字段重命名为 account，以便语义上支持邮箱和用户名
const loginForm = ref({ account: '', password: '' });
const registerForm = ref({ username: '', email: '', password: '', code: '' });
// --- 验证码倒计时逻辑 ---
const countdown = ref(0);
let timer = null;

//发送验证码
const handleSendCode = async () => {
  // 简单校验邮箱是否为空
  if (!registerForm.value.email) {
    alert("请先填写电子邮箱");
    return;
  }

  console.log(`正在向 ${registerForm.value.email} 发送验证码...`);
  const responseData = await UserApi.SeedCode(registerForm.value.email);
  if(responseData.status===1){
    ElMessage.error(responseData.Msg)
  }else{
    ElMessage.success('验证码发送成功')
  }
  // 开始倒计时 (60秒)
  countdown.value = 60;
  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
};

// 组件销毁时清除定时器，防止内存泄漏
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const toggleFormMode = () => formMode.value = formMode.value === 'login' ? 'register' : 'login';

//登陆
const handleLogin = async () => {
  // 修改：传入 account 而不是 email
  const responseData = await UserApi.login(loginForm.value.account, loginForm.value.password);
  if(responseData.Status===1){
    ElMessage.error(responseData.Msg)
  }else{
    settingStore.token = responseData.Data.token;
    ElMessage.success('登陆成功！')
    $router.push("/home")
  }
}

//注册
const handleRegister = async () => {
  const responseData = await UserApi.register(registerForm.value.username, registerForm.value.password,registerForm.value.email, registerForm.value.code);
  if(responseData.Status===1){
    ElMessage.error(responseData.Msg)
  }else{
    ElMessage.success('注册成功，开始登陆吧~')
    registerForm.value = {
      username: '',
      email: '',
      password: '',
      code: ''
    };
    toggleFormMode()
  }
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

/* --- 主题与基础样式 --- */
.auth-container {
  --accent-color: #0078d4;
  --accent-hover: #106ebe;
  --app-bg: #f3f5f9;
  --acrylic-base: rgba(255, 255, 255, 0.5);
  --border-color: rgba(0, 0, 0, 0.1);
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --bg-hover: rgba(0, 0, 0, 0.04);
  --shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2);

  /* 效果变量：亮色主题 */
  --shape-color: rgba(0, 120, 212, 0.08);
  --shape-glow: none;

  &[data-theme='dark'] {
    --app-bg: #111827;
    --acrylic-base: rgba(26, 35, 51, 0.5);
    --border-color: rgba(255, 255, 255, 0.1);
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --bg-hover: rgba(255, 255, 255, 0.05);
    --shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);

    /* 效果变量：暗黑主题 */
    --shape-color: rgba(139, 92, 246, 0.1); /* 紫色调 */
    --shape-glow: 0 0 70px 20px var(--shape-color); /* 发光效果 */
  }

  --glass-blur: blur(30px);
  --radius: 10px;

  background-color: var(--app-bg);
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: "Segoe UI Variable", "Segoe UI", "Microsoft YaHei", sans-serif;
  transition: background-color 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* --- 背景形状 --- */
.background-shapes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
.shape {
  position: absolute;
  border-radius: 50%;
  background-color: var(--shape-color);
  box-shadow: var(--shape-glow);
  animation: float 25s infinite linear;
  /* 新增：平滑过渡效果 */
  transition: background-color 0.5s ease, box-shadow 0.5s ease;
}
.shape-1 { width: 400px; height: 400px; left: -150px; top: -150px; animation-duration: 35s; }
.shape-2 { width: 150px; height: 150px; right: 5%; bottom: 10%; animation-duration: 20s; animation-delay: 3s;}
.shape-3 { width: 250px; height: 250px; right: -80px; bottom: 30%; animation-duration: 30s; animation-delay: 5s;}
.shape-4 { width: 80px; height: 80px; left: 10%; bottom: 5%; animation-duration: 15s; }
.shape-5 { width: 300px; height: 300px; left: 25%; bottom: -200px; animation-duration: 40s; animation-delay: 8s;}

@keyframes float {
  0% { transform: translateY(0) rotate(0deg); opacity: 0.8; }
  50% { opacity: 0.2; }
  100% { transform: translateY(-120vh) rotate(360deg); opacity: 0.8; }
}

/* --- 整体窗口布局 --- */
.auth-window {
  width: 90vw;
  max-width: 960px;
  height: 600px;
  display: flex;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  position: relative;
  z-index: 1;
  background-color: var(--app-bg);
}

/* --- 左侧图片面板 --- */
.left-pane {
  flex: 1;
  background-image: url('@/assets/loginImage.jpg');
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
}
.image-overlay {
  flex: 1; /* 关键：使其在flex容器中伸展 */
  display: flex; /* 自身也设为flex，以便控制内部元素 */
  flex-direction: column;
  padding: 40px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.1));
  color: #fff;
}
.overlay-logo {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: #fff;
}
.image-overlay h2 {
  font-size: 2.5rem;
  font-weight: 600;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.image-overlay p {
  font-size: 1rem;
  max-width: 300px;
  line-height: 1.6;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}


/* --- 右侧表单面板 --- */
.right-pane {
  width: 420px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  background-color: var(--acrylic-base);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-left: 1px solid var(--border-color);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
.form-wrapper {
  width: 100%;
}
.auth-form {
  text-align: center;
  color: var(--text-primary);
}
.auth-form h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 8px;
}
.auth-form .subtitle {
  color: var(--text-secondary);
  margin-bottom: 35px;
}

/* --- 表单元素 --- */
.input-group {
  position: relative;
  margin-bottom: 20px;
}
.input-group i {
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  font-size: 14px;
}
.input-group input {
  width: 100%;
  height: 50px;
  padding: 0 20px 0 45px;
  background-color: var(--bg-hover);
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 1rem;
  outline: none;
  transition: all 0.2s ease;
}
.input-group input::placeholder {
  color: var(--text-secondary);
}
.input-group input:focus {
  background-color: transparent;
  border-color: var(--accent-color);
}

/* --- 新增：验证码行布局 --- */
.verify-row {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.verify-row .input-group {
  margin-bottom: 0; /* 清除默认下边距，由父级flex gap控制或自行控制 */
  flex: 1; /* 输入框占据剩余空间 */
}
/* 验证码按钮样式 */
.verify-btn {
  height: 50px;
  padding: 0 15px;
  background-color: transparent;
  border: 1px solid var(--accent-color);
  color: var(--accent-color);
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap; /* 防止文字换行 */
  transition: all 0.2s ease;
}
.verify-btn:hover:not(:disabled) {
  background-color: var(--accent-color);
  color: #fff;
}
.verify-btn:disabled {
  border-color: var(--text-secondary);
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.7;
}

.submit-btn {
  width: 100%;
  height: 50px;
  margin-top: 10px;
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}
.submit-btn:hover {
  background: var(--accent-hover);
}
.toggle-form-link {
  margin-top: 25px;
  font-size: 14px;
  color: var(--text-secondary);
}
.toggle-form-link a {
  color: var(--accent-color);
  font-weight: 600;
  text-decoration: none;
}

/* --- 主题切换按钮 --- */
.theme-toggle-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.theme-toggle-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* --- Vue Transition 动画 --- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .auth-container {
    padding: 18px;
  }

  .auth-window {
    width: 100%;
    max-width: 480px;
    height: auto;
    min-height: 0;
    flex-direction: column;
  }

  .left-pane {
    min-height: 200px;
  }

  .image-overlay {
    padding: 24px;
  }

  .image-overlay h2 {
    font-size: 2rem;
  }

  .right-pane {
    width: 100%;
    padding: 28px 22px 24px;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }
}

@media (max-width: 640px) {
  .auth-container {
    align-items: stretch;
    padding: 0;
  }

  .auth-window {
    max-width: none;
    min-height: 100vh;
    border-radius: 0;
  }

  .left-pane {
    min-height: 160px;
  }

  .overlay-logo {
    font-size: 2.25rem;
  }

  .image-overlay h2 {
    font-size: 1.6rem;
  }

  .image-overlay p,
  .auth-form .subtitle,
  .toggle-form-link {
    font-size: 0.95rem;
  }

  .verify-row {
    flex-direction: column;
  }

  .verify-btn,
  .submit-btn,
  .input-group input {
    height: 46px;
  }
}
</style>
