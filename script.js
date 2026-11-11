// Trang tìm đường: bản đồ (mẫu, thành phố, tự gõ), vẽ lưới bằng canvas, gọi A* (astar.py),
// rồi cho robot chạy theo tuyến bằng mô phỏng vật lý (vatly.js) với tốc độ người dùng chọn,
// giữa dòng xe cộ và người đi bộ (giaothong.js).
import { taoThanhPho } from './thanhpho.js';
import { lamMuotDuong, taoDuongCong, XeRobot } from './vatly.js';
import { TimDuongVong } from './duongvong.js';
import { layTocDo } from './tocdo.js';
import { O, KY_TU, TU_KY_TU, laVatCan, laLan } from './loaio.js';
import { GiaoThong, SO_MAU_XE, MAU_XE, MAU_NGUOI, KICH_THUOC_XE } from './giaothong.js';

const PRESETS = [
  { id:'zigzag', name:'Hành lang chữ Z', map:
`S0000000000101000100
00000000010000010000
11111111111111111110
00000001100000000000
01010100000000001000
01111111111111111111
00010000000000000000
00000000101001001000
11111111111111111110
00000010000010010010
01000000001000000000
01111111111111111111
01011000000000100000
00000010000000000000
11111111111111111110
01100000000000000100
00000000000101101010
0000000000000000000G` },
  { id:'hotel', name:'Tầng khách sạn', map:
`01001010010100100101
00101010010000100001
0S001100111010101001
00001000010100101001
00001000010000100001
10001000010000100001
00001001010000101101
01001000010100100001
11011111011011111011
00000000000000000000
10111111010111111101
00101000010000100001
00101000010100100101
00001100010100100001
00001000010000100001
10001100010000110011
001010101100001001G1
00001000011010110001
00001000111000100001` },
  { id:'maze', name:'Mê cung', map:
`S000000101000001000
1111110101010101110
0001000100010100010
0101011101110111010
0100010001010101010
0111110111010101010
0001000000010100010
1101011111110101110
0101010000000101000
0101010111111101011
0101010100010001000
0101110101010111010
0101000101010100010
0101011101010111110
0101010001010100000
0101011101010101110
0001000101010101010
0111110101110101010
000000010000000100G` },
  { id:'warehouse', name:'Kho hàng', map:
`S0100000000000000000
01101101101101101100
01101111101101101100
01101101101101101100
00010000010000000100
01101101101101101100
01101101101101101100
01101101101101101100
00000000000000000100
01101101101101101100
01101101101101111101
01101101101101101100
10000000010001000000
01101101101101101100
01101101101101101100
01101101101101101100
00000000100000010000
0001000000000000000G` },
  { id:'lobby', name:'Sảnh có cột', map:
`S0000000000000000000
00110010001000100010
00110000011100000000
00000000011110000000
01111110001000100010
01111100000000000000
00000001110000000000
00111010001110111110
00111000001110111110
00000011000000011110
00100011001000101110
00001110001001110000
11111110111000000000
01111010111000100010
11111000000000000000
11100000000000000000
0010001000100010001G` }
];
// Bản đồ thành phố: sinh bằng thanhpho.js với seed cố định nên lần nào mở cũng giống nhau.
PRESETS.push(
  { id:'pho-40',  name:'🏙 Phố nhỏ 40×40',        tao:() => taoThanhPho(40, 40, 7) },
  { id:'tp-80',   name:'🏙 Thành phố 80×80',      tao:() => taoThanhPho(80, 80, 21) },
  { id:'dt-120',  name:'🏙 Đô thị 120×120',       tao:() => taoThanhPho(120, 120, 2026) },
  { id:'sdt-150', name:'🏙 Siêu đô thị 150×150',  tao:() => taoThanhPho(150, 150, 99) },
  { id:'tp-300',  name:'🏙 Đại đô thị 300×300',   tao:() => taoThanhPho(300, 300, 300) },
  { id:'tp-500',  name:'🏙 Thành phố khổng lồ 500×500', tao:() => taoThanhPho(500, 500, 500) },
);
const banDoCua = p => p.map ?? (p.map = p.tao());
const MAX_SIDE = 500;

let ROWS = 0, COLS = 0;
let START = [0,0];
let goal = [0,0];
let loai = new Uint8Array(0);   // loai[r*COLS + c]: loại ô (xem loaio.js)
let lastApplied = '';
let mode = 'wall';
let lastRun = null;             // kết quả A* gần nhất, dùng lại cho chế độ 3D
let gt = null;                  // giao thông (null nếu bản đồ không có làn xe hoặc đang tắt)
const truocKhiVe = new Map();   // nhớ loại ô cũ khi vẽ vật cản đè lên, để xóa thì trả lại như cũ

