# mi-security-review

Use for changes touching auth, credentials, connectors, owner memory, remote control, file access, or message delivery.

Check:

- Secrets are not logged, committed, surfaced in UI, or sent to untrusted connectors.
- Owner data paths respect consent and least privilege.
- Write/delete/deploy/send/remote actions require the correct approval level.
- Inputs crossing HTTP, WebSocket, file, or connector boundaries are validated.
- Audit logs capture who/what/when/result without storing sensitive payloads.
- Dependency and generated artifact changes are intentional.

