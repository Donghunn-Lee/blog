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

export default seriesData
