import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconX,
  IconBolt,
  IconBoltOff,
  IconRotate2,
  IconShieldCheck,
  IconShield,
  IconMapPin,
  IconCamera,
  IconAlertTriangle,
  IconCameraOff,
  IconPlayerStopFilled,
  IconPhoto,
  IconClock,
} from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';
import { useCamera } from '../hooks/useCamera';
import { useGeolocation } from '../hooks/useGeolocation';
import { EXIFRejectModal, EXIFConfirmModal } from '../components/lj/ExifModals';
import { validateGalleryFile } from '../lib/exif/validateGalleryFile';
import { setUploadMedia } from '../stores/uploadStore';

const DARK = '#0A0A0A';
const OVERLAY = 'rgba(0,0,0,0.45)';
const OVERLAY_STRONG = 'rgba(0,0,0,0.6)';
const RED = 'rgb(220, 38, 38)';
const KEY_BG_15 = 'rgba(77,184,232,0.15)';
const KEY_BG_30 = 'rgba(77,184,232,0.3)';
const WHITE_85 = 'rgba(255,255,255,0.85)';
const WHITE_70 = 'rgba(255,255,255,0.7)';
const WHITE_60 = 'rgba(255,255,255,0.6)';

const MAX_RECORD_SECONDS = 30;

function CameraScreen() {
  const navigate = useNavigate();
  const cam = useCamera();
  const geo = useGeolocation();

  // 갤러리 모달 상태
  const [galleryModal, setGalleryModal] = useState({
    type: null, // 'reject' | 'confirm' | null
    reason: null,
    minutesAgo: 0,
    file: null,
    takenAt: null,
    location: null,
  });
  const fileInputRef = useRef(null);

  const close = () => navigate(-1);

  const openGallery = () => {
    fileInputRef.current?.click();
  };

  const handoffAndGo = async ({
    file,
    source,
    mode,
    takenAt,
    lat,
    lng,
    placeName,
    exif,
  }) => {
    // 셔터/갤러리 확정 시점에 한 번 더 정밀 위치 받기 (캐시 또는 fresh)
    // EXIF에 GPS가 있으면 그것을 최우선, 그 외에는 정밀 위치 사용
    let finalLat = lat;
    let finalLng = lng;
    let finalAccuracy = geo.accuracy ?? null;
    if (lat == null || lng == null) {
      try {
        const precise = await geo.getPreciseLocation(8000);
        if (precise && Number.isFinite(precise.lat) && Number.isFinite(precise.lng)) {
          finalLat = precise.lat;
          finalLng = precise.lng;
          finalAccuracy = precise.accuracy ?? finalAccuracy;
        }
      } catch (_) {}
    }
    const url = URL.createObjectURL(file);
    setUploadMedia({
      file,
      url,
      source,
      mode,
      mimeType: file.type,
      size: file.size,
      takenAt: (takenAt || new Date()).toISOString(),
      lat: finalLat ?? null,
      lng: finalLng ?? null,
      accuracy: finalAccuracy,
      placeName: placeName ?? geo.placeName ?? null,
      facingMode: cam.facingMode,
      exif: exif || null,
    });
    navigate('/upload');
  };

  const handleGalleryFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능하도록
    if (!file) return;

    const result = await validateGalleryFile(file);
    if (!result.valid) {
      setGalleryModal({
        type: 'reject',
        reason: result.reason,
        minutesAgo: result.minutesAgo || 0,
        file: null,
        takenAt: null,
        location: null,
      });
      return;
    }
    setGalleryModal({
      type: 'confirm',
      reason: null,
      minutesAgo: result.minutesAgo,
      file,
      takenAt: result.takenAt,
      location: result.location || null,
      exif: result.exif || null,
    });
  };

  const handleConfirmGallery = () => {
    const { file, takenAt, location, exif } = galleryModal;
    setGalleryModal({
      type: null,
      reason: null,
      minutesAgo: 0,
      file: null,
      takenAt: null,
      location: null,
      exif: null,
    });
    if (!file) return;
    handoffAndGo({
      file,
      source: 'gallery',
      mode: file.type?.startsWith('video') ? 'video' : 'photo',
      takenAt,
      // EXIF에 GPS가 있으면 EXIF 우선, 없으면 현재 위치
      lat: location?.lat ?? geo.coords?.lat ?? null,
      lng: location?.lng ?? geo.coords?.lng ?? null,
      exif,
    });
  };

  if (cam.permission === 'idle' || cam.permission === 'requesting') {
    return (
      <PermissionRequest
        onRequest={cam.requestPermission}
        loading={cam.permission === 'requesting'}
        onClose={close}
      />
    );
  }
  if (cam.permission === 'denied') return <PermissionDenied onClose={close} />;
  if (cam.permission === 'unsupported') return <PermissionDenied unsupported onClose={close} />;

  return (
    <>
      <CameraView
        cam={cam}
        geo={geo}
        onClose={close}
        onOpenGallery={openGallery}
        onCapturedPhoto={(blob) => {
          const now = new Date();
          handoffAndGo({
            file: blob,
            source: 'camera',
            mode: 'photo',
            takenAt: now,
            // 카메라(in-app) 촬영은 canvas → EXIF 없음. lat/lng는 GPS에서 받음.
            lat: null,
            lng: null,
            exif: {
              source: 'in_app_camera',
              DateTimeOriginal: now.toISOString(),
              facingMode: cam.facingMode || null,
            },
          });
        }}
        onCapturedVideo={(blob) => {
          const now = new Date();
          handoffAndGo({
            file: blob,
            source: 'camera',
            mode: 'video',
            takenAt: now,
            lat: null,
            lng: null,
            exif: {
              source: 'in_app_camera',
              DateTimeOriginal: now.toISOString(),
              facingMode: cam.facingMode || null,
            },
          });
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={undefined}
        style={{ display: 'none' }}
        onChange={handleGalleryFile}
      />
      <EXIFRejectModal
        open={galleryModal.type === 'reject'}
        reason={galleryModal.reason}
        minutesAgo={galleryModal.minutesAgo}
        onRetake={() => setGalleryModal({ type: null })}
        onPickOther={() => {
          setGalleryModal({ type: null });
          setTimeout(openGallery, 50);
        }}
        onClose={() => setGalleryModal({ type: null })}
      />
      <EXIFConfirmModal
        open={galleryModal.type === 'confirm'}
        file={galleryModal.file}
        takenAt={galleryModal.takenAt}
        location={galleryModal.location}
        placeName={geo.placeName}
        onContinue={handleConfirmGallery}
        onPickOther={() => {
          setGalleryModal({ type: null });
          setTimeout(openGallery, 50);
        }}
        onClose={() => setGalleryModal({ type: null })}
      />
    </>
  );
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
          padding: '0 24px 24px',
          textAlign: 'center',
          fontFamily: LJ.fontStack,
          color: '#fff',
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            background: KEY_BG_15,
            border: `1.5px solid ${KEY_BG_30}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <IconCamera size={38} stroke={1.8} color={LJ.key} />
        </div>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, lineHeight: 1.4 }}>
          지금 거기 있는 사람만
          <br />
          찍을 수 있어요
        </h2>
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: WHITE_70,
            lineHeight: 1.6,
            maxWidth: 320,
          }}
        >
          라이브저니는 카메라가 자동으로 기록한 시간을 그대로 보여줘요. 조작할 수도,
          갤러리에서 옛 사진을 가져올 수도 없어요.
        </p>

        {/* 3가지 안내 리스트 */}
        <ul
          style={{
            margin: '20px 0 0',
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
            maxWidth: 320,
          }}
        >
          <PromiseRow icon={<IconShield size={13} stroke={1.8} color={LJ.key} />} label="촬영 시각 자동 인증" />
          <PromiseRow icon={<IconMapPin size={13} stroke={1.8} color={LJ.key} />} label="위치 자동 인증" />
          <PromiseRow icon={<IconClock size={13} stroke={1.8} color={LJ.key} />} label="48시간 동안만 라이브" />
        </ul>
      </div>

      <div
        style={{
          padding: '14px 18px calc(18px + env(safe-area-inset-bottom))',
        }}
      >
        <button
          type="button"
          onClick={onRequest}
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            background: loading ? 'rgba(255,255,255,0.15)' : LJ.key,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <IconCamera size={18} stroke={2} />
          {loading ? '권한 요청 중...' : '카메라 시작하기'}
        </button>
      </div>
    </DarkFrame>
  );
}

function PromiseRow({ icon, label }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          minWidth: 24,
          borderRadius: '50%',
          background: KEY_BG_15,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 12.5, color: WHITE_85 }}>{label}</span>
    </li>
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
          padding: '0 24px 24px',
          textAlign: 'center',
          fontFamily: LJ.fontStack,
          color: '#fff',
        }}
      >
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          {unsupported ? (
            <IconAlertTriangle size={34} stroke={1.6} color={WHITE_85} />
          ) : (
            <IconCameraOff size={34} stroke={1.6} color={WHITE_85} />
          )}
        </div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>
          {unsupported ? '이 브라우저는 카메라를 지원하지 않아요' : '카메라 권한이 필요해요'}
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: WHITE_85, lineHeight: 1.6, maxWidth: 320 }}>
          {unsupported
            ? '최신 브라우저(Chrome, Safari, Edge)에서 다시 열어주세요.'
            : '라이브저니는 카메라로 직접 촬영한 사진만 받아요'}
        </p>
      </div>
      <div style={{ padding: '14px 18px calc(18px + env(safe-area-inset-bottom))' }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            padding: 14,
            background: LJ.key,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontFamily: LJ.fontStack,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {unsupported ? '다시 시도' : '설정에서 허용하기'}
        </button>
      </div>
    </DarkFrame>
  );
}

/* -------------------- 다크 프레임 -------------------- */
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
            width: 34,
            height: 34,
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
          <IconX size={18} stroke={2} />
        </button>
      </div>
      {children}
    </div>
  );
}

/* -------------------- 카메라 뷰 -------------------- */
function CameraView({ cam, geo, onClose, onOpenGallery, onCapturedPhoto, onCapturedVideo }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordIntervalRef = useRef(null);

  useEffect(() => {
    if (cam.isRecording) {
      setRecordSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_RECORD_SECONDS) {
            // 최대치 도달 시 자동 정지
            (async () => {
              try {
                const blob = await cam.stopRecording();
                onCapturedVideo(blob);
              } catch (_) {}
            })();
          }
          return next;
        });
      }, 1000);
    } else if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [cam.isRecording]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShutter = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (cam.mode === 'photo') {
        const blob = await cam.capturePhoto();
        onCapturedPhoto(blob);
      } else {
        if (!cam.isRecording) {
          cam.startRecording();
        } else {
          const blob = await cam.stopRecording();
          onCapturedVideo(blob);
        }
      }
    } catch (e) {
      setError(e?.message || '잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const showGalleryAndSwitch = !cam.isRecording;

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

      {/* 뷰파인더 가이드 */}
      <ViewfinderGuide recording={cam.isRecording} />

      {/* 상단 */}
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
        <CircleButton onClick={onClose} aria-label="닫기" size={34}>
          <IconX size={18} stroke={2} />
        </CircleButton>

        {cam.isRecording ? (
          <Pill
            background="rgba(220,38,38,0.9)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#fff',
                animation: 'lj-pulse-dot 1s ease-in-out infinite',
              }}
            />
            {formatSeconds(recordSeconds)}
          </Pill>
        ) : (
          <Pill background={OVERLAY}>
            <IconShieldCheck size={13} stroke={2} color={LJ.key} />
            EXIF 자동 인증
          </Pill>
        )}

        <CircleButton onClick={cam.toggleFlash} aria-label="플래시" size={34}>
          {cam.flashOn ? (
            <IconBolt size={18} stroke={2} color={LJ.key} />
          ) : (
            <IconBoltOff size={18} stroke={2} />
          )}
        </CircleButton>
      </div>

      {/* 하단 영역 */}
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
        {/* GPS 박스 */}
        <GPSBox geo={geo} />

        {/* 모드 토글 */}
        <ModeToggle mode={cam.mode} onChange={cam.setMode} disabled={cam.isRecording} />

        {/* 컨트롤 행 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
          }}
        >
          <div style={{ width: 44, height: 44, opacity: showGalleryAndSwitch ? 1 : 0 }}>
            {showGalleryAndSwitch && (
              <SquareButton onClick={onOpenGallery} aria-label="갤러리">
                <IconPhoto size={20} stroke={1.8} />
              </SquareButton>
            )}
          </div>

          <ShutterButton
            mode={cam.mode}
            isRecording={cam.isRecording}
            busy={busy}
            onClick={handleShutter}
          />

          <div style={{ width: 44, height: 44, opacity: showGalleryAndSwitch ? 1 : 0 }}>
            {showGalleryAndSwitch && (
              <SquareButton onClick={cam.switchCamera} aria-label="카메라 전환">
                <IconRotate2 size={20} stroke={1.8} />
              </SquareButton>
            )}
          </div>
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
function CircleButton({ children, onClick, disabled, size = 36, style, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
      style={{
        width: size,
        height: size,
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

function SquareButton({ children, onClick, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: OVERLAY,
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </button>
  );
}

function Pill({ children, background = OVERLAY, style }) {
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
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ViewfinderGuide({ recording }) {
  const len = 18;
  const w = 2;
  const corners = [
    { top: 80, left: 24, borders: { borderTop: `${w}px solid rgba(255,255,255,0.6)`, borderLeft: `${w}px solid rgba(255,255,255,0.6)` } },
    { top: 80, right: 24, borders: { borderTop: `${w}px solid rgba(255,255,255,0.6)`, borderRight: `${w}px solid rgba(255,255,255,0.6)` } },
    { bottom: 220, left: 24, borders: { borderBottom: `${w}px solid rgba(255,255,255,0.6)`, borderLeft: `${w}px solid rgba(255,255,255,0.6)` } },
    { bottom: 220, right: 24, borders: { borderBottom: `${w}px solid rgba(255,255,255,0.6)`, borderRight: `${w}px solid rgba(255,255,255,0.6)` } },
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
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />
      ))}
      {recording && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 0 3px rgba(220,38,38,0.4)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}
    </>
  );
}

function GPSBox({ geo }) {
  let primary = '위치 확인 중...';
  let badge = 'GPS';
  if (geo.status === 'denied' || geo.status === 'unsupported') {
    primary = '위치 권한이 없어요';
    badge = '없음';
  } else if (geo.placeName) {
    primary = geo.placeName;
    badge = 'GPS 확인';
  } else if (geo.coords) {
    primary = `${geo.coords.lat.toFixed(4)}, ${geo.coords.lng.toFixed(4)}`;
    badge = 'GPS 확인';
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.5)',
        borderRadius: 10,
        backdropFilter: 'blur(8px)',
      }}
    >
      <IconMapPin size={14} stroke={2} color={LJ.key} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: WHITE_60, letterSpacing: 0.4 }}>위치 자동 인증</div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {primary}
        </div>
      </div>
      <span
        style={{
          padding: '3px 8px',
          background: 'rgba(77,184,232,0.18)',
          color: LJ.key,
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        {badge}
      </span>
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={mode === 'photo' ? '사진 촬영' : isRecording ? '녹화 정지' : '녹화 시작'}
      style={{
        width: 76,
        height: 76,
        borderRadius: '50%',
        background: 'transparent',
        border: `2px solid #fff`,
        boxShadow: 'inset 0 0 0 5px rgba(255,255,255,0.15)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: busy ? 'wait' : 'pointer',
      }}
    >
      {isRecording ? (
        <IconPlayerStopFilled size={28} color={RED} />
      ) : (
        <span
          style={{
            display: 'inline-block',
            width: mode === 'video' ? 50 : 60,
            height: mode === 'video' ? 50 : 60,
            borderRadius: '50%',
            background: mode === 'video' ? RED : '#fff',
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
