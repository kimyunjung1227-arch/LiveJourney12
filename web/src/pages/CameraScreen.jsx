import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconX,
  IconBolt,
  IconBoltOff,
  IconRotate2,
  IconShieldCheck,
  IconMapPin,
  IconCamera,
  IconAlertTriangle,
  IconPlayerStopFilled,
} from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import { useCamera } from '../hooks/useCamera';
import { useGeolocation } from '../hooks/useGeolocation';

const KEY = LJ.key; // 키컬러
const DARK = '#0A0A0A';
const OVERLAY = 'rgba(0,0,0,0.45)';
const OVERLAY_STRONG = 'rgba(0,0,0,0.6)';
const RED = 'rgb(220, 38, 38)';
const KEY_BG_15 = 'rgba(77,184,232,0.15)';
const KEY_BG_50 = 'rgba(77,184,232,0.5)';
const WHITE_85 = 'rgba(255,255,255,0.85)';
const WHITE_60 = 'rgba(255,255,255,0.6)';
const CONTROL_BG = 'rgba(255,255,255,0.15)';

/** 캡처 데이터 핸드오프 키 — UploadScreen에서 이 키로 읽어 처리한다. */
export const PENDING_CAPTURE_KEY = 'lj:pendingCapture';

/**
 * 카메라 화면 (/camera).
 * 권한 상태에 따라 PermissionRequest / CameraView / PermissionDenied 분기.
 * 캡처 결과는 sessionStorage(PENDING_CAPTURE_KEY)에 저장 후 /upload로 이동.
 */
function CameraScreen() {
  const navigate = useNavigate();
  const cam = useCamera();
  const geo = useGeolocation();

  if (cam.permission === 'idle' || cam.permission === 'requesting') {
    return <PermissionRequest onRequest={cam.requestPermission} loading={cam.permission === 'requesting'} onClose={() => navigate(-1)} />;
  }
  if (cam.permission === 'denied') {
    return <PermissionDenied onClose={() => navigate(-1)} />;
  }
  if (cam.permission === 'unsupported') {
    return <PermissionDenied unsupported onClose={() => navigate(-1)} />;
  }
  return <CameraView cam={cam} geo={geo} onClose={() => navigate(-1)} navigate={navigate} />;
}

/* -------------------- 권한 요청 -------------------- */
function PermissionRequest({ onRequest, loading, onClose }) {
  return (
    <DarkFrame onClose={onClose}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          textAlign: 'center',
          fontFamily: LJ.fontStack,
          color: '#fff',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: KEY_BG_15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <IconCamera size={30} stroke={1.8} color={KEY} />
        </div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>
          카메라 권한이 필요해요
        </h2>
        <p style={{ marginTop: 8, fontSize: 13, color: WHITE_85, lineHeight: 1.6 }}>
          라이브저니는 지금 거기 있는 사람만 찍을 수 있어요.
          <br />
          갤러리 사진은 받지 않아요.
        </p>
        <button
          type="button"
          onClick={onRequest}
          disabled={loading}
          style={{
            marginTop: 22,
            padding: '14px 22px',
            background: loading ? CONTROL_BG : KEY,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            minWidth: 200,
          }}
        >
          {loading ? '권한 요청 중...' : '카메라 시작하기'}
        </button>
      </div>
    </DarkFrame>
  );
}

/* -------------------- 권한 거부 / 미지원 -------------------- */
function PermissionDenied({ unsupported = false, onClose }) {
  return (
    <DarkFrame onClose={onClose}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          textAlign: 'center',
          fontFamily: LJ.fontStack,
          color: '#fff',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(220,38,38,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <IconAlertTriangle size={30} stroke={1.8} color={RED} />
        </div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>
          {unsupported ? '이 브라우저는 카메라를 지원하지 않아요' : '카메라 접근이 막혀 있어요'}
        </h2>
        <p style={{ marginTop: 8, fontSize: 13, color: WHITE_85, lineHeight: 1.6 }}>
          {unsupported ? (
            <>최신 브라우저(Chrome, Safari, Edge 등)에서 다시 열어주세요.</>
          ) : (
            <>
              브라우저 설정 → 사이트 권한 → 카메라 허용으로 바꾼 뒤
              <br />
              다시 시도해주세요.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 22,
            padding: '12px 18px',
            background: CONTROL_BG,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </div>
    </DarkFrame>
  );
}

/* -------------------- 다크 프레임 (상단 X 닫기) -------------------- */
function DarkFrame({ children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: DARK,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        fontFamily: LJ.fontStack,
      }}
    >
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5 }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: OVERLAY_STRONG,
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <IconX size={20} stroke={2} />
        </button>
      </div>
      {children}
    </div>
  );
}

