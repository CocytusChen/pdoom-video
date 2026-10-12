// "Without a single CDR": the lyric as a Lisp list, drawn in box-and-pointer notation in world
// units on the same drawing sheet as the roadmap (north of it). Each sung word is consed into a
// cell as it is sung, its car holding the word, and the previous cell's cdr pointer shoots across
// to it. The last cell's car is CDR itself. Then, one syllable at a time, C, D, R, the three cdr
// pointers are cut: each break flashes, the halves recoil, the cell's cdr box is struck through
// (NIL), and the list falls apart into loose atoms drifting off the sheet. Only the last cell's cdr
// box is left, empty and blinking: the rest of the list is the next line, and the box folds into
// the next prompt's caret.
import { Lyrics, type Word } from '../engine/lyrics';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { ease, keys, lerp, prog, TAU } from '../engine/util';

export const LIST = {
  GX: 700, // x of the first cell's left edge
  GL: 560, // y of the cells' centre line
  H: 170, // cell height (and cdr box width)
  PAD: 56, // padding around the word in the car box
  GAP: 230, // pointer length between cells
  WORD: 112, // lyric type size
  BIG: 1.5, // scale of the last cell (CDR)
  CDR: 150, // size of the CDR letters
};

export interface ListTimes {
  words: Word[]; // Without, a, single
  cdr: Word;
  syl: number[]; // C, D, R: the three cuts
  drain0: number; // everything but the empty cdr box starts to fade
  end: number;
}

type Cell = { text: string; s: number; x0: number; x1: number; x2: number; addr: string };
type Pose = { dx: number; dy: number; rot: number };

/** Drift of the loose cells once their cdr is cut: direction (world units) and roll. */
const DRIFT: Pose[] = [{ dx: -70, dy: -95, rot: -0.07 }, { dx: -25, dy: 120, rot: 0.06 }, { dx: 20, dy: -80, rot: -0.04 }];

export class LispList {
  cells: Cell[] = [];
  /** Pointer k runs from cell k's cdr box to cell k + 1, growing over [g0, g1] (g1 = the word's start). */
  links: { g0: number; g1: number; cut: number }[] = [];

  constructor(public T: ListTimes, public pdoom: string) {
    const L = LIST;
    const texts = [...T.words.map((w) => w.w), 'CDR'];
    let x = L.GX;
    texts.forEach((text, i) => {
      const big = i === texts.length - 1;
      const s = big ? L.BIG : 1;
      const tw = big ? measure('CDR', F.mono(700), L.CDR) : measure(text, F.archivo(100, 900), L.WORD);
      const car = Math.max(L.H * s, tw + 2 * L.PAD * s);
      // consecutive conses, 16 bytes apart: the deadpan detail nobody needs
      const addr = `#<CONS #x7F3A${(0x10 + 0x10 * i).toString(16).toUpperCase().padStart(2, '0')}>`;
      this.cells.push({ text, s, x0: x, x1: x + car, x2: x + car + L.H * s, addr });
      x += car + L.H * s + L.GAP;
    });
    const starts = [...T.words.map((w) => w.start), T.cdr.start];
    for (let k = 0; k + 1 < this.cells.length; k++) {
      const g1 = starts[k + 1]!;
      const g0 = Math.max(g1 - 0.12, (T.words[k]?.start ?? g1 - 0.12) + 0.02);
      this.links.push({ g0, g1, cut: T.syl[k]! });
    }
  }

  get start() { return [...this.T.words.map((w) => w.start), this.T.cdr.start]; }
  /** Centre of the cdr box of cell i (at rest). */
  cdrAt(i: number) { const c = this.cells[i]!; return { x: (c.x1 + c.x2) / 2, y: LIST.GL }; }
  /** The empty cdr box of the last cell: what becomes the caret. */
  get slot() { return this.cdrAt(this.cells.length - 1); }
  get DS() { return (LIST.H * LIST.BIG) / 2; }
  get bounds() { return { x0: this.cells[0]!.x0, x1: this.cells[this.cells.length - 1]!.x2 }; }