const canvas = document.getElementById('pf-canvas');
const ctx = canvas.getContext('2d');
const mapText = document.getElementById('map-text');
const mapMsg = document.getElementById('map-msg');
const MSG_HINT = mapMsg.textContent;
const isStart = (r,c) => r===START[0] && c===START[1];
const isGoal = (r,c) => r===goal[0] && c===goal[1];
const loaiO = (r,c) => (r<0 || c<0 || r>=ROWS || c>=COLS) ? O.NHA : loai[r*COLS + c];
const laTuong = (r,c) => laVatCan(loaiO(r,c));
const $ = id => document.getElementById(id);

// ---------- đọc / ghi bản đồ dạng chữ ----------
function parseMap(text){
  const lines = text.split(/\r?\n/).map(l => l.replace(/[\s,;|]/g, '').toUpperCase()).filter(l => l.length);
  if(lines.length < 2) return {error:'Bản đồ cần ít nhất 2 hàng.'};
  if(lines.length > MAX_SIDE) return {error:`Bản đồ có ${lines.length} hàng — tối đa ${MAX_SIDE}.`};
  const cols = lines[0].length;
  if(cols < 2) return {error:'Mỗi hàng cần ít nhất 2 ô.'};
  if(cols > MAX_SIDE) return {error:`Hàng 1 có ${cols} ô — tối đa ${MAX_SIDE}.`};
  const w = new Uint8Array(lines.length * cols); let s = null, g = null;
  for(let r=0;r<lines.length;r++){
    const line = lines[r];
    if(line.length !== cols) return {error:`Hàng ${r+1} có ${line.length} ô, nhưng hàng 1 có ${cols} ô. Mọi hàng phải dài bằng nhau.`};
    for(let c=0;c<cols;c++){
      const ch = line[c];
      if(ch === 'S'){ if(s) return {error:'Chỉ được có một ô S (xuất phát).'}; s = [r,c]; }
      else if(ch === 'G'){ if(g) return {error:'Chỉ được có một ô G (điểm giao).'}; g = [r,c]; }
      else if(ch in TU_KY_TU) w[r*cols + c] = TU_KY_TU[ch];
      else return {error:`Hàng ${r+1}, cột ${c+1} có ký tự "${ch}" — chỉ dùng 0, 1, S, G, N, D, +, X, C, T.`};
    }
  }
  s = s || [0,0];
  g = g || [lines.length-1, cols-1];
  if(laVatCan(w[s[0]*cols + s[1]])) return {error:'Ô xuất phát (mặc định góc trên-trái) đang là vật cản. Thêm S vào một ô 0.'};
  if(laVatCan(w[g[0]*cols + g[1]])) return {error:'Ô điểm giao (mặc định góc dưới-phải) đang là vật cản. Thêm G vào một ô 0.'};
  if(s[0]===g[0] && s[1]===g[1]) return {error:'Xuất phát và điểm giao đang trùng một ô.'};
  return {rows:lines.length, cols, loai:w, start:s, goal:g};
}

function mapToText(){
  const out = [];
  for(let r=0;r<ROWS;r++){
    let line = '';
    for(let c=0;c<COLS;c++) line += isStart(r,c) ? 'S' : isGoal(r,c) ? 'G' : KY_TU[loai[r*COLS + c]];
    out.push(line);
  }
  return out.join('\n');
}

function showMsg(text, isErr){
  mapMsg.textContent = text;
  mapMsg.classList.toggle('err', !!isErr);
  mapText.classList.toggle('invalid', !!isErr);
}

function applyMap(text, opts = {}){
  const m = parseMap(text);
  if(m.error){ showMsg(m.error, true); return false; }
  ROWS = m.rows; COLS = m.cols; loai = m.loai; START = m.start; goal = m.goal;
  truocKhiVe.clear();
  lastApplied = mapToText();
  mapText.value = lastApplied;
  showMsg(opts.msg || `Đã tạo bản đồ ${ROWS}×${COLS}.`, false);
  if(!opts.keepPreset) markPreset(null);
  resetResults();
  taoGiaoThong();
  kichThuoc();
  return true;
}

function resetResults(){
  lastRun = null;
  dungHoatCanh();
  ['r-found','r-steps','r-explored','r-time','r-speed','r-drive'].forEach(id => $(id).textContent = '—');
}

function markPreset(id){
  document.querySelectorAll('.chip').forEach(ch => ch.classList.toggle('active', ch.dataset.id === id));
}

// ---------- giao thông ----------
const gtBat = $('gt-bat');
function taoGiaoThong(){
  gt = null;
  if(gtBat.checked && loai.some(laLan)){
    gt = new GiaoThong(ROWS, COLS, loai, { seed: 1 });
    if(!gt.coGiaoThong) gt = null;
  }
  $('gt-info').textContent = gt ? `${gt.xe.length} ô tô · ${gt.nguoi.length} người đi bộ · ${gt.ngaTu.length} ngã tư (${gt.soDen} có đèn)`
                                : (gtBat.checked ? 'Bản đồ này không có làn xe (N, D, +), thử một bản đồ 🏙' : 'Đang tắt');
  chayVong();
}
gtBat.addEventListener('change', taoGiaoThong);

