import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Parses a short freeform chat-style note (date, time, title — often on
 * separate lines, often in Hebrew, often a bare "11.8" with no year) into a
 * structured event. Server-side only, same ANTHROPIC_API_KEY as /api/translate.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, todayISO } = req.body ?? {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Missing text' });
  if (!todayISO || typeof todayISO !== 'string') return res.status(400).json({ error: 'Missing todayISO' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured: missing ANTHROPIC_API_KEY' });

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 300,
      system:
        `Today's date is ${todayISO} (YYYY-MM-DD). You extract a single event from a short, ` +
        'informal note — often Hebrew, often just a date, a time, and a title on separate lines ' +
        '(e.g. "11.8" / "13:30" / "ראיון לאליס קוד"). Dates may be day.month, day/month, day-month, ' +
        'or relative Hebrew/English terms like "מחר", "יום שלישי", "next tuesday". When the note ' +
        "omits a year, use today's year unless that date has already passed this year, in which " +
        'case use next year. Times may be "13:30", "1:30pm", "13.30", etc. — normalize to 24h ' +
        '"HH:MM". Keep the title in whatever language the note used — do not translate it. The ' +
        'title is whatever text in the note is not the date or time.\n\n' +
        'Respond with ONLY a JSON object, no markdown fences, no explanation, in exactly this shape:\n' +
        '{"date": "YYYY-MM-DD" | null, "time": "HH:MM" | null, "title": string}\n' +
        'Set date or time to null if the note genuinely does not specify one — never guess a time ' +
        'that was not given. If nothing in the note can be identified as a title, use the full ' +
        'original note as the title.',
      messages: [{ role: 'user', content: text }],
    });

    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const raw = block?.text?.trim();
    if (!raw) return res.status(502).json({ error: 'Empty response' });

    let parsed: { date: string | null; time: string | null; title: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Couldn't understand that — try rephrasing." });
    }

    if (!parsed.date) {
      return res.status(422).json({ error: "Couldn't find a date in that note." });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[api/parse-quick-event] Claude request failed:', err);
    return res.status(502).json({ error: 'Parsing failed' });
  }
}
