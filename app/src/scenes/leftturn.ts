// "Trajectory, revised". Verse 3, part 2. One continuous drawing sheet, the camera never at rest.
// The line is about symbolic AI: Lisp was to be the road to AGI, and AGI arrived "without a single
// cdr" (the Lisp list operation), by the numeric route of the line before ("Forward MLP, backward,
// repeat"). Symbols are the plan; the thing that arrives is all numbers.
//  0. The run-in (drawn by `bureau`, which renders this plate under its last page): the spark comes up
//     the list from the south, under the page, bursts through it on the beat before the cut and
//     burns it in two; the held camera picks up the chase as it nears the top, and the halves swing away.
//  1. "Sharp left turn": the symbolic roadmap to AGI drawn as a Lisp list in box-and-pointer
//     notation (LISP · SHRDLU · CADR · EXPERT SYSTEMS · AGI, then NIL), every step a cdr pointer;
//     the spark runs the planned route, evaluating the cells it passes, lyrics painted on it as
//     road markings; on "left" it swerves 90° and the camera whips round with it (true multi-tap
//     motion blur), leaving the plan.
//  2. "and there you are": AND / THERE keep being painted on the new road as the spark brakes
//     into terra incognita; on "there" it lands in a crater, a survey marker drops and the
//     contour lines ripple. On "you" the camera cranes out with a quarter-turn: the crater is an
//     eye, the terrain is the mask (a topographic smile). YOU / ARE are stamped on it as map
//     labels; the second eye lights; its spot heights are weights, not symbols; a deadpan callout
//     files it as an unplanned object.
//  3. "Without a single CDR": a whip north to the lyric itself, drawn as a list on the same sheet:
//     each word is consed into a cell as it is sung, the previous cdr pointer shooting across to
//     it, the last car being CDR. Then each syllable, C, D, R, cuts one of the three pointers (a
//     snap, a NIL slash through the cdr box) and the list falls apart into loose atoms. Everything
//     drains but the last cell's empty cdr box, which folds into the orange caret of the next
//     prompt: the rest of the list is the next line.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { rgba } from '../engine/palette';
import { F, font, layout } from '../engine/type';
import { Lyrics, norm, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, keys, lerp, prog, pulse } from '../engine/util';
import { sparkHead, sparkParticles } from './_motifs';
import { MAP, FACE, EYE_R, routeAt, ROUTE_LA, ROUTE_LC, ROUTE_EYE, cellBox, mapTextures, makeMapPass, WorldLayer } from './leftturn-map';
import { LIST, LispList } from './leftturn-list';
import { PDoom, formatPDoom } from '../engine/hud';

function wordOf(l: Line, s: string): Word {
  const q = norm(s);
  return l.words.find((w) => norm(w.w).includes(q)) ?? l.words[0]!;
}

type Cam = { x: number; y: number; rot: number; zoom: number };

/** Blend two camera poses (zoom in log space). */
function mixCam(a: Cam, b: Cam, k: number): Cam {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), rot: lerp(a.rot, b.rot, k), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k)) };
}

/** Spot heights on the unplanned object (face units, value): weights, where a map would have symbols. */
const SPOTS: [number, number, string][] = [
  [-0.66, -0.4, '0.0137'], [0.62, -0.52, '−0.4421'], [-0.82, 0.1, '1.2e−3'], [-0.14, -0.02, '−0.0019'],
  [-0.64, 0.46, '0.2208'], [0.62, 0.4, '−0.0716'], [-0.08, 0.24, '0.5003'],
  [-1.25, -0.35, '0.0094'], [-1.1, 0.78, '−1.307'], [0.2, 1.08, '0.0661'], [1.1, 0.75, '−0.0352'], [-0.4, -1.1, '0.0008'],
];

/** The gato prompt's caret on its first frame (screen px): the slot lands exactly there. */
const CARET = { x: 1150, y: 631, w: 5.6, h: 86 };

/**
 * The run-in, under and through the bureau's last page. The camera is held (tilting up by `drift` px over the
 * beat before the burst); the spark smoulders north at `creep` (map units/s), its head coming into the frame
 * (screen y `enter`) on the off-beat before the burst; on the burst it flares up to `speed`, which it keeps to
 * LISP. The camera picks up the chase as the head reaches screen y `park` (`hold`: how softly, map units), then
 * eases ahead of it into the roadmap's framing by the turn.
 */
