interface Series {
  slug: string
  title: string
  description?: string
}

const seriesData: Series[] = [
  { slug: 'slatekr', title: 'SlateKR', description: '국내 주식 정보 조회 웹 서비스' },
  { slug: 'aimtest', title: 'AimTest', description: '1인칭 에임 테스트 웹 게임' },
  { slug: 'coworkers', title: 'Coworkers' },
  { slug: 'fe-concepts', title: 'FE 개념 탐구' },
  { slug: 'javascript', title: 'JavaScript의 이해' },
  { slug: 'react', title: 'React의 이해' },
  { slug: 'browser', title: '브라우저와 웹 동작 원리의 이해' },
  { slug: 'toeic-speaking', title: '토익 스피킹 준비' },
]

export default seriesData
