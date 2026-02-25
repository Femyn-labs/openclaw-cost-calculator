// data.js
export async function loadPricingTSV() {
  const res = await fetch("./pricing.tsv");
  if (!res.ok) {
    throw new Error("Could not load pricing.tsv. Make sure the file exists in the project root.");
  }

  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error("pricing.tsv looks empty. Paste your dataset including the header row.");
  }

  const header = lines[0].split("\t").map((h) => h.trim());

  const idxProvider = header.indexOf("Provider");
  const idxModel = header.indexOf("Model");
  const idxInput = header.indexOf("Input $/1M");
  const idxOutput = header.indexOf("Output $/1M");

  if (idxProvider === -1 || idxModel === -1 || idxInput === -1 || idxOutput === -1) {
    throw new Error(
      "pricing.tsv missing required headers. Must include: Provider, Model, Input $/1M, Output $/1M"
    );
  }

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");

    const provider = (cols[idxProvider] || "").trim();
    const model = (cols[idxModel] || "").trim();

    const inputRaw = (cols[idxInput] || "").trim();
    const outputRaw = (cols[idxOutput] || "").trim();

    // Accept values like "$0.625" or "0.625"
    const input_per_1m = Number(inputRaw.replace("$", "").replace(",", ""));
    const output_per_1m = Number(outputRaw.replace("$", "").replace(",", ""));

    if (!provider || !model) continue;
    if (!Number.isFinite(input_per_1m) || !Number.isFinite(output_per_1m)) continue;

    rows.push({
      provider,
      model,
      input_per_1m,
      output_per_1m,
    });
  }

  if (rows.length === 0) {
    throw new Error(
      "No valid rows found. Check that Input $/1M and Output $/1M are numeric (like $1.25)."
    );
  }

  return rows;
}