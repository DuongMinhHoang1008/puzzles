import type { Locale } from "../engine/contract";
import translations from "./engine-static.vi.json";
import errors from "./engine-errors.vi.json";
const vi: Record<string, string> = { ...translations, ...errors };
const missing = new Set<string>();
const prefixes: [string, string][] = [
  ["COMPLETED! ", "Đã hoàn thành! "],
  ["COMPLETE! ", "Đã hoàn thành! "],
  ["Auto-solved. ", "Đã giải tự động. "],
  ["Auto-solver used. ", "Đã dùng giải tự động. "],
  ["FAILED! ", "Chưa thành công! "],
  ["Cannot move! ", "Không còn nước đi! "],
];
export function engineText(source: string, locale: Locale): string {
  if (locale === "en" || !source) return source;
  if (vi[source]) return vi[source];
  for (const [original, translated] of prefixes)
    if (source.startsWith(original))
      return translated + engineText(source.slice(original.length), locale);
  const clock = /^\[(\d+:\d{2})\] (.+)$/.exec(source);
  if (clock) return `[${clock[1]}] ${engineText(clock[2], locale)}`;
  const deaths = /^(.+?)\s+Deaths: (\d+)$/.exec(source);
  if (deaths)
    return `${engineText(deaths[1], locale)} · Số lần chết: ${deaths[2]}`;
  const target = /^(.+?) \(target (\d+)\)$/.exec(source);
  if (target) return `${engineText(target[1], locale)} (mục tiêu ${target[2]})`;
  const markedMines = /^Marked: (\d+) \/ (\d+)$/.exec(source);
  if (markedMines) return `Đã đánh dấu: ${markedMines[1]} / ${markedMines[2]}`;
  const selected = /^Score: (-?\d+)  Selected: (\d+) \((-?\d+)\)$/.exec(source);
  if (selected)
    return `Điểm: ${selected[1]} · Đã chọn: ${selected[2]} (${selected[3]})`;
  const wrong = /^(\d+) wrong and (\d+) missed balls\.$/.exec(source);
  if (wrong) return `${wrong[1]} quả cầu sai và ${wrong[2]} quả cầu bị bỏ sót.`;
  const extraBalls = /^(\d+) too many balls marked\.$/.exec(source);
  if (extraBalls) return `Đã đánh dấu thừa ${extraBalls[1]} quả cầu.`;
  const ballsRange = /^Balls marked: (\d+) \/ (\d+)-(\d+)\.$/.exec(source);
  if (ballsRange)
    return `Quả cầu đã đánh dấu: ${ballsRange[1]} / ${ballsRange[2]}–${ballsRange[3]}.`;
  const errorSuffix = /^(.+) \((\d+) errors?\)$/.exec(source);
  if (errorSuffix)
    return `${engineText(errorSuffix[1], locale)} (${errorSuffix[2]} lỗi)`;
  const puzzleDiff = /^Puzzle is (.+)\.$/.exec(source);
  if (puzzleDiff && vi[puzzleDiff[1]]) return `Độ khó: ${vi[puzzleDiff[1]]}.`;
  const afterSolve = /^Moves since auto-solve: (\d+)$/.exec(source);
  if (afterSolve) return `Lượt từ khi giải tự động: ${afterSolve[1]}`;
  const rectStatus = /^(\d+x\d+) (Auto-solved\.|COMPLETED!)$/.exec(source);
  if (rectStatus)
    return `${rectStatus[1]} ${engineText(rectStatus[2], locale)}`;
  if (/^\d+(?:x\d+)+$/.test(source)) return source;
  if (/^\d+$/.test(source)) return source;
  const configuration = /^([A-Za-z ]+) configuration$/.exec(source);
  if (configuration) return `Cấu hình ${configuration[1]}`;
  const timed = /^\[(\d+:\d{2})\] Marked: (\d+) \/ (\d+)$/.exec(source);
  if (timed) return `[${timed[1]}] Đã đánh dấu: ${timed[2]} / ${timed[3]}`;
  const netSlide = /^Moves: (\d+) Active: (\d+)\/(\d+)$/.exec(source);
  if (netSlide)
    return `Lượt: ${netSlide[1]} Đã nối: ${netSlide[2]}/${netSlide[3]}`;
  const active = /^Active: (\d+)\/(\d+)$/.exec(source);
  if (active) return `Đã nối: ${active[1]}/${active[2]}`;
  const wrapping = /^(\d+x\d+) wrapping$/.exec(source);
  if (wrapping) return `${wrapping[1]} cuộn vòng`;
  const preset =
    /^(\d+(?:x\d+)+) (Easy|Medium|Hard|Tricky|Trivial|Basic|Intermediate|Advanced|Extreme|Unreasonable|easy|medium|hard|tricky|trivial|basic|intermediate|advanced|extreme|unreasonable)$/i.exec(
      source,
    );
  if (preset)
    return `${preset[1]} ${vi[preset[2].charAt(0).toUpperCase() + preset[2].slice(1).toLowerCase()]}`;
  const ballPreset =
    /^(\d+x\d+), (\d+(?:-\d+)?) (balls?|pegs?|mines?|cells?|points?)$/.exec(
      source,
    );
  if (ballPreset)
    return `${ballPreset[1]}, ${ballPreset[2]} ${ballPreset[3].startsWith("ball") ? "quả cầu" : ballPreset[3].startsWith("peg") ? "chốt" : ballPreset[3].startsWith("mine") ? "mìn" : ballPreset[3].startsWith("cell") ? "ô" : "đỉnh"}`;
  const marked = /^(Balls?|Pegs?|Mines?) marked: (\d+) \/ (\d+)$/.exec(source);
  if (marked)
    return `${marked[1].startsWith("Ball") ? "Quả cầu" : marked[1].startsWith("Peg") ? "Chốt" : "Mìn"} đã đánh dấu: ${marked[2]} / ${marked[3]}`;
  const current = /^Current score: (\d+)$/.exec(source);
  if (current) return `Điểm hiện tại: ${current[1]}`;
  const moves = /^Moves: (\d+)$/.exec(source);
  if (moves) return `Lượt: ${moves[1]}`;
  const doubleNum = /^Up to (double-\d+)$/.exec(source);
  if (doubleNum) return `Đến ${doubleNum[1].replace("double-", "đôi-")}`;
  const score = /^Score: (\d+)$/.exec(source);
  if (score) return `Điểm: ${score[1]}`;
  const gridWord =
    /^(\d+x\d+) (Crosses|Random|Tetrahedron|Octahedron|Icosahedron)$/.exec(
      source,
    );
  if (gridWord) return `${gridWord[1]} ${vi[gridWord[2]]}`;
  const coloursPreset = /^(\d+x\d+), (\d+) (colours?|Colours?)$/.exec(source);
  if (coloursPreset) return `${coloursPreset[1]}, ${coloursPreset[2]} màu`;
  const movesLeft = /^(\d+) \/ (\d+) moves$/.exec(source);
  if (movesLeft) return `${movesLeft[1]} / ${movesLeft[2]} lượt`;
  const gridMode =
    /^(\d+x\d+) (Normal|Unique|Unique rows and columns|Jigsaw|Killer)$/.exec(
      source,
    );
  if (gridMode) return `${gridMode[1]} ${vi[gridMode[2]] || gridMode[2]}`;
  const gems = /^Gems: (\d+)$/.exec(source);
  if (gems) return `Ngọc: ${gems[1]}`;
  const shapeDiff = /^(\d+x\d+) (.+?) - (Easy|Medium|Hard|Normal)$/.exec(
    source,
  );
  if (shapeDiff)
    return `${shapeDiff[1]} ${vi[shapeDiff[2]] || shapeDiff[2]} - ${vi[shapeDiff[3]] || shapeDiff[3]}`;
  if (import.meta.env?.DEV && !missing.has(source)) {
    missing.add(source);
    console.warn("[engine i18n missing]", source);
  }
  return source;
}