  /** Where the camera looks while the list is being built: the newest cell. */
  focusX(t: number) {
    const st = this.start, cx = (i: number) => (this.cells[i]!.x0 + this.cells[i]!.x2) / 2;
    return keys(t, [[st[0]! - 0.3, cx(0)], ...this.links.map((l, k) => [l.g1 - 0.02, cx(k + 1), ease.inOutCubic] as [number, number, (x: number) => number])]);
  }

  /** The loose cells drift off once their own cdr is cut; the last cell stays put. */
  pose(i: number, t: number): Pose {
    const d = DRIFT[i];
    const l = this.links[i];
    if (!d || !l || t < l.cut) return { dx: 0, dy: 0, rot: 0 };
    const k = 0.45 * ease.outCubic(prog(t, l.cut, l.cut + 0.5)) + 0.55 * prog(t, l.cut, this.T.end);
    return { dx: d.dx * k, dy: d.dy * k, rot: d.rot * k };
  }

  /** Spark on the pointer being consed (its arrow head), or null. */
  headAt(t: number) {
    for (const [k, l] of this.links.entries()) {
      if (t < l.g0 || t > l.g1 + 0.06) continue;
      const a = this.cdrAt(k), b = this.cells[k + 1]!.x0;
      return { x: lerp(a.x, b, ease.inOutQuad(prog(t, l.g0, l.g1))), y: LIST.GL };
    }
    return null;
  }
  /** Pointer k's end points (cdr dot of cell k, left edge of cell k + 1), following both cells' drift. */
  linkEnds(k: number, t: number) {
    const a = this.cdrAt(k), pa = this.pose(k, t), pb = this.pose(k + 1, t);
    return { ax: a.x + pa.dx, ay: a.y + pa.dy, bx: this.cells[k + 1]!.x0 + pb.dx, by: LIST.GL + pb.dy };
  }
  /** Where pointer k breaks. */
  breakAt(k: number, t: number) {
    const { ax, ay, bx, by } = this.linkEnds(k, t);
    return { x: (ax + bx) / 2, y: (ay + by) / 2 };
  }

  /**
   * Draw in world units (the caller set the world transform). `px` = world units per screen px.
   * `keep` fades everything except the empty cdr box (the hand-off); `morph` turns it into the caret.
   */
  draw(c: CanvasRenderingContext2D, t: number, px: number, o: { alpha: number; keep: number; morph: number; caret: { hw: number; hh: number } }) {
    const T = this.T, L = LIST;
    const A = o.alpha * o.keep;
    c.save();
    c.textBaseline = 'alphabetic';
    c.lineCap = 'butt';
    if (A > 0.002) {
      c.globalAlpha = A;
      const x0 = this.cells[0]!.x0;
      const vis = prog(t, T.words[0]!.start - 0.3, T.words[0]!.start);
      // title
      c.globalAlpha = A * vis;
      c.textAlign = 'left';
      c.font = font(F.mono(600), 36); c.fillStyle = rgba('bone', 0.95);
      c.fillText('THE LYRIC, AS A LIST', x0, L.GL - 290);
      c.font = font(F.mono(400), 24); c.fillStyle = rgba('ash', 0.9);
      c.fillText('BOX-AND-POINTER · ONE CONS PER WORD', x0, L.GL - 252);
      c.globalAlpha = A;
      for (let k = 0; k < this.links.length; k++) this.drawLink(c, t, k);
      for (let i = 0; i < this.cells.length; i++) this.drawCell(c, t, i);
      this.drawNotes(c, t);
    }
    c.globalAlpha = o.alpha;
    this.drawSlot(c, t, px, o);
    c.restore();
  }

