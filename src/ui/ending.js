import { escapeHtml } from './dom.js';

const list = entries => entries.length
  ? `<ul>${entries.map(entry => `<li><b>${escapeHtml(entry.region)}</b> · ${escapeHtml(entry.name)}</li>`).join('')}</ul>`
  : '<p>None yet. Every optional discovery remains available.</p>';

const storyScenes = [
  {
    image: 'assets/images/intro/great-forgetter.jpg',
    title: 'The last seal breaks',
    body: 'The final stroke of the Spirit Brush cut through the Great Forgetter’s spell. The Word Spirits you freed in every region answered together. The Great Forgetter remembered what he had tried to erase: names, stories, and promises belong to the people who share them.'
  },
  {
    image: 'assets/images/ending/dictionary-tree-restored.webp',
    title: 'The Great Dictionary Tree wakes',
    body: 'Light returned to its branches. Spirits flew home from the roads, rivers, theatres and gardens. The Tree did not lock the words away again. It let them travel wherever someone read, spoke, listened, wrote, or tried once more.'
  },
  {
    image: 'assets/images/ending/dictionary-tree-restored.webp',
    title: 'Every word has a place again',
    body: 'Across all seven regions, friends called each other by name. Letters could be written. Stories could be told. Even mistakes became a reason to learn, not to give up. The Brush was whole, and the next story was yours to begin.'
  }
];

export function showFinalBlow(overlay, onContinue) {
  const frames = [
    { image: 'assets/images/ending/final-hero-sword.webp', title: 'One final stroke', body: 'The hero drew the gathered Brush Fragments into a blade of light.', action: 'Strike' },
    { image: 'assets/images/ending/final-forgetter-split.webp', title: 'The spell breaks', body: 'The Great Forgetter’s vast shadow split apart, and the stolen words began to return.', action: 'Continue the story' }
  ];
  let index = 0;
  const render = () => {
    const frame = frames[index];
    overlay.open(`<section class="finale-screen ending-story-screen final-blow-screen final-blow-frame-${index + 1}" aria-label="Final strike, part ${index + 1} of ${frames.length}"><img class="ending-story-image" src="${frame.image}" alt="${index ? 'The towering Great Forgetter divides into two dissolving halves beneath the hero’s glowing strike' : 'The hero lunges in side view with a glowing sword'}"><div class="ending-story-shade"></div><article class="ending-story-card"><p class="ending-eyebrow">The final stroke · ${index + 1} / ${frames.length}</p><h1>${frame.title}</h1><p>${frame.body}</p><button class="primary" type="button" data-final-blow-continue>${frame.action}</button></article></section>`, { dismissible: false });
    document.querySelector('[data-final-blow-continue]').addEventListener('click', () => {
      if (index === frames.length - 1) onContinue();
      else { index += 1; render(); }
    }, { once: true });
  };
  render();
}

export function showFinalReform(overlay, dialogue, onComplete) {
  const images = {
    'Great Forgetter': 'assets/images/ending/final-forgetter-reflects.webp',
    'Keeper Ming': 'assets/images/ending/final-keeper-ming.webp',
    Hero: 'assets/images/ending/final-hero-sword.webp',
    'Spirit Brush': 'assets/images/ending/final-brush-restored.webp'
  };
  let index = 0;
  const render = () => {
    const line = dialogue[index];
    const brush = line.speaker === 'Spirit Brush';
    overlay.open(`<section class="finale-screen ending-story-screen final-reform-screen${brush ? ' final-brush-screen' : ''}" data-speaker="${escapeHtml(line.speaker)}" aria-label="Final conversation, part ${index + 1} of ${dialogue.length}"><img class="ending-story-image" src="${images[line.speaker]}" alt="${escapeHtml(brush ? 'The seven strokes join in the restored Spirit Brush before the Great Dictionary Tree' : line.speaker)}"><div class="ending-story-shade"></div><article class="ending-story-card"><p class="ending-eyebrow">${brush ? 'The Spirit Brush is whole' : `The final conversation · ${index + 1} / ${dialogue.length}`}</p><h1>${escapeHtml(brush ? 'Final Stroke restored' : line.speaker)}</h1><p>${escapeHtml(line.say)}</p><button class="primary" type="button" data-final-reform-next>${index === dialogue.length - 1 ? 'See the Tree awaken' : 'Continue'}</button></article></section>`, { dismissible: false });
    document.querySelector('[data-final-reform-next]').addEventListener('click', () => {
      if (index === dialogue.length - 1) onComplete();
      else { index += 1; render(); }
    }, { once: true });
  };
  render();
}

