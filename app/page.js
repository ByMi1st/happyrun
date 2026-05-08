'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const css = `
  * { box-sizing: border-box; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.6; } }
  @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }

  .fade-in { animation: fadeIn .3s ease; }
  .slide-up { animation: slideUp .4s cubic-bezier(.16,1,.3,1); }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }

  .glass { background: rgba(255,255,255,.72); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); }
  .card-hover { transition: transform .2s, box-shadow .2s; }
  .card-hover:hover { transform: translateY(-1px); box-shadow: 0 8px 30px rgba(0,0,0,.08); }

  .input-apple { width:100%; padding:12px 16px; border:1px solid rgba(0,0,0,.1); border-radius:12px; font-size:15px; background:rgba(0,0,0,.03); outline:none; transition:border .2s,box-shadow .2s; }
  .input-apple:focus { border-color:#007AFF; box-shadow:0 0 0 3px rgba(0,122,255,.15); }

  .btn-primary { width:100%; padding:14px; background:linear-gradient(135deg,#007AFF,#0055D4); color:#fff; border:none; border-radius:14px; font-size:16px; font-weight:600; cursor:pointer; transition:all .2s; letter-spacing:.3px; }
  .btn-primary:hover { filter:brightness(1.05); transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,122,255,.3); }
  .btn-primary:active { transform:scale(.98); }
  .btn-primary:disabled { opacity:.5; cursor:not-allowed; transform:none; filter:none; box-shadow:none; }

  .btn-sm { padding:8px 16px; border:none; border-radius:10px; font-size:13px; font-weight:500; cursor:pointer; transition:all .15s; }
  .btn-sm:active { transform:scale(.95); }
  .btn-sm:disabled { opacity:.5; cursor:not-allowed; }

  .tab-bar { display:flex; gap:4px; padding:3px; background:rgba(0,0,0,.05); border-radius:12px; margin-bottom:20px; }
  .tab-item { flex:1; padding:10px 4px; border:none; border-radius:10px; cursor:pointer; font-size:14px; font-weight:500; color:#666; background:transparent; transition:all .25s; }
  .tab-item.active { background:#fff; color:#000; box-shadow:0 1px 4px rgba(0,0,0,.08); font-weight:600; }

  .date-pill { display:flex; flex-direction:column; align-items:center; padding:8px 0; border:none; border-radius:12px; cursor:pointer; min-width:46px; font-weight:500; transition:all .2s; background:transparent; }
  .date-pill.active { background:#007AFF; color:#fff; box-shadow:0 2px 10px rgba(0,122,255,.3); }
  .date-pill:not(.active) { color:#666; }
  .date-pill:not(.active):hover { background:rgba(0,0,0,.04); }

  .msg-toast { padding:12px 16px; border-radius:12px; font-size:13px; font-weight:500; animation:fadeIn .3s ease; backdrop-filter:blur(10px); margin-bottom:14px; }

  .act-row { display:flex; align-items:center; gap:12px; padding:14px 0; border-bottom:1px solid rgba(0,0,0,.04); transition:background .15s; }
  .act-row:last-child { border-bottom:none; }

  .task-card { display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(0,0,0,.03); border-radius:12px; margin-bottom:6px; animation:fadeIn .3s ease; }

  .range-apple { -webkit-appearance:none; width:100%; height:4px; border-radius:2px; background:rgba(0,0,0,.08); outline:none; }
  .range-apple::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.2); cursor:pointer; border:none; }

  .select-apple { width:100%; padding:10px 14px; border:1px solid rgba(0,0,0,.1); border-radius:12px; font-size:14px; background:#fff; outline:none; appearance:none; }
`;

export default function Home() {
  const [session, setSession] = useState(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('run');
  const [runResult, setRunResult] = useState(null);
  const [activities, setActivities] = useState([]);
  const [myActs, setMyActs] = useState([]);
  const [msg, setMsg] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [timerActive, setTimerActive] = useState(false);
  const [timerCountdown, setTimerCountdown] = useState('');
  const timerRef = useRef(null);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [rushStatus, setRushStatus] = useState([]);
  const [btnLoading, setBtnLoading] = useState({});
  const msgTimer = useRef(null);
  const [runLimits, setRunLimits] = useState(null);
  const [runDist, setRunDist] = useState(0);
  const [runTime, setRunTime] = useState(0);
  const [riskCheck, setRiskCheck] = useState(null);
  const [clubRisk, setClubRisk] = useState(null);

  function showMsg(text, type = 'info', duration = 4000) {
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMsg({ text, type });
    msgTimer.current = setTimeout(() => setMsg(null), duration);
  }
  function setBtnLoad(key, val) { setBtnLoading(prev => ({ ...prev, [key]: val })); }

  async function api(url, opts = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ===== Auth =====
  async function handleLogin(e) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
      setSession(data); setPassword('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  // ===== Run =====
  async function handleRun() {
    setLoading(true); setRunResult(null);
    try {
      const data = await api('/api/run', { method: 'POST', body: JSON.stringify({ routeName: selectedRoute || null, distance: runDist, time: runTime }) });
      setRunResult(data.result);
      showMsg('跑步记录提交成功！', 'success');
    } catch (e) { showMsg(e.message, 'error'); }
    setLoading(false);
  }

  async function loadRoutes() {
    try { const d = await api('/api/routes'); setRoutes(d); } catch {}
    try {
      const d = await api('/api/run');
      setRunLimits(d.limits);
      const newDist = d.limits.distMin + Math.floor((d.limits.distMax - d.limits.distMin) * 0.3);
      const newTime = d.limits.timeMin + Math.floor((d.limits.timeMax - d.limits.timeMin) * 0.3);
      if (!runDist) setRunDist(newDist);
      if (!runTime) setRunTime(newTime);
      checkRisk(runDist || newDist, runTime || newTime);
    } catch {}
  }

  async function checkRisk(d, t) {
    if (!d || !t) return;
    try {
      const data = await api('/api/check', { method: 'POST', body: JSON.stringify({ distance: d, time: t }) });
      setRiskCheck(data);
    } catch {}
  }

  // ===== Club =====
  const loadActivities = useCallback(async (date) => {
    const d = date || selectedDate;
    try { const data = await api(`/api/club?action=list&date=${d}`); setActivities(data); } catch {}
  }, [selectedDate]);

  async function loadMyActivities() {
    try { const data = await api('/api/club?action=mine'); setMyActs(data); } catch {}
  }

  async function handleClubAction(activity, type) {
    const id = activity.clubActivityId, key = `club-${id}-${type}`;
    setBtnLoad(key, true);
    try {
      const data = await api('/api/club', { method: 'POST', body: JSON.stringify({ action: type === 'join' ? 'join' : 'cancel', activityId: id }) });
      const result = data.result;
      if (result?.status === '0' || result?.status === 0) {
        showMsg(result.message || '操作失败', 'error', 8000);
      } else if (type === 'join') {
        showMsg(`报名成功「${activity.activityName}」`, 'success');
        await Promise.all([loadActivities(), loadMyActivities()]);
        if (confirm(`报名成功！是否设置定时签到？\n${activity.activityName} ${activity.startTime}-${activity.endTime}`)) {
          await scheduleActivity(activity);
        }
        setBtnLoad(key, false); return;
      } else {
        showMsg(`已取消报名「${activity.activityName}」`, 'success');
      }
      await Promise.all([loadActivities(), loadMyActivities()]);
    } catch (e) { showMsg(e.message, 'error', 8000); }
    setBtnLoad(key, false);
  }

  async function handleRush(activity) {
    const delayMin = prompt('几分钟后开始抢报？(0=立即)', '0');
    if (delayMin === null) return;
    setBtnLoad(`rush-${activity.clubActivityId}`, true);
    try {
      await api('/api/rush', { method: 'POST', body: JSON.stringify({ activityId: activity.clubActivityId, activityName: activity.activityName, delayMs: Math.max(0, Number(delayMin)) * 60000 }) });
      showMsg(Number(delayMin) > 0 ? `${delayMin}分钟后开始抢报` : '正在抢报...', 'success');
      await loadRushStatus();
    } catch (e) { showMsg(e.message, 'error'); }
    setBtnLoad(`rush-${activity.clubActivityId}`, false);
  }

  async function loadRushStatus() { try { setRushStatus(await api('/api/rush')); } catch {} }

  async function checkClubRisk() {
    const firstAct = activities[0];
    try {
      const data = await api('/api/check', { method: 'POST', body: JSON.stringify({ type: 'club', activityStartTime: firstAct?.startTime || '18:00', activityEndTime: firstAct?.endTime || '18:30' }) });
      setClubRisk(data);
    } catch {}
  }

  // ===== Sign =====
  async function handleSign(type) {
    setBtnLoad(`sign-${type}`, true);
    try {
      const data = await api('/api/club', { method: 'POST', body: JSON.stringify({ action: type === 'in' ? 'signIn' : 'signBack' }) });
      const r = data.result;
      if (r.success) showMsg(`${r.type === 'sign_in' ? '签到' : '签退'}成功！${r.activityName}`, 'success');
      else if (r.reason === 'no_activity') showMsg('当前不在活动时间范围内', 'info');
      else showMsg(r.message || '操作完成', 'info');
    } catch (e) { showMsg(e.message, 'error'); }
    setBtnLoad(`sign-${type}`, false);
  }

  async function handleTimedSign() {
    if (timerActive) return;
    setBtnLoad('sign-timed', true);
    try {
      const data = await api('/api/club', { method: 'POST', body: JSON.stringify({ action: 'signIn' }) });
      if (!data.result.success) { showMsg(data.result.message || '当前不在活动时间范围内', 'info'); setBtnLoad('sign-timed', false); return; }
      showMsg('签到成功！将自动签退', 'success');
      const delay = (22 + Math.floor(Math.random() * 6)) * 60;
      const endTime = Date.now() + delay * 1000;
      setTimerActive(true);
      timerRef.current = setInterval(() => {
        const rem = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        if (rem <= 0) { clearInterval(timerRef.current); setTimerActive(false); setTimerCountdown(''); executeTimedSignBack(); }
        else setTimerCountdown(`${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`);
      }, 1000);
    } catch (e) { showMsg(e.message, 'error'); }
    setBtnLoad('sign-timed', false);
  }

  async function executeTimedSignBack() {
    try {
      const data = await api('/api/club', { method: 'POST', body: JSON.stringify({ action: 'signBack' }) });
      showMsg(data.result?.success ? '定时签退成功！' : '签退：无需签退或已超时', data.result?.success ? 'success' : 'info');
    } catch (e) { showMsg(`签退失败：${e.message}`, 'error'); }
  }

  // ===== Schedule =====
  async function scheduleActivity(activity) {
    try {
      const mmdd = activity.mmdd || selectedDate.slice(5);
      const data = await api('/api/schedule', { method: 'POST', body: JSON.stringify({ activity: { ...activity, mmdd } }) });
      if (data.error) throw new Error(data.error);
      showMsg(`定时签到：${mmdd} ${data.signInTimeStr} → ${data.signBackTimeStr} 签退`, 'success', 6000);
      await loadScheduledTasks();
    } catch (e) { showMsg(e.message, 'error'); }
  }
  async function loadScheduledTasks() { try { setScheduledTasks(await api('/api/schedule')); } catch {} }
  async function cancelSchedule(id) { try { await api(`/api/schedule?id=${id}`, { method: 'DELETE' }); showMsg('已取消', 'info'); await loadScheduledTasks(); } catch {} }

  // ===== Effects =====
  useEffect(() => {
    if (!session) return;
    if (tab === 'club') { loadActivities(); loadRushStatus(); checkClubRisk(); loadScheduledTasks(); }
    if (tab === 'mine') { loadMyActivities(); loadScheduledTasks(); }
    if (tab === 'run') loadRoutes();
  }, [tab, session]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function getDates() {
    const dates = [], today = new Date(), weekNames = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() + i); dates.push({ value: d.toISOString().slice(0, 10), day: d.getDate(), week: i === 0 ? '今' : weekNames[d.getDay()] }); }
    return dates;
  }

  function getActBtn(a) {
    const opt = a.optionStatus;
    const isFull = a.fullActivity === '1';
    const isJoined = opt === '1' || opt === '4';
    const canJoin = !isFull && (opt === '3' || opt === '6');
    if (isJoined) return { label: '已报名', cls: 'btn-sm', style: { background: 'rgba(0,122,255,.08)', color: '#007AFF' }, canCancel: true };
    if (isFull) return { label: '已满', cls: 'btn-sm', style: { background: 'rgba(0,0,0,.04)', color: '#999' }, canCancel: false };
    if (canJoin) return { label: '报名', cls: 'btn-sm', style: { background: '#007AFF', color: '#fff' }, canCancel: false };
    return { label: '-', cls: 'btn-sm', style: { background: 'rgba(0,0,0,.04)', color: '#999' }, canCancel: false };
  }

  const statusColors = { waiting: '#007AFF', signing_in: '#FF9500', signed_in: '#34C759', signing_back: '#FF9500', completed: '#34C759', failed: '#FF3B30', back_failed: '#FF9500' };
  const statusLabels = { waiting: '等待签到', signing_in: '签到中...', signed_in: '已签到，待签退', signing_back: '签退中...', completed: '已完成', failed: '签到失败', back_failed: '签退失败' };

  // ===== RENDER =====
  if (!session) {
    return (
      <>
        <style>{css}</style>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="slide-up glass" style={{ borderRadius: 24, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 28, textAlign: 'center', fontWeight: 700, background: 'linear-gradient(135deg,#007AFF,#5856D6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>HappyRun</h1>
            <p style={{ margin: '0 0 28px', textAlign: 'center', color: 'rgba(0,0,0,.4)', fontSize: 14 }}>校园跑助手</p>
            <form onSubmit={handleLogin}>
              <input className="input-apple" placeholder="手机号" value={phone} onChange={e => setPhone(e.target.value)} style={{ marginBottom: 12 }} />
              <input className="input-apple" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} style={{ marginBottom: 16 }} />
              {error && <p className="fade-in" style={{ color: '#FF3B30', fontSize: 13, margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}
              <button className="btn-primary" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: '100vh', background: '#F2F2F7', padding: '20px 16px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{session.studentName}</h2>
              <span style={{ fontSize: 13, color: 'rgba(0,0,0,.4)' }}>{session.schoolName}</span>
            </div>
          </div>

          {msg && <div className="msg-toast fade-in" style={{ background: msg.type === 'success' ? 'rgba(52,199,89,.12)' : msg.type === 'error' ? 'rgba(255,59,48,.12)' : 'rgba(255,149,0,.12)', color: msg.type === 'success' ? '#248A3D' : msg.type === 'error' ? '#FF3B30' : '#C93400' }}>{msg.text}</div>}

          <div className="tab-bar">
            {['run', 'club', 'mine'].map(t => (
              <button key={t} className={`tab-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'run' ? '校园跑' : t === 'club' ? '俱乐部' : '我的记录'}
              </button>
            ))}
          </div>

          {/* ===== 校园跑 ===== */}
          {tab === 'run' && (
            <div className="slide-up" style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15 }}>自动校园跑</p>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(0,0,0,.4)' }}>生成合规轨迹并提交，每天限一次</p>

              {runLimits && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: '#666', width: 32 }}>距离</span>
                    <input className="range-apple" type="range" min={runLimits.distMin} max={runLimits.distMax} step={100} value={runDist} onChange={e => { const v = Number(e.target.value); setRunDist(v); checkRisk(v, runTime); }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#007AFF', minWidth: 52, textAlign: 'right' }}>{(runDist / 1000).toFixed(1)}km</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#666', width: 32 }}>时间</span>
                    <input className="range-apple" type="range" min={runLimits.timeMin} max={runLimits.timeMax} step={1} value={runTime} onChange={e => { const v = Number(e.target.value); setRunTime(v); checkRisk(runDist, v); }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#007AFF', minWidth: 52, textAlign: 'right' }}>{runTime}min</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,.3)', marginBottom: 4 }}>配速: {runDist > 0 ? (runTime / (runDist / 1000)).toFixed(1) : '-'} min/km</div>
                  {riskCheck?.advice?.map((a, i) => (
                    <div key={i} className="fade-in" style={{ fontSize: 12, color: a.level === 'ok' ? '#34C759' : a.level === 'warn' ? '#FF9500' : '#FF3B30', marginTop: 3 }}>{a.msg}</div>
                  ))}
                  {riskCheck?.frequency && !riskCheck.frequency.should && <div style={{ fontSize: 12, color: '#007AFF', marginTop: 3 }}>{riskCheck.frequency.reason}</div>}
                </div>
              )}

              {routes.length > 0 && <select className="select-apple" value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)} style={{ marginBottom: 14 }}><option value="">随机生成轨迹</option>{routes.map(r => <option key={r.file} value={r.name}>{r.name} ({r.pointCount}点)</option>)}</select>}

              <button className="btn-primary" onClick={handleRun} disabled={loading}>{loading ? '提交中...' : '一键跑步'}</button>

              {runResult && (
                <div className="slide-up" style={{ marginTop: 14, padding: 14, background: 'rgba(52,199,89,.08)', borderRadius: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#248A3D' }}>提交成功</p>
                  {runResult.recordId && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>记录 #{runResult.recordId}</p>}
                  {runResult.resultDesc && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#666' }}>{runResult.resultDesc}</p>}
                  {runResult.quality && <p style={{ margin: '4px 0 0', fontSize: 12, color: runResult.quality.score >= 70 ? '#34C759' : '#FF9500' }}>轨迹质量 {runResult.quality.score}/100{runResult.quality.issues?.length > 0 ? ` · ${runResult.quality.issues.join('、')}` : ''}</p>}
                </div>
              )}
            </div>
          )}

          {/* ===== 俱乐部 ===== */}
          {tab === 'club' && (
            <div className="slide-up">
              <div style={{ display: 'flex', gap: 4, marginBottom: 14, justifyContent: 'space-between' }}>
                {getDates().map(d => (
                  <button key={d.value} className={`date-pill ${selectedDate === d.value ? 'active' : ''}`} onClick={() => { setSelectedDate(d.value); loadActivities(d.value); }}>
                    <span style={{ fontSize: 11 }}>{d.week}</span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{d.day}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button className="btn-sm" style={{ flex: 1, background: '#34C759', color: '#fff' }} onClick={() => handleSign('in')} disabled={btnLoading['sign-in']}>{btnLoading['sign-in'] ? '...' : '签到'}</button>
                <button className="btn-sm" style={{ flex: 1, background: '#FF9500', color: '#fff' }} onClick={() => handleSign('back')} disabled={btnLoading['sign-back']}>{btnLoading['sign-back'] ? '...' : '签退'}</button>
                <button className="btn-sm" style={{ flex: 1.5, background: '#007AFF', color: '#fff' }} onClick={handleTimedSign} disabled={btnLoading['sign-timed'] || timerActive}>{timerActive ? `签退 ${timerCountdown}` : '签到+自动签退'}</button>
              </div>

              {scheduledTasks.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {scheduledTasks.map(t => {
                    const isDone = ['completed', 'failed', 'back_failed'].includes(t.status);
                    return (
                      <div key={t.id} className="task-card" style={{ opacity: isDone ? .5 : 1 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: statusColors[t.status] || '#999', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{t.date} {t.activityName}</div>
                          <div style={{ fontSize: 11, color: 'rgba(0,0,0,.4)' }}>{statusLabels[t.status]}{t.signInResult && t.status === 'failed' ? ` · ${t.signInResult}` : ''}</div>
                        </div>
                        {!isDone && <button className="btn-sm" style={{ background: 'rgba(255,59,48,.1)', color: '#FF3B30', fontSize: 11, padding: '4px 10px' }} onClick={() => cancelSchedule(t.id)}>取消</button>}
                      </div>
                    );
                  })}
                </div>
              )}

              {clubRisk?.advice?.map((a, i) => <div key={i} style={{ fontSize: 12, color: a.level === 'ok' ? '#34C759' : a.level === 'error' ? '#FF3B30' : a.level === 'warn' ? '#FF9500' : '#007AFF', marginBottom: 2 }}>{a.msg}</div>)}

              <div style={{ background: '#fff', borderRadius: 16, padding: '4px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', marginTop: 10 }}>
                {activities.length === 0 && <p style={{ textAlign: 'center', color: 'rgba(0,0,0,.25)', fontSize: 13, padding: 20 }}>暂无活动</p>}
                {activities.map(a => {
                  const btn = getActBtn(a);
                  const jk = `club-${a.clubActivityId}-join`, ck = `club-${a.clubActivityId}-cancel`;
                  const rushing = rushStatus.find(r => r.activityId === a.clubActivityId);
                  return (
                    <div key={a.clubActivityId} className="act-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{a.activityName}</div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.4)', marginTop: 2 }}>{a.startTime}-{a.endTime} · {a.addressDetail}</div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.4)' }}>{a.teacherName} · <span style={{ color: a.fullActivity === '1' ? '#FF3B30' : '#34C759' }}>{a.signInStudent}/{a.maxStudent}</span></div>
                        {rushing && <div className="pulse" style={{ fontSize: 11, color: statusColors[rushing.status] || '#007AFF', marginTop: 2 }}>抢报{rushing.status === 'success' ? '成功' : rushing.status === 'failed' ? '失败' : '中...'}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {btn.canCancel ? (<>
                          <button className="btn-sm" style={{ background: 'rgba(255,59,48,.08)', color: '#FF3B30' }} onClick={() => handleClubAction(a, 'cancel')} disabled={btnLoading[ck]}>{btnLoading[ck] ? '...' : '取消'}</button>
                          {!scheduledTasks.some(t => t.clubActivityId === a.clubActivityId) && (
                            <button className="btn-sm" style={{ background: '#5856D6', color: '#fff', fontSize: 11 }} onClick={() => scheduleActivity(a)}>定时签到</button>
                          )}
                          {scheduledTasks.some(t => t.clubActivityId === a.clubActivityId) && (
                            <span style={{ fontSize: 11, color: '#007AFF', textAlign: 'center' }}>已定时</span>
                          )}
                        </>) : (<>
                          <button className="btn-sm" style={btn.style} disabled={btn.label !== '报名' || btnLoading[jk]} onClick={() => handleClubAction(a, 'join')}>{btnLoading[jk] ? '...' : btn.label}</button>
                        </>)}
                        {a.fullActivity === '1' && a.optionStatus !== '4' && <button className="btn-sm" style={{ background: '#FF3B30', color: '#fff', fontSize: 11, padding: '5px 10px' }} onClick={() => handleRush(a)} disabled={btnLoading[`rush-${a.clubActivityId}`]}>{btnLoading[`rush-${a.clubActivityId}`] ? '...' : '抢报'}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== 我的记录 ===== */}
          {tab === 'mine' && (
            <div className="slide-up" style={{ background: '#fff', borderRadius: 16, padding: '4px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
              {myActs.length === 0 && <p style={{ textAlign: 'center', color: 'rgba(0,0,0,.25)', fontSize: 13, padding: 20 }}>暂无记录</p>}
              {myActs.slice(0, 15).map((a, i) => {
                const isScheduled = scheduledTasks.some(t => t.clubActivityId === a.clubActivityId);
                const isPast = a.activityStatus === '3';
                const isOngoing = a.activityStatus === '2';
                return (
                  <div key={a.signUpId || i} className="act-row">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{a.activityName}</div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,.4)', marginTop: 2 }}>{a.mmdd} {a.startTime}-{a.endTime}</div>
                    </div>
                    {isPast
                      ? <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(52,199,89,.1)', color: '#34C759', fontWeight: 500 }}>已完成</span>
                      : isScheduled
                        ? <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(0,122,255,.1)', color: '#007AFF', fontWeight: 500 }}>已定时</span>
                        : <button className="btn-sm" style={{ background: '#5856D6', color: '#fff', fontSize: 11 }} onClick={() => scheduleActivity(a)}>定时签到</button>
                    }
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
