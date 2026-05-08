import { ensureSession } from '../session.js';
import { executeCampusRun, getRunStandard, getRunLimits } from '../../../src/lib/run.js';

export async function GET() {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });
    const standard = await getRunStandard(session.schoolId);
    const limits = getRunLimits(standard, session.gender);
    return Response.json({ standard, limits });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const result = await executeCampusRun({
      routeName: body.routeName || null,
      distance: body.distance || null,
      time: body.time || null,
    });
    return Response.json({ success: true, result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
