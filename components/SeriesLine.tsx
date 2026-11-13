import Link from './Link'
import { getNumberLine, getSeriesLine } from '@/data/seriesData'

interface Props {
  post: { slug: string; series: string; category?: string }
  // On /blog/<series>/ the link would point to the current page, so show the number only
  onSeriesPage?: boolean
  // Post header: grows with the page title, at about the midpoint
  large?: boolean
}

export default function SeriesLine({ post, onSeriesPage, large }: Props) {
  const text = onSeriesPage ? getNumberLine(post) : getSeriesLine(post)
  if (!text) return null
  const line = `[${text}]`
  const size = large
    ? 'text-xl leading-7 sm:text-2xl sm:leading-8 md:text-3xl md:leading-9'
    : 'text-base leading-6'

  return (
    <div className={`${size} font-semibold text-gray-900 dark:text-gray-100`}>
      {onSeriesPage ? (
        line
      ) : (
        <Link href={`/blog/${post.series}`} className="hover:text-primary-500">
          {line}
        </Link>
      )}
    </div>
  )
}
