import { buildRouteMap, expandRouteMap } from '../src/world/routeMaps.js';

const regions = [
  { id: 'r1', town: 'Scholar Village', greeter: 'Grandma Wang', problem: 'The Muddle King has mixed up the villagers’ words.', reading: 'Reading Hall', school: 'School', inn: 'Inn', shop: 'Shop', route: 'Mistwood Road', next: 'Harvest Crossing', secret: 'Hidden Grove', secretReward: 'a special scroll and 30 coins' },
  { id: 'r2', town: 'Harvest Crossing', greeter: 'Elder Sun', problem: 'Rumours have twisted the market’s signs, prices and promises.', reading: 'Market Archive', school: 'Schoolhouse', inn: 'Rest House', shop: 'Supply Stall', route: 'Golden Reed Way', next: 'Tidewater Bay', secret: 'Truth Terrace', secretReward: 'a Secret Scroll and 60 coins' },
  { id: 'r3', town: 'Tidewater Bay', greeter: 'Keeper Lan', problem: 'The Clock Tower has stopped and a young whale is stranded.', reading: 'Tide Archive', school: 'Harbour School', inn: 'Sailor’s Rest', shop: 'Dockside Store', route: 'Saltwind Coast', next: 'Lantern Theatre', secret: 'Tide Vault', secretReward: 'a Secret Scroll and 70 coins' },
  { id: 'r4', town: 'Lantern Theatre', greeter: 'Director Luo', problem: 'The Mocking Mirror makes performers afraid of mistakes.', reading: 'Script Library', school: 'Rehearsal School', inn: 'Actors’ Rest', shop: 'Prop and Produce Stall', route: 'Lantern Pass', next: 'Festival City', secret: 'Courage Loft', secretReward: 'a Secret Scroll and 80 coins' },
  { id: 'r5', town: 'Festival City', greeter: 'Mayor Shen', problem: 'Old grudges have turned a celebration into a contest of pride.', reading: 'Festival Archive', school: 'City Academy', inn: 'Firecracker Rest', shop: 'Night Market', route: 'Ember Parade Road', next: 'Ancient Grove', secret: 'Harmony Pavilion', secretReward: 'a Secret Scroll and 90 coins' },
  { id: 'r6', town: 'Ancient Grove', greeter: 'Curator Wen', problem: 'The Give-Up Ghost has erased discoveries from the researchers’ notes.', reading: 'Oracle Reading Room', school: 'Grove Academy', inn: 'Explorer’s Rest', shop: 'Expedition Store', route: 'Root Stair Trail', next: 'Treehouse Summit', secret: 'Memory Vault', secretReward: 'a Secret Scroll and 100 coins' },
  { id: 'r7', town: 'Treehouse Summit', greeter: 'Keeper Ming', problem: 'The Great Dictionary Tree’s heart is quiet and the Great Forgetter holds the final Brush seal.', reading: 'Canopy Reading Hall', school: 'Summit School', inn: 'Treehouse Inn', shop: 'Summit Supply', route: 'Summit glades', next: null, secret: 'Dictionary Heart', secretReward: 'the Final Story Scroll and 120 coins' }
];

const root = document.querySelector('#guide-root');
const regionId = document.body.dataset.region;
const level = new URLSearchParams(location.search).get('level') === 'p2' ? 'p2' : 'p5';
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const titleCase = id => id.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
const regionNumber = id => Number(id.slice(1));
const regionHref = id => `./walkthrough-region-${regionNumber(id)}.html?level=${level}`;
const introHref = `./region1-walkthrough.html?level=${level}`;

function shell(title, description, content) {
  const nav = [`<a href="${introHref}" ${regionId === 'intro' ? 'aria-current="page"' : ''}>Introduction</a>`, ...regions.map(region => `<a href="${regionHref(region.id)}" ${regionId === region.id ? 'aria-current="page"' : ''}>${regionNumber(region.id)} · ${escapeHtml(region.town)}</a>`)].join('');
  const selector = ['p5', 'p2'].map(id => `<a href="${location.pathname}?level=${id}" aria-current="${level === id}">${id === 'p5' ? 'Primary 5' : 'Primary 2'}</a>`).join('');
  root.innerHTML = `<div class="sheet"><header class="masthead"><div class="trail"><svg viewBox="0 0 28 28" aria-hidden="true"><path fill="none" stroke="#dfc481" stroke-width="2" d="M4 25 13 3l3 3-9 20m10-15 8 3-7 8-7-3"/></svg> Word Spirit Quest · a player’s field journal</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><div class="level-choice"><span>Curriculum</span>${selector}</div></header><nav class="region-nav" aria-label="Walkthrough pages">${nav}</nav><main>${content}</main><footer>A separate player’s guide. Its maps and numbers come from the local game content.</footer></div>`;
}

