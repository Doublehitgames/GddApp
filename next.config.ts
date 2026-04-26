import type { NextConfig } from "next";

// We don't use `@next/mdx` anymore: Turbopack rejects function-typed
// loader options (so remark plugins fail to serialise), and the runtime
// `next-mdx-remote` evaluator uses `new Function()` which breaks under
// React 19 + RSC. The docs page now compiles MDX server-side with
// `@mdx-js/mdx` directly — see app/(docs)/docs/[[...slug]]/page.tsx.
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
