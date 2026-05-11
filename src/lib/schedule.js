import { getSignInInfo, signIn, signBack } from './club.js';
import { getSignBackDelay } from './anti-detection.js';
import { getAccount } from './account-manager.js';

let scheduledTasks = new Map();

function taskKey(phone, id) {
  return `${phone}:${id}`;
}

export function getScheduledTasks(phone) {
  const result = [];
  for (const [key, task] of scheduledTasks) {
    if (phone && !key.startsWith(`${phone}:`)) continue;
    const [p, ...rest] = key.split(':');
    result.push({ id: rest.join(':'), phone: p, ...task, timer: undefined, backTimer: undefined });
  }
  return result;
}

export function cancelScheduledTask(phone, id) {
  const key = taskKey(phone, id);
  const task = scheduledTasks.get(key);
  if (task) {
    if (task.timer) clearTimeout(task.timer);
    if (task.backTimer) clearTimeout(task.backTimer);
    scheduledTasks.delete(key);
  }
}

export function scheduleForActivity(account, activity) {
  const { phone } = account;
  const { clubActivityId, activityName, mmdd, startTime, endTime } = activity;

  const id = `act-${clubActivityId}`;
  const key = taskKey(phone, id);
  if (scheduledTasks.has(key)) {
    return { error: '该活动已有定时任务' };
  }

  const year = new Date().getFullYear();
  const [month, day] = mmdd.split('-').map(Number);
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = (endTime || '').split(':').map(Number);

  const signInDelay = 60 + Math.floor(Math.random() * 180);
  const targetStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}:00+08:00`;
  const targetDate = new Date(targetStr);
  const signInTime = new Date(targetDate.getTime() + signInDelay * 1000);

  const delayMs = signInTime.getTime() - Date.now();
  if (delayMs < 0) {
    return { error: `活动 ${mmdd} ${startTime} 已过，无法定时` };
  }

  const actDurationMin = (endH && !isNaN(endH) && endM !== undefined && !isNaN(endM))
    ? (endH - startH) * 60 + (endM - startM)
    : 30;
  const backDelayMs = getSignBackDelay(actDurationMin);

  // Clamp sign-back time to be within activity end time (with 2min buffer)
  const actEndTime = endH && !isNaN(endH)
    ? new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}:00+08:00`)
    : null;
  const computedBackTime = new Date(signInTime.getTime() + backDelayMs);
  const safeBackTime = actEndTime && computedBackTime > actEndTime
    ? new Date(actEndTime.getTime() - 2 * 60 * 1000) // 2 min before end
    : computedBackTime;
  const clampedBackDelayMs = Math.max(safeBackTime.getTime() - signInTime.getTime(), 5 * 60 * 1000); // at least 5 min after sign-in

  const task = {
    clubActivityId,
    activityName,
    date: `${mmdd}`,
    startTime,
    endTime: endTime || '',
    signInAt: signInTime.toISOString(),
    signBackAt: new Date(signInTime.getTime() + clampedBackDelayMs).toISOString(),
    status: 'waiting',
    signInResult: null,
    signBackResult: null,
    timer: null,
    backTimer: null,
  };

  task.timer = setTimeout(async () => {
    const current = getAccount(phone) || account;
    task.status = 'signing_in';
    try {
      const info = await getSignInInfo(current);
      if (!info || !info.activityId) {
        task.status = 'failed';
        task.signInResult = '无可签到活动（不在活动时间内）';
        return;
      }
      if (info.signStatus === '3') {
        task.status = 'completed';
        task.signInResult = '已完成（签到前检查发现已签到并签退）';
        return;
      }
      if (info.signStatus === '2') {
        // Already signed in, skip to sign back
        task.status = 'signed_in';
        task.signInResult = '已签到（由其他方式完成），将自动签退';
      } else {
        // signStatus === '1': need to sign in
        await signIn(current, info.activityId, info.latitude, info.longitude);
        task.status = 'signed_in';
        task.signInResult = '签到成功';
      }

      task.backTimer = setTimeout(async () => {
        const cur = getAccount(phone) || account;
        task.status = 'signing_back';
        try {
          const info2 = await getSignInInfo(cur);
          if (info2 && info2.activityId && info2.signStatus === '2') {
            await signBack(cur, info2.activityId, info2.latitude, info2.longitude);
            task.status = 'completed';
            task.signBackResult = '签退成功';
          } else {
            task.status = 'completed';
            task.signBackResult = '无需签退';
          }
        } catch (e) {
          task.status = 'back_failed';
          task.signBackResult = e.message;
        }
      }, clampedBackDelayMs);
    } catch (e) {
      task.status = 'failed';
      task.signInResult = e.message;
    }
  }, delayMs);

  scheduledTasks.set(key, task);
  const signInTimeStr = signInTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const signBackTimeStr = new Date(signInTime.getTime() + clampedBackDelayMs).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' });
  return { success: true, id, signInTimeStr, signBackTimeStr };
}
