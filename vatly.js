// Vật lý chuyển động của robot (dùng chung cho 2D và 3D).
//
// 1) lamMuotDuong: A* trên lưới cho đường "bậc thang". Ta kéo thẳng đường (string pulling):
//    từ một điểm, nhảy tới điểm xa nhất còn nhìn thấy mà không quệt vào nhà (tính cả bán kính robot).
// 2) taoDuongCong: bo tròn mỗi góc bằng một cung tròn, lấy mẫu dày (ds) kèm độ cong k.
//    Tốc độ an toàn khi vào cua: v = sqrt(gia_tốc_ngang_tối_đa / k).
//    Duyệt ngược từ đích (v = 0) để biết phải phanh từ đâu: v[i] = min(v_cua, sqrt(v[i+1]^2 + 2·phanh·ds)).
// 3) XeRobot.buoc(dt, vmax, vatCan): mỗi khung hình tăng tốc (tối đa a_tang) hoặc phanh (tối đa a_phanh)
//    về phía tốc độ mục tiêu = min(vmax, giới hạn phanh/cua, giới hạn vì vật cản động).
//    Vật cản động (ô tô, người đi bộ): đoán vị trí của chúng trong 1,2 s tới; nếu chạm vào đoạn
//    tuyến phía trước cách d thì robot chỉ được chạy v ≤ sqrt(2·a_phanh·(d − 0,7)) → dừng chờ trước.
//    Đổi vmax giữa chừng vẫn đúng vật lý.
// Đơn vị: 1 ô lưới = 1 đơn vị độ dài, thời gian tính bằng giây.

export const VAT_LY = {
  tangToc: 40,        // ô/s²  gia tốc tối đa khi tăng tốc
  phanh: 55,          // ô/s²  gia tốc tối đa khi phanh
  gtNgang: 45,        // ô/s²  gia tốc ngang tối đa khi vào cua (v²/r)
  banKinh: 0.22,      // ô     nửa bề ngang robot (robot giao hàng nhỏ ~0,35 ô), để không quệt tường
  catGoc: 0.55,       // ô     đoạn cắt tối thiểu vào mỗi góc khi bo cua (luôn đi được)
  catGocMax: 3.2,     // ô     đoạn cắt tối đa: chỗ rộng thì bo cung lớn hơn để vào cua nhanh hơn (xem lamMuotDuong)
  ds: 0.05,           // ô     bước lấy mẫu đường cong
};

// ---------- 1) kéo thẳng đường ----------
function nhinThay(a, b, laTuong){
  const dx = b.x - a.x, dy = b.y - a.y;
  const dai = Math.hypot(dx, dy);
  if(dai < 1e-9) return true;
  const nx = -dy / dai * VAT_LY.banKinh, ny = dx / dai * VAT_LY.banKinh;
  const buoc = Math.ceil(dai / 0.1);
  for(let i = 0; i <= buoc; i++){
    const t = i / buoc, x = a.x + dx * t, y = a.y + dy * t;
    for(const k of [0, 1, -1]){
      if(laTuong(Math.round(y + ny * k), Math.round(x + nx * k))) return false;
    }
  }
  return true;
}

// Cung bo góc tại P (đi từ A0 tới P rồi tới B0) với đoạn cắt L: trả về các điểm trên cung hoặc null nếu L quá lớn
function hinhCung(A0, P, B0, L){
  let ix = P.x - A0.x, iy = P.y - A0.y; const li = Math.hypot(ix, iy); ix /= li; iy /= li;
  let ox = B0.x - P.x, oy = B0.y - P.y; const lo = Math.hypot(ox, oy); ox /= lo; oy /= lo;
  const theta = Math.acos(Math.max(-1, Math.min(1, ix * ox + iy * oy)));
  if(theta < 1e-3) return null;
  const r = L / Math.tan(theta / 2);
  const Ax = P.x - ix * L, Ay = P.y - iy * L;
  const dau = Math.sign(ix * oy - iy * ox);
  const Cx = Ax - iy * r * dau, Cy = Ay + ix * r * dau;
  const a0 = Math.atan2(Ay - Cy, Ax - Cx), n = Math.max(2, Math.ceil(r * theta / 0.1));
  const kq = [];
  for(let j = 0; j <= n; j++){ const a = a0 + dau * theta * j / n; kq.push([Cx + Math.cos(a) * r, Cy + Math.sin(a) * r]); }
  return kq;
}

