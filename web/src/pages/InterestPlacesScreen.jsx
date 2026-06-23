import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  toggleInterestPlace, 
  isInterestPlace, 
  getInterestPlaces 
} from '../utils/interestPlaces';

const InterestPlacesScreen = () => {
  const navigate = useNavigate();
  const [placeInput, setPlaceInput] = useState('');
  const [interestPlaces, setInterestPlaces] = useState([]);

  // 추천 지역/장소
  const popularPlaces = [
    '서울', '부산', '제주', '강릉', '경주', 
    '전주', '인천', '대구', '광주', '속초',
    '성산일출봉', '남산타워', '해운대', '감천문화마을'
  ];

  useEffect(() => {
    loadData();
    
    const handleChange = () => loadData();
    window.addEventListener('interestPlaceChanged', handleChange);
    
    return () => {
      window.removeEventListener('interestPlaceChanged', handleChange);
    };
  }, []);

  const loadData = () => {
    setInterestPlaces(getInterestPlaces());
  };

  const handleToggle = (place) => {
    toggleInterestPlace(place);
    loadData();
  };

  const handleAdd = () => {
    if (!placeInput.trim()) {
      alert('지역이나 장소명을 입력해주세요');
      return;
    }
    
    toggleInterestPlace(placeInput.trim());
    setPlaceInput('');
    loadData();
  };

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-gray-900">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm p-4 border-b border-gray-200 dark:border-gray-800">
        <button 
          onClick={() => navigate(-1)}
          className="flex size-12 shrink-0 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-gray-900 dark:text-gray-100">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">관심 지역/장소</h1>
        <div className="w-12"></div>
      </header>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {/* 설명 */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">⭐ 관심 지역/장소란?</h3>
          <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
            관심있는 지역이나 장소를 추가하면, 새로운 실시간 정보가 올라올 때 알림을 받아요!
          </p>
          <div className="flex flex-col gap-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>지역: 제주, 부산, 강릉 등</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary">•</span>
              <span>장소: 성산일출봉, 남산타워 등</span>
            </div>
          </div>
        </div>

        {/* 추가 입력 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={placeInput}
            onChange={(e) => setPlaceInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="지역 또는 장소명 입력"
            className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleAdd}
            className="px-5 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-md"
          >
            추가
          </button>
        </div>

        {/* 추천 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🔥 인기 지역/장소</h3>
          <div className="flex flex-wrap gap-2">
            {popularPlaces.map((place) => {
              const isEnabled = isInterestPlace(place);
              return (
                <button
                  key={place}
                  onClick={() => handleToggle(place)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isEnabled
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {isEnabled && '⭐ '}
                  {place}
                </button>
              );
            })}
          </div>
        </div>

        {/* 내 관심 목록 */}
        {interestPlaces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-800 dark:text-gray-200 text-[15px] font-bold mb-2">
              아직 관심 지역/장소가 없어요
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs">
              관심있는 지역이나 장소를 추가해보세요!
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              ⭐ 내 관심 지역/장소 ({interestPlaces.length})
            </h3>
            <div className="space-y-2">
              {interestPlaces.map((place, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="material-symbols-outlined text-primary">star</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{place.name}</span>
                    </div>
                    {place.region && place.name !== place.region && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 ml-9">
                        📍 {place.region}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 ml-9">
                      {new Date(place.addedAt).toLocaleDateString('ko-KR')} 추가
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(place)}
                    className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterestPlacesScreen;




