import axios from 'axios';
import { BASE_URL, APPKEY } from '../config.js';
import { computeSign } from './sign.js';

let currentToken = null;

export function setToken(token) {
  currentToken = token || null;
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const fullUrl = new URL(config.url, BASE_URL);
  if (config.params) {
    for (const [k, v] of Object.entries(config.params)) {
      if (v !== undefined && v !== null) fullUrl.searchParams.set(k, String(v));
    }
  }

  const bodyData = config.data || null;
  const sign = computeSign(fullUrl.toString(), bodyData);

  config.headers['appKey'] = APPKEY;
  config.headers['sign'] = sign;
  if (currentToken) {
    config.headers['token'] = currentToken;
  }

  return config;
});

client.interceptors.response.use(
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
  (err) => {
    throw err;
  }
);

export default client;
