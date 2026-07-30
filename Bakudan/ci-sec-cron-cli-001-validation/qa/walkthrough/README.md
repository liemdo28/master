# Walkthrough Recorder

Captures user flows as video + structured data for QA documentation.

## Usage

```bash
# Install dependencies
cd qa && npm install

# Record a walkthrough
node walkthrough/record.js login-flow

# Generate HTML report
node walkthrough/generate-report.js
```

## Templates

- `templates/login-flow.json` - Login → Dashboard verification
- `templates/create-task-flow.json` - Create task → Verify

## Output

- Screenshots: `walkthrough/captures/{flow-name}/`
- Reports: `walkthrough/reports/{flow-name}.html`
