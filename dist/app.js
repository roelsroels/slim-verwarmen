const STORAGE_KEY = "slim-verwarmen-v1";
const DEFAULTS = {
  electricity: 0.41,
  gas: 1.836,
  outside: 8,
  inside: 19.5,
  target: 20,
  duration: 4,
  boilerEfficiency: 90,
  heatLoss: 50,
  gasSurcharge: 0.81505,
  electricitySurcharge: 0.145,
};

const els = Object.fromEntries(
  [
    "electricityPrice", "gasPrice", "outsideTemp", "insideTemp", "targetTemp", "duration",
    "boilerEfficiency", "heatLoss", "gasSurcharge", "electricitySurcharge", "outsideDisplay",
    "recommendationTitle", "recommendationSubtitle", "recommendationIcon", "savingValue", "savingLabel",
    "reasonText", "heatPumpCost", "gasCost", "copValue", "boilerEfficiencyValue", "breakEvenPrice",
    "breakEvenCop", "heatPumpHourly", "gasHourly", "heatPumpBar", "gasBar", "heatDemand",
    "fourHourSaving", "capacityStatus", "explanationTitle", "explanationText", "dataStatus",
    "weatherTime", "weatherNote", "refreshButton", "resetButton", "toast"
  ].map((id) => [id, document.getElementById(id)])
);

const fields = {
  electricity: els.electricityPrice,
  gas: els.gasPrice,
  outside: els.outsideTemp,
  inside: els.insideTemp,
  target: els.targetTemp,
  duration: els.duration,
  boilerEfficiency: els.boilerEfficiency,
  heatLoss: els.heatLoss,
  gasSurcharge: els.gasSurcharge,
  electricitySurcharge: els.electricitySurcharge,
};