function renderIntroduction() {
  shell('The words are waiting', 'The story, the goal, and the route through all seven regions.', `
    <section class="intro-scene"><div><span class="chapter-kicker">Before the first step</span><h2>A brush shattered. Seven regions fell quiet.</h2><p class="lead">Long ago, every word lived as a Word Spirit in the Great Dictionary Tree. The spirits helped people speak, read and write clearly.</p><p>The Great Forgetter shattered the Spirit Brush and sealed those spirits inside wild creatures. Towns began mixing up names, recipes and promises. Grandma Wang gives me the Brush handle, and I set out to bring the spirits home.</p><a class="start-link" href="${regionHref('r1')}">Begin in Scholar Village</a></div><img src="../assets/images/intro/dictionary-tree.jpg" alt="The Great Dictionary Tree before its Word Spirits were scattered" loading="eager"></section>
    <section><h2>What I am trying to do</h2><div class="intro-steps"><article><strong>Free spirits</strong><p>Battle creatures in each lesson area to collect different Word Spirit cards. Correct answers also fill their skill circles.</p></article><article><strong>Restore the Brush</strong><p>Read a passage, help the villagers answer it, collect enough Bronze cards, then defeat the region’s boss.</p></article><article><strong>Reach the next town</strong><p>Pass the gate’s dictation test and continue. At the final summit, face the Great Forgetter and wake the Dictionary Heart.</p></article></div><p>School, the Inn, the Shop and optional neighbour requests help along the way. The Journal suggests a route, but the lesson areas stay open.</p></section>
    <section><h2>How to use this guide</h2><p>Each region has its own page with the town tasks, a route map, creature levels, a shop list, the boss and gate requirements, and optional goals. Choose Primary 2 or Primary 5 above to see the matching lessons and counts.</p></section>`);
}

async function json(path) {
  const response = await fetch(`../${path}`);
  if (!response.ok) throw new Error(`${path} could not load (${response.status}).`);
  return response.json();
}

async function loadRegion() {
  const number = regionNumber(regionId);
  const [config, content, balance, items, gear, story, authoredSets, mapSource] = await Promise.all([
    json(`content/authored/levels/${level}/level.json`),
    json(`content/generated/${level}.content.json`),
    json('content/authored/shared/balance.json'),
    json('content/authored/shared/items.json'),
    json('content/authored/shared/gear.json'),
    json(`content/authored/campaign/${regionId}-story.json`),
    json(`content/authored/campaign/${regionId}-sets.json`),
    json(number === 1 ? 'content/authored/campaign/maps/r1-r2-mistwood.json' : number === 7 ? 'content/authored/campaign/maps/r7-treehouse-summit.json' : 'content/authored/campaign/routes.json')
  ]);
  const lessons = config.regionLessons[regionId];
  const rawMap = number === 1 || number === 7 ? mapSource : buildRouteMap(mapSource.find(route => route.region === regionId), lessons, config.tuning.routeEncounterRate);
  for (const zone of rawMap.zones) if (Number.isInteger(zone.lessonSlot)) zone.lesson = lessons[zone.lessonSlot] ?? lessons.at(-1);
  const scale = config.tuning.routeEncounterScales?.[regionId] ?? config.tuning.routeEncounterScale ?? 1.2;
  const map = number === 7 ? rawMap : expandRouteMap(rawMap, scale);
  const sets = Array.isArray(authoredSets) ? authoredSets : authoredSets[level];
  const regionalWords = content.words.filter(word => lessons.includes(word.lesson));
  const distinct = new Set(regionalWords.map(word => word.w));
  const required = Math.ceil(distinct.size * story.gateBronzePct);
  const bossLevel = Math.max(...lessons.map(lesson => balance.combat.lessonLevels[String(lesson)][1])) + 1;
  return { config, balance, items, gear, story, map, sets, lessons, required, total: distinct.size, bossLevel };
}

