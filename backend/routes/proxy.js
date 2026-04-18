'use strict';

/**
 * 외부 공공/오픈 API — serviceKey 이중 인코딩 방지
 */

const express = require('express');
const axios = require('axios');

const router = express.Router();

const KMA_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';

function normalizeDataGoKrServiceKey(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s === 'your_kma_api_key_here') return '';
  try {
    if (/%[0-9A-Fa-f]{2}/.test(s)) {
      return decodeURIComponent(s);
    }
  } catch (_) {
    /* keep raw */
  }
  return s;
}

router.get('/kma/ultra-srt-ncst', async (req, res) => {
  const serviceKey = normalizeDataGoKrServiceKey(
    process.env.KMA_API_KEY ||
      process.env.DATA_GO_KR_SERVICE_KEY ||
      process.env.VITE_KMA_API_KEY ||
      ''
  );
  if (!serviceKey) {
    return res.status(503).json({
      success: false,
      error: 'Weather proxy is not configured (set KMA_API_KEY or DATA_GO_KR_SERVICE_KEY on the server).',
    });
  }

  const { base_date, base_time, nx, ny } = req.query;
  if (!base_date || !base_time || nx == null || ny == null) {
    return res.status(400).json({
      success: false,
      error: 'Missing required query: base_date, base_time, nx, ny',
    });
  }

  try {
    const { data, status } = await axios.get(KMA_BASE, {
      params: {
        serviceKey,
        pageNo: 1,
        numOfRows: 20,
        dataType: 'JSON',
        base_date: String(base_date),
        base_time: String(base_time),
        nx: String(nx),
        ny: String(ny),
      },
      timeout: 20000,
      validateStatus: () => true,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LiveJourney-weather-proxy/1.0',
      },
      paramsSerializer: { indexes: null },
    });

    if (typeof data === 'string') {
      return res.status(502).json({
        success: false,
        error: 'KMA returned non-JSON (check API key and endpoint).',
        rawPreview: data.slice(0, 200),
      });
    }

    if (status >= 400 && typeof data !== 'object') {
      return res.status(502).json({
        success: false,
        error: 'KMA upstream HTTP error',
        status,
      });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({
      success: false,
      error: e?.message || 'Upstream weather request failed',
    });
  }
});

router.get('/traffic/seoul', async (_req, res) => {
  const key = process.env.SEOUL_TRAFFIC_API_KEY;
  if (!key || !String(key).trim()) {
    return res.status(503).json({
      success: false,
      error: 'Seoul traffic proxy is not configured (set SEOUL_TRAFFIC_API_KEY on the server).',
    });
  }

  const url = `http://openapi.seoul.go.kr:8088/${String(key).trim()}/json/TrafficInfo/1/10/`;

  try {
    const { data, status } = await axios.get(url, {
      timeout: 12000,
      validateStatus: () => true,
    });
    return res.status(status >= 400 ? 502 : 200).json(data);
  } catch (e) {
    return res.status(502).json({
      success: false,
      error: e?.message || 'Upstream traffic request failed',
    });
  }
});

module.exports = router;