const RUN = { creep: 800, speed: 3600, zoom: 0.86, enter: 1100, park: 350, drift: 36, hold: 60 };

/** Soft max(d, 0): 0 well below, d well above, a smooth knee about 0 of width k (never decreasing). */
function softPos(d: number, k: number) {
  return d > 0 ? d + k * Math.log1p(Math.exp(-d / k)) : k * Math.log1p(Math.exp(d / k));
}

export default class LeftTurn extends Scene {
  map!: ReturnType<typeof makeMapPass>;
  ov = new WorldLayer();
  glow = new LineBatch(6000);
  pd!: PDoom;
  lst!: LispList;
  /** Rendered inside `bureau`'s transition: that plate draws the spark itself, over its page. */
  embedded = false;
  /** The held camera of the run-in (map y, before its drift), and the lead (map units) it picks the spark up at. */
  holdY = 0;
  leadPark = 0;
  beat = 0.4545;
  T = {
    l5: null as unknown as Line, l6: null as unknown as Line,
    sharp: 0, left: 0, turn: 0, and: 0, there: 0, you: 0, youEnd: 0, are: 0, without: 0, cdr: 0,
    tShrdlu: 0, db1: 0, call: 0, whip0: 0, drain0: 0, cdrSyl: [] as number[], burst: 0,
  };

  override init() {
    const tx = mapTextures();
    this.map = makeMapPass(tx.map, tx.marks, this.ov);
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    this.pd = new PDoom(ly);
    const T = this.T;
    const beatAfter = (t: number) => au.timeOfBeat(Math.ceil(au.beatAt(t) - 1e-6));
    const beatBefore = (t: number) => au.timeOfBeat(Math.floor(au.beatAt(t) + 1e-6));
    const downAfter = (t: number) => au.downbeats.find((d) => d >= t - 1e-6) ?? beatAfter(t);
    T.l5 = ly.get('Sharp left');
    T.l6 = ly.get('single CDR');
    T.sharp = wordOf(T.l5, 'sharp').start;
    T.left = wordOf(T.l5, 'left').start;
    T.turn = wordOf(T.l5, 'turn').start;
    T.and = wordOf(T.l5, 'and').start;
    T.there = wordOf(T.l5, 'there').start;
    const you = wordOf(T.l5, 'you');
    T.you = you.start; T.youEnd = you.end;
    T.are = wordOf(T.l5, 'are').start;
    T.without = wordOf(T.l6, 'without').start;
    const cdr = wordOf(T.l6, 'cdr');
    T.cdr = cdr.start;
    T.cdrSyl = cdr.syl && cdr.syl.length >= 3 ? cdr.syl.map((s) => s[0]) : [0, 1, 2].map((i) => cdr.start + i * 0.4);
    T.tShrdlu = beatAfter(T.sharp + 0.12);
    // the spark bursts through the bureau's page on the beat before the cut; the camera is held so that
    // its head comes into the frame there
    T.burst = beatBefore(this.ctx.start - 0.05);
    this.beat = au.timeOfBeat(Math.round(au.beatAt(T.burst)) + 1) - T.burst;
    T.db1 = downAfter(T.you);
    T.call = beatAfter(T.are + 0.2);
    T.whip0 = Math.max(beatBefore(T.without), T.without - 0.3) - 0.03;
    T.drain0 = beatBefore(this.ctx.end - 0.05);
    const head = T.l6.words.filter((w) => norm(w.w) !== 'cdr');
    this.lst = new LispList({ words: head, cdr, syl: T.cdrSyl, drain0: T.drain0, end: this.ctx.end }, formatPDoom(this.pd.value(T.without)));
    // screen y -> camera-relative map units at the run-in zoom (the inverse of the keystone)
    const K = this.kAt(T.burst), unproject = (y: number) => (y - H / 2) / (1 + K * (y - H / 2)) / RUN.zoom;
    const tIn = T.burst - this.beat / 2;
    this.holdY = MAP.Y0 - this.runIn(tIn) - unproject(RUN.enter) + this.driftAt(tIn) / RUN.zoom;
    this.leadPark = unproject(RUN.park);
  }

