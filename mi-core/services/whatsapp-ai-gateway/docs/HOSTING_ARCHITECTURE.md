# Hosting Architecture

## Runtime Requirement

The WhatsApp Web bot is not a static website. It requires a long-running Node.js process and a persistent browser session for `whatsapp-web.js`.

The runtime needs:

- A continuously running Node process.
- Chromium/Puppeteer support.
- Persistent WhatsApp session storage under `data/session`.
- Reliable outbound network access to WhatsApp Web, Google APIs, and the vision API.
- Restart supervision after crashes, OS restarts, and network drops.

## Shared Host Position

Shared hosting is not recommended for the bot runtime.

Shared hosts usually do not provide reliable long-running Node processes, browser automation support, or persistent background sessions. They may work for simple static pages, but the WhatsApp listener needs process supervision and a browser session that remains alive.

Shared hosting can host a static dashboard only if the actual API and bot runtime are hosted elsewhere and proxied securely.

## Recommended Options

Option A: Laptop always on

- Fastest for controlled testing.
- Good for the first test-group validation.
- Risk: user logout, sleep mode, browser/session instability, local network outages.

Option B: Dedicated Windows PC

- Good for a store office or back-office pilot.
- Easier to support with Task Scheduler or a service wrapper.
- Risk: still depends on local power/network and OS updates.

Option C: VPS

- Recommended for production pilot.
- Supports a long-running Node service, browser dependencies, backups, monitoring, and remote access.
- Best fit once the separate WhatsApp test group passes end-to-end.

## Recommendation

Use a laptop or dedicated Windows PC for the first controlled test group. Move to a VPS or dedicated PC before enabling any real Bakudan operations group.

Do not connect the real operations group until the test group proves:

1. WhatsApp image intake works.
2. Vision analysis is configured and verified with a real image.
3. Threshold checks are correct.
4. Google Sheet daily log append works.
5. FAIL and NEEDS_REVIEW warnings are sent back to the test group.
6. Dashboard status shows the latest image, result, warning, and sheet write state.
