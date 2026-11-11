// Giao thông trong thành phố: ô tô chạy theo làn, người đi bộ trên vỉa hè.
// Dùng chung cho lưới 2D và cảnh 3D. Tọa độ: x = cột, y = hàng (tâm ô là số nguyên).
//
// Ô tô:
//   - Mỗi đoạn làn liền nhau (N, D, +) là một "tuyến". Đi bên phải: nửa trên của đường ngang chạy
//     sang trái (tây), nửa dưới chạy sang phải (đông); nửa trái của đường dọc chạy xuống (nam),
//     nửa phải chạy lên (bắc).
//   - Giữ khoảng cách: nhìn phía trước trong làn, nếu có xe / robot / người thì giảm tốc
//     sao cho v² ≤ 2·a_phanh·(khoảng_cách − 1,5) và dừng hẳn khi quá gần.
//   - Chạy hết tuyến (ra mép bản đồ) thì biến mất, một lúc sau xuất hiện lại ở đầu tuyến.
// Đèn giao thông: chỉ ngã tư lớn (đại lộ 4 làn gặp đại lộ 4 làn) mới có đèn, chu kỳ 15 s: 6 s xanh cho chiều ngang,
// 1,5 s đỏ cả hai chiều (để xe trong ngã tư đi hết), 6 s xanh cho chiều dọc, 1,5 s đỏ cả hai.
// Xe gặp đèn đỏ thì dừng trước vạch; nếu đã quá gần, không kịp phanh thì đi tiếp (như đèn vàng).
// Ngã tư nhỏ không có đèn: ai tới trước đi trước. Chiều đang đi giữ ngã tư cho tới khi hết xe;
// nếu giữ quá 4 s mà chiều kia đang chờ thì nhường lại (không để một chiều chờ mãi).
// Kích thước (1 ô ≈ 2,5 m): ô tô dài 1,7 ô × rộng 0,8 ô, robot giao hàng chỉ ~0,35 ô, người ~0,3 ô.
// Người đi bộ: đi trên ô 0 (vỉa hè, hẻm, công viên), hay đi thẳng, thấy robot trước mặt thì
// đứng lại rồi rẽ hướng khác.
import { O, laNgang, laDoc, laVatCan } from './loaio.js';
import { taoRng } from './thanhpho.js';
import { hatVat } from './hatung.js';

// dai/rong: kích thước thân xe (ô). cachXe: khoảng cách tâm–tâm tối thiểu khi dừng sau xe khác.
const XE = { tangToc: 6, phanh: 22, dai: 1.7, rong: 0.8, cachXe: 2.4, banKinh: 0.42 };
export const KICH_THUOC_XE = { dai: XE.dai, rong: XE.rong };
const NGA_TU_KHONG_DEN = { giuToiDa: 4, giuThem: 1.2 };
export const DEN = { chuKy: 15, xanhNgang: 6, doHet: 1.5 };
const NGUOI = { banKinh: 0.2 };
const R_ROBOT = 0.22;   // nửa bề ngang robot (khớp VAT_LY.banKinh), dùng khi robot húc
export const MAU_XE = ['#e4553f', '#3d7fd9', '#f2c14e', '#eef1f0', '#2f3a38', '#8e5bd6'];
export const SO_MAU_XE = MAU_XE.length;
export const MAU_NGUOI = ['#ffd2a8', '#7fc8f8', '#f497b6', '#c3e88d', '#ffb86b', '#b4a7f5', '#f7f7f7', '#7ee0c3'];

