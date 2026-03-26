import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { addNotification } from '../utils/notifications';
import { awardBadge, BADGES } from '../utils/badgeSystem';
import { getSOSMissions, decideMissionResponse } from '../utils/sosMissionStore';

const MISSION_REWARD_KEY = 'missionReward_v1';

const MyMissionsScreen = () => {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [heartFxResponseId, setHeartFxResponseId] = useState(null);
  const missions = useMemo(
    () => getSOSMissions().filter((m) => m?.requesterId === 'current-user'),
    [tick]
  );

  useEffect(() => {
    const onUpdate = () => setTick((v) => v + 1);
    window.addEventListener('sosMissionUpdated', onUpdate);
    return () => window.removeEventListener('sosMissionUpdated', onUpdate);
  }, []);

  const handleDecision = (mission, response, decision) => {
    if (decision === 'accepted') {
      const current = getSOSMissions().find((m) => m.id === mission.id);
      const currentResponses = Array.isArray(current?.responses) ? current.responses : [];
      const samePhotoAccepted = currentResponses.some(
        (r) => r.id === response.id && r.status === 'accepted'
      );
      if (samePhotoAccepted) {
        alert('이 사진은 이미 채택되었습니다.');
        return;
      }
      const allAcceptedForResponder = getSOSMissions()
        .flatMap((m) => (Array.isArray(m.responses) ? m.responses : []))
        .filter((r) => r.responderId === response.responderId && r.status === 'accepted').length;
      if (allAcceptedForResponder >= 3) {
        alert('같은 정보제공자는 최대 3회까지만 채택할 수 있어요.');
        return;
      }
    }

    if (decision === 'accepted') {
      setHeartFxResponseId(response.id);
      setTimeout(() => setHeartFxResponseId(null), 650);
    }
    decideMissionResponse(mission.id, response.id, decision);
    const rewardRaw = JSON.parse(localStorage.getItem(MISSION_REWARD_KEY) || '{}');
    const prev = rewardRaw[response.responderId] || { accepted: 0, rejected: 0, trustBonus: 0 };
    if (decision === 'accepted') {
      rewardRaw[response.responderId] = {
        ...prev,
        accepted: (prev.accepted || 0) + 1,
        trustBonus: (prev.trustBonus || 0) + 120
      };
      addNotification({
        type: 'system',
        title: '🎯 미션 정보가 채택되었어요',
        message: '정보 제공자에게 신뢰지수/뱃지 혜택이 반영되었습니다.',
        link: '/profile'
      });
      if (BADGES?.['실시간 답변러']) awardBadge(BADGES['실시간 답변러']);
    } else {
      rewardRaw[response.responderId] = { ...prev, rejected: (prev.rejected || 0) + 1 };
    }
    localStorage.setItem(MISSION_REWARD_KEY, JSON.stringify(rewardRaw));
    setTick((v) => v + 1);
  };

  const handleOpenResponseDetail = (resp) => {
    const localPosts = JSON.parse(localStorage.getItem('uploadedPosts') || '[]');
    const matched = localPosts.find((p) => p.id === resp.linkedPostId || p.thumbnail === resp.photoUrl);
    const targetId = matched?.id || resp.linkedPostId;
    if (targetId) {
      navigate(`/post/${targetId}`, { state: matched ? { post: matched } : undefined });
      return;
    }
    if (resp.photoUrl) window.open(resp.photoUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark h-[100dvh] overflow-hidden flex flex-col">
      <style>{`
        @keyframes heartPop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="screen-content flex flex-col flex-1 min-h-0 overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border-light bg-white dark:border-border-dark dark:bg-gray-900 px-4">
          <button onClick={() => navigate('/map')} className="flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-base font-bold">내가 올린 미션</h1>
          <div className="w-10" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 space-y-6">
          {missions.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">등록된 내 미션이 없습니다.</p>
          )}
          {missions.map((mission) => {
            const responses = Array.isArray(mission.responses) ? mission.responses : [];
            return (
              <div key={mission.id}>
                <p className="text-xs text-gray-500">미션제목</p>
                <p className="text-sm font-semibold">{mission.locationName || '근처 지역'}</p>
                <p className="text-xs text-gray-500 mt-2">미션 내용</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{mission.question}</p>
                <p className="text-xs text-gray-500 mt-2">정보제공된 사진</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {responses.filter((r) => !!r.photoUrl).map((resp) => (
                    <div key={resp.id} className="space-y-1">
                      <div
                        onClick={() => handleOpenResponseDetail(resp)}
                        className="relative w-full aspect-square rounded-md overflow-hidden bg-gray-200 cursor-pointer"
                      >
                        <img src={resp.photoUrl} alt="" className="w-full h-full object-cover" />
                        {resp.status !== 'accepted' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDecision(mission, resp, 'rejected');
                            }}
                            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/35 text-white flex items-center justify-center"
                            title="거절"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                          </button>
                        )}
                        {resp.status !== 'accepted' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDecision(mission, resp, 'accepted');
                            }}
                            className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 border border-rose-200 text-rose-500 flex items-center justify-center shadow-sm"
                            title="채택"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>favorite</span>
                          </button>
                        )}
                        {resp.status === 'accepted' && (
                          <div
                            className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-rose-500/95 text-white flex items-center justify-center shadow-md"
                            style={{ animation: heartFxResponseId === resp.id ? 'heartPop 0.5s ease-out' : undefined }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>favorite</span>
                          </div>
                        )}
                        {heartFxResponseId === resp.id && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <span
                              className="material-symbols-outlined text-rose-500"
                              style={{ fontSize: '36px', animation: 'heartPop 0.6s ease-out' }}
                            >
                              favorite
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-600 dark:text-gray-300 truncate">{resp.note || '현장 정보'}</p>
                      {resp.status === 'accepted' ? (
                        <div className="text-[11px] text-rose-500">채택됨</div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {responses.filter((r) => !!r.photoUrl).length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">정보제공된 사진이 아직 없습니다.</p>
                )}
                {responses.filter((r) => !r.photoUrl).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {responses.filter((r) => !r.photoUrl).map((resp) => (
                      <p key={resp.id} className="text-xs text-gray-500">- {resp.note}</p>
                    ))}
                  </div>
                )}
                {responses.length > 0 && (
                  <p className="mt-2 text-[11px] text-gray-500">사진 {responses.filter((r) => !!r.photoUrl).length}장</p>
                )}
                </div>
            );
          })}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default MyMissionsScreen;
