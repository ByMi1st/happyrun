# HappyRun 风控对策模块 (Anti-Detection)

## 概述

本模块提供策略层逻辑，降低自动化行为被服务端检测的风险。
覆盖两个场景：校园跑 和 俱乐部签到。

---

## 一、校园跑风控

### 逆向分析发现

#### 客户端层 (APK)

| 文件 | 机制 | 说明 |
|------|------|------|
| `RunningServiceImpl.onLocationSuccess()` | 轨迹有效性判断 | 1022条指令，jadx反编译失败，核心过滤逻辑 |
| `RunningPresenterImpl.checkRunRecord()` | 提交前校验 | 451条指令，jadx反编译失败，决定是否valid/unvalid |
| `RunningServiceImpl.getMostAccuracyLocation()` | 精度过滤 | `locationType==1 && gpsAccuracyStatus==1 && accuracy<=20m` |
| `GaoDeMapUtils.isInSchoolArea()` | 围栏检测 | 80%轨迹点在校区多边形内即通过 |
| `TrackUtils.getDistance()` | 距离计算 | `AMapUtils.calculateLineDistance() * 1.3` 系数 |
| `StepUtil` | 步数验证 | 注册 TYPE_STEP_DETECTOR(18) 和 TYPE_STEP_COUNTER(19) 传感器 |
| `RunTrackManager` | 定位模式 | `AMapLocationMode.Device_Sensors`（纯GPS） |

#### 服务端层 (API 返回字段验证)

| 字段 | 来源 | 含义 | 当前账号状态 |
|------|------|------|-------------|
| `suspectedStatus` | 跑步记录查询 API | `"1"` = 被标记为可疑 | 5/2、5/3 的记录已被标记 |
| `rangeStatus` | 跑步记录查询 API | `"1"` = 围栏检测结果 | 被标记的记录有此字段 |
| `runSpeedWarn` | 跑步记录查询 API | `"0"` = 正常 | 目前正常 |
| `runStatus` | 跑步记录查询 API | `"1"`=有效，`"6"`=重复 | — |
| `overSpeedWarn` | RunStandard 配置 | 超速提示文案 | "您的速度过快啦，疑似使用代步工具哟~" |
| `boyMaxSpeed/MinSpeed` | RunStandard 配置 | 500/100（配速上下限） | 服务端计算的配速单位 |
| `boyRunSpeed` | RunStandard 配置 | 300（参考正常配速） | — |

#### 关键分析

1. **不能调用 `v1/push/startRun`** — 会触发服务端跑步状态锁，后续请求全部返回"请勿重复提交"
2. **配速单位**：服务端 `runSpeed = distance/time * 1.66`（实测推算），安全范围 120-450
3. **步数未在V2 API中提交** — `StudentRunRecordRequestBody` 无步数字段，但服务端可能通过其他方式关联
4. **`suspectedStatus` 是后置审核** — 提交时返回"有效跑步"，事后可能被改标为可疑
5. **无 root/Xposed/Frida 检测** — APK 内无反调试、无签名校验、无 Native SO 层检测

### 已知服务端检测维度

| 维度 | 检测方式 | 应对 |
|------|----------|------|
| 配速异常 | `boyMaxSpeed=500`, `boyMinSpeed=100`，超出标记 | 控制配速在安全区间 |
| 超速警告 | `runSpeedWarn` 字段，`overSpeedWarn` 提示 | 配速不超过 boyRunSpeed(300) |
| 可疑标记 | `suspectedStatus:"1"` 标记可疑记录 | 轨迹拟真、行为拟真 |
| 围栏检测 | `rangeStatus` 检查是否在校区内 | 确保 >80% 点在围栏内 |
| 重复提交 | `startRun` 触发锁 | 不调用 startRun |
| 轨迹分析 | 对比 trackPoints 与 realityTrackPoints | 保持一致性 |

### 风控策略

| 策略 | 实现函数 | 说明 |
|------|----------|------|
| 安全时段 | `isInSafeRunWindow()` | 仅在 6:00-8:00 或 17:00-21:00 提交 |
| 配速检测 | `calculateSafePace()` | 服务端配速 120-450 安全，180-300 最优 |
| 频率控制 | `shouldRunToday()` | 每周 3-4 次，15% 概率随机跳过 |
| 轨迹评分 | `scoreTrack()` | 检测时间均匀性、停顿、速度变异、精度多样性 |
| 设备随机 | `randomDevice()` | 每次登录随机品牌/型号/系统版本 |
| 提交缓冲 | track-generator | 轨迹结束时间比提交时刻早 60-180s |

