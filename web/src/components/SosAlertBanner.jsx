import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';
import { getDistanceKm } from '../utils/geoDistance';

const SosAlertBanner = () => {
  const location = useLocation();
  const [nearbySosRequests, setNearbySosRequests] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [dismissedSosIds, setDismissedSosIds] = useState([]);

  const loadSosRequests = useCallback(() => {
    try {
      const sosRequests = [];
      if (!currentLocation) {
        setNearbySosRequests([]);
        return;
      }
      const nearby = sosRequests.filter((req) => {
        if (req.status !== 'open' || !req.coordinates) return false;
        const d = getDistanceKm(
          currentLocation.latitude,
          currentLocation.longitude,
          req.coordinates.lat,
          req.coordinates.lng,
        );
        return d <= 5;
      });
      setNearbySosRequests(nearby);
    } catch (error) {
      logger.error('SOS 요청 로드 실패:', error);
    }
  }, [currentLocation]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          logger.error('위치 가져오기 실패:', error);
        },
      );
    }
  }, []);

  useEffect(() => {
    loadSosRequests();
    const interval = setInterval(() => {
      loadSosRequests();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadSosRequests]);

  const handleDismiss = (id) => {
    setDismissedSosIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      return next;
    });
  };

  // 메인 화면(/main)에서는 SOS 배너를 표시하지 않음
  if (location.pathname === '/main') return null;

  if (nearbySosRequests.length === 0) return null;

  const activeRequest = nearbySosRequests[0];
  if (!activeRequest || dismissedSosIds.includes(activeRequest.id)) return null;

  return (
    <div style={{ padding: '8px 16px' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #ff6b35, #ff9e7d)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '14px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          boxShadow: '0 4px 15px rgba(255, 107, 53, 0.2)',
        }}
      >
        <span>
          <b>SOS</b> 주변에 도움이 필요한 이웃이 있습니다.
        </span>
        <button
          type="button"
          onClick={() => handleDismiss(activeRequest.id)}
          style={{
            border: 'none',
            background: 'rgba(0,0,0,0.15)',
            color: 'white',
            borderRadius: '999px',
            padding: '4px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default SosAlertBanner;

