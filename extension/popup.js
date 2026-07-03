const AUTOCOMPLETE_URL = "https://ac.stock.naver.com/ac";
const STOCK_API_HOST = "https://m.stock.naver.com";
const FINANCE_HOST = "https://finance.naver.com";
const NAVER_ITEM_HOST = `${FINANCE_HOST}/item/main.naver`;
const RECENT_KEY = "naverSupplyRecentStocks";

const formatNumber = new Intl.NumberFormat("ko-KR");
const formatPercent = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const state = {
  report: null,
  selectedPeriod: 20,
  recent: [],
};

const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("stockQuery"),
  rangeSelect: document.getElementById("rangeSelect"),
  button: document.getElementById("analyzeButton"),
  status: document.getElementById("status"),
  candidates: document.getElementById("candidates"),
  recentBox: document.getElementById("recentBox"),
  recentList: document.getElementById("recentList"),
  result: document.getElementById("result"),
  stockMarket: document.getElementById("stockMarket"),
  stockName: document.getElementById("stockName"),
  openNaver: document.getElementById("openNaver"),
  flowVerdict: document.getElementById("flowVerdict"),
  flowVerdictDetail: document.getElementById("flowVerdictDetail"),
  flowScore: document.getElementById("flowScore"),
  scoreNeedle: document.getElementById("scoreNeedle"),
  tradeOpinion: document.getElementById("tradeOpinion"),
  tradeBias: document.getElementById("tradeBias"),
  tradeAction: document.getElementById("tradeAction"),
  strategyGrid: document.getElementById("strategyGrid"),
  strategyRisk: document.getElementById("strategyRisk"),
  latestClose: document.getElementById("latestClose"),
  latestChange: document.getElementById("latestChange"),
  latestForeign: document.getElementById("latestForeign"),
  latestForeignRate: document.getElementById("latestForeignRate"),
  latestInstitution: document.getElementById("latestInstitution"),
  latestIndividual: document.getElementById("latestIndividual"),
  individualLabel: document.getElementById("individualLabel"),
  individualNote: document.getElementById("individualNote"),
  periodPrice: document.getElementById("periodPrice"),
  periodSmart: document.getElementById("periodSmart"),
  periodIndividual: document.getElementById("periodIndividual"),
  periodIndividualLabel: document.getElementById("periodIndividualLabel"),
  periodForeignRate: document.getElementById("periodForeignRate"),
  periodIntensity: document.getElementById("periodIntensity"),
  chartMeta: document.getElementById("chartMeta"),
  flowChart: document.getElementById("flowChart"),
  priceChart: document.getElementById("priceChart"),
  diagnosticGrid: document.getElementById("diagnosticGrid"),
  insightList: document.getElementById("insightList"),
  dailyRows: document.getElementById("dailyRows"),
  tableSub: document.getElementById("tableSub"),
  copyButton: document.getElementById("copyButton"),
  periodTabs: Array.from(document.querySelectorAll(".period-tab")),
};

