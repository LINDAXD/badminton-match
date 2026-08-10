// app.js — Birdie 공통 React 컴포넌트 & 훅
// 이 파일은 <script type="text/babel" src="./app.js"></script> 로 각 페이지에서 공유됩니다.
const { useState, useEffect } = React;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function todayStr() {
  // 주의: toISOString()은 UTC 기준이라 한국 시간 자정~오전 9시 사이엔 날짜가 하루 밀려서 나오는 버그가 있었어요.
  // 그래서 로컬(내 폰) 시간 기준으로 직접 조립해요.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayMD() {
  const d = new Date();
  return String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
}

function fmtBirthday(b) {
  if (!b || b.length !== 4) return b || "";
  return `${b.slice(0, 2)}월 ${b.slice(2, 4)}일`;
}

// ---------- 실력점수(ELO식) 시스템 ----------
// 승률이랑은 별개로 관리되는 "매칭용 실력 지표"예요. 모든 신규 회원은 1,000점에서 시작하고,
// 이기면 오르고 지면 내려가는데, 비슷한 상대한테 이기면 조금, 나보다 센 상대한테 이기면 더 많이 올라요.
window.DEFAULT_SKILL_SCORE = 1000;

function getSkillScore(member) {
  return (member && typeof member.skillScore === "number") ? member.skillScore : window.DEFAULT_SKILL_SCORE;
}

// 팀 평균 점수끼리 비교해서, 이긴 쪽/진 쪽 점수를 얼마나 올리고 내릴지 계산해요 (K=20 기준: 비슷한 상대 이기면 약 +10점).
function computeEloDelta(teamARating, teamBRating, aWon, K) {
  const k = K || 20;
  const expectedA = 1 / (1 + Math.pow(10, (teamBRating - teamARating) / 400));
  const actualA = aWon ? 1 : 0;
  const deltaA = Math.round(k * (actualA - expectedA));
  return { deltaA, deltaB: -deltaA };
}

// 경기 수에 따라 "평가중 / 임시급수 / 정식급수" 단계를 나눠요 — 처음 몇 경기만으로 급수가 요동치지 않게요.
function evaluationStage(gamesPlayed) {
  if (gamesPlayed < 5) return "provisional0"; // 🆕 평가중
  if (gamesPlayed < 10) return "provisional1"; // 🟡 임시급수
  return "rated"; // 🟢 정식급수
}
window.EVAL_STAGE_LABEL = { provisional0: "🆕 평가중", provisional1: "🟡 임시급수", rated: "🟢 정식급수" };

// 기본 급수 기준 (나중에 관리자가 조정할 수 있게 별도 설정으로 뺄 수 있어요. 지금은 고정값이에요.)
window.TIER_THRESHOLDS = { A: 1100, B: 1000, C: 900 }; // A: 1100+, B: 1000~1099, C: 900~999, D: 899 이하

function tierForScore(score, gamesPlayed) {
  if (evaluationStage(gamesPlayed) === "provisional0") return "평가중";
  if (score >= window.TIER_THRESHOLDS.A) return "A";
  if (score >= window.TIER_THRESHOLDS.B) return "B";
  if (score >= window.TIER_THRESHOLDS.C) return "C";
  return "D";
}

function tierColor(tier) {
  const map = {
    "평가중": { bg: "#F4F4F2", fg: "#8A8A85" },
    A: { bg: "#FDECEC", fg: "#C0392B" },
    B: { bg: "#E8F5E9", fg: "#2E7D32" },
    C: { bg: "#E3F2FD", fg: "#1565C0" },
    D: { bg: "#F4F4F2", fg: "#8A8A85" },
  };
  return map[tier] || map["평가중"];
}

// 출생연도로 만 나이를 계산해요 (관리자만 볼 수 있는 정보예요)
function computeAge(birthYear, birthday) {
  if (!birthYear) return null;
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  if (birthday && birthday.length === 4) {
    const mm = parseInt(birthday.slice(0, 2), 10) - 1;
    const dd = parseInt(birthday.slice(2, 4), 10);
    const hadBirthdayThisYear = now.getMonth() > mm || (now.getMonth() === mm && now.getDate() >= dd);
    if (!hadBirthdayThisYear) age -= 1;
  }
  return age;
}

// ---------- 앱 내장 팝업 (브라우저 기본 prompt/confirm/alert 대체) ----------
// 브라우저 기본 팝업은 위에 사이트 주소가 무조건 뜨는데(보안상 못 없앰), 이 컴포넌트는 그냥 화면 안의
// 일반 UI라서 주소가 전혀 안 보여요. 각 페이지의 App()에서 <AppModalHost /> 한 번만 렌더링하면 돼요.
let _appModalSetter = null;

