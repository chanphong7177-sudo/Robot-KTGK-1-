# VELA D1 — Robot giao hàng tự hành

Dự án học tập: website giới thiệu robot giao hàng VELA D1, kèm phần thử thuật toán tìm đường **A\*** viết bằng **Python**.

## Cấu trúc thư mục

| File | Nội dung |
|---|---|
| `index.html` | Nội dung trang: giới thiệu, vấn đề/giải pháp, tính năng, tìm đường, wireframe, ứng dụng |
| `style.css` | Giao diện trang (sáng/tối, điện thoại) |
| `script.js` | Lưới bản đồ (vẽ bằng canvas), 5 bản đồ mẫu + 4 thành phố, ô nhập 0/1/S/G, nạp `astar.py`, vẽ ô đã xét, đường đi và robot chạy |
| `thanhpho.js` | Sinh bản đồ **thành phố** (đại lộ, hẻm, công viên, quảng trường, xe đỗ) tới 150×150, cùng mã seed thì ra cùng thành phố |
| `vatly.js` | **Vật lý** robot: làm mượt tuyến, bo cua, tăng tốc / phanh / giới hạn tốc độ khi vào cua |
| `giaothong.js` | **Giao thông**: ô tô chạy theo làn (đi bên phải), đèn giao thông ở ngã tư, người đi bộ trên vỉa hè |
| `duongvong.js` | **Đường vòng**: bị xe / người đứng yên chặn thì chạy A* (astar.py) trên khung nhỏ quanh robot để đi vòng cho nhanh |
| `hatung.js` | **Chế độ Húc** (phím **B** trong cửa sổ 3D): vật lý văng / xoay / rơi / nảy của người, ô tô, xe đỗ, nón, cây bị robot tông |
| `loaio.js` | Danh sách loại ô (đường, nhà, làn xe, ngã tư, xe đỗ, nón, cây) dùng chung cho mọi file |
| `tocdo.js` | Thanh **tốc độ** 10–40 ô/giây (kéo hoặc gõ số), dùng chung cho 2D và 3D, nhớ lựa chọn lần sau |
| `astar.py` | **Thuật toán A\*** bằng Python, chạy trong trình duyệt qua Brython |
| `chay_web.bat` / `chay_web.py` | Bật máy chủ web cục bộ (tự chọn port trống) và mở trang |
| `xem3d.js` | Cửa sổ **Xem trong 3D** (three.js): dựng bản đồ 3D, robot chạy theo tuyến A\*, 6 góc camera |
| `tao_robot_blender.py` / `tao_robot_3d.bat` | Script **Blender** dựng mô hình robot và xuất `robot.glb` + `robot.blend` |
| `robot.glb` / `robot.blend` | Mô hình robot 3D (trang web nạp `robot.glb`; mở `robot.blend` để sửa trong Blender) |

## Chạy website

Nhấp đúp **`chay_web.bat`** (hoặc `python chay_web.py`) → trình duyệt tự mở trang.
Trình chạy tự tìm port còn trống từ 8765 trở lên, nên không đụng chương trình khác đang dùng port 8000.

> Không mở thẳng `index.html` bằng cách nhấp đúp: trình duyệt sẽ chặn việc đọc `astar.py`
> (quy tắc bảo mật với `file://`) và trang sẽ báo cần chạy `chay_web.bat`.

Cần Internet để tải Brython (bộ chạy Python 3 trong trình duyệt) và font chữ.


## Xem trong 3D

Bấm **🧊 Xem trong 3D** (cạnh nút "Tìm đường"). Nếu chưa bấm "Tìm đường" thì cửa sổ 3D tự chạy A\* trước.
Cảnh 3D: ô xanh lá = ô A\* đã xét, ô cam + vạch cam = tuyến đường, khối xám = vật cản, nón cam = điểm giao.

Góc camera (bấm nút hoặc phím số): **1** Toàn cảnh · **2** Góc chéo · **3** Bám theo · **4** Mắt robot ·
**5** Trực thăng · **6** Xoay quanh · **7** Tự do (kéo chuột để xoay, cuộn để phóng to). Phím **R** chạy lại, **Esc** đóng.

**Chế độ Húc (phím B hoặc nút 💥)**: robot kệ mọi vật cản trừ nhà, không nhường ai, tính lại tuyến thẳng từ chỗ đang đứng. Gặp người, ô tô, xe đỗ, nón, cây thì tông: vật văng lên, xoay, rơi, nảy rồi nằm im (người / xe chạy biến mất rồi xuất hiện lại), camera rung. Bấm B lần nữa để về chạy bình thường.

