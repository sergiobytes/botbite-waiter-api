export const removeMenuItemsIdsUtil = (message: string): string => {
  return message.replace(/\[ID:[^\]]+\]\s*/g, '');
};
