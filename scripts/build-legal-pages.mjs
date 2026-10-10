#!/usr/bin/env node
// build-legal-pages.mjs: the Legal notice and Cookie policy pages, in 6 languages.
//
//   node scripts/build-legal-pages.mjs           dry run
//   node scripts/build-legal-pages.mjs --write   writes legal-notice.html and cookies.html
//                                                (and fr/ de/ pt/ es/ it/), adds them to sitemap.xml
//
// Each page is the same language's privacy page with its head data and its text
// swapped, so the header, footer, fonts and scripts always match the rest of the site.
// The facts (company, NIPC, licence, address) come from the footer and the notes in
// stores/chifbay/CLAUDE.md. Safe to run again.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const BASE = "https://chifbay.com";
const LANGS = ["en", "fr", "de", "pt", "es", "it"];
const dirOf = (l) => (l === "en" ? "" : `${l}/`);

const FACTS = {
  nipc: "518603750",
  rnaat: "305/2026",
  policy: "BR66385591",
  seat: "Rampa dos Piornais, lote 14, porta 10, 5A, 9000-682 Funchal, Madeira, Portugal",
  point: "Marina do Funchal, Pontoon C, 9000-055 Funchal",
  mail: "hello@chifbay.com",
  phone: "+351 937 200 320",
  host: "GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA",
  livro: "https://www.livroreclamacoes.pt/inicio",
};
const mail = `<a href="mailto:${FACTS.mail}">${FACTS.mail}</a>`;
const livro = (t) => `<a href="${FACTS.livro}" target="_blank" rel="noopener">${t}</a>`;