### Sửa robot bằng Blender

1. Mở `robot.blend` trong Blender để xem, hoặc sửa kích thước/màu ở đầu file `tao_robot_blender.py`.
2. Nhấp đúp `tao_robot_3d.bat` (hoặc `blender --background --python tao_robot_blender.py`) để xuất lại `robot.glb`.
3. F5 trang web. Robot mới sẽ xuất hiện trong cửa sổ 3D.

Quy ước: 1 đơn vị = 1 ô lưới, gốc ở giữa đáy robot, mặt trước hướng **-Y** trong Blender.
Không có `robot.glb` thì trang dùng mô hình dựng sẵn cùng hình dạng. Cần Internet để tải three.js.

## Định dạng bản đồ

Mỗi dòng là một hàng của lưới:

- `0` = đường đi
- `1` = vật cản
- `S` = điểm xuất phát (không ghi thì mặc định góc trên-trái)
- `G` = điểm giao hàng (không ghi thì mặc định góc dưới-phải)
- `N` / `D` = làn ô tô ngang / dọc, `+` = ngã tư (robot đi được nhưng tránh, chỉ băng qua khi cần)
- `X` = ô tô đang đỗ, `C` = nón giao thông, `T` = cây (đều là vật cản)

Có thể viết liền (`0010`) hoặc cách nhau bằng dấu cách / dấu phẩy (`0 0 1 0`). Tối đa 150×150 trên web.

## Bản đồ thành phố

Có sẵn 4 bản đồ mẫu 🏙 (40×40, 80×80, 120×120, 150×150). Muốn thành phố khác thì chọn kích thước ở mục
"Thành phố ngẫu nhiên" rồi bấm **🎲 Tạo thành phố**. Bạn vẫn bấm/kéo trên lưới để thêm hoặc xóa nhà như bình thường.
Trong 3D, mỗi cụm vật cản liền nhau là một tòa nhà (càng gần trung tâm càng cao), cụm 1–2 ô là cây, ô đường sát nhà là vỉa hè.

## Xe cộ, người đi bộ, đèn giao thông

Bản đồ có làn xe (các bản đồ 🏙) sẽ có giao thông chạy thật, bật/tắt bằng ô **🚗 Xe cộ, người đi bộ, đèn giao thông**:

- **Ô tô** chạy theo làn, đi bên phải (nửa trên đường ngang chạy sang trái, nửa dưới sang phải; nửa trái đường dọc
  chạy xuống, nửa phải chạy lên). Xe giữ khoảng cách với xe trước, dừng ở đèn đỏ, không chạy vào ngã tư khi bên kia đang kẹt
  hoặc còn xe chiều kia trong ngã tư. Chạy ra mép bản đồ thì biến mất rồi xuất hiện lại ở đầu làn.
- **Đèn giao thông** chỉ có ở ngã tư lớn (đại lộ 4 làn gặp đại lộ 4 làn), chu kỳ 15 s (6 s xanh ngang, 1,5 s đỏ hết, 6 s xanh dọc, 1,5 s đỏ hết), mỗi ngã tư lệch pha khác nhau. Bản đồ nhỏ không có ngã tư lớn thì ngã tư rộng nhất được gắn đèn.
- **Ngã tư không đèn**: ai tới trước đi trước. Chiều đang đi giữ ngã tư tới khi hết xe; giữ quá 4 s mà chiều kia đang chờ thì nhường lại.
- **Vì sao xe dừng?** Mỗi xe có `lyDo` (đèn đỏ, xe phía trước, nhường robot, xe chiều kia trong ngã tư, bên kia ngã tư đang kẹt…). Chỗ robot hay phải chờ nhất là ngay trước ngã tư: xe đứng chờ xe chiều kia / đèn đỏ đúng chỗ robot băng qua.
- **Đường vòng (`duongvong.js`) — ưu tiên thời gian hơn quãng đường**: robot đứng chờ ≥ 0,6 s vì xe / người **đứng yên**, hoặc bị người đi chậm kìm tốc độ ≥ 0,8 s, thì đánh dấu các ô thân chúng chiếm là tường, chạy lại A* (`astar.py`) trên một khung nhỏ quanh robot tới một điểm phía sau chỗ bị chặn, rồi ghép với phần còn lại của tuyến. Chấp nhận đi xa hơn tối đa 30 ô để khỏi chờ. Xe đang chạy qua thì vẫn chờ (nhanh hơn đi vòng). Số lần đi vòng hiện ở kết quả và HUD 3D.
- **An toàn**: robot không bước vào khoảng phanh trước mũi xe đang chạy; xe ô tô đoán trước chỗ robot sắp băng ngang tới (0,3 s, 0,6 s) để dừng kịp.
- **Kích thước theo tỉ lệ thật** (1 ô ≈ 2,5 m): ô tô dài 1,7 ô × rộng 0,8 ô (`XE.dai`, `XE.rong` trong `giaothong.js`), robot giao hàng nhỏ hơn nhiều (`TL_ROBOT = 0.55` trong `xem3d.js`), người đi bộ cao ~0,7 ô. Xe đỗ trong bãi chiếm 2 ô X trên–dưới.
- **Người đi bộ** đi trên vỉa hè, hẻm, công viên; gặp robot trước mặt thì né sang ô xa robot nhất.
- **Robot** đi vỉa hè (A\* tính 1 ô làn xe tốn bằng 3 ô vỉa hè), chỉ băng qua đường khi cần. Robot đoán vị trí xe/người
  trong 1,2 s tới; nếu sắp chắn tuyến thì phanh dừng chờ (viền robot đỏ, thanh trạng thái báo "đang nhường đường").
  Xe đã dừng nhường robot thì robot đi tiếp; gặp người đi bộ trong hẻm cụt quá 3 s thì robot "xin đường" lách qua.

