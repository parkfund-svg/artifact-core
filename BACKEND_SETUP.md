# 백엔드 설정 가이드

## 1단계: Google Sheets + Apps Script 설정

### 1. 새 Google Sheets 생성
1. [Google Sheets](https://sheets.google.com) 접속
2. 새 스프레드시트 만들기
3. 이름: "아티팩트코어 상담신청"

### 2. Apps Script 에디터 열기
1. 상단 메뉴: **확장 프로그램** → **Apps Script**
2. 기존 코드 모두 삭제
3. `backend-apps-script.js` 파일의 내용을 복사해서 붙여넣기

### 3. 웹앱으로 배포
1. Apps Script 에디터 상단의 **배포** 버튼 클릭
2. **새 배포** 선택
3. 설정:
   - **유형**: 웹 앱
   - **설명**: "상담신청 백엔드"
   - **실행 계정**: 나 (본인 이메일)
   - **액세스 권한**: **모든 사용자** (중요!)
4. **배포** 클릭
5. **웹 앱 URL** 복사 (예: `https://script.google.com/macros/s/ABC.../exec`)

### 4. 권한 승인
- 처음 배포 시 권한 요청이 나오면:
  1. "권한 검토" 클릭
  2. Google 계정 선택
  3. "고급" → "안전하지 않은 페이지로 이동" 클릭
  4. "허용" 클릭

## 2단계: 홈페이지에 URL 연결

### index.html 파일 수정
현재 WEBHOOK_URL을 새로 배포한 URL로 변경:

```javascript
const WEBHOOK_URL = 'https://script.google.com/macros/s/새로배포한URL/exec';
```

### admin.html 파일에도 추가
관리자 페이지에서 데이터를 불러올 수 있도록 동일한 URL 설정

## 3단계: 테스트

### 상담 신청 테스트
1. 홈페이지 Contact 폼 작성 후 제출
2. Google Sheets에 데이터가 추가되는지 확인
3. 이메일(parkfund@naver.com)로 알림이 오는지 확인

### 관리자 페이지 테스트
1. admin.html 접속
2. 데이터가 표시되는지 확인

## 문제 해결

### 이메일이 안 올 때
- Gmail 설정 → 필터 및 차단된 주소 확인
- 스팸 메일함 확인

### 데이터가 안 보일 때
- 웹앱 배포 시 "모든 사용자" 액세스로 설정했는지 확인
- 브라우저 콘솔(F12)에서 에러 메시지 확인

### CORS 에러가 날 때
- Apps Script는 자동으로 CORS를 허용하므로 정상
- URL이 정확한지 확인

## 보안 강화 (선택사항)

### 관리자 페이지 비밀번호 추가
간단한 비밀번호를 admin.html에 추가하여 무단 접근 방지

### API 키 인증
Apps Script에서 요청 헤더의 API 키를 검증하도록 수정
