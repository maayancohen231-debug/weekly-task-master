export async function translateText(text: string): Promise<string> {
  const isHebrew = /[\u0590-\u05FF]/.test(text);
  if (!isHebrew) return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=he|en`;
    const res = await fetch(url);
    const data = await res.json();
    const translated: string = data?.responseData?.translatedText;
    if (translated && translated.toLowerCase() !== text.toLowerCase()) {
      return translated;
    }
    return text;
  } catch {
    return text;
  }
}
