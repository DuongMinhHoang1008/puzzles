# Thiết kế web Puzzles: UI, game feel, EN/VI và GitHub Pages

Trạng thái: đề xuất thiết kế, chưa triển khai frontend hoặc workflow deploy.
Ngày: 2026-10-08.

## 1. Hướng sản phẩm

Tên làm việc: Puzzle Studio. Một bộ puzzle gọn, dễ vào chơi, có cảm giác thao tác tốt trên desktop lẫn điện thoại. Giữ tên và nguồn gốc từng game; footer ghi công Simon Tatham và các tác giả trong LICENCE.

Hướng ưu tiên: Calm Studio — nền giấy sáng hoặc nền mực tối, điểm nhấn teal, typography rõ dấu tiếng Việt, bàn chơi là vùng nổi bật nhất. Hướng thay thế: Pocket Play — bố cục gọn, toolbar dưới bàn, hợp điện thoại và những ván ngắn. Hai hướng dùng chung engine, không tạo hai frontend cần duy trì.

Không đưa ranking online, tài khoản, tiền tệ, streak hoặc daily challenge vào bản đầu. Có thể bổ sung sau khi trải nghiệm chơi và lưu ván ổn định.

## 2. Những gì đã kiểm tra

Repo này chứa C engine, frontend Objective-C/iOS và frontend Emscripten đời cũ. Trang index.html hiện là tài liệu, không phải launcher game.

- `Recipe`, các file `*.R`, `mkfiles.pl`: mô tả các game và dependency; Makefile được sinh tự động.
- `mkfiles.pl:1776`: build cũ dùng `ASM_JS=1`. Không coi pipeline này đã tương thích Emscripten hiện đại.
- `emccpre.js`: Module và canvas/dialog/input được quản lý bằng global; input phụ thuộc mouse và `setCapture` cũ.
- `emcclib.js`: dùng `Pointer_stringify`, style/statusbar hardcode, tạo DOM trực tiếp; timer `setInterval` 20 ms dùng `new Date()`.
- `html/jspage.pl`: sinh trang theo các DOM ID cố định, nội dung ASCII/tiếng Anh.
- `puzzles.h`: đã có `midend_status`, undo/redo, serialise/deserialise, `anim_length`, `flash_length` và drawing interface.
- `emccx.json`: export hiện tại chủ yếu là input/command/resize; chưa export API lưu ván, lifecycle và state event cho app mới.

Trang Simon hiện mô tả bản web JavaScript + WebAssembly. Repo cục bộ không phải chính xác snapshot hiện tại của trang đó; không mặc định mọi game hay artifact trên trang đều có ở đây.

## 3. Luồng và màn hình

### Thư viện

Header: logo, thư viện, chọn EN/VI, theme, cài đặt. Nội dung: tiếp tục ván đang chơi nếu tồn tại, rồi danh sách game dạng card có thumbnail từ board thật, tên, mô tả một câu và nút Chơi. Tìm bằng cả tên gốc lẫn tên Việt; filter theo nhóm số, đường nối, vùng, màu, di chuyển. Favorite lưu trên máy.

Tên card: `Net · Nối mạng`, `Solo · Sudoku`, `Light Up · Thắp sáng`. Các tên dịch này là tên hiển thị đề xuất; ID engine vẫn là net/solo/lightup. Không gắn nhãn độ khó cố định cho cả game: độ khó thuộc preset hoặc cấu hình từng game.

Không tải tất cả engine khi mở thư viện. Thumbnail là asset tĩnh; engine chỉ tải khi người dùng mở game.

### Bàn chơi desktop

Thanh trên: quay lại, tên game, preset/cấu hình, chia sẻ, trợ giúp. Trung tâm: board với vùng thở vừa đủ, không quảng cáo hoặc popup che bàn. Toolbar: Undo, Redo, Ván mới; Restart, Solve, nhập Game ID và seed trong menu phụ. Solve có nhãn Giải tự động và trạng thái kết quả riêng, không được trình bày như Hint.

Thanh bên: mục tiêu, hướng dẫn 2–3 bước, thao tác chuột/phím và nút mở luật đầy đủ. Có Focus mode để ẩn hướng dẫn. Timer và số lượt chỉ hiển thị khi định nghĩa đo lường của game đã rõ; không suy ra số lượt bằng đếm click hay đưa ra phần trăm hoàn thành giả.

