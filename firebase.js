// firebase.js — Birdie 공통 Firebase 초기화
// 기존 프로젝트(badminton-42968)를 그대로 사용합니다. (데이터 유지)
const firebaseConfig = {
  apiKey: "AIzaSyDn5tgqFHAKNbiSBwxyrxyhKgFR9w1jf8E",
  authDomain: "badminton-42968.firebaseapp.com",
  projectId: "badminton-42968",
  storageBucket: "badminton-42968.firebasestorage.app",
  messagingSenderId: "1079190230967",
  appId: "1:1079190230967:web:82c8c22b7f84fa5ea23a32"
};

firebase.initializeApp(firebaseConfig);

window.db = firebase.firestore();

// ---- 🧪 테스트 모드 ----
// 주소 뒤에 ?test=1 을 붙여서 한 번 들어오면, 그때부터 완전히 별도의(비어있는) 테스트 전용 컬렉션을 써요.
// 실제 회원 데이터가 있는 "badminton" 컬렉션은 테스트 모드 동안 전혀 건드리지 않아요.
// ?test=0 을 붙여서 한 번 들어오면 다시 실제 데이터로 돌아와요. (브라우저에 저장되니, 다음부턴 그냥 링크만 눌러도 계속 테스트 모드예요)
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.has("test")) {
    if (params.get("test") === "0") localStorage.removeItem("birdie_test_mode");
    else localStorage.setItem("birdie_test_mode", "1");
  }
})();
window.BIRDIE_TEST_MODE = localStorage.getItem("birdie_test_mode") === "1";
const BC_COLLECTION = window.BIRDIE_TEST_MODE ? "badminton_test" : "badminton";

if (window.BIRDIE_TEST_MODE) {
  // 실수로 실제 데이터인 줄 알고 조작하는 일이 없도록, 화면 위에 눈에 띄는 배너를 띄워요.
  window.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.textContent = "🧪 테스트 모드 — 실제 데이터가 아니에요 (끄기: 주소 끝에 ?test=0)";
    bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#B7E600;color:#172B3A;text-align:center;font-size:12px;font-weight:800;padding:6px 8px;";
    document.body.prepend(bar);
    document.body.style.paddingTop = "28px";
  });
}

// 익명 로그인 — Firestore 보안 규칙에서 "로그인된 사용자만 읽기/쓰기 가능"하게 제한할 수 있도록 해줘요.
// 회원 이름/비밀번호 방식과는 별개로, 앱이 열리면 자동으로(팝업 없이) 조용히 한 번 로그인돼요.
// window.authReadyPromise: 각 페이지는 이 약속이 끝날 때까지 화면을 안 띄우고 기다려요.
// 이게 없으면, "회원 명단 불러오기"가 "익명 로그인 완료"보다 미세하게 먼저 실행돼서 명단이 텅 빈 채로
// 처리되는 경우가 있었어요(특히 시크릿 탭처럼 완전히 새로 시작할 때) — 그 문제를 원천적으로 막는 거예요.
let _resolveAuthReady;
window.authReadyPromise = new Promise((resolve) => { _resolveAuthReady = resolve; });
firebase.auth().onAuthStateChanged((user) => {
  if (user) _resolveAuthReady();
});
firebase.auth().signInAnonymously().catch((err) => {
  console.error("익명 로그인 실패:", err);
  _resolveAuthReady(); // 인증이 실패해도 화면이 무한정 멈춰있지 않도록
});

// ---- Cloudinary 설정 (사진 업로드용) ----
// Firebase Storage는 이제 카드 등록(Blaze)이 필요해서, 대신 무료인 Cloudinary를 씁니다.
// 아래 두 값을 Cloudinary 가입 후 본인 값으로 꼭 채워주세요:
// 1) cloudName: Cloudinary 대시보드 상단에 보이는 "Cloud name"
// 2) uploadPreset: Settings → Upload → Upload presets → Add upload preset
//    → Signing Mode를 "Unsigned"로 설정하고 저장한 뒤, 그 preset 이름
window.CLOUDINARY = {
  cloudName: "qu68x157",
  uploadPreset: "krlvpgfp",
};

