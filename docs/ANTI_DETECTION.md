# HappyRun 风控对策模块

## 概述

本文档基于对 Unirun APK (`com.tanma.unirun`) 的逆向分析，梳理服务端/客户端的检测机制，以及 HappyRun 在代码中实现的对抗措施。

---

## 一、校园跑

### 1.1 检测机制（逆向发现）

#### 客户端检测 (APK 内)

| 检测项 | APK 位置 | 逻辑 |
|--------|----------|------|
| GPS 精度过滤 | `RunningServiceImpl.getMostAccuracyLocation()` | `locationType==1 && gpsAccuracyStatus==1 && accuracy<=20m` 才算有效点 |
| 校区围栏 | `GaoDeMapUtils.isInSchoolArea()` | 80% 轨迹点必须在校区多边形内 |
| 距离计算 | `TrackUtils.getDistance()` | `AMapUtils.calculateLineDistance() × 1.3` 系数 |
| 轨迹有效性 | `RunningServiceImpl.onLocationSuccess()` | 1022 条指令，jadx 反编译失败，核心过滤 |
| 提交前校验 | `RunningPresenterImpl.checkRunRecord()` | 451 条指令，jadx 反编译失败，判定 valid/unvalid |
| 步数传感器 | `StepUtil` | 注册 TYPE_STEP_DETECTOR(18) + TYPE_STEP_COUNTER(19) |
| 定位模式 | `RunTrackManager` | 强制 `Device_Sensors`（纯 GPS，拒绝网络定位） |
| 声纹验证 | `VocalVerifyApi` + 讯飞 SDK | `openStatus="1"` 时需声纹验证（当前学校未开启） |

#### 服务端检测 (API 返回字段验证)

| 字段 | 含义 | 检测逻辑 |
|------|------|----------|
| `suspectedStatus:"1"` | 可疑标记 | **后置审核**：提交时返回"有效"，事后可能被改标（5/2、5/3 记录已被标记） |
| `rangeStatus:"1"` | 围栏异常 | 轨迹点超出校区范围 |
| `runSpeedWarn:"1"` | 超速警告 | 配速超过 `boyMaxSpeed(500)` |
| `runStatus:"6"` | 重复提交 | 当天已有有效记录 |
| `overSpeedWarn` | 超速文案 | "您的速度过快啦，疑似使用代步工具哟~" |
| `boyMaxSpeed/MinSpeed` | 配速限制 | 500/100（服务端配速单位 = `distance/time × 1.66`） |
| `startRun` 锁 | 状态锁定 | 调用 `v1/push/startRun` 后不提交，服务端锁定为"跑步中" |

### 1.2 我们的对抗措施

| 风险 | 对抗策略 | 代码位置 | 说明 |
|------|----------|----------|------|
| 配速异常 | 安全区间校验 | `anti-detection.js: calculateSafePace()` | 服务端配速 120-450 安全，180-300 最优，前端滑块实时反馈 |
| 围栏检测 | 全部点在多边形内生成 | `track-generator.js: pointInPolygon()` | 碰壁 U 形转弯，不瞬移 |
| 轨迹太均匀 | 随机时间间隔 | `track-generator.js: interval = 3 + random()*3` | 非固定 4s，stddev > 0.8s |
| 无停顿（机器特征） | 插入随机停顿 | `track-generator.js: pauseCount/pauseAtSeconds` | 1-3 次停顿，每次 5-15s |
| 速度恒定（机器特征） | 惯性速度模型 | `track-generator.js: currentSpeed += (target - current)*0.3` | 渐变加减速，变异系数 >0.1 |
| GPS 抖动不连续 | 自相关抖动 | `track-generator.js: jitter = prev*0.7 + new*0.3` | 连续噪声，非独立随机 |
| 提交时间=轨迹结束 | 提交缓冲 | `track-generator.js: buffer = 60+random(120)` | 轨迹结束比提交早 1-3 分钟 |
| 精度值单一 | 随机精度 | `track-generator.js: accuracy = 5-16` | 至少 4 种不同值 |
| startRun 触发锁 | 不调用 | `run.js` | 直接提交 `save/run/record/new`，绕过状态锁 |
| 设备指纹相同 | 随机设备 | `config.js: randomDevice()` | 5 品牌 × 25+ 机型 × 4 系统版本，每次登录随机 |
| 提交时段异常 | 安全时段检查 | `anti-detection.js: isInSafeRunWindow()` | 仅 6-8 / 17-21 点，亚洲/上海时区 |
| 提交频率异常 | 频率控制 | `anti-detection.js: shouldRunToday()` | 每周 3-4 次，15% 随机跳过 |
| 轨迹质量检测 | 自检评分 | `anti-detection.js: scoreTrack()` | 提交后显示风险分，检测 5 个维度 |
| 距离系数 | 匹配 1.3x | `track-generator.js: DISTANCE_FACTOR = 1.3` | 与 APK `TrackUtils.getDistance()` 一致 |

### 1.3 轨迹质量评分维度 (`scoreTrack`)

| 维度 | 扣分条件 | 分值 |
|------|----------|------|
| 时间间隔均匀度 | stddev < 0.5s 扣 30，< 1.0s 扣 10 | -10 ~ -30 |
| 停顿段 | 无任何 >8s 间隔 | -15 |
| 速度变异系数 | CV < 0.1 (过于恒速) | -20 |
| 精度值多样性 | 种类 < 4 | -10 |

---

## 二、俱乐部签到

### 2.1 检测机制（逆向发现）

#### 客户端检测 (APK SignInPresenterImpl.java)

