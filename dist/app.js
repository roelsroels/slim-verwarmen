const STORAGE_KEY = "slim-verwarmen-v2";
const DEFAULTS = {
  electricity: 0.41,
  gas: 1.836,
  outside: 8,
  inside: 19.5,
  target: 20,
  duration: 4,
  boilerEfficiency: 90,
  heatLoss: 50,
  gasSurcharge: 0,
  electricitySurcharge: 0,
  roomName: "Woonkamer",
  roomArea: 60,
  locationName: "Amsterdam",
  latitude: 52.3676,
  longitude: 4.9041,
  heatPumpEnabled: true,
  heatPumpName: "Airco",
  heatPumpModel: "Mitsubishi SCM40ZS-W",
  heatPumpCapacity: 4.5,
  copCorrection: 100,
  boilerEnabled: true,
  boilerName: "Cv-ketel",
  boilerModel: "Intergas 28/24A",
  gasEnergyContent: 9.77,
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
    , "planningRange", "nextSwitchText", "nextSwitchReason", "nextSwitchIcon",
    "timelineAxis", "strategyTimeline", "temperatureLine", "plannerNote", "switchList",
    "assumptionElectricity", "assumptionGas", "assumptionOutside", "assumptionInsideTarget",
    "assumptionDuration", "assumptionEfficiency", "assumptionHeatLoss", "assumptionCop",
    "roomName", "roomArea", "locationName", "latitude", "longitude", "heatPumpEnabled",
    "heatPumpName", "heatPumpModel", "heatPumpCapacity", "copCorrection", "boilerEnabled", "boilerName",
    "boilerModel", "gasEnergyContent", "weatherLocation", "metricHeatPumpLabel", "metricBoilerLabel",
    "planRoomEyebrow", "areaBadge", "heatPumpLabel", "heatPumpModelDisplay", "boilerLabel",
    "boilerModelDisplay", "durationSummaryLabel", "legendHeatPump", "legendBoiler",
    "formulaHeatPumpLabel", "formulaBoilerLabel", "gasFormula", "assumptionArea", "assumptionRoom",
    "assumptionHeatPump", "assumptionHeatPumpModel", "assumptionBoiler", "assumptionBoilerModel",
    "assumptionGasEnergy", "assumptionLocation", "heatPumpProfileCard", "boilerProfileCard",
    "heatPumpMetricCard", "boilerMetricCard", "breakEvenMetricCard", "heatPumpCostRow",
    "boilerCostRow", "heatPumpFormula", "boilerFormula", "legendHybridItem"
  ].map((id) => [id, document.getElementById(id)])
);

const numericFields = {
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
  roomArea: els.roomArea,
  latitude: els.latitude,
  longitude: els.longitude,
  heatPumpCapacity: els.heatPumpCapacity,
  copCorrection: els.copCorrection,
  gasEnergyContent: els.gasEnergyContent,
};

const textFields = {
  roomName: els.roomName,
  locationName: els.locationName,
  heatPumpName: els.heatPumpName,
  heatPumpModel: els.heatPumpModel,
  boilerName: els.boilerName,
  boilerModel: els.boilerModel,
};

const toggleFields = {
  heatPumpEnabled: els.heatPumpEnabled,
  boilerEnabled: els.boilerEnabled,
};

const fields = { ...numericFields, ...textFields, ...toggleFields };

