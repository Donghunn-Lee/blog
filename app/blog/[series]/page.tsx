import { allCoreContent, sortPosts } from 'pliny/utils/contentlayer'
import ListLayout from '@/layouts/ListLayoutWithTags'
import { allBlogs } from 'contentlayer/generated'
import seriesData from '@/data/seriesData'
import { genPageMetadata } from 'app/seo'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

const POSTS_PER_PAGE = 5

export async function generateMetadata(props: {
  params: Promise<{ series: string }>
}): Promise<Metadata | undefined> {
  const params = await props.params
  const series = seriesData.find((s) => s.slug === params.series)
  if (!series) {
    return
  }
  return genPageMetadata({
    title: series.title,
    description: series.description || `${series.title} 시리즈`,
  })
}

export const generateStaticParams = async () => {
  return seriesData.map((s) => ({
    series: s.slug,
  }))
}

export default async function SeriesPage(props: { params: Promise<{ series: string }> }) {
  const params = await props.params
  const series = seriesData.find((s) => s.slug === params.series)
  if (!series) {
    return notFound()
  }
  // Oldest first, like a table of contents
  const filteredPosts = allCoreContent(
    sortPosts(allBlogs.filter((post) => post.series === series.slug))
  ).reverse()
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  const initialDisplayPosts = filteredPosts.slice(0, POSTS_PER_PAGE)
  const pagination = {
    currentPage: 1,
    totalPages: totalPages,
  }

  return (
    <ListLayout
      posts={filteredPosts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={pagination}
      title={series.title}
    />
  )
}
