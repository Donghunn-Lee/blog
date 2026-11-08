/**
 * velog 백업(markdown) → 템플릿 블로그 MDX 변환 스크립트
 *
 * 실행: yarn tsx scripts/migrate-velog.ts
 * 입력: ../velog-archive/backup/content/*.md, ../velog-archive/backup/images/* (읽기만)
 * 출력: data/blog/<series-folder>/<n>.mdx, public/static/images/velog/<file>
 * 멱등: 실행할 때마다 출력 폴더를 비우고 다시 쓴다.
 */
import fs from 'fs'
import path from 'path'
import { slug as githubSlug } from 'github-slugger'

const ROOT = path.resolve(__dirname, '..')
const SRC_CONTENT_DIR = path.resolve(ROOT, '..', 'velog-archive', 'backup', 'content')
const SRC_IMAGE_DIR = path.resolve(ROOT, '..', 'velog-archive', 'backup', 'images')
const OUT_BLOG_DIR = path.join(ROOT, 'data', 'blog')
const OUT_IMAGE_DIR = path.join(ROOT, 'public', 'static', 'images', 'velog')
const SRC_IMAGE_URL_PREFIX = '/images/'
const OUT_IMAGE_URL_PREFIX = '/static/images/velog/'
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
/** U+00A0 non-breaking space (velog 내보내기의 series.name에 섞여 있음) */
const NBSP = String.fromCharCode(0xa0)

export interface SeriesRule {
  /** velog series.name (null = 시리즈 없음) */
  name: string | null
  folder: string
  tag: string | null
  expected: number
}

export const SERIES_RULES: readonly SeriesRule[] = [
  {
    name: 'SlateKR - 국내 주식 정보 조회 웹 서비스',
    folder: 'slatekr',
    tag: 'SlateKR',
    expected: 192,
  },
  { name: 'FE 개념 탐구', folder: 'fe-concepts', tag: 'FE 개념 탐구', expected: 43 },
  {
    name: 'FPS Aim Test - 1인칭 에임 테스트 웹 게임',
    folder: 'aimtest',
    tag: 'AimTest',
    expected: 26,
  },
  { name: 'JavaScript의 이해', folder: 'javascript', tag: 'JavaScript의 이해', expected: 7 },
  { name: 'Coworkers', folder: 'coworkers', tag: 'Coworkers', expected: 5 },
  { name: '브라우저와 웹 동작 원리의 이해', folder: 'browser', tag: '브라우저', expected: 4 },
  { name: 'React의 이해', folder: 'react', tag: 'React의 이해', expected: 4 },
  { name: '토익 스피킹 준비', folder: 'toeic-speaking', tag: '토익 스피킹', expected: 4 },
  { name: null, folder: 'etc', tag: null, expected: 2 },
]

/** 규칙 9. slug 일치·시리즈 번호로 못 찾는 옛 velog slug → 새 블로그 경로 */
export const LEGACY_SLUG_MAP: ReadonlyMap<string, string> = new Map([
  ['600줄의-God-Component-해체-책임-분리와-Hub-패턴', '/blog/aimtest/14/'],
  // AimTest #02의 옛 slug
  ['맵-구현', '/blog/aimtest/02/'],
])

// ---------------------------------------------------------------------------
// 입력 frontmatter 파싱 (라인 단위 regex — YAML 라이브러리 사용 안 함)
// ---------------------------------------------------------------------------

export interface VelogPost {
  sourceFile: string
  title: string
  slug: string
  description: string
  date: string
  lastmod: string
  tags: string[]
  thumbnail: string | null
  seriesName: string | null
  body: string
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && (value as unknown[]).every((item) => typeof item === 'string')
}

