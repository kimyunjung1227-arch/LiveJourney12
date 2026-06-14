import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 촬영 순간 기기(화면) 방향을 0/90/180/270(시계방향)으로 반환.
 * getUserMedia 프레임은 기기 본체 기준으로 고정되므로, 가로로 들고 찍으면
 * 피사체가 옆으로 누운 채 저장된다. 이 각도만큼 캔버스를 회전해 정면으로 보정한다.
 */
function getScreenOrientationAngle() {
  if (typeof window === 'undefined') return 0;
  // 표준 ScreenOrientation API 우선
  const a = window.screen?.orientation?.angle;
  if (typeof a === 'number') return ((a % 360) + 360) % 360;
  // 구형 iOS Safari 폴백 (window.orientation: 0 / 90 / -90 / 180)
  const legacy = window.orientation;
  if (typeof legacy === 'number') return ((legacy % 360) + 360) % 360;
  return 0;
}

/**
 * 가속도(deviceorientation)의 beta/gamma로 기기를 어느 방향으로 들었는지 추정.
 * OS '화면 회전 잠금'이 켜져 있으면 screen.orientation.angle 은 항상 0이라
 * 가로로 들어도 감지가 안 된다 → 센서값으로 보완한다.
 * 반환: 0(세로) / 90(가로) / 270(반대 가로). 애매하면 null.
 */
function orientationFromTilt(beta, gamma) {
  if (typeof beta !== 'number' || typeof gamma !== 'number') return null;
  // 좌우로 기울면 가로로 판단 — 화면 회전 잠금 환경에서도 가로 촬영을 잡아내도록
  // 임계값을 낮춰 약하게 기울여도 가로로 인식한다.
  if (gamma > 20) return 90; // 기기 우측이 아래로 (landscape)
  if (gamma < -20) return 270; // 기기 좌측이 아래로 (반대 landscape)
  // 그 외에는 세로로 본다 (애매한 평평/약한 기울기 포함)
  if (Math.abs(gamma) <= 15) return 0;
  return null; // 15~20° 경계 구간은 직전 값 유지
}

/**
 * 웹 인앱 카메라 훅 — getUserMedia + Canvas + MediaRecorder.
 *
 * UI 사용 패턴:
 *   const cam = useCamera();
 *   useEffect(() => { cam.requestPermission(); }, []);
 *   <video ref={cam.videoRef} autoPlay playsInline muted />
 *   <button onClick={cam.capturePhoto} />
 *
 * 권한 상태:
 *   - 'idle'       : 아직 요청 안 함
 *   - 'requesting' : 사용자 권한 다이얼로그 표시 중
 *   - 'granted'    : 스트림 활성
 *   - 'denied'     : 사용자가 거절
 *   - 'unsupported': 브라우저가 getUserMedia 미지원
 */
