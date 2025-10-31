export type SplitMessagesResult = {
  client: string | null;
  cashier: string[];
};

export const splitMessages = (input: string): SplitMessagesResult => {
  const text = input.replace(/\r\n/g, '\n');

  const re = /^###\s*CAJA[^\n]*\n([\s\S]*?)(?=^###\s*CAJA|(?![\s\S]))/gim;

  const cashier: string[] = [];
  const fullMatches: string[] = [];

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    fullMatches.push(m[0]);
    cashier.push((m[1] || '').trim());
  }

  let client = text;
  for (const full of fullMatches) {
    client = client.replace(full, '').trim();
  }

  client = client.replace(/\n{3,}/g, '\n\n').trim();

  return {
    client: client.length ? client : null,
    cashier,
  };
};
