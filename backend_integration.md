# NewAPI 多站点模型价格同步工具 - 后端对接与开发文档 (GPT-5.5 专用)

本页面提供前端与 Electron 主进程之间的 IPC 通讯协议（API 合约）规范，以供 GPT-5.5 快速实现 Electron 主进程（`electron/main.ts`）的真实后端逻辑、数据库存储（如 SQLite/LokiJS）以及与 NewAPI 实体的 HTTP 接口对接。

---

## 架构概述

本应用基于 Electron 架构开发：
1. **渲染进程 (Renderer Process)**：使用 React + TypeScript，通过全局属性 `window.electronAPI` 异步调用底层接口。
2. **预加载脚本 (Preload Script)**：定义在 `electron/preload.ts` 中，使用 `contextBridge.exposeInMainWorld` 将 IPC 通信封装为安全的 Promise 接口。
3. **主进程 (Main Process)**：运行于 Node.js 环境，需要使用 `ipcMain.handle` 注册对应的通道监听器，实现数据持久化（推荐 SQLite 或本地 JSON 文件）并代理发送与 NewAPI 各站点的 HTTP 请求。

---

## 一、 IPC 通道接口定义

### 1. 站点管理相关 (`sites:*`)

#### 1.1 获取站点列表 (`sites:list`)
* **IPC 通道名**：`sites:list`
* **前端调用**：`window.electronAPI.listSites()`
* **返回数据格式**：`Promise<Site[]>`
  ```typescript
  interface Site {
    id: string;
    name: string;
    url: string;                  // NewAPI 站点 Base URL，例如 https://api.your-newapi.com
    status: 'connected' | 'failed' | 'connecting' | 'untested';
    auth_type?: 'admin' | 'user'; // 鉴权类型，默认 'admin'
    auth_method?: 'access_token' | 'password';
    token?: string;               // NewAPI 管理员或用户的 API Key / Access Token
    user_id?: string;
    username?: string;
    password?: string;
    lastSync?: string;            // 最后同步时间，格式：YYYY-MM-DD HH:mm:ss
  }
  ```

#### 1.2 添加站点 (`sites:add`)
* **IPC 通道名**：`sites:add`
* **前端调用**：`window.electronAPI.addSite(siteData: Omit<Site, 'id' | 'status'>)`
* **输入参数**：
  * `siteData`: 包含 `name`, `url`, `auth_method`, `token` (或 `username`/`password`) 等字段。
* **返回数据格式**：`Promise<Site>`
  * 返回成功保存并分配了唯一 `id` 的 `Site` 对象，初始 `status` 为 `'untested'`。

#### 1.3 编辑站点 (`sites:edit`)
* **IPC 通道名**：`sites:edit`
* **前端调用**：`window.electronAPI.editSite(siteId: string, siteData: Partial<Site>)`
* **输入参数**：
  * `siteId`: 目标站点唯一 ID。
  * `siteData`: 需要更新的站点字段。
* **返回数据格式**：`Promise<boolean>` (成功返回 `true`，失败返回 `false`)

#### 1.4 测试站点连接性 (`sites:test`)
* **IPC 通道名**：`sites:test`
* **前端调用**：`window.electronAPI.testSite(siteId: string)`
* **后端职责**：
  1. 读取对应站点的 `url` 和凭证 (`token` 或 `username`/`password`)。
  2. 向 NewAPI 的探活或鉴权接口（例如：获取当前用户信息接口 `GET /api/user/self`）发送 HTTP 请求。
  3. 若请求返回 200 且校验通过，将站点数据库中的状态更新为 `'connected'`，否则更新为 `'failed'`。
  4. 主进程应通过 `log-message` 通道向前端推送对应的测试日志。
* **返回数据格式**：`Promise<{ success: boolean; status: 'connected' | 'failed'; message: string }>`
  * 示例：`{ success: true, status: 'connected', message: '连接成功，检测到 25 个已启用模型。' }`

---

### 2. 模型与价格管理相关 (`models:*`, `pricing:*`)