### Bàn chơi mobile

Board chiếm phần lớn chiều ngang; toolbar chính đặt ngay dưới, cách vùng chạm trên board. Help/cấu hình mở dạng sheet. Nút tác vụ có vùng chạm tối thiểu 44 px; ô board mục tiêu 40–48 px khi kích thước cho phép. Board lớn dùng zoom/pan và chế độ điều khiển rõ, không ép ô thành quá nhỏ.

Tap tương đương thao tác chính; hành động phụ có mode switch riêng như Đánh dấu/Khóa. Long press chỉ là shortcut bổ sung. Drag dùng Pointer Events và pointer capture, xử lý cancel/lost capture; không chặn scroll trên toàn trang. Resize và DPR phải chuyển đúng từ CSS pixels sang tọa độ engine. Không stretch canvas để đổi tỉ lệ bàn chơi.

### Kết thúc và phục hồi

Khi chuyển từ chưa hoàn thành sang hoàn thành: nhấn sáng board ngắn, âm hoàn thành nếu người dùng bật âm, sau đó hiện thẻ kết quả không che bàn quá lâu. Có Ván mới và Xem lại. Undo có thể đưa game về trạng thái chưa hoàn thành. Khôi phục một save đã hoàn thành không tự phát lại celebration.

Khi quay lại site: phục hồi ván dở cùng preset và trạng thái undo/redo nếu engine serialisation hỗ trợ; báo riêng khi save không tương thích thay vì âm thầm thay bằng ván mới.

## 4. Design system

| Thành phần | Quyết định |
| --- | --- |
| Typography | Font có đủ dấu Việt, self-host subset phù hợp; số trên bàn dùng tabular figures khi hữu ích |
| Màu | Nền trung tính, teal cho thao tác chính; lỗi có biểu tượng/nhãn, không chỉ dựa vào màu |
| Board | Đường và số tương phản cao; palette có tên semantic theo game, không thay mọi màu bằng một accent |
| Surface | Radius 12–20 px cho UI; radius/tile gap của game phải giữ tính rõ ràng của luật |
| Theme | Light/Dark, mặc định theo hệ thống; đổi theme không restart engine |
| Focus | Focus ring rõ, keyboard navigation; modal trả focus về nút mở |
| Accessibility | Reduced motion, âm tắt mặc định, phân biệt màu bằng hình/ký hiệu khi game cần |
| Loading/error | Skeleton đúng kích thước board, retry khi tải WASM lỗi, thông báo EN/VI |

Canvas không tự có semantics cho screen reader. Bản đầu cung cấp app chrome dùng được bằng bàn phím và hướng dẫn điều khiển; hỗ trợ đọc từng ô sẽ cần semantic board adapter riêng cho từng game, không tuyên bố toàn bộ collection đã accessible.

## 5. Juice và polish

Nguyên tắc: animation theo hành động engine chấp nhận; trạng thái C là nguồn sự thật. Click chưa chắc là một nước đi. Không phát âm hoặc hiệu ứng thành công khi engine bỏ qua input. Không đoán completed từ chuỗi statusbar.

| Tình huống | Feedback đề xuất | Khoảng thời gian mục tiêu |
| --- | --- | --- |
| Nhấn UI | Scale nhẹ, highlight trạng thái | 80–120 ms |
| Đặt/đánh dấu | Pop nhỏ ở ô đã thay đổi, click âm mềm nếu bật | 100–160 ms |
| Undo/Redo | Chuyển trạng thái ô liên quan, feedback trung tính | 100–160 ms |
| Xung đột luật | Pulse outline/biểu tượng; chỉ khi engine biết có conflict | 120–200 ms |
| Ván mới | Chuyển board ngắn, loading nếu đang sinh | 150–220 ms |
| Hoàn thành | Một sweep/glow gọn, âm kết thúc, thẻ kết quả | 400–700 ms |

Hai lớp:

1. Shared feedback: UI press, accepted action, loading, completion, audio và settings. Có thể áp dụng toàn collection với semantic event đủ tối thiểu.
2. Per-game polish: Net xoay tile và truyền sáng qua network; Light Up lan ánh sáng qua ô; Fifteen trượt tile; Pattern đánh dấu dứt khoát; Bridges kéo/hiện nét cầu; Same Game pop nhóm ô và rơi ô. Mỗi game có adapter quan sát thay đổi cần thiết.

