/* Gera app/dados.json: tudo o que o aplicativo do Munich Calendar precisa, num arquivo só.
   Junta o EVENTS, o WEEKLY e o DESTAQUE da programação (index.html) com os textos de
   ferramentas/detalhes.json e as coordenadas de ferramentas/coordenadas.json.

   node ferramentas/gerar-app.mjs

   Rode depois da atualização semanal e do gerar-eventos.mjs (que busca as coordenadas novas).
   O app baixa https://munichcalendar.com/app/dados.json ao abrir; sem internet, usa a última cópia. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..");
const SITE = "https://munichcalendar.com";

const idDe = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const lerJSON = (nome) => JSON.parse(fs.readFileSync(path.join(AQUI, nome), "utf8"));

const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
const bloco = html.split("// === DADOS DOS EVENTOS: INÍCIO")[1].split("// === DADOS DOS EVENTOS: FIM")[0];
const { EVENTS, WEEKLY, UPDATED, DESTAQUE } = new Function(
  bloco.replace(/^[^\n]*\n/, "") + "\nreturn { EVENTS, WEEKLY, UPDATED, DESTAQUE: typeof DESTAQUE === 'undefined' ? null : DESTAQUE };"
)();

const detalhes = lerJSON("detalhes.json");
const coords = lerJSON("coordenadas.json");

// Campos do detalhes.json que o app mostra (título e descrição de SEO ficam de fora)
const CAMPOS = ["local", "endereco", "transporte", "transporteNota", "entrada", "entradaNota", "quando", "quandoNota",
  "oQueE", "criancas", "horarios", "horariosNota", "semFeira", "calendarioAte"];

function evento(e, semanal) {
  const id = idDe(e.t);
  const d = detalhes[id];
  const c = d && d.lat ? { lat: d.lat, lon: d.lon } : coords[id];
  const out = { id, ...e };
  if (semanal) out.semanal = true;
  if (c) { out.lat = c.lat; out.lon = c.lon; }
  if (d) {
    out.det = {};
    CAMPOS.forEach((k) => { if (d[k] !== undefined) out.det[k] = d[k]; });
  }
  return out;
}

const eventos = EVENTS.map((e) => evento(e, false)).concat((WEEKLY || []).map((e) => evento(e, true)));

const dados = {
  versao: 1,
  atualizado: UPDATED,
  site: SITE + "/",
  destaque: DESTAQUE && DESTAQUE.img
    ? { img: SITE + DESTAQUE.img, s: DESTAQUE.s, e: DESTAQUE.e, ev: idDe(DESTAQUE.ev), alt: DESTAQUE.alt || {} }
    : null,
  eventos,
};

fs.mkdirSync(path.join(RAIZ, "app"), { recursive: true });
const destino = path.join(RAIZ, "app", "dados.json");
fs.writeFileSync(destino, JSON.stringify(dados) + "\n");

const semCoord = eventos.filter((e) => e.lat === undefined).map((e) => e.id);
console.log(`app/dados.json: ${eventos.length} eventos, ${eventos.filter((e) => e.det).length} com detalhes, ${(fs.statSync(destino).size / 1024).toFixed(0)} KB.`);
if (semCoord.length) console.log("  sem coordenadas (não aparecem no mapa): " + semCoord.join(", "));
