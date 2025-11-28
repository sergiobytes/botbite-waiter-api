export const shortenUrl = (url?: string, maxLength: number = 60): string => {
  if (!url) return '';

  const clean = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  if (clean.length <= maxLength) return clean;

  const parts = clean.split('/');
  const last = parts.pop() ?? '';
  const base = parts.join('/');

  if (last.length > maxLength / 2) {
    return clean.slice(0, maxLength - 1) + '...';
  }

  const baseMax = maxLength - last.length - 4;
  const shortBase = base.slice(0, Math.max(0, baseMax));

  return `${shortBase}.../${last}`;
};
