import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SessionData, getIronSessionConfig } from './utils/ironSessionConfig';
import { getIronSession } from 'iron-session';

export const middleware = async (req: NextRequest) => {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, getIronSessionConfig(req));

  const { user } = session;

  const originalUrl = req.headers.get('x-ms-original-url');
  const url = originalUrl ? new URL(originalUrl) : new URL(req.url);
  const host = process.env.HOST || req.headers.get('host') || 'app.absentify.com';

  // Check if host is localhost
  const protocol = host.includes('localhost') ? 'http' : 'https';

  if (user && !user.language) {
    user.language = 'en';
    await session.save();
  }

  if (user && user.language !== 'en' && req.nextUrl.locale === 'en') {
    return NextResponse.redirect(
      new URL(`/${user.language}${req.nextUrl.pathname}${req.nextUrl.search}`, `${protocol}://${host}`)
    );
  }

  if (!user?.microsoft_user_id && req.nextUrl.pathname !== '/login' && req.nextUrl.pathname !== '/signup') {
    if (req.nextUrl.pathname === '/') {
      const queryString = url.search;
      return NextResponse.redirect(new URL('/login' + queryString, `${protocol}://${host}`));
    }
    return NextResponse.redirect(
      new URL(
        '/login?redirect_after_login=' +
          encodeURIComponent(`${protocol}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`),
        `${protocol}://${host}`
      )
    );
  }

  return res;
};

export const config = {
  matcher: [
    '/settings/:path*',
    '/calendar/:path*',
    '/internal/:path*',
    '/microsoft/:path*',
    '/insights',
    '/requests',
    '/finishMsPay',
    '/'
  ]
};
