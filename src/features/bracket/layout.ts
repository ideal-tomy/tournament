// =====================================================================
// layout.ts — トーナメント座標計算（演出の「座標駆動」の中核）
// 配置: src/features/bracket/layout.ts
//
// 役割:
//   brackets-manager の stageData(JSON) を入力に、各試合(match)と
//   各チーム枠(slot)の画面座標を計算して返す純粋関数。
//   演出(線の衝突/爆発/VS表示)はこの戻り値の座標だけを参照する。
//   → 当日の人数・配置が変わっても演出が自動追従する。
//
// 重要原則:
//   - 座標をハードコードしない。すべてここで計算する。
//   - これは「純粋関数」。副作用なし＝Vitestで単体テストする(Phase2のDone条件)。
// =====================================================================

// ---- 入力: brackets-manager stageData の必要部分 ----------------------
// ※ brackets-model の型に対応。プロジェクトでは brackets-manager の
//   get.stageData() の戻り値をそのまま渡す想定。
export interface BMGroup { id: number; number: number; stage_id: number }
export interface BMRound { id: number; number: number; group_id: number; stage_id: number }
export interface BMOpponent { id: number | null; position?: number; score?: number; result?: 'win' | 'loss' | 'draw' }
export interface BMMatch {
  id: number;
  number: number;
  group_id: number;
  round_id: number;
  status: number;            // brackets-manager の Status enum 値
  opponent1: BMOpponent | null;
  opponent2: BMOpponent | null;
}
export interface BMParticipant { id: number; tournament_id: number; name: string }
export interface StageData {
  group: BMGroup[];
  round: BMRound[];
  match: BMMatch[];
  participant: BMParticipant[];
}

// ---- 出力: 演出が参照するレイアウト ----------------------------------
export type BracketKind = 'winner' | 'loser' | 'grand_final';
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export interface SlotLayout {
  slot: 0 | 1;
  /** brackets-manager participant.id。null は未確定/BYE。
   *  顔写真解決: participant.id → participant.name(=team.id uuid) → teams → team_members → faces */
  teamRef: number | null;
  rect: Rect;
  center: Point;
}
export interface MatchLayout {
  matchId: number;
  bracket: BracketKind;
  round: number;             // そのbracket内のラウンド番号(1始まり)
  col: number;               // 列インデックス(0始まり)
  row: number;               // 列内の行インデックス(0始まり)
  box: Rect;                 // 試合ボックス全体
  center: Point;             // ボックス中心（衝突点の基準）
  slots: [SlotLayout, SlotLayout];
}
export interface Connector {
  fromMatchId: number;
  toMatchId: number;
  kind: 'advance' | 'drop';  // advance=同bracket内の勝ち上がり / drop=WB敗者→LB(TODO)
  from: Point;               // 線の始点(fromボックス右端中央)
  to: Point;                 // 線の終点(toボックス左端中央)
}
export interface BracketLayout {
  matches: MatchLayout[];
  connectors: Connector[];
  /** SVG viewBox 用 */
  width: number;
  height: number;
  byId: Record<number, MatchLayout>;
}

// ---- レイアウト設定 ---------------------------------------------------
export interface LayoutConfig {
  boxW: number;       // 試合ボックス幅
  boxH: number;       // 試合ボックス高さ(2スロット分)
  colGap: number;     // 列間の余白
  sectionGap: number; // WBセクションとLBセクションの縦間隔
  padding: number;    // 全体マージン
  wbSectionH: number; // WBセクションの高さ(縦の描画領域)
  lbSectionH: number; // LBセクションの高さ
}
export const DEFAULT_LAYOUT: LayoutConfig = {
  boxW: 240,
  boxH: 96,
  colGap: 80,
  sectionGap: 80,
  padding: 48,
  wbSectionH: 720,
  lbSectionH: 480,
};

