/**
 * YoLink API Client — low-level API calls
 */
const auth = require('./yolink-auth');
const { makeLogger } = require('../../logger');
const log = makeLogger('yolink');

const API_URL = 'https://api.yosmart.com/open/yolink/v2/api';

async function callApi(method, params = {}) {
  const token = await auth.getToken();
  const timeout = parseInt(process.env.YOLINK_TIMEOUT_SECONDS || '20', 10) * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        method,
        time: Date.now(),
        ...params,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YoLink API ${method} failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    if (data.code !== '000000') {
      throw new Error(`YoLink API ${method} error: code=${data.code} desc=${data.desc || ''}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getDeviceList() {
  const result = await callApi('Home.getDeviceList');
  return result.data?.devices || [];
}

async function getDeviceState(deviceId, deviceType = 'THSensor') {
  const result = await callApi(`${deviceType}.getState`, {
    targetDevice: deviceId,
  });
  return result.data;
}

async function getHomeInfo() {
  const result = await callApi('Home.getGeneralInfo');
  return result.data;
}

async function testConnection() {
  try {
    const home = await getHomeInfo();
    return { ok: true, home };
  } catch (err) {
    log.error('YoLink connection test failed', { error: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = { callApi, getDeviceList, getDeviceState, getHomeInfo, testConnection };
