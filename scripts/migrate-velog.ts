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

// ---------------------------------------------------------------------------
// 입력 frontmatter 파싱 (라인 단위 regex — YAML 라이브러리 사용 안 함)
// ---------------------------------------------------------------------------

export interface VelogPost {
  sourceFile: string
  title: string
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
  const tagsRaw = pick(/^tags: (.*)$/)
  if (title === null || date === null || lastmod === null || tagsRaw === null) {
    throw new Error(`${sourceFile}: title/date/lastmod/tags 중 누락`)
  }
  const tags: unknown = JSON.parse(tagsRaw)
  if (!isStringArray(tags)) throw new Error(`${sourceFile}: tags가 문자열 배열이 아님`)

  return {
    sourceFile,
    title,
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
}

interface TransformContext {
  sourceFile: string
  imageExists: (file: string) => boolean
  imageFiles: Set<string>
  removed: RemovedImageRef[]
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
  imageExists: (file: string) => boolean
): BodyTransformResult {
  const ctx: TransformContext = { sourceFile, imageExists, imageFiles: new Set(), removed: [] }
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

  return { body: out.join('\n'), imageFiles: ctx.imageFiles, removed: ctx.removed }
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
}

export function convertPost(
  post: VelogPost,
  imageExists: (file: string) => boolean
): ConvertedPost {
  const rule = SERIES_RULES.find((r) => r.name === post.seriesName)
  if (!rule) {
    throw new Error(
      `표에 없는 series.name: ${JSON.stringify(post.seriesName)} (${post.sourceFile})`
    )
  }

  const transformed = transformBody(post.body, post.sourceFile, imageExists)
  const imageFiles = new Set(transformed.imageFiles)
  const removed = [...transformed.removed]

  const date = toKstDateString(post.date)
  const lastmod = toKstDateString(post.lastmod)
  const tags = buildTags(post.tags, rule.tag)

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

  const fm: string[] = ['---', `title: ${JSON.stringify(post.title)}`, `date: ${date}`]
  if (lastmod !== date) fm.push(`lastmod: ${lastmod}`)
  if (post.description !== '') fm.push(`summary: ${JSON.stringify(post.description)}`)
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
  const converted: ConvertedPost[] = []
  const seen = new Map<string, string>() // "folder/stem" → sourceFile
  const collisions: string[] = []
  for (const file of sourceFiles) {
    const raw = fs.readFileSync(path.join(SRC_CONTENT_DIR, file), 'utf8')
    const post = convertPost(parseVelogMarkdown(file, raw), imageExists)
    const key = `${post.folder}/${post.stem}`
    const prev = seen.get(key)
    if (prev !== undefined) collisions.push(`${key}.mdx ← "${prev}" / "${file}"`)
    seen.set(key, file)
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
}

if (require.main === module) {
  migrate()
}