  // ---------------------------------------------------------------- the spark on the route
  /**
   * Arc length on the run-in (negative: south of the `roadmap` variable): RUN.creep under the page, smoothly up
   * to RUN.speed across the burst, at LISP on "Sharp". Closed form of the integral of that speed.
   */
  runIn(t: number) {
    const T = this.T, a = T.burst - 0.03, b = T.burst + 0.1, lisp = MAP.Y0 - MAP.ms[0]!.y;
    const ramp = (t: number) => {
      const u = clamp((t - a) / (b - a));
      return t >= b ? (b - a) / 2 + (t - b) : (b - a) * (u * u * u - (u * u * u * u) / 2);
    };
    const dist = (t: number) => RUN.creep * t + (RUN.speed - RUN.creep) * ramp(t);
    return lisp - (dist(T.sharp) - dist(t));
  }

  sparkS(t: number) {
    const T = this.T;
    const lisp = MAP.Y0 - MAP.ms[0]!.y, shrdlu = MAP.Y0 - MAP.ms[1]!.y;
    const tc = T.left + 0.13, sc = ROUTE_LA + ROUTE_LC + 40;
    if (t < T.sharp) return this.runIn(t);
    if (t < tc) {
      return keys(t, [[T.sharp, lisp], [T.tShrdlu, shrdlu, ease.linear], [T.left, ROUTE_LA - 10, ease.linear], [tc, sc, ease.linear]]);
    }
    // out of the corner at speed, braking into the crater on "there" (cubic Hermite, v1 = 0)
    const D = ROUTE_EYE - sc, dur = T.there - tc, v0 = (ROUTE_LC + 50) / 0.13;
    const u = clamp((t - tc) / dur);
    return sc + (u * u * u - 2 * u * u + u) * v0 * dur + (-2 * u * u * u + 3 * u * u) * D;
  }

  // ---------------------------------------------------------------- camera
  /** Hold, chase, brake, land: the camera rides behind the spark, then settles over the crater. */
  camLand(t: number): Cam {
    const T = this.T;
    const sp = routeAt(this.sparkS(t));
    const turn = (Math.PI / 2) * prog(t, T.left - 0.02, T.left + 0.24, ease.inOutCubic);
    const hx = -Math.sin(turn), hy = -Math.cos(turn); // forward (screen up) in world coords
    const lead = keys(t, [[T.burst + 0.25, this.leadPark], [T.left - 0.05, 230, ease.inOutCubic], [T.turn + 0.25, 230], [T.and, -40, ease.inOutQuad], [T.there, 20, ease.inOutQuad]]);
    let zoom = keys(t, [[T.sharp, RUN.zoom], [T.left, 1.0, ease.inOutQuad], [T.left + 0.2, 1.12, ease.outCubic], [T.turn + 0.3, 0.95, ease.inOutQuad], [T.there, 1.02, ease.inOutCubic]]);
    // the landing punch, then a slow creep in
    zoom *= 1 + 0.32 * ease.outExpo(prog(t, T.there, T.there + 0.3)) + 0.07 * prog(t, T.there + 0.3, T.you, ease.inOutQuad);
    if (t > T.there + 0.2) zoom *= 1 + 0.03 * this.ctx.audio.hit('kick', t, 0.09);
    const rot = turn + 0.09 * prog(t, T.there, T.you + 0.2, ease.inOutQuad);
    let y = sp.y + hy * lead;
    // the run-in: held over the bureau's page until the spark has come up to its place, then carried along
    // with it (by the turn the knee is thousands of units behind: exactly the chase)
    if (t < T.left) {
      const hold = this.holdY - this.driftAt(t) / RUN.zoom;
      y = hold - softPos(hold - y, RUN.hold);
    }
    return { x: sp.x + hx * lead, y, rot, zoom };
  }

  /** The reveal: the whole face, north up. */
  camWide(t: number): Cam {
    const T = this.T;
    // lands on the downbeat, punches on "are", reframes tighter with a roll on the snare
    const snap = ease.outExpo(prog(t, T.call, T.call + 0.22));
    const z = 0.43 * (1 + 0.05 * prog(t, T.db1, T.whip0 + 0.1, ease.inOutQuad)) * (1 + 0.05 * pulse(t, T.are, 0.1)) * (1 + 0.17 * snap);
    const rot = -0.02 * prog(t, T.db1, T.call, ease.inOutQuad) + 0.045 * ease.outBack(prog(t, T.call, T.call + 0.3));
    return { x: FACE.x + 60 - 150 * snap, y: FACE.y + 40 + 45 * snap, rot, zoom: z };
  }

