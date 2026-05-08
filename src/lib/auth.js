import crypto from 'crypto';
import client, { setToken } from './client.js';
import { randomDevice } from '../config.js';

let session = null;

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

export function getSession() {
  return session;
}

export function setSession(s) {
  session = s;
  if (s?.token) setToken(s.token);
}

export async function login(userPhone, password) {
  const device = randomDevice();
  const body = {
    userPhone,
    password: md5(password),
    ...device,
  };

  const user = await client.post('v1/auth/login/password', body);
  if (!user) throw new Error('Login failed: empty response');

  const token = user.oauthToken?.token;
  if (!token) throw new Error('Login failed: no token in response');

  setToken(token);
  session = {
    token,
    userId: user.userId,
    studentId: user.studentId || user.userId,
    schoolId: user.schoolId,
    gender: user.gender,
    studentName: user.studentName,
    schoolName: user.schoolName,
    device,
  };

  return session;
}

export async function loginByToken(token) {
  setToken(token);
  try {
    const user = await client.get('v1/auth/query/token');
    if (!user) throw new Error('Token invalid');

    const device = randomDevice();
    session = {
      token,
      userId: user.userId,
      studentId: user.studentId || user.userId,
      schoolId: user.schoolId,
      gender: user.gender,
      studentName: user.studentName,
      schoolName: user.schoolName,
      device,
    };
    return session;
  } catch (e) {
    setToken(null);
    session = null;
    throw e;
  }
}
