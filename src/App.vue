<script setup lang="ts">
import useSettingStore from '@/store/Setting'; // 请确保路径正确
import { watch, onMounted } from 'vue';
const settingStore = useSettingStore();


// 监听 store 中 theme 的变化
watch(
    () => settingStore.theme, // 监听的目标
    (newTheme) => { // 变化时执行的回调
      const html = document.documentElement; // 获取 <html> 元素
      if (newTheme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }
);

onMounted(() => {
  const html = document.documentElement;
  if (settingStore.theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
});
</script>

<template>
  <router-view v-wechat-title="$route.meta.title" ></router-view>
</template>

<style scoped>

</style>