// Mỗi góc được gắn p.L = đoạn cắt lớn nhất mà cung bo góc (tính cả bề ngang robot) vẫn không quệt tường:
// đường rộng → cung lớn → bán kính cua lớn → vào cua nhanh; hẻm hẹp → cung nhỏ như cũ.
function gocCoTheCat(a, p, b, laTuong){
  const li = Math.hypot(p.x - a.x, p.y - a.y), lo = Math.hypot(b.x - p.x, b.y - p.y);
  const lMax = Math.min(VAT_LY.catGocMax, li / 2, lo / 2);
  const rb = VAT_LY.banKinh;
  for(let L = lMax; L > VAT_LY.catGoc; L -= 0.25){
    const cung = hinhCung(a, p, b, L);
    if(!cung) return VAT_LY.catGoc;
    if(cung.every(([x, y]) => [[0, 0], [rb, 0], [-rb, 0], [0, rb], [0, -rb]].every(([dx, dy]) => !laTuong(Math.round(y + dy), Math.round(x + dx))))) return L;
  }
  return VAT_LY.catGoc;
}

export function lamMuotDuong(path, laTuong){
  const p = path.map(([r, c]) => ({ x: c, y: r }));
  if(p.length < 3) return p;
  const kq = [p[0]];
  let i = 0;
  while(i < p.length - 1){
    let j = i + 1;
    while(j + 1 < p.length && nhinThay(p[i], p[j + 1], laTuong)) j++;
    kq.push(p[j]);
    i = j;
  }
  for(let k = 1; k < kq.length - 1; k++) kq[k].L = gocCoTheCat(kq[k - 1], kq[k], kq[k + 1], laTuong);
  return kq;
}

// ---------- 2) đường cong + giới hạn tốc độ ----------
export function taoDuongCong(goc){
  const { ds, catGoc, gtNgang, phanh } = VAT_LY;
  const x = [], y = [], k = [];
  const them = (px, py, kk) => {
    if(x.length){
      const d = Math.hypot(px - x[x.length - 1], py - y[y.length - 1]);
      if(d < 1e-6) return;
    }
    x.push(px); y.push(py); k.push(kk);
  };
  const doan = (ax, ay, bx, by) => {
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / ds));
    for(let i = 1; i <= n; i++) them(ax + (bx - ax) * i / n, ay + (by - ay) * i / n, 0);
  };

  them(goc[0].x, goc[0].y, 0);
  let cx = goc[0].x, cy = goc[0].y;               // điểm hiện tại của đường cong
  for(let i = 1; i < goc.length - 1; i++){
    const P = goc[i], A0 = goc[i - 1], B0 = goc[i + 1];
    let ix = P.x - A0.x, iy = P.y - A0.y; const li = Math.hypot(ix, iy); ix /= li; iy /= li;
    let ox = B0.x - P.x, oy = B0.y - P.y; const lo = Math.hypot(ox, oy); ox /= lo; oy /= lo;
    const cosT = Math.max(-1, Math.min(1, ix * ox + iy * oy));
    const theta = Math.acos(cosT);                 // góc phải quay
    if(theta < 1e-3){ doan(cx, cy, P.x, P.y); cx = P.x; cy = P.y; continue; }
    const L = Math.min(P.L ?? catGoc, li / 2, lo / 2);
    const r = L / Math.tan(theta / 2);
    const Ax = P.x - ix * L, Ay = P.y - iy * L, Bx = P.x + ox * L, By = P.y + oy * L;
    doan(cx, cy, Ax, Ay);
    const dau = Math.sign(ix * oy - iy * ox);      // +1 rẽ một phía, -1 phía kia
    const Cx = Ax - iy * r * dau, Cy = Ay + ix * r * dau;
    const a0 = Math.atan2(Ay - Cy, Ax - Cx);
    const n = Math.max(2, Math.ceil(r * theta / ds));
    for(let j = 1; j <= n; j++){
      const a = a0 + dau * theta * j / n;
      them(Cx + Math.cos(a) * r, Cy + Math.sin(a) * r, dau / r);
    }
    cx = Bx; cy = By;
  }
  const cuoi = goc[goc.length - 1];
  doan(cx, cy, cuoi.x, cuoi.y);

  const n = x.length;
  const s = new Float64Array(n), huong = new Float64Array(n), vGioiHan = new Float64Array(n);
  for(let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  for(let i = 0; i < n; i++){
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    huong[i] = Math.atan2(x[b] - x[a], y[b] - y[a]);   // cùng quy ước với rotation.y của three.js
  }
  // duyệt ngược: đích v = 0, cua giới hạn v = sqrt(gtNgang/|k|)
  vGioiHan[n - 1] = 0;
  for(let i = n - 2; i >= 0; i--){
    const vCua = Math.abs(k[i]) > 1e-9 ? Math.sqrt(gtNgang / Math.abs(k[i])) : Infinity;
    vGioiHan[i] = Math.min(vCua, Math.sqrt(vGioiHan[i + 1] ** 2 + 2 * phanh * (s[i + 1] - s[i])));
  }
  // các ô lưới mà robot thực sự lăn qua (để tô màu tuyến cho khớp với đường cong)
  const oDiQua = [], daCo = new Set();
  for(let i = 0; i < n; i++){
    const r = Math.round(y[i]), c = Math.round(x[i]), kh = r + ',' + c;
    if(!daCo.has(kh)){ daCo.add(kh); oDiQua.push([r, c]); }
  }
  return { x, y, k, s, huong, vGioiHan, tong: s[n - 1], n, oDiQua };
}