export function showFinale(overlay, ledger, onReturn) {
  const chapters = ledger.chapters.map((chapter, index) => `<article class="ending-chapter"><span>Chapter ${index + 1}</span><img src="${escapeHtml(chapter.image)}" alt="${escapeHtml(chapter.boss)}" loading="lazy"><div><h2>${escapeHtml(chapter.region)}</h2><p>${escapeHtml(chapter.boss)} was overcome.</p><small>${escapeHtml(chapter.fragment)} restored</small></div></article>`).join('');
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let sceneIndex = 0;

  function renderStory() {
    const scene = storyScenes[sceneIndex];
    overlay.open(`<section class="finale-screen ending-story-screen" aria-label="Story ending, part ${sceneIndex + 1} of ${storyScenes.length}"><img class="ending-story-image" src="${scene.image}" alt=""><div class="ending-story-shade"></div><article class="ending-story-card"><p class="ending-eyebrow">The story ends · ${sceneIndex + 1} / ${storyScenes.length}</p><h1>${escapeHtml(scene.title)}</h1><p>${escapeHtml(scene.body)}</p><button class="primary" type="button" data-ending-next>${sceneIndex === storyScenes.length - 1 ? 'Roll the credits' : 'Continue the story'}</button></article></section>`, { dismissible: false });
    document.querySelector('[data-ending-next]').addEventListener('click', () => {
      sceneIndex += 1;
      if (sceneIndex === storyScenes.length) renderCredits();
      else renderStory();
    }, { once: true });
  }

  function renderCredits() {
    overlay.open(`<section class="finale-screen ending-credits" aria-label="Final credits"><div class="ending-credits-sky" aria-hidden="true"></div><div class="ending-credits-viewport" data-ending-viewport><div class="ending-credits-track" data-ending-track><div class="ending-credits-title"><img src="assets/images/ending/dictionary-tree-restored.webp" alt="The restored Great Dictionary Tree"><p class="ending-eyebrow">Word Spirit Quest · 字灵</p><h1>Every word has a place again</h1><p>The end of this chapter. The beginning of many more.</p></div><h2 class="ending-section-title">The road we travelled</h2><div class="ending-chapters">${chapters}</div><section class="ending-mementos"><h2>Optional discoveries collected</h2>${list(ledger.completed)}${ledger.decorations.length ? `<p><b>Room decorations:</b> ${escapeHtml(ledger.decorations.join(', '))}</p>` : ''}${ledger.trophies.length ? `<p><b>Trophies:</b> ${escapeHtml(ledger.trophies.join(', '))}</p>` : ''}<p>${ledger.missing.length} optional discoveries still await you. Nothing is permanently missed.</p></section><p class="ending-last-line">Thank you for carrying the words home.</p></div></div><div class="ending-controls"><button class="secondary" type="button" data-ending-pause>Pause credits</button><button class="primary" type="button" data-ending-return>Return to Scholar Village</button></div></section>`, { dismissible: false });
    const viewport = document.querySelector('[data-ending-viewport]');
    const track = document.querySelector('[data-ending-track]');
    const pause = document.querySelector('[data-ending-pause]');
    let rolling = !reducedMotion;
    let position = viewport.clientHeight;
    let previous = 0;
    if (reducedMotion) {
      viewport.classList.add('ending-reduced-motion');
      pause.hidden = true;
    } else {
      track.style.transform = `translateY(${position}px)`;
      const frame = now => {
        if (!track.isConnected) return;
        if (rolling && !document.hidden && previous) {
          position = Math.max(-track.scrollHeight, position - Math.min(64, now - previous) * .045);
          track.style.transform = `translateY(${position}px)`;
          if (position === -track.scrollHeight) {
            rolling = false;
            pause.hidden = true;
            viewport.classList.add('ending-credits-complete');
          }
        }
        previous = now;
        if (position > -track.scrollHeight) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
    pause.addEventListener('click', () => {
      rolling = !rolling;
      pause.textContent = rolling ? 'Pause credits' : 'Resume credits';
    });
    document.querySelector('[data-ending-return]').addEventListener('click', onReturn, { once: true });
  }

  renderStory();
}
