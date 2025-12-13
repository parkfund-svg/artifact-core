// Google Apps Script 백엔드 코드
// 사용법: Google Apps Script 에디터에 붙여넣고 웹앱으로 배포

// === 설정 ===
const ADMIN_EMAIL = 'parkfund@naver.com';
const SHEET_NAME = '상담신청';

// 스프레드시트 가져오기 또는 생성
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 헤더 추가
    sheet.appendRow(['접수일시', '이름', '이메일', '관심상품', '통화시간', '문의내용', 'IP주소', 'User-Agent']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#6FAFC7').setFontColor('#FFFFFF');
  }
  
  return sheet;
}

// POST 요청 처리 (상담 신청)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = getSheet();
    
    // 데이터 저장
    const row = [
      new Date(data.ts).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      data.name,
      data.email,
      data.product,
      data.time,
      data.message,
      e.parameter.userip || 'N/A',
      e.parameter.useragent || 'N/A'
    ];
    
    sheet.appendRow(row);
    
    // 이메일 발송
    try {
      const subject = `[아티팩트코어] 새로운 상담 신청 - ${data.name}`;
      const body = `
새로운 상담 신청이 접수되었습니다.

━━━━━━━━━━━━━━━━━━━━
📋 상담 신청 정보
━━━━━━━━━━━━━━━━━━━━

접수일시: ${row[0]}
이름: ${data.name}
이메일: ${data.email}
관심상품: ${data.product}
통화시간: ${data.time}

문의내용:
${data.message}

━━━━━━━━━━━━━━━━━━━━

스프레드시트에서 전체 내역 확인:
${SpreadsheetApp.getActiveSpreadsheet().getUrl()}

관리자 페이지:
https://artifact-core.com/admin.html
비밀번호: artifact2025
      `;
      
      GmailApp.sendEmail(ADMIN_EMAIL, subject, body);
      Logger.log('이메일 발송 성공');
    } catch (mailError) {
      Logger.log('이메일 발송 실패: ' + mailError.toString());
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: '접수 완료' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('오류: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET 요청 처리 (관리자 페이지 데이터 조회)
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getSubmissions') {
      const sheet = getSheet();
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      
      const submissions = rows.map(row => {
        return {
          ts: row[0],
          name: row[1],
          email: row[2],
          product: row[3],
          time: row[4],
          message: row[5],
          ip: row[6],
          useragent: row[7]
        };
      });
      
      // CORS 헤더 추가
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, data: submissions.reverse() })) // 최신순
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('오류: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
