import re
base='/home/runner/work/chifbay-site/chifbay-site/'
s=open(base+'posts/how-eco-friendly-is-a-boat-trip-in-madeira.html',encoding='utf8').read()
def R(a,b):
    global s
    assert a in s,a[:60]
    s=s.replace(a,b)
R('../assets/','../../assets/'); R('../peak.min','../../peak.min'); R('href="../experiences"','href="../../experiences"'); R('href="../hidden','href="../../hidden'); R('href="../sunset','href="../../sunset')
R('<html lang="en">','<html lang="pt">')
R('https://chifbay.com/posts/how-eco-friendly-is-a-boat-trip-in-madeira"/>\n<meta name="robots"','https://chifbay.com/pt/posts/how-eco-friendly-is-a-boat-trip-in-madeira.html"/>\n<meta name="robots"')
R('<link rel="stylesheet" href="/marina.min.css"/>\n','<link rel="stylesheet" href="/marina.min.css"/>\n<meta property="og:url" content="https://chifbay.com/pt/posts/how-eco-friendly-is-a-boat-trip-in-madeira.html"/>\n<meta property="og:locale" content="pt"/>\n')
T='Passeio de barco na Madeira: qual é o impacto ambiental?'
R('How Eco-Friendly Is a Boat Trip in Madeira? | Chifbay',T)
D='Um passeio de barco a motor na Madeira nunca tem baixo impacto. O que pesa: a velocidade, o trato com a vida selvagem, o que cai ao mar e quantos o partilham.'
R('A motor boat trip is not low-impact. What changes the harm is speed, how the boat treats wildlife, what goes in the sea and how many share it. The trade-offs.',D)
H='Passeio de barco na Madeira é ecológico? Uma resposta honesta'
R('How Eco-Friendly Is a Boat Trip in Madeira? An Honest Answer',H)
R('No motor boat trip is green. Speed, wildlife, sunscreen and rubbish: the honest trade-offs of a boat trip in Madeira.','Nenhum passeio de barco a motor é verde. Velocidade, vida selvagem, protetor solar e lixo: o que está realmente em causa num passeio de barco na Madeira.')
R('A loggerhead turtle at the surface while a small boat waits well back','Uma tartaruga-comum à superfície, enquanto um barco pequeno espera bem afastado')
R('Giving a turtle room','Dar espaço a uma tartaruga')
FAQ=[('Is a sailing catamaran greener than a motor boat?','Um catamarã à vela é mais ecológico do que um barco a motor?'),
('Only when it is actually under sail. Ask how much of the route is sailed and how much is motored.','Só quando navega mesmo à vela. Pergunte que parte do percurso é feita à vela e que parte é a motor.'),
('Do boat trips in Madeira disturb dolphins?','Os passeios de barco na Madeira incomodam os golfinhos?'),
('They can, which is why Madeira bans active approaches closer than 50 metres, sets speed limits near the animals and allows each boat 10 minutes in the watching zone.','Podem incomodar, e é por isso que a Madeira proíbe aproximações ativas a menos de 50 metros, impõe limites de velocidade junto dos animais e permite a cada barco 10 minutos na zona de observação.'),
('What sunscreen is best for swimming in the sea?','Qual é o melhor protetor solar para tomar banho no mar?'),
('A water-resistant mineral sunscreen based on zinc oxide, used with a UV shirt and a hat so you need less of it.','Um protetor solar mineral resistente à água, à base de óxido de zinco, usado com uma camisola de proteção UV e um chapéu para precisar de menos.'),
('Does a private boat trip use more fuel than a shared tour?','Um passeio de barco privado gasta mais combustível do que um passeio partilhado?'),
('Per person, usually yes, because fewer guests share the fuel. Per stop, a small group puts less pressure on swim spots and wildlife.','Por pessoa, normalmente sim, porque há menos passageiros a dividir o combustível. Por paragem, um grupo pequeno pressiona menos os locais de banho e a vida selvagem.')]
# replace in JSON-LD and (later) body: body gets rebuilt, so only replace within JSON part first
k=s.index('</script>',s.index('"FAQPage"'))
j0=s[:k]
for a,b in FAQ: j0=j0.replace(a,b)
s=j0+s[k:]
R('alt="Chifbay — private boat tours in Madeira, Funchal"','alt="Chifbay — passeios de barco privados na Madeira, Funchal"')
R('>Experiences</a>','>Experiências</a>'); R('>Boat &amp; Crew</a>','>Barco e tripulação</a>'); R('>Practical info</a>','>Informações práticas</a>'); R('>Our reviews</a>','>As nossas avaliações</a>'); R('>Leave a review</a>','>Deixe uma avaliação</a>'); R('>Book now</a>','>Reservar</a>')
R('Journal · Experience','Journal · Experiência')
R('<h1 class="rv in" style="font-size:clamp(2.2rem,5vw,4rem);max-width:20ch">How Eco-Friendly Is a Boat Trip in Madeira? An Honest Answer','<h1 class="rv in" style="font-size:clamp(2.2rem,5vw,4rem);max-width:20ch">'+H)
R('>By <a','>Por <a'); R('18 November 2026','18 de novembro de 2026'); R('5 min read','5 min de leitura')
R('Not very, if we are honest. A motor boat burns fuel, and no trip on one is low-impact. What changes the harm is how the boat is run: how fast it goes, how it treats wildlife, what goes into the sea, and how many people share the trip.','Pouco, para ser honesto. Um barco a motor gasta combustível e nenhum passeio num barco assim tem baixo impacto. O que faz variar o dano é a forma como o barco é conduzido: a velocidade, o trato com a vida selvagem, o que vai parar ao mar e quantas pessoas partilham o passeio.')
i=s.index('<h2>Is a small boat'); j=s.index('</article>')
body=open(base+'scripts/data/tmp-loc-pt-eco-body.html',encoding='utf8').read()
s=s[:i]+body+s[j:]
R('<b>About Chifbay</b>Chifbay runs private boat trips in Madeira from Marina do Funchal, Pontoon C: one boat, one group at a time, up to 5 guests, with two local skippers. Day trips with a swim at Fajã dos Padres from €500 and sunset cruises from €400, for the whole boat. Licensed maritime tourism operator (RNAAT 305/2026). <a href="/about">Our story</a> · <a href="/experiences">The trips</a>','<b>Sobre a Chifbay</b>A Chifbay faz passeios de barco privados na Madeira a partir da Marina do Funchal, Pontão C: um barco, um grupo de cada vez, até 5 pessoas, com dois skippers locais. Passeio de Dia com banho na Fajã dos Padres desde €500 e passeio ao pôr do sol desde €400, preço para o barco inteiro. Operador marítimo-turístico licenciado (RNAAT 305/2026). <a href="/about">A nossa história</a> · <a href="/experiences">Os passeios</a>')
R('Enjoying our Madeira guides?','Gosta dos nossos guias da Madeira?'); R('Add Chifbay as a preferred source on Google','Adicione a Chifbay como fonte preferida no Google')
R('Your group only','Só o seu grupo'); R('See Madeira from the water with Chifbay','Veja a Madeira do mar com a Chifbay')
R('Private boat trips from Funchal — dolphins, hidden coves, Cabo Girão and golden-hour sunsets. The boat is yours alone.','Passeios de barco privados a partir do Funchal — golfinhos, enseadas escondidas, Cabo Girão e pores do sol na hora dourada. O barco é só seu.')
R('Explore the experiences →','Descobrir as experiências →'); R('>Day Trip</a> · <a href="../../sunset-cruise" style="color:var(--teal)">Sunset Trip<','>Passeio de Dia</a> · <a href="../../sunset-cruise" style="color:var(--teal)">Passeio ao Pôr do Sol<')
R('Private boat tours from Funchal, Madeira. Snorkeling in hidden coves, Cabo Girão and luxury sunset cruises — your group only, always.','Passeios de barco privados a partir do Funchal, Madeira. Snorkeling em enseadas escondidas, Cabo Girão e cruzeiros de luxo ao pôr do sol — só o seu grupo, sempre.')
R('aria-label="Colour theme"','aria-label="Tema de cores"'); R('/svg>Light</button>','/svg>Claro</button>'); R('/svg>Dark</button>','/svg>Escuro</button>')
R('<h3>Book</h3>','<h3>Reservar</h3>'); R('>Book the Day Trip<','>Reservar o Passeio de Dia<'); R('>Book the Sunset Trip<','>Reservar o Passeio ao Pôr do Sol<'); R('>All experiences<','>Todas as experiências<')
R('>Private boat tour<','>Passeio de barco privado<'); R('>Cabo Girão boat tour<','>Passeio de barco ao Cabo Girão<'); R('>Fajã dos Padres trip<','>Passeio à Fajã dos Padres<'); R('>Boat with skipper<','>Barco com skipper<'); R('>Boat trips in Madeira<','>Passeios de barco na Madeira<')
R('<h3>Contact</h3>','<h3>Contacto</h3>'); R('>Contact</a>','>Contacto</a>')
R('aria-label="Chifbay on Instagram','aria-label="Chifbay no Instagram'); R('aria-label="Chifbay on Facebook','aria-label="Chifbay no Facebook'); R('aria-label="Chifbay on TikTok','aria-label="Chifbay no TikTok'); R('aria-label="Chifbay on TripAdvisor','aria-label="Chifbay no TripAdvisor'); R('aria-label="Chifbay on Google Reviews"','aria-label="Chifbay nas avaliações do Google"')
R('<h3>Explore</h3>','<h3>Explorar</h3>'); R('Sea-view apartments','Apartamentos com vista para o mar')
R('<h3>The Chifbay app</h3>','<h3>A app Chifbay</h3>'); R('Your booking and the meeting point on your phone, even with no signal.','A sua reserva e o ponto de encontro no telemóvel, mesmo sem rede.'); R('alt="Download on the App Store"','alt="Transferir na App Store"')
R('>Privacy Policy<','>Política de Privacidade<'); R('>Terms<','>Termos<'); R('>Legal notice<','>Aviso legal<')
R('title="Complaints book — the official Portuguese consumer portal"','title="Livro de Reclamações — o portal oficial português do consumidor"')
R('Licensed maritime tourism operator · RNAAT','Operador marítimo-turístico licenciado · RNAAT'); R('Funchal Marina · Built for the Atlantic','Marina do Funchal · Feito para o Atlântico')
open(base+'pt/posts/how-eco-friendly-is-a-boat-trip-in-madeira.html','w',encoding='utf8').write(s)
print(len(T),len(D))
