# OpenClaw Model Cost Calculator

A practical pricing estimation tool built for OpenClaw builders who want clarity before scaling usage.

Live site:
https://openclaw-cost-calculator.vercel.app/

---

## Why this exists

When you’re building with multiple LLM providers, token costs stack up quickly.

Input tokens.
Output tokens.
Different pricing per provider.
Annual projections.
Discount assumptions.

It becomes difficult to reason about real infrastructure cost without a simple calculation layer.

This tool exists to make that decision visible in seconds.

No guessing.
No spreadsheet friction.
No hidden assumptions.

Just transparent math.

---

## What it does

• Select a provider and model  
• Enter expected monthly token usage  
• Toggle annual projection  
• Compare two models side by side  
• Generate exportable estimates  
• Share the scenario via URL  

It is intentionally simple and direct.

---

## Features

1. Model Cost Estimation  
   - Separate input and output pricing  
   - Monthly and annual view  
   - Total estimate breakdown  
   - Optional AIsa discount (illustrative)

2. Compare Mode  
   - Model A vs Model B  
   - Clear delta calculation  
   - Decision support for routing

3. Clean UX  
   - Manual Calculate action  
   - Comma formatted token inputs  
   - Mobile responsive layout  
   - Copy as text, markdown, or CSV  

4. Shareable URL State  
   - Current selection encoded in the URL  
   - Easy sharing across teams  

---

## Tech Stack

This project intentionally avoids frameworks.

• HTML  
• CSS  
• Vanilla JavaScript (ES Modules)  
• TSV pricing dataset  
• GitHub for version control  
• Vercel for deployment  

No build step.
No dependency chain.
Full control.

---

## File Structure

openclaw-pricing-calculator/

- index.html  
- styles.css  
- app.js  
- data.js  
- pricing.tsv  
- robots.txt  
- favicon.ico  
- og-image.png  
- README.md  

---

## Local Development

Clone the repo:

git clone https://github.com/Femyn-labs/openclaw-cost-calculator.git

Open index.html in your browser.

That’s it.

If you update pricing.tsv, refresh the page.

---

## Deployment

Deployed via Vercel.

Every push to main automatically redeploys.

---

## Important Notes

• Pricing is based on official list prices.  
• AIsa discount is illustrative only.  
• Always confirm production pricing before infrastructure decisions.  

This tool is for estimation and planning purposes.

---

## Future Enhancements

• Scenario saving  
• Advanced breakdown view  
• Model latency comparison  
• Usage simulation tools  

---

## License

MIT License

Use it.
Fork it.
Improve it.