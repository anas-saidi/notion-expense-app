# Product roadmap

Ideas agreed in principle and parked for later. Built work lives in `design.md`; this file holds what's next and the decisions still open.

## Month receipt (keepsake when a month closes)

A text-only receipt for the month that just closed, which both partners sign.

- **When:** the moment the last Settle line is marked sent for the new month's plan (old month's advances repaid, new plan funded). Saving the plan alone is too early. It slides up once with a short print animation (a plain fade under Reduce Motion).
- **Content, one screen:** month name; top four categories by spending, the rest folded into one line; total, planned and over/under; what each partner put in; advances repaid; two signature lines.
- **Look:** monospace and a paper surface, both documented as a one-off exception in `design.md`. No category artwork: the Thiings licence doesn't cover a saved or shared image, and a real receipt is text anyway.
- **Afterwards:** a closed month in Reflect gets a quiet "View receipt", so past months become a stack of receipts.
- **Open decisions:**
  1. Signatures: drawn by finger (needs storing, likely in Notion Finance Records) or tap-to-sign with each name in a handwriting-style font.
  2. Save as image: a download button, or in-app only.

## Pull to reveal the daily brief

Dragging Home's hero down reveals a calm daily brief (spending pace, next bill, what Joint owes), with the jars leaning in as if saying it. Insights only: anything actionable stays visible in the summary sentence. Needs a discovery hint, a non-gesture alternative for VoiceOver and keyboard, a Reduce Motion fallback, and a decision on whether the gesture replaces pull-to-refresh. Mascots inline in the sentence were deferred to this.

## Smaller follow-ups

- Plan sheet "spent so far" hint on the phone layout (desktop only today).
- Check the modal scroll lock on a real iPhone.
- Desktop pass on Reflect's recap sentence.
