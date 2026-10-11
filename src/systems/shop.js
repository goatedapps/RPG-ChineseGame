export function shopItemsForRegion(items, regionId) {
  return items.filter(item => !item.regions || item.regions.includes(regionId));
}
