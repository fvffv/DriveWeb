<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import Setting from "@/store/setting.js";
import { AdminApi } from "@/commands/admin.ts";
import Home from "@/store/home";

const homeStore = Home();
const settingStore = Setting();
// 图表 DOM 引用
const lineChartRef = ref<HTMLElement | null>(null);
const pieChartRef = ref<HTMLElement | null>(null);
const barChartRef = ref<HTMLElement | null>(null);

let lineChartInstance: echarts.ECharts | null = null;
let pieChartInstance: echarts.ECharts | null = null;
let barChartInstance: echarts.ECharts | null = null;

// 系统监控状态
const cpuUsage = ref(0);
const ramUsage = ref(0);
const diskUsagePercent = ref(0);
const diskUsedText = ref('0 B');
const diskTotalText = ref('0 B');
let sysInfoTimer: number | null = null; // 存放定时器ID

// 顶部卡片状态
const stats = ref([
  { title: '平台总用户数', value: '0', icon: 'fa-solid fa-users', color: '#0078d4' },
  { title: '全站文件总数', value: '0', icon: 'fa-solid fa-file-shield', color: '#d83b01' },
  { title: '今日新增文件', value: '0', icon: 'fa-solid fa-cloud-arrow-up', color: '#881798' },
  { title: '外链分享总数', value: '0', icon: 'fa-solid fa-share-nodes', color: '#ffb900' },
  { title: '今日上传流量', value: '0 B', icon: 'fa-solid fa-upload', color: '#107c10' },
  { title: '今日下载流量', value: '0 B', icon: 'fa-solid fa-download', color: '#e3008c' },
]);

const recentLogs = ref<{ timestamp: string, content: string, type: string }[]>([]);

