import { ensureSession } from '../session.js';
import { scheduleRush, getAllRushStatus, cancelRush, getRushStatus } from '../../../src/lib/rush.js';

export async function GET() {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });
    return Response.json(getAllRushStatus());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });

    const { activityId, activityName, delayMs } = await request.json();
    if (!activityId) return Response.json({ error: '缺少活动ID' }, { status: 400 });

    const delay = Math.max(0, delayMs || 0);
    const result = scheduleRush(activityId, activityName || '', delay);
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
    const activityId = searchParams.get('activityId');
    if (!activityId) return Response.json({ error: '缺少活动ID' }, { status: 400 });
    cancelRush(Number(activityId));
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
