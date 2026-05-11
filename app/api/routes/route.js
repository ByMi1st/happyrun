import { ensureAccounts } from '../session.js';
import { listTemplates, saveTemplate, deleteTemplate } from '../../../src/lib/track-template.js';

export async function GET() {
  try {
    await ensureAccounts();
    return Response.json(listTemplates());
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureAccounts();
    const { name, points } = await request.json();
    if (!name || !points || !Array.isArray(points) || points.length < 2) {
      return Response.json({ error: '路线名称和至少2个坐标点必填' }, { status: 400 });
    }
    const result = saveTemplate(name, points);
    return Response.json({ success: true, result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    await ensureAccounts();
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    if (!name) return Response.json({ error: '缺少路线名称' }, { status: 400 });
    deleteTemplate(name);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
