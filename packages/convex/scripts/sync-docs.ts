/**
 * SCAFFOLDING (non-functional): this script does NOT yet write to Convex.
 * It currently parses docs MDX and logs a dry-run summary. The Convex sync is a
 * TODO (see bottom of file). Carried over from the original repo unchanged.
 *
 * Sync documentation to Convex for search and storage
 * Run: vp run sync:docs (development) or vp run sync:docs:prod (production)
 */

import fs from "fs";
import path from "path";
import { glob } from "glob";
import matter from "gray-matter";

interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: string;
  order: number;
  keywords: string[];
  content: string;
  path: string;
}

async function syncDocs(): Promise<void> {
  const docsDir = path.resolve(import.meta.dirname, "../../../apps/docs");
  const isProd = process.env.SYNC_ENV === "production";

  console.log(`Syncing docs to ${isProd ? "production" : "development"}...`);

  // Find all MDX files
  const mdxFiles = await glob("**/*.mdx", { cwd: docsDir });
  const pages: DocPage[] = [];

  for (const file of mdxFiles) {
    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Parse frontmatter
    const { data: frontmatter, content: body } = matter(content);

    // Build path from file location
    const slug = file.replace(/\.mdx$/, "").replace(/\/index$/, "");

    // Extract section from path
    const pathParts = slug.split("/");
    const section = pathParts[0] || "root";

    pages.push({
      slug,
      title: frontmatter.title || path.basename(file, ".mdx"),
      description: frontmatter.description || "",
      section: frontmatter.section || section,
      order: frontmatter.order || 0,
      keywords: frontmatter.keywords || [],
      content: body,
      path: `/docs/${slug}`,
    });
  }

  console.log(`Found ${pages.length} doc pages`);

  // In a real implementation, this would call Convex mutation
  // For now, we'll output the pages for verification
  if (process.env.DEBUG) {
    console.log(JSON.stringify(pages, null, 2));
  }

  // Output summary
  const sections = [...new Set(pages.map((p) => p.section))];
  console.log(`\nSections: ${sections.join(", ")}`);
  console.log(`\nPages per section:`);
  for (const section of sections) {
    const count = pages.filter((p) => p.section === section).length;
    console.log(`  ${section}: ${count}`);
  }

  // In production mode, would sync to Convex
  if (isProd) {
    console.log("\nProduction sync would update Convex database");
    // TODO: Add actual Convex sync using convex client
  } else {
    console.log("\nDevelopment mode - dry run complete");
  }
}

syncDocs().catch(console.error);
