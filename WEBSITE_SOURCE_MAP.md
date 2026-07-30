# Website Source Map

Generated: 2026-06-14

## Summary

| Website | Local source | GitHub repository | Production domain | Branch | Last commit | Deploy method | Last deploy evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bakudanramen.com | `E:/Project/Master/Bakudan/bakudanramen.com-current` | `https://github.com/liemdo28/bakudanwebsite_sub.git` | `https://bakudanramen.com` -> `https://www.bakudanramen.com/` | `main` | `2fcdff7d72d197f6c9fa7993108dd7e2d5b8694f` | GitHub Actions SCP deploy to server target directory | `Deploy rim.bakudanramen.com`, success, `2026-06-01T08:49:37Z` |
| rawsushibar.com | `E:/Project/Master/RawSushi/RawWebsite` | `https://github.com/liemdo28/rawwebsite.git` | `https://rawsushibar.com` -> `https://www.rawsushibar.com/` | `master` local | `7b38923929637a88642a595babf9da91f8e6390c` | GitHub Actions scheduled publish API | `RawWebsite Scheduled Publish`, success, `2026-06-14T13:10:20Z` |

## Bakudan Website

- Local source path: `E:/Project/Master/Bakudan/bakudanramen.com-current`
- GitHub origin: `https://github.com/liemdo28/bakudanwebsite_sub.git`
- Extra remote: `https://github.com/heoventure/BakudanWebsite.git`
- Production domain: `https://bakudanramen.com`
- Canonical public URL: `https://www.bakudanramen.com/`
- Branch: `main`
- Last commit: `2fcdff7d72d197f6c9fa7993108dd7e2d5b8694f`
- Last commit time: `2026-06-01 15:47:10 +0700`
- Last commit subject: `assets: import 14 unique images from WordPress source before removal`
- Deploy file: `.github/workflows/deploy.yml`
- Deploy method: GitHub Actions copies static files by SCP to a server target directory.

## Raw Sushi Website

- Local source path: `E:/Project/Master/RawSushi/RawWebsite`
- GitHub origin: `https://github.com/liemdo28/rawwebsite.git`
- Production domain: `https://rawsushibar.com`
- Canonical public URL: `https://www.rawsushibar.com/`
- Local branch: `master`
- Last local commit: `7b38923929637a88642a595babf9da91f8e6390c`
- Last local commit time: `2026-06-12 15:59:39 +0700`
- Last local commit subject: `SEO audit sync: 10 new blog posts, location pages, updated content`
- Deploy files: `.github/workflows/scheduled-publish.yml`, `_redirects`, `wrangler.toml`, `wrangler.jsonc`
- Deploy method: GitHub Actions scheduled publish API with Cloudflare/Wrangler deployment configuration.

## Source Map Risks

- Raw Sushi local branch is `master`, while recent GitHub Actions runs report `headBranch: main`. Confirm the intended production branch before future release work.
- Bakudan local tree has existing uncommitted/untracked source changes. They were not reverted or altered.
- Raw local tree has existing untracked `rawwebsite/` source copy. It was synced as evidence and not reverted.

