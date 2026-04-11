import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { fetchNotices } from '../api/noticesSupabase';

const NoticesScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromMain = location.state?.fromMain === true;
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [dynamicNotices, setDynamicNotices] = useState([]);

  useEffect(() => {
    fetchNotices().then((list) => {
      const formatted = (list || []).map((n) => ({
        id: n.id,
        title: n.title,
        date: n.created_at ? new Date(n.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '',
        isNew: n.created_at ? (Date.now() - new Date(n.created_at).getTime() < 7 * 24 * 60 * 60 * 1000) : false,
        category: n.category || '공지',
        content: n.content || '',
        is_pinned: !!n.is_pinned,
      }));
      setDynamicNotices(formatted);
    });
  }, []);

  // 공지사항 데이터 (관리자 작성 공지 + 가이드 등 정적 콘텐츠)
  const staticNotices = [
    {
      id: 1,
      title: '🎯 LiveJourney 완전 가이드',
      date: '2024.12.20',
      isNew: true,
      category: '가이드',
      content: `
# LiveJourney 완전 가이드

안녕하세요! LiveJourney는 **지금 이 순간의 여행지**를 실시간으로 공유하는 플랫폼입니다.

## 📸 실시간 정보 공유하기
1. 하단 네비게이션에서 **업로드** 버튼을 클릭하세요
2. 사진을 선택하거나 촬영하세요
3. 위치 정보가 자동으로 추가됩니다
4. AI가 자동으로 카테고리를 분류해줍니다 (맛집, 관광지, 개화정보 등)
5. 해시태그와 메모를 추가하고 업로드하세요

## 🗺️ 지도에서 장소 탐색하기
1. **지도** 탭에서 주변 장소를 확인하세요
2. 핀을 클릭하면 해당 장소의 실시간 사진을 볼 수 있습니다
3. **경로 만들기** 기능으로 여러 장소를 선택하여 여행 계획을 세울 수 있습니다
4. **필터** 기능으로 원하는 카테고리만 볼 수 있습니다 (개화정보, 맛집정보, 가볼만한 곳)

## 🏆 뱃지 시스템
LiveJourney에는 7개 카테고리, 총 20개의 뱃지가 있습니다!

### 주요 뱃지 카테고리
- **온보딩**: 첫 걸음
- **지역 가이드**: 지역 가이드, 지역 지킴이, 지역 통신원, 지역 마스터
- **실시간 정보**: 날씨요정, 웨이팅 요정 등
- **도움 지수**: 도움 요정, 정보 나눔가 등
- **정확한 정보**: 정확도 마스터 등
- **친절한 여행자**: 친절왕 등
- **기여도**: 기여왕 등

특정 지역을 방문하거나 특정 카테고리 사진을 업로드하면 특별한 뱃지를 받을 수 있습니다.
**프로필** 탭에서 획득한 뱃지를 확인하세요!

## 👑 일일 타이틀 시스템
매일 자정에 리셋되는 24시간 명예 챌린지입니다!
- **실시간 0분 스피드 헌터**: 당일 첫 번째 실시간 정보 포스팅
- **좋아요 폭격의 왕**: 24시간 동안 가장 많은 좋아요를 받은 포스팅
- **오늘의 첫 셔터**: 당일 가장 먼저 사진을 올린 사용자

## 🆘 지금 상황 알아보기 (SOS)
지도 화면에서 **"지금 상황 알아보기"** 버튼을 사용하면:
- 특정 위치에 대한 질문을 할 수 있습니다
- 주변 사용자들이 실시간으로 답변해줍니다
- 예: "이 근처에 주차장이 있나요?", "지금 혼잡한가요?"

## ⏰ 48시간 클린 시스템
과거의 정보가 아닌 **지금 이 순간**의 정보만 제공합니다.
48시간이 지난 정보는 자동으로 관리되어 항상 최신 정보만 볼 수 있습니다.

## 💡 활용 팁
- 해시태그를 많이 사용하면 더 많은 사람들이 내 사진을 찾을 수 있습니다
- 다른 사용자의 사진에 좋아요와 댓글을 남기면 소통이 더 활발해집니다
- 실시간 정보를 많이 공유할수록 더 많은 뱃지를 획득할 수 있습니다
- 지도에서 필터 기능을 사용하면 원하는 카테고리만 볼 수 있습니다

더 궁금한 점이 있으시면 고객센터로 문의해주세요!
      `
    },
    {
      id: 2,
      title: '✨ v1.3 업데이트 안내',
      date: '2024.12.18',
      isNew: true,
      category: '업데이트',
      content: `
# LiveJourney v1.3 업데이트 안내

새로운 기능과 개선사항을 소개합니다!

## 🆕 새로운 기능

### 1. GPS 위치 정확도 대폭 개선
- 지도에서 내 위치 핀이 정확한 GPS 좌표에 표시됩니다
- 위치 추적 시스템이 개선되어 더 정확한 위치를 제공합니다
- 위치 권한 요청 시 명확한 안내 메시지가 표시됩니다

### 2. 경로 만들기 기능 강화
- 지도에서 여러 장소를 선택하여 여행 경로를 만들 수 있습니다
- 경로를 저장하고 공유할 수 있습니다
- 경로 모드에서 핀을 선택하여 순서대로 경로를 만들 수 있습니다

### 3. 검색 기능 강화
- 해시태그 검색이 더욱 정확해졌습니다
- 지역명 자동완성 기능이 추가되었습니다
- 카테고리별 필터링이 개선되었습니다

### 4. 실시간 피드 개선
- 48시간 클린 시스템이 더욱 정확해졌습니다
- 실시간 정보가 더 빠르게 업데이트됩니다

## 🔧 개선사항
- 지도 로딩 속도 개선
- 사진 업로드 속도 향상
- 알림 시스템 안정화
- 뱃지 시스템 성능 개선
- 일일 타이틀 시스템 안정화

## 🐛 버그 수정
- 지도에서 위치 핀 표시 오류 수정
- GPS 위치 추적 정확도 문제 해결
- 일부 기기에서 사진 업로드 실패 문제 해결
- SOS 요청 기능 안정화

앞으로도 더 나은 서비스를 제공하기 위해 노력하겠습니다!
      `
    },
    {
      id: 3,
      title: '🎉 연말 실시간 정보 공유 이벤트',
      date: '2024.12.15',
      isNew: true,
      category: '이벤트',
      content: `
# 연말 실시간 정보 공유 이벤트

2024년을 마무리하며 특별한 이벤트를 준비했습니다!

## 🎁 이벤트 내용

### 1. 실시간 정보 공유 이벤트
- 12월 15일 ~ 12월 31일 동안 사진을 업로드하면 특별 뱃지를 획득할 수 있습니다
- 업로드한 사진이 많을수록 더 많은 뱃지를 받을 수 있습니다
- 실시간 정보를 많이 공유할수록 더 높은 등급의 뱃지를 받을 수 있습니다

### 2. 해시태그 이벤트
- #연말여행 #2024마무리 #실시간정보 해시태그를 사용하면 추첨을 통해 소정의 상품을 드립니다
- 매일 10명씩 선정됩니다
- 해시태그를 사용한 게시물은 메인 화면에 우선 노출됩니다

### 3. 경로 공유 이벤트
- 지도에서 만든 경로를 공유하면 특별한 뱃지를 받을 수 있습니다
- 가장 많은 좋아요를 받은 경로는 메인 화면에 노출됩니다
- 경로를 공유한 사용자에게는 "여행 기획자" 뱃지가 지급됩니다

### 4. 일일 타이틀 챌린지
- 매일 첫 번째로 실시간 정보를 공유하면 "실시간 0분 스피드 헌터" 타이틀을 획득할 수 있습니다
- 가장 많은 좋아요를 받은 게시물 작성자는 "좋아요 폭격의 왕" 타이틀을 받습니다

## 📅 이벤트 기간
2024년 12월 15일 ~ 12월 31일

## 🏆 특별 혜택
- 이벤트 기간 중 획득한 뱃지는 영구 보관됩니다
- 특별 뱃지를 획득한 사용자는 프로필에 특별 표시가 됩니다

많은 참여 부탁드립니다!
      `
    },
    {
      id: 4,
      title: '🔔 알림 기능 완전 가이드',
      date: '2024.12.10',
      isNew: false,
      category: '가이드',
      content: `
# 알림 기능 완전 가이드

LiveJourney의 알림 기능을 활용하는 방법을 안내드립니다.

## 📱 알림 종류

### 1. 뱃지 획득 알림
- 새로운 뱃지를 획득하면 알림을 받을 수 있습니다
- 일일 타이틀을 획득하면 즉시 알림이 표시됩니다

### 2. 좋아요/댓글 알림
- 내 사진에 좋아요나 댓글이 달리면 알림을 받습니다
- 다른 사용자와의 소통을 놓치지 않을 수 있습니다

### 3. 팔로우 알림
- 누군가 나를 팔로우하면 알림을 받습니다

### 4. SOS 요청 알림
- 내 주변에서 도움 요청이 올라오면 알림을 받습니다
- 다른 여행자들을 도울 수 있는 기회입니다

## ⚙️ 알림 설정 방법
1. **설정** 메뉴로 이동
2. **알림 설정** 선택
3. 원하는 알림을 켜고 끌 수 있습니다
   - 활동 알림: 좋아요, 댓글, 팔로우 알림
   - 위치 알림: SOS 요청 알림

## 💡 알림 활용 팁
- 알림을 통해 빠르게 반응하면 더 활발한 소통이 가능합니다
- SOS 요청 알림을 켜두면 주변 여행자들을 도울 수 있습니다

알림을 통해 더 활발한 소통을 즐기세요!
      `
    },
    {
      id: 5,
      title: '🛠️ 시스템 점검 안내',
      date: '2024.12.01',
      isNew: false,
      category: '점검',
      content: `
# 시스템 점검 안내

서비스 안정화를 위한 시스템 점검이 예정되어 있습니다.

## 📅 점검 일정
- **일시**: 2024년 12월 3일 (화) 오전 2시 ~ 오전 4시
- **소요 시간**: 약 2시간

## 🔧 점검 내용
- 서버 안정화 작업
- 데이터베이스 최적화
- 보안 업데이트

## ⚠️ 점검 중 서비스 이용
점검 시간 동안 일시적으로 서비스 이용이 제한될 수 있습니다.
불편을 드려 죄송합니다.

점검 완료 후 더욱 안정적인 서비스를 제공하겠습니다.
      `
    },
    {
      id: 6,
      title: '📋 개인정보 처리방침 개정 안내',
      date: '2024.11.20',
      isNew: false,
      category: '안내',
      content: `
# 개인정보 처리방침 개정 안내

개인정보 보호를 강화하기 위해 개인정보 처리방침이 개정되었습니다.

## 📝 주요 변경사항
- 위치 정보 수집 및 이용에 대한 명확한 안내 추가
- 제3자 제공에 대한 상세한 설명 추가
- 이용자의 권리 강화

## 📅 시행일
2024년 11월 25일부터 시행됩니다.

## 📄 자세한 내용
**설정 > 이용약관 및 정책**에서 전체 내용을 확인하실 수 있습니다.

변경된 내용을 확인하시고 동의해주시기 바랍니다.
      `
    },
    {
      id: 7,
      title: '🏆 뱃지 시스템 완전 가이드',
      date: '2024.12.08',
      isNew: false,
      category: '가이드',
      content: `
# 뱃지 시스템 완전 가이드

LiveJourney의 뱃지 시스템을 소개합니다!

## 🎯 뱃지 시스템 개요
LiveJourney에는 **7개 카테고리, 총 20개의 뱃지**가 있습니다.
각 뱃지는 실시간 정보 공유와 기여도에 따라 획득할 수 있습니다.

## 🏆 뱃지 카테고리

### 1. 🌱 온보딩
- **첫 걸음**: 첫 번째 실시간 여행 정보를 공유했을 때 획득

### 2. 🗺️ 지역 가이드 (Locality)
- **지역 가이드**: 해당 지역 실시간 제보 10회 이상
- **지역 지킴이**: 해당 지역의 중요 정보(폐업, 혼잡 등) 5회 이상 공유
- **지역 통신원**: 해당 지역에서 3일 연속 실시간 중계
- **지역 마스터**: 해당 지역 활동량 상위 1% 기록

### 3. ⚡ 실시간 정보 (Speed)
- **날씨요정**: 비/눈 등 기상 변화 시 10분 이내 현장 제보 5회
- **웨이팅 요정**: 웨이팅 정보를 빠르게 공유한 사용자
- **혼잡도 요정**: 혼잡한 장소를 실시간으로 알려준 사용자

### 4. 🤝 도움 지수 (Helpfulness)
- **도움 요정**: SOS 요청에 도움을 준 사용자
- **정보 나눔가**: 유용한 정보를 많이 공유한 사용자

### 5. ✅ 정확한 정보 (Accuracy)
- **정확도 마스터**: 정확한 정보를 많이 공유한 사용자

### 6. 😊 친절한 여행자 (Kindness)
- **친절왕**: 다른 사용자들에게 친절하게 답변한 사용자

### 7. 🌟 기여도 (Contribution)
- **기여왕**: 전체적으로 많은 기여를 한 사용자

## 📍 뱃지 확인 방법
**프로필** 탭에서 **뱃지** 메뉴를 선택하면 획득한 뱃지를 확인할 수 있습니다.
각 뱃지의 진행 상황도 확인할 수 있습니다.

## 💡 뱃지 획득 팁
- 실시간 정보를 많이 공유할수록 더 많은 뱃지를 획득할 수 있습니다
- 특정 지역에 집중하여 정보를 공유하면 지역 뱃지를 획득하기 쉽습니다
- 정확하고 유용한 정보를 공유하면 더 높은 등급의 뱃지를 받을 수 있습니다
- 다른 사용자들을 도와주면 도움 지수 뱃지를 획득할 수 있습니다

## 🎨 뱃지의 의미
- 뱃지를 많이 모을수록 프로필이 더 화려해집니다
- 특별한 뱃지는 다른 사용자들에게 보여질 수 있습니다
- 뱃지는 당신의 기여도를 보여주는 명예의 상징입니다

다양한 뱃지를 모아보세요!
      `
    },
    {
      id: 8,
      title: '🆘 지금 상황 알아보기 기능 안내',
      date: '2024.12.05',
      isNew: false,
      category: '가이드',
      content: `
# 지금 상황 알아보기 기능 안내

LiveJourney의 "지금 상황 알아보기" 기능을 소개합니다!

## 🆘 기능 소개
지도 화면에서 **"지금 상황 알아보기"** 버튼을 사용하면 특정 위치에 대한 질문을 할 수 있고, 주변 사용자들이 실시간으로 답변해줍니다.

## 📍 사용 방법
1. **지도** 탭으로 이동하세요
2. 상단 필터 영역에서 **"지금 상황 알아보기"** 버튼을 클릭하세요
3. 지도에서 궁금한 위치를 선택하거나 직접 질문을 입력하세요
4. 질문을 등록하면 주변 사용자들에게 알림이 전송됩니다

## 💬 질문 예시
- "이 근처에 주차장이 있나요?"
- "지금 혼잡한가요?"
- "웨이팅이 얼마나 걸리나요?"
- "이 식당 지금 열려있나요?"
- "주변에 화장실이 있나요?"

## 🤝 답변하기
- 메인 화면에서 주변 SOS 요청을 확인할 수 있습니다
- 답변할 수 있는 질문이 있으면 도움을 주세요!
- 도움을 주면 "도움 요정" 뱃지를 획득할 수 있습니다

## ⚠️ 주의사항
- 정확한 정보를 제공해주세요
- 부적절한 질문은 삭제될 수 있습니다
- 질문과 답변은 모두 실시간 정보를 위한 것입니다

여행자들을 도와주는 따뜻한 커뮤니티를 만들어가요!
      `
    },
    {
      id: 9,
      title: '⏰ 48시간 클린 시스템 안내',
      date: '2024.12.03',
      isNew: false,
      category: '안내',
      content: `
# 48시간 클린 시스템 안내

LiveJourney는 **과거의 정보가 아닌, 지금 이 순간의 정보**만 제공합니다.

## 🎯 시스템 목적
- 오래된 정보로 인한 혼란 방지
- 항상 최신의 실시간 정보만 제공
- 신뢰할 수 있는 정보만 유지

## ⏰ 작동 방식
- 업로드된 사진과 정보는 48시간 동안 표시됩니다
- 48시간이 지나면 자동으로 관리되어 더 이상 메인 피드에 표시되지 않습니다
- 오래된 정보는 과거 기록으로만 보관됩니다

## 💡 왜 48시간인가요?
- 날씨, 혼잡도, 개화 상태 등은 시간이 지나면 변할 수 있습니다
- 48시간은 실시간 정보의 유효성을 보장하는 최적의 기간입니다
- 항상 최신 정보만 볼 수 있어 더 정확한 여행 계획을 세울 수 있습니다

## 📸 정보 공유 팁
- 자주 업로드하면 더 많은 사람들이 최신 정보를 볼 수 있습니다
- 중요한 정보(폐업, 혼잡 등)는 빠르게 공유해주세요
- 실시간 정보를 많이 공유하면 뱃지를 획득할 수 있습니다

항상 최신 정보를 제공하기 위해 노력하겠습니다!
      `
    },
    {
      id: 10,
      title: '🤖 AI 자동 분류 기능 안내',
      date: '2024.12.01',
      isNew: false,
      category: '안내',
      content: `
# AI 자동 분류 기능 안내

LiveJourney는 Google Vision AI를 사용하여 사진을 자동으로 분류합니다.

## 🤖 AI 분류 기능
- 업로드한 사진을 AI가 자동으로 분석합니다
- 맛집, 관광지, 개화정보, 카페 등으로 자동 분류됩니다
- 해시태그도 자동으로 추천해줍니다

## 📸 분류 카테고리
- **맛집정보**: 음식 사진이 감지되면 자동으로 맛집 카테고리로 분류
- **개화정보**: 꽃, 벚꽃 등이 감지되면 개화정보로 분류
- **가볼만한 곳**: 관광지, 명소 등이 감지되면 가볼만한 곳으로 분류
- **카페**: 카페 관련 사진이 감지되면 카페로 분류

## 💡 활용 방법
- 사진을 업로드하면 AI가 자동으로 카테고리를 제안합니다
- 제안된 카테고리를 확인하고 수정할 수 있습니다
- AI가 추천한 해시태그를 활용하면 더 많은 사람들이 찾을 수 있습니다

## 🎯 정확도 향상
- AI는 계속 학습하여 더 정확한 분류를 제공합니다
- 사용자가 수정한 정보는 AI 학습에 반영됩니다

AI가 도와주는 스마트한 여행 정보 공유를 경험해보세요!
      `
    },
    {
      id: 11,
      title: '🚀 LiveJourney 정식 출시 안내',
      date: '2024.09.01',
      isNew: false,
      category: '출시',
      content: `
# LiveJourney 정식 출시 안내

안녕하세요! LiveJourney가 정식으로 출시되었습니다!

## 🎯 서비스 소개
LiveJourney는 **과거의 정보가 아닌, 지금 이 순간의 여정(Journey)**을 가장 스마트하고 즐겁게 완성하는 실시간 여행 정보 공유 플랫폼입니다.

## 🎉 출시 기념 이벤트
- 출시 기념 특별 뱃지 지급
- 첫 사진 업로드 시 특별 혜택 제공
- 초기 사용자 특별 혜택

## 📱 주요 기능
- **실시간 정보 공유**: 지금 이 순간의 여행지를 사진으로 공유
- **지도 기반 탐색**: 사진 핀으로 여행지를 한눈에 확인
- **AI 자동 분류**: Google Vision AI가 자동으로 카테고리 분류
- **뱃지 시스템**: 여행 기록에 따라 뱃지 획득 (7개 카테고리, 20개 뱃지)
- **경로 만들기**: 여러 장소를 선택하여 여행 경로 생성
- **48시간 클린 시스템**: 항상 최신 정보만 제공
- **지금 상황 알아보기**: 실시간 질문과 답변
- **일일 타이틀 시스템**: 매일 리셋되는 24시간 명예 챌린지

## 🌟 서비스 철학
"과거의 정보가 아닌, 지금 당신의 눈 앞에 펼쳐진 여정을 가장 스마트하고 즐겁게 완성합니다."

많은 관심과 이용 부탁드립니다!
      `
    }
  ];

  // 관리자 작성 공지를 상단에, 그 다음 정적 가이드
  const notices = [...dynamicNotices, ...staticNotices];

  const handleNoticeClick = (notice) => {
    setSelectedNotice(notice);
  };

  const handleCloseDetail = () => {
    setSelectedNotice(null);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-hidden relative">
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border-light bg-surface-light/80 dark:border-border-dark dark:bg-surface-dark/80 backdrop-blur-sm px-4">
          <button
            onClick={() => (fromMain ? navigate('/main', { replace: true }) : navigate(-1))}
            className="flex size-12 shrink-0 items-center justify-center cursor-pointer text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-black dark:text-white">공지사항</h1>
          <div className="flex size-12 shrink-0 items-center justify-end"></div>
        </header>

        <main className="flex-grow pb-24 bg-surface-light dark:bg-surface-dark">
          <div className="flex flex-col">
            {notices.map((notice) => (
              <button
                key={notice.id}
                onClick={() => handleNoticeClick(notice)}
                className="flex items-center border-b border-border-light dark:border-border-dark px-4 py-4 hover:bg-surface-subtle-light dark:hover:bg-surface-subtle-dark transition-colors cursor-pointer"
              >
                <div className="flex-grow text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold leading-normal text-black dark:text-white">
                      {notice.title}
                    </p>
                    {notice.is_pinned && (
                      <span className="inline-block rounded bg-amber-500 text-white px-1.5 py-0.5 text-xs font-bold">
                        상단고정
                      </span>
                    )}
                    {notice.isNew && (
                      <span className="inline-block rounded bg-red-500 text-white px-1.5 py-0.5 text-xs font-bold">
                        NEW
                      </span>
                    )}
                    {notice.category && (
                      <span className="inline-block rounded bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                        {notice.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-normal leading-normal text-black/70 dark:text-white/70">
                    {notice.date}
                  </p>
                </div>
                <span className="material-symbols-outlined text-black/70 dark:text-white/70">
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        </main>

        {/* 공지사항 상세 모달 */}
        {selectedNotice && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCloseDetail}>
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-black dark:text-white">
                    {selectedNotice.title}
                  </h2>
                  {selectedNotice.isNew && (
                    <span className="inline-block rounded bg-red-500 text-white px-1.5 py-0.5 text-xs font-bold">
                      NEW
                    </span>
                  )}
                </div>
                <button
                  onClick={handleCloseDetail}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-black dark:text-white">close</span>
                </button>
              </div>

              {/* 내용 */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  {selectedNotice.date} {selectedNotice.category && `· ${selectedNotice.category}`}
                </div>
                <div
                  className="prose dark:prose-invert max-w-none text-black dark:text-white whitespace-pre-line"
                  dangerouslySetInnerHTML={{
                    __html: selectedNotice.content
                      .split('\n')
                      .map(line => {
                        if (line.startsWith('# ')) {
                          return `<h1 class="text-2xl font-bold mt-6 mb-4">${line.substring(2)}</h1>`;
                        } else if (line.startsWith('## ')) {
                          return `<h2 class="text-xl font-bold mt-5 mb-3">${line.substring(3)}</h2>`;
                        } else if (line.startsWith('### ')) {
                          return `<h3 class="text-lg font-semibold mt-4 mb-2">${line.substring(4)}</h3>`;
                        } else if (line.startsWith('- ')) {
                          return `<li class="ml-4 mb-1">${line.substring(2)}</li>`;
                        } else if (line.trim() === '') {
                          return '<br />';
                        } else {
                          return `<p class="mb-2">${line}</p>`;
                        }
                      })
                      .join('')
                  }}
                />
              </div>
            </div>
          </div>
        )}

      </div>

      <BottomNavigation />
    </div>
  );
};

export default NoticesScreen;



