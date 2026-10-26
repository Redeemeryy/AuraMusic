# aura-copy-v1 APK 差分格式

该格式只压缩传输字节，不修改 APK 的 ZIP 内容或签名。还原结果必须逐字节对应正式签名 APK。发布端为 `scripts/updates/delta.cjs`，Android/JVM 还原端为 `BinaryDelta.apply(base, patch, output)`；两端均不依赖新增原生库。

## 文件布局

文件由 100 字节明文头部和一个 gzip 成员组成。头部所有整数采用大端无符号表示；实现拒绝最高位为 1 的 64 位整数，以及超过下述限额的值。

| 偏移 | 字节数 | 内容 |
| --- | --- | --- |
| 0 | 8 | ASCII `AURACPY1` |
| 8 | 8 | 基准 APK 字节数 |
| 16 | 8 | 目标 APK 字节数 |
| 24 | 32 | 基准 APK SHA256，原始摘要字节 |
| 56 | 32 | 目标 APK SHA256，原始摘要字节 |
| 88 | 4 | 命令数量 |
| 92 | 8 | gzip 成员的完整字节数，含 gzip 头及尾部 |
| 100 | 变长 | gzip 压缩的命令流 |

gzip 必须使用 DEFLATE，`FLG=0`，固定 10 字节 gzip 头，不带文件名、注释、附加字段或头校验和。时间戳、XFL 和 OS 不影响还原。标准 gzip 尾部 CRC32 和 ISIZE 为小端，必须匹配。只接受一个完整成员，拒绝附加成员、DEFLATE 结束后的额外字节和文件末尾的额外数据。

## 解压后的命令

| 操作码 | 内容 | 含义 |
| --- | --- | --- |
| `0x01` | 基准偏移 u64BE，长度 u64BE | 从基准 APK 对应范围 COPY 到输出末尾 |
| `0x02` | 长度 u64BE，随后紧接该长度的原始字节 | INSERT 到输出末尾 |

长度必须大于 0。COPY 可重复使用、重排基准文件范围；每条 COPY 都必须完全位于基准文件内。每条命令追加的字节不能超出目标剩余长度。准确读取头部声明数量的命令后，解压流必须立即结束，且输出长度和目标 SHA256 必须匹配。空目标使用 0 条命令和正常的空 gzip 成员。

## 限额与错误行为

- 基准和目标分别最多 256 MiB；整个补丁最多 272 MiB。
- 最多 1,000,000 条命令，且命令数不能超过目标字节数。
- 解压命令流最多 `targetSize + 17 * commandCount` 字节；实际命令边界仍按上面的严格规则验证。
- 所有偏移和长度先验证非负，再用减法检查范围，避免加法溢出。
- 基准 SHA256 在读取命令前验证，目标 SHA256 在完成还原后验证；gzip CRC32 和 ISIZE 也必须通过。
- JVM 端以 64 KiB 缓冲流式解压、复制和计算摘要。线程中断抛出 `InterruptedIOException`。
- JVM 端先写同目录随机临时文件，完成全部验证并同步后原子替换输出。失败抛出 `IOException`，清理本次临时文件并保留已有输出。输出不能与任一输入为同一路径或解析到同一符号链接目标。
- 清单签名、补丁文件 SHA256、APK 包名、版本和签名证书由更新器另行验证；该格式本身不提供清单认证。

## 生成器接口与算法

```javascript
const { createDelta } = require('./scripts/updates/delta.cjs');
const result = await createDelta(basePath, targetPath, patchPath);
// result: {format, baseSha256, targetSha256, patchSha256, sha256, size, commandCount}
// format 为 aura-copy-v1；patchSha256 与 sha256 相同，摘要均为小写十六进制。
```

函数返回 Promise，完成压缩和输出发布后才 resolve；文件索引与匹配部分在调用进程内同步执行。调用者应在发布流程或后台任务使用，不要放入交互主线程。输出目录必须已存在。

基准每 4096 字节建立弱校验索引，目标按字节滚动查找，候选块逐字节确认后延长为 COPY；未匹配区间生成 INSERT。每个弱校验桶最多保留 8 个基准偏移，碰撞只会降低压缩率，不会改变输出字节。每个输入只缓存两个 1 MiB 页面；命令落到临时磁盘文件后流式 gzip 压缩。完成时再次核对输入摘要，拒绝生成期间发生变化的输入。

```powershell
node scripts/updates/delta.cjs --base old.apk --target new.apk --out update.delta
node --test tests/updates-delta.test.cjs
.\gradlew.bat testDebugUnitTest --tests com.jelly.audio.updates.BinaryDeltaTest
```

发布器应在补丁不小于完整目标 APK 时跳过补丁，并一直提供完整 APK 回退。

## 已验证的实际基准

2026-10-26 使用仓库已有正式 APK，由 Node 生成补丁，再通过真实 JVM `BinaryDelta.apply` 还原：

| 项目 | 结果 |
| --- | --- |
| 基准 | v1.2.0，11,181,825 字节 |
| 目标 | v1.2.1，11,191,544 字节 |
| 补丁 | 2,221,216 字节，17 条命令 |
| 传输减少 | 约 80.15% |
| 基准 SHA256 | `b888177049c5a78869873ff62635449a162a66f26d3fed8d48314f9c36935b5b` |
| 目标与还原 SHA256 | `37433edb5ce9c70f20e836238044e19777ff703ac0c9064c4cceae7a5c6e70c0` |
| 补丁 SHA256 | `05ced845e837634bbd413bf6afde58767af8be120021173ec7fc66350c03b782` |

验证产物位于被 Git 忽略的 `artifacts/update-delta-validation/`。可将 `AURA_DELTA_BASE`、`AURA_DELTA_TARGET`、`AURA_DELTA_PATCH`、`AURA_DELTA_OUTPUT` 设置为绝对路径后运行上述 JVM 测试，执行跨语言集成用例。该比例仅代表这一对 APK，其他版本需实测。