Không tween từng lệnh `draw_line`/`draw_rect`: renderer C có thể redraw nhiều lần và dùng clip/blitter. Biến primitive thành animation không biết ngữ nghĩa sẽ gây trễ state hoặc sai hình. Lượt đầu giữ renderer canvas hiện có, sửa palette và thêm feedback layer riêng. Net là pilot để kiểm chứng tile transform cần semantic hook hay thay phần renderer theo game.

CSS transition và Web Animations API dùng cho DOM UI. Canvas feedback dùng requestAnimationFrame có điều kiện và pool nhỏ; animation hình học game dùng engine callback hoặc adapter, không DOM hóa mọi ô của mọi game. DOTween/Odin thuộc Unity và không áp dụng trực tiếp cho frontend này; giữ nguyên nguyên tắc lifecycle tương đương: cancel animation, hủy listener, dừng timer và free engine khi rời bàn.

Audio khởi tạo sau gesture, mặc định tắt và nhớ lựa chọn. Chọn âm khác nhau có giới hạn, giới hạn polyphony; không phát mỗi frame. Không cần haptic trong bản đầu vì thiết bị/browser hỗ trợ khác nhau.

## 6. EN/VI

Tách ba tầng nội dung:

1. App chrome: menu, button, setting, loading/error, completion và accessibility labels; catalog theo key, ví dụ `game.new`, `game.undo`, `settings.language`.
2. Luật chơi: EN/VI viết có chủ ý, mục tiêu và ví dụ ngắn, thuật ngữ thống nhất. Chuyển ngôn ngữ không sinh lại board.
3. Engine strings: presets, config labels/choice lists, status, lỗi validation và chữ thật trong canvas. Cần inventory, map/ID và structured values. Bridge cũ có thể dùng exact source-string map có cảnh báo thiếu key làm bước chuyển tiếp; không dùng replace/regex tùy tiện trên câu tiếng Anh có số.

Trạng thái ứng dụng ưu tiên dữ liệu như `{ kind: 'moves', count: 12 }` hoặc `{ kind: 'validation', code: 'invalid-size' }`; UI tự format theo locale. Với text chưa có adapter, fallback EN rõ ràng và đưa vào danh sách cần dịch. Bản release nhận tiêu chí EN/VI chỉ khi các chuỗi reachable của các game trong release đã được kiểm kê.

Preset ID, game ID, seed, save format và numeric puzzle labels giữ invariant; không dịch dữ liệu định danh. Dùng UTF-8 xuyên bridge, font hỗ trợ dấu Việt. Locale ưu tiên lựa chọn đã lưu, sau đó browser, rồi EN. URL chia sẻ có game ID/preset/description và có thể kèm locale, không dùng tên dịch làm route.

## 7. Kiến trúc đề xuất

Stack ban đầu: TypeScript + Vite, DOM/CSS cho shell, Canvas 2D cho board, C → WebAssembly qua Emscripten. Không cần backend cho chơi offline, save local và chia sẻ qua URL.

Quan hệ dependency:

`Library / Player UI → PuzzleSession interface → EmscriptenSession → C midend → game`

`PuzzleSession events → FeedbackController / SaveController / HUD`

Contracts trước implementation:

```ts
type SessionEvent =
  | { type: 'state-changed'; cause: 'move' | 'undo' | 'redo' | 'new' | 'restore' }
  | { type: 'history-changed'; canUndo: boolean; canRedo: boolean }
  | { type: 'completion-changed'; completed: boolean; assisted: boolean }
  | { type: 'error'; code: string; fallbackMessage: string };

interface PuzzleSession {
  start(options: StartOptions): Promise<void>;
  input(action: InputAction): void;
  execute(command: GameCommand): void;
  snapshot(): SessionSnapshot;
  serialise(): Uint8Array;
  restore(data: Uint8Array): void;
  subscribe(listener: (event: SessionEvent) => void): () => void;
  dispose(): void;
}
```

Đây là sketch contract, không phải source compile-ready; các type còn lại được định nghĩa theo bridge thực tế trong spike. Không thêm hệ thống DI, event bus toàn cục hoặc framework plugin trước khi có nhu cầu.

