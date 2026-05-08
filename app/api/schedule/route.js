import { ensureSession } from '../session.js';
import { scheduleSignIn, getScheduledTasks, cancelScheduledTask } from '../../../src/lib/schedule.js';

export async function GET() {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });
    return Response.json(getScheduledTasks());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });

    const { targetTime, activityName } = await request.json();
    if (!targetTime) return Response.json({ error: '缺少目标时间' }, { status: 400 });

    const id = `sign-${Date.now()}`;
    const result = scheduleSignIn(id, targetTime, activityName || '');
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: '缺少任务ID' }, { status: 400 });
    cancelScheduledTask(id);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
