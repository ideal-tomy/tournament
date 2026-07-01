# Display 演出 — Single Timeline 化リファクタ実装指示書

作成: 2026-07-02
対象: `/display` の試合確定演出（WIN → 棒上昇 → 接近 → 衝突/爆発 → VS → 表復帰）
前提資料: `PRESENTATION_EFFECT_STATUS.md`（症状・現状アーキテクチャ・既知バグはそちらを参照）

> **この指示書の目的**
> 「秒数と phase フラグ」で3本の非同期タイムラインを揃える現行方式をやめ、
> **アニメの真実を1本の GSAP タイムラインに集約**する。
> これにより `PRESENTATION_EFFECT_STATUS.md` §4 で分析された退行の温床（mount/ref race・animCue・3層GSAP）を構造的に除去する。

---

## 0. 実装者（Claude Code / Cursor）への進め方

1. §11 の**移行順序**に従い、段階的にコミットする（大爆発リファクタを一気にやらない）。
2. 各段階で `npm run build` が通ること、§12 のチェックリストが満たされることを確認する。

---

## 1. 原則と受け入れ基準（Invariants）

### 1.1 3つの原則

| # | 原則 | 具体 |
|---|------|------|
| P1 | **アニメの真実は1箇所** | 表示/移動/フェードは全部 `timeline.ts` の1本の GSAP が ref を直接 tween する |
| P2 | **レイヤーは常時 mount** | mount/unmount をやめ、`opacity:0` で待機。ref は常に生きている（race 消滅） |
| P3 | **React state は表示専用** | phase / どの2人か はラベル・debug 用のみ。**演出中に state 起因の re-render を起こさない** |

### 1.2 受け入れ基準（これが満たされれば「直った」）

- [ ] **INV-1** 接近→爆発→VS→光 の順序が、秒数ではなく**タイムライン上の位置**で保証される
- [ ] **INV-2** 爆発 webm は `impact` の1点で**必ず1回だけ**再生される（0連発・3連発が起きない）
- [ ] **INV-3** 対戦者の顔は clash〜hold で**同一 DOM ノード**。再 mount / 再 scale-in / 再接近が発生しない
- [ ] **INV-4** `return`（表復帰）のフェードは teamPair の状態に依存せず**常に走る**（「光だけ残る」不能）
- [ ] **INV-5** 演出中、`ref === null` を理由に**スキップされる分岐が存在しない**
- [ ] **INV-6** 演出中の React re-render 回数 = 0（開始時の1回のみ）。`lineProgress` 等の毎フレーム state は撤去済み

---

## 2. 目標アーキテクチャ

```
DisplayPage
  └─ EffectOrchestrator
       ├─ activeEffect: { matchId, teamA, teamB, winner, advance } | null   ← 開始時に1回だけ set
       │
       └─ PresentationStage（stageRef を scope に持つ・全レイヤー常時 mount）
            │  refs を1箇所で生成し、下の各レイヤーの DOM ノードに attach
            ├─ BracketFrozen   (opacity 1 : 更新前スナップショット)
            ├─ BracketUpdated  (opacity 0 : 更新後レイアウト)   ← return で crossfade-in
            ├─ LineCollision   (bar: scaleY 0 → 1)
            ├─ WinnerLayer     (winner face + WIN!)
            ├─ TeamPairLayer   (left / right / vs : 表示ロジックを持たない純表示)
            ├─ ExplosionVideo  (webm : impact で play)
            ├─ ExplosionSpark  (接合点スパーク : 控えめ)
            └─ ReturnFlashLayer(flash)
```

**制御は1本だけ:**

```
buildMatchTimeline(refs, TIMING, { advance })  →  gsap.timeline()
  useGSAP(() => tl, { scope: stageRef, dependencies: [activeEffect?.matchId] })
```

以前の「GSAP Timeline / React State / TeamPairLayer GSAP」の3軸は、**buildMatchTimeline 1本に統合**される。

---

## 3. タイミング定数（consolidate）

現状 `effectConstants.ts` / `timeline.ts` に散っている秒数を、**単一の定数オブジェクト**にまとめる。

```ts
// effectConstants.ts
export const TIMING = {
  win:      3.8,   // WIN 表示
  dissolve: 0.6,   // 勝者 fade（黒にせず裏の表が見え始める）
  pause:    0.5,   // dissolve 後の短い間
  barRise:  2.8,   // 棒が下から伸びる
  clash:    3.0,   // 左右から接近
  impact:   1.0,   // 衝突＋爆発
  vsHold:   3.5,   // VS ホールド
  return:   1.6,   // 白フラッシュ＋表復帰
} as const;
export type EffectTiming = typeof TIMING;
```