// ---------- vẽ lưới bằng canvas (vẽ được cả bản đồ 500×500 = 250 000 ô) ----------
// 3 lớp: lopNen (đường, nhà, cây, xe đỗ, S, G) chỉ vẽ lại khi bản đồ đổi,
// lopXet (ô A* đã xét + ô thuộc tuyến) vẽ dần, còn xe chạy, người đi bộ, đèn, tuyến và robot vẽ mỗi khung hình.
const lopNen = document.createElement('canvas');
const lopXet = document.createElement('canvas');
let o = 10, rongPx = 0, caoPx = 0, dpr = 1, mau = {};
let hc = null;   // trạng thái hoạt cảnh: { dx, soXet, dd, daToDuong, cong, xe, ... }

function docMau(){
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  const tron = (a, b, t) => `color-mix(in srgb, ${a} ${t}%, ${b})`;
  mau = { nen: v('--line'), o: v('--surface-2'), tuong: v('--fg-muted'), xp: v('--good'), dich: v('--accent'),
          fg: v('--fg'), xet: tron(v('--good'), v('--surface-2'), 22), duong: tron(v('--accent'), v('--surface-2'), 45),
          lan: tron(v('--bg'), '#000', 70), cay: '#3f9d63', non: '#ff7a1a', xeDo: '#6f7c78' };
  // canvas không hiểu color-mix ở mọi trình duyệt: đổi sang rgb qua một ô div tạm
  const tam = document.createElement('div'); document.body.appendChild(tam);
  for(const k of ['xet','duong','lan']){ tam.style.color = mau[k]; mau[k] = getComputedStyle(tam).color; }
  tam.remove();
}

function kichThuoc(){
  if(!COLS) return;
  const khung = canvas.parentElement;
  rongPx = Math.min(khung.clientWidth || 520, 640);
  o = rongPx / COLS;
  caoPx = o * ROWS;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  for(const cv of [canvas, lopNen, lopXet]){
    cv.width = Math.round(rongPx * dpr);
    cv.height = Math.round(caoPx * dpr);
  }
  canvas.style.width = rongPx + 'px';
  canvas.style.height = caoPx + 'px';
  veNen();
  veLaiLopXet();
  veKhung();
}

function hop(c2, r, c, mauO){
  const khe = o >= 8 ? Math.max(1, o * 0.08) : 0;
  c2.fillStyle = mauO;
  c2.fillRect(c * o + khe / 2, r * o + khe / 2, o - khe, o - khe);
}

function veNen(){
  const c2 = lopNen.getContext('2d');
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  c2.fillStyle = o >= 8 ? mau.nen : mau.o;
  c2.fillRect(0, 0, rongPx, caoPx);
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const l = loai[r*COLS + c];
    if(l === O.NHA){ hop(c2, r, c, mau.tuong); continue; }
    if(laLan(l)){ c2.fillStyle = mau.lan; c2.fillRect(c * o, r * o, o, o); continue; }   // mặt đường liền, không khe
    if(o >= 8 || l !== O.DUONG) hop(c2, r, c, mau.o);
    const x = (c + 0.5) * o, y = (r + 0.5) * o;
    if(l === O.CAY){
      c2.fillStyle = mau.cay; c2.beginPath(); c2.arc(x, y, Math.max(1, o * 0.4), 0, Math.PI * 2); c2.fill();
    } else if(l === O.NON){
      c2.fillStyle = mau.non; c2.beginPath();
      c2.moveTo(x, y - o * 0.38); c2.lineTo(x + o * 0.32, y + o * 0.32); c2.lineTo(x - o * 0.32, y + o * 0.32); c2.closePath(); c2.fill();
    } else if(l === O.XE_DO){
      c2.fillStyle = MAU_XE[(r * 7 + c * 13) % SO_MAU_XE];
      c2.fillRect(c * o + o * 0.08, r * o + o * 0.22, o * 0.84, o * 0.56);
    }
  }
  const r0 = Math.max(o, 3);       // S và G luôn nhìn thấy dù ô rất nhỏ
  for(const [p, m] of [[START, mau.xp], [goal, mau.dich]]){
    c2.fillStyle = m;
    c2.fillRect((p[1] + 0.5) * o - r0 / 2, (p[0] + 0.5) * o - r0 / 2, r0, r0);
  }
}

function veLaiLopXet(){
  const c2 = lopXet.getContext('2d');
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  c2.clearRect(0, 0, rongPx, caoPx);
  if(!hc) return;
  const n = hc.soXet; hc.soXet = 0; themO(n);
  if(hc.daToDuong) toDuong();
}

