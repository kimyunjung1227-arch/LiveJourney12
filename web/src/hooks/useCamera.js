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
 * deviceorientation(beta/gamma) → "화면 평면에서 중력이 향하는 각도"(도, -180~180).
 *
 * gamma 만 보면 안 되는 이유: deviceorientation 은 ZXY 오일러각이라
 * 화면을 세우고 들면(beta≈90°) 짐벌락 구간에 들어가 gamma 가 ±90° 까지 제멋대로 튄다.
 * 사진 찍을 때 자세가 정확히 그 구간이라, 세로로 들고 찍었는데도 가로로 오판됐다.
 * → 오일러각을 중력 벡터로 되돌린 뒤 화면 평면 성분만 보면 이 문제가 사라진다.
 *
 * 반환: 0=세로 정방향, +90=기기를 시계방향으로 눕힘, -90=반시계방향, ±180=거꾸로.
 *        화면을 하늘/바닥 쪽으로 눕혀 중력의 화면 평면 성분이 작아지면(방향을 알 수 없으면) null.
 */
function gravityAngleFromOrientation(beta, gamma) {
  if (typeof beta !== 'number' || typeof gamma !== 'number') return null;
  const b = (beta * Math.PI) / 180;
  const g = (gamma * Math.PI) / 180;
  // 기기 좌표계(x=화면 오른쪽, y=화면 위쪽)에서 본 중력 방향
  const gx = Math.cos(b) * Math.sin(g);
  const gy = -Math.sin(b);
  const planar = Math.hypot(gx, gy);
  if (planar < 0.5) return null; // 화면이 거의 수평 — 방향 판단 불가(직전 값 유지)
  return (Math.atan2(gx, -gy) * 180) / Math.PI;
}

/**
 * 연속 각도 → 0/90/180/270 으로 스냅. 단, "확실히 그 방향일 때만" 바꾼다.
 *
 * 각 방향의 중심에서 ±25° 안에 들어와야 전환되므로,
 * 가로로 인정되려면 기기를 65° 이상(= 거의 완전히) 눕혀야 하고,
 * 세로로 되돌아오려면 25° 안쪽까지 세워야 한다. 경계에서의 떨림으로 방향이 오락가락하지 않는다.
 */
const SNAP_TOLERANCE = 25;

