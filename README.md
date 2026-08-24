# Meldrift Monorepo

두 가지 Meldrift 앱을 한 저장소에서 관리한다.

```text
apps/
  free/   # 기본 앱: /
  plus/   # Plus 앱: /plus
```

## Local development

```bash
npm install
npm run dev
```

- Free: `http://localhost:3000`
- Plus: `http://localhost:3000/plus`
- Plus 직접 접속: `http://localhost:3001/plus`

배포 환경에서는 Free 프로젝트에 `PLUS_ORIGIN`을 Plus 프로젝트의 origin으로 설정한다.
