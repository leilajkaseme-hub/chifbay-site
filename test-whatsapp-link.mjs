// Prouve que le bouton WhatsApp de la page de confirmation produit un lien
// valide, quoi qu il arrive dans les donnees de la reservation.
//
// Le risque reel: un nom avec une apostrophe ou un accent, ou un champ absent,
// et le client tombe sur un lien casse juste apres avoir paye 400 euros.
import fs from "node:fs";
const here = "/Users/Shared/Claude/stores/chifbay/site/booking-done.html";
const t = fs.readFileSync(here, "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)); };

const m = t.match(/function waHref\(bk, prettyDay\) \{[\s\S]*?\n      \}/);
ok(Boolean(m), "waHref existe dans la page");
if (!m) { console.log("\n0 passed, 1 failed"); process.exit(1); }
const waHref = eval("(" + m[0].replace("function waHref", "function") + ")");

const full = waHref(
  { label: "The Sunset Trip · To Cabo Girão", time: "18:30", guests: 2, name: "Jennifer Collmann" },
  "Monday, 28 September 2026");
const u = new URL(full);
ok(u.host === "wa.me", "le lien va bien sur wa.me");
ok(u.pathname === "/351937200320", "le numero est celui affiche partout sur le site");
const text = u.searchParams.get("text");
ok(text.startsWith("Hi Chifbay! I just booked a trip with you."),
   "le message est a la premiere personne, c est le client qui ecrit");
// Un "hey j ai reserve" tout seul obligerait a demander qui c est.
ok(/Trip: .*Sunset/.test(text), "la sortie est dans le message");
ok(/Date: Monday, 28 September 2026 at 18:30\./.test(text), "la date et l heure y sont");
ok(/Guests: 2\./.test(text), "le nombre de personnes y est");
ok(/Name: Jennifer Collmann\./.test(text), "le nom y est, on sait tout de suite qui ecrit");
ok(text.includes("Cabo Girão"), "les accents survivent a l encodage");

console.log("\nles donnees qui cassent un lien mal fait");
const odd = waHref({ label: "Sunset · Cabo Girão & co", time: "18:30", guests: 5,
                     name: "O'Brien <Ana> & Zoë" }, "Sunday, 5 October 2026");
const oddText = new URL(odd).searchParams.get("text");
ok(oddText.includes("O'Brien <Ana> & Zoë"),
   "apostrophe, chevrons et esperluette passent sans casser la requete");
ok(!odd.includes(" "), "aucun espace brut dans l URL");

const bare = waHref({}, "");
const bareText = new URL(bare).searchParams.get("text");
ok(bareText === "Hi Chifbay! I just booked a trip with you.",
   "sans aucun detail, le message reste correct au lieu de disparaitre");
ok(!bareText.includes("undefined") && !bareText.includes("null"),
   "jamais d undefined ni de null sous les yeux du client");

console.log("\nla page");
ok(/class="dnwa"/.test(t), "le bouton est rendu dans le cas paye");
ok(/target="_blank" rel="noopener"/.test(t), "il ouvre un nouvel onglet sans fuite de referrer");
ok(/class="dnback"/.test(t), "le retour au site est devenu un lien discret, plus le bouton principal");
ok(!/_wa-preview/.test(fs.readdirSync("/Users/Shared/Claude/stores/chifbay/site").join(" ")),
   "aucun fichier d apercu laisse dans le dossier publie");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
