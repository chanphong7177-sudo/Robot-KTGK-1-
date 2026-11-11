// Sinh bản đồ kiểu thành phố:
//   đại lộ = vỉa hè + 2 hoặc 4 làn xe + vỉa hè, giao nhau thành ngã tư (+),
//   trong khu phố có hẻm (cả hẻm cụt), công viên có cây, quảng trường có đài phun nước,
//   bãi đỗ ô tô (X), nón giao thông (C) rải trên vỉa hè, cây (T).
// Cùng seed thì luôn ra cùng một thành phố, nên bản đồ mẫu không đổi giữa các lần mở trang.
import { O, KY_TU } from './loaio.js';

export function taoRng(seed){
  // mulberry32: bộ sinh số ngẫu nhiên nhỏ, đủ đều cho việc vẽ bản đồ
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chiaDuong(chieuDai, rng){
  // Trả về danh sách đại lộ theo một chiều: [bắt đầu, số làn]. Đại lộ rộng = 1 vỉa hè + làn + 1 vỉa hè.
  const ds = [];
  let p = Math.floor(rng() * 3);
  let thu = 0;
  while(p + 4 <= chieuDai){
    const soLan = (thu % 3 === 1) ? 4 : 2;         // cứ 3 đường có 1 đại lộ 4 làn
    if(p + soLan + 2 > chieuDai) break;
    ds.push([p, soLan]);
    p += soLan + 2 + 7 + Math.floor(rng() * 6);    // khu phố dày 7–12 ô
    thu++;
  }
  return ds;
}

export function taoThanhPho(rows, cols, seed = Date.now()){
  const rng = taoRng(seed);
  const o = new Uint8Array(rows * cols).fill(O.NHA);
  const trong = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;
  const lay = (r, c) => trong(r, c) ? o[r * cols + c] : O.NHA;
  const dat = (r, c, v) => { if(trong(r, c)) o[r * cols + c] = v; };
  const moHcn = (r0, c0, r1, c1, v = O.DUONG) => { for(let r = r0; r < r1; r++) for(let c = c0; c < c1; c++) dat(r, c, v); };

  // 1) đại lộ: vỉa hè (0) hai bên, làn xe ở giữa; chỗ làn ngang gặp làn dọc là ngã tư
  const hang = chiaDuong(rows, rng), cot = chiaDuong(cols, rng);
  const lanNgang = new Set(), lanDoc = new Set(), heNgang = new Set(), heDoc = new Set();
  for(const [p, n] of hang){ heNgang.add(p); heNgang.add(p + n + 1); for(let i = 1; i <= n; i++) lanNgang.add(p + i); }
  for(const [p, n] of cot){ heDoc.add(p); heDoc.add(p + n + 1); for(let i = 1; i <= n; i++) lanDoc.add(p + i); }
  for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
    const ngang = lanNgang.has(r), doc = lanDoc.has(c);
    if(ngang && doc) dat(r, c, O.NGA_TU);
    else if(ngang) dat(r, c, O.LAN_NGANG);           // vạch qua đường cũng là làn xe
    else if(doc) dat(r, c, O.LAN_DOC);
    else if(heNgang.has(r) || heDoc.has(c)) dat(r, c, O.DUONG);
  }

  // 2) các khu phố nằm giữa các đại lộ
  const bien = (ds, dai) => {
    const k = []; let dau = 0;
    for(const [p, n] of ds){ if(p > dau) k.push([dau, p]); dau = p + n + 2; }
    if(dau < dai) k.push([dau, dai]);
    return k;
  };
  for(const [r0, r1] of bien(hang, rows)) for(const [c0, c1] of bien(cot, cols)){
    const cao = r1 - r0, rong = c1 - c0;
    if(cao < 3 || rong < 3) continue;
    const x = rng();
    if(x < 0.10){
      // công viên: mở hết, trồng cây rải rác (không cho 2 cây sát nhau để không chặn lối)
      moHcn(r0, c0, r1, c1);
      for(let r = r0 + 1; r < r1 - 1; r++) for(let c = c0 + 1; c < c1 - 1; c++){
        let ke = 0;
        for(let dr = -1; dr <= 1; dr++) for(let dc = -1; dc <= 1; dc++) if(lay(r + dr, c + dc) === O.CAY) ke++;
        if(ke === 0 && rng() < 0.22) dat(r, c, O.CAY);
      }
    } else if(x < 0.16){
      // quảng trường + đài phun nước 2×2 ở giữa
      moHcn(r0, c0, r1, c1);
      const rm = r0 + Math.floor(cao / 2) - 1, cm = c0 + Math.floor(rong / 2) - 1;
      moHcn(rm, cm, rm + 2, cm + 2, O.NHA);
    } else if(x < 0.24 && cao >= 5 && rong >= 5){
      // bãi đỗ xe: hàng xe đỗ xen lối đi, chừa viền để ra vào
      moHcn(r0, c0, r1, c1);
      for(let r = r0 + 1; r < r1 - 1; r++){
        if((r - r0) % 3 === 0) continue;               // lối đi giữa các hàng xe
        for(let c = c0 + 1; c < c1 - 1; c++) if(rng() < 0.7) dat(r, c, O.XE_DO);
      }
    } else {
      // khu nhà: cắt hẻm ngang/dọc, có lúc là hẻm cụt
      if(cao >= 7 && rng() < 0.75){
        const r = r0 + 2 + Math.floor(rng() * (cao - 4));
        const dai = rng() < 0.35 ? Math.max(2, Math.floor(rong * (0.4 + rng() * 0.3))) : rong;
        if(rng() < 0.5) moHcn(r, c0, r + 1, c0 + dai); else moHcn(r, c1 - dai, r + 1, c1);
      }
      if(rong >= 7 && rng() < 0.75){
        const c = c0 + 2 + Math.floor(rng() * (rong - 4));
        const dai = rng() < 0.35 ? Math.max(2, Math.floor(cao * (0.4 + rng() * 0.3))) : cao;
        if(rng() < 0.5) moHcn(r0, c, r0 + dai, c + 1); else moHcn(r1 - dai, c, r1, c + 1);
      }
      if(rng() < 0.3){
        const r = r0 + 1 + Math.floor(rng() * Math.max(1, cao - 3));
        moHcn(r, c0, r + 2, c0 + 2);                    // sân trong nhỏ
      }
    }
  }

  // 3) nón giao thông / cây trên vỉa hè (chặn vỉa hè: robot phải vòng hoặc xuống lòng đường)
  for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
    if(lay(r, c) !== O.DUONG || !(heNgang.has(r) || heDoc.has(c))) continue;
    if(heNgang.has(r) && heDoc.has(c)) continue;      // không đặt ở góc phố
    const x = rng();
    if(x < 0.012) dat(r, c, O.NON);
    else if(x < 0.03) dat(r, c, O.CAY);
  }

  // 4) S ở gần góc trên-trái, G ở gần góc dưới-phải: ô vỉa hè / hẻm gần nhất mà
  //    nối được với mạng đường chính (không chọn sân trong bị nhà bao kín).
  const noiDuoc = new Uint8Array(rows * cols);
  const hangDoi = [];
  const goc = o.findIndex(v => v === O.LAN_NGANG || v === O.LAN_DOC || v === O.NGA_TU);
  if(goc >= 0){ noiDuoc[goc] = 1; hangDoi.push(goc); }
  for(let k = 0; k < hangDoi.length; k++){
    const j = hangDoi[k], r = (j / cols) | 0, c = j % cols;
    for(const [a, b] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]){
      if(!trong(a, b)) continue;
      const v = a * cols + b, l = o[v];
      if(noiDuoc[v] || l === O.NHA || l >= O.XE_DO) continue;
      noiDuoc[v] = 1; hangDoi.push(v);
    }
  }
  const ganNhat = (r0, c0) => {
    for(let d = 0; d < rows + cols; d++)
      for(let dr = 0; dr <= d; dr++){
        const r = r0 + (r0 === 0 ? dr : -dr), c = c0 + (c0 === 0 ? d - dr : -(d - dr));
        if(lay(r, c) === O.DUONG && noiDuoc[r * cols + c]) return [r, c];
      }
    return [r0, c0];
  };
  const S = ganNhat(0, 0), G = ganNhat(rows - 1, cols - 1);

  const dong = [];
  for(let r = 0; r < rows; r++){
    let s = '';
    for(let c = 0; c < cols; c++) s += (r === S[0] && c === S[1]) ? 'S' : (r === G[0] && c === G[1]) ? 'G' : KY_TU[o[r * cols + c]];
    dong.push(s);
  }
  return dong.join('\n');
}
