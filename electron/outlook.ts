// Microsoft Graph Calendar integration via OAuth 2.0 PKCE + loopback redirect.
// No external auth library needed — uses Node built-ins only.
//
// Prerequisites (user must do once):
//   1. Register an app in Azure portal → App registrations
//   2. Add a Mobile/Desktop redirect URI: http://localhost (or any localhost port)
//   3. Grant "Calendars.Read" delegated permission
//   4. Copy the Application (client) ID and Directory (tenant) ID
//   5. Enter those in the app settings under "Connect Outlook"

import { shell } from 'electron';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { request as httpsRequest, type RequestOptions } from 'node:https';

export interface OutlookConfig {
  clientId: string;
  tenantId: string;
}

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  startDateTime: string; // ISO datetime (local to event's timezone)
  endDateTime: string;
  timeZone: string;
  isAllDay: boolean;
  location?: string;
  onlineMeetingUrl?: string;
  isCancelled: boolean;
}

interface TokenData {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // unix ms
}

type ConfigGetter = (key: string) => string | null;
type ConfigSetter = (key: string, value: string) => void;

// Separate secure pair used only for OAuth tokens — values are encrypted at rest.
type SecureConfigGetter = (key: string) => string | null;
type SecureConfigSetter = (key: string, value: string) => void;

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

function randomLoopbackPort(): number {
  // IANA dynamic/private port range
  return Math.floor(Math.random() * (65535 - 49152 + 1)) + 49152;
}

// ── HTTPS helpers ─────────────────────────────────────────────────────────────