// per language: badge, then for each page: slug-independent title, h1, description, sections [h2, html]
const T = {
  en: {
    badge: "Legal",
    notice: {
      title: "Legal Notice", h1: "Legal notice",
      desc: "Who runs Chifbay: company name, registration number, tourism licence, address, insurance, hosting and how to make a complaint.",
      body: [
        ["Publisher", `<p>This website is published by <strong>CHIF&amp;CO, Lda</strong>, trading as Chifbay, a private limited company registered in Portugal.</p><p>Company registration number (NIPC): <strong>${FACTS.nipc}</strong><br>Registered office: ${FACTS.seat}</p>`],
        ["Tourism licence and insurance", `<p>Licensed maritime tourism operator (<em>Operador Marítimo Turístico</em>), RNAAT n.º <strong>${FACTS.rnaat}</strong>, registered with Turismo de Portugal.</p><p>Civil liability insurance: Fidelidade, policy ${FACTS.policy}.</p>`],
        ["Contact", `<p>Email: ${mail}<br>Phone and WhatsApp: ${FACTS.phone}<br>Meeting point for all trips: ${FACTS.point}</p>`],
        ["Hosting", `<p>This website is hosted by ${FACTS.host}.</p>`],
        ["Complaints", `<p>You can make a complaint through the Portuguese official ${livro("Livro de Reclamações Eletrónico")}, or write to ${mail}. We answer every message.</p>`],
        ["Content", `<p>The texts, photos and videos on this website belong to CHIF&amp;CO, Lda unless a credit says otherwise. Please ask us before you reuse them.</p>`],
        ["Your data and cookies", `<p>See our <a href="/privacy">privacy policy</a> and our <a href="/cookies">cookie policy</a>.</p>`],
      ],
    },
    cookies: {
      title: "Cookie Policy", h1: "Cookie policy",
      desc: "Which cookies Chifbay uses, and why. Short answer: no advertising or analytics cookies.",
      body: [
        ["The short answer", `<p>We do not use advertising or analytics cookies. Nothing is stored on your device to track you.</p>`],
        ["How we measure visits and ads", `<p>We use Google Analytics 4 and Google Ads, set up to work without cookies: Google only receives anonymous signals, with no identifier. When you arrive from an ad, its click reference travels in the page address, not in a cookie.</p><p>We also count page views on our own server, with no cookie and no IP address kept: only a daily code that cannot be traced back to you.</p>`],
        ["What is stored on your device", `<p>Only what the site needs to work the way you set it: your light or dark theme, and a short marker for the page transition that disappears when you close the tab. These are not tracking.</p>`],
        ["If you accepted cookies before", `<p>Visitors who accepted cookies on an earlier visit may still have two cookies: <code>cb_consent</code> (their answer, kept up to 180 days) and <code>cb_attr</code> (which ad brought them, kept up to 90 days). You can delete them at any time in your browser settings.</p>`],
        ["Third parties", `<p>The map on our pages loads from Google only when you press “Show the map”, and Google may set its own cookies then. Our payment provider, Stripe, may set cookies needed for secure payment and fraud prevention when you pay.</p>`],
        ["Questions", `<p>Write to ${mail}. More on your data in our <a href="/privacy">privacy policy</a>.</p>`],
      ],
    },
  },
  fr: {
    badge: "Mentions légales",
    notice: {
      title: "Mentions légales", h1: "Mentions légales",
      desc: "Qui édite Chifbay : société, numéro d'immatriculation, licence de tourisme, adresse, assurance, hébergement et réclamations.",
      body: [
        ["Éditeur", `<p>Ce site est édité par <strong>CHIF&amp;CO, Lda</strong>, sous le nom commercial Chifbay, société à responsabilité limitée immatriculée au Portugal.</p><p>Numéro d'immatriculation (NIPC) : <strong>${FACTS.nipc}</strong><br>Siège social : ${FACTS.seat}</p>`],
        ["Licence de tourisme et assurance", `<p>Opérateur maritime touristique agréé (<em>Operador Marítimo Turístico</em>), RNAAT n.º <strong>${FACTS.rnaat}</strong>, enregistré auprès de Turismo de Portugal.</p><p>Assurance responsabilité civile : Fidelidade, police ${FACTS.policy}.</p>`],
        ["Contact", `<p>E-mail : ${mail}<br>Téléphone et WhatsApp : ${FACTS.phone}<br>Point de rendez-vous de toutes les sorties : ${FACTS.point}</p>`],
        ["Hébergement", `<p>Ce site est hébergé par ${FACTS.host}.</p>`],
        ["Réclamations", `<p>Vous pouvez déposer une réclamation sur le ${livro("Livro de Reclamações Eletrónico")} officiel portugais, ou écrire à ${mail}. Nous répondons à chaque message.</p>`],
        ["Contenu", `<p>Les textes, photos et vidéos de ce site appartiennent à CHIF&amp;CO, Lda, sauf mention contraire. Merci de nous demander avant de les réutiliser.</p>`],
        ["Vos données et les cookies", `<p>Voir notre <a href="/fr/privacy">politique de confidentialité</a> et notre <a href="/fr/cookies">politique de cookies</a>.</p>`],
      ],
    },
    cookies: {
      title: "Politique de cookies", h1: "Politique de cookies",
      desc: "Quels cookies Chifbay utilise, et pourquoi. En bref : aucun cookie publicitaire ni de mesure.",
      body: [
        ["En bref", `<p>Nous n'utilisons ni cookie publicitaire ni cookie de mesure d'audience. Rien n'est enregistré sur votre appareil pour vous suivre.</p>`],
        ["Comment nous mesurons les visites et les publicités", `<p>Nous utilisons Google Analytics 4 et Google Ads, réglés pour fonctionner sans cookies : Google ne reçoit que des signaux anonymes, sans identifiant. Quand vous arrivez depuis une annonce, sa référence de clic passe dans l'adresse de la page, pas dans un cookie.</p><p>Nous comptons aussi les pages vues sur notre propre serveur, sans cookie et sans conserver l'adresse IP : seulement un code quotidien qui ne permet pas de remonter jusqu'à vous.</p>`],
        ["Ce qui est enregistré sur votre appareil", `<p>Uniquement ce dont le site a besoin pour fonctionner comme vous l'avez réglé : votre thème clair ou sombre, et un court repère pour la transition entre pages qui disparaît à la fermeture de l'onglet. Ce n'est pas du suivi.</p>`],
        ["Si vous avez accepté les cookies avant", `<p>Les visiteurs qui ont accepté les cookies lors d'une visite précédente peuvent encore avoir deux cookies : <code>cb_consent</code> (leur réponse, jusqu'à 180 jours) et <code>cb_attr</code> (quelle annonce les a amenés, jusqu'à 90 jours). Vous pouvez les supprimer à tout moment dans les réglages de votre navigateur.</p>`],
        ["Tiers", `<p>La carte de nos pages ne se charge depuis Google que lorsque vous appuyez sur « Afficher la carte », et Google peut alors déposer ses propres cookies. Notre prestataire de paiement, Stripe, peut déposer des cookies nécessaires au paiement sécurisé et à la lutte contre la fraude lorsque vous payez.</p>`],
        ["Questions", `<p>Écrivez à ${mail}. Plus de détails sur vos données dans notre <a href="/fr/privacy">politique de confidentialité</a>.</p>`],
      ],
    },
  },
  de: {
    badge: "Rechtliches",
    notice: {
      title: "Impressum", h1: "Impressum",
      desc: "Wer Chifbay betreibt: Firma, Registernummer, Tourismuslizenz, Anschrift, Versicherung, Hosting und Beschwerden.",
      body: [
        ["Anbieter", `<p>Diese Website wird betrieben von <strong>CHIF&amp;CO, Lda</strong>, handelnd unter dem Namen Chifbay, einer in Portugal eingetragenen Gesellschaft mit beschränkter Haftung.</p><p>Handelsregisternummer (NIPC): <strong>${FACTS.nipc}</strong><br>Sitz: ${FACTS.seat}</p>`],
        ["Tourismuslizenz und Versicherung", `<p>Zugelassener maritimer Tourismusbetreiber (<em>Operador Marítimo Turístico</em>), RNAAT Nr. <strong>${FACTS.rnaat}</strong>, eingetragen bei Turismo de Portugal.</p><p>Haftpflichtversicherung: Fidelidade, Police ${FACTS.policy}.</p>`],
        ["Kontakt", `<p>E-Mail: ${mail}<br>Telefon und WhatsApp: ${FACTS.phone}<br>Treffpunkt für alle Fahrten: ${FACTS.point}</p>`],
        ["Hosting", `<p>Diese Website wird gehostet von ${FACTS.host}.</p>`],
        ["Beschwerden", `<p>Sie können sich über das offizielle portugiesische ${livro("Livro de Reclamações Eletrónico")} beschweren oder an ${mail} schreiben. Wir antworten auf jede Nachricht.</p>`],
        ["Inhalte", `<p>Die Texte, Fotos und Videos dieser Website gehören CHIF&amp;CO, Lda, sofern nichts anderes angegeben ist. Bitte fragen Sie uns, bevor Sie sie weiterverwenden.</p>`],
        ["Ihre Daten und Cookies", `<p>Siehe unsere <a href="/de/privacy">Datenschutzerklärung</a> und unsere <a href="/de/cookies">Cookie-Richtlinie</a>.</p>`],
      ],
    },
    cookies: {
      title: "Cookie-Richtlinie", h1: "Cookie-Richtlinie",
      desc: "Welche Cookies Chifbay verwendet und warum. Kurz gesagt: keine Werbe- oder Analyse-Cookies.",
      body: [
        ["Kurz gesagt", `<p>Wir verwenden keine Werbe- oder Analyse-Cookies. Auf Ihrem Gerät wird nichts gespeichert, um Sie zu verfolgen.</p>`],
        ["Wie wir Besuche und Anzeigen messen", `<p>Wir nutzen Google Analytics 4 und Google Ads, eingestellt auf den Betrieb ohne Cookies: Google erhält nur anonyme Signale ohne Kennung. Wenn Sie über eine Anzeige kommen, steht deren Klick-Referenz in der Seitenadresse, nicht in einem Cookie.</p><p>Außerdem zählen wir Seitenaufrufe auf unserem eigenen Server, ohne Cookie und ohne IP-Adresse zu speichern: nur ein Tagescode, der nicht zu Ihnen zurückführt.</p>`],
        ["Was auf Ihrem Gerät gespeichert wird", `<p>Nur das, was die Website braucht, um so zu funktionieren, wie Sie es eingestellt haben: Ihr helles oder dunkles Design und eine kurze Markierung für den Seitenwechsel, die beim Schließen des Tabs verschwindet. Das ist kein Tracking.</p>`],
        ["Wenn Sie früher Cookies akzeptiert haben", `<p>Besucher, die bei einem früheren Besuch Cookies akzeptiert haben, haben möglicherweise noch zwei Cookies: <code>cb_consent</code> (ihre Antwort, bis zu 180 Tage) und <code>cb_attr</code> (welche Anzeige sie hergeführt hat, bis zu 90 Tage). Sie können sie jederzeit in den Browser-Einstellungen löschen.</p>`],
        ["Dritte", `<p>Die Karte auf unseren Seiten wird erst von Google geladen, wenn Sie „Karte anzeigen“ drücken, und Google kann dann eigene Cookies setzen. Unser Zahlungsdienstleister Stripe kann beim Bezahlen Cookies setzen, die für sichere Zahlung und Betrugsabwehr nötig sind.</p>`],
        ["Fragen", `<p>Schreiben Sie an ${mail}. Mehr zu Ihren Daten in unserer <a href="/de/privacy">Datenschutzerklärung</a>.</p>`],
      ],
    },
  },
  pt: {
    badge: "Legal",
    notice: {
      title: "Aviso Legal", h1: "Aviso legal",
      desc: "Quem gere a Chifbay: empresa, número de registo, licença de turismo, morada, seguro, alojamento do site e reclamações.",
      body: [
        ["Editor", `<p>Este site é editado pela <strong>CHIF&amp;CO, Lda</strong>, que opera sob o nome Chifbay, sociedade por quotas registada em Portugal.</p><p>Número de identificação (NIPC): <strong>${FACTS.nipc}</strong><br>Sede: ${FACTS.seat}</p>`],
        ["Licença de turismo e seguro", `<p>Operador marítimo-turístico licenciado, RNAAT n.º <strong>${FACTS.rnaat}</strong>, registado no Turismo de Portugal.</p><p>Seguro de responsabilidade civil: Fidelidade, apólice ${FACTS.policy}.</p>`],
        ["Contacto", `<p>E-mail: ${mail}<br>Telefone e WhatsApp: ${FACTS.phone}<br>Ponto de encontro de todos os passeios: ${FACTS.point}</p>`],
        ["Alojamento do site", `<p>Este site está alojado por ${FACTS.host}.</p>`],
        ["Reclamações", `<p>Pode reclamar através do ${livro("Livro de Reclamações Eletrónico")} oficial, ou escrever para ${mail}. Respondemos a todas as mensagens.</p>`],
        ["Conteúdo", `<p>Os textos, fotografias e vídeos deste site pertencem à CHIF&amp;CO, Lda, salvo indicação em contrário. Peça-nos autorização antes de os reutilizar.</p>`],
        ["Os seus dados e os cookies", `<p>Consulte a nossa <a href="/pt/privacy">política de privacidade</a> e a nossa <a href="/pt/cookies">política de cookies</a>.</p>`],
      ],
    },
    cookies: {
      title: "Política de Cookies", h1: "Política de cookies",
      desc: "Que cookies a Chifbay usa e porquê. Em resumo: nenhum cookie de publicidade nem de análise.",
      body: [
        ["Em resumo", `<p>Não usamos cookies de publicidade nem de análise. Nada é guardado no seu dispositivo para o seguir.</p>`],
        ["Como medimos visitas e anúncios", `<p>Usamos o Google Analytics 4 e o Google Ads, configurados para funcionar sem cookies: a Google só recebe sinais anónimos, sem identificador. Quando chega através de um anúncio, a referência do clique segue no endereço da página, não num cookie.</p><p>Contamos também as visitas no nosso próprio servidor, sem cookie e sem guardar o endereço IP: apenas um código diário que não permite chegar até si.</p>`],
        ["O que é guardado no seu dispositivo", `<p>Apenas o que o site precisa para funcionar como o configurou: o tema claro ou escuro e uma marca curta para a transição entre páginas, que desaparece ao fechar o separador. Não é rastreamento.</p>`],
        ["Se aceitou cookies antes", `<p>Os visitantes que aceitaram cookies numa visita anterior podem ainda ter dois cookies: <code>cb_consent</code> (a sua resposta, até 180 dias) e <code>cb_attr</code> (que anúncio os trouxe, até 90 dias). Pode apagá-los a qualquer momento nas definições do navegador.</p>`],
        ["Terceiros", `<p>O mapa das nossas páginas só é carregado da Google quando carrega em «Mostrar o mapa», e a Google pode então definir os seus próprios cookies. O nosso prestador de pagamentos, a Stripe, pode definir cookies necessários ao pagamento seguro e à prevenção de fraude quando paga.</p>`],
        ["Perguntas", `<p>Escreva para ${mail}. Mais sobre os seus dados na nossa <a href="/pt/privacy">política de privacidade</a>.</p>`],
      ],
    },
  },
  es: {
    badge: "Legal",
    notice: {
      title: "Aviso Legal", h1: "Aviso legal",
      desc: "Quién gestiona Chifbay: empresa, número de registro, licencia de turismo, dirección, seguro, alojamiento web y reclamaciones.",
      body: [
        ["Titular", `<p>Este sitio web es editado por <strong>CHIF&amp;CO, Lda</strong>, que opera con el nombre Chifbay, sociedad limitada registrada en Portugal.</p><p>Número de identificación (NIPC): <strong>${FACTS.nipc}</strong><br>Domicilio social: ${FACTS.seat}</p>`],
        ["Licencia de turismo y seguro", `<p>Operador marítimo turístico autorizado (<em>Operador Marítimo Turístico</em>), RNAAT n.º <strong>${FACTS.rnaat}</strong>, registrado en Turismo de Portugal.</p><p>Seguro de responsabilidad civil: Fidelidade, póliza ${FACTS.policy}.</p>`],
        ["Contacto", `<p>Correo electrónico: ${mail}<br>Teléfono y WhatsApp: ${FACTS.phone}<br>Punto de encuentro de todas las salidas: ${FACTS.point}</p>`],
        ["Alojamiento web", `<p>Este sitio web está alojado por ${FACTS.host}.</p>`],
        ["Reclamaciones", `<p>Puede reclamar a través del ${livro("Livro de Reclamações Eletrónico")} oficial portugués, o escribir a ${mail}. Respondemos a todos los mensajes.</p>`],
        ["Contenido", `<p>Los textos, fotos y vídeos de este sitio pertenecen a CHIF&amp;CO, Lda, salvo indicación en contrario. Pídanos permiso antes de reutilizarlos.</p>`],
        ["Sus datos y las cookies", `<p>Consulte nuestra <a href="/es/privacy">política de privacidad</a> y nuestra <a href="/es/cookies">política de cookies</a>.</p>`],
      ],
    },
    cookies: {
      title: "Política de Cookies", h1: "Política de cookies",
      desc: "Qué cookies usa Chifbay y por qué. En resumen: ninguna cookie publicitaria ni de análisis.",
      body: [
        ["En resumen", `<p>No usamos cookies publicitarias ni de análisis. No se guarda nada en su dispositivo para seguirle.</p>`],
        ["Cómo medimos las visitas y los anuncios", `<p>Usamos Google Analytics 4 y Google Ads, configurados para funcionar sin cookies: Google solo recibe señales anónimas, sin identificador. Cuando llega desde un anuncio, la referencia del clic viaja en la dirección de la página, no en una cookie.</p><p>También contamos las visitas en nuestro propio servidor, sin cookie y sin guardar la dirección IP: solo un código diario que no permite llegar hasta usted.</p>`],
        ["Qué se guarda en su dispositivo", `<p>Solo lo que el sitio necesita para funcionar como usted lo configuró: su tema claro u oscuro y una marca breve para la transición entre páginas que desaparece al cerrar la pestaña. No es seguimiento.</p>`],
        ["Si aceptó cookies antes", `<p>Los visitantes que aceptaron cookies en una visita anterior pueden conservar dos cookies: <code>cb_consent</code> (su respuesta, hasta 180 días) y <code>cb_attr</code> (qué anuncio los trajo, hasta 90 días). Puede borrarlas en cualquier momento en los ajustes del navegador.</p>`],
        ["Terceros", `<p>El mapa de nuestras páginas solo se carga desde Google cuando pulsa «Mostrar el mapa», y Google puede entonces establecer sus propias cookies. Nuestro proveedor de pagos, Stripe, puede establecer cookies necesarias para el pago seguro y la prevención del fraude cuando paga.</p>`],
        ["Preguntas", `<p>Escriba a ${mail}. Más sobre sus datos en nuestra <a href="/es/privacy">política de privacidad</a>.</p>`],
      ],
    },
  },
  it: {
    badge: "Note legali",
    notice: {
      title: "Note Legali", h1: "Note legali",
      desc: "Chi gestisce Chifbay: società, numero di registrazione, licenza turistica, indirizzo, assicurazione, hosting e reclami.",
      body: [
        ["Editore", `<p>Questo sito è pubblicato da <strong>CHIF&amp;CO, Lda</strong>, che opera con il nome Chifbay, società a responsabilità limitata registrata in Portogallo.</p><p>Numero di registrazione (NIPC): <strong>${FACTS.nipc}</strong><br>Sede legale: ${FACTS.seat}</p>`],
        ["Licenza turistica e assicurazione", `<p>Operatore marittimo turistico autorizzato (<em>Operador Marítimo Turístico</em>), RNAAT n.º <strong>${FACTS.rnaat}</strong>, registrato presso Turismo de Portugal.</p><p>Assicurazione di responsabilità civile: Fidelidade, polizza ${FACTS.policy}.</p>`],
        ["Contatti", `<p>E-mail: ${mail}<br>Telefono e WhatsApp: ${FACTS.phone}<br>Punto d'incontro di tutte le uscite: ${FACTS.point}</p>`],
        ["Hosting", `<p>Questo sito è ospitato da ${FACTS.host}.</p>`],
        ["Reclami", `<p>Può presentare reclamo tramite il ${livro("Livro de Reclamações Eletrónico")} ufficiale portoghese, oppure scrivere a ${mail}. Rispondiamo a ogni messaggio.</p>`],
        ["Contenuti", `<p>I testi, le foto e i video di questo sito appartengono a CHIF&amp;CO, Lda, salvo diversa indicazione. Ci chieda il permesso prima di riutilizzarli.</p>`],
        ["I suoi dati e i cookie", `<p>Veda la nostra <a href="/it/privacy">informativa sulla privacy</a> e la nostra <a href="/it/cookies">cookie policy</a>.</p>`],
      ],
    },
    cookies: {
      title: "Cookie Policy", h1: "Cookie policy",
      desc: "Quali cookie usa Chifbay e perché. In breve: nessun cookie pubblicitario né di analisi.",
      body: [
        ["In breve", `<p>Non usiamo cookie pubblicitari né di analisi. Sul suo dispositivo non viene salvato nulla per seguirla.</p>`],
        ["Come misuriamo visite e annunci", `<p>Usiamo Google Analytics 4 e Google Ads, impostati per funzionare senza cookie: Google riceve solo segnali anonimi, senza identificativo. Quando arriva da un annuncio, il riferimento del clic viaggia nell'indirizzo della pagina, non in un cookie.</p><p>Contiamo anche le visualizzazioni di pagina sul nostro server, senza cookie e senza conservare l'indirizzo IP: solo un codice giornaliero che non porta a lei.</p>`],
        ["Cosa viene salvato sul suo dispositivo", `<p>Solo ciò che serve al sito per funzionare come lei ha scelto: il tema chiaro o scuro e un breve segno per la transizione tra pagine, che scompare alla chiusura della scheda. Non è tracciamento.</p>`],
        ["Se ha accettato i cookie in passato", `<p>I visitatori che hanno accettato i cookie in una visita precedente possono avere ancora due cookie: <code>cb_consent</code> (la loro risposta, fino a 180 giorni) e <code>cb_attr</code> (quale annuncio li ha portati, fino a 90 giorni). Può eliminarli in qualsiasi momento dalle impostazioni del browser.</p>`],
        ["Terze parti", `<p>La mappa delle nostre pagine viene caricata da Google solo quando preme «Mostra la mappa», e Google può allora impostare i propri cookie. Il nostro fornitore di pagamenti, Stripe, può impostare cookie necessari al pagamento sicuro e alla prevenzione delle frodi quando paga.</p>`],
        ["Domande", `<p>Scriva a ${mail}. Altro sui suoi dati nella nostra <a href="/it/privacy">informativa sulla privacy</a>.</p>`],
      ],
    },
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const PAGES = [["legal-notice", "notice"], ["cookies", "cookies"]];
let written = 0;
const sitemapAdd = [];

for (const lang of LANGS) {
  const src = join(SITE, dirOf(lang), "privacy.html");
  if (!existsSync(src)) { console.error(`missing ${src}`); process.exit(1); }
  const h = readFileSync(src, "utf8");
  const cut = h.indexOf("<footer>");
  if (cut < 0) { console.error(`no <footer> in ${src}`); process.exit(1); }
  const tail = h.slice(cut);
  let head = h.slice(0, cut);

  for (const [slug, key] of PAGES) {
    const c = T[lang][key];
    const url = `${BASE}/${lang === "en" ? "" : lang + "/"}${slug}`;
    let p = head;
    p = p.replace(/<title>[^<]*<\/title>/, `<title>${c.title} | Chifbay</title>`);
    p = p.replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(c.desc)}"`);
    p = p.replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(c.title)} | Chifbay"`);
    p = p.replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(c.desc)}"`);
    p = p.replace(/(https:\/\/chifbay\.com\/(?:[a-z]{2}\/)?)privacy(?:\.html)?/g, `$1${slug}`);
    p = p.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
    const ld = JSON.stringify({
      "@context": "https://schema.org", "@type": "WebPage", name: c.h1, headline: `${c.title} | Chifbay`,
      description: c.desc, url, inLanguage: lang,
      isPartOf: { "@type": "WebSite", name: "Chifbay", url: `${BASE}/` },
      publisher: { "@type": "Organization", name: "Chifbay", url: BASE },
    });
    p = p.replace("</head>", `<script type="application/ld+json">${ld}</script>\n</head>`);
    p = p.replace(/(<div class="hbadge rv in">)[^<]*(<\/div>)/, `$1${T[lang].badge}$2`);
    p = p.replace(/(<h1 class="rv in"[^>]*>)[^<]*(<\/h1>)/, `$1${c.h1}$2`);
    const body = c.body.map(([h2, html]) => `      <h2>${h2}</h2>\n      ${html}`).join("\n\n");
    p = p.replace(/(<article class="article rv">)[\s\S]*?(<\/article>)/, `$1\n${body}\n    $2`);
    const out = join(SITE, dirOf(lang), `${slug}.html`);
    const prev = existsSync(out) ? readFileSync(out, "utf8") : "";
    if (prev !== p + tail) { written++; if (WRITE) writeFileSync(out, p + tail); }
    sitemapAdd.push(url);
  }
}

// sitemap
const smPath = join(SITE, "sitemap.xml");
let sm = readFileSync(smPath, "utf8"), added = 0;
const today = new Date().toISOString().slice(0, 10);
for (const u of sitemapAdd) {
  if (sm.includes(`<loc>${u}</loc>`)) continue;
  sm = sm.replace("</urlset>", `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq></url>\n</urlset>`);
  added++;
}
if (WRITE && added) writeFileSync(smPath, sm);
console.log(`${WRITE ? "WRITTEN" : "DRY RUN (add --write)"}: ${written} page(s) changed, ${added} sitemap URL(s) added`);
