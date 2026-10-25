# Android 发布签名

从 v1.2.0-beta.2 起，正式包名 `com.auramusic.app` 使用固定发布密钥。
私钥和密码保存在仓库外，禁止提交 Git 或上传为 Release 附件。

## 本机构建

默认读取仓库同级的 `signing/AuraMusic/signing.properties`。
其他电脑或 CI 可通过环境变量 `AURA_SIGNING_PROPERTIES` 指定外部配置文件。
配置包含 `storeFile`、`storePassword`、`keyAlias`、`keyPassword` 四项；路径使用正斜杠。

运行 `npm ci`、`npm run build:web` 后执行 `./gradlew assembleRelease`。
Windows 中文目录增加 `-Pandroid.overridePathCheck=true`。
产物为 `app/build/outputs/apk/release/app-release.apk`。
缺少签名配置时发布包构建会失败；开发仍可使用 `assembleDebug`。

## 备份与升级

- 将签名目录中的私钥文件、配置文件及公开证书作为一组保存至另一处安全介质。
- 配置文件包含密码，备份应加密保存；不要放入公开仓库或普通分享链接。
- 今后发布必须使用同一私钥，版本号及 versionCode 递增。
- 公开证书可以分享以核验发行者；它不能用于签署应用。
- 新密钥无法覆盖使用其他密钥签名的旧本地测试包。独立包名的「灵音预览」可以保留，两者数据独立。
