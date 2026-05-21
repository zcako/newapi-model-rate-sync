# NewAPI 多站点模型价格同步工具

这是一个面向 NewAPI 管理员的 Electron 桌面工具，用于集中管理多个 NewAPI 站点的模型价格，并将源站价格同步到一个或多个目标站点。

当前版本已从 Python GUI 重构为 Electron + React + TypeScript。Electron 主进程负责本地存储、NewAPI 管理接口调用和安全写入，渲染进程只负责界面展示和 IPC 调用。

## 功能特性

- 多站点管理：添加、编辑、测试 NewAPI 站点连接。
- 源站/目标站选择：选择一个源站，勾选多个目标站。
- 模型价格读取：从 NewAPI `/api/option/` 和渠道模型中读取站点模型及价格配置。
- 未设置价格筛选：快速查看启用但未配置价格的模型。
- 本地价格草稿：修改价格后先保存到本地缓存，不会立即写入远端。
- 同步预览：写入前展示 `CREATE`、`UPDATE`、`NO_CHANGE`、`SKIP`、`BLOCKED`。
- 多计费模式：
  - 按量计费：输入、输出、缓存读取、缓存创建价格。
  - 按次收费：每次调用固定价格。
  - 表达式/阶梯收费：写入 NewAPI `billing_setting.billing_mode` 和 `billing_setting.billing_expr`。
- 渠道模型同步：扫描渠道上游新模型，勾选后增量开启到本地渠道。
- 实时日志：测试连接、扫描、预览、执行同步都会写入底部日志。

## 安全策略

本工具默认采用保守写入策略：

- 禁止删除站点。
- 禁止删除渠道。
- 禁止删除渠道已有模型。
- 禁止清空渠道模型列表。
- 禁止把目标站已有有效价格同步成 `未设置价格`。
- 渠道同步只允许增量添加新模型，后端会拒绝 `resetAll: true`。
- 同步前必须生成预览，`BLOCKED` 项不会执行。

说明：NewAPI 的计费配置由多个 option map 组成。对同一个模型进行计费模式切换时，工具会清理该模型冲突的旧计费键，例如 `ModelPrice` 与 `ModelRatio` 不能同时作为有效模式存在。这个行为只作用于用户选中的模型，用于避免 NewAPI 计费冲突；不会删除未选模型、渠道模型或站点配置。

## NewAPI 接口依赖

工具使用 NewAPI 管理端接口：

- `GET /api/user/self`：测试认证和用户信息。
- `GET /api/option/`：读取模型价格配置。
- `PUT /api/option/`：写入模型价格配置。
- `GET /api/channel/?p=1&page_size=1000`：读取渠道列表。
- `GET /api/channel/:id`：读取单个渠道详情。
- `GET /api/channel/fetch_models/:id`：获取渠道上游模型列表。
- `PUT /api/channel/`：增量更新渠道 `models` 字段。

这些接口需要 NewAPI 管理权限。写入 `/api/option/` 通常需要 Root 权限。

## 计费规则

### 按量计费

界面填写真实美元价格，单位为 `$ / 1M tokens`：

- 输入价格
- 输出价格
- 缓存读取价格
- 缓存创建价格

写入 NewAPI 时转换为倍率：

```text
ModelRatio = 输入价格 / 2
CompletionRatio = 输出价格 / 输入价格
CacheRatio = 缓存读取价格 / 输入价格
CreateCacheRatio = 缓存创建价格 / 输入价格
```

示例：

```text
输入价格: $0.15 / 1M
输出价格: $0.60 / 1M
缓存读取: $0.075 / 1M
缓存创建: $0.15 / 1M

写入:
ModelRatio = 0.075
CompletionRatio = 4
CacheRatio = 0.5
CreateCacheRatio = 1
```

### 按次收费

界面填写每次调用价格：

```text
ModelPrice = 每次调用价格
```

切换为按次收费时，会移除同一模型在 `ModelRatio`、`CompletionRatio`、`CacheRatio`、`CreateCacheRatio` 中的冲突键。

### 表达式/阶梯收费

表达式/阶梯收费写入：

```text
billing_setting.billing_mode[model] = "tiered_expr"
billing_setting.billing_expr[model] = 表达式
```

示例：

```text
tier("base", p * 2.5 + c * 15 + cr * 0.25)
```

## 站点认证配置

工具支持两种认证方式。

