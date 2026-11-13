import Link from '@/components/Link'
import Tag from '@/components/Tag'
import SeriesLine from '@/components/SeriesLine'
import siteMetadata from '@/data/siteMetadata'
import { formatDate } from 'pliny/utils/formatDate'

const MAX_DISPLAY = 5

export default function Home({ posts, series }) {
  return (
    <>
      <div className="pt-6 pb-10">
        <h1 className="sr-only">{siteMetadata.title}</h1>
        <p className="text-lg leading-7 text-gray-500 dark:text-gray-400">
          프론트엔드 개발자{' '}
          <strong className="font-bold text-gray-900 dark:text-gray-100">이동훈</strong>의 개발
          기록입니다.
        </p>
      </div>
      <section className="pb-12">
        <h2 className="text-2xl leading-8 font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Series
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {series.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/blog/${s.slug}`}
                className="hover:border-primary-500 dark:hover:border-primary-400 block h-full rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">{s.title}</h3>
                  <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
                    {s.postCount}편
                  </span>
                </div>
                {s.description && (
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{s.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-2xl leading-8 font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Latest
        </h2>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {!posts.length && '아직 글이 없습니다.'}
          {posts.slice(0, MAX_DISPLAY).map((post) => {
            const { slug, date, title, summary, tags } = post
            return (
              <li key={slug} className="py-12">
                <article>
                  <div className="space-y-3 xl:grid xl:grid-cols-4 xl:items-baseline xl:space-y-0">
                    <dl>
                      <dt className="sr-only">작성일</dt>
                      <dd className="text-base leading-6 font-medium text-gray-500 dark:text-gray-400">
                        <time dateTime={date}>{formatDate(date, siteMetadata.locale)}</time>
                      </dd>
                    </dl>
                    <div className="space-y-5 xl:col-span-3">
                      <div className="space-y-3.5">
                        <div>
                          <SeriesLine post={post} />
                          <h3 className="text-2xl leading-8 font-bold tracking-tight">
                            <Link
                              href={`/blog/${slug}`}
                              className="text-gray-900 dark:text-gray-100"
                            >
                              {title}
                            </Link>
                          </h3>
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
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
        {posts.length > MAX_DISPLAY && (
          <div className="flex justify-end text-base leading-6 font-medium">
            <Link
              href="/blog"
              className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
              aria-label="전체 글"
            >
              전체 글 &rarr;
            </Link>
          </div>
        )}
      </section>
    </>
  )
}
