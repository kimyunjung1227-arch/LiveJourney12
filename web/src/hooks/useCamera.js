import { useCallback, useEffect, useRef, useState } from 'react';

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

  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

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
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // 전면 카메라는 미러링 표시이지만 저장은 자연 방향으로
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