参考: 絶対位置（`buildMatchTimeline` が生成するラベル）

| ラベル | 絶対 t(s) | 意味 |
|--------|----------|------|
| `win`    | 0.00  | WIN in |
| (dissolve) | 3.80 | 勝者 fade / 表が見え始める |
| (barRise)  | 4.90 | 棒上昇開始（= win+dissolve+pause） |
| `clash`  | 6.44  | 接近開始（barRise 終盤に重ねる = barRise*0.55 地点） |
| `impact` | 9.44  | 衝突＝爆発発火 |
| (vs)     | 9.84  | VS にじむ（impact+0.4） |
| `hold`   | 10.44 | VS ホールド開始 |
| `return` | 13.94 | 光＋表復帰 |
| (end)    | ~15.5 | 終了 |

合計 **約 15.5 秒**（advance あり）。数値は上記 TIMING を変えるだけで全体が追従する。

---

## 4. 単一タイムライン・コントローラ（`timeline.ts`）

**この関数が本リファクタの心臓部。** `timeline.ts` を以下で置き換える。

```ts
// src/features/presentation/timeline.ts
import gsap from 'gsap';
import type { EffectTiming } from './effectConstants';

/** 常時 mount された各レイヤーの DOM ノード ref を集約 */
export type StageRefs = {
  winner:         HTMLElement | null;   // WinnerLayer（WIN 顔）
  bar:            SVGElement  | null;   // LineCollision の棒 group
  left:           HTMLElement | null;   // 対戦者 A（接近する顔）
  right:          HTMLElement | null;   // 対戦者 B
  vs:             HTMLElement | null;   // VS 文字
  explosionWrap:  HTMLElement | null;   // 爆発 webm のラッパ（opacity 制御用）
  explosionVideo: HTMLVideoElement | null; // 爆発 <video> 本体
  spark:          HTMLElement | null;   // 接合点の控えめスパーク
  flash:          HTMLElement | null;   // ReturnFlashLayer
  bracketUpdated: HTMLElement | null;   // 更新後ブラケット（return で fade-in）
  bracketFrozen:  HTMLElement | null;   // 更新前ブラケット（開始時 opacity 1）
};

export function buildMatchTimeline(
  r: StageRefs,
  T: EffectTiming,
  opts: { advance: boolean; fireExplosion: () => void },
): gsap.core.Timeline {
  const tl = gsap.timeline();

  // --- 初期状態を明示的に固定（mount 済みノードの待機姿勢）---
  gsap.set([r.winner, r.left, r.right, r.vs, r.explosionWrap, r.spark, r.flash, r.bracketUpdated],
           { opacity: 0 });
  gsap.set(r.bracketFrozen, { opacity: 1 });
  gsap.set(r.bar, { scaleY: 0, transformOrigin: 'bottom' });
  gsap.set(r.left,  { xPercent: -120 });
  gsap.set(r.right, { xPercent:  120 });
  gsap.set(r.vs,    { scale: 0.85 });

  // --- ① WIN 表示 ---
  tl.addLabel('win', 0)
    .to(r.winner, { opacity: 1, duration: 0.4, ease: 'power2.out' }, 'win')
    .to(r.winner, { opacity: 0, duration: T.dissolve, ease: 'power1.inOut' }, `win+=${T.win}`);

  // --- 勝利のみ（advance なし）: 表に自然復帰して終了 ---
  if (!opts.advance) {
    tl.addLabel('return', `win+=${T.win + T.dissolve}`)
      .to(r.bracketUpdated, { opacity: 1, duration: T.return, ease: 'power1.inOut' }, 'return')
      .to(r.bracketFrozen,  { opacity: 0, duration: T.return, ease: 'power1.inOut' }, 'return');
    return tl;
  }

  // --- ② 短い間 → 棒上昇（更新前スナップショット上で伸びる）---
  const barAt = T.win + T.dissolve + T.pause;
  tl.fromTo(r.bar, { scaleY: 0 }, { scaleY: 1, duration: T.barRise, ease: 'power2.out' }, barAt);

  // --- ③ 左右から接近（対戦者はここで初登場・barRise 終盤に重ねる）---
  const clashAt = barAt + T.barRise * 0.55;
  tl.addLabel('clash', clashAt)
    .fromTo(r.left,  { xPercent: -120, opacity: 0 },
                     { xPercent: 0, opacity: 1, duration: T.clash, ease: 'power3.out' }, 'clash')
    .fromTo(r.right, { xPercent:  120, opacity: 0 },
                     { xPercent: 0, opacity: 1, duration: T.clash, ease: 'power3.out' }, 'clash');

  // --- ④ 衝突＋爆発（1回だけ）---
  tl.addLabel('impact', 'clash+=' + T.clash)
    .set(r.explosionWrap, { opacity: 1 }, 'impact')
    .call(opts.fireExplosion, [], 'impact')                                   // ← webm を1回発火
    .fromTo(r.spark, { opacity: 0 }, { opacity: 0.8, duration: 0.1, yoyo: true, repeat: 1 }, 'impact')
    .to(r.explosionWrap, { opacity: 0, duration: 0.2 }, `impact+=${Math.max(0.1, T.impact - 0.2)}`)
    // VS がにじむ（impact 終盤に重ねる = 同一の顔の上に浮かぶ）
    .fromTo(r.vs, { opacity: 0, scale: 0.85 },
                  { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' }, 'impact+=0.4');

  // --- ⑤ VS ホールド（同じ顔のまま。再 scale-in / 再接近 なし）---
  tl.addLabel('hold', `impact+=${T.impact}`)
    .to({}, { duration: T.vsHold });   // 何も動かさず保持するだけ

  // --- ⑥ 光＋表復帰（同期）---
  tl.addLabel('return', `hold+=${T.vsHold}`)
    .to(r.flash, { opacity: 1, duration: 0.2, ease: 'power2.in' }, 'return')
    .to(r.bracketUpdated, { opacity: 1, duration: T.return, ease: 'power1.inOut' }, 'return')  // 更新済み表が同時に
    .to([r.left, r.right, r.vs], { opacity: 0, duration: T.return * 0.7 }, 'return+=0.15')
    .to(r.bracketFrozen, { opacity: 0, duration: T.return, ease: 'power1.inOut' }, 'return')
    .to(r.flash, { opacity: 0, duration: T.return * 0.7 }, `return+=${T.return * 0.4}`);

  return tl;
}
```

