/** Old free machine-translation fallback — lower quality, but needs no server config, so it keeps translation working while ANTHROPIC_API_KEY isn't set on Vercel yet. */
async function translateViaMyMemory(text: string): Promise<string> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=he|en`;
    const res = await fetch(url);
    const data = await res.json();
    const translated: string = data?.responseData?.translatedText;
    if (translated && translated.toLowerCase() !== text.toLowerCase()) return translated;
    return text;
  } catch {
    return text;
  }
}

export async function translateText(text: string): Promise<string> {
  const isHebrew = /[֐-׿]/.test(text);
  if (!isHebrew) return text;

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return translateViaMyMemory(text);
    const data = await res.json();
    return typeof data.translated === 'string' && data.translated ? data.translated : translateViaMyMemory(text);
  } catch {
    return translateViaMyMemory(text);
  }
}