// 辅助函数：格式化字节大小
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// 格式化日期为更易读的格式
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}-${date.getDate()}`;
};

// 获取时间的相对描述
const getRelativeTime = (dateString: string) => {
  const time = new Date(dateString).getTime();
  if (isNaN(time)) return dateString;
  const now = new Date().getTime();
  const diff = now - time;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return Math.floor(diff / 86400000) + '天前';
}

// 图表数据
let trafficDates: string[] = [];
let uploadData: number[] = [];
let downloadData: number[] = [];
let pieData: {value: number, name: string, itemStyle?: any}[] = [];
let barNames: string[] = [];
let barData: number[] = [];
const pieColors = ['#0078d4', '#107c10', '#d83b01', '#ffb900', '#881798', '#00b7c3', '#e3008c'];

const fetchData = async () => {
  try {
    const res = await AdminApi.GetDataStatistics();
    if (res.Status === 0 && res.Data) {
      const data = res.Data;

      stats.value[0].value = data.UserCount.toLocaleString();
      stats.value[1].value = data.FileCount.toLocaleString();
      stats.value[2].value = data.FileTodayCount.toLocaleString();
      stats.value[3].value = data.ShareFileCount.toLocaleString();

      const todayTraffic = data.traffic7day.length > 0 ? data.traffic7day[data.traffic7day.length - 1] : { UploadBytes: 0, DownloadBytes: 0 };
      stats.value[4].value = formatBytes(todayTraffic.UploadBytes);
      stats.value[5].value = formatBytes(todayTraffic.DownloadBytes);

      trafficDates = data.traffic7day.map((item: any) => formatDate(item.Date));
      uploadData = data.traffic7day.map((item: any) => parseFloat((item.UploadBytes / (1024 * 1024)).toFixed(2)));
      downloadData = data.traffic7day.map((item: any) => parseFloat((item.DownloadBytes / (1024 * 1024)).toFixed(2)));

      pieData = data.AllTypeData.map((item: any, index: number) => ({
        name: item.Name,
        value: item.ValueBytes,
        itemStyle: { color: pieColors[index % pieColors.length] }
      }));

      const reversedTopUsers = [...data.TopUsers].reverse();
      barNames = reversedTopUsers.map((item: any) => item.Username);
      barData = reversedTopUsers.map((item: any) => parseFloat((item.TotalSize / (1024 * 1024 * 1024)).toFixed(2)));

      recentLogs.value = data.Log.map((log: any) => {
        let type = 'info';
        if(log.Level === 3) type = 'warning';
        if(log.Level === 4) type = 'danger';
        if(log.Message.includes("成功")) type = 'success';

        return {
          timestamp: log.Timestamp ? getRelativeTime(log.Timestamp) : '未知时间',
          content: log.Message,
          type: type
        }
      })

      renderCharts();
    }
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
  }
};

// 获取并更新服务器资源的函数
const fetchSystemInfo = async () => {
  try {
    const res = await AdminApi.GetSystemInfo();
    if (res.Status === 0 && res.Data) {
      const data = res.Data;
      cpuUsage.value = Number(data.CpuUsagePercent.toFixed(1));
      ramUsage.value = Number(data.MemoryUsagePercent.toFixed(1));

      diskUsedText.value = formatBytes(data.UsedDiskSpace);
      diskTotalText.value = formatBytes(data.TotalDiskSpace);

      if (data.TotalDiskSpace > 0) {
        diskUsagePercent.value = Number(((data.UsedDiskSpace / data.TotalDiskSpace) * 100).toFixed(1));
      } else {
        diskUsagePercent.value = 0;
      }
    }
  } catch (error) {
    console.error("Failed to fetch system info:", error);
  }
};

// 【新增】：启动定时器
const startSysInfoTimer = () => {
  if (sysInfoTimer === null) {
    fetchSystemInfo(); // 启动时立即拉取一次
    sysInfoTimer = window.setInterval(fetchSystemInfo, 5000);
  }
};

// 【新增】：停止定时器
const stopSysInfoTimer = () => {
  if (sysInfoTimer !== null) {
    window.clearInterval(sysInfoTimer);
    sysInfoTimer = null;
  }
};

// 【新增】：监听 activeNavItem 动态控制定时器启停
watch(
    () => homeStore.activeNavItem,
    (newVal) => {
      if (newVal === '主页看板') {
        startSysInfoTimer();
      } else {
        stopSysInfoTimer();
      }
    },
    { immediate: true } // 立即执行一次，确保组件初次加载时能正确开启定时器
);

const renderCharts = () => {
  if (!lineChartRef.value || !pieChartRef.value || !barChartRef.value) return;

  const isDark = settingStore.theme === 'dark';
  const textColor = isDark ? '#9ca3af' : '#5c5f66';
  const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const tooltipBg = isDark ? 'rgba(26, 35, 51, 0.9)' : 'rgba(255, 255, 255, 0.9)';
  const tooltipText = isDark ? '#f9fafb' : '#1a1a1c';

  if (!lineChartInstance) lineChartInstance = echarts.init(lineChartRef.value);
  lineChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: splitLineColor,
      textStyle: { color: tooltipText },
      valueFormatter: (value: number) => value + ' MB'
    },
    legend: { textStyle: { color: textColor } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trafficDates.length ? trafficDates : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'], axisLabel: { color: textColor }, axisLine: { lineStyle: { color: splitLineColor } } },
    yAxis: { type: 'value', name: 'MB', axisLabel: { color: textColor }, splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } } },
    series: [
      {
        name: '上传流量', type: 'line', smooth: true, symbol: 'none',
        lineStyle: { width: 3, color: '#107c10' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 124, 16, 0.3)' }, { offset: 1, color: 'rgba(16, 124, 16, 0.0)' }
          ])
        },
        data: uploadData.length ? uploadData : [0,0,0,0,0,0,0]
      },
      {
        name: '下载流量', type: 'line', smooth: true, symbol: 'none',
        lineStyle: { width: 3, color: '#0078d4' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 120, 212, 0.3)' }, { offset: 1, color: 'rgba(0, 120, 212, 0.0)' }
          ])
        },
        data: downloadData.length ? downloadData : [0,0,0,0,0,0,0]
      }
    ]
  });

  if (!pieChartInstance) pieChartInstance = echarts.init(pieChartRef.value);
  pieChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg,
      borderColor: splitLineColor,
      textStyle: { color: tooltipText },
      valueFormatter: (value: number) => formatBytes(value)
    },
    legend: { bottom: '0%', left: 'center', textStyle: { color: textColor }, icon: 'circle', type: 'scroll' },
    series: [{
      name: '文件类型', type: 'pie', radius: ['40%', '70%'], avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: isDark ? '#182235' : '#ffffff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: tooltipText, formatter: '{b}\n{d}%' } },
      labelLine: { show: false },
      data: pieData.length ? pieData : [{value: 0, name: '暂无数据'}]
    }]
  });

  if (!barChartInstance) barChartInstance = echarts.init(barChartRef.value);
  barChartInstance.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: tooltipBg,
      borderColor: splitLineColor,
      textStyle: { color: tooltipText },
      valueFormatter: (value: number) => value + ' GB'
    },
    grid: { left: '3%', right: '10%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: { type: 'value', name: 'GB', axisLabel: { color: textColor }, splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } } },
    yAxis: { type: 'category', data: barNames.length ? barNames : ['暂无'], axisLabel: { color: textColor, width: 80, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{
      name: '占用空间', type: 'bar', barWidth: '40%',
      itemStyle: { borderRadius: [0, 4, 4, 0], color: '#00b7c3' },
      data: barData.length ? barData : [0]
    }]
  });
};

const handleResize = () => {
  lineChartInstance?.resize();
  pieChartInstance?.resize();
  barChartInstance?.resize();
};

watch(() => settingStore.theme, () => {
  renderCharts();
});

defineExpose({
  resizeCharts: () => {
    nextTick(() => {
      handleResize();
    });
  }
});

onMounted(() => {
  fetchData();
  // 注意：不再需要在此处直接启动定时器，watch 已经通过 immediate: true 接管了启动逻辑
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  // 【修改】：使用封装好的停止函数清理定时器
  stopSysInfoTimer();

  window.removeEventListener('resize', handleResize);
  lineChartInstance?.dispose();
  pieChartInstance?.dispose();
  barChartInstance?.dispose();
});
</script>

<template>
  <div class="fade-in panel-content">
    <el-row :gutter="20">
      <el-col :span="8" v-for="stat in stats" :key="stat.title" class="mb-20">
        <div class="fluent-card stat-card">
          <div class="stat-icon-wrapper" :style="{ backgroundColor: stat.color + '20', color: stat.color }">
            <i :class="stat.icon"></i>
          </div>
          <div class="stat-info">
            <div class="stat-title">{{ stat.title }}</div>
            <div class="stat-value">{{ stat.value }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mb-20">
      <el-col :span="16">
        <div class="fluent-card p-20 chart-card">
          <h3 class="card-title mb-15">7天内流量统计</h3>
          <div ref="lineChartRef" class="chart-container"></div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="fluent-card p-20 chart-card">
          <h3 class="card-title mb-15">全局存储文件类型分布</h3>
          <div ref="pieChartRef" class="chart-container"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="8">
        <div class="fluent-card p-20 dashboard-block">
          <h3 class="card-title mb-20">服务器资源监控</h3>
          <div class="server-status-container">
            <div class="status-item">
              <el-progress type="dashboard" :percentage="cpuUsage" color="#0078d4" :width="100">
                <template #default="{ percentage }"><span class="progress-text">{{ percentage }}%<br><small>CPU</small></span></template>
              </el-progress>
            </div>
            <div class="status-item">
              <el-progress type="dashboard" :percentage="ramUsage" color="#ffb900" :width="100">
                <template #default="{ percentage }"><span class="progress-text">{{ percentage }}%<br><small>RAM</small></span></template>
              </el-progress>
            </div>
          </div>
          <div class="mt-20">
            <div class="flex-between mb-8"><span class="text-secondary">总存储空间利用率</span><span>{{ diskUsedText }} / {{ diskTotalText }}</span></div>
            <el-progress :text-inside="true" :stroke-width="18" :percentage="diskUsagePercent" color="#d83b01" />
          </div>
        </div>
      </el-col>

      <el-col :span="8">
        <div class="fluent-card p-20 dashboard-block">
          <h3 class="card-title mb-15">存储空间占用 Top 5</h3>
          <div ref="barChartRef" style="height: 220px; width: 100%;"></div>
        </div>
      </el-col>

      <el-col :span="8">
        <div class="fluent-card p-20 dashboard-block">
          <h3 class="card-title mb-20">系统动态审计日志</h3>
          <div class="timeline-container">
            <el-timeline>
              <el-timeline-item v-for="(activity, index) in recentLogs" :key="index" :type="activity.type" :timestamp="activity.timestamp" size="large">
                {{ activity.content }}
              </el-timeline-item>
              <el-empty v-if="recentLogs.length === 0" description="暂无日志" :image-size="60" />
            </el-timeline>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.fluent-card { background-color: var(--main-content-bg); border: 1px solid var(--border-color); border-radius: var(--radius); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); transition: border-color 0.3s, background-color 0.3s; }
.stat-card { display: flex; align-items: center; padding: 20px; gap: 16px; }
.stat-icon-wrapper { width: 48px; height: 48px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.stat-info { display: flex; flex-direction: column; min-width: 0; }
.stat-title { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.stat-value { font-size: 24px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chart-card { display: flex; flex-direction: column; }
.chart-container { height: 320px; width: 100%; flex-shrink: 0; }
.dashboard-block { height: 280px; display: flex; flex-direction: column; }
.server-status-container { display: flex; justify-content: space-around; flex: 1; align-items: center; }
.progress-text { display: flex; flex-direction: column; align-items: center; line-height: 1.2; font-size: 18px; font-weight: 600; color: var(--text-primary); }
.progress-text small { font-size: 12px; font-weight: normal; color: var(--text-secondary); margin-top: 4px; }
.timeline-container { flex: 1; overflow-y: auto; padding-right: 10px; }
.timeline-container::-webkit-scrollbar { width: 4px; }
.timeline-container::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 4px; }
.timeline-container :deep(.el-timeline-item__content) { color: var(--text-primary); font-size: 13px; }
.timeline-container :deep(.el-timeline-item__timestamp) { color: var(--text-secondary); }

.p-20 { padding: 20px; }
.mt-20 { margin-top: 20px; }
.mb-8 { margin-bottom: 8px; }
.mb-15 { margin-bottom: 15px; }
.mb-20 { margin-bottom: 20px; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.text-secondary { color: var(--text-secondary); font-size: 13px; }
.card-title { margin: 0; font-size: 16px; color: var(--text-primary); }
.fade-in { animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 900px) {
  :deep(.el-col) {
    max-width: 100%;
    flex: 0 0 100%;
  }

  .stat-card,
  .p-20 {
    padding: 16px;
  }

  .chart-container {
    height: 260px;
  }

  .dashboard-block {
    height: auto;
    min-height: 260px;
  }

  .server-status-container {
    gap: 16px;
    flex-wrap: wrap;
  }
}
</style>
