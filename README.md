# Beccario

Traduce qualsiasi roba in becchese.

- `index.html` — la pagina
- `api/becco.js` — edge function che fa da proxy verso Claude (il prompt del becchese sta qui)

Richiede la variabile d'ambiente `ANTHROPIC_API_KEY` su Vercel (Production).

Live: https://beccario.vercel.app