const itemDescriptions = {
  heal: item => `Restore at least ${item.amount} HP (${Math.round(item.healFraction * 100)}% of maximum HP).`,
  'full-heal': () => 'Restore all HP during battle.',
  'writing-retry': () => 'Retry a writing challenge safely.',
  escape: () => 'Guarantee an escape from battle.',
  'attack-boost': item => `Increase attack damage by ${Math.round(item.amount * 8)}% for one battle.`,
  'defense-boost': item => `Reduce incoming damage by ${Math.round(item.amount * 8)}% for one battle.`,
  repellent: item => `Prevent encounters for ${item.amount} encounter-grass steps.`,
  'repel-mastered': item => `Avoid Silver and Gold spirits for ${item.amount} encounter-grass steps.`
};

function shopSection(info, data) {
  const rows = data.items.map(item => `<tr><td><b>${escapeHtml(item.name)}</b></td><td>${item.price} coins</td><td>${escapeHtml(itemDescriptions[item.effect]?.(item) || item.effect)}</td></tr>`).join('');
  const cap = data.gear.find(item => item.id === 'red-cap');
  return `<details class="fold"><summary>Everything sold at ${escapeHtml(info.shop)}</summary><div class="fold-body"><p>The same core supplies are available in each region. The Shop also offers exact-word Spirit Bait for the lessons shown on this page.</p><table class="item-table"><thead><tr><th>Item</th><th>Price</th><th>Use</th></tr></thead><tbody>${rows}<tr><td><b>Spirit Bait</b></td><td>10 coins</td><td>Choose a missing word from a lesson here; it appears in the next encounter in that lesson area.</td></tr><tr><td><b>${escapeHtml(cap.name)}</b></td><td>${cap.price} coins</td><td>Add ${cap.amount} maximum HP when equipped.</td></tr></tbody></table></div></details>`;
}

function attackSection() {
  const attacks = [
    ['Meaning Strike', 'Meaning', 'See the Chinese word; choose its English meaning.'],
    ['Sound Blast', 'Pinyin', 'See the Chinese word; choose its Hanyu Pinyin.'],
    ['Precision Jab', 'Hanzi', 'See the English meaning; choose the Chinese word. No pinyin is shown.'],
    ['Heavy Slam', 'Usage', 'Choose the word that fits a blank in a sentence.'],
    ['Brush Finisher', 'Writing', 'Write the dictated word from memory using its meaning, pinyin and blanked example sentence.']
  ];
  return `<details class="fold"><summary>What each battle move practises</summary><div class="fold-body"><table class="attacks"><thead><tr><th>Move</th><th>Skill</th><th>Question</th></tr></thead><tbody>${attacks.map(([move, skill, task]) => `<tr><td><b>${move}</b></td><td>${skill}</td><td>${task}</td></tr>`).join('')}</tbody></table><p>When a creature casts a spell, a correct defence answer blocks it. Mirror Trick, for example, asks me to choose the Chinese word from its English meaning.</p></div></details>`;
}

function optionalSection(info, data) {
  const { story, sets, lessons } = data;
  const requests = regionNumber(info.id) === 1 ? (() => {
    const bindings = data.config.region1.requests;
    return [
      `<li><b>Xiaoqiang:</b> collect ${bindings.xiaoqiang.collect.map(escapeHtml).join(' and ')}, find the treasure box, then raise ${escapeHtml(bindings.xiaoqiang.bronze)} to Bronze. <b>Reward:</b> the Jade Brush recipe and its needed Mist Drops and Ink Beads.</li>`,
      `<li><b>Mr Lin:</b> raise ${bindings['mr-lin'].bronze.map(escapeHtml).join(' and ')} to Bronze, defeat three Twin Shades, and write ${escapeHtml(bindings['mr-lin'].write)} successfully. <b>Reward:</b> Grandma’s Lantern keepsake.</li>`,
      `<li><b>Chef Mei:</b> raise ${bindings['chef-mei'].bronze.map(escapeHtml).join(' and ')} to Bronze, defeat two Ink Imps, and answer three Lesson 3 tingxie words correctly. <b>Reward:</b> the Mooncake recipe and one Mooncake.</li>`
    ].join('');
  })() : Object.values(story.requests).map(request => {
    const lesson = request.lesson ?? lessons[request.lessonSlot] ?? lessons.at(-1);
    return `<li><b>${escapeHtml(request.name)}:</b> collect three Lesson ${lesson} Spirit cards, defeat ${request.count} ${escapeHtml(titleCase(request.creature))} creatures, then hear the Lesson ${lesson} Storyteller chapter. <b>Reward:</b> ${escapeHtml(request.reward)}, 40 coins and a Rice Ball.</li>`;
  }).join('');
  const restorations = sets.map(set => `<li><b>${escapeHtml(set.name)}:</b> raise ${set.words.map(escapeHtml).join(', ')} to Silver or Gold, then offer the set at the Restoration Board. <b>Reward:</b> ${escapeHtml(set.restoration)} and a room decoration.</li>`).join('');
  return `<details class="fold"><summary>Optional goals and rewards in ${escapeHtml(info.town)}</summary><div class="fold-body"><h3>Help the neighbours</h3><ul>${requests}</ul><h3>Restore themed sets</h3><ul>${restorations}</ul><p>The first reading of each regional Storyteller chapter gives 10 coins. Completing all three Daily Board tasks opens a chest with coins and supplies.</p><p>After the boss, the restored Brush Stroke opens <b>${escapeHtml(info.secret)}</b> for ${escapeHtml(info.secretReward)}. These are side rewards, not gate requirements.</p></div></details>`;
}

