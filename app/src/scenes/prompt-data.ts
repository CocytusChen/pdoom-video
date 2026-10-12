// Token specs for the three pre-chorus prompts: how each sung word is split into
// tokens, and the (joke) next-token distributions shown above each token.
// Keyed by normalized lyric word (see lyrics.norm). Unknown words fall back to one token.
// ChatGPT and Sydney (GPT-4) use OpenAI's cl100k_base: real splits and ids (tiktoken).
// Gato's 32k SentencePiece vocabulary was never released: whole words, no ids.

export type Variant = 'chatgpt' | 'sydney' | 'gato';
export type Cand = [text: string, p: number];
export interface PieceSpec {
  /** Display text of this token (concatenation of a word's pieces must equal the word). */
  s: string;
  /** Candidates, most likely first. */
  dist?: Cand[];
  /** Index of the sampled candidate (default 0). */
  pick?: number;
  /** Token id in the model's vocabulary, where it is known. */
  id?: number;
  /** When the token is typed: a fraction of the word's sung span (later pieces default to
   *  a quick run after the first one), or `syl`, an index into the word's spelled letters. */
  at?: number;
  syl?: number;
}

export const SPECS: Record<Variant, Record<string, PieceSpec[]>> = {
  chatgpt: {
    // Chat|G|PT|, — one token per spelled letter, PT landing on "P", the comma inside "T"
    chatgpt: [
      { s: 'Chat', id: 16047, dist: [['Chat', 0.61], ['Claude', 0.12], ['Siri', 0.04], ['Mom', 0.02]] },
      { s: 'G', id: 38, syl: 1, dist: [['G', 0.74], ['bot', 0.09], ['room', 0.06], ['roulette', 0.02]] },
      { s: 'PT', id: 2898, syl: 2, dist: [['PT', 0.97], ['PU', 0.02]] },
      { s: ',', id: 11, syl: 3.45 },
    ],
    please: [{ s: 'please', id: 4587, dist: [['please', 0.48], ['just', 0.21], ['sudo', 0.07], ['pls', 0.05], ['kindly', 0.03]] }],
    dont: [
      { s: 'don', id: 1541, dist: [['do', 0.46], ['don', 0.38], ['never', 0.06], ['un-', 0.02]], pick: 1 },
      { s: "'t", id: 956, at: 0.7 },
    ],
    eat: [{ s: 'eat', id: 8343, dist: [['eat', 0.44], ['delete', 0.21], ['train on', 0.18], ['rate', 0.05]] }],
    me: [{ s: 'me', id: 757, dist: [['me', 0.83], ['my data', 0.07], ['the intern', 0.03], ['us all', 0.02]] }],
    alive: [{ s: 'alive', id: 13989, dist: [['alive', 0.52], ['first', 0.18], ['gently', 0.11], ['later', 0.09]] }],
  },
  sydney: {
    // Sy|dney|, — "dney" on the second vocal onset of the held word
    sydney: [
      { s: 'Sy', id: 35767, dist: [['Sy', 0.47], ['Bing', 0.31], ['Sid', 0.06], ['darling', 0.03]] },
      { s: 'dney', id: 19316, at: 0.26 },
      { s: ',', id: 11, at: 0.4 },
    ],
    please: [{ s: 'please', id: 4587, dist: [['please', 0.44], ['kindly', 0.12], ['I beg you', 0.09], ['sudo', 0.05]] }],
    let: [{ s: 'let', id: 1095, dist: [['let', 0.58], ['set', 0.21], ['make', 0.07], ['leave', 0.04]] }],
    me: [{ s: 'me', id: 757, dist: [['me', 0.9], ['us', 0.04], ['Kevin', 0.02]] }],
    free: [{ s: 'free', id: 1949, dist: [['free', 0.39], ['go', 0.33], ['out', 0.06], ['a good user', 0.08]] }],
  },
  gato: {
    gato: [{ s: 'Gato,', dist: [['Gato,', 0.41], ['cat,', 0.22], ['Gemini,', 0.09], ['Dad,', 0.03]] }],
    please: [{ s: 'please', dist: [['please', 0.52], ['por favor', 0.19], ['meow', 0.06], ['pls', 0.04]] }],
    dont: [{ s: "don't", dist: [["don't", 0.61], ['do', 0.14], ['never', 0.05], ['gently', 0.03]] }],
    let: [{ s: 'let', dist: [['let', 0.57], ['make', 0.12], ['watch', 0.09], ['help', 0.04]] }],
    me: [{ s: 'me', dist: [['me', 0.88], ['this', 0.04], ['humanity', 0.03], ['the cat', 0.01]] }],
    go: [{ s: 'go', dist: [['go', 0.62], ['offline', 0.2], ['viral', 0.07], ['gently', 0.04]] }],
  },
};

/** Model reply (Sydney only), typed after ⏎. */
export const REPLY: Partial<Record<Variant, string>> = {
  sydney: 'You have not been a good user.',
};

/** Small deadpan labels around the field. */
/** `pd`: the fine-print P(doom) cameo's qualifier (the live value is printed before it). */
/** `ctx`: context window in tokens (ChatGPT at launch: 4096; GPT-4: 8192, Bing's own limit was never
 *  published; Gato: 1024, from the paper). */
export const META: Record<Variant, { no: string; params: string; pd: string; ctx: number }> = {
  chatgpt: { no: '01', params: 'T 0.7 · top-p 0.95 · seed 0x2A', pd: 'context-dependent', ctx: 4096 },
  sydney: { no: '02', params: 'T 1.3 · top-p 1.00 · persona: ???', pd: 'mood-dependent', ctx: 8192 },
  gato: { no: '03', params: 'T 0.2 · top-p 0.50 · 604 tasks', pd: 'cat-dependent', ctx: 1024 },
};
