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
const CAROUSEL_SLIDES = Array.from({ length: 12 }, (_, i) => ({
  type: 'photo',
  src: `assets/mobile/mobile-pair-${String(i + 1).padStart(2, '0')}.jpg`,
  alt: `모바일 화면 세트 ${i + 1}`,
}));
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

// ===== 회원가입 / 로그인 (Firebase Authentication, HATS 프로젝트 공용) =====
const firebaseConfig = {
  apiKey: 'AIzaSyAzPrf9b4y2bAT_TB24Twdu9gu9i-sIV7k',
  authDomain: 'hats-398d5.firebaseapp.com',
  projectId: 'hats-398d5',
  storageBucket: 'hats-398d5.firebasestorage.app',
  messagingSenderId: '998297935635',
  appId: '1:998297935635:web:b6e969f3fa0052f97884e6',
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

function authSignUp(email, password) {
  return firebase.auth().createUserWithEmailAndPassword(email, password);
}

function authLogin(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password);
}

function authLoginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider);
}

function authLogout() {
  return firebase.auth().signOut().then(() => { window.location.href = 'index.html'; });
}

function authErrorMessage(err) {
  const map = {
    'auth/email-already-in-use': '이미 가입된 이메일입니다.',
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/user-not-found': '가입되지 않은 이메일입니다.',
    'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/network-request-failed': '네트워크 오류입니다. 연결을 확인해주세요.',
  };
  return map[err.code] || ('오류: ' + err.message);
}

async function handleLogin(e) {
  e.preventDefault();
  const status = document.getElementById('authStatus');
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  status.textContent = '로그인 중...';
  try {
    await authLogin(email, password);
    window.location.href = 'account.html';
  } catch (err) {
    status.textContent = authErrorMessage(err);
  }
  return false;
}

async function handleSignup(e) {
  e.preventDefault();
  const status = document.getElementById('authStatus');
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const password2 = document.getElementById('password2').value;
  if (password !== password2) {
    status.textContent = '비밀번호가 일치하지 않습니다.';
    return false;
  }
  if (password.length < 6) {
    status.textContent = '비밀번호는 6자 이상이어야 합니다.';
    return false;
  }
  status.textContent = '가입 처리 중...';
  try {
    await authSignUp(email, password);
    window.location.href = 'account.html';
  } catch (err) {
    status.textContent = authErrorMessage(err);
  }
  return false;
}

async function handleGoogleAuth() {
  const status = document.getElementById('authStatus');
  try {
    await authLoginGoogle();
    window.location.href = 'account.html';
  } catch (err) {
    if (status) status.textContent = authErrorMessage(err);
  }
}

function renderAuthWidget(user) {
  const menu = document.getElementById('mainMenu');
  if (!menu) return;
  let widget = document.getElementById('authWidget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'authWidget';
    widget.className = 'auth-widget';
    menu.appendChild(widget);
  }
  if (user) {
    const name = user.displayName || (user.email ? user.email.split('@')[0] : '회원');
    widget.innerHTML = `
      <a href="account.html" class="auth-user">${name}님</a>
      <button class="auth-logout" onclick="authLogout()">로그아웃</button>
    `;
  } else {
    widget.innerHTML = `
      <a href="login.html" class="auth-link">로그인</a>
      <a href="signup.html" class="btn btn-primary auth-signup-btn">회원가입</a>
    `;
  }
}

function initAccountPage() {
  const card = document.getElementById('accountCard');
  if (!card) return;
  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    const joined = user.metadata && user.metadata.creationTime
      ? new Date(user.metadata.creationTime).toLocaleDateString('ko-KR')
      : '-';
    card.innerHTML = `
      <div class="info-row"><strong>이메일</strong>${user.email || '-'}</div>
      <div class="info-row"><strong>가입일</strong>${joined}</div>
      <button class="btn" style="margin-top:16px" onclick="authLogout()">로그아웃</button>
    `;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBgm();
  loadVideos();

  if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged(renderAuthWidget);
  }
  initAccountPage();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(() => console.log('Service Worker registration failed'));
    });
  }
});
