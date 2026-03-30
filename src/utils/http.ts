/**
 * Minimal HTTP client using built-in Node.js modules (zero dependencies)
 */
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface HttpResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: <T = any>() => T;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export async function request(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const { method = 'GET', headers = {}, body, timeout = 15000 } = options;
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'marmar-cli/0.1.0',
    ...headers,
  };

  const payload = body ? JSON.stringify(body) : undefined;
  if (payload) {
    requestHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: requestHeaders,
        timeout,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const bodyStr = Buffer.concat(chunks).toString('utf-8');
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: bodyStr,
            json: <T = any>() => JSON.parse(bodyStr) as T,
          });
        });
      }
    );

    req.on('error', (err) => reject(new Error(`Network error: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Build URL with base and path
 */
export function buildUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}