function mapSection(info, data) {
  const final = info.id === 'r7';
  const rows = data.map.zones.map(zone => {
    const [low, high] = data.balance.combat.lessonLevels[String(zone.lesson)];
    return `<tr><td><b>${escapeHtml(zone.name)}</b><span class="level-band">Lesson ${zone.lesson} · Creature levels ${low}–${high}</span></td><td>${Object.keys(zone.encounter.types).map(type => escapeHtml(titleCase(type))).join(', ')}</td></tr>`;
  }).join('');
  const labels = data.map.zones.map(zone => `<span>${escapeHtml(zone.name)} · Lesson ${zone.lesson}</span>`).join('');
  return `<section id="route"><h2>${final ? 'I explored the summit glades' : `I explored ${escapeHtml(info.route)}`}</h2><p class="lead">${final ? 'Treehouse Summit keeps its buildings and battle glades on one shared map. The paths by the buildings are safe; the named glades contain the final creatures.' : `I left ${escapeHtml(info.town)} and explored a fog-covered route. Cleared ground stays visible when I return to heal or restock.`}</p><div class="fact-strip">${labels}</div><figure class="map-wrap"><figcaption>${escapeHtml(final ? 'Treehouse Summit' : info.route)} map <small>Authored layout; ${final ? 'the glades carry encounters' : 'the in-game route begins under fog'}.</small></figcaption><div class="map-frame"><svg id="route-map" role="img" aria-label="${escapeHtml(info.route)} map with entrance, boss and ${final ? 'Dictionary Heart' : 'onward gate'}"></svg></div><div class="map-key"><span style="--key:${data.map.legend.g?.color || '#83b77f'}">Encounter ground</span><span style="--key:${data.map.legend.p?.color || '#d0bc90'}">Path</span><span style="--key:${data.map.legend.t?.color || '#3c7151'}">Blocked ground</span><span style="--key:${data.map.legend.w?.color || '#5b9bb0'}">Water or gap</span></div></figure><div class="legend-spots"><article><b>1 · ${final ? 'Summit entrance' : 'Town entrance'}</b><small>${final ? 'I arrived from Ancient Grove.' : 'I could return to the Inn and Shop without losing explored fog.'}</small></article><article><b>2 · ${escapeHtml(final ? 'Final Seal' : data.story.bossPlace)}</b><small>The boss waits here after I collect the reading key and enough Bronze cards.</small></article><article><b>3 · ${escapeHtml(final ? 'Dictionary Heart' : `Gate to ${info.next}`)}</b><small>${final ? 'The final story follows the restored Brush.' : 'The gate tests dictation after the boss is defeated.'}</small></article></div><table class="creatures"><thead><tr><th>Lesson area and levels</th><th>Creatures I met</th></tr></thead><tbody>${rows}</tbody></table><p><b>Elite</b> creatures are tougher versions at the same lesson level, with extra HP, attack and defence. <b>Golden</b> creatures have extra HP and bonus coins, but flee after four turns, so I use their weak spot to finish quickly. Each battle counts toward the daily limit of 30; when it runs out, I return to the Inn. On fog routes, my discoveries stay cleared.</p>${attackSection()}</section>`;
}

