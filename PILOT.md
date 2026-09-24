# P9–P10 Pilot Record

## Decision

The build is a **conditional go for supervised testing on the target tablet**.
Region 2 must not begin until a child and parent complete the physical-device checks below and no blocking issue remains.

## Completed engineering checks

- Primary 2 and Primary 5 both enter the same Region 1 world with separate saves.
- Primary 2 uses its own tutorial word, story summaries, villager-request words, question flags and gentler combat tuning.
- The Muddle King builds all four phases from question types enabled for the selected curriculum.
- Unsupported Restoration Sets and idiom rewards stay hidden or receive a supported alternative.
- Corrupt and future-version saves are preserved, and a valid backup is restored when available.
- The recovery screen requires a second deliberate action before starting a fresh save.
- The app caches both curricula and the Region 1 runtime for offline use after installation.
- Dialogs trap keyboard focus, restore focus on close and support Escape when dismissal is allowed.
- Reduced-motion mode disables gameplay animation, controls retain 44-pixel targets, and status changes use live regions.
- Automated content, progression, save, accessibility and offline checks pass.
- Browser smoke tests cover both curricula at tablet and narrow-phone widths without runtime errors.

## Physical tablet session still required

1. A Primary 2 child should start unaided, follow the Next step banner, complete the first story and win one battle.
2. A Primary 5 child should complete one multi-character writing task and one Reading Hall passage.
3. Test touch movement, scrolling, focus, the Chinese keyboard and a stylus if one is normally used.
4. Turn off the network after one online load and confirm both curriculum saves reopen.
5. A parent should unlock the Parent Panel, change a setting, export a save and switch between P2 and P5.
6. Record confusion, accidental taps, unreadable text, slow screens and any place where an adult has to explain the next action.

## Expansion gate

The current decision permits the real-device pilot and bug fixing.
The decision remains **no-go for P11 Region 2** until the physical child-and-parent session is recorded and its blockers are resolved.
