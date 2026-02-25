import { loadPricingTSV } from "./data.js";

/* ===== Grab elements safely ===== */
const el = (id) => document.getElementById(id);

const modelSearch = el("modelSearch");

const compareModeEl = el("compareMode");
const singleSelectBlock = el("singleSelectBlock");
const compareSelectBlock = el("compareSelectBlock");

const modelSelect = el("modelSelect");
const modelSelectA = el("modelSelectA");
const modelSelectB = el("modelSelectB");

const inputTokensEl = el("inputTokens");
const outputTokensEl = el("outputTokens");

const preset7030 = el("preset7030");
const preset5050 = el("preset5050");

const showAisaEl = el("showAisa");
const aisaDiscountEl = el("aisaDiscount");

const annualModeEl = el("annualMode");

const calculateBtn = el("calculateBtn");
const copyBtn = el("copyBtn");
const copyMarkdownBtn = el("copyMarkdownBtn");
const copyCsvBtn = el("copyCsvBtn");

const resultsEl = el("results");

/* ===== State ===== */
let ALL_MODELS = [];
let VIEW_MODELS = [];
let hasCalculatedOnce = false;

/* Debounced auto-calc timer */
let calcTimer = null;

/* ===== Helpers ===== */
function stripCommas(s) {
  return String(s || "").replace(/,/g, "").trim();
}

