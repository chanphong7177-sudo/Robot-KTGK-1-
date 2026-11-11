// Đường vòng: robot bị chặn bởi xe / người đang ĐỨNG YÊN thì tự tìm lối khác thay vì chờ mãi.
// Ưu tiên THỜI GIAN hơn quãng đường: chấp nhận đi xa hơn (tối đa `toiDaThem` ô) để khỏi phải chờ.
//
// Cách làm (dùng chung cho 2D và 3D):
//   1) Robot đã đứng chờ ≥ `choTruocKhiVong` giây. Lấy các vật cản đang đứng yên ở gần
//      (ô tô dừng đèn đỏ / kẹt xe, người đứng lại) và đánh dấu các ô mà thân chúng chiếm là "tường".
//      Vật đang chạy thì KHÔNG đánh dấu: chờ nó chạy qua thường nhanh hơn đi vòng.
//   2) Nếu tuyến phía trước không đi qua ô nào bị chặn thì thôi (robot chỉ đang chờ xe chạy qua).
//   3) Chọn điểm "nhập lại" trên tuyến cũ, sau chỗ bị chặn vài ô, rồi chạy A* (chính astar.py, Python)
//      trên một khung nhỏ quanh robot → đường vòng. Ghép: vị trí robot → đường vòng → phần còn lại của tuyến cũ.
//   4) Làm mượt + bo cua lại (vatly.js) và cho robot chạy tiếp theo tuyến mới, giữ nguyên vận tốc.
// A* được truyền vào (timAStar) để trang web dùng Python (window.td), còn bản thử nghiệm dùng JS.
import { lamMuotDuong, taoDuongCong } from './vatly.js';
import { laVatCan, laLan } from './loaio.js';

export const DUONG_VONG = {
  choTruocKhiVong: 0.3,   // s   đứng chờ bao lâu thì bắt đầu tìm đường vòng
  nghi: 1.2,              // s   giữa 2 lần thử (A* tốn thời gian, không chạy mỗi khung hình)
  vDung: 0.4,             // ô/s vật chậm hơn mức này coi như đang đứng yên
  vCham: 2.0,             // ô/s vật chậm hơn mức này (người đi bộ) mà kìm robot lâu thì vượt qua
  chamTruocKhiVuot: 0.8,  // s   bị kìm tốc độ bao lâu thì tìm cách vượt
  tamNhin: 6,             // ô   chỉ xét vật cản đứng yên trong bán kính này quanh robot
  vuotQua: 5,             // ô   điểm nhập lại cách ô bị chặn cuối cùng ít nhất chừng này ô (theo tuyến)
  khungThem: 8,           // ô   khung A* = hình chữ nhật bao robot + điểm nhập lại, nới thêm chừng này ô
  toiDaThem: 30,         // ô   đường vòng dài hơn đoạn cũ quá mức này thì thà chờ còn hơn
};

export class TimDuongVong {
  // path: tuyến lưới hiện tại [[r, c], ...] (kết quả A*), timAStar(grid, [r, c], [r, c]) → [[r, c], ...]
  constructor({ rows, cols, loai, path, timAStar }){
    Object.assign(this, { rows, cols, loai, path: path.slice(), timAStar, j: 0, lanThuCuoi: -Infinity, soLanVong: 0 });
  }

