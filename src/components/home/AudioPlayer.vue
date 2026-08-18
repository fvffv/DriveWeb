<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import { ElSlider } from 'element-plus';
import Setting from "@/store/setting.js";

const settingStore = Setting();

const props = defineProps<{
  modelValue: boolean; // 控制显示/隐藏
  audioUrl: string;    // 音频直链
  fileName: string;    // 文件名
}>();

const emit = defineEmits(['update:modelValue', 'close']);

// --- 状态与引用 ---
const audioRef = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(100); // 0 - 100
const isMuted = ref(false);

// --- 时间格式化 (mm:ss) ---
const formatTime = (time: number) => {
  if (isNaN(time)) return '00:00';
  const m = Math.floor(time / 60).toString().padStart(2, '0');
  const s = Math.floor(time % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// --- 播放控制 ---
const togglePlay = () => {
  if (!audioRef.value) return;
  if (isPlaying.value) {
    audioRef.value.pause();
  } else {
    audioRef.value.play().catch(err => console.error("播放失败:", err));
  }
};

const onTimeUpdate = () => {
  if (!audioRef.value) return;
  currentTime.value = audioRef.value.currentTime;
};

const onLoadedMetadata = () => {
  if (!audioRef.value) return;
  duration.value = audioRef.value.duration;
  audioRef.value.play().then(() => {
    isPlaying.value = true;
  }).catch(() => {
    isPlaying.value = false;
  });
};

const onEnded = () => {
  isPlaying.value = false;
  currentTime.value = 0;
};

const onPlay = () => isPlaying.value = true;
const onPause = () => isPlaying.value = false;

const handleProgressChange = (val: number | any) => {
  if (!audioRef.value) return;
  audioRef.value.currentTime = val;
  currentTime.value = val;
};

const handleVolumeChange = (val: number | any) => {
  if (!audioRef.value) return;
  audioRef.value.volume = val / 100;
  isMuted.value = val === 0;
};

const toggleMute = () => {
  if (!audioRef.value) return;
  isMuted.value = !isMuted.value;
  audioRef.value.muted = isMuted.value;
  if (isMuted.value) {
    volume.value = 0;
  } else {
    volume.value = audioRef.value.volume * 100 || 50;
  }
};

const closePlayer = () => {
  if (audioRef.value) {
    audioRef.value.pause();
  }
  isPlaying.value = false;
  emit('update:modelValue', false);
  emit('close');
};


const easterEggs = ref<{ id: number; emoji: string; left: number; size: number; duration: number }[]>([]);
let eggInterval: ReturnType<typeof setInterval> | null = null;

const checkEasterEgg = () => {
  if (!props.modelValue || !props.fileName) {
    stopEasterEgg();
    return;
  }

  const nameLower = props.fileName.toLowerCase();
  // 触发关键词，可自行添加如 'jntm', 'cxk' 等
  if (nameLower.includes('只因你太美') || nameLower.includes('鸡') || nameLower.includes('篮球') || nameLower.includes('jntm')) {
    startEasterEgg();
  } else {
    stopEasterEgg();
  }
};

const startEasterEgg = () => {
  if (eggInterval) return;
  // 每隔 300 毫秒生成一个元素
  eggInterval = setInterval(() => {
    const id = Date.now() + Math.random();
    // 一半概率是鸡，一半概率是篮球
    const emoji = Math.random() > 0.5 ? '🐔' : '🏀';
    // 随机横向位置 5% - 95%
    const left = 5 + Math.random() * 90;
    // 随机大小 24px - 54px
    const size = 24 + Math.random() * 30;
    // 随机飘浮动画时长 3s - 6s
    const duration = 3 + Math.random() * 3;

    easterEggs.value.push({ id, emoji, left, size, duration });

    // 动画结束后从数组中移除，防止内存泄漏
    setTimeout(() => {
      easterEggs.value = easterEggs.value.filter(e => e.id !== id);
    }, duration * 1000);
  }, 300);
};

const stopEasterEgg = () => {
  if (eggInterval) {
    clearInterval(eggInterval);
    eggInterval = null;
  }
  easterEggs.value = []; // 清空屏幕上的元素
};
// ==========================================
// 专属彩蛋逻辑结束
// ==========================================

// 监听文件或显隐变化，触发彩蛋和歌曲重载
watch([() => props.audioUrl, () => props.modelValue], ([newUrl, visible]) => {
  checkEasterEgg(); // 检查彩蛋

  if (newUrl && visible) {
    nextTick(() => {
      if (audioRef.value) {
        audioRef.value.load();
      }
    });
  }
});

onUnmounted(() => {
  stopEasterEgg();
  if (audioRef.value) audioRef.value.pause();
});
</script>

<template>
  <div class="easter-egg-container" v-show="easterEggs.length > 0">
    <span
        v-for="egg in easterEggs"
        :key="egg.id"
        class="floating-egg"
        :style="{
        left: egg.left + 'vw',
        fontSize: egg.size + 'px',
        animationDuration: egg.duration + 's'
      }"
    >
      {{ egg.emoji }}
    </span>
  </div>

  <transition name="el-zoom-in-bottom">
    <div v-show="modelValue" :class="['fluent-audio-player', settingStore.theme]">
      <audio
          ref="audioRef"
          :src="audioUrl"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
          @ended="onEnded"
          @play="onPlay"
          @pause="onPause"
      ></audio>

      <div class="player-header">
        <div class="file-info">
          <div class="icon-disc" :class="{ 'is-spinning': isPlaying, 'is-ikun': easterEggs.length > 0 }">
            <i class="fa-solid" :class="easterEggs.length > 0 ? 'fa-basketball' : 'fa-music'"></i>
          </div>
          <div class="text-marquee">
            <span class="file-name" :title="fileName">{{ fileName || '未知音频' }}</span>
          </div>
        </div>
        <button class="close-btn" @click="closePlayer" title="关闭播放器">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="progress-container">
        <span class="time-text">{{ formatTime(currentTime) }}</span>
        <el-slider
            v-model="currentTime"
            :max="duration"
            :show-tooltip="false"
            @input="handleProgressChange"
            class="custom-slider"
        />
        <span class="time-text">{{ formatTime(duration) }}</span>
      </div>

      <div class="player-controls">
        <div class="left-controls"></div>

        <div class="main-controls">
          <button class="control-btn play-btn" @click="togglePlay">
            <i :class="isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play'"></i>
          </button>
        </div>

        <div class="right-controls">
          <button class="control-btn small" @click="toggleMute">
            <i :class="isMuted || volume === 0 ? 'fa-solid fa-volume-xmark' : (volume < 50 ? 'fa-solid fa-volume-low' : 'fa-solid fa-volume-high')"></i>
          </button>
          <div class="volume-slider-wrapper">
            <el-slider v-model="volume" :max="100" :show-tooltip="false" @input="handleVolumeChange" class="custom-slider" />
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.easter-egg-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none; /* 关键：确保不阻挡用户的鼠标点击事件 */
  z-index: 9999; /* 浮在最上层 */
  overflow: hidden;
}

