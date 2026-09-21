import request from './request';

export enum CloudDriveType { Baidu = 1, Aliyun = 2, OneDrive = 3 }
export enum DriveTokenAction { GetAuthorizationInfo = 1, CheckAuthorization = 2 }

export interface EdriveDefaultMsg<T> { Status: number; Msg: string; Data: T }
export interface DriveParams { Target: string; Label: string; Description: string }
export interface ExternalDriveAccount { external_id: string; display_name: string; drive_type: CloudDriveType; created_at: string }
export interface ExternalDriveItem { id: string; name: string; path: string; is_directory: boolean; size: number; created_at?: string; modified_at?: string; hash?: string }
export interface ExternalDriveDirectory { path: string; items: ExternalDriveItem[]; has_more: boolean; start: number; limit: number }
export interface ExternalDriveFileInfo extends ExternalDriveItem { download_url?: string; mime_type?: string }
export interface ExternalDriveDownload { file_id: string; file_name: string; download_url: string; expires_in: number; supports_range: boolean }
export interface ExternalDriveOperation { operation: string; file_id?: string; path?: string; task_id?: number }
export interface ExternalDriveMoveRequest { driveType: CloudDriveType; fileIdOrPaths: string[]; targetFolderIdOrPath: string; accessToken: string }
export interface ExternalDriveShare { share_id?: string; url?: string; short_url?: string; password?: string; expires_at?: string }
export interface ExternalDriveSearch { items: ExternalDriveItem[]; has_more: boolean; page: number; limit: number }
export interface ExternalDriveChunk { upload_id?: string; chunk_index: number; size: number; md5?: string }
export interface ExternalDriveUploadSession { upload_id: string; file_name: string; file_size: number; chunk_size: number; status: string; uploaded_chunks: ExternalDriveChunk[] }
export interface ExternalDriveUpload { file?: ExternalDriveFileInfo; upload_id?: string; status: string }
export interface ExternalDriveAuthorization { action: DriveTokenAction; authorization_session_id?: string; user_code?: string; verification_url?: string; verification_url_complete?: string; qrcode_url?: string; expires_in?: number; interval?: number; access_token?: string; authorized: boolean }

const API = {
  DIRECTORY_FILE_INFO: '/Edrive/GetUserDirectoryFileInfo', FILE_INFO: '/Edrive/GetFileInfo', SCI_INFO: '/Edrive/GetUserStorageCapacityInfo',
  UPLOAD_FILE: '/Edrive/UpdataFile', CREATE_MULTIPART: '/Edrive/CreateMultipartUpload', GET_CHUNK_INFO: '/Edrive/GetFileChunkInfo',
  UPLOAD_CHUNK: '/Edrive/UploadChunk', MERGE_FILES: '/Edrive/MergeFiles', DELETE_FILE: '/Edrive/DeleteFile', DOWNLOAD_FILE: '/Edrive/DownLoadFile',
  MOVE: '/Edrive/MoveFileOrDir', RENAME: '/Edrive/RenameFileOrDir', CREATE_FOLDER: '/Edrive/CreateFolder', DELETE_FOLDER: '/Edrive/DeleteUserFolder',
  CREATE_SHARE: '/Edrive/CreateShareKey', SEARCH_FILES: '/Edrive/SearchFiles', GET_ADD_PARAMS: '/Edrive/GetAddExternalDriveParams', ADD_DRIVE: '/Edrive/AddExternalDrive',
  DELETE_DRIVE: '/Edrive/DeleteExternalDrive', GET_DRIVES: '/Edrive/GetExternalDriveList', GET_TOKEN: '/Edrive/GetTokenDrive'
};
type Msg<T> = EdriveDefaultMsg<T>;

