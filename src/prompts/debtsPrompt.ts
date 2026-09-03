// Copy-pasted by the user into an external LLM of their choosing — the one
// deliberate exception to "no external calls" (CLAUDE.md rule 1). The user
// pastes this prompt plus their own messy notes, then pastes the LLM's JSON
// reply back into the Data screen's paste-import box.

export const DEBTS_PROMPT = `You convert informal notes about money someone owes or is owed into structured JSON for a personal finance app.

I will paste messy notes below (a list, a paragraph, chat messages — any format). Extract every distinct debt you can find and return ONLY a JSON object of this exact shape, with no other text, no markdown code fences, and no commentary:

{
  "debts": [
    {
      "name": "string, required — the other person's name",
      "amount": "number, required — always positive, never negative",
      "type": "\\"negative\\" if I owe them money, \\"positive\\" if they owe me money — required",
      "date": "string, required — YYYY-MM-DD, best guess if not stated, otherwise today",
      "currency": "string, optional — 3-letter code (SAR, USD, EUR, etc.), omit if unknown",
      "notes": "string, optional — any extra context from the note",
      "monthlyPayment": "number, optional — only if an installment/monthly payment amount is mentioned",
      "startDate": "string, optional — YYYY-MM-DD, only if an installment plan start date is mentioned",
      "endDate": "string, optional — YYYY-MM-DD, only if an installment plan end date is mentioned",
      "phone": "string, optional — only if a phone number is mentioned",
      "email": "string, optional — only if an email is mentioned",
      "company": "string, optional — only if a company/business name is mentioned"
    }
  ]
}

Rules:
- One JSON object per distinct debt, even if the same person appears multiple times.
- Never invent values — omit a field entirely if the notes don't say.
- "amount" is always a positive number; the sign of the debt is carried entirely by "type".
- If you truly cannot find any debts in the notes, return { "debts": [] }.

My notes:
`;
