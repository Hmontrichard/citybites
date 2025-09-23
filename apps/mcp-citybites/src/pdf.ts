import { chromium, type LaunchOptions } from "playwright";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--no-zygote",
  "--disable-gpu",
];

function isDisabled() {
  return process.env.DISABLE_PDF?.toLowerCase() === "true";
}

export async function renderHtmlToPdf(html: string) {
  if (isDisabled()) {
    return null;
  }

  const launchOptions: LaunchOptions = {
    headless: true,
    args: LAUNCH_ARGS,
  };

  const browser = await chromium.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
      printBackground: true,
      displayHeaderFooter: false,
    });

    await page.close();
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
