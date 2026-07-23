# 싱크님의 일상 — Supabase + Vercel 배포 가이드

## 파일 구성
- `index.html` — 페이지 구조 (사이드바 + 메인 소개 화면 + 7개 섹션 + 글쓰기/데일리로그)
- `styles.css` — 전체 스타일
- `app.js` — 화면 전환, 글쓰기, 데일리 로그, Supabase 동기화 로직
- `config.js` — Supabase 프로젝트 URL / anon key (직접 채워야 함)
- `schema.sql` — Supabase에 실행할 테이블 + RLS 정책

## 1. Supabase 프로젝트 준비
1. https://supabase.com 에서 새 프로젝트를 생성합니다.
2. 좌측 메뉴 **SQL Editor** 에서 `schema.sql` 내용을 붙여넣고 실행합니다.
   - `app_data` 테이블 하나에 사용자별로 글/데일리로그 전체가 jsonb로 저장됩니다.
   - Row Level Security가 켜져 있어 각자 자신의 데이터만 읽고 쓸 수 있습니다.
3. **Authentication > Providers > Email** 에서 이메일 매직링크(OTP) 로그인이 켜져 있는지 확인합니다. (기본값으로 켜져 있음)
4. **Authentication > URL Configuration** 에서:
   - `Site URL` 에 배포될 Vercel 주소(예: `https://your-app.vercel.app`)를 입력
   - `Redirect URLs` 에 같은 주소와 `http://localhost:3000`(로컬 테스트용)을 추가
5. Project URL과 API 키 복사 — Supabase가 최근 대시보드 메뉴를 개편해서 "Project Settings > API"라는 이름이 없을 수 있습니다. 아래 두 가지 방법 중 하나로 찾으세요.
   - **가장 쉬운 방법:** 프로젝트 상단의 **Connect** 버튼 클릭 → "App Frameworks" 또는 "API" 탭에 `Project URL`과 키가 함께 표시됩니다.
   - **메뉴로 찾는 방법:** 좌측 사이드바 톱니바퀴(Project Settings) → **Data API** 메뉴에서 `Project URL`을 확인하고, **API Keys** 메뉴로 이동합니다.
     - API Keys 화면에 탭이 있다면 **Legacy API Keys** 탭에서 `anon` `public` 키를 그대로 쓰면 됩니다.
     - 탭이 "Publishable and secret API keys"만 보이고 Legacy 키가 없다면, **Publishable key** (`sb_publishable_...`로 시작)를 복사하세요. 이 키가 예전 anon key와 같은 역할(클라이언트에 노출해도 되는 공개 키)을 합니다. **secret key는 절대 사용하지 마세요** — 서버 전용 키입니다.

## 2. config.js 채우기
`config.js`를 열어 아래 두 값을 방금 복사한 값으로 바꿉니다.

```js
const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'ey... 또는 sb_publishable_...';
```

anon/publishable 키는 클라이언트(브라우저)에 노출되어도 되는 키입니다. 실제 보안은 Supabase의 Row Level Security 정책이 처리하므로, 이 키만으로는 남의 데이터에 접근할 수 없습니다.

## 3. Vercel 배포
1. 이 4개 파일(`index.html`, `styles.css`, `app.js`, `config.js`)을 GitHub 리포지토리에 올립니다.
2. https://vercel.com 에서 **Add New > Project** 로 해당 리포지토리를 Import 합니다.
3. Framework Preset은 **Other**로 두고 그대로 Deploy 합니다. (빌드 과정 없는 정적 사이트라 별도 설정이 필요 없습니다.)
4. 배포가 끝나면 발급된 주소(예: `https://your-app.vercel.app`)를 위 1-4단계의 Supabase URL Configuration에도 반영되어 있는지 다시 확인합니다.

## 4. 동작 확인
1. 배포된 주소로 접속 → 좌측 사이드바에서 이메일 입력 후 "로그인 링크 보내기" 클릭
2. 메일함에서 받은 링크 클릭 → 자동으로 로그인 상태가 됩니다.
3. 데일리 로그, 글쓰기(첨부 포함)를 저장해봅니다. 저장 시마다 Supabase로 자동 업로드됩니다.
4. 다른 브라우저/기기에서 같은 이메일로 로그인하면 동일한 내용이 그대로 불러와지는지 확인합니다.

## 모바일 ↔ 데스크탑 실시간 동기화 (중요, 업데이트 반영 방법)
기존에는 로그인 시점에만 데이터를 한 번 불러오고, 그 이후에는 화면을 새로고침하기 전까지 다른 기기의 변경사항이 자동으로 보이지 않는 문제가 있었습니다. 이를 고치기 위해 Supabase Realtime을 사용해 한쪽 기기에서 저장하면 다른 쪽에도 즉시 반영되도록 했습니다.

**이미 프로젝트를 만들어두신 분은 아래 한 단계만 추가로 하시면 됩니다.**
1. Supabase 대시보드 > **SQL Editor**에서 갱신된 `schema.sql`을 다시 실행하세요. (맨 아래 Realtime 활성화 부분만 새로 추가됐고, 나머지는 이미 있으면 건너뛰도록 만들어서 여러 번 실행해도 안전합니다.)
2. 그래도 실시간 반영이 안 보이면, Supabase 대시보드 **Database > Replication**에서 `app_data` 테이블이 realtime 목록에 켜져 있는지 확인하세요.
3. `app.js`를 이번에 받은 버전으로 교체하세요.

이제는 한쪽 기기에서 저장하면 다른 쪽이 켜져 있을 때 몇 초 안에 자동으로 화면이 갱신됩니다. 혹시 실시간 반영이 안 되는 경우를 대비해, 탭/앱을 다시 열거나 화면으로 돌아올 때도 최신 데이터를 한 번 더 받아오도록 안전장치를 넣어뒀습니다.

## 참고
- 로그인하지 않아도 이 브라우저(localStorage)에는 즉시 저장되지만, 다른 기기와 동기화되거나 캐시를 지운 뒤에도 남으려면 반드시 로그인해야 합니다.
- 사진/파일 첨부는 base64로 인코딩되어 저장됩니다. 너무 큰 파일을 많이 첨부하면 저장이 느려질 수 있으니 사진은 적당한 크기로 첨부하는 것을 권장합니다.
- 메인 페이지에 실제 프로필 사진을 넣으려면 같은 폴더에 `profile.jpg`를 추가하고 `index.html`의 주석 처리된 `<img>` 줄의 주석을 해제하세요.

## 무료로 사용하기
- **Supabase 무료(Free) 플랜**: 개인용 이 정도 규모(1인 사용, 글/사진 첨부 몇백 건 수준)라면 무료 플랜만으로 충분합니다. 별도 카드 등록 없이 프로젝트를 생성할 수 있습니다. 다만 무료 프로젝트는 7일간 API 요청이 없으면 자동으로 일시정지(pause)될 수 있으니, 오랫동안 접속하지 않았다면 대시보드에서 "Restore/Resume project"를 눌러 다시 켜주면 됩니다. 데이터는 사라지지 않습니다.
- **Vercel 무료(Hobby) 플랜**: 지금 만든 파일들은 빌드 과정이 없는 순수 정적 사이트라 Hobby 플랜 한도 안에서 충분히 운영 가능합니다. 개인/비상업적 용도로 사용하시면 됩니다.
- 두 서비스 모두 신용카드 등록 없이 무료 플랜으로 시작할 수 있습니다.