### 4.1 タイムラインを回すフック（`useMatchEffect.ts`）

`useMatchEffect.ts` は「phase 計算 + 3種のタイムライン + animCue」をやめ、**単一タイムラインの生成と後片付けだけ**にする。

```ts
// useMatchEffect.ts（骨子）
import { useGSAP } from '@gsap/react';   // 未導入なら: npm i @gsap/react
import { buildMatchTimeline, type StageRefs } from './timeline';
import { TIMING } from './effectConstants';

export function usePresentationTimeline(
  stageRef: React.RefObject<HTMLElement>,
  refs: StageRefs,
  active: { matchId: string; advance: boolean } | null,
  fireExplosion: () => void,
  onComplete: () => void,
) {
  useGSAP(() => {
    if (!active) return;
    const tl = buildMatchTimeline(refs, TIMING, { advance: active.advance, fireExplosion });
    tl.eventCallback('onComplete', onComplete);
    // useGSAP が scope 内の tween を自動 revert（次回開始時の初期化に利用）
  }, { scope: stageRef, dependencies: [active?.matchId] });
}
```

> **なぜこれで race が消えるか**: `dependencies:[matchId]` はレイヤーが**既に mount 済み**の後にしか変化しない（§6 参照）。よって `buildMatchTimeline` 実行時に `refs.*` は全て非 null。`animCue` も `ref 未接続時のリトライ`も不要になる（= INV-5）。

---

## 5. ファイル別の変更一覧