#### 2.1 加载站点模型价格列表 (`models:load`)
* **IPC 通道名**：`models:load`
* **前端调用**：`window.electronAPI.loadSiteModels(siteId: string)`
* **后端职责**：
  * 请求该 NewAPI 站点的全局模型和价格配置接口。在 NewAPI (One API 衍生项目) 中，模型倍率和计费模式通常通过 `GET /api/option` (获取系统设置) 或模型列表接口获取。
  * 将其转换为前端期望的 `ModelPricing` 格式数组。
* **返回数据格式**：`Promise<ModelPricing[]>`
  ```typescript
  interface ModelPricing {
    id: string;               // 模型唯一标识（通常可与 name 一致）
    name: string;             // 模型名称，例如 gpt-4o, claude-3-5-sonnet
    billing_mode: 'unset' | 'quota' | 'times' | 'expr' | 'tiers'; 
                              // 计费模式：未设置、额度/倍率计费、按次、表达式计费、阶梯计费
    input_price: number;      // 输入价格/倍率 (每百万/每千 token 额度)
    output_price: number;     // 输出价格/倍率
    cache_read_price: number; // 缓存读取价格/倍率 (如支持)
    cache_create_price: number;// 缓存写入价格/倍率
    times_price: number;      // 按次计费单价
    expression: string;       // 计费表达式 (选填)
    tiers?: PricingTier[];    // 阶梯计费详情 (选填)
    status: 'synced' | 'modified' | 'new' | 'error'; // 同步状态
    lastUpdate: string;       // 最后更新时间显示，例如 "15:28" 或 "2026-05-21 15:28"
  }
  ```

#### 2.2 本地临时修改价格 (`pricing:updateLocal`)
* **IPC 通道名**：`pricing:updateLocal`
* **前端调用**：`window.electronAPI.updateModelPricingLocal(siteId: string, modelName: string, pricingData: LocalPricingData)`
* **后端职责**：
  * 将站点 `siteId` 下模型 `modelName` 的本地价格草稿保存到缓存或本地数据库中（标记 `status = 'modified'`），暂不提交到远端 NewAPI 站点。
* **输入参数 `pricingData` 结构**：
  ```typescript
  interface LocalPricingData {
    billing_mode: 'unset' | 'quota' | 'times' | 'expr';
    input_price: number;
    output_price: number;
    cache_read_price: number;
    cache_create_price: number;
    times_price: number;
    expression: string;
    tiers: Array<{ range_start: number; range_end: number; price: number }>;
  }
  ```
* **返回数据格式**：`Promise<boolean>`

---

### 3. 多站价格同步核心 (`pricing:*`)

#### 3.1 生成同步预览方案 (`pricing:previewSync`)
* **IPC 通道名**：`pricing:previewSync`
* **前端调用**：`window.electronAPI.previewSync(sourceSiteId: string, targetSiteIds: string[], modelNames: string[], pricingPayload?: LocalPricingData)`
* **后端职责**：
  1. 获取源站 `sourceSiteId` 下选中的 `modelNames` 模型的价格规则（若传入了 `pricingPayload` 则优先使用该覆盖规则）。
  2. 获取每个目标站点 `targetSiteIds` 对应模型现有的价格规则。
  3. 比对两端的价格差异，生成同步预览方案计划表返回给前端展示。
  4. 保护策略：如果源站模型价格为 `'unset'` (未设置)，且目标站存在有效价格，应标记 `action = 'BLOCKED'`，保护目标站已有价格不被置为空。
* **返回数据格式**：`Promise<SyncPlanItem[]>`
  ```typescript
  interface SyncPlanItem {
    source_site_id: string;
    target_site_id: string;
    model_name: string;
    source_price_summary: string; // 源端价格摘要字符串（由 getSummary 生成）
    target_price_summary: string; // 目标端当前价格摘要字符串
    action: 'CREATE' | 'UPDATE' | 'NO_CHANGE' | 'SKIP' | 'BLOCKED';
    status: string;               // 状态说明文字，例如："待同步"、"无变化"、"被保护: 禁止将价格设为未设置"
    error_message?: string;
  }
  ```

