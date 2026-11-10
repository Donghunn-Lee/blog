import Link from './Link'
import { getNumberLine, getSeriesLine } from '@/data/seriesData'

interface Props {
  post: { slug: string; series: string; category?: string }
  // On /blog/<series>/ the link would point to the current page, so show the number only
  onSeriesPage?: boolean
}

export default function SeriesLine({ post, onSeriesPage }: Props) {
  const line = onSeriesPage ? getNumberLine(post) : getSeriesLine(post)
  if (!line) return null

  return (
    <div className="text-sm leading-5 font-medium text-gray-500 dark:text-gray-400">
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
