import {defineStore} from "pinia";
import {ref} from "vue";
import {BasicInfo, UserInfo} from "@/models/user_models";
import {UserApi} from "@/commands/user";
import {ElMessage} from "element-plus";
import isJwtExpired from "@/commands/jwtExpired";
//全局一些设置
let Setting = defineStore("Setting", ()=>{
    //用户token
    const token = ref('');
    //用户基本信息
    const userInfo = ref<UserInfo | null>(null);
    const theme = ref('light');
    const basicInfo:BasicInfo= {}
    //切换主题状态
    async function toggleTheme() {
        theme.value = theme.value === 'light' ? 'dark' : 'light';
        userInfo.value.Preferences.DarkMode = !userInfo.value.Preferences.DarkMode;
        if (!isJwtExpired(token.value)){
            const info = await UserApi.UpdateUserPreferences(userInfo.value.Preferences);
            if (info.Status!==0) {
                ElMessage.error(info.Msg);
            }
        }


    }
    //刷新用户主题状态
    function refreshTheme() {

        if(userInfo.value==null){
            theme.value = 'light';
        }else{
            theme.value = userInfo.value.Preferences.DarkMode === true ? 'dark' : 'light';
        }
    }

    return {basicInfo,theme,toggleTheme,refreshTheme,token,userInfo}
}, {
    // 组合式持久化配置
    persist: {
        strategies: [
            {
                key: 'setting-store',
                storage: sessionStorage,
                paths: [
                    'theme',
                    'token',

                ]
            }
        ]
    }
})
export default Setting;