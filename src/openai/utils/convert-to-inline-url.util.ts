import { shortenUrl } from '../../common/utils/link-shortener';

export const convertToInlineUrl = (
  url: string,
  menuId: string,
  menuName: string,
): string => {
  if (!url) return '—';

  const frontendUrl =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:4200'
      : 'https://app.botbite.com.mx';

  const viewerUrl = `${frontendUrl}/menu/${menuId}?url=${encodeURIComponent(url)}&name=${encodeURIComponent(menuName)}`;

  // Devolver la URL completa directamente para que sea clickeable
  return viewerUrl;
};
