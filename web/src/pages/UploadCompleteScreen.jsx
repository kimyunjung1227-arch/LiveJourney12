import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCheck } from '@tabler/icons-react';
import { LJ } from '../components/lj/tokens';

// 알림이 뜨고 나서 홈으로 자동 이동하기까지의 시간(ms)
const REDIRECT_DELAY = 1800;

/**
 * 업로드 완료 화면 (/upload/complete/:postId).
 * 깔끔한 완료 알림만 보여주고, 잠시 후 홈으로 자동 이동한다.
 */
function UploadCompleteScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, REDIRECT_DELAY);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      style={{
        background: '#fff',
        minHeight: '100vh',
        fontFamily: LJ.fontStack,
        color: LJ.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 24px',
      }}
    >
      <div
        style={{
          width: 66,
          height: 66,
          marginBottom: 16,
          borderRadius: '50%',
          background: LJ.keyBgLight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCheck size={30} stroke={2.2} color={LJ.key} />
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: LJ.textPrimary, lineHeight: 1.4 }}>
        완료되었습니다
      </h2>
      <p style={{ margin: '10px 0 0', fontSize: 13, color: LJ.textSecondary, lineHeight: 1.6 }}>
        라이브 피드에 올라갔어요
      </p>
    </div>
  );
}

export default UploadCompleteScreen;
