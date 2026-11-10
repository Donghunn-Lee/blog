import Link from './Link'
import { getSeriesLine } from '@/data/seriesData'

interface Props {
  post: { slug: string; series: string; category?: string }
}

export default function SeriesLine({ post }: Props) {
  const line = getSeriesLine(post)
  if (!line) return null

  return (
    <div className="text-sm leading-5 font-medium text-gray-500 dark:text-gray-400">
      <Link href={`/blog/${post.series}`} className="hover:text-primary-500">
        {line}
      </Link>
    </div>
  )
}
