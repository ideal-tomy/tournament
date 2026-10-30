// Optional CLI-only fallback for local OS DNS outages. No OS settings are changed.
// TLS still verifies the requested hostname. Never disable certificate validation.
const dns = require('node:dns');
const https = require('node:https');
const original = dns.lookup.bind(dns);
const cache = new Map();
function resolve(hostname) {
  const hit = cache.get(hostname);
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.addresses);
  return new Promise((fulfill, reject) => {
    const request = https.get(`https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=A`, { headers: { Accept: 'application/dns-json' }, timeout: 6000 }, response => {
      let text = '';
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) throw new Error('DNS fallback unavailable');
          const data = JSON.parse(text);
          const addresses = (data.Answer ?? []).filter(record => record.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(record.data)).map(record => ({ address: record.data, family: 4 }));
          if (!addresses.length) throw new Error('DNS fallback unavailable');
          cache.set(hostname, { addresses, until: Date.now() + 60000 });
          fulfill(addresses);
        } catch { reject(new Error('DNS fallback unavailable')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('DNS fallback timeout')));
    request.on('error', reject);
  });
}
dns.lookup = function lookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  const supported = /^(?:[a-zA-Z0-9-]+\.)*(?:cloudflare\.com|workers\.dev|cloudflarestorage\.com)$/.test(hostname);
  if (!supported || (typeof options === 'number' ? options : options?.family) === 6) return original(hostname, options, callback);
  resolve(hostname).then(addresses => {
    if (options?.all) callback(null, addresses);
    else callback(null, addresses[0].address, 4);
  }, () => original(hostname, options, callback));
};