- PuzzleSession: một owner cho một ván; lifecycle và event public tối thiểu.
- EmscriptenSession: module factory theo game, wrap API C, trạng thái owned memory và ready/error, hoàn toàn giấu Module khỏi UI.
- Input adapter: pointer/keyboard/cancel, tọa độ canvas và mode thao tác phụ.
- FeedbackController: nghe sự kiện, sở hữu animation/audio; optional adapter cho game có semantic tile data.
- SaveController: dùng engine serialisation, debounce sau state change, flush khi ẩn trang/rời game; không serialize mỗi frame. Envelope chứa schema version, game ID, engine build ID và metadata tương thích.
- i18n: catalog và engine-text adapter, không tạo service abstraction cho một JSON dictionary đơn giản.

Hoàn thành/assisted và state change cần hook sau midend xử lý; cấu trúc trên chưa tồn tại trong exports hiện tại. Khả năng undo/redo có thể tái sử dụng callback sẵn có. Hint chỉ hiển thị nếu game có hint thật; Solve chỉ là giải tự động.

Nếu modularize bridge cũ chưa khả thi ngay, iframe cùng origin là phương án tạm để cô lập global. Parent gửi command qua postMessage, kiểm tra origin/source và phiên session. Iframe giúp đóng runtime nhưng không tự tạo tile juice hoặc dịch nội dung; mục tiêu lâu dài vẫn là module factory, không tải nhiều game global vào cùng window.

Hiệu năng: không mount module cho từng library card; chỉ một session hoạt động; cache asset với giới hạn. Dirty redraw khi có thay đổi, rAF khi animation cần, `performance.now()` cho thời gian, pause/reset delta khi tab ẩn để tránh frame catch-up. Không tạo object/closure/DOM node mới trong vòng render mỗi frame; event payload chỉ khi state đổi. Chặn sinh ván liên tiếp hoặc hủy bằng teardown/recreate có token chống kết quả cũ.

## 8. Cấu trúc repo dự kiến

Giữ các source C/iOS tại vị trí hiện có để tránh diff lớn. Thêm:

```text
web/
  src/
    app/                 # library, player, settings
    engine/              # session, input, wasm adapter
    feedback/            # shared feedback + adapter game pilot
    locales/             # en, vi và engine mappings
    content/             # luật EN/VI theo game
    styles/
  public/                # assets và LICENSE/credits
  package.json
  vite.config.ts
tools/web/
  build-engine.*         # build qua manifest/dependency sinh từ Recipe/*.R
  generate-catalog.*
  games.manifest.json    # release IDs/capabilities, đối chiếu artifact build
.github/workflows/
  web-check.yml
  deploy-pages.yml
docs/
  web-modernization-design.md
```

