import request from './request';
import type {CustomView, DefaultMsg} from '@/models/user_models';

const API = {

    LOGIN: "/user/LoginUser",
    REGISTER: "/user/RegisterUser",
    SEED_CODE: "/user/SeedEmailCode",
    USER_INFO: "/user/GetUserInfo",
    UPLOAD_AVATAR: "/user/UploadAvatar",
    UPDATE_INFO:"/user/UpdateUserInfo",
    UPDATE_PW: "/user/UpdatePassword",
    UPDATE_PF: "/user/UpdateUserPreferences",
    UPDATE_VIEW: "/user/UpdateUserView",

};

export const UserApi = {

    /**
     * 用户登录接口
     * @param usernameOrEmail 用户名或邮箱
     * @param password 密码
     */
    login: (usernameOrEmail: string, password: string): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.LOGIN, { usernameOrEmail, password });
    },
    /**
     * 用户注册接口
     * @param UserName 用户名名
     * @param PassWord 密码
     * @param Email 邮箱
     * @param code 验证码
     */
    register: (UserName:string,PassWord:string ,Email:string,code:string): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.REGISTER,{UserName,PassWord,Email,code});
    },
    /**
     * 用户发送验证码
     * @param Email 邮箱
     */
    SeedCode: (Email: string): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.SEED_CODE, {params: {
            Email: Email // 正确传递参数的方式
        }});
    },
    /**
     * 获取用户信息
     */
    GetUserInfo: (): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.USER_INFO);
    },
    /**
     * 上传头像 (最大限制 2MB)
     * @param file 原生 File 或 Blob 对象
     */
    UploadAvatar: (file: File): Promise<DefaultMsg> => {
        const formData = new FormData();
        formData.append('file', file);
        return request.post(API.UPLOAD_AVATAR, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },
    /**
     * 更新用户信息
     */
    UpdateUserInfo: (info:UserInfoEdit): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.UPDATE_INFO,info);
    },
    /**
     * 更新用户密码
     */
    UpdatePassword: (info:UserPasswordEdit): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.UPDATE_PW,info);
    },
    /**
     * 更新用户偏好
     */
    UpdateUserPreferences: (info:UserPreferences): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.UPDATE_PF,info);
    },
    /**
     * 更新用户偏好
     */
    UpdateUserView: (info:CustomView[]): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.UPDATE_VIEW,info);
    },

};