function AppModalHost() {
  const [modal, setModal] = useState(null);
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    _appModalSetter = (m) => {
      setModal(m);
      setInputVal((m && m.defaultValue) || "");
    };
    return () => { _appModalSetter = null; };
  }, []);

  if (!modal) return null;

  function close(result) {
    const resolve = modal.resolve;
    setModal(null);
    resolve(result);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center px-6" onClick={() => modal.type !== "alert" && close(modal.type === "confirm" ? false : null)}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-xs rise-in" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-stone-800 whitespace-pre-wrap mb-3">{modal.message}</p>
        {modal.type === "prompt" && (
          <input
            autoFocus
            type={modal.password ? "password" : "text"}
            inputMode={modal.password ? "numeric" : "text"}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && close(inputVal)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        )}
        <div className="flex gap-2">
          {modal.type !== "alert" && (
            <button
              onClick={() => close(modal.type === "confirm" ? false : null)}
              className="flex-1 rounded-lg py-2 text-sm font-semibold border border-stone-200 text-stone-500"
            >
              취소
            </button>
          )}
          <button
            onClick={() => close(modal.type === "confirm" ? true : modal.type === "prompt" ? inputVal : true)}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--bc-blue)" }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function appPrompt(message, defaultValue, opts) {
  return new Promise((resolve) => {
    if (_appModalSetter) _appModalSetter({ type: "prompt", message, defaultValue: defaultValue || "", password: !!(opts && opts.password), resolve });
    else resolve(window.prompt(message, defaultValue));
  });
}
function appConfirm(message) {
  return new Promise((resolve) => {
    if (_appModalSetter) _appModalSetter({ type: "confirm", message, resolve });
    else resolve(window.confirm(message));
  });
}
function appAlert(message) {
  return new Promise((resolve) => {
    if (_appModalSetter) _appModalSetter({ type: "alert", message, resolve: () => resolve() });
    else { window.alert(message); resolve(); }
  });
}

function fmtMoney(n) {
  const num = Number(n);
  if (isNaN(num)) return "";
  return num.toLocaleString("ko-KR") + "원";
}

// 후기의 사진들을 배열로 반환 (새 형식 photoUrls / 예전 형식 photoUrl 둘 다 지원)
function photosOf(r) {
  if (r.photoUrls && r.photoUrls.length) return r.photoUrls;
  if (r.photoUrl) return [r.photoUrl];
  return [];
}

// ---------- 배지 시스템 (확장 가능한 구조) ----------
// 새 배지를 추가하려면 이 배열에 항목만 추가하면 돼요. earn(stats, member)이 true를 반환하면 획득.
// stats: { totalCount, streak, lastDate, noShow, rate, weeksAttendedThisMonth, isFirstWeek }
window.BADGE_DEFS = [
  { key: "first", emoji: "🌱", label: "첫 참석", earn: (s) => s.totalCount >= 1 },
  { key: "streak5", emoji: "🔥", label: "5회 연속 참석", earn: (s) => s.streak >= 5 },
  { key: "everyWeek", emoji: "💯", label: "매주 참석", earn: (s) => s.weeksAttendedThisMonth >= 4 },
  { key: "mvp", emoji: "⭐", label: "MVP", earn: (s, m) => !!(m && m.manualBadges && m.manualBadges.mvp) || (s.mvpWins || 0) >= 1 },
  { key: "chat", emoji: "🏸", label: "소통왕", earn: (s, m) => !!(m && m.manualBadges && m.manualBadges.chat) },
  { key: "kind", emoji: "🤝", label: "친절왕", earn: (s, m) => !!(m && m.manualBadges && m.manualBadges.kind) || (s.kindVotes || 0) >= 5 || (s.kindWins || 0) >= 1 },
  { key: "mood", emoji: "😂", label: "분위기 메이커", earn: (s) => (s.moodWins || 0) >= 1 },
  { key: "birthdayWeek", emoji: "🎂", label: "생일 주간", earn: (s, m) => {
    if (!m || !m.birthday || m.birthday.length !== 4) return false;
    const now = new Date();
    const bm = parseInt(m.birthday.slice(0, 2), 10), bd = parseInt(m.birthday.slice(2, 4), 10);
    const bday = new Date(now.getFullYear(), bm - 1, bd);
    const diff = Math.abs((now - bday) / 86400000);
    return diff <= 3;
  } },
  { key: "king", emoji: "🏆", label: "출석왕", earn: (s) => !!s.isAttendanceKing },
];

// checkinlog(항목: {memberId, date})를 바탕으로 한 회원의 출석 통계를 계산해요.
// allSessionDates: 클럽 전체에서 실제로 모임이 있었던 날짜 목록(=checkinlog에 등장하는 모든 날짜, 중복 제거)
// "오늘 참석"인지 판단 — rsvp 플래그는 한번 켜지면 계속 남아있는 값이라(자동으로 안 꺼짐),
// checkinlog에 "오늘 날짜"로 실제 기록이 있는지까지 같이 확인해야 진짜 오늘 참석자만 걸러져요.
function isAttendingToday(memberId, rsvp, checkinlog) {
  if (!rsvp || rsvp[memberId] !== "in") return false;
  const today = todayStr();
  return (checkinlog || []).some((c) => c.memberId === memberId && c.date === today);
}

// 오늘 날짜로 등록된 일정(들)에 실제로 "✅참석"을 누른 사람만 모아요 (진짜 정확한 오늘 참석자 목록).
// 정원이 있으면 정원 안에 든 사람까지만 "참석"으로 쳐요 (대기자는 제외).
// 오늘 날짜와 정확히 일치하는 일정이 있으면 그 참석자를, 없으면(아직 모임 당일이 아니면)
// 홈 화면에 "다가오는 모임"으로 뜨는 제일 가까운 다음 일정의 참석자를 보여줘요.
// 이렇게 해야 화면 여기저기(홈/더보기/매칭)에서 보여주는 "참석 인원"이 서로 안 어긋나요.
function getEffectiveAttendanceEvents(scheduleItems) {
  const today = todayStr();
  const exact = (scheduleItems || []).filter((s) => s.date === today);
  if (exact.length > 0) return exact;
  const upcoming = [...(scheduleItems || [])]
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  return upcoming.length > 0 ? [upcoming[0]] : [];
}

