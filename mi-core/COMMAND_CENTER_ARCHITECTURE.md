# Command Center Architecture

The Phase 10 command center exposes one executive snapshot across:
- Finance: revenue, labor, payroll, risk
- Marketing: traffic, conversions, reviews, campaigns
- Operations: food safety, DoorDash, Toast, QB
- IT: services, ports, backups, incidents
- Creative: assets, approvals, campaign support

Runtime source: `server/src/company-os-operational/command-center/`.

The command center reads local Phase 5, 6, 7, and 8 dashboards and preserves live-data blockers instead of inventing production metrics.
