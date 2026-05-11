import crypto from 'crypto';
import { makeClient } from './client.js';
import { randomDevice } from '../config.js';

const accounts = new Map();

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

export function getAccount(phone) {
  return accounts.get(phone) || null;
}

export function getAllAccounts() {
  const result = [];
  for (const [phone, s] of accounts) {
    result.push({
      phone,
      studentName: s.studentName,
      schoolName: s.schoolName,
      gender: s.gender,
      status: s.status || 'idle',
      lastActivity: s.lastActivity || null,
      loginAt: s.loginAt,
    });
  }
  return result;
}

export function removeAccount(phone) {
  accounts.delete(phone);
}

export async function loginAccount(phone, password) {
  const device = randomDevice();
  const tempClient = makeClient(null);
  const body = { userPhone: phone, password: md5(password), ...device };
  const user = await tempClient.post('v1/auth/login/password', body);
  if (!user) throw new Error('Login failed: empty response');
  const token = user.oauthToken?.token;
  if (!token) throw new Error('Login failed: no token');

  const account = {
    phone,
    token,
    userId: user.userId,
    studentId: user.studentId || user.userId,
    schoolId: user.schoolId,
    gender: user.gender,
    studentName: user.studentName,
    schoolName: user.schoolName,
    device,
    client: makeClient(token),
    status: 'idle',
    lastActivity: null,
    loginAt: new Date().toISOString(),
  };

  accounts.set(phone, account);
  return account;
}

export async function loginAccountByToken(phone, token) {
  const client = makeClient(token);
  try {
    const user = await client.get('v1/auth/query/token');
    if (!user) throw new Error('Token invalid');

    const device = randomDevice();
    const account = {
      phone,
      token,
      userId: user.userId,
      studentId: user.studentId || user.userId,
      schoolId: user.schoolId,
      gender: user.gender,
      studentName: user.studentName,
      schoolName: user.schoolName,
      device,
      client,
      status: 'idle',
      lastActivity: null,
      loginAt: new Date().toISOString(),
    };

    accounts.set(phone, account);
    return account;
  } catch (e) {
    accounts.delete(phone);
    throw e;
  }
}