const nf = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const money = (value, digits = 3) => `€ ${new Intl.NumberFormat("nl-NL", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
})[character]);

function loadState() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) {}
  const params = new URLSearchParams(location.search);
  const state = { ...DEFAULTS, ...saved };
  for (const key of Object.keys(numericFields)) {
    if (params.has(key) && Number.isFinite(Number(params.get(key)))) state[key] = Number(params.get(key));
  }
  return state;
}

let state = loadState();
let liveParts = new Set();
let forecast = { electricity: [], gas: [], weather: [] };

function populate() {
  for (const [key, input] of Object.entries(numericFields)) input.value = state[key];
  for (const [key, input] of Object.entries(textFields)) input.value = state[key];
  for (const [key, input] of Object.entries(toggleFields)) input.checked = Boolean(state[key]);
}

function readForm() {
  for (const [key, input] of Object.entries(numericFields)) {
    const value = Number(input.value);
    if (Number.isFinite(value)) state[key] = value;
  }
  for (const [key, input] of Object.entries(textFields)) {
    state[key] = input.value.trim() || DEFAULTS[key];
  }
  for (const [key, input] of Object.entries(toggleFields)) state[key] = input.checked;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function estimateCop(outside, target, correction = 100) {
  // Practical air-to-air heat-pump curve, reduced for colder air, defrost and
  // a higher room target. The saved profile can tune it for another model.
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
  cop *= correction / 100;
  return clamp(cop, 1.8, 5.4);
}

function computeSnapshot(input) {
  const cop = estimateCop(input.outside, input.target, input.copCorrection);
  const efficiency = input.boilerEfficiency / 100;
  const gasUnitCost = input.gas / (input.gasEnergyContent * efficiency);
  const hpUnitCost = input.electricity / cop;
  const steadyDemand = input.roomArea * input.heatLoss * Math.max(0, input.target - input.outside) / 20 / 1000;
  const warmupDemand = Math.max(0, input.target - input.inside) * 0.55;
  const heatDemand = clamp(steadyDemand + warmupDemand, 0.3, 7.5);
  const capacityLimited = input.heatPumpEnabled && heatDemand > input.heatPumpCapacity;
  const hybridHourly = Math.min(input.heatPumpCapacity, heatDemand) * hpUnitCost
    + Math.max(0, heatDemand - input.heatPumpCapacity) * gasUnitCost;
  const hpHourly = input.boilerEnabled ? hybridHourly : heatDemand * hpUnitCost;
  const gasHourly = heatDemand * gasUnitCost;
  const comparisonAvailable = input.heatPumpEnabled && input.boilerEnabled;
  let strategy = "hp";
  if (!input.heatPumpEnabled) strategy = "gas";
  else if (!input.boilerEnabled) strategy = "hp";
  else if (hpHourly < gasHourly) strategy = capacityLimited ? "hybrid" : "hp";
  else strategy = "gas";
  return {
    cop, gasUnitCost, hpUnitCost, heatDemand, capacityLimited, hpHourly, gasHourly,
    comparisonAvailable, strategy,
  };
}

function calculate() {
  readForm();
  const snapshot = computeSnapshot(state);
  const { cop, gasUnitCost, hpUnitCost, heatDemand, capacityLimited, hpHourly, gasHourly, comparisonAvailable, strategy } = snapshot;
  const efficiency = state.boilerEfficiency / 100;
  const breakEvenPrice = gasUnitCost * cop;
  const breakEvenCop = state.electricity / gasUnitCost;
  const hpWins = strategy === "hp" || strategy === "hybrid";
  const savingHourly = Math.abs(gasHourly - hpHourly);
  const savingPercent = Math.round(savingHourly / Math.max(hpHourly, gasHourly) * 100);
  const periodSaving = savingHourly * state.duration;

  document.body.classList.toggle("single-source", !comparisonAvailable);
  els.heatPumpMetricCard.hidden = !state.heatPumpEnabled;
  els.boilerMetricCard.hidden = !state.boilerEnabled;
  els.breakEvenMetricCard.hidden = !comparisonAvailable;
  els.heatPumpCostRow.hidden = !state.heatPumpEnabled;
  els.boilerCostRow.hidden = !state.boilerEnabled;
  els.heatPumpFormula.hidden = !state.heatPumpEnabled;
  els.boilerFormula.hidden = !state.boilerEnabled;
  els.legendHeatPump.parentElement.hidden = !state.heatPumpEnabled;
  els.legendBoiler.parentElement.hidden = !state.boilerEnabled;
  els.legendHybridItem.hidden = !comparisonAvailable;
  els.heatPumpProfileCard.classList.toggle("source-off", !state.heatPumpEnabled);
  els.boilerProfileCard.classList.toggle("source-off", !state.boilerEnabled);

  els.weatherLocation.textContent = `Buiten in ${state.locationName}`;
  els.metricHeatPumpLabel.textContent = state.heatPumpName;
  els.metricBoilerLabel.textContent = state.boilerName;
  els.planRoomEyebrow.textContent = `Plan voor ${state.roomName}`;
  els.areaBadge.textContent = `${nf.format(state.roomArea)} m²`;
  els.heatPumpLabel.textContent = state.heatPumpName;
  els.heatPumpModelDisplay.textContent = state.heatPumpModel;
  els.boilerLabel.textContent = state.boilerName;
  els.boilerModelDisplay.textContent = state.boilerModel;
  els.durationSummaryLabel.textContent = `Verbruik voor ${nf.format(state.duration)} uur`;
  els.legendHeatPump.textContent = state.heatPumpName;
  els.legendBoiler.textContent = state.boilerName;
  els.formulaHeatPumpLabel.textContent = state.heatPumpName;
  els.formulaBoilerLabel.textContent = state.boilerName;
  els.gasFormula.textContent = `gasprijs ÷ (${nf.format(state.gasEnergyContent)} × rendement)`;

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
  els.fourHourSaving.textContent = comparisonAvailable
    ? `${money(periodSaving, 2)} voordeel`
    : `${money((state.heatPumpEnabled ? hpHourly : gasHourly) * state.duration, 2)} totaal`;
  els.capacityStatus.textContent = capacityLimited
    ? (state.boilerEnabled ? "Combineren" : "Vermogen tekort")
    : "Voldoende";
  els.assumptionElectricity.textContent = `${money(state.electricity)}/kWh`;
  els.assumptionGas.textContent = `${money(state.gas)}/m³`;
  els.assumptionOutside.textContent = `${state.outside.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} °C`;
  els.assumptionInsideTarget.textContent = `${state.inside.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} → ${state.target.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} °C`;
  els.assumptionDuration.textContent = `${state.duration.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} uur`;
  els.assumptionEfficiency.textContent = `${state.boilerEfficiency.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}%`;
  els.assumptionHeatLoss.textContent = `${state.heatLoss.toLocaleString("nl-NL", { maximumFractionDigits: 0 })} W/m²K`;
  els.assumptionCop.textContent = nf.format(cop);
  els.assumptionArea.textContent = `${nf.format(state.roomArea)} m²`;
  els.assumptionRoom.textContent = state.roomName;
  els.assumptionHeatPump.textContent = state.heatPumpEnabled ? `${nf.format(state.heatPumpCapacity)} kW · actief` : "Uitgeschakeld";
  els.assumptionHeatPumpModel.textContent = state.heatPumpModel;
  els.assumptionBoiler.textContent = state.boilerEnabled ? `${state.boilerEfficiency.toFixed(0)}% · actief` : "Uitgeschakeld";
  els.assumptionBoilerModel.textContent = state.boilerModel;
  els.assumptionGasEnergy.textContent = `${nf.format(state.gasEnergyContent)} kWh/m³`;
  els.assumptionLocation.textContent = `${state.locationName} · ${state.latitude.toFixed(4)}, ${state.longitude.toFixed(4)}`;

  const maxHourly = Math.max(hpHourly, gasHourly) * 1.08;
  els.heatPumpBar.style.width = `${(hpHourly / maxHourly) * 100}%`;
  els.gasBar.style.width = `${(gasHourly / maxHourly) * 100}%`;

  if (!comparisonAvailable && state.heatPumpEnabled) {
    els.recommendationTitle.textContent = state.heatPumpName;
    els.recommendationSubtitle.textContent = capacityLimited
      ? `Dit is je enige actieve bron, maar het geschatte benodigde vermogen ligt boven ${nf.format(state.heatPumpCapacity)} kW.`
      : `Kostenprofiel van je enige actieve warmtebron.`;
    els.recommendationIcon.textContent = "❄";
    els.reasonText.textContent = `Geschatte warmtekosten: ${money(hpUnitCost)} per kWh warmte bij COP ${nf.format(cop)}.`;
  } else if (!comparisonAvailable && state.boilerEnabled) {
    els.recommendationTitle.textContent = state.boilerName;
    els.recommendationSubtitle.textContent = "Kostenprofiel van je enige actieve warmtebron.";
    els.recommendationIcon.textContent = "♨";
    els.reasonText.textContent = `Geschatte warmtekosten: ${money(gasUnitCost)} per kWh warmte bij ${state.boilerEfficiency.toFixed(0)}% rendement.`;
  } else if (capacityLimited && hpWins) {
    els.recommendationTitle.textContent = "Hybride";
    els.recommendationSubtitle.textContent = `Laat ${state.heatPumpName} de basis doen en gebruik ${state.boilerName} alleen voor het tekort.`;
    els.recommendationIcon.textContent = "◐";
    els.reasonText.textContent = `De vraag is circa ${nf.format(heatDemand)} kW; ${state.heatPumpName} is ingesteld op maximaal ${nf.format(state.heatPumpCapacity)} kW warmte.`;
  } else if (hpWins) {
    els.recommendationTitle.textContent = state.heatPumpName;
    els.recommendationSubtitle.textContent = `${state.heatPumpModel} levert nu de goedkoopste warmte.`;
    els.recommendationIcon.textContent = "❄";
    els.reasonText.textContent = `De geschatte COP is ${nf.format(cop)}; ${state.heatPumpName} blijft voordelig zolang stroom onder ${money(breakEvenPrice)} per kWh blijft.`;
  } else {
    els.recommendationTitle.textContent = state.boilerName;
    els.recommendationSubtitle.textContent = `${state.boilerModel} levert in deze situatie de goedkoopste warmte.`;
    els.recommendationIcon.textContent = "♨";
    els.reasonText.textContent = `Voor de huidige stroomprijs is een COP van ${nf.format(breakEvenCop)} nodig; de schatting is ${nf.format(cop)}.`;
  }

  els.savingValue.textContent = comparisonAvailable
    ? `${money(savingHourly, 2)} · ${savingPercent}%`
    : `${money(state.heatPumpEnabled ? hpHourly : gasHourly, 2)}/uur`;
  els.savingLabel.textContent = comparisonAvailable
    ? (hpWins ? `goedkoper per uur met ${state.heatPumpName}` : `goedkoper per uur met ${state.boilerName}`)
    : "geschatte verwarmingskosten";
  els.explanationTitle.textContent = !comparisonAvailable
    ? `Kostenprofiel van ${state.heatPumpEnabled ? state.heatPumpName : state.boilerName}.`
    : hpWins ? "De warmtepomp haalt meer warmte uit iedere euro." : "De stroomprijs ligt boven het huidige omslagpunt.";
  els.explanationText.textContent = !comparisonAvailable
    ? `De berekening gebruikt ${nf.format(heatDemand)} kW geschatte warmtevraag voor ${state.roomName} (${nf.format(state.roomArea)} m²). Activeer een tweede warmtebron in je profiel om kosten en omslagpunten te vergelijken.`
    : hpWins
    ? `Bij ${state.outside.toLocaleString("nl-NL")} °C buiten rekenen we met een COP van ${nf.format(cop)}. Eén kWh stroom levert dan ongeveer ${nf.format(cop)} kWh warmte. Met jouw prijzen kost die warmte ${money(hpUnitCost)} per kWh via ${state.heatPumpName}, tegenover ${money(gasUnitCost)} via ${state.boilerName}.`
    : `Met de huidige prijzen kost warmte via ${state.heatPumpName} ${money(hpUnitCost)} per kWh en via ${state.boilerName} ${money(gasUnitCost)}. Een lagere stroomprijs, hogere buitentemperatuur of lagere voorkeurstemperatuur kan de keuze weer omdraaien.`;
  renderPlanner();
}

function getLocalDayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function extractPrices(payload) {
  const candidates = [payload?.all_in_with_vat, payload?.allInWithVat, payload?.Prices, payload?.prices, payload?.data, payload?.items, payload?.values];
  const list = candidates.find(Array.isArray) || [];
  return list.map((item) => ({
    time: new Date(item.readingDate || item.timestamp || item.start || item.date || item.from),
    price: Number(item?.price?.value ?? item.price ?? item.value ?? item.amount ?? item?.price?.incl ?? item?.tariff?.incl),
  })).filter((item) => Number.isFinite(item.price) && !Number.isNaN(item.time.getTime()));
}

function localDateParameter(date = new Date()) {
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

async function fetchEnergyZero(usageType) {
  const query = new URLSearchParams({
    date: localDateParameter(),
    interval: usageType === 3 ? "INTERVAL_DAY" : "INTERVAL_QUARTER",
    energyType: usageType === 3 ? "ENERGY_TYPE_GAS" : "ENERGY_TYPE_ELECTRICITY",
  });
  const sources = [
    `/api/energyzero?${query}`,
    `./data/energyzero-${usageType === 3 ? "gas" : "electricity"}.json`,
    `https://public.api.energyzero.nl/public/v1/prices?${query}`,
  ];
  let lastError;
  for (const source of sources) {
    try {
      const response = await fetch(source, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`EnergyZero ${response.status}`);
      const prices = extractPrices(await response.json());
      if (!prices.length) throw new Error("Geen prijsgegevens ontvangen");
      return prices.sort((a, b) => a.time - b.time);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("EnergyZero niet bereikbaar");
}

function activeValue(points, at, fallback) {
  if (!points.length) return fallback;
  const prior = points.filter((point) => point.time <= at).at(-1);
  if (prior) return prior.value ?? prior.price;
  return points[0].value ?? points[0].price ?? fallback;
}

function hourlyAverage(points, hour, surcharge, fallback) {
  if (!points.length) return fallback;
  const end = hour + 60 * 60 * 1000;
  const inHour = points.filter((point) => point.time.getTime() >= hour && point.time.getTime() < end);
  const candidates = inHour.length ? inHour : [points.filter((point) => point.time.getTime() <= hour).at(-1)].filter(Boolean);
  if (!candidates.length) return null;
  return candidates.reduce((sum, point) => sum + point.price, 0) / candidates.length + surcharge;
}

function formatPlanTime(date, includeDay = false) {
  return new Intl.DateTimeFormat("nl-NL", includeDay
    ? { weekday: "short", hour: "2-digit", minute: "2-digit" }
    : { hour: "2-digit", minute: "2-digit" }).format(date);
}

function renderPlanner() {
  if (!els.strategyTimeline) return;
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const hasLiveForecast = forecast.electricity.length > 0 && forecast.weather.length > 0;
  const electricityLast = forecast.electricity.at(-1)?.time?.getTime() || 0;
  const requestedHours = 48;
  const usableHours = hasLiveForecast
    ? Math.max(1, Math.min(requestedHours, Math.ceil((electricityLast + 15 * 60 * 1000 - start.getTime()) / 3600000)))
    : requestedHours;
  const slots = [];

  for (let index = 0; index < usableHours; index++) {
    const time = new Date(start.getTime() + index * 3600000);
    const timestamp = time.getTime();
    const electricity = hourlyAverage(forecast.electricity, timestamp, state.electricitySurcharge, state.electricity);
    const gas = hourlyAverage(forecast.gas, timestamp, state.gasSurcharge, state.gas);
    const outside = activeValue(forecast.weather, timestamp, state.outside);
    if (!Number.isFinite(electricity) || !Number.isFinite(gas) || !Number.isFinite(outside)) {
      slots.push({ time, strategy: "unavailable", outside, electricity, gas });
      continue;
    }
    const result = computeSnapshot({ ...state, electricity, gas, outside });
    slots.push({ time, electricity, gas, outside, ...result });
  }

  const switches = [];
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].strategy !== "unavailable" && slots[i - 1].strategy !== "unavailable" && slots[i].strategy !== slots[i - 1].strategy) {
      switches.push({ ...slots[i], from: slots[i - 1].strategy });
    }
  }

  els.planningRange.textContent = `${slots.length} uur vooruit`;
  els.plannerNote.textContent = hasLiveForecast
    ? "Gepubliceerde EnergyZero-prijzen + Open-Meteo verwachting"
    : "Laatste waarden gebruikt; vernieuw voor een live planning";
  els.timelineAxis.innerHTML = slots.map((slot, index) =>
    `<span>${index % 6 === 0 ? formatPlanTime(slot.time, index >= 24) : ""}</span>`
  ).join("");
  els.strategyTimeline.innerHTML = slots.map((slot, index) => {
    const changed = index > 0 && slot.strategy !== slots[index - 1].strategy && slot.strategy !== "unavailable";
    const label = slot.strategy === "hp" ? state.heatPumpName : slot.strategy === "gas" ? state.boilerName : slot.strategy === "hybrid" ? "Hybride" : "Geen data";
    const title = slot.strategy === "unavailable"
      ? `${formatPlanTime(slot.time, true)} — nog geen prijs beschikbaar`
      : `${formatPlanTime(slot.time, true)} — ${label} · stroom ${money(slot.electricity)} · gas ${money(slot.gas)} · ${Number(slot.outside).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} °C`;
    return `<div class="timeline-slot ${slot.strategy}${changed ? " switch" : ""}" title="${escapeHtml(title)}"><small>${index % 3 === 0 ? escapeHtml(label) : ""}</small></div>`;
  }).join("");
  els.temperatureLine.innerHTML = slots.map((slot, index) =>
    `<span>${index % 3 === 0 && Number.isFinite(slot.outside) ? `${Number(slot.outside).toLocaleString("nl-NL", { maximumFractionDigits: 0 })}°` : ""}</span>`
  ).join("");

  const labelFor = (value) => value === "hp" ? state.heatPumpName : value === "gas" ? state.boilerName : "hybride verwarmen";
  if (switches.length) {
    const next = switches[0];
    els.nextSwitchIcon.textContent = "↻";
    els.nextSwitchText.textContent = `${formatPlanTime(next.time, true)} overschakelen op ${labelFor(next.strategy)}`;
    els.nextSwitchReason.textContent = next.strategy === "gas"
      ? `De stroomprijs loopt dan op naar ${money(next.electricity)} per kWh.`
      : `De combinatie van ${money(next.electricity)} stroom en ${Number(next.outside).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} °C buiten maakt ${labelFor(next.strategy)} voordeliger.`;
  } else {
    const current = slots.find((slot) => slot.strategy !== "unavailable");
    els.nextSwitchIcon.textContent = "✓";
    els.nextSwitchText.textContent = current ? `Geen wissel verwacht — blijf op ${labelFor(current.strategy)}` : "Nog onvoldoende prijsdata";
    els.nextSwitchReason.textContent = current ? `Binnen de beschikbare planning blijft dit de goedkoopste strategie.` : "Vernieuw zodra de energieprijzen beschikbaar zijn.";
  }

  els.switchList.innerHTML = switches.length
    ? switches.slice(0, 6).map((event) => `<article class="switch-event"><time>${formatPlanTime(event.time, true)}</time><div><strong>Naar ${escapeHtml(labelFor(event.strategy))}</strong><small>${money(event.electricity)}/kWh · ${Number(event.outside).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} °C</small></div></article>`).join("")
    : `<div class="switch-empty">Geen schakelmomenten in de beschikbare periode.</div>`;
}

