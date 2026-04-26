import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  // The bare loader — no remark/rehype plugins for now. We can layer GFM
  // (tables/strikethrough) and shiki/prism (syntax highlighting) later
  // without changing the route surface.
});

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Treat .mdx files as page candidates so the dynamic [[...slug]] route
  // can resolve them and the loader runs on import.
  pageExtensions: ["ts", "tsx", "js", "jsx", "mdx"],
};

export default withMDX(nextConfig);
