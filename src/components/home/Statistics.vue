<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import Setting from "@/store/setting.js";
import Home from '@/store/home.ts';
import { FileApi } from "@/commands/file"; // 确保引入了你的真实 API

const settingStore = Setting();
const homeStore = Home();

// --- DOM Refs ---
const typeChartRef = ref<HTMLElement | null>(null);
const trendChartRef = ref<HTMLElement | null>(null);
const topFilesChartRef = ref<HTMLElement | null>(null);

// --- ECharts 实例与监听器 ---
let typeChart: echarts.ECharts | null = null;
let trendChart: echarts.ECharts | null = null;
let topFilesChart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null; // 【新增】定时刷新器

// --- 字节转换工具函数 ---
const formatBytes = (bytes: number): string => {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- 响应式数据状态 ---
const summaryData = ref({
  totalSpace: '0 B',
  usedSpace: '0 B',
  fileCount: 0,
  shareCount: 0
});

const fileTypeData = ref<{ value: number, name: string }[]>([]);
const trendData = ref({ dates: [] as string[], uploads: [] as number[] });
const topFilesData = ref({ names: [] as string[], sizes: [] as number[] });

// --- 核心：通用 JSON 数据解析与加载方法 ---
const loadDashboardData = (jsonInput: string | any) => {
  try {
    const res = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;

    if (res.Status !== 0 || !res.Data) {
      console.error("加载数据失败：状态不正确或缺少 Data 节点", res);
      return;
    }

    const data = res.Data;

    if (data.SummaryData) {
      summaryData.value = {
        totalSpace: formatBytes(data.SummaryData.TotalSpaceBytes),
        usedSpace: formatBytes(data.SummaryData.UsedSpaceBytes),
        fileCount: data.SummaryData.FileCount,
        shareCount: data.SummaryData.ShareCount
      };
    }

    if (data.FileTypeData) {
      fileTypeData.value = data.FileTypeData.map((item: any) => ({
        name: item.Name,
        value: item.ValueBytes
      }));
    }

    if (data.TrendData) {
      trendData.value = {
        dates: data.TrendData.map((item: any) => item.Dates),
        uploads: data.TrendData.map((item: any) => item.Uploads)
      };
    }

    if (data.TopFilesData) {
      topFilesData.value = {
        names: data.TopFilesData.map((item: any) => item.Name),
        sizes: data.TopFilesData.map((item: any) => item.SizeByte)
      };
    }

    setTimeout(() => {
      renderAllCharts();
    }, 100);

  } catch (error) {
    console.error("解析加载统计数据时出错:", error);
  }
};

// --- 拉取后端数据 ---
const fetchDashboardData = async () => {
  try {
    const res = await FileApi.GetDataStatistics();
    if (res.Status === 0){
      loadDashboardData(res);
    }
  } catch (error) {
    console.error("获取统计看板数据失败", error);
  }
};

// --- ECharts 初始化与配置 ---
const getThemeColor = () => settingStore.theme === 'dark' ? '#f9fafb' : '#1f2937';
const getSubTextColor = () => settingStore.theme === 'dark' ? '#9ca3af' : '#6b7280';
const getBorderColor = () => settingStore.theme === 'dark' ? '#374151' : '#eef0f3';

const initTypeChart = () => {
  if (!typeChartRef.value || fileTypeData.value.length === 0) return;
  typeChart = echarts.getInstanceByDom(typeChartRef.value) || echarts.init(typeChartRef.value);

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}: ${formatBytes(params.value)} (${params.percent}%)`;
      }
    },
    legend: {
      bottom: '0%',
      left: 'center',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: getThemeColor(), fontSize: 12 }
    },
    color: ['#0078d4', '#3fb1e3', '#6be6c1', '#a0a7e6', '#c4ebad', '#f0a44b'],
    series: [
      {
        name: '文件类型',
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: settingStore.theme === 'dark' ? '#182235' : '#ffffff',
          borderWidth: 2
        },
        label: { show: false, position: 'center' },
        emphasis: {
          label: { show: true, fontSize: 16, fontWeight: 'bold', color: getThemeColor() }
        },
        labelLine: { show: false },
        data: fileTypeData.value
      }
    ]
  };
  typeChart.setOption(option);
};

const initTrendChart = () => {
  if (!trendChartRef.value || trendData.value.dates.length === 0) return;
  trendChart = echarts.getInstanceByDom(trendChartRef.value) || echarts.init(trendChartRef.value);

  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '5%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.value.dates,
      axisLabel: { color: getSubTextColor() },
      axisLine: { lineStyle: { color: getBorderColor() } }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: getBorderColor(), type: 'dashed' } },
      axisLabel: { color: getSubTextColor() }
    },
    series: [
      {
        name: '上传文件数',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 3, color: '#0078d4' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 120, 212, 0.4)' },
            { offset: 1, color: 'rgba(0, 120, 212, 0.0)' }
          ])
        },
        data: trendData.value.uploads
      }
    ]
  };
  trendChart.setOption(option);
};

const initTopFilesChart = () => {
  if (!topFilesChartRef.value || topFilesData.value.names.length === 0) return;
  topFilesChart = echarts.getInstanceByDom(topFilesChartRef.value) || echarts.init(topFilesChartRef.value);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const data = params[0];
        return `${data.name}<br/>大小: <b style="color:var(--accent-color)">${formatBytes(data.value)}</b>`;
      }
    },
    grid: { left: '3%', right: '15%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { show: false },
      axisLabel: {
        color: getSubTextColor(),
        formatter: (value: number) => formatBytes(value)
      }
    },
    yAxis: {
      type: 'category',
      data: [...topFilesData.value.names].reverse(),
      axisLabel: {
        color: getThemeColor(),
        formatter: (value: string) => value.length > 12 ? value.substring(0, 12) + '...' : value
      },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        name: '文件大小',
        type: 'bar',
        data: [...topFilesData.value.sizes].reverse(),
        barWidth: '40%',
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: '#106ebe' },
            { offset: 1, color: '#3fb1e3' }
          ])
        },
        label: {
          show: true,
          position: 'right',
          color: getThemeColor(),
          formatter: (params: any) => formatBytes(params.value)
        }
      }
    ]
  };
  topFilesChart.setOption(option);
};

// --- 生命周期与事件监听 ---
const renderAllCharts = () => {
  initTypeChart();
  initTrendChart();
  initTopFilesChart();
};

const resizeCharts = () => {
  typeChart?.resize();
  trendChart?.resize();
  topFilesChart?.resize();
};

onMounted(() => {
  // 1. 初次挂载拉取一次数据
  fetchDashboardData();

  // 2. 监听布局变动
  setTimeout(() => {
    window.addEventListener('resize', resizeCharts);

    resizeObserver = new ResizeObserver(() => {
      resizeCharts();
    });

    if (typeChartRef.value) resizeObserver.observe(typeChartRef.value);
    if (trendChartRef.value) resizeObserver.observe(trendChartRef.value);
    if (topFilesChartRef.value) resizeObserver.observe(topFilesChartRef.value);
  }, 200);
});

onUnmounted(() => {
  // 【新增】组件卸载时清除定时器，防止内存泄漏
  if (refreshTimer) clearInterval(refreshTimer);

  window.removeEventListener('resize', resizeCharts);

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  typeChart?.dispose();
  trendChart?.dispose();
  topFilesChart?.dispose();
});

watch(() => settingStore.theme, () => {
  renderAllCharts();
});
</script>

<template>
  <div class="statistics-dashboard">

    <div class="dashboard-header">
      <span class="refresh-tip"><i class="fa-regular fa-clock"></i> 数据 30 分钟刷新一次</span>
    </div>

    <div class="stat-cards-grid">
      <div class="stat-summary-card">
        <div class="stat-icon-box" style="color: #0078d4; background: rgba(0,120,212,0.1);"><i class="fa-solid fa-hard-drive"></i></div>
        <div class="stat-text-box">
          <span class="stat-label-title">总容量</span>
          <span class="stat-value-text">{{ summaryData.totalSpace }}</span>
        </div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-icon-box" style="color: #67c23a; background: rgba(103,194,58,0.1);"><i class="fa-solid fa-chart-pie"></i></div>
        <div class="stat-text-box">
          <span class="stat-label-title">已用容量</span>
          <span class="stat-value-text">{{ summaryData.usedSpace }}</span>
        </div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-icon-box" style="color: #e6a23c; background: rgba(230,162,60,0.1);"><i class="fa-solid fa-file-lines"></i></div>
        <div class="stat-text-box">
          <span class="stat-label-title">总文件数</span>
          <span class="stat-value-text">{{ summaryData.fileCount }} <span class="stat-unit">个</span></span>
        </div>
      </div>
      <div class="stat-summary-card">
        <div class="stat-icon-box" style="color: #a855f7; background: rgba(168,85,247,0.1);"><i class="fa-solid fa-share-nodes"></i></div>
        <div class="stat-text-box">
          <span class="stat-label-title">活跃分享</span>
          <span class="stat-value-text">{{ summaryData.shareCount }} <span class="stat-unit">个</span></span>
        </div>
      </div>
    </div>

    <div class="stat-charts-grid">
      <div class="stat-chart-panel">
        <h3 class="stat-chart-title">存储空间分布</h3>
        <div class="stat-echarts-container" ref="typeChartRef"></div>
      </div>

      <div class="stat-chart-panel">
        <h3 class="stat-chart-title">过去7天上传活跃度</h3>
        <div class="stat-echarts-container" ref="trendChartRef"></div>
      </div>
    </div>

    <div class="stat-charts-grid stat-bottom-grid">
      <div class="stat-chart-panel">
        <h3 class="stat-chart-title">大文件空间占用 TOP 5
          <span class="stat-title-tip">(可考虑清理以释放空间)</span>
        </h3>
        <div class="stat-echarts-container stat-large-container" ref="topFilesChartRef"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.statistics-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* === 【新增】顶部提示栏样式 === */
.dashboard-header {
  display: flex;
  justify-content: flex-end; /* 靠右对齐 */
  margin-bottom: -5px; /* 让提示和卡片距离紧凑一点 */
}

.refresh-tip {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.8;
  background: var(--bg-hover);
  padding: 4px 10px;
  border-radius: 12px;
}
/* ================================= */


/* === 顶部卡片 === */
.stat-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-summary-card {
  background-color: var(--main-content-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.stat-summary-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
  border-color: color-mix(in srgb, var(--border-color), var(--text-secondary) 20%);
}

.stat-icon-box {
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  margin-right: 15px;
}

.stat-text-box {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.stat-label-title {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  white-space: nowrap;
}

.stat-value-text {
  font-size: 22px;
  font-weight: bold;
  color: var(--text-primary);
  font-family: 'Segoe UI Variable', sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stat-unit {
  font-size: 13px;
  font-weight: normal;
  color: var(--text-secondary);
}

/* === 图表区域 === */
.stat-charts-grid {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(350px, 2fr);
  gap: 20px;
}

.stat-bottom-grid {
  grid-template-columns: 1fr;
}

@media (max-width: 900px) {
  .stat-charts-grid {
    grid-template-columns: 1fr;
  }
}

.stat-chart-panel {
  background-color: var(--main-content-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 20px;
  min-width: 0;
  transition: all 0.3s ease;
}

.stat-chart-panel:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
}
:global([data-theme='dark']) .stat-chart-panel:hover {
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
}

.stat-chart-title {
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}
.stat-title-tip {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: normal;
}

.stat-echarts-container {
  width: 100%;
  height: 280px;
}

.stat-large-container {
  height: 320px;
}

@media (max-width: 768px) {
  .statistics-dashboard {
    padding: 0;
    gap: 16px;
  }

  .dashboard-header {
    justify-content: flex-start;
    margin-bottom: 0;
  }

  .stat-cards-grid,
  .stat-charts-grid {
    gap: 16px;
  }

  .stat-summary-card,
  .stat-chart-panel {
    padding: 16px;
  }

  .stat-value-text {
    font-size: 18px;
  }

  .stat-echarts-container {
    height: 240px;
  }

  .stat-large-container {
    height: 280px;
  }

  .stat-chart-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
