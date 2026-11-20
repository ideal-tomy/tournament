/** 台に出す試合が無いときの表示。大会終了やグランドファイナルも、次の台試合がない言葉にする。 */
export function courtStandbyLabel(reason: string | null | undefined): string {
  if (
    reason == null
    || reason === '大会終了'
    || reason === 'グランドファイナルは台には載せません'
  ) return '次の試合はありません';
  if (reason === '対戦相手の確定待ち' || reason === 'もう一方の結果が出ると、対戦相手が決まる') {
    return '対戦相手の確定待ち';
  }
  return reason;
}
