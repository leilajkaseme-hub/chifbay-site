// funchal-local.mjs: "boat trip from Funchal" pages in the words each language searches (21 Nov 2026).
//   de/bootstour-funchal         "bootstour funchal" (Search Console, 3 months to 31 Oct 2026: 11th, with the
//                                German home page; the home and two trip pages shared the search)
//   pt/passeio-de-barco-funchal  "passeio de barco funchal" (pt-PT, formal address)
// Built by build-seo-pages.mjs, group "local": node scripts/build-seo-pages.mjs --only local --write
// Every fact comes from the trip pages: prices (booking-api/catalog.js, P below), departures (day trip 10:00 and
// 14:00; sunset 1 h 15 before sunset, scripts/lib/sunset.mjs), meeting point (Marina do Funchal, pontoon C, next
// to the statue, 15 minutes early), route distances (the tide:route block), what is included. Change a fact on the
// trip pages, change it here. Nothing here about paying or deposits: the booking pages own that.

export function localPages({ ed, opts, feat, faq, reserve, P }) {
  const de = {
    slug: "de/bootstour-funchal", lang: "de", group: "local", modified: "2026-11-21",
    title: "Bootstour Funchal: privat ab der Marina, ab 400 € | Chifbay",
    description: `Private Bootstour ab Funchal: Start an der Marina do Funchal, Steg C. Tagestour mit Baden um 10:00 oder 14:00, Sonnenuntergang am Abend. Ab ${P.sunset2} € pro Boot.`,
    heroImg: "hero", heroAlt: "Bootstour ab Funchal: das private Chifbay Boot vor der Südküste von Madeira",
    badge: "Bootstour · Marina do Funchal",
    h1: "Bootstour<br>ab <em>Funchal</em>",
    hsub: "Ihre Bootstour beginnt mitten in Funchal: an der Marina, wenige Gehminuten von der Altstadt. Das ganze Boot nur für Ihre Gruppe, bis zu 5 Gäste, zwei Skipper aus Madeira. Tagestour mit Baden oder Fahrt zum Sonnenuntergang.",
    book: "/book?lang=de", bookLabel: "Termine prüfen &amp; buchen", waLabel: "Die Skipper fragen",
    meta: [["Ab", `<span class="now" data-cb-price="sunset">€${P.sunset2}</span>`], ["Start", "Marina do Funchal"], ["Dauer", "2 bis 3 Std."], ["Gäste", "Bis zu 5"]],
    trip: {
      name: "Private Bootstour ab Funchal, Madeira",
      description: "Private Bootstour ab der Marina do Funchal, Steg C, für bis zu 5 Gäste mit zwei Skippern: Tagestour um 10:00 oder 14:00 Uhr mit Baden an der Fajã dos Padres und in Ribeira Brava, oder Fahrt zum Sonnenuntergang, 1 Std. 15 Min. vor Sonnenuntergang. Essen und Getränke, Insta360-360°-Video, Drohnenaufnahmen (wenn das Wetter es erlaubt) und Kamerafotos inklusive.",
      stops: ["Marina do Funchal, Steg C", "Câmara de Lobos", "Cabo Girão", "Fajã dos Padres", "Ribeira Brava", "Ponta do Sol"],
      touristType: ["Paare", "Familien", "Kleine Gruppen"],
      offers: [["Sonnenuntergang 2 Std., Cabo Girão", P.sunset2, "/book-sunset?v=cabo-girao&lang=de"], ["Sonnenuntergang 2,5 Std., Ribeira Brava", P.sunset25, "/book-sunset?v=ribeira-brava&lang=de"], ["Tagestour 2,5 Std., Ribeira Brava", P.day25, "/book-day?v=ribeira-brava&lang=de"], ["Tagestour 3 Std., Ponta do Sol", P.day3, "/book-day?v=ponta-do-sol&lang=de"]],
    },
    crumbs: [["Startseite", "/de/"], ["Erlebnisse", "/de/experiences"], ["Bootstour Funchal", "/de/bootstour-funchal"]],
    sbar: { aria: "Datum wählen", k: "Ab", v: `€${P.sunset2}`, live: "sunset", href: "/book?lang=de", label: "Jetzt buchen" },
    faq: {
      n: "04", label: "Gut zu wissen", h2: "Fragen zur Bootstour ab Funchal",
      items: [
        ["Wo startet die Bootstour in Funchal?", "An der Marina do Funchal, Steg C, neben der Statue, mitten in der Stadt und wenige Gehminuten von der Altstadt. Bitte seien Sie 15 Minuten vor der Abfahrt da."],
        ["Was kostet eine Bootstour ab Funchal?", `Ein fester Preis für das ganze Boot, bis zu 5 Gäste: ${P.sunset2} € für 2 Std. zum Sonnenuntergang, ${P.sunset25} € für 2,5 Std. (Sonnenuntergang oder Tagestour) und ${P.day3} € für die Tagestour mit 3 Std. Nie pro Person: zu fünft sind es 80 € pro Person für die Abendfahrt.`],
        ["Wann fahren die Boote ab?", "Die Tagestour startet um 10:00 oder 14:00 Uhr. Mit 2,5 Std. sind Sie um 12:30 oder 16:30 Uhr zurück, mit 3 Std. um 13:00 oder 17:00 Uhr. Die Fahrt zum Sonnenuntergang startet 1 Std. 15 Min. vor Sonnenuntergang, gegen 16:45 Uhr im Dezember und 20:00 Uhr im Juni. Der Buchungskalender zeigt die genaue Zeit für Ihr Datum."],
        ["Kann man bei der Bootstour baden?", "Ja, auf der Tagestour: an der Fajã dos Padres (schwimmen, vom Boot springen, Paddleboard) und ein zweites Mal vor Ribeira Brava. Am Abend ist das Wasser zu kalt, die Fahrt zum Sonnenuntergang ist eine reine Fahrt an der Küste."],
        ["Was ist inklusive?", "Essen und Getränke an Bord, auf beiden Touren. Auf jeder Fahrt außerdem ein Insta360-360°-Video, Drohnenaufnahmen von oben (wenn das Wetter es erlaubt) und hochwertige Fotos mit einer echten Kamera."],
        ["Kann ich stornieren?", "Ja, kostenlos bis 24 Stunden vor der Abfahrt."],
      ],
    },
    sections: (p, t) => [
      ed(p, { n: "01", label: "Treffpunkt", h2: "Mitten in Funchal<br>an Bord gehen", paras: [
        "Kein Transfer, kein Hafen am Stadtrand: Die Bootstour startet an der <strong>Marina do Funchal</strong>, Steg C, neben der Statue. Von der Altstadt sind es wenige Gehminuten. Ihre zwei Skipper warten am Steg, das Boot ist eine <strong>Karnic R8S von 2026</strong>, 9 Meter, mit Badeplattform und Bad an Bord.",
        "Nach dem Ablegen fahren Sie an der Uferpromenade entlang nach Westen. Funchal liegt bald hinter Ihnen, vor Ihnen die Südküste: Câmara de Lobos, die Steilküste von Cabo Girão und die Buchten, zu denen keine Straße führt.",
      ], cta: ["#options", "Die zwei Touren"], img: "g-cliffs", alt: "Das Chifbay Boot unter den Klippen von Cabo Girão, westlich von Funchal", cap: "Cabo Girão, 9 km ab der Marina" }),
      opts({ n: "02", label: "Zwei Touren", h2: "Tagsüber baden oder abends fahren",
        lead: "Gleiches Boot, gleiche Crew, gleicher Steg. Der Preis gilt für das ganze Boot.",
        cards: [
          { dur: "10:00 oder 14:00 · 2,5 oder 3 Std.", h3: "Tagestour mit Baden", turn: "Cabo Girão · Fajã dos Padres · Ribeira Brava", price: `€${P.day25}`, live: "day-trip", unit: "Ab · ganzes Boot · bis zu 5",
            li: ["Baden, Springen und Paddeln an der Fajã dos Padres", "Zweiter Badestopp vor Ribeira Brava", "Essen und Getränke an Bord", `3 Std. bis Ponta do Sol (${P.day3} €)`],
            href: "/book-day?lang=de", btn: "Tagestour buchen", more: ["hidden-coves-half-day", "Mehr zur Tagestour"] },
          { dur: "1 Std. 15 Min. vor Sonnenuntergang · 2 oder 2,5 Std.", h3: "Zum Sonnenuntergang", turn: "Câmara de Lobos · Cabo Girão · Ribeira Brava", price: `€${P.sunset2}`, live: "sunset", unit: "Ab · ganzes Boot · bis zu 5",
            li: ["Câmara de Lobos und Cabo Girão im Abendlicht", "Essen, Getränke und portugiesischer Wein inklusive", "Drohnenaufnahmen an Cabo Girão", `2,5 Std. bis Ribeira Brava (${P.sunset25} €)`],
            href: "/book-sunset?lang=de", btn: "Sonnenuntergang buchen", more: ["sunset-cruise", "Mehr zur Abendfahrt"] },
        ] }),
      feat([
        ["crew", "Zwei Skipper", "Lizenziert und aus Madeira, auf jeder Fahrt an Bord. RNAAT 305/2026."],
        ["drink", "Essen &amp; Getränke", "Auf beiden Touren im Preis inklusive. Kein Aufpreis an Bord."],
        ["drone", "Alles auf Video", "360°-Video, Drohne (wenn das Wetter es erlaubt) und Kamerafotos, danach zugeschickt."],
      ]),
      t.route,
      ed(p, { n: "03", label: "Privat statt Ausflugsschiff", h2: "Nur Ihre Gruppe<br>an Bord", flip: true, top0: true, paras: [
        "Ab Funchal fahren auch große Ausflugsschiffe, dort teilen Sie das Deck mit vielen Fremden. Bei Chifbay buchen Sie das ganze Boot für 1 bis 5 Gäste, wir mischen nie Gruppen. Sie bestimmen das Tempo: länger baden, langsamer an den Klippen, schneller auf dem Heimweg.",
        "Delfine sind ein Geschenk, wenn sie auftauchen, aber nie versprochen. Alles über das Boot, die Crew und die Preise im Vergleich: <a href=\"/de/private-boat-tour-madeira\">private Bootstour auf Madeira</a>.",
      ], img: "charter", alt: "Gäste auf dem Bug des privaten Chifbay Boots vor Funchal", cap: "Nur Ihre Gruppe an Bord" }),
      faq(de.faq),
      t.media,
      reserve(p, { img: "hero", lbl: "Marina do Funchal · Steg C", h2: "Ihre Bootstour <em>ab Funchal</em>", p: `Freie Termine prüfen und das ganze Boot in wenigen Minuten buchen. Nur Ihre Gruppe, ab ${P.sunset2} €.`, book: "/book?lang=de", bookLabel: "Termine prüfen &amp; buchen", wa: "WhatsApp an die Skipper", call: "Oder direkt anrufen" }),
    ],
  };

  const pt = {
    slug: "pt/passeio-de-barco-funchal", lang: "pt", group: "local", modified: "2026-11-21",
    title: "Passeio de Barco no Funchal: Barco Privado desde 400 € | Chifbay",
    description: `Passeio de barco no Funchal, a partir da Marina do Funchal, cais C. Passeio com banhos às 10:00 ou 14:00, ou ao pôr do sol. Barco privado desde ${P.sunset2} €.`,
    heroImg: "hero", heroAlt: "Passeio de barco no Funchal: o barco privado da Chifbay na costa sul da Madeira",
    badge: "Passeio de barco · Marina do Funchal",
    h1: "Passeio de barco<br>no <em>Funchal</em>",
    hsub: "O passeio começa no centro do Funchal, na Marina, a poucos minutos a pé da zona velha. O barco inteiro só para o seu grupo, até 5 pessoas, com dois skippers madeirenses. Passeio de dia com banhos ou ao pôr do sol.",
    book: "/book?lang=pt", bookLabel: "Ver disponibilidade &amp; reservar", waLabel: "Fale com o skipper",
    meta: [["Desde", `<span class="now" data-cb-price="sunset">€${P.sunset2}</span>`], ["Partida", "Marina do Funchal"], ["Duração", "2h a 3h"], ["Pessoas", "Até 5"]],
    trip: {
      name: "Passeio de barco privado no Funchal, Madeira",
      description: "Passeio de barco privado a partir da Marina do Funchal, cais C, para até 5 pessoas com dois skippers: passeio de dia às 10:00 ou 14:00 com banhos na Fajã dos Padres e na Ribeira Brava, ou passeio ao pôr do sol, com partida 1 h 15 antes do pôr do sol. Comida e bebidas, vídeo 360° Insta360, imagens de drone (se o tempo permitir) e fotos de câmara incluídos.",
      stops: ["Marina do Funchal, cais C", "Câmara de Lobos", "Cabo Girão", "Fajã dos Padres", "Ribeira Brava", "Ponta do Sol"],
      touristType: ["Casais", "Famílias", "Pequenos grupos"],
      offers: [["Pôr do sol 2h, Cabo Girão", P.sunset2, "/book-sunset?v=cabo-girao&lang=pt"], ["Pôr do sol 2h30, Ribeira Brava", P.sunset25, "/book-sunset?v=ribeira-brava&lang=pt"], ["Passeio de dia 2h30, Ribeira Brava", P.day25, "/book-day?v=ribeira-brava&lang=pt"], ["Passeio de dia 3h, Ponta do Sol", P.day3, "/book-day?v=ponta-do-sol&lang=pt"]],
    },
    crumbs: [["Início", "/pt/"], ["Experiências", "/pt/experiences"], ["Passeio de barco no Funchal", "/pt/passeio-de-barco-funchal"]],
    sbar: { aria: "Escolher uma data", k: "Desde", v: `€${P.sunset2}`, live: "sunset", href: "/book?lang=pt", label: "Reservar" },
    faq: {
      n: "04", label: "Bom saber", h2: "Perguntas sobre o passeio de barco no Funchal",
      items: [
        ["De onde parte o passeio de barco no Funchal?", "Da Marina do Funchal, cais C, junto à estátua, no centro da cidade e a poucos minutos a pé da zona velha. Chegue 15 minutos antes da partida."],
        ["Quanto custa um passeio de barco no Funchal?", `Um preço fixo pelo barco inteiro, até 5 pessoas: ${P.sunset2} € pelas 2h ao pôr do sol, ${P.sunset25} € pelas 2h30 (pôr do sol ou passeio de dia) e ${P.day3} € pelo passeio de dia de 3h. Nunca por pessoa: com cinco a bordo, o pôr do sol fica a 80 € por pessoa.`],
        ["A que horas partem os passeios?", "O passeio de dia parte às 10:00 ou às 14:00. Com 2h30 regressa às 12:30 ou às 16:30, com 3h às 13:00 ou às 17:00. O passeio ao pôr do sol parte 1 h 15 antes do pôr do sol, por volta das 16:45 em dezembro e das 20:00 em junho. O calendário de reservas mostra a hora exata da sua data."],
        ["Pode-se tomar banho durante o passeio?", "Sim, no passeio de dia: na Fajã dos Padres (nadar, saltar do barco, paddle) e uma segunda vez na Ribeira Brava. Ao fim do dia a água está demasiado fria, por isso o passeio ao pôr do sol é só de navegação."],
        ["O que está incluído?", "Bebidas e comida a bordo, nos dois passeios. Em todos os passeios também um vídeo 360° Insta360, imagens de drone vistas de cima (se o tempo permitir) e fotos de qualidade tiradas com uma câmara a sério."],
        ["Posso cancelar?", "Sim, sem custos até 24 horas antes da partida."],
      ],
    },
    sections: (p, t) => [
      ed(p, { n: "01", label: "Ponto de encontro", h2: "Embarque no centro<br>do Funchal", paras: [
        "Sem transfer nem porto fora da cidade: o passeio parte da <strong>Marina do Funchal</strong>, cais C, junto à estátua, a poucos minutos a pé da zona velha. Os dois skippers esperam no cais. O barco é um <strong>Karnic R8S de 2026</strong>, com 9 metros, plataforma de banho e casa de banho a bordo.",
        "Depois de largar, seguimos pela marginal para oeste. O Funchal fica para trás e à frente está a costa sul: Câmara de Lobos, a falésia do Cabo Girão e as baías onde não chega nenhuma estrada.",
      ], cta: ["#options", "Os dois passeios"], img: "g-cliffs", alt: "O barco da Chifbay sob a falésia do Cabo Girão, a oeste do Funchal", cap: "Cabo Girão, a 9 km da Marina" }),
      opts({ n: "02", label: "Dois passeios", h2: "Banhos de dia ou o pôr do sol",
        lead: "O mesmo barco, a mesma tripulação, o mesmo cais. O preço é pelo barco inteiro.",
        cards: [
          { dur: "10:00 ou 14:00 · 2h30 ou 3h", h3: "Passeio com banhos", turn: "Cabo Girão · Fajã dos Padres · Ribeira Brava", price: `€${P.day25}`, live: "day-trip", unit: "Desde · barco inteiro · até 5",
            li: ["Nadar, saltar e fazer paddle na Fajã dos Padres", "Segunda paragem para banhos na Ribeira Brava", "Bebidas e comida a bordo", `3h até à Ponta do Sol (${P.day3} €)`],
            href: "/book-day?lang=pt", btn: "Reservar o passeio de dia", more: ["hidden-coves-half-day", "Saber mais sobre o passeio de dia"] },
          { dur: "1 h 15 antes do pôr do sol · 2h ou 2h30", h3: "Ao pôr do sol", turn: "Câmara de Lobos · Cabo Girão · Ribeira Brava", price: `€${P.sunset2}`, live: "sunset", unit: "Desde · barco inteiro · até 5",
            li: ["Câmara de Lobos e o Cabo Girão com a luz do fim do dia", "Comida, bebidas e vinho português incluídos", "Imagens de drone no Cabo Girão", `2h30 até à Ribeira Brava (${P.sunset25} €)`],
            href: "/book-sunset?lang=pt", btn: "Reservar o pôr do sol", more: ["sunset-cruise", "Saber mais sobre o pôr do sol"] },
        ] }),
      feat([
        ["crew", "Dois skippers", "Licenciados e madeirenses, a bordo em todos os passeios. RNAAT 305/2026."],
        ["drink", "Comida e bebidas", "Incluídas nos dois passeios. Nada a pagar a mais a bordo."],
        ["drone", "Tudo em imagens", "Vídeo 360°, drone (se o tempo permitir) e fotos de câmara, enviados depois."],
      ]),
      t.route,
      ed(p, { n: "03", label: "Barco privado", h2: "Só o seu grupo<br>a bordo", flip: true, top0: true, paras: [
        "Do Funchal também partem barcos grandes, onde se divide o convés com muitos desconhecidos. Com a Chifbay reserva o barco inteiro, de 1 a 5 pessoas, e nunca juntamos grupos. O ritmo é o seu: mais tempo na água, mais devagar junto às falésias, mais depressa no regresso.",
        "Os golfinhos são uma surpresa quando aparecem, nunca uma promessa. Para comparar com os outros passeios da ilha, veja o nosso guia de <a href=\"/pt/best-boat-trips-madeira\">passeios de barco na Madeira</a>.",
      ], img: "charter", alt: "Pessoas na proa do barco privado da Chifbay em frente ao Funchal", cap: "Só o seu grupo a bordo" }),
      faq(pt.faq),
      t.media,
      reserve(p, { img: "hero", lbl: "Marina do Funchal · Cais C", h2: "O seu passeio <em>no Funchal</em>", p: `Veja as datas livres e reserve o barco inteiro em poucos minutos. Só o seu grupo, desde ${P.sunset2} €.`, book: "/book?lang=pt", bookLabel: "Ver disponibilidade &amp; reservar", wa: "WhatsApp aos skippers", call: "Ou ligue diretamente" }),
    ],
  };
  return [de, pt];
}
