# 蓝牙歌词

在 **设置 → 系统播放 → 蓝牙歌词** 开启，手机连接蓝牙车机并播放带同步歌词的歌曲。默认关闭。打开后，当前歌词显示在支持动态媒体信息刷新的设备的曲名位置；暂停、关闭开关、歌词空白或当前歌曲无歌词时恢复歌曲信息。

## 实现方式

参考 [LX Music Mobile 的实时蓝牙歌词入口](https://github.com/lyswhut/lx-music-mobile/blob/fb8480728d875fa5e0da25eebd3a26bb71723aae/src/core/init/player/lyric.ts)，在灵音现有 MediaSession 中独立实现：

- `android.media.metadata.TITLE` 为当前歌词，`ARTIST` 为“歌曲名 - 歌手”。关闭时恢复原始歌名、歌手。
- `DISPLAY_TITLE` 仍为歌曲名，通知标题也保留歌曲名。蓝牙媒体转换会优先读取明确的 `TITLE/ARTIST`，见 [AOSP Metadata](https://android.googlesource.com/platform/packages/modules/Bluetooth/+/d59ed44eef154262bc6851523e472e1c64185c9e/android/app/src/com/android/bluetooth/audio_util/helpers/Metadata.java)。
- 页面解析完整歌词时间轴，一次交给原生播放服务。服务依据 ExoPlayer 的实际进度同步，息屏与退到后台后继续工作；只有歌词或播放状态变化时才发布新元数据。
- 切歌使用独立标识拒绝迟到的歌词；拖动进度立即重新定位；切换音质保留时间轴。空白时间戳和具有结束时间的歌词允许间奏恢复歌曲名。

本功能使用标准系统媒体会话，不需要扫描蓝牙设备或新增蓝牙权限。不发送伪装为其他音乐应用的广播，未引入 LX 播放器代码或依赖。

## 兼容范围

这不是独立的蓝牙歌词协议。车机、音箱等设备需要显示并刷新 AVRCP 媒体信息；只在切歌时读取一次曲名的设备可能不会逐句更新。Android 锁屏或其他读取标准曲名的系统界面也可能显示当前歌词，关闭开关即可恢复。

长安 2023 款糯玉米 205 尚未完成实车验证，不能仅凭手机元数据正常便认定车机已显示歌词。实测时选择有同步歌词的歌曲，开启此开关后观察车机歌曲信息，并检查暂停、继续、切歌、拖动进度和手机锁屏后的显示。

LX 另有完整 LRC 输出（`android.media.metadata.LYRICS`）和固定提前量；这些不是标准 AVRCP 必需字段，本次未加入。
