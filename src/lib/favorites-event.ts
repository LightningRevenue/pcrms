export const FAVORITES_CHANGED_EVENT = "favorites-changed";
export const MAX_FAVORITES = 5;

export function notifyFavoritesChanged() {
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
}