## Vật lý và tốc độ

Ô **Tốc độ tối đa** nhận số từ **10 đến 40** (ô/giây), có thể kéo thanh trượt hoặc gõ số. Đổi tốc độ ngay khi robot đang chạy cũng được.
Robot không còn nhảy từng ô mà chạy như xe thật (`vatly.js`):

1. Kéo thẳng tuyến A\* (bỏ các bậc thang) nhưng vẫn giữ khoảng cách 0,3 ô với tường.
2. Bo tròn mỗi góc cua, tính độ cong `k`. Tốc độ an toàn khi vào cua là `v = √(a_ngang / k)`.
3. Tính ngược từ đích (`v = 0`) để biết phải phanh từ đâu: `v² = v_sau² + 2·a_phanh·Δs`.
4. Mỗi khung hình: tăng tốc tối đa 14 ô/s², phanh tối đa 24 ô/s², không vượt tốc độ bạn chọn.

Trong 3D thân robot ngả ra sau khi tăng tốc, chúi tới khi phanh, nghiêng ra ngoài khi vào cua (lò xo – giảm chấn),
bánh xe quay theo tốc độ. Thanh dưới cảnh 3D hiện tốc độ, gia tốc, quãng đường và thời gian.

## Thuật toán A\* trong `astar.py`

1. Đưa ô xuất phát vào hàng đợi ưu tiên `cx` (binary heap tự viết: `day_vao`, `lay_ra`).
2. Lấy ô có `f` nhỏ nhất ra xét (heap trả về ngay, không phải quét cả danh sách), với `f = g + khoảng cách tới đích`
   (`g` là số bước đã đi, khoảng cách là Manhattan: chênh hàng + chênh cột).
3. Nếu ô đó là đích thì lần ngược `ot` (ô trước) để có đường đi.
4. Nếu không, xét 4 ô xung quanh: bỏ qua ô ngoài bản đồ, vật cản, ô đã xét;
   nếu tìm được đường ngắn hơn tới ô đó thì lưu lại `g`, `f`, `ot`.
5. Hết ô để xét mà chưa tới đích thì không có đường.

Hàm `td(bd, xp, dc)` (tìm đường: bản đồ, xuất phát, đích) trả về đường đi `dd` và các ô đã xét `dx`; không có đường thì `dd` rỗng.

| Tên | Nghĩa |
|---|---|
| `kc` | khoảng cách Manhattan |
| `day_vao`, `lay_ra` | đẩy vào / lấy ra khỏi heap |
| `cp` | chi phí đi vào ô (1 vỉa hè, 3 làn xe, 0 = vật cản) |
| `td` / `td_web` | tìm đường / bản gọi từ web |
| `bd`, `xp`, `dc` | bản đồ, xuất phát, đích |
| `sh`, `sc` | số hàng, số cột |
| `cx`, `dx`, `dax` | hàng đợi các ô cần xét, thứ tự các ô đã xét, tập (set) ô đã xét |
| `ot` | ô trước (để dựng lại đường) |
| `ht`, `hg`, `ct` | ô hiện tại, hàng, cột của nó |
| `oxq` | các ô xung quanh |
| `gm` | g mới |
| `dd` | đường đi |
| `kq`, `tg` | kết quả, thời gian |