| 检测项 | 实现 | 逻辑 |
|--------|------|------|
| GeoFence 围栏 | `GeoFenceClient` + `clockingRange` | 以活动坐标为圆心，`clockingRange` 为半径画圆 |
| 围栏判定 | `geoFence: boolean` | 进入=true，离开=false |
| 围栏外阻断 | `if (!geoFence)` 按钮变灰 | 显示"不在签到范围内"，禁止操作 |
| 坐标来源 | `currentLocation.getLatitude/getLongitude` | 取手机实时 GPS 定位 |
| 双模式 | `clubOrClass` 标志 | false=俱乐部(SignBody)，true=体育课(ClockingBody) |

#### 服务端检测 (API 行为验证)

| 检测项 | 证据 | 逻辑 |
|--------|------|------|
| 坐标校验 | SignBody 含 `latitude/longitude` | 服务端接收坐标，可能校验与活动地点的距离 |
| 时间窗口 | `getSignInTf` 活动外返回空 | 只有活动时段内才能签到 |
| 签退时限 | `signBackLimitTime` 字段 | 超过时限无法签退 |
| 状态机 | signStatus: 1→签到→2→签退→3 | 不可跳步，状态不对则拒绝 |
| 旷课累计 | `signStatus:"0"` 记录 | **已验证：连续 3 次旷课 → 禁止报名 2 天** |

### 2.2 我们的对抗措施

| 风险 | 对抗策略 | 代码位置 | 说明 |
|------|----------|----------|------|
| 坐标固定不变 | GPS 随机偏移 | `club.js: jitterCoordinate(lat, lng, 15)` | 每次签到/签退坐标 ±15m 偏移，在围栏半径内 |
| 精确踩点签到 | 签到延迟 | `anti-detection.js: getSignInDelay()` | 活动开始后随机 1-5 分钟 |
| 秒退 | 签退延迟 | `anti-detection.js: getSignBackDelay()` | 活动时长的 73%-95%，如 30min 活动 → 22-28min 后签退 |
| 活动时间外签到 | 时段检查 | `anti-detection.js: getClubSignAdvice()` | 前端实时提示是否在活动时间内 |
| 签到签退间隔太短 | 间隔检查 | `anti-detection.js: assessClubSignRisk()` | <5min 扣 40 分，<15min 扣 20 分 |
| 旷课惩罚 | 频率控制 | `anti-detection.js: shouldJoinClubToday()` | 报名了就要签到，跟踪每周参加次数 |
| 客户端围栏阻断 | 绕过客户端 | `club.js: signIn/signBack` 直接调 API | 不经过 GeoFenceClient，直接发请求 |
| 自动签退忘记 | 定时签退 | `page.js: handleTimedSign()` | 签到后自动倒计时 22-28min 签退 |

### 2.3 签到时序模型

```
活动 18:00-18:30（30分钟）

18:00           签到窗口开放（getSignInTf 开始返回数据）
18:01 ~ 18:04   ← 建议签到时刻（getSignInDelay: 1-5min 随机）
18:22 ~ 18:28   ← 建议签退时刻（getSignBackDelay: 73%-95%）
18:30           签退窗口关闭（signBackLimitTime 生效）
```

---

## 三、通用对抗措施

### 3.1 设备指纹随机化

| 维度 | 实现 | 代码 |
|------|------|------|
| 品牌 | Xiaomi/HUAWEI/OPPO/vivo/samsung 随机 | `config.js: randomDevice()` |
| 机型 | 每个品牌 4-6 款机型随机 | 同上 |
| 系统版本 | Android 10-14 随机 | 同上 |
| App 版本 | 1.8.0 ~ 1.9.0 随机 | 同上 |
| 会话一致性 | 同一次登录不变 | `auth.js: session.device` |

### 3.2 认证安全

| 措施 | 代码 | 说明 |
|------|------|------|
| 密码 MD5 | `auth.js: md5(password)` | 与 APK `MD5Digest.encodeByMD5()` 一致 |
| Cookie 仅存 token | `login/route.js` | 不存明文密码 |
| Token 续期恢复 | `session.js: loginByToken()` | 用 `v1/auth/query/token` 恢复会话 |
| Cookie 安全标志 | `HttpOnly;SameSite=Strict` | 防 XSS / CSRF |
| 签名算法 | `sign.js: computeSign()` | 还原 APK `MyInterceptor` 的 MD5 签名 |

### 3.3 请求签名算法（逆向还原）

```
1. 取 URL 查询参数，按 key 字母排序
2. 拼接: key1+value1+key2+value2+...
3. 追加 APPKEY + APPSECRET
4. 追加 POST body JSON 字符串
5. 检查是否含 空格/~/!/(/)/单引号
   - 有: 删除这些字符 → encodeURIComponent → MD5 大写 + "encodeutf8"
   - 无: 直接 MD5 大写
```

---

## 四、使用建议

| 场景 | 建议 | 原因 |
|------|------|------|
| 校园跑频率 | 每周 3-4 次，别每天跑 | 真人不可能天天跑，频率异常容易被标记 |
| 校园跑时段 | 早 6-8 点或晚 17-21 点 | 凌晨/深夜提交极不自然 |
| 校园跑距离 | 1.5-3km | 卡最低或最高限都可疑，中间段最安全 |
| 校园跑配速 | 5.5-7.5 min/km | 对应服务端配速 180-300，最优区间 |
| 俱乐部签退 | 签到后至少 20 分钟 | <5min 极易被判无效 |
| 俱乐部报名 | 报了就去签到 | 连续 3 次旷课 → 禁报 2 天（已实际触发） |
| 自定义路线 | 有条件就录一条真实路线复用 | 比随机游走轨迹真实得多 |