function httpsGet(url: string, accessToken: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options: RequestOptions = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    const req = httpsRequest(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Non-JSON response (${res.statusCode}): ${body.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(url: string, body: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options: RequestOptions = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/json',
      },
    };
    const req = httpsRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Non-JSON token response: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── OutlookService ────────────────────────────────────────────────────────────

export class OutlookService {
  constructor(
    private readonly getAppConfig: ConfigGetter,
    private readonly setAppConfig: ConfigSetter,
    // Token storage uses encrypted getters/setters so tokens are never stored in plain text.
    private readonly getSecureConfig: SecureConfigGetter,
    private readonly setSecureConfig: SecureConfigSetter,
  ) {}

  // ── Config ────────────────────────────────────────────────────────────────

  getOutlookConfig(): OutlookConfig | null {
    const clientId = this.getAppConfig('outlook_client_id');
    const tenantId = this.getAppConfig('outlook_tenant_id');
    if (!clientId || !tenantId) return null;
    return { clientId, tenantId };
  }

  setOutlookConfig(config: OutlookConfig): void {
    this.setAppConfig('outlook_client_id', config.clientId.trim());
    this.setAppConfig('outlook_tenant_id', config.tenantId.trim());
  }

  // ── Token management ──────────────────────────────────────────────────────

  private getStoredToken(): TokenData | null {
    // Tokens are encrypted at rest via SqliteAppConfigRepository.getSecure()
    const accessToken = this.getSecureConfig('outlook_access_token');
    const refreshToken = this.getSecureConfig('outlook_refresh_token');
    const expiresAt = this.getAppConfig('outlook_token_expires'); // expiry is not sensitive
    if (!accessToken || !expiresAt) return null;
    return {
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt: parseInt(expiresAt, 10),
    };
  }

  private storeToken(data: TokenData): void {
    // Tokens are encrypted before writing — never stored in plain text.
    this.setSecureConfig('outlook_access_token', data.accessToken);
    this.setSecureConfig('outlook_refresh_token', data.refreshToken ?? '');
    this.setAppConfig('outlook_token_expires', String(data.expiresAt));
  }

  getTokenStatus(): { connected: boolean; expiresAt?: number } {
    const token = this.getStoredToken();
    if (!token) return { connected: false };
    const connected = token.expiresAt > Date.now();
    return { connected, expiresAt: token.expiresAt };
  }

  disconnect(): void {
    this.setSecureConfig('outlook_access_token', '');
    this.setSecureConfig('outlook_refresh_token', '');
    this.setAppConfig('outlook_token_expires', '');
  }

  private async getValidAccessToken(): Promise<string | null> {
    const token = this.getStoredToken();
    if (!token) return null;

    // Token still valid with a 5-minute buffer
    if (token.expiresAt > Date.now() + 5 * 60 * 1000) {
      return token.accessToken;
    }

    // Try refresh
    if (!token.refreshToken) return null;
    const config = this.getOutlookConfig();
    if (!config) return null;

    try {
      const body = new URLSearchParams({
        client_id: config.clientId,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        scope: 'Calendars.Read offline_access',
      }).toString();

      const res = await httpsPost(
        `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
        body,
      ) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

      if (res.error || !res.access_token) return null;

      const refreshed: TokenData = {
        accessToken: res.access_token,
        refreshToken: res.refresh_token ?? token.refreshToken,
        expiresAt: Date.now() + (res.expires_in ?? 3600) * 1000,
      };
      this.storeToken(refreshed);
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }

  // ── PKCE auth flow ────────────────────────────────────────────────────────

  startAuth(): Promise<{ success: boolean; error?: string }> {
    const config = this.getOutlookConfig();
    if (!config) {
      return Promise.resolve({
        success: false,
        error: 'Outlook not configured. Enter your Azure app Client ID and Tenant ID first.',
      });
    }

    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    const state = base64url(randomBytes(16));
    const port = randomLoopbackPort();
    const redirectUri = `http://localhost:${port}/callback`;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        server.close();
        resolve({ success: false, error: 'Authentication timed out after 5 minutes.' });
      }, 5 * 60 * 1000);

      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', `http://localhost:${port}`);
        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end();
          return;
        }

        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDesc = url.searchParams.get('error_description');

        const success = !error && !!code && returnedState === state;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><title>Wavhudi OS</title>
          <style>body{font-family:system-ui,sans-serif;text-align:center;padding:80px 20px;background:#0f0f0f;color:#e5e5e5}</style>
          </head><body>
          <h2>${success ? '✓ Signed in successfully' : '✗ Sign-in failed'}</h2>
          <p style="color:#888">${success ? 'You can close this tab and return to Wavhudi OS.' : (errorDesc ?? error ?? 'Unknown error')}</p>
          <script>setTimeout(()=>window.close(),2000)</script>
          </body></html>`);

        server.close();
        clearTimeout(timeout);

        if (!success) {
          // success already requires returnedState === state, so this covers state mismatch too.
          resolve({ success: false, error: errorDesc ?? error ?? 'Authorization cancelled or state mismatch' });
          return;
        }

        // Exchange auth code for tokens
        const body = new URLSearchParams({
          client_id: config.clientId,
          grant_type: 'authorization_code',
          code: code!,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          scope: 'Calendars.Read offline_access',
        }).toString();

        httpsPost(
          `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
          body,
        ).then((raw) => {
          const r = raw as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
            error?: string;
            error_description?: string;
          };
          if (r.error || !r.access_token) {
            resolve({ success: false, error: r.error_description ?? r.error ?? 'Token exchange failed' });
            return;
          }
          this.storeToken({
            accessToken: r.access_token,
            refreshToken: r.refresh_token ?? null,
            expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
          });
          resolve({ success: true });
        }).catch((err: Error) => {
          resolve({ success: false, error: err.message });
        });
      });

      server.on('error', (err: Error) => {
        clearTimeout(timeout);
        resolve({ success: false, error: `Could not start local auth server: ${err.message}` });
      });

      server.listen(port, '127.0.0.1', () => {
        const authUrl = new URL(
          `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`,
        );
        authUrl.searchParams.set('client_id', config.clientId);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', 'Calendars.Read offline_access');
        authUrl.searchParams.set('response_mode', 'query');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('prompt', 'select_account');

        void shell.openExternal(authUrl.toString());
      });
    });
  }

  // ── Calendar events ───────────────────────────────────────────────────────

  async getCalendarEvents(date: string): Promise<OutlookCalendarEvent[]> {
    const accessToken = await this.getValidAccessToken();
    if (!accessToken) return [];

    try {
      // Graph calendarView requires ISO datetime without 'Z' suffix for local interpretation
      const url =
        `https://graph.microsoft.com/v1.0/me/calendarView` +
        `?startDateTime=${encodeURIComponent(`${date}T00:00:00`)}` +
        `&endDateTime=${encodeURIComponent(`${date}T23:59:59`)}` +
        `&$select=id,subject,start,end,isAllDay,isCancelled,location,onlineMeetingUrl` +
        `&$orderby=start/dateTime` +
        `&$top=50`;

      const res = await httpsGet(url, accessToken) as {
        value?: Array<{
          id: string;
          subject: string;
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
          isAllDay: boolean;
          isCancelled: boolean;
          location?: { displayName: string };
          onlineMeetingUrl?: string;
        }>;
        error?: { message: string; code: string };
      };

      if (res.error || !res.value) return [];

      return res.value.map((e) => ({
        id: e.id,
        subject: e.subject || '(No title)',
        startDateTime: e.start.dateTime,
        endDateTime: e.end.dateTime,
        timeZone: e.start.timeZone,
        isAllDay: e.isAllDay,
        location: e.location?.displayName || undefined,
        onlineMeetingUrl: e.onlineMeetingUrl || undefined,
        isCancelled: e.isCancelled,
      }));
    } catch {
      return [];
    }
  }
}
