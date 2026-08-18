export interface DefaultMsg{
    Status:number,
    Msg:string,
    Data:Object,
}

/**
 * 存储空间使用信息
 */
export interface StorageInfo {
    UsedSpaceInBytes: number;
    TotalSpaceInBytes: number;
    FreeSpaceInBytes: number;
}

/**
 * 用户偏好设置
 */
export interface UserPreferences {
    /**
     * 是否启用深色模式
     */
    DarkMode: boolean;
    /**
     * 是否启用文件直链功能
     */
    IsDirectLinkEnabled: boolean;
    /**
     * 是否启用WebDAV功能
     */
    IsWebDAVEnabled: boolean;
    /**
     * 自定义视图
     */
    CustomView: CustomView[];
}
/**
 * 自定义视图
 */
export interface CustomView {
    /**
     * 视图名字
     */
    Name: string;
    /**
     * 视图图标
     */
    Icon: string;
    /**
     * 视图类型 (0: 关键字过滤搜索, 1: 文件夹路径快捷跳转)
     */
    Type: number;
    /**
     * 视图关键词数组 (若Type为1，则第一项为绝对路径)
     */
    Keywords: string[];
}
/**
 * 用户信息模型
 */
export interface UserInfo {
    UserId: string;
    Username: string;
    Nickname: string;
    AvatarUrl: string;
    CreatedAt: string;
    Email: string;
    Sci: StorageInfo;
    Preferences: UserPreferences;
    Status: number;
}
export interface FileInfo {
    Id: string;
    FileName: string;
    FileSizeInBytes: number;
    FileHash: string;
    CreationTime: string;      // 日期时间通常用 string 或 Date 类型
    LastModifiedTime: string;  // 此处使用 string 以匹配原始数据
    FileShare: any | null;     // 分享信息，结构未知，可为 null
    FolderPath: string;
}
export interface FolderInfo {
    Id: string;
    ParentId: string;
    FolderName: string;
    CreationTime: string; // 日期时间通常用 string 或 Date 类型
}
export interface FileOrDirReNameInfo {
    Type: 0 | 1;
    Id: string;
    NewName: string;
}
export interface FileOrDirMoveInfo {
    /**
     * 选中的文件夹 ID 集合
     * 对应 C# 中的 string[]? (可空)
     */
    folderIds?: string[] | null;

    /**
     * 选中的文件 ID 集合
     * 对应 C# 中的 string[]? (可空)
     */
    fileIds?: string[] | null;

    /**
     * 目标文件夹 ID
     * 对应 C# 中的 string (不可空，必填)
     */
    newFolderId: string;
}
export interface UserInfoEdit {
    UserNick :string;
}
export interface UserPasswordEdit {
    OldPassword :string;
    NewPassword:string;
}
export interface BasicInfo {
    Name :string;
    MaxFileSize: number;
}
export interface FileShareData {
    ShareFileId: string;
    BeginValidity: string | Date;
    EndValidity: string | Date;
    Password?: string;
    Introduction?: string;
}
/**
 * 分享详情返回数据
 */
export interface ShareDetailInfo {
    /**
     * 分享者的用户 ID
     */
    UserId: string;

    /**
     * 分享者昵称
     */
    Nickname: string;

    /**
     * 被分享的文件 ID
     */
    ShareFileId: string;

    /**
     * 有效期开始时间 (ISO 8601 字符串)
     */
    BeginValidity: string;

    /**
     * 有效期结束时间 (ISO 8601 字符串)
     */
    EndValidity: string;

    /**
     * 分享留言/简介
     */
    Introduction: string;

    /**
     * 分享链接创建时间 (ISO 8601 字符串)
     */
    CreationTime: string;

    /**
     * 该分享是否被密码保护
     */
    IsPassword: boolean;

    /**
     * 被分享的文件名称
     */
    Name: string;
    /**
     * 文件大小
     */
    SizeInBytes: string;
    /**
     * 头像
     */
    AvatarUrl: string;
}
/**
 * 基础信息配置
 */
export interface BasicInformation {
    ProjectName: string; // 项目名称
}

/**
 * AI 设定配置
 */
export interface AISetting {
    Enable: boolean;              // 是否启用 AI 功能
    ImageCosineThreshold: number; // 图片相似度阈值 (0-1)
    BaseURL?: string;
    ApiKey?: string;
    Model?: string;
}

/**
 * 认证与安全 (JWT) 配置
 */
export interface JwtSetting {
    SigningKey: string;    // 密钥
    Issuer: string;        // 颁发者
    Audience: string;      // 接收者
    ExpireSeconds: number; // 过期时间 (秒)
}

/**
 * 数据库配置
 */
export interface DbSetting {
    DbType: number;           // 数据库类型 (例如：0:MySql, 1:SqlServer, 4:PostgreSql)
    ConnectionString: string; // 数据库连接字符串
    LogWriteToDB: boolean;    // 系统日志是否写入数据库
}

/**
 * 缓存配置
 */
export interface CacheSetting {
    CacheType: string;                     // 缓存类型 (例如：MemoryCache, Redis)
    ConnectionString: string;              // 缓存连接串
    ValidityPeriod: number;                // 默认有效期 (天)
    TempDownLoadKeyValidityPeriod: number; // 临时下载密钥有效期 (分钟)
}