/* -------------------- 카메라 뷰 -------------------- */
function CameraView({ cam, geo, onClose, navigate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordIntervalRef = useRef(null);

  useEffect(() => {
    if (cam.isRecording) {
      setRecordSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
    }
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [cam.isRecording]);

  const handoffAndNavigate = (blob, mode) => {
    const url = URL.createObjectURL(blob);
    const payload = {
      url,
      mode,
      mimeType: blob.type,
      size: blob.size,
      capturedAt: new Date().toISOString(),
      facingMode: cam.facingMode,
      lat: geo.coords?.lat ?? null,
      lng: geo.coords?.lng ?? null,
      accuracy: geo.accuracy ?? null,
      placeName: geo.placeName ?? null,
    };
    try {
      sessionStorage.setItem(
        'lj:pendingCapture',
        JSON.stringify(payload)
      );
    } catch (_) {}
    navigate('/upload', { state: { fromCamera: true, capture: payload } });
  };

  const handleShutter = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (cam.mode === 'photo') {
        const blob = await cam.capturePhoto();
        handoffAndNavigate(blob, 'photo');
      } else if (cam.mode === 'video') {
        if (!cam.isRecording) {
          cam.startRecording();
        } else {
          const blob = await cam.stopRecording();
          handoffAndNavigate(blob, 'video');
        }
      }
    } catch (e) {
      setError(e?.message || '잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: DARK,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        fontFamily: LJ.fontStack,
        color: '#fff',
      }}
    >
      {/* 비디오 (전면 카메라면 미러 표시) */}
      <video
        ref={cam.videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: cam.facingMode === 'user' ? 'scaleX(-1)' : 'none',
          background: DARK,
        }}
      />

      {/* 뷰파인더 4모서리 가이드 + 녹화 시 빨간 보더 */}
      <ViewfinderGuide recording={cam.isRecording} />

      {/* 상단: [X 닫기] [EXIF 또는 녹화 시간] [플래시] */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 5,
        }}
      >
        <CircleButton onClick={onClose} aria-label="닫기">
          <IconX size={20} stroke={2} />
        </CircleButton>

        {cam.isRecording ? (
          <Pill background={RED}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#fff',
                animation: 'lj-pulse-dot 1s ease-in-out infinite',
              }}
            />
            REC {formatSeconds(recordSeconds)}
          </Pill>
        ) : (
          <Pill background={OVERLAY}>
            <IconShieldCheck size={14} stroke={2} color={KEY} />
            EXIF 자동 인증
          </Pill>
        )}

        <CircleButton onClick={cam.toggleFlash} aria-label="플래시">
          {cam.flashOn ? (
            <IconBolt size={20} stroke={2} color={KEY} />
          ) : (
            <IconBoltOff size={20} stroke={2} />
          )}
        </CircleButton>
      </div>

      {/* 하단 컨트롤 영역 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '14px 18px calc(28px + env(safe-area-inset-bottom))',
          background:
            'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          zIndex: 5,
        }}
      >
        {/* GPS 상태바 */}
        <GPSStatusBar geo={geo} />

        {/* 모드 토글 (사진/영상) */}
        <ModeToggle
          mode={cam.mode}
          onChange={cam.setMode}
          disabled={cam.isRecording}
        />

        {/* 컨트롤: [전환] [셔터] [.] */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
          }}
        >
          <CircleButton
            onClick={cam.switchCamera}
            aria-label="카메라 전환"
            disabled={cam.isRecording}
            style={cam.isRecording ? { opacity: 0.4 } : null}
          >
            <IconRotate2 size={20} stroke={2} />
          </CircleButton>

          <ShutterButton
            mode={cam.mode}
            isRecording={cam.isRecording}
            busy={busy}
            onClick={handleShutter}
          />

          <div style={{ width: 36, height: 36 }} />
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(220,38,38,0.18)',
              border: `1px solid ${RED}`,
              borderRadius: 8,
              fontSize: 12,
              color: '#fff',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* 펄스 dot 키프레임 (간단 inline) */}
      <style>{`
        @keyframes lj-pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}

/* -------------------- 보조 컴포넌트 -------------------- */
function CircleButton({ children, onClick, disabled, style, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: OVERLAY,
        border: 'none',
        color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ children, background = OVERLAY }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 11px',
        background,
        borderRadius: 999,
        color: '#fff',
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </div>
  );
}

function ViewfinderGuide({ recording }) {
  const len = 28;
  const w = 3;
  const color = recording ? RED : KEY_BG_50;
  const inset = 24;
  const corners = [
    { top: inset, left: inset, borders: { borderTop: `${w}px solid ${color}`, borderLeft: `${w}px solid ${color}` } },
    { top: inset, right: inset, borders: { borderTop: `${w}px solid ${color}`, borderRight: `${w}px solid ${color}` } },
    { bottom: inset, left: inset, borders: { borderBottom: `${w}px solid ${color}`, borderLeft: `${w}px solid ${color}` } },
    { bottom: inset, right: inset, borders: { borderBottom: `${w}px solid ${color}`, borderRight: `${w}px solid ${color}` } },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: len,
            height: len,
            top: c.top,
            bottom: c.bottom,
            left: c.left,
            right: c.right,
            ...c.borders,
            borderTopLeftRadius: c.top && c.left ? 4 : 0,
            borderTopRightRadius: c.top && c.right ? 4 : 0,
            borderBottomLeftRadius: c.bottom && c.left ? 4 : 0,
            borderBottomRightRadius: c.bottom && c.right ? 4 : 0,
            zIndex: 3,
            pointerEvents: 'none',
            transition: 'border-color 200ms ease-out',
          }}
        />
      ))}
      {/* 녹화 중 화면 가장자리 약한 빨간 잔광 */}
      {recording && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 0 2px rgba(220,38,38,0.7)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}
    </>
  );
}

function GPSStatusBar({ geo }) {
  let label = '위치 확인 중...';
  let color = WHITE_60;
  let icon = <IconMapPin size={13} stroke={2} color={WHITE_60} />;
  if (geo.status === 'denied' || geo.status === 'unsupported') {
    label = '위치 권한이 없어요';
    color = WHITE_85;
  } else if (geo.placeName) {
    label = geo.placeName;
    color = '#fff';
    icon = <IconMapPin size={13} stroke={2} color={KEY} />;
  } else if (geo.coords) {
    label = `${geo.coords.lat.toFixed(4)}, ${geo.coords.lng.toFixed(4)}`;
    color = '#fff';
    icon = <IconMapPin size={13} stroke={2} color={KEY} />;
  }
  return (
    <div
      style={{
        display: 'inline-flex',
        alignSelf: 'center',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        background: OVERLAY,
        borderRadius: 999,
        color,
        fontSize: 11.5,
        fontWeight: 600,
        backdropFilter: 'blur(8px)',
      }}
    >
      {icon}
      {label}
    </div>
  );
}

function ModeToggle({ mode, onChange, disabled }) {
  return (
    <div
      style={{
        alignSelf: 'center',
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        background: OVERLAY,
        borderRadius: 999,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {[
        { id: 'photo', label: '사진' },
        { id: 'video', label: '영상' },
      ].map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => !disabled && onChange(m.id)}
            disabled={disabled}
            style={{
              padding: '5px 14px',
              borderRadius: 999,
              border: 'none',
              background: active ? '#fff' : 'transparent',
              color: active ? DARK : '#fff',
              fontFamily: LJ.fontStack,
              fontSize: 12,
              fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
              lineHeight: 1,
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function ShutterButton({ mode, isRecording, busy, onClick }) {
  const size = 72;
  const inner = isRecording ? 28 : mode === 'video' ? 56 : 60;
  const innerRadius = isRecording ? 6 : '50%';
  const innerColor = isRecording ? RED : mode === 'video' ? RED : '#fff';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={mode === 'photo' ? '사진 촬영' : isRecording ? '녹화 정지' : '녹화 시작'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'transparent',
        border: `3px solid #fff`,
        boxShadow: `0 0 0 3px ${KEY}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: busy ? 'wait' : 'pointer',
      }}
    >
      {isRecording ? (
        <IconPlayerStopFilled size={20} color={RED} />
      ) : (
        <span
          style={{
            display: 'inline-block',
            width: inner,
            height: inner,
            borderRadius: innerRadius,
            background: innerColor,
            transition: 'all 150ms ease-out',
          }}
        />
      )}
    </button>
  );
}

function formatSeconds(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default CameraScreen;
