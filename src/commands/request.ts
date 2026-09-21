import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus'
import Setting from "@/store/setting";
import {useRouter} from "vue-router";
// 创建一个新的 axios 实例
const service: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_APP_BASE_API, // 使用 .env 文件中的 VITE_APP_BASE_API
    timeout: -1, // 请求超时时间

});

// --- 请求拦截器 ---
service.interceptors.request.use(

    (config: InternalAxiosRequestConfig) => {

        const settingStore = Setting()

        // 确保 settingStore.token有值
        if (settingStore.token) {
            config.headers.Authorization = `Bearer ${settingStore.token}`;
        }
        return config;
    },
    (error: AxiosError) => {
        // 对请求错误做些什么
        console.error('请求错误:', error); // for debug
        return Promise.reject(error);
    }
);

// --- 响应拦截器 ---
service.interceptors.response.use(
    (response: AxiosResponse) => {
        if (response.data instanceof Blob) {
            return response;
        }
        const res = response.data;

        // 如果响应数据不是我们期望的格式，直接抛出错误
        // 这里的 `code` 是与后端约定好的状态码，例如 20000 表示成功

        // 外部网盘设备码轮询使用 Status=2 表示“等待用户确认”，这不是错误。
        if (res.Status !== 0 && res.Status !== 1 && res.Status !== 2) {

            if (res.Status === 401) {
                useRouter().push('/login');
                return res;
            }else{
                ElMessage({
                    message: res.Msg || 'Error',
                    type: 'error',
                    duration: 5 * 1000
                });
                console.error('API 错误:', res);
            }





            return Promise.reject(new Error(res.message || 'Error'));
        } else {
            // 如果成功，则直接返回 `data` 字段
            return res;
        }
    },
    (error: AxiosError) => {
        // 处理 HTTP 错误
        let errorMessage = '';
        if (error.response) {
            // 请求已发出，但服务器以状态码进行响应
            console.log(error.response);
            switch (error.response.status) {
                case 400:
                    errorMessage = '请求错误(400)\n'+JSON.stringify(error.response.data);
                    break;
                case 401:
                    errorMessage = '未授权，请重新登录(401)';
                    // 这里可以做跳转登录页等操作
                    break;
                case 403:
                    errorMessage = '拒绝访问(403)';
                    break;
                case 404:
                    errorMessage = '请求资源不存在(404)';
                    break;
                case 500:
                    errorMessage = '服务器内部错误(500)';
                    break;
                default:
                    errorMessage = `连接错误(${error.response.status})!`;
            }
        } else if (error.request) {
            // 请求已发出，但没有收到响应
            errorMessage = '网络超时，请检查网络连接!';
        } else {
            // 在设置请求时触发的某些事情导致了错误
            errorMessage = '请求失败!';
        }

        console.error('HTTP 错误:', error.message);
        ElMessage({
          message: errorMessage,
          type: 'error',
          duration: 5 * 1000
        });

        return Promise.reject(error);
    }
);

export default service;