/**
 * 文件与存储规则配置
 */
export interface FileSetting {
    FileOrDirNameLengthLimit: number;     // 名称长度限制
    FileOrDirNameBlacklist: string;       // 名称黑名单 (使用 | 隔开)
    FileOrDirNameBlacklistRegExp: string; // 名称黑名单正则表达式
    MaxFileSize: number;                  // 单文件最大上传限制 (Bytes)
    IsSoftDelete: boolean;                // 是否启用软删除
    LocalFilePath: string;                // 本地文件存储路径 (使用 | 隔开)
    TempFilePath: string;                 // 临时文件存储路径
}

/**
 * 默认用户与配额配置
 */
export interface UserSetting {
    UserNameMaxLength: number;     // 用户名最大长度
    UserPassWordMinLength: number; // 密码最小长度
    UserPassWordMaxLength: number; // 密码最大长度
    DefaultUserAvatar: string;     // 默认用户头像地址 (URL)
    DefaultTotalStorageGb: number; // 新用户默认容量 (GB)
}

/**
 * SMTP 邮件服务配置
 */
export interface EmailSetting {
    SmtpServer: string; // SMTP 地址
    SmtpPort: number;   // 端口
    Email: string;      // 发件人邮箱
    PassWord: string;   // 邮箱密码/授权码
}

/**
 * 消息队列 (MQ) 配置
 */
export interface MQSetting {
    MqType: string;           // 队列类型 (例如：MemoryMQ, RabbitMQ)
    ConnectionString: string; // 连接字符串
}

/**
 * 单个网络监听端点配置 (IPv4/IPv6 共用)
 */
export interface EndpointConfig {
    Ip: string;           // IP 地址
    Port: number;         // 端口
    EnableSsl: boolean;   // 启用 SSL
    CertPath: string;     // 证书路径
    CertPassword: string; // 证书密码
}

/**
 * 服务器监听配置
 */
export interface ServerSettings {
    IPv4: EndpointConfig; // IPv4 监听配置
    IPv6: EndpointConfig; // IPv6 监听配置
}

/**
 * 系统全局配置总接口 (聚合以上所有子模块)
 */
export interface SystemConfig {
    basicInformation: BasicInformation;
    aiSetting: AISetting;
    jwtSetting: JwtSetting;
    dbSetting: DbSetting;
    cacheSetting: CacheSetting;
    fileSetting: FileSetting;
    userSetting: UserSetting;
    emailSetting: EmailSetting;
    mqSetting: MQSetting;
    serverSettings: ServerSettings;
}
export interface SearchInfo {
    /**
     * 搜索关键词
     */
    Keyword?: string | null;

    /**
     * 文件类型数组, 是空则不限制搜索类型。
     */
    FileType?: string[] | null;

    /**
     * 文件最小Bytes, 是0则不限制
     * 注: JS中安全的数字范围足够表示 9 PB 以下的文件大小，这里直接用 number 即可
     */
    FileSizeInBytesMin?: number | null;

    /**
     * 文件最大Bytes, 是0则不限制
     */
    FileSizeInBytesMax?: number | null;

    /**
     * 文件搜索最后修改时间开始部分
     * 格式: yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss
     */
    StarLastModifiedTime?: string | null;

    /**
     * 文件搜索最后修改时间结束部分
     * 格式: yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss
     */
    EndLastModifiedTime?: string | null;

    /**
     * 文件搜索创建时间开始部分
     * 格式: yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss
     */
    StarCreationTime?: string | null;

    /**
     * 文件搜索创建时间结束部分
     * 格式: yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss
     */
    EndCreationTime?: string | null;

    /**
     * 排序方式, 是空则默认按时间排序。
     * 注: 排列方式不同结果也不同
     */
    OrderByType?: string[] | null;
}
/**
 * 初始化分片上传请求的模型
 */
export interface MultipartUploadInitRequest {
    FileName: string;
    FileSizeInBytes: number;
    FileHash: string;
}

/**
 * 单个已上传成功的分片信息模型
 */
export interface UploadedChunkModel {
    /** 分片序号 从 0 开始 */
    index: number;
    /** 当前分片实际大小 字节 */
    size: number;
    /** 该分片完成上传的时间戳 */
    completed_at: number;
}

/**
 * 上传文件的静态元数据模型
 */
export interface UploadMetaModel {
    /** 原始文件名 */
    file_name: string;
    /** 文件完整哈希值256 */
    file_hash: string;
    /** 文件总大小 字节 */
    total_size: number;
    /** 总分片数量 */
    total_chunks: number;
}

/**
 * 分段上传任务核心信息模型
 */
export interface UploadTaskModel {
    /** 任务唯一标识 (Guid) */
    upload_id: string;
    /** 所属用户ID (Guid) */
    user_id: string;
    /** 当前任务状态 UPLOADING上传中 END结束 */
    status: string;
    /** 文件的静态元数据 */
    meta: UploadMetaModel;
    /** 已完成上传的分片进度列表 */
    uploaded_chunks: UploadedChunkModel[];
    /** 任务创建时间戳 */
    created_at: number;
}