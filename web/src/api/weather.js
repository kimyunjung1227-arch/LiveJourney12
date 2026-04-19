// 날씨: Supabase Edge `kma-ultra-ncst` 우선(배포가 Supabase만 쓸 때). Edge 시크릿에 KMA_API_KEY.
// 로컬 또는 VITE_API_URL 로 Express를 쓰는 경우에만 Node `/api/proxy/kma/*` 후보에 포함.
import { getCoordinatesByRegion } from '../utils/regionCoordinates';
import { logger } from '../utils/logger';
import { getFetchApiUrl } from '../utils/apiBase';

const weatherCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const API_TIMEOUT = 20000;

const pad2 = (n) => String(n).padStart(2, '0');

function getKstNcstBaseDateTime(hoursBack = 0) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
  let Y = g('year');
  let M = g('month');
  let D = g('day');
  let H = g('hour');
  const Min = g('minute');

  if (Min < 40) {
    H -= 1;
  }
  H -= hoursBack;

  while (H < 0) {
    H += 24;
    const dt = new Date(Date.UTC(Y, M - 1, D));
    dt.setUTCDate(dt.getUTCDate() - 1);
    Y = dt.getUTCFullYear();
    M = dt.getUTCMonth() + 1;
    D = dt.getUTCDate();
  }

  return {
    baseDate: `${Y}${pad2(M)}${pad2(D)}`,
    baseTime: `${pad2(H)}00`,
  };
}