export class GiaoThong {
  constructor(rows, cols, loai, { seed = 1, matDo = 1 } = {}){
    Object.assign(this, { rows, cols, loai, t: 0 });
    this.rng = taoRng(seed);
    this.tuyen = this.#timTuyen();
    this.#timNgaTu();
    this.xe = [];
    this.nguoi = [];
    this.song = [];
    this.sk = [];            // sự kiện cho giao diện 3D: { loai: 'no', x, y }
    this.day = 0;            // số vật bị vật khác đâm trúng (dây chuyền, nổ lan)
    this.noTong = 0;         // số vụ nổ
    const rng = this.rng;

    for(const tu of this.tuyen){
      const soXe = Math.floor(tu.dai / 16 * matDo + rng());
      for(let k = 0; k < soXe; k++){
        const xe = this.#xeMoi(tu);
        let viTri = Math.round(tu.dau + (k + rng() * 0.5) * (tu.dai / Math.max(1, soXe)) * tu.chieu);
        const oTai = v => tu.truc === 'ngang' ? this.#o(tu.hang, v) : this.#o(v, tu.cot);
        // không đặt xe sẵn trong hay sát ngã tư (thân xe dài 1,7 ô, cần chỗ để kịp phanh)
        const satNgaTu = v => [-1, 0, 1, 2, 3].some(d => oTai(v + d * tu.chieu) === O.NGA_TU);
        for(let lui = 0; lui < 8 && satNgaTu(viTri); lui++) viTri -= tu.chieu;
        if(tu.truc === 'ngang') xe.x = viTri; else xe.y = viTri;
        xe.v = xe.vMax * 0.7;
        this.xe.push(xe);
      }
    }

    const viaHe = [];
    for(let i = 0; i < rows * cols; i++) if(loai[i] === O.DUONG) viaHe.push(i);
    this.viaHe = viaHe;
    const soNguoi = Math.min(180, Math.floor(viaHe.length / 40 * matDo));
    for(let k = 0; k < soNguoi; k++){
      const i = viaHe[Math.floor(rng() * viaHe.length)];
      const r = (i / cols) | 0, c = i % cols;
      this.nguoi.push({ x: c, y: r, tx: c, ty: r, hx: 0, hy: 0, v: 0.9 + rng() * 0.8, dung: rng() * 2,
                        mau: Math.floor(rng() * 8), vx: 0, vy: 0 });
    }
  }