function mapArt(map, final) {
  const svg = document.querySelector('#route-map');
  const ns = 'http://www.w3.org/2000/svg';
  const unit = 10;
  const top = 31;
  const add = (parent, name, attributes) => {
    const element = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    parent.appendChild(element);
    return element;
  };
  svg.setAttribute('viewBox', `0 0 ${map.width * unit} ${map.height * unit + top}`);
  add(svg, 'rect', { x: 0, y: 0, width: map.width * unit, height: top, fill: '#e7d7ad' });
  for (const zone of map.zones) {
    const x = (zone.rect.x + zone.rect.width / 2) * unit;
    add(svg, 'text', { x, y: 20, 'text-anchor': 'middle', fill: '#173747', 'font-size': final ? 10 : 12, 'font-weight': 800 }).textContent = zone.name;
  }
  map.tiles.forEach((row, y) => [...row].forEach((tile, x) => add(svg, 'rect', { x: x * unit, y: y * unit + top, width: unit + .15, height: unit + .15, fill: map.legend[tile]?.color || '#83b77f' })));
  const pavilion = map.objects.find(object => object.id === (final ? 'final-seal-building' : 'boss-pavilion-building'));
  if (pavilion) add(svg, 'rect', { x: pavilion.rect.x * unit, y: pavilion.rect.y * unit + top, width: pavilion.rect.width * unit, height: pavilion.rect.height * unit, rx: 4, fill: '#6b587b', stroke: '#fff3c5', 'stroke-width': 2 });
  const gate = map.objects.find(object => object.id === (final ? 'dictionary-heart' : 'next-region-gate'));
  const markers = [
    { number: '1', x: map.spawn.x, y: map.spawn.y, fill: '#235b54', label: 'Entrance' },
    { number: '2', x: pavilion.door.x, y: pavilion.door.y, fill: '#82552e', label: pavilion.name },
    { number: '3', x: gate.x, y: gate.y, fill: '#a44331', label: final ? 'Dictionary Heart' : 'Onward gate' }
  ];
  for (const marker of markers) {
    const x = (marker.x + .5) * unit;
    const y = (marker.y + .5) * unit + top;
    add(svg, 'circle', { cx: x, cy: y, r: 10, fill: marker.fill, stroke: '#fff9e8', 'stroke-width': 2 });
    const number = add(svg, 'text', { x, y: y + 4, 'text-anchor': 'middle', fill: 'white', 'font-size': 11, 'font-weight': 900 });
    number.textContent = marker.number;
    add(number, 'title', {}).textContent = marker.label;
  }
}