  /** Riding the list as it is consed: the newest cell right of centre, a punch on each new cell. */
  camTrack(t: number): Cam {
    const st = this.lst.start;
    let z = 0.98 * (1 + 0.04 * ease.outExpo(prog(t, st[1]!, st[1]! + 0.25)));
    z *= 1 + 0.05 * pulse(t, st[1]!, 0.08) + 0.06 * pulse(t, st[2]!, 0.08);
    const rot = -0.025 + 0.045 * ease.outBack(prog(t, st[2]!, st[2]! + 0.35));
    const off = this.screenToWorldOffset(-230, 0, rot, z);
    return { x: this.lst.focusX(t) + off.x, y: LIST.GL - 30 + off.y, rot, zoom: z };
  }

  /** The whole list, punching on each syllable as its pointer is cut, rolling on the snares. */
  camAll(t: number): Cam {
    const T = this.T, b = this.lst.bounds;
    const [C, D, R] = T.cdrSyl as [number, number, number];
    let z = (W * 0.88) / (b.x1 - b.x0 + 200);
    z *= 1 + 0.06 * prog(t, C, this.ctx.end, ease.inOutQuad);
    z *= 1 + 0.07 * pulse(t, C, 0.1) + 0.08 * pulse(t, D, 0.1) + 0.1 * pulse(t, R, 0.1);
    let roll = 0;
    for (const s of this.ctx.audio.events('snare', C + 0.2, D - 0.05).map((e) => e[0])) { z *= 1 + 0.04 * pulse(t, s, 0.1); roll += 0.012 * ease.outBack(prog(t, s, s + 0.25)); }
    const rot = roll + 0.02 * ease.outExpo(prog(t, D, D + 0.14)) - 0.035 * ease.outExpo(prog(t, R, R + 0.14));
    return { x: (b.x0 + b.x1) / 2 + 30, y: LIST.GL + 40, rot, zoom: z };
  }

  /**
   * The whole list; once it is cut, a slow reframe that leaves the loose atoms behind and puts the
   * empty cdr box where the prompt's caret will be; then the push onto it.
   */
  camEnd(t: number): Cam {
    const T = this.T, end = this.ctx.end;
    const wide = this.camAll(t);
    const R = T.cdrSyl[2]!;
    const k1 = ease.inOutCubic(prog(t, R + 0.15, T.drain0 + 0.1));
    const k2 = ease.inOutCubic(prog(t, T.drain0, end - 0.07));
    const z = wide.zoom * Math.exp(lerp(0, Math.log(1.4), k2));
    const s = this.lst.slot;
    const anch: Cam = { x: s.x - (CARET.x - W / 2) / z, y: s.y - (CARET.y - H / 2) / z, rot: 0, zoom: z };
    const c = mixCam(wide, anch, k1);
    c.rot = lerp(wide.rot, 0, Math.max(k1, k2));
    c.zoom = z;
    return c;
  }

