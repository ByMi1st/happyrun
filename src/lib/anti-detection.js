/**
 * Anti-Detection Module
 *
 * Provides risk-control strategies for campus run and club sign-in
 * to minimize detection probability.
 */

// ===== Time Window Validation =====

const SAFE_RUN_HOURS = [
  { start: 6, end: 8 },
  { start: 17, end: 21 },
];

function getChinaHour() {
  return Number(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai', hour: 'numeric', hour12: false }));
}

export function isInSafeRunWindow() {
  const hour = getChinaHour();
  return SAFE_RUN_HOURS.some(w => hour >= w.start && hour < w.end);
}

export function getNextSafeWindow() {
  const hour = getChinaHour();
  const now = new Date();
  for (const w of SAFE_RUN_HOURS) {
    if (hour < w.start) {
      const next = new Date(now);
      next.setHours(next.getHours() + (w.start - hour), Math.floor(Math.random() * 30), 0, 0);
      return next;
    }
  }
  const tomorrow = new Date(now);
  tomorrow.setHours(tomorrow.getHours() + (24 - hour + SAFE_RUN_HOURS[0].start), Math.floor(Math.random() * 30), 0, 0);
  return tomorrow;
}

// ===== Pace Safety =====

const SERVER_SPEED_UNIT_FACTOR = 1.66;

export function calculateSafePace(distanceMeters, timeMinutes) {
  const serverSpeed = Math.round((distanceMeters / timeMinutes) * SERVER_SPEED_UNIT_FACTOR);
  return {
    serverSpeed,
    paceMinPerKm: timeMinutes / (distanceMeters / 1000),
    isSafe: serverSpeed >= 120 && serverSpeed <= 450,
    isOptimal: serverSpeed >= 180 && serverSpeed <= 300,
  };
}

export function suggestSafeParams(distMin, distMax, timeMin, timeMax) {
  const targetPaceRange = { min: 5.0, max: 8.0 };
  const dist = distMin + Math.floor(Math.random() * (distMax - distMin) * 0.5) + Math.floor((distMax - distMin) * 0.1);
  const idealTimeMin = (dist / 1000) * targetPaceRange.min;
  const idealTimeMax = (dist / 1000) * targetPaceRange.max;
  const time = Math.max(timeMin, Math.min(timeMax, Math.floor(idealTimeMin + Math.random() * (idealTimeMax - idealTimeMin))));
  return { distance: dist, time };
}

// ===== GPS Jitter for Sign-in =====

export function jitterCoordinate(lat, lng, radiusMeters = 20) {
  const r = radiusMeters / 111000;
  const angle = Math.random() * 2 * Math.PI;
  const dist = Math.random() * r;
  return {
    lat: lat + dist * Math.cos(angle),
    lng: lng + dist * Math.sin(angle) / Math.cos(lat * Math.PI / 180),
  };
}

// ===== Sign-in Timing =====

export function getSignInDelay() {
  return (60 + Math.floor(Math.random() * 240)) * 1000;
}

export function getSignBackDelay(activityDurationMinutes = 30) {
  const minDelay = Math.floor(activityDurationMinutes * 0.73);
  const maxDelay = Math.floor(activityDurationMinutes * 0.95);
  return (minDelay + Math.floor(Math.random() * (maxDelay - minDelay))) * 60 * 1000;
}

// ===== Frequency Control =====

export function shouldRunToday(recentRecords, targetPerWeek = 4) {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeekCount = recentRecords.filter(r => {
    const d = new Date(r.recordDate || r.createTime);
    return d.getTime() > oneWeekAgo && r.runStatus === '1';
  }).length;

  if (thisWeekCount >= targetPerWeek) return { should: false, reason: `本周已跑${thisWeekCount}次，达标` };

  const skipChance = 0.15;
  if (Math.random() < skipChance) return { should: false, reason: '随机跳过（模拟真人不确定性）' };

  return { should: true, remaining: targetPerWeek - thisWeekCount };
}

// ===== Track Quality Scoring =====

export function scoreTrack(trackPoints) {
  if (!trackPoints || trackPoints.length < 10) return { score: 0, issues: ['点数过少'] };

  const points = trackPoints.map(s => {
    const [lng, lat, time, acc] = s.split('-');
    return { lng: Number(lng), lat: Number(lat), time: Number(time), acc: Number(acc) };
  });

  const issues = [];
  let score = 100;

  const intervals = [];
  for (let i = 1; i < points.length; i++) {
    intervals.push((points[i].time - points[i - 1].time) / 1000);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const stdInterval = Math.sqrt(intervals.reduce((a, b) => a + (b - avgInterval) ** 2, 0) / intervals.length);
  if (stdInterval < 0.5) { score -= 30; issues.push('时间间隔过于均匀'); }
  if (stdInterval < 1.0) { score -= 10; issues.push('时间间隔方差偏低'); }

  const hasPause = intervals.some(i => i > 8);
  if (!hasPause) { score -= 15; issues.push('无停顿段'); }

  const speeds = [];
  for (let i = 1; i < points.length; i++) {
    const dt = (points[i].time - points[i - 1].time) / 1000;
    if (dt <= 0) continue;
    const dlat = (points[i].lat - points[i - 1].lat) * 111000;
    const dlng = (points[i].lng - points[i - 1].lng) * 111000 * Math.cos(points[i].lat * Math.PI / 180);
    const dist = Math.sqrt(dlat ** 2 + dlng ** 2);
    speeds.push(dist / dt);
  }
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const stdSpeed = Math.sqrt(speeds.reduce((a, b) => a + (b - avgSpeed) ** 2, 0) / speeds.length);
  const cv = stdSpeed / avgSpeed;
  if (cv < 0.1) { score -= 20; issues.push('速度变异系数过低(过于恒速)'); }

  const accValues = [...new Set(points.map(p => p.acc))];
  if (accValues.length < 4) { score -= 10; issues.push('精度值多样性不足'); }

  return { score: Math.max(0, score), issues, stats: { avgInterval, stdInterval, avgSpeed, cv, hasPause } };
}

// ===== Export Summary =====

export function getAntiDetectionAdvice(context = {}) {
  const advice = [];

  if (!isInSafeRunWindow()) {
    const next = getNextSafeWindow();
    advice.push({ level: 'warn', msg: `当前不在安全提交时段，建议等到 ${next.getHours()}:${String(next.getMinutes()).padStart(2, '0')}` });
  }

  if (context.distance && context.time) {
    const pace = calculateSafePace(context.distance, context.time);
    if (!pace.isSafe) {
      advice.push({ level: 'error', msg: `配速${pace.paceMinPerKm.toFixed(1)}min/km 超出安全范围(5-9min/km)` });
    } else if (!pace.isOptimal) {
      advice.push({ level: 'warn', msg: `配速${pace.paceMinPerKm.toFixed(1)}min/km 不在最优区间(5.5-7.5min/km)` });
    }
  }

  if (advice.length === 0) {
    advice.push({ level: 'ok', msg: '当前参数通过风控检查' });
  }

  return advice;
}
