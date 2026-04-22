import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { useAuth } from '../contexts/AuthContext';
import { getRegionDefaultImage } from '../utils/regionDefaultImages';

const STEPS = [
  { step: 1, title: '여행지 선택' },
  { step: 2, title: '원하는 여행 카테고리 선택' },
  { step: 3, title: '글 내용 작성' },
  { step: 4, title: '업로드' },
];

const WRITE_REGIONS = [
  { id: '서울', label: '서울' },
  { id: '부산', label: '부산' },
  { id: '제주', label: '제주' },
  { id: '경주', label: '경주' },
  { id: '강릉', label: '강릉' },
  { id: '도쿄', label: '도쿄' },
  { id: '오사카', label: '오사카' },
  { id: '인천', label: '인천' },
  { id: '대구', label: '대구' },
  { id: '기타', label: '기타' },
];

// 사진 참고: 2열 + 하단 1개, 다중 선택
const TRAVEL_CATEGORIES = [
  { id: '체험·액티비티', label: '체험·액티비티' },
  { id: '자연과 함께', label: '자연과 함께' },
  { id: '여유롭게 힐링', label: '여유롭게 힐링' },
  { id: '여행지 느낌 물씬', label: '여행지 느낌 물씬' },
  { id: 'SNS 핫플레이스', label: 'SNS 핫플레이스' },
  { id: '유명 관광지는 필수', label: '유명 관광지는 필수' },
  { id: '문화·예술·역사', label: '문화·예술·역사' },
  { id: '쇼핑은 열정적으로', label: '쇼핑은 열정적으로' },
  { id: '관광보다 먹방', label: '관광보다 먹방', wide: true },
];

const ChatWriteScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [region, setRegion] = useState('');
  const [categories, setCategories] = useState([]); // 다중 선택
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const canNextStep1 = !!region;
  const canNextStep2 = categories.length > 0;
  const canNextStep3 = !!title.trim();
  const canUpload = !!region && categories.length > 0 && !!title.trim();

  const toggleCategory = (id) => {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep((s) => s + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleUpload = () => {
    if (!canUpload) return;
    const userName = user?.username || '사용자';
    const newChat = {
      id: `chat-${Date.now()}`,
      region: region || '기타',
      city: region || '기타',
      theme: categories.length > 0 ? categories.join(' · ') : '동행',
      title: title.trim(),
      description: description.trim() || '내용을 입력해 주세요.',
      userName,
      representativeBadge: { icon: '👣', name: '첫 걸음' },
      verified: false,
      lastMessage: '',
      lastTime: '방금',
      dates: new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(/\. /g, '.').replace('.', ' '),
      avatarEmoji: '✏️',
      thumbnail: getRegionDefaultImage(region || '서울'),
      messages: [
        { id: 1, sender: '시스템', text: `${title.trim()} 채팅방에 오신 걸 환영해요!`, time: '방금', isMine: false },
      ],
    };
    // 서버 운영 전환: localStorage 제거 (채팅방 임시 저장 비활성화)
    navigate('/chat');
  };

  return (
    <div className="screen-layout bg-background-light dark:bg-background-dark">
      <div className="screen-content bg-white dark:bg-gray-900">
        <header className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 safe-area-top">
          <button
            type="button"
            onClick={currentStep === 1 ? () => navigate('/chat') : handlePrev}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white flex-1">글쓰기</h1>
        </header>

        {/* 단계 표시 */}
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between gap-1 max-w-[460px] mx-auto">
            {STEPS.map(({ step, title: stepTitle }) => (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      currentStep > step
                        ? 'bg-[#26C6DA] text-white'
                        : currentStep === step
                          ? 'bg-[#26C6DA] text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}
                  >
                    {currentStep > step ? (
                      <span className="material-symbols-outlined text-lg">check</span>
                    ) : (
                      step
                    )}
                  </div>
                  <span className="text-[10px] mt-1 text-center truncate w-full text-gray-500 dark:text-gray-400 hidden sm:block">
                    {stepTitle.replace(/ 선택| 작성|업로드/, '')}
                  </span>
                </div>
                {step < 4 && (
                  <div
                    className={`flex-1 h-0.5 max-w-[20px] rounded ${
                      currentStep > step ? 'bg-[#26C6DA]' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-3 text-center">
            {STEPS[currentStep - 1].title}
          </p>
        </div>

        <div className="px-4 py-6 pb-28 max-w-[460px] mx-auto min-h-[40vh]">
          {/* 1. 여행지 선택 */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">동행을 구할 여행지를 선택하세요.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WRITE_REGIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRegion(id)}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors ${
                      region === id
                        ? 'border-[#26C6DA] bg-[#26C6DA]/10 text-[#26C6DA]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-[#26C6DA]/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. 원하는 여행 카테고리 선택 (사진 참고: 카메라 아이콘 + 제목 + 다중 선택) */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <div className="flex flex-col items-center pt-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-5">
                  <span className="material-symbols-outlined text-4xl text-gray-400 dark:text-gray-500">photo_camera</span>
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white text-center leading-snug">
                  내가 선호하는
                  <br />
                  여행 스타일은?
                </h2>
                <p className="text-base text-gray-500 dark:text-gray-400 text-center mt-3">
                  마음에 드는 스타일을 넉넉하게 골라 주세요.
                  <br />
                  다중 선택이 가능합니다.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {TRAVEL_CATEGORIES.filter((c) => !c.wide).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCategory(id)}
                    className={`py-4 px-4 rounded-2xl border-2 text-base font-semibold transition-colors text-center whitespace-pre-line ${
                      categories.includes(id)
                        ? 'border-[#26C6DA] bg-[#26C6DA]/10 text-[#26C6DA]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex justify-center mt-2">
                {TRAVEL_CATEGORIES.filter((c) => c.wide).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCategory(id)}
                    className={`w-full max-w-[320px] py-4 px-4 rounded-2xl border-2 text-base font-semibold transition-colors whitespace-pre-line ${
                      categories.includes(id)
                        ? 'border-[#26C6DA] bg-[#26C6DA]/10 text-[#26C6DA]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. 글 내용 작성 */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 주말 남산 야경 산책 같이 가실 분"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-[15px] placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#26C6DA]/50 focus:border-[#26C6DA]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">내용</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="일정, 원하는 동행 조건 등을 자유롭게 적어주세요."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-[15px] placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#26C6DA]/50 focus:border-[#26C6DA] resize-none"
                />
              </div>
            </div>
          )}

          {/* 4. 업로드 (확인 후 등록) - 여백 줄임 */}
          {currentStep === 4 && (
            <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-500 dark:text-gray-400">여행지</span>
                <span className="font-medium text-gray-900 dark:text-white">{region || '-'}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-gray-500 dark:text-gray-400">카테고리</span>
                <span className="font-medium text-gray-900 dark:text-white text-right max-w-[60%]">
                  {categories.length > 0 ? categories.join(', ') : '-'}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 py-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">제목</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm leading-snug">{title || '-'}</p>
              </div>
              {description.trim() ? (
                <div className="pt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">내용</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{description}</p>
                </div>
              ) : null}
            </div>
          )}

          {/* 하단 버튼: 다음 / 업로드 (네비에 가리지 않게 네비 바로 위 고정) */}
          <div
            className="fixed left-0 right-0 z-10 px-4 py-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 max-w-[460px] mx-auto safe-area-bottom"
            style={{
              bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
              paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !canNextStep1) ||
                  (currentStep === 2 && !canNextStep2) ||
                  (currentStep === 3 && !canNextStep3)
                }
                className="w-full py-3.5 rounded-xl bg-[#26C6DA] text-white font-semibold text-[15px] hover:bg-[#00B8CC] active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            ) : (
              <button
                type="button"
                onClick={handleUpload}
                disabled={!canUpload}
                className="w-full py-3.5 rounded-xl bg-[#26C6DA] text-white font-semibold text-[15px] hover:bg-[#00B8CC] active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">upload</span>
                업로드
              </button>
            )}
          </div>
        </div>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default ChatWriteScreen;
