<p align="center">
  <img src="app/src/main/assets/web/logo.png" width="128" height="128" alt="AuraMusic Logo" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);" />
</p>

<h1 align="center">AuraMusic • 灵音</h1>

<p align="center">
  <strong>流光溢彩的高保真开源 Android 音乐播放器</strong><br>
  Liquid Glass 风格界面 • Hi-Res 音质支持 • 音源插件扩展 • 系统媒体控制
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%208.0+-3DDC84?style=flat-square&logo=android&logoColor=white" alt="Platform">
  <img src="https://img.shields.io/badge/Language-Kotlin%20%7C%20JavaScript-7F52FF?style=flat-square&logo=kotlin&logoColor=white" alt="Language">
  <img src="https://img.shields.io/badge/Engine-AndroidX%20Media3%20ExoPlayer-0078D7?style=flat-square" alt="Engine">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License">
</p>

---

## 🌟 核心特性 (Features)

- 💎 **液态果冻玻璃美学 (Liquid Glass Aesthetic)**
  - 深度融合 iOS 级弥散光斑、高斯模糊微折射特效与果冻按压缩放动效。
  - 沉浸式 3D 拟真黑胶唱片旋转与流体律动背景，下滑手势丝滑收起播放详情页。

- 🎧 **Hi-Res 母带与无损音质智能阶梯降级**
  - 支持 **Hi-Res 母带 (24Bit/96kHz+)**、**FLAC CD级无损**、**320K 超高品质** 以及 **128K 标准音质**。
  - 业界级智能降级算法：当首选音质为母带，而当前曲目仅包含无损或高清时，自动顺位匹配最高可用档位平滑播放，杜绝弹窗打扰与播放中断。
  - 实时音质切换抽屉，动态标注曲目实际音质支持状态。

- 🔌 **全网多音源插件生态兼容**
  - 全面支持 **CeruMusic 插件规范** 与 **洛雪 (LX Music) 自定义音源脚本**。
  - 支持本地脚本文件一键载入、网络直链下载导入、插件状态检测与一键跳转热更新。

- 🏝️ **OriginOS 深度整合与系统级流转**
  - 使用标准 MediaSession / MediaStyle 系统媒体控制。v1.2.0 恢复历史包名后，已在 vivo X200 Pro mini / OriginOS 6 验证原子岛显示及基础播控；其他设备、ROM 与组件版本仍需实测。
  - 当前包名与椒盐音乐冲突，不能同时安装；详见[兼容性说明](docs/originos-compatibility.md)。
  - 系统级通知栏自适应着色控制中心、双向收藏状态实时同步与锁屏控制无缝流转。

- 📝 **动感歌词与云村高赞热评**
  - 支持双模式自由切换：唱片旋律视图 / 沉浸式逐行歌词视图。
  - 拖拽歌词进度预览并支持点按秒级定向快进播放。
  - 聚合精选热评生态，听歌看评两不误。
  - 可在设置中开启蓝牙歌词，以当前歌词更新车机的曲名信息；原生服务在后台与息屏时持续同步，具体兼容范围见[蓝牙歌词说明](docs/bluetooth-lyrics.md)。

- 🚗 **车载中控大屏与横屏全场景深度适配 (Car & Landscape Mode)**
  - 侧边专属车载导航胶囊，充分释放中控宽屏浏览视野；
  - 全屏播放器**左右双分栏沉浸视效**：左侧拟真 3D 黑胶自转与流体光晕，右侧实时动感滚动歌词与行车级大触控按键；
  - 针对手机横屏、车机中控大屏（16:9 / 21:9 带鱼屏）、平板全面优化触控靶区与多列自适应栅格；
  - 声明车机免摄像头/电话硬件依赖，支持 Android 8.0+ 各类车载系统即装即用。

- 🎯 **个性化专属推荐 (Daily Radar)**
  - 基于本地红心收藏与听歌历史，自动计算歌手与风格权重，每日精准生成 30 首心动私人推荐歌单。

---

## 🛠️ 技术栈 (Tech Stack)

| 模块 | 技术方案 |
| :--- | :--- |
| **应用架构** | 原生 Android (Kotlin) + 极速现代 Webview Hybrid |
| **音频引擎** | AndroidX Media3 (ExoPlayer) + OkHttp 底层流直连 |
| **后台服务** | Foreground MediaService + MediaSessionCompat 流转控制 |
| **界面风格** | Tailwind CSS + Liquid Glass Design + Material Symbols |
| **插件运行时** | 沙箱化 JavaScript 引擎 + 原生多线程异步网络代理 |

---

## 📦 项目编译 (Building from Source)

### 本地界面开发（Liquid Glass 改版）

当前正式版为 [v1.3.0](https://github.com/Redeemeryy/AuraMusic/releases/tag/v1.3.0)，桌面名称为「灵音」，使用固定发布签名及历史包名 `com.salt.music`。本次新增界面资源更新和 APK 差分更新，见[发布说明](docs/releases/v1.3.0.md)与[增量更新说明](docs/incremental-updates.md)。安装和数据迁移注意事项见 [v1.2.0 说明](docs/releases/v1.2.0.md)，密钥配置见[发布签名说明](docs/release-signing.md)。

界面样式和图标已随 APK 打包，运行时不再依赖 Tailwind CDN 或 Google Fonts。
修改 `assets/web` 中 HTML/JS 类名后，先运行 `npm ci`、`npm run build:web`，再构建 APK。
`npm test` 检查偏好数据行为；`npm run test:ui` 使用本机 Chrome 检查离线页面、五种窗口尺寸和设置持久化。

Windows 中文目录可以使用 `-Pandroid.overridePathCheck=true` 进行构建。
`-PauraPreview=true` 生成包名为 `com.salt.music.preview` 的「灵音预览」，与正式应用共存、数据独立。此前版本的 `com.auramusic.app` / `.preview` 也保留各自的数据，不会自动迁移到新包。
覆盖升级必须包名和签名都一致。beta.2 开始采用固定发布密钥；同包名的 debug 测试版无法直接覆盖为正式签名版，不要为了安装而直接卸载已有测试应用。

OriginOS 的音乐岛包含系统侧包名筛选。标准媒体通知和服务连接正常不等于获得岛显示资格；本次仅报告已验证机型的显示与基础播控，未宣称所有厂商歌词、收藏或歌单扩展均完整支持。详见[兼容性说明](docs/originos-compatibility.md)。

### 环境要求
- **Android SDK**: Compile SDK 34, Min SDK 26 (Android 8.0+)
- **JDK**: OpenJDK 17 或 21
- **Node.js**: 用于生成网页资源校验清单及发布增量包
- **Gradle**: 8.7+ (已内置 Gradle Wrapper)

### 命令行编译

1. **克隆代码仓库**
   ```bash
   git clone git@github.com:<your-username>/AuraMusic.git
   cd AuraMusic
   ```

2. **构建 Debug APK**
   ```bash
   ./gradlew assembleDebug
   ```

3. **构建 Release APK**
   ```bash
   ./gradlew assembleRelease
   ```
   *生成的安装包位于 `app/build/outputs/apk/` 目录下。*

---

## 📄 开源许可证 (License)

本项目采用 [MIT License](LICENSE) 授权许可，欢迎提交 Issue 与 Pull Request 共同完善！
