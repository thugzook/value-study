// Vercel Edge Function: proxies a remote image so the client can read its
// pixels even when the source host (e.g. Pinterest's CDN) doesn't send
// permissive CORS headers.
export const config = { runtime: 'edge' }

const IMAGE_TYPE = /^image\//

export default async function handler(req: Request): Promise<Response> {
  const target = new URL(req.url).searchParams.get('url')
  if (!target) return new Response('Missing url', { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return new Response('Unsupported protocol', { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (value-study image proxy)' },
    })
  } catch {
    return new Response('Could not fetch that URL', { status: 502 })
  }

  const contentType = upstream.headers.get('content-type') ?? ''
  if (!upstream.ok || !IMAGE_TYPE.test(contentType)) {
    return new Response('That URL did not return an image', { status: 415 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': '*',
    },
  })
}
