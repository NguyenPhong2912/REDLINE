# REDLINE Astral Depth — hệ thống chiều sâu, chuyển động và bố cục

**Version:** 1.1 · **Date:** 2026-09-04 · **Status:** phases 1–2 in code (Protocol + 7 trang vận hành), phase 3 in design

Astral Depth là lớp nâng cấp của thiết kế Astral hiện có: **giữ nguyên** palette (nền `#080d19`, panel `#121c30`, vàng champagne `#dfc38c`, Inter / JetBrains Mono / Georgia italic) và thêm bốn thứ mà bản trước còn thiếu — một thang bóng đổ thống nhất, chiều sâu 3D xếp lớp, nút bấm có xúc giác, và một bộ mô-típ 3D dùng chung (voxel · chain · water · open book) để trang Protocol kể được câu chuyện *"the agent proposes, the chain decides"* bằng chuyển động.

Nguồn thiết kế: `design/astral-depth/` (12 artboard `.dc.html` + `canvas.json` của Claude Design canvas) và bản canvas bấm được đã chia sẻ trong phiên thiết kế.

## 1. Token

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--ease` | `cubic-bezier(.16,1,.3,1)` | mọi transition / entrance |
| `--sh-1` | 1px top light + 24px soft | input, chip, tool, resting |
| `--sh-2` | 2 lớp 34 / 70px | panel, card, KPI tile |
| `--sh-3` | 3 lớp + 70px gold ambient | hover, hero worlds, modal |
| `--sh-gold` | 26px gold bloom + inset rim | CTA chính |
| `--pg` | r,g,b theo route (hoyoverse.css) | viền đùn nổi của panel, corner, water dưới banner |

Quy tắc bất biến từ `DESIGN_SYSTEM_PROMPT.md` vẫn áp dụng: mono = sự thật on-chain, sans = diễn giải; màu trạng thái bão hòa và chỉ xuất hiện đúng khoảnh khắc có nghĩa; nút không hoàn tác được tách khỏi hàng nút thường.

## 2. Chiều sâu

- **Panel**: `--sh-2` khi nghỉ, cộng viền đùn nổi 8px theo `--pg` (`8px 8px 0 rgba(var(--pg),.22)`); hover nhấc 3px và chuyển `--sh-3`. Áp cho `.route-page .rounded-2xl`, `.redline-spine`, `.protocol-facts`, `.analytics-ledger`, `.market-grid > *`.
- **KPI tile / fact**: `preserve-3d`, hover `translateZ(12px)`.
- **Nút**: cạnh đùn 4–5px (`0 5px 0 0 #8f7340`) sập xuống khi `:active` (`translateY(4px)`, transition 60ms) kèm gợn sóng `::after`. Class: `.rl-btn-gold`, `.rl-btn-ghost`, `.rl-btn-danger`; các nút Astral cũ (`.astral-button`, `.protocol-primary-action`) được nâng cấp tự động.

## 3. Mô-típ 3D (`src/app/components/depth/`)

| Component | CSS | Ý nghĩa |
|---|---|---|
| `VoxelCube` | `.vox` ba mặt, `--vs` kích cỡ, `--vc` màu; `tone` = gold / ok / bad / info | khối = một proposal, một block, một đơn vị tài sản |
| `ChainLinks` / `ChainConnector` | `.rl-chain`, `.lnk` | "link by link" — chuỗi xích nối các cổng |
| `WaterDivider` / `StoryDivider` | `.rl-water`, `.rl-divider` | dòng chảy nối các chương, đáy hero và banner |
| `GateChain` | `.gate-chain`, `rl-gate-0..6`, `rl-runner` | 7 cổng là phiến đùn nổi; vòng 24 s: proposal 1 qua hết → vault sáng, proposal 2 bị chặn ở cổng 06 |
| `OpenBook` | `.rl-book` | Three worlds là sách mở: bìa, gáy, tờ giấy xếp lớp, trang phải lật vào từ −86° |