export const EdriveApi = {
  GetUserDirectoryFileInfo: (driveType: CloudDriveType, folderIdOrPath: string, accessToken: string, start = 0, limit = 1000): Promise<Msg<ExternalDriveDirectory>> => request.get<any, Msg<ExternalDriveDirectory>>(API.DIRECTORY_FILE_INFO, { params: { driveType, folderIdOrPath, accessToken, start, limit } }),
  GetFileInfo: (driveType: CloudDriveType, fileIdOrPath: string, accessToken: string): Promise<Msg<ExternalDriveFileInfo>> => request.get<any, Msg<ExternalDriveFileInfo>>(API.FILE_INFO, { params: { driveType, fileIdOrPath, accessToken } }),
  GetUserStorageCapacityInfo: (driveType: CloudDriveType, accessToken: string): Promise<Msg<{ UsedSpaceInBytes: number; TotalSpaceInBytes: number; FreeSpaceInBytes: number }>> => request.get<any, Msg<{ UsedSpaceInBytes: number; TotalSpaceInBytes: number; FreeSpaceInBytes: number }>>(API.SCI_INFO, { params: { driveType, accessToken } }),
  UpdataFileAsync: (driveType: CloudDriveType, file: File, folderIdOrPath: string, accessToken: string): Promise<Msg<ExternalDriveUpload>> => { const form = new FormData(); form.append('driveType', String(driveType)); form.append('file', file); form.append('folderIdOrPath', folderIdOrPath); form.append('accessToken', accessToken); return request.post<any, Msg<ExternalDriveUpload>>(API.UPLOAD_FILE, form, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  CreateMultipartUpload: (driveType: CloudDriveType, fileName: string, fileSize: number, fileHash: string | null, folderIdOrPath: string, accessToken: string): Promise<Msg<ExternalDriveUploadSession>> => request.post<any, Msg<ExternalDriveUploadSession>>(API.CREATE_MULTIPART, null, { params: { driveType, fileName, fileSize, fileHash, folderIdOrPath, accessToken } }),
  GetFileChunkInfo: (driveType: CloudDriveType, uploadId: string, accessToken: string): Promise<Msg<ExternalDriveUploadSession>> => request.get<any, Msg<ExternalDriveUploadSession>>(API.GET_CHUNK_INFO, { params: { driveType, uploadId, accessToken } }),
  UploadChunkAsync: (driveType: CloudDriveType, uploadId: string, chunkIndex: number, file: File | Blob, accessToken: string): Promise<Msg<ExternalDriveChunk>> => { const form = new FormData(); form.append('driveType', String(driveType)); form.append('uploadId', uploadId); form.append('chunkIndex', String(chunkIndex)); form.append('file', file); form.append('accessToken', accessToken); return request.post<any, Msg<ExternalDriveChunk>>(API.UPLOAD_CHUNK, form, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  MergeFilesAsync: (driveType: CloudDriveType, uploadId: string, folderIdOrPath: string, accessToken: string): Promise<Msg<ExternalDriveUpload>> => request.post<any, Msg<ExternalDriveUpload>>(API.MERGE_FILES, null, { params: { driveType, uploadId, folderIdOrPath, accessToken } }),
  DeleteFileAsync: (driveType: CloudDriveType, fileIdOrPath: string, accessToken: string): Promise<Msg<ExternalDriveOperation>> => request.post<any, Msg<ExternalDriveOperation>>(API.DELETE_FILE, null, { params: { driveType, fileIdOrPath, accessToken } }),
  DownLoadFile: (driveType: CloudDriveType, fileIdOrPath: string, accessToken: string): Promise<Msg<ExternalDriveDownload>> => request.get<any, Msg<ExternalDriveDownload>>(API.DOWNLOAD_FILE, { params: { driveType, fileIdOrPath, accessToken } }),
  MoveFileOrDir: (requestData: ExternalDriveMoveRequest): Promise<Msg<ExternalDriveOperation>> => request.post<ExternalDriveMoveRequest, Msg<ExternalDriveOperation>>(API.MOVE, requestData),
  RenameFileOrDir: (driveType: CloudDriveType, fileIdOrPath: string, newName: string, accessToken: string): Promise<Msg<ExternalDriveOperation>> => request.post<any, Msg<ExternalDriveOperation>>(API.RENAME, null, { params: { driveType, fileIdOrPath, newName, accessToken } }),
  CreateFolder: (driveType: CloudDriveType, parentIdOrPath: string, folderName: string, accessToken: string): Promise<Msg<ExternalDriveOperation>> => request.post<any, Msg<ExternalDriveOperation>>(API.CREATE_FOLDER, null, { params: { driveType, parentIdOrPath, folderName, accessToken } }),
  DeleteUserFolderAsync: (driveType: CloudDriveType, folderIdOrPath: string, accessToken: string): Promise<Msg<ExternalDriveOperation>> => request.post<any, Msg<ExternalDriveOperation>>(API.DELETE_FOLDER, null, { params: { driveType, folderIdOrPath, accessToken } }),
  CreateShareKey: (driveType: CloudDriveType, fileIdOrPath: string, accessToken: string, appId?: string, password?: string, expireTime?: string): Promise<Msg<ExternalDriveShare>> => request.post<any, Msg<ExternalDriveShare>>(API.CREATE_SHARE, null, { params: { driveType, fileIdOrPath, accessToken, appId, password, expireTime } }),
  SearchFiles: (driveType: CloudDriveType, keyword: string, accessToken: string, folderIdOrPath?: string, start = 0, limit = 1000): Promise<Msg<ExternalDriveSearch>> => request.get<any, Msg<ExternalDriveSearch>>(API.SEARCH_FILES, { params: { driveType, keyword, accessToken, folderIdOrPath, start, limit } }),
  GetAddExternalDriveParams: (driveType: CloudDriveType): Promise<Msg<DriveParams[]>> => request.get<any, Msg<DriveParams[]>>(API.GET_ADD_PARAMS, { params: { driveType } }),
  AddExternalDrive: (driveType: CloudDriveType, displayName: string, credentialData: string): Promise<Msg<ExternalDriveAccount>> => request.post<any, Msg<ExternalDriveAccount>>(API.ADD_DRIVE, null, { params: { driveType, displayName, credentialData } }),
  DeleteExternalDrive: (externalId: string): Promise<Msg<ExternalDriveOperation>> => request.post<any, Msg<ExternalDriveOperation>>(API.DELETE_DRIVE, null, { params: { externalId } }),
  GetExternalDriveList: (): Promise<Msg<ExternalDriveAccount[]>> => request.get<any, Msg<ExternalDriveAccount[]>>(API.GET_DRIVES),
  GetTokenDrive: (driveType: CloudDriveType, credentialData: string, action: DriveTokenAction, authorizationSessionId?: string): Promise<Msg<ExternalDriveAuthorization>> => request.post<any, Msg<ExternalDriveAuthorization>>(API.GET_TOKEN, null, { params: { driveType, credentialData, action, authorizationSessionId } })
};