Không sửa Makefile sinh tự động. Spike quyết định patch `mkfiles.pl`/Recipe để build modern WASM hay tạo driver build trong tools/web; cả hai phải lấy dependency từ Recipe/*.R thay vì duy trì một danh sách link thứ hai dễ lệch. Catalog chỉ liệt kê game có module build thành công; những game unfinished không tự động vào release.

## 9. Build và deploy GitHub Pages

Pipeline dự kiến:

`C sources → pinned Emscripten → per-game .js/.wasm + manifest → Vite build → dist → Pages`

Emscripten build hướng đến factory modularized với `MODULARIZE`, `EXPORT_ES6` và `WASM`; export bridge functions rõ ràng, thay `Pointer_stringify` bằng UTF8ToString và cập nhật library hooks. Pin một SDK stable sau compile spike, không chọn version bằng suy đoán. Cần sửa globals dùng trong emccpre/emcclib để nằm trong instance; bật flag không tự giải quyết vấn đề này.

Đường dẫn JS/WASM lấy qua base URL và module `locateFile`, có hash/version manifest thống nhất. Với repo tên puzzles: URL dự kiến `https://<owner>.github.io/puzzles/`, Vite base `/puzzles/`; với custom domain base `/`. Dùng hash routing như `/puzzles/#/play/net?...` để refresh không 404. Không dùng link root `/assets/...`.

GitHub Actions:

1. PR: compile engine, typecheck, build web và smoke test production artifact dưới base path dự kiến; không deploy.
2. Push default branch hoặc workflow_dispatch: checkout, setup Node pinned, npm ci, Emscripten pinned, build engine, build shell, kiểm tra artifact.
3. Upload đúng dist qua `actions/upload-pages-artifact`; deploy qua `actions/deploy-pages` và environment `github-pages`.
4. Quyền deploy tối thiểu `pages: write`, `id-token: write`; read source `contents: read`. Chỉ một deployment theo concurrency group.
5. Settings → Pages → Source: GitHub Actions. Dùng tên default branch thực tế khi triển khai, không mặc định main trước khi kiểm tra.

Pages chỉ nhận file static; Node/Emscripten dùng trong build, không chạy như backend trên Pages. Single-thread WASM là mặc định để không phụ thuộc COOP/COEP headers. Backend hoặc host khác chỉ cần nếu về sau muốn tài khoản/leaderboard xác thực.

Save local là ván đang chơi; link share mặc định chia sẻ cùng đề bằng Game ID, không tự chia sẻ đầy đủ lịch sử hiện tại. Description ổn định hơn seed khi generator thay đổi; share seed/save cần metadata version. PWA/offline là phase sau: cache module đã chơi, version đồng bộ loader/WASM, tránh phục vụ asset của hai build khác nhau.

## 10. Trình tự thực hiện và tiêu chí chốt

### Phase A — Technical spike

Build Net với SDK hiện đại, tạo module riêng, render/input/resize/undo/redo/Solve, probe status/completion và serialisation; chạy static build dưới `/puzzles/`. Sau đó build toàn manifest để tìm chênh lệch dependency/compiler. Chưa hứa toàn collection tương thích trước spike.

Chốt khi game thật chạy trong Chrome/Firefox, touch input được trên một máy thật, switch session không giữ timer/listener, refresh dưới base path chạy đúng. Nếu modern bridge khó migrate, ghi rõ phạm vi fallback iframe và cost trước khi chọn.

### Phase B — Vertical slice

Library tối thiểu + player thật + EN/VI + save/restore + theme + feedback cho Net. Thêm Solo và Light Up để kiểm chứng input số/pencil marks, xung đột và lighting. Chỉ chọn preset vừa phải trên mobile.

Chốt khi đổi locale/theme không mất ván, vòng new/undo/redo/solve/restore phát event chính xác, reload giữ save, solved-by-player và Solve khác nhau, tile feedback không làm lệch tọa độ/hit test.

### Phase C — Collection rollout

Đưa các game build được vào catalog; kiểm tra presets, config, resize, save, input đặc thù; dịch toàn UI/luật/engine text reachable của release. Shared juice trước, per-game polish theo nhóm. Không khai báo generic Hint hay move counter nếu chưa có semantics.

### Phase D — Release Pages

Deploy pipeline, smoke URL thật dưới repo path, EN/VI, loading/error và asset 404; credits/license; kiểm tra mobile và reduced motion. PWA offline có thể bổ sung khi pipeline ổn định.

### Mục tiêu đo lường

- Feedback nhìn thấy trong frame kế tiếp với ván thông thường; không delay input để chờ tween.
- Mục tiêu 60 fps trên thiết bị mobile tham chiếu được chọn; profile riêng generation và các board lớn.
- Không có rAF chạy vô ích khi session không có animation; chỉ cập nhật timer HUD nếu cần.
- Không có xu hướng heap/timer/listener tăng sau nhiều lần đổi game; thu benchmark trước khi đặt budget bundle/WASM cuối cùng.
- Kiểm tra build production dưới subpath, WASM tải được, share link/refresh hoạt động, completion chỉ phát khi có transition hợp lệ.
- EN/VI không có missing keys trong màn hình và game phát hành; bàn/phím và dấu Việt không bị clipping.

## 11. Nguồn tham khảo

- [Simon Tatham's Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/): collection hiện tại, web JS/WASM và kiến trúc frontend/backend.
- [Emscripten: Interacting with code](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html): exported C functions, ccall/cwrap và bridge JS.
- [Emscripten: Modularized Output](https://emscripten.org/docs/compiling/Modularized-Output.html): module factory và isolation.
- [Vite: Static deploy](https://vite.dev/guide/static-deploy.html): base path và build GitHub Pages.
- [GitHub: Custom workflows with Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): artifact/deploy workflow và permission.
- [MDN: Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API): animation DOM và lifecycle animation objects.

Các lựa chọn UI, duration, stack và roadmap phía trên là đề xuất của dự án, không phải hành vi đã triển khai hay benchmark đã đo.
