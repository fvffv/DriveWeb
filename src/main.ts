import {createApp} from 'vue'
import App from './App.vue'
import router from '@/router'
import '@fortawesome/fontawesome-free/css/all.css';
import '@/styles/index.scss'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import 'element-plus/dist/index.css'
import VueWechatTitle from 'vue-wechat-title' //动态修改title
import pinia from "@/store/"
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import 'element-plus/theme-chalk/dark/css-vars.css'//黑暗主题
import 'devicon/devicon.min.css'
const app = createApp(App)
import Setting from "@/store/setting";
import Home from "@/store/home";
import {FileApi} from "@/commands/file";


// 全局注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
}


app.use(ElementPlus, {
    locale: zhCn,
})
pinia.use(piniaPluginPersistedstate)
//使用pinia
app.use(pinia)
//使用路由
app.use(router);
//自动修改网页标题
app.use(VueWechatTitle);
//使用ElementPlus
app.use(ElementPlus)
app.mount('#app')
const settingStore = Setting();
const info = await FileApi.GetCloudInfo()
if (info.Status===0) {
    settingStore.basicInfo = info.Data

}

