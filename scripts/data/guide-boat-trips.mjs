// guide-boat-trips.mjs: "boat trips in Madeira" in the five other site languages, written for each language's
// readers, not translated (Theo, 17 and 18 Oct 2026). Same facts as the English guide in build-seo-pages.mjs
// (best-boat-trips-madeira): the GetYourGuide count of 11 Aug 2026, operator facts read on 4 and 18 Oct 2026.
// Change a fact there, change it here in all five. Built by build-seo-pages.mjs (group "guide").

export const GUIDE_SLUG = "best-boat-trips-madeira";
export const GUIDE_ALTS = ["en", "fr", "de", "pt", "es", "it"].map((l) => [l, l === "en" ? GUIDE_SLUG : `${l}/${GUIDE_SLUG}`]);

// operator rows, per language: [name, kind, price (date), good to know]
function rows(P, t) {
  return [
    ["Chifbay", t.chif[0], `${t.eur(P.sunset2)} ${t.to} ${t.eur(P.day3)} ${t.perBoat}, ${t.upTo5} (18/10/2026)`, t.chif[1]],
    ["Cristal Sea Madeira", t.cristal[0], t.cristal[1], t.cristal[2]],
    ["Ventura do Mar", t.ventura[0], t.seeSite, t.ventura[1]],
    ["VMT Madeira", t.vmt[0], t.vmt[1], t.vmt[2]],
    ["Lobosonda", t.lobo[0], t.lobo[1], t.lobo[2]],
    ["Bonita da Madeira", t.bonita[0], t.seeSite, t.bonita[1]],
    ["Magic Dolphin", t.magic[0], t.magic[1], t.magic[2]],
    ["VipDolphins", t.vip[0], t.vip[1], t.vip[2]],
    ["On Tales", t.tales[0], t.tales[1], t.tales[2]],
  ];
}

const T = {};

T.pt = {
  eur: (n) => `${n} €`, to: "a", perBoat: "por barco", upTo5: "até 5 pessoas", seeSite: "Ver o site",
  title: "Passeios de Barco na Madeira: os Melhores em 2026 | Chifbay",
  description: "Passeios de barco na Madeira comparados: barco privado, catamarã partilhado, observação de golfinhos e veleiro, com preços e operadores reais.",
  heroAlt: "Um barco privado na costa sul da Madeira ao fim do dia",
  badge: "Guia · atualizado a 18 de outubro de 2026",
  h1: "Passeios de barco<br>na <em>Madeira</em> (2026)", h1Plain: "Passeios de barco na Madeira (2026): os melhores comparados, com preços",
  hsub: "Há quatro tipos de passeio de barco na Madeira: catamarã partilhado (cerca de 40 a 79 € por pessoa), observação de baleias e golfinhos (cerca de 45 a 67 €), veleiro e barco privado (mediana de 537 € pelo barco inteiro). A maioria sai da Marina do Funchal. Escrito pela Chifbay, uma empresa de barco privado no Funchal: dizemos onde encaixamos e quando outro passeio é melhor escolha.",
  bookLabel: "Ver a comparação", waLabel: "Fazer uma pergunta",
  meta: [["Passeio partilhado", "59 € por pessoa*"], ["Barco privado", "537 € por barco*"], ["Operadores", "9 comparados"], ["Preços lidos", "out. 2026"]],
  crumbs: [["Início", "/pt/"], ["Experiências", "/pt/experiences"], ["Passeios de barco na Madeira", "/pt/best-boat-trips-madeira"]],
  sbar: { aria: "Passeios de barco privados", k: "Barco privado", label: "Reservar" },
  kinds: ["Quatro tipos de passeio", "Que passeio de barco é para si?", "Na Madeira vendem-se quatro tipos de passeio de barco, lado a lado, nas mesmas páginas de reserva. A primeira coisa a ver é a unidade do preço: um passeio partilhado paga-se por pessoa, um barco privado paga-se pelo barco inteiro.",
    [["Por pessoa · mediana 59 €, a maioria 40 a 79 €", "Catamarã ou barco partilhado", "Um barco grande com percurso e horário fixos, muitas vezes com dezenas de pessoas. A forma mais barata de ir ao mar, boa para uma ou duas pessoas com orçamento curto."],
     ["Por pessoa · cerca de 45 a 67 €", "Observação de baleias e golfinhos", "Passeios pensados para encontrar os animais, em catamarã, barco tradicional ou semirrígido. Escolha este se os animais são a razão do passeio."],
     ["Por pessoa ou por barco", "Veleiro", "Mais lento e mais calmo, à vela quando há vento. Existem saídas partilhadas e veleiros privados; ao pôr do sol, os privados começam por volta dos 500 € por barco."],
     ["Por barco · mediana 537 €", "Barco privado", "O barco inteiro para o seu grupo, com skipper. Escolhe o ritmo, fica mais tempo a nadar e não há mais ninguém a bordo. Os preços vão de cerca de 150 € a 3500 € por barco."]],
    "* Contagem nossa de 58 anúncios de passeios de barco na Madeira no GetYourGuide, a 11 de agosto de 2026: mediana partilhada 59 € por pessoa (34 anúncios); mediana privada 537 € por barco (24 anúncios)."],
  ops: ["Operadores comparados", "Nove operadores, lado a lado", "<strong>Este guia é escrito pela Chifbay, um dos nove operadores abaixo</strong>, por isso aparecemos primeiro. Os dados foram lidos nos sites dos operadores, no GetYourGuide ou no Viator, na data indicada em cada linha. Estes sites mostram preços em dólares a visitantes dos EUA. Não pusemos as estrelas: as contagens mudam todas as semanas.",
    ["Operador", "Tipo de passeio", "Preço (data)", "Bom saber"], "Os preços mudam. Confirme com o operador antes de reservar. Se gere uma destas empresas e um dado estiver desatualizado, escreva para hello@chifbay.com e corrigimos."],
  chif: ["Barco privado a motor, Funchal", "Karnic R8S de 2026, dois skippers, comida e bebidas, banho no passeio de dia, vídeo 360°, drone e fotos incluídos"],
  cristal: ["Barcos privados, Funchal", "Barco privado 2 h 30 desde 320 €; pôr do sol privado 2 h 30 desde 340 €; barcos maiores desde 500 € (4/10/2026)", "Até 10 a 12 pessoas; paddle e snorkel incluídos; reserva no próprio site"],
  ventura: ["Passeios partilhados, Funchal", "Em atividade desde 2001; reserva online"],
  vmt: ["Catamarã partilhado, Funchal", "Baleias e golfinhos 3 h cerca de 45 a 48 US$ por pessoa; pôr do sol 45 US$; Desertas 101 US$ (GetYourGuide, 4/10/2026)", "Reserva online; site em português e inglês"],
  lobo: ["Baleias e golfinhos, Calheta", "Barco tradicional desde 51,83 € por pessoa; semirrígido 2 h desde 66,63 € (4/10/2026)", "Desde 2003; fica na Calheta, não no Funchal"],
  bonita: ["Passeios partilhados, Funchal", "Indicado pelo turismo entre os operadores de barco do Funchal"],
  magic: ["Catamarã partilhado, Funchal", "Desde 35 € por pessoa no próprio site (18/10/2026)", "Baleias e golfinhos; novo passeio por 10 € se não houver avistamento"],
  vip: ["Partilhado premium e fretamento privado, Funchal", "Partilhado 89 € por adulto; privado 3 h desde 950 € (18/10/2026)", "Máximo 17 pessoas no partilhado, biólogo marinho e bar aberto"],
  tales: ["Barco privado até 5 pessoas, Calheta", "Cerca de 535 € por barco (18/10/2026)", "Sai da Calheta, não do Funchal; transfer do hotel anunciado como incluído"],
  who: ["Para quem é cada um", "Escolha por quem vai", [
    "<strong>Uma ou duas pessoas com orçamento curto:</strong> catamarã partilhado ou observação de cetáceos partilhada.",
    "<strong>Veio pelas baleias e golfinhos:</strong> um operador especializado como a VMT Madeira, a Lobosonda ou a Magic Dolphin.",
    "<strong>Um casal a celebrar, ou um pedido de casamento:</strong> um passeio privado ao pôr do sol, sem mais ninguém a bordo.",
    "<strong>Família ou grupo de 4 ou 5 que quer nadar:</strong> um passeio privado de dia. O barco espera enquanto nadam, e o preço por pessoa desce depressa com o barco cheio.",
    "<strong>Grupo maior, de 6 a 12 pessoas:</strong> um operador privado com barco maior, como a Cristal Sea Madeira. A Chifbay leva no máximo 5 pessoas."]],
  where: ["De onde saem", "De onde partem os passeios de barco na Madeira", [
    "A maioria dos passeios de barco na Madeira sai da <strong>Marina do Funchal</strong>, na marginal, no centro da cidade: Chifbay, Cristal Sea, VMT Madeira, Magic Dolphin e VipDolphins partem daí. Alguns operadores trabalham a partir do oeste da costa sul, como a Lobosonda e a On Tales na <strong>Calheta</strong>.",
    "A partir do Funchal, o percurso clássico vai para oeste: o <strong>Cabo Girão</strong>, uma das falésias mais altas da Europa, com cerca de 580 metros, a <strong>Fajã dos Padres</strong>, onde não chega estrada, e Câmara de Lobos, Ribeira Brava e Ponta do Sol. Os passeios de cetáceos vão mais para o largo, onde estiverem os animais nesse dia."]],
  why: ["Porquê um barco privado", "Quando vale a pena um barco privado", (P) => [
    "Um barco privado custa mais do que um lugar partilhado. O que se compra é controlo: escolhe quando parar, quanto tempo nadar, ir depressa ou devagar, e não há mais ninguém a bordo.",
    `Na Chifbay o barco inteiro custa ${P.sunset2} € no <a href="/pt/sunset-cruise">passeio ao pôr do sol</a> de 2 h e ${P.day25} € ou ${P.day3} € no <a href="/pt/hidden-coves-half-day">passeio de dia</a>, até 5 pessoas, com dois skippers, comida e bebidas, vídeo 360°, imagens de drone e fotos incluídos. Cancelamento gratuito até 24 horas antes.`]],
  faq: ["Perguntas", "Passeios de barco na Madeira: perguntas", (P) => [
    ["Qual é o melhor passeio de barco na Madeira?", "Depende de quem vai. Para baleias e golfinhos, um operador especializado. Para o preço mais baixo por pessoa, um catamarã partilhado. Para um casal, uma família ou um grupo pequeno que quer nadar e ter o barco só para si, um barco privado. Para vento e silêncio, um veleiro."],
    ["Quanto custa um passeio de barco na Madeira?", `Na nossa contagem de 11 de agosto de 2026 no GetYourGuide, a mediana dos passeios partilhados era 59 € por pessoa e a dos barcos privados 537 € pelo barco inteiro. Na Chifbay, o barco inteiro custa de ${P.sunset2} € a ${P.day3} €, até 5 pessoas.`],
    ["Os golfinhos e as baleias são garantidos?", "Nenhum passeio pode prometer animais selvagens. Os operadores especializados vão à procura deles. Num passeio privado pela costa, como o nosso, os golfinhos são um presente quando aparecem, nunca uma promessa."],
    ["De onde saem os passeios de barco na Madeira?", "A maioria sai da Marina do Funchal, no centro da cidade. Alguns operadores saem da Calheta, a oeste, como a Lobosonda e a On Tales."],
    ["Há passeios de barco para quem chega de cruzeiro?", "Sim. A Marina do Funchal fica no centro, na mesma marginal do porto de cruzeiros, por isso um passeio de 2 ou 3 horas cabe na maioria das escalas. Escolha um passeio que acabe com folga antes da hora de embarque."],
  ]],
  reserve: { lbl: "Chifbay · Marina do Funchal", h2: "Quer o barco <em>só para si?</em>", p: (P) => `Passeios de barco privados a partir do Funchal, até 5 pessoas, desde ${P.sunset2} € pelo barco inteiro.`, bookLabel: "Ver datas e reservar", wa: "WhatsApp aos skippers", call: "Ou ligue diretamente" },
  book: "/book?lang=pt",
};