### Access Token + New-Api-User

推荐方式。

需要填写：

- 站点名称
- NewAPI 地址
- Access Token
- New-Api-User 用户 ID

请求头：

```text
Authorization: Bearer <Access Token>
New-Api-User: <用户 ID>
```

注意：NewAPI 管理接口会校验 `New-Api-User`，只填 Token 不够。

### 用户名 + 密码

工具会调用 `/api/user/login` 获取会话 Cookie。

如果账号启用了 2FA，当前工具暂不支持密码方式完成二次验证，请改用 Access Token。

## 使用流程

1. 启动应用。
2. 在左侧添加 NewAPI 站点。
3. 测试站点连接。
4. 选择一个源站。
5. 等待模型价格加载完成。
6. 勾选需要同步的模型。
7. 如需修改价格，在右侧编辑器选择计费模式并保存到本地缓存。
8. 勾选目标站点。
9. 点击一键同步。
10. 在同步预览弹窗确认变更。
11. 执行同步。

## 渠道模型同步

渠道模型同步页面用于发现渠道上游新增模型：

1. 选择站点。
2. 选择渠道。
3. 点击扫描上游模型。
4. 勾选状态为“新模型”的项目。
5. 点击一键同步所选变更。

安全行为：

- 只会把新模型追加到渠道 `models` 列表。
- 上游已下线但本地仍存在的模型只提示，不会删除。
- 自动初始化价格开启时，如果源站有该模型价格，会复制价格；源站也未设置时保持未设置状态。

## 本地数据存储

站点配置、价格草稿和日志保存在 Electron 用户数据目录：

```text
%APPDATA%\newapi-sync-tool\newapi-sync-data.json
```

其中会包含站点 Token 或密码，请自行保护本机用户目录权限。

## 目录结构

```text
newapi-model-rate-sync/
  electron/
    main.ts                  # Electron 主进程与 IPC 注册
    preload.ts               # 安全暴露 window.electronAPI
    backend/
      newapi.ts              # NewAPI HTTP 客户端
      service.ts             # 后端业务服务
      store.ts               # 本地 JSON 存储
      pricing.ts             # 价格换算与同步计划
      channelSafety.ts       # 渠道模型只增不删保护
      types.ts               # 后端类型定义
  src/
    App.tsx                  # React 应用入口
    components/              # 页面和弹窗组件
    services/                # Renderer 调用 electronAPI 的封装
  tests/
    electron-backend/        # Electron 后端核心规则测试
    run-backend-tests.mjs    # 测试构建与运行脚本
  backend_integration.md     # 前后端 IPC 对接文档
  设计方案.md                 # Electron 前端设计方案
```

## 环境要求

- Windows 推荐
- Node.js 18 或更高版本
- NewAPI 站点管理员或 Root 权限

## 安装与运行

进入项目目录：

```powershell
cd "D:\ai\newapi多个站点模型价格一键同步工具\newapi-model-rate-sync"
```

安装依赖：

```powershell
npm install
```

开发模式启动前端：

```powershell
npm run dev
```

启动 Electron：

```powershell
npm run electron
```

构建：

```powershell
npm run build
```

## 测试

运行 Electron 后端核心规则测试：

```powershell
npm run test:backend
```

当前测试覆盖：

- NewAPI 价格倍率与真实 `$ / 1M tokens` 价格换算。
- 按量计费写入 `ModelRatio`、`CompletionRatio`、`CacheRatio`、`CreateCacheRatio`。
- 按次收费写入 `ModelPrice`。
- 计费模式切换时仅清理同一模型冲突计费键。
- `unset` 源价格不会清空目标站已有价格。
- 渠道模型同步只增不删，拒绝 `resetAll`。

## 打包说明

当前项目已具备 Electron 构建产物：

```powershell
npm run build
```

该命令会生成：

```text
dist/
dist-electron/
```

如果需要生成 Windows 安装包或便携版 exe，可后续接入 `electron-builder` 或 `electron-forge`。

## 注意事项

- 同步前建议先在 NewAPI 后台或数据库层面对重要配置做备份。
- 目标站连接失败时不要执行同步。
- `BLOCKED` 代表存在清空或高风险覆盖行为，工具会自动跳过。
- 密码登录不支持 2FA。
- 真实写入前请确认 Access Token 对应用户具备 NewAPI 管理权限。
