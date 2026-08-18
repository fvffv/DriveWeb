import request from './request';
import {
    DefaultMsg,
    FileOrDirMoveInfo,
    FileOrDirReNameInfo,
    FileShareData,
    MultipartUploadInitRequest,
    SearchInfo
} from "@/models/user_models";
const API = {
    UPLOAD_FILE: "/Files/UploadFile",
    SCI_INFO:"/Files/GetUserStorageCapacityInfo",
    SAVE_FILE: "/Files/SaveToFile",
    BASIC:"/Files/GetCloudInfo",
    DIRECTORY_FILE_INFO:"/Files/GetUserDirectoryFileInfo",
    CREATE_FOLDER:"/Files/CreateFolder",
    ROOT:"/Files/GetFolderRoot",
    PATH_ID:"/Files/GetFolderByPathStrict",
    DELETE_FILES:"/Files/DeleteUserFile",
    DELETE_FOLDERS:"/Files/DeleteUserFolder",
    RENAME:"/Files/RenameFileOrDir",
    DIRECT_LINK:"/Files/DirectLink",
    DOWNLOAD_KEY:"/Files/GetFileDownLoadTempKey",
    MOVE:"/Files/MoveFileOrDir",
    CREATE_SHARE:"/Files/CreateShareKey",
    GET_SHARE:"/Files/GetShareInfo",
    DOWNLOAD_KEY_SHARE:"/Files/GetShareTempDownLoadKey",
    GET_SEARCH:"/Files/SearchFiles",
    GET_SHAREPRI:"/Files/GetShareFilesInfoPrivate",
    UPDATE_SHARE:"/Files/UpdateShareFileInfo",
    GET_DATAINFO:"/Files/GetDataStatistics",
};
export const FileApi = {
    /**
     * 文件上传接口
     * @param file 原生 File 对象
     * @param folderId 目标上传路径
     * @param onProgress 上传进度回调 (可选)
     */
    uploadFile: (
        file: File,
        folderId: string,
        onProgress?: (event: any) => void
    ) => {
        // 1. 构建 FormData (对应后端 [FromForm])
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', folderId);

        // 2. 发送请求
        return request.post(API.UPLOAD_FILE, formData, {
            headers: {
                // Axios 会自动设置 boundary，但显式声明 multipart/form-data 是好习惯
                'Content-Type': 'multipart/form-data',
            },
            // 3. 绑定进度回调
            onUploadProgress: onProgress
        });
    },
    /**
     * 获取存储容量信息
     */
    GetUserStorageCapacityInfo: (): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.SCI_INFO);
    },
    /**
     * 根据id转存文件或根据hash256转存
     */
    SaveToFile: (folderId,fileId,hash256): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.SAVE_FILE,{params: {
                folderId: folderId,
                fileId: fileId,
                hash256: hash256
            }});
    },
    /**
     * 获取用户根目录ID
     */
    GetFolderRoot: (): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.ROOT);
    },
    /**
     * 获取网盘基本信息
     */
    GetCloudInfo: (): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.BASIC);
    },
    /**
     * 获取目录的文件和文件夹
     */
    GetUserDirectoryFileInfo: (folderId: string, pageIndex: number = 1, pageSize: number = 50): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.DIRECTORY_FILE_INFO, {
            params: {
                folderId: folderId,
                pageIndex: pageIndex,
                pageSize: pageSize
            }
        });
    },
    /**
     * 新建文件夹
     */
    CreateFolder: (folderId,name): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.CREATE_FOLDER,{params: {
                folderId: folderId,
                name: name
            }});
    },
    /**
     * 根据路径获取文件夹id
     */
    GetFolderByPathStrict: (rootPathId,fullPath): Promise<DefaultMsg> => {
        return request.get<any, DefaultMsg>(API.PATH_ID,{params: {
                rootPathId: rootPathId,
                fullPath: fullPath
            }});
    },
    /**
     * 删除文件
     * @param fileIds 删除文件的id数组
     */
    DeleteUserFile: (fileIds:string[]): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.DELETE_FILES, fileIds);
    },
    /**
     * 删除文件夹
     * @param folderIds 删除文件夹的id数组
     */
    DeleteUserFolder: (folderIds:string[]): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.DELETE_FOLDERS, folderIds);
    },
    /**
     * 修改文件夹和名字
     * @param info 修改表单
     */
    RenameFileOrDir: (info:FileOrDirReNameInfo): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.RENAME, info);
    },
    /**
     * 生成临时下载密钥
     * @param fid 文件id
     */
    GetFileDownLoadTempKey: (fid: string): Promise<DefaultMsg> => {
        return request.get(API.DOWNLOAD_KEY,{params: {
                fileId: fid,
            }});
    },
    /**
     * 生成临时下载密钥 分享
     * @param shareKey
     * @param pwd
     */
    GetShareTempDownLoadKey: (shareKey: string,pwd:string): Promise<DefaultMsg> => {
        return request.get(API.DOWNLOAD_KEY_SHARE,{params: {
                shareKey: shareKey,
                pwd:pwd
            }});
    },
    /**
     * 移动文件或文件夹到其他目录
     * @param info 移动文件清单
     */
    MoveFileOrDir: (info: FileOrDirMoveInfo): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.MOVE, info);
    },
    /**
     * 创建分享链接
     */
    CreateShareKey: (info: FileShareData): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.CREATE_SHARE, info);
    },
    /**
     * 更新分享链接信息
     */
    UpdateShareFileInfo: (shareId,info?: FileShareData,isDel?:boolean=false): Promise<DefaultMsg> => {
        return request.post<any, DefaultMsg>(API.UPDATE_SHARE, info, {
            params: {
                shareId: shareId,
                isDel:isDel
            }
        });
    },
    /**
     * 得到下载信息
     */
    GetShareInfo: (shareKey: string): Promise<DefaultMsg> => {
        return request.get(API.GET_SHARE,{params: {
                shareKey: shareKey,
            }});
    },

    /**
     * 语义搜索文件
     */
    SearchFiles: (searchInfo: SearchInfo, isAI: boolean = true): Promise<DefaultMsg> => {

        return request.post(API.GET_SEARCH, searchInfo, {
            params: {
                isAI: isAI
            }
        });
    },
    /**
     * 得到自己的分享文件列表
     */
    GetShareFilesInfoPrivate: (): Promise<DefaultMsg> => {
        return request.get(API.GET_SHAREPRI);
    },

    /**
     * 得到自己的统计信息
     */
    GetDataStatistics: (): Promise<DefaultMsg> => {
        return request.get(API.GET_DATAINFO);
    },

    /**
     * 创建分片上传任务
     * @param req 初始化上传请求参数
     * @returns 返回包含分片任务信息的 DefaultMsg
     */
    CreateMultipartUpload: (req: MultipartUploadInitRequest): Promise<DefaultMsg> => {
        return request.post('/Files/CreateMultipartUpload', req); // 请替换为实际的路由常量 API.XXX
    },

    /**
     * 获取文件分片信息 (断点续传时获取已传进度)
     * @param uploadId 分片任务唯一标识
     */
    GetFileChunkInfo: (uploadId: string): Promise<DefaultMsg> => {
        // 后端是 POST，但参数是简单字符串，通常通过 URL Query 传递
        return request.get('/Files/GetFileChunkInfo', {
            params: {
                uploadId: uploadId,
            }
        });
    },

    /**
     * 上传单块分片文件
     * @param uploadId 分片任务唯一标识
     * @param chunkIndex 当前分片序号
     * @param file 分片文件对象 (Blob 或 File)
     */
    UploadChunk: (uploadId: string, chunkIndex: number, file: File | Blob): Promise<DefaultMsg> => {
        // 后端标记了 [FromForm]，必须使用 FormData 构造表单数据
        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('file', file);

        return request.post('/Files/UploadChunk', formData, {
            // Axios 会自动识别 FormData 并设置 Content-Type 为 multipart/form-data，并带上正确的 boundary
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    /**
     * 请求合并分片文件
     * @param uploadId 分片任务唯一标识
     * @param folderId 目标存储的文件夹 ID
     */
    MergeFiles: (uploadId: string, folderId: string): Promise<DefaultMsg> => {
        // 后端是 GET 请求
        return request.get('/Files/MergeFiles', {
            params: {
                uploadId: uploadId,
                folderId: folderId
            }
        });
    }
};