T.de = {
  eur: (n) => `${n} €`, to: "bis", perBoat: "pro Boot", upTo5: "bis 5 Gäste", seeSite: "Siehe Website",
  title: "Bootstour Madeira: die besten Bootstouren 2026 | Chifbay",
  description: "Bootstouren auf Madeira im Vergleich: Privatboot, Katamaran, Wal und Delfin Beobachtung und Segeln, mit Preisen, Abfahrtsorten und echten Anbietern.",
  heroAlt: "Ein Privatboot vor der Südküste Madeiras am Abend",
  badge: "Ratgeber · aktualisiert am 18. Oktober 2026",
  h1: "Bootstouren<br>auf <em>Madeira</em> (2026)", h1Plain: "Bootstouren auf Madeira (2026): die besten im Vergleich, mit Preisen",
  hsub: "Auf Madeira gibt es vier Arten von Bootstouren: geteilte Katamarane (etwa 40 bis 79 € pro Person), Wal und Delfin Beobachtung (etwa 45 bis 67 €), Segeltörns und Privatboote (Median 537 € für das ganze Boot). Die meisten starten in der Marina do Funchal. Geschrieben von Chifbay, einem Privatboot Anbieter in Funchal: Wir sagen, wo wir passen und wann eine andere Tour die bessere Wahl ist.",
  bookLabel: "Zum Vergleich", waLabel: "Frage stellen",
  meta: [["Geteilte Tour", "59 € pro Person*"], ["Privatboot", "537 € pro Boot*"], ["Anbieter", "9 im Vergleich"], ["Preise gelesen", "Okt. 2026"]],
  crumbs: [["Startseite", "/de/"], ["Erlebnisse", "/de/experiences"], ["Bootstouren auf Madeira", "/de/best-boat-trips-madeira"]],
  sbar: { aria: "Private Bootstouren", k: "Privatboot", label: "Buchen" },
  kinds: ["Vier Arten von Touren", "Welche Bootstour passt zu Ihnen?", "Auf Madeira werden vier Arten von Bootstouren nebeneinander auf denselben Buchungsseiten verkauft. Prüfen Sie zuerst die Preiseinheit: Eine geteilte Tour kostet pro Person, ein Privatboot kostet pro Boot.",
    [["Pro Person · Median 59 €, meist 40 bis 79 €", "Geteilter Katamaran oder geteiltes Boot", "Ein großes Boot mit fester Route und festem Fahrplan, oft mit Dutzenden anderen Gästen. Der günstigste Weg aufs Wasser, gut für ein oder zwei Personen mit kleinem Budget."],
     ["Pro Person · etwa 45 bis 67 €", "Wal und Delfin Beobachtung", "Touren, die darauf ausgelegt sind, die Tiere zu finden, mit Katamaran, traditionellem Boot oder Schlauchboot. Die richtige Wahl, wenn die Tiere der Grund der Reise sind."],
     ["Pro Person oder pro Boot", "Segeln", "Langsamer und ruhiger, unter Segeln, wenn der Wind passt. Es gibt geteilte Segeltörns und private Segelboote; private Törns zum Sonnenuntergang beginnen bei etwa 500 € pro Boot."],
     ["Pro Boot · Median 537 €", "Privatboot", "Das ganze Boot für Ihre Gruppe, mit Skipper. Sie bestimmen das Tempo, bleiben länger zum Baden, und niemand sonst ist an Bord. Die Preise reichen von etwa 150 € bis 3.500 € pro Boot."]],
    "* Unsere eigene Zählung von 58 Bootstouren auf Madeira bei GetYourGuide am 11. August 2026: geteilte Touren im Median 59 € pro Person (34 Angebote), Privatboote im Median 537 € pro Boot (24 Angebote)."],
  ops: ["Anbieter im Vergleich", "Neun Anbieter nebeneinander", "<strong>Dieser Ratgeber stammt von Chifbay, einem der neun Anbieter unten</strong>, deshalb stehen wir zuerst. Die Angaben stammen von den Websites der Anbieter, von GetYourGuide oder Viator, zum Datum in jeder Zeile. Diese Seiten zeigen US Besuchern Dollarpreise. Sterne lassen wir weg: Die Zahlen ändern sich jede Woche.",
    ["Anbieter", "Art der Tour", "Preis (Datum)", "Gut zu wissen"], "Preise ändern sich. Prüfen Sie vor der Buchung beim Anbieter. Sie betreiben eines dieser Unternehmen und eine Angabe ist veraltet? Schreiben Sie an hello@chifbay.com, wir korrigieren sie."],
  chif: ["Privates Motorboot, Funchal", "Karnic R8S von 2026, zwei Skipper, Essen und Getränke, Badestopp auf der Tagestour, 360°-Video, Drohne und Kamerafotos inklusive"],
  cristal: ["Privatboote, Funchal", "Privatboot 2,5 Std. ab 320 €; privater Sonnenuntergang 2,5 Std. ab 340 €; größere Boote ab 500 € (4.10.2026)", "Bis 10 bis 12 Gäste; Paddleboard und Schnorchel inklusive; Buchung auf der eigenen Website"],
  ventura: ["Geteilte Touren, Funchal", "Seit 2001 aktiv; Buchung online"],
  vmt: ["Geteilter Katamaran, Funchal", "Wale und Delfine 3 Std. etwa 45 bis 48 US$ pro Person; Sonnenuntergang 45 US$; Desertas 101 US$ (GetYourGuide, 4.10.2026)", "Buchung online; Website auf Portugiesisch und Englisch"],
  lobo: ["Wal und Delfin Beobachtung, Calheta", "Traditionelles Boot ab 51,83 € pro Person; Schlauchboot 2 Std. ab 66,63 € (4.10.2026)", "Seit 2003; Website auch auf Deutsch; Sitz in Calheta, nicht in Funchal"],
  bonita: ["Geteilte Touren, Funchal", "Vom Tourismusamt unter den Bootsanbietern in Funchal gelistet"],
  magic: ["Geteilter Katamaran, Funchal", "Ab 35 € pro Person auf der eigenen Buchungsseite (18.10.2026)", "Wale und Delfine; neue Fahrt für 10 €, wenn keine Tiere gesichtet werden"],
  vip: ["Premium geteilt und privat, Funchal", "Geteilt 89 € pro Erwachsenem; privat 3 Std. ab 950 € (18.10.2026)", "Höchstens 17 Gäste auf der geteilten Tour, Meeresbiologe und offene Bar"],
  tales: ["Privatboot bis 5 Gäste, Calheta", "Etwa 535 € pro Boot (18.10.2026)", "Startet in Calheta, nicht in Funchal; Hoteltransfer als inklusive angegeben"],
  who: ["Für wen", "Wählen Sie nach Ihrer Gruppe", [
    "<strong>Eine oder zwei Personen mit kleinem Budget:</strong> ein geteilter Katamaran oder eine geteilte Walbeobachtung.",
    "<strong>Sie kommen wegen Walen und Delfinen:</strong> ein spezialisierter Anbieter wie VMT Madeira, Lobosonda oder Magic Dolphin.",
    "<strong>Ein Paar mit Anlass oder ein Heiratsantrag:</strong> eine private Tour zum Sonnenuntergang, niemand sonst an Bord.",
    "<strong>Familie oder Gruppe von 4 oder 5, die baden will:</strong> eine private Tagestour. Das Boot wartet beim Baden, und der Preis pro Person sinkt mit vollem Boot schnell.",
    "<strong>Größere Gruppe von 6 bis 12 Personen:</strong> ein privater Anbieter mit größerem Boot, etwa Cristal Sea Madeira. Chifbay nimmt höchstens 5 Gäste."]],
  where: ["Abfahrtsorte", "Wo Bootstouren auf Madeira starten", [
    "Die meisten Bootstouren auf Madeira starten in der <strong>Marina do Funchal</strong>, an der Uferpromenade im Stadtzentrum: Chifbay, Cristal Sea, VMT Madeira, Magic Dolphin und VipDolphins legen dort ab. Einige Anbieter arbeiten im Westen der Südküste, etwa Lobosonda und On Tales in <strong>Calheta</strong>.",
    "Von Funchal aus führt die klassische Route nach Westen: zum <strong>Cabo Girão</strong>, mit rund 580 Metern einer der höchsten Klippen Europas, zur Bucht <strong>Fajã dos Padres</strong>, die keine Straße erreicht, und zu Câmara de Lobos, Ribeira Brava und Ponta do Sol. Walbeobachtungen fahren weiter aufs Meer hinaus, dorthin, wo die Tiere an diesem Tag sind."]],
  why: ["Warum ein Privatboot", "Wann sich ein Privatboot lohnt", (P) => [
    "Ein Privatboot kostet mehr als ein Platz auf einer geteilten Tour. Sie kaufen Freiheit: wann Sie anhalten, wie lange Sie baden, ob schnell oder langsam, und niemand sonst ist an Bord.",
    `Bei Chifbay kostet das ganze Boot ${P.sunset2} € für die zweistündige <a href="/de/sunset-cruise">Tour zum Sonnenuntergang</a> und ${P.day25} € oder ${P.day3} € für die <a href="/de/hidden-coves-half-day">Tagestour</a>, für bis zu 5 Gäste, mit zwei Skippern, Essen und Getränken, 360°-Video, Drohnenaufnahmen und Kamerafotos. Kostenlose Stornierung bis 24 Stunden vorher. Mehr auf unserer Seite zur <a href="/de/private-boat-tour-madeira">privaten Bootstour</a>.`]],
  faq: ["Fragen", "Bootstouren auf Madeira: Fragen", (P) => [
    ["Welche ist die beste Bootstour auf Madeira?", "Das hängt von der Gruppe ab. Für Wale und Delfine ein spezialisierter Anbieter. Für den niedrigsten Preis pro Person ein geteilter Katamaran. Für ein Paar, eine Familie oder eine kleine Gruppe, die baden und das Boot für sich haben möchte, ein Privatboot. Für Wind und Ruhe ein Segeltörn."],
    ["Was kostet eine Bootstour auf Madeira?", `Bei unserer Zählung auf GetYourGuide am 11. August 2026 lag der Median geteilter Touren bei 59 € pro Person und der von Privatbooten bei 537 € für das ganze Boot. Bei Chifbay kostet das ganze Boot ${P.sunset2} € bis ${P.day3} €, für bis zu 5 Gäste.`],
    ["Sind Delfine und Wale garantiert?", "Keine Tour kann wilde Tiere versprechen. Spezialisierte Anbieter fahren gezielt hinaus, um sie zu suchen. Auf einer privaten Küstentour wie unserer sind Delfine ein Geschenk, wenn sie auftauchen, nie ein Versprechen."],
    ["Wo starten die Bootstouren auf Madeira?", "Die meisten in der Marina do Funchal im Stadtzentrum. Einige Anbieter starten in Calheta im Westen, etwa Lobosonda und On Tales."],
    ["Gibt es Bootstouren für Kreuzfahrtgäste?", "Ja. Die Marina do Funchal liegt im Zentrum, an derselben Uferpromenade wie der Kreuzfahrthafen, daher passt eine Tour von 2 oder 3 Stunden in die meisten Liegezeiten. Wählen Sie eine Tour, die mit genug Puffer vor der letzten Einschiffung endet."],
  ]],
  reserve: { lbl: "Chifbay · Marina do Funchal", h2: "Das Boot <em>für sich allein?</em>", p: (P) => `Private Bootstouren ab Funchal für bis zu 5 Gäste, ab ${P.sunset2} € für das ganze Boot.`, bookLabel: "Termine prüfen &amp; buchen", wa: "WhatsApp an die Skipper", call: "Oder direkt anrufen" },
  book: "/book?lang=de",
};

