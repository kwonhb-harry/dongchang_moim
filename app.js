/**
 * 동창모임 심플 모바일 앱 - 핵심 로직
 * - 회비 항목 제외, 모임 공지(제목, 날짜, 시간, 장소, 안내글) 변경 및 영구 재사용 가능
 * - 주최자 비밀번호(기본: 1234) 보호 기능으로 친구들의 실수 방지
 * - 참석 여부 결정 및 불참 시 사유 입력
 * - 최종 참석 인원 집계 및 엑셀(CSV) 다운로드
 * - 원클릭 카카오톡 단톡방 공유 연동
 */

const STORAGE_KEY_NOTICE = 'SIMPLE_MOIM_NOTICE_V4';
const STORAGE_KEY_RSVP = 'SIMPLE_MOIM_RSVP_V4';
const STORAGE_KEY_PIN = 'SIMPLE_MOIM_PIN_V4';

// 기본 공지 데이터 (회비 항목 제외)
let eventData = {
  title: '2026 동창 정기 모임',
  date: '2026-04-25',
  time: '18:00',
  location: '맛있는 고기마을 강남본점',
  address: '서울 강남구 테헤란로 123 (강남역 1번 출구 도보 3분)',
  notice: '친구들아 반갑다! 식당 인원 예약을 위해 꼭 참석 여부를 투표해 줘 😊',
  organizer: '총무'
};

// 기본 관리자 비밀번호 (초기값: 1234)
let adminPin = '1234';

// 기본 샘플 투표 명단
let rsvpList = [
  { name: '김민수 (회장)', status: 'attend', reason: '', time: '방금 전' },
  { name: '이영희', status: 'attend', reason: '', time: '1시간 전' },
  { name: '박지훈', status: 'attend', reason: '', time: '3시간 전' },
  { name: '최수진', status: 'absent', reason: '지방 출장 일정으로 불참', time: '5시간 전' },
  { name: '정현우', status: 'absent', reason: '가족 행사 참석', time: '어제' }
];

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderAll();
  initKakao();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

function initKakao() {
  if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    try {
      Kakao.init('9faeb3693f18b31a5eb23b090e9d6573');
    } catch (e) { }
  }
}

function loadData() {
  const savedNotice = localStorage.getItem(STORAGE_KEY_NOTICE);
  if (savedNotice) {
    try { eventData = { ...eventData, ...JSON.parse(savedNotice) }; } catch (e) { }
  }

  const savedRsvp = localStorage.getItem(STORAGE_KEY_RSVP);
  if (savedRsvp) {
    try { rsvpList = JSON.parse(savedRsvp); } catch (e) { }
  }

  const savedPin = localStorage.getItem(STORAGE_KEY_PIN);
  if (savedPin) {
    adminPin = savedPin;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY_NOTICE, JSON.stringify(eventData));
  localStorage.setItem(STORAGE_KEY_RSVP, JSON.stringify(rsvpList));
  localStorage.setItem(STORAGE_KEY_PIN, adminPin);
}

/**
 * 화면 렌더링
 */