Mọi chuyển động là CSS keyframe (không JS trên main thread); `prefers-reduced-motion` biến tất cả thành khung tĩnh và ẩn runner.

## 4. Bố cục theo trang (phase 2 — đã vào code)

Mỗi trang vận hành có một bố cục riêng thay cho công thức "journey bar → banner → panel". Banner nghệ thuật của route bị ẩn, journey bar rút còn 44px, tiêu đề trang thành một dòng topline (`.route-page > :first-child`), phần còn lại là bố cục riêng của trang bằng CSS override trong `astral-depth.css` cộng bốn component mới trong `depth/`:

| Component | Trang | Dữ liệu thật |
|---|---|---|
| `TransferLane` | Guardrails | `subscribeFeed("*")` — `intent.created` → coin bay, `tx.confirmed` → 7 cổng xanh + vault sáng, `tx.rejected`/`decision.precheck` → dừng ở cổng theo `reasonCode` |
| `PolicyDeck` | Guardrails (trong `GrantsPanel`) | 3 grant mới nhất (grant còn sống lên trước); click đưa thẻ ra trước và mở danh sách proposal |
| `VaultScene` | Treasury (trong `VaultPanel`) | `balanceUnits` on-chain; mỗi khối = 1,000 dUSDC, tối đa 12; refill → khối rơi, withdraw → khối bay ra |
| `FlipCard` | Agents | mặt trước là thẻ agent hiện có, mặt sau là `agentHash` và công thức `sha256(modelRef\|codeRef\|config)` |

| Trang | Bố cục | Hoạt cảnh giao dịch |
|---|---|---|
| Guardrails | *policy deck* (thẻ grant vật lý xếp chồng 3D) + wizard + **live transfer lane** | Start agent → coin bay qua 7 cổng, cổng sáng xanh, dòng log rơi vào; Force over cap → dừng ở 06, lóe đỏ |
| Treasury | cảnh vault toàn màn, mỗi khối voxel = 1,000 dUSDC | Refill → khối rơi vào; Withdraw → khối bay về ví |
| Audit | dòng thời gian với tia chạy, thẻ sự kiện nhóm theo ngày, khối bằng chứng đối chiếu | — |
| Marketplace | spotlight + coverflow 3D | Rent → "Verifying on devnet…" → "Hired" + bung pixel |
| Agents | thẻ định danh lật 180° lộ công thức hash | — |
| Analytics | bento grid, cột 3D, donut nghiêng | — |
| Settings | sidebar tabs 3D | — |
| Copilot | chat với model local (Ollama qua `OPENAI_BASE_URL=http://localhost:11434/v1`), model card, connection panel | stream token |
| Models | profiling model: TTFT / tok/s / p95, calibration vs. gate outcome, adversarial suite | Run benchmark |
| Profile | thẻ owner, heatmap ký, sessions, API key, signatures | — |

## 5. Lộ trình vào code

1. **Phase 1 (đã commit)** — `astral-depth.css`, 5 component depth, Protocol dùng `GateChain` + `OpenBook` + water dividers, nút xúc giác toàn app.
2. **Phase 2 (đã commit)** — bố cục riêng cho 7 trang vận hành theo bảng trên, `TransferLane` / `PolicyDeck` / `VaultScene` / `FlipCard` nối vào dữ liệu và feed SSE thật. Còn nợ: gộp 5 lớp CSS (`index → astral → layout → hoyoverse → pixel-onchain → astral-depth`) thành hai file và bỏ `!important`.
3. **Phase 3** — Copilot (route chat SSE song song `askForJson`), Models, Profile.

## 6. Kiểm tra

`npm run typecheck && npm run build` phải xanh. Khi thêm hiệu ứng mới: có nhánh `prefers-reduced-motion`, không quá 3 lớp parallax một cảnh, không `filter: blur` trên phần tử đang animate.
