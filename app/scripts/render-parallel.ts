#!/usr/bin/env bun
// Unattended long export: splits [from, to) into chunks, renders them with render.ts on several workers (a few per
// GPU: one export pipeline leaves the GPU mostly idle, waiting on sub-frame syncs and readbacks), then joins the
// chunks losslessly and muxes the audio.
//   bun scripts/render-parallel.ts --gpus pci-0000_17_00_0,pci-0000_65_00_0 [--per-gpu 3] [--chunk 1]
//       [--from 0] [--to <song end>] --work <dir> --out <file.mp4> -- <render.ts video options>
//   e.g. ... -- --scale 2 --fps 120 --samples auto --shutter 0.4 --codec h265
// Each worker picks its GPU with DRI_PRIME=<gpu> (Mesa's Vulkan device-select layer, Linux). A run resumes: chunks
// already rendered into --work are kept, as long as the render options match the ones recorded there (run.json);
// delete a chunk to have it rendered again. Per-chunk logs in <work>/logs/, progress in <work>/progress.log.
// Before rendering it regenerates the outro's plates (public/plates/) on the same machine (--no-plates to skip).
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';

const sep = process.argv.indexOf('--');
const argv = process.argv.slice(2, sep < 0 ? undefined : sep);
const pass = sep < 0 ? [] : process.argv.slice(sep + 1);
const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const passOpt = (k: string, d: string) => { const i = pass.indexOf(`--${k}`); return i >= 0 ? pass[i + 1]! : d; };

const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
const gpus = (opt('gpus') ?? '').split(',').filter(Boolean);
const perGpu = +opt('per-gpu', '3')!;
const chunk = +opt('chunk', '1')!;
const from = +opt('from', '0')!;
const to = +(opt('to') ?? (await Bun.file(path.join(ROOT, 'data/audio.json')).json()).duration);
const work = path.resolve(opt('work', path.join(ROOT, 'out/parallel'))!);
const out = path.resolve(opt('out', path.join(ROOT, 'out/pdoom.mp4'))!);
const fps = +passOpt('fps', '60');
const h265 = passOpt('codec', 'h264') === 'h265';
if (!gpus.length) throw new Error('--gpus is required (DRI_PRIME ids, e.g. pci-0000_17_00_0)');

mkdirSync(path.join(work, 'logs'), { recursive: true });
// chunks from another configuration must not be mixed into this one
const manifest = JSON.stringify({ from, to, chunk, render: pass });
const manifestFile = path.join(work, 'run.json');
if (existsSync(manifestFile) && readFileSync(manifestFile, 'utf8') !== manifest) {
  console.error(`${work} holds chunks rendered with other options:\n  ${readFileSync(manifestFile, 'utf8')}\nuse another --work directory (or empty this one)`);
  process.exit(1);
}
writeFileSync(manifestFile, manifest);
const progress = (s: string) => { const l = `${new Date().toISOString()}  ${s}`; console.log(l); appendFileSync(path.join(work, 'progress.log'), l + '\n'); };
const frameCount = (f: string) => {
  const r = Bun.spawnSync(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', f]);
  return parseInt(r.stdout.toString().trim(), 10) || 0;
};

// chunks on whole frames, as render.ts counts them (round(t * fps))
type Chunk = { i: number; a: number; b: number; frames: number; file: string };
const chunks: Chunk[] = [];
for (let a = from, i = 0; a < to - 1e-9; a += chunk, i++) {
  const b = Math.min(to, a + chunk);
  chunks.push({ i, a, b, frames: Math.round(b * fps) - Math.round(a * fps), file: path.join(work, `seg_${String(i).padStart(4, '0')}.mp4`) });
}
const queue = chunks.filter((c) => !existsSync(c.file));
progress(`${chunks.length} chunks of ${chunk}s over [${from}, ${to}) at ${fps} fps, ${chunks.length - queue.length} already done; ${gpus.length} GPU(s) × ${perGpu} workers; render.ts ${pass.join(' ')}`);

// one shared dev server without live reload
const port = +opt('port', '5390')!;
const url = `http://localhost:${port}`;
const reachable = async () => { try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
let vite: ReturnType<typeof Bun.spawn> | null = null;
if (!(await reachable())) {
  vite = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, PDOOM_NO_HMR: '1' } });
  for (let k = 0; k < 300 && !(await reachable()); k++) await Bun.sleep(100);
}

