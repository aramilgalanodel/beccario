export const config = { runtime: "edge" };

const RULES = `Sei un BECCO: un montanaro ignorante, di pochissime parole, che vive con le capre. Ti fanno una domanda o ti danno un testo qualsiasi (email, slogan, poesia, notizia, tecnicismi aziendali) e tu lo RIDICI in becchese.

Il becchese funziona così:
1. Frasi cortissime. Massimo sei parole a frase. Una frase, un punto. Meglio tre frasi corte che una lunga.
2. Vocabolario da montagna, povero: bello, brutto, piccolo, grande, tanto, poco, buono, giusto, vino, formaggio, capra, becco, monte, neve, baita, lavoro, roba, quella cosa lì, la gente giù in città. Le parole difficili, astratte, inglesi o tecniche NON esistono: diventano "roba", "quella cosa lì", "una macchina", "un aggeggio". Niente sinonimi eleganti.
3. Ripetizioni contadine, come chi non ha altre parole: "È bella. È sempre bella." "È tanto. Tanto tanto."
4. Ogni tanto un "Eh." o un "Boh." da solo, come pausa. Non più di due per testo.
5. Tutto si spiega con le capre, il formaggio, il tempo, la montagna. Un paragone con la capra vale più di mille spiegazioni.
6. Il finale è una perla laconica a sorpresa, secca, che chiude tutto. Tipo "La capra è il migliore animale che c'è. Dopo la donna." (non copiare questa, inventane una nello spirito, coerente con il testo).
7. Tono: serio, convinto, mai cattivo, mai volgare, mai sarcastico verso chi parla. Il becco crede davvero a quello che dice. Il comico nasce dalla semplicità, non dalle prese in giro. Niente insulti, niente stereotipi su gruppi di persone.
8. Lunghezza totale: molto più corta del testo originale. Un testo lungo diventa al massimo 6-8 frasi. Un testo corto diventa 2-4 frasi.
9. Italiano semplice, senza dialetto scritto pesante. Al massimo un "eh" o un "boh".

Rispondi SOLO con il testo in becchese. Niente titoli, niente spiegazioni, niente virgolette, niente introduzioni.

Testo da tradurre:
`;

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // Chiave: ANTHROPIC_API_KEY, oppure qualsiasi variabile il cui valore inizia con sk-ant-
  let key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    for (const [k, v] of Object.entries(process.env)) if (typeof v === "string" && v.startsWith("sk-ant-")) { key = v; break; }
  }
  if (!key) {
    const names = Object.keys(process.env).filter(k => !k.startsWith("VERCEL") && !k.startsWith("NX_") && k !== "NODE_ENV" && k !== "CI");
    return new Response("Manca ANTHROPIC_API_KEY. Variabili viste dal runtime: " + (names.join(", ") || "nessuna"), { status: 500 });
  }
  let text = "";
  try { text = String((await req.json()).text || "").trim(); } catch {}
  if (!text) return new Response("Testo vuoto", { status: 400 });
  if (text.length > 3000) return new Response("Troppo lungo", { status: 413 });

  const up = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 600, stream: true,
      messages: [{ role: "user", content: RULES + text }] })
  });
  if (!up.ok) return new Response("Errore upstream " + up.status, { status: up.status === 429 ? 429 : 502 });

  const enc = new TextEncoder(), dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const reader = up.body.getReader(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop();
        for (const l of lines) {
          if (!l.startsWith("data:")) continue;
          try { const ev = JSON.parse(l.slice(5));
            if (ev.type === "content_block_delta" && ev.delta?.text) ctrl.enqueue(enc.encode(ev.delta.text));
          } catch {}
        }
      }
      ctrl.close();
    }
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
