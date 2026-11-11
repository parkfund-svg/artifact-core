// 퀀트라엑스 구독 결제 (2026-11-09) — 토스페이먼츠 자동결제(카드 등록 → 매달 자동 결제)
// 실제 결제·금액 결정은 전부 서버(Firebase Cloud Functions, quantrea-x-prod)에서 한다.
// 이 파일은 화면만 그린다. 가격 표시는 안내용이고 실제 금액은 서버 표(functions/plans.js)가 정한다.

// ⚠ 지금은 토스 공개 테스트 키(실제 돈 안 나감). 계약 후 라이브 키(live_ck_...)로 교체.
const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';
const FUNCTIONS_REGION = 'asia-northeast3';

const QX_PLANS = {
  builder: { name: '전략빌더', amount: 0 },
  signal: { name: '신호 알림', amount: 120000 },
  auto: { name: '자동매매', amount: 290000 },
  full: { name: '퀀트라 전체', amount: 480000 },
};
// 결제 주기 (2026-11-11): 연간 = 월 × 10 ('2개월 무료') — 서버 functions/plans.js와 같은 규칙
const QX_CYCLES = {
  month: { label: '월간', unit: '월', mult: 1 },
  year: { label: '연간', unit: '년', mult: 10 },
};

const STATUS_LABEL = { active: '이용 중', past_due: '결제 실패(재시도 중)', canceled: '해지됨' };

function won(n) {
  return '₩' + Number(n || 0).toLocaleString('ko-KR');
}

function ymd(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('ko-KR');
}

function callFn(name, data) {
  return firebase.app().functions(FUNCTIONS_REGION).httpsCallable(name)(data || {}).then((r) => r.data);
}

