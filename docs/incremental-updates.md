# 增量更新与发布

灵音从 v1.3.0 开始通过 GitHub Release 的签名清单获取更新，不需要部署自己的服务器。GitHub 下载速度仍受网络影响；增量包通过减少下载字节改善等待时间，不保证提高链路速度。

## 使用方式

- **首次升级到 v1.3.0**：旧版没有增量客户端，需要下载完整 APK，使用相同包名和正式签名覆盖安装，保留歌单、音源和设置。
- **界面更新**：下载发生变化的 HTML、JS、CSS、图片等资源，校验后点击「应用界面更新」。刷新界面，不安装 APK；原生音频服务继续播放。
- **原生更新**：优先下载与当前安装包完全匹配的差分包，在本地还原正式 APK，核验包名、版本、签名和完整哈希，再进入系统安装确认。差分只能减少下载量，仍需 Android 安装确认。
- **失败处理**：增量基准不匹配、补丁损坏或无法重建时改用完整包。中断后支持续传；服务器不支持续传时重新下载。取消系统安装不删除用户数据。

不同签名的调试版不能直接覆盖为正式版，应用会明确提示。不要通过卸载来解决签名不匹配。

## 数据与资源安全

首次启动将旧 `file:///android_asset/web/` 页面的 localStorage 完整备份到应用私有目录，然后逐键迁移至固定的 `https://appassets.androidplatform.net` 本地域，确认写入成功后才完成迁移。此域名的页面由 APK/本地已校验资源提供，不是远程网站。歌单、队列、收藏、音源脚本及设置使用原有数据键。

网页更新保存完整目标文件清单，每个文件校验大小和 SHA256；ZIP 禁止越界路径、重复文件、额外文件及缺失的变更文件。候选版本先写入独立目录，再原子切换。新页面未完成本地初始化时，下次启动回退前一版本。正常界面初始化不会等待音源联网。

清单使用正式发布证书对应的 RSA 私钥签名，客户端内置公钥验签，再信任清单中的哈希和版本。更新仅允许本仓库 GitHub Release 与官方资源重定向。私钥和密码不得进入仓库、APK 或 Release。

## 构建与发布工具

依赖 Node.js、JDK 17+、Android SDK。正式签名配置见 [发布签名说明](release-signing.md)。以下命令从仓库根目录运行，签名路径通过环境变量传入。

Gradle `preBuild` 自动生成 `app/src/main/assets/update-base.json`，与本次打包的网页字节保持一致。新原生版本应提高 Android `versionCode`；如内置网页版本已迭代，应同时使用 `-PauraWebVersion=N` 提高网页版本。

```powershell
$env:AURA_SIGNING_PROPERTIES = '外部目录/signing.properties'
./gradlew assembleRelease -PauraWebVersion=1
node scripts/updates/package.cjs --mode release --apk app/build/outputs/apk/release/app-release.apk --out artifacts/release-1.3.0 --properties $env:AURA_SIGNING_PROPERTIES --tag v1.3.0 --version 1.3.0 --code 14 --web-version 1 --native-min 14 --native-max 14 --notes docs/releases/v1.3.0.md
```

首次部署公钥时可执行 `--mode key --properties <路径>`，仅导出公钥和公开证书摘要。后续沿用当前固定签名，不要随意替换公钥。

后续原生发布加入 `--base-apk <上一版正式APK>` 生成差分包。补丁若不比完整 APK 小，则不进入清单。加入 `--base-web <上一版Release的web-base.json>` 生成网页增量 ZIP；未修改文件从已安装资源复用，删除文件由目标完整清单决定。

工具生成：

- `AuraMusic-<tag>.apk`、可选的 `*.auradelta`。
- `web-full-*.zip`、可选的 `web-<旧摘要>-<新摘要>.zip`。
- `update-manifest.json`：客户端读取的签名清单。
- `web-base.json`：下一次发布生成网页增量的基准元数据。
- `SHA256SUMS.txt`：公开校验值。
- `update-payload.json`：签名前的可读清单，供本地核对，无需上传。

将这些公开产物上传至对应 tag 的 **草稿 Release**，核对完整性后再设为最新正式版，避免客户端读到尚未上传完毕的资源。`update-manifest.json` 固定名称不能改。已发布版本资产应保持不可变。

## 仅发布界面更新

保留当前正式 APK（例如原生 code 14 / version 1.3.0），修改网页并测试。使用新 Release tag（例如 `v1.3.0-ui.2`），提高 `--web-version 2`，原生范围仍为 `14..14`，传入上一版 `web-base.json`：

```powershell
node scripts/updates/package.cjs --mode release --apk artifacts/release-1.3.0/AuraMusic-v1.3.0.apk --out artifacts/release-ui-2 --properties $env:AURA_SIGNING_PROPERTIES --tag v1.3.0-ui.2 --version 1.3.0 --code 14 --web-version 2 --native-min 14 --native-max 14 --base-web artifacts/release-1.3.0/web-base.json --notes docs/releases/ui-2.md
```

上传完整 APK 仍有必要：更旧的原生客户端需要先升级原生能力。已有 code 14 的客户端会选择网页更新。`--code` 和 `--version` 必须与提供的 APK 实际版本一致；`--native-min/max` 必须覆盖经过测试的原生接口范围，不能为了绕过兼容检查而随意扩大。更新 Android 服务、权限、通知、蓝牙或安装逻辑时必须发布新的 APK。

## 验证

`npm test` 覆盖网页迁移、浏览器启动、更新面板与发布工具。`./gradlew :app:testDebugUnitTest lintRelease assembleRelease` 覆盖签名清单、下载续传规则、差分还原、资源落盘、回滚及 Android 构建。

发布前还应核验最终 APK 的签名和版本，使用生成的签名清单与资源包做跨语言互通检查，并在 Android 设备上检查覆盖安装和系统确认。差分格式及限制见 [差分格式文档](updates-delta-format.md)。
