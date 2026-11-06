export type EventFormat = 'single_elimination' | 'double_elimination';

export const EVENT_FORMATS: { value: EventFormat; label: string; note: string }[] = [
  { value: 'single_elimination', label: 'トーナメント', note: '1敗で終了' },
  { value: 'double_elimination', label: 'ダブルイリミネーション', note: '2敗で終了' },
];

export function formatLabel(format: string | undefined): string {
  return EVENT_FORMATS.find(item => item.value === format)?.label ?? '';
}
