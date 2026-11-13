/* Gera uma página por evento em /evento/<id>/ a partir do EVENTS da programação
   e dos complementos escritos à mão em ferramentas/detalhes.json.

   node ferramentas/gerar-eventos.mjs            gera as páginas
   node ferramentas/gerar-eventos.mjs --listar   diz quais eventos ainda não têm detalhes

   As coordenadas vêm do Nominatim (OpenStreetMap) e ficam guardadas em
   ferramentas/coordenadas.json, para não consultar de novo a cada geração. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..");
const SITE = "https://agendamunique.com";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TIPOS = { natal: ["Mercados de Natal", "natal"], floh: ["Feiras de pulgas", "floh"], rua: ["Eventos de rua", "rua"] };
const DIAS_SCHEMA = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const idDe = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const dia = (iso) => Number(iso.slice(8, 10));
const mes = (iso) => Number(iso.slice(5, 7)) - 1;
const porExtenso = (iso) => `${dia(iso)} de ${MESES[mes(iso)]}`;
const curto = (iso) => `${dia(iso)} ${MESES_CURTOS[mes(iso)]}`;

function carregarEventos() {
  const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  const bloco = html.split("// === DADOS DOS EVENTOS: INÍCIO")[1].split("// === DADOS DOS EVENTOS: FIM")[0];
  const fn = new Function(bloco.replace(/^[^\n]*\n/, "") + "\nreturn { EVENTS, WEEKLY, UPDATED };");
  const { EVENTS, WEEKLY } = fn();
  // Os semanais (feiras de pulgas) não têm data de início e fim: ganham semanal = true
  // e a página mostra a recorrência no lugar do período.
  const todos = EVENTS.concat((WEEKLY || []).map((e) => Object.assign({}, e, { semanal: true })));
  todos.forEach((e) => { e.id = idDe(e.t); });
  return todos;
}

const lerJSON = (nome, vazio) => {
  const p = path.join(AQUI, nome);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : vazio;
};

/* ---- coordenadas ---- */
async function coordenadas(eventos) {
  const cache = lerJSON("coordenadas.json", {});
  let novas = 0;
  for (const ev of eventos) {
    if (cache[ev.id]) continue;
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=" + encodeURIComponent(ev.q);
    const r = await fetch(url, { headers: { "User-Agent": "AgendaMunique/1.0 (+https://agendamunique.com)" } });
    const j = await r.json();
    cache[ev.id] = j[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon), achou: j[0].display_name } : null;
    console.log(cache[ev.id] ? `  ${ev.id} → ${cache[ev.id].lat}, ${cache[ev.id].lon}` : `  ${ev.id} → não encontrado (${ev.q})`);
    novas++;
    await new Promise((r) => setTimeout(r, 1100)); // o Nominatim pede no máximo 1 consulta por segundo
  }
  if (novas) fs.writeFileSync(path.join(AQUI, "coordenadas.json"), JSON.stringify(cache, null, 2) + "\n");
  return cache;
}

/* ---- mapa: mosaico de tiles do OpenStreetMap ---- */
function mapa(lat, lon, rotulo) {
  const z = 15, n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const lr = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2) * n;
  const x0 = Math.floor(x) - 2, y0 = Math.floor(y) - 1;
  const offx = ((x - x0) * 256).toFixed(0), offy = ((y - y0) * 256).toFixed(0);
  let tiles = "";
  for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++)
    tiles += `<img src="https://tile.openstreetmap.org/${z}/${x0 + i}/${y0 + j}.png" alt="" loading="lazy" decoding="async" width="256" height="256">`;
  return `  <div class="mapa">
    <div class="mapa-tiles" style="margin-left:-${offx}px;margin-top:-${offy}px" aria-hidden="true">${tiles}</div>
    <svg class="mapa-pin" viewBox="0 0 24 30" role="img" aria-label="${esc(rotulo)}"><path d="M12 29s10-9.3 10-17A10 10 0 0 0 2 12c0 7.7 10 17 10 17z"/><circle cx="12" cy="12" r="3.6" fill="#fff" stroke="none"/></svg>
    <p class="mapa-cred">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></p>
  </div>`;
}

