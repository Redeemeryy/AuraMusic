<p align="center">
  <img src="art/logo.png" width="128" height="128" alt="AuraMusic Logo" style="border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);" />
</p>

<h1 align="center">AuraMusic • 灵音</h1>

<p align="center">
  <strong>流光溢彩的高保真开源 Android 音乐播放器</strong><br>
  Liquid Glass 美学设计 • Hi-Res 母带级音质 • 全网音源插件扩展 • 深度适配 vivo 原子岛
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
  - 专属适配 **vivo OriginOS 4 / OriginOS 5 原子岛 (Origin Island)** 音乐微胶囊与展开态交互。
  - 系统级通知栏自适应着色控制中心、双向收藏状态实时同步与锁屏控制无缝流转。

- 📝 **动感歌词与云村高赞热评**
  - 支持双模式自由切换：唱片旋律视图 / 沉浸式逐行歌词视图。
  - 拖拽歌词进度预览并支持点按秒级定向快进播放。
  - 聚合精选热评生态，听歌看评两不误。

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
