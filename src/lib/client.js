import axios from 'axios';
import { BASE_URL, APPKEY } from '../config.js';
import { computeSign } from './sign.js';

export function makeClient(token) {
  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config) => {
    const fullUrl = new URL(config.url, BASE_URL);
    if (config.params) {
      for (const [k, v] of Object.entries(config.params)) {
        if (v !== undefined && v !== null) fullUrl.searchParams.set(k, String(v));
      }
    }
    const sign = computeSign(fullUrl.toString(), config.data || null);
    config.headers['appKey'] = APPKEY;
    config.headers['sign'] = sign;
    if (token) config.headers['token'] = token;
    return config;
  });

  instance.interceptors.response.use(
    (res) => {
      const data = res.data;
      if (data.code !== undefined && data.code !== 10000) {
        const err = new Error(data.msg || `API error code: ${data.code}`);
        err.code = data.code;
        err.response = data;
        throw err;
      }
      return data.response !== undefined ? data.response : data;
    },
    (err) => { throw err; }
  );

  return instance;
}