// ---------- 3) mô phỏng theo thời gian ----------
export class XeRobot {
  constructor(cong){ this.congGoc = cong; this.cong = cong; this.datLai(); }

  datLai(){
    const c = this.cong = this.congGoc;
    Object.assign(this, { s: 0, sTruoc: 0, soLanVong: 0, v: 0, vMax: 0, aDoc: 0, aNgang: 0, t: 0, i: 0, xong: c.tong <= 0,
      dangCho: false, soLanNhuong: 0, tgCho: 0, choLienTuc: 0, choTong: 0, xinDuong: 0, tuDo: 0, biCham: 0,
      x: c.x[0], y: c.y[0], huong: c.huong[Math.min(1, c.n - 1)], k: 0 });
  }

  // Đổi sang tuyến mới giữa chừng (đường vòng): giữ vận tốc, thời gian, số lần nhường.
  doiCong(cong, dem = true){
    this.sTruoc += this.s;
    Object.assign(this, { cong, s: 0, i: 0, xong: cong.tong <= 0, choLienTuc: 0 });
    if(dem) this.soLanVong++;      // đổi tuyến vì bật/tắt chế độ húc thì không tính là đi vòng
  }
  get daDi(){ return this.sTruoc + this.s; }              // tổng quãng đường đã chạy (qua mọi tuyến)
  get tongDuong(){ return this.sTruoc + this.cong.tong; } // quãng đường dự kiến khi tới đích