// ---- 공통 Firestore 문서 참조 (테스트 모드일 땐 자동으로 "badminton_test" 컬렉션을 써요) ----
window.REFS = {
  roster: db.collection(BC_COLLECTION).doc("roster"),         // 회원 명단
  notices: db.collection(BC_COLLECTION).doc("notices"),       // 공지사항
  checkin: db.collection(BC_COLLECTION).doc("checkin"),       // 오늘 참석 체크인
  restwish: db.collection(BC_COLLECTION).doc("restwish"),     // 랜덤매칭 휴식 희망
  suggestions: db.collection(BC_COLLECTION).doc("suggestions"), // 건의사항
  schedule: db.collection(BC_COLLECTION).doc("schedule"),     // 일정
  checkinlog: db.collection(BC_COLLECTION).doc("checkinlog"), // 출석 이력(출석왕 계산용)
  reviews: db.collection(BC_COLLECTION).doc("reviews"),       // 모임 후기
  matchhistory: db.collection(BC_COLLECTION).doc("matchhistory"), // 랜덤매칭 경기 기록 (내 정보용)
  statsadjust: db.collection(BC_COLLECTION).doc("statsadjust"), // 관리자의 개인 전적 수동 보정값
  paymentinfo: db.collection(BC_COLLECTION).doc("paymentinfo"), // 대관비 계좌 정보
  payments: db.collection(BC_COLLECTION).doc("payments"),       // 날짜별 대관비 송금 현황
  pending: db.collection(BC_COLLECTION).doc("pending"),         // 신규 가입 승인 대기 명단
  courtmatches: db.collection(BC_COLLECTION).doc("courtmatches"), // 코트별 진행중인 경기 (실시간 공유)
  matchmode: db.collection(BC_COLLECTION).doc("matchmode"),     // 매칭 모드(랜덤/균형/실력전) + 제외 회원
  kindvotes: db.collection(BC_COLLECTION).doc("kindvotes"),     // "또 치고싶어요" 익명 투표 (친절왕 집계용)
  dailyvotes: db.collection(BC_COLLECTION).doc("dailyvotes"),   // 오늘의 MVP/친절왕/분위기메이커/성장왕/베스트플레이 익명 투표
  noshows: db.collection(BC_COLLECTION).doc("noshows"),         // 노쇼 기록 (자동/관리자 부여)
  guestlist: db.collection(BC_COLLECTION).doc("guestlist"),     // 가끔 오는 게스트 (날짜별) — 매칭 참석자에 임시로 추가됨
  shuttlecock: db.collection(BC_COLLECTION).doc("shuttlecock"), // 날짜별 셔틀콕 제출 현황
  dailylogin: db.collection(BC_COLLECTION).doc("dailylogin"),   // 로그인 기준 "출석" 기록 (모임 "참석"과는 별개)
  teamqueue: db.collection(BC_COLLECTION).doc("teamqueue"),     // 팀 대기열 (다음/그다음 경기를 미리 짜둔 목록)
};

// ---- 공통 상수 ----
window.GRADES = [
  { key: "운영진", emoji: "👑", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "MVP", emoji: "🏆", color: "bg-amber-50 text-amber-600 border-amber-200" },
  { key: "일반회원", emoji: "", color: "bg-stone-50 text-stone-400 border-stone-200" },
  { key: "신입회원", emoji: "🌱", color: "bg-stone-50 text-stone-400 border-stone-200" },
];

window.LEVELS = ["왕초보", "초보", "D조", "C조", "B조"];
window.LEVEL_SKILL = { "왕초보": 0.05, "초보": 0.25, "D조": 0.5, "C조": 0.75, "B조": 0.95 };

window.ADMIN_PIN = "004400";
