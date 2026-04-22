// 여행 매거진 구성 설정
// 태그/키워드 기반으로 사용자 피드를 큐레이션하는 주제형 매거진.

// 서버 운영 전환: localStorage 제거 → 기본 토픽만 사용

const DEFAULT_TOPICS = [
  {
    id: 'hydrangea-full-bloom',
    title: '현재 만개한 수국을 볼 수 있는 장소',
    description: '지금 실제로 수국이 활짝 피어 있는 스팟만 모아 보여줘요. 실시간 수국 사진으로 동선을 잡아보세요.',
    // 이 매거진에 포함할 게시물을 고를 때 사용할 키워드들
    tagKeywords: ['수국', 'hydrangea'],
    // 나중에 확장할 수 있도록 메타 정보 일부 포함
    themeColor: '#4f46e5',
    emoji: '💠',
  },
];

export const loadMagazineTopics = () => {
  try {
    return DEFAULT_TOPICS;
  } catch {
    return DEFAULT_TOPICS;
  }
};

export const saveMagazineTopics = (topics) => {
  try {
    if (!Array.isArray(topics)) return;
    try {
      window.dispatchEvent(new Event('magazineTopicsUpdated'));
    } catch {
      // window가 없는 환경에서는 무시
    }
  } catch {
    // ignore
  }
};

export const getMagazineTopicById = (id) =>
  loadMagazineTopics().find((m) => String(m.id) === String(id)) || null;

