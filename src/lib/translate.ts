export async function translateText(text: string): Promise<string> {
  const isHebrew = /[\u0590-\u05FF]/.test(text);
  if (!isHebrew) return text;

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    return typeof data.translated === 'string' && data.translated ? data.translated : text;
  } catch {
    return text;
  }
}
