import { ReactNode } from 'react'
import { CoreContent } from 'pliny/utils/contentlayer'
import type { Blog, Authors } from 'contentlayer/generated'
import Comments from '@/components/Comments'
import Link from '@/components/Link'
import PageTitle from '@/components/PageTitle'
import Tag from '@/components/Tag'
import siteMetadata from '@/data/siteMetadata'
import seriesData, { getPostNumber } from '@/data/seriesData'
import ScrollTopAndComment from '@/components/ScrollTopAndComment'
import SeriesLine from '@/components/SeriesLine'

const editUrl = (path) => `${siteMetadata.siteRepo}/blob/main/data/${path}`
const navTitle = ({ path, title }: { path: string; title: string }) => {
  const number = getPostNumber(path)
  return number ? `#${number} ${title}` : title
}

const postDateTemplate: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}

interface LayoutProps {
  content: CoreContent<Blog>
  authorDetails: CoreContent<Authors>[]
  next?: { path: string; title: string }
  prev?: { path: string; title: string }
  children: ReactNode
}

export default function PostLayout({ content, next, prev, children }: LayoutProps) {
  const { filePath, path, slug, date, title, tags, series } = content
  const basePath = path.split('/')[0]
  const seriesTitle = seriesData.find((s) => s.slug === series)?.title

  return (
    <>
      <ScrollTopAndComment />
      {/* One column at every width, so the header, body and footer share the same left edge */}
      <article className="mx-auto max-w-3xl">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          <header className="pt-6 pb-6">
            <div className="space-y-1 text-center">
              <dl className="space-y-10">
                <div>
                  <dt className="sr-only">작성일</dt>
                  <dd className="text-base leading-6 font-medium text-gray-500 dark:text-gray-400">
                    <time dateTime={date}>
                      {new Date(date).toLocaleDateString(siteMetadata.locale, postDateTemplate)}
                    </time>
                  </dd>
                </div>
              </dl>
              <div>
                <SeriesLine post={content} />
                <PageTitle>{title}</PageTitle>
                {tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {tags.map((tag) => (
                      <Tag key={tag} text={tag} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="prose prose-neutral dark:prose-invert max-w-none pt-10 pb-8">
            {children}
          </div>
          <div className="pt-6 pb-6 text-sm text-gray-700 dark:text-gray-300">
            <Link href={editUrl(filePath)}>GitHub에서 보기</Link>
          </div>
          {siteMetadata.comments && (
            <div className="pt-6 pb-6 text-center text-gray-700 dark:text-gray-300" id="comment">
              <Comments slug={slug} />
            </div>
          )}
          <footer className="pb-8 text-sm leading-5 font-medium">
            {(next || prev) && (
              <div className="grid grid-cols-2 gap-x-8 pt-6">
                {prev && prev.path && (
                  <div>
                    <h2 className="text-xs tracking-wide text-gray-500 dark:text-gray-400">
                      이전 글
                    </h2>
                    <div className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400">
                      <Link href={`/${prev.path}`}>{navTitle(prev)}</Link>
                    </div>
                  </div>
                )}
                {next && next.path && (
                  <div className="col-start-2 text-right">
                    <h2 className="text-xs tracking-wide text-gray-500 dark:text-gray-400">
                      다음 글
                    </h2>
                    <div className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400">
                      <Link href={`/${next.path}`}>{navTitle(next)}</Link>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="pt-6">
              <Link
                href={seriesTitle ? `/${basePath}/${series}` : `/${basePath}`}
                className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                aria-label={seriesTitle ? `${seriesTitle} 목록으로` : '목록으로'}
              >
                &larr; {seriesTitle || '목록으로'}
              </Link>
            </div>
          </footer>
        </div>
      </article>
    </>
  )
}
