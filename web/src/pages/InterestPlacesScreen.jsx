import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInterestPlaces } from '../utils/interestPlaces';
import BackButton from '../components/BackButton';
import { REGIONS, getSubregions } from '../utils/regionSubregions';

const InterestPlacesScreen = () => {
  const navigate = useNavigate();
  const [selectedSet, setSelectedSet] = useState(new Set());
  const [selectedRegion, setSelectedRegion] = useState('서울');

  useEffect(() => {
    const places = getInterestPlaces();
    const names = new Set((places || []).map((p) => p.name).filter(Boolean));
    setSelectedSet(names);
  }, []);

  const toggle = (name) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleDone = () => {
    const list = Array.from(selectedSet);
    if (list.length === 0) {
      localStorage.setItem('interestPlaces', JSON.stringify([]));
    } else {
      const now = new Date().toISOString();
      const newPlaces = list.map((name) => ({
        name,
        location: name,
        region: name,
        coordinates: null,
        addedAt: now
      }));
      localStorage.setItem('interestPlaces', JSON.stringify(newPlaces));
    }
    window.dispatchEvent(new CustomEvent('interestPlaceChanged', { detail: { place: list, enabled: true } }));
    navigate(-1);
  };

  // 'OO 전체' 항목은 숨기고, 실제 세부 지역만 노출
  const subregions = getSubregions(selectedRegion).filter((name) => !name.includes('전체'));

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black/40">
      {/* 팝업 카드: 크기 고정으로 지역 변경 시에도 동일한 레이아웃 유지 */}
      <div className="w-full max-w-md h-[85vh] max-h-[720px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 헤더 */}
        <header className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-center h-12 px-4 gap-3">
            <BackButton ariaLabel="관심지역 설정 닫기" />
            <h1 className="text-base font-bold text-gray-900 flex-1 text-center pr-9">관심지역 설정</h1>
          </div>
        </header>

        {/* 본문: 좌우 2열 고정 높이 (세부지역 개수와 관계없이 동일한 팝업 크기) */}
        <div className="flex flex-1 min-h-0 h-[calc(100%-7rem)]">
          {/* 왼쪽: 시·도 리스트 (전국 17개) */}
          <div className="w-2/5 flex-shrink-0 border-r border-gray-100 bg-gray-50 overflow-y-auto">
            {REGIONS.map((region) => {
              const active = selectedRegion === region;
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => {
                    setSelectedRegion(region);
                    // 해당 시·도에 세부 지역(구/군/시)이 없으면, 'OO 전체' 대신 바로 시·도를 토글 선택
                    const allSubregions = getSubregions(region);
                    const hasRealSubregion = allSubregions.some((name) => !name.includes('전체'));
                    if (!hasRealSubregion) {
                      toggle(region);
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm truncate ${
                    active ? 'bg-white font-semibold text-gray-900' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {region}
                </button>
              );
            })}
          </div>

          {/* 오른쪽: 세부지역 (광역시는 구/군, 도는 시/군) */}
          <div className="flex-1 bg-white flex flex-col min-h-0 overflow-hidden">
            <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 text-sm font-semibold text-gray-800">
              {selectedRegion}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {subregions.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">세부지역 없음</div>
              ) : (
                subregions.map((name) => {
                  const label = name;
                  const selected = selectedSet.has(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggle(label)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm border-b border-gray-50 ${
                        selected ? 'bg-[#E0F7FA] text-[#006064]' : 'text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <span>{name}</span>
                      {selected && (
                        <span className="material-symbols-outlined text-[#00BCD4] text-xl flex-shrink-0">check_circle</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white">
          <button
            type="button"
            onClick={handleDone}
            className="w-full h-11 rounded-full bg-[#00BCD4] text-white text-sm font-semibold hover:bg-[#00A5BD]"
          >
            선택 완료 ({selectedSet.size}개)
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterestPlacesScreen;
