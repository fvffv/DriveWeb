# DriveWeb · 网盘网页客户端

DriveWeb 是配套 [DriveApi](https://github.com/fvffv/DriveApi) 使用的网盘网页客户端，基于 Vue 3、TypeScript 和 Vite 构建。通过浏览器即可管理文件、上传下载、在线预览、分享文件，并使用语义搜索和智能助手。

前端负责交互与展示；账户验证、文件存储、数据库、邮件和 AI 服务由 DriveApi 提供。部署前需要准备可访问的服务端。

[前端源码](https://github.com/fvffv/DriveWeb) · [服务端部署说明](https://github.com/fvffv/DriveApi#readme) · [服务端与模型下载](https://github.com/fvffv/DriveApi/releases)

## 功能介绍

| 功能 | 说明 |
| --- | --- |
| 账户管理 | 登录、邮箱验证码注册、头像与账户设置、修改密码。 |
| 文件管理 | 浏览目录、创建文件夹、选择文件、移动、重命名、删除和下载。 |
| 文件上传 | 点击或拖拽上传，计算文件 Hash，配合服务端进行去重和分片上传，展示上传进度。 |
| 文件预览 | 图片、文本与代码、音频，以及 DOCX、Excel、PDF、PPTX 文档预览。具体兼容性取决于文件格式与浏览器。 |
| 文件分享 | 创建和管理分享，设置有效期与提取码，复制链接、显示二维码，通过分享页访问文件。 |
| 搜索与视图 | 搜索网盘文件，使用分类、自定义筛选视图以及服务端提供的语义搜索。 |
| 智能助手 | 对话式交互与流式回复，调用服务端配置的大模型服务。 |
| 数据统计 | 查看个人网盘统计；管理员可查看平台数据、用户、文件、日志和系统配置。 |
| 个性化设置 | 明暗主题、账户偏好以及 WebDAV 访问开关等设置。 |

分片上传会查询服务端已有分片并跳过已完成部分；能否续传取决于服务端是否仍保留上传任务及分片，不代表关闭浏览器后能自动恢复所有上传任务。

## 技术栈

- Vue 3 + TypeScript：页面和组件。
- Vite 7：开发服务器与生产构建。
- Vue Router：页面路由，使用 HTML5 History 模式。
- Pinia：共享状态管理。
- Element Plus + Sass：界面组件与样式。
- Axios：API 请求与登录令牌传递。
- ECharts：统计图表。
- Monaco Editor：文本与代码展示。
- Vue Office：文档预览。
- hash-wasm：文件 Hash 计算。

依赖及命令以 [package.json](package.json) 为准，具体安装版本由 [package-lock.json](package-lock.json) 锁定。

## 快速开始

### 1. 准备环境

安装 Node.js 和 npm。当前锁定的 Vite 版本要求 Node.js **`^20.19.0 || >=22.12.0`**，例如可以使用符合条件的 Node.js 22 或 24。

同时启动 DriveApi，并确认数据库与邮件配置正确。默认开发配置连接 `http://127.0.0.1:5085`。

### 2. 安装依赖

```bash
git clone https://github.com/fvffv/DriveWeb.git
cd DriveWeb
npm ci
```

已有源码时直接进入项目目录执行 `npm ci`。该命令按照锁文件安装依赖；日常修改依赖时再使用 `npm install`，并同步维护锁文件。

### 3. 启动开发服务器

```bash
npm run dev
```

打开终端显示的地址，通常为 `http://localhost:5173`。Vite 的开发端口与 DriveApi 的 API 端口是两个不同的端口。

需要从局域网中的其他设备访问开发页面时：

```bash
npm run dev -- --host 0.0.0.0
```

此时还要将开发环境的 API 和资源地址改成其他设备能够访问的服务器 IP。浏览器中的 `127.0.0.1` 指向浏览器所在设备，不一定是运行后端的机器。

## 环境配置

开发环境使用 [.env.development](.env.development)，生产构建使用 [.env.production](.env.production)。也可以在本地创建 `.env.development.local` 或 `.env.production.local` 覆盖对应值，这两类本地文件已由 `.gitignore` 忽略。

### 开发环境

```dotenv
VITE_APP_TITLE='网盘客户端'
VITE_APP_BASE_API='http://127.0.0.1:5085/api'
VITE_APP_ASSETS_API='http://127.0.0.1:5085/driveassets'
```

| 配置项 | 用途 |
| --- | --- |
| `VITE_APP_BASE_API` | 服务端 API 基础地址，包含末尾的 `/api`，例如 `https://drive.example.com/api`。 |
| `VITE_APP_ASSETS_API` | 头像、缩略图等服务端资源的基础地址，包含 `/driveassets`。 |
| `VITE_APP_TITLE` | 环境文件中保留的标题配置；当前页面标题主要由路由及页面代码设置，仅修改此值不会自动修改所有页面标题。 |

地址末尾不要额外加 `/`，代码会继续拼接具体接口或资源路径。当前 Vite 配置没有设置 API 代理，开发环境会直接访问配置的后端地址，跨域访问需要服务端允许前端来源。

### 生产环境：与 API 同源部署

仓库默认的生产配置适用于前端和 API 共用域名、端口的情况：

```dotenv
VITE_APP_TITLE='网盘客户端'
VITE_APP_BASE_API='/api'
VITE_APP_ASSETS_API='/driveassets'
```

例如在 `https://drive.example.com` 打开网页，请求会发送到 `https://drive.example.com/api/...`，头像和缩略图从 `https://drive.example.com/driveassets/...` 加载。

### 生产环境：前后端分开部署

将两个地址改成浏览器可以访问的 API 服务域名：

```dotenv
VITE_APP_TITLE='网盘客户端'
VITE_APP_BASE_API='https://api.example.com/api'
VITE_APP_ASSETS_API='https://api.example.com/driveassets'
```

后端需要允许前端域名跨域访问，并允许使用 `Authorization` 请求头。网页使用 HTTPS 时，API 和资源地址也应使用 HTTPS，避免浏览器阻止混合内容请求。

**环境变量在构建时写入前端产物。** 修改生产环境文件后必须重新执行 `npm run build` 并部署新的 `dist`；只在服务器上修改 `.env.production` 不会改变已经构建好的网页。

不要在 `VITE_*` 变量中填写数据库密码、SMTP 授权码或 AI API 密钥，这些内容会暴露给浏览器。相关密钥应配置在 DriveApi 的 `appsettings.json` 中。

## 编译与部署

### 构建生产版本

```bash
npm run build
```

默认生成 `dist` 目录：

```text
dist/
├── index.html
├── assets/
├── monaco-editor/
└── …
```

其中 `public` 下的资源会随构建复制到输出目录。请保留完整构建产物，尤其是 `monaco-editor`，文本预览需要加载 `/monaco-editor/min/vs` 下的编辑器资源。

本地检查构建后的网页：

```bash
npm run preview
```

该命令仅用于预览静态产物，不会启动 DriveApi，也不是生产服务。生产配置使用 `/api` 时，单独运行预览服务器并不会自动代理后端，需要配套代理或使用可访问的绝对 API 地址。

### 方式一：放入 DriveApi 的 wwwroot

这是默认生产配置对应的部署方式，无需另外启动 Node.js 网页服务。

1. 使用 `/api` 和 `/driveassets` 的同源生产配置构建。
2. 将 `dist` **里面的全部内容**复制到 DriveApi 程序同目录的 `wwwroot`。
3. 启动 DriveApi，访问其对外地址，例如 `http://服务器IP:5085`。

部署后的目录结构：

```text
DriveApi程序目录/
├── driveApi                 # Windows 下为 driveApi.exe
├── appsettings.json
├── EmailCodeTemplate.html
├── Onnx/
└── wwwroot/
    ├── index.html
    ├── assets/
    └── monaco-editor/
```

不要放成 `wwwroot/dist/index.html`。DriveApi 已提供静态文件服务和前端页面回退，根地址会跳转到 `/home`，未登录时前端会跳转到登录页。

更新网页时保留服务端生成的 `wwwroot/driveassets`，不要连同头像和缩略图一起删除。

### 方式二：独立静态站点

也可以使用 Nginx 等静态 Web 服务器托管 `dist`。需要同时满足：

- 配置正确的生产 API、资源地址，或为同源 `/api` 和 `/driveassets` 设置到 DriveApi 的反向代理。
- 未对应实际静态文件的页面路径回退到 `index.html`，包括 `/home`、`/login`、`/share/...`。
- `/api` 和 `/driveassets` 请求走后端，不能误回退成 `index.html`。
- 代理上传请求时，设置符合业务需要的请求体大小限制和超时时间；代理智能助手的流式回复时避免响应缓冲。

当前前端按域名根路径部署，Monaco 资源地址也使用根路径。放入 `/drive/` 等子路径需要同时调整 Vite base、路由和硬编码的资源路径，不建议只移动目录。

## 服务端需要准备什么

前端不连接数据库，也不直接运行 ONNX 模型。以下内容均在 DriveApi 配置：

| 配置 | 说明 |
| --- | --- |
| `DbConfig` | 推荐 PostgreSQL：`DbType: 4`；也支持 SQLite：`DbType: 2`。填写相应的 `ConnectionString`。 |
| `EmailConfig` | **必须正确配置才能发送注册验证码、完成正常注册。** |
| `AIConfig.ApiKey` | 智能助手的大模型密钥；需要助手时同时填写匹配的 `BaseURL` 和 `Model`。 |
| `AIConfig.Enable` 与 `Onnx` | 图片、文档语义搜索使用服务端本地 ONNX 模型，不需要联网调用外部 AI 模型 API；需准备模型和数据库向量支持。 |

ONNX 模型请到 [DriveApi Releases](https://github.com/fvffv/DriveApi/releases) 单独下载，放在 **DriveApi 程序同目录的 `Onnx`**，不要放进本前端项目的 `public`、`dist` 或服务端的 `wwwroot`。

Ubuntu 上安装 PostgreSQL 与 pgvector 可使用服务端提供的 [数据库安装脚本](https://github.com/fvffv/DriveApi/blob/main/install_postgresql_pgvector_ubuntu.sh)。连接字符串、模型目录结构和注册系统服务的方法见 [DriveApi README](https://github.com/fvffv/DriveApi#readme)。

## 使用方法

1. 打开网页，在登录页面切换到注册，填写账户信息并获取邮箱验证码；已有账户直接登录。
2. 在网盘首页进入目录，通过上传面板添加文件，或使用文件操作菜单管理内容。
3. 打开支持的文件类型进行预览；预览前可能需要下载文件，较大的文件会有等待时间。
4. 使用搜索栏查找文件；语义搜索依赖服务端完成模型初始化和后台向量生成。
5. 为文件创建分享，设置有效期、提取码等信息，将生成的链接或二维码发送给接收者。
6. 在设置中修改头像、密码和账户偏好；具备管理员权限的账户可使用管理功能。

## 常见问题

**页面打开了，但无法登录或提示网络错误？**

检查 DriveApi 是否启动，以及 `VITE_APP_BASE_API` 是否包含 `/api`。在浏览器开发者工具的 Network 面板查看实际请求地址、状态码和返回内容；同时确认端口、防火墙、HTTPS 与跨域配置。

**注册收不到验证码？**

检查服务端 `EmailConfig`、SMTP 授权码、网络连通性和日志，并检查邮箱垃圾箱。该功能依赖后端邮件服务，不是前端邮箱配置。

**刷新 /home 或打开分享链接出现 404？**

项目使用 History 路由。独立托管时需要配置页面回退到 `index.html`；挂载在 DriveApi 时，检查 `wwwroot/index.html` 是否存在、静态文件路径是否正确。

**头像、缩略图无法显示？**

检查 `VITE_APP_ASSETS_API`，它与 API 地址不是同一个路径。确认后端的 `/driveassets` 可以访问，并且没有在更新前端时删除服务端生成的资源。

**文本预览打不开或编辑器一直加载？**

检查完整的 `dist/monaco-editor` 是否已部署，以及 `/monaco-editor/min/vs/loader.js` 是否能返回 JavaScript，而不是页面回退产生的 HTML。

**修改了 API 地址，但网页仍请求旧地址？**

重新构建并部署整个 `dist`，然后检查浏览器缓存和反向代理缓存。开发模式修改环境配置后需要重启 Vite。

**本地预览正常，但语义搜索或助手不可用？**

两者需要不同的后端配置：语义搜索检查 ONNX 模型、向量扩展和处理任务；智能助手检查大模型 API 地址、密钥、模型名称与网络连接。

## 项目结构

```text
DriveWeb/
├── public/                  # 构建时复制的静态资源，包含 Monaco 编辑器
├── src/
│   ├── assets/              # 页面使用的图片等资源
│   ├── commands/            # API 请求封装
│   ├── components/home/     # 文件管理、预览、上传、分享、助手与管理组件
│   ├── models/              # TypeScript 数据类型
│   ├── router/              # 页面路由与登录校验
│   ├── store/               # Pinia 状态管理
│   ├── styles/              # 全局样式
│   ├── views/               # 首页、登录、网盘与分享页面
│   ├── App.vue
│   └── main.ts
├── .env.development
├── .env.production
├── package.json
├── package-lock.json
└── vite.config.ts
```

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按锁文件安装依赖。 |
| `npm run dev` | 启动开发服务器。 |
| `npm run build` | 生成生产构建产物。 |
| `npm run preview` | 在本地预览构建产物。 |

当前 `build` 脚本执行 `vite build`，不包含独立的 TypeScript 类型检查或自动化测试。

## 许可证

项目使用 [MIT License](LICENSE)。第三方依赖遵循各自的许可证。
