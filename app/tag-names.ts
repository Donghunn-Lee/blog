import { slug } from 'github-slugger'
import { allBlogs } from 'contentlayer/generated'

// tag-data.json keys are slugs; map them back to the tag as written in posts ("nextjs" → "Next.js")
const tagNames = new Map(
  allBlogs.flatMap((post) => post.tags.map((tag) => [slug(tag), tag] as const))
)

export function getTagName(tagSlug: string) {
  return tagNames.get(tagSlug) ?? tagSlug
}
