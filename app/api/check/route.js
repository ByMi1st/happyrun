import { ensureSession } from '../session.js';
import { isInSafeRunWindow, getNextSafeWindow, calculateSafePace, suggestSafeParams, shouldRunToday, getAntiDetectionAdvice } from '../../../src/lib/anti-detection.js';
import client from '../../../src/lib/client.js';

export async function POST(request) {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { distance, time } = body;

    const inWindow = isInSafeRunWindow();
    const nextWindow = !inWindow ? getNextSafeWindow() : null;
    const pace = distance && time ? calculateSafePace(distance, time) : null;
    const advice = getAntiDetectionAdvice({ distance, time });

    let frequency = null;
    try {
      const records = await client.get('v1/unirun/query/student/all/run/record', { params: { pageNum: 1, pageSize: 10 } });
      if (Array.isArray(records)) frequency = shouldRunToday(records);
    } catch {}

    return Response.json({
      inSafeWindow: inWindow,
      nextWindow: nextWindow?.toISOString(),
      pace,
      advice,
      frequency,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
