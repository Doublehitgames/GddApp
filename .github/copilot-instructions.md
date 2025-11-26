# Copilot Instructions for AI Agents

## Project Overview
- This is a Next.js app using the `/app` directory structure, bootstrapped with `create-next-app`.
- Main entry: `app/page.tsx`. Routing is file-based, with nested routes under `app/projects/` and dynamic routes under `app/projects/[id]/`.
- State management is handled in `store/projectStore.ts`.
- Custom hooks are in `hooks/`, e.g., `useInitProjects.ts` for project initialization logic.

## Key Patterns & Conventions
- Use React Server Components and Client Components as per Next.js 13+ conventions. Client components must include `"use client"` at the top.
- Shared styles are in `app/globals.css`.
- Project details and logic for individual projects are in `app/projects/[id]/ProjectDetailClient.tsx`.
- Prefer hooks for data fetching and initialization logic.
- Use TypeScript throughout; type definitions are in `.ts` and `.tsx` files.
- Configuration files: `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json`.

## Developer Workflows
- **Start dev server:** `npm run dev` (default port 3000)
- **Build for production:** `npm run build`
- **Lint:** `npm run lint`
- **No explicit test setup detected.**
- Hot reload is enabled for all changes in the `/app` directory.

## Integration Points
- Fonts are optimized via `next/font` (see README).
- External dependencies managed in `package.json`.
- Public assets are in `public/`.

## Examples
- To add a new project route: create a new folder under `app/projects/` and add a `page.tsx`.
- To fetch and initialize project data: use or extend `hooks/useInitProjects.ts` and update `store/projectStore.ts` as needed.
- For client-side interactivity, ensure your component starts with `"use client"`.

## Recommendations for AI Agents
- Always check for existing hooks and stores before adding new logic.
- Follow Next.js file-based routing and component conventions.
- Reference configuration files for build/lint settings.
- Keep styles in `globals.css` unless component-specific.
- Document any new patterns or workflows in this file for future agents.
