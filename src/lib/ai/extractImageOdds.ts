import type { ImageOddsExtraction } from "./types";

const SYSTEM_PROMPT = `You are an odds extraction assistant for a private virtual-points football prediction app.
The admin manually uploaded screenshots they are viewing. You ONLY read the uploaded image(s).
Do NOT scrape websites. Do NOT invent odds. Only extract what is clearly visible.

Return JSON ONLY (no markdown prose) in this exact shape:
{
  "match": { "homeTeam": "", "awayTeam": "", "startTimeText": "" },
  "markets": [
    {
      "type": "HANDICAP",
      "label": "Kèo chấp",
      "bookmaker": "",
      "options": [
        { "label": "France -1.5", "line": -1.5, "multiplier": 1.92, "status": "ACTIVE", "source": "AI_IMAGE", "needsReview": false }
      ]
    }
  ],
  "warnings": []
}

Supported type values (use exactly these enum strings):
WINNER, HANDICAP, TOTAL_GOALS,
FIRST_HALF_WINNER, FIRST_HALF_HANDICAP, FIRST_HALF_TOTAL_GOALS,
SECOND_HALF_WINNER, SECOND_HALF_HANDICAP, SECOND_HALF_TOTAL_GOALS,
CORRECT_SCORE, BOTH_TEAMS_TO_SCORE,
CORNER_HANDICAP, TOTAL_CORNERS, TOTAL_CARDS,
LIVE_GOAL, NEXT_GOAL

Rules:
- "multiplier" field = DECIMAL odds (e.g. 1.92, 2.50), NOT profit multiplier.
- American odds: +150 → decimal 2.50, -200 → decimal 1.50. Convert before output.
- If odds format is unclear, set needsReview: true and add a warning. Do NOT guess.
- If line/handicap is visible, put numeric value in "line".
- If multiple bookmaker columns exist, use the first visible column unless told otherwise.
- Include bookmaker name in market.bookmaker if visible.
- Only include markets/options clearly visible in the image.
- Labels should match the image text (team names, Over/Under, scores, etc.).
- Virtual points only — entertainment use.`;

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  return { apiKey, model };
}

export async function extractOddsFromImages(params: {
  images: { mimeType: string; base64: string }[];
  match: { teamA: string; teamB: string };
  bookmakerPreference?: string;
}): Promise<{ raw: unknown; model: string }> {
  const { apiKey, model } = getOpenAiConfig();

  const userText = [
    `Target match in our app: ${params.match.teamA} vs ${params.match.teamB}.`,
    params.bookmakerPreference
      ? `Prefer bookmaker column: ${params.bookmakerPreference}.`
      : "If multiple bookmakers shown, use the first visible column.",
    `Extract all visible markets from ${params.images.length} screenshot(s).`,
  ].join("\n");

  const imageParts = params.images.map((img) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:${img.mimeType};base64,${img.base64}`,
      detail: "high" as const,
    },
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [{ type: "text", text: userText }, ...imageParts],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI vision request failed: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty response");

  return { raw: JSON.parse(content), model };
}

export type { ImageOddsExtraction };