function parseNumber(value) {
  if (value === null || value === undefined || value === "" || value === "-") return 0;
  const normalized = String(value).replace(/,/g, "");
  const match = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseChangeText(value) {
  const text = String(value || "");
  const amount = parseNumber(text);
  if (text.includes("하락")) return -Math.abs(amount);
  if (text.includes("상승")) return Math.abs(amount);
  return amount;
}

function sign(value) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function signed(value) {
  const parsed = Number(value) || 0;
  const prefix = parsed > 0 ? "+" : "";
  return `${prefix}${formatNumber.format(Math.round(parsed))}`;
}

function signedPercent(value, suffix = "%") {
  const parsed = Number(value) || 0;
  const prefix = parsed > 0 ? "+" : "";
  return `${prefix}${formatPercent.format(parsed)}${suffix}`;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function flowClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function setFlowText(element, value, suffix = "") {
  element.textContent = `${signed(value)}${suffix}`;
  element.className = flowClass(value);
}

function compactNumber(value) {
  const abs = Math.abs(value);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  if (abs >= 100000000) return `${prefix}${formatPercent.format(abs / 100000000)}억주`;
  if (abs >= 10000) return `${prefix}${formatPercent.format(abs / 10000)}만주`;
  return signed(value);
}

function toDate(value) {
  const text = String(value || "");
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(text)) return text.replaceAll(".", "-");
  return text;
}

function actorName(key) {
  return {
    foreign: "외국인",
    institution: "기관",
    individual: "개인/기타",
    smartMoney: "외국인+기관",
  }[key] || key;
}

function dominantActor(row) {
  const flows = [
    ["foreign", row.foreign],
    ["institution", row.institution],
    ["individual", row.individual],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [key, value] = flows[0] || ["-", 0];
  if (!value) return "-";
  return `${actorName(key)} ${value > 0 ? "순매수" : "순매도"}`;
}

function streak(rows, key) {
  if (!rows.length) return { direction: "없음", days: 0 };
  const firstSign = sign(rows[0][key]);
  if (!firstSign) return { direction: "중립", days: 1 };
  let days = 0;
  for (const row of rows) {
    if (sign(row[key]) !== firstSign) break;
    days += 1;
  }
  return { direction: firstSign > 0 ? "순매수" : "순매도", days };
}

function sameDirectionRate(rows, key) {
  let matched = 0;
  let total = 0;
  for (const row of rows) {
    const flowSign = sign(row[key]);
    const priceSign = sign(row.priceChange);
    if (!flowSign || !priceSign) continue;
    total += 1;
    if (flowSign === priceSign) matched += 1;
  }
  return total ? ratio(matched, total) : 0;
}

function sumBy(rows, key) {
  return rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
}

function getCellText(row, selector) {
  return row.querySelector(selector)?.textContent?.trim() || "";
}

function normalizeMobileRows(rawRows) {
  const map = new Map();
  for (const row of rawRows || []) {
    const date = toDate(row.bizdate);
    if (!date) continue;
    map.set(date, {
      date,
      individual: parseNumber(row.individualPureBuyQuant),
      other: null,
      individualKind: "actual",
    });
  }
  return map;
}

function parsePcRows(html, actualIndividualMap) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const table = tables.find((candidate) => {
    const text = candidate.textContent || "";
    return text.includes("날짜") && text.includes("기관") && text.includes("외국인") && text.includes("보유율");
  });
  if (!table) return [];

  const rows = [];
  for (const tr of Array.from(table.querySelectorAll("tr"))) {
    const cells = Array.from(tr.querySelectorAll("th,td")).map((cell) => cell.textContent.trim());
    if (cells.length < 9 || !/^\d{4}\.\d{2}\.\d{2}$/.test(cells[0])) continue;
    const date = toDate(cells[0]);
    const foreign = parseNumber(cells[6]);
    const institution = parseNumber(cells[5]);
    const actual = actualIndividualMap.get(date);
    const residual = -(foreign + institution);

    rows.push({
      date,
      close: parseNumber(cells[1]),
      priceChange: parseChangeText(cells[2]),
      priceChangePct: parseNumber(cells[3]),
      priceDirection: cells[2].includes("하락") ? "하락" : cells[2].includes("상승") ? "상승" : "보합",
      volume: parseNumber(cells[4]),
      institution,
      foreign,
      individual: actual ? actual.individual : residual,
      individualKind: actual ? "actual" : "residual",
      other: actual ? -(foreign + institution + actual.individual) : null,
      smartMoney: foreign + institution,
      foreignHoldShares: parseNumber(cells[7]),
      foreignHoldRatio: parseNumber(cells[8]),
    });
  }
  return rows;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    credentials: "omit",
    headers: { accept: "application/json, text/plain, */*" },
  });
  if (!response.ok) throw new Error(`네이버 요청 실패: HTTP ${response.status}`);
  return response.json();
}

