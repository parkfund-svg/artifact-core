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

// 기능소개 영상 모달 (전략빌더 등 기능 카드용)
function ensureFeatureVideoModal() {
  if (document.getElementById('featureVideoModal')) return;
  const modal = document.createElement('div');
  modal.className = 'feature-video-modal';
  modal.id = 'featureVideoModal';
  modal.innerHTML = `
    <div class="feature-video-modal-inner">
      <button class="feature-video-close" onclick="closeFeatureVideo()">✕</button>
      <video id="featureVideoPlayer" controls playsinline></video>
    </div>
  `;
  modal.addEventListener('click', (e) => { if (e.target === modal) closeFeatureVideo(); });
  document.body.appendChild(modal);
}

function openFeatureVideo(el) {
  ensureFeatureVideoModal();
  const src = el.getAttribute('data-video');
  const poster = el.getAttribute('data-poster');
  const player = document.getElementById('featureVideoPlayer');
  player.src = src;
  if (poster) player.poster = poster;
  document.getElementById('featureVideoModal').classList.add('open');
  player.play().catch(() => {});
}

function closeFeatureVideo() {
  const modal = document.getElementById('featureVideoModal');
  const player = document.getElementById('featureVideoPlayer');
  if (player) { player.pause(); player.currentTime = 0; }
  if (modal) modal.classList.remove('open');
}

document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('featureVideoModal');
  if (modal && modal.classList.contains('open') && e.key === 'Escape') closeFeatureVideo();
});

// 모바일 스크린샷 캐러셀 (모바일 지원 카드용)
const CAROUSEL_SLIDES = [
  { type: 'logo', src: 'assets/logo-quantrea-x.png', alt: 'Quantrea-X' },
  { type: 'photo', src: 'assets/mobile/phone-1.png', alt: '모바일 화면 1' },
  { type: 'photo', src: 'assets/mobile/phone-2.png', alt: '모바일 화면 2' },
  { type: 'photo', src: 'assets/mobile/phone-3.png', alt: '모바일 화면 3' },
  { type: 'photo', src: 'assets/mobile/phone-4.png', alt: '모바일 화면 4' },
  { type: 'photo', src: 'assets/mobile/phone-5.png', alt: '모바일 화면 5' },
  { type: 'photo', src: 'assets/mobile/phone-6.png', alt: '모바일 화면 6' },
  { type: 'photo', src: 'assets/mobile/phone-7.png', alt: '모바일 화면 7' },
  { type: 'photo', src: 'assets/mobile/phone-8.png', alt: '모바일 화면 8' },
  { type: 'photo', src: 'assets/mobile/phone-9.png', alt: '모바일 화면 9' },
  { type: 'photo', src: 'assets/mobile/phone-10.png', alt: '모바일 화면 10' },
  { type: 'photo', src: 'assets/mobile/phone-11.png', alt: '모바일 화면 11' },
  { type: 'photo', src: 'assets/mobile/phone-12.png', alt: '모바일 화면 12' },
  { type: 'logo', src: 'assets/logo-ghvia.png', alt: 'GHVIA' },
];
let carouselIndex = 0;

function ensureCarouselModal() {
  if (document.getElementById('carouselModal')) return;

  const modal = document.createElement('div');
  modal.className = 'carousel-modal';
  modal.id = 'carouselModal';

  const slidesHtml = CAROUSEL_SLIDES.map(s =>
    `<div class="carousel-slide${s.type === 'logo' ? ' logo-slide' : ''}"><img src="${s.src}" alt="${s.alt}" /></div>`
  ).join('');
  const dotsHtml = CAROUSEL_SLIDES.map((_, i) =>
    `<button class="dot${i === 0 ? ' active' : ''}" onclick="carouselGoTo(${i})" aria-label="slide ${i + 1}"></button>`
  ).join('');

  modal.innerHTML = `
    <div class="carousel-modal-inner">
      <button class="carousel-close" onclick="closeCarousel()">✕</button>
      <div class="carousel-viewport">
        <div class="carousel-track" id="carouselTrack">${slidesHtml}</div>
        <button class="carousel-nav prev" onclick="carouselPrev()">‹</button>
        <button class="carousel-nav next" onclick="carouselNext()">›</button>
      </div>
      <div class="carousel-dots" id="carouselDots">${dotsHtml}</div>
    </div>
  `;
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCarousel(); });
  document.body.appendChild(modal);
}

function updateCarousel() {
  const track = document.getElementById('carouselTrack');
  if (track) track.style.transform = `translateX(-${carouselIndex * 100}%)`;
  document.querySelectorAll('#carouselDots .dot').forEach((d, i) => {
    d.classList.toggle('active', i === carouselIndex);
  });
}

function carouselGoTo(i) {
  carouselIndex = i;
  updateCarousel();
}

function carouselPrev() {
  carouselIndex = (carouselIndex - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length;
  updateCarousel();
}

function carouselNext() {
  carouselIndex = (carouselIndex + 1) % CAROUSEL_SLIDES.length;
  updateCarousel();
}

function openCarousel() {
  ensureCarouselModal();
  carouselIndex = 0;
  updateCarousel();
  document.getElementById('carouselModal').classList.add('open');
}

function closeCarousel() {
  const modal = document.getElementById('carouselModal');
  if (modal) modal.classList.remove('open');
}

document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('carouselModal');
  if (!modal || !modal.classList.contains('open')) return;
  if (e.key === 'Escape') closeCarousel();
  if (e.key === 'ArrowLeft') carouselPrev();
  if (e.key === 'ArrowRight') carouselNext();
});

// 배경음악: 페이지 전체 공용 (뮤트 여부는 localStorage로 기억, 실제 재생은 사용자 클릭 후 시작)
function initBgm() {
  const audio = document.createElement('audio');
  audio.id = 'bgmAudio';
  audio.src = '/assets/audio/bgm.mp3';
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0.35;
  document.body.appendChild(audio);

  const btn = document.createElement('button');
  btn.id = 'bgmToggle';
  btn.className = 'bgm-toggle';
  btn.setAttribute('aria-label', 'background music toggle');
  btn.textContent = '🔇';
  document.body.appendChild(btn);

  const setPlayingUI = (playing) => {
    btn.classList.toggle('playing', playing);
    btn.textContent = playing ? '🔊' : '🔇';
  };

  btn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        setPlayingUI(true);
        localStorage.setItem('bgmPlaying', '1');
      }).catch(() => {});
    } else {
      audio.pause();
      setPlayingUI(false);
      localStorage.setItem('bgmPlaying', '0');
    }
  });

  // 이전에 재생 중이었다면 이번 페이지에서도 자동 재개 시도 (브라우저 정책상 차단될 수 있음 — 그 경우 버튼을 눌러야 함)
  if (localStorage.getItem('bgmPlaying') === '1') {
    audio.play().then(() => setPlayingUI(true)).catch(() => setPlayingUI(false));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initBgm();
  loadVideos();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(() => console.log('Service Worker registration failed'));
    });
  }
});
