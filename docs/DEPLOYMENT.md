# Account deployment and recovery

The existing localhost service remains an anonymous demo. Account mode is a separate configuration using Express sessions, SQLite session persistence and scrypt password hashing. Every active account has an explicit farm list, including administrators. Field users record observations/actions/outcomes/follow-ups; supervisors and administrators can additionally submit review records. The server validates parent-batch and assessment links, rejects entity replacement and records the submitting account with server receipt time. A staff code inside a record remains a self-report; the separate server receipt is the authenticated submission identity, not proof of who made the field observation.

## Local account workspace

A separate instance is provisioned at http://127.0.0.1:8790/ with farm `F-001`. Read `.data/accounts-local/ACCESS.txt` for the generated operator login; credentials are intentionally excluded from reports and Git. `systemctl --user status silksense-accounts` manages it. `node --experimental-strip-types scripts/setup-local-accounts.ts` provisions this instance without changing the existing anonymous service. A live browser smoke check verified sign-in, Telugu rendering at 390 px, authenticated model health, logout and rejection of logged-out synchronization.

This is localhost account deployment, not public HTTPS deployment. The existing demonstration on port 8787 and its browser records are retained separately.

## Prepare the host

1. Install Node 22.23+, the project's pinned Python inference dependencies and Caddy. Copy the app to `/opt/silksense`, run `npm ci` and `npm run build`. Use a dedicated `silksense` OS account and writable `/var/lib/silksense` directory.
2. Copy `deployment/accounts.env.example` to `/etc/silksense/accounts.env`, mode 0600. Replace the session secret with a cryptographically random value. Set `PUBLIC_ORIGIN` to the real HTTPS origin. Do not commit this file. Do not use the placeholder domain or secret.
3. Create accounts using the local operator CLI with the same `DATA_DIR`. Passwords are read from stdin, not command-line arguments. Example interactive Bash session:

```bash
read -rsp 'New password (12+ characters): ' silksense_password
printf '%s' "$silksense_password" | DATA_DIR=/var/lib/silksense npm run user -- create field01 field F-001
unset silksense_password
```

Use `create officer01 supervisor F-001 F-002` for an officer. Use `password USER` with password on stdin, `disable USER`, `enable USER`, or `farms USER replace F-001 F-002`. Account changes revoke sessions. No public self-registration or universal default password exists.

4. Install the account service template with paths adjusted for the host. Run the Python inference service on loopback port 8791; do not expose that service directly. The application listens on loopback port 8787.
5. Set Caddy's `DOMAIN` to the same domain as `PUBLIC_ORIGIN`; point DNS to the server and open ports 80/443. Install `deployment/Caddyfile` and validate it with `caddy validate --config deployment/Caddyfile --adapter caddyfile`. Caddy handles TLS issuance, renewal and HTTP redirects. Its process must share the host network with the loopback application; this configuration does not describe a container network.
6. Verify HTTPS, camera permission, login/logout, cross-farm denial, offline capture and synchronization using actual provisioned accounts. Check `/api/health`; authenticated `/api/model/health` verifies the loaded model. Public DNS/TLS checks remain pending until a domain and reachable host are supplied.

Primary configuration references: [Express session documentation](https://expressjs.com/en/resources/middleware/session/), [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

## Offline and shared-device behavior

Each account and its farm/role assignment has a separate IndexedDB namespace. Changing accounts does not merge local records. A same-tab cached session can reopen local work offline until its expiry; backend requests always require a live server session. Server permission changes cannot instantly revoke an already offline device. Offline data is not encrypted at rest, and OS/browser-profile access remains outside this app's authorization boundary. Use a dedicated browser profile on a shared device and sign out before handing it over. Signing out hides that user's local records but retains unsynced work for their next login. Offline sign-out locks the device immediately and leaves a pending server logout that must complete after reconnecting. Farm/role changes use a new local namespace; old offline work needs an authorized operator review before recovery/import.

The anonymous demonstration namespace is not automatically imported into accounts. Export/import is explicit; server checks apply when imported records synchronize. Keep assigned farms stable while devices have unsynced work. No email/SMS notifications, password-reset email or remote device wipe is claimed.

## Backups and retention

Run `DATA_DIR=/var/lib/silksense node --experimental-strip-types scripts/backup-db.ts /secure-backups/silksense-DATE.sqlite`. SQLite creates a consistent snapshot while the application is running, and the script verifies integrity and uses restrictive file permissions. Backups include account hashes, structured records and sessions; browser media is not included. Store encrypted copies off-host and restrict access.

For recovery: stop the app, preserve the current database and its WAL/SHM files together, restore a verified snapshot into a clean data directory, set service ownership, delete restored sessions (`DELETE FROM sessions`) to require fresh sign-in, then restart and verify record counts and authorization. Never replace the SQLite file while the service is writing. Test recovery on an isolated copy first.

No automatic record deletion is enabled: it could destroy required follow-up evidence or unsynced reconciliation history. Before field use the operator must choose retention periods for records, local media and backups, and document deletion/export requests. A retention period cannot be chosen on behalf of the department without its requirements.