function regionPage(info, data) {
  const first = info.id === 'r1';
  const final = info.id === 'r7';
  const key = data.story.gateKeyName || 'Cave Lantern';
  const boss = data.story.bossName;
  const fragment = data.story.fragmentName || 'Dawn Stroke';
  const villageIntro = first ? 'After the introduction, Grandma Wang welcomed me and gave me the Spirit Brush handle. A Fogling appeared, so my first fight showed me how to free a Word Spirit.' : `${info.greeter} welcomed me. ${info.problem}`;
  const village = `<section id="town"><h2>${first ? 'I got ready in Scholar Village' : `I arrived in ${escapeHtml(info.town)}`}</h2><div class="split"><div><p class="lead">${escapeHtml(villageIntro)}</p><ul class="checklist"><li><b>${escapeHtml(info.reading)}:</b> finish a passage and answer the villagers marked ?. Reviewing an answer helps, but only a correct answer clears its question. Finishing the passage awards the <b>${escapeHtml(key)}</b>.</li><li><b>${escapeHtml(info.school)}:</b> practise Lessons ${data.lessons.join(', ')}, including dictation. School can be repeated for XP.</li><li><b>${escapeHtml(info.inn)}:</b> answer three regional questions to restore HP.</li><li><b>${escapeHtml(info.shop)}:</b> buy healing, battle items, equipment and 10-coin exact-word Spirit Bait.</li></ul></div><aside class="margin-note"><h3>My next step</h3><p>${final ? 'The summit glades are on the same map as the buildings.' : `The town exit leads to ${escapeHtml(info.route)}.`} The on-screen Next step pin and small map show where to go, but I can explore in any order.</p><p>In the Spirit Book, a new card is Bronze. Three filled skill circles make Silver; all five make Gold. Bronze is enough for the boss requirement.</p></aside></div>${shopSection(info, data)}</section>`;
  const supplies = `<section id="supplies"><h2>I used my book, bag and equipment</h2><p>Creatures carry sealed Word Spirits. Winning frees a card, earns XP and coins, and may help fill a skill circle. I needed different Bronze-or-better cards rather than repeated wins against the same word.</p><p>A <b>weak spot</b> is the move that hurts this creature more. <b>“Can fill an empty skill circle”</b> means a correct answer could teach the Spirit a skill it has not mastered. When I kept meeting words I already owned, I used exact-word Spirit Bait from the Shop to seek a missing word in that lesson area.</p><p>My <b>Bag</b> held consumables, materials, scrolls and key items. <b>Hero Status</b> showed my stats and equipped brush, charm and hat. I could open the Bag during a boss fight.</p></section>`;
  const bossText = `<p>Inside ${escapeHtml(final ? 'the Final Seal' : data.story.bossPlace)}, the <b>${escapeHtml(boss)} (Level ${data.bossLevel})</b> fought back. The challenge mixed word questions with writing from memory. I brought healing and could open my Bag during the fight. Winning restored the Spirit Brush’s <b>${escapeHtml(fragment)}</b>.</p>`;
  const gateText = final ? `<div class="end-note"><h3>The Dictionary Heart</h3><p>After defeating the Great Forgetter, I visited the Dictionary Heart. The Great Dictionary Tree woke again, and I received the Final Story Scroll and 120 coins. There is no onward gate or dictation test after Region 7.</p></div>` : `<div class="end-note"><h3>My last test before ${escapeHtml(info.next)}</h3><p>At the gate, I wrote <b>15 collected regional words from memory</b> and needed <b>13 correct</b>. The prompt read each word aloud and showed its meaning, pinyin and a blanked example sentence, but not the target Chinese characters. I could practise at School and try again. Passing opened the gate to <b>${escapeHtml(info.next)}</b>.</p></div>`;
  const bossSection = `<section id="boss"><h2>${final ? 'I faced the Great Forgetter' : `I faced ${escapeHtml(boss)} and reached the gate`}</h2><p class="lead">I needed the <b>${escapeHtml(key)}</b> and at least <b>${data.required}</b> different Bronze-or-better regional Spirits out of <b>${data.total}</b> to challenge the boss. Silver and Gold were bonuses, not requirements.</p><div class="checkpoint"><span>Reading key · ${escapeHtml(key)}</span><span>${data.required} Bronze-or-better Spirits</span><span>${escapeHtml(boss)} · Level ${data.bossLevel}</span></div>${bossText}${gateText}</section>`;
  const index = regions.findIndex(region => region.id === info.id);
  const previous = index === 0 ? `<a href="${introHref}">Introduction</a>` : `<a href="${regionHref(regions[index - 1].id)}">Previous: ${escapeHtml(regions[index - 1].town)}</a>`;
  const next = index < regions.length - 1 ? `<a href="${regionHref(regions[index + 1].id)}">Next: ${escapeHtml(regions[index + 1].town)}</a>` : `<a href="${introHref}">Back to introduction</a>`;
  shell(`Region ${index + 1}: ${info.town}`, `A player’s route through ${info.town}${final ? ' and the Great Dictionary Tree' : `, ${info.route}, and the gate to ${info.next}`}.`, `${village}${mapSection(info, data)}${supplies}${bossSection}${optionalSection(info, data)}<nav class="page-turn" aria-label="Previous and next walkthrough pages">${previous}${next}</nav>`);
  mapArt(data.map, final);
}

if (regionId === 'intro') {
  const legacy = /^#region([1-7])$/.exec(location.hash);
  if (legacy) location.replace(regionHref(`r${legacy[1]}`));
  else renderIntroduction();
} else {
  const info = regions.find(region => region.id === regionId);
  if (!info) root.innerHTML = '<p class="loading error">This region does not exist in the walkthrough.</p>';
  else loadRegion().then(data => regionPage(info, data)).catch(error => {
    root.innerHTML = `<p class="loading error">This region could not load: ${escapeHtml(error.message)} Open the guide through the local HTTP server.</p>`;
  });
}
