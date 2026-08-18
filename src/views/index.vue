<script setup>
import { ref } from 'vue';
import Setting from "@/store/setting.js";

// --- 状态管理 ---
const settingStore = Setting();

// --- 页面静态内容 ---
// 核心功能列表
const features = ref([
  {
    icon: 'fa-solid fa-cloud-arrow-up',
    title: '随时访问',
    description: '无论您身在何处，都可以通过任何设备安全地访问您的所有文件。'
  },
  {
    icon: 'fa-solid fa-users',
    title: '轻松共享',
    description: '与同事或朋友安全地共享文件和文件夹，并精细控制访问权限。'
  },
  {
    icon: 'fa-solid fa-shield-halved',
    title: '企业级安全',
    description: '我们采用行业领先的加密技术，确保您的每一个数据都安全无虞。'
  }
]);

// --- 方法 ---
const getStarted = () => {
  console.log('用户点击了 "立即开始"');
  // 在这里可以添加路由跳转到注册页的逻辑，例如: router.push('/register');
};
</script>

<template>
  <!-- 根容器，:data-theme 的值由 Pinia store 驱动 -->
  <div class="home-container" :data-theme="settingStore.theme">

    <!-- 流动渐变光斑背景 -->
    <div class="blob-container">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <!-- 主题切换按钮 -->
    <button class="theme-toggle-btn" @click="settingStore.toggleTheme()" aria-label="切换主题">
      <i v-if="settingStore.theme === 'light'" class="fa-solid fa-moon"></i>
      <i v-else class="fa-solid fa-sun"></i>
    </button>

    <!-- 主要内容区域 -->
    <main class="main-content">
      <!-- 1. 英雄区域 -->
      <section class="hero-section">
        <h1 class="main-headline">云端存储，重塑您的工作流</h1>
        <p class="tagline">
          一个简洁、高效且无比安全的云存储解决方案，专为现代团队和个人打造。
        </p>
        <div class="cta-buttons">
          <button class="cta-primary" @click="getStarted">
            <i class="fa-solid fa-rocket"></i>
            立即开始a
          </button>
          <button class="cta-secondary">了解更多</button>
        </div>
      </section>

      <!-- 2. 特性展示区域 -->
      <section class="features-grid">
        <div v-for="feature in features" :key="feature.title" class="feature-card">
          <div class="feature-icon">
            <i :class="feature.icon"></i>
          </div>
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-description">{{ feature.description }}</p>
        </div>
      </section>
    </main>

  </div>
</template>

<style scoped>
/* 确保 Font Awesome 图标库已加载 */
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');

/* --- 主题与基础样式 --- */
.home-container {
  /* ...基础主题变量... */
  --accent-color: #0078d4;
  --accent-hover: #106ebe;
  --app-bg: #f3f5f9;
  --acrylic-base: rgba(252, 252, 252, 0.7);
  --border-color: #eef0f3;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.1);
  --bg-hover: rgba(0, 0, 0, 0.04);

  /* 效果变量：亮色主题 */
  --blob-color-1: #a7f3d0;
  --blob-color-2: #bae6fd;
  --blob-color-3: #fbcfe8;

  &[data-theme='dark'] {
    /* ...暗色主题变量... */
    --app-bg: #111827;
    --acrylic-base: rgba(26, 35, 51, 0.7);
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.3);
    --bg-hover: rgba(255, 255, 255, 0.05);

    /* 效果变量：暗黑主题 */
    --blob-color-1: #0d3446;
    --blob-color-2: #221b44;
    --blob-color-3: #3a193f;
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
  padding: 40px;
}

/* --- 流动渐变光斑 --- */
.blob-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; filter: blur(100px); opacity: 0.8; }
.blob { position: absolute; border-radius: 50%; mix-blend-mode: screen; animation: blob-move 30s infinite alternate; transition: background-color 0.5s ease; }
.blob-1 { width: 450px; height: 450px; background-color: var(--blob-color-1); top: -150px; left: -150px; }
.blob-2 { width: 350px; height: 350px; background-color: var(--blob-color-2); top: -100px; right: -100px; animation-duration: 25s; animation-delay: -10s; }
.blob-3 { width: 400px; height: 400px; background-color: var(--blob-color-3); bottom: -200px; left: 20%; animation-duration: 35s; animation-delay: -5s; }
@keyframes blob-move { 0% { transform: translate(0, 0) scale(1); } 33% { transform: translate(30vw, -20vh) scale(1.2); } 66% { transform: translate(-25vw, 15vh) scale(0.8); } 100% { transform: translate(0, 0) scale(1); } }

/* --- 主题切换按钮 --- */
.theme-toggle-btn { position: absolute; top: 30px; right: 40px; z-index: 2; background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 16px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
.theme-toggle-btn:hover { background-color: var(--bg-hover); color: var(--text-primary); border-color: var(--accent-color); }

/* --- 主要内容布局 --- */
.main-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1100px;
  text-align: center;
}

/* --- 英雄区域 --- */
.hero-section {
  margin-bottom: 80px;
}
.main-headline {
  font-size: 3.5rem;
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--text-primary);
  margin-bottom: 1rem;
  text-wrap: balance; /* 优化多行标题的显示 */
}
.tagline {
  font-size: 1.125rem;
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto 2.5rem;
  line-height: 1.6;
}
.cta-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
}
.cta-primary, .cta-secondary {
  padding: 14px 32px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.cta-primary {
  background-color: var(--accent-color);
  color: #fff;
}
.cta-primary:hover {
  background-color: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 120, 212, 0.3);
}
.cta-secondary {
  background-color: transparent;
  color: var(--text-primary);
  border-color: var(--border-color);
}
.cta-secondary:hover {
  background-color: var(--bg-hover);
  border-color: var(--accent-color);
}

/* --- 特性网格 --- */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}
.feature-card {
  background-color: var(--acrylic-base);
  backdrop-filter: var(--glass-blur);
  padding: 30px;
  border-radius: var(--radius);
  border: 1px solid var(--border-color);
  text-align: left;
  transition: all 0.3s ease;
}
.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow);
  background-color: color-mix(in srgb, var(--acrylic-base), transparent 10%); /* 悬停时更透明一点 */
}
.feature-icon {
  font-size: 1.75rem;
  color: var(--accent-color);
  margin-bottom: 1rem;
}
.feature-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}
.feature-description {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.7;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .home-container {
    padding: 72px 18px 24px;
    align-items: flex-start;
  }

  .theme-toggle-btn {
    top: 18px;
    right: 18px;
  }

  .hero-section {
    margin-bottom: 48px;
  }

  .main-headline {
    font-size: 2.5rem;
  }

  .tagline {
    font-size: 1rem;
  }

  .cta-buttons {
    flex-direction: column;
  }

  .cta-primary,
  .cta-secondary {
    width: 100%;
    justify-content: center;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