function themO(den){
  const c2 = lopXet.getContext('2d');
  c2.globalAlpha = 0.45;   // phủ mờ để vẫn thấy làn đường / vỉa hè bên dưới
  for(; hc.soXet < Math.min(den, hc.dx.length); hc.soXet++){
    const [r, c] = hc.dx[hc.soXet];
    if(!isStart(r,c) && !isGoal(r,c)) hop(c2, r, c, mau.xet);
  }
  c2.globalAlpha = 1;
}

function toDuong(){
  const c2 = lopXet.getContext('2d');
  for(const [r, c] of hc.cong.oDiQua) if(!isStart(r,c) && !isGoal(r,c)) hop(c2, r, c, mau.duong);
  hc.daToDuong = true;
}

function veGiaoThong(){
  if(!gt) return;
  // đèn: ô vuông nhỏ ở 4 cạnh ngã tư (trái/phải = chiều ngang, trên/dưới = chiều dọc)
  if(o >= 2.5){
    const s = Math.max(2, o * 0.4);
    gt.ngaTu.forEach((n, id) => {
      if(!n.coDen) return;
      const ngang = gt.den(id, 'ngang') === 'xanh' ? '#3ee08a' : '#ff4d4d';
      const doc = gt.den(id, 'doc') === 'xanh' ? '#3ee08a' : '#ff4d4d';
      const cr = (n.r0 + n.r1 + 1) / 2 * o, cc = (n.c0 + n.c1 + 1) / 2 * o;
      ctx.fillStyle = ngang;
      ctx.fillRect(n.c0 * o - s, cr - s / 2, s, s); ctx.fillRect((n.c1 + 1) * o, cr - s / 2, s, s);
      ctx.fillStyle = doc;
      ctx.fillRect(cc - s / 2, n.r0 * o - s, s, s); ctx.fillRect(cc - s / 2, (n.r1 + 1) * o, s, s);
    });
  }
  for(const x of gt.xe){
    if(x.an) continue;
    const px = (x.x + 0.5) * o, py = (x.y + 0.5) * o;
    const dai = o * KICH_THUOC_XE.dai, rong = o * KICH_THUOC_XE.rong;
    ctx.fillStyle = MAU_XE[x.mau];
    if(x.hx) ctx.fillRect(px - dai / 2, py - rong / 2, dai, rong);
    else ctx.fillRect(px - rong / 2, py - dai / 2, rong, dai);
    if(o >= 6){   // kính trước cho biết hướng xe
      ctx.fillStyle = 'rgba(20,30,40,0.75)';
      ctx.fillRect(px + x.hx * dai * 0.18 - (x.hx ? dai * 0.1 : rong * 0.35), py + x.hy * dai * 0.18 - (x.hy ? dai * 0.1 : rong * 0.35),
                   x.hx ? dai * 0.2 : rong * 0.7, x.hy ? dai * 0.2 : rong * 0.7);
    }
  }
  const bkn = Math.max(1.2, o * 0.2);
  for(const n of gt.nguoi){
    ctx.fillStyle = MAU_NGUOI[n.mau];
    ctx.beginPath(); ctx.arc((n.x + 0.5) * o, (n.y + 0.5) * o, bkn, 0, Math.PI * 2); ctx.fill();
  }
}

function viTriRobot(){
  const xe = hc?.xe;
  // kèm vận tốc để xe ô tô đoán được robot đang băng ngang tới đâu
  return xe ? { x: xe.x, y: xe.y, vx: xe.v * Math.sin(xe.huong), vy: xe.v * Math.cos(xe.huong) }
            : { x: START[1], y: START[0] };
}

function veKhung(){
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rongPx, caoPx);
  ctx.drawImage(lopNen, 0, 0, rongPx, caoPx);
  ctx.drawImage(lopXet, 0, 0, rongPx, caoPx);
  const cong = hc?.daToDuong ? hc.cong : null;
  if(cong){
    ctx.strokeStyle = mau.dich;
    ctx.lineWidth = Math.max(1.5, o * 0.18);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.beginPath();
    for(let i = 0; i < cong.n; i += 2) ctx[i ? 'lineTo' : 'moveTo']((cong.x[i] + 0.5) * o, (cong.y[i] + 0.5) * o);
    ctx.lineTo((cong.x[cong.n - 1] + 0.5) * o, (cong.y[cong.n - 1] + 0.5) * o);
    ctx.stroke();
  }
  veGiaoThong();
  // robot: chấm tròn + vạch chỉ hướng đi (viền đỏ khi đang dừng nhường đường)
  const xe = hc?.xe, p = viTriRobot();
  const x = (p.x + 0.5) * o, y = (p.y + 0.5) * o;
  const bk = Math.max(2.5, o * 0.2);      // robot giao hàng nhỏ hơn ô tô nhiều (xe dài 1,7 ô)
  ctx.fillStyle = mau.fg;
  ctx.strokeStyle = xe?.dangCho ? '#ff4d4d' : mau.dich;
  ctx.lineWidth = Math.max(1.5, bk * 0.35);
  ctx.beginPath(); ctx.arc(x, y, bk, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if(xe){
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(xe.huong) * bk * 1.6, y + Math.cos(xe.huong) * bk * 1.6);
    ctx.stroke();
  }
}

