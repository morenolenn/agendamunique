/* Comportamento das páginas de evento. Cada página define EV antes de carregar este arquivo:

   EV = {
     inicio: "2026-11-20", fim: "2026-12-24",
     lat, lon,
     abre: "20 de novembro",            // texto para "Ainda não abriu"
     horario: [[abre, fecha], ...],     // minutos desde a meia-noite, por dia da semana (0 = domingo)
     excecoes: { "2026-12-24": [600, 840], "2026-11-22": null }
   }

   horario pode vir vazio quando o organizador não publica horário fixo: aí o cartão
   mostra só se a temporada está em andamento, sem inventar hora. */

(function () {
  "use strict";

  function doisDigitos(n) { return (n < 10 ? "0" : "") + n; }
  function emTexto(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return m ? h + "h" + doisDigitos(m) : h + "h";
  }
  function diaISO(d) { return d.getFullYear() + "-" + doisDigitos(d.getMonth() + 1) + "-" + doisDigitos(d.getDate()); }
  function horarioDe(d) {
    var iso = diaISO(d);
    if (EV.excecoes && Object.prototype.hasOwnProperty.call(EV.excecoes, iso)) return EV.excecoes[iso];
    return EV.horario && EV.horario[d.getDay()];
  }

  // Para conferir outros dias sem esperar: ?dia=2026-12-05T18:30
  function agoraDaPagina() {
    var m = /[?&]dia=([^&]+)/.exec(location.search);
    if (!m) return new Date();
    var d = new Date(decodeURIComponent(m[1]));
    return isNaN(d) ? new Date() : d;
  }

  function diz(alvo, texto, detalhe) {
    alvo.textContent = texto;
    if (detalhe) alvo.insertAdjacentHTML("afterend", "<small>" + detalhe + "</small>");
  }

  // "Hoje": aberto agora e até que horas, ou quando abre de novo
  var alvo = document.getElementById("hoje");
  if (alvo) {
    var agora = agoraDaPagina(), iso = diaISO(agora), selo = document.getElementById("selo-estado");
    var faixa = horarioDe(agora);
    var minutos = agora.getHours() * 60 + agora.getMinutes();
    var temHorario = !!(EV.horario && EV.horario.length);

    if (iso < EV.inicio) {
      diz(alvo, "Ainda não abriu", EV.abre ? "Abre em " + EV.abre : "");
    } else if (iso > EV.fim) {
      diz(alvo, "Já terminou", "Confira o site oficial para a próxima edição");
    } else if (!temHorario) {
      diz(alvo, "Está acontecendo", "O horário de cada dia está no site oficial");
      if (selo) { selo.textContent = "Acontecendo agora"; selo.className = "selo aberto"; }
    } else if (!faixa) {
      diz(alvo, "Fechado hoje", "");
    } else if (minutos < faixa[0]) {
      diz(alvo, "Abre às " + emTexto(faixa[0]), "");
    } else if (minutos < faixa[1]) {
      var falta = faixa[1] - minutos;
      diz(alvo, "Aberto agora", "Fecha às " + emTexto(faixa[1]) + (falta <= 90 ? ", em " + falta + " minutos" : ""));
      if (selo) { selo.textContent = "Aberto agora"; selo.className = "selo aberto"; }
    } else {
      var amanha = horarioDe(new Date(agora.getTime() + 864e5));
      diz(alvo, "Fechado agora", amanha ? "Abre amanhã às " + emTexto(amanha[0]) : "");
    }

    // marca a linha da tabela que vale hoje
    var tabela = document.getElementById("tabela-horarios");
    if (tabela && iso >= EV.inicio && iso <= EV.fim) {
      var linha = tabela.querySelector('tr[data-data="' + iso + '"]') ||
        tabela.querySelector('tr[data-dia="' + agora.getDay() + '"]') ||
        tabela.querySelector('tr[data-dia="' + (agora.getDay() === 0 ? 0 : 1) + '"]');
      if (linha) linha.classList.add("destacado");
    }
  }

  // "Como chegar daqui": pede a localização só no toque e abre o trajeto de transporte público
  var btn = document.getElementById("btn-rota"), aviso = document.getElementById("aviso-local");
  if (btn) {
    var destino = EV.lat + "," + EV.lon;
    var apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && !/Chrome|Android/.test(navigator.userAgent);
    var abrir = function (origem) {
      location.href = apple
        ? "https://maps.apple.com/?daddr=" + destino + (origem ? "&saddr=" + origem : "") + "&dirflg=r"
        : "https://www.google.com/maps/dir/?api=1&destination=" + destino + (origem ? "&origin=" + origem : "") + "&travelmode=transit";
    };
    btn.addEventListener("click", function () {
      if (!navigator.geolocation) return abrir();
      btn.disabled = true;
      if (aviso) aviso.textContent = "Procurando a sua localização…";
      navigator.geolocation.getCurrentPosition(
        function (p) { abrir(p.coords.latitude.toFixed(5) + "," + p.coords.longitude.toFixed(5)); },
        function () { if (aviso) aviso.textContent = "Sem a localização, abrimos o mapa só com o destino."; abrir(); },
        { timeout: 8000, maximumAge: 300000 }
      );
    });
  }
})();