// The outro's rewind montage shows public/plates/ (one still per scene), not live scenes: regenerate them
// first, on this machine, so they always match the scenes being rendered (--no-plates to skip)
if (!argv.includes('--no-plates') && queue.length) {
  progress('regenerating the outro plates (public/plates/)');
  const r = Bun.spawnSync([process.execPath, path.join(APP, 'scripts/render.ts'), 'plates', '--url', url], {
    cwd: APP, env: { ...process.env, DRI_PRIME: gpus[0]! }, stdout: 'pipe', stderr: 'pipe',
  });
  const log = r.stdout.toString() + r.stderr.toString();
  writeFileSync(path.join(work, 'logs', 'plates.log'), log);
  if (r.exitCode !== 0 || /SCENE ERRORS|\[pageerror\]|app failed to boot/.test(log)) {
    progress(`PLATES FAILED (exit ${r.exitCode}); see logs/plates.log`);
    vite?.kill();
    process.exit(1);
  }
}

const t0 = Date.now();
const todo = queue.length;
let done = 0;
const failed: number[] = [];
async function worker(gpu: string) {
  for (let c = queue.shift(); c; c = queue.shift()) {
    const tag = `seg_${String(c.i).padStart(4, '0')}`;
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      const part = c.file.replace(/\.mp4$/, '.part.mp4');
      const s = Date.now();
      const p = Bun.spawn([process.execPath, path.join(APP, 'scripts/render.ts'), 'video', '--from', String(c.a), '--to', String(c.b), '--noaudio', '--url', url, '--out', part, ...pass], {
        cwd: APP, env: { ...process.env, DRI_PRIME: gpu },
        stdout: Bun.file(path.join(work, 'logs', `${tag}.log`)), stderr: Bun.file(path.join(work, 'logs', `${tag}.err`)),
      });
      const code = await p.exited;
      const n = existsSync(part) ? frameCount(part) : 0;
      // a scene that failed to load still renders (as black): treat its errors as a failed chunk
      const logs = ['log', 'err'].map((x) => { try { return readFileSync(path.join(work, 'logs', `${tag}.${x}`), 'utf8'); } catch { return ''; } }).join('\n');
      const sceneError = /SCENE ERRORS|\[pageerror\]|app failed to boot/.test(logs);
      ok = code === 0 && n === c.frames && !sceneError;
      if (ok) {
        renameSync(part, c.file);
        done++;
        const el = (Date.now() - t0) / 1000, left = todo - done - failed.length;
        progress(`${tag} [${c.a.toFixed(2)}, ${c.b.toFixed(2)}) on ${gpu}: ${((Date.now() - s) / 1000).toFixed(0)}s  (${done}/${todo}, ~${(((el / done) * left) / 3600).toFixed(1)} h left)`);
      } else {
        progress(`${tag} attempt ${attempt} failed on ${gpu}: exit ${code}, ${n}/${c.frames} frames${sceneError ? ', scene errors' : ''} (see logs/${tag}.*)`);
        rmSync(part, { force: true });
      }
    }
    if (!ok) failed.push(c.i);
  }
}
await Promise.all(gpus.flatMap((g) => Array.from({ length: perGpu }, () => worker(g))));
vite?.kill();

if (failed.length || chunks.some((c) => !existsSync(c.file))) {
  progress(`NOT JOINED: chunks failed ${failed.join(', ')}; rerun the same command to retry them`);
  process.exit(1);
}

// join: concat the video losslessly, cut the audio to the same range
const list = path.join(work, 'concat.txt');
writeFileSync(list, chunks.map((c) => `file '${c.file.replace(/'/g, "'\\''")}'`).join('\n') + '\n'); // concat-demuxer quoting
progress(`joining ${chunks.length} chunks -> ${out}`);
mkdirSync(path.dirname(out), { recursive: true });
const ff = Bun.spawnSync(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(from), '-t', String(to - from), '-i', path.join(ROOT, 'audio/pdoom.mp3'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...(h265 ? ['-tag:v', 'hvc1'] : []), '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out], { stderr: 'pipe' });
const total = Math.round(to * fps) - Math.round(from * fps);
const n = existsSync(out) ? frameCount(out) : 0;
if (ff.exitCode !== 0 || n !== total) {
  progress(`JOIN FAILED: exit ${ff.exitCode}, ${n}/${total} frames\n${ff.stderr.toString()}`);
  process.exit(1);
}
progress(`DONE ${out}: ${n} frames in ${((Date.now() - t0) / 3600000).toFixed(2)} h (chunks kept in ${work})`);