.floating-egg {
  position: absolute;
  bottom: -60px; /* 初始位置在屏幕下方 */
  animation-name: floatUpAndSpin;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
  opacity: 0.9;
}

@keyframes floatUpAndSpin {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(-110vh) rotate(720deg); /* 向上飘并旋转两圈 */
    opacity: 0;
  }
}

.icon-disc.is-ikun {
  background: linear-gradient(135deg, #ff8c00, #ff4500) !important; /* 篮球色底盘 */
  color: #fff;
}
/* ========================================== */

.fluent-audio-player {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 340px;
  background-color: var(--main-content-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  backdrop-filter: blur(10px);
}

:global([data-theme='dark']) .fluent-audio-player {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  background-color: color-mix(in srgb, var(--main-content-bg) 90%, transparent);
}

/* 头部信息 */
.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.icon-disc {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-color), #3fb1e3);
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent-color) 40%, transparent);
  transition: all 0.5s;
}

.icon-disc.is-spinning {
  animation: spin 4s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.text-marquee {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s;
}
.close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* 进度条 */
.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-text {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: Consolas, monospace;
  width: 40px;
  text-align: center;
}

/* 控制栏 */
.player-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.left-controls, .right-controls {
  flex: 1;
  display: flex;
  align-items: center;
}

.right-controls {
  justify-content: flex-end;
  gap: 8px;
}

.main-controls {
  flex: 1;
  display: flex;
  justify-content: center;
}

.control-btn {
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s;
}

.play-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: var(--accent-color);
  color: #fff;
  font-size: 16px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--accent-color) 40%, transparent);
}
.play-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--accent-color) 50%, transparent);
}
.play-btn:active {
  transform: scale(0.95);
}

.control-btn.small {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--text-secondary);
}
.control-btn.small:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.volume-slider-wrapper {
  width: 60px;
}

/* 深度覆写 Element Plus Slider 样式 */
:deep(.custom-slider .el-slider__runway) {
  height: 4px;
  background-color: var(--border-color);
}
:deep(.custom-slider .el-slider__bar) {
  height: 4px;
  background-color: var(--accent-color);
}
:deep(.custom-slider .el-slider__button) {
  width: 10px;
  height: 10px;
  border: 2px solid var(--accent-color);
  background-color: #fff;
}
:deep(.custom-slider:hover .el-slider__button) {
  transform: scale(1.2);
}
</style>