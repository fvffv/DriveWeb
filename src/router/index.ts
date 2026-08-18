import {createRouter,createWebHistory} from 'vue-router'
import Setting from "@/store/setting.ts";
import isJwtExpired from "@/commands/jwtExpired";

let router = createRouter({
    //hash模式
    history:createWebHistory(import.meta.env.BASE_URL),
    routes:[
        {
            path:'/',
            redirect: '/home'
        },
        {
            path:'/index',
            component: ()=>import('@/views/index.vue'),
            name:'index',
            meta: {
                title: '网盘'
            }
        },
        {
            path:'/home',
            component: ()=>import('@/views/home.vue'),
            name:'home',
            meta: {
                requiresAuth: true,
                title: '我的网盘'
            }
        },
        {
            path:'/login',
            component: ()=>import('@/views/login.vue'),
            name:'login',
            meta: {
                title: '用户登陆',
            }
        },
        {
            path:'/share/:shareId',
            component: ()=>import('@/views/share.vue'),
            name:'file-share',
            meta: {
                title: '文件分享'
            }
        },
        {
            path:'/404',
            component:()=>import('@/views/404.vue'),
            name:'404',
        },
        // 兜底路由：匹配所有未定义的路径，跳 404
        {
            path: '/:pathMatch(.*)*',
            redirect: '/404'
        }
    ]

});
// 全局前置守卫：进入路由前校验权限
router.beforeEach(async (to, from, next) => {

    const settingStore = Setting();

    // 判断当前路由是否需要权限
    if (to.meta.requiresAuth) {
        // 校验 userData.code（200 表示已授权，-1 表示未加载/未登录
        if (isJwtExpired(settingStore.token)) {
            settingStore.token = "";

            next("/login"); // 未授权/未登录，跳登录页
        } else {
            next(); // 已授权，放行

        }
    } else if(to.path=='/login' && !isJwtExpired(settingStore.token)){
        next("/home");  //如果已经登陆 则返回home
    } else {
        next(); // 无需权限的路由（如登录页），直接放行
    }
});
export default router;