### 轨迹真实性细节

- 时间间隔：3-6s 随机（非固定值）
- 停顿：1-3 次，每次 5-15s（模拟系鞋带/等红灯）
- GPS 抖动：连续自相关（0.7 衰减 + 0.3 新随机），非独立随机
- 速度：惯性模型，渐变加减速，变异系数 >0.1
- 碰壁：150°+ U 形转弯，非瞬移
- 精度值：5-16 随机分布，至少 4 种不同值

---

## 二、俱乐部签到风控

### 逆向分析发现

#### 客户端层 (APK SignInPresenterImpl.java)

| 机制 | 实现 | 说明 |
|------|------|------|
| GeoFence 围栏 | `GeoFenceClient` + `clockingRange` | 以活动坐标为圆心，`clockingRange` 为半径创建圆形围栏 |
| 围栏状态 | `geoFence: boolean` | 进入围栏=true，离开=false |
| 围栏外禁止签到 | `if (!geoFence)` 按钮变灰 | 显示"不在签到范围内"，阻止点击 |
| 真实GPS坐标 | `currentLocation.getLatitude/getLongitude` | 签到时取手机实时定位填入 SignBody |
| 双模式签到 | `clubOrClass` 标志 | false=俱乐部(SignBody)，true=体育课(SportsClassStudentLearnClockingBody) |

#### 服务端层 (API 行为推断)

| 机制 | 证据 | 风险 |
|------|------|------|
| 坐标验证 | SignBody 包含 `latitude/longitude`，服务端接收 | 服务端可校验坐标与活动地点的距离 |
| 时间窗口 | `getSignInTf` 仅在活动时段返回有效数据 | 活动时间外签到直接返回空 |
| 签退时限 | `signBackLimitTime` 字段 | 超时可能无法签退 |
| 签到状态机 | signStatus: "1"→签到→"2"→签退→"3" | 状态不对时 API 拒绝 |
| 旷课累计 | `signStatus: "0"` 在俱乐部记录中 | 连续旷课触发报名禁令（已验证：连续3次旷课禁报2天） |

#### 关键分析

1. **围栏检查是客户端行为** — 我们直接调 `signInOrSignBack` API 绕过了 GeoFence 客户端检查
2. **但坐标发给了服务端** — 服务端可能做二次距离校验
3. **`clockingRange` 具体值未知** — 需在活动时间内通过 `getSignInTf` 或 `SportsClassStudentLearnClockingVO` 获取
4. **我们使用活动返回坐标 + ±15m 偏移** — 在任何合理围栏半径内（通常 50-500m）都安全

### 风控策略

| 策略 | 实现函数 | 依据 |
|------|----------|------|
| GPS 偏移 | `jitterCoordinate(lat, lng, 15)` | 逆向确认坐标发给服务端，每次偏移避免精确重复 |
| 签到延迟 | `getSignInDelay()` 1-5min | 避免活动开始 0 秒精确签到 |
| 签退延迟 | `getSignBackDelay()` 73%-95% 活动时长 | 逆向发现 `signBackLimitTime` 存在时限 |
| 时段检查 | `getClubSignAdvice()` | 逆向确认 `getSignInTf` 仅活动时段返回数据 |
| 间隔检查 | `assessClubSignRisk()` | 签到-签退 <5min 极不自然 |
| 频率控制 | `shouldJoinClubToday()` | 逆向发现旷课累计触发惩罚 |
| 避免旷课 | 确保已报名活动都签到 | 连续3次旷课 → 禁报2天（实际触发过） |

### 签到时序建议

```
活动 18:00-18:30（30分钟）

18:00        签到窗口开放
18:01~18:04  [建议签到时刻] 延迟 1-4 分钟
18:22~18:28  [建议签退时刻] 活动时长的 73%~95%
18:30        签退窗口关闭
```

---

## 三、通用风控

### 设备指纹

每次登录随机选取设备组合，避免所有请求使用同一设备标识：

- 5 种品牌 × 4-6 款机型 = 25+ 种组合
- 4 种系统版本 × 4 种 App 版本 = 16 种组合
- 同一次会话内保持不变（一个人不会换手机）

### 建议使用模式

1. **不要每天都跑** — 真人每周 3-4 次，偶尔跳过
2. **在正常时间提交** — 早上 6-8 点或下午 17-21 点
3. **距离不要太极端** — 1.5-3km 最自然，别卡最低最高限
4. **俱乐部别秒退** — 签到后至少 20 分钟再签退
5. **用自定义路线** — 比纯随机游走更真实
