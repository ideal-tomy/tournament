import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const framesDir = resolve(root, 'tmp', 'bracket-tour-frames');
const videoPath = resolve(root, 'tmp', 'bracket-tour.mp4');
const logPath = resolve(root, 'tmp', 'bracket-tour-log.json');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9223;
const pageUrl = 'http://127.0.0.1:5199/bracket-tour.html';

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(resolve(root, 'tmp'), { recursive: true });

const profile = resolve(tmpdir(), `bracket-tour-chrome-${Date.now()}`);
const chromeProc = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  '--window-size=1440,810',
  `--user-data-dir=${profile}`,
  pageUrl,
], { stdio: 'ignore' });

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

async function cdp() {
  let targets = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      targets = await response.json();
      const page = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Chrome is still starting.
    }
    await sleep(250);
  }
  throw new Error('Chrome debugging port did not open');
}

const target = await cdp();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
await new Promise((done) => { ws.addEventListener('open', done, { once: true }); });
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve: fulfill, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else fulfill(message.result);
  }
});
function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 810, deviceScaleFactor: 1, mobile: false });

async function readTour() {
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('.obt-root');
      if (!root) return null;
      return { phase: root.dataset.phase || '', stop: root.dataset.stop || '', stops: root.dataset.stops || '', viewBox: root.dataset.viewBox || '', caption: document.querySelector('.obt-caption')?.textContent || '' };
    })()`,
    returnByValue: true,
  });
  return result.result.value;
}

for (let attempt = 0; attempt < 40 && !(await readTour()); attempt += 1) await sleep(250);
const samples = [];
let frame = 0;
const started = Date.now();
let doneFor = 0;
while (Date.now() - started < 90000) {
  const tour = await readTour();
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  const name = String(frame).padStart(4, '0');
  writeFileSync(resolve(framesDir, `${name}.jpg`), Buffer.from(shot.data, 'base64'));
  samples.push({ frame, t: (Date.now() - started) / 1000, ...tour });
  frame += 1;
  if (tour?.phase === 'done') {
    doneFor += 1;
    if (doneFor >= 3) break;
  } else doneFor = 0;
  await sleep(250);
}

ws.close();
chromeProc.kill();

const require = createRequire(resolve(tmpdir(), 'tour-rec', 'package.json'));
const ffmpeg = require('ffmpeg-static');
const elapsed = samples.at(-1)?.t || 1;
const fps = Math.max(1, Math.round(((samples.length - 1) / elapsed) * 100) / 100);
await new Promise((done, reject) => {
  const proc = spawn(ffmpeg, [
    '-y', '-framerate', String(fps), '-i', resolve(framesDir, '%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', videoPath,
  ], { stdio: 'inherit' });
  proc.on('exit', (code) => (code === 0 ? done() : reject(new Error(`ffmpeg exited ${code}`))));
});

const holds = new Map();
for (const sample of samples) {
  if (sample.phase !== 'hold' || sample.stop === '') continue;
  const box = (sample.viewBox || '').split(' ').map(Number);
  holds.set(sample.stop, box[0]);
}
const order = [...holds.keys()];
const xs = order.map((key) => holds.get(key));
const overview = samples.find((sample) => sample.phase === 'overview');
const finished = samples.filter((sample) => sample.phase === 'done');
const overviewBox = overview?.viewBox?.split(' ').map(Number) ?? [];
const endBox = finished.at(-1)?.viewBox?.split(' ').map(Number) ?? [];
const problems = [];
if (!overview) problems.push('最初の全体表示がありません');
if (finished.length < 2) problems.push('最後が全体停止になっていません');
if (order.length < 2) problems.push('拡大の停止が2か所未満です');
if (order.some((key, index) => key !== String(index))) problems.push(`停止順が左からの一巡ではありません: ${order.join(',')}`);
if (xs.some((x, index) => index > 0 && x + 1 < xs[index - 1])) problems.push(`カメラが左へ戻っています: ${xs.join(',')}`);
if (new Set(xs.map((x) => Math.round(x))).size < xs.length) problems.push('同じ位置を繰り返しています');
if (overviewBox.length === 4 && endBox.length === 4 && Math.abs(overviewBox[2] - endBox[2]) > 1) problems.push('終了時の全体幅が開始時と違います');
const phases = samples.map((sample) => sample.phase).filter((phase, index, all) => phase && phase !== all[index - 1]);
writeFileSync(logPath, JSON.stringify({ problems, phases, holds: Object.fromEntries(holds), samples }, null, 2));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`recorded ${videoPath}`);
console.log(`stops ${order.length} phases ${phases.join(' > ')}`);