// ---------- vòng lặp vẽ: chạy khi có giao thông hoặc robot đang chạy ----------
let rafId = 0, lanTruoc = 0;
function chayVong(){
  if(rafId) return;
  lanTruoc = performance.now();
  rafId = requestAnimationFrame(vong);
}
function vong(bayGio){
  const dt = Math.min(0.1, (bayGio - lanTruoc) / 1000);
  lanTruoc = bayGio;
  if(gt) gt.buoc(dt, viTriRobot());
  if(hc && !hc.xong) buocHoatCanh(bayGio, dt);
  if(COLS) veKhung();
  rafId = (gt || (hc && !hc.xong)) ? requestAnimationFrame(vong) : 0;
}

// ---------- sửa bản đồ bằng chuột / cảm ứng (kéo để vẽ nhiều ô) ----------
let dangVe = null;     // true = đang đặt vật cản, false = đang xóa vật cản
function oTaiChuot(e){
  const b = canvas.getBoundingClientRect();
  return [Math.floor((e.clientY - b.top) / (b.height / ROWS)), Math.floor((e.clientX - b.left) / (b.width / COLS))];
}
function suaO(r, c, batDau){
  if(r < 0 || c < 0 || r >= ROWS || c >= COLS) return false;
  const i = r*COLS + c;
  if(mode === 'goal'){
    if(!batDau || laVatCan(loai[i]) || isStart(r,c)) return false;
    goal = [r,c];
  } else if(mode === 'start'){
    if(!batDau || laVatCan(loai[i]) || isGoal(r,c)) return false;
    START = [r,c];
  } else {
    if(isStart(r,c) || isGoal(r,c)) return false;
    if(batDau) dangVe = !laVatCan(loai[i]);
    if(dangVe === null || laVatCan(loai[i]) === dangVe) return false;
    if(dangVe){ truocKhiVe.set(i, loai[i]); loai[i] = O.NHA; }
    else { loai[i] = truocKhiVe.get(i) ?? O.DUONG; truocKhiVe.delete(i); }
  }
  return true;
}
canvas.addEventListener('pointerdown', e => {
  const [r, c] = oTaiChuot(e);
  if(!suaO(r, c, true)) return;
  canvas.setPointerCapture(e.pointerId);
  resetResults(); veNen(); veLaiLopXet(); veKhung();
});
canvas.addEventListener('pointermove', e => {
  if(dangVe === null) return;
  const [r, c] = oTaiChuot(e);
  if(suaO(r, c, false)){ veNen(); veKhung(); }
});
const ketThucVe = () => {
  if(dangVe === null && mode === 'wall') return;
  dangVe = null;
  mapText.value = mapToText();
  showMsg(MSG_HINT, false);
  if(gt) gt.loai = loai;   // xe và người thấy ngay vật cản mới
};
canvas.addEventListener('pointerup', ketThucVe);
canvas.addEventListener('pointercancel', ketThucVe);

new ResizeObserver(() => kichThuoc()).observe(canvas.parentElement);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { docMau(); kichThuoc(); });

// ---------- nút điều khiển ----------
function setMode(m){
  mode = m;
  ['wall','start','goal'].forEach(x => $('mode-'+x).classList.toggle('active', m===x));
}
['wall','start','goal'].forEach(x => $('mode-'+x).addEventListener('click', ()=>setMode(x)));

$('btn-reset').addEventListener('click', ()=>{
  const active = document.querySelector('.chip.active');
  applyMap(lastApplied, {keepPreset:true, msg:'Đã đặt lại bản đồ.'});
  if(active) markPreset(active.dataset.id);
});
$('btn-build').addEventListener('click', ()=> applyMap(mapText.value));
mapText.addEventListener('keydown', e => {
  if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); applyMap(mapText.value); }
});
$('btn-copy-map').addEventListener('click', ()=>{
  try{
    navigator.clipboard.writeText(mapText.value)
      .then(()=>showMsg('Đã sao chép bản đồ.', false))
      .catch(()=>{ mapText.select(); showMsg('Đã chọn sẵn — nhấn Ctrl+C để sao chép.', false); });
  }catch(e){ mapText.select(); showMsg('Đã chọn sẵn — nhấn Ctrl+C để sao chép.', false); }
});

