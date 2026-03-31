# 🥣 이유식 플래너

우리 아이 이유식 식단 & 큐브 관리 PWA 웹앱  
Firebase Firestore + Google 로그인 + GitHub Pages 배포

---

## 📁 파일 구조

```
/
├── index.html        # 메인 HTML
├── style.css         # 스타일시트
├── app.js            # Firebase 연동 + 앱 로직
├── manifest.json     # PWA 매니페스트 (직접 생성)
├── sw.js             # 서비스 워커 (직접 생성)
├── README.md         # 이 파일
└── icons/
    ├── icon-192.png  # PWA 아이콘
    └── icon-512.png  # PWA 아이콘
```

---

## 🔥 Firebase 설정

### 1. Firebase 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com) → 새 프로젝트 생성
2. **Authentication** → 시작하기 → Google 로그인 활성화
3. **Firestore Database** → 데이터베이스 만들기 → 테스트 모드로 시작
4. **프로젝트 설정** → 웹 앱 추가 → Firebase SDK 구성 복사

### 2. app.js 상단 설정값 교체

```js
const FIREBASE_CONFIG = {
  apiKey:            "여기에 apiKey",
  authDomain:        "프로젝트ID.firebaseapp.com",
  projectId:         "프로젝트ID",
  storageBucket:     "프로젝트ID.appspot.com",
  messagingSenderId: "숫자ID",
  appId:             "앱ID"
};
```

### 3. Firestore 보안 규칙 설정
Firebase Console → Firestore → 규칙 탭에 붙여넣기:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🌐 GitHub Pages 배포

### 1. GitHub 저장소 생성 및 파일 업로드

```bash
git init
git add .
git commit -m "이유식 플래너 초기 배포"
git remote add origin https://github.com/유저명/repo이름.git
git push -u origin main
```

### 2. GitHub Pages 활성화
저장소 → Settings → Pages → Source: `main` 브랜치 → Save

### 3. Firebase 인증 도메인 추가
Firebase Console → Authentication → Settings → 승인된 도메인 → 추가  
`유저명.github.io` 추가

---

## 📱 PWA 설정 (Safari에서 홈 화면 추가)

### manifest.json 생성

```json
{
  "name": "이유식 플래너",
  "short_name": "이유식",
  "description": "이유식 식단표 & 큐브 관리",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#fffaf6",
  "theme_color": "#f9a86b",
  "orientation": "portrait",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### sw.js (서비스 워커) 생성

```js
const CACHE = 'baby-food-v1';
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
```

### iPhone에서 PWA 추가 방법
1. Safari에서 배포된 URL 접속
2. 하단 공유 버튼 → **홈 화면에 추가**
3. 앱처럼 전체화면으로 실행됩니다

---

## 🗂️ 데이터 구조 (Firestore)

```
users/
  {uid}/
    plans/          # 재료 계획
      {planId}: { ingredient, date, memo }
    
    meals/          # 식단 기록
      {mealId}: { date, timeLabel, type, cubes[], snackMemo, order }
    
    cubes/          # 큐브
      {cubeId}: { name, category, ingredients[], g, count, usedCount,
                  madeDate, expireDays, status }
```

---

## 🚀 기능 요약

| 탭 | 기능 |
|---|---|
| 📅 재료 플래너 | 월간 달력에 새 식재료 추가 계획 · 수정/삭제 |
| 🍽️ 식단표 | 날짜별 이유식/간식 기록 · 큐브 배치 · 총 g 자동 계산 |
| 🧊 큐브 관리 | 큐브 등록/수정/삭제 · 1개씩 사용 · D-day 표시 · 소진 처리 |

---

## 💬 문의

Claude와 함께 만든 앱입니다.  
기능 추가나 수정이 필요하면 언제든 알려주세요!
