
// 모바일용 날씨 API
// web/src/api/weather.js 로직을 React Native 호환되게 포팅

const MOCK_WEATHER_DATA = {
    '서울': { icon: '☀️', condition: '맑음', temperature: '23℃' },
    '부산': { icon: '🌤️', condition: '구름조금', temperature: '25℃' },
    '제주': { icon: '🌧️', condition: '비', temperature: '20℃' },
    '인천': { icon: '☁️', condition: '흐림', temperature: '22℃' },
    '대전': { icon: '☀️', condition: '맑음', temperature: '24℃' },
    '대구': { icon: '☀️', condition: '맑음', temperature: '26℃' },
    '광주': { icon: '🌤️', condition: '구름조금', temperature: '24℃' },
    '울산': { icon: '🌤️', condition: '구름조금', temperature: '25℃' },
    '강릉': { icon: '☀️', condition: '맑음', temperature: '21℃' },
    '경주': { icon: '☀️', condition: '맑음', temperature: '24℃' },
    '영덕': { icon: '☀️', condition: '맑음', temperature: '10℃' },
    '영덕군': { icon: '☀️', condition: '맑음', temperature: '10℃' },
    '포항': { icon: '🌤️', condition: '구름조금', temperature: '12℃' },
    '여수': { icon: '☀️', condition: '맑음', temperature: '18℃' },
    '전주': { icon: '☀️', condition: '맑음', temperature: '22℃' },
    '속초': { icon: '🌤️', condition: '구름조금', temperature: '19℃' },
};

/** 주소/지명 문자열에서 mock 키에 가장 잘 맞는 지역명 (날씨 조회용) */
export const guessWeatherRegionKey = (text) => {
    if (!text || typeof text !== 'string') return '서울';
    const keys = Object.keys(MOCK_WEATHER_DATA).sort((a, b) => b.length - a.length);
    for (const k of keys) {
        if (text.includes(k)) return k;
    }
    return '서울';
};

export const getWeatherByRegion = async (regionName) => {
    const mockWeather = MOCK_WEATHER_DATA[regionName] || MOCK_WEATHER_DATA['서울'];

    await new Promise(resolve => setTimeout(resolve, 500));

    return {
        success: true,
        weather: {
            ...mockWeather,
            humidity: '60%',
            wind: '5m/s'
        }
    };
};
