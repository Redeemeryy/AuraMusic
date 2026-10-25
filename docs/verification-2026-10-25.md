# 2026-10-25 改版验证记录

分支 feat/liquid-glass，基线 24218dd。以下按开发阶段记录，最新安装及发布验证见文末。

## 实现

- 中性内容层、玻璃导航/迷你播放器/弹层，减少逐项模糊与彩色阴影；保留唱片与歌词。
- 本地编译 Tailwind 和本地 Material Symbols（许可证随包），离线保持布局/图标。
- 原生安全区归零修复，键盘避让，短屏滚动、横屏 48px 主控制、歌单操作换行。
- 真实播放模式/减少动效/降低透明度设置、通知设置入口与诊断、清历史确认。
- 统一播放模式入口，修复队列调用不存在函数的问题；保留用户历史键与音源协议。
- 通知不再等待封面下载，过期封面结果不会覆盖切歌/停止后的状态；补充超时与流关闭。
- 删除非法的字符串 superx template 和猜测的原子岛载荷，恢复标准 MediaStyle 路径。此项不能替代原子岛验收。

## 验证证据

- Node 偏好行为测试 5 项通过：损坏回退、持久化、类型过滤、清历史边界、存储不可用。
- Chrome 离线交互检查：320×640、347×754、393×852、800×360、1024×768，通过页面切换、无水平溢出、偏好重载、底部更新按钮可访问。
- 顶部安全区回归先复现 38px 无法归零，再修复通过。
- 347×754 与 800×360 全屏播放器截图已检查。独立审阅额外检查 320×480、640×320、740×320，小窗口允许纵向滚动。
- npm audit：0 漏洞（开发依赖）；JS 语法检查通过。
- Android 预览 APK 构建成功；Lint 初次发现 13 个错误，集中在原有主题 API 27 属性和 Media3 opt-in 声明，已修复并复检成功（仍有既有警告，见构建报告）。

## 真机已实测与未决

设备 V2419A / Android 16，用户确认 X200 Pro mini / OriginOS 6，屏幕 1216×2640 / density 560。
原版 1.1.6 播放时前台服务、MediaSession PLAYING、媒体令牌和通知权限均正常。
SystemUI 将该通知归入 VivoNormalNotifCoordinator；无足够证据确认系统不显示原子岛的最终原因。

包名曾从 com.salt.music 改为 com.auramusic.app，这是识别机制调查线索，不是已证明的根因。
系统字段 island_music_card_show=0 的语义未确认，未擅自修改。
vivo 官方文档要求 notification.superx.template 是整数、岛数据使用 notification.superx.island；原实现不符。
原子通知准入与音乐媒体胶囊不能混为一谈。仍需用户在真机验证原子岛和交互，不宣称已恢复。

原安装包与本机 debug 签名不同，用户不掌握原签名位置。生成独立预览包以保留正式应用数据。
自动安装/启动操作被工具策略拒绝（blocked by policy），没有重试绕过；预览包尚未自动安装。
因此尚未测得新界面的真机帧率、键盘避让和原子岛实际显示效果，不能宣称 60/120 FPS 或完全复制 Apple 原生渲染。

## 来源

- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- https://dev.vivo.com.cn/documentCenter/doc/896
- https://dev.vivo.com.cn/documentCenter/doc/894

## 推荐页与浅色图标（第三版预览）
- 推荐页改为真实封面主卡、简洁歌曲列表、横滑歌单和热门歌曲，保留原导航及播放器样式。
- 新增 discover.css 与 tests/discover.cjs；移除推荐列表未经验证的 FLAC 标记。横屏旧 align-items/gap 样式泄漏已覆盖。
- imagegen 生成浅色玻璃音符图标，原图 design/app-icon-light.png；已导出五档 Android launcher 尺寸及网页 logo/favicon。
- npm test：5/5 通过；npm run test:ui：五种尺寸通过；npm run test:discover：320x640、347x754、800x360 缓存推荐、无音源隐藏、详情跳转和溢出检查通过。
- assembleDebug -PauraPreview=true 成功。产物 artifacts/AuraMusic-preview-discover-v3.apk。尚未在真机安装本次 APK；测试截图使用模拟数据，真实音源加载及滚动手感需真机确认。

## 真机安装验收
- vivo X200 Pro mini / V2419A 已 adb install -r 覆盖安装成功；应用内浅色图标、新推荐页、原聆澜音源配置均确认保留。
- 实测 3 首精选、6 个歌单、5 首热门加载；推荐页 clientWidth/scrollWidth 均 347；歌单横滑 scrollLeft=638.57；每日歌单详情可开关；切歌响应。
- 发现并修复原生播放位置缓存不持续更新，导致进度和歌词停在 00:00。MusicService 主线程每250ms刷新缓存，服务销毁时随 scope 取消。
- 修复版 assembleDebug + lintDebug 通过并再次覆盖安装。实测播放位置4657ms ->7160ms、界面00:04 ->00:07；暂停后位置保持稳定。测试结束暂停播放并返回推荐页。

## 第四版玻璃控件补齐
- 替换播放模式原生 select 为应用内 dialog 玻璃面板，支持选中状态、持久化同步、关闭/遮罩/Escape 与减少动效。
- 播放器底部三按钮、推荐歌曲右侧播放图标、歌单操作按钮统一玻璃材质。
- 专属算法移入歌单元信息，操作栏三列布局；320/347/800尺寸新增按钮及来源标记边界断言通过；五尺寸 UI 回归通过。
- v4 APK 已覆盖安装成功。真机选择面板 backdrop blur24px、宽323.43px；专属算法右边界188.22px小于347px视口；播放器底部按钮 blur12px，截图已核对。
- 截图 artifacts/device-v4-mode.png、device-v4-detail.png、device-v4-player.png；产物 artifacts/AuraMusic-preview-glass-v4.apk。

## 第五版按压动画
- interaction-motion.js 委托处理按钮/歌曲行：按钮按住scale0.90，释放360ms轻微回弹；歌曲行幅度0.975；指针移动超过10px取消，兼容动态内容、键盘触发和减少动效。
- 新增 tests/motion.cjs，验证按住、松开、动画清理及减少动效；五尺寸 UI 回归通过，assembleDebug通过。
- artifacts/AuraMusic-preview-motion-v5.apk 已覆盖安装到真机；WebView 实测held=0.9，释放过渡后scale恢复none；另外一次点击采样scale=1.02469，确认回弹生效。

## v1.2.0-beta.1 发布检查
- versionCode=9，包名com.auramusic.app.preview，标签灵音预览；apksigner验证成功，使用本机Android Debug签名。
- 偏好5项、motion、discover与五尺寸UI通过；发布前独立审查发现播放模式dialog遗漏Android返回处理，已修复并添加回归断言。
- assembleDebug/lintDebug通过。APK SHA256: 70c917aeea90eb3f276afaa9751adc0b37a9123da0d3768bfa8f9034615a0d17。
- 以预发布方式发布，不替代稳定版；原签名缺失与原子岛限制在发布说明中明确列出。
