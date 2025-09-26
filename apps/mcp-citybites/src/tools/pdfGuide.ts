import { z } from "zod";
import { escapeHtml, formatDateLabel, safeParseJsonBlock, normalise } from "../utils/text.js";
import { renderHtmlToPdf } from "../pdf.js";
import { logger } from "../logger.js";

export const PdfBuildSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  city: z.string().optional(),
  theme: z.string().optional(),
  summary: z.string().optional(),
  distanceKm: z.number().optional(),
  tips: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
  days: z.array(
    z.object({
      date: z.string(),
      blocks: z.array(z.object({ time: z.string(), name: z.string(), summary: z.string() })),
    }),
  ),
});

export const PdfBuildResultSchema = z.object({
  filename: z.string(),
  content: z.string(),
  format: z.enum(["pdf", "html"]),
  encoding: z.enum(["base64", "utf-8"]).optional(),
  mimeType: z.string(),
  warning: z.string().optional(),
  htmlFallback: z.string().optional(),
});

export type PdfBuildInput = z.infer<typeof PdfBuildSchema>;
export type PdfBuildOutput = z.infer<typeof PdfBuildResultSchema>;

function buildGuideHtml({
  title,
  subtitle,
  city,
  theme,
  summary,
  distanceKm,
  tips = [],
  highlights = [],
  days,
}: PdfBuildInput) {
  const badge = theme ? `<span class="badge">${escapeHtml(theme)}</span>` : "";
  const cityLine = city ? `<p class="hero-meta">${escapeHtml(city)}${
    distanceKm ? ` · ${distanceKm.toFixed(1)} km` : ""
  }</p>` : distanceKm ? `<p class="hero-meta">${distanceKm.toFixed(1)} km</p>` : "";
  const heroSubtitle = subtitle ? `<p class="hero-subtitle">${escapeHtml(subtitle)}</p>` : "";
  const heroSummary = summary ? `<p class="hero-summary">${escapeHtml(summary)}</p>` : "";

  const highlightsList = highlights.length
    ? `<section class="section section-highlights">
        <h2>À goûter absolument</h2>
        <ul>
          ${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n        ")}
        </ul>
      </section>`
    : "";

  const tipsList = tips.length
    ? `<section class="section section-tips">
        <h2>Budget & conseils</h2>
        <ul>
          ${tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("\n        ")}
        </ul>
      </section>`
    : `<section class="section section-tips">
        <h2>Budget & conseils</h2>
        <ul>
          <li>Prévois une enveloppe flexible (entrées + repas) selon tes envies.</li>
          <li>Réserve les tables du soir à l’avance, surtout le week-end.</li>
          <li>Garde une option “pluie” et une option “soirée” pour chaque bloc.</li>
        </ul>
      </section>`;

  const daySections = days
    .map((day, dayIndex) => {
      const stops = day.blocks
        .map((block, blockIndex) => {
          const label = `${dayIndex + 1}.${blockIndex + 1}`;
          return `<article class="stop">
              <header>
                <span class="stop-order">${escapeHtml(label)}</span>
                <div class="stop-info">
                  <h3>${escapeHtml(block.name)}</h3>
                  <p class="stop-time">${escapeHtml(block.time)}</p>
                </div>
              </header>
              <p class="stop-summary">${escapeHtml(block.summary)}</p>
            </article>`;
        })
        .join("\n");

      return `<section class="section day">
          <h2>${formatDateLabel(day.date)}</h2>
          <div class="stops">
            ${stops}
          </div>
        </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Helvetica Neue", Arial, sans-serif;
        background: #f5f5f6;
        color: #1f2a37;
      }

      body { margin: 0; padding: 0; }
      .wrap { max-width: 840px; margin: 0 auto; padding: 48px 32px 64px; }
      header.hero { background: linear-gradient(135deg, #ff7a18 0%, #af002d 74%); color: #fff; padding: 48px; border-radius: 24px; box-shadow: 0 12px 24px rgba(0, 0, 0, 0.16); }
      .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 16px; }
      .hero-title { font-size: 42px; margin: 0 0 12px; }
      .hero-subtitle, .hero-summary, .hero-meta { font-size: 17px; line-height: 1.6; margin: 8px 0; max-width: 580px; }
      main { margin-top: 40px; display: grid; gap: 32px; }
      .section { background: #fff; padding: 32px; border-radius: 20px; box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08); }
      .section h2 { margin-top: 0; font-size: 24px; }
      .section ul { padding-left: 20px; line-height: 1.5; }
      .stops { display: grid; gap: 20px; }
      .stop { border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; display: grid; gap: 12px; background: #fcfdff; }
      .stop header { display: flex; align-items: center; gap: 16px; }
      .stop-order { width: 36px; height: 36px; border-radius: 12px; background: #1f2937; color: #fff; font-weight: 600; display: flex; align-items: center; justify-content: center; }
      .stop-info h3 { margin: 0; font-size: 20px; }
      .stop-time { margin: 0; color: #64748b; font-size: 15px; }
      .stop-summary { margin: 0; font-size: 16px; line-height: 1.6; }
      footer { text-align: center; color: #94a3b8; font-size: 13px; margin-top: 48px; }
      @media print { body { background: #fff; } .wrap { padding: 24px; } header.hero { box-shadow: none; color: #1f2a37; background: #fef3c7; } .section { box-shadow: none; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header class="hero">
        ${badge}
        <h1 class="hero-title">${escapeHtml(title)}</h1>
        ${heroSubtitle}
        ${cityLine}
        ${heroSummary}
      </header>
      <main>
        ${highlightsList}
        ${daySections}
        ${tipsList}
      </main>
      <footer>Créé avec CityBites — partage tes découvertes gourmandes.</footer>
    </div>
  </body>
</html>`;
}

export async function handlePdfBuild(input: PdfBuildInput): Promise<PdfBuildOutput> {
  const html = buildGuideHtml(input);
  try {
    const pdfBuffer = await renderHtmlToPdf(html);
    if (!pdfBuffer) {
      throw new Error("PDF désactivé (DISABLE_PDF=true)");
    }
    return {
      filename: "guide.pdf",
      content: pdfBuffer.toString("base64"),
      format: "pdf",
      encoding: "base64",
      mimeType: "application/pdf"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de générer le PDF";
    logger.warn({ msg: 'pdf:failed', error: message });
    throw new Error(message);
  }
}