// 주어진 일정(들)에 실제로 "✅참석"을 누른 사람만 모아요 (정원 있으면 정원 안에 든 사람까지만).
function todayScheduleAttendees(scheduleItems) {
  const seen = new Map();
  (scheduleItems || []).forEach((s) => {
    const rsvpList = s.rsvp || [];
    const inList = rsvpList.filter((r) => r.status === "in").sort((a, b) => a.at - b.at);
    const confirmed = s.capacity ? inList.slice(0, s.capacity) : inList;
    confirmed.forEach((r) => { if (!seen.has(r.id)) seen.set(r.id, { id: r.id, name: r.name }); });
  });
  return [...seen.values()];
}

// 일정(RSVP)으로 참석 잡힌 사람 + 관리자가 매칭 페이지 "참석자 관리"에서 직접 체크인시킨 사람(checkinlog에 오늘 날짜로 찍힌 사람)을 합쳐요.
// 체크인 경로가 두 개(일정 RSVP / 관리자 직접 체크인)라서, 한쪽만 보면 실제로 참석했는데도 "참석자 아님"으로 잘못 판단되는 경우가 있었어요.
function combinedTodayAttendees(scheduleItems, checkinlog, roster) {
  const map = new Map();
  todayScheduleAttendees(getEffectiveAttendanceEvents(scheduleItems)).forEach((a) => map.set(a.id, a));
  const today = todayStr();
  (checkinlog || []).forEach((c) => {
    if (c.date !== today || map.has(c.memberId)) return;
    const m = (roster || []).find((r) => r.id === c.memberId);
    if (m) map.set(m.id, { id: m.id, name: m.name });
  });
  return [...map.values()];
}

