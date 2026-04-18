'use strict';

/**
 * 외부 공공/오픈 API 호출을 서버에서만 수행합니다.
 * 클라이언트 번들에 serviceKey·서울시 API 키가 노출되지 않도록 합니다.
 */

const express = require('express');
const axios = require('axios');

const router = express.Router();

const KMA_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';

router.get('/kma/ultra-srt-ncst', async (req, res) => {
  const serviceKey = process.env.KMA_API_KEY || process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey || String(serviceKey).trim() === 'your_kma_api_key_here') {
    return res.status(503).json({
      success: false,
      error: 'Weather proxy is not configured (set KMA_API_KEY on the server).',
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
        serviceKey: String(serviceKey).trim(),
        pageNo: 1,
        numOfRows: 10,
        dataType: 'JSON',
        base_date: String(base_date),
        base_time: String(base_time),
        nx: String(nx),
        ny: String(ny),
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    const code = data?.response?.header?.resultCode;
    const http = code === '00' ? 200 : status >= 400 ? status : 502;
    return res.status(http).json(data);
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