  #laTuongGoc(r, c){
    return r < 0 || c < 0 || r >= this.rows || c >= this.cols || laVatCan(this.loai[r * this.cols + c]);
  }

  // chỉ số ô trên tuyến gần robot nhất (tìm tới trước từ lần trước, vì robot chỉ đi tới)
  #capNhatViTri(x, y){
    const p = this.path;
    let tot = this.j, dTot = Infinity;
    for(let k = this.j; k < Math.min(p.length, this.j + 40); k++){
      const d = Math.abs(p[k][0] - y) + Math.abs(p[k][1] - x);
      if(d < dTot){ dTot = d; tot = k; }
    }
    this.j = tot;
  }

  // Gọi mỗi khung hình. Trả về đường cong mới (đổi tuyến) hoặc null (cứ đi / chờ tiếp).
  thu(xe, chuongNgai){
    this.#capNhatViTri(xe.x, xe.y);
    const { choTruocKhiVong, nghi, vDung, vCham, chamTruocKhiVuot, tamNhin, vuotQua, khungThem, toiDaThem } = DUONG_VONG;
    const dungCho = xe.dangCho && xe.choLienTuc >= choTruocKhiVong;
    const biKim = !xe.dangCho && xe.biCham >= chamTruocKhiVuot;
    if(!(dungCho || biKim) || !chuongNgai) return null;
    if(xe.t - this.lanThuCuoi < nghi) return null;
    this.lanThuCuoi = xe.t;

    // 1) ô bị vật đứng yên chiếm (lấy mẫu quanh tâm mỗi hình tròn của thân xe / người)
    const r0 = Math.round(xe.y), c0 = Math.round(xe.x);
    const chan = new Set();
    for(const o of chuongNgai){
      const vo = Math.hypot(o.vx, o.vy);
      if(vo > (biKim ? vCham : vDung)) continue;
      if(Math.abs(o.x - xe.x) + Math.abs(o.y - xe.y) > tamNhin) continue;
      const rr = o.r + 0.05;    // chỉ ô thân vật thật sự chiếm (nới nhiều quá sẽ chặn luôn làn bên cạnh)
      // vật đang chậm rãi đi: chặn cả chỗ nó sắp tới (sau 0,8 s)
      const diem = [[0, 0], [rr, 0], [-rr, 0], [0, rr], [0, -rr]];
      if(vo > vDung) diem.push([o.vx * 0.8, o.vy * 0.8]);
      for(const [ax, ay] of diem){
        const r = Math.round(o.y + ay), c = Math.round(o.x + ax);
        if(r === r0 && c === c0) continue;      // ô robot đang đứng thì không thể là tường
        chan.add(r * this.cols + c);
      }
    }
    if(!chan.size) return null;

    // 2) tuyến phía trước có đi qua ô bị chặn không? Ô bị chặn cuối cùng (trong tầm) ở đâu?
    const p = this.path;
    let cuoi = -1;
    for(let k = this.j; k < p.length && k <= this.j + tamNhin * 2; k++){
      if(chan.has(p[k][0] * this.cols + p[k][1])) cuoi = k;
    }
    if(cuoi < 0) return null;
    if(cuoi >= p.length - 1) return null;   // vật đứng ngay trên điểm giao: không vòng được

    // 3) điểm nhập lại: sau ô bị chặn ≥ vuotQua ô, và không nằm trong ô bị chặn
    let nhap = Math.min(p.length - 1, cuoi + vuotQua);
    while(nhap < p.length - 1 && chan.has(p[nhap][0] * this.cols + p[nhap][1])) nhap++;
    const [rg, cg] = p[nhap];

    // khung A*: bao robot + điểm nhập lại, nới thêm khungThem ô
    const rMin = Math.max(0, Math.min(r0, rg) - khungThem), rMax = Math.min(this.rows - 1, Math.max(r0, rg) + khungThem);
    const cMin = Math.max(0, Math.min(c0, cg) - khungThem), cMax = Math.min(this.cols - 1, Math.max(c0, cg) + khungThem);
    const grid = [];
    for(let r = rMin; r <= rMax; r++){
      let s = '';
      for(let c = cMin; c <= cMax; c++){
        const l = this.loai[r * this.cols + c];
        s += laVatCan(l) || chan.has(r * this.cols + c) ? '1' : laLan(l) ? '3' : '0';
      }
      grid.push(s);
    }
    const vong = this.timAStar(grid, [r0 - rMin, c0 - cMin], [rg - rMin, cg - cMin]);
    if(!vong || vong.length < 2) return null;
    const doanVong = vong.map(([r, c]) => [r + rMin, c + cMin]);

    // đáng đi vòng không? (so số ô: đường vòng vs đoạn cũ từ robot tới điểm nhập lại)
    if(doanVong.length - 1 - (nhap - this.j) > toiDaThem) return null;

    // 4) ghép tuyến mới, làm mượt (không cắt qua ô bị chặn, không cắt chéo làn xe ngoài tuyến)
    const moi = doanVong.concat(p.slice(nhap + 1));
    const tren = new Set(moi.map(([r, c]) => r * this.cols + c));
    const laTuong = (r, c) => this.#laTuongGoc(r, c) || chan.has(r * this.cols + c)
                           || (laLan(this.loai[r * this.cols + c]) && !tren.has(r * this.cols + c));
    const goc = lamMuotDuong([[xe.y, xe.x], ...moi.slice(1)], laTuong);
    if(goc.length < 2) return null;
    this.path = moi;
    this.j = 0;
    this.soLanVong++;
    return taoDuongCong(goc);
  }
}

// A* bằng JS (cùng chi phí như astar.py: '1' = vật cản, '3' = làn xe tốn 3, còn lại tốn 1).
// Chỉ dùng khi chạy thử ngoài trình duyệt (Node); trên web dùng astar.py qua Brython.
export function aSaoJS(grid, xp, dc){
  const R = grid.length, C = grid[0].length, id = (r, c) => r * C + c;
  const g = new Float64Array(R * C).fill(Infinity), cha = new Int32Array(R * C).fill(-1), xong = new Uint8Array(R * C);
  const h = (r, c) => Math.abs(r - dc[0]) + Math.abs(c - dc[1]);
  const heap = [[h(...xp), id(...xp)]];
  g[id(...xp)] = 0;
  while(heap.length){
    let m = 0; for(let k = 1; k < heap.length; k++) if(heap[k][0] < heap[m][0]) m = k;
    const [, u] = heap[m]; heap[m] = heap[heap.length - 1]; heap.pop();
    if(xong[u]) continue; xong[u] = 1;
    const r = (u / C) | 0, c = u % C;
    if(r === dc[0] && c === dc[1]){
      const dd = []; for(let v = u; v !== -1; v = cha[v]) dd.unshift([(v / C) | 0, v % C]); return dd;
    }
    for(const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]){
      if(a < 0 || b < 0 || a >= R || b >= C || grid[a][b] === '1') continue;
      const v = id(a, b), gm = g[u] + (grid[a][b] === '3' ? 3 : 1);
      if(gm < g[v]){ g[v] = gm; cha[v] = u; heap.push([gm + h(a, b), v]); }
    }
  }
  return [];
}
