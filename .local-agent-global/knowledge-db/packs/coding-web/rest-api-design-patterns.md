# REST API Design

## URL Structure
- GET /api/resources — list
- GET /api/resources/:id — single
- POST /api/resources — create
- PUT/PATCH /api/resources/:id — update
- DELETE /api/resources/:id — delete

## Response Format
- Always return JSON
- Include status code
- Consistent error format: { error: string, code: string }
- Pagination: { data, total, page, limit }

## Authentication
- JWT for stateless auth
- Refresh token rotation
- Bearer token in Authorization header