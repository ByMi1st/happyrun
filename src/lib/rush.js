import { joinActivity } from './club.js';
import { getAccount } from './account-manager.js';

let rushTasks = new Map();

function taskKey(phone, activityId) {
  return `${phone}:${activityId}`;
}

export function getRushStatus(phone, activityId) {
  return rushTasks.get(taskKey(phone, activityId)) || null;
}

export function getAllRushStatus(phone) {
  const result = [];
  for (const [key, task] of rushTasks) {
    if (phone && !key.startsWith(`${phone}:`)) continue;
    const [p, id] = key.split(':');
    result.push({ phone: p, activityId: Number(id), ...task });
  }
  return result;
}

export function cancelRush(phone, activityId) {
  const key = taskKey(phone, activityId);
  const task = rushTasks.get(key);
  if (task?.timer) clearTimeout(task.timer);
  rushTasks.delete(key);
}

export function scheduleRush(account, activityId, activityName, delayMs) {
  const { phone } = account;
  const key = taskKey(phone, activityId);
  if (rushTasks.has(key)) {
    return { error: '该活动已有抢报任务' };
  }

  const startAt = Date.now() + delayMs;
  const task = {
    activityName,
    status: 'waiting',
    startAt,
    result: null,
    timer: null,
  };

  task.timer = setTimeout(async () => {
    task.status = 'rushing';
    const maxAttempts = 20;
    for (let i = 0; i < maxAttempts; i++) {
      const current = getAccount(phone) || account;
      try {
        const result = await joinActivity(current, activityId);
        task.status = 'success';
        task.result = result;
        return;
      } catch (e) {
        if (e.message.includes('已满') || e.message.includes('已报名')) {
          task.status = 'failed';
          task.result = e.message;
          return;
        }
      }
      await sleep(500);
    }
    task.status = 'failed';
    task.result = '超过最大尝试次数';
  }, delayMs);

  rushTasks.set(key, task);
  return { success: true, startAt };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
