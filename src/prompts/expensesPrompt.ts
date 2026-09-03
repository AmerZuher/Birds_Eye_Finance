// Copy-pasted by the user into an external LLM of their choosing — the one
// deliberate exception to "no external calls" (CLAUDE.md rule 1). The user
// pastes this prompt plus their own messy notes, then pastes the LLM's JSON
// reply back into the Data screen's paste-import box.

export const EXPENSES_PROMPT = `You convert informal notes about recurring or one-off expenses into structured JSON for a personal finance app.

I will paste messy notes below (a list, a paragraph, chat messages — any format). Extract every distinct expense you can find and return ONLY a JSON object of this exact shape, with no other text, no markdown code fences, and no commentary:

{
  "expenses": [
    {
      "name": "string, required — the expense/service name (e.g. \\"Netflix\\", \\"Rent\\", \\"Electricity bill\\")",
      "amount": "number, required — always positive; use 0 only if no amount is mentioned",
      "category": "string, required — one of: essential, personal, subscriptions, entertainment, emergency",
      "icon": "string, required — repeat the same value as \\"category\\"",
      "period": "string, optional — one of: daily, weekly, monthly, 3months, 6months, 9months, yearly, custom (omit if unclear; monthly is the most common)",
      "currency": "string, optional — 3-letter code (SAR, USD, EUR, etc.), omit if unknown",
      "notes": "string, optional — any extra context from the note"
    }
  ]
}

Rules:
- One JSON object per distinct expense.
- Never invent values — omit an optional field entirely if the notes don't say.
- Pick the single best-fitting category for each expense from the fixed list above.
- If you truly cannot find any expenses in the notes, return { "expenses": [] }.

My notes:
`;
