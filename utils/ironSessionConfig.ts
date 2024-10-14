import { IncomingMessage } from 'http';
import type { SessionOptions } from 'iron-session';
import { NextApiRequest } from 'next';
import { NextRequest } from 'next/server';

export function getIronSessionConfig(req: NextApiRequest | NextRequest | IncomingMessage): SessionOptions {
  let hostname = '';

  // Behandlung für NextRequest (Middleware)
  if (req instanceof NextRequest) {
    // Verwenden einer präziseren Typüberprüfung
    hostname = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  } else if ('headers' in req) {
    // Sicherstellen, dass wir Array oder String korrekt behandeln
    const host = req.headers.host;
    if (Array.isArray(host)) {
      hostname = host[0] ?? ''; // Standardwert als leerer String, falls das Array leer ist
    } else {
      hostname = host || '';
    }

    const xForwardedHost = req.headers['x-forwarded-host'];
    if (Array.isArray(xForwardedHost)) {
      hostname = xForwardedHost[0] ?? ''; // Standardwert als leerer String, falls das Array leer ist
    } else if (typeof xForwardedHost === 'string') {
      hostname = xForwardedHost;
    }
  }

  return {
    cookieName: 'absentify_session',
    password: process.env.IRON_SESSION_KEY + '',
    cookieOptions: {
      secure: process.env.INNGEST_SIGNING_KEY !== 'local',
      sameSite: getSameSiteOption(hostname)
    }
  };
}

function getSameSiteOption(hostname: string): 'none' | 'lax' {
  return hostname.includes('teams.absentify.com') || hostname.includes('sharepoint.absentify.com') ? 'none' : 'lax';
}

export interface SessionData {
  user: {
    id: string;
    email: string;
    microsoft_user_id: string;
    microsoft_tenant_id: string;
    name: string;
    member_id: string | null;
    orgName: string;
    language: string;
    impersonate: boolean;
  } | undefined;
}
