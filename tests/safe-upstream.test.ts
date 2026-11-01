import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn(), status: 200 }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:https', () => ({ request: mocks.request }));
import {
  publicAddress,
  resolvePublicHost,
  safeUserFetch,
  userBaseURL,
} from '../server/safe-upstream';
beforeEach(() => {
  mocks.status = 200;
  mocks.lookup.mockReset();
  mocks.request.mockReset();
  mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  mocks.request.mockImplementation((_options, callback) => {
    const outgoing = new EventEmitter() as EventEmitter & {
      setTimeout: () => void;
      destroy: () => void;
      end: () => void;
    };
    outgoing.setTimeout = () => {};
    outgoing.destroy = () => {};
    outgoing.end = () =>
      queueMicrotask(() => {
        const response = Object.assign(Readable.from([Buffer.from('{"ok":true}')]), {
          statusCode: mocks.status,
          headers: { location: 'https://localhost/private' },
        });
        callback(response);
      });
    return outgoing;
  });
});
it('拒绝私网、链路本地、保留地址及 IPv4 映射 IPv6', () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.1.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
  ])
    expect(publicAddress(ip), ip).toBe(false);
  expect(publicAddress('93.184.216.34')).toBe(true);
  expect(publicAddress('2606:4700:4700::1111')).toBe(true);
});
it('域名任一 DNS 答案为私网就拒绝，包括混合地址', async () => {
  mocks.lookup.mockResolvedValue([
    { address: '93.184.216.34', family: 4 },
    { address: '10.0.0.1', family: 4 },
  ]);
  await expect(resolvePublicHost('api.vendor.com')).rejects.toThrow('非公开地址');
  await expect(safeUserFetch('https://api.vendor.com/v1/responses')).rejects.toThrow('非公开地址');
  expect(mocks.request).not.toHaveBeenCalled();
});
it('连接钉住已校验的 IP，TLS 身份和 Host 保持目标域名，不再次解析 DNS', async () => {
  const response = await safeUserFetch('https://api.vendor.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic-key' },
    body: '{}',
  });
  expect(await response.json()).toEqual({ ok: true });
  expect(mocks.lookup).toHaveBeenCalledOnce();
  expect(mocks.request.mock.calls[0][0]).toMatchObject({
    hostname: '93.184.216.34',
    servername: 'api.vendor.com',
    port: 443,
    agent: false,
    path: '/v1/responses',
    headers: { Host: 'api.vendor.com', authorization: 'Bearer synthetic-key' },
  });
  expect(typeof mocks.request.mock.calls[0][0].checkServerIdentity).toBe('function');
});
it('不跟随重定向，不把密钥转发给第二个目标', async () => {
  mocks.status = 307;
  await expect(
    safeUserFetch('https://api.vendor.com/v1/responses', {
      headers: { Authorization: 'Bearer synthetic-key' },
    }),
  ).rejects.toThrow('重定向');
  expect(mocks.request).toHaveBeenCalledOnce();
});
it('拒绝用户信息、查询参数、IP 和非标准端口', () => {
  for (const url of [
    'https://169.254.169.254',
    'https://[::ffff:127.0.0.1]',
    'https://api.vendor.com:8443',
    'https://user:secret@api.vendor.com',
    'https://api.vendor.com?key=secret',
  ])
    expect(() => userBaseURL(url)).toThrow();
});
