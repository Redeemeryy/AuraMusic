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
  - 使用标准 MediaSession / MediaStyle 系统媒体控制；**vivo 原子岛仍待验证，不保证显示**。
  - 系统级通知栏自适应着色控制中心、双向收藏状态实时同步与锁屏控制无缝流转。

- 📝 **动感歌词与云村高赞热评**
  - 支持双模式自由切换：唱片旋律视图 / 沉浸式逐行歌词视图。
  - 拖拽歌词进度预览并支持点按秒级定向快进播放。
  - 聚合精选热评生态，听歌看评两不误。

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

当前改版预发布为 [v1.2.0-beta.2](https://github.com/Redeemeryy/AuraMusic/releases/tag/v1.2.0-beta.2)，使用固定发布签名及正式包名。与调试签名「灵音预览」数据独立；安装方式见[发布说明](docs/releases/v1.2.0-beta.2.md)，构建配置与密钥备份见[发布签名说明](docs/release-signing.md)。

界面样式和图标已随 APK 打包，运行时不再依赖 Tailwind CDN 或 Google Fonts。
修改 `assets/web` 中 HTML/JS 类名后，先运行 `npm ci`、`npm run build:web`，再构建 APK。
`npm test` 检查偏好数据行为；`npm run test:ui` 使用本机 Chrome 检查离线页面、五种窗口尺寸和设置持久化。

Windows 中文目录可以使用 `-Pandroid.overridePathCheck=true` 进行构建。
`-PauraPreview=true` 生成包名为 `com.auramusic.app.preview` 的「灵音预览」，与正式应用共存、数据独立。
覆盖升级必须使用同一签名；beta.2 开始采用新的固定发布密钥，不要为了安装新包直接卸载已有测试应用。

本次改版的原子岛仍需 OriginOS 真机验收。已移除不符合 vivo 文档类型的猜测通知载荷；
标准媒体通知正常，不等于系统一定显示原子岛。详见 `docs/verification-2026-10-25.md`。

### 环境要求
- **Android SDK**: Compile SDK 34, Min SDK 26 (Android 8.0+)
- **JDK**: OpenJDK 17 或 21
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