T.fr = {
  eur: (n) => `${n} €`, to: "à", perBoat: "par bateau", upTo5: "jusqu'à 5 personnes", seeSite: "Voir leur site",
  title: "Excursion en bateau à Madère : comparatif 2026 | Chifbay",
  description: "Excursions en bateau à Madère comparées : bateau privé, catamaran partagé, observation des dauphins et voilier, avec les prix et les vrais opérateurs.",
  heroAlt: "Un bateau privé au large de la côte sud de Madère en fin de journée",
  badge: "Guide · mis à jour le 18 octobre 2026",
  h1: "Excursions en bateau<br>à <em>Madère</em> (2026)", h1Plain: "Excursions en bateau à Madère (2026) : comparatif des meilleures sorties, avec les prix",
  hsub: "À Madère, il existe quatre sortes d'excursion en bateau : le catamaran partagé (environ 40 à 79 € par personne), l'observation des baleines et des dauphins (environ 45 à 67 €), la voile et le bateau privé (médiane de 537 € pour tout le bateau). La plupart partent de la Marina do Funchal. Écrit par Chifbay, une entreprise de bateau privé à Funchal : nous disons où nous nous situons et quand une autre sortie vous conviendra mieux.",
  bookLabel: "Voir le comparatif", waLabel: "Poser une question",
  meta: [["Sortie partagée", "59 € par personne*"], ["Bateau privé", "537 € par bateau*"], ["Opérateurs", "9 comparés"], ["Prix relevés", "oct. 2026"]],
  crumbs: [["Accueil", "/fr/"], ["Expériences", "/fr/experiences"], ["Excursions en bateau à Madère", "/fr/best-boat-trips-madeira"]],
  sbar: { aria: "Sorties en bateau privé", k: "Bateau privé", label: "Réserver" },
  kinds: ["Quatre sortes de sortie", "Quelle excursion en bateau vous convient ?", "À Madère, quatre sortes d'excursion en bateau sont vendues côte à côte sur les mêmes sites de réservation. Regardez d'abord l'unité du prix : une sortie partagée se paie par personne, un bateau privé se paie pour tout le bateau.",
    [["Par personne · médiane 59 €, le plus souvent 40 à 79 €", "Catamaran ou bateau partagé", "Un grand bateau, un parcours et des horaires fixes, souvent avec des dizaines d'autres passagers. La façon la moins chère d'aller en mer, idéale à une ou deux personnes avec un petit budget."],
     ["Par personne · environ 45 à 67 €", "Observation des baleines et des dauphins", "Des sorties pensées pour trouver les animaux, en catamaran, en bateau traditionnel ou en semi-rigide. Le bon choix si les animaux sont la raison du voyage."],
     ["Par personne ou par bateau", "Voile", "Plus lent et plus calme, à la voile quand le vent le permet. Il existe des sorties partagées et des voiliers privés ; au coucher du soleil, les voiliers privés commencent vers 500 € par bateau."],
     ["Par bateau · médiane 537 €", "Bateau privé", "Tout le bateau pour votre groupe, avec un skipper. Vous choisissez le rythme, restez plus longtemps dans l'eau, et personne d'autre n'est à bord. Les prix vont d'environ 150 € à 3 500 € par bateau."]],
    "* Notre propre décompte de 58 annonces d'excursions en bateau à Madère sur GetYourGuide, le 11 août 2026 : médiane partagée 59 € par personne (34 annonces) ; médiane privée 537 € par bateau (24 annonces)."],
  ops: ["Opérateurs comparés", "Neuf opérateurs, côte à côte", "<strong>Ce guide est écrit par Chifbay, l'un des neuf opérateurs ci-dessous</strong>, c'est pourquoi nous apparaissons en premier. Les informations viennent des sites des opérateurs, de GetYourGuide ou de Viator, à la date indiquée sur chaque ligne. Ces sites affichent des prix en dollars aux visiteurs américains. Nous n'avons pas mis les étoiles : leur nombre change chaque semaine.",
    ["Opérateur", "Type de sortie", "Prix (date)", "Bon à savoir"], "Les prix changent. Vérifiez auprès de l'opérateur avant de réserver. Vous dirigez l'une de ces entreprises et une information est dépassée ? Écrivez à hello@chifbay.com, nous la corrigerons."],
  chif: ["Bateau privé à moteur, Funchal", "Karnic R8S de 2026, deux skippers, repas et boissons, baignade sur la sortie de jour, vidéo 360°, drone et photos à l'appareil inclus"],
  cristal: ["Bateaux privés, Funchal", "Bateau privé 2 h 30 dès 320 € ; coucher de soleil privé 2 h 30 dès 340 € ; plus grands bateaux dès 500 € (4/10/2026)", "Jusqu'à 10 à 12 personnes ; paddle et masque inclus ; réservation sur leur site"],
  ventura: ["Sorties partagées, Funchal", "En activité depuis 2001 ; réservation en ligne"],
  vmt: ["Catamaran partagé, Funchal", "Baleines et dauphins 3 h environ 45 à 48 US$ par personne ; coucher de soleil 45 US$ ; Desertas 101 US$ (GetYourGuide, 4/10/2026)", "Réservation en ligne ; site en portugais et en anglais"],
  lobo: ["Baleines et dauphins, Calheta", "Bateau traditionnel dès 51,83 € par personne ; semi-rigide 2 h dès 66,63 € (4/10/2026)", "Depuis 2003 ; basé à Calheta, pas à Funchal"],
  bonita: ["Sorties partagées, Funchal", "Cité par l'office du tourisme parmi les opérateurs de Funchal"],
  magic: ["Catamaran partagé, Funchal", "Dès 35 € par personne sur leur site (18/10/2026)", "Baleines et dauphins ; nouvelle sortie à 10 € si aucun animal n'est vu"],
  vip: ["Partagé haut de gamme et privatisation, Funchal", "Partagé 89 € par adulte ; privé 3 h dès 950 € (18/10/2026)", "17 personnes maximum sur la sortie partagée, biologiste marin et bar ouvert"],
  tales: ["Bateau privé jusqu'à 5 personnes, Calheta", "Environ 535 € par bateau (18/10/2026)", "Part de Calheta, pas de Funchal ; transfert depuis l'hôtel annoncé comme inclus"],
  who: ["Pour qui", "Choisissez selon votre groupe", [
    "<strong>Une ou deux personnes avec un petit budget :</strong> un catamaran partagé ou une observation des cétacés partagée.",
    "<strong>Vous venez pour les baleines et les dauphins :</strong> un spécialiste comme VMT Madeira, Lobosonda ou Magic Dolphin.",
    "<strong>Un couple qui fête quelque chose, ou une demande en mariage :</strong> une sortie privée au coucher du soleil, sans personne d'autre à bord.",
    "<strong>Une famille ou un groupe de 4 ou 5 qui veut se baigner :</strong> une sortie privée de jour. Le bateau attend pendant la baignade, et le prix par personne baisse vite avec un bateau plein.",
    "<strong>Un groupe plus grand, de 6 à 12 personnes :</strong> un opérateur privé avec un plus grand bateau, comme Cristal Sea Madeira. Chifbay prend 5 personnes au maximum."]],
  where: ["Les départs", "D'où partent les excursions en bateau à Madère", [
    "La plupart des excursions en bateau à Madère partent de la <strong>Marina do Funchal</strong>, sur le front de mer en plein centre-ville : Chifbay, Cristal Sea, VMT Madeira, Magic Dolphin et VipDolphins partent de là. Quelques opérateurs travaillent depuis l'ouest de la côte sud, comme Lobosonda et On Tales à <strong>Calheta</strong>.",
    "Depuis Funchal, le parcours classique va vers l'ouest : le <strong>Cabo Girão</strong>, l'une des plus hautes falaises d'Europe avec environ 580 mètres, la crique de <strong>Fajã dos Padres</strong> qu'aucune route n'atteint, puis Câmara de Lobos, Ribeira Brava et Ponta do Sol. Les sorties d'observation partent plus au large, là où se trouvent les animaux ce jour-là."]],
  why: ["Pourquoi un bateau privé", "Quand un bateau privé vaut le coup", (P) => [
    "Un bateau privé coûte plus cher qu'une place partagée. Ce que vous achetez, c'est la liberté : quand s'arrêter, combien de temps se baigner, aller vite ou lentement, et personne d'autre à bord.",
    `Chez Chifbay, tout le bateau coûte ${P.sunset2} € pour la <a href="/fr/sunset-cruise">sortie au coucher du soleil</a> de 2 h et ${P.day25} € ou ${P.day3} € pour la <a href="/fr/hidden-coves-half-day">sortie de jour</a>, jusqu'à 5 personnes, avec deux skippers, repas et boissons, vidéo 360°, images de drone et photos inclus. Annulation gratuite jusqu'à 24 heures avant. Plus de détails sur notre page <a href="/fr/private-boat-tour-madeira">excursion en bateau privé</a>.`]],
  faq: ["Questions", "Excursions en bateau à Madère : vos questions", (P) => [
    ["Quelle est la meilleure excursion en bateau à Madère ?", "Tout dépend de qui vient. Pour les baleines et les dauphins, un spécialiste. Pour le prix le plus bas par personne, un catamaran partagé. Pour un couple, une famille ou un petit groupe qui veut se baigner et avoir le bateau pour lui, un bateau privé. Pour le vent et le calme, un voilier."],
    ["Combien coûte une sortie en bateau à Madère ?", `Lors de notre décompte du 11 août 2026 sur GetYourGuide, la médiane des sorties partagées était de 59 € par personne, celle des bateaux privés de 537 € pour tout le bateau. Chez Chifbay, tout le bateau coûte de ${P.sunset2} € à ${P.day3} €, jusqu'à 5 personnes.`],
    ["Les dauphins et les baleines sont-ils garantis ?", "Aucune sortie ne peut promettre des animaux sauvages. Les spécialistes partent à leur recherche. Sur une sortie privée le long de la côte comme la nôtre, les dauphins sont un cadeau quand ils passent, jamais une promesse."],
    ["D'où partent les excursions en bateau à Madère ?", "La plupart partent de la Marina do Funchal, en centre-ville. Quelques opérateurs partent de Calheta, à l'ouest, comme Lobosonda et On Tales."],
    ["Existe-t-il des sorties en bateau pour les passagers de croisière ?", "Oui. La Marina do Funchal est en centre-ville, sur le même front de mer que le port de croisière : une sortie de 2 ou 3 heures tient dans la plupart des escales. Choisissez une sortie qui finit avec de la marge avant l'heure de retour à bord."],
  ]],
  reserve: { lbl: "Chifbay · Marina do Funchal", h2: "Le bateau <em>rien que pour vous ?</em>", p: (P) => `Sorties en bateau privé depuis Funchal, jusqu'à 5 personnes, dès ${P.sunset2} € pour tout le bateau.`, bookLabel: "Voir les dates &amp; réserver", wa: "WhatsApp aux skippers", call: "Ou appelez directement" },
  book: "/book?lang=fr",
};

