# FarmFresh Security & Deployment Checklist

## Local development

1. Keep `backend/.env` private. Never commit it.
2. From `backend/`, run `npm install` (or `npm ci` when using the lockfile).
3. From `frontend/`, run `npm install` (or `npm ci`). Do not copy a `node_modules` directory between operating systems.
4. Start MongoDB / use the configured MongoDB Atlas URI.
5. Start backend: `node server.js`.
6. Start frontend: `npm run dev`.
7. Verify `http://localhost:5000/health` and `http://localhost:5000/ready`.

## Required backend variables

- `MONGO_URI` — MongoDB connection string.
- `JWT_SECRET` — long random secret; production should use 64+ random characters.
- `BANK_ENCRYPTION_KEY` — exactly 64 hexadecimal characters.
- `CORS_ORIGIN` — exact frontend origin(s), comma-separated.
- `NODE_ENV=production` in production.
- `TRUST_PROXY=1` only when the app is behind a trusted reverse proxy/load balancer.
- Existing eNAM variables should remain configured if market-price synchronization is required.

## Frontend production

Set `VITE_API_URL` to the public API base URL ending in `/api` before `npm run build`.

Example local value:
`VITE_API_URL=http://localhost:5000/api`

## Nginx + PM2

- Replace the placeholder `server_name _;` with the real API hostname.
- Terminate TLS at Nginx or the cloud load balancer.
- `deploy/pm2/ecosystem.config.cjs` resolves the backend path absolutely, so it can be started from any working directory.
- Two instances listen on ports 5000 and 5001.
- Nginx distributes requests using `least_conn`.
- Point the load balancer readiness check at `/ready`, not only `/health`.

## Security layers

- Helmet security headers
- Strict CORS when `CORS_ORIGIN` is configured
- Application WAF for common request-layer attacks
- Global and write rate limiting
- Upload-specific rate limiting
- Express route-parameter ObjectId validation
- Server-side resource ownership checks for FPO, consumer, farmer, batch, listing, order, payout and subscription resources
- Private KYC/import storage
- Password hashing with bcrypt
- JWT authentication + role authorization
- Tamper-evident internal SHA-256 audit hash chain

## Important architecture note

The audit blockchain is an internal MongoDB-backed hash chain. It is tamper-evident and verifiable, but it is not a decentralized public blockchain. For a stronger production trust boundary, store periodic signed/exported audit checkpoints outside the application database.

The in-process rate limiter protects each backend process. For a multi-region or horizontally scaled deployment, use a shared rate-limit store (for example Redis) at the infrastructure layer so limits are global across instances.

## Verification endpoints

- `GET /health` — process liveness.
- `GET /ready` — MongoDB readiness.
- `GET /api/security/audit-ledger/verify` — authority-admin audit-chain verification.