| ファイル | 変更内容 | 対応する不具合 |
|---------|---------|--------------|
| `effectConstants.ts` | 秒数を単一 `TIMING` オブジェクトに集約（§3） | 秒数の散在 |
| `timeline.ts` | **全面置換**: `buildMatchTimeline` 1本に（§4） | 3層GSAP / 順序非保証 |
| `useMatchEffect.ts` | phase 計算・animCue・複数 timeline を撤去し `usePresentationTimeline` に（§4.1） | animCue race |
| `deriveLayerState.ts` | **mount 判定を撤去**。返すのは「どの2人か・ラベル」等の**表示情報のみ**（§6） | mount/unmount race |
| `PresentationStage.tsx` | 全レイヤーを**常時 mount**。refs を1箇所で生成し各 DOM に attach。`animCue` の useEffect を**削除**（§6, §7） | 「光だけ」/ 非表示 |
| `TeamPairLayer.tsx` | **内部 GSAP と imperative API（playApproach 等）を全削除**。`left/right/vs` の ref を親へ渡す純表示コンポーネントにする（§7） | 3本目GSAP / reset で一瞬消える |
| `ExplosionVideo.tsx` | `video` 要素の ref を親へ公開。待機時 `opacity:0`。`fireExplosion` で `currentTime=0; play()`（§8） | 3連発 / 0連発 |
| `ExplosionLayer.tsx` | 接合点スパークを `spark` ref として公開（控えめ表示のみ） | — |
| `LineCollision.tsx` | 棒を**GSAP で tween する SVG group**として ref 公開。内部の毎フレーム state を撤去（§6, INV-6） | 毎フレーム re-render |
| `ReturnFlashLayer.tsx` | flash 要素の ref 公開。自前アニメを撤去（tween は timeline 側） | 光の二重制御 |
| `DisplayPage.tsx` | 結果確定時に `activeEffect` を**1回だけ** set。`onComplete` で snapshot 更新＋ `activeEffect=null`（§9） | snapshot 二重管理 |
| `resolveEffectLayout.ts` | 棒の座標算出は維持（起点＝勝者 box 下端） | — |
| `advanceEffect.ts` | 2試合目判定は維持（`advance` フラグを `activeEffect` に載せる） | — |

---

## 6. 常時 mount モデル（P2 / INV-5 / INV-6）

**現行**: `deriveLayerState` が phase を見て `teamPairActive` 等で mount/unmount → phase 変化から ref 接続まで1フレーム遅延 → race。

**変更後**:

1. `PresentationStage` は `activeEffect !== null` の間、**全レイヤーを常に render**する（条件付き `return null` を禁止）。
2. 各レイヤーの表示状態は **GSAP の opacity のみ**で決まる（React は表示を判断しない）。
3. refs は `PresentationStage` で1回だけ生成:

```tsx
// PresentationStage.tsx（骨子）
const stageRef = useRef<HTMLDivElement>(null);
const winnerRef = useRef<HTMLDivElement>(null);
const leftRef   = useRef<HTMLDivElement>(null);
const rightRef  = useRef<HTMLDivElement>(null);
const vsRef     = useRef<HTMLDivElement>(null);
const barRef    = useRef<SVGGElement>(null);
const explosionWrapRef = useRef<HTMLDivElement>(null);
const explosionVideoRef = useRef<HTMLVideoElement>(null);
const sparkRef  = useRef<HTMLDivElement>(null);
const flashRef  = useRef<HTMLDivElement>(null);
const bracketUpdatedRef = useRef<HTMLDivElement>(null);
const bracketFrozenRef  = useRef<HTMLDivElement>(null);

const refs: StageRefs = {
  winner: winnerRef.current, left: leftRef.current, right: rightRef.current, vs: vsRef.current,
  bar: barRef.current, explosionWrap: explosionWrapRef.current, explosionVideo: explosionVideoRef.current,
  spark: sparkRef.current, flash: flashRef.current,
  bracketUpdated: bracketUpdatedRef.current, bracketFrozen: bracketFrozenRef.current,
};
// ↑ .current は render 時点で確定させず、useGSAP 実行時に読む形にする（下記注意）
```

> **ref.current の読みタイミング注意**: 上のように render 中に `.current` を展開すると初回は null。
> **推奨**: `refs` を「ref オブジェクトそのもの」で持ち、`buildMatchTimeline` 内で `r.left.current` を参照する形にするか、
> `usePresentationTimeline` を `useGSAP` の中で `xxxRef.current` を読むようにする（`useGSAP` の callback は mount 後に走るため `.current` は確定済み）。
> 実装者は後者（callback 内で `.current` 参照）に統一すること。型は `RefObject` 群にする。

4. `LineCollision` の棒は「毎フレーム進捗 state」ではなく、**静的な SVG group を GSAP が scaleY tween**する形へ（INV-6）。`lineProgress` state は削除。

---

## 7. 3つの非同期ソースを剥がす（P1）

