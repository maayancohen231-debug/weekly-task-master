import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Translates a short Hebrew task/to-do phrase into natural English using
 * Claude, server-side only (the API key can't live in the frontend bundle).
 * Replaces the earlier MyMemory machine-translation API, whose output was
 * frequently mangled for short, informal task-list phrasing.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured: missing ANTHROPIC_API_KEY' });

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 200,
      system:
        'You translate short Hebrew task-list phrases into natural, concise English, the way a ' +
        'native English speaker would phrase the same to-do item. Personal names stay as names: ' +
        'transliterate them (e.g. "מעיין" -> "Maayan") instead of translating them as common nouns, ' +
        'even when the name is also an ordinary Hebrew word. Respond with ONLY the translated ' +
        'text — no quotes, no explanation, no alternatives, no leading or trailing punctuation beyond ' +
        'what the phrase itself needs.',
      messages: [{ role: 'user', content: text }],
    });

    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const translated = block?.text?.trim();
    if (!translated) return res.status(502).json({ error: 'Empty translation' });

    return res.status(200).json({ translated });
  } catch (err) {
    console.error('[api/translate] Claude request failed:', err);
    return res.status(502).json({ error: 'Translation failed' });
  }
}
