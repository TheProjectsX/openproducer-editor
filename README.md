# Local Studio

Frontend-only media editor PWA. All media processing, project storage, and exports stay in the browser. Product scope and implementation decisions live in [`project_research/`](project_research/README.md).

## Local development

Requirements: Node.js 24 LTS and npm. In this Windows environment, pnpm's executable is blocked by Device Guard, so the project uses npm and `package-lock.json`.

```powershell
npm ci
npm run dev
npm run typecheck
npm run build
```

The app is built with React Router Framework Mode and static output. There is no runtime server or media backend. Serve the generated static output over HTTPS to test installation and service workers.

## Project areas

- `app/`: routes and UI
- `public/`: static app assets
- `project_research/`: product, technical, and implementation guides
- `WORK_LOG.md`: sequential record of work completed and commits

See [`project_research/docs/07-implementation-roadmap.md`](project_research/docs/07-implementation-roadmap.md) for the implementation sequence.
