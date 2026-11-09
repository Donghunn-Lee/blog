import { allCoreContent, sortPosts } from 'pliny/utils/contentlayer'
import ListLayout from '@/layouts/ListLayoutWithTags'
import { allBlogs } from 'contentlayer/generated'
import seriesData from '@/data/seriesData'
import { notFound } from 'next/navigation'

const POSTS_PER_PAGE = 5

export const generateStaticParams = async () => {
  return seriesData.flatMap((s) => {
    const postCount = allBlogs.filter((post) => post.series === s.slug).length
    const totalPages = Math.max(1, Math.ceil(postCount / POSTS_PER_PAGE))
    return Array.from({ length: totalPages }, (_, i) => ({
      series: s.slug,
      page: (i + 1).toString(),
    }))
  })
}

export default async function SeriesPage(props: {
  params: Promise<{ series: string; page: string }>
}) {
  const params = await props.params
  const series = seriesData.find((s) => s.slug === params.series)
  if (!series) {
    return notFound()
  }
  const pageNumber = parseInt(params.page)
  // Oldest first, like a table of contents
  const filteredPosts = allCoreContent(
    sortPosts(allBlogs.filter((post) => post.series === series.slug))
  ).reverse()
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)

  // Return 404 for invalid page numbers or empty pages
  if (pageNumber <= 0 || pageNumber > totalPages || isNaN(pageNumber)) {
    return notFound()
  }
  const initialDisplayPosts = filteredPosts.slice(
    POSTS_PER_PAGE * (pageNumber - 1),
    POSTS_PER_PAGE * pageNumber
  )
  const pagination = {
    currentPage: pageNumber,
    totalPages: totalPages,
  }

  return (
    <ListLayout
      posts={filteredPosts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={pagination}
      title={series.title}
      description={series.description}
    />
  )
}
