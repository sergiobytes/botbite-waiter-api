export const hasRequestedBill = (input: string[]): boolean => {
  const normalize = (s: string) =>
    s.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n');

  const requestedBill = input.some((block) =>
    /(^|\n)\s*Acción:\s*.*ha pedido la cuenta\.?\s*$/i.test(normalize(block)),
  );

  return requestedBill;
};
