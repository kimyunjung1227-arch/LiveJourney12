// 날씨: 우선 Supabase Edge Function `kma-ultra-ncst` (VITE_SUPABASE_*), 없으면 Node `/api/proxy/*`
import { getCoordinatesByRegion } from '../utils/regionCoordinates';
import { logger } from '../utils/logger';
import { getBackendOrigin } from '../utils/apiBase';

// 날씨 캐시 (5분간 유효)
const weatherCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 재시도 설정
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1초
const API_TIMEOUT = 10000; // 10초

/**
 * 재시도 로직이 포함된 fetch 함수
 * @param {string} url - API URL
 * @param {AbortSignal} signal - AbortSignal
 * @param {number} retries - 남은 재시도 횟수
 * @returns {Promise<Response>}
 */
const fetchWithRetry = async (url, signal, retries = MAX_RETRIES, fetchInit = {}) => {
  for (let i = 0; i < retries; i++) {
    try {
      logger.log(`🔄 기상청 API 호출 시도 ${i + 1}/${retries}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      // 기존 signal과 새로운 timeout signal 병합
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // 응답이 실패했지만 재시도 가능한 경우
      if (i < retries - 1) {
        logger.warn(`⚠️ API 응답 실패 (${response.status}), ${RETRY_DELAY}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
        continue;
      }

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        if (i < retries - 1) {
          logger.warn(`⏱️ 타임아웃 발생, ${RETRY_DELAY * (i + 1)}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
          continue;
        }
        throw error;
      }

      // 네트워크 오류 등
      if (i < retries - 1) {
        logger.warn(`🌐 네트워크 오류, ${RETRY_DELAY * (i + 1)}ms 후 재시도...`, error.message);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)));
        continue;
      }

      throw error;
    }
  }

  throw new Error('모든 재시도 실패');
};

const pad2 = (n) => String(n).padStart(2, '0');

/** KST 기준 초단기실황 요청 시각 (40분 이전이면 이전 정시, hoursBack만큼 더 과거) */
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

/** Supabase Edge Function 우선, 없으면 Node 프록시 */
function buildKmaProxyUrl(searchParams) {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/kma-ultra-ncst?${searchParams.toString()}`;
  }
  const origin = getBackendOrigin();
  return `${origin}/api/proxy/kma/ultra-srt-ncst?${searchParams.toString()}`;
}

function buildKmaFetchInit() {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anon) return {};
  return {
    headers: {
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
  };
}

/**
 * 지역별 날씨 정보 가져오기 (캐시 + 재시도 + 타임아웃 적용)
 * @param {string} regionName - 지역명 (예: '서울', '부산')
 * @param {boolean} forceRefresh - 캐시 무시하고 강제 새로고침
 * @returns {Promise<Object>} 날씨 정보
 */
export const getWeatherByRegion = async (regionName, forceRefresh = false) => {
  logger.log('🌦️ 날씨 API 호출 시작:', regionName);

  // 캐시 확인 - 있으면 즉시 반환! (강제 새로고침이 아닐 때만)
  if (!forceRefresh) {
    const cached = weatherCache.get(regionName);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      logger.log(`⚡ 캐시된 날씨 정보 즉시 반환: ${regionName}`);
      return cached.data;
    }
  }

  // 실제 기상청 API 호출 (재시도 로직 포함)
  try {
    // 지역 좌표 가져오기
    const coords = getCoordinatesByRegion(regionName);

    logger.log(`📍 지역 좌표 조회: ${regionName}`, coords);

    if (!coords || !coords.nx || !coords.ny) {
      logger.error(`❌ 지역 좌표 없음 또는 잘못됨: ${regionName}`, coords);
      throw new Error(`지역 좌표 없음: ${regionName}`);
    }

    logger.log(`🔍 기상청(프록시) API 호출: ${regionName} (nx:${coords.nx}, ny:${coords.ny})`);

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
      const fullUrl = buildKmaProxyUrl(params);
      if (import.meta.env.DEV) {
        logger.log('🌐 날씨 프록시 URL:', fullUrl);
      }

      const response = await fetchWithRetry(fullUrl, null, MAX_RETRIES, buildKmaFetchInit());
      logger.log('📡 API 응답 상태:', response.status);

      if (!response.ok) {
        let detail = response.statusText;
        try {
          const errBody = await response.clone().json();
          if (errBody?.error) detail = String(errBody.error);
        } catch (_) {}
        if (response.status === 503) {
          throw new Error(
            '날씨 프록시가 설정되지 않았습니다. 백엔드에 KMA_API_KEY(또는 DATA_GO_KR_SERVICE_KEY)를 설정해 주세요.'
          );
        }
        throw new Error(`HTTP ${response.status}: ${detail}`);
      }

      const data = await response.json();
      logger.log('📦 API 응답 데이터:', data);

      const header = data?.response?.header;
      const code = header?.resultCode;
      const rawItems = data?.response?.body?.items?.item;

      if (code === '03' || code === '02' || !rawItems) {
        lastError = header?.resultMsg || `NO_DATA (${code || 'empty'})`;
        logger.warn(`⚠️ 기상청 데이터 없음, 이전 시각 재시도: ${lastError}`);
        continue;
      }

      if (code !== '00') {
        lastError = header?.resultMsg || 'API 응답 실패';
        logger.error('❌ API 응답 오류:', header);
        throw new Error(lastError);
      }

      const items = normalizeKmaItems(rawItems);
      if (items.length === 0) {
        lastError = '관측 항목 없음';
        logger.warn('⚠️ items 비어 있음, 이전 시각 재시도');
        continue;
      }

      let temperature = '23';
      let sky = '맑음';
      let icon = '☀️';
      let humidity = '60%';
      let wind = '5m/s';

      items.forEach((item) => {
        if (item.category === 'T1H' && item.obsrValue != null && item.obsrValue !== '') {
          temperature = Math.round(Number(item.obsrValue));
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
          humidity = `${Math.round(Number(item.obsrValue))}%`;
        }
        if (item.category === 'WSD' && item.obsrValue != null && item.obsrValue !== '') {
          wind = `${Number(item.obsrValue).toFixed(1)}m/s`;
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

      weatherCache.set(regionName, {
        data: result,
        timestamp: Date.now(),
      });

      logger.log(`✅ 기상청 API 성공: ${regionName} - ${sky}, ${temperature}℃`);
      return result;
    }

    throw new Error(lastError || '해당 지역 최신 관측 데이터를 찾지 못했습니다.');

  } catch (error) {
    logger.error(`❌ 기상청 API 최종 실패: ${regionName}`, error.message);

    // 캐시에 이전 데이터가 있으면 그것을 반환 (완전히 실패한 경우에만)
    const cached = weatherCache.get(regionName);
    if (cached) {
      logger.log(`🔄 캐시된 이전 데이터 반환: ${regionName}`);
      return cached.data;
    }

    return {
      success: false,
      error: error.message,
      weather: { icon: '🌤️', condition: '-', temperature: '-', humidity: '-', wind: '-' }
    };
  }
};

/**
 * 날씨 아이콘 가져오기
 * @param {string} condition - 날씨 상태 (맑음, 흐림, 비, 눈 등)
 * @returns {string} 이모지 아이콘
 */
export const getWeatherIcon = (condition) => {
  const iconMap = {
    '맑음': '☀️',
    '구름조금': '🌤️',
    '흐림': '☁️',
    '비': '🌧️',
    '눈': '❄️',
    '천둥번개': '⛈️',
    '안개': '🌫️'
  };

  return iconMap[condition] || '🌤️';
};

/**
 * 교통 정보 가져오기 (실제 API + Fallback)
 * @param {string} regionName - 지역명
 * @returns {Promise<Object>} 교통 정보
 */
export const getTrafficByRegion = async (regionName) => {
  try {
    // 서울 지역 - 서울시 오픈API (키는 백엔드 프록시에서만 사용)
    if (regionName.includes('서울')) {
      try {
        const origin = getBackendOrigin();
        const response = await fetch(`${origin}/api/proxy/traffic/seoul`);
        if (!response.ok) {
          throw new Error(`traffic proxy ${response.status}`);
        }
        const data = await response.json();

        if (data.TrafficInfo?.row) {
          // 평균 혼잡도 계산
          const avgSpeed = data.TrafficInfo.row.reduce((sum, item) =>
            sum + parseFloat(item.PRCS_SPD || 30), 0
          ) / data.TrafficInfo.row.length;

          let icon, status, congestionLevel;

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
            traffic: { icon, status, congestionLevel, isRealTime: true }
          };
        }
      } catch (error) {
        logger.error('서울시 교통 API(프록시) 오류:', error);
      }
    }

    // Fallback: 시간대 기반 스마트 추정
    return getSmartTrafficEstimate(regionName);

  } catch (error) {
    logger.error('교통 정보 조회 실패:', error);
    return getSmartTrafficEstimate(regionName);
  }
};

/**
 * 시간대 기반 스마트 교통 추정 (Fallback)
 * @param {string} regionName - 지역명
 * @returns {Object} 추정 교통 정보
 */
const getSmartTrafficEstimate = (regionName) => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  const majorCities = ['서울', '부산', '대구', '인천', '대전', '광주'];
  const isMajorCity = majorCities.some(city => regionName.includes(city) || city.includes(regionName));

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
    } else {
      if (hour >= 11 && hour <= 19) {
        congestionLevel = 'medium';
        status = '교통 보통';
        icon = '🚙';
      }
    }
  } else {
    const touristAreas = ['제주', '강릉', '속초', '경주', '여수'];
    if (touristAreas.some(area => regionName.includes(area)) && isWeekend && hour >= 10 && hour <= 17) {
      congestionLevel = 'medium';
      status = '교통 보통';
      icon = '🚙';
    }
  }

  return {
    success: true,
    traffic: {
      icon,
      status,
      congestionLevel,
      isEstimated: true
    }
  };
};

/**
 * 교통 아이콘 가져오기
 * @param {string} level - 혼잡도 (low, medium, high)
 * @returns {string} 이모지 아이콘
 */
export const getTrafficIcon = (level) => {
  const iconMap = {
    'low': '🚗',      // 원활
    'medium': '🚙',   // 보통
    'high': '🚨'      // 혼잡
  };

  return iconMap[level] || '🚗';
};

/**
 * 교통 상태 텍스트 가져오기
 * @param {string} level - 혼잡도
 * @returns {string} 상태 텍스트
 */
export const getTrafficStatus = (level) => {
  const statusMap = {
    'low': '교통 원활',
    'medium': '교통 보통',
    'high': '교통 혼잡'
  };

  return statusMap[level] || '정보 없음';
};














































