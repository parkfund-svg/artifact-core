// Google Apps Script 백엔드 코드
// 사용법: Google Apps Script 에디터에 붙여넣고 웹앱으로 배포

// === 설정 ===
const ADMIN_EMAIL = 'parkfund@naver.com';
const SHEET_NAME = '상담신청';
const VIDEO_SHEET_NAME = '매매영상';
const ADMIN_PASSWORD = 'artifact2025'; // admin.html / videos-admin.html과 동일하게 유지

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

// 매매실제영상 시트 가져오기 또는 생성
function getVideoSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(VIDEO_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(VIDEO_SHEET_NAME);
    sheet.appendRow(['등록일시', '영상ID', '제목', '업로드일']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#6FAFC7').setFontColor('#FFFFFF');
  }

  return sheet;
}

// POST 요청 처리 (상담 신청 / 영상 추가 / 영상 삭제)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === 'addVideo') {
      return addVideo(data);
    }
    if (data.action === 'deleteVideo') {
      return deleteVideo(data);
    }

    // 기본 동작: 상담 신청 (기존 Contact 폼과 동일)
    const sheet = getSheet();

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

// 영상 추가 (관리자 비밀번호 필요)
function addVideo(data) {
  if (data.password !== ADMIN_PASSWORD) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: '비밀번호가 틀렸습니다.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (!data.videoId || !data.title) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: '영상ID와 제목은 필수입니다.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getVideoSheet();
  const row = sheet.getLastRow() + 1;
  // 업로드일이 YYYY-MM-DD 형태라 시트가 자동으로 날짜 타입으로 바꿔버리는 것을 막기 위해
  // 저장 전에 셀 서식을 일반 텍스트로 고정한다.
  sheet.getRange(row, 1, 1, 4).setNumberFormat('@');
  sheet.getRange(row, 1, 1, 4).setValues([[
    new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    data.videoId,
    data.title,
    data.uploadDate || new Date().toISOString().slice(0, 10)
  ]]);

  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: '영상이 추가되었습니다.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 영상 삭제 (관리자 비밀번호 필요)
function deleteVideo(data) {
  if (data.password !== ADMIN_PASSWORD) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: '비밀번호가 틀렸습니다.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getVideoSheet();
  const values = sheet.getDataRange().getValues();

  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][1] === data.videoId) {
      sheet.deleteRow(i + 1);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, message: '영상이 삭제되었습니다.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: '해당 영상을 찾을 수 없습니다.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET 요청 처리 (관리자 페이지 데이터 조회 / 영상 목록 조회)
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getSubmissions') {
      const sheet = getSheet();
      const data = sheet.getDataRange().getValues();
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

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, data: submissions.reverse() })) // 최신순
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'getVideos') {
      const sheet = getVideoSheet();
      const data = sheet.getDataRange().getValues();
      const rows = data.slice(1);

      const videos = rows.map(row => {
        return {
          registeredAt: row[0],
          videoId: row[1],
          title: row[2],
          uploadDate: row[3]
        };
      }).sort((a, b) => (a.uploadDate < b.uploadDate ? 1 : a.uploadDate > b.uploadDate ? -1 : 0));

      return ContentService
        .createTextOutput(JSON.stringify({ success: true, data: videos }))
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
