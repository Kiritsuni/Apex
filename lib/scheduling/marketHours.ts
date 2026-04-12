export function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false;
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  const marketOpen = 15 * 60 + 30; // 15:30
  const marketClose = 22 * 60; // 22:00
  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
}

export function isMarketDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}