function normalizeKmaItems(raw) {
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

const fetchWithRetry = async (url, signal, retries = MAX_RETRIES, fetchInit = {}) => {
  for (let i = 0; i < retries; i++) {
    try {
      logger.log(`🔄 기상청 API 호출 시도 ${i + 1}/${retries}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) return response;
      if (i < retries - 1) {
        logger.warn(`⚠️ API 응답 실패 (${response.status}), ${RETRY_DELAY * (i + 1)}ms 후 재시도...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY * (i + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY * (i + 1)));
          continue;
        }
        throw error;
      }
      if (i < retries - 1) {
        logger.warn(`🌐 네트워크 오류, 재시도...`, error.message);
        await new Promise((r) => setTimeout(r, RETRY_DELAY * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('모든 재시도 실패');
};

/**
 * Supabase URL이 있으면 Edge를 1순위(서버 없이 기상청 키는 Edge 시크릿만).
 * Node 프록시는 로컬(dev) 또는 VITE_API_URL 로 별도 백엔드를 둔 경우에만 후보에 넣음.
 */
function buildKmaProxyUrlList(searchParams) {
  const q = searchParams.toString();
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const edgeUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/kma-ultra-ncst?${q}` : null;

  const nodeUrl = getFetchApiUrl(`/api/proxy/kma/ultra-srt-ncst?${q}`);
  const hasExplicitNodeApi = String(import.meta.env.VITE_API_URL || '').trim() !== '';

  const list = [];
  const wantEdge =
    edgeUrl && String(import.meta.env.VITE_WEATHER_USE_SUPABASE || 'true').trim() !== 'false';
  // Edge 게이트웨이는 Authorization + apikey(anon) 필수 — 없으면 UNAUTHORIZED_NO_AUTH_HEADER
  if (wantEdge && edgeUrl) {
    if (anonKey) {
      list.push(edgeUrl);
    } else {
      logger.warn(
        'VITE_SUPABASE_ANON_KEY 가 없어 Supabase Edge 날씨 호출을 건너뜁니다. 웹 빌드/호스팅 환경 변수에 anon 키를 넣으세요.'
      );
    }
  }
  if (import.meta.env.DEV || hasExplicitNodeApi) {
    if (!list.includes(nodeUrl)) list.push(nodeUrl);
  }
  if (list.length === 0) {
    list.push(nodeUrl);
  }
  return list;
}

function buildKmaFetchInit(fullUrl) {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anon) return {};
  try {
    const u = new URL(fullUrl);
    const base = new URL(supabaseUrl.includes('://') ? supabaseUrl : `https://${supabaseUrl}`);
    if (u.host !== base.host) return {};
  } catch {
    if (!String(fullUrl).startsWith(supabaseUrl)) return {};
  }
  return {
    headers: {
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
  };
}

function normalizeKmaResultCode(header) {
  const raw = header?.resultCode;
  if (raw == null || raw === '') return '';
  return String(raw).trim();
}

export const getWeatherByRegion = async (regionName, forceRefresh = false) => {
  logger.log('🌦️ 날씨 API 호출 시작:', regionName);

  if (!forceRefresh) {
    const cached = weatherCache.get(regionName);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      logger.log(`⚡ 캐시된 날씨 정보 즉시 반환: ${regionName}`);
      return cached.data;
    }
  }

  try {
    const coords = getCoordinatesByRegion(regionName);
    logger.log(`📍 지역 좌표: ${regionName}`, coords);
    if (!coords || coords.nx == null || coords.ny == null) {
      throw new Error(`지역 좌표 없음: ${regionName}`);
    }

    logger.log(`🔍 기상청 호출: ${regionName} (nx:${coords.nx}, ny:${coords.ny})`);
    let lastError = 'API 응답 실패';

    for (let hoursBack = 0; hoursBack < 4; hoursBack += 1) {
      const { baseDate, baseTime } = getKstNcstBaseDateTime(hoursBack);
      logger.log(`📅 기준시각(KST) 시도 ${hoursBack}: ${baseDate} ${baseTime}`);

      const params = new URLSearchParams({
        base_date: baseDate,
        base_time: baseTime,
        nx: String(coords.nx),
        ny: String(coords.ny),
      });
      const urlCandidates = buildKmaProxyUrlList(params);
      if (import.meta.env.DEV) {
        logger.log('🌐 날씨 프록시 후보:', urlCandidates);
      }

      let data = null;
      let responseOk = false;
      let httpErrorDetail = '';

      for (const fullUrl of urlCandidates) {
        try {
          const response = await fetchWithRetry(fullUrl, null, MAX_RETRIES, buildKmaFetchInit(fullUrl));
          logger.log('📡 API 응답 상태:', response.status, fullUrl.slice(0, 80));

          if (!response.ok) {
            let detail = response.statusText;
            try {
              const errBody = await response.clone().json();
              if (errBody?.error) detail = String(errBody.error);
            } catch (_) {}
            httpErrorDetail = detail;
            if (response.status === 503) {
              logger.warn(`⚠️ 프록시 미설정/불가 (${fullUrl.slice(0, 60)}…), 다음 경로 시도`);
            } else {
              logger.warn(`⚠️ HTTP ${response.status}, 다음 경로 시도`);
            }
            continue;
          }

          data = await response.json();
          responseOk = true;
          break;
        } catch (err) {
          httpErrorDetail = err?.message || String(err);
          logger.warn(`⚠️ 날씨 요청 실패, 다음 경로 시도:`, httpErrorDetail);
        }
      }

      if (!responseOk) {
        lastError = httpErrorDetail || '모든 날씨 프록시 경로 실패';
        if (lastError.includes('not configured') || lastError.includes('KMA_API_KEY')) {
          throw new Error(
            '날씨 프록시 미설정: backend에 KMA_API_KEY(또는 DATA_GO_KR_SERVICE_KEY)를 넣거나 Supabase Edge에 KMA 시크릿을 설정하세요.'
          );
        }
        logger.warn(`⚠️ HTTP 실패, 이전 시각 재시도: ${lastError}`);
        continue;
      }

      logger.log('📦 API 응답 헤더:', data?.response?.header);

      const header = data?.response?.header;
      const code = normalizeKmaResultCode(header);
      const rawItems = data?.response?.body?.items?.item;

      if (code === '03' || code === '3' || code === '02' || code === '2' || rawItems == null) {
        lastError = header?.resultMsg || `NO_DATA (${code || 'empty'})`;
        logger.warn(`⚠️ 데이터 없음, 이전 시각 재시도: ${lastError}`);
        continue;
      }

      if (code !== '00' && code !== '0') {
        lastError = header?.resultMsg || 'API 응답 실패';
        logger.error('❌ 기상청 오류 코드:', header);
        throw new Error(lastError);
      }

      const items = normalizeKmaItems(rawItems);
      if (items.length === 0) {
        lastError = '관측 항목 없음';
        logger.warn('⚠️ items 비어 있음, 이전 시각 재시도');
        continue;
      }

      let temperature = 23;
      let sky = '맑음';
      let icon = '☀️';
      let humidity = '60%';
      let wind = '5m/s';

      items.forEach((item) => {
        if (item.category === 'T1H' && item.obsrValue != null && item.obsrValue !== '') {
          const t = Number(item.obsrValue);
          if (!Number.isNaN(t)) temperature = Math.round(t);
        }
        if (item.category === 'PTY') {
          const ptyValue = parseInt(item.obsrValue, 10);
          if (ptyValue === 1 || ptyValue === 4) {
            sky = '비';
            icon = '🌧️';
          } else if (ptyValue === 2) {
            sky = '진눈깨비';
            icon = '🌨️';
          } else if (ptyValue === 3) {
            sky = '눈';
            icon = '❄️';
          }
        }
        if (item.category === 'SKY' && sky === '맑음') {
          const skyValue = parseInt(item.obsrValue, 10);
          if (skyValue === 3) {
            sky = '구름많음';
            icon = '🌤️';
          } else if (skyValue === 4) {
            sky = '흐림';
            icon = '☁️';
          }
        }
        if (item.category === 'REH' && item.obsrValue != null && item.obsrValue !== '') {
          const h = Number(item.obsrValue);
          if (!Number.isNaN(h)) humidity = `${Math.round(h)}%`;
        }
        if (item.category === 'WSD' && item.obsrValue != null && item.obsrValue !== '') {
          const w = Number(item.obsrValue);
          if (!Number.isNaN(w)) wind = `${w.toFixed(1)}m/s`;
        }
      });

      const result = {
        success: true,
        weather: {
          icon,
          condition: sky,
          temperature: `${temperature}℃`,
          humidity,
          wind,
        },
      };

      weatherCache.set(regionName, { data: result, timestamp: Date.now() });
      logger.log(`✅ 기상청 성공: ${regionName} — ${temperature}℃ ${sky}`);
      return result;
    }

    throw new Error(lastError || '해당 지역 최신 관측 데이터를 찾지 못했습니다.');
  } catch (error) {
    logger.error(`❌ 기상청 API 실패: ${regionName}`, error.message);
    const cached = weatherCache.get(regionName);
    if (cached) {
      logger.log(`🔄 캐시 반환: ${regionName}`);
      return cached.data;
    }
    return {
      success: false,
      error: error.message,
      weather: { icon: '🌤️', condition: '-', temperature: '-', humidity: '-', wind: '-' },
    };
  }
};

export const getWeatherIcon = (condition) => {
  const iconMap = {
    맑음: '☀️',
    구름조금: '🌤️',
    흐림: '☁️',
    비: '🌧️',
    눈: '❄️',
    천둥번개: '⛈️',
    안개: '🌫️',
  };
  return iconMap[condition] || '🌤️';
};

export const getTrafficByRegion = async (regionName) => {
  try {
    if (regionName.includes('서울')) {
      try {
        const response = await fetch(getFetchApiUrl('/api/proxy/traffic/seoul'));
        if (!response.ok) throw new Error(`traffic proxy ${response.status}`);
        const data = await response.json();
        if (data.TrafficInfo?.row) {
          const avgSpeed =
            data.TrafficInfo.row.reduce((sum, item) => sum + parseFloat(item.PRCS_SPD || 30), 0) /
            data.TrafficInfo.row.length;
          let icon;
          let status;
          let congestionLevel;
          if (avgSpeed >= 40) {
            icon = '🚗';
            status = '교통 원활';
            congestionLevel = 'low';
          } else if (avgSpeed >= 20) {
            icon = '🚙';
            status = '교통 보통';
            congestionLevel = 'medium';
          } else {
            icon = '🚨';
            status = '교통 혼잡';
            congestionLevel = 'high';
          }
          return {
            success: true,
            traffic: { icon, status, congestionLevel, isRealTime: true },
          };
        }
      } catch (error) {
        logger.error('서울 교통 API 오류:', error);
      }
    }
    return getSmartTrafficEstimate(regionName);
  } catch (error) {
    logger.error('교통 정보 조회 실패:', error);
    return getSmartTrafficEstimate(regionName);
  }
};

const getSmartTrafficEstimate = (regionName) => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const majorCities = ['서울', '부산', '대구', '인천', '대전', '광주'];
  const isMajorCity = majorCities.some((city) => regionName.includes(city) || city.includes(regionName));
  let congestionLevel = 'low';
  let status = '교통 원활';
  let icon = '🚗';
  if (isMajorCity) {
    if (!isWeekend) {
      if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 20)) {
        congestionLevel = 'high';
        status = '교통 혼잡';
        icon = '🚨';
      } else if ((hour >= 12 && hour <= 14) || (hour >= 17 && hour <= 18)) {
        congestionLevel = 'medium';
        status = '교통 보통';
        icon = '🚙';
      }
    } else if (hour >= 11 && hour <= 19) {
      congestionLevel = 'medium';
      status = '교통 보통';
      icon = '🚙';
    }
  } else {
    const touristAreas = ['제주', '강릉', '속초', '경주', '여수'];
    if (
      touristAreas.some((area) => regionName.includes(area)) &&
      isWeekend &&
      hour >= 10 &&
      hour <= 17
    ) {
      congestionLevel = 'medium';
      status = '교통 보통';
      icon = '🚙';
    }
  }
  return {
    success: true,
    traffic: { icon, status, congestionLevel, isEstimated: true },
  };
};

export const getTrafficIcon = (level) => {
  const m = { low: '🚗', medium: '🚙', high: '🚨' };
  return m[level] || '🚗';
};

export const getTrafficStatus = (level) => {
  const m = { low: '교통 원활', medium: '교통 보통', high: '교통 혼잡' };
  return m[level] || '정보 없음';
};