#### 3.2 执行多站价格同步 (`pricing:executeSync`)
* **IPC 通道名**：`pricing:executeSync`
* **前端调用**：`window.electronAPI.executeSync(syncPlan: SyncPlanItem[])`
* **后端职责**：
  1. 遍历执行预览中生成的 `syncPlan`，过滤掉 `NO_CHANGE` 和 `BLOCKED` 项。
  2. 对每个待同步的 `target_site_id` + `model_name`，调用目标站 NewAPI 接口或直接修改目标站 NewAPI 数据库，写入新的倍率和价格参数。
  3. 通过 `log-message` 实时向前端渲染进程推送同步过程的进度日志。
* **返回数据格式**：`Promise<SyncResult>`
  ```typescript
  interface SyncResult {
    success: boolean;
    success_count: number;
    fail_count: number;
    logs: string[]; // 同步执行产生的详细日志数组
  }
  ```

---

### 4. 渠道模型自同步管理 (`channels:*`)

#### 4.1 获取站点的渠道列表 (`channels:list`)
* **IPC 通道名**：`channels:list`
* **前端调用**：`window.electronAPI.listChannels(siteId: string)`
* **后端职责**：
  * 请求对应站点的 NewAPI 管理端渠道接口：`GET /api/channel`（通常为管理员权限）。
  * 解析返回的渠道信息，转换为前端格式返回。
* **返回数据格式**：`Promise<Channel[]>`
  ```typescript
  interface Channel {
    id: string;              // 渠道在 NewAPI 中的唯一 ID
    name: string;            // 渠道名称
    type: string;            // 渠道模型源类型，例如 "openai", "anthropic", "custom" 等
    base_url: string;        // 渠道代理请求的 Base URL
    models: string[];        // 当前渠道已启用的模型列表（从 NewAPI 渠道模型的 String 字段分割，如 "gpt-4o,gpt-4-turbo"）
    upstream_models: string[]; // 该渠道上游支持的完整模型列表（可通过各大模型官方接口获得，或后端内置常见上游支持列表）
  }
  ```

#### 4.2 扫描渠道上游模型列表 (`channels:scanUpstream`)
* **IPC 通道名**：`channels:scanUpstream`
* **前端调用**：`window.electronAPI.scanChannelUpstreamModels(siteId: string, channelId: string)`
* **后端职责**：
  1. 获取该渠道的上游节点支持列表。例如如果是 OpenAI 官方通道，可通过发送 `GET /v1/models` (带上该渠道的 Key) 获取上游最新真实模型列表。如果是其他中转站，同样可以通过其 `models` 接口查询。
  2. 比对该渠道本地已经开启的模型列表（`channel.models`）与上游真实支持列表（`upstream_models`）。
  3. 返回包含各模型比对状态的结果数组给前端。
* **返回数据格式**：`Promise<ScannedModel[]>`
  ```typescript
  interface ScannedModel {
    name: string;
    upstream_supported: boolean; // 上游是否支持
    local_enabled: boolean;      // 本地是否已经启用
    status: 'new' | 'exists' | 'removed'; // new: 上游新增，exists: 已存在且启用，removed: 上游已下线但本地仍启用
  }
  ```

#### 4.3 渠道模型对齐同步 (`channels:sync`)
* **IPC 通道名**：`channels:sync`
* **前端调用**：`window.electronAPI.syncChannelModels(siteId: string, channelId: string, models: string[], options: { autoAddPricing: boolean; resetAll: boolean; sourceSiteId?: string })`
* **输入参数**：
  * `siteId`: 目标站点。
  * `channelId`: 目标渠道 ID。
  * `models`: 用户选中的需要开启或对齐的模型名称数组。
  * `options`:
    * `resetAll`: 若为 `true`，代表完全重置，将渠道的模型列表完全替换成上游列表；若为 `false`，代表增量合并。
    * `autoAddPricing`: 若为 `true`，同步渠道模型成功后，对**新增开启的且在站点中还没有价格配置的模型**自动创建价格条目。
    * `sourceSiteId`: 发生价格初始化时的“源站点 ID”。如果存在此字段且非空，后端应当从该源站读取对应模型的价格配置，直接同步复制到目标站；如果源站也没有或者未传，则默认将价格设为 `'unset'`。