function snapDeviceAngle(deg, prev) {
  let best = prev;
  let bestDiff = Infinity;
  for (const center of [0, 90, 180, 270]) {
    const diff = Math.abs((((deg - center + 540) % 360) - 180));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = center;
    }
  }
  if (best === prev) return prev;
  return bestDiff <= SNAP_TOLERANCE ? best : prev;
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
  const [zoom, setZoomState] = useState(1); // 줌 배율 (1 / 2 / 3)
  const [hardwareZoom, setHardwareZoom] = useState(false); // 센서(광학) 줌 사용 중 여부

  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const zoomRef = useRef(1); // 디지털 줌 폴백 배율
  const zoomCapsRef = useRef(null); // 하드웨어 줌 지원 시 { min, max, step }
  const hardwareZoomRef = useRef(false); // 캡처 시 디지털 크롭 여부 판단용
  const focusModesRef = useRef([]); // 트랙이 지원하는 focusMode 목록
  const autoExposureRef = useRef(false); // 연속 노출 지원 여부
  const autoWhiteBalanceRef = useRef(false); // 연속 화이트밸런스 지원 여부
  const poiSupportedRef = useRef(false); // 초점 지점(pointsOfInterest) 지정 지원 여부
  const focusPointRef = useRef(null); // 사용자가 탭한 초점 지점 {x, y} (0~1)
  const focusResetTimerRef = useRef(null);
  const torchSupportedRef = useRef(false);
  const appliedZoomRef = useRef(null); // 트랙에 실제로 적용된 하드웨어 줌 값
  const appliedTorchRef = useRef(null); // 트랙에 실제로 적용된 토치 상태
  const tiltAngleRef = useRef(0); // 가속도 센서로 추정한 기기 방향(0/90/270)
  const hasTiltRef = useRef(false); // 센서값을 한 번이라도 받았는지

  /**
   * 트랙에 제약을 적용한다.
   *
   * applyConstraints 는 트랙의 제약을 "누적"이 아니라 "교체"한다.
   * 그래서 줌만 따로 넣으면 앞서 켜둔 연속 초점/노출/화이트밸런스가 통째로 풀리고,
   * 카메라가 초점·노출을 다시 헤매면서 화면이 지직거린다(플래시도 같은 문제로 줌을 되돌렸다).
   * → 항상 "보정값 + 현재 줌 + 현재 토치"를 한 번에 실어 보낸다.
   */
  const buildTuneAdvanced = useCallback(() => {
    const advanced = [];
    const modes = focusModesRef.current;
    const poi = focusPointRef.current;
    if (poi) {
      // 탭한 지점에 초점을 맞춘다 (single-shot 미지원이면 연속 초점 + 지점만 지정)
      if (modes.includes('single-shot')) advanced.push({ focusMode: 'single-shot' });
      else if (modes.includes('continuous')) advanced.push({ focusMode: 'continuous' });
      if (poiSupportedRef.current) {
        advanced.push({ pointsOfInterest: [{ x: poi.x, y: poi.y }] });
      }
    } else if (modes.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' }); // 연속 자동초점 — 흐릿함 감소
    }
    if (autoExposureRef.current) advanced.push({ exposureMode: 'continuous' });
    if (autoWhiteBalanceRef.current) advanced.push({ whiteBalanceMode: 'continuous' });
    return advanced;
  }, []);

  const applyTrackState = useCallback(async (overrides = {}) => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track?.applyConstraints) return false;

    const zoom = 'zoom' in overrides ? overrides.zoom : appliedZoomRef.current;
    const torch = 'torch' in overrides ? overrides.torch : appliedTorchRef.current;

    const advanced = buildTuneAdvanced();
    if (typeof zoom === 'number') advanced.push({ zoom });
    if (typeof torch === 'boolean' && torchSupportedRef.current) advanced.push({ torch });
    if (!advanced.length) return true;

    await track.applyConstraints({ advanced });
    appliedZoomRef.current = typeof zoom === 'number' ? zoom : null;
    appliedTorchRef.current = typeof torch === 'boolean' ? torch : null;
    return true;
  }, [buildTuneAdvanced]);

  /**
   * 트랙 화질 보정 — 연속 자동초점/노출/화이트밸런스를 켜고,
   * 하드웨어 줌 지원 범위를 파악해 둔다. (지원하는 항목만 선택적으로 적용)
   */
  const tuneTrack = useCallback(
    (track) => {
      if (!track?.getCapabilities) return;
      let caps = {};
      try {
        caps = track.getCapabilities() || {};
      } catch (_) {
        caps = {};
      }
      // 이후 줌/토치/탭 초점을 바꿀 때도 이 보정값을 같이 실어 보내야 하므로 기억해 둔다.
      focusModesRef.current = Array.isArray(caps.focusMode) ? caps.focusMode : [];
      autoExposureRef.current =
        Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous');
      autoWhiteBalanceRef.current =
        Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous');
      poiSupportedRef.current =
        'pointsOfInterest' in caps ||
        !!navigator.mediaDevices?.getSupportedConstraints?.().pointsOfInterest;
      torchSupportedRef.current = !!caps.torch;
      focusPointRef.current = null; // 새 트랙 — 탭 초점 초기화
      appliedZoomRef.current = null;
      appliedTorchRef.current = null;
      const advanced = buildTuneAdvanced();
      if (advanced.length) {
        track.applyConstraints({ advanced }).catch(() => {});
      }
      // 하드웨어 줌 캐파 저장 (max가 min보다 클 때만 의미 있음)
      const zc = caps.zoom;
      if (zc && typeof zc.max === 'number' && zc.max > (zc.min ?? 1) + 0.01) {
        zoomCapsRef.current = { min: zc.min ?? 1, max: zc.max, step: zc.step || 0.1 };
      } else {
        zoomCapsRef.current = null;
      }
    },
    [buildTuneAdvanced],
  );

  const setZoom = useCallback(
    async (level) => {
      const lvl = Math.max(1, Math.min(3, Number(level) || 1));
      const caps = zoomCapsRef.current;
      if (caps) {
        // 하드웨어(센서) 줌 — 카메라가 실제로 확대해 화질 손실이 없다.
        const target = Math.min(caps.max, Math.max(caps.min, lvl));
        try {
          if (await applyTrackState({ zoom: target })) {
            hardwareZoomRef.current = true;
            zoomRef.current = 1; // 디지털 크롭은 하지 않음
            setHardwareZoom(true);
            setZoomState(lvl);
            return;
          }
        } catch (_) {
          /* 실패 시 아래 디지털 줌으로 폴백 */
        }
      }
      // 디지털 줌 폴백 — 중앙 크롭 + CSS 확대
      hardwareZoomRef.current = false;
      zoomRef.current = lvl;
      setHardwareZoom(false);
      setZoomState(lvl);
    },
    [applyTrackState],
  );

  /**
   * 터치 초점 — 미리보기에서 탭한 지점(clientX/clientY)에 초점·노출을 맞춘다.
   *
   * 화면 좌표 → 카메라 프레임 좌표(0~1) 환산이 핵심이다.
   *   - 미리보기는 object-fit: cover 라 프레임의 일부만 보인다
   *   - 디지털 줌은 CSS scale 로 확대해 보여준다 (하드웨어 줌이면 스트림 자체가 확대됨)
   *   - 전면 카메라는 좌우 반전해서 보여준다
   * 셋을 되돌려야 사용자가 누른 피사체에 실제로 초점이 잡힌다.
   *
   * 반환: 카메라에 실제로 적용됐으면 true (iOS Safari 등 미지원 환경이면 false)
   */
  const focusAt = useCallback(
    async (clientX, clientY) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return false;
      if (!poiSupportedRef.current && !focusModesRef.current.includes('single-shot')) return false;

      const rect = video.getBoundingClientRect();
      // CSS scale 은 중심 기준이라 중심 좌표는 그대로지만 rect 크기는 확대된다 → 레이아웃 크기 사용
      const w = video.offsetWidth || rect.width;
      const h = video.offsetHeight || rect.height;
      if (!w || !h) return false;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const z = hardwareZoomRef.current ? 1 : zoomRef.current || 1;
      const scale = Math.max(w / vw, h / vh) * z; // object-fit: cover + 디지털 줌

      let dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      if (facingMode === 'user') dx = -dx;

      const clamp01 = (n) => Math.min(1, Math.max(0, n));
      focusPointRef.current = {
        x: clamp01((vw / 2 + dx / scale) / vw),
        y: clamp01((vh / 2 + dy / scale) / vh),
      };

      try {
        await applyTrackState();
      } catch (_) {
        // 지점 지정을 거부한 기기 — 원래(연속 초점) 상태로 되돌린다
        focusPointRef.current = null;
        applyTrackState().catch(() => {});
        return false;
      }

      // 잠시 뒤 연속 자동초점으로 복귀 — 탭 지점에 계속 고정돼 있으면 이후 장면이 흐려진다
      if (focusResetTimerRef.current) clearTimeout(focusResetTimerRef.current);
      focusResetTimerRef.current = setTimeout(() => {
        focusResetTimerRef.current = null;
        focusPointRef.current = null;
        applyTrackState().catch(() => {});
      }, 3500);
      return true;
    },
    [applyTrackState, facingMode],
  );

  // 기기 기울기(가속도) 추적 — 화면 회전 잠금 상태에서도 가로 촬영을 감지하기 위함.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onTilt = (e) => {
      const deg = gravityAngleFromOrientation(e.beta, e.gamma);
      if (deg == null) return; // 화면이 수평에 가까움 — 직전 판정 유지
      tiltAngleRef.current = snapDeviceAngle(deg, tiltAngleRef.current);
      hasTiltRef.current = true;
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
    if (focusResetTimerRef.current) {
      clearTimeout(focusResetTimerRef.current);
      focusResetTimerRef.current = null;
    }
    focusPointRef.current = null;
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
          // 더 높은 해상도를 요청해 선명도 확보 (브라우저가 지원 최대치로 클램프)
          width: { ideal: 2560 },
          height: { ideal: 1440 },
          frameRate: { ideal: 30 },
        },
        audio: mode === 'video',
      });
      // 트랙 보정: 연속 자동초점/노출/화이트밸런스 + 하드웨어 줌 캐파 파악
      try {
        const track = s.getVideoTracks?.()[0];
        if (track) tuneTrack(track);
      } catch (_) {}
      // 스트림이 새로 열리면 줌·토치는 꺼진 상태로 초기화 (새 트랙은 항상 1배 / 토치 off)
      hardwareZoomRef.current = false;
      zoomRef.current = 1;
      setHardwareZoom(false);
      setZoomState(1);
      setFlashOn(false);
      setStream(s);
      setPermission('granted');
      return s;
    } catch (e) {
      setPermission(
        e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError' ? 'denied' : 'unsupported'
      );
      return null;
    }
  }, [facingMode, mode, tuneTrack]);

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
      // 토치만 따로 넣으면 적용 중인 줌·화질 보정이 함께 풀린다 → 현재 상태와 같이 보낸다
      await applyTrackState({ torch: next });
      setFlashOn(next);
      return next;
    } catch (_) {
      return false;
    }
  }, [flashOn, applyTrackState]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) throw new Error('비디오 스트림이 준비되지 않았어요.');

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // 줌 처리 — 하드웨어 줌이 적용 중이면 스트림 자체가 이미 확대되어 있으므로
    // 추가 크롭 없이 전체 프레임을 사용한다(화질 보존). 하드웨어 줌 미지원일 때만
    // 중앙을 1/z 만큼 잘라내는 디지털 줌(미리보기 CSS scale과 일치)을 적용.
    const z = hardwareZoomRef.current ? 1 : zoomRef.current || 1;
    const sw = vw / z;
    const sh = vh / z;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    // 저장 방향 = 사용자가 뷰파인더에서 본 그대로.
    //
    // 브라우저 대부분은 화면이 회전하면 프레임도 같이 돌려서 준다(프레임 가로/세로가 화면과 일치).
    // 이때 화면 각도만큼 또 돌리면 이중 회전이 되어 사진이 옆으로 눕는다 — 그래서 각도를 재지 않고
    // "프레임 방향이 화면 방향과 어긋날 때"만 보정한다.
    //
    // 예외는 OS 화면 회전 잠금: 화면·프레임 모두 세로로 고정되는데 기기는 옆으로 누워 있어서
    // 어긋남을 감지할 수 없다. 이 경우에만 가속도 센서(기울기)로 보정한다.
    const screenAngle = getScreenOrientationAngle(); // 0 / 90 / 180 / 270
    const frameIsLandscape = vw > vh;
    const viewIsLandscape =
      typeof window !== 'undefined' && window.innerHeight > 0
        ? window.innerWidth > window.innerHeight
        : frameIsLandscape;

    let angle = 0;
    if (frameIsLandscape !== viewIsLandscape) {
      // 프레임이 화면 방향을 따라오지 않은 브라우저 — 화면이 돌아간 각도만큼 보정
      angle = screenAngle;
    } else if (screenAngle === 0 && hasTiltRef.current) {
      // 회전 잠금 상태에서 기기를 옆으로 눕히고 찍은 경우.
      // tiltAngleRef 는 "기기를 65° 이상 완전히 눕혔을 때"만 90/270 이 되므로,
      // 세로로 들고 앞뒤로 기울인 정도로는 절대 돌아가지 않는다.
      angle = tiltAngleRef.current;
    }
    const swap = angle === 90 || angle === 270;

    const canvas = document.createElement('canvas');
    canvas.width = swap ? sh : sw;
    canvas.height = swap ? sw : sh;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    // 화면이 회전한 각도(시계방향)만큼 그대로 회전해 누운 사진을 정방향으로 세움.
    ctx.rotate((angle * Math.PI) / 180);
    // 전면 카메라는 미러링 표시이지만 저장은 자연 방향으로
    ctx.drawImage(video, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.95
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
    hardwareZoom,
    setZoom,
    videoRef,
    requestPermission,
    switchCamera,
    toggleFlash,
    setMode,
    focusAt,
    capturePhoto,
    startRecording,
    stopRecording,
  };
}
