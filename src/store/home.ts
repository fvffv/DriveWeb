import {defineStore} from "pinia";
import {ref} from "vue";
import {FileApi} from "@/commands/file.js";
import {  ElMessage } from 'element-plus';
import {DefaultMsg, FileInfo, FolderInfo} from "@/models/user_models"
import setting from "@/store/setting";
//全局一些设置
let Home = defineStore("Home", ()=>{
    const TotalFileCount = ref(0);
    const CurrentPageIndex = ref(1);
    const PageSize = ref(50); // 与后端约定的默认页大小
    //选中的文件列表
    const selectedFiles = ref<FileInfo[]>([]);
    //选中的文件夹列表
    const selectedFolders = ref<FolderInfo[]>([]);
    //清空选择的动作
    const clearSelection = () => {
        selectedFiles.value = [];
        selectedFolders.value = [];
    }
    //当前导航
    const activeNavItem =ref("我的文件");
    //自定义视图列表
    const customMenus = ref<CustomView[]>([]);
    //当前浏览文件夹
    const currentFolder = ref<FolderInfo>({});
    //根目录信息
    const rootFolder = ref<FolderInfo>({});
    //当前浏览总路径
    const currentPath = ref<string>('');
    //存储容量信息
    const sci = ref({
        UsedSpaceInBytes:0,
        TotalSpaceInBytes:0,
        FreeSpaceInBytes:0
    })
    //获取储存容量信息
    const setUserStorageCapacityInfo=async() =>{
        const info =(await FileApi.GetUserStorageCapacityInfo()).Data ;
        sci.value.FreeSpaceInBytes = info.FreeSpaceInBytes;
        sci.value.TotalSpaceInBytes = info.TotalSpaceInBytes;
        sci.value.UsedSpaceInBytes = info.UsedSpaceInBytes;
    }
    const FileMaxUploadSizeLimit = ref(0)
    const FolderInfo = ref<FolderInfo[]>([]); // 这是一个 FolderInfo 类型的数组
    const FileInfo = ref<FileInfo[]>([]);   // 这是一个 FileInfo 类型的数组
    const FilterFolderInfo = ref<FolderInfo[]>([]); // 筛选的临时
    const FilterFileInfo = ref<FileInfo[]>([]);   // 筛选的临时
    const AiSearchFolderInfo = ref<FolderInfo[]>([]); // 筛选的临时
    const AiSearchFileInfo = ref<FileInfo[]>([]);   // 筛选的临时
    const setFolderRoot =async ()=>{
        const info =await FileApi.GetFolderRoot();
        rootFolder.value.Id = info.Data
        rootFolder.value.Path = '/'
    }

    // 目录刷新时间戳，用于通知前端强制重新渲染
    const DirRefreshTimestamp = ref(Date.now());

    // 获取目录文件信息
    const setUserDirectoryFileInfo = async (folderId: string, pageIndex: number = 1, pageSize: number = 50): DefaultMsg => {
        // 获取目录信息（带上分页参数）
        const info = await FileApi.GetUserDirectoryFileInfo(folderId, pageIndex, pageSize);
        if(info.Status == 0){
            currentFolder.value.Id = folderId;

            // 拿到新的文件数据并排序
            const newSortedFiles = sortFileRecordsByCreationTime(info.Data.FileInfos, false);

            if (pageIndex === 1) {
                // 第一页：直接覆盖
                FileInfo.value = newSortedFiles;
                // 文件夹通常不分页或只在第一页加载，过滤掉自身
                FolderInfo.value = info.Data.Dirs.filter(x => x.Id !== folderId);

                // 🌟 核心：只要是拉取第一页数据（刷新、重命名后刷新），就更新时间戳
                DirRefreshTimestamp.value = Date.now();
            } else {
                // 第二页及以后：追加数据
                FileInfo.value.push(...newSortedFiles);
            }

            FilterFolderInfo.value = FolderInfo.value;
            FilterFileInfo.value = FileInfo.value;

            // 更新分页统计状态
            TotalFileCount.value = info.Data.TotalFileCount;
            CurrentPageIndex.value = pageIndex;
            PageSize.value = pageSize;
        }

        return info;
    }
    //根据路径得到文件夹Id
    const getPullPathToFolderId = async (path)=>{
        const info = await FileApi.GetFolderByPathStrict(rootFolder.value.Id,path)
        return info;
    }
    //根据名字获得图标
    const getFileIconClass = (fileName: string): string => {
        if (!fileName) return 'fa-solid fa-file'; // 空检查

        // 1. 获取后缀名 (转小写)
        // 使用 lastIndexOf 处理文件名中可能包含多个点的情况 (如 archive.tar.gz)
        const index = fileName.lastIndexOf('.');
        if (index === -1) return 'fa-solid fa-file'; // 没有后缀名，返回默认图标

        const ext = fileName.substring(index + 1).toLowerCase();

        // 2. 定义映射关系
        // 你可以在这里随意添加更多格式
        const iconMap: Record<string, string> = {
            // 图片
            'jpg': 'fa-solid fa-file-image',
            'jpeg': 'fa-solid fa-file-image',
            'png': 'fa-solid fa-file-image',
            'gif': 'fa-solid fa-file-image',
            'bmp': 'fa-solid fa-file-image',
            'svg': 'fa-solid fa-file-image',
            'webp': 'fa-solid fa-file-image',
            'ico': 'fa-solid fa-file-image',

            // 文档
            'pdf': 'fa-solid fa-file-pdf',
            'doc': 'fa-solid fa-file-word',
            'docx': 'fa-solid fa-file-word',
            'xls': 'fa-solid fa-file-excel',
            'xlsx': 'fa-solid fa-file-excel',
            'csv': 'fa-solid fa-file-csv', // 或者用 excel 图标
            'ppt': 'fa-solid fa-file-powerpoint',
            'pptx': 'fa-solid fa-file-powerpoint',
            'txt': 'fa-solid fa-file-lines',
            'md': 'fa-brands fa-markdown', // Markdown 有专门的 brands 图标
            'xml': 'fa-solid fa-file-code',

            // 代码
            'js': 'fa-brands fa-js',
            'ts': 'fa-brands fa-js', // 或者用 file-code
            'vue': 'fa-brands fa-vuejs',
            'html': 'fa-brands fa-html5',
            'css': 'fa-brands fa-css3-alt',
            'json': 'fa-solid fa-file-code',
            'java': 'fa-brands fa-java',
            'jar': 'fa-brands fa-java',
            'py': 'fa-brands fa-python',
            'go': 'fa-brands fa-golang',
            'c': 'fa-solid fa-file-code',
            'cpp': 'fa-solid fa-file-code',
            'sql': 'fa-solid fa-database',
            'cs': 'devicon-csharp-plain colored',

            // 压缩包
            'zip': 'fa-solid fa-file-zipper',
            'rar': 'fa-solid fa-file-zipper',
            '7z': 'fa-solid fa-file-zipper',
            'tar': 'fa-solid fa-file-zipper',
            'gz': 'fa-solid fa-file-zipper',

            // 媒体
            'mp3': 'fa-solid fa-file-audio',
            'wav': 'fa-solid fa-file-audio',
            'ogg': 'fa-solid fa-file-audio',
            'mp4': 'fa-solid fa-file-video',
            'avi': 'fa-solid fa-file-video',
            'mkv': 'fa-solid fa-file-video',
            'mov': 'fa-solid fa-file-video',

            // 其他
            'exe': 'fa-brands fa-windows',
            'apk': 'fa-brands fa-android',
            'iso': 'fa-solid fa-compact-disc', // 光盘镜像
            'nbt': 'fa-solid fa-cube'
        };

        // 3. 返回对应图标，如果没有匹配则返回默认通用文件图标
        return iconMap[ext] || 'fa-solid fa-file';
    };
    //获得颜色
    const getFileIconColor = (fileName: string): string => {
        // 默认颜色 (灰色 - 用于未知文件)
        const defaultColor = '#909399';

        if (!fileName) return defaultColor;

        const index = fileName.lastIndexOf('.');
        if (index === -1) return defaultColor;

        const ext = fileName.substring(index + 1).toLowerCase();

        const colorMap: Record<string, string> = {
            // === 办公文档 ===
            'pdf': '#e33e33',   // PDF 红色
            'doc': '#2b579a',   // Word 蓝色
            'docx': '#2b579a',
            'xls': '#217346',   // Excel 绿色
            'xlsx': '#217346',
            'csv': '#217346',
            'ppt': '#d24726',   // PPT 橙红色
            'pptx': '#d24726',
            'txt': '#606266',   // 文本 深灰

            // === 图片 (统一用紫色或根据类型分) ===
            'jpg': '#8e44ad',   // 紫色
            'jpeg': '#8e44ad',
            'png': '#8e44ad',
            'gif': '#8e44ad',
            'svg': '#e67e22',   // SVG 橙色
            'ico': '#8e44ad',
            'webp': '#8e44ad',

            // === 代码文件 (使用品牌色) ===
            'js': '#f1e05a',    // JS 黄
            'ts': '#3178c6',    // TS 蓝
            'vue': '#41b883',   // Vue 绿
            'html': '#e34c26',  // HTML5 橙
            'css': '#563d7c',   // CSS 紫
            'json': '#cf8f2f',  // JSON 黄褐
            'java': '#b07219',  // Java 棕
            'py': '#3572a5',    // Python 蓝
            'go': '#00add8',    // Go 青
            'sql': '#f0ad4e',   // 数据库 黄
            'jar': '#f89820',
            'nbt': '#4caf50',
            'xml': '#cf8f2f',

            // === 压缩包 ===
            'zip': '#f1c40f',   // 黄色
            'rar': '#f1c40f',
            '7z': '#f1c40f',
            'tar': '#f1c40f',
            'gz': '#f1c40f',

            // === 媒体 ===
            'mp3': '#ff9f43',   // 音频 橙色
            'wav': '#ff9f43',
            'mp4': '#3498db',   // 视频 蓝色
            'avi': '#3498db',
            'mkv': '#3498db',
            'mov': '#3498db',

            // === 系统/其他 ===
            'exe': '#00a8ff',   // Windows 蓝
            'apk': '#a4c639',   // Android 绿
            'iso': '#95a5a6',   // 镜像 灰
        };

        return colorMap[ext] || defaultColor;
    };
    //格式化时间字符串
    const formatShortDate = (timeStr: string): string => {
        if (!timeStr) return '';

        // 将字符串转换为 Date 对象
        const date = new Date(timeStr);

        // 检查时间是否有效
        if (isNaN(date.getTime())) return timeStr;

        // 1. 获取年份后两位 (2026 -> 26)
        const year = date.getFullYear().toString().slice(-2);

        // 2. 获取月份 (0-11，需要+1，不补0以匹配你的示例 "2月")
        const month = date.getMonth() + 1;

        // 3. 获取日期 (不补0)
        const day = date.getDate();

        // 4. 获取小时 (需要补0，例如 9 -> 09)
        const hour = date.getHours().toString().padStart(2, '0');

        // 5. 获取分钟 (需要补0)
        const minute = date.getMinutes().toString().padStart(2, '0');

        // 拼接字符串
        return `${year}年${month}月${day}日${hour}:${minute}`;
    };
    //取后缀
    const getFileTypeDetail = (fileName: string): string => {
        // 1. 安全检查
        if (!fileName) return '未知文件';

        // 2. 找最后一个点的位置
        const lastIndex = fileName.lastIndexOf('.');

        // 3. 处理无后缀的情况
        // lastIndex === -1 (没有点)
        // lastIndex === fileName.length - 1 (点在最后，如 "file.")
        if (lastIndex === -1 || lastIndex === fileName.length - 1) {
            return '文件'; // 或者返回 '未知类型'
        }

        // 4. 截取后缀并转小写
        const ext = fileName.substring(lastIndex + 1).toLowerCase();

        // 5. 定义映射字典 (你可以根据需要补充更多)
        const typeMap: Record<string, string> = {
            // === 办公文档 ===
            'doc': 'Word 文档',
            'docx': 'Word 文档',
            'xls': 'Excel 工作表',
            'xlsx': 'Excel 工作表',
            'ppt': 'PowerPoint 演示文稿',
            'pptx': 'PowerPoint 演示文稿',
            'pdf': 'PDF 文档',
            'txt': '文本文档',
            'md': 'Markdown 文档',
            'csv': 'CSV 表格数据',

            // === 图片 ===
            'jpg': 'JPEG 图像',
            'jpeg': 'JPEG 图像',
            'png': 'PNG 图像',
            'gif': 'GIF 动图',
            'bmp': 'BMP 图像',
            'svg': 'SVG 矢量图',
            'ico': '图标文件',
            'webp': 'WebP 图像',
            'psd': 'Photoshop 文档',

            // === 代码与网页 ===
            'html': 'HTML 网页',
            'htm': 'HTML 网页',
            'css': 'CSS 样式表',
            'js': 'JavaScript 脚本',
            'ts': 'TypeScript 源码',
            'json': 'JSON 数据文件',
            'vue': 'Vue 组件',
            'java': 'Java 源代码',
            'py': 'Python 脚本',
            'go': 'Go 源代码',
            'c': 'C 源代码',
            'cpp': 'C++ 源代码',
            'sql': 'SQL 数据库脚本',
            'xml': 'XML 文件',
            'yaml': 'YAML 配置文件',
            'yml': 'YAML 配置文件',

            // === 压缩包 ===
            'zip': 'ZIP 压缩包',
            'rar': 'RAR 压缩包',
            '7z': '7z 压缩包',
            'tar': 'TAR 归档文件',
            'gz': 'GZ 压缩文件',

            // === 多媒体 ===
            'mp3': 'MP3 音频',
            'wav': 'WAV 音频',
            'ogg': 'OGG 音频',
            'mp4': 'MP4 视频',
            'avi': 'AVI 视频',
            'mov': 'MOV 视频',
            'mkv': 'MKV 视频',
            'flv': 'Flash 视频',

            // === 可执行程序与系统 ===
            'exe': 'Windows 应用程序',
            'msi': 'Windows 安装包',
            'bat': 'Windows 批处理',
            'sh': 'Shell 脚本',
            'apk': 'Android 安装包',
            'iso': '光盘镜像文件',
            'dmg': 'macOS 磁盘映像',
            'dll': '应用程序扩展',
        };

        // 6. 返回匹配结果，如果没有匹配，则返回 "EXT 文件" (例如 "XYZ 文件")
        return typeMap[ext] || `${ext.toUpperCase()} 文件`;
    };
    //单位转换
    const formatFileSize = (bytes: number, decimals: number = 2): string => {
        // 1. 处理 0 字节的情况
        if (bytes === 0) return '0 B';

        // 2. 定义单位 (使用 1024 进制)
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        // 3. 计算单位级别 (Math.log 来计算是 1024 的几次幂)
        // Math.floor(Math.log(bytes) / Math.log(k)) 等同于 floor(log1024(bytes))
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        // 4. 计算数值
        // Math.pow(k, i) 就是 1024 的 i 次方
        const size = bytes / Math.pow(k, i);

        // 5. 格式化小数
        // parseFloat 是为了去掉不必要的 .00 (例如 "10.00" -> 10)
        return parseFloat(size.toFixed(decimals)) + ' ' + sizes[i];
    };
    /**
     * 按 CreationTime 对文件记录数组排序
     * @param records 文件记录数组
     * @param isAscending 是否升序（默认 true，false 为降序）
     * @returns 排序后的新数组（不修改原数组）
     */
    //按时间排序
    const sortFileRecordsByCreationTime = (records: FileRecord[], isAscending: boolean = true)=>{
        // 复制数组避免修改原数据，然后排序
        return [...records].sort((a, b) => {
            // 将时间字符串转为 Date 对象
            const dateA = new Date(a.CreationTime);
            const dateB = new Date(b.CreationTime);

            // 处理无效时间的边界情况（比如时间格式错误）
            if (isNaN(dateA.getTime())) return isAscending ? 1 : -1;
            if (isNaN(dateB.getTime())) return isAscending ? -1 : 1;

            // 比较时间戳并根据升序/降序返回结果
            const timeDiff = dateA.getTime() - dateB.getTime();
            return isAscending ? timeDiff : -timeDiff;
        });
    }
    //取差集
    function getSymmetricDifference<T>(arrA: T[], arrB: T[]): T[] {
        const setA = new Set(arrA);
        const setB = new Set(arrB);
        const result: T[] = [];

        // 找出在 A 中但不在 B 中的元素
        for (const item of setA) {
            if (!setB.has(item)) {
                result.push(item);
            }
        }

        // 找出在 B 中但不在 A 中的元素
        for (const item of setB) {
            if (!setA.has(item)) {
                result.push(item);
            }
        }

        return result;
    }
    //支持的后缀
    const previewConfig = {
        // 图片类 -> 触发 imagePreview
        image: ['ico','png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'],

        // 文档类 -> 触发 docPreview (vue-office)
        doc: ['pdf', 'docx', 'xlsx','pptx'],

        // 文本类 -> 触发 textPreview (vue-codemirror 等)
        text: ['ini','txt', 'json', 'sql','md', 'yml', 'yaml', 'xml', 'log', 'csv', 'js', 'ts', 'vue', 'cs', 'css', 'html','java'],
        music: ['mp3', 'wav', 'flac', 'aac', 'ogg']
    };
    //检测后缀是否支持打开
    const checkFileExtension = (filename: string): boolean => {
        // 如果文件名为空或没有传入，直接返回 false
        if (!filename) return false;
        // 查找最后一个 '.' 的位置
        const lastDotIndex = filename.lastIndexOf('.');
        // 如果没有找到 '.'，或者是隐藏文件（如 ".gitignore" 以 '.' 开头且没有其他后缀），返回 false
        if (lastDotIndex === -1 || lastDotIndex === 0) {
            return false;
        }
        // 截取后缀名并转换为小写
        const extension = filename.substring(lastDotIndex + 1).toLowerCase();
        // 判断内部变量数组中是否包含该后缀
        return Object.values(previewConfig).flat().includes(extension);
    };
    //取后缀
    const getExtension = (filename: string): string => {
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    };
    return {DirRefreshTimestamp,TotalFileCount,PageSize,CurrentPageIndex,activeNavItem,customMenus,AiSearchFolderInfo,AiSearchFileInfo,previewConfig,getExtension,checkFileExtension,getPullPathToFolderId,rootFolder,setFolderRoot,currentFolder,selectedFolders,FilterFileInfo,FilterFolderInfo,formatFileSize,getFileTypeDetail,formatShortDate,getFileIconColor, getFileIconClass,selectedFiles, clearSelection ,currentPath,sci,setUserStorageCapacityInfo,FileMaxUploadSizeLimit,setUserDirectoryFileInfo,FolderInfo,FileInfo}
});
export default Home;