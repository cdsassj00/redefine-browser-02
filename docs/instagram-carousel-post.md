# Instagram 5장 카드 포스팅

## 업로드 규격

- 원본 카드: `1080×1350` 피드용 4:5
- 안전영역: 중앙 `1080×1080`
- 핵심 제목, 시리즈 번호, 브랜드명, 대표 그래픽은 모두 중앙 1:1 안전영역 안에 배치
- 프로필 그리드 확인용 크롭: `docs/instagram-cards/safe-crop-1x1`

## 카드 구성

1. 가격보다 먼저 돈의 흐름을 봅니다
2. 왜 수급분석이 중요할까?
3. 5일 표에서 120거래일 대시보드로
4. 표에서 끝내지 않고 전략까지
5. GitHub에서 받고 CDSA에서 배웁니다

## 캡션

국내증시 수급분석기라는 Chrome 확장프로그램을 만들었습니다.

가격은 결과이고, 수급은 그 가격을 만든 돈의 흐름입니다.

국내증시는 외국인, 기관, 개인이라는 투자 주체별 매매 동향이 비교적 잘 공개됩니다. 그래서 가격만 보는 것보다 “누가 사고 있는가”, “누가 빠지고 있는가”, “그 수급이 가격을 지지하고 있는가”를 같이 보는 게 중요합니다.

처음 버전은 최근 5거래일 수급을 보여주는 정도였습니다.  
그런데 5일만 보고 매수/매도 전략을 말하기엔 너무 얕았습니다.

그래서 다시 만들었습니다.

- 20/60/120거래일 장기 수급 수집
- 외국인+기관 누적 순매수/순매도
- 개인/기타 잔여 수급 추정
- 외국인 보유율 변화
- 가격과 수급의 괴리
- 수급 막대 그래프
- 가격·외국인 보유율 라인 그래프
- 수급 기준 매수·매도 전략

이 도구는 투자 권유가 아니라, 국내증시 수급 데이터를 더 빠르고 구조적으로 읽기 위한 참고용 분석 도구입니다.

소스 코드와 설치용 ZIP은 GitHub에 공개했습니다.

GitHub  
https://github.com/cdsassj00/redefine-browser-02

설치용 ZIP  
https://github.com/cdsassj00/redefine-browser-02/releases/download/v1.3.1/naver-supply-extension.zip

AI·데이터 교육과 바이브 코딩, 현장에서 바로 쓰는 도구 제작은 CDSA에서 함께합니다.

CDSA  
https://cdsa.kr

#국내증시 #수급분석 #네이버증권 #크롬확장프로그램 #주식수급 #외국인수급 #기관수급 #데이터분석 #바이브코딩 #업무자동화 #AI교육 #CDSA #한국데이터사이언티스트협회

## 댓글 고정용 링크

GitHub: https://github.com/cdsassj00/redefine-browser-02  
ZIP: https://github.com/cdsassj00/redefine-browser-02/releases/download/v1.3.1/naver-supply-extension.zip  
CDSA: https://cdsa.kr