| 剥がす対象 | 現行 | 変更後 |
|-----------|------|--------|
| `animCue` パターン | callback → `animCue++` → useEffect が ref 経由で imperative 実行 | **削除**。全て `tl.to()/.call()` に置換 |
| TeamPairLayer 内 GSAP | `playApproach` / `playImpact` / `reset()` | **削除**。TeamPairLayer は ref を渡すだけの純表示 |
| 毎フレーム React state | `lineProgress` 等が clash 中も re-render を誘発 | **削除**。棒も VS も GSAP tween のみ |

`TeamPairLayer.tsx` 変更後の姿（アニメを一切持たない）:

```tsx
// TeamPairLayer.tsx（骨子）— forwardRef で3つの内部 ref を親へ
type Props = { teamA: Team; teamB: Team; leftRef: Ref<HTMLDivElement>; rightRef: Ref<HTMLDivElement>; vsRef: Ref<HTMLDivElement>; };
export function TeamPairLayer({ teamA, teamB, leftRef, rightRef, vsRef }: Props) {
  return (
    <div className="team-pair" aria-hidden>
      <div className="team-pair__side team-pair__side--left"  ref={leftRef}><TeamShowcase team={teamA} /></div>
      <div className="team-pair__vs" ref={vsRef}>VS</div>
      <div className="team-pair__side team-pair__side--right" ref={rightRef}><TeamShowcase team={teamB} /></div>
    </div>
  );
}
```

> **重要**: WIN 顔（`WinnerLayer`）と、接近する2枚の顔（`TeamPairLayer`）は**別要素**でよい。
> INV-3 が要求するのは「接近する2枚が clash〜hold で同一ノードであること」。WIN 顔とは別物で問題ない。

---

## 8. 爆発トリガー（INV-2）

`ExplosionVideo` は待機時 `opacity:0`・**プリロード済み**。発火は `impact` ラベルの `tl.call` 1点のみ。

```ts
// PresentationStage 側で fireExplosion を定義し timeline に渡す
const fireExplosion = () => {
  const v = explosionVideoRef.current;
  if (!v) return;
  v.currentTime = 0;
  void v.play();
};
```

- `impact` の `.set(explosionWrap,{opacity:1})` → `.call(fireExplosion)` → `impact+=(impact-0.2)` で wrap を `opacity:0`。webm は約0.8s、impact phase は 1.0s なので収まる。
- **1つの timeline 位置でしか呼ばれない**ため、phase フラグ経由の多重発火（3連発）が原理的に起きない。
- `<video>` は `muted playsinline preload="auto"` を付与。プリロードは既存 `preloadPresentation.ts` / `media.ts` を利用。

---

## 9. ブラケット・スナップショットと表復帰（snapshot 二重管理の解消）

**方針**: データを演出中に差し替えるのをやめ、**2枚重ね + opacity crossfade**にする。

- `BracketFrozen`（更新前レイアウト）を `opacity:1` で下敷きに。演出中ずっとこれが見える（棒上昇もこの上）。
- `BracketUpdated`（更新後レイアウト）を `opacity:0` で重ねておく。
- `return` ラベルで `bracketUpdated → 1` / `bracketFrozen → 0` を crossfade。**光と同時**に更新済みの表が現れる（§4 の `return` ブロック）。

`DisplayPage.tsx`:

```tsx
// 結果確定時（1回だけ）
setActiveEffect({ matchId, teamA, teamB, winner, advance });   // これで全レイヤーが mount される
// 表示中スナップショットは「更新前」を凍結して BracketFrozen に渡す
// BracketUpdated には「更新後」レイアウトを渡す

// onComplete（timeline 完了時）
const handleComplete = () => {
  commitBracketUpdate();      // 実データを更新後に確定
  setActiveEffect(null);      // レイヤー unmount（次の演出まで待機不要ならそのまま）
};
```

> これで `displaySnapshot / layoutSnapshot` の**整合デバッグ**が「2枚のどちらが見えているか」だけになり、追いやすくなる。

---

## 10. advance なし分岐（§1.2）

`buildMatchTimeline` の `opts.advance === false` 分岐（§4 内）で、`WIN → dissolve → 表に自然復帰` の短縮版を返す。棒上昇・接近・爆発・VS は生成しない。`advanceEffect.ts` の判定結果を `activeEffect.advance` に載せるだけ。

---

## 11. 移行順序（安全に段階コミット）

一気に置換せず、以下の順で**各段階ビルドを通しながら**進める。

