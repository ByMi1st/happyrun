'use client';
import { useState, useEffect, useRef } from 'react';

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
  const [scheduleTimer, setScheduleTimer] = useState(null);
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

  function setBtnLoad(key, val) {
    setBtnLoading(prev => ({ ...prev, [key]: val }));
  }

  // ===== Login =====
  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data);
      setPassword('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  // ===== Run =====
  async function handleRun() {
    setLoading(true); setRunResult(null);
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeName: selectedRoute || null, distance: runDist, time: runTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRunResult(data.result);
      showMsg('跑步记录提交成功！', 'success');
    } catch (e) { showMsg(e.message, 'error'); }
    setLoading(false);
  }

  async function loadRoutes() {
    try {
      const res = await fetch('/api/routes');
      if (res.ok) setRoutes(await res.json());
    } catch {}
    try {
      const res = await fetch('/api/run');
      if (res.ok) {
        const data = await res.json();
        setRunLimits(data.limits);
        if (!runDist) setRunDist(data.limits.distMin + Math.floor((data.limits.distMax - data.limits.distMin) * 0.3));
        if (!runTime) setRunTime(data.limits.timeMin + Math.floor((data.limits.timeMax - data.limits.timeMin) * 0.3));
      }
    } catch {}
    checkRisk();
  }

  async function checkRisk(d, t) {
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distance: d || runDist, time: t || runTime }),
      });
      if (res.ok) setRiskCheck(await res.json());
    } catch {}
  }

  // ===== Club =====
  async function loadActivities(date) {
    const d = date || selectedDate;
    try {
      const res = await fetch(`/api/club?action=list&date=${d}`);
      const data = await res.json();
      if (res.ok) setActivities(data);
    } catch {}
  }

  async function loadMyActivities() {
    try {
      const res = await fetch('/api/club?action=mine');
      const data = await res.json();
      if (res.ok) setMyActs(data);
    } catch {}
  }

  async function handleClubAction(activity, type) {
    const id = activity.clubActivityId;
    const key = `club-${id}-${type}`;
    setBtnLoad(key, true);
    try {
      const action = type === 'join' ? 'join' : 'cancel';
      const res = await fetch('/api/club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, activityId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const result = data.result;
      if (result?.status === '0' || result?.status === 0) {
        showMsg(result.message || '操作失败', 'error', 8000);
      } else if (result?.message) {
        showMsg(result.message, 'success');
      } else {
        showMsg(type === 'join' ? `报名成功「${activity.activityName}」` : `已取消报名「${activity.activityName}」`, 'success');
      }
      await Promise.all([loadActivities(), loadMyActivities()]);
    } catch (e) { showMsg(e.message, 'error', 8000); }
    setBtnLoad(key, false);
  }

  async function handleRush(activity) {
    const delayMin = prompt('几分钟后开始抢报？(输入0立即开始)', '0');
    if (delayMin === null) return;
    const delayMs = Math.max(0, Number(delayMin)) * 60 * 1000;
    setBtnLoad(`rush-${activity.clubActivityId}`, true);
    try {
      const res = await fetch('/api/rush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: activity.clubActivityId, activityName: activity.activityName, delayMs }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showMsg(`抢报任务已创建${delayMs > 0 ? `，${delayMin}分钟后开始` : '，正在抢报...'}`, 'success');
      await loadRushStatus();
    } catch (e) { showMsg(e.message, 'error'); }
    setBtnLoad(`rush-${activity.clubActivityId}`, false);
  }

  async function loadRushStatus() {
    try {
      const res = await fetch('/api/rush');
      if (res.ok) setRushStatus(await res.json());
    } catch {}
  }

  async function checkClubRisk() {
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'club', activityStartTime: '18:00', activityEndTime: '18:30' }),
      });
      if (res.ok) setClubRisk(await res.json());
    } catch {}
  }

  // ===== Sign =====
  async function handleSign(type) {
    setBtnLoad(`sign-${type}`, true);
    try {
      const res = await fetch('/api/club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: type === 'in' ? 'signIn' : 'signBack' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const r = data.result;
      if (r.success) {
        showMsg(`${r.type === 'sign_in' ? '签到' : '签退'}成功！活动：${r.activityName}`, 'success');
      } else if (r.reason === 'no_activity') {
        showMsg('当前不在活动时间范围内', 'info');
      } else if (r.reason === 'wrong_status') {
        showMsg(r.message, 'info');
      } else {
        showMsg('操作完成', 'info');
      }
    } catch (e) { showMsg(e.message, 'error'); }
    setBtnLoad(`sign-${type}`, false);
  }

  async function handleTimedSign() {
    if (timerActive) return;
    setBtnLoad('sign-timed', true);
    try {
      const res = await fetch('/api/club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signIn' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const r = data.result;
      if (!r.success) {
        showMsg(r.reason === 'no_activity' ? '当前不在活动时间范围内' : (r.message || '无法签到'), 'info');
        setBtnLoad('sign-timed', false);
        return;
      }
      showMsg(`签到成功！将在活动结束前自动签退`, 'success');

      const delay = (22 + Math.floor(Math.random() * 6)) * 60;
      const endTime = Date.now() + delay * 1000;
      setTimerActive(true);
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setTimerActive(false);
          setTimerCountdown('');
          executeTimedSignBack();
        } else {
          const m = Math.floor(remaining / 60);
          const s = remaining % 60;
          setTimerCountdown(`${m}:${String(s).padStart(2, '0')}`);
        }
      }, 1000);
    } catch (e) { showMsg(e.message, 'error'); }
    setBtnLoad('sign-timed', false);
  }

  async function executeTimedSignBack() {
    try {
      const res = await fetch('/api/club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signBack' }),
      });
      const data = await res.json();
      if (data.result?.success) showMsg(`定时签退成功！`, 'success');
      else showMsg('定时签退：无需签退或已超时', 'info');
    } catch (e) { showMsg(`定时签退失败：${e.message}`, 'error'); }
  }

  async function handleScheduleSign() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    const defaultDate = now.toISOString().slice(0, 10);
    const defaultTime = h < 18 ? '18:01' : `${h}:${String(Math.min(m + 2, 59)).padStart(2, '0')}`;

    const input = prompt(
      `设定签到时间\n格式: YYYY-MM-DD HH:MM（如 ${defaultDate} ${defaultTime}）\n或只填 HH:MM 表示今天`,
      `${defaultDate} ${defaultTime}`
    );
    if (!input) return;

    let targetTime;
    if (/^\d{2}:\d{2}$/.test(input.trim())) {
      targetTime = `${defaultDate}T${input.trim()}:00`;
    } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(input.trim())) {
      const [d, t] = input.trim().split(/\s+/);
      targetTime = `${d}T${t}:00`;
    } else {
      showMsg('时间格式错误，请使用 HH:MM 或 YYYY-MM-DD HH:MM', 'error');
      return;
    }

    if (new Date(targetTime).getTime() <= Date.now()) {
      showMsg('目标时间已过，请设置未来的时间', 'error');
      return;
    }

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTime }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showMsg(`定时签到已创建：${input.trim()} → 自动签到 → 自动签退`, 'success', 6000);
      loadScheduledTasks();
    } catch (e) { showMsg(e.message, 'error'); }
  }

  async function loadScheduledTasks() {
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) setScheduledTasks(await res.json());
    } catch {}
  }

  async function cancelSchedule(id) {
    try {
      await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
      showMsg('已取消定时任务', 'info');
      loadScheduledTasks();
    } catch {}
  }

  // ===== Effects =====
  useEffect(() => {
    if (session && tab === 'club') { loadActivities(); loadRushStatus(); checkClubRisk(); loadScheduledTasks(); }
    if (session && tab === 'mine') loadMyActivities();
    if (session && tab === 'run') loadRoutes();
  }, [tab, session]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ===== Helpers =====
  function getDates() {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
      dates.push({
        value: d.toISOString().slice(0, 10),
        day: d.getDate(),
        week: i === 0 ? '今' : weekNames[d.getDay()],
      });
    }
    return dates;
  }

  function getActButton(a) {
    const isFull = a.fullActivity === '1';
    const optSt = a.optionStatus;
    if (optSt === '4') return { label: '已报名', style: styles.btnJoined, canCancel: true };
    if (isFull) return { label: '已满', style: styles.btnDisabled, canCancel: false };
    if (optSt === '6') return { label: '报名', style: styles.btnJoin, canCancel: false };
    return { label: '-', style: styles.btnDisabled, canCancel: false };
  }

  // ===== Render =====
  if (!session) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>HappyRun</h1>
          <p style={styles.subtitle}>校园跑助手</p>
          <form onSubmit={handleLogin}>
            <input style={styles.input} placeholder="手机号" value={phone} onChange={e => setPhone(e.target.value)} />
            <input style={styles.input} type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btn} disabled={loading}>{loading ? '登录中...' : '登录'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: 520 }}>
        <div style={styles.header}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{session.studentName}</h2>
          <span style={styles.school}>{session.schoolName}</span>
        </div>

        {msg && (
          <div style={{
            ...styles.msgBox,
            background: msg.type === 'success' ? '#e8f5e9' : msg.type === 'error' ? '#ffebee' : '#fff3e0',
            color: msg.type === 'success' ? '#2e7d32' : msg.type === 'error' ? '#c62828' : '#e65100',
          }}>
            {msg.type === 'success' ? '✓ ' : msg.type === 'error' ? '✗ ' : 'ℹ '}{msg.text}
          </div>
        )}

        <div style={styles.tabs}>
          <button style={tab === 'run' ? styles.tabActive : styles.tab} onClick={() => setTab('run')}>校园跑</button>
          <button style={tab === 'club' ? styles.tabActive : styles.tab} onClick={() => setTab('club')}>俱乐部</button>
          <button style={tab === 'mine' ? styles.tabActive : styles.tab} onClick={() => setTab('mine')}>我的记录</button>
        </div>

        {/* ===== 校园跑 ===== */}
        {tab === 'run' && (
          <div style={styles.section}>
            <div style={styles.infoBox}>
              <p style={{ margin: '0 0 6px', fontWeight: 500 }}>自动校园跑</p>
              <p style={styles.infoText}>自动获取围栏规则，生成合规轨迹并提交。每天限一次。</p>
            </div>

            {runLimits && (
              <div style={{ marginBottom: 14 }}>
                <div style={styles.sliderRow}>
                  <label style={styles.sliderLabel}>距离</label>
                  <input type="range" min={runLimits.distMin} max={runLimits.distMax} step={100} value={runDist} onChange={e => { setRunDist(Number(e.target.value)); checkRisk(Number(e.target.value), runTime); }} style={styles.slider} />
                  <span style={styles.sliderValue}>{(runDist / 1000).toFixed(1)}km</span>
                </div>
                <div style={styles.sliderRow}>
                  <label style={styles.sliderLabel}>时间</label>
                  <input type="range" min={runLimits.timeMin} max={runLimits.timeMax} step={1} value={runTime} onChange={e => { setRunTime(Number(e.target.value)); checkRisk(runDist, Number(e.target.value)); }} style={styles.slider} />
                  <span style={styles.sliderValue}>{runTime}min</span>
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  配速: {runDist > 0 ? (runTime / (runDist / 1000)).toFixed(1) : '-'} min/km
                </div>
                {riskCheck && (
                  <div style={{ marginTop: 8 }}>
                    {riskCheck.advice?.map((a, i) => (
                      <div key={i} style={{ fontSize: 12, color: a.level === 'ok' ? '#43a047' : a.level === 'warn' ? '#e65100' : '#c62828', marginTop: 2 }}>
                        {a.level === 'ok' ? '✓' : a.level === 'warn' ? '⚠' : '✗'} {a.msg}
                      </div>
                    ))}
                    {riskCheck.frequency && !riskCheck.frequency.should && (
                      <div style={{ fontSize: 12, color: '#1565c0', marginTop: 2 }}>ℹ {riskCheck.frequency.reason}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {routes.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <select style={styles.select} value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}>
                  <option value="">随机生成轨迹</option>
                  {routes.map(r => <option key={r.file} value={r.name}>{r.name} ({r.pointCount}点)</option>)}
                </select>
              </div>
            )}

            <button style={styles.btn} onClick={handleRun} disabled={loading}>
              {loading ? '提交中...' : '一键跑步'}
            </button>
            {runResult && (
              <div style={styles.resultBox}>
                <p style={{ margin: 0, fontWeight: 500 }}>提交成功</p>
                {runResult.recordId && <p style={{ margin: '4px 0 0', fontSize: 13 }}>记录ID: {runResult.recordId}</p>}
                {runResult.resultDesc && <p style={{ margin: '4px 0 0', fontSize: 13 }}>{runResult.resultDesc}</p>}
                {runResult.quality && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: runResult.quality.score >= 70 ? '#43a047' : '#e65100' }}>
                    轨迹质量: {runResult.quality.score}/100
                    {runResult.quality.issues?.length > 0 && ` (${runResult.quality.issues.join(', ')})`}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== 俱乐部 ===== */}
        {tab === 'club' && (
          <div style={styles.section}>
            <div style={styles.dateBar}>
              {getDates().map(d => (
                <button
                  key={d.value}
                  style={selectedDate === d.value ? styles.dateActive : styles.dateBtn}
                  onClick={() => { setSelectedDate(d.value); loadActivities(d.value); }}
                >
                  <span style={{ fontSize: 11 }}>{d.week}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{d.day}</span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <button style={styles.btnGreen} onClick={() => handleSign('in')} disabled={btnLoading['sign-in']}>
                {btnLoading['sign-in'] ? '...' : '签到'}
              </button>
              <button style={styles.btnOrange} onClick={() => handleSign('back')} disabled={btnLoading['sign-back']}>
                {btnLoading['sign-back'] ? '...' : '签退'}
              </button>
              <button style={styles.btnBlue} onClick={handleTimedSign} disabled={btnLoading['sign-timed'] || timerActive}>
                {timerActive ? `签退 ${timerCountdown}` : '签到+自动签退'}
              </button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <button style={styles.btnSchedule} onClick={handleScheduleSign}>
                定时签到（设定时间自动签到+签退）
              </button>
            </div>

            {scheduledTasks.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {scheduledTasks.map(t => {
                  const statusMap = {
                    waiting: '⏳ 等待中',
                    signing_in: '🔄 签到中...',
                    signed_in: '✓ 已签到，等待签退',
                    signing_back: '🔄 签退中...',
                    completed: '✓ 已完成',
                    failed: '✗ 失败',
                    back_failed: '⚠ 签退失败',
                  };
                  const timeStr = new Date(t.targetTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                  const isDone = ['completed', 'failed', 'back_failed'].includes(t.status);
                  return (
                    <div key={t.id} style={{ ...styles.taskCard, opacity: isDone ? 0.6 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {timeStr} {t.activityName && `· ${t.activityName}`}
                        </div>
                        <div style={{ fontSize: 12, color: t.status === 'failed' || t.status === 'back_failed' ? '#c62828' : '#666', marginTop: 2 }}>
                          {statusMap[t.status] || t.status}
                          {t.signInResult && t.status === 'failed' && ` - ${t.signInResult}`}
                          {t.signBackResult && ` - ${t.signBackResult}`}
                        </div>
                      </div>
                      {!isDone && (
                        <button style={styles.btnTaskCancel} onClick={() => cancelSchedule(t.id)}>取消</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {clubRisk && (
              <div style={{ marginBottom: 12 }}>
                {clubRisk.advice?.map((a, i) => (
                  <div key={i} style={{ fontSize: 12, marginTop: 2, color: a.level === 'ok' ? '#43a047' : a.level === 'error' ? '#c62828' : a.level === 'warn' ? '#e65100' : '#1565c0' }}>
                    {a.level === 'ok' ? '✓' : a.level === 'error' ? '✗' : a.level === 'warn' ? '⚠' : 'ℹ'} {a.msg}
                  </div>
                ))}
                {clubRisk.frequency && !clubRisk.frequency.should && (
                  <div style={{ fontSize: 12, color: '#1565c0', marginTop: 2 }}>ℹ {clubRisk.frequency.reason}</div>
                )}
              </div>
            )}

            {activities.length === 0 && <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13 }}>暂无活动</p>}
            {activities.map(a => {
              const btn = getActButton(a);
              const joinKey = `club-${a.clubActivityId}-join`;
              const cancelKey = `club-${a.clubActivityId}-cancel`;
              const rushKey = `rush-${a.clubActivityId}`;
              const rushing = rushStatus.find(r => r.activityId === a.clubActivityId);

              return (
                <div key={a.clubActivityId} style={styles.actCard}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{a.activityName}</div>
                    <div style={styles.actMeta}>{a.startTime}-{a.endTime} · {a.addressDetail}</div>
                    <div style={styles.actMeta}>{a.teacherName} · <span style={{ color: a.fullActivity === '1' ? '#e53935' : '#43a047' }}>{a.signInStudent}/{a.maxStudent}</span></div>
                    {rushing && (
                      <div style={{ fontSize: 11, marginTop: 2, color: rushing.status === 'success' ? '#2e7d32' : rushing.status === 'failed' ? '#c62828' : '#1565c0' }}>
                        抢报{rushing.status === 'waiting' ? '等待中' : rushing.status === 'rushing' ? '进行中...' : rushing.status === 'success' ? '成功！' : '失败'}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {btn.canCancel ? (
                      <button style={styles.btnCancel} onClick={() => handleClubAction(a, 'cancel')} disabled={btnLoading[cancelKey]}>
                        {btnLoading[cancelKey] ? '...' : '取消报名'}
                      </button>
                    ) : (
                      <button
                        style={btn.style}
                        disabled={btn.label !== '报名' || btnLoading[joinKey]}
                        onClick={() => handleClubAction(a, 'join')}
                      >
                        {btnLoading[joinKey] ? '...' : btn.label}
                      </button>
                    )}
                    {a.fullActivity === '1' && a.optionStatus !== '4' && (
                      <button style={styles.btnRush} onClick={() => handleRush(a)} disabled={btnLoading[rushKey]}>
                        {btnLoading[rushKey] ? '...' : '抢报'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== 我的记录 ===== */}
        {tab === 'mine' && (
          <div style={styles.section}>
            {myActs.length === 0 && <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13 }}>暂无记录</p>}
            {myActs.slice(0, 15).map((a, i) => (
              <div key={a.signUpId || i} style={styles.actCard}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{a.activityName}</div>
                  <div style={styles.actMeta}>{a.mmdd} {a.startTime}-{a.endTime}</div>
                </div>
                <span style={{
                  fontSize: 12, padding: '3px 8px', borderRadius: 4,
                  background: a.activityStatus === '3' ? '#e8f5e9' : '#fff3e0',
                  color: a.activityStatus === '3' ? '#2e7d32' : '#e65100',
                }}>
                  {a.activityStatus === '3' ? '已完成' : a.activityStatus === '2' ? '进行中' : '待开始'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' },
  title: { margin: '0 0 2px', fontSize: 26, textAlign: 'center', fontWeight: 700 },
  subtitle: { margin: '0 0 24px', textAlign: 'center', color: '#999', fontSize: 13 },
  input: { width: '100%', padding: '12px 14px', marginBottom: 12, border: '1px solid #e0e0e0', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  btn: { width: '100%', padding: '13px', background: '#ff8c00', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, cursor: 'pointer', fontWeight: 600 },
  error: { color: '#d32f2f', fontSize: 13, margin: '0 0 10px', textAlign: 'center' },
  header: { marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #f0f0f0' },
  school: { fontSize: 13, color: '#999' },
  tabs: { display: 'flex', gap: 6, marginBottom: 16 },
  tab: { flex: 1, padding: '10px 4px', background: '#f5f5f5', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#666' },
  tabActive: { flex: 1, padding: '10px 4px', background: '#ff8c00', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  section: { minHeight: 180 },
  msgBox: { padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, fontWeight: 500 },
  infoBox: { background: '#fafafa', borderRadius: 10, padding: 14, marginBottom: 14 },
  infoText: { margin: '2px 0', fontSize: 13, color: '#666' },
  resultBox: { marginTop: 14, padding: 14, background: '#e8f5e9', borderRadius: 10 },
  select: { width: '100%', padding: '9px 10px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13 },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  sliderLabel: { fontSize: 13, color: '#555', width: 36 },
  slider: { flex: 1, height: 4, cursor: 'pointer' },
  sliderValue: { fontSize: 13, fontWeight: 600, color: '#ff8c00', width: 55, textAlign: 'right' },
  dateBar: { display: 'flex', gap: 4, marginBottom: 12, justifyContent: 'space-between' },
  dateBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 8px', border: 'none', borderRadius: 8, background: '#f5f5f5', cursor: 'pointer', minWidth: 40 },
  dateActive: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 8px', border: 'none', borderRadius: 8, background: '#ff8c00', color: '#fff', cursor: 'pointer', minWidth: 40 },
  btnGreen: { flex: 1, padding: '9px 6px', background: '#43a047', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnOrange: { flex: 1, padding: '9px 6px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnBlue: { flex: 1.5, padding: '9px 6px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnSchedule: { width: '100%', padding: '9px 6px', background: '#7b1fa2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  taskCard: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f5f5f5', borderRadius: 8, marginBottom: 6 },
  btnTaskCancel: { padding: '4px 10px', background: '#fff', color: '#c62828', border: '1px solid #c62828', borderRadius: 6, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' },
  actCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid #f5f5f5' },
  actMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  btnJoin: { padding: '7px 14px', background: '#ff8c00', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' },
  btnJoined: { padding: '7px 14px', background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' },
  btnCancel: { padding: '7px 10px', background: '#fff', color: '#e53935', border: '1px solid #e53935', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' },
  btnDisabled: { padding: '7px 14px', background: '#f0f0f0', color: '#bbb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' },
  btnRush: { padding: '5px 10px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' },
};
