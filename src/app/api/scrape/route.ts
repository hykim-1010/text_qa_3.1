import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '?붿껌 蹂몃Ц???좏슚??JSON???꾨떃?덈떎.' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('url' in body) ||
    typeof (body as { url: unknown }).url !== 'string'
  ) {
    return NextResponse.json({ error: 'url ?꾨뱶媛 ?꾩슂?⑸땲??' }, { status: 400 })
  }

  const { url, forceExpand = false } = body as { url: string; forceExpand?: boolean }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: '?좏슚?섏? ?딆? URL?낅땲??' }, { status: 400 })
  }

  let browser = null
  try {
    browser = await chromium.launch()
    const page = await browser.newPage()

    try {
      await page.goto(url, { timeout: 30_000, waitUntil: 'domcontentloaded' })
      // 異붽? 由ъ냼???대?吏, ?고듃 ?? 濡쒕뱶 ?湲?(理쒕? 5珥?
      await page.waitForLoadState('load', { timeout: 5_000 }).catch(() => {})
      await page.waitForTimeout(800)

      // ?섏씠吏瑜??④퀎?곸쑝濡??ㅽ겕濡ㅽ빐 Intersection Observer 湲곕컲 紐⑥뀡 ?좊땲硫붿씠??媛뺤젣 諛쒕룞
      await page.evaluate(async () => {
        await new Promise<void>(resolve => {
          const distance = 400
          const delay = 80
          let scrolled = 0
          const timer = setInterval(() => {
            window.scrollBy(0, distance)
            scrolled += distance
            if (scrolled >= document.body.scrollHeight) {
              clearInterval(timer)
              window.scrollTo(0, 0)
              resolve()
            }
          }, delay)
        })
      })
      // 吏꾩엯 ?좊땲硫붿씠???꾨즺 ?湲?
      await page.waitForTimeout(1_000)

      // ?④꺼吏?肄섑뀗痢?媛뺤젣 ?쇱튂湲?(?꾩퐫?붿뼵쨌??톎etails)
      if (forceExpand) {
        await page.evaluate(() => {
          // 1) <details> ?붿냼 ?꾩껜 ?닿린
          document.querySelectorAll('details').forEach(el => { el.open = true })

          // 2) aria 湲곕컲 ?꾩퐫?붿뼵: aria-expanded="false" 踰꾪듉 ?대┃
          document.querySelectorAll<HTMLElement>('[aria-expanded="false"]').forEach(btn => btn.click())

          // 3) ???⑤꼸: role="tabpanel" 媛뺤젣 ?쒖떆
          document.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach(panel => {
            panel.style.display = 'block'
            panel.style.visibility = 'visible'
            panel.removeAttribute('hidden')
            panel.setAttribute('aria-hidden', 'false')
          })

          // 4) display:none ???쇰컲 肄섑뀗痢??⑤꼸 媛뺤젣 ?쒖떆
          //    (aria-hidden="true" ???섎룄???④??대?濡??쒖쇅)
          document.querySelectorAll<HTMLElement>(
            '[class*="accordion__content"], [class*="accordion-content"],' +
            '[class*="collapse__body"], [class*="collapse-body"],' +
            '[class*="tab__content"], [class*="tab-content"],' +
            '[class*="panel__content"], [class*="panel-content"]'
          ).forEach(el => {
            if (el.getAttribute('aria-hidden') === 'true') return
            const s = window.getComputedStyle(el)
            if (s.display === 'none' || s.visibility === 'hidden') {
              el.style.display = 'block'
              el.style.visibility = 'visible'
            }
          })

        })
        // ?꾩퐫?붿뼵 ?대┃ ???대┝ ?좊땲硫붿씠???꾨즺 ?湲?
        await page.waitForTimeout(600)
      }
    } catch (navErr: unknown) {
      const msg = navErr instanceof Error ? navErr.message : String(navErr)
      if (msg.toLowerCase().includes('timeout')) {
        return NextResponse.json({ error: '?섏씠吏 濡쒕뱶 ?쒓컙??珥덇낵?섏뿀?듬땲??(15珥?.' }, { status: 504 })
      }
      return NextResponse.json({ error: `?섏씠吏???묎렐?????놁뒿?덈떎: ${msg}` }, { status: 502 })
    }

    const nodes = await page.evaluate((forceExpandInline: boolean) => {
      // display:none ?붿냼 媛뺤젣 ?쒖떆 (forceExpand ??
      // - ?몃씪??style 肉먮쭔 ?꾨땲??CSS ?대옒??湲곕컲 ?④????ы븿 (computedStyle 泥댄겕)
      // - [class],[style] ?띿꽦???덈뒗 ?붿냼濡?踰붿쐞 ?쒗븳???깅뒫 理쒖쟻??
      // - 蹂꾨룄 evaluate ?댄썑 ?ъ씠??JS媛 DOM???섎룎由щ뒗 寃껋쓣 留됯린 ?꾪빐
      //   異붿텧怨??숈씪??evaluate ?덉뿉???ㅽ뻾 (JS???깃??ㅻ젅????媛쒖엯 遺덇?)
      if (forceExpandInline) {
        document.querySelectorAll<HTMLElement>('[class], [style]').forEach(el => {
          if (el.getAttribute('aria-hidden') === 'true') return
          const tag = el.tagName.toLowerCase()
          if (['script', 'style', 'noscript', 'head', 'meta', 'link'].includes(tag)) return
          if (window.getComputedStyle(el).display === 'none') {
            el.style.setProperty('display', 'block', 'important')
          }
        })
      }

      // noise ?붿냼 ?쒓굅
      document.querySelectorAll(
        'script, style, noscript, iframe, object, embed, svg, template, [hidden],' +
        'header, footer, nav, aside,' +
        '[role="banner"], [role="contentinfo"], [role="navigation"],' +
        '[aria-hidden="true"],' +
        '.blind, .sr-only, .screen-reader-only, .visually-hidden, .visuallyhidden,' +
        '.a11y-hidden, .accessibility-hidden, .skip, .offscreen, .off-screen,' +
        '.header, .footer, #header, #footer,' +
        '.nav, .navbar, .navigation, .gnb, .lnb'
      ).forEach(el => el.remove())

      // a, button, label, strong ?ы븿: ?꾨옒?먯꽌 遺紐?罹≪쿂 ?щ?瑜?泥댄겕??以묐났 諛⑹?
      const SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, td, th, dt, dd, figcaption, blockquote, button, a[href], label, strong, span'
      const elements = Array.from(document.querySelectorAll(SELECTORS))

      // dl 異붽?: li ?덉뿉 dl???덉쓣 ??outer li媛 ?듭㎏濡??≫엳??寃껋쓣 留됱쓬
      const BLOCK_TAGS = new Set(['p','h1','h2','h3','h4','h5','h6','li','td','th','dt','dd','div','section','article','ul','ol','dl','table'])

      // ??됲꽣???ы븿??紐⑤뱺 ?쒓렇 (遺紐④? ??以??섎굹?닿퀬 釉붾줉 ?먯떇???놁쑝硫?遺紐④? 罹≪쿂)
      const ALL_SELECTOR_TAGS = new Set(['p','h1','h2','h3','h4','h5','h6','li','td','th','dt','dd','figcaption','blockquote','button','a','label','strong','span'])

      const result: Array<{
        id: string; text: string
        x: number; y: number; width: number; height: number
        source: 'web'
      }> = []

      elements.forEach((el, index) => {
        const htmlEl = el as HTMLElement
        const tag = htmlEl.tagName.toLowerCase()
        const style = window.getComputedStyle(htmlEl)

        if (style.display === 'none' || style.visibility === 'hidden') return

        const rect = htmlEl.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return

        const text = htmlEl.innerText?.trim() ?? ''
        if (!text) return

        // <dt><strong>..</strong><span>..</span></dt> 형태는
        // 컨테이너(dt) 대신 strong/span을 개별 추출한다.
        if (
          tag === 'dt' &&
          Array.from(htmlEl.children).some(child => {
            const childTag = child.tagName.toLowerCase()
            return childTag === 'strong' || childTag === 'span'
          })
        ) return

        // <li><span>..</span><strong>..</strong></li> 조합은
        // li 컨테이너 대신 span/strong을 개별 추출한다.
        if (tag === 'li') {
          const childTags = Array.from(htmlEl.children).map(child => child.tagName.toLowerCase())
          const hasSpan = childTags.includes('span')
          const hasStrong = childTags.includes('strong')
          if (hasSpan && hasStrong) return
        }

        // 釉붾줉 ?먯떇???덈뒗 而⑦뀒?대꼫??以묐났 諛⑹?瑜??꾪빐 ?쒖쇅
        const hasBlockChild = Array.from(htmlEl.children).some(child =>
          BLOCK_TAGS.has(child.tagName.toLowerCase())
        )
        if (hasBlockChild) return

        // a, button, label, strong ???몃씪????됲꽣:
        // 遺紐⑤룄 ??됲꽣???랁븯怨?釉붾줉 ?먯떇???놁쑝硫???遺紐④? 罹≪쿂 ?덉젙) 以묐났 諛⑹?瑜??꾪빐 ?ㅽ궢.
        // ?? 遺紐④? 釉붾줉 ?먯떇??媛???ㅽ궢??寃쎌슦?먮뒗 ???붿냼媛 ?낅┰ 罹≪쿂?섏뼱???섎?濡??좎?.
        // ?? <li><a>text</a></li>         ??li 罹≪쿂, a ?ㅽ궢
        //     <li><strong>t</strong><dl/></li> ??li ?ㅽ궢, strong 罹≪쿂
        const INLINE_SELECTOR_TAGS = new Set(['a','button','label','strong','span'])
        if (INLINE_SELECTOR_TAGS.has(tag)) {
          const parentEl = htmlEl.parentElement
          if (parentEl) {
            const parentTag = parentEl.tagName.toLowerCase()
            // dt의 strong/span은 타이틀 조합 분리를 위해 개별 추출 허용
            if ((tag === 'strong' || tag === 'span') && parentTag === 'dt') {
              // no-op
            // li의 span+strong 조합도 개별 추출 허용
            } else if (
              (tag === 'strong' || tag === 'span') &&
              parentTag === 'li' &&
              Array.from(parentEl.children).some(c => c.tagName.toLowerCase() === 'span') &&
              Array.from(parentEl.children).some(c => c.tagName.toLowerCase() === 'strong') &&
              text.length >= 2
            ) {
              // no-op
            } else if (ALL_SELECTOR_TAGS.has(parentTag)) {
              const parentHasBlock = Array.from(parentEl.children).some(c =>
                BLOCK_TAGS.has(c.tagName.toLowerCase())
              )
              if (!parentHasBlock) return  // 遺紐④? 罹≪쿂 ?????붿냼???ㅽ궢
            }
          }
        }

        result.push({
          id: `web-${index}`,
          text,
          x: Math.round(rect.left),
          // scrollY瑜??뷀빐 ?덈? ?섏씠吏 醫뚰몴濡?蹂??(?뺣젹 ???쇨????뺣낫)
          y: Math.round(rect.top + window.scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          source: 'web',
        })
      })

      return result
    }, forceExpand)

    const [screenshotBuffer, pageSize] = await Promise.all([
      page.screenshot({ fullPage: true, type: 'png' }),
      page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      })),
    ])
    const screenshotBase64 = `data:image/png;base64,${screenshotBuffer.toString('base64')}`

    return NextResponse.json({ nodes, screenshotBase64, pageWidth: pageSize.width, pageHeight: pageSize.height })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '?????녿뒗 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    if (browser) await browser.close()
  }
}