* **后端职责**：
  1. 请求该站点的 NewAPI 修改渠道接口（通常为 `PUT /api/channel`），修改该渠道的 `models` 字符串。
  2. 若 `autoAddPricing` 为真，则在目标站点的模型价格库中进行比对，为新开启的模型自动建立定价条目（复制源站价格或置为 `unset`）。
  3. 实时输出同步日志并保存。
* **返回数据格式**：`Promise<{ success: boolean; logs: string[] }>`

---

### 5. 系统运行日志服务 (`logs:*`)

#### 5.1 获取历史运行日志 (`logs:get`)
* **IPC 通道名**：`logs:get`
* **前端调用**：`window.electronAPI.getSyncLogs()`
* **返回数据格式**：`Promise<string[]>`

#### 5.2 实时日志推流 (`log-message` 主动推送)
* **后端职责**：
  * 主进程在执行同步、测试、扫描等操作时，调用：
    `win.webContents.send('log-message', '[INFO] 同步执行中...')`
  * 前端将自动通过回调方法监听该事件，并追加到前端的日志控制台控制面板中。

---

## 二、 NewAPI 真实 API 对接指导指南

GPT-5.5 在实现主进程逻辑时，需要编写一个 `NewAPIService` 与目标 NewAPI 站点通信。

### 1. 常用管理 API 终结点 (Endpoint)

NewAPI 使用管理员权限的 Token (通常在 HTTP 请求头中添加 `Authorization: Bearer <Admin_Token>`) 访问以下接口：

* **1. 获取所有渠道**：
  * 请求：`GET /api/channel/?page=1&pagesize=100` (需要带管理员 Header)
  * 返回：包含 `data` 列表的 JSON，单项包含 `id`, `name`, `type`, `models` (以逗号分隔的字符串，如 `"gpt-4,gpt-4o"`), `base_url`。
* **2. 修改渠道模型**：
  * 请求：`PUT /api/channel`
  * Body (JSON)：传入完整的渠道对象，重点修改 `models` 属性（把 models 数组重新组合为逗号分隔的字符串）。
* **3. 获取模型倍率与价格**：
  * NewAPI 中模型的输入输出价格是用**模型倍率 (Model Ratio)** 配合**系统基础倍率 (Group Ratio)** 进行计算的。
  * 获取全局配置：`GET /api/option` (需要管理员凭证)
  * 返回的数据中包含以下关键字段：
    * `ModelRatio`：模型倍率字典（JSON 字符串），如 `{"gpt-4": 15, "gpt-4o-mini": 0.15}`。
    * `ModelPrice`：按次计费模型单价字典（JSON 字符串），如 `{"dall-e-3": 0.08}`。
* **4. 更新全局模型倍率/按次价格**：
  * 请求：`PUT /api/option` (需要管理员凭证)
  * Body (JSON)：
    ```json
    {
      "key": "ModelRatio",
      "value": "{\"gpt-4\":15,\"gpt-4o-mini\":0.15}"
    }
    ```
    或更新按次计费价格：
    ```json
    {
      "key": "ModelPrice",
      "value": "{\"dall-e-3\":0.08}"
    }
    ```

### 2. 计费模式映射建议

在 NewAPI 侧，前端的 `billing_mode` 应做如下映射：
* `'quota'` (额度/倍率计费)：对应将模型配置写入系统的 `ModelRatio` (模型倍率)。同时在 `ModelPrice` (按次价格) 字典中移除该模型。
* `'times'` (按次计费)：对应将模型配置写入系统 `ModelPrice` 字典。并在 `ModelRatio` 字典中移除该模型或设为倍率 0。
* `'unset'` (未设置价格)：在 NewAPI 侧，如果 `ModelRatio` 和 `ModelPrice` 都没有此模型的 key，NewAPI 会默认使用 `DefaultModelRatio` 或者禁止调用。
* `'expr'`/`'tiers'`：高级计费表达式和阶梯配置在原生 NewAPI 中可能不支持，后端可以采取以下两种策略之一：
  1. 将其转换为最接近的固定倍率写入 NewAPI，并在本工具本地数据库中存储高级表达式作为备份。
  2. 仅支持 NewAPI 原生的 `quota` 与 `times` 模式，对不支持的模式向前端抛出 Error。