  /** World offset that puts the camera centre `dx,dy` screen px away (for a camera at rot, zoom). */
  screenToWorldOffset(dx: number, dy: number, rot: number, zoom: number) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return { x: (c * dx + s * dy) / zoom, y: (-s * dx + c * dy) / zoom };
  }

  camAt(t: number): Cam {
    const T = this.T;
    if (t < T.you) return this.camLand(t);
    const revEnd = T.db1 + 0.12;
    if (t < T.whip0) return mixCam(this.camLand(Math.min(t, revEnd)), this.camWide(t), 1 - Math.pow(1 - prog(t, T.you, revEnd), 3.2));
    if (t < T.without) {
      const k = ease.inOutCubic(prog(t, T.whip0, T.without));
      const c = mixCam(this.camWide(t), this.camTrack(t), k);
      c.zoom *= 1 - 0.45 * Math.sin(Math.PI * k);
      return c;
    }
    if (t < T.cdr - 0.02) return this.camTrack(t);
    // on C the camera pulls back to the whole list, where the cuts happen
    return mixCam(this.camTrack(Math.min(t, T.cdr + 0.25)), this.camEnd(t), ease.outExpo(prog(t, T.cdr - 0.02, T.cdr + 0.25)));
  }

  kAt(t: number) {
    const T = this.T;
    return keys(t, [[T.you, 0.00035], [T.db1 + 0.1, 0.0002, ease.inOutCubic], [T.without, 0.00016, ease.inOutCubic], [T.cdr + 0.3, 0.00016], [T.drain0, 0.0001, ease.linear], [this.ctx.end - 0.08, 0, ease.inOutCubic]]);
  }

  /** How whip-like the camera move is right now (drives the in-shader shutter). */
  whipAt(t: number) {
    const T = this.T;
    return Math.max(
      prog(t, T.left - 0.05, T.left + 0.05) * (1 - prog(t, T.left + 0.2, T.left + 0.3)),
      prog(t, T.you, T.you + 0.05) * (1 - prog(t, T.db1 - 0.05, T.db1 + 0.1)),
      prog(t, T.whip0, T.whip0 + 0.05) * (1 - prog(t, T.without - 0.03, T.without + 0.03)),
      prog(t, T.cdr - 0.02, T.cdr) * (1 - prog(t, T.cdr + 0.08, T.cdr + 0.16)),
    );
  }

  /** World (map px, y down) -> screen px with the keystone tilt. */
  project(wx: number, wy: number, c: Cam, K: number) {
    const dx = wx - c.x, dy = wy - c.y;
    const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    const fx = (cs * dx - sn * dy) * c.zoom, fy = (sn * dx + cs * dy) * c.zoom;
    const d = 1 - K * fy;
    return { x: W / 2 + fx / d, y: H / 2 + fy / d };
  }

  /** The spark head on screen. */
  sparkScreen(t: number) {
    const p = routeAt(this.sparkS(t));
    return this.project(p.x, p.y, this.camAt(t), this.kAt(t));
  }

  /** The held camera's slow tilt north over the beat before the burst (screen px). */
  driftAt(t: number) {
    return RUN.drift * ease.inOutQuad(prog(t, this.T.burst - this.beat, this.T.burst));
  }

  /** How far the sheet has slid down the screen since the run-in's held camera (px, at the run-in zoom). */
  slide(t: number) {
    return (this.holdY - this.camAt(t).y) * RUN.zoom;
  }

  /** The spark on the route, and the sparks on the lyric's list, additive over `out`. */
  renderSpark(out: THREE.WebGLRenderTarget, t: number) {
    const T = this.T, cam = this.camAt(t);
    const g = this.glow; g.clear();
    if (t < T.there + 0.5) {
      const headAt = (tt: number) => this.sparkScreen(tt);
      const hp = headAt(t);
      const I = 1 - prog(t, T.there + 0.05, T.there + 0.45);
      sparkParticles(g, t, headAt, { rate: 120, speed: 280, intensity: 1.1 * I, seed: 8, width: 2 });
      sparkHead(g, hp.x, hp.y, t, 1.5 * Math.min(cam.zoom, 1.2), 1.3 * I);
    }
    // on the list: a spark rides each pointer as it is consed, and flashes where each one is cut
    const lst = this.lst;
    if (t > T.without - 0.1 && t < T.drain0) {
      const onScreen = (p: { x: number; y: number } | null, tt: number) => (p ? this.project(p.x, p.y, this.camAt(tt), this.kAt(tt)) : null);
      const headAt = (tt: number) => onScreen(lst.headAt(tt), tt);
      sparkParticles(g, t, headAt, { rate: 110, speed: 240, intensity: 0.9, seed: 12, width: 1.6 });
      const hp = headAt(t);
      if (hp) sparkHead(g, hp.x, hp.y, t, 0.9 * Math.min(Math.sqrt(cam.zoom), 1.5), 1.2);
      lst.links.forEach((l, k) => {
        if (t < l.cut || t > l.cut + 0.5) return;
        const at = (tt: number) => (tt >= l.cut && tt < l.cut + 0.05 ? onScreen(lst.breakAt(k, tt), tt) : null);
        sparkParticles(g, t, at, { rate: 420, speed: 380, intensity: 1.2, seed: 20 + k, width: 1.6 });
        const I = pulse(t, l.cut, 0.09);
        const p = onScreen(lst.breakAt(k, t), t)!;
        if (I > 0.02) sparkHead(g, p.x, p.y, t, 1.3 * Math.min(Math.sqrt(cam.zoom) * 1.4, 1.5), 1.6 * I);
      });
    }
    g.render(this.ctx.renderer, out);
  }

  // ---------------------------------------------------------------- render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const T = this.T, t = f.t, end = this.ctx.end;
    const cam = this.camAt(t);
    const K = this.kAt(t);
    const whip = this.whipAt(t);
    const shutter = lerp(1 / 300, 1 / 80, whip);
    const camB = this.camAt(t - shutter);
    const u = this.map.u;
    (u.uCamA!.value as THREE.Vector4).set(cam.x, cam.y, cam.rot, cam.zoom);
    (u.uCamB!.value as THREE.Vector4).set(camB.x, camB.y, camB.rot, camB.zoom);
    const pa = this.project(cam.x + 900, cam.y - 500, cam, K), pb = this.project(cam.x + 900, cam.y - 500, camB, K);
    const pc = this.project(cam.x - 900, cam.y + 500, cam, K), pd = this.project(cam.x - 900, cam.y + 500, camB, K);
    const motion = Math.max(Math.hypot(pa.x - pb.x, pa.y - pb.y), Math.hypot(pc.x - pd.x, pc.y - pd.y));
    u.uTaps!.value = clamp(Math.ceil(motion / 3), 1, 16);
    u.uK!.value = K;
    u.uT!.value = t;
    // the whole drawing is there from the start: the bureau's page burns open onto it
    u.uReveal!.value = -2000;
    u.uTrail!.value = this.sparkS(t);
    u.uHeat!.value = 1;
    u.uHaze!.value = keys(t, [[T.you, 0.55], [T.db1, 0.3], [T.without, 0.2], [end - 0.1, 0]]);
    // the drain: the sheet goes dark, only the slot remains
    const drain = prog(t, T.drain0, end - 0.12, ease.inOutQuad);
    u.uDim!.value = 1 - drain;
    u.uPool!.value = prog(t, T.drain0 + 0.1, end - 0.05, ease.inOutQuad);
    u.uTopo!.value = t < T.without + 0.1 ? 1 : 0;
    const wSharp = wordOf(T.l5, 'sharp'), wLeft = wordOf(T.l5, 'left'), wTurn = wordOf(T.l5, 'turn');
    const wAnd = wordOf(T.l5, 'and'), wThere = wordOf(T.l5, 'there');
    const on = (w: Word) => prog(t, w.start - 0.02, w.start + 0.04);
    const hot = (w: Word) => (t >= w.start && t < w.end + 0.08 ? 1 : 0);
    (u.uMarkOn!.value as THREE.Vector4).set(on(wSharp), on(wLeft), on(wTurn), 0);
    (u.uMarkHot!.value as THREE.Vector4).set(hot(wSharp), hot(wLeft), hot(wTurn), 0);
    (u.uMarkOn2!.value as THREE.Vector2).set(on(wAnd), on(wThere));
    (u.uMarkHot2!.value as THREE.Vector2).set(hot(wAnd), hot(wThere));
    (u.uChecks!.value as THREE.Vector2).set(prog(t, T.sharp, T.sharp + 0.04), prog(t, T.tShrdlu, T.tShrdlu + 0.04));
    (u.uEye!.value as THREE.Vector2).set(prog(t, T.there, T.there + 0.1), prog(t, T.are - 0.02, T.are + 0.08));
    // the face breathes on the beat: ripples through the contours, the eyes flare on the kicks
    const au = this.ctx.audio;
    const bi = Math.floor(au.beatAt(t));
    const rip = [bi, bi - 1].map((b) => {
      const tb = au.timeOfBeat(b), e = t - tb;
      const live = tb > T.there + 0.2 && tb < T.whip0 ? 1 : 0;
      return [1500 * e, live * 0.9 * Math.exp(-e / 0.45)] as const;
    });
    (u.uRip!.value as THREE.Vector4).set(rip[0]![0], rip[0]![1], rip[1]![0], rip[1]![1]);
    u.uEyePulse!.value = t > T.there + 0.2 && t < T.without ? au.hit('kick', t, 0.1) : 0;
    const we = t - T.there;
    (u.uWave!.value as THREE.Vector4).set(EYE_R.x, EYE_R.y, 1700 * Math.max(0, we), we > 0 ? 1.8 * Math.exp(-we / 0.35) : 0);

    // ---- the world overlay (labels, the lyric list), drawn with the current camera
    const L = this.ov;
    L.begin(cam);
    const c = L.c;
    if (t < T.there) this.drawStamps(c, t);
    if (t < T.without + 0.05) this.drawTerrain(c, t);
    if (t >= T.and - 0.3 && t < T.without + 0.05) this.drawArrival(c, t, L.px);
    if (t >= T.whip0 - 0.05) {
      const morph = ease.inOutCubic(prog(t, T.drain0 + 0.08, end - 0.1));
      this.lst.draw(c, t, L.px, {
        alpha: 1, keep: 1 - prog(t, T.drain0, T.drain0 + 0.3, ease.inOutQuad), morph,
        caret: { hw: (CARET.w / 2) / cam.zoom, hh: (CARET.h / 2) / cam.zoom },
      });
    }
    L.upload();
    (u.uOvCam!.value as THREE.Vector4).set(cam.x, cam.y, cam.rot, cam.zoom);
    this.map.render(renderer, out);

    // ---- the spark (inside the bureau's transition that plate draws it, over its page)
    if (!this.embedded) this.renderSpark(out, t);

    // ---- post
    const lst = this.lst;
    const corner = pulse(t, T.left, 0.08);
    const land = pulse(t, T.there, 0.07);
    const consHit = Math.max(...lst.start.slice(1, 3).map((s) => pulse(t, s, 0.06)));
    const sylHit = Math.max(...T.cdrSyl.map((s) => pulse(t, s, 0.06)));
    const sh = 10 * corner + 16 * land + 5 * consHit + 9 * sylHit;
    return {
      bloom: lerp(0.75, 0.7, drain) - 0.2 * prog(t, T.there, T.there + 0.2) * (1 - prog(t, T.you, T.db1)), bloomThreshold: lerp(0.85, 0.95, drain), bloomKnee: lerp(0.5, 0.25, drain),
      vignette: lerp(0.45, 0.6, drain), grain: lerp(0.055, 0.065, drain),
      shake: [Math.sin(t * 93) * sh, Math.cos(t * 71) * sh * 0.8],
      ca: 1.2 + 4 * corner + 5 * whip + 2 * land,
      zoom: 1 + 0.03 * corner,
    };
  }

  // ---------------------------------------------------------------- overlay drawings
  /** "EVALUATED" over the cells the spark passes on the planned route. */
  drawStamps(c: CanvasRenderingContext2D, t: number) {
    const T = this.T;
    const stamp = (i: number, t0: number) => {
      if (t < t0) return;
      const b = cellBox(MAP.ms[i]!);
      const e = t - t0;
      const a = prog(e, 0, 0.03) * (1 - prog(e, 0.5, 0.8));
      c.save(); c.translate(b.x0 + 4, b.y0 - 18); c.rotate(-0.06);
      c.font = font(F.mono(600), 22); c.fillStyle = rgba('signal', a); c.textAlign = 'left';
      c.fillText('EVALUATED', 0, 0);
      c.restore();
    };
    stamp(0, T.sharp);
    stamp(1, T.tShrdlu);
  }

  /** Terra incognita, lettered along the upper rim of the unplanned object (a map label). */
  drawTerrain(c: CanvasRenderingContext2D, t: number) {
    c.save();
    const fam = F.serif(400, true), size = 84;
    c.font = font(fam, size);
    c.fillStyle = rgba('ash', 0.75);
    c.textAlign = 'center';
    const lay = layout('Terra incognita', fam, size);
    const R = FACE.r * 0.8;
    const a0 = -Math.PI / 2 - (lay.width / R) / 2;
    // glyphs at their kerned positions along the arc (the T–e kern tucks the e under the T's arm)
    for (const g of lay.glyphs) {
      const am = a0 + (g.x + g.w / 2) / R;
      c.save();
      c.translate(FACE.x + Math.cos(am) * R, FACE.y + Math.sin(am) * R);
      c.rotate(am + Math.PI / 2);
      c.fillText(g.ch, 0, 0);
      c.restore();
    }
    // spot heights, surveyed once the spark has landed: no symbols on this map, only weights
    const sa = prog(t, this.T.there, this.T.there + 0.25);
    if (sa > 0) {
      c.font = font(F.mono(400), 40);
      c.textAlign = 'left';
      c.fillStyle = rgba('ash', 0.7 * sa);
      for (const [u, v, val] of SPOTS) {
        const x = FACE.x + u * FACE.r, y = FACE.y + v * FACE.r;
        c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
        c.fillText(val, x + 18, y + 14);
      }
    }
    c.restore();
  }

  /** The landing marker, the map labels on the face, the callout. */
  drawArrival(c: CanvasRenderingContext2D, t: number, px: number) {
    const T = this.T;
    const wYou = wordOf(T.l5, 'you'), wAre = wordOf(T.l5, 'are');
    const col = (w: Word, vis: number) => {
      const p = Lyrics.wordProgress(w, t);
      if (p <= 0) return rgba('bone', 0.16 * vis);
      return p < 1 ? rgba('signal', 1) : rgba('bone', 1);
    };
    // the survey marker dropping on the crater
    const e = t - T.there;
    if (e > -0.14) {
      const fall = ease.inQuad(prog(e, -0.14, 0));
      const s = lerp(3.6, 1, fall);
      const ma = prog(e, -0.14, -0.06);
      const R0 = 132;
      c.save();
      c.translate(EYE_R.x, EYE_R.y);
      c.globalAlpha = ma;
      // drop shadow converging as it falls
      if (e < 0) {
        c.strokeStyle = rgba('ink', 0.6); c.lineWidth = 10 * px;
        c.beginPath(); c.arc(40 * (s - 1), 40 * (s - 1), R0 * s, 0, Math.PI * 2); c.stroke();
      }
      c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 3 * px;
      c.beginPath(); c.arc(0, 0, R0 * s, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 2 * px;
      for (let i = 0; i < 4; i++) {
        const an = (i + 0.5) * Math.PI / 2;
        c.beginPath();
        c.moveTo(Math.cos(an) * (R0 - 26) * s, Math.sin(an) * (R0 - 26) * s);
        c.lineTo(Math.cos(an) * (R0 + 44) * s, Math.sin(an) * (R0 + 44) * s);
        c.stroke();
      }
      // shock ring
      if (e > 0) {
        const rr = R0 * (1 + 5 * ease.outCubic(prog(e, 0, 0.5)));
        c.strokeStyle = rgba('signal', 0.8 * (1 - prog(e, 0.05, 0.5))); c.lineWidth = 2.5 * px;
        c.beginPath(); c.arc(0, 0, rr, 0, Math.PI * 2); c.stroke();
      }
      c.restore();
    }

    // YOU / ARE: map labels stamped on the forehead and the chin
    const stampWord = (w: Word, text: string, x: number, y: number, size: number) => {
      const vis = prog(t, w.start - 0.15, w.start);
      if (vis <= 0) return;
      const k = t >= w.start ? 1 + 0.35 * Math.pow(0.5, (t - w.start) / 0.06) : 1;
      c.save();
      c.translate(x, y); c.scale(k, k);
      c.font = font(F.archivo(125, 900), size);
      c.textAlign = 'center';
      c.fillStyle = col(w, vis);
      c.fillText(text, 0, size * 0.36);
      c.restore();
    };
    stampWord(wYou, 'YOU', FACE.x, FACE.y - FACE.r * 0.5, 250);
    stampWord(wAre, 'ARE', FACE.x, FACE.y + FACE.r * 0.72, 250);

    // deadpan callout, filed on the snare
    const ca = prog(t, T.call - 0.01, T.call + 0.04);
    if (ca > 0) {
      const an = -Math.PI * 0.8;
      const ex = FACE.x + Math.cos(an) * FACE.r, ey = FACE.y + Math.sin(an) * FACE.r;
      const k = ease.outExpo(prog(t, T.call, T.call + 0.2));
      const lx = ex - 200 * k, ly = ey - 150 * k;
      c.save();
      c.globalAlpha = ca;
      c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 2 * px;
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(lx, ly); c.lineTo(lx - 700 * k, ly); c.stroke();
      c.fillStyle = rgba('bone', 1);
      c.beginPath(); c.arc(ex, ey, 5 * px, 0, Math.PI * 2); c.fill();
      c.textAlign = 'right';
      c.font = font(F.mono(600), 68); c.fillStyle = rgba('bone', 1);
      c.fillText('UNPLANNED OBJECT', lx, ly - 26);
      c.font = font(F.mono(400), 50); c.fillStyle = rgba('ash', 1);
      c.fillText('not on roadmap · 0 symbols', lx, ly + 66);
      c.restore();
    }
  }
}