function fnErrorText(err) {
  return (err && err.message) || '알 수 없는 오류가 발생했습니다.';
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function waitForUser() {
  return new Promise((resolve) => {
    const off = firebase.auth().onAuthStateChanged((u) => {
      off();
      resolve(u);
    });
  });
}

// ---------- 구독 페이지 (subscribe.html) ----------

async function initSubscribePage() {
  const box = document.getElementById('subscribeBox');
  if (!box) return;
  const params = new URLSearchParams(location.search);

  const user = await waitForUser();
  if (!user) {
    location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    return;
  }

  // 토스 카드 등록창에서 돌아온 경우 → 서버에서 빌링키 발급 + 첫 결제
  if (params.get('authKey') && params.get('customerKey')) {
    box.innerHTML = '<p>결제를 처리하는 중입니다... 창을 닫지 마세요.</p>';
    try {
      const r = await callFn('confirmBilling', { authKey: params.get('authKey'), customerKey: params.get('customerKey') });
      history.replaceState(null, '', 'subscribe.html');
      if (r.result === 'card_updated') {
        const next = r.nextTier && r.nextTier !== r.tier ? `<p>다음 결제일(${ymd(r.currentPeriodEnd)})부터 <strong>${QX_PLANS[r.nextTier].name}</strong> 등급으로 바뀝니다.</p>` : '';
        box.innerHTML = `<h3>카드가 변경되었습니다</h3>${next}<a class="btn btn-primary" href="account.html">마이페이지로</a>`;
      } else {
        const receipt = r.receiptUrl ? ` <a href="${escapeHtml(r.receiptUrl)}" target="_blank" rel="noopener">영수증 보기</a>` : '';
        box.innerHTML = `<h3>구독이 시작되었습니다 🎉</h3>
          <p><strong>${QX_PLANS[r.tier].name}</strong> · ${won(r.amount)} 결제 완료.${receipt}</p>
          <p>다음 결제일: ${ymd(r.currentPeriodEnd)} (매달 같은 날 자동 결제)</p>
          <p style="color:var(--muted)">프로그램에서 같은 계정으로 로그인하면 바로 적용됩니다.</p>
          <a class="btn btn-primary" href="account.html">마이페이지로</a>`;
      }
    } catch (err) {
      box.innerHTML = `<h3>결제를 완료하지 못했습니다</h3><p>${escapeHtml(fnErrorText(err))}</p>
        <a class="btn" href="pricing.html">요금제로 돌아가기</a>`;
    }
    return;
  }

  // 카드 등록창에서 취소·실패하고 돌아온 경우
  if (params.get('fail')) {
    box.innerHTML = `<h3>카드 등록이 취소되었습니다</h3><p>${escapeHtml(params.get('message') || '')}</p>
      <a class="btn" href="pricing.html">요금제로 돌아가기</a>`;
    return;
  }

  const tier = params.get('plan');
  const plan = QX_PLANS[tier];
  if (!plan || tier === 'builder') {
    location.href = 'pricing.html';
    return;
  }
  let cycle = params.get('cycle') === 'year' ? 'year' : 'month';

  box.innerHTML = `
    <h3>${plan.name}</h3>
    <div class="cycle-toggle" role="radiogroup" aria-label="결제 주기" style="display:flex;gap:8px;margin:8px 0 12px">
      <button type="button" class="btn" data-cycle="month">월간</button>
      <button type="button" class="btn" data-cycle="year">연간 <small style="color:var(--accent,#e2ad30)">2개월 무료</small></button>
    </div>
    <div class="price" id="priceLine"></div>
    <ul class="billing-notice">
      <li id="cycleNotice"></li>
      <li>언제든 마이페이지에서 해지할 수 있고, 해지해도 이미 결제한 기간은 끝까지 이용할 수 있습니다.</li>
      <li>이미 구독 중이면 카드만 바뀌고, 다른 등급을 고르면 다음 결제일부터 바뀝니다(이번 달 추가 결제 없음).</li>
      <li>결제 계정: ${escapeHtml(user.email || '')}</li>
    </ul>
    <label class="billing-agree"><input type="checkbox" id="billingAgree" />
      위 내용과 정기결제에 동의합니다.</label>
    <button class="btn btn-primary btn-block" id="billingStart">카드 등록하고 결제하기</button>
    <p id="billingMsg" style="color:var(--danger);font-size:13px"></p>`;

  const renderCycle = () => {
    const c = QX_CYCLES[cycle];
    document.getElementById('priceLine').innerHTML =
      `${won(plan.amount * c.mult)} <span class="unit">/ ${c.unit}</span>` +
      (cycle === 'year' ? ` <span class="unit">(월 ${won(Math.round(plan.amount * 10 / 12))} 꼴)</span>` : '');
    document.getElementById('cycleNotice').innerHTML = cycle === 'year'
      ? '카드를 한 번 등록하면 <strong>오늘 1년치를 결제</strong>하고 <strong>1년 뒤 같은 날 자동 결제</strong>됩니다.'
      : '카드를 한 번 등록하면 <strong>오늘 첫 결제</strong> 후 <strong>매달 같은 날 자동 결제</strong>됩니다.';
    box.querySelectorAll('[data-cycle]').forEach((b) => {
      b.classList.toggle('btn-primary', b.dataset.cycle === cycle);
      b.setAttribute('aria-checked', b.dataset.cycle === cycle ? 'true' : 'false');
    });
  };
  box.querySelectorAll('[data-cycle]').forEach((b) => {
    b.onclick = () => { cycle = b.dataset.cycle; renderCycle(); };
  });
  renderCycle();

  document.getElementById('billingStart').onclick = async () => {
    const msg = document.getElementById('billingMsg');
    if (!document.getElementById('billingAgree').checked) {
      msg.textContent = '정기결제 동의에 체크해 주세요.';
      return;
    }
    msg.textContent = '';
    try {
      const prep = await callFn('prepareBilling', { tier, cycle });
      const toss = TossPayments(TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: prep.customerKey });
      const base = location.origin + location.pathname;
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: base,
        failUrl: base + '?fail=1',
        customerEmail: user.email || undefined,
        customerName: user.displayName || undefined,
      });
    } catch (err) {
      msg.textContent = fnErrorText(err);
    }
  };
}

// ---------- 마이페이지 구독 카드 (account.html) ----------