export function useCamera({ initialFacingMode = 'environment', initialMode = 'photo' } = {}) {
  const [stream, setStream] = useState(null);
  const [permission, setPermission] = useState('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState(initialFacingMode);
  const [mode, setMode] = useState(initialMode);
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoomState] = useState(1); // 디지털 줌 배율 (1 / 2 / 3)

  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const zoomRef = useRef(1);
  const tiltAngleRef = useRef(0); // 가속도 센서로 추정한 기기 방향(0/90/270)
  const hasTiltRef = useRef(false); // 센서값을 한 번이라도 받았는지

  const setZoom = useCallback((level) => {
    const z = Math.max(1, Math.min(3, Number(level) || 1));
    zoomRef.current = z;
    setZoomState(z);
  }, []);

  // 기기 기울기(가속도) 추적 — 화면 회전 잠금 상태에서도 가로 촬영을 감지하기 위함.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onTilt = (e) => {
      const next = orientationFromTilt(e.beta, e.gamma);
      if (next != null) {
        tiltAngleRef.current = next;
        hasTiltRef.current = true;
      }
    };
    window.addEventListener('deviceorientation', onTilt, true);

    // iOS 13+ 는 사용자 제스처에서 권한 요청이 필요 → 첫 탭에 1회 요청
    const DOE = window.DeviceOrientationEvent;
    let onFirstTap;
    if (DOE && typeof DOE.requestPermission === 'function') {
      onFirstTap = async () => {
        try {
          await DOE.requestPermission();
        } catch (_) {
          /* 거부해도 screen.orientation 폴백 사용 */
        }
      };
      window.addEventListener('pointerdown', onFirstTap, { once: true });
    }

    return () => {
      window.removeEventListener('deviceorientation', onTilt, true);
      if (onFirstTap) window.removeEventListener('pointerdown', onFirstTap);
    };
  }, []);

  // stream이 갱신될 때마다 ref와 video 엘리먼트에 연결
  useEffect(() => {
    streamRef.current = stream;
    if (videoRef.current && stream) {
      try {
        videoRef.current.srcObject = stream;
      } catch (_) {}
    }
  }, [stream]);

  const stopCurrentStream = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    try {
      s.getTracks().forEach((t) => t.stop());
    } catch (_) {}
    streamRef.current = null;
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch (_) {}
    }
    setStream(null);
  }, []);

  const openStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      return null;
    }
    setPermission((p) => (p === 'granted' ? 'granted' : 'requesting'));
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: mode === 'video',
      });
      setStream(s);
      setPermission('granted');
      return s;
    } catch (e) {
      setPermission(
        e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError' ? 'denied' : 'unsupported'
      );
      return null;
    }
  }, [facingMode, mode]);

  const requestPermission = useCallback(async () => {
    await openStream();
  }, [openStream]);

  // facingMode / mode 변경 시 스트림 재시작
  useEffect(() => {
    if (permission !== 'granted') return;
    let active = true;
    (async () => {
      stopCurrentStream();
      if (!active) return;
      await openStream();
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, mode]);

  // unmount 시 cleanup
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch (_) {}
      stopCurrentStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  /** 토치(플래시) — 지원 환경에서만 동작 (대부분 후면 카메라 + 안드로이드) */
  const toggleFlash = useCallback(async () => {
    const s = streamRef.current;
    if (!s) return false;
    const track = s.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return false;
    const caps = track.getCapabilities();
    if (!caps.torch) return false;
    const next = !flashOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setFlashOn(next);
      return next;
    } catch (_) {
      return false;
    }
  }, [flashOn]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) throw new Error('비디오 스트림이 준비되지 않았어요.');

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // 디지털 줌 — 중앙을 1/z 만큼 잘라내 확대 효과 (미리보기 CSS scale과 일치)
    const z = zoomRef.current || 1;
    const sw = vw / z;
    const sh = vh / z;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    // 가로(landscape)로 촬영한 경우 기기 방향만큼 회전해 세로(정방향)로 저장.
    // 화면 회전 잠금이 켜져 있으면 screen.orientation 은 0이므로 가속도 센서값으로 보완.
    const screenAngle = getScreenOrientationAngle(); // 0 / 90 / 180 / 270
    const angle =
      screenAngle !== 0 ? screenAngle : hasTiltRef.current ? tiltAngleRef.current : 0;
    const swap = angle === 90 || angle === 270;

    const canvas = document.createElement('canvas');
    canvas.width = swap ? sh : sw;
    canvas.height = swap ? sw : sh;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    // 기기 회전 각도를 반대(반시계)로 되돌려 누운 사진을 똑바로 세움.
    ctx.rotate((-angle * Math.PI) / 180);
    // 전면 카메라는 미러링 표시이지만 저장은 자연 방향으로
    ctx.drawImage(video, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.92
      );
    });
  }, []);

  const startRecording = useCallback(() => {
    if (isRecording) return;
    const s = streamRef.current;
    if (!s) return;
    chunksRef.current = [];
    let mimeType = '';
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    for (const t of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) {
        mimeType = t;
        break;
      }
    }
    try {
      const rec = mimeType ? new MediaRecorder(s, { mimeType }) : new MediaRecorder(s);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start(1000); // 1초마다 chunk
      recorderRef.current = rec;
      setIsRecording(true);
    } catch (_) {
      setIsRecording(false);
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      const rec = recorderRef.current;
      if (!rec) return reject(new Error('녹화 중이 아니에요.'));
      const finish = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'video/webm',
        });
        chunksRef.current = [];
        recorderRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };
      if (rec.state === 'inactive') return finish();
      rec.onstop = finish;
      try {
        rec.stop();
      } catch (e) {
        reject(e);
      }
    });
  }, []);

  return {
    stream,
    permission,
    isRecording,
    facingMode,
    mode,
    flashOn,
    zoom,
    setZoom,
    videoRef,
    requestPermission,
    switchCamera,
    toggleFlash,
    setMode,
    capturePhoto,
    startRecording,
    stopRecording,
  };
}
