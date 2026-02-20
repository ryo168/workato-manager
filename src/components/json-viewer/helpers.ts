// スクロール・フラッシュユーティリティ。

export function scrollInContainer(
  el: HTMLElement,
  container: HTMLElement,
): void {
  const elRect = el.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  const target =
    container.scrollTop +
    (elRect.top - cRect.top) -
    cRect.height / 2 +
    elRect.height / 2;
  container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
}

export function flashAndScroll(
  el: HTMLElement | null,
  container: HTMLElement | null,
): void {
  if (!el || !container) return;
  scrollInContainer(el, container);
  el.style.transition = "box-shadow 0.3s";
  el.style.boxShadow = "0 0 0 2px #60a5fa";
  setTimeout(() => {
    el.style.boxShadow = "";
    setTimeout(() => {
      el.style.transition = "";
    }, 300);
  }, 1500);
}
