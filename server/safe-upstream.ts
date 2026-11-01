import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { checkServerIdentity } from 'node:tls';
import { isIP } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import ipaddr from 'ipaddr.js';
import { AiError } from '../shared/extraction.ts';

export function publicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}
export function userBaseURL(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AiError(400, '请填写有效的 HTTPS Base URL。');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    url.protocol !== 'https:' ||
    (url.port && url.port !== '443') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new AiError(
      400,
      '自定义接口必须使用 HTTPS 的 443 端口，地址中不能包含账号、密钥参数或片段。',
    );
  if (
    !host.includes('.') ||
    isIP(host) ||
    host.startsWith('[') ||
    /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)
  )
    throw new AiError(400, '自定义接口需要公开的 HTTPS 域名，不支持本机、内网或 IP 地址。');
  return url;
}
export async function resolvePublicHost(hostname: string, resolver = lookup) {
  const addresses = await resolver(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address)))
    throw new AiError(400, '接口域名解析到了非公开地址，已停止请求。');
  return addresses[0];
}
/** Resolve once, validate every answer, then connect to that IP with the original TLS name.
 * No redirect following, proxy environment, pooled sockets, or second DNS resolution. */
export const safeUserFetch: typeof fetch = async (input, init) => {
  const url = userBaseURL(String(input));
  const address = await resolvePublicHost(url.hostname);
  if (init?.signal?.aborted) throw init.signal.reason;
  return new Promise<Response>((resolve, reject) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const outgoing = httpsRequest(
      {
        hostname: address.address,
        family: address.family,
        port: 443,
        servername: url.hostname,
        checkServerIdentity: (_hostname, cert) => checkServerIdentity(url.hostname, cert),
        method: 'POST',
        path: url.pathname,
        agent: false,
        headers: { ...headers, Host: url.host, 'Accept-Encoding': 'identity' },
        signal: init?.signal ?? undefined,
      },
      (incoming) => {
        const status = incoming.statusCode || 502;
        if (status >= 300 && status < 400) {
          incoming.resume();
          reject(new AiError(400, '接口返回了重定向，请改用服务商提供的最终 HTTPS Base URL。'));
          return;
        }
        const encoding = incoming.headers['content-encoding'];
        const decoder =
          encoding === 'gzip'
            ? createGunzip()
            : encoding === 'br'
              ? createBrotliDecompress()
              : encoding === 'deflate'
                ? createInflate()
                : null;
        const stream = decoder ? incoming.pipe(decoder) : incoming;
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on('error', reject);
        stream.on('error', reject);
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 8 * 1024 * 1024) {
            outgoing.destroy();
            stream.destroy();
            reject(new AiError(502, '模型响应过大，请减少词数后重试。'));
          } else chunks.push(chunk);
        });
        stream.on('end', () =>
          resolve(
            new Response(Buffer.concat(chunks), {
              status,
              headers: { 'Content-Type': 'application/json' },
            }),
          ),
        );
      },
    );
    outgoing.on('error', reject);
    outgoing.setTimeout(120000, () => outgoing.destroy(new Error('Upstream timed out')));
    outgoing.end(typeof init?.body === 'string' ? init.body : '');
  });
};
