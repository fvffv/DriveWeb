import request from './request';
import {DefaultMsg, FileOrDirMoveInfo, FileOrDirReNameInfo, FileShareData} from "@/models/user_models";
const API = {
    GET_DATAINFO: "/Admin/GetDataStatistics",
    SYSTEM_INFO: "/Admin/GetSystemInfo",
    GET_USERS: "/Admin/GetUsers",
    UPDATE_USERS: "/Admin/UpdateUserInfo",
    ADD_USER: "/Admin/RegisterUser",
    FIND_FILE: "/Admin/GetGlobalFiles",
    DEL_FILES: "/Admin/RemoveFiles",
    GET_FILEKEY: "/Admin/GetTempDownLoadKey",
    CFG: "/Admin/GetConfigs",
    UPDATE_CFG: "/Admin/UpdateSystemConfig",
    RE:"/Admin/Restart",
    LOG:"/Admin/GetLogs",
};
export const AdminApi = {
    /**
     * 得到总统计信息
     */
    GetDataStatistics: (): Promise<DefaultMsg> => {
        return request.get(API.GET_DATAINFO);
    },
    /**
     * 获取系统重要信息
     */
    GetSystemInfo: (): Promise<DefaultMsg> => {
        return request.get(API.SYSTEM_INFO);
    },
    /**
     * 获取所有用户信息
     */
    GetUsers: (): Promise<DefaultMsg> => {
        return request.get(API.GET_USERS);
    },
    /**
     * 更新用户信息
     */
    UpdateUserInfo: (info): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.UPDATE_USERS,info);
    },
    /**
     * 新增用户
     */
    RegisterUser: (info): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.ADD_USER,info);
    },
    /**
     * 分页获取全局文件列表
     * @param pageIndex 当前页码
     * @param pageSize 每页数量
     * @param keyword 搜索关键字 (可选)
     * @param isDeleted 0:所有 1:软删除 2:未软删除
     */
    GetGlobalFiles: (pageIndex: number, pageSize: number, keyword: string = '', isDeleted: number = 0): Promise<DefaultMsg> => {
        return request.post(API.FIND_FILE, {
                pageIndex,
                pageSize,
                keyword,
                isDeleted
        });
    },
    RemoveFiles: (payload: any[]): Promise<DefaultMsg> => {
        return request.post(API.DEL_FILES, payload);
    },
    GetTempDownLoadKey: (userId:string,fileId:string): Promise<DefaultMsg> => {
        return request.get(API.GET_FILEKEY,{params: {
                userId: userId,
                fileId:fileId
            }});
    },
    GetConfigs:():Promise<DefaultMsg>=>{
        return request.get(API.CFG)
    },
    Restart: (payload: any[]): Promise<DefaultMsg> => {
        return request.get(API.RE);
    },
    GetLogs:(page:number):Promise<DefaultMsg> => {
        return request.get(API.LOG,{params: {
                page: page,
            }});
    },
    UpdateSystemConfig: (info: any): Promise<DefaultMsg> => {
        return request.post(API.UPDATE_CFG, info);
    },

};