// 로그인 기준 "출석" 통계 — 총 출석일수, 연속 출석일수 (모임 "참석" 통계와는 완전히 별개예요)
function computeLoginAttendance(memberId, dailylogin) {
  const dates = [...new Set((dailylogin || []).filter((it) => it.memberId === memberId).map((it) => it.date))].sort();
  const totalDays = dates.length;
  let streak = 0;
  if (totalDays > 0) {
    let cursor = new Date(dates[dates.length - 1]);
    const dateSet = new Set(dates);
    while (true) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (!dateSet.has(key)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return { totalDays, streak };
}

function computeAttendanceStats(memberId, checkinlog, allSessionDates) {
  const myDates = new Set(checkinlog.filter((c) => c.memberId === memberId).map((c) => c.date));
  const totalCount = myDates.size;
  const sortedMine = [...myDates].sort();
  const lastDate = sortedMine.length ? sortedMine[sortedMine.length - 1] : null;

  // 연속 출석: 전체 모임 개최일(최신순)을 하나씩 확인하며, 이 회원이 그날 참석했는지를 체크.
  // 참석 안 한 날이 나오는 순간 멈춰요.
  const sessionsDesc = [...new Set(allSessionDates)].sort().reverse();
  let streak = 0;
  for (const d of sessionsDesc) {
    if (myDates.has(d)) streak++;
    else break;
  }

  const thisMonth = todayStr().slice(0, 7);
  const weeksAttendedThisMonth = new Set(
    sortedMine.filter((d) => d.slice(0, 7) === thisMonth).map((d) => {
      const dt = new Date(d);
      const firstDay = new Date(dt.getFullYear(), dt.getMonth(), 1);
      return Math.ceil((dt.getDate() + firstDay.getDay()) / 7);
    })
  ).size;

  const totalSessions = sessionsDesc.length;
  const noShowCount = 0; // 노쇼는 일정 RSVP 데이터가 있어야 계산 가능 — more.html에서 별도 계산
  const rate = totalSessions > 0 ? Math.round((totalCount / totalSessions) * 100) : 0;

  return { totalCount, streak, lastDate, weeksAttendedThisMonth, rate, totalSessions };
}

// 노쇼: 일정에 "✅참석"으로 RSVP하고(정원 안에 들었는데도) 실제로는 체크인 기록이 없는 경우
// 노쇼는 관리자가 직접 부여한 것만 세요 — 자동 감지는 오히려 헷갈리고 부정확할 수 있어서, 상황을 아는
// 관리자가 판단해서 회원 프로필 카드에서 부여하는 방식 하나로만 운영해요.
function computeNoShowCount(memberId, scheduleItems, checkinlog, noshows) {
  return (noshows || []).filter((n) => n.memberId === memberId).length;
}

function earnedBadges(member, stats) {
  return window.BADGE_DEFS.filter((b) => {
    try { return b.earn(stats, member); } catch (e) { return false; }
  });
}

function computeKindVotes(memberId, kindvotes) {
  return (kindvotes || []).filter((v) => v.votedForId === memberId).length;
}

// 이 회원이 지금까지 누구랑 몇 번이나 팀(파트너)이었는지 상위 N명
function topPartners(memberId, matchhistory, n) {
  const counts = {};
  (matchhistory || []).forEach((m) => {
    const inA = (m.teamA || []).some((p) => p.id === memberId);
    const inB = (m.teamB || []).some((p) => p.id === memberId);
    if (!inA && !inB) return;
    const teammates = inA ? (m.teamA || []) : (m.teamB || []);
    teammates.forEach((p) => {
      if (p.id === memberId) return;
      counts[p.id] = counts[p.id] || { name: p.name, count: 0 };
      counts[p.id].count++;
    });
  });
  return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, n || 3);
}

// ---------- 월간 투표 시스템 (친절왕 / MVP / 분위기메이커) ----------
// 결과는 그 자리에서 바로 공개하지 않고, 점수만 쌓아뒀다가 매월 자동으로 집계해서 보여줘요.
window.VOTE_CATEGORIES = [
  { key: "kind", emoji: "😊", label: "친절왕", question: "가장 배려를 많이 해준 회원은 누구인가요?" },
  { key: "mvp", emoji: "⭐", label: "MVP", question: "가장 인상적인 플레이를 보여준 회원은 누구인가요?" },
  { key: "mood", emoji: "😂", label: "분위기메이커", question: "분위기를 즐겁게 만든 회원은 누구인가요?" },
];
window.ALL_VOTE_CATEGORIES = [...window.VOTE_CATEGORIES];


// dailyvotes 문서 구조: { data: { [date]: { [category]: [{voterId, votedForId}] } } }
// 특정 날짜, 특정 카테고리의 득표 집계 → { memberId: count }
function tallyVotes(dailyvotes, date, category) {
  const votes = ((dailyvotes || {})[date] || {})[category] || [];
  const counts = {};
  votes.forEach((v) => { if (!v.votedForId) return; counts[v.votedForId] = (counts[v.votedForId] || 0) + 1; });
  return counts;
}

// 특정 날짜, 특정 카테고리의 1위(동点이면 먼저 표를 채운 사람) memberId — 표가 없으면 null
function dailyWinner(dailyvotes, date, category) {
  const counts = tallyVotes(dailyvotes, date, category);
  const ids = Object.keys(counts);
  if (ids.length === 0) return null;
  return ids.reduce((best, id) => (counts[id] > counts[best] ? id : best), ids[0]);
}

// 이 회원이 지금까지 해당 카테고리에서 "오늘의 1위"를 몇 번 했는지 (monthOnly=true면 이번 달만)
function cumulativeWins(dailyvotes, memberId, category, monthOnly) {
  const thisMonth = todayStr().slice(0, 7);
  let count = 0;
  Object.keys(dailyvotes || {}).forEach((date) => {
    if (monthOnly && date.slice(0, 7) !== thisMonth) return;
    if (dailyWinner(dailyvotes, date, category) === memberId) count++;
  });
  return count;
}

// 이번 달 카테고리별 1위 회원(=이달의 OOO) — { memberId, count } 또는 null
function monthlyLeader(dailyvotes, category, roster) {
  const thisMonth = todayStr().slice(0, 7);
  const counts = {};
  Object.keys(dailyvotes || {}).forEach((date) => {
    if (date.slice(0, 7) !== thisMonth) return;
    const w = dailyWinner(dailyvotes, date, category);
    if (w) counts[w] = (counts[w] || 0) + 1;
  });
  const ids = Object.keys(counts);
  if (ids.length === 0) return null;
  const topId = ids.reduce((best, id) => (counts[id] > counts[best] ? id : best), ids[0]);
  const member = (roster || []).find((m) => m.id === topId);
  return member ? { member, count: counts[topId] } : null;
}

const SOCIAL_TAGS = [
  { key: "meal", emoji: "🍚", label: "식사 가능" },
  { key: "coffee", emoji: "☕", label: "커피 가능" },
  { key: "pickup", emoji: "🚗", label: "픽업 가능" },
  { key: "racket", emoji: "🏸", label: "라켓 대여 가능" },
  { key: "beginnerCare", emoji: "🆕", label: "초보 케어 가능" },
  { key: "photo", emoji: "📸", label: "사진 촬영 가능" },
  { key: "sportsOnly", emoji: "🏸", label: "운동만 참여" },
  { key: "social", emoji: "😊", label: "운동 외 활동 가능" },
  { key: "weekendOnly", emoji: "📅", label: "주말만 가능" },
  { key: "weekdayOnly", emoji: "💼", label: "평일만 가능" },
  { key: "anyDay", emoji: "🗓️", label: "평일·주말 상관없음" },
];
window.SOCIAL_TAGS = SOCIAL_TAGS;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
window.WEEKDAYS = WEEKDAYS;

// ---------- 회원 프로필 카드 (클릭하면 열리는 모달) ----------
function MemberProfileModal({ member, checkinlog, allSessionDates, scheduleItems, kindvotes, matchhistory, dailyvotes, noshows, canEdit, isAdmin, isSelf, onSave, onClose, onGiveNoShow }) {
  const [edit, setEdit] = useState(false);
  const [bio, setBio] = useState(member.bio || "");
  const [career, setCareer] = useState(member.career || "");
  const [activeDay, setActiveDay] = useState(member.activeDay || "");
  const [social, setSocial] = useState(member.social || {});
  const [uploading, setUploading] = useState(false);

  const stats = computeAttendanceStats(member.id, checkinlog, allSessionDates);
  stats.kindVotes = computeKindVotes(member.id, kindvotes);
  window.ALL_VOTE_CATEGORIES.forEach((c) => {
    stats[c.key + "Wins"] = cumulativeWins(dailyvotes, member.id, c.key, false);
  });
  const badges = earnedBadges(member, stats);
  const noShowCount = computeNoShowCount(member.id, scheduleItems || [], checkinlog, noshows);
  const partners = topPartners(member.id, matchhistory || [], 3);

  function toggleManualBadge(key) {
    const manualBadges = { ...(member.manualBadges || {}), [key]: !(member.manualBadges || {})[key] };
    onSave({ manualBadges });
  }

  function toggleSocial(key) {
    setSocial((s) => ({ ...s, [key]: !s[key] }));
  }

  function save() {
    onSave({ bio, career, activeDay, social });
    setEdit(false);
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onSave({ photoUrl: url });
    } catch (err) {
      appAlert("사진 업로드에 실패했어요. (" + (err.message || "") + ")");
    }
    setUploading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[88vh] overflow-y-auto rise-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden shrink-0">
                {member.photoUrl ? (
                  <img src={member.photoUrl} className="w-full h-full object-cover" alt={member.name} />
                ) : (
                  <span className="text-2xl">🏸</span>
                )}
              </div>
              <div>
                <p className="text-lg font-bold text-stone-900">{member.name}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <GradeBadge grade={member.grade} />
                  {member.level && <MiniTag>{member.level}</MiniTag>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-stone-400 text-xl leading-none px-1">✕</button>
          </div>

          {canEdit && (
            <div className="mb-3">
              <label className="text-[11px] text-stone-400 underline underline-offset-2 cursor-pointer">
                📸 프로필 사진 {uploading ? "업로드 중..." : "바꾸기"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploading} />
              </label>
            </div>
          )}

          {edit ? (
            <div className="space-y-2 mb-4">
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="한 줄 소개" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              <input value={career} onChange={(e) => setCareer(e.target.value)} placeholder="배드민턴 경력 (예: 2년차)" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              <select value={activeDay} onChange={(e) => setActiveDay(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
                <option value="">주 활동 요일 선택</option>
                {WEEKDAYS.map((d) => <option key={d} value={d}>{d}요일</option>)}
              </select>
              <div>
                <p className="text-[11px] text-stone-400 mb-1">친목 태그</p>
                <div className="flex flex-wrap gap-1.5">
                  {SOCIAL_TAGS.map((t) => (
                    <button key={t.key} onClick={() => toggleSocial(t.key)}
                      className={`text-xs px-2.5 py-1.5 rounded-full border ${social[t.key] ? "text-white border-transparent" : "bg-white text-stone-500 border-stone-200"}`}
                      style={social[t.key] ? { backgroundColor: "var(--bc-blue)" } : {}}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={save} className="flex-1 rounded-lg py-2 text-sm font-semibold text-[var(--bc-navy)]" style={{ backgroundColor: "var(--bc-blue)" }}>저장</button>
                <button onClick={() => setEdit(false)} className="flex-1 rounded-lg py-2 text-sm font-semibold border border-stone-200 text-stone-500">취소</button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-sm text-stone-600 mb-2">{member.bio || (canEdit ? "한 줄 소개를 등록해보세요." : "한 줄 소개가 없어요.")}</p>
              {(member.social && Object.values(member.social).some(Boolean)) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SOCIAL_TAGS.filter((t) => member.social[t.key]).map((t) => (
                    <span key={t.key} className="text-[11px] bg-stone-50 border border-stone-200 rounded-full px-2 py-1">{t.emoji} {t.label}</span>
                  ))}
                </div>
              )}
              {canEdit && (
                <button onClick={() => setEdit(true)} className="text-[11px] text-stone-400 underline underline-offset-2">✏️ 프로필 수정</button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">가입일</p>
              <p className="text-sm font-semibold text-stone-800">{member.joinedAt ? fmtDate(member.joinedAt) : "-"}</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">생일</p>
              <p className="text-sm font-semibold text-stone-800">
                {!(isAdmin || isSelf) ? (
                  <span className="text-stone-300 font-normal text-xs">비공개 (당일에만 축하 알림이 떠요)</span>
                ) : member.birthday ? (
                  <>
                    {fmtBirthday(member.birthday)}
                    {isAdmin && member.birthYear && (
                      <span className="text-stone-400 font-normal"> · {computeAge(member.birthYear, member.birthday)}세</span>
                    )}
                  </>
                ) : "-"}
              </p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">경력</p>
              <p className="text-sm font-semibold text-stone-800">{member.career || "-"}</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">주 활동 요일</p>
              <p className="text-sm font-semibold text-stone-800">{member.activeDay ? `${member.activeDay}요일` : "-"}</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">📅 참석 횟수</p>
              <p className="text-sm font-semibold text-stone-800">{stats.totalCount}회</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">🔥 연속 출석</p>
              <p className="text-sm font-semibold text-stone-800">{stats.streak}회</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">마지막 참석일</p>
              <p className="text-sm font-semibold text-stone-800">{stats.lastDate ? fmtDate(stats.lastDate) : "-"}</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">참석률</p>
              <p className="text-sm font-semibold text-stone-800">{stats.rate}%</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">🚫 노쇼</p>
              <p className="text-sm font-semibold text-stone-800">{noShowCount}회</p>
            </div>
            <div className="bg-stone-50 rounded-xl p-3">
              <p className="text-[11px] text-stone-400">👍 또 치고싶어요</p>
              <p className="text-sm font-semibold text-stone-800">{stats.kindVotes}표</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[11px] text-stone-400 mb-1.5">🗳️ 누적 월간 수상 (매월 1일 집계)</p>
            <div className="flex flex-wrap gap-1.5">
              {window.ALL_VOTE_CATEGORIES.map((c) => (
                <span key={c.key} className="text-xs bg-stone-50 border border-stone-200 text-stone-600 rounded-full px-2.5 py-1">
                  {c.emoji} {c.label} {stats[c.key + "Wins"] || 0}회
                </span>
              ))}
            </div>
          </div>

          {partners.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] text-stone-400 mb-1.5">🤝 자주 함께한 사람</p>
              <div className="flex flex-wrap gap-1.5">
                {partners.map((p) => (
                  <span key={p.name} className="text-xs bg-stone-50 border border-stone-200 text-stone-600 rounded-full px-2.5 py-1">
                    {p.name} · {p.count}번
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <p className="text-[11px] text-stone-400 mb-1.5">🏅 획득 배지</p>
            {badges.length === 0 ? (
              <p className="text-xs text-stone-300">아직 획득한 배지가 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <span key={b.key} className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-1">
                    {b.emoji} {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="mb-4">
              <p className="text-[11px] text-stone-400 mb-1.5">🛠️ 관리자: 배지 수동 지급</p>
              <div className="flex flex-wrap gap-1.5">
                {window.BADGE_DEFS.filter((b) => ["mvp", "chat", "kind"].includes(b.key)).map((b) => {
                  const has = !!(member.manualBadges && member.manualBadges[b.key]);
                  return (
                    <button
                      key={b.key}
                      onClick={() => toggleManualBadge(b.key)}
                      className={`text-xs px-2.5 py-1.5 rounded-full border tap-scale ${has ? "text-white border-transparent" : "bg-white text-stone-500 border-stone-200"}`}
                      style={has ? { backgroundColor: "var(--bc-blue)" } : {}}
                    >
                      {b.emoji} {b.label} {has ? "· 지급됨" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isAdmin && onGiveNoShow && (
            <div>
              <p className="text-[11px] text-stone-400 mb-1.5">🚫 관리자: 노쇼 부여</p>
              <button
                onClick={() => onGiveNoShow(member)}
                className="text-xs px-2.5 py-1.5 rounded-full border border-red-200 text-red-500 bg-red-50 tap-scale"
              >
                🚫 노쇼 1회 추가 (연락 없이 불참)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${y}.${m}.${day}`;
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${String(m).padStart(2, "0")}`;
}

function gradeInfo(grade) {
  return (window.GRADES && window.GRADES.find((g) => g.key === grade)) || window.GRADES[2];
}

function isOfficerOf(roster, myId) {
  const me = roster.find((m) => m.id === myId);
  return !!(me && me.grade === "운영진");
}

// 지정한 시간(ms) 안에 안 끝나면 강제로 실패 처리 — 업로드가 무한정 멈춰있는 것을 방지
function withTimeout(promise, ms, label) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label || "요청"} 응답이 없어요 (시간 초과). 설정을 확인해주세요.`)), ms)
    ),
  ]);
}

// ---------- 사진 업로드 (Cloudinary, 카드 등록 없이 무료) ----------
async function uploadToCloudinary(file) {
  const { cloudName, uploadPreset } = window.CLOUDINARY || {};
  if (!cloudName || cloudName.includes("여기에") || !uploadPreset || uploadPreset.includes("여기에")) {
    throw new Error("Cloudinary 설정이 안 되어있어요 (firebase.js의 CLOUDINARY 값을 채워주세요)");
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  const res = await withTimeout(
    fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    }),
    20000,
    "사진 업로드"
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody.error && errBody.error.message) || `업로드 실패 (${res.status})`);
  }
  const data = await res.json();
  return data.secure_url;
}

// ---------- 관리자 잠금 훅 ----------
// isOfficer: 로그인한 회원의 등급이 "운영진"이면 비밀번호 없이도 자동으로 관리자 권한을 가짐
function useAdmin(isOfficer) {
  const [pinOn, setPinOn] = useState(() => localStorage.getItem("bm_admin") === "1");
  const adminOn = pinOn || !!isOfficer;
  async function tryUnlock(cb) {
    if (adminOn) { if (cb) cb(); return; }
    const pin = await appPrompt("관리자 비밀번호를 입력하세요", "", { password: true });
    if (pin === window.ADMIN_PIN) {
      localStorage.setItem("bm_admin", "1");
      setPinOn(true);
      if (cb) cb();
    } else if (pin !== null) {
      appAlert("비밀번호가 틀렸어요.");
    }
  }
  function lock() {
    localStorage.removeItem("bm_admin");
    setPinOn(false);
  }
  return { adminOn, tryUnlock, lock, isOfficer: !!isOfficer };
}

// ---------- 로그인(내 신원) 훅 ----------
function useIdentity() {
  const [myId, setMyId] = useState(() => localStorage.getItem("bm_myId") || null);
  const [myName, setMyName] = useState(() => localStorage.getItem("bm_myName") || null);
  function login(id, name) {
    localStorage.setItem("bm_myId", id);
    localStorage.setItem("bm_myName", name);
    setMyId(id);
    setMyName(name);
    // 🎯 출석(로그인) — 특정 모임 "참석"과는 완전히 별개예요. 로그인만 하면 하루에 딱 1번 자동으로 찍혀요.
    logDailyAttendance(id);
  }
  function logout() {
    localStorage.removeItem("bm_myId");
    localStorage.removeItem("bm_myName");
    setMyId(null);
    setMyName(null);
  }
  return { myId, myName, login, logout };
}

// 로그인 기준 "출석" 기록 — 하루에 한 번만 남아요 (같은 날 여러 번 로그인해도 중복 안 쌓여요).
function logDailyAttendance(memberId) {
  const today = todayStr();
  REFS.dailylogin.get().then((snap) => {
    const data = snap.data() || {};
    const items = data.items || [];
    const already = items.some((it) => it.memberId === memberId && it.date === today);
    if (!already) REFS.dailylogin.set({ items: [...items, { id: uid(), memberId, date: today }] }).catch(() => {});
  }).catch(() => {
    REFS.dailylogin.set({ items: [{ id: uid(), memberId, date: today }] }).catch(() => {});
  });
}

// ---------- 회원 명단 실시간 훅 ----------
function useRoster() {
  const [roster, setRoster] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = window.REFS.roster.onSnapshot((snap) => {
      const data = snap.data();
      setRoster(data && data.members ? data.members : []);
      setReady(true);
    }, () => setReady(true));
    return () => unsub();
  }, []);
  function persist(next) {
    setRoster(next);
    window.REFS.roster.set({ members: next }).catch(() => {});
  }
  return { roster, ready, setRoster, persist };
}

// ---------- 출석 이력 기록 (출석왕 계산용, 하루 1회만 기록) ----------
// 다들 거의 동시에 참석 체크를 하는 순간이라 충돌 위험이 커요 — 트랜잭션으로 안전하게 처리해요.
// 일정 RSVP(참석/미정/불참) — 홈, 더보기 어디서든 같은 방식으로 쓸 수 있게 공용 함수로 뺐어요.
// 트랜잭션으로 처리해요 — 다들 거의 동시에 참석 누르는 순간이라 충돌 위험이 제일 큰 곳이에요.
async function setRsvpFor(item, status, myId, myName) {
  if (!myId) {
    appAlert("참석 체크를 하려면 먼저 홈에서 이름으로 입장해주세요.");
    return;
  }
  let wasIn = false;
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(REFS.schedule);
      const data = snap.data() || {};
      const items = data.items || [];
      const target = items.find((s) => s.id === item.id);
      const list = (target && target.rsvp) || [];
      const existing = list.find((r) => r.id === myId);
      wasIn = existing ? existing.status === "in" : false;
      const at = existing ? existing.at : Date.now();
      const nextList = [...list.filter((r) => r.id !== myId), { id: myId, name: myName || "?", status, at }];
      const nextItems = items.map((s) => (s.id === item.id ? { ...s, rsvp: nextList } : s));
      tx.set(REFS.schedule, { items: nextItems });
    });
  } catch (e) {
    appAlert("참석 체크에 실패했어요. 다시 시도해주세요.");
    return;
  }

  // 오늘 일정에 ✅참석을 누르면 오늘 참석 체크(매칭 대상)도 자동으로 같이 돼요
  if (item.date === todayStr()) {
    if (status === "in" && !wasIn) {
      try {
        await db.runTransaction(async (tx) => {
          const checkinSnap = await tx.get(REFS.checkin);
          const nextRsvp = { ...((checkinSnap.data() || {}).data || {}), [myId]: "in" };
          tx.set(REFS.checkin, { data: nextRsvp });
          const logSnap = await tx.get(REFS.checkinlog);
          const items = (logSnap.data() || {}).items || [];
          const already = items.some((it) => it.memberId === myId && it.date === todayStr());
          if (!already) tx.set(REFS.checkinlog, { items: [...items, { id: uid(), memberId: myId, date: todayStr() }] });
        });
      } catch (e) {}
    } else if (status !== "in" && wasIn) {
      // 참석이었다가 취소(미정/불참)로 바꾸면 참석 체크도 같이 풀려요. 노쇼는 여기서 자동으로 안 매겨요 —
      // 관리자가 상황 보고 직접 판단해서 부여하는 게 더 정확해서요 (회원 프로필 카드에서 부여 가능).
      try {
        await db.runTransaction(async (tx) => {
          const checkinSnap = await tx.get(REFS.checkin);
          const nextRsvp = { ...((checkinSnap.data() || {}).data || {}), [myId]: "out" };
          tx.set(REFS.checkin, { data: nextRsvp });
        });
      } catch (e) {}
      appAlert("참석을 취소하셨어요.");
    }
  }
}

function logAttendance(memberId) {
  if (!memberId) return;
  const today = todayStr();
  db.runTransaction(async (tx) => {
    const snap = await tx.get(REFS.checkinlog);
    const data = snap.data() || {};
    const items = data.items || [];
    const already = items.some((it) => it.memberId === memberId && it.date === today);
    if (already) return;
    tx.set(REFS.checkinlog, { items: [...items, { id: uid(), memberId, date: today }] });
  }).catch(() => {});
}

// ---------- 경기 결과 기록 (내 정보 > 경기 기록용) ----------
// 여러 코트가 거의 동시에 경기를 끝내도 서로 기록이 안 사라지게, 트랜잭션으로 안전하게 추가해요.
function logMatchResult(record) {
  db.runTransaction(async (tx) => {
    const snap = await tx.get(REFS.matchhistory);
    const data = snap.data() || {};
    const items = data.items || [];
    tx.set(REFS.matchhistory, { items: [{ id: uid(), date: todayStr(), ...record }, ...items] });
  }).catch(() => {});
}

// ---------- 로그인 필요 화면 (비로그인 접근 제한) ----------
function RequireLogin({ myId, children }) {
  if (myId) return children;
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-8">
      <p className="text-4xl mb-3">🔒</p>
      <p className="text-sm font-semibold text-stone-700 mb-1">로그인이 필요해요</p>
      <p className="text-xs text-stone-400 mb-5">홈 화면에서 이름과 비밀번호로 입장한 뒤 이용할 수 있어요.</p>
      <a
        href="./index.html#login"
        className="text-white text-sm font-semibold px-6 py-2.5 rounded-full"
        style={{ backgroundColor: "var(--bc-blue)" }}
      >
        🏠 홈으로 가서 입장하기
      </a>
    </div>
  );
}

// ---------- 하단 고정 내비게이션 ----------
function BottomNav({ active }) {
  const items = [
    { key: "home", href: "./index.html", icon: "🏠", label: "홈" },
    { key: "match", href: "./match.html?tab=match", icon: "🔀", label: "매칭" },
    { key: "record", href: "./match.html?tab=record", icon: "🏸", label: "기록" },
    { key: "ranking", href: "./match.html?tab=ranking", icon: "🏆", label: "랭킹" },
    { key: "more", href: "./more.html", icon: "🙋", label: "마이" },
  ];
  return (
    <nav className="bc-bottomnav">
      {items.map((it) => (
        <a key={it.key} href={it.href} className={active === it.key ? "active" : ""}>
          <span className="icon-wrap"><span className="icon">{it.icon}</span></span>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

// ---------- 상단 헤더 (공용) ----------
function TopHeader({ title, subtitle }) {
  return (
    <header className="px-5 pt-6 pb-3 max-w-2xl mx-auto">
      <div className="min-w-0">
        <a href="./index.html" className="headfont text-xs tracking-wide" style={{ color: "var(--bc-blue)" }}>🏸 BIRDIE</a>
        {title && <h1 className="headfont text-[26px] text-stone-900 mt-1.5 leading-tight">{title}</h1>}
        {subtitle && <p className="text-sm text-stone-400 mt-1">{subtitle}</p>}
      </div>
    </header>
  );
}

// ---------- 등급 배지 ----------
function GradeBadge({ grade }) {
  const g = gradeInfo(grade);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${g.color}`}>
      {g.emoji && <span>{g.emoji}</span>} {g.key}
    </span>
  );
}

// 레벨/실력등급/게스트 등 부가 정보용 — 항상 같은 옅은 회색 스타일로 통일
function MiniTag({ children }) {
  return (
    <span className="inline-flex items-center text-[10px] text-stone-400 bg-stone-50 border border-stone-200 rounded-full px-2 py-0.5">
      {children}
    </span>
  );
}

// 참/늦참/결석 같은 상태를 색깔 있는 알약 배지로 — 초록(긍정) / 노랑(주의) / 빨강(부정) / 회색(중립)
function StatusPill({ tone, children }) {
  const tones = {
    green: { bg: "#E8F5E9", fg: "#2E7D32" },
    yellow: { bg: "#FFF8E1", fg: "#B98900" },
    red: { bg: "#FDECEC", fg: "#C0392B" },
    gray: { bg: "#F4F4F2", fg: "#8A8A85" },
  };
  const t = tones[tone] || tones.gray;
  return (
    <span
      className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

// 승률/참석률처럼 0~100 값을 막대로 보여줄 때 — 라벨 위, 막대 아래
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bc-progress-track">
      <div className="bc-progress-fill" style={{ width: `${pct}%`, backgroundColor: color || "var(--bc-blue)" }} />
    </div>
  );
}

// ---------- 로딩 스켈레톤 ----------
function Skeleton({ className }) {
  return <div className={`shimmer rounded-2xl ${className || "h-16 w-full"}`} />;
}

// ---------- 버디 캐릭터 이미지 슬롯 ----------
// 아직 실제 캐릭터 파일이 없어서 이모지로 대체해서 보여줘요. 나중에 /images/ 폴더에 정해진 이름으로
// 파일만 넣으면(예: buddy-hero.png), 코드 수정 없이 자동으로 캐릭터 이미지로 바뀌어요.
// 슬롯 이름 목록: buddy-hero(홈 인사말), buddy-profile(기본 프로필), buddy-notice(공지),
// buddy-vote(투표), buddy-match(매칭), buddy-schedule(일정), buddy-logo(로고/앱아이콘)
// 사이즈는 항상 style로 강제 지정해요 (Tailwind 클래스에만 의존하면 캐시/우선순위 문제로 원본 크기 그대로 나오는 경우가 있어서, 무조건 적용되는 인라인 스타일로 안전하게 고정해요)
function Mascot({ slot, fallback, className, imgClassName, style, size, objectFit }) {
  const [failed, setFailed] = useState(false);
  const sizeStyle = size ? { width: size, height: size, objectFit: objectFit || "contain", flexShrink: 0 } : {};
  if (failed) {
    if (fallback === null) return null; // 대체할 이모지가 마땅치 않은 자리는, 파일 없을 때 그냥 아무것도 안 보여줘요
    return <span className={className} style={style}>{fallback || "🏸"}</span>;
  }
  return (
    <img
      src={`./images/${slot}.png`}
      alt=""
      onError={() => setFailed(true)}
      className={imgClassName || className}
      style={{ ...sizeStyle, ...style }}
    />
  );
}

// 사진 없는 회원용 — 이름 기반으로 색깔이 항상 똑같이 나오는 동그란 이니셜 아바타예요.
const AVATAR_COLORS = ["#4CAF50", "#42A5F5", "#FFA726", "#EC407A", "#AB47BC", "#26A69A", "#7E57C2", "#EF5350"];
function avatarColorFor(name) {
  const str = String(name || "?");
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function Avatar({ name, photoUrl, size }) {
  const px = size || 36;
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: px, height: px, backgroundColor: avatarColorFor(name), fontSize: px * 0.42 }}
    >
      {(name || "?").trim().slice(0, 1)}
    </div>
  );
}
