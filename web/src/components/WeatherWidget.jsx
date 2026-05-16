import React, { useState, useEffect } from 'react';
import { getWeatherByRegion } from '../api/weather';
import { logger } from '../utils/logger';

const WeatherWidget = ({ region = '서울' }) => {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const data = await getWeatherByRegion(region);
                if (data && data.weather) {
                    setWeather(data.weather);
                }
            } catch (error) {
                logger.error('Failed to fetch weather:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
        // Refresh every 30 minutes
        const interval = setInterval(fetchWeather, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [region]);

    if (loading) return <div style={{ fontSize: '12px', color: '#9ca3af' }}>날씨 로딩중...</div>;
    if (!weather) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '6px 10px', borderRadius: '20px' }}>
            <span>{weather.icon}</span>
            <span>{weather.temperature}</span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{weather.condition}</span>
        </div>
    );
};

export default WeatherWidget;
