// Gera a newsletter da semana a partir dos mesmos dados do site (bloco DADOS DOS EVENTOS do index.html).
// Uso: node newsletter/gerar.mjs [AAAA-MM-DD]   (data da edição, normalmente a quinta; sem data usa hoje)
// Cria newsletter/AAAA-MM-DD-pt.html, -de.html e -en.html (cada um é o e-mail e também a versão "ver no navegador")
// e newsletter/ultima.json, que o Apps Script lê para criar o envio no Resend.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PASTA = dirname(fileURLToPath(import.meta.url));
const SITE = "https://munichcalendar.com/";
const html = readFileSync(join(PASTA, "..", "index.html"), "utf8");
const bloco = html.slice(html.indexOf("// === DADOS DOS EVENTOS: INÍCIO"), html.indexOf("// === DADOS DOS EVENTOS: FIM"));
const dados = {};
vm.runInNewContext(bloco + "\n;out.EVENTS = EVENTS; out.WEEKLY = WEEKLY;", { out: dados });
const { EVENTS, WEEKLY } = dados;

// Datas sempre como dias de calendário (sem fuso)
const dia = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const mais = (d, n) => new Date(d.getTime() + n * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);
const hoje = process.argv[2] ? dia(process.argv[2]) : dia(new Date().toISOString().slice(0, 10));
const dow = hoje.getUTCDay();
const sab = mais(hoje, dow === 0 ? -1 : 6 - dow), dom = mais(sab, 1);
const proxIni = mais(dom, 1), proxFim = mais(dom, 7);

const TXT = {
  pt: {
    meses: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
    data: (d) => d.getUTCDate() + " " + TXT.pt.meses[d.getUTCMonth()],
    faixa: (a, b) => a + " a " + b,
    previa: "O que tem para fazer em Munique neste fim de semana, em português.",
    assunto: (nomes, n) => "Fim de semana em Munique: " + nomes + (n > 0 ? " e mais " + n : ""),
    oi: "Oi! Aqui vai a programação de Munique para o fim de semana.",
    estreias: "Abre neste fim de semana", abertos: "Também abertos no fim de semana",
    proxima: "Abre na semana que vem", semanal: "Toda semana",
    ate: (d) => "até " + d, abre: (d) => "abre " + d,
    gratis: "Entrada gratuita", criancas: "Bom com crianças", mais: (n) => "E mais " + n + " no site →",
    mapa: "Ver no mapa", siteOf: "Site oficial", tudo: "Ver a programação completa",
    navegador: "Ver no navegador", porque: "Você recebe este e-mail porque se inscreveu no Munich Calendar (antes Agenda Munique).",
    sair: "Cancelar a newsletter", nada: "Nenhuma estreia neste fim de semana. Mas tem muita coisa aberta:",
    fimDeSemana: (s, d) => "Fim de semana, " + (s.getUTCMonth() === d.getUTCMonth() ? s.getUTCDate() + " e " + TXT.pt.data(d) : TXT.pt.data(s) + " e " + TXT.pt.data(d)),
  },
  de: {
    meses: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
    data: (d) => d.getUTCDate() + ". " + TXT.de.meses[d.getUTCMonth()],
    faixa: (a, b) => a + " bis " + b,
    previa: "Was am Wochenende in München los ist.",
    assunto: (nomes, n) => "Wochenende in München: " + nomes + (n > 0 ? " und " + n + " mehr" : ""),
    oi: "Hallo! Hier ist, was am Wochenende in München los ist.",
    estreias: "Neu an diesem Wochenende", abertos: "Am Wochenende außerdem geöffnet",
    proxima: "Startet nächste Woche", semanal: "Jede Woche",
    ate: (d) => "bis " + d, abre: (d) => "ab " + d,
    gratis: "Eintritt frei", criancas: "Kinderfreundlich", mais: (n) => "Und " + n + " weitere auf der Seite →",
    mapa: "Auf der Karte ansehen", siteOf: "Offizielle Website", tudo: "Das ganze Programm ansehen",
    navegador: "Im Browser ansehen", porque: "Du bekommst diese E-Mail, weil du dich bei Munich Calendar (früher Agenda Munique) eingetragen hast.",
    sair: "Newsletter abbestellen", nada: "An diesem Wochenende startet nichts Neues. Aber vieles hat geöffnet:",
    fimDeSemana: (s, d) => "Wochenende, " + (s.getUTCMonth() === d.getUTCMonth() ? s.getUTCDate() + ". und " + TXT.de.data(d) : TXT.de.data(s) + " und " + TXT.de.data(d)),
  },
  en: {
    meses: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    data: (d) => d.getUTCDate() + " " + TXT.en.meses[d.getUTCMonth()],
    faixa: (a, b) => a + " to " + b,
    previa: "What's on in Munich this weekend.",
    assunto: (nomes, n) => "Munich this weekend: " + nomes + (n > 0 ? " and " + n + " more" : ""),
    oi: "Hi! Here's what's on in Munich this weekend.",
    estreias: "Opening this weekend", abertos: "Also open this weekend",
    proxima: "Opening next week", semanal: "Every week",
    ate: (d) => "until " + d, abre: (d) => "opens " + d,
    gratis: "Free entry", criancas: "Kid-friendly", mais: (n) => "And " + n + " more on the site →",
    mapa: "Open in Maps", siteOf: "Official website", tudo: "See everything that's on",
    navegador: "View in browser", porque: "You're getting this email because you signed up for Munich Calendar (formerly Agenda Munique).",
    sair: "Unsubscribe", nada: "Nothing new opens this weekend, but there's still plenty on:",
    fimDeSemana: (s, d) => "Weekend of " + (s.getUTCMonth() === d.getUTCMonth() ? s.getUTCDate() + " and " + TXT.en.data(d) : TXT.en.data(s) + " and " + TXT.en.data(d)),
  },
};

