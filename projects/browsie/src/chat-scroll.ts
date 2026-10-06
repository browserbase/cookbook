export type ScrollMetrics = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

export function isNearScrollBottom(metrics: ScrollMetrics, threshold = 96): boolean {
  const distanceFromBottom = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop;
  return distanceFromBottom <= threshold;
}
