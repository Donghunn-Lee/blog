import { sortPosts, allCoreContent } from 'pliny/utils/contentlayer'
import { allBlogs } from 'contentlayer/generated'
import seriesData from '@/data/seriesData'
import Main from './Main'

export default async function Page() {
  const sortedPosts = sortPosts(allBlogs)
  const posts = allCoreContent(sortedPosts)
  // allCoreContent drops drafts in production, so counts match the series pages
  const series = seriesData.map((s) => ({
    ...s,
    postCount: posts.filter((post) => post.series === s.slug).length,
  }))
  return <Main posts={posts} series={series} />
}
