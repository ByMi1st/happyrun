import { getSignInInfo, signIn, signBack } from './club.js';
import { getSignInDelay, getSignBackDelay } from './anti-detection.js';

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

export function scheduleSignIn(id, targetTime, activityName = '') {
  if (scheduledTasks.has(id)) {
    return { error: '该时间已有定时任务' };
  }

  const delayMs = new Date(targetTime).getTime() - Date.now();
  if (delayMs < 0) {
    return { error: '目标时间已过' };
  }

  const task = {
    activityName,
    targetTime,
    status: 'waiting',
    signInResult: null,
    signBackResult: null,
    timer: null,
    backTimer: null,
    createdAt: new Date().toISOString(),
  };

  task.timer = setTimeout(async () => {
    task.status = 'signing_in';

    const signInDelay = 1000 + Math.floor(Math.random() * 3000);
    await sleep(signInDelay);

    try {
      const info = await getSignInInfo();
      if (!info || !info.activityId) {
        task.status = 'failed';
        task.signInResult = '无可签到活动（不在活动时间内）';
        return;
      }

      task.activityName = info.activityName || task.activityName;
      const result = await signIn(info.activityId, info.latitude, info.longitude);
      task.status = 'signed_in';
      task.signInResult = '签到成功';

      const backDelay = getSignBackDelay(30);
      task.signBackTime = new Date(Date.now() + backDelay).toISOString();

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
            task.signBackResult = '无需签退或已超时';
          }
        } catch (e) {
          task.status = 'back_failed';
          task.signBackResult = e.message;
        }
      }, backDelay);

    } catch (e) {
      task.status = 'failed';
      task.signInResult = e.message;
    }
  }, delayMs);

  scheduledTasks.set(id, task);
  return { success: true, delayMs, id };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