  private drawLink(c: CanvasRenderingContext2D, t: number, k: number) {
    const l = this.links[k]!;
    if (t < l.g0) return;
    const { ax, ay, bx, by } = this.linkEnds(k, t);
    const ga = c.globalAlpha;
    const hot = t < l.g1 + 0.2 || (t >= l.cut && t < l.cut + 0.15);
    c.strokeStyle = hot ? rgba('signal', 1) : rgba('bone', 0.85);
    c.fillStyle = c.strokeStyle;
    c.lineWidth = 4;
    const AH = 30, AW = 13; // arrow head
    const head = (x: number, y: number, a: number) => {
      c.globalAlpha = ga * a;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - AH, y - AW); c.lineTo(x - AH, y + AW); c.closePath(); c.fill();
    };
    if (t < l.cut) {
      // growing, then whole
      const k2 = ease.inOutQuad(prog(t, l.g0, l.g1));
      const tx = lerp(ax, bx, k2);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(Math.max(ax, tx - AH * 0.6), lerp(ay, by, k2)); c.stroke();
      if (k2 > 0.05) head(tx, lerp(ay, by, k2), 1);
      c.globalAlpha = ga;
      return;
    }
    // cut: the halves recoil from the break and fade
    const e = t - l.cut;
    const r = ease.outExpo(prog(e, 0, 0.3));
    const a = 1 - prog(e, 0.15, 0.6);
    if (a <= 0) return;
    const mx = (ax + bx) / 2, my = (ay + by) / 2, gap = 14;
    const lEnd = lerp(mx - gap, ax + (LIST.H * this.cells[k]!.s) / 2, r);
    const rStart = lerp(mx + gap, bx - AH, r);
    c.globalAlpha = ga * a;
    c.beginPath(); c.moveTo(ax + (LIST.H * this.cells[k]!.s) / 2, lerp(ay, my, 0.5 * (1 - r))); c.lineTo(lEnd, lerp(my, ay, r)); c.stroke();
    if (rStart < bx - AH) { c.beginPath(); c.moveTo(rStart, lerp(my, by, r)); c.lineTo(bx - AH * 0.6, by); c.stroke(); }
    head(bx, by, a);
    // the snap: short shards flying off the break
    const sa = 1 - prog(e, 0, 0.22);
    if (sa > 0) {
      c.globalAlpha = ga * sa;
      c.strokeStyle = rgba('ember', 1); c.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const an = (i / 7) * TAU + 0.35 + k;
        const r0 = 20 + 120 * ease.outCubic(prog(e, 0, 0.22)), r1 = r0 + 34 * sa;
        c.beginPath(); c.moveTo(mx + Math.cos(an) * r0, my + Math.sin(an) * r0); c.lineTo(mx + Math.cos(an) * r1, my + Math.sin(an) * r1); c.stroke();
      }
    }
    c.globalAlpha = ga;
  }

  private drawCell(c: CanvasRenderingContext2D, t: number, i: number) {
    const L = LIST, T = this.T;
    const cell = this.cells[i]!, s = cell.s, H = L.H * s;
    const last = i === this.cells.length - 1;
    const w: Word = last ? T.cdr : T.words[i]!;
    const vis = prog(t, w.start - 0.3, w.start - 0.04);
    if (vis <= 0) return;
    const on = t >= w.start;
    const p = last ? (t >= w.start ? 1 : 0) : Lyrics.wordProgress(w, t);
    const pose = this.pose(i, t);
    const ga = c.globalAlpha;
    // the cons: a slam on the word's start
    const k = on ? 1 + 0.1 * Math.pow(0.5, (t - w.start) / 0.05) : 1;
    const cx = (cell.x0 + cell.x2) / 2;
    c.save();
    c.translate(cx + pose.dx, L.GL + pose.dy); c.rotate(pose.rot); c.scale(k, k); c.translate(-cx, -L.GL);
    const y0 = L.GL - H / 2;
    c.globalAlpha = ga * (on ? 1 : 0.45 * vis);
    c.fillStyle = rgba('ink', 0.94);
    c.fillRect(cell.x0, y0, cell.x2 - cell.x0, H);
    c.strokeStyle = on ? rgba('bone', 1) : rgba('ash', 1);
    c.lineWidth = 4; c.lineJoin = 'miter';
    c.strokeRect(cell.x0, y0, cell.x1 - cell.x0, H);
    if (!last) c.strokeRect(cell.x1, y0, cell.x2 - cell.x1, H);
    // cdr box: a dot once its pointer leaves, struck through (NIL) once it is cut
    const l = this.links[i];
    if (l && t >= l.g0 && t < l.cut) {
      c.fillStyle = rgba('bone', 1);
      c.beginPath(); c.arc((cell.x1 + cell.x2) / 2, L.GL, 11, 0, TAU); c.fill();
    }
    if (l && t >= l.cut) {
      const e = t - l.cut, q = ease.outCubic(prog(e, 0, 0.1));
      c.strokeStyle = e < 0.35 ? rgba('signal', 1) : rgba('bone', 1);
      c.lineWidth = 5;
      const ax = cell.x1 + 12, ay = y0 + H - 12, bx = cell.x2 - 12, by = y0 + 12;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, q), lerp(ay, by, q)); c.stroke();
    }
    // the car: the word
    if (last) this.drawCDR(c, t, cell);
    else {
      c.font = font(F.archivo(100, 900), L.WORD);
      c.textAlign = 'center';
      c.fillStyle = p <= 0 ? rgba('bone', 0.3) : p < 1 ? rgba('signal', 1) : rgba('bone', 1);
      c.fillText(cell.text, (cell.x0 + cell.x1) / 2, L.GL + L.WORD * 0.36);
      // sung progress, a hairline under the word
      if (p > 0) {
        c.fillStyle = p < 1 ? rgba('signal', 1) : rgba('ash', 0.8);
        c.fillRect(cell.x0 + L.PAD, L.GL + H / 2 - 30, (cell.x1 - cell.x0 - 2 * L.PAD) * p, 6);
      }
    }
    // the address, under the cell
    c.textAlign = 'left';
    c.font = font(F.mono(400), 24); c.fillStyle = rgba('graphite', 1);
    c.fillText(cell.addr, cell.x0, L.GL + H / 2 + 40);
    c.restore();
    c.globalAlpha = ga;
  }

  /** The last car: CDR, its letters lit one per syllable, with a footnote asterisk. */
  private drawCDR(c: CanvasRenderingContext2D, t: number, cell: Cell) {
    const L = LIST, T = this.T;
    c.font = font(F.mono(700), L.CDR);
    const wch = c.measureText('C').width;
    const lx = (cell.x0 + cell.x1) / 2 - 1.5 * wch, base = L.GL + L.CDR * 0.36;
    c.textAlign = 'center';
    ['C', 'D', 'R'].forEach((ch, k) => {
      const ts = T.syl[k]!;
      const lit = t >= ts;
      const pop = lit ? 1 + 0.3 * Math.pow(0.5, (t - ts) / 0.05) : 1;
      c.save();
      c.translate(lx + wch * (k + 0.5), L.GL); c.scale(pop, pop);
      c.fillStyle = lit ? rgba('signal', 1) : rgba('bone', 0.3);
      c.fillText(ch, 0, base - L.GL);
      c.restore();
    });
    const sa = prog(t, T.syl[0]!, T.syl[0]! + 0.1);
    if (sa > 0) {
      c.textAlign = 'left';
      c.font = font(F.mono(700), 64); c.fillStyle = rgba('signal', sa);
      c.fillText('*', lx + 3 * wch + 4, base - L.CDR * 0.5);
    }
  }

  /** The status line and footnote under the list, and the P(doom) cameo at the prompt. */
  private drawNotes(c: CanvasRenderingContext2D, t: number) {
    const L = LIST, T = this.T;
    const [C, D, R] = T.syl as [number, number, number];
    const ga = c.globalAlpha;
    const nx = this.cells[2]!.x0, ny = L.GL + (L.H * L.BIG) / 2 + 120;
    c.textAlign = 'left';
    const sa = prog(t, D - 0.02, D + 0.05);
    if (sa > 0) {
      c.globalAlpha = ga * sa;
      c.font = font(F.mono(600), 40); c.fillStyle = rgba('signal', 1);
      c.fillText('CDR CALLS ON THE WAY TO AGI: 0', nx, ny);
    }
    const fa = prog(t, C + 0.3, C + 0.45);
    if (fa > 0) {
      c.globalAlpha = ga * fa;
      c.font = font(F.mono(400), 30); c.fillStyle = rgba('ash', 1);
      c.fillText('* CDR: Contents of the Decrement part of Register (IBM 704).', nx, ny + 58);
      c.fillText('  Returns the rest of a list. Usually pronounced “could-er”.', nx, ny + 100);
    }
    // P(doom), asked at the REPL: always within tolerance
    const pa = prog(t, R + 0.25, R + 0.4);
    if (pa > 0) {
      c.globalAlpha = ga * pa;
      const py = ny + 190;
      c.font = font(F.mono(500), 34); c.fillStyle = rgba('bone', 1);
      c.fillText('> (p-doom)', nx, py);
      c.font = font(F.mono(400), 34); c.fillStyle = rgba('ash', 1);
      c.fillText(`${this.pdoom} ; within tolerance`, nx, py + 46);
    }
    c.globalAlpha = ga;
  }

  /** The last cell's cdr box: empty while the list is built, blinking once it is alone; finally the caret. */
  private drawSlot(c: CanvasRenderingContext2D, t: number, px: number, o: { alpha: number; keep: number; morph: number; caret: { hw: number; hh: number } }) {
    const T = this.T;
    const w = T.cdr;
    const vis = prog(t, w.start - 0.3, w.start - 0.04);
    if (vis <= 0) return;
    const on = t >= w.start;
    const r = this.DS;
    const R = T.syl[2]!;
    const beat = 60 / 132; // the song's tempo (132.007 BPM)
    const alone = t >= R;
    const blinkOn = !alone || Math.floor((t - R) / (beat / 2)) % 2 === 0;
    const m = o.morph;
    // the cons slam scales the whole cell about its centre (drawCell): the box moves with it
    const k = on ? 1 + 0.1 * Math.pow(0.5, (t - w.start) / 0.05) : 1;
    const cell = this.cells[this.cells.length - 1]!, ccx = (cell.x0 + cell.x2) / 2;
    const x = ccx + (this.slot.x - ccx) * k, y = this.slot.y;
    const hw = lerp(r * k, o.caret.hw, m), hh = lerp(r * k, o.caret.hh, m);
    c.beginPath(); c.rect(x - hw, y - hh, 2 * hw, 2 * hh);
    if (m > 0) { c.fillStyle = rgba('signal', 0.9 * ease.inQuad(m)); c.fill(); }
    c.setLineDash(alone && m < 0.5 ? [22, lerp(16, 0, m * 2)] : []);
    c.lineJoin = 'miter';
    c.strokeStyle = alone ? rgba('signal', (blinkOn ? 1 : 0.3) * (1 - m)) : on ? rgba('bone', 1 - m) : rgba('ash', 0.45 * vis);
    c.lineWidth = Math.max(4 * (1 - m), 2 * px);
    c.stroke();
    c.setLineDash([]);
    // a hairline note on the empty box, while it waits
    const na = prog(t, R + 0.1, R + 0.25) * o.keep;
    if (na > 0) {
      c.globalAlpha = o.alpha * na;
      c.textAlign = 'center';
      c.font = font(F.mono(400), 30); c.fillStyle = rgba('ash', 1);
      c.fillText('(cdr line) → next line', x, y - r - 30);
      c.globalAlpha = o.alpha;
    }
    c.textAlign = 'left';
  }
}