async function fetchLiveData() {
  els.refreshButton.classList.add("loading");
  liveParts = new Set();
  const jobs = [
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(state.latitude)}&longitude=${encodeURIComponent(state.longitude)}&current=temperature_2m&hourly=temperature_2m&forecast_days=3&timezone=auto`)
      .then((r) => { if (!r.ok) throw new Error("weer"); return r.json(); })
      .then((data) => {
        const temperature = Number(data?.current?.temperature_2m);
        if (!Number.isFinite(temperature)) throw new Error("weer");
        state.outside = temperature;
        fields.outside.value = temperature;
        forecast.weather = (data?.hourly?.time || []).map((time, index) => ({
          time: new Date(time),
          value: Number(data.hourly.temperature_2m[index]),
        })).filter((point) => Number.isFinite(point.value));
        els.weatherTime.textContent = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date());
        liveParts.add("weer");
      }),
    fetchEnergyZero(1).then((prices) => {
      forecast.electricity = prices;
      const raw = activeValue(prices, Date.now(), prices[0]?.price);
      state.electricity = raw + state.electricitySurcharge;
      fields.electricity.value = state.electricity.toFixed(4);
      liveParts.add("stroom");
    }),
    fetchEnergyZero(3).then((prices) => {
      forecast.gas = prices;
      const raw = activeValue(prices, Date.now(), prices[0]?.price);
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
document.getElementById("profileForm").addEventListener("input", (event) => {
  if ((event.target === els.heatPumpEnabled || event.target === els.boilerEnabled)
      && !els.heatPumpEnabled.checked && !els.boilerEnabled.checked) {
    event.target.checked = true;
    showToast("Laat minimaal één warmtebron actief");
    return;
  }
  calculate();
});
document.getElementById("profileForm").addEventListener("change", (event) => {
  if ([els.latitude, els.longitude].includes(event.target)) fetchLiveData();
});
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