T.es = {
  eur: (n) => `${n} €`, to: "a", perBoat: "por barco", upTo5: "hasta 5 personas", seeSite: "Ver su web",
  title: "Excursiones en barco en Madeira: las mejores en 2026 | Chifbay",
  description: "Excursiones en barco en Madeira comparadas: barco privado, catamarán compartido, avistamiento de delfines y velero, con precios y empresas reales.",
  heroAlt: "Un barco privado frente a la costa sur de Madeira al atardecer",
  badge: "Guía · actualizada el 18 de octubre de 2026",
  h1: "Excursiones en barco<br>en <em>Madeira</em> (2026)", h1Plain: "Excursiones en barco en Madeira (2026): las mejores comparadas, con precios",
  hsub: "En Madeira hay cuatro tipos de excursión en barco: catamarán compartido (unos 40 a 79 € por persona), avistamiento de ballenas y delfines (unos 45 a 67 €), velero y barco privado (mediana de 537 € por el barco entero). La mayoría sale de la Marina do Funchal. La escribe Chifbay, una empresa de barco privado en Funchal: decimos dónde encajamos y cuándo le conviene más otra excursión.",
  bookLabel: "Ver la comparación", waLabel: "Hacer una pregunta",
  meta: [["Excursión compartida", "59 € por persona*"], ["Barco privado", "537 € por barco*"], ["Empresas", "9 comparadas"], ["Precios leídos", "oct. 2026"]],
  crumbs: [["Inicio", "/es/"], ["Experiencias", "/es/experiences"], ["Excursiones en barco en Madeira", "/es/best-boat-trips-madeira"]],
  sbar: { aria: "Excursiones en barco privado", k: "Barco privado", label: "Reservar" },
  kinds: ["Cuatro tipos de excursión", "¿Qué excursión en barco le conviene?", "En Madeira se venden cuatro tipos de excursión en barco, uno al lado del otro, en las mismas webs de reserva. Mire primero la unidad del precio: una excursión compartida se paga por persona, un barco privado se paga por el barco entero.",
    [["Por persona · mediana 59 €, casi siempre 40 a 79 €", "Catamarán o barco compartido", "Un barco grande con ruta y horario fijos, a menudo con decenas de pasajeros. La forma más barata de salir al mar, buena para una o dos personas con poco presupuesto."],
     ["Por persona · unos 45 a 67 €", "Avistamiento de ballenas y delfines", "Salidas pensadas para encontrar a los animales, en catamarán, barco tradicional o neumática. Elija esta si los animales son el motivo del viaje."],
     ["Por persona o por barco", "Velero", "Más lento y tranquilo, a vela cuando hay viento. Hay salidas compartidas y veleros privados; al atardecer, los privados empiezan hacia 500 € por barco."],
     ["Por barco · mediana 537 €", "Barco privado", "El barco entero para su grupo, con patrón. Usted elige el ritmo, se queda más tiempo en el agua y no hay nadie más a bordo. Los precios van de unos 150 € a 3.500 € por barco."]],
    "* Recuento propio de 58 anuncios de excursiones en barco en Madeira en GetYourGuide, el 11 de agosto de 2026: mediana compartida 59 € por persona (34 anuncios); mediana privada 537 € por barco (24 anuncios)."],
  ops: ["Empresas comparadas", "Nueve empresas, una al lado de otra", "<strong>Esta guía la escribe Chifbay, una de las nueve empresas de abajo</strong>, por eso aparecemos primero. Los datos se leyeron en las webs de las empresas, en GetYourGuide o en Viator, en la fecha de cada fila. Esas webs muestran precios en dólares a visitantes de EE. UU. No ponemos estrellas: los recuentos cambian cada semana.",
    ["Empresa", "Tipo de excursión", "Precio (fecha)", "Bueno saber"], "Los precios cambian. Confírmelo con la empresa antes de reservar. ¿Dirige una de estas empresas y un dato está desactualizado? Escriba a hello@chifbay.com y lo corregimos."],
  chif: ["Barco privado a motor, Funchal", "Karnic R8S de 2026, dos patrones, comida y bebidas, baño en la excursión de día, vídeo 360°, dron y fotos con cámara incluidos"],
  cristal: ["Barcos privados, Funchal", "Barco privado 2 h 30 desde 320 €; atardecer privado 2 h 30 desde 340 €; barcos más grandes desde 500 € (4/10/2026)", "Hasta 10 a 12 personas; paddle y snorkel incluidos; reserva en su web"],
  ventura: ["Excursiones compartidas, Funchal", "En activo desde 2001; reserva online"],
  vmt: ["Catamarán compartido, Funchal", "Ballenas y delfines 3 h unos 45 a 48 US$ por persona; atardecer 45 US$; Desertas 101 US$ (GetYourGuide, 4/10/2026)", "Reserva online; web en portugués e inglés"],
  lobo: ["Ballenas y delfines, Calheta", "Barco tradicional desde 51,83 € por persona; neumática 2 h desde 66,63 € (4/10/2026)", "Desde 2003; con base en Calheta, no en Funchal"],
  bonita: ["Excursiones compartidas, Funchal", "Citada por la oficina de turismo entre las empresas de barco de Funchal"],
  magic: ["Catamarán compartido, Funchal", "Desde 35 € por persona en su web (18/10/2026)", "Ballenas y delfines; nueva salida por 10 € si no se ven animales"],
  vip: ["Compartido premium y chárter privado, Funchal", "Compartido 89 € por adulto; privado 3 h desde 950 € (18/10/2026)", "Máximo 17 personas en el compartido, biólogo marino y barra libre"],
  tales: ["Barco privado hasta 5 personas, Calheta", "Unos 535 € por barco (18/10/2026)", "Sale de Calheta, no de Funchal; traslado desde el hotel anunciado como incluido"],
  who: ["Para quién", "Elija según quién va", [
    "<strong>Una o dos personas con poco presupuesto:</strong> un catamarán compartido o un avistamiento compartido.",
    "<strong>Viene por las ballenas y los delfines:</strong> una empresa especializada como VMT Madeira, Lobosonda o Magic Dolphin.",
    "<strong>Una pareja que celebra algo, o una pedida de mano:</strong> una excursión privada al atardecer, sin nadie más a bordo.",
    "<strong>Una familia o un grupo de 4 o 5 que quiere bañarse:</strong> una excursión privada de día. El barco espera mientras se bañan, y el precio por persona baja rápido con el barco lleno.",
    "<strong>Un grupo más grande, de 6 a 12 personas:</strong> una empresa privada con un barco mayor, como Cristal Sea Madeira. Chifbay lleva 5 personas como máximo."]],
  where: ["Salidas", "Desde dónde salen las excursiones en barco en Madeira", [
    "La mayoría de las excursiones en barco en Madeira sale de la <strong>Marina do Funchal</strong>, en el paseo marítimo, en pleno centro: Chifbay, Cristal Sea, VMT Madeira, Magic Dolphin y VipDolphins salen de allí. Algunas empresas trabajan desde el oeste de la costa sur, como Lobosonda y On Tales en <strong>Calheta</strong>.",
    "Desde Funchal, la ruta clásica va hacia el oeste: el <strong>Cabo Girão</strong>, uno de los acantilados más altos de Europa con unos 580 metros, la cala de <strong>Fajã dos Padres</strong>, a la que no llega ninguna carretera, y Câmara de Lobos, Ribeira Brava y Ponta do Sol. Los avistamientos se alejan más de la costa, a donde estén los animales ese día."]],
  why: ["Por qué un barco privado", "Cuándo merece la pena un barco privado", (P) => [
    "Un barco privado cuesta más que una plaza compartida. Lo que compra es libertad: cuándo parar, cuánto tiempo bañarse, ir rápido o despacio, y nadie más a bordo.",
    `En Chifbay el barco entero cuesta ${P.sunset2} € en el <a href="/es/sunset-cruise">paseo al atardecer</a> de 2 h y ${P.day25} € o ${P.day3} € en la <a href="/es/hidden-coves-half-day">excursión de día</a>, hasta 5 personas, con dos patrones, comida y bebidas, vídeo 360°, imágenes de dron y fotos incluidos. Cancelación gratuita hasta 24 horas antes.`]],
  faq: ["Preguntas", "Excursiones en barco en Madeira: preguntas", (P) => [
    ["¿Cuál es la mejor excursión en barco en Madeira?", "Depende de quién vaya. Para ballenas y delfines, una empresa especializada. Para el precio más bajo por persona, un catamarán compartido. Para una pareja, una familia o un grupo pequeño que quiere bañarse y tener el barco para sí, un barco privado. Para viento y calma, un velero."],
    ["¿Cuánto cuesta una excursión en barco en Madeira?", `En nuestro recuento del 11 de agosto de 2026 en GetYourGuide, la mediana de las excursiones compartidas era de 59 € por persona y la de los barcos privados de 537 € por el barco entero. En Chifbay, el barco entero cuesta de ${P.sunset2} € a ${P.day3} €, hasta 5 personas.`],
    ["¿Están garantizados los delfines y las ballenas?", "Ninguna excursión puede prometer animales salvajes. Las empresas especializadas salen a buscarlos. En una excursión privada por la costa, como la nuestra, los delfines son un regalo cuando aparecen, nunca una promesa."],
    ["¿Desde dónde salen las excursiones en barco en Madeira?", "La mayoría sale de la Marina do Funchal, en el centro. Algunas empresas salen de Calheta, al oeste, como Lobosonda y On Tales."],
    ["¿Hay excursiones en barco para pasajeros de crucero?", "Sí. La Marina do Funchal está en el centro, en el mismo paseo marítimo que el puerto de cruceros, así que una excursión de 2 o 3 horas cabe en la mayoría de las escalas. Elija una que termine con margen antes de la hora de embarque."],
  ]],
  reserve: { lbl: "Chifbay · Marina do Funchal", h2: "¿El barco <em>solo para ustedes?</em>", p: (P) => `Excursiones en barco privado desde Funchal, hasta 5 personas, desde ${P.sunset2} € por el barco entero.`, bookLabel: "Ver fechas y reservar", wa: "WhatsApp a los patrones", call: "O llame directamente" },
  book: "/book?lang=es",
};

