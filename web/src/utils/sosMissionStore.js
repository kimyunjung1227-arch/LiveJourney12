const SOS_MISSIONS_KEY = 'sosMissions_v2';

// 서버 운영 전환: localStorage 제거 → 세션 메모리만 사용
let sosMissionsMemory = [];

export const getSOSMissions = () => {
  try {
    void SOS_MISSIONS_KEY;
    return Array.isArray(sosMissionsMemory) ? sosMissionsMemory : [];
  } catch {
    return [];
  }
};

export const saveSOSMissions = (missions) => {
  sosMissionsMemory = Array.isArray(missions) ? missions : [];
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sosMissionUpdated'));
};

export const appendSOSMission = (mission) => {
  const next = [mission, ...getSOSMissions()];
  saveSOSMissions(next);
  return mission;
};

export const addMissionResponse = (missionId, response) => {
  const next = getSOSMissions().map((m) => {
    if (m.id !== missionId) return m;
    const responses = Array.isArray(m.responses) ? m.responses : [];
    return { ...m, responses: [response, ...responses] };
  });
  saveSOSMissions(next);
};

export const updateMissionResponseLinkedPostId = (missionId, responseId, linkedPostId) => {
  if (!missionId || !responseId || !linkedPostId) return;
  const next = getSOSMissions().map((m) => {
    if (m.id !== missionId) return m;
    const responses = (Array.isArray(m.responses) ? m.responses : []).map((r) =>
      r.id === responseId ? { ...r, linkedPostId } : r
    );
    return { ...m, responses };
  });
  saveSOSMissions(next);
};

export const updateMissionResponseStatus = (missionId, responseId, status) => {
  const next = getSOSMissions().map((m) => {
    if (m.id !== missionId) return m;
    const responses = (Array.isArray(m.responses) ? m.responses : []).map((r) =>
      r.id === responseId ? { ...r, status, reviewedAt: new Date().toISOString() } : r
    );
    const resolved = status === 'accepted';
    return { ...m, responses, status: resolved ? 'resolved' : m.status };
  });
  saveSOSMissions(next);
};

export const decideMissionResponse = (missionId, responseId, decision) => {
  const next = getSOSMissions().map((m) => {
    if (m.id !== missionId) return m;
    const responses = Array.isArray(m.responses) ? m.responses : [];
    if (decision === 'rejected') {
      return { ...m, responses: responses.filter((r) => r.id !== responseId) };
    }
    if (decision === 'accepted') {
      const updatedResponses = responses.map((r) =>
        r.id === responseId
          ? { ...r, status: 'accepted', reviewedAt: new Date().toISOString() }
          : { ...r, status: r.status || 'pending' }
      );
      return { ...m, responses: updatedResponses, status: 'resolved', resolvedAt: new Date().toISOString() };
    }
    return m;
  });
  saveSOSMissions(next);
};
