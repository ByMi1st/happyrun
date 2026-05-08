import { joinActivity } from './club.js';

let rushTasks = new Map();

export function getRushStatus(activityId) {
  return rushTasks.get(activityId) || null;
}

export function getAllRushStatus() {
  const result = [];
  for (const [id, task] of rushTasks) {
    result.push({ activityId: id, ...task });
  }
  return result;
}

export function cancelRush(activityId) {
  const task = rushTasks.get(activityId);
  if (task?.timer) clearTimeout(task.timer);
  rushTasks.delete(activityId);
}

export function scheduleRush(activityId, activityName, delayMs) {
  if (rushTasks.has(activityId)) {
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
      try {
        const result = await joinActivity(activityId);
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

  rushTasks.set(activityId, task);
  return { success: true, startAt };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