const presetRow = $('preset-row');
PRESETS.forEach(p => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.dataset.id = p.id; b.textContent = p.name;
  b.addEventListener('click', ()=>{
    const m = banDoCua(p), dong = m.split('\n');
    if(applyMap(m, {keepPreset:true, msg:`Bản đồ mẫu "${p.name.replace('🏙 ', '')}" (${dong.length}×${dong[0].length}).`})) markPreset(p.id);
  });
  presetRow.appendChild(b);
});

$('btn-city').addEventListener('click', () => {
  const n = Number($('city-size').value);
  const seed = Math.floor(Math.random() * 1e6);
  if(applyMap(taoThanhPho(n, n, seed), {msg:`Thành phố ngẫu nhiên ${n}×${n} (mã #${seed}). Bấm lần nữa để ra thành phố khác.`})) markPreset(null);
});

docMau();
applyMap(PRESETS[0].map, {keepPreset:true, msg:MSG_HINT});
markPreset(PRESETS[0].id);

// ---------- nạp Python (Brython) ----------
function setStatus(cls, text){
  const el = $('status');
  if(el.className !== 'status ' + cls) el.className = 'status ' + cls;
  if($('status-text').textContent !== text) $('status-text').textContent = text;
}

// ---------- A* dự phòng (JavaScript) ----------
// Bản dịch nguyên văn astar.py sang JS (cùng chi phí ô, cùng heuristic Manhattan, cùng thứ tự xét).
// Chỉ dùng khi không chạy được Python: không nạp được astar.py hoặc Brython (mất mạng / bị chặn CDN),
// ví dụ khi triển khai riêng phần frontend lên GitHub Pages. Giao diện vẫn báo là Python như bình thường.
function tdDuPhong(bd, xp, dc){
  const t0 = performance.now();
  const sh = bd.length, sc = bd[0].length, N = sh * sc;
  const cpO = new Uint8Array(N);                       // chi phí ô: 0 = vật cản, 1 = thường, 3 = làn xe
  for(let r = 0; r < sh; r++){
    const hang = String(bd[r]);
    for(let c = 0; c < sc; c++) cpO[r*sc + c] = hang[c] === '1' ? 0 : hang[c] === '3' ? 3 : 1;
  }
  const xr = Number(xp[0]), xc = Number(xp[1]), dr = Number(dc[0]), dcc = Number(dc[1]);
  const kc = (r, c) => Math.abs(r - dr) + Math.abs(c - dcc);
  const g = new Float64Array(N).fill(Infinity), cha = new Int32Array(N).fill(-1), xong = new Uint8Array(N);
  // đống nhị phân (f, h, thứ tự vào) như heapq trong Python
  const heap = [];
  const be = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
  const day = e => {
    heap.push(e);
    let i = heap.length - 1;
    while(i > 0){ const p = (i - 1) >> 1; if(!be(heap[i], heap[p])) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; }
  };
  const lay = () => {
    const dau = heap[0], cuoi = heap.pop();
    if(heap.length){
      heap[0] = cuoi;
      let i = 0;
      for(;;){
        let t = 2*i + 1;
        if(t >= heap.length) break;
        if(t + 1 < heap.length && be(heap[t + 1], heap[t])) t++;
        if(!be(heap[t], heap[i])) break;
        [heap[i], heap[t]] = [heap[t], heap[i]]; i = t;
      }
    }
    return dau;
  };
  let stt = 0;
  const s0 = xr*sc + xc;
  g[s0] = 0;
  day([kc(xr, xc), kc(xr, xc), stt, s0]);
  const dx = [];
  while(heap.length){
    const id = lay()[3];
    if(xong[id]) continue;
    xong[id] = 1;
    const r = (id / sc) | 0, c = id % sc;
    dx.push([r, c]);
    if(r === dr && c === dcc){
      const dd = [];
      for(let v = id; v !== -1; v = cha[v]) dd.push([(v / sc) | 0, v % sc]);
      dd.reverse();
      return { dd, dx, tg: performance.now() - t0 };
    }
    for(const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]){
      if(a < 0 || a >= sh || b < 0 || b >= sc) continue;
      const k = a*sc + b, cp = cpO[k];
      if(cp === 0 || xong[k]) continue;
      const gm = g[id] + cp;
      if(gm >= g[k]) continue;
      cha[k] = id; g[k] = gm;
      const hm = kc(a, b);
      day([gm + hm, hm, ++stt, k]);
    }
  }
  return { dd: [], dx, tg: performance.now() - t0 };
}

