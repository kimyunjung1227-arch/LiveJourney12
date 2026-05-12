import { useEffect } from "react"
import { getDefaultOgImageUrl, getPublicBaseUrl, SEO_DEFAULT } from "../config/seo"

function setMetaByProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("property", property)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function setMetaByName(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute("name", name)
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

/**
 * 라우트별 title·description·canonical·OG 동기화 (크롤러·공유 미리보기 일치).
 * 언마운트 시 기본 SEO(SEO_DEFAULT)로 되돌려 다음 화면과 충돌을 줄임.
 */
export default function PageSeo({ title, description, path, robots }) {
  useEffect(() => {
    const base = getPublicBaseUrl()
    const pathname = path.startsWith("/") ? path : `/${path}`
    const canonical = `${base}${pathname}`
    const ogImage = getDefaultOgImageUrl()

    document.title = title
    setMetaByName("description", description)
    setMetaByName("robots", robots || "index, follow")

    setMetaByProperty("og:title", title)
    setMetaByProperty("og:description", description)
    setMetaByProperty("og:url", canonical)
    setMetaByProperty("og:image", ogImage)

    setMetaByName("twitter:title", title)
    setMetaByName("twitter:description", description)

    let linkCanonical = document.querySelector('link[rel="canonical"]')
    if (!linkCanonical) {
      linkCanonical = document.createElement("link")
      linkCanonical.setAttribute("rel", "canonical")
      document.head.appendChild(linkCanonical)
    }
    linkCanonical.setAttribute("href", canonical)

    return () => {
      const root = base.endsWith("/") ? base : `${base}/`
      document.title = SEO_DEFAULT.title
      setMetaByName("description", SEO_DEFAULT.description)
      setMetaByName("robots", "index, follow")
      setMetaByProperty("og:title", SEO_DEFAULT.title)
      setMetaByProperty("og:description", SEO_DEFAULT.description)
      setMetaByProperty("og:url", root)
      setMetaByProperty("og:image", ogImage)
      setMetaByName("twitter:title", SEO_DEFAULT.title)
      setMetaByName("twitter:description", SEO_DEFAULT.description)
      if (linkCanonical) linkCanonical.setAttribute("href", root)
    }
  }, [title, description, path, robots])

  return null
}