/* ---- horários: uma só fonte vira a tabela e o EV do script ---- */
const emMinutos = (h) => {
  const m = /^(\d{1,2})h(\d{2})?$/.exec(String(h).trim());
  if (!m) throw new Error(`horário fora do formato 10h ou 10h30: ${h}`);
  return Number(m[1]) * 60 + Number(m[2] || 0);
};

const emRelogio = (h) => {
  const m = emMinutos(h);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/* Nos semanais, as datas sem feira entram como exceção fechada sem virar linha da tabela. */
function horarios(linhas, semFeira) {
  if (!linhas || !linhas.length) return { tabela: "", semana: null, excecoes: {} };
  const semana = [null, null, null, null, null, null, null];
  const excecoes = {};
  (semFeira || []).forEach((iso) => { excecoes[iso] = null; });
  const tr = linhas.map((l) => {
    const faixa = l.fechado ? null : [emMinutos(l.abre), emMinutos(l.fecha)];
    const texto = l.fechado || `${l.abre} às ${l.fecha}`;
    if (l.data) { excecoes[l.data] = faixa; return `      <tr data-data="${l.data}"><th>${esc(l.rotulo)}</th><td>${esc(texto)}</td></tr>`; }
    l.dias.forEach((d) => { semana[d] = faixa; });
    return `      <tr data-dia="${l.dias[0]}"><th>${esc(l.rotulo)}</th><td>${esc(texto)}</td></tr>`;
  }).join("\n");
  return { tabela: tr, semana, excecoes };
}

/* ---- eventos por perto ---- */
function perto(ev, eventos, coords, comPagina) {
  const a = coords[ev.id];
  if (!a) return [];
  const hoje = new Date().toISOString().slice(0, 10);
  const R = 6371000, rad = (g) => (g * Math.PI) / 180;
  // O semanal acontece o ano todo: vizinho dele é qualquer evento com data que ainda não terminou.
  const coincide = (o) => (ev.semanal ? o.e >= hoje : o.s <= ev.e && o.e >= ev.s);
  return eventos
    .filter((o) => o.id !== ev.id && !o.semanal && coords[o.id] && coincide(o))
    .map((o) => {
      const b = coords[o.id];
      const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
      return { ev: o, m: Math.round(2 * R * Math.asin(Math.sqrt(h))) };
    })
    .filter((x) => x.m <= 1500)
    .sort((x, y) => x.m - y.m)
    .slice(0, 4)
    .map(({ ev: o, m }) => {
      const destino = comPagina.has(o.id) ? `/evento/${o.id}/` : `/#ev-${o.id}`;
      const dist = m < 1000 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
      const quando = o.s === o.e ? curto(o.s) : `${curto(o.s)} a ${curto(o.e)}`;
      return `    <li><a href="${destino}"><strong>${esc(o.t)}</strong> <span>${esc(quando)}</span> <span class="dist">${dist}</span></a></li>`;
    });
}

/* ---- a página ---- */
function pagina(ev, d, coord, vizinhos) {
  const [rotuloTipo, filtroTipo] = TIPOS[ev.type] || ["Programação", ""];
  const ano = ev.semanal ? String(new Date().getFullYear()) : ev.s.slice(0, 4);
  const tituloOg = ev.semanal ? ev.t : `${ev.t} ${ano}`;
  const titulo = d.titulo || (ev.semanal
    ? `${ev.t}: dias, horários e como chegar`
    : `${ev.t} ${ano}: datas, horários e como chegar`);
  const descricao = d.descricao || (ev.semanal
    ? `${ev.t}, em português: em que dias acontece, horários, entrada e como chegar.`
    : `${ev.t} em Munique, em português: datas, horários, entrada e como chegar.`);
  const local = d.local || ev.place;
  const quando = ev.semanal
    ? (d.quando || ev.when)
    : (ev.s === ev.e ? `${porExtenso(ev.s)} de ${ano}` : `${porExtenso(ev.s)} a ${porExtenso(ev.e)} de ${ev.e.slice(0, 4)}`);
  const h = horarios(d.horarios, d.semFeira);
  const oQueE = (d.oQueE && d.oQueE.length ? d.oQueE : [ev.d]).map((p) => `  <p>${p}</p>`).join("\n");

  const item = (dt, dd, nota) => `    <div class="ess-item">
      <dt>${dt}</dt>
      <dd>${dd}${nota ? `<small>${nota}</small>` : ""}</dd>
    </div>`;

  const essencial = [
    `    <div class="ess-item">
      <dt>Hoje</dt>
      <dd class="hoje" id="hoje">—</dd>
    </div>`,
    item("Quando", esc(quando), esc(d.quandoNota || (ev.semanal ? ev.note || "" : ""))),
    item("Onde", esc(local), d.endereco ? esc(d.endereco) : ""),
    d.transporte ? item("Como chegar", esc(d.transporte), d.transporteNota ? esc(d.transporteNota) : "") : "",
    item("Entrada", esc(d.entrada || (ev.free ? "Gratuita" : "Confira no site oficial")), d.entradaNota ? esc(d.entradaNota) : ""),
    ev.url ? item("Site oficial", `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))} ↗</a>`, "Confira lá antes de sair: datas e horários podem mudar") : "",
  ].filter(Boolean).join("\n");

  const selos = [
    `<span class="selo" id="selo-estado">${esc(ev.semanal ? "Toda semana" : (ev.s === ev.e ? curto(ev.s) : `${curto(ev.s)} a ${curto(ev.e)}`))}</span>`,
    ev.free ? '<span class="selo">Entrada gratuita</span>' : "",
    ev.kids ? '<span class="selo">Bom com crianças</span>' : "",
  ].filter(Boolean).join("\n    ");

  // O semanal não tem início e fim: vira EventSeries com a recorrência em eventSchedule.
  const agenda = (d.horarios || []).filter((l) => l.dias && !l.fechado).map((l) => ({
    "@type": "Schedule",
    byDay: l.dias.map((n) => `https://schema.org/${DIAS_SCHEMA[n]}`),
    startTime: emRelogio(l.abre), endTime: emRelogio(l.fecha),
    repeatFrequency: "P1W", scheduleTimezone: "Europe/Berlin",
    ...(d.semFeira && d.semFeira.length ? { exceptDate: d.semFeira } : {}),
  }));

  const jsonld = {
    "@context": "https://schema.org", "@type": ev.semanal ? "EventSeries" : "Event", name: ev.t,
    ...(ev.semanal ? (agenda.length ? { eventSchedule: agenda } : {}) : { startDate: ev.s, endDate: ev.e }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: d.descricao || ev.d, image: `${SITE}/og.png`, url: `${SITE}/evento/${ev.id}/`,
    ...(ev.free ? { isAccessibleForFree: true } : {}),
    location: {
      "@type": "Place", name: local,
      ...(d.rua ? { address: { "@type": "PostalAddress", streetAddress: d.rua, postalCode: d.cep, addressLocality: "München", addressCountry: "DE" } } : {}),
      ...(coord ? { geo: { "@type": "GeoCoordinates", latitude: coord.lat, longitude: coord.lon } } : {}),
    },
    ...(ev.url ? { organizer: { "@type": "Organization", name: d.organizador || ev.t, url: ev.url } } : {}),
  };

  const EV = {
    ...(ev.semanal
      ? { semanal: true, ...(d.calendarioAte ? { ateQuando: d.calendarioAte } : {}) }
      : { inicio: ev.s, fim: ev.e, abre: porExtenso(ev.s) }),
    ...(coord ? { lat: coord.lat, lon: coord.lon } : {}),
    horario: h.semana, excecoes: h.excecoes,
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${SITE}/evento/${ev.id}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Agenda Munique">
<meta property="og:title" content="${esc(tituloOg)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${SITE}/evento/${ev.id}/">
<meta property="og:image" content="${SITE}/og.png?v=2">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#a5d86a">
<style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style>
<link rel="stylesheet" href="/evento/estilo.css">
</head>
<body>

<div class="top">
  <a class="logo" href="/" aria-label="Agenda Munique, início">
    <svg viewBox="12 -1 88 88" aria-hidden="true"><rect x="10.6163" y="13.3935" width="79.6215" height="73" rx="22" transform="rotate(-9.68402 10.6163 13.3935)" fill="#a6d86a"/><circle cx="70.1856" cy="27.0938" r="15.5" fill="#f7d84a"/></svg>
    Agenda Munique
  </a>
  <a class="voltar" href="/">← Toda a programação</a>
</div>

<main class="wrap">
  <p class="trilha"><a href="/">Agenda Munique</a> › <a href="/?tipo=${filtroTipo}">${rotuloTipo}</a> › ${esc(ev.t)}</p>

  <h1>${esc(ev.t)}</h1>
  <div class="selos">
    ${selos}
  </div>

  <dl class="essencial">
${essencial}
  </dl>

  <h2>O que é</h2>
${oQueE}
${d.criancas && d.criancas.length ? `
  <h2>Com crianças</h2>
${d.criancas.map((p) => `  <p>${p}</p>`).join("\n")}
` : ""}${h.tabela ? `
  <h2>Horários</h2>
  <table class="horarios" id="tabela-horarios">
    <tbody>
${h.tabela}
    </tbody>
  </table>
  <p class="nota">${esc(d.horariosNota || "Os horários são os publicados pelo organizador e podem mudar.")}</p>
` : ""}${coord ? `
  <h2>Como chegar</h2>
${mapa(coord.lat, coord.lon, `${ev.t} fica em ${local}, em Munique`)}
  <div class="acoes">
    <button class="btn principal" type="button" id="btn-rota">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>
      Como chegar daqui
    </button>
    <a class="btn" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(ev.q)}" target="_blank" rel="noopener">Abrir no mapa ↗</a>
  </div>
  <p class="aviso-local" id="aviso-local">Ao tocar, o navegador pede a sua localização e abre o trajeto de transporte público. Se preferir não dar, abrimos o mapa só com o destino.</p>
` : ""}${vizinhos.length ? `
  <h2>Outros eventos por perto</h2>
  <p class="nota nota-perto">Distâncias a pé a partir de ${esc(local)}, não da sua localização.</p>
  <ul class="perto">
${vizinhos.join("\n")}
  </ul>
` : ""}
  <div class="news">
    <p>📬 Receba a programação toda quinta-feira no seu e-mail</p>
    <a class="btn" href="/#newsletter">Quero receber →</a>
  </div>
</main>

<footer class="foot">
  <div class="foot-in">
    <p>O Agenda Munique é um agregador de eventos de Munique. Todas as informações vêm dos sites dos próprios eventos, por isso confira${ev.url ? ` no <a href="${esc(ev.url)}" target="_blank" rel="noopener">site oficial</a>` : " no site oficial"} as datas, os locais e os valores antes de sair.</p>
    <p><a href="/">Ver toda a programação</a></p>
  </div>
</footer>

<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>

<script>var EV = ${JSON.stringify(EV)};</script>
<script src="/evento/pagina.js"></script>
</body>
</html>
`;
}

/* ---- main ---- */
const eventos = carregarEventos();
const detalhes = lerJSON("detalhes.json", {});

if (process.argv.includes("--listar")) {
  const faltam = eventos.filter((e) => !detalhes[e.id]);
  console.log(`${eventos.length} eventos, ${eventos.length - faltam.length} com texto próprio.`);
  faltam.forEach((e) => console.log(`  falta: ${e.id}  (${e.t})`));
  process.exit(0);
}

// Quem tem lat/lon escritos à mão em detalhes.json não vai ao Nominatim.
const manuais = {};
eventos.forEach((e) => {
  const d = detalhes[e.id];
  if (d && d.lat) manuais[e.id] = { lat: d.lat, lon: d.lon };
});

console.log("Coordenadas:");
const coords = Object.assign({}, await coordenadas(eventos.filter((e) => !manuais[e.id])), manuais);
const comPagina = new Set(eventos.map((e) => e.id));

let n = 0;
for (const ev of eventos) {
  const d = detalhes[ev.id] || {};
  const coord = d.lat ? { lat: d.lat, lon: d.lon } : coords[ev.id];
  const destino = path.join(RAIZ, "evento", ev.id);
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, "index.html"), pagina(ev, d, coord, perto(ev, eventos, coords, comPagina)));
  n++;
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc></url>
${eventos.map((e) => `  <url><loc>${SITE}/evento/${e.id}/</loc></url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(RAIZ, "sitemap.xml"), sitemap);
console.log(`\n${n} páginas geradas e sitemap.xml atualizado.`);
