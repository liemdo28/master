# Node.js + TypeScript Best Practices

## Project Structure
- src/ for source
- dist/ for compiled output
- Separate config, routes, services, models

## Error Handling
- Always use try/catch in async functions
- Create custom error classes
- Global error middleware in Express

## Security
- Helmet.js for HTTP headers
- Rate limiting on all endpoints
- Input validation (zod or joi)
- Never log sensitive data

## Performance
- Use streaming for large files
- Cache heavy computations
- Connection pooling for DB