export function parseVelogMarkdown(sourceFile: string, raw: string): VelogPost {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  if (lines[0] !== '---') throw new Error(`${sourceFile}: frontmatter 시작 '---' 없음`)
  const end = lines.indexOf('---', 1)
  if (end === -1) throw new Error(`${sourceFile}: frontmatter 종료 '---' 없음`)
  const fm = lines.slice(1, end)
  const body = lines.slice(end + 1).join('\n')

  const pick = (re: RegExp): string | null => {
    for (const line of fm) {
      const m = re.exec(line)
      if (m) return m[1]
    }
    return null
  }

  const title = pick(/^title: "(.*)"$/)
  const date = pick(/^date: (\S+)$/)
  const lastmod = pick(/^lastmod: (\S+)$/)
  const slug = pick(/^slug: (\S+)$/)
  const tagsRaw = pick(/^tags: (.*)$/)
  if (title === null || date === null || lastmod === null || slug === null || tagsRaw === null) {
    throw new Error(`${sourceFile}: title/date/lastmod/slug/tags 중 누락`)
  }
  const tags: unknown = JSON.parse(tagsRaw)
  if (!isStringArray(tags)) throw new Error(`${sourceFile}: tags가 문자열 배열이 아님`)

  return {
    sourceFile,
    title,
    slug,
    description: pick(/^description: "(.*)"$/) ?? '',
    date,
    lastmod,
    tags,
    thumbnail: pick(/^thumbnail: (\S+)$/),
    // velog 내보내기의 series.name에 NBSP(U+00A0)가 섞여 있어 일반 공백으로 정규화
    seriesName:
      pick(/^ {2}name: (.*)$/)
        ?.split(NBSP)
        .join(' ') ?? null,
    body,
  }
}

// ---------------------------------------------------------------------------
// 출력 frontmatter 값
// ---------------------------------------------------------------------------

/** ISO 문자열 → KST 기준 YYYY-MM-DD */
export function toKstDateString(iso: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`잘못된 날짜: ${iso}`)
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * 규칙 8. 같은 KST 날짜 안에서 released_at(velog date) 오름차순 순번(0부터)을 매긴다.
 * 템플릿은 date로만 정렬하고 같은 값이면 파일 순서를 유지하므로, 순번을 초 자리에 넣어 순서를 고정한다.
 * 반환: sourceFile → 순번
 */
export function assignDateSequence(posts: readonly VelogPost[]): Map<string, number> {
  const byDay = new Map<string, VelogPost[]>()
  for (const post of posts) {
    const day = toKstDateString(post.date)
    const group = byDay.get(day)
    if (group) group.push(post)
    else byDay.set(day, [post])
  }
  const seq = new Map<string, number>()
  for (const [day, group] of byDay) {
    group.sort((a, b) => {
      const diff = Date.parse(a.date) - Date.parse(b.date)
      if (diff !== 0) return diff
      return a.sourceFile < b.sourceFile ? -1 : a.sourceFile > b.sourceFile ? 1 : 0
    })
    if (group.length > 60) {
      throw new Error(`${day}: 같은 날 글이 ${group.length}편이라 초 단위 순번(00~59)을 넘음`)
    }
    group.forEach((post, index) => seq.set(post.sourceFile, index))
  }
  return seq
}

/** 규칙 8. `YYYY-MM-DDT00:00:SSZ` — UTC·KST 어디서 빌드해도 같은 날짜가 찍히고, SS(순번)만 정렬에 쓰인다 */
export function toDateStamp(kstDate: string, sequence: number): string {
  return `${kstDate}T00:00:${String(sequence).padStart(2, '0')}Z`
}

/** 규칙 7. velog description에 노출되는 마크다운 백슬래시 이스케이프(`\[` 등) 제거 */
export function cleanDescription(description: string): string {
  return description.replace(DESCRIPTION_ESCAPE_RE, '$1')
}

export function seriesRuleOf(post: VelogPost): SeriesRule {
  const rule = SERIES_RULES.find((r) => r.name === post.seriesName)
  if (!rule) {
    throw new Error(
      `표에 없는 series.name: ${JSON.stringify(post.seriesName)} (${post.sourceFile})`
    )
  }
  return rule
}

