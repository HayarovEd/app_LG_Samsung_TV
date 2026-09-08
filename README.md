# Tele TV for LG and Samsung TV

Web TV client prototype for LG webOS and Samsung Tizen.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to an HTTPS API endpoint with CORS enabled. Set `VITE_TEST_STREAM_URL` only for local player testing. Without the API URL, the app runs in demo mode.

## Build

```bash
npm run build
```

The build also creates `dist/platforms/tizen` and `dist/platforms/webos` package sources. Sign them with the official Samsung Tizen and LG webOS tools before installing on a TV.

The current prototype includes the login, API-backed channel catalogue, TV remote navigation, and platform-specific player adapters. Stream compatibility still needs validation on target TV models.