async function initBillingCard() {
  const card = document.getElementById('billingCard');
  if (!card) return;
  const user = await waitForUser();
  if (!user) return;

  let s = null;
  try {
    const doc = await firebase.firestore().collection('user_billing_status').doc(user.uid).get();
    if (doc.exists) s = doc.data();
  } catch (err) {
    console.log('구독 상태 불러오기 실패:', err);
  }

  if (!s || !s.status || s.status === 'canceled') {
    card.innerHTML = `<div class="info-row"><strong>등급</strong>전략빌더(무료)</div>
      <a class="btn btn-primary" style="margin-top:16px" href="pricing.html">요금제 보기</a>`;
    return;
  }

  const plan = QX_PLANS[s.tier] || { name: s.tier };
  const rows = [
    `<div class="info-row"><strong>등급</strong>${plan.name} · ${s.cycle === 'year' ? `${won((plan.amount || 0) * 10)} / 년` : `${won(plan.amount)} / 월`}</div>`,
    `<div class="info-row"><strong>상태</strong>${STATUS_LABEL[s.status] || s.status}${s.cancelAtPeriodEnd ? ' · 해지 예약됨' : ''}</div>`,
    `<div class="info-row"><strong>${s.cancelAtPeriodEnd ? '이용 종료일' : '다음 결제일'}</strong>${ymd(s.currentPeriodEnd)}</div>`,
  ];
  if (s.pendingTier && QX_PLANS[s.pendingTier]) rows.push(`<div class="info-row"><strong>다음 등급</strong>${QX_PLANS[s.pendingTier].name} (다음 결제일부터)</div>`);
  if (s.card && s.card.number) rows.push(`<div class="info-row"><strong>결제 카드</strong>${escapeHtml(s.card.number)}</div>`);
  if (s.lastPayment && s.lastPayment.receiptUrl) rows.push(`<div class="info-row"><strong>최근 결제</strong><a href="${escapeHtml(s.lastPayment.receiptUrl)}" target="_blank" rel="noopener">영수증 보기</a></div>`);
  if (s.status === 'past_due') rows.push(`<p style="color:var(--danger)">자동 결제에 실패했습니다(${escapeHtml(s.lastError || '')}). 카드를 바꾸면 바로 다시 결제됩니다.</p>`);

  const buttons = [
    `<a class="btn" href="pricing.html">등급 바꾸기</a>`,
    `<a class="btn" href="subscribe.html?plan=${encodeURIComponent(s.pendingTier || s.tier)}">카드 변경</a>`,
    s.cancelAtPeriodEnd
      ? `<button class="btn btn-primary" id="billingResume">해지 취소</button>`
      : `<button class="btn" id="billingCancel">구독 해지</button>`,
  ];
  card.innerHTML = rows.join('') + `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">${buttons.join('')}</div>`;

  const cancel = document.getElementById('billingCancel');
  if (cancel) cancel.onclick = async () => {
    if (!confirm(`구독을 해지할까요? ${ymd(s.currentPeriodEnd)}까지는 계속 이용할 수 있고, 그 뒤로 결제되지 않습니다.`)) return;
    try { await callFn('cancelSubscription'); location.reload(); } catch (err) { alert(fnErrorText(err)); }
  };
  const resume = document.getElementById('billingResume');
  if (resume) resume.onclick = async () => {
    try { await callFn('resumeSubscription'); location.reload(); } catch (err) { alert(fnErrorText(err)); }
  };
}

// ---------- 요금제 페이지 버튼: 이미 구독 중이면 등급 변경으로 ----------

async function initPricingButtons() {
  const btns = document.querySelectorAll('[data-plan]');
  if (!btns.length) return;
  const user = await waitForUser();
  if (!user) return;
  let s = null;
  try {
    const doc = await firebase.firestore().collection('user_billing_status').doc(user.uid).get();
    if (doc.exists) s = doc.data();
  } catch (_) {}
  if (!s || s.status !== 'active') return;

  btns.forEach((b) => {
    const tier = b.dataset.plan;
    if (tier === s.tier && !s.pendingTier) {
      b.textContent = '이용 중';
      b.classList.add('disabled');
      b.removeAttribute('href');
      return;
    }
    b.textContent = '이 등급으로 바꾸기';
    b.onclick = async (e) => {
      e.preventDefault();
      if (!confirm(`${QX_PLANS[tier].name} 등급으로 바꿀까요? 다음 결제일(${ymd(s.currentPeriodEnd)})부터 적용되고 이번 달 추가 결제는 없습니다.`)) return;
      try { await callFn('changePlan', { tier }); location.href = 'account.html'; } catch (err) { alert(fnErrorText(err)); }
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase === 'undefined') return;
  initSubscribePage();
  initBillingCard();
  initPricingButtons();
});
