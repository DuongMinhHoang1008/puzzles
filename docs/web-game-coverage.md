# Puzzle Studio — coverage as of 2026-10-15

Production build `77a109f2a657739e`. Full scope remains 38 games. [Detailed evidence and limitations](web-qa-2026-10-15.md).

All 38 also pass the separate **in-game interaction feedback** check: a committed input without Solve produces a visible changed-pixel overlay. Includes selection/keypad/touch support through shared input events, with native effects preserved. [Current polish evidence](web-polish-2026-10-15.md). The Feedback column below describes the underlying native/semantic layer; every row now additionally has this shared interaction layer.

The history matrix means: real Solve or committed move, Undo/Redo, serialized restore/history, another preset where available, invalid ID validation, and Vietnamese rules. It does not imply every preset or gesture is tested.

| Game | Compile | Chrome smoke | History/config/restore | EN/VI rules and captured text | Feedback | Remaining per-game QA |
| --- | --- | --- | --- | --- | --- | --- |
| blackbox | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| bridges | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| cube | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| dominosa | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| fifteen | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| filling | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| flip | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| flood | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| galaxies | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| guess | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| inertia | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| keen | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| lightup | pass | pass | pass | pass | custom | all presets/gestures, dynamic strings, colours/device |
| loopy | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| magnets | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| map | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| mines | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| net | pass | pass | pass | pass | custom | all presets/gestures, dynamic strings, colours/device |
| netslide | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| pattern | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| pearl | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| pegs | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| range | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| rect | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| samegame | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| signpost | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| singles | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| sixteen | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| slant | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| solo | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| tents | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| towers | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| tracks | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| twiddle | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| undead | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| unequal | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| unruly | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |
| untangle | pass | pass | pass | pass | native-integrated | all presets/gestures, dynamic strings, colours/device |

Net additionally covers ignored input, invalid config, assisted metadata and once-only natural completion. Light Up covers real bulb/illumination feedback and reduced-motion cleanup. Shared lifecycle passes 30 pilot switches with no retained WASM memories and stable listener counts.

EN/VI captured text coverage does not assert all reachable strings. Non-pilot board palettes retain native colours; theme chrome and pilot palettes are verified separately. No physical mobile or Safari/Firefox QA is claimed.
