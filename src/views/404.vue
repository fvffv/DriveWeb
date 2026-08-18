<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Setting from "@/store/setting.js";

// --- 状态管理 ---
const settingStore  = Setting();

// --- 路由 ---
const router = useRouter();
const goHome = () => {
  router.push('/');
};
</script>

<template>
  <div class="not-found-container" :data-theme="settingStore.theme">

    <!-- 新增：幽默的问号背景 -->
    <div class="background-questions">
      <div v-for="n in 15" :key="n" class="question-mark">?</div>
    </div>

    <!-- 主题切换按钮 -->
    <button class="theme-toggle-btn" @click="settingStore.toggleTheme" aria-label="切换主题">
      <i v-if="settingStore.theme === 'light'" class="fa-solid fa-moon"></i>
      <i v-else class="fa-solid fa-sun"></i>
    </button>

    <div class="error-window">
      <div class="error-content">
        <i class="fa-solid fa-ghost icon-ghost"></i>
        <h1 class="error-code">404</h1>
        <p class="error-message">页面“迷路”了</p>
        <p class="error-description">
          别担心，不是你的问题。它可能只是去外太空探险了。
        </p>
        <button @click="goHome" class="action-btn">
          <i class="fa-solid fa-house"></i>
          <span>带我回地球</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 确保 Font Awesome 图标库已加载 */
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');

/* --- 主题与基础样式 --- */
.not-found-container {
  --accent-color: #0078d4;
  --accent-hover: #106ebe;
  --app-bg: #f3f5f9;
  --acrylic-base: rgba(252, 252, 252, 0.65);
  --border-color: #eef0f3;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.15);

  /* 效果变量：亮色主题 */
  --effect-color: rgba(0, 0, 0, 0.06);

  &[data-theme='dark'] {
    --app-bg: #111827;
    --acrylic-base: rgba(26, 35, 51, 0.65);
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.3);

    /* 效果变量：暗黑主题 */
    --effect-color: rgba(255, 255, 255, 0.08);
  }

  --glass-blur: blur(25px);
  --radius: 12px;

  background-color: var(--app-bg);
  height: 100vh;
  width: 100vw;
  color: var(--text-primary);
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Segoe UI Variable', 'Segoe UI', 'Microsoft YaHei', sans-serif;
  transition: background-color 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* --- 新增：迷途的问号 --- */
.background-questions {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
.question-mark {
  position: absolute;
  color: var(--effect-color);
  font-weight: bold;
  user-select: none;
  animation: wander 20s infinite linear;
  transition: color 0.5s ease;
}

/* 通过 nth-child 为每个问号设置不同的样式和动画，创造随机感 */
.question-mark:nth-child(1) { font-size: 80px; top: 10%; left: 5%; animation-duration: 25s; }
.question-mark:nth-child(2) { font-size: 40px; top: 20%; left: 80%; animation-duration: 30s; }
.question-mark:nth-child(3) { font-size: 120px; top: 70%; left: 10%; animation-duration: 22s; }
.question-mark:nth-child(4) { font-size: 50px; top: 85%; left: 88%; animation-duration: 35s; animation-delay: -5s; }
.question-mark:nth-child(5) { font-size: 90px; top: 40%; left: 45%; animation-duration: 28s; }
.question-mark:nth-child(6) { font-size: 30px; top: 5%; left: 30%; animation-duration: 40s; }
.question-mark:nth-child(7) { font-size: 60px; top: 60%; left: 70%; animation-duration: 20s; }
.question-mark:nth-child(8) { font-size: 150px; top: 50%; left: 90%; animation-duration: 33s; animation-delay: -10s; }
.question-mark:nth-child(9) { font-size: 45px; top: 90%; left: 40%; animation-duration: 26s; }
.question-mark:nth-child(10) { font-size: 75px; top: 30%; left: 20%; animation-duration: 38s; }
.question-mark:nth-child(11) { font-size: 100px; top: -10%; left: 60%; animation-duration: 23s; }
.question-mark:nth-child(12) { font-size: 35px; top: 75%; left: 55%; animation-duration: 31s; animation-delay: -15s; }
.question-mark:nth-child(13) { font-size: 65px; top: 15%; left: 95%; animation-duration: 29s; }
.question-mark:nth-child(14) { font-size: 110px; top: 95%; left: -5%; animation-duration: 21s; }
.question-mark:nth-child(15) { font-size: 25px; top: 50%; left: 50%; animation-duration: 45s; }


@keyframes wander {
  0%   { transform: translate(0, 0) rotate(-15deg); opacity: 0.1; }
  25%  { transform: translate(10vw, -15vh) rotate(20deg); opacity: 1; }
  50%  { transform: translate(-15vw, 10vh) rotate(-5deg); opacity: 0.3; }
  75%  { transform: translate(5vw, 20vh) rotate(10deg); opacity: 0.8; }
  100% { transform: translate(0, 0) rotate(-15deg); opacity: 0.1; }
}

/* --- 主题切换按钮 --- */
.theme-toggle-btn {
  position: absolute;
  top: 30px;
  right: 40px;
  z-index: 2; /* 确保在最上层 */
  background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 16px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;
}
.theme-toggle-btn:hover { background-color: var(--bg-hover, rgba(0, 0, 0, 0.04)); color: var(--text-primary); border-color: var(--accent-color); }


/* --- 错误提示窗口 --- */
.error-window {
  position: relative; /* 确保在背景之上 */
  z-index: 1;
  width: 90vw; max-width: 500px; padding: 40px; background-color: var(--acrylic-base); backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur); border-radius: var(--radius); border: 1px solid var(--border-color); box-shadow: var(--shadow); text-align: center; transition: background-color 0.3s ease, border-color 0.3s ease;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.icon-ghost {
  font-size: 48px;
  color: var(--accent-color);
  margin-bottom: 20px;
  animation: float 3s ease-in-out infinite;
}

.error-code {
  font-size: 6rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.error-message {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 10px;
}

.error-description {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-top: 8px;
  margin-bottom: 30px;
  max-width: 300px;
}

/* --- 返回首页按钮 --- */
.action-btn {
  background: var(--accent-color);
  color: #fff;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn:hover {
  background: var(--accent-hover);
}

/* --- 幽灵图标浮动动画 --- */
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}
</style>
