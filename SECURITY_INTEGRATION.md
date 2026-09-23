# FarmFresh Security Integration

This patch adds defense-in-depth security without changing the existing FarmFresh business model.

## Implemented

### 1. WAF
`backend/middleware/waf.js`

Runs before API routes and blocks common request-layer attacks:
- Mongo/NoSQL operator keys
- prototype-pollution keys
- obvious XSS payloads
- path traversal patterns
- excessively deep/large JSON structures

This is an application-layer WAF. Production should still use a managed edge WAF such as Cloudflare/AWS WAF where available.

### 2. Rate limiting
`backend/middleware/rateLimiters.js`

- Authentication: 10 attempts / 15 minutes per client IP
- API: 600 requests / 15 minutes per client IP
- Write methods: 120 requests / minute per client IP
- Upload endpoints: 40 requests / 15 minutes per client IP

`TRUST_PROXY=1` should be used only when the service is behind a trusted reverse proxy/load balancer.

Important: the built-in limiter uses process-local memory. In a horizontally scaled deployment, use a shared rate-limit store at the infrastructure layer for globally coordinated limits.

### 3. IDOR defense
`backend/middleware/idValidation.js`

Express `app.param()` validators reject malformed Mongo ObjectIds before route handlers run.

This is only one layer of IDOR defense. The existing controllers also scope resources to the authenticated user's FPO or consumer identity. Examples include:
- FPO + farmer
- FPO + batch
- FPO + listing
- FPO + order
- FPO + payout
- consumer + order
- consumer + subscription
- user + notification

### 4. Tamper-evident audit blockchain
- `backend/models/AuditBlock.js`
- `backend/services/blockchainAuditService.js`
- `backend/controllers/securityController.js`
- `backend/routes/securityRoutes.js`

Every existing ActivityLog event is additionally committed to a SHA-256 hash chain containing the previous block hash and payload hash.

Verify with an authority-admin token:
`GET /api/security/audit-ledger/verify`

This is an internal MongoDB-backed tamper-evident hash chain, not a decentralized public blockchain.

### 5. Load balancing
- `deploy/nginx/farmfresh.conf`
- `deploy/pm2/ecosystem.config.cjs`

PM2 starts two API processes on ports 5000 and 5001. Nginx distributes requests with `least_conn`.

The PM2 config resolves the backend directory from `__dirname`, so it does not depend on the directory from which PM2 is invoked.

### 6. Health/readiness
- `/health` = process liveness
- `/ready` = MongoDB readiness

The load balancer should use `/ready` for backend health decisions.

### 7. Upload security
Existing Multer restrictions remain in place. Upload-specific rate limiting is now applied to KYC, farmer imports, listing images and grading images.

### 8. Sensitive data
- KYC/import files stay under `private_uploads/` and are not exposed by the public `/uploads` static route.
- Staff update responses no longer return password hashes.
- Public listing traceability no longer exposes farmer phone numbers.

## Production requirements

Set real values for:
- `MONGO_URI`
- `JWT_SECRET` (64+ random characters recommended)
- `BANK_ENCRYPTION_KEY` (64 hexadecimal characters)
- `CORS_ORIGIN`
- `FRONTEND_URL`
- `VITE_API_URL` on the frontend
- `NODE_ENV=production`
- `TRUST_PROXY=1` when behind Nginx/cloud proxy

Replace the Nginx `server_name _;` placeholder with the real API hostname and terminate TLS at Nginx or the cloud load balancer.