function renderAll() {
  document.getElementById('eventTitle').textContent = eventData.title;
  document.getElementById('eventLocationText').textContent = eventData.location;
  document.getElementById('eventAddressText').textContent = eventData.address;
  document.getElementById('eventNoticeText').textContent = eventData.notice;

  // 카카오맵 링크
  const mapBtn = document.getElementById('btnMapLink');
  mapBtn.href = `https://map.kakao.com/?q=${encodeURIComponent(eventData.location + ' ' + eventData.address)}`;

  // 날짜/시간 포맷
  const [year, month, day] = eventData.date.split('-');
  const [hour, minute] = eventData.time.split(':');
  const dObj = new Date(`${eventData.date}T${eventData.time}`);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = isNaN(dObj.getDay()) ? '' : days[dObj.getDay()];
  const hNum = parseInt(hour, 10);
  const ampm = hNum >= 12 ? '오후' : '오전';
  const displayH = hNum > 12 ? hNum - 12 : (hNum === 0 ? 12 : hNum);

  document.getElementById('eventDateText').textContent =
    `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${dayName}) ${ampm} ${displayH}:${minute}`;

  // D-Day 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(eventData.date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  const badge = document.getElementById('dDayBadge');
  if (diffDays > 0) {
    badge.textContent = `D-${diffDays}일 남음`;
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-tossBlue';
  } else if (diffDays === 0) {
    badge.textContent = `🔥 오늘 모임!`;
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-400 text-slate-900';
  } else {
    badge.textContent = `모임 종료`;
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600';
  }

  // 참석/불참 집계
  const attends = rsvpList.filter(item => item.status === 'attend');
  const absents = rsvpList.filter(item => item.status === 'absent');

  document.getElementById('countAttend').textContent = attends.length;
  document.getElementById('countAbsent').textContent = absents.length;
  document.getElementById('countAttendList').textContent = attends.length;
  document.getElementById('countAbsentList').textContent = absents.length;

  // 참석자 명단 태그
  const attendListEl = document.getElementById('attendeesList');
  attendListEl.innerHTML = '';
  if (attends.length === 0) {
    attendListEl.innerHTML = '<span class="text-xs text-slate-400 py-1">아직 참석자가 없습니다.</span>';
  } else {
    attends.forEach(m => {
      const tag = document.createElement('span');
      tag.className = 'px-2.5 py-1 bg-white text-slate-800 text-xs font-bold rounded-lg border border-slate-200/80 shadow-xs flex items-center space-x-1';
      tag.innerHTML = `
        <span>🟢 ${escapeHtml(m.name)}</span>
        <button onclick="deleteVote('${escapeHtml(m.name)}')" class="text-slate-300 hover:text-rose-500 ml-1 text-[10px]" title="삭제">✕</button>
      `;
      attendListEl.appendChild(tag);
    });
  }

  // 불참자 및 사유 리스트
  const absentListEl = document.getElementById('absenteesList');
  absentListEl.innerHTML = '';
  if (absents.length === 0) {
    absentListEl.innerHTML = '<span class="text-xs text-slate-400">불참자가 없습니다.</span>';
  } else {
    absents.forEach(m => {
      const item = document.createElement('div');
      item.className = 'text-xs p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between';
      item.innerHTML = `
        <div>
          <span class="font-bold text-slate-800">🔴 ${escapeHtml(m.name)}</span>
          ${m.reason ? `<span class="text-slate-500 ml-2">- ${escapeHtml(m.reason)}</span>` : '<span class="text-slate-400 ml-2">(사유 없음)</span>'}
        </div>
        <button onclick="deleteVote('${escapeHtml(m.name)}')" class="text-slate-300 hover:text-rose-500 text-[10px] p-0.5" title="삭제">✕</button>
      `;
      absentListEl.appendChild(item);
    });
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * 불참 선택 시 사유 입력창 토글
 */
function toggleReasonBox() {
  const choice = document.querySelector('input[name="rsvpChoice"]:checked').value;
  const reasonBox = document.getElementById('absentReasonBox');
  if (choice === 'absent') {
    reasonBox.classList.remove('hidden');
    document.getElementById('absentReason').focus();
  } else {
    reasonBox.classList.add('hidden');
  }
}

/**
 * 투표 제출
 */
function handleVote(e) {
  e.preventDefault();

  const nameInput = document.getElementById('voterName');
  const name = nameInput.value.trim();
  if (!name) {
    showToast('이름을 입력해주세요.');
    return;
  }

  const choice = document.querySelector('input[name="rsvpChoice"]:checked').value;
  const reasonInput = document.getElementById('absentReason');
  const reason = choice === 'absent' ? reasonInput.value.trim() : '';

  const existingIdx = rsvpList.findIndex(m => m.name.toLowerCase() === name.toLowerCase());
  const entry = {
    name,
    status: choice,
    reason,
    time: '방금 전'
  };

  if (existingIdx >= 0) {
    rsvpList[existingIdx] = entry;
    showToast(`'${name}' 님의 참석 여부가 수정되었습니다.`);
  } else {
    rsvpList.push(entry);
    showToast(`'${name}' 님, 투표가 완료되었습니다! 🎉`);
  }

  saveData();
  renderAll();

  nameInput.value = '';
  reasonInput.value = '';
  document.querySelector('input[name="rsvpChoice"][value="attend"]').checked = true;
  toggleReasonBox();
}

/**
 * 특정 투표 삭제
 */
function deleteVote(name) {
  if (!confirm(`'${name}' 님의 투표 항목을 삭제하시겠습니까?`)) return;
  rsvpList = rsvpList.filter(m => m.name !== name);
  saveData();
  renderAll();
  showToast('삭제되었습니다.');
}

/**
 * 주최자 비밀번호 확인 요청
 */
function requestAdminAccess() {
  const modal = document.getElementById('adminPinModal');
  document.getElementById('adminPinInput').value = '';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => document.getElementById('adminPinInput').focus(), 100);
}

function closeAdminPinModal() {
  const modal = document.getElementById('adminPinModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function verifyAdminPin() {
  const inputPin = document.getElementById('adminPinInput').value.trim();
  if (inputPin === adminPin) {
    closeAdminPinModal();
    openEditModal();
  } else {
    showToast('비밀번호가 일치하지 않습니다.');
    document.getElementById('adminPinInput').value = '';
    document.getElementById('adminPinInput').focus();
  }
}

/**
 * 주최자 공지 수정 모달 열기/닫기
 */
function openEditModal() {
  document.getElementById('editTitle').value = eventData.title;
  document.getElementById('editDate').value = eventData.date;
  document.getElementById('editTime').value = eventData.time;
  document.getElementById('editLocation').value = eventData.location;
  document.getElementById('editAddress').value = eventData.address;
  document.getElementById('editNotice').value = eventData.notice;
  document.getElementById('editPin').value = '';

  const modal = document.getElementById('editModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/**
 * 주최자 공지 수정 저장
 */
function saveNotice(e) {
  e.preventDefault();

  eventData.title = document.getElementById('editTitle').value.trim();
  eventData.date = document.getElementById('editDate').value;
  eventData.time = document.getElementById('editTime').value;
  eventData.location = document.getElementById('editLocation').value.trim();
  eventData.address = document.getElementById('editAddress').value.trim();
  eventData.notice = document.getElementById('editNotice').value.trim();

  const newPin = document.getElementById('editPin').value.trim();
  if (newPin && newPin.length >= 4) {
    adminPin = newPin;
    showToast('공지와 주최자 비밀번호가 함께 변경되었습니다.');
  } else {
    showToast('모임 공지가 변경되었습니다! 다음 모임에도 계속 사용하실 수 있습니다.');
  }

  saveData();
  renderAll();
  closeEditModal();
}

/**
 * 새 모임 시작 (이전 참석자 명단 비우기)
 */
function resetAttendeesForNextMeeting() {
  if (!confirm('이전 모임의 참석자 투표 명단을 모두 비우고 새로운 모임을 시작하시겠습니까?\n(공지 내용은 그대로 유지됩니다.)')) {
    return;
  }

  rsvpList = [];
  saveData();
  renderAll();
  closeEditModal();
  showToast('이전 참석자 명단이 비워졌습니다. 새로운 모임 투표를 시작하세요!');
}

/**
 * 원클릭 카카오톡 단톡방 공유
 */
function shareToKakao() {
  const attendCount = rsvpList.filter(item => item.status === 'attend').length;
  const currentUrl = window.location.href;

  if (typeof Kakao !== 'undefined' && Kakao.isInitialized()) {
    try {
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `🎓 ${eventData.title}`,
          description: `📅 일시: ${document.getElementById('eventDateText').textContent}\n📍 장소: ${eventData.location}\n👥 현재 참석: ${attendCount}명 확정!\n\n단톡방 친구들은 아래 버튼을 눌러 참석 여부를 투표해 줘!`,
          imageUrl: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80',
          link: { mobileWebUrl: currentUrl, webUrl: currentUrl }
        },
        buttons: [
          {
            title: '🟢 참석 여부 투표하기',
            link: { mobileWebUrl: currentUrl, webUrl: currentUrl }
          }
        ]
      });
      return;
    } catch (e) {
      console.warn('카카오 SDK 공유 에러:', e);
    }
  }

  const text = `📢 [${eventData.title}]\n일시: ${document.getElementById('eventDateText').textContent}\n장소: ${eventData.location}\n현재 참석: ${attendCount}명\n👉 참석 투표하기:\n${currentUrl}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('초대장 문구가 복사되었습니다! 카톡에 붙여넣기 하세요.');
  }).catch(() => {
    showToast('복사 완료');
  });
}

/**
 * 엑셀(CSV) 다운로드
 */
function exportToCsv() {
  if (rsvpList.length === 0) {
    showToast('내보낼 참석자 명단이 없습니다.');
    return;
  }

  let csv = '\uFEFF이름,참석여부,불참사유\n';
  rsvpList.forEach(m => {
    const statusKo = m.status === 'attend' ? '참석' : '불참';
    const safeReason = (m.reason || '').replace(/"/g, '""');
    csv += `"${m.name}","${statusKo}","${safeReason}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${eventData.title}_최종참석명단.csv`;
  a.click();
  showToast('엑셀(CSV) 파일이 다운로드되었습니다.');
}

/**
 * 토스트 알림
 */
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('opacity-0');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    t.classList.add('opacity-0');
  }, 2200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}