T.it = {
  eur: (n) => `${n} €`, to: "a", perBoat: "a barca", upTo5: "fino a 5 persone", seeSite: "Vedi il sito",
  title: "Gite in barca a Madeira: le migliori nel 2026 | Chifbay",
  description: "Gite in barca a Madeira a confronto: barca privata, catamarano condiviso, avvistamento delfini e barca a vela, con prezzi e operatori reali.",
  heroAlt: "Una barca privata davanti alla costa sud di Madeira al tramonto",
  badge: "Guida · aggiornata il 18 ottobre 2026",
  h1: "Gite in barca<br>a <em>Madeira</em> (2026)", h1Plain: "Gite in barca a Madeira (2026): le migliori a confronto, con i prezzi",
  hsub: "A Madeira ci sono quattro tipi di gita in barca: catamarano condiviso (tra circa 40 e 79 € a persona), avvistamento di balene e delfini (tra circa 45 e 67 €), barca a vela e barca privata (mediana 537 € per tutta la barca). Quasi tutte partono dalla Marina do Funchal. La scrive Chifbay, un'azienda di barca privata a Funchal: diciamo dove ci collochiamo e quando un'altra gita fa più al caso vostro.",
  bookLabel: "Vedi il confronto", waLabel: "Fai una domanda",
  meta: [["Gita condivisa", "59 € a persona*"], ["Barca privata", "537 € a barca*"], ["Operatori", "9 a confronto"], ["Prezzi letti", "ott. 2026"]],
  crumbs: [["Home", "/it/"], ["Esperienze", "/it/experiences"], ["Gite in barca a Madeira", "/it/best-boat-trips-madeira"]],
  sbar: { aria: "Gite in barca privata", k: "Barca privata", label: "Prenota" },
  kinds: ["Quattro tipi di gita", "Quale gita in barca fa per voi?", "A Madeira si vendono quattro tipi di gita in barca, uno accanto all'altro, sugli stessi siti di prenotazione. Guardate prima l'unità del prezzo: una gita condivisa si paga a persona, una barca privata si paga per tutta la barca.",
    [["A persona · mediana 59 €, di solito tra 40 e 79 €", "Catamarano o barca condivisa", "Una barca grande con percorso e orari fissi, spesso con decine di altri passeggeri. Il modo più economico per andare in mare, adatto a una o due persone con un budget ridotto."],
     ["A persona · tra circa 45 e 67 €", "Avvistamento di balene e delfini", "Uscite pensate per trovare gli animali, in catamarano, barca tradizionale o gommone. La scelta giusta se gli animali sono il motivo del viaggio."],
     ["A persona o a barca", "Barca a vela", "Più lenta e tranquilla, a vela quando c'è vento. Esistono uscite condivise e barche a vela private; al tramonto le private partono da circa 500 € a barca."],
     ["A barca · mediana 537 €", "Barca privata", "Tutta la barca per il vostro gruppo, con skipper. Scegliete il ritmo, restate di più in acqua e non c'è nessun altro a bordo. I prezzi vanno da circa 150 € a 3.500 € a barca."]],
    "* Nostro conteggio di 58 annunci di gite in barca a Madeira su GetYourGuide, l'11 agosto 2026: mediana condivisa 59 € a persona (34 annunci); mediana privata 537 € a barca (24 annunci)."],
  ops: ["Operatori a confronto", "Nove operatori, uno accanto all'altro", "<strong>Questa guida è scritta da Chifbay, uno dei nove operatori qui sotto</strong>, per questo compariamo per primi. I dati sono stati letti sui siti degli operatori, su GetYourGuide o su Viator, alla data indicata in ogni riga. Questi siti mostrano prezzi in dollari ai visitatori degli Stati Uniti. Niente stelle: i conteggi cambiano ogni settimana.",
    ["Operatore", "Tipo di gita", "Prezzo (data)", "Buono a sapersi"], "I prezzi cambiano. Verificate con l'operatore prima di prenotare. Gestite una di queste aziende e un dato non è aggiornato? Scrivete a hello@chifbay.com e lo correggiamo."],
  chif: ["Barca privata a motore, Funchal", "Karnic R8S del 2026, due skipper, cibo e bevande, bagno nella gita di giorno, video 360°, drone e foto con fotocamera inclusi"],
  cristal: ["Barche private, Funchal", "Barca privata 2 h 30 da 320 €; tramonto privato 2 h 30 da 340 €; barche più grandi da 500 € (4/10/2026)", "Fino a 10 o 12 persone; paddle e snorkeling inclusi; prenotazione sul loro sito"],
  ventura: ["Gite condivise, Funchal", "Attiva dal 2001; prenotazione online"],
  vmt: ["Catamarano condiviso, Funchal", "Balene e delfini 3 h tra circa 45 e 48 US$ a persona; tramonto 45 US$; Desertas 101 US$ (GetYourGuide, 4/10/2026)", "Prenotazione online; sito in portoghese e inglese"],
  lobo: ["Balene e delfini, Calheta", "Barca tradizionale da 51,83 € a persona; gommone 2 h da 66,63 € (4/10/2026)", "Dal 2003; con sede a Calheta, non a Funchal"],
  bonita: ["Gite condivise, Funchal", "Indicata dall'ente del turismo tra gli operatori di Funchal"],
  magic: ["Catamarano condiviso, Funchal", "Da 35 € a persona sul suo sito (18/10/2026)", "Balene e delfini; nuova uscita a 10 € se non si vedono animali"],
  vip: ["Condiviso premium e noleggio privato, Funchal", "Condiviso 89 € ad adulto; privato 3 h da 950 € (18/10/2026)", "Massimo 17 persone nel condiviso, biologo marino e open bar"],
  tales: ["Barca privata fino a 5 persone, Calheta", "Circa 535 € a barca (18/10/2026)", "Parte da Calheta, non da Funchal; transfer dall'hotel indicato come incluso"],
  who: ["Per chi", "Scegliete in base a chi viene", [
    "<strong>Una o due persone con budget ridotto:</strong> un catamarano condiviso o un avvistamento condiviso.",
    "<strong>Venite per balene e delfini:</strong> un operatore specializzato come VMT Madeira, Lobosonda o Magic Dolphin.",
    "<strong>Una coppia che festeggia, o una proposta di matrimonio:</strong> una gita privata al tramonto, senza nessun altro a bordo.",
    "<strong>Una famiglia o un gruppo di 4 o 5 che vuole fare il bagno:</strong> una gita privata di giorno. La barca aspetta mentre fate il bagno, e il prezzo a persona scende in fretta con la barca piena.",
    "<strong>Un gruppo più grande, da 6 a 12 persone:</strong> un operatore privato con una barca più grande, come Cristal Sea Madeira. Chifbay porta al massimo 5 persone."]],
  where: ["Partenze", "Da dove partono le gite in barca a Madeira", [
    "Quasi tutte le gite in barca a Madeira partono dalla <strong>Marina do Funchal</strong>, sul lungomare in pieno centro: Chifbay, Cristal Sea, VMT Madeira, Magic Dolphin e VipDolphins partono da lì. Alcuni operatori lavorano dall'ovest della costa sud, come Lobosonda e On Tales a <strong>Calheta</strong>.",
    "Da Funchal il percorso classico va verso ovest: il <strong>Cabo Girão</strong>, una delle scogliere più alte d'Europa con circa 580 metri, la baia di <strong>Fajã dos Padres</strong>, dove non arriva nessuna strada, e Câmara de Lobos, Ribeira Brava e Ponta do Sol. Gli avvistamenti vanno più al largo, dove si trovano gli animali quel giorno."]],
  why: ["Perché una barca privata", "Quando conviene una barca privata", (P) => [
    "Una barca privata costa più di un posto condiviso. Quello che comprate è libertà: quando fermarsi, quanto restare in acqua, andare veloci o piano, e nessun altro a bordo.",
    `Con Chifbay tutta la barca costa ${P.sunset2} € per la <a href="/it/sunset-cruise">gita al tramonto</a> di 2 ore e ${P.day25} € o ${P.day3} € per la <a href="/it/hidden-coves-half-day">gita di giorno</a>, fino a 5 persone, con due skipper, cibo e bevande, video 360°, riprese col drone e foto inclusi. Cancellazione gratuita fino a 24 ore prima.`]],
  faq: ["Domande", "Gite in barca a Madeira: domande", (P) => [
    ["Qual è la gita in barca migliore a Madeira?", "Dipende da chi viene. Per balene e delfini, un operatore specializzato. Per il prezzo più basso a persona, un catamarano condiviso. Per una coppia, una famiglia o un piccolo gruppo che vuole fare il bagno e avere la barca tutta per sé, una barca privata. Per vento e silenzio, una barca a vela."],
    ["Quanto costa una gita in barca a Madeira?", `Nel nostro conteggio dell'11 agosto 2026 su GetYourGuide, la mediana delle gite condivise era 59 € a persona e quella delle barche private 537 € per tutta la barca. Con Chifbay tutta la barca costa da ${P.sunset2} € a ${P.day3} €, fino a 5 persone.`],
    ["Delfini e balene sono garantiti?", "Nessuna gita può promettere animali selvatici. Gli operatori specializzati escono a cercarli. In una gita privata lungo la costa come la nostra, i delfini sono un regalo quando arrivano, mai una promessa."],
    ["Da dove partono le gite in barca a Madeira?", "Quasi tutte dalla Marina do Funchal, in centro. Alcuni operatori partono da Calheta, a ovest, come Lobosonda e On Tales."],
    ["Ci sono gite in barca per chi arriva in crociera?", "Sì. La Marina do Funchal è in centro, sullo stesso lungomare del porto crocieristico, quindi una gita di 2 o 3 ore sta nella maggior parte degli scali. Scegliete una gita che finisca con margine prima dell'ora di rientro a bordo."],
  ]],
  reserve: { lbl: "Chifbay · Marina do Funchal", h2: "La barca <em>tutta per voi?</em>", p: (P) => `Gite in barca privata da Funchal, fino a 5 persone, da ${P.sunset2} € per tutta la barca.`, bookLabel: "Vedi le date e prenota", wa: "WhatsApp agli skipper", call: "Oppure chiama direttamente" },
  book: "/book?lang=it",
};