// =====================================================================
// 本体
// =====================================================================
export function computeBracketLayout(
  data: StageData,
  cfg: LayoutConfig = DEFAULT_LAYOUT,
): BracketLayout {
  const groupNumberById = new Map<number, number>();
  for (const g of data.group) groupNumberById.set(g.id, g.number);

  const roundInfoById = new Map<number, { groupNumber: number; roundNumber: number }>();
  for (const r of data.round) {
    const groupNumber = groupNumberById.get(r.group_id) ?? 1;
    roundInfoById.set(r.id, { groupNumber, roundNumber: r.number });
  }

  // bracket 種別判定: group.number 1=WB / 2=LB / 3=GF（double_elimination の標準）
  const kindOf = (groupNumber: number): BracketKind =>
    groupNumber === 1 ? 'winner' : groupNumber === 2 ? 'loser' : 'grand_final';

  // (bracket, round) ごとに match をまとめる
  type Bucket = { bracket: BracketKind; round: number; matches: BMMatch[] };
  const buckets = new Map<string, Bucket>();
  for (const m of data.match) {
    const info = roundInfoById.get(m.round_id);
    if (!info) continue;
    const bracket = kindOf(info.groupNumber);
    const round = info.roundNumber;
    const key = `${bracket}:${round}`;
    if (!buckets.has(key)) buckets.set(key, { bracket, round, matches: [] });
    buckets.get(key)!.matches.push(m);
  }
  // 各 round 内は match.number 昇順
  for (const b of buckets.values()) b.matches.sort((a, z) => a.number - z.number);

  // 列インデックスの割り当て
  //  WB: round-1
  //  GF: WBの最大列の右隣から
  //  LB: round-1（縦はWBの下のバンド）
  const wbRounds = [...buckets.values()].filter(b => b.bracket === 'winner').map(b => b.round);
  const wbMaxRound = wbRounds.length ? Math.max(...wbRounds) : 0;

  const colOf = (bracket: BracketKind, round: number): number => {
    if (bracket === 'winner') return round - 1;
    if (bracket === 'grand_final') return wbMaxRound + (round - 1); // WBの右へ
    return round - 1; // loser
  };

  const xOfCol = (col: number) => cfg.padding + col * (cfg.boxW + cfg.colGap);

  const wbTop = cfg.padding;
  const maxMatchesInBracket = (kind: BracketKind) =>
    Math.max(
      1,
      ...[...buckets.values()]
        .filter((b) => b.bracket === kind)
        .map((b) => b.matches.length),
    );
  const wbSectionH = Math.max(cfg.wbSectionH, maxMatchesInBracket('winner') * cfg.boxH);
  const lbSectionH = Math.max(cfg.lbSectionH, maxMatchesInBracket('loser') * cfg.boxH);
  const lbTop = cfg.padding + wbSectionH + cfg.sectionGap;
  const sectionTopOf = (bracket: BracketKind) =>
    bracket === 'loser' ? lbTop : wbTop;
  const sectionHOf = (bracket: BracketKind) =>
    bracket === 'loser' ? lbSectionH : wbSectionH;

  const matches: MatchLayout[] = [];
  const byId: Record<number, MatchLayout> = {};

  for (const b of buckets.values()) {
    const col = colOf(b.bracket, b.round);
    const x = xOfCol(col);
    const top = sectionTopOf(b.bracket);
    const sectionH = sectionHOf(b.bracket);
    const n = b.matches.length;

    b.matches.forEach((m, row) => {
      // 列内で均等配置（中心を等間隔に置く）
      const centerY = top + ((row + 0.5) * sectionH) / n;
      const boxY = centerY - cfg.boxH / 2;
      const box: Rect = { x, y: boxY, w: cfg.boxW, h: cfg.boxH };

      const slotH = cfg.boxH / 2;
      const mkSlot = (slot: 0 | 1, op: BMOpponent | null): SlotLayout => {
        const rect: Rect = { x, y: boxY + slot * slotH, w: cfg.boxW, h: slotH };
        return {
          slot,
          teamRef: op?.id ?? null,
          rect,
          center: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
        };
      };

      const ml: MatchLayout = {
        matchId: m.id,
        bracket: b.bracket,
        round: b.round,
        col,
        row,
        box,
        center: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
        slots: [mkSlot(0, m.opponent1), mkSlot(1, m.opponent2)],
      };
      matches.push(ml);
      byId[ml.matchId] = ml;
    });
  }

  // -------------------------------------------------------------------
  // コネクタ（線）
  //   advance: 同bracket内 round r の row p → round r+1 の row floor(p/2)
  //     → WBはこの規則で正しい。LB/GFは構造が不規則なため要検証(下のTODO)。
  //   drop: WB敗者 → LB への落下線。brackets-manager の構造から導出が必要。
  // -------------------------------------------------------------------
  const connectors: Connector[] = [];
  const findMatch = (bracket: BracketKind, round: number, row: number) =>
    matches.find(m => m.bracket === bracket && m.round === round && m.row === row);

  for (const m of matches) {
    // advance（暫定: WB向けの素直な規則。LBは要調整）
    const next = findMatch(m.bracket, m.round + 1, Math.floor(m.row / 2));
    if (next) {
      connectors.push({
        fromMatchId: m.matchId,
        toMatchId: next.matchId,
        kind: 'advance',
        from: { x: m.box.x + m.box.w, y: m.center.y },
        to: { x: next.box.x, y: next.center.y },
      });
    }
    // TODO(Phase4以降): drop コネクタ（WB各試合の敗者がLBのどの試合へ落ちるか）。
    //   brackets-manager の match 構造/順序から対応付けを導出して push する。
    //   ※ 演出(線の衝突/爆発)は基本的に「現在の試合の2スロット中心」を使うため、
    //     drop線は表示上の装飾。MVPでは未実装でも進行・VS演出は成立する。
  }

  // -------------------------------------------------------------------
  // 全体サイズ（viewBox）
  // -------------------------------------------------------------------
  const maxRight = matches.reduce((mx, m) => Math.max(mx, m.box.x + m.box.w), 0);
  const maxBottom = matches.reduce((mx, m) => Math.max(mx, m.box.y + m.box.h), 0);
  const width = maxRight + cfg.padding;
  const height = Math.max(maxBottom + cfg.padding, lbTop + lbSectionH + cfg.padding);

  return { matches, connectors, width, height, byId };
}

// =====================================================================
// 顔写真解決ヘルパ（参照のみ。実データ取得はSupabase側で行う）
//   teamRef(participant.id) → participant.name(=team.id uuid) → team を引く。
// =====================================================================
export function resolveTeamId(
  teamRef: number | null,
  participants: BMParticipant[],
): string | null {
  if (teamRef == null) return null;
  const p = participants.find(pp => pp.id === teamRef);
  return p ? p.name : null; // seeding に team.id(uuid) を name として渡している前提
}