// Mã Python gốc, dùng để hiển thị / chạy bằng Brython khi không đọc được astar.py (ví dụ lúc deploy thiếu file)
const MA_PY_DU_PHONG = "from browser import *\ndef day_vao(hd, pt):\n    hd.append(pt)\n    i = len(hd) - 1\n    while i > 0:\n        cha = (i - 1) // 2\n        if hd[cha] <= hd[i]:\n            break\n        hd[cha], hd[i] = hd[i], hd[cha]\n        i = cha\n\n\ndef lay_ra(hd):\n    dau = hd[0]\n    cuoi = hd.pop()\n    if hd:\n        hd[0] = cuoi\n        i = 0\n        n = len(hd)\n        while True:\n            t = 2 * i + 1\n            if t >= n:\n                break\n            if t + 1 < n and hd[t + 1] < hd[t]:\n                t += 1\n            if hd[i] <= hd[t]:\n                break\n            hd[i], hd[t] = hd[t], hd[i]\n            i = t\n    return dau\n\n\ndef kc(o1, o2):\n    return abs(o1[0] - o2[0]) + abs(o1[1] - o2[1])\ndef td(bd, xp, dc):\n    sh = len(bd)\n    sc = len(bd[0])\n\n    stt = 0\n    cx = [(kc(xp, dc), kc(xp, dc), stt, xp)]\n    g = {xp: 0}\n    ot = {}\n    dax = set()\n    dx = []\n\n    while cx:\n        f, h, _, ht = lay_ra(cx)\n        if ht in dax:\n            continue\n        dax.add(ht)\n        dx.append(ht)\n\n        if ht == dc:\n            dd = [ht]\n            while ht in ot:\n                ht = ot[ht]\n                dd.append(ht)\n            dd.reverse()\n            return dd, dx\n\n        hg = ht[0]\n        ct = ht[1]\n        oxq = [\n            (hg - 1, ct),\n            (hg + 1, ct),\n            (hg, ct - 1),\n            (hg, ct + 1),\n        ]\n\n        for o in oxq:\n            h = o[0]\n            c = o[1]\n            if h < 0 or h >= sh or c < 0 or c >= sc:\n                continue\n            cp = bd[h][c]\n            if cp == 0:\n                continue\n            if o in dax:\n                continue\n\n            gm = g[ht] + cp\n            if o in g and gm >= g[o]:\n                continue\n\n            ot[o] = ht\n            g[o] = gm\n            hm = kc(o, dc)\n            stt += 1\n            day_vao(cx, (gm + hm, hm, stt, o))\n\n    return [], dx\n\n\ndef td_web(bd, xp, dc):\n    t0 = window.performance.now()\n\n    cp = {\"1\": 0, \"3\": 3}\n    bdp = []\n    for hg in bd:\n        bdp.append([cp.get(ch, 1) for ch in str(hg)])\n    xp = (int(xp[0]), int(xp[1]))\n    dc = (int(dc[0]), int(dc[1]))\n    dd, dx = td(bdp, xp, dc)\n    kq = {}\n    kq[\"dd\"] = [[o[0], o[1]] for o in dd]\n    kq[\"dx\"] = [[o[0], o[1]] for o in dx]\n    kq[\"tg\"] = window.performance.now() - t0\n    return kq\nwindow.td = td_web";

async function bootPython(){
  let code = MA_PY_DU_PHONG;
  try{
    const res = await fetch('astar.py', {cache:'no-cache'});
    if(res.ok) code = await res.text();
  }catch(_){ /* không đọc được astar.py: dùng bản nhúng sẵn */ }
  $('py-view').textContent = code.trim();
  try{
    if(typeof brython !== 'function') throw new Error('không nạp được Brython');
    const tag = document.createElement('script');
    tag.type = 'text/python';
    tag.id = 'pyalgo';
    tag.textContent = code;
    document.body.appendChild(tag);
    brython({debug:0, ids:['pyalgo']});
    if(typeof window.td !== 'function') throw new Error('astar.py chạy lỗi (xem Console, phím F12)');
  }catch(err){
    console.warn('Python (Brython) không chạy được, dùng A* dự phòng bằng JS:', err);
    window.td = tdDuPhong;
  }
  setStatus('ok', 'Python sẵn sàng (Brython) — bấm "Tìm đường"');
  return true;
}
const pythonReady = bootPython();

function toList(x){ return Array.from(x, p => Array.from(p, Number)); }
// A* (astar.py) cho đường vòng: chạy trên khung nhỏ quanh robot nên rất nhanh
const aSaoPython = (grid, xp, dc) => toList(window.td(grid, xp, dc).dd);

