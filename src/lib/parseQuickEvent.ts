export interface QuickEventParse {
  date: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:MM"
  title: string;
}

/** Parses a freeform chat-style note ("11.8" / "13:30" / title) into a structured event via Claude. */
export async function parseQuickEventText(text: string): Promise<QuickEventParse> {
  const todayISO = new Date().toLocaleDateString('en-CA'); // en-CA formats as YYYY-MM-DD

  const res = await fetch('/api/parse-quick-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, todayISO }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Parsing failed');
  }
  return data as QuickEventParse;
}
