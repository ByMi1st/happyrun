import { ensureSession } from '../session.js';
import {
  isInSafeRunWindow, getNextSafeWindow, calculateSafePace,
  shouldRunToday, getAntiDetectionAdvice,
  getClubSignAdvice, shouldJoinClubToday,
} from '../../../src/lib/anti-detection.js';
import client from '../../../src/lib/client.js';

export async function POST(request) {
  try {
    const session = await ensureSession();
    if (!session) return Response.json({ error: '未登录' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { type, distance, time, activityStartTime, activityEndTime } = body;

    if (type === 'club') {
      const clubAdvice = getClubSignAdvice(activityStartTime, activityEndTime);

      let clubFrequency = null;
      try {
        const records = await client.get('v1/clubactivity/getStudentClubRecord', {
          params: { studentId: session.studentId, pageNo: 1, pageSize: 10 },
        });
        if (Array.isArray(records)) clubFrequency = shouldJoinClubToday(records);
      } catch {}

      return Response.json({ advice: clubAdvice, frequency: clubFrequency });
    }

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