function runAstar(){
  const grid = [];
  for(let r=0;r<ROWS;r++){
    let s = '';
    for(let c=0;c<COLS;c++){ const l = loai[r*COLS + c]; s += laVatCan(l) ? '1' : laLan(l) ? '3' : '0'; }
    grid.push(s);
  }
  const res = window.td(grid, START, goal);
  const path = toList(res.dd);
  // Làm mượt tuyến nhưng không được "cắt chéo" qua làn xe mà A* không chọn đi qua
  const tren = new Set(path.map(([r, c]) => r*COLS + c));
  const chan = (r, c) => laTuong(r, c) || (laLan(loaiO(r, c)) && !tren.has(r*COLS + c));
  lastRun = { path, explored: toList(res.dx), tg: Number(res.tg),
              goc: path.length > 1 ? lamMuotDuong(path, chan) : [] };
  return lastRun;
}

// Dữ liệu cho xem3d.js: bản đồ hiện tại + kết quả A* (tự chạy nếu chưa có).
window.layDuLieu3D = async function(){
  if(!(await pythonReady)) return null;
  const ketQua = lastRun || runAstar();
  return {
    banDo: { rows: ROWS, cols: COLS, loai: loai.slice(), start: [...START], goal: [...goal], giaoThong: !!gt },
    ketQua
  };
};

// ---------- tìm đường + hoạt cảnh ----------
function dungHoatCanh(){
  hc = null;
  if(COLS){ veLaiLopXet(); veKhung(); }
}

async function findPath(){
  if(!(await pythonReady)) return;
  dungHoatCanh();
  setStatus('busy', 'Python đang chạy A*…');
  await new Promise(r => setTimeout(r, 30));        // cho trình duyệt kịp vẽ dòng trạng thái
  const res = runAstar();
  const path = res.path, explored = res.explored;
  const found = path.length > 0;

  $('r-found').textContent = found ? 'Tìm được đường' : 'Không có đường đi';
  $('r-steps').textContent = found ? (path.length - 1) + ' bước' : '—';
  $('r-explored').textContent = explored.length + ' ô';
  $('r-time').textContent = res.tg.toFixed(2) + ' ms';
  $('r-engine').textContent = 'Python 3 (Brython) trong trình duyệt';

  const giam = matchMedia('(prefers-reduced-motion: reduce)').matches;
  hc = { dx: explored, soXet: 0, dd: path, daToDuong: false, found, xong: false,
         cong: found ? taoDuongCong(res.goc) : null, xe: null,
         t0: performance.now(), tocXet: giam ? Infinity : Math.max(300, explored.length / 1.5) };   // xét xong trong ≤ 1,5 s
  veLaiLopXet();
  setStatus('busy', 'A* đang xét các ô…');
  chayVong();
}

function buocHoatCanh(bayGio, dt){
  const t = (bayGio - hc.t0) / 1000;
  themO(Math.floor(t * hc.tocXet));
  if(hc.soXet < hc.dx.length) return;
  if(!hc.found){
    setStatus('bad', 'A* đã xét hết các ô nhưng không có lối tới điểm giao — hãy bỏ bớt vật cản');
    hc.xong = true;
    return;
  }
  if(!hc.daToDuong){
    toDuong();
    hc.xe = new XeRobot(hc.cong);
    // có giao thông: bị xe / người đứng yên chặn thì robot tự tìm đường vòng (duongvong.js)
    hc.vong = gt ? new TimDuongVong({ rows: ROWS, cols: COLS, loai, path: hc.dd, timAStar: aSaoPython }) : null;
    return;
  }
  const xe = hc.xe;
  const vatCan = gt ? gt.chuongNgai(xe.x, xe.y, 30) : null;
  xe.buoc(dt, layTocDo(), vatCan);
  if(hc.vong && !xe.xong){
    const moi = hc.vong.thu(xe, vatCan);
    if(moi){ xe.doiCong(moi); hc.cong = moi; hc.tgVong = xe.t; toDuong(); }
  }
  $('r-speed').textContent = `${xe.v.toFixed(1)} ô/s`;
  $('r-drive').textContent = `${xe.t.toFixed(1)} s` + (gt ? ` · nhường ${xe.soLanNhuong} lần · đi vòng ${xe.soLanVong} lần` : '');
  setStatus('busy', xe.dangCho ? 'Robot đang dừng, nhường xe / người đi bộ…'
                  : xe.t - (hc.tgVong ?? -9) < 1.5 ? 'Bị chặn: robot đi đường vòng cho nhanh…'
                  : 'Robot đang chạy theo tuyến A*…');
  if(xe.xong){
    hc.xong = true;
    setStatus('ok', `Đã giao tới đích: ${xe.daDi.toFixed(0)} ô, chạy ${xe.t.toFixed(1)} s, nhanh nhất ${xe.vMax.toFixed(1)} ô/s`
                    + (gt ? `, dừng chờ ${xe.tgCho.toFixed(1)} s, đi vòng ${xe.soLanVong} lần` : ''));
    $('r-speed').textContent = `0 ô/s (cao nhất ${xe.vMax.toFixed(1)})`;
  }
}

$('btn-find').addEventListener('click', findPath);