  // Mỗi cụm ô "+" liền nhau là một ngã tư; lệch pha ngẫu nhiên để các đèn không đổi cùng lúc.
  #timNgaTu(){
    const { rows, cols, loai } = this;
    this.cumNgaTu = new Int32Array(rows * cols).fill(-1);
    this.ngaTu = [];
    for(let i = 0; i < rows * cols; i++){
      if(loai[i] !== O.NGA_TU || this.cumNgaTu[i] >= 0) continue;
      const id = this.ngaTu.length, ds = [i];
      this.cumNgaTu[i] = id;
      let r0 = rows, r1 = 0, c0 = cols, c1 = 0;
      for(let k = 0; k < ds.length; k++){
        const j = ds[k], r = (j / cols) | 0, c = j % cols;
        r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
        for(const [a, b] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]){
          if(a < 0 || b < 0 || a >= rows || b >= cols) continue;
          const v = a * cols + b;
          if(loai[v] === O.NGA_TU && this.cumNgaTu[v] < 0){ this.cumNgaTu[v] = id; ds.push(v); }
        }
      }
      // chỉ ngã tư của 2 đại lộ 4 làn (cụm ≥ 4×4 ô) mới gắn đèn, còn lại là ngã tư tự nhường
      const coDen = r1 - r0 + 1 >= 4 && c1 - c0 + 1 >= 4;
      this.ngaTu.push({ r0, r1, c0, c1, coDen, lech: this.rng() * DEN.chuKy,
                        giu: null, batDau: 0, het: 0, choKhac: -1 });
    }
    // bản đồ nhỏ không có đại lộ nào giao nhau: vẫn cho ngã tư lớn nhất 1 bộ đèn
    if(this.ngaTu.length && !this.ngaTu.some(n => n.coDen)){
      const dt = n => (n.r1 - n.r0 + 1) * (n.c1 - n.c0 + 1);
      this.ngaTu.reduce((a, b) => dt(b) > dt(a) ? b : a).coDen = true;
    }
    this.soDen = this.ngaTu.filter(n => n.coDen).length;
  }

  // Còn xe chiều kia mà thân xe (dài 1,7 ô) vẫn nằm trong ngã tư hay không
  #coXeChieuKhac(nt, truc){
    const m = XE.dai / 2 + 0.1;
    return this.#xeGan((nt.c0 + nt.c1) / 2, (nt.r0 + nt.r1) / 2).some(k => !k.an && k.tu.truc !== truc
      && k.x > nt.c0 - 0.5 - m && k.x < nt.c1 + 0.5 + m && k.y > nt.r0 - 0.5 - m && k.y < nt.r1 + 0.5 + m
      && (k.tu.truc === 'ngang' ? k.y > nt.r0 - 0.5 && k.y < nt.r1 + 0.5 : k.x > nt.c0 - 0.5 && k.x < nt.c1 + 0.5)
      && (k.v > 0.1 || (k.tu.truc === 'ngang' ? k.x > nt.c0 - 0.5 - m + 0.2 && k.x < nt.c1 + 0.5 + m - 0.2
                                               : k.y > nt.r0 - 0.5 - m + 0.2 && k.y < nt.r1 + 0.5 + m - 0.2)));
  }

  // Ngã tư không đèn: xe chiều `truc` xin đi qua. Trả về true nếu được đi.
  #xinQua(nt, truc){
    const t = this.t, { giuToiDa, giuThem } = NGA_TU_KHONG_DEN;
    const khac = truc === 'ngang' ? 'doc' : 'ngang';
    if(nt.giu === khac && t < nt.het){ nt.choKhac = t; nt.truKhac = truc; return false; }
    const kiaDangCho = nt.choKhac > t - 0.3 && nt.truKhac === khac;
    if(nt.giu !== truc || t >= nt.het){
      // ngã tư vừa trống mà chiều kia đang chờ: tới lượt chiều kia
      if(nt.giu === truc && kiaDangCho){ Object.assign(nt, { giu: khac, batDau: t, het: t + giuThem, choKhac: -1 }); return false; }
      nt.giu = truc; nt.batDau = t; nt.choKhac = -1;
    }
    // giữ quá lâu mà chiều kia đang chờ: không gia hạn nữa, để ngã tư trống rồi chiều kia đi
    if(kiaDangCho && t - nt.batDau > giuToiDa) return false;
    nt.het = t + giuThem;
    return true;
  }

  // 'xanh' hoặc 'do' cho trục 'ngang' / 'doc' của ngã tư id
  den(id, truc){
    if(!this.ngaTu[id].coDen) return 'xanh';
    const t = (this.t + this.ngaTu[id].lech) % DEN.chuKy;
    const { xanhNgang, doHet } = DEN;
    if(truc === 'ngang') return t < xanhNgang ? 'xanh' : 'do';
    return t >= xanhNgang + doHet && t < 2 * xanhNgang + doHet ? 'xanh' : 'do';
  }

  get coGiaoThong(){ return this.xe.length + this.nguoi.length > 0; }

  #o(r, c){ return (r < 0 || c < 0 || r >= this.rows || c >= this.cols) ? O.NHA : this.loai[r * this.cols + c]; }

  #timTuyen(){
    const { rows, cols } = this, ds = [];
    // nửa nào của con đường: đếm số làn liền kề phía trên/dưới (hoặc trái/phải)
    const demLan = (r, c, dr, dc, laLoai) => { let k = 0; while(laLoai(this.#o(r + dr * (k + 1), c + dc * (k + 1)))) k++; return k; };
    for(let r = 0; r < rows; r++){
      let c = 0;
      while(c < cols){
        if(!laNgang(this.#o(r, c))){ c++; continue; }
        const a = c; while(c < cols && laNgang(this.#o(r, c))) c++;
        if(c - a < 6) continue;
        let mau = a; while(mau < c && this.#o(r, mau) === O.NGA_TU) mau++;
        if(mau >= c) mau = a;
        const tren = demLan(r, mau, -1, 0, laNgang), duoi = demLan(r, mau, 1, 0, laNgang);
        const chieu = tren < duoi ? -1 : 1;                 // nửa trên đi về tây, nửa dưới về đông
        ds.push({ truc: 'ngang', hang: r, dau: chieu > 0 ? a : c - 1, cuoi: chieu > 0 ? c - 1 : a, chieu, dai: c - a });
      }
    }
    for(let c = 0; c < cols; c++){
      let r = 0;
      while(r < rows){
        if(!laDoc(this.#o(r, c))){ r++; continue; }
        const a = r; while(r < rows && laDoc(this.#o(r, c))) r++;
        if(r - a < 6) continue;
        let mau = a; while(mau < r && this.#o(mau, c) === O.NGA_TU) mau++;
        if(mau >= r) mau = a;
        const trai = demLan(mau, c, 0, -1, laDoc), phai = demLan(mau, c, 0, 1, laDoc);
        const chieu = trai < phai ? 1 : -1;                 // nửa trái đi xuống (nam), nửa phải đi lên (bắc)
        ds.push({ truc: 'doc', cot: c, dau: chieu > 0 ? a : r - 1, cuoi: chieu > 0 ? r - 1 : a, chieu, dai: r - a });
      }
    }
    return ds;
  }

  #xeMoi(tu){
    const ngang = tu.truc === 'ngang';
    return {
      tu, an: false, henGio: 0, cho: 0,
      x: ngang ? tu.dau : tu.cot, y: ngang ? tu.hang : tu.dau,
      hx: ngang ? tu.chieu : 0, hy: ngang ? 0 : tu.chieu,
      v: 0, vMax: 5 + this.rng() * 4, mau: Math.floor(this.rng() * SO_MAU_XE), vx: 0, vy: 0,
    };
  }

  // Danh sách vật cản động cho robot: vị trí, vận tốc, bán kính
  // quanh (cx, cy) trong tầm `tam` ô (nếu có): bản đồ lớn có hàng nghìn xe, robot chỉ cần xe ở gần
  chuongNgai(cx = 0, cy = 0, tam = Infinity){
    const ds = [];
    // ô tô dài: dùng 2 hình tròn (đầu xe, đuôi xe) để robot né đúng thân xe
    const lech = (XE.dai - XE.rong) / 2;
    // xe đang dừng nhường robot vẫn là vật cản (đứng yên): robot không được chạy xuyên qua thân xe,
    // nếu xe chắn ngay trên tuyến thì robot sẽ tìm đường vòng (duongvong.js)
    for(const x of this.xe) if(!x.an && !x.bay && Math.abs(x.x - cx) + Math.abs(x.y - cy) < tam)
    {
      for(const s of [-1, 1]) ds.push({ x: x.x + x.hx * lech * s, y: x.y + x.hy * lech * s, vx: x.vx, vy: x.vy, r: XE.banKinh });
      // (không còn "vùng phanh" phía trước mũi xe: ô tô tự phanh khi thấy robot trên làn, robot chỉ cần tránh đúng lúc xe tới)
    }
    for(const n of this.nguoi) if(!n.bay && Math.abs(n.x - cx) + Math.abs(n.y - cy) < tam) ds.push({ x: n.x, y: n.y, vx: n.vx, vy: n.vy, r: NGUOI.banKinh });
    return ds;
  }

  // Ô tô x có bị vật tròn bán kính r tại (px, py) đâm trúng không (thân xe là hình chữ nhật 1,7 × 0,8 ô)
  #xeTrung(x, px, py, r){
    const dx = px - x.x, dy = py - x.y;
    if(Math.abs(dx) + Math.abs(dy) > 3) return false;
    const doc = dx * x.hx + dy * x.hy, ngang = dx * x.hy - dy * x.hx;
    return Math.abs(doc) <= XE.dai / 2 + r && Math.abs(ngang) <= XE.rong / 2 + r;
  }

  #hatNguoi(n, rb){ n.bay = hatVat('nguoi', n, rb, this.rng); n.vx = n.vy = 0; }
  // xacNo: xác suất xe nổ khi bị hất
  #hatXe(x, rb, xacNo){
    x.bay = hatVat('xe', { x: x.x, y: x.y, vx: x.vx, vy: x.vy, yaw: Math.atan2(-x.hy, x.hx) }, rb, this.rng);
    x.v = 0; x.vx = x.vy = 0;
    if(this.rng() < xacNo) x.bay.noSau = 0.5 + this.rng() * 0.9;      // bốc cháy rồi nổ giữa không trung / khi chạm đất
  }

  // Dân chạy loạn và xe phóng nhanh trong vùng quanh (x, y) sau một cú tông / vụ nổ
  #hoangLoan(x, y, R){
    for(const n of this.nguoi){
      if(n.bay) continue;
      const dx = n.x - x, dy = n.y - y, d = Math.hypot(dx, dy);
      if(d > R) continue;
      n.hoang = 4 + this.rng() * 2; n.dung = 0;
      n.fx = d > 0.01 ? dx / d : 1; n.fy = d > 0.01 ? dy / d : 0;
    }
    for(const k of this.xe) if(!k.bay && !k.an && Math.abs(k.x - x) + Math.abs(k.y - y) < R * 1.5) k.hoang = 3;
  }

  // Vụ nổ tại (x, y): phát ra sóng xung kích lan 18 ô/s tới bán kính 6 ô. Sóng chạm tới đâu hất người / xe tới đó
  // (nổ lan thành từng đợt), xe bị hất có thể nổ tiếp (nổ dây chuyền). Người / xe quanh đó hoảng loạn.
  #no(x, y){
    this.sk.push({ loai: 'no', x, y });
    this.noTong++;
    this.song.push({ x, y, ban: 0 });
    this.#hoangLoan(x, y, 14);
  }
  noTai(x, y){ this.#no(x, y); }        // cho giao diện 3D gọi khi xe đỗ nổ

  #songXungKich(dt){
    if(!this.song.length) return;
    const RMAX = 6;
    for(const w of this.song){
      w.ban += 18 * dt;
      const huong = (px, py) => { const dx = px - w.x, dy = py - w.y, d = Math.hypot(dx, dy) || 1; return { x: w.x, y: w.y, vx: dx / d * 14, vy: dy / d * 14 }; };
      for(const n of this.nguoi) if(!n.bay && Math.hypot(n.x - w.x, n.y - w.y) < w.ban){ this.#hatNguoi(n, huong(n.x, n.y)); this.day++; }
      for(const k of this.xe) if(!k.bay && !k.an && Math.hypot(k.x - w.x, k.y - w.y) < w.ban){ this.#hatXe(k, huong(k.x, k.y), 0.35); this.day++; }
    }
    this.song = this.song.filter(w => w.ban < RMAX);
  }

  // Vật đang bay (đã bị hất) đâm vào người / xe khác thì hất luôn: dây chuyền
  #dayChuyen(){
    const dap = (b, r) => {
      if(b.dat || b.z > 1.2 || Math.hypot(b.vx, b.vy) < 3) return;
      const rb = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
      for(const n of this.nguoi){
        if(!n.bay && Math.hypot(n.x - b.x, n.y - b.y) < r + NGUOI.banKinh){ this.#hatNguoi(n, rb); this.day++; this.#hoangLoan(n.x, n.y, 6); }
      }
      for(const k of this.#xeGan(b.x, b.y)){
        if(!k.bay && !k.an && this.#xeTrung(k, b.x, b.y, r)){ this.#hatXe(k, rb, 0.3); this.day++; this.#hoangLoan(k.x, k.y, 6); }
      }
    };
    for(const a of this.xe) if(a.bay) dap(a.bay, 0.8);
    for(const a of this.nguoi) if(a.bay) dap(a.bay, 0.3);
  }

  // Chế độ húc: robot rb ({x, y, vx, vy}) đâm vào người / ô tô thì hất văng. Trả về số vật vừa bị tông.
  vaCham(rb){
    const kq = { nguoi: 0, xe: 0 };
    const v = Math.hypot(rb.vx, rb.vy);
    for(const n of this.nguoi){
      if(n.bay || Math.hypot(n.x - rb.x, n.y - rb.y) > NGUOI.banKinh + R_ROBOT) continue;
      this.#hatNguoi(n, rb); kq.nguoi++;
      this.#hoangLoan(n.x, n.y, 9);
    }
    for(const x of this.xe){
      if(x.an || x.bay || !this.#xeTrung(x, rb.x, rb.y, R_ROBOT)) continue;
      this.#hatXe(x, rb, v > 10 ? 0.5 : 0.1); kq.xe++;
      this.#hoangLoan(x.x, x.y, 9);
    }
    return kq;
  }

  // Lưới băm các ô tô theo ô 14×14 để tìm xe lân cận nhanh (bản đồ 500×500 có cả nghìn xe)
  #dungLuoiXe(){
    const m = new Map();
    for(const k of this.xe){
      if(k.an) continue;
      const kh = Math.floor(k.x / 14) * 4096 + Math.floor(k.y / 14);
      const ds = m.get(kh);
      if(ds) ds.push(k); else m.set(kh, [k]);
    }
    this.luoiXe = m;
  }
  #xeGan(x, y){
    const cx = Math.floor(x / 14), cy = Math.floor(y / 14), kq = [];
    for(let a = -1; a <= 1; a++) for(let b = -1; b <= 1; b++){
      const ds = this.luoiXe.get((cx + a) * 4096 + cy + b);
      if(ds) for(const k of ds) kq.push(k);
    }
    return kq;
  }

  buoc(dt, robot){
    this.t += dt;
    this.#dungLuoiXe();
    for(const xe of this.xe) this.#buocXe(xe, dt, robot);
    for(const n of this.nguoi) this.#buocNguoi(n, dt, robot);
    this.#songXungKich(dt);
    this.#dayChuyen();
  }

  #buocXe(xe, dt, robot){
    const tu = xe.tu;
    if(xe.bay){                       // đang bị húc văng: bay theo vật lý, hết hạn thì biến mất rồi xuất hiện lại đầu tuyến
      const b = xe.bay;
      b.buoc(dt);
      xe.x = b.x; xe.y = b.y; xe.v = 0; xe.vx = xe.vy = 0;
      if(b.noSau !== undefined && b.t >= b.noSau){ b.noSau = undefined; b.tSong = b.t + 0.05; this.#no(b.x, b.y); }
      if(b.het){ xe.bay = null; xe.an = true; xe.henGio = this.t + 1 + this.rng() * 3; }
      return;
    }
    if(xe.an){
      if(this.t < xe.henGio) return;
      // xuất hiện lại ở đầu tuyến nếu chỗ đó đang trống
      const x0 = tu.truc === 'ngang' ? tu.dau : tu.cot, y0 = tu.truc === 'ngang' ? tu.hang : tu.dau;
      const banRo = this.xe.some(k => !k.an && k !== xe && Math.hypot(k.x - x0, k.y - y0) < 3)
                 || (robot && Math.hypot(robot.x - x0, robot.y - y0) < 2.5);
      if(banRo){ xe.henGio = this.t + 0.5; return; }
      Object.assign(xe, { an: false, x: x0, y: y0, v: xe.vMax * 0.6, cho: 0 });
    }

    // tìm vật gần nhất phía trước trong làn của mình
    let gan = Infinity, lyDo = '';
    const trongNgaTu = this.#o(Math.round(xe.y), Math.round(xe.x)) === O.NGA_TU;
    let vuongRobot = false;
    const kiem = (ox, oy, laXe, laRobot) => {
      const rx = ox - xe.x, ry = oy - xe.y;
      const doc = rx * xe.hx + ry * xe.hy, ngang = Math.abs(rx * xe.hy - ry * xe.hx);
      // robot đã ở ngang thân xe (chưa vượt lên trước mũi xe) thì xe không chờ robot nữa, tránh 2 bên chờ nhau
      const oCanh = laRobot && doc < XE.dai / 2 && ngang > 0.3;
      if(!oCanh && doc > 0.05 && ngang < 0.6 && doc < gan && !(laXe && xe.cho > 8)){   // kẹt quá 8 s thì nhích lên
        gan = doc; vuongRobot = !!laRobot; lyDo = laRobot ? 'nhường robot' : laXe ? 'xe phía trước' : 'người đi bộ';
      }
    };
    for(const k of this.#xeGan(xe.x, xe.y)){
      if(k === xe || k.an || Math.abs(k.x - xe.x) + Math.abs(k.y - xe.y) >= 14) continue;
      if(trongNgaTu && k.tu.truc !== xe.tu.truc) continue;   // đã vào ngã tư thì đi cho hết, không chờ xe chiều kia
      kiem(k.x, k.y, true);
    }
    if(robot){
      kiem(robot.x, robot.y, false, true);
      // robot đang băng ngang: xét cả chỗ robot sẽ tới sau 0,3 s và 0,6 s
      if(robot.vx || robot.vy) for(const tau of [0.3, 0.6]) kiem(robot.x + robot.vx * tau, robot.y + robot.vy * tau, false, true);
    }
    for(const n of this.nguoi) if(!n.bay && Math.abs(n.x - xe.x) + Math.abs(n.y - xe.y) < 6) kiem(n.x, n.y, false);

    // vật cản cố định mới vẽ lên làn (người dùng bấm chuột vẽ thêm): dừng trước nó
    const r = Math.round(xe.y), c = Math.round(xe.x);
    for(let k = 1; k <= 3; k++){
      const rr = r + xe.hy * k, cc = c + xe.hx * k;
      if(rr < 0 || cc < 0 || rr >= this.rows || cc >= this.cols) break;   // mép bản đồ: xe chạy ra ngoài rồi biến mất
      if(laVatCan(this.#o(rr, cc))){
        const d = (cc - xe.x) * xe.hx + (rr - xe.y) * xe.hy;
        if(d < gan){ gan = d; lyDo = 'vật cản trên làn'; }
        break;
      }
    }

    // đèn đỏ ở ngã tư phía trước (chỉ xét khi xe chưa vào ngã tư)
    if(this.#o(r, c) !== O.NGA_TU){
      for(let k = 1; k <= 3; k++){
        const rr = r + xe.hy * k, cc = c + xe.hx * k;
        if(this.#o(rr, cc) !== O.NGA_TU) continue;
        const vach = (cc - xe.x) * xe.hx + (rr - xe.y) * xe.hy - 0.5 - XE.dai / 2;   // đầu xe tới vạch dừng
        const khongKipPhanh = xe.v * xe.v / (2 * XE.phanh) > vach + 0.3;
        const id = this.cumNgaTu[rr * this.cols + cc];
        const nt = this.ngaTu[id];
        let dung = nt.coDen && this.den(id, xe.tu.truc) === 'do', vi = 'đèn đỏ';
        // còn xe chiều kia đang ở trong ngã tư: chờ nó ra hết
        if(!dung){ dung = this.#coXeChieuKhac(nt, xe.tu.truc); vi = 'xe chiều kia trong ngã tư'; }
        if(!dung){
          // đèn xanh nhưng phía bên kia ngã tư đang kẹt xe: không chạy vào giữa ngã tư (tránh tắc cả nút)
          let er = rr, ec = cc;
          while(this.#o(er, ec) === O.NGA_TU){ er += xe.hy; ec += xe.hx; }
          dung = this.#xeGan(ec, er).some(k => k !== xe && !k.an && k.v < 2
            && Math.abs((k.x - ec) * xe.hy - (k.y - er) * xe.hx) < 0.6
            && (k.x - ec) * xe.hx + (k.y - er) * xe.hy < XE.dai + 0.4 && (k.x - ec) * xe.hx + (k.y - er) * xe.hy > -0.6);
          vi = 'bên kia ngã tư đang kẹt';
        }
        // ngã tư không đèn: chỉ xin đường khi đã tới gần vạch (tránh giữ chỗ từ xa)
        if(!dung && !nt.coDen && vach < 2.5){ dung = !this.#xinQua(nt, xe.tu.truc); vi = 'nhường xe chiều kia'; }
        if(dung && !khongKipPhanh && vach + XE.cachXe < gan){ gan = vach + XE.cachXe; lyDo = vi; }
        break;
      }
    }

    if(xe.hoang > 0) xe.hoang -= dt;
    const vMuc = Math.min(xe.vMax * (xe.hoang > 0 ? 1.7 : 1), gan === Infinity ? Infinity : Math.sqrt(2 * XE.phanh * Math.max(0, gan - XE.cachXe)));
    xe.v = xe.v < vMuc ? Math.min(vMuc, xe.v + XE.tangToc * dt) : Math.max(vMuc, xe.v - XE.phanh * dt);
    xe.cho = xe.v < 0.1 ? xe.cho + dt : 0;
    xe.lyDo = xe.v < 0.3 ? lyDo : '';       // vì sao xe đang dừng (hiện khi rê chuột / để kiểm tra)
    xe.nhuongRobot = vuongRobot && xe.v < 0.5;   // xe đang dừng nhường robot: robot cứ đi, không chờ lại
    xe.x += xe.hx * xe.v * dt;
    xe.y += xe.hy * xe.v * dt;
    xe.vx = xe.hx * xe.v; xe.vy = xe.hy * xe.v;

    const viTri = tu.truc === 'ngang' ? xe.x : xe.y;
    if((viTri - tu.cuoi) * tu.chieu > 0.6){                // ra khỏi tuyến
      xe.an = true;
      xe.henGio = this.t + 0.5 + this.rng() * 3;
      xe.vx = xe.vy = 0;
    }
  }

  // BFS ngắn từ ô (r, c) qua các ô đi được, trả về bước đầu tiên [dx, dy] tới ô vỉa hè gần nhất
  #huongVeViaHe(r, c){
    const thu = [[r, c, null]], da = new Set([r * this.cols + c]);
    for(let k = 0; k < thu.length && k < 200; k++){
      const [y, x, dau] = thu[k];
      for(const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]){
        const yy = y + b, xx = x + a, l = this.#o(yy, xx), id = yy * this.cols + xx;
        if(l === O.NHA || l >= O.XE_DO || da.has(id)) continue;
        const buoc = dau || [a, b];
        if(l === O.DUONG) return buoc;
        da.add(id); thu.push([yy, xx, buoc]);
      }
    }
    return null;
  }

  #buocNguoi(n, dt, robot){
    if(n.bay){                        // đang bị húc văng; hết hạn thì xuất hiện lại ở một ô vỉa hè ngẫu nhiên
      const b = n.bay;
      b.buoc(dt);
      n.x = b.x; n.y = b.y; n.vx = n.vy = 0;
      if(b.het){
        n.bay = null;
        const i = this.viaHe.length ? this.viaHe[Math.floor(this.rng() * this.viaHe.length)] : 0;
        const r = (i / this.cols) | 0, c = i % this.cols;
        Object.assign(n, { x: c, y: r, tx: c, ty: r, hx: 0, hy: 0, dung: 0.5 });
      }
      return;
    }
    if(robot){
      const rx = robot.x - n.x, ry = robot.y - n.y, d = Math.hypot(rx, ry);
      // Robot đang chạy nhanh tới từ phía sau / phía trước trên đúng đường người này đứng: bước sang ngang NGAY (nhanh gấp ~3 lần
      // bình thường) để robot lướt qua, thay vì đứng chắn đường khiến robot phải hãm tốc đi theo sau.
      const vr = Math.hypot(robot.vx, robot.vy);
      if(vr > 1.5 && !(n.esq > 0)){
        const ux = robot.vx / vr, uy = robot.vy / vr, px = -rx, py = -ry;
        const doc = px * ux + py * uy, ngang = px * -uy + py * ux;
        if(doc > -0.2 && doc < 6 && Math.abs(ngang) < 0.7){
          const dau = ngang >= 0 ? 1 : -1, r = Math.round(n.y), c = Math.round(n.x);
          for(const sg of [dau, -dau]){
            const qx = -uy * sg, qy = ux * sg;
            const a = Math.abs(qx) > Math.abs(qy) ? Math.sign(qx) : 0, b = Math.abs(qx) > Math.abs(qy) ? 0 : Math.sign(qy);
            const l = this.#o(r + b, c + a);
            if(l === O.NHA || l >= O.XE_DO) continue;
            Object.assign(n, { hx: a, hy: b, tx: c + a, ty: r + b, dung: 0, esq: 0.6 });
            break;
          }
        }
      }
      // robot ở ngay trước mặt: khựng lại một chút rồi quay sang ô xa robot nhất (né đường)
      if(!(n.esq > 0) && d < 1.1 && (rx * n.hx + ry * n.hy) > 0.2){
        const r = Math.round(n.y), c = Math.round(n.x);
        let tot = null, xaNhat = -1;
        for(const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]){
          const l = this.#o(r + b, c + a);
          if(l === O.NHA || l >= O.XE_DO) continue;          // né được cả xuống mép đường nếu vỉa hè bị chặn
          const xa = Math.hypot(c + a - robot.x, r + b - robot.y);
          if(xa > xaNhat){ xaNhat = xa; tot = [a, b]; }
        }
        n.dung = 0.3 + this.rng() * 0.3;
        if(tot){ n.hx = tot[0]; n.hy = tot[1]; n.tx = c + tot[0]; n.ty = r + tot[1]; }
        else { n.tx = c; n.ty = r; }
      }
    }
    if(n.esq > 0) n.esq -= dt;
    const chay = n.hoang > 0;           // hoảng loạn: chạy nhanh, ưu tiên hướng ra xa chỗ nổ / tông
    if(chay){ n.hoang -= dt; n.dung = 0; }
    if(n.dung > 0){ n.dung -= dt; n.vx = n.vy = 0; return; }

    const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
    if(d < 0.02){
      // tới ô đích: chọn ô kế tiếp (ưu tiên đi thẳng, tránh quay đầu, tránh phía robot)
      const r = n.ty, c = n.tx, lua = [];
      for(const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]){
        if(this.#o(r + b, c + a) !== O.DUONG) continue;
        let w = 1;
        if(a === n.hx && b === n.hy) w = 6;
        else if(a === -n.hx && b === -n.hy) w = 0.15;
        if(chay && a * n.fx + b * n.fy > 0.3) w *= 8;
        lua.push([a, b, w]);
      }
      if(!lua.length){
        // đang đứng giữa lòng đường (lúc né robot): đi về vỉa hè gần nhất, không đứng chặn xe
        const buocVe = this.#huongVeViaHe(r, c);
        if(buocVe){ n.hx = buocVe[0]; n.hy = buocVe[1]; n.tx = c + buocVe[0]; n.ty = r + buocVe[1]; }
        else n.dung = 1;
        return;
      }
      let tong = lua.reduce((s, x) => s + x[2], 0), x = this.rng() * tong;
      let chon = lua[lua.length - 1];
      for(const l of lua){ x -= l[2]; if(x <= 0){ chon = l; break; } }
      n.hx = chon[0]; n.hy = chon[1]; n.tx = c + chon[0]; n.ty = r + chon[1];
      if(!chay && this.rng() < 0.02) n.dung = 1 + this.rng() * 2;   // thỉnh thoảng đứng lại (xem điện thoại…)
      return;
    }
    const vv = n.v * (chay ? 2.6 : n.esq > 0 ? 3.2 : 1);
    const buoc = Math.min(d, vv * dt);
    n.x += dx / d * buoc; n.y += dy / d * buoc;
    n.vx = dx / d * vv; n.vy = dy / d * vv;
  }
}