/** The five native guide pages, in the builder's page format. h = the builder's helpers. */
export function guidePages(h) {
  const { prose, faq, reserve, P, CMP_CSS } = h;
  return ["pt", "de", "fr", "es", "it"].map((lang) => {
    const t = T[lang];
    const faqData = { n: "06", label: t.faq[0], h2: t.faq[1], items: t.faq[2](P) };
    const table = rows(P, t).map((r) => `          <tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n");
    return {
      slug: `${lang}/${GUIDE_SLUG}`, lang, css: CMP_CSS, group: "guide", alternates: GUIDE_ALTS, modified: "2026-10-18",
      title: t.title, description: t.description, heroImg: "hero", heroAlt: t.heroAlt, badge: t.badge,
      h1: t.h1, h1Plain: t.h1Plain, hsub: t.hsub, book: "#compare", bookLabel: t.bookLabel, waLabel: t.waLabel, meta: t.meta,
      article: { published: "2026-10-18" }, crumbs: t.crumbs,
      sbar: { aria: t.sbar.aria, k: t.sbar.k, v: t.eur(P.sunset2), live: "sunset", href: t.book, label: t.sbar.label },
      faq: faqData,
      sections: () => [
        prose("01", t.kinds[0], t.kinds[1], `    <p class="reveal d1" style="max-width:68ch">${t.kinds[2]}</p>
    <div class="cmp-cards">
${t.kinds[3].map(([k, h3, p], i) => `      <div class="cmp-card reveal${i % 2 ? " d1" : ""}"><div class="k">${k}</div><h3>${h3}</h3><p>${p}</p></div>`).join("\n")}
    </div>
    <p class="cmp-note reveal">${t.kinds[4]}</p>`),
        prose("02", t.ops[0], t.ops[1], `    <p class="reveal d1" style="max-width:68ch" id="compare">${t.ops[2]}</p>
    <div class="cmp-wrap reveal">
      <table class="cmp-t">
        <thead><tr>${t.ops[3].map((c) => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>
${table}
        </tbody>
      </table>
    </div>
    <p class="cmp-note reveal">${t.ops[4]}</p>`),
        prose("03", t.who[0], t.who[1], `    <ul class="cmp-list reveal d1">
${t.who[2].map((li) => `      <li>${li}</li>`).join("\n")}
    </ul>`),
        prose("04", t.where[0], t.where[1], t.where[2].map((p, i) => `    <p class="cmp-p reveal d${i + 1}" style="max-width:68ch">${p}</p>`).join("\n")),
        prose("05", t.why[0], t.why[1], t.why[2](P).map((p, i) => `    <p class="cmp-p reveal d${i + 1}" style="max-width:68ch">${p}</p>`).join("\n")),
        faq(faqData),
        reserve(`../`, { lbl: t.reserve.lbl, img: "charter", h2: t.reserve.h2, p: t.reserve.p(P), book: t.book, bookLabel: t.reserve.bookLabel, wa: t.reserve.wa, call: t.reserve.call }),
      ],
    };
  });
}