  // tìm đoạn [i, i+1] chứa quãng đường s (s chỉ tăng nên đi tiếp từ i cũ)
  #noiSuy(mang){
    const c = this.cong, i = this.i;
    if(i >= c.n - 1) return mang[c.n - 1];
    const t = (this.s - c.s[i]) / Math.max(1e-9, c.s[i + 1] - c.s[i]);
    return mang[i] + (mang[i + 1] - mang[i]) * t;
  }

  // Quãng đường tới chỗ đầu tiên trên tuyến mà robot SẼ đụng vật cản động (Infinity nếu thông).
  // Kiểm tra theo cả không gian lẫn thời gian: ước lượng robot tới mỗi điểm trên tuyến lúc nào (tăng tốc hết cỡ rồi giữ vCap),
  // rồi chỉ xét chỗ vật cản đang ở quanh thời điểm đó (±0,45 s). Nhờ vậy robot nhanh băng qua làn xe khi xe còn xa,
  // thay vì đứng chờ cho tới khi xe chạy hẳn qua (kiểu cũ: coi mọi chỗ xe có thể tới trong 1,2 s tới đều bị chiếm).
  #khoangTrong(vatCan, vCap){
    if(!vatCan || !vatCan.length || this.tuDo > 0) return Infinity;
    const c = this.cong, v = this.v, a = VAT_LY.tangToc;
    const tamNhin = v * v / (2 * VAT_LY.phanh) + 6;
    // chỉ quan tâm vật ở phía trước hoặc ngang robot; vật đã ở sau lưng thì bỏ qua (tránh kẹt nhau)
    const hx = Math.sin(this.huong), hy = Math.cos(this.huong);
    // chờ người đi bộ quá 3 s (vd. gặp nhau trong hẻm cụt): robot "xin đường", lách qua người trong 1,5 s
    const boQuaNguoi = this.xinDuong > 0;
    const gan = vatCan.filter(o => Math.abs(o.x - this.x) + Math.abs(o.y - this.y) < tamNhin + 14
                                && (o.x - this.x) * hx + (o.y - this.y) * hy > -0.3
                                && !(boQuaNguoi && o.r < 0.3));
    if(!gan.length) return Infinity;
    const cap = Math.max(vCap, v, 1);
    const dTang = Math.max(0, (cap * cap - v * v) / (2 * a));
    const denTai = d => d <= dTang ? (Math.sqrt(v * v + 2 * a * d) - v) / a : (cap - v) / a + (d - dTang) / cap;
    for(let j = this.i; j < c.n && c.s[j] - this.s < tamNhin; j += 3){
      const px = c.x[j], py = c.y[j], tj = denTai(Math.max(0, c.s[j] - this.s));
      for(const o of gan){
        const nguong = (VAT_LY.banKinh + o.r) ** 2;
        for(let k = -1; k <= 1; k++){
          const tau = Math.max(0, tj + k * 0.15);
          const qx = o.x + o.vx * tau - px, qy = o.y + o.vy * tau - py;
          if(qx * qx + qy * qy < nguong) return Math.max(0, c.s[j] - this.s);
        }
      }
    }
    return Infinity;
  }

  buoc(dt, vmax, vatCan){
    if(this.xong) { this.aDoc = 0; this.aNgang = 0; this.dangCho = false; return; }
    const c = this.cong;
    const trong = this.#khoangTrong(vatCan, Math.min(vmax, this.#noiSuy(c.vGioiHan) + 8));
    const vTranh = trong === Infinity ? Infinity : Math.sqrt(2 * VAT_LY.phanh * Math.max(0, trong - 0.7));
    const soBuocCon = Math.max(1, Math.ceil(dt / (1 / 240)));   // chia nhỏ dt cho ổn định
    const h = dt / soBuocCon;
    const v0 = this.v;
    for(let n = 0; n < soBuocCon && !this.xong; n++){
      while(this.i < c.n - 2 && c.s[this.i + 1] <= this.s) this.i++;
      const vMuc = Math.min(vmax, this.#noiSuy(c.vGioiHan), vTranh);
      if(this.v < vMuc) this.v = Math.min(vMuc, this.v + VAT_LY.tangToc * h);
      else this.v = Math.max(vMuc, this.v - VAT_LY.phanh * 1.5 * h);   // giảm vmax đột ngột: phanh gấp
      this.s += this.v * h;          // còn < 0.01 ô tới đích thì coi như đã dừng
      this.t += h;
      if(this.s >= c.tong - 0.01){ this.s = c.tong; this.v = 0; this.xong = true; this.i = c.n - 2; }
    }
    while(this.i < c.n - 2 && c.s[this.i + 1] <= this.s) this.i++;
    this.x = this.#noiSuy(c.x);
    this.y = this.#noiSuy(c.y);
    // hướng: nội suy theo góc ngắn nhất
    const i = Math.min(this.i, c.n - 2);
    let d = c.huong[i + 1] - c.huong[i]; d = Math.atan2(Math.sin(d), Math.cos(d));
    const t = Math.min(1, Math.max(0, (this.s - c.s[i]) / Math.max(1e-9, c.s[i + 1] - c.s[i])));
    this.huong = c.huong[i] + d * t;
    this.k = c.k[i];
    this.aDoc = (this.v - v0) / Math.max(dt, 1e-6);
    this.aNgang = this.v * this.v * this.k;
    this.vMax = Math.max(this.vMax, this.v);
    const cho = vTranh < 0.3 && this.v < 0.3;
    // bị vật phía trước kìm tốc độ (vd. đi sau người đi bộ): đếm thời gian để duongvong.js tìm cách vượt
    const vCoThe = Math.min(vmax, this.#noiSuy(c.vGioiHan));
    this.biCham = vTranh < 0.5 * vCoThe && vCoThe > 2 ? this.biCham + dt : 0;
    if(cho && !this.dangCho) this.soLanNhuong++;
    if(cho) this.tgCho += dt;
    this.choLienTuc = cho ? this.choLienTuc + dt : 0;
    // Chống kẹt vĩnh viễn (xe và robot chờ nhau, hoặc robot nằm chồng lên xe): đứng chờ quá 2 s thì "nhích lên" 1,2 s,
    // bỏ qua mọi vật cản động để thoát ra; xong lại xét vật cản như bình thường.
    this.choTong = cho ? this.choTong + dt : (this.v > 1 ? 0 : this.choTong);
    this.tuDo = Math.max(0, this.tuDo - dt);
    if(this.choTong > 2){ this.tuDo = 1.2; this.choTong = 0; }
    this.xinDuong = Math.max(0, this.xinDuong - dt);
    if(this.choLienTuc > 3){ this.xinDuong = 1.5; this.choLienTuc = 0; }
    this.dangCho = cho;
  }
}