| 段階 | 作業 | 完了条件 |
|------|------|---------|
| S0 | ブランチ作成 + §13 の死にファイル7件を削除 | `npm run build` 成功・挙動不変 |
| S1 | `effectConstants.ts` に `TIMING` を集約（値は現行踏襲） | ビルド成功 |
| S2 | 各レイヤーを**常時 mount + opacity 0 待機**に変更（deriveLayerState の mount 判定撤去） | 演出は未接続でも WIN 等が表示崩れしない |
| S3 | `TeamPairLayer` / `LineCollision` / `ExplosionVideo` / `ReturnFlashLayer` を**ref 公開の純表示**化（内部アニメ・state 撤去） | 静止状態で正しく描画 |
| S4 | `timeline.ts` を `buildMatchTimeline` に置換 + `usePresentationTimeline` 接続 | フル演出が1本で通る |
| S5 | `DisplayPage` の `activeEffect` / snapshot 2枚重ねに移行 | 表復帰が光と同期 |
| S6 | `animCue` と旧 phase 分岐・旧 timeline を**完全削除** | INV-1〜6 全て満たす |

> **並行運用したい場合**: S4 で旧経路を残したまま `?tl=1` 等のフラグで新経路に切替え、リハーサルで確認してから S6 で旧経路削除、でもよい。

---

## 12. リハーサル用チェックリスト（受け入れ）

演出を1回流し、目視で確認する。

- [ ] WIN が **3.8s** しっかり見える（せわしなくない）
- [ ] 勝者が dissolve し、**黒一色にならず**裏の表が見え始める
- [ ] 棒が**下から伸びる**（最初から到達済みでない）
- [ ] 対戦者の顔が**左右から約3s**かけて中央へ（ここで初登場）
- [ ] 中央合流と**同時に**爆発（webm が中央で1回）
- [ ] 接合点は**控えめなスパーク**程度（主役は中央）
- [ ] **同じ顔**の上に VS が浮かぶ（再接近・再 scale-in なし）
- [ ] VS が **約3.5s** ホールド
- [ ] **光と同時に**更新済みブラケットが見える
- [ ] 「光だけ」「顔が出ない」「順番が逆」「3連発」が**起きない**
- [ ] advance なしの試合は WIN → 表復帰の短縮版で自然に戻る
- [ ] 演出中 React DevTools で `PresentationStage` 配下の re-render が起きない（INV-6）

---

## 13. 削除するファイル（調査ノイズ除去）

`PRESENTATION_EFFECT_STATUS.md` §5.2 の未使用7件を削除:

- `ClashPopup.tsx`
- `VsScreen.tsx`
- `FlameBurstOverlay.tsx`
- `WinnerCelebratePopup.tsx`
- `VsAnticipationOverlay.tsx`
- `FlameVsLayer.tsx`
- `ImpactAfterglowLayer.tsx`

削除前に `grep -r "ClashPopup\|VsScreen\|FlameBurstOverlay\|WinnerCelebratePopup\|VsAnticipationOverlay\|FlameVsLayer\|ImpactAfterglowLayer" src` で **import 0件**を確認すること。

---

## 14. ロールバック

- 作業は `feat/single-timeline-presentation` ブランチで実施。
- 本番演出は main を維持し、リハーサルで §12 を通過してから merge。
- 問題時は該当ブランチを破棄すれば現状に戻る（main 無傷）。

---

## 15. なぜこれで「毎回同じ」に戻るか（まとめ）

| 旧原因（STATUS §4） | 本リファクタでの解消 |
|--------------------|--------------------|
| 3つの時間軸が非同期 | `buildMatchTimeline` **1本**に統合（P1） |
| mount → ref 接続の1フレーム遅延 | **常時 mount** で ref 常在（P2 / INV-5） |
| `lineProgress` で毎フレーム re-render | 棒も GSAP tween、毎フレーム state 撤去（INV-6） |
| ref null 時リトライなしで approach スキップ | ref が常在 → `tl.to(left, …)` が必ず走る（INV-5） |
| bracketReturn 時 fadeOut 未呼び出し（光だけ） | `return` の fade は teamPair 状態に**無依存**で常時実行（INV-4） |
| 爆発の多重/未発火 | `impact` の `tl.call` 1点のみ（INV-2） |

**核心**: 「アニメが DOM 上で実際に走ったか」を保証する**単一の制御点（1本の GSAP timeline）**を作ること。秒数調整はその上で初めて意味を持つ。

---

*本書は `PRESENTATION_EFFECT_STATUS.md` の続き（実装フェーズ指示）。実装完了後は STATUS 側の §2「現状」も更新すること。*
