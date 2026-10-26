# 无服务器增量更新实施计划

> **For agentic workers:** Use subagent-driven-development; steps are tracked below.

**Goal:** GitHub Release 托管签名更新清单、网页增量包和 APK 差分包，保留本地数据并提供应用内下载与更新流程。

**Architecture:** 发布端生成带 RSA SHA256 签名的清单；客户端先验证清单，再下载/校验/重建。网页采用完整文件清单和增量 ZIP，固定 HTTPS 本地域加载，首次迁移原 file origin 的 localStorage。APK 使用受限 COPY/INSERT 差分格式，重建字节必须与正式签名 APK 完全相同，失败回退完整 APK。

**Tech Stack:** Kotlin/JVM、Android PackageInstaller、WebViewAssetLoader、OkHttp、Node.js 发布工具；不增加后端服务。

**Spec:** 用户已批准本对话中“GitHub 托管、网页热更新、APK 差分、进度/校验/回滚和数据保留”的完整方案。

## Global Constraints

- 发布版 v1.3.0 / versionCode 14，applicationId com.salt.music，沿用现有正式签名。
- 更新公钥为正式签名证书的 RSA 公钥；私钥只留外部 signing 目录。清单信封 `{payload:base64(raw UTF8 JSON),signature:base64(SHA256withRSA(payload bytes))}`。
- 清单 URL `https://github.com/Redeemeryy/AuraMusic/releases/latest/download/update-manifest.json`；仅 HTTPS GitHub Release 及其官方资源重定向，拒绝回滚/错误包名/超大文件。
- 不清除应用数据；旧 localStorage 完整备份并逐键迁移确认后才标记完成。网络或校验失败继续旧版。
- 首次升级仍须完整安装本版，旧版没有差分客户端。以后同包名同签名覆盖升级；不能承诺厂商免确认。
- 不暂存已有 7 个私人调查 docs，不上传签名私钥/密码/手机备份。

## Shared interfaces

清单 payload：`{schema:1,packageName,releaseVersion,notes,apk,web}`。

`apk={versionCode,versionName,url,size,sha256,certificateSha256,patches:[{fromSha256,url,size,sha256,format:"aura-copy-v1"}]}`。

`web={versionCode,minNativeVersionCode,maxNativeVersionCode,filesHash,files:[{path,size,sha256}],full:{url,size,sha256},patches:[{fromFilesHash,url,size,sha256}]}`。

文件列表按 path 排序、字段顺序 path/size/sha256，`filesHash=SHA256(UTF8(JSON.stringify(files)))`。初始网页 versionCode=1，原生兼容范围 14..14。APK 中 `assets/update-base.json` 保存 web 元数据（无下载地址），网页文件位于 `assets/web`。网页包是正常 ZIP，完整包含全部文件，增量包仅变化文件；发布及校验对象均是未压缩文件字节。

原生包 `com.jelly.audio.updates`：
- `BinaryDelta.apply(base:File,patch:File,output:File)`；格式由 delta 实现者固定并记录，客户端限流和边界校验。
- `WebContentStore(context)`：`currentVersion():Int`, `currentFilesHash():String`, `stage(web:JSONObject,archive:File)`, `prepareLaunch()`, `markHealthy()`, `open(path:String):InputStream?`。stage 创建待启用版本；prepareLaunch 切换候选并记录尝试，未健康确认的下次启动恢复上个版本。
- `NativeUpdater(activity:MainActivity,store:WebContentStore)`，作为 JS 对象 `AuraUpdater`；`@JavascriptInterface getState():String, check(), start(), cancel(), install(), applyWebUpdate()`；`onResume()`, `close()`。后台状态变化调用 `window.onAuraUpdateState(JSON)`（主线程）。state 为 `{status,kind?,version?,message?,downloaded?,total?,canRetry?}`；status: idle/checking/available/downloading/verifying/patching/ready_web/ready_apk/installing/current/error/cancelled；kind:web/apk。
- MainActivity 公共 `reloadUpdatedWebContent()` 供 NativeUpdater 调用，负责 prepareLaunch 并加载固定本地 HTTPS URL。
- 网页迁移单独 `AuraStorage` bridge 与 `update-bootstrap.js`，由 WebContentStore 实现者负责；app.js 起始检查 `window.AuraStorageMigrationPending`，结尾成功初始化调用 `AuraStorage.markHealthy()`。
- 公钥 `assets/update-public-key.der` 为 X509 SPKI DER。

## Review Focus

- 清单伪造、补丁基准错误/截断/越界、ZIP 路径穿越/缺文件均必须拒绝，不能执行损坏资源或安装未经验证 APK。
- 进程死亡/取消/下载中断，旧版可用，重试可续传或安全重下；篡改缓存不得被复用。
- file→HTTPS 存储迁移中途失败/配额不足不能把空数据当成功；备份保持可恢复。
- 旧网页与新原生接口不兼容时必须选择 APK，且热更新不打断正在播放的音频。
- 旧 debug 签名或不同 APK 基准不能错误套用差分或导致用户卸载丢数据。

## Tasks

- [x] 1. 差分引擎：先写 Kotlin/Node 边界测试并观察失败；实现 COPY/INSERT 生成和流式还原；在 1.2.0→1.2.1 上实际生成、比对 SHA256 和体积。
- [x] 2. 网页存储：先测路径/哈希/增量复用/回滚；实现双版本资源目录、完整数据迁移、固定 HTTPS AssetLoader 和 MainActivity 接线。
- [x] 3. 原生更新：先测签名/版本/选择/下载恢复；实现签名清单校验、下载进度、差分与完整回退、PackageInstaller 与权限接续。
- [x] 4. 发布与界面：生成公钥/基准元数据、签名清单/ZIP/差分脚本；接入玻璃更新面板和进度/重试/安装/重载交互；补充浏览器测试。
- [x] 5. 集成：完整单元/浏览器/构建检查，独立代码审查；真实基准补丁重建和发布工具/客户端互通验证。

## Execution notes

- 原有页面为本地资产 URL，不能依靠拦截 android_asset 路径实现覆盖，因此采用固定 HTTPS 本地域并显式迁移存储。
- COPY/INSERT 差分只优化传输，避免新增各 CPU 架构 native 库；基准和目标均使用完整 SHA256，包名/证书另验证。尺寸效果以实际生成结果报告。
- 当前使用 feat/incremental-updates 分支隔离提交；原主分支与已有用户文件保留。用户已授权推送与发布，无需重复确认。
- 验证结果：46 项 Node/Chrome 测试、46 项 JVM 测试全部通过；assembleDebug、assembleRelease、lintRelease 成功。独立审查发现的返回旧存储、慢音源误回滚、重试和取消残留等问题已修复，无剩余 P1/P2。
- 实际 1.2.0→1.2.1 APK 补丁 2,221,216 字节，完整包 11,191,544 字节，减少 80.15%；Kotlin 还原后完整 SHA256 一致。该数据为历史包验证，不承诺所有版本相同比例。
- 用最终网页基准和正式签名生成测试界面版本 2：增量 ZIP 15,443 字节，完整 ZIP 4,192,114 字节。Kotlin 验签、基准比对、增量/完整解包、健康确认和失败回滚均通过。测试资源不发布。
- 设备限制：此次没有连接真机，本机 AVD 缺失系统镜像，Android 系统安装权限、确认和进程恢复尚未进行设备验收；不报告为真机通过。
- 发布顺序：提交后重建正式 APK，生成公开更新资源，推送 main/tag；上传草稿 Release 并核验资产后设为最新正式版，再从公开 URL 读取验签。首次升级须完整 APK，未来版本按发布文档生成增量。