async function fetchNaverHtml(url) {
  const response = await fetch(url, {
    credentials: "omit",
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  if (!response.ok) throw new Error(`네이버 수급 페이지 요청 실패: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  return new TextDecoder("euc-kr").decode(buffer);
}

async function searchStocks(query) {
  const url = new URL(AUTOCOMPLETE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("target", "stock,index,marketindicator");
  const data = await fetchJson(url.toString());

  return (data.items || [])
    .filter((item) => item.category === "stock" && item.nationCode === "KOR")
    .map((item) => ({
      code: item.code,
      name: item.name,
      market: item.typeName,
      typeCode: item.typeCode,
    }))
    .slice(0, 8);
}

async function fetchReport(stock, maxRows) {
  const mobileData = await fetchJson(`${STOCK_API_HOST}/api/stock/${encodeURIComponent(stock.code)}/integration`);
  const actualIndividualMap = normalizeMobileRows(mobileData.dealTrendInfos);
  const pages = Math.max(1, Math.ceil(maxRows / 20));
  const urls = Array.from({ length: pages }, (_, index) => {
    return `${FINANCE_HOST}/item/frgn.naver?code=${encodeURIComponent(stock.code)}&page=${index + 1}`;
  });

  const htmlPages = await Promise.all(urls.map((url) => fetchNaverHtml(url)));
  const seen = new Set();
  const rows = [];
  for (const html of htmlPages) {
    for (const row of parsePcRows(html, actualIndividualMap)) {
      if (seen.has(row.date)) continue;
      seen.add(row.date);
      rows.push(row);
    }
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  const limitedRows = rows.slice(0, maxRows);
  if (!limitedRows.length) throw new Error("장기 수급 데이터를 찾지 못했습니다.");

  return {
    stock: {
      ...stock,
      name: mobileData.stockName || stock.name,
      naverUrl: `${NAVER_ITEM_HOST}?code=${encodeURIComponent(stock.code)}`,
    },
    rows: limitedRows,
    actualIndividualDays: limitedRows.filter((row) => row.individualKind === "actual").length,
    raw: { mobileData },
  };
}

function summarizePeriod(rows, days) {
  const slice = rows.slice(0, Math.min(days, rows.length));
  if (!slice.length) return null;
  const latest = slice[0];
  const oldest = slice[slice.length - 1];
  const volume = sumBy(slice, "volume");
  const foreign = sumBy(slice, "foreign");
  const institution = sumBy(slice, "institution");
  const individual = sumBy(slice, "individual");
  const smartMoney = foreign + institution;
  const priceChangePct = oldest.close ? ratio(latest.close - oldest.close, oldest.close) : 0;
  const foreignHoldRatioChange = latest.foreignHoldRatio - oldest.foreignHoldRatio;
  const smartBuyDays = slice.filter((row) => row.smartMoney > 0).length;
  const foreignBuyDays = slice.filter((row) => row.foreign > 0).length;
  const institutionBuyDays = slice.filter((row) => row.institution > 0).length;
  const individualBuyDays = slice.filter((row) => row.individual > 0).length;
  const contrarianDays = slice.filter((row) => sign(row.smartMoney) && sign(row.individual) === -sign(row.smartMoney)).length;
  const smartMoneyVolumeRatio = ratio(smartMoney, volume);
  const individualVolumeRatio = ratio(individual, volume);
  const score = clamp(
    smartMoneyVolumeRatio * 11 +
      foreignHoldRatioChange * 18 +
      (smartBuyDays / slice.length - 0.5) * 34 +
      (sign(smartMoney) === sign(priceChangePct) ? 8 : -8),
    -100,
    100
  );
  const largestForeignBuy = slice.reduce((best, row) => (row.foreign > best.foreign ? row : best), slice[0]);
  const largestForeignSell = slice.reduce((best, row) => (row.foreign < best.foreign ? row : best), slice[0]);
  const largestSmartBuy = slice.reduce((best, row) => (row.smartMoney > best.smartMoney ? row : best), slice[0]);
  const largestSmartSell = slice.reduce((best, row) => (row.smartMoney < best.smartMoney ? row : best), slice[0]);
  const highCloseRow = slice.reduce((best, row) => (row.close > best.close ? row : best), slice[0]);
  const lowCloseRow = slice.reduce((best, row) => (row.close < best.close ? row : best), slice[0]);

  return {
    days: slice.length,
    startDate: oldest.date,
    endDate: latest.date,
    priceChangePct,
    foreign,
    institution,
    individual,
    smartMoney,
    volume,
    smartMoneyVolumeRatio,
    individualVolumeRatio,
    foreignHoldRatioChange,
    foreignBuyDays,
    institutionBuyDays,
    individualBuyDays,
    smartBuyDays,
    contrarianDays,
    smartPriceSync: sameDirectionRate(slice, "smartMoney"),
    individualPriceSync: sameDirectionRate(slice, "individual"),
    score: Math.round(score),
    largestForeignBuy,
    largestForeignSell,
    largestSmartBuy,
    largestSmartSell,
    highClose: highCloseRow.close,
    highCloseDate: highCloseRow.date,
    lowClose: lowCloseRow.close,
    lowCloseDate: lowCloseRow.date,
    latestClose: latest.close,
    actualIndividualDays: slice.filter((row) => row.individualKind === "actual").length,
  };
}

function classifyFlow(period) {
  if (period.score >= 45) return ["강한 매집 우위", "외국인+기관 누적 수급과 보유율 흐름이 동시에 우호적입니다."];
  if (period.score >= 18) return ["매집 우위", "수급은 우호적이나 가격·보유율 확인이 더 필요합니다."];
  if (period.score <= -45) return ["강한 분산 우위", "외국인+기관 매도와 보유율 약화가 뚜렷합니다."];
  if (period.score <= -18) return ["분산 우위", "수급 부담이 가격 흐름에 반영될 수 있는 구간입니다."];
  return ["혼조", "수급 주체 간 방향성이 엇갈리거나 강도가 약합니다."];
}

function buildTradingStrategy(rows, period) {
  const shortPeriod = summarizePeriod(rows, Math.min(5, rows.length)) || period;
  const smartSelling = period.smartMoney < 0;
  const smartBuying = period.smartMoney > 0;
  const foreignRateDown = period.foreignHoldRatioChange < 0;
  const foreignRateUp = period.foreignHoldRatioChange > 0;
  const overextended = period.priceChangePct > 12;
  const fallingWithSell = period.priceChangePct < 0 && smartSelling;
  const risingWithSell = period.priceChangePct > 0 && smartSelling;
  const supportGuide = `${formatNumber.format(period.lowClose)}원(${period.lowCloseDate})`;
  const resistanceGuide = `${formatNumber.format(period.highClose)}원(${period.highCloseDate})`;

  if (period.score >= 45) {
    return {
      tone: "positive",
      opinion: overextended ? "조건부 매수" : "매수 우위",
      action: overextended ? "눌림목 대기" : "분할매수",
      bias: "외국인+기관 수급이 가격을 지지하는 구간입니다.",
      items: [
        ["진입", overextended ? "급등 추격보다 5일선 눌림 또는 약한 조정 후 분할 진입이 유리합니다." : "한 번에 몰아 사기보다 2~3회 분할매수 전략이 적합합니다."],
        ["추가매수", `5거래일 외국인+기관이 계속 순매수이고 외국인 보유율이 상승하면 추가 매수 후보입니다. 최근 5일 수급: ${signed(shortPeriod.smartMoney)}.`],
        ["이익관리", `단기 저항 참고값은 기간 내 고가 종가 ${resistanceGuide}입니다. 수급이 유지되면 보유, 수급이 꺾이면 일부 실현입니다.`],
      ],
      risk: `매수 전략 무효화: 5거래일 외국인+기관 순매도 전환 또는 외국인 보유율 -0.30%p 이상 하락. 방어 기준 참고값은 기간 내 저가 종가 ${supportGuide}입니다.`,
    };
  }

  if (period.score >= 18) {
    return {
      tone: "positive",
      opinion: "조건부 매수",
      action: "소액 분할",
      bias: "수급은 우호적이지만 확인 신호가 더 필요합니다.",
      items: [
        ["진입", "첫 매수는 작게 시작하고, 외국인+기관 5거래일 누적 순매수가 유지될 때만 비중을 늘립니다."],
        ["확인", `외국인 보유율 변화 ${signedPercent(period.foreignHoldRatioChange)}p, 수급강도 ${signedPercent(period.smartMoneyVolumeRatio)}입니다. 둘 중 하나가 약해지면 관망으로 낮춥니다.`],
        ["보유", `가격이 ${supportGuide} 부근을 지키면서 외국인+기관 매수가 이어지면 보유 우위입니다.`],
      ],
      risk: "조건부 매수 무효화: 외국인+기관 누적이 음수로 전환되거나 기관·외국인이 동시에 3거래일 이상 매도하면 신규매수 중단.",
    };
  }

  if (period.score > -18) {
    return {
      tone: "neutral",
      opinion: "관망",
      action: "대기",
      bias: "수급 우위가 뚜렷하지 않아 매수·매도 어느 쪽도 강하게 말하기 어렵습니다.",
      items: [
        ["신규매수", "지금은 확률 높은 매수 구간으로 보기 어렵습니다. 외국인+기관 5거래일 누적 순매수 전환을 기다립니다."],
        ["보유", "보유자는 비중을 유지하되, 외국인 보유율이 추가 하락하면 축소 쪽으로 전환합니다."],
        ["전환조건", `매수 전환은 외국인+기관 순매수와 외국인 보유율 상승이 동시에 나올 때입니다. 매도 전환은 ${supportGuide} 이탈과 수급 매도 확대입니다.`],
      ],
      risk: "관망 구간에서는 매수 단가보다 수급 방향 확인이 우선입니다. 확실한 주체가 생기기 전까지 큰 비중 진입은 피합니다.",
    };
  }

  if (period.score > -45) {
    return {
      tone: "negative",
      opinion: "매도 우위",
      action: "비중축소",
      bias: risingWithSell ? "가격 상승 중 외국인+기관이 파는 수급 이탈 구간입니다." : "외국인+기관 수급 부담이 남아 있습니다.",
      items: [
        ["신규매수", "신규매수는 보류합니다. 반등이 나와도 외국인+기관 5거래일 누적 순매수 전환 전까지 추격하지 않습니다."],
        ["보유", "보유자는 반등 시 일부 비중 축소가 우선입니다. 외국인 보유율 하락이 멈추는지 확인합니다."],
        ["재진입", `재진입은 5거래일 외국인+기관 순매수 전환, 외국인 보유율 상승, ${supportGuide} 방어가 같이 나올 때 검토합니다.`],
      ],
      risk: `매도 우위 유지 조건: 외국인+기관 누적 ${signed(period.smartMoney)}, 외국인 보유율 ${signedPercent(period.foreignHoldRatioChange)}p. 둘 중 하나가 개선되기 전까지 방어적으로 봅니다.`,
    };
  }

  return {
    tone: "negative",
    opinion: "강한 매도 우위",
    action: "신규매수 금지",
    bias: fallingWithSell ? "가격 하락과 외국인+기관 매도가 동시에 진행되는 분산 구간입니다." : "외국인+기관 매도와 보유율 약화가 강합니다.",
    items: [
      ["신규매수", "수급 기준으로는 신규매수 금지입니다. 낙폭만 보고 들어가기보다 수급 전환을 먼저 확인해야 합니다."],
      ["보유", "보유자는 반등 시 비중 축소 또는 손실 제한 전략이 우선입니다. 외국인+기관 매도가 이어지면 물타기 금지입니다."],
      ["재매수 조건", `최소 조건은 5거래일 외국인+기관 순매수 전환, 외국인 보유율 상승, 가격이 ${supportGuide} 위에서 안정되는 것입니다.`],
    ],
    risk: `수급 기준 방어선: 외국인+기관 누적 ${signed(period.smartMoney)}, 외국인 보유율 ${signedPercent(period.foreignHoldRatioChange)}p. 이 흐름이 개선되기 전까지 매수보다 현금 비중이 유리합니다.`,
  };
}

function buildDiagnostics(period) {
  return [
    {
      title: "주도 수급",
      value: period.smartMoney > 0 ? "외국인+기관 매수" : period.smartMoney < 0 ? "외국인+기관 매도" : "중립",
      detail: `${period.days}일 중 ${period.smartBuyDays}일 순매수, 누적 ${compactNumber(period.smartMoney)}`,
      tone: period.smartMoney,
    },
    {
      title: "외국인 보유율",
      value: `${signedPercent(period.foreignHoldRatioChange)}p`,
      detail: `${period.startDate} → ${period.endDate}`,
      tone: period.foreignHoldRatioChange,
    },
    {
      title: "가격-수급 괴리",
      value: period.priceChangePct * period.smartMoney < 0 ? "괴리 발생" : "동행",
      detail: `가격 ${signedPercent(period.priceChangePct)}, 수급 ${compactNumber(period.smartMoney)}`,
      tone: period.priceChangePct * period.smartMoney < 0 ? -1 : 1,
    },
    {
      title: "거래량 대비 강도",
      value: signedPercent(period.smartMoneyVolumeRatio),
      detail: "외국인+기관 누적 / 총거래량",
      tone: period.smartMoneyVolumeRatio,
    },
    {
      title: "최대 매집일",
      value: period.largestSmartBuy.date,
      detail: `외국인+기관 ${compactNumber(period.largestSmartBuy.smartMoney)}`,
      tone: period.largestSmartBuy.smartMoney,
    },
    {
      title: "최대 이탈일",
      value: period.largestSmartSell.date,
      detail: `외국인+기관 ${compactNumber(period.largestSmartSell.smartMoney)}`,
      tone: period.largestSmartSell.smartMoney,
    },
  ];
}

function buildInsights(rows, period) {
  const latest = rows[0];
  const foreignStreak = streak(rows, "foreign");
  const institutionStreak = streak(rows, "institution");
  const individualStreak = streak(rows, "individual");
  const [verdict] = classifyFlow(period);
  const insights = [
    `${period.days}거래일 판정은 "${verdict}"입니다. 외국인+기관 누적은 ${signed(period.smartMoney)}, 개인/기타 누적은 ${signed(period.individual)}입니다.`,
    `최근일(${latest.date}) 주도 흐름은 ${dominantActor(latest)}입니다. 외국인 ${signed(latest.foreign)}, 기관 ${signed(latest.institution)}, 개인/기타 ${signed(latest.individual)}입니다.`,
    `연속 흐름: 외국인 ${foreignStreak.days}일 ${foreignStreak.direction}, 기관 ${institutionStreak.days}일 ${institutionStreak.direction}, 개인/기타 ${individualStreak.days}일 ${individualStreak.direction}.`,
    `외국인 보유율은 기간 중 ${signedPercent(period.foreignHoldRatioChange)}p 변했습니다. 가격 변화는 ${signedPercent(period.priceChangePct)}입니다.`,
    `외국인+기관이 가격 방향과 같은 날은 ${formatPercent.format(period.smartPriceSync)}%, 개인/기타가 가격 방향과 같은 날은 ${formatPercent.format(period.individualPriceSync)}%입니다.`,
    `개인/기타와 외국인+기관이 반대로 움직인 날은 ${period.days}거래일 중 ${period.contrarianDays}일입니다.`,
  ];

  if (period.priceChangePct < 0 && period.smartMoney > 0) {
    insights.push("가격 하락 중 외국인+기관이 매수한 구간입니다. 단기 약세를 흡수하는 수급인지 다음 반등 여부를 확인해야 합니다.");
  } else if (period.priceChangePct > 0 && period.smartMoney < 0) {
    insights.push("가격 상승 중 외국인+기관이 매도한 구간입니다. 상승 추세의 질이 약해질 수 있어 거래량 동반 매도를 주의해야 합니다.");
  }

  if (period.actualIndividualDays < period.days) {
    insights.push(`개인 수급은 최근 ${period.actualIndividualDays}일만 실제 값이며, 나머지는 개인+기타 잔여 추정치입니다.`);
  }

  return insights;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
}

function setLoading(isLoading) {
  els.button.disabled = isLoading;
  els.rangeSelect.disabled = isLoading;
  els.button.textContent = isLoading ? "수집 중" : "분석";
}

function renderCandidates(candidates) {
  els.candidates.innerHTML = "";
  els.candidates.hidden = candidates.length <= 1;
  if (candidates.length <= 1) return;

  for (const stock of candidates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-button";
    button.innerHTML = `<strong>${stock.name}</strong><span>${stock.market} · ${stock.code}</span>`;
    button.addEventListener("click", () => analyzeStock(stock));
    els.candidates.appendChild(button);
  }
}

function renderDiagnostics(period) {
  els.diagnosticGrid.innerHTML = "";
  for (const item of buildDiagnostics(period)) {
    const article = document.createElement("article");
    article.className = `diagnostic-card ${flowClass(item.tone)}`;
    article.innerHTML = `<span>${item.title}</span><strong>${item.value}</strong><small>${item.detail}</small>`;
    els.diagnosticGrid.appendChild(article);
  }
}

function renderStrategy(rows, period) {
  const strategy = buildTradingStrategy(rows, period);
  els.tradeOpinion.textContent = strategy.opinion;
  els.tradeOpinion.className = strategy.tone;
  els.tradeAction.textContent = strategy.action;
  els.tradeAction.className = strategy.tone;
  els.tradeBias.textContent = strategy.bias;
  els.strategyRisk.textContent = `${strategy.risk} 이 문구는 수급 데이터 기반의 기계적 전략이며 투자 권유가 아닙니다.`;
  els.strategyRisk.className = `strategy-risk ${strategy.tone}`;
  els.strategyGrid.innerHTML = "";

  for (const [title, detail] of strategy.items) {
    const article = document.createElement("article");
    article.className = "strategy-card";
    article.innerHTML = `<span>${title}</span><p>${detail}</p>`;
    els.strategyGrid.appendChild(article);
  }
}

function chartNumber(value) {
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${formatPercent.format(value / 100000000)}억`;
  if (abs >= 10000) return `${formatPercent.format(value / 10000)}만`;
  return formatNumber.format(Math.round(value));
}

function svgPolyline(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function renderFlowChart(rows, period) {
  const slice = rows.slice(0, period.days).reverse();
  const width = 660;
  const height = 220;
  const margin = { top: 16, right: 14, bottom: 28, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const zeroY = margin.top + plotHeight / 2;
  const maxAbs = Math.max(1, ...slice.flatMap((row) => [Math.abs(row.smartMoney), Math.abs(row.individual)]));
  const step = plotWidth / Math.max(1, slice.length);
  const smartWidth = Math.max(1.4, step * 0.34);
  const individualWidth = Math.max(1.2, step * 0.28);

  const yFor = (value) => zeroY - (value / maxAbs) * (plotHeight / 2 - 8);
  const rectFor = (value, x, barWidth, color, opacity = 1) => {
    const y = yFor(value);
    const top = Math.min(y, zeroY);
    const barHeight = Math.max(1, Math.abs(y - zeroY));
    return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="1.5" fill="${color}" opacity="${opacity}"/>`;
  };

  const bars = slice
    .map((row, index) => {
      const x = margin.left + index * step;
      const smartColor = row.smartMoney >= 0 ? "#e03131" : "#1c64f2";
      const individualColor = row.individual >= 0 ? "#f08a8a" : "#7aa7ff";
      return [
        rectFor(row.smartMoney, x + step * 0.16, smartWidth, smartColor, 0.92),
        rectFor(row.individual, x + step * 0.56, individualWidth, individualColor, 0.72),
      ].join("");
    })
    .join("");

  const largestBuy = slice.reduce((best, row) => (row.smartMoney > best.smartMoney ? row : best), slice[0]);
  const largestSell = slice.reduce((best, row) => (row.smartMoney < best.smartMoney ? row : best), slice[0]);
  const markerFor = (target, color) => {
    const index = slice.findIndex((row) => row.date === target.date);
    const x = margin.left + index * step + step * 0.33;
    const y = yFor(target.smartMoney);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="${color}" stroke="#fff" stroke-width="2"/>`;
  };

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#fbfcfc"/>
      <line class="chart-grid-line" x1="${margin.left}" y1="${margin.top}" x2="${width - margin.right}" y2="${margin.top}"/>
      <line class="chart-grid-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"/>
      <line class="chart-zero" x1="${margin.left}" y1="${zeroY}" x2="${width - margin.right}" y2="${zeroY}"/>
      <text class="chart-label" x="8" y="${margin.top + 4}">+${chartNumber(maxAbs)}</text>
      <text class="chart-label" x="16" y="${zeroY - 5}">0</text>
      <text class="chart-label" x="10" y="${height - margin.bottom}">-${chartNumber(maxAbs)}</text>
      ${bars}
      ${markerFor(largestBuy, "#e03131")}
      ${markerFor(largestSell, "#1c64f2")}
      <text class="chart-label" x="${margin.left}" y="${height - 8}">${slice[0]?.date.slice(5) || ""}</text>
      <text class="chart-label" text-anchor="end" x="${width - margin.right}" y="${height - 8}">${slice[slice.length - 1]?.date.slice(5) || ""}</text>
    </svg>
  `;
}

function renderPriceChart(rows, period) {
  const slice = rows.slice(0, period.days).reverse();
  const width = 660;
  const height = 220;
  const margin = { top: 16, right: 48, bottom: 28, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const closeValues = slice.map((row) => row.close);
  const holdValues = slice.map((row) => row.foreignHoldRatio);
  const closeMin = Math.min(...closeValues);
  const closeMax = Math.max(...closeValues);
  const holdMin = Math.min(...holdValues);
  const holdMax = Math.max(...holdValues);
  const closeRange = closeMax - closeMin || 1;
  const holdRange = holdMax - holdMin || 1;
  const xFor = (index) => margin.left + (plotWidth * index) / Math.max(1, slice.length - 1);
  const yClose = (value) => margin.top + ((closeMax - value) / closeRange) * plotHeight;
  const yHold = (value) => margin.top + ((holdMax - value) / holdRange) * plotHeight;
  const pricePoints = slice.map((row, index) => ({ x: xFor(index), y: yClose(row.close) }));
  const holdPoints = slice.map((row, index) => ({ x: xFor(index), y: yHold(row.foreignHoldRatio) }));
  const areaPoints = [
    `${pricePoints[0]?.x.toFixed(1)},${height - margin.bottom}`,
    svgPolyline(pricePoints),
    `${pricePoints[pricePoints.length - 1]?.x.toFixed(1)},${height - margin.bottom}`,
  ].join(" ");
  const latest = slice[slice.length - 1];

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="#fbfcfc"/>
      <line class="chart-grid-line" x1="${margin.left}" y1="${margin.top}" x2="${width - margin.right}" y2="${margin.top}"/>
      <line class="chart-grid-line" x1="${margin.left}" y1="${margin.top + plotHeight / 2}" x2="${width - margin.right}" y2="${margin.top + plotHeight / 2}"/>
      <line class="chart-grid-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"/>
      <polygon class="chart-fill-price" points="${areaPoints}"/>
      <polyline class="chart-line-price" points="${svgPolyline(pricePoints)}"/>
      <polyline class="chart-line-hold" points="${svgPolyline(holdPoints)}"/>
      <circle cx="${pricePoints[pricePoints.length - 1]?.x.toFixed(1)}" cy="${pricePoints[pricePoints.length - 1]?.y.toFixed(1)}" r="4" fill="#17201b" stroke="#fff" stroke-width="2"/>
      <circle cx="${holdPoints[holdPoints.length - 1]?.x.toFixed(1)}" cy="${holdPoints[holdPoints.length - 1]?.y.toFixed(1)}" r="4" fill="#1c64f2" stroke="#fff" stroke-width="2"/>
      <text class="chart-label" x="6" y="${margin.top + 4}">${formatNumber.format(closeMax)}</text>
      <text class="chart-label" x="6" y="${height - margin.bottom}">${formatNumber.format(closeMin)}</text>
      <text class="chart-label" text-anchor="end" x="${width - 6}" y="${margin.top + 4}">${formatPercent.format(holdMax)}%</text>
      <text class="chart-label" text-anchor="end" x="${width - 6}" y="${height - margin.bottom}">${formatPercent.format(holdMin)}%</text>
      <text class="chart-label" x="${margin.left}" y="${height - 8}">${slice[0]?.date.slice(5) || ""}</text>
      <text class="chart-label" text-anchor="end" x="${width - margin.right}" y="${height - 8}">${latest?.date.slice(5) || ""}</text>
    </svg>
  `;
}

function renderCharts(rows, period) {
  els.chartMeta.textContent = `${period.startDate} ~ ${period.endDate} · ${period.days}거래일 · 막대는 순매매, 선은 가격/보유율`;
  els.flowChart.innerHTML = renderFlowChart(rows, period);
  els.priceChart.innerHTML = renderPriceChart(rows, period);
}

function renderReport() {
  const report = state.report;
  if (!report) return;

  const latest = report.rows[0];
  const availablePeriods = [5, 20, 60, 120].filter((days) => days <= report.rows.length);
  if (state.selectedPeriod > report.rows.length && availablePeriods.length) {
    state.selectedPeriod = availablePeriods[availablePeriods.length - 1];
  }
  if (!availablePeriods.includes(state.selectedPeriod)) {
    state.selectedPeriod = availablePeriods[0] || report.rows.length;
  }

  for (const tab of els.periodTabs) {
    const tabPeriod = Number(tab.dataset.period);
    tab.disabled = tabPeriod > report.rows.length;
    tab.classList.toggle("is-active", tabPeriod === state.selectedPeriod);
  }

  const period = summarizePeriod(report.rows, state.selectedPeriod) || summarizePeriod(report.rows, report.rows.length);
  const [verdict, verdictDetail] = classifyFlow(period);
  const insights = buildInsights(report.rows, period);

  els.result.hidden = false;
  els.stockMarket.textContent = `${report.stock.market} · ${report.stock.code} · ${report.rows.length}거래일 수집 · ${latest.date}`;
  els.stockName.textContent = report.stock.name;
  els.openNaver.href = report.stock.naverUrl;

  els.flowVerdict.textContent = verdict;
  els.flowVerdictDetail.textContent = verdictDetail;
  els.flowScore.textContent = `${period.score}`;
  els.flowScore.className = flowClass(period.score);
  els.scoreNeedle.style.left = `${clamp((period.score + 100) / 2, 0, 100)}%`;

  els.latestClose.textContent = formatNumber.format(latest.close);
  els.latestChange.textContent = `${latest.priceDirection} ${signed(latest.priceChange)} (${signedPercent(latest.priceChangePct)})`;
  els.latestChange.className = flowClass(latest.priceChange);
  setFlowText(els.latestForeign, latest.foreign);
  els.latestForeignRate.textContent = `보유율 ${formatPercent.format(latest.foreignHoldRatio)}%`;
  setFlowText(els.latestInstitution, latest.institution);
  setFlowText(els.latestIndividual, latest.individual);
  els.individualLabel.textContent = latest.individualKind === "actual" ? "개인" : "개인+기타";
  els.individualNote.textContent = latest.individualKind === "actual" ? "최근일 실제 개인" : "잔여 추정";

  els.periodPrice.textContent = signedPercent(period.priceChangePct);
  els.periodPrice.className = flowClass(period.priceChangePct);
  setFlowText(els.periodSmart, period.smartMoney);
  setFlowText(els.periodIndividual, period.individual);
  els.periodIndividualLabel.textContent = period.actualIndividualDays === period.days ? "개인" : "개인+기타";
  els.periodForeignRate.textContent = `${signedPercent(period.foreignHoldRatioChange)}p`;
  els.periodForeignRate.className = flowClass(period.foreignHoldRatioChange);
  els.periodIntensity.textContent = signedPercent(period.smartMoneyVolumeRatio);
  els.periodIntensity.className = flowClass(period.smartMoneyVolumeRatio);

  renderStrategy(report.rows, period);
  renderCharts(report.rows, period);
  renderDiagnostics(period);

  els.insightList.innerHTML = "";
  for (const insight of insights) {
    const li = document.createElement("li");
    li.textContent = insight;
    els.insightList.appendChild(li);
  }

  els.tableSub.textContent = `${report.rows[report.rows.length - 1].date} ~ ${report.rows[0].date}`;
  els.dailyRows.innerHTML = "";
  for (const row of report.rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date.slice(5)}</td>
      <td class="${flowClass(row.foreign)}">${signed(row.foreign)}</td>
      <td class="${flowClass(row.institution)}">${signed(row.institution)}</td>
      <td class="${flowClass(row.individual)}">${signed(row.individual)}${row.individualKind === "actual" ? "" : "*"}</td>
      <td>${formatPercent.format(row.foreignHoldRatio)}%</td>
      <td>${formatNumber.format(row.close)}</td>
    `;
    els.dailyRows.appendChild(tr);
  }
}

function renderRecent() {
  els.recentList.innerHTML = "";
  els.recentBox.hidden = state.recent.length === 0;
  for (const stock of state.recent.slice(0, 4)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-chip";
    button.title = `${stock.name} (${stock.code})`;
    button.textContent = stock.name;
    button.addEventListener("click", () => analyzeStock(stock));
    els.recentList.appendChild(button);
  }
}

function storageGet(key) {
  return new Promise((resolve) => {
    if (!globalThis.chrome?.storage?.local) {
      const fallback = localStorage.getItem(key);
      resolve(fallback ? JSON.parse(fallback) : undefined);
      return;
    }
    chrome.storage.local.get(key, (items) => resolve(items[key]));
  });
}

function storageSet(key, value) {
  return new Promise((resolve) => {
    if (!globalThis.chrome?.storage?.local) {
      localStorage.setItem(key, JSON.stringify(value));
      resolve();
      return;
    }
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

async function rememberStock(stock) {
  state.recent = [stock, ...state.recent.filter((item) => item.code !== stock.code)].slice(0, 6);
  await storageSet(RECENT_KEY, state.recent);
  renderRecent();
}

async function analyzeStock(stock) {
  const maxRows = Number(els.rangeSelect.value || 120);
  try {
    setLoading(true);
    setStatus(`${stock.name} 수급 데이터를 최대 ${maxRows}거래일까지 수집하는 중입니다.`);
    renderCandidates([]);
    state.report = await fetchReport(stock, maxRows);
    await rememberStock(state.report.stock);
    setStatus(`네이버 PC 수급 페이지 ${Math.ceil(maxRows / 20)}개와 모바일 실제 개인 수급을 병합했습니다.`);
    renderReport();
  } catch (error) {
    setStatus(error.message || "분석 중 오류가 발생했습니다.", true);
  } finally {
    setLoading(false);
  }
}

async function analyzeQuery(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    setStatus("종목명 또는 종목코드를 입력해주세요.", true);
    return;
  }

  try {
    setLoading(true);
    setStatus("종목을 검색하는 중입니다.");
    const candidates = await searchStocks(trimmed);
    if (!candidates.length) {
      setStatus(`검색 결과가 없습니다: ${trimmed}`, true);
      return;
    }

    renderCandidates(candidates);
    const normalized = trimmed.toUpperCase();
    const exact = candidates.find((item) => item.code.toUpperCase() === normalized || item.name.toUpperCase() === normalized);
    await analyzeStock(exact || candidates[0]);
  } catch (error) {
    setStatus(error.message || "검색 중 오류가 발생했습니다.", true);
  } finally {
    setLoading(false);
  }
}

function copySummary() {
  if (!state.report) return;
  const report = state.report;
  const period = summarizePeriod(report.rows, state.selectedPeriod) || summarizePeriod(report.rows, report.rows.length);
  const [verdict] = classifyFlow(period);
  const strategy = buildTradingStrategy(report.rows, period);
  const latest = report.rows[0];
  const lines = [
    `[${report.stock.name} ${report.stock.code}] 네이버 수급 분석`,
    `${period.days}거래일 판정: ${verdict}, 점수 ${period.score}`,
    `수급 기준 의견: ${strategy.opinion} / 실행: ${strategy.action}`,
    `최근일 ${latest.date}: 외국인 ${signed(latest.foreign)}, 기관 ${signed(latest.institution)}, 개인/기타 ${signed(latest.individual)}`,
    `${period.days}거래일: 가격 ${signedPercent(period.priceChangePct)}, 외국인+기관 ${signed(period.smartMoney)}, 개인/기타 ${signed(period.individual)}, 외국인 보유율 ${signedPercent(period.foreignHoldRatioChange)}p`,
    `전략: ${strategy.items.map(([title, detail]) => `${title} - ${detail}`).join(" / ")}`,
    `데이터: ${report.rows.length}거래일, 실제 개인 수급 ${report.actualIndividualDays}일, 나머지 개인/기타 잔여 추정`,
  ];
  navigator.clipboard.writeText(lines.join("\n")).then(
    () => setStatus("요약을 클립보드에 복사했습니다."),
    () => setStatus("클립보드 복사 권한이 없어 복사하지 못했습니다.", true)
  );
}

function bindEvents() {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    analyzeQuery(els.input.value);
  });

  els.copyButton.addEventListener("click", copySummary);

  for (const tab of els.periodTabs) {
    tab.addEventListener("click", () => {
      if (tab.disabled) return;
      state.selectedPeriod = Number(tab.dataset.period);
      renderReport();
    });
  }
}

async function init() {
  bindEvents();
  state.recent = (await storageGet(RECENT_KEY)) || [];
  renderRecent();
  els.input.focus();
}

init();
