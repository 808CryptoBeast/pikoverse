/* ═══════════════════════════════════════════════════════════════════
   culturalverse-data.js
   ──────────────────────────────────────────────────────────────────
   HOW TO ADD CONTENT:

   ► Add a new culture:
     Copy a full culture object in CULTURES array, change the id,
     name, emoji, theme, and populate its modules array.

   ► Add a module to an existing culture:
     Find the culture by id, add a new object to its modules array.

   ► Add a lesson to an existing module:
     Find the module by id, add a new object to its lessons array.

   ► Content format inside lesson.content:
     Plain string. Supports these HTML-like tags:
       <h4>Heading</h4>
       <p>Paragraph</p>
       <ul><li>Item</li></ul>
       <callout>Highlighted note</callout>
       <callout type="gold">Gold variant</callout>
       <callout type="bridge">Bridge/connection variant</callout>
       <facts>val::key | val::key | val::key</facts>
       <twocol left="Label" right="Label">left content || right content</twocol>
       <quote cite="Source">Quote text</quote>
       <concepts>Word · Word · Word</concepts>
═══════════════════════════════════════════════════════════════════ */

const CULTURALVERSE_DATA = {

  /* ─────────────────────────────────────────────────────────────
     CULTURES
  ───────────────────────────────────────────────────────────────*/
  cultures: [

    /* ══════════════════════════════════════════════════════════
       KĀNAKA MAOLI
    ══════════════════════════════════════════════════════════ */
    {
      id:      'kanaka',
      name:    'Kānaka Maoli',
      emoji:   '🌺',
      tagline: 'Hawaiian Indigenous Knowledge',
      theme:   'emerald',   // controls color scheme
      status:  'live',
      intro:   'The Native Hawaiian people developed one of the most sophisticated civilizations in the Pacific over more than 1,500 years. These lessons explore the depth of Hawaiian knowledge — from cosmic creation to ecological engineering — as a living tradition, not a historical artifact.',

      modules: [

        /* ── MODULE 1: COSMOLOGY ── */
        {
          id:    'kanaka-cosmology',
          title: 'Cosmology & Creation',
          emoji: '🌊',
          desc:  'The Hawaiian understanding of the origins of the cosmos, life, and humanity.',
          lessons: [
            {
              id:       'km-kumulipo',
              num:      'KM·01',
              title:    'The Kumulipo — Sacred Chant of Creation',
              readTime: '12 min',
              content: `
<p class="lead">The Kumulipo is one of the most profound sacred texts in all of Polynesian literature — a <em>mele koʻihonua</em> (chant of creation and genealogy) of approximately <strong>2,102 lines</strong>, organized into <strong>16 wā</strong> (epochs). Its name reveals everything: <em>Kumu</em> (source, origin) + <em>Lipo</em> (the deep dark blue-black of the ocean's depths) = <strong>"Beginning in Deep Darkness."</strong></p>

<facts>2,102::Lines in the Chant|16 Wā::Epochs / Sections|~1700 CE::Approximate Composition|1897::First English Translation</facts>

<h4>Origins & Transmission</h4>
<p>The Kumulipo was composed approximately in the early 18th century, traditionally attributed to the poet <strong>Keaulumoku</strong> and composed for the birth of <strong>Kalaninuiamamao</strong>, an aliʻi (chief) of the Kamehameha lineage. For generations it was transmitted entirely through oral tradition — memorized, chanted, and passed down with ritual precision. King <strong>Kalākaua</strong> first committed it to writing in the 19th century. <strong>Queen Liliʻuokalani</strong> — the last sovereign monarch of Hawaiʻi — translated it into English, published in 1897. The definitive scholarly translation was produced by Martha Beckwith in 1951.</p>

<callout>The opening line of the Kumulipo: <strong>"O ke au i kahuli wela ka honua"</strong> — "At the time when the earth became hot." Creation begins not in the void, but in heat — the primordial conditions of a world coming into being.</callout>

<h4>Structure: The Two Great Epochs</h4>
<p>The 16 wā divide into two great movements that mirror the cosmic arc from darkness to light:</p>

<twocol left="Wā 1–8 · The Pō (Darkness)" right="Wā 9–16 · The Ao (Light)">The age of darkness and the natural world. Creation begins with the simplest marine organisms — the coral polyp — and unfolds through progressive stages of increasing complexity: sea creatures, plants, land animals. Each wā introduces paired beings (male and female), revealing a deeply dualistic understanding of creation. Modern scholars have noted this progression from simple marine life to complex organisms parallels evolutionary biology — remarkable in an oral tradition centuries before Darwin.||The age of light and humanity. Here the chant transitions from cosmic creation to the genealogy of the aliʻi — the sacred chiefs of Hawaiʻi. By connecting human lineage to the first stirrings of life in the primordial darkness, the Kumulipo makes a profound statement: humans are not separate from nature. We are the continuation of the same creative force that produced the first coral.</twocol>

<h4>Wā 1: The First Life — Ko'a</h4>
<p>The first wā opens in the deepest pō (darkness). The first paired living beings introduced are the <strong>koʻa</strong> (coral, the coral polyp) as the male form, paired with its female counterpart. From this single pairing, an unfolding cascade of life begins — each wā introducing new creatures, always in pairs, always building on what came before. The sea is the womb. Darkness is not absence — it is potential.</p>

<h4>Why This Matters</h4>
<callout>The Kumulipo is not mythology in the dismissive Western sense. It is a sophisticated cosmological and genealogical system that encodes the Hawaiian understanding of the universe — that all life is related, that humans emerge from the same creative process as coral and fish and stars, and that the chiefs who govern carry the responsibility of that entire lineage within their bodies. The whitepaper is publicly available: it is called the Kumulipo, and reading it is one of the most valuable hours you can spend understanding Hawaiian thought.</callout>
`
            },
            {
              id:       'km-wakea',
              num:      'KM·02',
              title:    'Wākea & Papahānaumoku — The Sky Father and Earth Mother',
              readTime: '8 min',
              content: `
<p class="lead">Beyond the Kumulipo's cosmic genealogy, the creation narrative of <strong>Wākea</strong> (sky father) and <strong>Papahānaumoku</strong> (earth mother) provides the deepest spiritual framework for the Hawaiian relationship to land, family, and food. This is the story that makes kalo the elder sibling of all human beings.</p>

<h4>The Names Themselves</h4>
<p><strong>Wākea</strong> means "wide expanse" — the sky, infinite space, the masculine expansive principle. <strong>Papahānaumoku</strong> means "she who gives birth to islands" — Papa (flat foundation, earth) + hānau (to give birth) + moku (island). The earth mother is literally defined by her generative act: birthing the islands of Hawaiʻi.</p>

<h4>The Birth of Hāloa</h4>
<p>Wākea and Papahānaumoku had a child together — but this child was stillborn, born too early and not fully formed. Rather than discarding this child, they planted the baby in the earth. From that sacred burial, the first <strong>kalo</strong> (taro) plant grew. Its name: <strong>Hāloa-naka</strong> — "the trembling long stalk."</p>
<p>Wākea and Papahānaumoku had a second child — this one fully alive, fully human. This child was named <strong>Hāloa</strong> — named in honor of his elder sibling, the kalo plant that preceded him and nourished him.</p>

<callout>This genealogy is one of the most ethically profound ecological relationships in any culture's tradition. Kalo is not a crop. Kalo is your elder sibling. To pull taro from the ground is not agriculture — it is receiving nourishment from your ancestor. To damage or waste kalo is to disrespect your elder. To tend the loʻi is to fulfill your obligation to your family. The entire Hawaiian relationship to land, food, and agriculture flows from this genealogical truth.</callout>

<h4>The Islands as Family</h4>
<p>The islands themselves are children of Papahānaumoku and Wākea — born in sequence, each with its own name and personality. Hawaiʻi (the Big Island) is the eldest, then Maui, Kahoʻolawe, Lānaʻi, Molokaʻi, Oʻahu, Kauaʻi, Niʻihau. Each island is not a place — it is a being, a family member, an ancestor. <strong>Aloha ʻāina</strong> — love of the land — is not a sentiment. It is the natural expression of knowing that the land is your relative.</p>
`
            },
          ]
        },

        /* ── MODULE 2: NAVIGATION ── */
        {
          id:    'kanaka-navigation',
          title: 'Wayfinding & Navigation',
          emoji: '⭐',
          desc:  'The science and art of navigating the Pacific by stars, swells, birds, and sky.',
          lessons: [
            {
              id:       'km-starcompass',
              num:      'KM·03',
              title:    'The Star Compass — Navigating by Hōkūleʻa and 150 Stars',
              readTime: '10 min',
              content: `
<p class="lead">For over a thousand years before European contact, Polynesian navigators sailed vast stretches of open ocean across the largest ocean on Earth — without compasses, maps, or instruments. They used the stars, ocean swells, wind, cloud formations, bird behavior, and the color and temperature of the water itself. This is not primitive navigation. It is one of humanity's greatest scientific and intellectual achievements.</p>

<facts>Hokūleʻa::Zenith Star of Hawaiʻi (Arcturus)|32::Star Houses on the Horizon Compass|~150–200::Stars Memorized by Master Navigators|2,500 mi::Hawaiʻi to Tahiti (open ocean)</facts>

<h4>The Star Compass</h4>
<p>Hawaiian navigators built a mental star compass by dividing the horizon into <strong>32 houses</strong> — directions defined by where specific stars rise and set on the horizon. Every star rises in the east and sets in the west at a consistent bearing, varying only with the observer's latitude. A navigator memorized each star's rising and setting points and used them to know direction at any hour of the night.</p>
<p>The zenith star of Hawaiʻi — the star that passes directly overhead — is <strong>Hōkūleʻa (Arcturus)</strong>. When Hōkūleʻa sits directly overhead, you are at the latitude of Hawaiʻi (~21°N). Navigators used the zenith star as a latitude fix: when it's overhead, you're home.</p>

<h4>Reading the Ocean Swells</h4>
<p>Stars only work on clear nights. The deeper art involved reading the ocean itself. The Pacific has <strong>deep ocean swells</strong> — long, regular waves generated by distant weather systems — that travel in consistent directions regardless of local wind. A skilled navigator could feel these swells through the hull of the canoe and through their own body lying on the deck with eyes closed.</p>
<p>Different swells come from different directions. By reading swell direction even on a cloudy night, a navigator always knew their orientation — sometimes with eyes closed, feeling the rhythm of the water through the wood beneath them.</p>

<h4>Other Signs of Land and Direction</h4>
<ul>
<li><strong>Birds:</strong> The kōlea (golden plover) migrates between Hawaiʻi and Alaska on a known path. Specific seabirds are only found within certain distances of land — their presence signals an island before it is visible on the horizon.</li>
<li><strong>Cloud formations:</strong> Islands create distinctive stationary cloud formations 20–30 miles away. Cumulus clouds tend to form and remain over land due to heat differentials. A cloud that doesn't move on a clear day often means land beneath it.</li>
<li><strong>Ocean color and smell:</strong> Near islands the water changes color from reef sediment and freshwater runoff. Vegetation can be smelled 20 miles offshore on the right wind.</li>
<li><strong>Phosphorescence:</strong> Underwater phosphorescence patterns change near islands. Current directions shift around landmasses in predictable ways.</li>
</ul>

<callout>Kilokilo Hōkū — "star gazing" — was a sacred science. The navigator held not just technical knowledge but spiritual responsibility: every life on the canoe depended on their clarity of mind and their relationship with the stars, wind, and ocean. Navigation was a practice of alignment — with the natural world and with oneself.</callout>
`
            },
            {
              id:       'km-hokuleaa',
              num:      'KM·04',
              title:    'Hōkūleʻa — The Voyaging Canoe & the Revival of Wayfinding',
              readTime: '8 min',
              content: `
<p class="lead">By the mid-20th century, traditional wayfinding had been nearly completely lost. In 1973, the Polynesian Voyaging Society was founded with a mission: prove that ancient Polynesians could have intentionally sailed and settled the Pacific — and revive the knowledge that nearly died. The result was one of the most important cultural achievements of the 20th century.</p>

<facts>1973::Polynesian Voyaging Society Founded|1976::First Voyage Hawaiʻi to Tahiti|62 ft::Length of Hōkūleʻa|2014–2017::Worldwide Voyage (Mālama Honua)</facts>

<h4>Building Hōkūleʻa</h4>
<p><strong>Hōkūleʻa</strong> — named for Arcturus, the zenith star of Hawaiʻi — is a 62-foot double-hulled voyaging canoe modeled on traditional designs from petroglyphs, oral tradition, and the accounts of early European observers. She was built by hand and launched in 1975. In <strong>1976</strong>, navigator <strong>Mau Piailug</strong> of Satawal, Micronesia — one of the last living traditional navigators in the Pacific — guided Hōkūleʻa from Hawaiʻi to Tahiti using only traditional navigation. No instruments. No compass. No maps. 2,500 miles of open ocean in 30 days.</p>

<h4>Nainoa Thompson and the Hawaiian Revival</h4>
<p><strong>Nainoa Thompson</strong> (born 1953, Oʻahu) became the apprentice of Mau Piailug and dedicated years to rebuilding the star compass from first principles — studying astronomy, memorizing star paths, learning to feel the swells. In 1980, he became the first Hawaiian in approximately 600 years to navigate by the stars alone. He has since guided Hōkūleʻa and sister canoes on voyages throughout the Pacific, to Japan, and on the Mālama Honua (2014–2017) worldwide voyage — 47,000 miles across 27 countries.</p>

<callout type="gold">The revival of wayfinding was not only a technical achievement. It was a cultural and spiritual restoration. When Hawaiian youth learned that their ancestors had navigated half the globe by the stars, the shame that colonialism had planted — the idea that Hawaiian knowledge was primitive — began to dissolve. The canoe became a vehicle not just of navigation but of healing. This is what indigenous knowledge restoration does when it succeeds.</callout>

<h4>What Hōkūleʻa Proved</h4>
<p>Hōkūleʻa's voyages answered the question that colonial scholarship had spent a century trying to muddy: Did Polynesian people intentionally navigate and settle the Pacific, or did they drift there by accident? The answer is definitive — they navigated. Every island in Polynesia, from Aotearoa (New Zealand) to Rapa Nui (Easter Island) to Hawaiʻi, was found, settled, and connected by intentional, skilled, deeply scientific ocean navigation. It was not luck. It was genius.</p>
`
            }
          ]
        },

        /* ── MODULE 3: LAND & ECOLOGY ── */
        {
          id:    'kanaka-land',
          title: 'Land, Ecology & Governance',
          emoji: '🌿',
          desc:  'The ahupuaʻa system, loʻi kalo, and loko iʻa — Hawaiian ecological intelligence.',
          lessons: [
            {
              id:       'km-ahupuaa',
              num:      'KM·05',
              title:    'The Ahupuaʻa — A Complete World in One Land Division',
              readTime: '10 min',
              content: `
<p class="lead">The ahupuaʻa is one of the most sophisticated land and resource management systems ever developed by any civilization on Earth. It was not just a political boundary — it was a complete ecological unit, a living system designed to sustain human communities in perfect relationship with their environment, from the highest mountain peak to the deepest ocean.</p>

<h4>What the Word Means</h4>
<p><strong>Ahu</strong> (altar/mound) + <strong>Puaʻa</strong> (pig) = a stone altar topped with the carved image of a pig's head, placed at territorial boundaries. When traveling along a ridge or coastal road and encountering an ahu puaʻa, you knew you were crossing from one community's land into another. These physical markers expressed a sophisticated system of resource sovereignty.</p>

<h4>The Shape: Mountain to Sea</h4>
<p>Each ahupuaʻa ran in a wedge shape from the mountain ridgeline (<em>mauka</em>) to the sea (<em>makai</em>), following a watershed — the path water naturally takes from mountain to ocean. This design meant every ahupuaʻa had access to every ecological zone needed for complete human survival:</p>

<ul>
<li><strong>Wao Akua</strong> (Realm of the Gods) — High mountain forest, cloud cover, the source of all fresh water. Sacred, protected, not for human habitation. This zone collected rainfall and fed all the streams below.</li>
<li><strong>Wao Koa</strong> (Realm of Warriors) — Upland forest. Timber for canoes, medicine plants, bird feathers for aliʻi regalia. Carefully managed harvesting.</li>
<li><strong>Wao Kanaka</strong> (Realm of People) — Agricultural lands. Loʻi kalo (taro paddies), gardens, sweet potato fields. The productive heart of the ahupuaʻa.</li>
<li><strong>Kahakai</strong> (Coastline) — Loko iʻa (fishponds), salt production, shoreline fishing. The boundary between land and sea.</li>
<li><strong>Kai</strong> (The Sea) — The ahupuaʻa extended into the ocean: offshore fishing zones, seaweed harvesting, canoe navigation routes.</li>
</ul>

<h4>The Konohiki: Resource Manager</h4>
<p>Each ahupuaʻa was overseen by a <strong>konohiki</strong> — a resource manager appointed by the aliʻi (chief). The konohiki regulated fishing seasons, controlled water flow through irrigation channels, managed access to forest resources, and ensured resources were used sustainably. This was not charity — it was ecological intelligence. Over-harvesting any zone would destabilize the entire system.</p>

<callout>The ahupuaʻa sustained a Hawaiian population estimated at 300,000 to 1,000,000 people — entirely from island resources, without external trade — for over 1,000 years. No landfill. No watershed pollution. Complete circularity of nutrients from mountain to sea and back through the bodies of fish, birds, and humans. Modern ecological sustainability science is still catching up to what Hawaiian communities understood a millennium ago.</callout>
`
            },
            {
              id:       'km-loikalo',
              num:      'KM·06',
              title:    'Loʻi Kalo & Loko Iʻa — Sacred Agriculture and Aquaculture',
              readTime: '10 min',
              content: `
<p class="lead">Two systems defined Hawaiian food sovereignty at a level unmatched in the pre-contact Pacific: the <strong>loʻi kalo</strong> (wetland taro paddies) and the <strong>loko iʻa</strong> (fishponds). Together they formed the nutritional foundation of Hawaiian civilization — one rooted in the land, one in the sea, both expressing the understanding that food production is a spiritual act.</p>

<h4>Loʻi Kalo — The Sacred Taro Paddy</h4>
<p>Kalo (taro) is the elder sibling of humanity in Hawaiian tradition (see KM·02). To cultivate kalo is to tend your ancestor. Loʻi kalo are sophisticated hydraulic systems fed by <strong>ʻauwai</strong> — irrigation channels redirecting mountain stream water through the paddies in continuous flow. This flow oxygenates the water, regulates temperature, delivers nutrients from the mountains, and carries waste downstream. Multiple loʻi were linked in sequence: the outflow of one fed the next, creating a chain of interconnected fields stretching from mountain stream to coastal plain.</p>

<facts>300+::Named Varieties of Kalo|~1000 yrs::Continuous Wetland Agriculture|5 vowels::Hawaiian Language (phonologically rich)|ʻAuwai::The Irrigation Channel System</facts>

<twocol left="ʻAuwai — The Water System" right="Biodiversity of Kalo">Hawaiian farmers built sophisticated ʻauwai networks that could irrigate dozens of loʻi from a single mountain stream. The channels were engineered for gravity flow, minimal evaporation, and nutrient transport. They required constant maintenance — cleaning, repair, flow management — and this maintenance was a community obligation, not an individual one. The water belonged to everyone.||Hawaiian farmers cultivated over 300 named varieties of kalo, each with distinct flavors, textures, colors, and preferred growing conditions. Some varieties grew in wet loʻi; others in dry fields (kula). Some were prized for eating; others for making poi; others for their medicinal properties. This biodiversity was itself a form of resilience — no single disease or drought could destroy the entire food supply.</twocol>

<h4>Loko Iʻa — Hawaiian Fishponds</h4>
<p>The loko iʻa represent one of the most sophisticated aquaculture systems developed by any indigenous culture in the world. At European contact in 1778, there were over <strong>400 documented fishponds</strong> across the Hawaiian Islands — ranging from small family ponds to massive coastal constructions covering hundreds of acres.</p>

<facts>400+::Fishponds at European Contact|88 acres::Heʻeia Fishpond, Oʻahu|4 Types::Main Pond Designs|Mākāhā::The Self-Regulating Sluice Gate</facts>

<h4>The Genius of the Mākāhā</h4>
<p>The loko kuapā (walled coastal fishpond) uses a mākāhā — a sluice gate built into the stone wall, sized so that juvenile fish can swim through the openings into the pond, feeding on the abundant algae inside. As the fish grow, they become too large to pass back through the gate. They are effectively self-harvesting. The fishpond ecosystem is self-sustaining: nutrients from mountain runoff feed algae; algae feeds fish; fish waste feeds more algae. The konohiki managed harvest rates to ensure the pond could replenish itself.</p>

<callout>The loʻi kalo and loko iʻa together embodied the principle of mālama ʻāina — caring for the land. Not as a philosophical abstraction, but as daily practice: you maintain the ʻauwai channels, you observe the mākāhā, you harvest sustainably, you return nutrients to the system. The land and sea care for you only as long as you care for them. This reciprocal relationship is the ethical core of Hawaiian ecological knowledge.</callout>
`
            }
          ]
        },

        /* ── MODULE 4: LANGUAGE & ARTS ── */
        {
          id:    'kanaka-language',
          title: 'Language, Hula & Sacred Arts',
          emoji: '🗣️',
          desc:  'ʻŌlelo Hawaiʻi, hula as living text, and the arts as knowledge systems.',
          lessons: [
            {
              id:       'km-olelo',
              num:      'KM·07',
              title:    'ʻŌlelo Hawaiʻi — The Hawaiian Language',
              readTime: '8 min',
              content: `
<p class="lead">ʻŌlelo Hawaiʻi is one of the most musical languages in the world — built from 5 vowels and 8 consonants, every word a meditation on sound and meaning. It is also a language that nearly died within living memory, and whose revival is one of the most remarkable acts of cultural resistance and restoration in modern history.</p>

<facts>5::Vowels (a, e, i, o, u)|8::Consonants (h, k, l, m, n, p, w, ʻokina)|~1778::Estimated 500,000 Hawaiian speakers|~1981::Fewer than 50 children fluent</facts>

<h4>The Structure of Meaning</h4>
<p>Hawaiian is a polysynthetic language — single words carry layers of compressed meaning. The word <strong>aloha</strong> alone contains: love, peace, compassion, grace, mercy, kindness, the breath of life (alo = presence + ha = breath). Every place name in Hawaiʻi is a story, an ecological observation, or a genealogical record. <strong>Waikīkī</strong> means "spouting waters" — describing the freshwater springs that once defined the area before urbanization. <strong>Honolulu</strong> means "protected bay" or "calm harbor." The landscape was a living text, and the language was the key to reading it.</p>

<h4>The Banning of the Language</h4>
<p>After the illegal overthrow of the Hawaiian Kingdom in 1893, and annexation by the United States in 1898, ʻōlelo Hawaiʻi was banned from schools in 1896. Children were punished for speaking Hawaiian at school. By 1981, fewer than 50 children spoke Hawaiian as their first language. A language that had carried 2,102 lines of the Kumulipo, generations of genealogy, and an entire ecological knowledge system was nearly gone within three generations.</p>

<callout type="gold">In 1983, a group of Hawaiian educators and families created the first Hawaiian language immersion preschool — Pūnana Leo (Language Nest). Today, there are over 20 Pūnana Leo schools and a full Hawaiian-medium school system from preschool through university. An estimated 18,000–20,000 people now speak Hawaiian with varying fluency. The language is not just surviving — it is being transmitted to a new generation of children for whom Hawaiian is their first language. This is what cultural survival looks like from the inside.</callout>
`
            },
            {
              id:       'km-hula',
              num:      'KM·08',
              title:    'Hula — The Body as Sacred Text',
              readTime: '8 min',
              content: `
<p class="lead">Hula is not a performance. It is a technology for the preservation and transmission of knowledge. Every movement — every gesture of the hand, every step of the foot, every expression of the face — encodes specific meaning: genealogy, geography, natural phenomenon, spiritual practice, historical event. The dancer's body is a living library.</p>

<h4>Two Forms of Hula</h4>
<p><strong>Hula kahiko</strong> (ancient hula) — performed with chant (oli or mele) and traditional percussion instruments (pahu drum, ipu gourd). This is ceremonial hula, rooted in the heiau tradition. It was performed for the gods, for the aliʻi, and for specific ritual occasions. The knowledge contained in hula kahiko was considered sacred and was transmitted only through formal apprenticeship with a kumu hula (hula teacher/master).</p>
<p><strong>Hula ʻauana</strong> (modern hula) — developed in the 19th century with Western musical influence, using guitar and ukulele. More accessible and celebratory, but still grounded in the same movement vocabulary and narrative tradition.</p>

<h4>The Hālau Hula</h4>
<p>The hālau hula (hula school) is a sacred institution. The relationship between <strong>kumu hula</strong> (teacher, literally "source of hula") and <strong>haumāna</strong> (student) is not merely educational — it is genealogical and spiritual. The kumu transmits not just technique but the akua (spiritual essence) of the tradition. Students enter into a covenant of respect, discipline, and responsibility for the knowledge they receive.</p>

<callout>When missionaries banned hula in the 1820s, calling it "licentious and heathen," they understood something important about it — they just understood it wrong. Hula was dangerous to colonialism precisely because it was the primary vehicle for transmitting Hawaiian identity, history, and values. Banning the dance was an attempt to sever Hawaiians from their own knowledge. The fact that hula survived, was revived in the Hawaiian Renaissance of the 1970s, and now thrives worldwide is one of the most powerful acts of cultural preservation in human history.</callout>
`
            }
          ]
        }
      ]
    },

    /* ══════════════════════════════════════════════════════════
       KEMET
    ══════════════════════════════════════════════════════════ */
    {
      id:      'kemet',
      name:    'Kemet',
      emoji:   '☥',
      tagline: 'Ancient Egyptian Wisdom — The Teachings of the Black Land',
      theme:   'gold',
      status:  'live',
      intro:   'The ancient Egyptians called their land Kemet — "the Black Land." They were African. Their civilization endured for over 3,000 years and produced knowledge systems in cosmology, ethics, mathematics, medicine, and philosophy that shaped every major civilization that followed. These lessons explore the depth of that knowledge on its own terms — not as the foundation of Western culture, but as African civilization at its height.',

      modules: [

        /* ── MODULE 1: COSMOLOGY ── */
        {
          id:    'kemet-cosmology',
          title: 'Cosmogony & Creation',
          emoji: '☀',
          desc:  'The multiple creation traditions of Kemet — from Nun to the Ennead.',
          lessons: [
            {
              id:       'ke-nun',
              num:      'KE·01',
              title:    'Nun & the Primordial Waters — Before the Beginning',
              readTime: '8 min',
              content: `
<p class="lead"><strong>Nun</strong> — the infinite, dark, primordial waters — is one of the oldest concepts in all human religious thought. It predates the Egyptian written record, which itself is the oldest in the world. Nun is not a god with a face and a story. Nun is the condition that existed before all conditions. Pure potential. Infinite depth. Absolute darkness. From Nun, everything arose.</p>

<h4>What Nun Is</h4>
<p>Nun is not nothingness. The Kemetic mind did not conceive of creation as something arising from nothing (ex nihilo) — that is a later Greek/Christian concept. For the ancient Egyptians, before creation there was <em>something</em>: dark, formless, infinite, and containing all potential. Nun is that something. It is the state of the universe before it organized itself. It is not empty space — it is full of everything that has not yet become anything.</p>

<callout>Nun was understood to still exist at the margins of the created world — the cosmic ocean that surrounded and underlaid the ordered creation. The annual Nile flood was Nun returning: the primordial waters briefly reclaiming the earth before receding and renewing it. Every flood was a mini-re-creation, and every fertile field that emerged from the receding flood was a re-enactment of the first land rising from the primordial waters.</callout>

<h4>The Conditions Within Nun</h4>
<p>The Hermopolitan tradition identified the conditions within Nun as four paired forces — the Ogdoad (Eight). These were not gods acting on the universe; they were the qualities of the universe before it acted on itself:</p>
<ul>
<li><strong>Nun & Naunet</strong> — the primordial waters themselves, the medium of all potential</li>
<li><strong>Heh & Hauhet</strong> — infinite space and infinite time; eternity in all directions</li>
<li><strong>Kek & Kauket</strong> — primordial darkness; the absence of light before light existed</li>
<li><strong>Amun & Amaunet</strong> — the hidden, invisible principle; the cause before the effect</li>
</ul>
<p>These eight existed in dynamic suspension within Nun until the moment of creation — when they collectively generated the Isle of Flame, the first mound of earth rising from the primordial waters, upon which the first sun rose. Creation was not an act of a single god imposing order on chaos — it was the natural unfolding of conditions that had always existed within the darkness.</p>
`
            },
            {
              id:       'ke-ennead',
              num:      'KE·02',
              title:    'The Heliopolitan Ennead — Nine Principles of Creation',
              readTime: '12 min',
              content: `
<p class="lead">The most complete and well-known Kemetic creation tradition comes from <strong>Iunu (Heliopolis)</strong> — the great city of the sun. Its theology produced the Ennead: nine interconnected divine principles that describe the unfolding of creation from nothing to the full world. Each principle is not merely a god — it is a cosmic function, a stage in the emergence of reality.</p>

<facts>Iunu::City of Origin (Heliopolis)|9::Principles of the Ennead|Atum::The Self-Created One|Ra-Atum::Sun as the Totality of Creation</facts>

<h4>Stage 1: Atum — The Self-Created</h4>
<p><strong>Atum</strong> ("The Complete One" or "The One Who Becomes") arose from Nun through self-generation — an act of will and consciousness from within the primordial waters. He stood upon the first primordial mound (the <strong>benben</strong> — the first solid ground emerging from the flood). Atum is the totality of existence made conscious. He contains within himself the seeds of everything that will come into being.</p>
<p>Atum created the next generation through an act of self-generation: from his own body emerged the first pair of divine principles.</p>

<h4>Stage 2: Shu & Tefnut — Air and Moisture</h4>
<p><strong>Shu</strong> (air, space, light, the atmosphere) and <strong>Tefnut</strong> (moisture, rain, the wet element) are the first created pair — and already the pattern is established: creation proceeds through complementary pairs. Neither alone is sufficient. Air without moisture is desert. Moisture without air has no movement. Together they make life possible.</p>

<h4>Stage 3: Geb & Nut — Earth and Sky</h4>
<p><strong>Geb</strong> (the earth — the reclining god whose body is the ground itself) and <strong>Nut</strong> (the sky — the arching goddess whose body forms the vault of heaven) are the children of Shu and Tefnut. Shu separates them, holding Nut above and Geb below — and in this separation, the space for life is created. Nut swallows the sun each evening and gives birth to it each dawn: the original cycle of death and resurrection.</p>

<h4>Stage 4: Osiris, Isis, Set & Nephthys — The Human Principles</h4>
<p>The children of Geb and Nut bring creation into the realm of human experience:</p>
<ul>
<li><strong>Osiris</strong> — divine order, resurrection, the agricultural cycle, the afterlife. The first king. The principle that even death is not an ending.</li>
<li><strong>Isis</strong> — divine magic, the seat of power (her name means "throne"), motherhood, healing. She reassembles Osiris after his murder and conceives Horus — the ultimate act of creative power.</li>
<li><strong>Set</strong> — the desert, storms, chaos, necessary disruption. Not evil — necessary. The force that keeps existence from stagnation. Without Set, there is no conflict; without conflict, no growth.</li>
<li><strong>Nephthys</strong> — the unseen, the margins, darkness, the protection of the dead. She assists Isis in reassembling Osiris. She is the principle of the threshold — the edge between worlds.</li>
</ul>

<callout>Notice the deep architecture: creation begins in darkness and water (Nun), a self-conscious principle arises (Atum), everything unfolds through paired complementary forces (Shu/Tefnut, Geb/Nut), and the final stage brings human experience — love, death, chaos, magic, and resurrection — into the cosmic order. This is not mythology. It is a complete cosmological model.</callout>
`
            },
            {
              id:       'ke-ptah',
              num:      'KE·03',
              title:    'Ptah & the Memphite Theology — Creation Through Word',
              readTime: '8 min',
              content: `
<p class="lead">From <strong>Memphis (Mennefer)</strong>, the theology of <strong>Ptah</strong> offers a radically different and philosophically extraordinary account of creation: the universe was created through thought and speech. This theology — recorded on the Shabaka Stone (~700 BCE but copied from a much older text) — predates the Greek concept of the Logos by over 1,500 years, and the opening of the Gospel of John ("In the beginning was the Word") by approximately 2,700 years.</p>

<h4>Ptah: The Divine Craftsman</h4>
<p>Ptah is depicted as a mummiform figure holding a combined was scepter (power), djed pillar (stability), and ankh (life) — the three principles of creation. He is the patron of craftsmen, architects, and artists, and his name may be the root of the word "Egypt" (Ḥwt-kA-Ptḥ → Aigyptos → Egypt).</p>

<twocol left="Creation Through the Heart (Ib)" right="Creation Through the Tongue (Ns)">Ptah first conceived all things in his mind — the heart (ib) being understood as the seat of thought and intention in Kemetic anatomy. Every being, every principle, every aspect of creation was first a thought in the mind of Ptah. The universe begins as an idea. This is a radical philosophical position: consciousness precedes matter.||Ptah then spoke, and what he had conceived became real. The tongue is the instrument that bridges thought and existence — when Ptah named something, it came into being. The creative power of language is not metaphorical here; it is literal. Words are generative. This idea shaped Kemetic ritual, medicine, and law for 3,000 years.</twocol>

<callout type="gold">The Shabaka Stone records the following: "The Ennead of Ptah is the teeth and lips... which pronounced the name of everything, from which Shu and Tefnut came forth, and which fashioned the Ennead." Ptah's theology subsumes and transcends the Heliopolitan Ennead — rather than replacing it, it explains how Atum himself came to exist: through the creative thought and speech of a deeper principle. This is philosophical sophistication of the highest order.</callout>
`
            }
          ]
        },

        /* ── MODULE 2: MAʻAT ── */
        {
          id:    'kemet-maat',
          title: 'Maʻat — Cosmic Order & Ethics',
          emoji: '⚖️',
          desc:  'The central ethical and cosmological principle of Kemetic civilization.',
          lessons: [
            {
              id:       'ke-maat',
              num:      'KE·04',
              title:    'Maʻat — Truth, Justice, and Cosmic Balance',
              readTime: '10 min',
              content: `
<p class="lead"><strong>Maʻat</strong> is perhaps the most central concept in all of Kemetic thought — a principle so fundamental that it organized everything from the movement of stars to the ethics of daily human conduct. Usually translated as "truth" or "justice," those words are too small. Maʻat is cosmic order itself — the principle that things are as they should be, that truth is spoken, that justice is upheld, that the balance between all forces is maintained. Its opposite, <strong>Isfet</strong> — chaos, untruth, injustice — was not merely wrong. It was cosmically dangerous.</p>

<h4>Maʻat as a Goddess</h4>
<p>Maʻat was personified as a woman wearing a single ostrich feather in her headdress. The feather was her symbol and her instrument — the <strong>Feather of Maʻat</strong>, used in the most important judgment in the Kemetic afterlife tradition: the Weighing of the Heart.</p>

<h4>The Hall of Two Truths: The Weighing of the Heart</h4>
<p>After death, the soul of the deceased was brought to the <strong>Hall of Two Truths</strong>. Here, before a tribunal of 42 divine assessors — one for each of the 42 nomes (provinces) of Egypt — the deceased's heart was placed on a set of scales against the Feather of Maʻat:</p>
<ul>
<li><strong>Anubis</strong> (jackal-headed) oversaw the weighing and guided the soul to judgment.</li>
<li><strong>Thoth</strong> (ibis-headed, god of wisdom and writing) recorded the outcome on his scroll.</li>
<li>The deceased recited the <strong>42 Declarations of Innocence</strong> before each assessor.</li>
<li>Heart lighter than or equal to the feather → welcomed into the Field of Reeds (Aaru), eternal paradise.</li>
<li>Heart heavier than the feather → consumed by <strong>Ammit</strong> (crocodile head, lion front, hippopotamus rear). The soul ceased to exist entirely.</li>
</ul>

<h4>Selected Declarations of Innocence</h4>
<p>The 42 Declarations (often miscalled "Negative Confessions") were statements of alignment with Maʻat — a complete ethical framework:</p>
<concepts>"I have not committed sin" · "I have not robbed with violence" · "I have not murdered" · "I have not told lies" · "I have not stolen food" · "I have not caused pain" · "I have not damaged the fields" · "I have not polluted the water" · "I have not spoken against the poor" · "I have not caused weeping" · "I have not been impatient" · "I have lived with truth"</concepts>

<callout>Notice the scope: these declarations cover interpersonal ethics, environmental ethics, economic justice, and cosmic alignment in a single integrated framework. Harming another person and polluting a river were equally violations of Maʻat — because both disrupted the divine order. This is the most integrated ethical system in ancient history.</callout>
`
            },
            {
              id:       'ke-maat-politics',
              num:      'KE·05',
              title:    'Maʻat as Political Philosophy — The Ruler Serves the Principle',
              readTime: '7 min',
              content: `
<p class="lead">In Kemetic governance, the Pharaoh's primary duty — above all military, administrative, or religious functions — was to <strong>uphold Maʻat</strong>. This was not metaphorical. A pharaoh who ruled unjustly did not merely fail their people — they threatened the continued functioning of the universe. Maʻat was not subject to royal decree. The pharaoh served Maʻat, not the other way around.</p>

<h4>The Pharaoh as Intermediary</h4>
<p>The pharaoh occupied a unique position in Kemetic cosmology: human in body, divine in office. As the representative of the gods on earth, and the representative of humanity before the gods, the pharaoh's role was primarily <strong>maintenance</strong> — of the temples, the rituals, the legal order, and the agricultural system that the Nile made possible. Every morning temple ritual was a re-enactment of creation; every judicial decree was an act of Maʻat or Isfet.</p>

<h4>The Maxims of Ptahhotep (~2400 BCE)</h4>
<p>The Maxims of Ptahhotep — composed by a vizier under Pharaoh Djedkare Isesi during the Old Kingdom — is one of the oldest works of moral philosophy in human history. Selected maxims:</p>
<ul>
<li>"How hard and painful are the last hours of an aged man! He grows weaker every day; his eyes become dim, his ears deaf; his strength fades; his heart knows peace no longer; he cannot speak a word."</li>
<li>"If you are great, humble yourself before those lesser than you."</li>
<li>"Do not be proud because of your knowledge. Consult the ignorant man as well as the wise."</li>
<li>"If you take to wife a spirited woman who is joyful and who is known in her town, if she is fickle and seems to live for the moment, do not reject her; let her eat."</li>
</ul>

<callout type="gold">The Maxims of Ptahhotep contain passages on leadership, humility, family life, and the treatment of others that are indistinguishable in sophistication and compassion from the best moral philosophy of any era. They were written approximately 4,400 years ago. The idea that sophisticated ethical thinking is a recent or Western achievement is a colonial fiction. Kemet was thinking about justice, humility, and the good life millennia before Athens.</callout>
`
            }
          ]
        },

        /* ── MODULE 3: SACRED ARTS ── */
        {
          id:    'kemet-arts',
          title: 'Sacred Arts, Science & Architecture',
          emoji: '𓂀',
          desc:  'Hieroglyphics, sacred geometry, medicine, and the built environment.',
          lessons: [
            {
              id:       'ke-medunetjer',
              num:      'KE·06',
              title:    'Medu Netjer — Words of the Gods',
              readTime: '9 min',
              content: `
<p class="lead">The ancient Egyptians called their writing system <strong>medu netjer</strong> — "words of the gods." One of the oldest writing systems on Earth (~3200 BCE), Egyptian hieroglyphics are not merely a practical tool for record-keeping — they are a sacred technology in which every sign carries spiritual weight, every text is an act of power, and writing itself is understood as creation.</p>

<facts>~3200 BCE::Earliest Hieroglyphic Writing|700+::Standard Hieroglyphic Signs|1822::Decipherment by Champollion|Rosetta Stone::196 BCE (key to decipherment)</facts>

<h4>Three Types of Signs</h4>
<ul>
<li><strong>Logograms (Ideograms):</strong> Signs that represent the thing they depict. A drawing of a sun (𓇳) means "sun." A drawing of a man (𓀀) in the right context means "man."</li>
<li><strong>Phonetic Signs:</strong> Signs representing sounds, not meanings. Egyptian used both single-consonant signs (an alphabet) and multi-consonant signs. Ancient Egyptian was written without vowels — only consonants were recorded, because vowels were considered the breath of the reader and could not be imprisoned in stone.</li>
<li><strong>Determinatives:</strong> Silent signs placed at the end of a word to indicate its category — "this word is about walking," "this word is about divinity," "this word is about a plant." They function like emoji used for disambiguation.</li>
</ul>

<h4>Hieroglyphics as Sacred Technology</h4>
<p>Because hieroglyphics were the words of the gods, writing was understood as an act of creation. To write a name was to bring its owner into existence — which is why kings had their names inscribed everywhere (to ensure their eternal existence) and why enemies would chisel names off monuments (to destroy the person's eternal life). This is also why Thoth — the god of writing and wisdom — was present at the Weighing of the Heart: writing was the technology of truth.</p>

<callout>When Egypt was conquered and eventually lost control of its own narrative, hieroglyphics were forgotten. The last known hieroglyphic inscription was written in 394 CE. For 1,400 years, no one could read them. The Rosetta Stone — inscribed in 196 BCE in three scripts (hieroglyphic, Demotic, and Greek) — was the key that unlocked 3,000 years of recorded human thought. Champollion's decipherment in 1822 was one of the greatest intellectual achievements of the 19th century. Kemet began speaking again.</callout>
`
            },
            {
              id:       'ke-medicine',
              num:      'KE·07',
              title:    'Kemetic Medicine — The Edwin Smith Papyrus & Healing Science',
              readTime: '8 min',
              content: `
<p class="lead">The <strong>Edwin Smith Papyrus</strong> (~1600 BCE, but based on a text from ~2600 BCE) is one of the most remarkable documents in human history: the world's first known surgical manual, describing 48 medical cases with clinical observations, diagnoses, prognoses, and recommended treatments. It represents a mode of medical thinking indistinguishable in approach from modern clinical practice — rational, empirical, based on observation rather than magic.</p>

<facts>48::Documented Cases in Edwin Smith Papyrus|~2600 BCE::Estimated Age of Source Text|Imhotep::Attributed Author (deified later)|700+::Remedies in the Ebers Papyrus</facts>

<h4>The Clinical Method</h4>
<p>Each case in the Edwin Smith Papyrus follows a consistent clinical format:</p>
<ul>
<li><strong>Title:</strong> Name of the injury or condition</li>
<li><strong>Examination:</strong> How to examine the patient; what to look for</li>
<li><strong>Diagnosis:</strong> "This is a condition I can treat" / "a condition I will contend with" / "a condition that cannot be treated"</li>
<li><strong>Treatment:</strong> Specific interventions — suturing, splinting, poultices, herbs, rest</li>
<li><strong>Prognosis:</strong> Expected outcome</li>
</ul>
<p>This format is nearly identical to the SOAP (Subjective, Objective, Assessment, Plan) framework used in modern medical documentation. Egyptian physicians 4,600 years ago were practicing evidence-based medicine.</p>

<h4>Specific Achievements</h4>
<ul>
<li>The papyrus contains the first recorded descriptions of the brain, meninges, cerebrospinal fluid, and the surface of the brain (the convolutions). The physician noted that brain injuries caused dysfunction on the opposite side of the body — the concept of contralateral brain function, "rediscovered" in the 19th century.</li>
<li>The Ebers Papyrus (1550 BCE) describes the cardiovascular system, with the heart as the center — and notes that the pulse can be felt "in every limb."</li>
<li>Egyptian dentistry is documented from ~2900 BCE — fillings, extractions, and prosthetics.</li>
<li>The concept of patient privacy was practiced: physicians were bound by an early form of medical ethics.</li>
</ul>

<callout type="gold">When Hippocrates — often called the "father of medicine" — traveled to Egypt in the 5th century BCE, he was visiting a medical tradition that was already 2,000 years old. The idea that rational medicine began in Greece requires ignoring everything that Kemet was doing while Greece was still in its infancy.</callout>
`
            }
          ]
        }
      ]
    },

    /* ══════════════════════════════════════════════════════════
       THE BRIDGE — separate "culture" for cross connections
    ══════════════════════════════════════════════════════════ */
    {
      id:      'bridge',
      name:    'The Bridge',
      emoji:   '🌐',
      tagline: 'Cross-Cultural Connections — Shared Cosmologies',
      theme:   'bridge',
      status:  'live',
      intro:   'Two civilizations on opposite ends of the Earth, separated by tens of thousands of miles and thousands of years. When you place their creation traditions and ethical frameworks side by side, the parallels are not superficial — they are structural. The same deep architecture of understanding, expressed through different languages and landscapes, pointing to the same cosmic realities.',

      modules: [
        {
          id:    'bridge-cosmology',
          title: 'Shared Cosmologies',
          emoji: '✦',
          desc:  'The five deep connections between the Kumulipo and Kemetic creation traditions.',
          lessons: [
            {
              id:       'bridge-darkness',
              num:      'BR·01',
              title:    'Both Begin in Primordial Darkness and Water',
              readTime: '6 min',
              content: `
<p class="lead">The Kumulipo opens in the deepest <strong>pō</strong> — darkness. Kemetic creation begins with <strong>Nun</strong> — the infinite, dark, primordial waters. Two civilizations on opposite ends of the Earth, with no contact, independently encoded the same cosmic insight: existence does not begin with light. It begins with darkness. And within that darkness is everything that will become.</p>

<twocol left="🌺 Kumulipo" right="☥ Kemet">The opening line: "O ke au i kahuli wela ka honua" — at the time when the earth became hot, in primordial conditions before form, life emerges from darkness and the sea. The ocean is the womb. The first life is the coral polyp — a marine creature — and from there all life unfolds in the deep pō before the light of the ao (day) eventually arrives.||Before all gods, before all things, there was Nun — not empty space, but dark water. Potential without form. From within Nun, Atum arose from himself, and the first mound of earth emerged from the flood. The Ogdoad of Hermopolis floated within Nun until creation began. Even after creation, Nun still exists at the margins of the world — the annual Nile flood is Nun returning.</twocol>

<callout type="bridge"><strong>The Pattern:</strong> Both traditions understood that existence did not begin with light — it began with darkness. Not absence, but pregnant potential. The deep ocean and the primordial flood are the same metaphor: formless, dark, filled with the possibility of everything. This may be one of the deepest perceptions available to the human mind about the nature of reality — and two ancient peoples arrived at it independently.</callout>
`
            },
            {
              id:       'bridge-pairs',
              num:      'BR·02',
              title:    'Creation Through Paired Complementary Forces',
              readTime: '6 min',
              content: `
<p class="lead">Throughout all 16 wā of the Kumulipo, creation proceeds through pairs — every living thing introduced in a male/female counterpart. The Kemetic Ogdoad consists entirely of four male/female pairs. The Ennead unfolds through paired productions. Two traditions, independently, understood that creation requires complementary forces — that neither alone is complete.</p>

<twocol left="🌺 Kumulipo — Pairing" right="☥ Kemet — Pairing">Every wā of the Kumulipo creates through pairs — the male and female principles of each life form introduced together. This is not merely biological. It is cosmological: existence requires complementary forces in dynamic relationship. The male and female principles are not opposites in conflict — they are the two poles of a unified creative reality.||The Ogdoad: four male/female pairs (Nun/Naunet, Heh/Hauhet, Kek/Kauket, Amun/Amaunet). The Ennead: Shu and Tefnut, Geb and Nut, then two further pairs. Even the fundamental forces of the universe — earth and sky, air and moisture — are paired complementaries. Balance between poles is the condition of existence.</twocol>

<callout type="bridge"><strong>The Pattern:</strong> Both traditions encode the same understanding: duality is the generative principle of reality. Creation requires two forces in dynamic relationship. This understanding, independently arrived at on opposite ends of the Earth, appears in virtually every profound wisdom tradition: yin/yang in Taoism, Shiva/Shakti in Vedic thought, ida/pingala in yoga. It may be one of the deepest structural insights available to the human mind about the nature of reality.</callout>
`
            },
            {
              id:       'bridge-pono-maat',
              num:      'BR·03',
              title:    'Pono & Maʻat — Cosmic Order as Personal Ethics',
              readTime: '7 min',
              content: `
<p class="lead">Both the Hawaiian tradition and the Kemetic tradition arrived at the same profound insight: cosmic order, personal ethics, social justice, and ecological responsibility are not separate domains — they are all expressions of the same underlying principle. Whether you call it Pono or Maʻat, the understanding is identical.</p>

<twocol left="🌺 Pono" right="☥ Maʻat">Pono in Hawaiian thought encompasses righteousness, balance, and alignment with natural law, community, and the cosmos. To live in pono is to maintain proper relationships — with oneself, one's community, the land, the sea, and the ancestors. The ahupuaʻa system, the mālama of the loʻi and loko iʻa — these were not merely practical systems. They were expressions of pono: maintaining cosmic balance through daily practice.||Maʻat encompasses truth, justice, cosmic balance, and divine order. To live in Maʻat is to align one's actions with the principle that holds the universe together — speaking truth, treating others fairly, protecting the vulnerable, maintaining ecological balance. Several of the 42 Declarations of Innocence address environmental ethics directly. The pharaoh's duty to uphold Maʻat and the individual's duty in the Hall of Two Truths are the same obligation at different scales.</twocol>

<callout type="bridge"><strong>The Pattern:</strong> Both cultures understood that personal integrity, ecological responsibility, and cosmic alignment are not separate concerns — they are one. If you damage the land, you damage the cosmic order. If you lie, you damage the cosmic order. Pono and Maʻat are the same principle wearing different names — and both traditions made that principle the ethical foundation of an entire civilization. This is not a coincidence. It is what civilizations look like when they are built from wisdom rather than conquest.</callout>
`
            }
          ]
        }
      ]
    },

    /* ══════════════════════════════════════════════════════════
       COMING SOON — placeholder cultures
       (status: 'soon' = shown as locked/coming soon in UI)
    ══════════════════════════════════════════════════════════ */
    {
      id:      'dreamtime',
      name:    'Dreamtime',
      emoji:   '🌏',
      tagline: 'Aboriginal Australian Wisdom Traditions',
      theme:   'rust',
      status:  'soon',
      intro:   'Coming soon.',
      modules: []
    },
    {
      id:      'dogon',
      name:    'Dogon',
      emoji:   '🪘',
      tagline: 'West African Knowledge — Mali',
      theme:   'amber',
      status:  'soon',
      intro:   'Coming soon.',
      modules: []
    },
    {
      id:      'vedic',
      name:    'Vedic',
      emoji:   '🕉️',
      tagline: 'Ancient Indian Wisdom Traditions',
      theme:   'saffron',
      status:  'soon',
      intro:   'Coming soon.',
      modules: []
    }

  ] // end cultures
}; // end CULTURALVERSE_DATA