# HappyRun

Unirun 校园跑 & 俱乐部自动化工具。基于逆向分析构建，提供 Web UI 和 CLI 两种使用方式。

> 仅供学习交流使用，请勿用于违反校规的行为。

## 功能

### 校园跑
- 一键提交跑步记录（自动生成合规轨迹）
- 自定义距离/时间（滑块调节，实时配速反馈）
- 自定义路线模板（保存真实路线，重复使用加随机偏移）
- 内置风控检测（配速安全区间、时段建议、频率控制、轨迹质量评分）

### 俱乐部
- 查看活动列表（按日期切换）
- 一键报名 / 取消报名
- 抢报（活动满员时定时高频尝试）
- 签到 / 签退 / 签到+定时自动签退

### 风控对策

基于 APK 逆向分析，针对服务端/客户端检测机制实现对抗。详见 **[风控策略文档](docs/ANTI_DETECTION.md)**。

#### 校园跑对抗
| 检测风险 | 对抗措施 | 代码 |
|----------|----------|------|
| 配速异常 (`boyMaxSpeed/MinSpeed`) | 安全区间校验 + 前端实时反馈 | `anti-detection.js: calculateSafePace()` |
| 轨迹太均匀 (机器特征) | 随机间隔(3-6s) + 停顿(1-3次) + 惯性速度 | `track-generator.js` |
| GPS 抖动不连续 | 自相关噪声 (0.7衰减 + 0.3新随机) | `track-generator.js` |
| 校区围栏 (80%点在内) | 全部点在多边形内生成，碰壁U形转弯 | `track-generator.js` + `geo.js` |
| `startRun` 触发状态锁 | 不调用，直接提交 | `run.js` |
| `suspectedStatus` 后置审核 | 轨迹质量自检评分 | `anti-detection.js: scoreTrack()` |
| 提交时段/频率异常 | 安全时段(6-8/17-21点) + 每周3-4次 | `anti-detection.js` |
| 设备指纹相同 | 每次登录随机品牌/机型/版本 | `config.js: randomDevice()` |

#### 俱乐部对抗
| 检测风险 | 对抗措施 | 代码 |
|----------|----------|------|
| GeoFence 围栏 (客户端阻断) | 绕过客户端，直接调 API | `club.js: signIn/signBack` |
| 签到坐标固定 | 每次 ±15m GPS 偏移 | `club.js` → `anti-detection.js: jitterCoordinate()` |
| 精确踩点签到 | 延迟 1-5 分钟 | `anti-detection.js: getSignInDelay()` |
| 秒退 (<5min) | 延迟 73%-95% 活动时长 | `anti-detection.js: getSignBackDelay()` |
| 连续旷课惩罚 | 频率控制 + 旷课提醒 | `anti-detection.js: shouldJoinClubToday()` |

## 项目结构

```
happyrun/
├── app/                        # Next.js App Router
│   ├── page.js                 # 前端页面（React SPA）
│   ├── layout.js               # 布局
│   └── api/                    # API Routes
│       ├── login/route.js      # 登录
│       ├── run/route.js        # 校园跑
│       ├── club/route.js       # 俱乐部 & 签到
│       ├── routes/route.js     # 路线模板 CRUD
│       ├── rush/route.js       # 抢报
│       ├── check/route.js      # 风控检查
│       └── session.js          # Session 恢复
├── src/
│   ├── lib/
│   │   ├── auth.js             # 登录认证 & Token 管理
│   │   ├── client.js           # HTTP 客户端（自动签名）
│   │   ├── sign.js             # 请求签名算法（MD5）
│   │   ├── run.js              # 校园跑业务逻辑
│   │   ├── club.js             # 俱乐部 & 签到
│   │   ├── rush.js             # 抢报调度
│   │   ├── track-generator.js  # GPS 轨迹生成
│   │   ├── track-template.js   # 路线模板管理
│   │   ├── geo.js              # 几何工具
│   │   └── anti-detection.js   # 风控对策模块
│   ├── utils/
│   │   └── date.js             # 日期工具
│   ├── config.js               # 配置
│   └── index.js                # CLI 入口
├── data/routes/                # 路线模板存储
├── docs/
│   └── ANTI_DETECTION.md       # 风控策略文档
├── .env.example                # 环境变量示例
├── .gitignore
├── next.config.js
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm

### 安装

```bash
git clone https://github.com/yourname/happyrun.git
cd happyrun
npm install
```

### 配置

```bash
cp .env.example .env
# 默认值即可使用，无需修改
```

### 启动 Web UI

```bash
npm run dev
# 打开 http://localhost:3000
```

### 使用 CLI

```bash
npm run cli
```

## 部署

### Vercel（推荐）

```bash
npm i -g vercel
vercel
```

注意：部署到 Vercel 后需在项目设置中添加环境变量 `APPKEY` 和 `APPSECRET`。

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 自建服务器

```bash
npm run build
npm start
# 或使用 PM2
pm2 start npm --name happyrun -- start
```

## AI Agent 辅助搭建 Prompt

如果你使用 Cursor、Trae、Claude Code 等 AI 编码工具，可以用以下 prompt 快速理解和修改项目：

```
这是一个基于 Next.js 的校园跑自动化工具（HappyRun），请帮我：

1. 项目结构：Next.js App Router，前端在 app/page.js（React SPA），后端 API 在 app/api/，核心逻辑在 src/lib/
2. 核心模块：
   - src/lib/sign.js: Unirun API 请求签名算法（MD5）
   - src/lib/client.js: axios 封装，自动签名 + token 注入
   - src/lib/auth.js: 登录（密码 MD5 后发送）
   - src/lib/track-generator.js: GPS 轨迹生成（多边形内随机游走）
   - src/lib/anti-detection.js: 风控模块（配速/时段/频率/轨迹评分）
   - src/lib/club.js: 俱乐部报名 + 签到签退
3. API 基础：
   - 目标服务器: https://run-lb.tanmasports.com/
   - 认证: headers 带 appKey + token + sign
   - 签名算法: 排序参数拼接 + APPKEY + APPSECRET + body → MD5 大写
   - 响应格式: { code: 10000, msg: "成功", response: <data> }
4. 关键注意：
   - 不要调用 v1/push/startRun（会触发服务端锁）
   - 密码需要先 MD5 再发送
   - 学校围栏坐标格式: "lng-lat,lng-lat,..."（逗号分隔点，连字符分隔经纬度）
   - optionStatus: "6"=可报名, "4"=已报名, "7"=已满
```

## 免责声明

本项目仅供技术学习和研究目的。使用者应自行承担使用风险，开发者不对任何因使用本工具导致的后果负责。

## License

MIT
