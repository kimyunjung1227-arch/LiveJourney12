import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';

const MapPhotoGridScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [photos, setPhotos] = useState([]);
  const sheetRef = useRef(null);
  const dragHandleRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const pins = location.state?.visiblePins || [];
    setPhotos(pins);
    setTimeout(() => setIsVisible(true), 10);
  }, [location.state]);

  const handleDragStart = (e) => {
    setIsDragging(true);
    setStartY(e.type === 'mousedown' ? e.clientY : e.touches[0].clientY);
    setCurrentY(0);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
    const deltaY = clientY - startY;
    if (deltaY > 0) setCurrentY(deltaY);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (currentY > 100) {
      handleClose();
    } else {
      setCurrentY(0);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => navigate(-1), 300);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove);
      document.addEventListener('touchend', handleDragEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, currentY]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      pointerEvents: 'all',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.3s ease-out'
    }}>
      <div
        ref={sheetRef}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
          backgroundColor: 'white',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          transform: isVisible 
            ? `translateY(${currentY}px)` 
            : `translateY(100%)`,
          transition: isDragging 
            ? 'none' 
            : isVisible 
              ? 'transform 0.3s ease-out' 
              : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)'
        }}
      >
        <div
          ref={dragHandleRef}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{
            padding: '12px 0',
            display: 'flex',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none'
          }}
        >
          <div style={{
            width: '40px',
            height: '4px',
            backgroundColor: '#d4d4d8',
            borderRadius: '2px'
          }} />
        </div>

        <div style={{
          padding: '8px 16px 12px',
          borderBottom: '1px solid #f4f4f5'
        }}>
          <h1 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            margin: 0
          }}>주변 장소</h1>
        </div>

        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          padding: '16px'
        }}>
          <div style={{
            marginBottom: '12px',
            fontSize: '14px',
            color: '#71717a',
            fontWeight: '600'
          }}>
            총 {photos.length}개의 장소
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: '24px'
          }}>
            {photos.map((pin, index) => (
              <div
                key={pin.id || index}
                onClick={() => navigate('/map', { 
                  state: { 
                    selectedPin: {
                      id: pin.id,
                      lat: pin.lat,
                      lng: pin.lng,
                      title: pin.title
                    }
                  } 
                })}
                style={{
                  aspectRatio: '1',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <img
                  src={pin.image}
                  alt={pin.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '8px'
                }}>
                  <p style={{
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: '600',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}>
                    {pin.title}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#a1a1aa',
            fontSize: '14px'
          }}>
            <div style={{
              marginBottom: '8px',
              fontSize: '32px'
            }}>
              ✨
            </div>
            <p style={{
              fontWeight: '600',
              marginBottom: '4px',
              color: '#71717a'
            }}>
              현재 표시된 모든 장소를 확인했어요
            </p>
            <p style={{ margin: 0, fontSize: '13px' }}>
              지도를 이동하면 새로운 장소를 발견할 수 있어요
            </p>
          </div>

          {photos.length < 3 && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              backgroundColor: '#fef2f2',
              borderRadius: '12px',
              marginTop: '20px'
            }}>
              <p style={{
                fontSize: '14px',
                color: '#dc2626',
                fontWeight: '600',
                marginBottom: '12px'
              }}>
                이 지역에 더 많은 사진을 공유해주세요!
              </p>
              <button
                onClick={() => navigate('/upload')}
                style={{
                  backgroundColor: '#E8F4FB',
                  color: '#1A6EA8',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                사진 올리기
              </button>
            </div>
          )}

          <div style={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px',
            backgroundColor: 'white',
            borderTop: '1px solid #f4f4f5',
            marginTop: '20px',
            marginLeft: '-16px',
            marginRight: '-16px',
            marginBottom: '-16px'
          }}>
            <button
              onClick={handleClose}
              style={{
                width: '100%',
                backgroundColor: '#00BCD4',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255,107,53,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span className="material-symbols-outlined">map</span>
              <span>지도 보기</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 101
      }}>
        <BottomNavigation />
      </div>
    </div>
  );
};

export default MapPhotoGridScreen;