/** 파일명: 제목의 `#N`(`#N-M`) → N, 없으면 제목 슬러그(소문자 · 공백→- · 기호 제거 · 한글 유지) */
export function postFileStem(title: string): string {
  const numbered = /#(\d+(?:-\d+)?)/.exec(title)
  if (numbered) return numbered[1]
  const slugged = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣ㄱ-ㆎ\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
  if (!slugged) throw new Error(`제목에서 파일명을 만들 수 없음: ${title}`)
  return slugged
}

/** velog 태그 + 시리즈 태그. 템플릿의 태그 식별 기준(github-slugger slug)으로 중복 제거, 표기는 시리즈 표의 것으로 통일 */
export function buildTags(velogTags: string[], seriesTag: string | null): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  const seriesKey = seriesTag === null ? null : githubSlug(seriesTag)
  for (const tag of velogTags) {
    const key = githubSlug(tag)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(seriesTag !== null && key === seriesKey ? seriesTag : tag)
  }
  if (seriesTag !== null && seriesKey !== null && !seen.has(seriesKey)) result.push(seriesTag)
  return result
}

// ---------------------------------------------------------------------------
// 규칙 9. velog 내부 링크 → 새 블로그 경로
// ---------------------------------------------------------------------------

/** `https://velog.io/@dh82680<path>`. 링크 대상 맨 앞에 붙은 `#`(`](#https://…)`, velog에서도 깨진 앵커)도 함께 치환 */
const VELOG_LINK_RE =
  /(?:(?<=\]\()#)?https:\/\/velog\.io\/@dh82680(\/[^\s)"'<>\]]*)?(?=[\s)"'<>\]]|$)/g
/** 위 패턴에 안 맞는 같은 주소(`ttps://` 같은 스킴 오타 등) — 치환하지 않고 보고만 */
const VELOG_STRAY_RE = /[A-Za-z]*:?\/*velog\.io\/@dh82680[^\s)"'<>\]]*/g
const FE_CONCEPTS_SLUG_RE = /FE-개념-탐구-(\d{3})/
const SLATEKR_SLUG_RE = /^SlateKR-(\d{3})/
const AIMTEST_SLUG_RE = /^AimTest-(\d{2})/

/** 적용 순서대로, 요약 출력 표기 */
const VELOG_LINK_KINDS = [
  ['posts', '/posts'],
  ['home', '홈'],
  ['slug', 'slug 일치'],
  ['fe-concepts', 'FE 개념 탐구 번호'],
  ['slatekr', 'SlateKR 번호'],
  ['aimtest', 'AimTest 번호'],
  ['legacy', 'LEGACY_SLUG_MAP'],
] as const

export type VelogLinkKind = (typeof VELOG_LINK_KINDS)[number][0]

/** kind가 null이면 원본 유지 */
export type VelogLinkResolution =
  | { kind: VelogLinkKind; to: string }
  | { kind: null; reason: string }

export type VelogLinkRef = { sourceFile: string; url: string } & VelogLinkResolution

export interface VelogLinkIndex {
  /** 백업 frontmatter slug → 출력 경로 `/blog/<folder>/<n>/` */
  bySlug: ReadonlyMap<string, string>
  /** 이번 실행에서 생성하는 mdx의 출력 경로 */
  outputPaths: ReadonlySet<string>
}

export function buildVelogLinkIndex(posts: readonly VelogPost[]): VelogLinkIndex {
  const bySlug = new Map<string, string>()
  const outputPaths = new Set<string>()
  for (const post of posts) {
    const outputPath = `/blog/${seriesRuleOf(post).folder}/${postFileStem(post.title)}/`
    bySlug.set(post.slug, outputPath)
    outputPaths.add(outputPath)
  }
  return { bySlug, outputPaths }
}

function tryDecodeURIComponent(text: string): string | null {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}

/** 규칙 9 표를 위에서부터 적용. 글 경로가 나오면 그 mdx가 생성되는지까지 확인 */
export function resolveVelogPath(urlPath: string, index: VelogLinkIndex): VelogLinkResolution {
  const decoded = tryDecodeURIComponent(urlPath)
  if (decoded === null) return { kind: null, reason: '퍼센트 인코딩 해석 실패' }
  if (decoded === '/posts') return { kind: 'posts', to: '/blog/' }
  if (decoded === '' || decoded === '/') return { kind: 'home', to: '/' }

  const toPost = (kind: VelogLinkKind, to: string): VelogLinkResolution =>
    index.outputPaths.has(to) ? { kind, to } : { kind: null, reason: `생성된 mdx 없음 ${to}` }
  const slug = decoded.slice(1)
  const bySlug = index.bySlug.get(slug)
  if (bySlug !== undefined) return toPost('slug', bySlug)
  const fe = FE_CONCEPTS_SLUG_RE.exec(slug)
  if (fe) return toPost('fe-concepts', `/blog/fe-concepts/${fe[1]}/`)
  const slatekr = SLATEKR_SLUG_RE.exec(slug)
  if (slatekr) return toPost('slatekr', `/blog/slatekr/${slatekr[1]}/`)
  const aimtest = AIMTEST_SLUG_RE.exec(slug)
  if (aimtest) return toPost('aimtest', `/blog/aimtest/${aimtest[1]}/`)
  const legacy = LEGACY_SLUG_MAP.get(slug)
  if (legacy !== undefined) return toPost('legacy', legacy)
  return { kind: null, reason: '맞는 규칙 없음' }
}

interface LinkContext {
  sourceFile: string
  linkIndex: VelogLinkIndex
  links: VelogLinkRef[]
}

/** prose 조각의 velog 내부 링크 치환. 못 푼 링크와 패턴 밖 주소는 그대로 두고 ctx.links에 남긴다 */
function rewriteVelogLinks(text: string, ctx: LinkContext): string {
  const rewritten = text.replace(VELOG_LINK_RE, (url: string, urlPath: string | undefined) => {
    const resolved = resolveVelogPath(urlPath ?? '', ctx.linkIndex)
    ctx.links.push({ sourceFile: ctx.sourceFile, url, ...resolved })
    return resolved.kind === null ? url : resolved.to
  })
  for (const m of text.replace(VELOG_LINK_RE, '').matchAll(VELOG_STRAY_RE)) {
    ctx.links.push({ sourceFile: ctx.sourceFile, url: m[0], kind: null, reason: '패턴 밖 주소' })
  }
  return rewritten
}

/** description: 인라인 코드 밖에만 규칙 9 적용 */
function rewriteDescriptionLinks(description: string, ctx: LinkContext): string {
  let out = ''
  let last = 0
  for (const m of description.matchAll(INLINE_CODE_RE)) {
    out += rewriteVelogLinks(description.slice(last, m.index), ctx) + m[0]
    last = m.index + m[0].length
  }
  return out + rewriteVelogLinks(description.slice(last), ctx)
}

// ---------------------------------------------------------------------------
// 본문 변환
// ---------------------------------------------------------------------------

export interface RemovedImageRef {
  sourceFile: string
  kind: 'markdown' | 'html' | 'thumbnail'
  file: string
}

export interface BodyTransformResult {
  body: string
  /** 복사해야 할 원본 이미지 파일명 */
  imageFiles: Set<string>
  removed: RemovedImageRef[]
  /** 규칙 6으로 이스케이프한 `$` 개수 */
  dollarCount: number
  /** 규칙 9로 만난 velog 내부 링크 (치환 + 원본 유지) */
  links: VelogLinkRef[]
}

interface TransformContext extends LinkContext {
  imageExists: (file: string) => boolean
  imageFiles: Set<string>
  removed: RemovedImageRef[]
  dollarCount: number
}

const ALLOWED_HTML_TAG_PATTERN = 'img|div|span|br|p'
/** 코드 펜스(``` / ~~~, 인용 `>` 접두·들여쓰기 3칸까지 허용) */
const FENCE_RE = /^((?:>[ \t]?)*) {0,3}(`{3,}|~{3,})(.*)$/
/** 인라인 코드: 같은 길이의 백틱 런으로 열고 닫음 */
const INLINE_CODE_RE = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g
const HTML_IMG_TAG_RE = /<img\b[^>]*>/g
const HTML_IMG_SRC_RE = /\ssrc="([^"]*)"/
const BRACE_RE = /[{}]/g
const UNSAFE_LT_RE = new RegExp(`<(?=\\S)(?!\\/?(?:${ALLOWED_HTML_TAG_PATTERN})\\b)`, 'g')
const IMG_CLOSE_RE = /<img\b([^>]*?)\s*\/?>/g
const BR_CLOSE_RE = /<br\s*\/?>/g
const STYLE_ATTR_RE = /style="([^"]*)"/g
/** 규칙 6. remark-math가 `$…$`를 수식으로 잡으므로 prose의 `$`는 전부 이스케이프 (이 블로그에 수식은 없음) */
const DOLLAR_RE = /\$/g
/** 규칙 7. description의 `\` + `[ ] * _ # ~ > |` */
const DESCRIPTION_ESCAPE_RE = /\\([[\]*_#~>|])/g

/** `a: b; c-d: e` → `{{a: 'b', cD: 'e'}}` */
export function cssToJsxStyle(css: string): string {
  const entries = css
    .split(';')
    .map((decl) => decl.trim())
    .filter((decl) => decl.length > 0)
    .map((decl) => {
      const idx = decl.indexOf(':')
      if (idx === -1) throw new Error(`style 선언 파싱 실패: "${decl}"`)
      const prop = decl
        .slice(0, idx)
        .trim()
        .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
      const value = decl
        .slice(idx + 1)
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
      return `${prop}: '${value}'`
    })
  return `{{${entries.join(', ')}}}`
}

type ImageMapping =
  | { kind: 'ok'; url: string }
  | { kind: 'missing'; file: string }
  | { kind: 'external' }

function mapImageUrl(url: string, ctx: TransformContext): ImageMapping {
  if (!url.startsWith(SRC_IMAGE_URL_PREFIX)) return { kind: 'external' }
  const file = url.slice(SRC_IMAGE_URL_PREFIX.length)
  if (!ctx.imageExists(file)) return { kind: 'missing', file }
  ctx.imageFiles.add(file)
  return { kind: 'ok', url: OUT_IMAGE_URL_PREFIX + file }
}

/** prose 조각(코드 밖)에 규칙 1~5를 순서대로 적용 */
function transformProseChunk(
  chunk: string,
  ctx: TransformContext
): { text: string; removedRef: boolean } {
  let removedRef = false
  let text = chunk

  // 1. 이미지 경로 치환 / 없는 파일 참조 제거
  text = text.replace(MD_IMAGE_RE, (whole, alt: string, url: string, titlePart: string) => {
    const mapped = mapImageUrl(url, ctx)
    if (mapped.kind === 'external') return whole
    if (mapped.kind === 'missing') {
      removedRef = true
      ctx.removed.push({ sourceFile: ctx.sourceFile, kind: 'markdown', file: mapped.file })
      return ''
    }
    return `![${alt}](${mapped.url}${titlePart})`
  })
  text = text.replace(HTML_IMG_TAG_RE, (tag) => {
    const src = HTML_IMG_SRC_RE.exec(tag)
    if (!src) return tag
    const mapped = mapImageUrl(src[1], ctx)
    if (mapped.kind === 'external') return tag
    if (mapped.kind === 'missing') {
      removedRef = true
      ctx.removed.push({ sourceFile: ctx.sourceFile, kind: 'html', file: mapped.file })
      return ''
    }
    return tag.replace(src[1], mapped.url)
  })

  // 2. 중괄호 이스케이프
  text = text.replace(BRACE_RE, (c) => `\\${c}`)

  // 3. 허용 태그가 아닌 `<`(공백 아닌 문자가 뒤따름) 이스케이프
  text = text.replace(UNSAFE_LT_RE, '\\<')

  // 4. 닫히지 않은 <img> / <br>
  text = text.replace(IMG_CLOSE_RE, (_m, attrs: string) => `<img${attrs} />`)
  text = text.replace(BR_CLOSE_RE, '<br />')

  // 5. style 문자열 → JSX 객체
  text = text.replace(STYLE_ATTR_RE, (_m, css: string) => `style=${cssToJsxStyle(css)}`)

  // 6. `$` 이스케이프
  text = text.replace(DOLLAR_RE, () => {
    ctx.dollarCount += 1
    return '\\$'
  })

  // 9. velog 내부 링크 → 새 블로그 경로
  text = rewriteVelogLinks(text, ctx)

  return { text, removedRef }
}

/** prose 라인: 인라인 코드는 그대로, 그 밖에만 변환. 이미지 참조 제거로 빈 줄이 되면 null(라인 삭제) */
function transformProseLine(line: string, ctx: TransformContext): string | null {
  let out = ''
  let removedRef = false
  let last = 0
  INLINE_CODE_RE.lastIndex = 0
  let m = INLINE_CODE_RE.exec(line)
  while (m !== null) {
    const prose = transformProseChunk(line.slice(last, m.index), ctx)
    removedRef = removedRef || prose.removedRef
    out += prose.text + m[0]
    last = m.index + m[0].length
    m = INLINE_CODE_RE.exec(line)
  }
  const tail = transformProseChunk(line.slice(last), ctx)
  removedRef = removedRef || tail.removedRef
  out += tail.text
  if (removedRef && out.trim() === '') return null
  return out
}

interface OpenFence {
  marker: string
  length: number
  quoteDepth: number
}

function countQuoteDepth(prefix: string): number {
  return (prefix.match(/>/g) ?? []).length
}

export function transformBody(
  body: string,
  sourceFile: string,
  imageExists: (file: string) => boolean,
  linkIndex: VelogLinkIndex
): BodyTransformResult {
  const ctx: TransformContext = {
    sourceFile,
    linkIndex,
    links: [],
    imageExists,
    imageFiles: new Set(),
    removed: [],
    dollarCount: 0,
  }
  const out: string[] = []
  let fence: OpenFence | null = null

  for (const line of body.split('\n')) {
    if (fence !== null) {
      const quotePrefix = /^(?:>[ \t]?)*/.exec(line)
      const depth = countQuoteDepth(quotePrefix ? quotePrefix[0] : '')
      if (depth >= fence.quoteDepth) {
        // 코드 블록 안: 그대로 통과, 닫는 펜스만 감지
        out.push(line)
        const close = FENCE_RE.exec(line)
        if (
          close &&
          close[2][0] === fence.marker &&
          close[2].length >= fence.length &&
          close[3].trim() === ''
        ) {
          fence = null
        }
        continue
      }
      // 인용(>) 밖으로 나오면 인용 안에서 열린 펜스는 닫힌 것으로 본다 (CommonMark)
      fence = null
    }

    const open = FENCE_RE.exec(line)
    if (open) {
      fence = { marker: open[2][0], length: open[2].length, quoteDepth: countQuoteDepth(open[1]) }
      out.push(line)
      continue
    }

    const transformed = transformProseLine(line, ctx)
    if (transformed !== null) out.push(transformed)
  }

  return {
    body: out.join('\n'),
    imageFiles: ctx.imageFiles,
    removed: ctx.removed,
    dollarCount: ctx.dollarCount,
    links: ctx.links,
  }
}

// ---------------------------------------------------------------------------
// 글 단위 변환
// ---------------------------------------------------------------------------

export interface ConvertedPost {
  sourceFile: string
  folder: string
  stem: string
  content: string
  imageFiles: Set<string>
  removed: RemovedImageRef[]
  /** 보고용: 규칙 9로 만난 velog 내부 링크 (본문 + description) */
  links: VelogLinkRef[]
  /** 보고용: 규칙 6(`$` 이스케이프)·7(description 백슬래시 제거) 적용 여부 */
  applied: { dollar: boolean; description: boolean }
}

export function convertPost(
  post: VelogPost,
  imageExists: (file: string) => boolean,
  dateSequence: number,
  linkIndex: VelogLinkIndex
): ConvertedPost {
  const rule = seriesRuleOf(post)

  const transformed = transformBody(post.body, post.sourceFile, imageExists, linkIndex)
  const imageFiles = new Set(transformed.imageFiles)
  const removed = [...transformed.removed]
  const links = [...transformed.links]

  const date = toKstDateString(post.date)
  const lastmod = toKstDateString(post.lastmod)
  const tags = buildTags(post.tags, rule.tag)
  const description = cleanDescription(post.description)
  const summary = rewriteDescriptionLinks(description, {
    sourceFile: post.sourceFile,
    linkIndex,
    links,
  })

  let images: string[] | null = null
  if (post.thumbnail !== null && post.thumbnail.startsWith(SRC_IMAGE_URL_PREFIX)) {
    const file = post.thumbnail.slice(SRC_IMAGE_URL_PREFIX.length)
    if (imageExists(file)) {
      images = [OUT_IMAGE_URL_PREFIX + file]
      imageFiles.add(file)
    } else {
      removed.push({ sourceFile: post.sourceFile, kind: 'thumbnail', file })
    }
  }

  const fm: string[] = [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `date: ${toDateStamp(date, dateSequence)}`,
  ]
  if (lastmod !== date) fm.push(`lastmod: ${lastmod}`)
  if (summary !== '') fm.push(`summary: ${JSON.stringify(summary)}`)
  fm.push(`tags: ${JSON.stringify(tags)}`)
  if (images !== null) fm.push(`images: ${JSON.stringify(images)}`)
  fm.push('draft: false', '---')

  const body = transformed.body.replace(/^\n+/, '').replace(/\s+$/, '')
  const content = `${fm.join('\n')}\n\n${body}\n`

  return {
    sourceFile: post.sourceFile,
    folder: rule.folder,
    stem: postFileStem(post.title),
    content,
    imageFiles,
    removed,
    links,
    applied: { dollar: transformed.dollarCount > 0, description: description !== post.description },
  }
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------

export function migrate(): void {
  const sourceFiles = fs
    .readdirSync(SRC_CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
  const imageExists = (file: string): boolean => {
    const p = path.join(SRC_IMAGE_DIR, file)
    return fs.existsSync(p) && fs.statSync(p).size > 0
  }

  // 1) 전부 메모리에서 변환·검증 (충돌/미지의 시리즈면 아무것도 쓰지 않고 중단)
  const posts = sourceFiles.map((file) =>
    parseVelogMarkdown(file, fs.readFileSync(path.join(SRC_CONTENT_DIR, file), 'utf8'))
  )
  const dateSequence = assignDateSequence(posts)
  const linkIndex = buildVelogLinkIndex(posts)
  const converted: ConvertedPost[] = []
  const seen = new Map<string, string>() // "folder/stem" → sourceFile
  const collisions: string[] = []
  for (const source of posts) {
    const sequence = dateSequence.get(source.sourceFile)
    if (sequence === undefined) throw new Error(`${source.sourceFile}: 날짜 순번 없음`)
    const post = convertPost(source, imageExists, sequence, linkIndex)
    const key = `${post.folder}/${post.stem}`
    const prev = seen.get(key)
    if (prev !== undefined) collisions.push(`${key}.mdx ← "${prev}" / "${source.sourceFile}"`)
    seen.set(key, source.sourceFile)
    converted.push(post)
  }
  if (collisions.length > 0) {
    throw new Error(`파일명 충돌 ${collisions.length}건:\n  ${collisions.join('\n  ')}`)
  }

  // 2) 출력 비우기 (멱등)
  for (const rule of SERIES_RULES) {
    fs.rmSync(path.join(OUT_BLOG_DIR, rule.folder), { recursive: true, force: true })
  }
  fs.rmSync(OUT_IMAGE_DIR, { recursive: true, force: true })

  // 3) 쓰기
  const allImages = new Set<string>()
  for (const post of converted) {
    const dir = path.join(OUT_BLOG_DIR, post.folder)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${post.stem}.mdx`), post.content, 'utf8')
    post.imageFiles.forEach((f) => allImages.add(f))
  }
  fs.mkdirSync(OUT_IMAGE_DIR, { recursive: true })
  for (const file of allImages) {
    fs.copyFileSync(path.join(SRC_IMAGE_DIR, file), path.join(OUT_IMAGE_DIR, file))
  }

  // 4) 요약
  const removed = converted.flatMap((p) => p.removed)
  console.log(`변환: ${converted.length}편 (입력 ${sourceFiles.length}편)`)
  console.log('시리즈별 (생성/예상):')
  for (const rule of SERIES_RULES) {
    const n = converted.filter((p) => p.folder === rule.folder).length
    console.log(`  ${rule.folder}: ${n}/${rule.expected}${n === rule.expected ? '' : '  ← 불일치'}`)
  }
  console.log(`이미지 복사: ${allImages.size}개 → public/static/images/velog/`)
  console.log(`제거된 이미지 참조: ${removed.length}건`)
  for (const r of removed) console.log(`  [${r.kind}] ${r.sourceFile} → ${r.file}`)
  console.log('파일명 충돌: 없음')
  const dayGroups = new Map<string, number>()
  for (const post of posts) {
    const day = toKstDateString(post.date)
    dayGroups.set(day, (dayGroups.get(day) ?? 0) + 1)
  }
  const multiDays = [...dayGroups.values()].filter((n) => n > 1)
  console.log(`규칙 6 ($ 이스케이프) 적용: ${converted.filter((p) => p.applied.dollar).length}편`)
  console.log(
    `규칙 7 (description 백슬래시 제거) 적용: ${converted.filter((p) => p.applied.description).length}편`
  )
  console.log(
    `규칙 8 (date 순번) 적용: ${converted.length}편 — 같은 날 그룹 ${multiDays.length}개(${multiDays.reduce((a, b) => a + b, 0)}편), 최대 ${Math.max(0, ...multiDays)}편/일`
  )
  const linkCounts = new Map<VelogLinkKind, number>()
  const linkPosts = new Set<string>()
  const keptLinks: string[] = []
  let anchorLinks = 0
  for (const link of converted.flatMap((p) => p.links)) {
    if (link.kind === null) {
      const url = tryDecodeURIComponent(link.url) ?? link.url
      keptLinks.push(`  [${link.reason}] ${link.sourceFile} → ${url}`)
      continue
    }
    linkCounts.set(link.kind, (linkCounts.get(link.kind) ?? 0) + 1)
    linkPosts.add(link.sourceFile)
    if (link.url.startsWith('#')) anchorLinks += 1
  }
  const linkTotal = [...linkCounts.values()].reduce((a, b) => a + b, 0)
  const byKind = VELOG_LINK_KINDS.map(([kind, label]) => `${label} ${linkCounts.get(kind) ?? 0}`)
  console.log(
    `규칙 9 (velog 내부 링크) 치환: ${linkTotal}건 / ${linkPosts.size}편 — ${byKind.join(', ')}` +
      (anchorLinks > 0 ? ` (\`](#https://…)\` 앵커 접두 포함 ${anchorLinks}건)` : '')
  )
  console.log(`규칙 9 원본 유지: ${keptLinks.length}건`)
  for (const line of keptLinks) console.log(line)
}

if (require.main === module) {
  migrate()
}
