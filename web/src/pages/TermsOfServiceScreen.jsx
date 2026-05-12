import React from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import PageSeo from '../components/PageSeo';
import { PAGE_SEO } from '../config/seo';

const TermsOfServiceScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full flex-col bg-background-light dark:bg-background-dark group/design-root">
      <PageSeo {...PAGE_SEO.termsOfService} />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border-light bg-surface-light/80 dark:border-border-dark dark:bg-surface-dark/80 backdrop-blur-sm px-4">
        <button
          onClick={() => navigate('/terms-and-policies')}
          className="flex size-12 shrink-0 items-center justify-start cursor-pointer text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-black dark:text-white font-display">서비스 이용 약관</h1>
        <div className="flex size-12 shrink-0 items-center justify-end"></div>
      </header>

        <main className="flex-grow pb-4 bg-surface-light dark:bg-surface-dark">
        <div className="p-6 space-y-6">
          {/* 제1조 */}
          <div className="space-y-4 text-black dark:text-white">
            <h2 className="text-xl font-bold text-black dark:text-white">제1조 (목적)</h2>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              이 약관은 LiveJourney 회사(전자상거래 사업자)가 운영하는 LiveJourney 사이버 몰(이하 "몰"이라 한다)에서 제공하는 인터넷 관련 서비스(이하 "서비스"라 한다)를 이용함에 있어 사이버 몰과 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </div>

          {/* 제2조 */}
          <div className="space-y-4 text-black dark:text-white">
            <h2 className="text-xl font-bold text-black dark:text-white">제2조 (정의)</h2>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ① "몰"이란 LiveJourney 회사가 재화 또는 용역(이하 "재화 등"이라 함)을 이용자에게 제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 등을 거래할 수 있도록 설정한 가상의 영업장을 말하며, 아울러 사이버몰을 운영하는 사업자의 의미로도 사용합니다.
            </p>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ② "이용자"란 "몰"에 접속하여 이 약관에 따라 "몰"이 제공하는 서비스를 받는 회원 및 비회원을 말합니다.
            </p>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ③ '회원'이라 함은 "몰"에 회원등록을 한 자로서, 계속적으로 "몰"이 제공하는 서비스를 이용할 수 있는 자를 말합니다.
            </p>
          </div>

          {/* 제3조 */}
          <div className="space-y-4 text-black dark:text-white">
            <h2 className="text-xl font-bold text-black dark:text-white">제3조 (약관 등의 명시와 설명 및 개정)</h2>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ① "몰"은 이 약관의 내용과 상호 및 대표자 성명, 영업소 소재지 주소(소비자의 불만을 처리할 수 있는 곳의 주소를 포함), 전화번호, 모사전송번호, 전자우편주소, 사업자등록번호, 통신판매업 신고번호, 개인정보관리책임자등을 이용자가 쉽게 알 수 있도록 LiveJourney 사이버몰의 초기 서비스화면(전면)에 게시합니다. 다만, 약관의 내용은 이용자가 연결화면을 통하여 볼 수 있도록 할 수 있습니다.
            </p>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ② "몰은 이용자가 약관에 동의하기에 앞서 약관에 정하여져 있는 내용 중 청약철회, 배송책임, 환불조건 등과 같은 중요한 내용을 이용자가 이해할 수 있도록 별도의 연결화면 또는 팝업화면 등을 제공하여 이용자의 확인을 구하여야 합니다.
            </p>
          </div>

          {/* 제4조 */}
          <div className="space-y-4 text-black dark:text-white">
            <h2 className="text-xl font-bold text-black dark:text-white">제4조 (서비스의 제공 및 변경)</h2>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ① "몰"은 다음과 같은 업무를 수행합니다.
              <br />1. 재화 또는 용역에 대한 정보 제공 및 구매계약의 체결
              <br />2. 구매계약이 체결된 재화 또는 용역의 배송
              <br />3. 기타 "몰"이 정하는 업무
            </p>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ② "몰"은 재화 또는 용역의 품절 또는 기술적 사양의 변경 등의 경우에는 장차 체결되는 계약에 의해 제공할 재화 또는 용역의 내용을 변경할 수 있습니다. 이 경우에는 변경된 재화 또는 용역의 내용 및 제공일자를 명시하여 현재의 재화 또는 용역의 내용을 게시한 곳에 즉시 공지합니다.
            </p>
          </div>

          {/* 제5조 */}
          <div className="space-y-4 text-black dark:text-white">
            <h2 className="text-xl font-bold text-black dark:text-white">제5조 (서비스의 중단)</h2>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ① "몰"은 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.
            </p>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ② "몰"은 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 이용자 또는 제3자가 입은 손해에 대하여 배상합니다. 단, "몰"이 고의 또는 과실이 없음을 입증하는 경우에는 그러하지 아니합니다.
            </p>
          </div>

          {/* 제6조 */}
          <div className="space-y-4 text-black dark:text-white">
            <h2 className="text-xl font-bold text-black dark:text-white">제6조 (회원가입)</h2>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ① 이용자는 "몰"이 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로서 회원가입을 신청합니다.
            </p>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ② "몰"은 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.
              <br />1. 가입신청자가 이 약관 제7조제3항에 의하여 이전에 회원자격을 상실한 적이 있는 경우
              <br />2. 등록 내용에 허위, 기재누락, 오기가 있는 경우
              <br />3. 기타 회원으로 등록하는 것이 "몰"의 기술상 현저히 지장이 있다고 판단되는 경우
            </p>
          </div>

          {/* 제7조 */}
          <div className="space-y-4 text-black dark:text-white">
            <h2 className="text-xl font-bold text-black dark:text-white">제7조 (회원 탈퇴 및 자격 상실 등)</h2>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ① 회원은 "몰"에 언제든지 탈퇴를 요청할 수 있으며 "몰"은 즉시 회원탈퇴를 처리합니다.
            </p>
            <p className="text-sm leading-relaxed text-black/70 dark:text-white/70">
              ② 회원이 다음 각 호의 사유에 해당하는 경우, "몰"은 회원자격을 제한 및 정지시킬 수 있습니다.
              <br />1. 가입 신청 시에 허위 내용을 등록한 경우
              <br />2. "몰"을 이용하여 구입한 재화 등의 대금, 기타 "몰"이용에 관련하여 회원이 부담하는 채무를 기일에 지급하지 않는 경우
              <br />3. 다른 사람의 "몰" 이용을 방해하거나 그 정보를 도용하는 등 전자상거래 질서를 위협하는 경우
            </p>
          </div>

          {/* 시행일자 */}
          <div className="pt-6 pb-2">
            <p className="text-xs text-black/70 dark:text-white/70">시행일자: 2023년 10월 26일</p>
          </div>
        </div>
        </main>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default TermsOfServiceScreen;