// Cores e fontes do site; as fontes próprias só aparecem nos programas que as aceitam (Apple Mail, iOS), nos outros fica Helvetica/Arial
const C = { lime: "#a5d86a", limeDeep: "#7fbf4a", cream: "#f5f0e3", ink: "#1d2a1a", muted: "#55604f", yellow: "#f7d84a", coral: "#f58a74", blue: "#8fbaf7", lilac: "#cdb8f5" };
const DISPLAY = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif";
const BODY = "'Source Sans 3','Helvetica Neue',Helvetica,Arial,sans-serif";
const CORES = [C.yellow, C.coral, C.blue, C.lilac, C.lime];
const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mapa = (q) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

function gerar(lang) {
  const T = TXT[lang];
  const tr = (ev, k) => (lang !== "pt" && ev[lang] && ev[lang][k]) || ev[k];
  const siteLang = SITE + (lang === "en" ? "" : lang + "/");
  const utm = "utm_source=newsletter&utm_medium=email&utm_campaign=" + iso(hoje);
  const comUtm = (u) => u + (u.includes("?") ? "&" : "?") + utm;
  const arquivo = iso(hoje) + "-" + lang + ".html";

  const noFds = EVENTS.filter((e) => dia(e.s) <= dom && dia(e.e) >= sab);
  const estreias = noFds.filter((e) => dia(e.s) >= hoje);
  const abertos = noFds.filter((e) => dia(e.s) < hoje);
  const proxima = EVENTS.filter((e) => dia(e.s) >= proxIni && dia(e.s) <= proxFim);

  const quando = (e) => (e.s === e.e ? T.data(dia(e.s)) : T.faixa(T.data(dia(e.s)), T.data(dia(e.e))));
  const botao = (href, texto, escuro) =>
    `<a href="${esc(href)}" style="display:inline-block;background:${escuro ? C.ink : "#ffffff"};color:${escuro ? C.cream : C.ink};border:2px solid ${C.ink};border-radius:999px;padding:8px 16px;font:600 14px ${BODY};text-decoration:none;margin:0 6px 6px 0">${esc(texto)}</a>`;
  const etiqueta = (t) => `<span style="display:inline-block;background:${C.cream};border-radius:999px;padding:3px 10px;font:600 12px ${BODY};color:${C.ink};margin:0 6px 4px 0">${esc(t)}</span>`;

  // Cartão grande, como os do site: adesivo colorido com o dia, título, quando, onde, descrição e botões
  const cartao = (e, i) => {
    const d = dia(e.s);
    const tags = (e.free ? etiqueta(T.gratis) : "") + (e.kids ? etiqueta(T.criancas) : "");
    return `<tr><td style="padding:0 0 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:26px"><tr>
<td width="76" valign="top" style="padding:20px 0 20px 20px">
<div style="background:${CORES[i % 5]};border-radius:18px;width:64px;padding:9px 0;text-align:center;font-family:${DISPLAY};color:${C.ink}">
<div style="font-size:28px;font-weight:800;line-height:1;letter-spacing:-1px">${d.getUTCDate()}</div>
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:3px">${T.meses[d.getUTCMonth()]}</div></div></td>
<td valign="top" style="padding:20px 20px 16px 14px;font-family:${BODY};color:${C.ink}">
<div style="font-family:${DISPLAY};font-size:21px;font-weight:800;line-height:1.1;letter-spacing:-0.5px;margin:0 0 6px">${esc(tr(e, "t"))}</div>
<div style="font-size:14px;color:${C.muted};margin:0 0 6px">${esc(quando(e))}</div>
<div style="font-size:15px;line-height:1.45;margin:0 0 6px">${esc(tr(e, "d"))}</div>
<div style="font-size:14px;font-weight:600;margin:0 0 10px">📍 <a href="${esc(mapa(e.q))}" style="color:${C.ink}">${esc(tr(e, "place"))}</a></div>
${tags ? `<div style="margin:0 0 8px">${tags}</div>` : ""}
${e.url ? botao(e.url, T.siteOf, true) : botao(comUtm(siteLang) + "#ev-" + idDe(e), "munichcalendar.com", false)}
</td></tr></table></td></tr>`;
  };

  // Linha compacta: nome com link, quando e onde
  const linha = (e, extra, i) => `<tr><td style="padding:10px 0;${i ? "border-top:1px solid #e7e1d2;" : ""}font-family:${BODY};color:${C.ink};font-size:15px;line-height:1.4">
<a href="${esc(e.url || comUtm(siteLang) + "#ev-" + idDe(e))}" style="color:${C.ink};font-weight:700;text-decoration:underline">${esc(tr(e, "t"))}</a>
<span style="color:${C.muted}"> · ${esc(extra)} · ${esc(tr(e, "place"))}</span></td></tr>`;

  const secao = (titulo, corpo) => corpo ? `<tr><td style="padding:26px 0 12px;font-family:${DISPLAY};font-size:26px;font-weight:800;letter-spacing:-0.8px;color:${C.ink}">${esc(titulo)}</td></tr>${corpo}` : "";
  const lista = (linhas) => linhas ? `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:22px"><tr><td style="padding:6px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}</table></td></tr></table></td></tr>` : "";

  // No máximo 6 cartões grandes e 10 linhas por lista; o que passar vira "e mais N no site" (nas semanas de Natal abrem dezenas de feiras)
  const base = estreias.length ? estreias : abertos.slice(0, 3);
  const destaque = base.slice(0, 6);
  const resto = base.slice(6).concat(estreias.length ? abertos : abertos.slice(3));
  const maisNoSite = (n) => n > 0 ? `<tr><td style="padding:10px 0;border-top:1px solid #e7e1d2;font:600 15px ${BODY}"><a href="${esc(comUtm(siteLang))}" style="color:${C.ink}">${esc(T.mais(n))}</a></td></tr>` : "";
  const ate10 = (lst, txt) => lst.slice(0, 10).map((e, i) => linha(e, txt(e), i)).join("") + maisNoSite(lst.length - 10);
  const corpo =
    (estreias.length ? "" : `<tr><td style="padding:22px 0 0;font:600 16px ${BODY};color:${C.ink}">${esc(T.nada)}</td></tr>`) +
    secao(estreias.length ? T.estreias : T.abertos, destaque.map(cartao).join("")) +
    secao(estreias.length ? T.abertos : "", lista(ate10(resto, (e) => T.ate(T.data(dia(e.e)))))) +
    secao(T.proxima, lista(ate10(proxima, (e) => T.abre(T.data(dia(e.s)))))) +
    secao(T.semanal, lista(WEEKLY.map((w, i) => linha(w, tr(w, "when"), i)).join("")));

  const nomes = (estreias.length ? estreias : abertos).slice(0, 2).map((e) => tr(e, "t"));
  const assunto = T.assunto(nomes.join(", "), Math.max(0, noFds.length - nomes.length));

  const email = `<!doctype html>
<html lang="${lang === "pt" ? "pt-BR" : lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(assunto)}</title>
<style>
@font-face{font-family:"Bricolage Grotesque";src:url("${SITE}fonts/bricolage-grotesque.woff2") format("woff2");font-weight:200 800}
@font-face{font-family:"Source Sans 3";src:url("${SITE}fonts/source-sans-3-400.woff2") format("woff2");font-weight:400}
@font-face{font-family:"Source Sans 3";src:url("${SITE}fonts/source-sans-3-600.woff2") format("woff2");font-weight:600}
@media (max-width:480px){.pad{padding-left:12px!important;padding-right:12px!important}}
</style></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden">${esc(T.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}"><tr><td align="center" class="pad" style="padding:24px 16px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="background:${C.lime};border-radius:30px;padding:28px 26px 26px">
<div style="font-family:${DISPLAY};font-size:22px;font-weight:800;color:${C.ink};letter-spacing:-0.5px;margin:0 0 20px">Munich <span style="background:${C.yellow};border-radius:10px;padding:0 6px">Calendar</span></div>
<div style="font-family:${DISPLAY};font-size:36px;font-weight:800;line-height:1;color:${C.ink};letter-spacing:-1.4px;margin:0 0 12px">${esc(T.fimDeSemana(sab, dom))}</div>
<div style="font:600 17px/1.45 ${BODY};color:${C.ink}">${esc(T.oi)}</div>
</td></tr>
${corpo}
<tr><td align="center" style="padding:30px 0 8px">${botao(comUtm(siteLang), T.tudo, true)}</td></tr>
<tr><td style="padding:26px 6px 0;font:400 13px/1.5 ${BODY};color:${C.muted};text-align:center">
${esc(T.porque)}<br>
<a href="${SITE}newsletter/${arquivo}" style="color:${C.muted}">${esc(T.navegador)}</a> · <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${C.muted}">${esc(T.sair)}</a><br>
Munich Calendar · {{ENDERECO}}
</td></tr>
</table></td></tr></table>
</body></html>
`;
  return { arquivo, assunto, previa: T.previa, email };
}

// Mesmo id que o site usa nos links #ev-… (a partir do título em português)
function idDe(e) {
  return e.t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const ultima = { data: iso(hoje), edicoes: {} };
for (const lang of ["pt", "de", "en"]) {
  const r = gerar(lang);
  writeFileSync(join(PASTA, r.arquivo), r.email);
  ultima.edicoes[lang] = { assunto: r.assunto, previa: r.previa, url: SITE + "newsletter/" + r.arquivo };
  console.log(lang, "→", r.arquivo, "|", r.assunto);
}
writeFileSync(join(PASTA, "ultima.json"), JSON.stringify(ultima, null, 2) + "\n");