const nf = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const money = (value, digits = 3) => `€ ${new Intl.NumberFormat("nl-NL", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function loadState() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) {}
  const params = new URLSearchParams(location.search);
  const state = { ...DEFAULTS, ...saved };
  for (const key of Object.keys(fields)) {
    if (params.has(key) && Number.isFinite(Number(params.get(key)))) state[key] = Number(params.get(key));
  }
  return state;
}

let state = loadState();
let liveParts = new Set();

function populate() {
  for (const [key, input] of Object.entries(fields)) input.value = state[key];
}

function readForm() {
  for (const [key, input] of Object.entries(fields)) {
    const value = Number(input.value);
    if (Number.isFinite(value)) state[key] = value;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function estimateCop(outside, target) {
  // Curve anchored to the SCM40ZS-W nominal 4.5 kW heat / 0.83 kW input label,
  // then reduced for colder air, defrost and a higher supply-air target.
  const points = [[-10, 2.15], [-7, 2.45], [-2, 3.05], [2, 3.65], [7, 4.55], [10, 5.05], [15, 5.35]];
  let cop = points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (outside <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      cop = y0 + ((outside - x0) / (x1 - x0)) * (y1 - y0);
      break;
    }
    cop = points[i][1];
  }
  if (outside > -1 && outside < 5) cop *= 0.92; // practical defrost allowance
  cop -= Math.max(0, target - 20) * 0.08;
  return clamp(cop, 1.8, 5.4);
}

function calculate() {
  readForm();
  const cop = estimateCop(state.outside, state.target);
  const efficiency = state.boilerEfficiency / 100;
  const gasHeatKwh = 9.77 * efficiency;
  const hpUnitCost = state.electricity / cop;
  const gasUnitCost = state.gas / gasHeatKwh;
  const breakEvenPrice = gasUnitCost * cop;
  const breakEvenCop = state.electricity / gasUnitCost;

  // 50 W/m² is interpreted at a 20 K indoor/outdoor difference.
  const steadyDemand = 60 * state.heatLoss * Math.max(0, state.target - state.outside) / 20 / 1000;
  const warmupDemand = Math.max(0, state.target - state.inside) * 0.55;
  const heatDemand = clamp(steadyDemand + warmupDemand, 0.3, 7.5);
  const hpDeliverable = Math.min(4.5, heatDemand);
  const hpHourly = hpDeliverable * hpUnitCost + Math.max(0, heatDemand - 4.5) * gasUnitCost;
  const gasHourly = heatDemand * gasUnitCost;
  const hpWins = hpHourly < gasHourly;
  const capacityLimited = heatDemand > 4.5;
  const savingHourly = Math.abs(gasHourly - hpHourly);
  const savingPercent = Math.round(savingHourly / Math.max(hpHourly, gasHourly) * 100);
  const periodSaving = savingHourly * state.duration;

  els.outsideDisplay.textContent = state.outside.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
  els.heatPumpCost.textContent = money(hpUnitCost);
  els.gasCost.textContent = money(gasUnitCost);
  els.copValue.textContent = nf.format(cop);
  els.boilerEfficiencyValue.textContent = `${state.boilerEfficiency.toFixed(0)}%`;
  els.breakEvenPrice.textContent = money(breakEvenPrice);
  els.breakEvenCop.textContent = nf.format(breakEvenCop);
  els.heatPumpHourly.textContent = `${money(hpHourly, 2)}/uur`;
  els.gasHourly.textContent = `${money(gasHourly, 2)}/uur`;
  els.heatDemand.textContent = `${nf.format(heatDemand)} kW`;
  els.fourHourSaving.textContent = `${money(periodSaving, 2)} voordeel`;
  els.capacityStatus.textContent = capacityLimited ? "Combineren" : "Voldoende";

  const maxHourly = Math.max(hpHourly, gasHourly) * 1.08;
  els.heatPumpBar.style.width = `${(hpHourly / maxHourly) * 100}%`;
  els.gasBar.style.width = `${(gasHourly / maxHourly) * 100}%`;

  if (capacityLimited && hpWins) {
    els.recommendationTitle.textContent = "Hybride";
    els.recommendationSubtitle.textContent = "Laat de airco de basis doen en gebruik gas alleen voor het tekort.";
    els.recommendationIcon.textContent = "◐";
    els.reasonText.textContent = `De vraag is circa ${nf.format(heatDemand)} kW; de airco is berekend op maximaal 4,5 kW warmte.`;
  } else if (hpWins) {
    els.recommendationTitle.textContent = "Airco";
    els.recommendationSubtitle.textContent = "De Mitsubishi warmtepomp levert nu de goedkoopste warmte.";
    els.recommendationIcon.textContent = "❄";
    els.reasonText.textContent = `De geschatte COP is ${nf.format(cop)}; de airco blijft voordelig zolang stroom onder ${money(breakEvenPrice)} per kWh blijft.`;
  } else {
    els.recommendationTitle.textContent = "Cv-ketel";
    els.recommendationSubtitle.textContent = "Gas levert in deze situatie de goedkoopste warmte.";
    els.recommendationIcon.textContent = "♨";
    els.reasonText.textContent = `Voor de huidige stroomprijs is een COP van ${nf.format(breakEvenCop)} nodig; de schatting is ${nf.format(cop)}.`;
  }

  els.savingValue.textContent = `${money(savingHourly, 2)} · ${savingPercent}%`;
  els.savingLabel.textContent = hpWins ? "goedkoper per uur met airco" : "goedkoper per uur met gas";
  els.explanationTitle.textContent = hpWins ? "De warmtepomp haalt meer warmte uit iedere euro." : "De stroomprijs ligt boven het huidige omslagpunt.";
  els.explanationText.textContent = hpWins
    ? `Bij ${state.outside.toLocaleString("nl-NL")} °C buiten rekenen we met een COP van ${nf.format(cop)}. Eén kWh stroom levert dan ongeveer ${nf.format(cop)} kWh warmte. Met jouw prijzen kost die warmte ${money(hpUnitCost)} per kWh, tegenover ${money(gasUnitCost)} via de cv-ketel.`
    : `Met de huidige prijzen kost warmte via de airco ${money(hpUnitCost)} per kWh en via de cv-ketel ${money(gasUnitCost)}. Een lagere stroomprijs, hogere buitentemperatuur of lagere gewenste kamertemperatuur kan de keuze weer omdraaien.`;
}

function getLocalDayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function extractPrices(payload) {
  const candidates = [payload?.Prices, payload?.prices, payload?.data, payload?.items, payload?.values];
  const list = candidates.find(Array.isArray) || [];
  return list.map((item) => ({
    time: new Date(item.readingDate || item.timestamp || item.start || item.date || item.from),
    price: Number(item.price ?? item.value ?? item.amount ?? item?.price?.incl ?? item?.tariff?.incl),
  })).filter((item) => Number.isFinite(item.price) && !Number.isNaN(item.time.getTime()));
}

async function fetchEnergyZero(usageType) {
  const { start, end } = getLocalDayRange();
  const url = new URL("https://api.energyzero.nl/v1/energyprices");
  url.searchParams.set("fromDate", start.toISOString());
  url.searchParams.set("tillDate", end.toISOString());
  url.searchParams.set("interval", usageType === 3 ? "5" : "3");
  url.searchParams.set("usageType", String(usageType));
  url.searchParams.set("inclBtw", "true");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`EnergyZero ${response.status}`);
  const prices = extractPrices(await response.json());
  if (!prices.length) throw new Error("Geen prijsgegevens ontvangen");
  const now = Date.now();
  return prices.reduce((best, entry) => Math.abs(entry.time - now) < Math.abs(best.time - now) ? entry : best).price;
}

async function fetchLiveData() {
  els.refreshButton.classList.add("loading");
  liveParts = new Set();
  const jobs = [
    fetch("https://api.open-meteo.com/v1/forecast?latitude=52.3676&longitude=4.9041&current=temperature_2m&timezone=Europe%2FAmsterdam")
      .then((r) => { if (!r.ok) throw new Error("weer"); return r.json(); })
      .then((data) => {
        const temperature = Number(data?.current?.temperature_2m);
        if (!Number.isFinite(temperature)) throw new Error("weer");
        state.outside = temperature;
        fields.outside.value = temperature;
        els.weatherTime.textContent = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date());
        liveParts.add("weer");
      }),
    fetchEnergyZero(1).then((raw) => {
      state.electricity = raw + state.electricitySurcharge;
      fields.electricity.value = state.electricity.toFixed(4);
      liveParts.add("stroom");
    }),
    fetchEnergyZero(3).then((raw) => {
      state.gas = raw + state.gasSurcharge;
      fields.gas.value = state.gas.toFixed(4);
      liveParts.add("gas");
    }),
  ];

  const results = await Promise.allSettled(jobs);
  els.refreshButton.classList.remove("loading");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  calculate();
  if (liveParts.size === 3) {
    els.dataStatus.classList.add("live");
    els.dataStatus.innerHTML = "<i></i> Actuele marktdata";
    showToast("Prijzen en weer zijn bijgewerkt");
  } else {
    els.dataStatus.classList.toggle("live", liveParts.size > 0);
    els.dataStatus.innerHTML = `<i></i> ${liveParts.size ? "Deels actueel" : "Handmatige waarden"}`;
    els.weatherNote.textContent = "Niet alle bronnen waren bereikbaar; de laatst opgeslagen waarden blijven actief.";
    if (results.every((r) => r.status === "rejected")) showToast("Live bronnen niet bereikbaar — opgeslagen waarden gebruikt");
  }
}

let toastTimer;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2800);
}

document.getElementById("strategyForm").addEventListener("input", calculate);
document.querySelector(".advanced-grid").addEventListener("input", calculate);
els.refreshButton.addEventListener("click", fetchLiveData);
els.resetButton.addEventListener("click", () => {
  state = { ...DEFAULTS };
  localStorage.removeItem(STORAGE_KEY);
  populate();
  calculate();
  showToast("Standaardwaarden hersteld");
});

populate();
calculate();
fetchLiveData();
