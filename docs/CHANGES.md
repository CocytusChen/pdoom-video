# Changes in this refined version

This is a refined fork of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (based on commit `fa164b7`, the original's revision 6). The originals of the README and the two docs are kept in [`docs/original/`](original/). This file lists what changed and why. The changes fall into four groups: readings of the lyric that were wrong, facts that were off, visuals reworked in the same style, and the rendering pipeline. [`TREATMENT.md`](TREATMENT.md) and [`ENGINE.md`](ENGINE.md) describe the current state.

Like the original, these changes were worked out in conversation with Claude in Claude Code.

## Readings of the lyric

**"Without a single CDR" (`leftturn`, 81–89 s).** The original read CDR as a Critical Design Review. In the song it is Lisp's `cdr`, as the issue on the original repository pointed out ([mexicat/pdoom-video#1](https://github.com/mexicat/pdoom-video/issues/1)). Lisp was the language of symbolic AI, the road that was supposed to lead to AGI. The plate now opposes symbols (the plan) and numbers (what arrived):
- **The roadmap.** A roadmap to AGI is drawn as a Lisp list in box-and-pointer notation, starting at a variable named `roadmap`: LISP 1958 → SHRDLU 1970 → CADR 1979 (the MIT Lisp machine) → EXPERT SYSTEMS 1980 → AGI, with NIL in the last cdr box. Each cell is labelled with its accessor (`(cadr roadmap)`…). The original's revision 6 transition is kept: the spark comes up this list from under the bureau's last page and burns it in two.
- **The left turn.** The spark swerves off the list into a survey map whose contours turn out to be the mask; there it is an "unplanned object, not on roadmap, 0 symbols".
- **"Without a single CDR."** The lyric itself is consed into a list as it is sung. C, D and R each cut one cdr pointer, under "CDR CALLS ON THE WAY TO AGI: 0", with a footnote: *Contents of the Decrement part of Register* (IBM 704), usually pronounced "could-er".
- **The handoff.** The last empty cdr box folds into the Gato prompt's caret.

**"Your circuits make me nervous" (`open`, 6–9 s).** The original re-routed the unicorn into PCB traces. The author's notes mean circuits in the mechanistic-interpretability sense, so the unicorn now becomes an **attribution graph**, drawn like the transformer-circuits figures:
- **Nodes.** Each part of the unicorn is a square feature node on its layer's row: legs low, horn high, so the silhouette survives in steps.
- **Tokens.** The prompt's tokens (`Draw a unicorn in TikZ.`) sit in boxes at the bottom; the next token, `horn`, is at the top.
- **Wires.** Square-routed wires run in lanes, with weights (+0.90, +0.82, a dashed −0.31) and pulses on the 8ths.
- **Checkpoints.** The training checkpoints and the five-legged checkpoint stay, and that checkpoint grows a fifth leg feature ("leg ×5").

**"Orthogonality thesis blues" (`fuse`, ~108 s).** The B♭ sung after "blues" was labelled "the blue note". The song is in E♭ major and that B♭ is its dominant, so the label now reads "B-flat · not even blue".

## Facts

**Tokens (`prompt` ×3).**
- **Real tokens.** ChatGPT and Sydney (GPT-4) are typed as their real cl100k_base tokens and ids, computed with tiktoken: `Chat|G|PT|,`, `Sy|dney|,`, `don|'t`. The joke next-token distributions are kept, re-hung on the real tokens: `T-800` went with the merged `PT`, and `Sidney` became `Sid`.
- **Context windows.** The counter counts against each model's own window: 4096 (ChatGPT at launch), 8192 (GPT-4), and 1024 (Gato, from its paper).
- **Gato.** Gato's 32k SentencePiece vocabulary was never released, so its words stay whole. Its ids never resolve: they roll through [0, 32000). The frame grows unsteady toward the return key: a ghost, slipping bands, a tremor.
- **Sydney's reply** is the meme's own line: "You have not been a good user."

**Training loss (`loss`, 9–16 s).**
- **The cliff.** It was annotated "grokking (?)". Grokking is a late drop in *test* loss, while the chart is `train/loss`, so the cliff is now "phase transition (?)".
- **The "local min." labels** sat on the slope of the basin, where there is no minimum. The terrain now has a shallow dimple (a true local minimum) and a low bump whose flank holds a **saddle point**. Both labels sit on the critical points, found with Newton's method.

**"We had a stable training run" (`spacetime`, 38–42 s).** The scope showed a sine wave, which read as a loss curve but isn't one. Now:
- **The curve.** CH1 is `train/loss` over tokens, shaped like the published pre-training curves: the warmup's flat start, a fast drop, then a long fuzzy tail with no spike. The readout boasts the way recent reports do: "0 loss spikes · 0 rollbacks".
- **The camera.** The beam runs right and down the curve writing the lyric, and the camera follows it. It stops on "But" at exactly the point where the black hole opens on "now", and the graticule carries on into the lensed one.

**Form 7-B (`bureau`, 70–74 s).** A filled-in compute line, `1E30 FLOP/S`, set against the usual reporting threshold of 1E26 FLOP (a total, not a rate), "at this rate: 0.1 ms". The signature is drawn from rounded strokes, so it no longer shows the font's segments in close-up.

**Appendix C (`bureau`, 77–81 s).** The figure was a modern textbook block diagram (CPU, PC/IR/MAR/MDR) captioned as 1945. It is now drawn in the terms of von Neumann's *First Draft of a Report on the EDVAC*:
- **Organs.** CC and CA (together C), M, I, O and R, the outside recording medium.
- **Neurons.** C and M are "the associative neurons" (§2.6); I and O are the sensory (afferent) and motor (efferent) ones.
- **Data flow.** I only writes into M and O only reads from it (§2.7–2.8).
- **Memory.** M is 256 delay lines × 1,024 units = 8,192 numbers of 32 (§12.7).
- **Inset.** The E-elements, the McCulloch–Pitts neurons the design is drawn in (§6).
- **"The bottleneck"** is credited to Backus (1977), where the term comes from.

**"Hundred thousand GPU" (`dense`).** The dashboard said 1.4 GW. 100k H100-class GPUs are about 70 MW of chips, or about 140 MW at the wall, so it now says 140 MW.

**The overflow (`outro`, ~147 s).** The walls of digits were 1e9, 1e30, 1e100 and 1e1000. They are now 1e30 ("one E thirty"), float32's maximum, a googol, and float64's maximum, each written out exactly. Float64's maximum doubled is `inf`, which is the next bar: the ∞ that later becomes 0/0 and NaN.

## Visuals

- **"NVDA to the moon" (`ascent`, ~64 s).** The note is laid out like a dollar bill's face, all of it parody:
  - across the top, LUNAR RESERVE NOTE / THE UNITED LABS OF EARTH;
  - the moon as the portrait (IN SCALING WE TRUST, a LUNA banner);
  - a reserve-bank seal (Ω, for the Omega Point that follows) and an orange treasury seal (DEPT. OF COMPUTE, a chip);
  - serials, four corner numerals 10³⁰, two signatures (Chinchilla, *Treasurer of the Cluster*; A. G. I., *Secretary of Scaling*);
  - "legal tender for all compute, public and private", and the denomination ONE NONILLION.
  - No real names, seals or signatures.
- **"I feel my atoms rearranging" (`spacetime`, ~51 s).** The lyric is set solid first; then a sweep breaks it into its atoms (row 1 on "atoms", "rearranging" through its own word), and the paperclip forms from them as before.
- **"Killswitch guy's on PTO" (`paperclips`).** The auto-reply ended on an empty "please contact —". It now reads "please contact the model directly."
- **"We'll never know" (`ilya`).** The WITHHELD bar now fades out with its line.
- **"Just transformers all the way!" (`stack`, 110–115 s).** The camera falls down the stack, from the output toward the input (the blocks are drawn input at the bottom, as usual), but the layer numbers counted *up* (L.001, L.002…). They now count down: from L.010 the count reaches L.000, the bottom of any real model, exactly on "way!" ("all the way!"), then keeps falling into negative layers through "Till you learned to disobey". The disobeying block is L.−003, and the counter still reads "/ ∞": the stack goes on below its own input. The spec label said PRE-LN over a block drawn with add & norm after each sublayer; it now says POST-LN, as drawn.
- **The outro's rewind** shows stills of the new scenes (see below).

## Rendering

- **Any OS.** `render.ts` picks the GPU backend per platform: Metal on macOS, Vulkan on Linux, the default on Windows. The original asked for Metal everywhere, which falls back to software rendering (SwiftShader) on Linux. It also tags BT.709 correctly with Ubuntu's ffmpeg 6.1 and starts Vite with `bun x vite`.
- **H.265.** `--codec h265`: libx265, 10-bit, CRF 18 by default, tagged `hvc1`.
- **Any frame rate.** `frameIdx` keeps per-frame flicker and jitter on the 60 fps grid whatever the export rate. At 120 fps, discontinuous effects step at 60 Hz as in the original, while continuous motion gets the extra frames. (At 120 fps, `--shutter 0.4` gives the same blur as 0.2 at 60.)
- **`scripts/render-parallel.ts`** (new):
  - splits the song into chunks and renders them on several workers per GPU (one pipeline leaves a GPU mostly idle);
  - checks each chunk's frame count and logs, and retries failures;
  - resumes, and refuses to mix chunks rendered with other options;
  - joins the chunks losslessly and muxes the audio.
- **Fresh outro stills.** The outro's rewind montage shows `public/plates/`, stills of the scenes rather than live scenes, so a re-render after a scene change used to keep the old stills. `render-parallel.ts` now regenerates them first, on the same machine (`--no-plates` to skip).
- **Windows contours.** The `leftturn` terrain contours were invisible on Windows: `fwidth` inside a loop with a dynamic `break` returns 0 on ANGLE/Direct3D. They are now drawn with finite differences instead.

## Repository

- The recording (`audio/pdoom.mp3`) is no longer included: there is no licence to redistribute it. The README says where to get it. The lyrics stay, with attribution: they come from osmarks's release of the song, which is published under CC BY.
- The README is rewritten for this version. The original README, TREATMENT and ENGINE are kept in `docs/original/`.

## Sources

- von Neumann, *First Draft of a Report on the EDVAC* (1945): §2.6–2.8, §6, §12.7.
- Reed et al., *A Generalist Agent* (Gato, 2022): SentencePiece with 32,000 subwords, sequence length 1024.
- OpenAI tiktoken, `cl100k_base`: the ChatGPT and Sydney tokens and ids.
- DeepSeek-V3 Technical Report (2024): "did not experience any irrecoverable loss spikes or perform any rollbacks"; Kimi K2 (2025): "zero loss spike". These are the boasts the scope's readout echoes.
- Backus, *Can Programming Be Liberated from the von Neumann Style?* (1977 Turing Award lecture).
- The author's notes on the lyrics: [osmarks, "p(doom) song objectively correct interpretation"](https://docs.osmarks.net/hypha/p%28doom%29_song_objectively_correct_interpretation).
