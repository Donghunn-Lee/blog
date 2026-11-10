interface Series {
  slug: string
  title: string
  description?: string
}

const seriesData: Series[] = [
  { slug: 'slatekr', title: 'SlateKR', description: '국내 주식 정보 조회 웹 서비스' },
  { slug: 'aimtest', title: 'AimTest', description: '1인칭 에임 테스트 웹 게임' },
  { slug: 'coworkers', title: 'Coworkers', description: '업무 진행 상황을 시각화하는 협업 서비스' },
  {
    slug: 'fe-concepts',
    title: 'FE 개념 탐구',
    description: 'FE 개발자로서 알아야 할, 알면 좋은 정보들',
  },
]

interface PostRef {
  slug: string
  series: string
  category?: string
}

// Number comes from the file name (slatekr/192, slatekr/188-2); slug-named posts have none
export function getPostNumber(slug: string) {
  const name = slug.split('/').pop() ?? ''
  return /^\d+(-\d+)?$/.test(name) ? name : undefined
}

// Line above the title, registered series only: "SlateKR #192", "FE 개념 탐구 #001 · JavaScript", "Coworkers"
export function getSeriesLine({ slug, series, category }: PostRef) {
  const seriesTitle = seriesData.find((s) => s.slug === series)?.title
  if (!seriesTitle) return
  const number = getPostNumber(slug)
  const line = number ? `${seriesTitle} #${number}` : seriesTitle
  return category ? `${line} · ${category}` : line
}

// Tab and OG title keep the prefix the title used to carry: "[SlateKR #192] 제목", "[JavaScript] 제목 — FE 개념 탐구 #001"
export function getFullTitle({ slug, series, category, title }: PostRef & { title: string }) {
  const seriesTitle = seriesData.find((s) => s.slug === series)?.title
  const number = getPostNumber(slug)
  if (!seriesTitle || !number) return title
  return category
    ? `[${category}] ${title} — ${seriesTitle} #${number}`
    : `[${seriesTitle} #${number}] ${title}`
}

export default seriesData
