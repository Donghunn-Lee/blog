import Link from 'next/link'
import { slug } from 'github-slugger'
interface Props {
  text: string
}

const Tag = ({ text }: Props) => {
  return (
    <Link
      href={`/tags/${slug(text)}`}
      className="bg-primary-50 text-primary-700 hover:bg-primary-100 border-primary-200 dark:border-primary-700/60 dark:bg-primary-900/50 dark:text-primary-200 dark:hover:bg-primary-900/70 inline-block rounded-md border px-2 py-0.5 text-xs font-medium"
    >
      {text.split(' ').join('-')}
    </Link>
  )
}

export default Tag
