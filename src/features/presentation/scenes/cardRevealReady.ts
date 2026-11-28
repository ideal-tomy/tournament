import { CARD_REVEAL_IMAGE_URLS } from '../../../lib/tournamentEffects';

function decodeImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    const finish = () => resolve();
    image.onload = () => {
      if (typeof image.decode === 'function') void image.decode().then(finish, finish);
      else finish();
    };
    image.onerror = finish;
    image.src = url;
  });
}

function warmFirstCard(root: ParentNode) {
  const card = root.querySelector<HTMLElement>('.draw-reveal-card');
  if (!card) return Promise.resolve();
  const images = [...card.querySelectorAll('img')];
  return Promise.all(images.map((image) => (
    typeof image.decode === 'function' ? image.decode().then(() => undefined, () => undefined) : Promise.resolve()
  ))).then(() => {
    card.getBoundingClientRect();
    card.querySelector('.draw-card-shell')?.getBoundingClientRect();
    card.querySelector('.draw-dart')?.getBoundingClientRect();
  });
}

/** 1人目のダーツ演出の前に、カード画像の展開を待つ。上限を超えたら未完了でも進む。 */
export function whenCardRevealReady(timeoutMs = 5000, root?: ParentNode | null) {
  const warm = root ? warmFirstCard(root) : Promise.resolve();
  return Promise.race([
    Promise.all([Promise.all(CARD_REVEAL_IMAGE_URLS.map(decodeImage)), warm]).then(() => undefined),
    new Promise<void>((resolve) => { window.setTimeout(resolve, timeoutMs); }),
  ]);
}
