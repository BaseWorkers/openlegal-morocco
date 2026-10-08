import { Resolver } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';

const nonPublicIPv4Addresses = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
]) nonPublicIPv4Addresses.addSubnet(network, prefix, 'ipv4');
const nonPublicIPv6Addresses = new BlockList();
for (const [network, prefix] of [
  ['::', 96], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48],
  ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['2002::', 16],
  ['3fff::', 20], // Documentation prefix from IANA's IPv6 Special-Purpose Address Registry.
  ['fc00::', 7],
  ['fe80::', 10], ['ff00::', 8]
]) nonPublicIPv6Addresses.addSubnet(network, prefix, 'ipv6');

export function isPublicSourceAddress(address, family = isIP(address)) {
  if (isIP(address) !== family) return false;
  const blockList = family === 4 ? nonPublicIPv4Addresses : nonPublicIPv6Addresses;
  return !blockList.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

async function resolvePublicAddresses(hostname, timeoutMs) {
  const resolver = new Resolver({ timeout: timeoutMs, tries: 1 });
  try {
    const results = await Promise.allSettled([
      resolver.resolve4(hostname),
      resolver.resolve6(hostname)
    ]);
    const addresses = [];
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
        if (!['ENODATA', 'ENOTFOUND'].includes(result.reason?.code)) throw result.reason;
        continue;
      }
      const family = index === 0 ? 4 : 6;
      addresses.push(...result.value.map((address) => ({ address, family })));
    }
    if (!addresses.length) throw new Error('hostname did not resolve to an IP address');
    if (addresses.some(({ address, family }) => !isPublicSourceAddress(address, family))) {
      throw new Error('hostname resolved to a non-public IP address');
    }
    return addresses;
  } finally {
    resolver.cancel();
  }
}

export async function requestPublicSource(url, { signal, timeoutMs = 5000, headers = {} } = {}) {
  const target = new URL(url);
  const addresses = await resolvePublicAddresses(target.hostname, timeoutMs);
  if (signal?.aborted) throw Object.assign(new Error('source-link request timed out'), { name: 'AbortError' });

  return new Promise((resolve, reject) => {
    const request = httpsRequest(target, {
      method: 'GET',
      headers,
      signal,
      agent: false,
      lookup(hostname, options, callback) {
        if (hostname.toLowerCase() !== target.hostname.toLowerCase()) {
          callback(new Error('unexpected hostname in HTTPS lookup'));
          return;
        }
        if (options?.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      }
    }, resolve);
    request.once('error', reject);
    request.end();
  });
}