function formatWithCommas(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function attachCommaFormatter(inputEl) {
  if (!inputEl) return;

  inputEl.addEventListener("input", (e) => {
    const el = e.target;
    const old = el.value;

    const beforeCursor = old.slice(0, el.selectionStart || 0);
    const digitsBefore = beforeCursor.replace(/[^\d]/g, "").length;

    const next = formatWithCommas(old);
    el.value = next;

    let pos = 0;
    let seen = 0;
    while (pos < next.length) {
      if (/\d/.test(next[pos])) seen++;
      pos++;
      if (seen >= digitsBefore) break;
    }
    el.setSelectionRange(pos, pos);
  });
}

function sanitizeNumber(value) {
  const n = Number(stripCommas(value));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function money(n) {
  return `$${n.toFixed(2)}`;
}

function periodLabel(isAnnual) {
  return isAnnual ? " / year" : " / month";
}

function sortModels(models) {
  return [...models].sort((a, b) => {
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    return a.model.localeCompare(b.model);
  });
}

function filterModels(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return ALL_MODELS;

  return ALL_MODELS.filter((m) => {
    const hay = `${m.provider} ${m.model}`.toLowerCase();
    return hay.includes(q);
  });
}

function fillSelect(selectEl, models, placeholderText = "Select a model...") {
  if (!selectEl) return;

  selectEl.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = placeholderText;
  placeholder.disabled = true;
  placeholder.selected = true;
  selectEl.appendChild(placeholder);

  models.forEach((m, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${m.provider} | ${m.model}`;
    selectEl.appendChild(opt);
  });

  // Force no default selection
  selectEl.value = "";
}

function computeCost(modelRow, inputTokens, outputTokens) {
  const inputCost = (inputTokens / 1_000_000) * modelRow.input_per_1m;
  const outputCost = (outputTokens / 1_000_000) * modelRow.output_per_1m;
  const total = inputCost + outputCost;
  return { inputCost, outputCost, total };
}

function bumpResults() {
  if (!resultsEl) return;
  resultsEl.classList.remove("bump");
  requestAnimationFrame(() => resultsEl.classList.add("bump"));
}

/* ===== UI Messages ===== */
function setResultsPlaceholder() {
  if (!resultsEl) return;
  resultsEl.innerHTML = `
    <div><strong>Ready.</strong></div>
    <div style="margin-top:6px;color:var(--muted);font-size:13px;">
      Select a model, enter tokens, then click <strong>Calculate Cost</strong>.
    </div>
  `;
  resultsEl.dataset.copyText = "";
  resultsEl.dataset.copyMarkdown = "";
  resultsEl.dataset.copyCsv = "";
}

function setHint(title, body) {
  if (!resultsEl) return;
  resultsEl.innerHTML = `
    <div><strong>${title}</strong></div>
    <div style="margin-top:6px;color:var(--muted);font-size:13px;">
      ${body}
    </div>
  `;
  resultsEl.dataset.copyText = "";
  resultsEl.dataset.copyMarkdown = "";
  resultsEl.dataset.copyCsv = "";
}

function markDirty(title = "Inputs changed.", body = "Click Calculate Cost to refresh results.") {
  if (!hasCalculatedOnce) return; // before first calculate, keep it simple
  setHint(title, body);
}

/* Debounced auto-calc after user has clicked Calculate once */
function scheduleAutoCalc() {
  if (!hasCalculatedOnce) return;

  clearTimeout(calcTimer);
  calcTimer = setTimeout(() => {
    calculate(true); // auto run
  }, 650);
}

/* ===== Dropdown population ===== */
function populateAllDropdowns(models) {
  VIEW_MODELS = models;

  fillSelect(modelSelect, models, "Select a model...");
  fillSelect(modelSelectA, models, "Select Model A...");
  fillSelect(modelSelectB, models, "Select Model B...");
}

/* ===== Result builders ===== */
function buildSingleResult(selected, inputTokens, outputTokens, costs, showAisa, discountPct, isAnnual) {
  const { inputCost, outputCost, total } = costs;

  let aisaTile = "";
  let aisaCopyLine = "";
  let aisaMd = "";
  let aisaCsv = "";

  if (showAisa) {
    const discounted = total * (1 - discountPct / 100);

    aisaTile = `
      <div class="tile">
        <div class="k">AIsa estimate</div>
        <div class="v">${money(discounted)}${periodLabel(isAnnual)}</div>
        <div class="s">Illustrative only, assumes ${discountPct}% discount.</div>
      </div>
    `;

    aisaCopyLine = `\nAIsa estimate (illustrative, ${discountPct}%): ${money(discounted)}${periodLabel(isAnnual)}`;
    aisaMd = `\n- **AIsa estimate (illustrative, ${discountPct}%)**: ${money(discounted)}${periodLabel(isAnnual)}`;
    aisaCsv = `,${discounted.toFixed(2)},${discountPct}`;
  }

  const titleLine = isAnnual ? "Model Cost Estimate (Annual)" : "Model Cost Estimate (Monthly)";

  const copyText = [
    titleLine,
    `Provider: ${selected.provider}`,
    `Model: ${selected.model}`,
    `Monthly input tokens: ${inputTokens.toLocaleString()}`,
    `Monthly output tokens: ${outputTokens.toLocaleString()}`,
    `Input cost: ${money(inputCost)}${periodLabel(isAnnual)}`,
    `Output cost: ${money(outputCost)}${periodLabel(isAnnual)}`,
    `Total: ${money(total)}${periodLabel(isAnnual)}`,
  ].join("\n") + aisaCopyLine;

  const markdown = [
    `### ${titleLine}`,
    `- **Provider**: ${selected.provider}`,
    `- **Model**: ${selected.model}`,
    `- **Monthly input tokens**: ${inputTokens.toLocaleString()}`,
    `- **Monthly output tokens**: ${outputTokens.toLocaleString()}`,
    `- **Input cost**: **${money(inputCost)}${periodLabel(isAnnual)}**`,
    `- **Output cost**: **${money(outputCost)}${periodLabel(isAnnual)}**`,
    `- **Total**: **${money(total)}${periodLabel(isAnnual)}**`,
  ].join("\n") + aisaMd;

  const csv =
    [
      `"${selected.provider}"`,
      `"${selected.model}"`,
      inputTokens,
      outputTokens,
      selected.input_per_1m,
      selected.output_per_1m,
      inputCost.toFixed(2),
      outputCost.toFixed(2),
      total.toFixed(2),
    ].join(",") +
    (showAisa ? aisaCsv : ",,") +
    `,"${isAnnual ? "year" : "month"}"`;

  const html = `
    <div class="badge">${selected.provider} | ${selected.model}</div>

    <div class="tiles">
      <div class="tile">
        <div class="k">Input cost</div>
        <div class="v">${money(inputCost)}${periodLabel(isAnnual)}</div>
        <div class="s">${inputTokens.toLocaleString()} monthly tokens × $${selected.input_per_1m}/1M</div>
      </div>

      <div class="tile">
        <div class="k">Output cost</div>
        <div class="v">${money(outputCost)}${periodLabel(isAnnual)}</div>
        <div class="s">${outputTokens.toLocaleString()} monthly tokens × $${selected.output_per_1m}/1M</div>
      </div>

      <div class="tile big">
        <div class="k">Total estimate</div>
        <div class="v">${money(total)}${periodLabel(isAnnual)}</div>
        <div class="s">Token-based estimate using official list pricing.</div>
      </div>

      ${aisaTile}
    </div>
  `;

  return { html, copyText, markdown, csv };
}

function buildCompareResult(a, b, inputTokens, outputTokens, ca, cb, isAnnual) {
  const delta = cb.total - ca.total;
  const deltaText = delta >= 0 ? `+${money(delta)}` : `-${money(Math.abs(delta))}`;

  const titleLine = isAnnual ? "Model Compare (Annual)" : "Model Compare (Monthly)";

  const copyText = [
    titleLine,
    `Monthly tokens: Input ${inputTokens.toLocaleString()}, Output ${outputTokens.toLocaleString()}`,
    ``,
    `A: ${a.provider} | ${a.model} => ${money(ca.total)}${periodLabel(isAnnual)}`,
    `B: ${b.provider} | ${b.model} => ${money(cb.total)}${periodLabel(isAnnual)}`,
    `Delta (B - A): ${deltaText}${periodLabel(isAnnual)}`,
  ].join("\n");

  const markdown = [
    `### ${titleLine}`,
    `- **Monthly tokens**: Input ${inputTokens.toLocaleString()}, Output ${outputTokens.toLocaleString()}`,
    `- **A**: ${a.provider} | ${a.model} = **${money(ca.total)}${periodLabel(isAnnual)}**`,
    `- **B**: ${b.provider} | ${b.model} = **${money(cb.total)}${periodLabel(isAnnual)}**`,
    `- **Delta (B - A)**: **${deltaText}${periodLabel(isAnnual)}**`,
  ].join("\n");

  const csv = [
    `"${a.provider}"`,
    `"${a.model}"`,
    ca.total.toFixed(2),
    `"${b.provider}"`,
    `"${b.model}"`,
    cb.total.toFixed(2),
    delta.toFixed(2),
    `"${isAnnual ? "year" : "month"}"`,
  ].join(",");

  const html = `
    <div class="badge">Compare Mode</div>

    <div class="tiles">
      <div class="tile">
        <div class="k">Model A</div>
        <div class="v">${money(ca.total)}${periodLabel(isAnnual)}</div>
        <div class="s">${a.provider} | ${a.model}</div>
      </div>

      <div class="tile">
        <div class="k">Model B</div>
        <div class="v">${money(cb.total)}${periodLabel(isAnnual)}</div>
        <div class="s">${b.provider} | ${b.model}</div>
      </div>

      <div class="tile big">
        <div class="k">Delta (B - A)</div>
        <div class="v">${deltaText}${periodLabel(isAnnual)}</div>
        <div class="s">Positive means B is more expensive than A.</div>
      </div>
    </div>
  `;

  return { html, copyText, markdown, csv };
}

/* ===== Core calculation =====
   calculate(isAuto) allows different UX hints; actual math is same.
*/
function calculate(isAuto = false) {
  if (!resultsEl) return;

  if (!VIEW_MODELS.length) {
    setHint("No models loaded.", "Check your pricing.tsv and refresh.");
    return;
  }

  const rawIn = (inputTokensEl?.value || "").trim();
  const rawOut = (outputTokensEl?.value || "").trim();

  if (!rawIn || !rawOut) {
    setHint("Enter your token usage.", "Fill monthly input and output tokens, or use a preset.");
    return;
  }

  const inputTokens = sanitizeNumber(rawIn);
  const outputTokens = sanitizeNumber(rawOut);

  const showAisa = !!showAisaEl?.checked;
  const discountPct = Math.min(100, sanitizeNumber(aisaDiscountEl?.value || 0));

  const isAnnual = !!annualModeEl?.checked;
  const mult = isAnnual ? 12 : 1;

  const isCompare = !!compareModeEl?.checked;

  // Validate selections
  if (!isCompare) {
    if (!modelSelect || modelSelect.value === "") {
      setHint("Select a model to begin.", "Choose a provider and model, then calculate.");
      return;
    }
  } else {
    if (!modelSelectA || modelSelectA.value === "" || !modelSelectB || modelSelectB.value === "") {
      setHint("Select Model A and Model B.", "Pick two models, then calculate.");
      return;
    }
  }

  if (!isCompare) {
    const selected = VIEW_MODELS[Number(modelSelect.value)];
    if (!selected) {
      setHint("Invalid selection.", "Re-select the model and try again.");
      return;
    }

    const monthly = computeCost(selected, inputTokens, outputTokens);
    const costs = {
      inputCost: monthly.inputCost * mult,
      outputCost: monthly.outputCost * mult,
      total: monthly.total * mult,
    };

    const rendered = buildSingleResult(selected, inputTokens, outputTokens, costs, showAisa, discountPct, isAnnual);
    resultsEl.innerHTML = rendered.html;
    resultsEl.dataset.copyText = rendered.copyText;
    resultsEl.dataset.copyMarkdown = rendered.markdown || "";
    resultsEl.dataset.copyCsv = rendered.csv || "";
    bumpResults();
    return;
  }

  // Compare mode
  const idxA = Number(modelSelectA.value);
  const idxB = Number(modelSelectB.value);

  const a = VIEW_MODELS[idxA];
  const b = VIEW_MODELS[idxB];

  if (!a || !b) {
    setHint("Could not load selected models.", "Try re-selecting both models, then calculate again.");
    return;
  }

  const caMonthly = computeCost(a, inputTokens, outputTokens);
  const cbMonthly = computeCost(b, inputTokens, outputTokens);

  const ca = {
    inputCost: caMonthly.inputCost * mult,
    outputCost: caMonthly.outputCost * mult,
    total: caMonthly.total * mult,
  };

  const cb = {
    inputCost: cbMonthly.inputCost * mult,
    outputCost: cbMonthly.outputCost * mult,
    total: cbMonthly.total * mult,
  };

  const rendered = buildCompareResult(a, b, inputTokens, outputTokens, ca, cb, isAnnual);
  resultsEl.innerHTML = rendered.html;
  resultsEl.dataset.copyText = rendered.copyText;
  resultsEl.dataset.copyMarkdown = rendered.markdown || "";
  resultsEl.dataset.copyCsv = rendered.csv || "";
  bumpResults();
}

/* ===== Events ===== */
function hookEvents() {
  // Search behavior: filter dropdowns, auto-select in single mode if exactly 1 match
  if (modelSearch) {
    modelSearch.addEventListener("input", (e) => {
      const filtered = sortModels(filterModels(e.target.value));
      populateAllDropdowns(filtered);

      const isCompare = !!compareModeEl?.checked;

      if (!isCompare && filtered.length === 1 && modelSelect) {
        modelSelect.value = "0";
        markDirty("1 match found.", "Model selected. Click Calculate or keep typing.");
        scheduleAutoCalc();
        return;
      }

      if (filtered.length === 0) {
        markDirty("No matches found.", "Try a different keyword.");
        return;
      }

      markDirty(`${filtered.length} matches found.`, "Pick a model, then click Calculate.");
    });
  }

  // Toggle compare mode UI
  if (compareModeEl && singleSelectBlock && compareSelectBlock) {
    compareModeEl.addEventListener("change", () => {
      const isCompare = compareModeEl.checked;
      singleSelectBlock.style.display = isCompare ? "none" : "block";
      compareSelectBlock.style.display = isCompare ? "grid" : "none";

      // Reset selections on mode change
      if (modelSelect) modelSelect.value = "";
      if (modelSelectA) modelSelectA.value = "";
      if (modelSelectB) modelSelectB.value = "";

      markDirty("Mode changed.", "Pick your model(s), then calculate.");
    });
  }

  // Changes mark dirty, then schedule auto-calc (after first manual calculate)
  const changeTriggers = [
    modelSelect,
    modelSelectA,
    modelSelectB,
    inputTokensEl,
    outputTokensEl,
    showAisaEl,
    aisaDiscountEl,
    annualModeEl,
  ].filter(Boolean);

  changeTriggers.forEach((node) => {
    const evt = node.tagName === "INPUT" ? "input" : "change";
    node.addEventListener(evt, () => {
      markDirty("Updating…", "Results refresh automatically when you pause, or click Calculate.");
      scheduleAutoCalc();
    });
  });

  // Presets set values, then schedule auto-calc
  if (preset7030) {
    preset7030.addEventListener("click", () => {
      if (inputTokensEl) inputTokensEl.value = 7000000;
      if (outputTokensEl) outputTokensEl.value = 3000000;
      markDirty("Preset applied.", "Refreshing estimate…");
      scheduleAutoCalc();
    });
  }

  if (preset5050) {
    preset5050.addEventListener("click", () => {
      if (inputTokensEl) inputTokensEl.value = 5000000;
      if (outputTokensEl) outputTokensEl.value = 5000000;
      markDirty("Preset applied.", "Refreshing estimate…");
      scheduleAutoCalc();
    });
  }

  // Calculate button (official commit)
  if (calculateBtn) {
    calculateBtn.addEventListener("click", () => {
    hasCalculatedOnce = true;

    // shimmer on
    calculateBtn.classList.add("is-loading");

    // do the compute
    calculate(false);

    // shimmer off quickly (feels instant but polished)
    setTimeout(() => {
    calculateBtn.classList.remove("is-loading");
      }, 650);
    });
  }

  // Copy helper
  async function copyAny(text, btnEl, originalLabel) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      btnEl.textContent = "Copied!";
      setTimeout(() => (btnEl.textContent = originalLabel), 1200);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);

      btnEl.textContent = "Copied!";
      setTimeout(() => (btnEl.textContent = originalLabel), 1200);
    }
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const txt = resultsEl?.dataset?.copyText || "";
      copyAny(txt, copyBtn, "Copy Result");
    });
  }

  if (copyMarkdownBtn) {
    copyMarkdownBtn.addEventListener("click", () => {
      const txt = resultsEl?.dataset?.copyMarkdown || "";
      copyAny(txt, copyMarkdownBtn, "Copy Markdown");
    });
  }

  if (copyCsvBtn) {
    copyCsvBtn.addEventListener("click", () => {
      const txt = resultsEl?.dataset?.copyCsv || "";
      copyAny(txt, copyCsvBtn, "Copy CSV");
    });
  }
}

/* ===== Init ===== */
async function init() {
  if (!resultsEl) return;

  try {
    setResultsPlaceholder();

    const models = await loadPricingTSV();
    ALL_MODELS = sortModels(models);
    populateAllDropdowns(ALL_MODELS);

    attachCommaFormatter(inputTokensEl);
    attachCommaFormatter(outputTokensEl);

    hookEvents();
  } catch (err) {
    resultsEl.innerHTML = `<strong style="color:#b00020;">Error:</strong> ${err.message}`;
  }
}

init();