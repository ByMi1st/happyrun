import { getSignInInfo, signIn, signBack } from './club.js';
import { getSignBackDelay } from './anti-detection.js';

let scheduledTasks = new Map();

export function getScheduledTasks() {
  const result = [];
  for (const [id, task] of scheduledTasks) {
    result.push({ id, ...task, timer: undefined, backTimer: undefined });
  }
  return result;
}

export function cancelScheduledTask(id) {
  const task = scheduledTasks.get(id);
  if (task) {
    if (task.timer) clearTimeout(task.timer);
    if (task.backTimer) clearTimeout(task.backTimer);
    scheduledTasks.delete(id);
  }
}

export function scheduleForActivity(activity) {
  const { clubActivityId, activityName, mmdd, startTime, endTime } = activity;

  const id = `act-${clubActivityId}`;
  if (scheduledTasks.has(id)) {
    return { error: '该活动已有定时任务' };
  }

  const year = new Date().getFullYear();
  const [month, day] = mmdd.split('-').map(Number);
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = (endTime || '').split(':').map(Number);

  const signInDelay = 60 + Math.floor(Math.random() * 180);
  const targetDate = new Date(year, month - 1, day, startH, startM, 0);
  const signInTime = new Date(targetDate.getTime() + signInDelay * 1000);

  const delayMs = signInTime.getTime() - Date.now();
  if (delayMs < 0) {
    return { error: `活动 ${mmdd} ${startTime} 已过，无法定时` };
  }

  const actDurationMin = endH && endM ? (endH - startH) * 60 + (endM - startM) : 30;
  const backDelayMs = getSignBackDelay(actDurationMin);

  const task = {
    clubActivityId,
    activityName,
    date: `${mmdd}`,
    startTime,
    endTime: endTime || '',
    signInAt: signInTime.toISOString(),
    signBackAt: new Date(signInTime.getTime() + backDelayMs).toISOString(),
    status: 'waiting',
    signInResult: null,
    signBackResult: null,
    timer: null,
    backTimer: null,
  };

  task.timer = setTimeout(async () => {
    task.status = 'signing_in';
    try {
      const info = await getSignInInfo();
      if (!info || !info.activityId) {
        task.status = 'failed';
        task.signInResult = '无可签到活动（不在活动时间内）';
        return;
      }
      await signIn(info.activityId, info.latitude, info.longitude);
      task.status = 'signed_in';
      task.signInResult = '签到成功';

      task.backTimer = setTimeout(async () => {
        task.status = 'signing_back';
        try {
          const info2 = await getSignInInfo();
          if (info2 && info2.activityId && info2.signStatus === '2') {
            await signBack(info2.activityId, info2.latitude, info2.longitude);
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
      }, backDelayMs);
    } catch (e) {
      task.status = 'failed';
      task.signInResult = e.message;
    }
  }, delayMs);

  scheduledTasks.set(id, task);
  const signInTimeStr = signInTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const signBackTimeStr = new Date(signInTime.getTime() + backDelayMs).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' });
  return { success: true, id, signInTimeStr, signBackTimeStr };
}
