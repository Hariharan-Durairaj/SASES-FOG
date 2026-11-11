# Emergency Information PWA

A static, installable emergency-information website generated from a Microsoft 365 OneDrive folder tree. The generated site has no application server or database and precaches its pages and images for offline use.

## What is implemented

- Any folder depth, ordering prefixes, draft/temp-file exclusions, direct-open single-document folders
- DOCX conversion with Mammoth, embedded images, tables, heading navigation, run colour and highlight post-processing
- JPG/PNG conversion to WebP, cover thumbnails and folder galleries
- Responsive bento tiles sized from direct subfolder counts: 0-2 normal, 3-5 wide, 6+ large
- MiniSearch index, PWA manifest, Workbox service worker, offline indicator and update banner
- Scheduled/manual GitHub Actions sync from OneDrive and GitHub Pages deployment
- Sample DOCX/image content and Playwright mobile/offline test

## Local setup

Requirements: Node.js 22 or later.

```bash
npm ci
npm run build:sample
npm run serve
```

Open `http://localhost:4173`. Run `npm test` for the build smoke test and `npx playwright install chromium && npm run test:e2e` for browser testing.

## OneDrive and GitHub setup

1. Create a public GitHub repository and push this project to its `main` branch. If policy requires a private repository, deploy `dist/` with Cloudflare Pages instead.
2. In the repository, enable **Settings > Pages > Source: GitHub Actions**.
3. On a trusted computer, install rclone and run `rclone authorize "onedrive"`. Complete work-account sign-in.
4. Add the returned JSON token as the repository Actions secret `RCLONE_TOKEN`.
5. Edit `ONEDRIVE_FOLDER` in `.github/workflows/publish.yml` to the folder used as the public content root.
6. Run **Actions > Sync OneDrive and publish > Run workflow**.

The workflow gives rclone no write commands. `rclone sync` writes only to the runner's local `content/` folder. The Microsoft permission granted during authorization should be reviewed with the organisation's M365 administrator.

### Optional refreshed-token write-back

The workflow can replace `RCLONE_TOKEN` with rclone's refreshed token, but GitHub's normal `GITHUB_TOKEN` cannot administer Actions secrets. To enable write-back, add `GH_ADMIN_TOKEN`, a fine-grained GitHub token that is restricted to this repository and has **Secrets: Read and write** permission. If this is not acceptable under organisational policy, omit it and rotate `RCLONE_TOKEN` manually when required.

## Cloudflare Pages alternative

Use build command `npm ci && npm run build` and output directory `dist`. Feed `content/` from a separate approved sync workflow, or replace the deploy job with `npx wrangler pages deploy dist --project-name <name>` and a scoped `CLOUDFLARE_API_TOKEN`.

## Security and publishing notes

- Everything under the selected OneDrive folder is intended for public release. Do not place operationally sensitive, personal, or internal-only information there.
- GitHub Actions logs must not print the rclone token. The supplied workflow writes it directly to the config file and masks repository secrets automatically.
- Use a dedicated least-privilege Entra application if the tenant blocks rclone's default application or requires formal app approval.
- A content hash avoids scheduled redeployment when the synchronized files are unchanged. Manual runs and pushes still rebuild for testing.

## Main configuration

Edit `CONFIG` near the top of `build/build.mjs` to change the site title or bento thresholds. Branding colours are CSS variables at the top of `src/style.css`.
