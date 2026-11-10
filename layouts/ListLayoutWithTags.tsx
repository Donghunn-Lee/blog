'use client'

import { usePathname } from 'next/navigation'
import { formatDate } from 'pliny/utils/formatDate'
import { CoreContent } from 'pliny/utils/contentlayer'
import type { Blog } from 'contentlayer/generated'
import Link from '@/components/Link'
import Tag from '@/components/Tag'
import SeriesLine from '@/components/SeriesLine'
import siteMetadata from '@/data/siteMetadata'
import seriesData, { type SeriesLinks } from '@/data/seriesData'

interface PaginationProps {
  totalPages: number
  currentPage: number
}
interface ListLayoutProps {
  posts: CoreContent<Blog>[]
  title: string
  description?: string
  // Series pages only: "Live · GitHub" under the description
  links?: SeriesLinks
  initialDisplayPosts?: CoreContent<Blog>[]
  pagination?: PaginationProps
}

function Pagination({ totalPages, currentPage }: PaginationProps) {
  const pathname = usePathname()
  const segments = pathname.split('/')
  const lastSegment = segments[segments.length - 1]
  const basePath = pathname
    .replace(/^\//, '') // Remove leading slash
    .replace(/\/page\/\d+\/?$/, '') // Remove any trailing /page
    .replace(/\/$/, '') // Remove trailing slash
  const prevPage = currentPage - 1 > 0
  const nextPage = currentPage + 1 <= totalPages

  return (
    <div className="space-y-2 pt-6 pb-8 md:space-y-5">
      <nav className="flex justify-between">
        {!prevPage && (
          <button className="cursor-auto disabled:opacity-50" disabled={!prevPage}>
            이전
          </button>
        )}
        {prevPage && (
          <Link
            href={currentPage - 1 === 1 ? `/${basePath}/` : `/${basePath}/page/${currentPage - 1}`}
            rel="prev"
          >
            이전
          </Link>
        )}
        <span>
          {currentPage} / {totalPages}
        </span>
        {!nextPage && (
          <button className="cursor-auto disabled:opacity-50" disabled={!nextPage}>
            다음
          </button>
        )}
        {nextPage && (
          <Link href={`/${basePath}/page/${currentPage + 1}`} rel="next">
            다음
          </Link>
        )}
      </nav>
    </div>
  )
}

export default function ListLayoutWithTags({
  posts,
  title,
  description,
  links,
  initialDisplayPosts = [],
  pagination,
}: ListLayoutProps) {
  const pathname = usePathname()
  // /blog/, /blog/page/N/
  const isAllPosts = /^\/blog(\/page\/\d+)?\/?$/.test(pathname)
  // /blog/<series>/, /blog/<series>/page/N/
  const currentSeries = pathname.match(/^\/blog\/([^/]+)(\/page\/\d+)?\/?$/)?.[1]

  const displayPosts = initialDisplayPosts.length > 0 ? initialDisplayPosts : posts
  const externalLinks = [
    { title: 'Live', href: links?.live },
    { title: 'GitHub', href: links?.github },
  ].filter((link): link is { title: string; href: string } => !!link.href)
  // The sidebar is hidden below sm, so the same list runs as one scrollable row under the title
  const seriesNav = [
    { href: '/blog', title: '전체 글', current: isAllPosts },
    ...seriesData.map((s) => ({
      href: `/blog/${s.slug}`,
      title: s.title,
      current: currentSeries === s.slug,
    })),
  ]

  return (
    <>
      <div>
        <div className="pt-6 pb-6">
          <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 dark:text-gray-100">
            {title}
          </h1>
          {description && <p className="text-lg text-gray-500 dark:text-gray-400">{description}</p>}
          {externalLinks.length > 0 && (
            <p className="mt-2 flex gap-x-2 text-base font-medium">
              {externalLinks.map((link, i) => (
                <span key={link.title} className="flex gap-x-2">
                  {i > 0 && <span className="text-gray-400 dark:text-gray-500">·</span>}
                  <Link
                    href={link.href}
                    className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                  >
                    {link.title}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
        <ul className="no-scrollbar -mt-2 flex gap-x-4 overflow-x-auto pb-4 text-sm whitespace-nowrap sm:hidden">
          {seriesNav.map((item) => (
            <li key={item.href}>
              {item.current ? (
                <span className="text-primary-500 font-bold">{item.title}</span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-primary-500 dark:hover:text-primary-500 font-medium text-gray-500 dark:text-gray-300"
                >
                  {item.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div className="flex sm:space-x-12">
          <div className="hidden h-full max-h-screen max-w-[280px] min-w-[280px] flex-wrap overflow-auto rounded-sm bg-gray-50 pt-5 shadow-md sm:flex dark:bg-gray-900 dark:shadow-none">
            <div className="px-6 py-4">
              {isAllPosts ? (
                <h3 className="text-primary-500 font-bold">전체 글</h3>
              ) : (
                <Link
                  href={`/blog`}
                  className="hover:text-primary-500 dark:hover:text-primary-500 font-bold text-gray-700 dark:text-gray-300"
                >
                  전체 글
                </Link>
              )}
              <ul>
                {seriesData.map((s) => {
                  return (
                    <li key={s.slug} className="my-3">
                      {currentSeries === s.slug ? (
                        <h3 className="text-primary-500 inline px-3 py-2 text-sm font-bold">
                          {s.title}
                        </h3>
                      ) : (
                        <Link
                          href={`/blog/${s.slug}`}
                          className="hover:text-primary-500 dark:hover:text-primary-500 px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-300"
                          aria-label={`${s.title} 시리즈 글 보기`}
                        >
                          {s.title}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
          <div>
            <ul>
              {displayPosts.map((post) => {
                const { path, date, title, summary, tags } = post
                return (
                  <li key={path} className="py-5">
                    <article className="flex flex-col space-y-2 xl:space-y-0">
                      <dl>
                        <dt className="sr-only">작성일</dt>
                        <dd className="text-base leading-6 font-medium text-gray-500 dark:text-gray-400">
                          <time dateTime={date} suppressHydrationWarning>
                            {formatDate(date, siteMetadata.locale)}
                          </time>
                        </dd>
                      </dl>
                      <div className="space-y-3">
                        <div>
                          <SeriesLine post={post} onSeriesPage={!!currentSeries} />
                          <h2 className="text-2xl leading-8 font-bold tracking-tight">
                            <Link href={`/${path}`} className="text-gray-900 dark:text-gray-100">
                              {title}
                            </Link>
                          </h2>
                          {tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {tags.map((tag) => (
                                <Tag key={tag} text={tag} />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="prose max-w-none text-gray-500 dark:text-gray-400">
                          {summary}
                        </div>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
            {pagination && pagination.totalPages > 1 && (
              <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
