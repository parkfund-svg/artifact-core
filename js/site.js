// 퀀트라엑스 / 지비아 공용 스크립트 — 모든 페이지에서 공유
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbwb1zjFQBFR7EAsFNgOUyIIcKMcP9aW8bbln6agOovTaagpiqZwe593HHFljGBehj1e/exec';
const ADMIN_EMAIL = 'parkfund@naver.com';

function toggleMenu() {
  const menu = document.getElementById('mainMenu');
  if (menu) menu.classList.toggle('show');
}

function closeMenu() {
  const menu = document.getElementById('mainMenu');
  if (menu) menu.classList.remove('show');
}

// 문의 폼 (contact.html 전용, 폼이 없는 페이지에서는 아무 동작 안 함)
async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById('submit-status');
  status.textContent = '전송 중...';

  const interests = Array.from(form.querySelectorAll('input[name="interest"]:checked')).map(cb => cb.value);
  const payload = {
    ts: new Date().toISOString(),
    name: form.name.value,
    email: form.email.value,
    interest: interests.join(', '),
    time: form.time.value,
    message: form.message.value,
    sendTo: ADMIN_EMAIL,
  };

  if (!WEBHOOK_URL || WEBHOOK_URL.includes('YOUR_APPS_SCRIPT_WEBAPP_URL')) {
    status.textContent = '웹훅 미설정: 로컬에만 저장되었습니다.';
  } else {
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('웹훅 전송 실패');
      status.textContent = '접수 완료: 관리자 이메일로 전송됨';
    } catch (err) {
      status.textContent = '웹훅 전송 실패: ' + err.message + ' (로컬에만 저장됨)';
    }
  }

  const existing = JSON.parse(localStorage.getItem('contactSubmissions') || '[]');
  existing.push(payload);
  localStorage.setItem('contactSubmissions', JSON.stringify(existing));

  form.reset();
  return false;
}

// 매매실제영상 (videos.html 전용): Apps Script에서 전체 영상 목록을 불러와 최신순 페이지네이션 표시
// (연결 실패 시 하드코딩된 영상들이 그대로 유지됨 — videos-admin.html에서 관리)
const VIDEOS_PER_PAGE = 6;
let allVideos = [];
let videosPage = 0;

function renderVideosPage() {
  const grid = document.getElementById('videosGrid');
  if (!grid) return;
  const start = videosPage * VIDEOS_PER_PAGE;
  const pageItems = allVideos.slice(start, start + VIDEOS_PER_PAGE);

  grid.innerHTML = pageItems.map(v => `
    <div class="card video-card">
      <div class="video-frame"><iframe src="https://www.youtube.com/embed/${v.videoId}" title="${v.title.replace(/"/g, '&quot;')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
    </div>
  `).join('');

  const totalPages = Math.max(1, Math.ceil(allVideos.length / VIDEOS_PER_PAGE));
  const pager = document.getElementById('videosPager');
  if (pager) pager.style.display = totalPages > 1 ? 'flex' : 'none';
  const pageInfo = document.getElementById('videosPageInfo');
  if (pageInfo) pageInfo.textContent = `${videosPage + 1} / ${totalPages}`;
  const prevBtn = document.getElementById('videosPrev');
  if (prevBtn) prevBtn.disabled = videosPage === 0;
  const nextBtn = document.getElementById('videosNext');
  if (nextBtn) nextBtn.disabled = videosPage >= totalPages - 1;
}

function videosPrevPage() {
  if (videosPage > 0) {
    videosPage--;
    renderVideosPage();
    document.getElementById('videosGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function videosNextPage() {
  const totalPages = Math.max(1, Math.ceil(allVideos.length / VIDEOS_PER_PAGE));
  if (videosPage < totalPages - 1) {
    videosPage++;
    renderVideosPage();
    document.getElementById('videosGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function loadVideos() {
  const grid = document.getElementById('videosGrid');
  if (!grid || !WEBHOOK_URL || WEBHOOK_URL.includes('YOUR_APPS_SCRIPT_WEBAPP_URL')) return;
  try {
    const res = await fetch(`${WEBHOOK_URL}?action=getVideos`);
    const result = await res.json();
    if (!result.success || !result.data || !result.data.length) return;

    allVideos = result.data;
    videosPage = 0;
    renderVideosPage();
  } catch (err) {
    console.log('영상 목록 로드 실패, 기본 목록 표시:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadVideos();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(() => console.log('Service Worker registration failed'));
    });
  }
});
