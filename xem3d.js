// Xem robot chạy theo tuyến A* trong 3D (three.js).
// Mô hình robot: robot.glb xuất từ Blender bằng tao_robot_blender.py.
// Nếu chưa có robot.glb thì dùng mô hình dựng sẵn cùng kích thước.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { taoDuongCong, lamMuotDuong, XeRobot } from './vatly.js';
import { hatVat } from './hatung.js';
import { taoRng } from './thanhpho.js';
import { TimDuongVong } from './duongvong.js';
import { layTocDo } from './tocdo.js';
import { O, laLan, laVatCan } from './loaio.js';
import { GiaoThong, MAU_XE, MAU_NGUOI, KICH_THUOC_XE } from './giaothong.js';

// Tỉ lệ thật (1 ô ≈ 2,5 m): ô tô dài 1,7 ô, người cao ~0,7 ô, robot giao hàng thu nhỏ còn ~0,55 lần mô hình
const TL_ROBOT = 0.55;

const CAMERAS = [
  { id:'tong-canh', name:'Toàn cảnh', key:'1' },
  { id:'goc-cheo',  name:'Góc chéo',  key:'2' },
  { id:'bam-theo',  name:'Bám theo',  key:'3' },
  { id:'mat-robot', name:'Mắt robot', key:'4' },
  { id:'truc-thang',name:'Trực thăng', key:'5' },
  { id:'xoay',      name:'Xoay quanh', key:'6' },
  { id:'tu-do',     name:'Tự do (kéo chuột)', key:'7' },
];
const MAU_DEN_XANH = new THREE.Color('#3ee08a'), MAU_DEN_DO = new THREE.Color('#ff4d4d');
const _mauTam = new THREE.Color();
const BAN_KINH_BANH = 0.085; // phải khớp tao_robot_blender.py để bánh quay đúng tốc độ
const CAO_TUONG = 0.9;

const v3d = document.getElementById('v3d');
const khung = document.getElementById('v3d-canvas');
const camRow = document.getElementById('v3d-cams');
const thongTin = document.getElementById('v3d-info');
const nguonMoHinh = document.getElementById('v3d-model');
const nutHuc = document.getElementById('v3d-huc');

let canh = null;             // mọi thứ của một lần mở cửa sổ 3D
let camHienTai = 'goc-cheo';
let huc = false;             // chế độ húc (phím B): kệ mọi vật cản trừ nhà, không nhường, tông luôn

// ---------- màu lấy từ CSS của trang ----------
function mauCSS(ten, duPhong){
  const v = getComputedStyle(document.documentElement).getPropertyValue(ten).trim();
  return new THREE.Color(v || duPhong);
}

// ---------- mô hình robot ----------
let huaRobot = null;
function napRobot(){
  if(!huaRobot){
    huaRobot = new GLTFLoader().loadAsync('robot.glb')
      .then(gltf => ({ goc: gltf.scene, nguon: 'robot.glb (xuất từ Blender)' }))
      .catch(() => ({ goc: robotDungSan(), nguon: 'mô hình dựng sẵn (chưa có robot.glb, chạy tao_robot_3d.bat để tạo bằng Blender)' }));
  }
  return huaRobot.then(r => ({ goc: r.goc.clone(true), nguon: r.nguon }));
}

// Cùng hình dạng với tao_robot_blender.py. Blender (x, y, z) -> three (x, z, -y).
function robotDungSan(){
  const g = new THREE.Group();
  const than = new THREE.MeshStandardMaterial({ color: mauCSS('--fg', '#edf2ef'), roughness: 0.35 });
  const nhan = new THREE.MeshStandardMaterial({ color: mauCSS('--accent', '#ff8a5c'), roughness: 0.4 });
  const den = new THREE.MeshStandardMaterial({ color: mauCSS('--accent', '#ff8a5c'), emissive: mauCSS('--accent', '#ff8a5c'), emissiveIntensity: 2 });
  const toi = new THREE.MeshStandardMaterial({ color: mauCSS('--surface-2', '#1b2722'), metalness: 0.3, roughness: 0.5 });
  const banh = new THREE.MeshStandardMaterial({ color: mauCSS('--line', '#263530'), roughness: 0.8 });
  const them = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };

  them(new THREE.BoxGeometry(0.60, 0.08, 0.50), toi, 0, 0.14, 0);
  for(const x of [-0.27, 0.27]) for(const z of [-0.16, 0.16]){
    const b = them(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 24), banh, x, 0.085, z);
    b.rotation.z = Math.PI / 2;
    b.name = 'Banh';
  }
  them(new THREE.BoxGeometry(0.54, 0.40, 0.44), than, 0, 0.38, 0);
  them(new THREE.BoxGeometry(0.40, 0.12, 0.03), toi, 0, 0.44, 0.215);
  them(new THREE.BoxGeometry(0.40, 0.12, 0.03), toi, 0, 0.30, 0.215);
  them(new THREE.BoxGeometry(0.30, 0.012, 0.035), nhan, 0, 0.37, 0.22);
  for(const s of [-1, 1]){
    them(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 12), than, s * 0.31, 0.42, 0.02).rotation.z = s * -0.61;
  }
  them(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 16), toi, 0, 0.61, 0);
  them(new THREE.SphereGeometry(0.17, 32, 16), than, 0, 0.78, 0);
  for(const x of [-0.06, 0.06]) them(new THREE.SphereGeometry(0.028, 16, 8), den, x, 0.80, 0.15);
  them(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), toi, 0, 0.73, 0.16).rotation.z = Math.PI / 2;
  them(new THREE.CylinderGeometry(0.01, 0.01, 0.10, 8), toi, 0, 0.99, 0);
  them(new THREE.SphereGeometry(0.03, 16, 8), den, 0, 1.05, 0);
  return g;
}

// ---------- dựng cảnh từ bản đồ ----------
// Bản đồ nhỏ: tường xám đều nhau như trước.
// Bản đồ thành phố (từ 40×40): mỗi cụm vật cản liền nhau là một tòa nhà với chiều cao riêng
// (càng gần trung tâm càng cao), cụm 1–2 ô là cây, ô đường sát nhà là vỉa hè.
function phanCum(rows, cols, luoi){
  const nhan = new Int32Array(rows * cols).fill(-1);
  const coCum = [];
  const hang = new Int32Array(rows * cols);
  for(let i = 0; i < rows * cols; i++){
    if(!luoi[i] || nhan[i] >= 0) continue;
    const id = coCum.length;
    let dau = 0, cuoi = 0;
    hang[cuoi++] = i; nhan[i] = id;
    let tongR = 0, tongC = 0;
    while(dau < cuoi){
      const j = hang[dau++], r = (j / cols) | 0, c = j % cols;
      tongR += r; tongC += c;
      for(const [a, b] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]){
        if(a < 0 || b < 0 || a >= rows || b >= cols) continue;
        const k = a * cols + b;
        if(luoi[k] && nhan[k] < 0){ nhan[k] = id; hang[cuoi++] = k; }
      }
    }
    coCum.push({ so: cuoi, r: tongR / cuoi, c: tongC / cuoi });
  }
  return { nhan, coCum };
}

function bam(n){ // số giả ngẫu nhiên 0..1 cố định theo n
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// các điểm 3D của đường cong (vạch tuyến nổi trên mặt đường)
function diemTuyen(cong, toaDo){
  const diem = [];
  for(let j = 0; j < cong.n; j++){
    const p = toaDo(0, 0); p.x += cong.x[j]; p.z += cong.y[j]; p.y = 0.06;
    diem.push(p);
  }
  return diem;
}

// Bộ ô tô dạng instanced (thân + cabin), dùng cho cả xe đỗ lẫn xe chạy
function taoBoXe(soLuong){
  const { dai, rong } = KICH_THUOC_XE;
  const than = new THREE.InstancedMesh(new THREE.BoxGeometry(dai, 0.34, rong),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.2 }), soLuong);
  const cabin = new THREE.InstancedMesh(new THREE.BoxGeometry(dai * 0.55, 0.26, rong * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.2, metalness: 0.4 }), soLuong);
  than.castShadow = cabin.castShadow = true;
  return { than, cabin };
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3(),
      _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _x = new THREE.Vector3(1, 0, 0), _z = new THREE.Vector3(0, 0, 1);
// bay (tùy chọn): trạng thái VatBay của xe đang bị húc văng (độ cao, nghiêng, lật, thu nhỏ khi sắp biến mất)
function datXe(bo, k, viTri, goc, mau, an = false, bay = null){
  _q.setFromAxisAngle(_y, goc);
  if(bay){
    _q.multiply(_q2.setFromAxisAngle(_z, bay.pitch)).multiply(_q2.setFromAxisAngle(_x, bay.roll));
  }
  _s.setScalar(an ? 0 : bay ? bay.tiLe : 1);
  const cao = bay ? 0.29 + 0.07 * (1 - Math.cos(bay.roll)) + bay.z : 0.29;
  _p.copy(viTri).setY(cao);
  bo.than.setMatrixAt(k, _m4.compose(_p, _q, _s));
  _p2.set(-0.12, 0.30, 0).applyQuaternion(_q).add(_p);     // cabin nằm lùi 0,12 ô và cao hơn thân 0,30 ô (theo hệ trục của xe)
  bo.cabin.setMatrixAt(k, _m4.compose(_p2, _q, _s));
  if(mau) bo.than.setColorAt(k, new THREE.Color(mau));
}

function dungCanh(bd, kq, gt){
  const { rows, cols, loai, start, goal } = bd;
  const luoi = loai.map(l => l === O.NHA ? 1 : 0);      // chỉ nhà mới gom thành khối cao tầng
  const n = Math.max(rows, cols);
  const thanhPho = rows * cols >= 1600;
  const scene = new THREE.Scene();
  const nen = mauCSS('--bg', '#0d1412');
  scene.background = nen;
  scene.fog = new THREE.Fog(nen, n * 1.3, n * 3.4);

  const toaDo = (r, c) => new THREE.Vector3(c - (cols - 1) / 2, 0, r - (rows - 1) / 2);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x223330, 1.1));
  const nang = new THREE.DirectionalLight(0xffffff, 1.6);
  nang.position.set(n * 0.4, n * 0.9, n * 0.3);
  nang.castShadow = true;
  nang.shadow.mapSize.set(n > 60 ? 4096 : 2048, n > 60 ? 4096 : 2048);
  const nb = n * 0.75;
  Object.assign(nang.shadow.camera, { left: -nb, right: nb, top: nb, bottom: -nb, near: 0.5, far: n * 3 });
  nang.shadow.bias = -0.0005;
  scene.add(nang);

  const san = new THREE.Mesh(
    new THREE.PlaneGeometry(cols + 2, rows + 2),
    new THREE.MeshStandardMaterial({ color: mauCSS('--surface', '#141e1a'), roughness: 0.95 })
  );
  san.rotation.x = -Math.PI / 2;
  san.position.y = -0.02;
  san.receiveShadow = true;
  scene.add(san);

  const { nhan, coCum } = thanhPho ? phanCum(rows, cols, luoi) : { nhan: null, coCum: [] };
  const laNha = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && luoi[r * cols + c] === 1;

  const mauO = mauCSS('--surface-2', '#1b2722');
  const mauViaHe = mauO.clone().lerp(new THREE.Color('#9eada6'), 0.18);
  const mauLan = new THREE.Color('#121716');
  const mauXet = mauO.clone().lerp(mauCSS('--good', '#4fcf8f'), 0.35);
  const mauDuong = mauO.clone().lerp(mauCSS('--accent', '#ff8a5c'), 0.6);

  // Mỗi ô không phải nhà một tấm sàn (InstancedMesh: 1 lần vẽ cho hàng chục nghìn ô).
  // Làn ô tô là mặt nhựa tối, liền nhau; vỉa hè sáng hơn, có khe giữa các viên gạch.
  let soO = 0;
  for(let i = 0; i < rows * cols; i++) if(!luoi[i]) soO++;
  const tam = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.94, 0.04, 0.94),
    new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    Math.max(1, soO)
  );
  tam.count = soO;
  tam.receiveShadow = true;
  const chiSo = new Map(), mauGoc = [];
  const m4 = new THREE.Matrix4();
  let i = 0;
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), co = new THREE.Vector3();
  for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
    if(luoi[r * cols + c]) continue;
    const l = loai[r * cols + c];
    pos.copy(toaDo(r, c)); co.set(1, 1, 1);
    if(laLan(l)) co.set(1 / 0.94, 1, 1 / 0.94);
    tam.setMatrixAt(i, m4.compose(pos, quat, co));
    const viaHe = thanhPho && (laNha(r-1,c) || laNha(r+1,c) || laNha(r,c-1) || laNha(r,c+1) || l === O.DUONG);
    const m = laLan(l) ? mauLan : viaHe ? mauViaHe : mauO;
    tam.setColorAt(i, m);
    mauGoc[i] = m;
    chiSo.set(r + ',' + c, i++);
  }
  scene.add(tam);

  // Vật tĩnh (cây, nón, xe đỗ) bị robot húc thì văng / đổ: mỗi vật có hàm ve(bay) vẽ lại đúng chỗ của nó
  // (bay = null: về vị trí gốc). Tra theo ô để kiểm tra va chạm nhanh.
  const tinh = [], luoiTinh = new Map();
  const g0 = toaDo(0, 0);
  const themTinh = (vat, ve, luoi) => {
    const it = Object.assign(vat, { ve, luoi, bay: null });
    tinh.push(it);
    const kh = Math.round(vat.y) + ',' + Math.round(vat.x);
    if(!luoiTinh.has(kh)) luoiTinh.set(kh, []);
    luoiTinh.get(kh).push(it);
  };
  // Đặt vật nghiêng quanh gốc: gốc ở (x, y), thân dựng lên theo trục đứng cục bộ
  const datNghieng = bay => {
    _q.setFromAxisAngle(_y, bay.yaw).multiply(_q2.setFromAxisAngle(_z, bay.pitch));
    return _p.set(g0.x + bay.x, bay.z, g0.z + bay.y);
  };

  // Nhà / tường, cây, nón, xe đỗ
  const dsNha = [], dsCay = [], dsNon = [], dsXeDo = [];
  for(let j = 0; j < rows * cols; j++){
    const l = loai[j];
    if(l === O.NHA) dsNha.push(j);
    else if(l === O.CAY) dsCay.push(j);
    else if(l === O.NON) dsNon.push(j);
    else if(l === O.XE_DO) dsXeDo.push(j);
  }
  const tuong = new THREE.InstancedMesh(
    new THREE.BoxGeometry(thanhPho ? 1 : 0.98, 1, thanhPho ? 1 : 0.98),   // thành phố: ô liền nhau thành khối nhà
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
    Math.max(1, dsNha.length)
  );
  tuong.castShadow = tuong.receiveShadow = true;
  tuong.count = dsNha.length;
  const bangMau = ['#9eada6', '#8b9b94', '#b8c3be', '#7f8e88', '#a99f93', '#94a3b0'].map(h => new THREE.Color(h));
  dsNha.forEach((j, k) => {
    const r = (j / cols) | 0, c = j % cols;
    let cao = 0.9, mauNha = bangMau[0];
    if(thanhPho){
      const cum = coCum[nhan[j]], id = nhan[j];
      const gan = 1 - Math.min(1, Math.hypot(cum.r - rows / 2, cum.c - cols / 2) / (n * 0.62));
      cao = 1.2 + bam(id) * 2.6 + 9 * gan * gan * (0.5 + bam(id + 7));   // trung tâm có nhà chọc trời
      mauNha = bangMau[Math.floor(bam(id + 3) * bangMau.length)];
    }
    pos.copy(toaDo(r, c)).setY(cao / 2);
    co.set(1, cao, 1);
    tuong.setMatrixAt(k, m4.compose(pos, quat, co));
    tuong.setColorAt(k, mauNha);
  });
  scene.add(tuong);

  // Cây: thân trụ + tán cầu
  if(dsCay.length){
    const than = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.09, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.9 }), dsCay.length);
    const tan = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({ color: 0x3f9d63, roughness: 0.8, flatShading: true }), dsCay.length);
    than.castShadow = tan.castShadow = true;
    dsCay.forEach((j, k) => {
      const r = (j / cols) | 0, c = j % cols, sc = 0.8 + bam(j) * 0.5;
      const ve = bay => {
        co.set(sc, sc, sc);
        if(!bay){ _q.identity(); _p.copy(toaDo(r, c)); }
        else { datNghieng(bay); _p.y += 0.4 * sc * Math.sin(bay.pitch); }
        const goc = _p.clone();
        for(const [mesh, cao] of [[than, 0.3], [tan, 0.85]]){
          pos.set(0, cao * sc, 0).applyQuaternion(_q).add(goc);
          mesh.setMatrixAt(k, m4.compose(pos, _q, co));
        }
      };
      ve(null);
      themTinh({ loai: 'cay', x: c, y: r, ban: 0.42, k }, ve, [than, tan]);
    });
    scene.add(than, tan);
  }

  // Nón giao thông
  if(dsNon.length){
    const non = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 0.5, 16),
      new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 }), dsNon.length);
    non.castShadow = true;
    dsNon.forEach((j, k) => {
      const r = (j / cols) | 0, c = j % cols;
      const ve = bay => {
        if(!bay){ _q.identity(); _p.copy(toaDo(r, c)).setY(0.27); }
        else { datNghieng(bay); _p.y += 0.27 * Math.abs(Math.cos(bay.pitch)) + 0.17 * Math.abs(Math.sin(bay.pitch)); }
        co.set(1, 1, 1);
        non.setMatrixAt(k, m4.compose(_p, _q, co));
      };
      ve(null);
      themTinh({ loai: 'non', x: c, y: r, ban: 0.42, k }, ve, [non]);
    });
    scene.add(non);
  }

  // Ô tô đang đỗ (bãi xe) dùng cùng kiểu thân + cabin với xe chạy
  const xeDo = taoBoXe(Math.max(1, dsXeDo.length));
  xeDo.than.count = xeDo.cabin.count = dsXeDo.length;
  // xe dài ~1,7 ô nên mỗi 2 ô X trên-dưới liền nhau là 1 chỗ đỗ (xe đỗ dọc, đầu quay ra lối đi)
  const laXeDo = (r, c) => r >= 0 && r < rows && loai[r * cols + c] === O.XE_DO;
  dsXeDo.forEach((j, k) => {
    const r = (j / cols) | 0, c = j % cols;
    if(laXeDo(r - 1, c)){ datXe(xeDo, k, toaDo(r, c), 0, null, true); return; }   // đã gộp với ô phía trên
    const doi = laXeDo(r + 1, c), vt = doi ? toaDo(r, c).add(toaDo(r + 1, c)).multiplyScalar(0.5) : toaDo(r, c);
    datXe(xeDo, k, vt, Math.PI / 2, MAU_XE[(r * 7 + c * 13) % MAU_XE.length]);
    const ve = bay => {
      if(bay) datXe(xeDo, k, _p.set(g0.x + bay.x, 0, g0.z + bay.y).clone(), bay.yaw, null, false, bay);
      else datXe(xeDo, k, vt, Math.PI / 2, null);
    };
    themTinh({ loai: 'xe', x: c, y: doi ? r + 0.5 : r, yaw: Math.PI / 2, k }, ve, [xeDo.than, xeDo.cabin]);
  });
  scene.add(xeDo.than, xeDo.cabin);

  // Giao thông động: ô tô, người đi bộ, cột đèn ở các ngã tư
  let dong = null;
  if(gt){
    const xeChay = taoBoXe(Math.max(1, gt.xe.length));
    const thanNguoi = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), Math.max(1, gt.nguoi.length));
    const dauNguoi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xf1c7a0, roughness: 0.7 }), Math.max(1, gt.nguoi.length));
    thanNguoi.castShadow = true;
    gt.nguoi.forEach((ng, k) => thanNguoi.setColorAt(k, new THREE.Color(MAU_NGUOI[ng.mau])));
    // mỗi ngã tư 4 cột đèn ở 4 góc: tây & đông báo đèn chiều ngang, bắc & nam báo đèn chiều dọc
    const coDen = gt.ngaTu.filter(nt => nt.coDen);
    const soDen = coDen.length * 4;
    const cot = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x2b3331 }), Math.max(1, soDen));
    const den = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, soDen));   // đèn tự sáng: màu lấy theo từng cột
    const dsDen = [];
    gt.ngaTu.forEach((nt, id) => {
      if(!nt.coDen) return;                    // ngã tư nhỏ không có đèn
      const goc = [[nt.r0 - 1, nt.c0 - 1, 'ngang'], [nt.r1 + 1, nt.c1 + 1, 'ngang'], [nt.r0 - 1, nt.c1 + 1, 'doc'], [nt.r1 + 1, nt.c0 - 1, 'doc']];
      for(const [r, c, truc] of goc){
        const k = dsDen.length;
        pos.copy(toaDo(r, c)).setY(0.65); co.set(1, 1, 1);
        cot.setMatrixAt(k, m4.compose(pos, quat, co));
        pos.setY(1.38);
        den.setMatrixAt(k, m4.compose(pos, quat, co));
        dsDen.push({ id, truc });
      }
    });
    cot.count = den.count = soDen;
    scene.add(xeChay.than, xeChay.cabin, thanNguoi, dauNguoi, cot, den);
    dong = { xeChay, thanNguoi, dauNguoi, den, dsDen };
  }

  const dem = (mau, p) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 32), new THREE.MeshStandardMaterial({ color: mau, emissive: mau, emissiveIntensity: 0.35 }));
    m.position.copy(p).setY(0.03);
    scene.add(m);
  };
  dem(mauCSS('--good', '#4fcf8f'), toaDo(...start));
  const dich = toaDo(...goal);
  dem(mauCSS('--accent', '#ff8a5c'), dich);
  const coc = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 24), new THREE.MeshStandardMaterial({ color: mauCSS('--accent', '#ff8a5c'), emissive: mauCSS('--accent', '#ff8a5c'), emissiveIntensity: 0.8 }));
  coc.rotation.x = Math.PI;
  coc.position.copy(dich).setY(1.4);
  scene.add(coc);

  // Tuyến đường cong (đã làm mượt) nổi trên mặt đường, vẽ dần theo quãng robot đã đi.
  const cong = kq.goc && kq.goc.length > 1 ? taoDuongCong(kq.goc) : null;
  let vach = null;
  if(cong){
    vach = new THREE.Line(new THREE.BufferGeometry().setFromPoints(diemTuyen(cong, toaDo)),
      new THREE.LineBasicMaterial({ color: mauCSS('--accent', '#ff8a5c') }));
    vach.geometry.setDrawRange(0, 0);
    scene.add(vach);
  }

  return { scene, tam, chiSo, mauGoc, mauXet, mauDuong, coc, vach, cong, toaDo, kichThuoc: n, dong, tinh, luoiTinh };
}

// ---------- camera ----------
function viTriCamera(c, robot, huong, t){
  const n = c.kichThuoc;
  const truoc = new THREE.Vector3(Math.sin(huong), 0, Math.cos(huong));
  const rp = robot.position;
  switch(camHienTai){
    case 'tong-canh':  return { pos: new THREE.Vector3(0, n * 1.15, n * 0.25), nhin: new THREE.Vector3(0, 0, 0) };
    case 'bam-theo':   return { pos: rp.clone().addScaledVector(truoc, -2.4).setY(1.9), nhin: rp.clone().addScaledVector(truoc, 1.6).setY(0.4) };
    case 'mat-robot':  return { pos: rp.clone().addScaledVector(truoc, 0.12).setY(0.82 * TL_ROBOT), nhin: rp.clone().addScaledVector(truoc, 4).setY(0.35) };
    case 'truc-thang': return { pos: rp.clone().addScaledVector(truoc, -4).setY(18), nhin: rp.clone().addScaledVector(truoc, 2) };
    case 'xoay': {
      const a = t * 0.2;
      return { pos: new THREE.Vector3(Math.cos(a) * n * 0.85, n * 0.6, Math.sin(a) * n * 0.85), nhin: new THREE.Vector3(0, 0, 0) };
    }
    default: return { pos: new THREE.Vector3(n * 0.7, n * 0.7, n * 0.75), nhin: new THREE.Vector3(0, 0, 0) };
  }
}

function chonCamera(id){
  camHienTai = id;
  camRow.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.cam === id));
  if(canh){
    canh.dieuKhien.enabled = id === 'tu-do';
    if(id === 'tu-do') canh.dieuKhien.target.copy(canh.nhin);
  }
}

CAMERAS.forEach(cam => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mode-btn';
  b.dataset.cam = cam.id;
  b.innerHTML = `<kbd>${cam.key}</kbd> ${cam.name}`;
  b.addEventListener('click', () => chonCamera(cam.id));
  camRow.appendChild(b);
});

// lò xo – giảm chấn: thân robot nghiêng theo gia tốc rồi dao động nhẹ và tắt dần
function loXo(trangThai, muc, dt, cung = 140, giam = 13){
  trangThai.v += (cung * (muc - trangThai.x) - giam * trangThai.v) * dt;
  trangThai.x += trangThai.v * dt;
  return trangThai.x;
}
const kep = (x, a) => Math.max(-a, Math.min(a, x));

// ---------- mở / đóng ----------
async function moXem3D(){
  if(typeof window.layDuLieu3D !== 'function') return;
  v3d.hidden = false;
  document.body.style.overflow = 'hidden';
  thongTin.textContent = 'Đang chuẩn bị cảnh 3D…';

  const du = await window.layDuLieu3D();      // tự chạy A* nếu chưa chạy
  if(!du){ thongTin.textContent = 'Python (A*) chưa sẵn sàng. Hãy chờ trang nạp xong rồi thử lại.'; return; }
  if(canh) dongCanh();

  const bd = du.banDo;
  const gt = bd.giaoThong ? new GiaoThong(bd.rows, bd.cols, bd.loai, { seed: 1 }) : null;
  const c = dungCanh(bd, du.ketQua, gt);
  const { goc: moHinh, nguon } = await napRobot();
  if(v3d.hidden) return;                      // người dùng đã đóng trong lúc nạp

  // khung (vị trí + hướng) > than (nghiêng, nhún) > mô hình
  const robot = new THREE.Group(), than = new THREE.Group();
  moHinh.scale.multiplyScalar(TL_ROBOT);
  than.add(moHinh); robot.add(than);
  const banh = [];
  moHinh.traverse(o => {
    if(o.isMesh) o.castShadow = true;
    if(/^Banh/.test(o.name)) banh.push(o);
  });
  const p0 = du.ketQua.path[0] || du.banDo.start;
  robot.position.copy(c.toaDo(...p0));
  c.scene.add(robot);
  nguonMoHinh.textContent = 'Mô hình: ' + nguon;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  khung.innerHTML = '';
  khung.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, c.kichThuoc * 8);
  const dieuKhien = new OrbitControls(camera, renderer.domElement);
  dieuKhien.enableDamping = true;
  dieuKhien.maxPolarAngle = Math.PI / 2 - 0.05;

  const coGian = () => {
    const w = khung.clientWidth, h = khung.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(coGian);
  ro.observe(khung);
  coGian();

  const giamChuyenDong = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dx = du.ketQua.explored, dd = du.ketQua.path;
  const tocXet = Math.max(260, dx.length / 2);           // xét xong trong ≤ 2 s
  const tXetXong = giamChuyenDong ? 0 : dx.length / tocXet;
  const daTimThay = dd.length > 0 && c.cong;
  const xe = daTimThay ? new XeRobot(c.cong) : null;
  // bị xe / người đứng yên chặn thì tìm đường vòng (A* trong astar.py, khung nhỏ quanh robot)
  const taoVong = (duong = dd) => xe && gt && typeof window.td === 'function'
    ? new TimDuongVong({ rows: du.banDo.rows, cols: du.banDo.cols, loai: du.banDo.loai, path: duong,
        timAStar: (g, a, b) => Array.from(window.td(g, a, b).dd, p => Array.from(p, Number)) })
    : null;
  let vong = taoVong();
  const doiVach = cong => {      // vẽ lại vạch tuyến theo tuyến mới
    if(!canh.vach) return;
    canh.vach.geometry.dispose();
    canh.vach.geometry = new THREE.BufferGeometry().setFromPoints(diemTuyen(cong, canh.toaDo));
  };

  canh = { ...c, renderer, camera, dieuKhien, ro, robot, raf: 0, t0: performance.now(), daXet: 0, daToDuong: false,
           huong: xe ? xe.huong : 0, nhin: new THREE.Vector3(), xe,
           nghiengDoc: { x: 0, v: 0 }, nghiengNgang: { x: 0, v: 0 },
           tong: { nguoi: 0, xe: 0, vat: 0 }, rung: 0, dangBay: [], rngTinh: taoRng(7),
           hieuUng: [], chop: new THREE.PointLight(0xffaa55, 0, 32), vet: [], hat: [], hatTiep: 0 };
  canh.scene.add(canh.chop);

  // Bật / tắt chế độ húc: tìm lại tuyến từ chỗ robot đang đứng.
  //   húc: chỉ nhà là tường (xe đỗ, nón, cây, làn xe đều đi xuyên được, làn xe không còn tốn thêm chi phí)
  //   thường: như lúc đầu (mọi vật cản là tường, đi làn xe tốn gấp 3)
  canh.datHuc = bat => {
    huc = bat;
    nutHuc.setAttribute('aria-pressed', String(bat));
    nutHuc.classList.toggle('dang-huc', bat);
    vong = bat ? null : taoVong();
    if(!xe || xe.xong || typeof window.td !== 'function') return;
    const { rows, cols, loai } = du.banDo;
    const laTuong0 = l => bat ? l === O.NHA : laVatCan(l);
    const grid = [];
    for(let r = 0; r < rows; r++){
      let h = '';
      for(let cc = 0; cc < cols; cc++){
        const l = loai[r * cols + cc];
        h += laTuong0(l) ? '1' : (!bat && laLan(l)) ? '3' : '0';
      }
      grid.push(h);
    }
    const ra = (v, max) => Math.max(0, Math.min(max, Math.round(v)));
    const tu = [ra(xe.y, rows - 1), ra(xe.x, cols - 1)], dich = du.banDo.goal;
    const moi = Array.from(window.td(grid, tu, dich).dd, p => Array.from(p, Number));
    if(moi.length < 2) return;
    const tren = new Set(moi.map(([r, cc]) => r * cols + cc));
    const laTuong = (r, cc) => r < 0 || cc < 0 || r >= rows || cc >= cols || laTuong0(loai[r * cols + cc])
                             || (!bat && laLan(loai[r * cols + cc]) && !tren.has(r * cols + cc));
    const goc = lamMuotDuong([[xe.y, xe.x], ...moi.slice(1)], laTuong);
    if(goc.length < 2) return;
    const cong = taoDuongCong(goc);
    xe.doiCong(cong, false); doiVach(cong);
    for(const p of cong.oDiQua){ const k = p.join(','); if(canh.chiSo.has(k)) canh.tam.setColorAt(canh.chiSo.get(k), canh.mauDuong); }
    if(!bat) vong = taoVong(moi);
  };
  const dau = viTriCamera(canh, robot, canh.huong, 0);
  camera.position.copy(dau.pos);
  canh.nhin.copy(dau.nhin);
  chonCamera(camHienTai);
  if(huc) canh.datHuc(true);

  // Vụ nổ: quả cầu lửa nở ra + vòng sóng xung kích + chớp sáng + rung camera + hất tung vật tĩnh quanh đó
  const hinhCau = new THREE.SphereGeometry(1, 16, 12), hinhVong = new THREE.TorusGeometry(1, 0.05, 6, 40);
  const hinhVet = new THREE.CircleGeometry(1.9, 24);
  const MAU_MANH = ['#ffd24a', '#ff8a2a', '#ff5a1a', '#3a3330', '#8a8a8a'].map(h => new THREE.Color(h));
  const MAX_MANH = 800;
  const manh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_MANH);
  manh.count = 0; manh.frustumCulled = false;
  canh.scene.add(manh);
  const noTai = (ex, ey) => {
    const g = canh.toaDo(0, 0), vt = new THREE.Vector3(g.x + ex, 0.5, g.z + ey);
    const lua = new THREE.Mesh(hinhCau, new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, depthWrite: false }));
    const vong = new THREE.Mesh(hinhVong, new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, depthWrite: false }));
    lua.position.copy(vt); vong.position.copy(vt).setY(0.15); vong.rotation.x = Math.PI / 2;
    canh.scene.add(lua, vong);
    canh.hieuUng.push({ lua, vong, t: 0 });
    canh.chop.position.copy(vt).setY(2); canh.chop.intensity = 300;
    canh.rung = 1;
    // mảnh vỡ bắn tung tóe
    for(let i = 0; i < 32; i++){
      const a = Math.random() * 6.283, sp = 3 + Math.random() * 10;
      canh.hat.push({ x: vt.x, y: 0.4, z: vt.z, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 10, vz: Math.sin(a) * sp,
                      t: 0, l: 0.9 + Math.random() * 0.9, mau: MAU_MANH[(Math.random() * MAU_MANH.length) | 0] });
    }
    if(canh.hat.length > MAX_MANH) canh.hat.splice(0, canh.hat.length - MAX_MANH);
    // vết cháy xém trên mặt đường (giữ tối đa 40 vết)
    const vet = new THREE.Mesh(hinhVet, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.6, depthWrite: false }));
    vet.rotation.x = -Math.PI / 2; vet.position.copy(vt).setY(0.05);
    canh.scene.add(vet); canh.vet.push(vet);
    if(canh.vet.length > 40){ const cu = canh.vet.shift(); canh.scene.remove(cu); cu.material.dispose(); }
    const r0 = Math.round(ey), c0 = Math.round(ex);
    for(let a = -6; a <= 6; a++) for(let b = -6; b <= 6; b++){
      for(const it of canh.luoiTinh.get((r0 + a) + ',' + (c0 + b)) || []){
        const dx = it.x - ex, dy = it.y - ey, d = Math.hypot(dx, dy);
        if(it.bay || d > 6) continue;
        it.bay = hatVat(it.loai, it, { x: ex, y: ey, vx: dx / (d || 1) * 14, vy: dy / (d || 1) * 14 }, canh.rngTinh);
        if(it.loai === 'xe' && Math.random() < 0.35) it.bay.noSau = 0.5 + Math.random() * 0.9;
        canh.dangBay.push(it); canh.tong.vat++;
      }
    }
  };
  const chayHieuUng = dt => {
    canh.chop.intensity *= Math.exp(-dt * 7);
    canh.hat = canh.hat.filter(p => (p.t += dt) < p.l);
    canh.hat.forEach((p, i) => {
      p.vy -= 18 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if(p.y < 0.05){ p.y = 0.05; p.vy *= -0.4; p.vx *= 0.6; p.vz *= 0.6; }
      _p.set(p.x, p.y, p.z); _s.setScalar(Math.max(0.2, 1 - p.t / p.l) * 1.4);
      manh.setMatrixAt(i, _m4.compose(_p, _q.identity(), _s));
      manh.setColorAt(i, p.mau);
    });
    manh.count = canh.hat.length;
    manh.instanceMatrix.needsUpdate = true;
    if(manh.instanceColor) manh.instanceColor.needsUpdate = true;
    canh.hieuUng = canh.hieuUng.filter(h => {
      h.t += dt;
      h.lua.scale.setScalar(0.4 + h.t * 9); h.lua.material.opacity = Math.max(0, 0.95 - h.t / 0.55);
      h.vong.scale.setScalar(0.5 + h.t * 18); h.vong.material.opacity = Math.max(0, 1 - h.t / 0.45);
      if(h.t < 0.6) return true;
      canh.scene.remove(h.lua, h.vong); h.lua.material.dispose(); h.vong.material.dispose();
      return false;
    });
  };

  // vật bay (người / xe bị hất) đâm vào cây, nón, xe đỗ thì hất luôn; xe đỗ bị đâm có thể bốc cháy rồi nổ
  const tinhDap = (b, r) => {
    if(b.dat || b.z > 1.2 || Math.hypot(b.vx, b.vy) < 3) return;
    const r0 = Math.round(b.y), c0 = Math.round(b.x), rb = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
    for(let a = -1; a <= 1; a++) for(let d = -1; d <= 1; d++){
      for(const it of canh.luoiTinh.get((r0 + a) + ',' + (c0 + d)) || []){
        if(it.bay) continue;
        const dx = b.x - it.x, dy = b.y - it.y;
        if(it.loai === 'xe' ? !(Math.abs(dx) < 0.4 + r && Math.abs(dy) < 0.85 + r) : Math.hypot(dx, dy) > it.ban - 0.2 + r) continue;
        it.bay = hatVat(it.loai, it, rb, canh.rngTinh);
        if(it.loai === 'xe' && Math.random() < 0.4) it.bay.noSau = 0.5 + Math.random() * 0.9;
        canh.dangBay.push(it); canh.tong.vat++;
      }
    }
  };

  let dongHo = new THREE.Clock();

  const khungHinh = () => {
    canh.raf = requestAnimationFrame(khungHinh);
    const dt = Math.min(dongHo.getDelta(), 0.1);
    const t = (performance.now() - canh.t0) / 1000;

    // 1) các ô A* đã xét sáng dần
    const can = giamChuyenDong ? dx.length : Math.min(dx.length, Math.floor(t * tocXet));
    for(; canh.daXet < can; canh.daXet++){
      const k = dx[canh.daXet].join(',');
      if(canh.chiSo.has(k)){
        const j = canh.chiSo.get(k);   // phủ xanh nhẹ lên màu gốc để làn đường vẫn tối, vỉa hè vẫn sáng
        canh.tam.setColorAt(j, _mauTam.copy(canh.mauGoc[j]).lerp(canh.mauXet, 0.45));
      }
    }

    // 1b) giao thông chạy suốt, kể cả lúc robot chưa đi
    if(gt){
      // chế độ húc: xe và người không thấy robot (không nhường, không né) nên bị tông
      gt.buoc(dt, huc ? null : { x: robot.position.x - canh.toaDo(0, 0).x, y: robot.position.z - canh.toaDo(0, 0).z,
                    vx: xe ? xe.v * Math.sin(xe.huong) : 0, vy: xe ? xe.v * Math.cos(xe.huong) : 0 });
      const { xeChay, thanNguoi, dauNguoi, den, dsDen } = c.dong;
      const goc0 = canh.toaDo(0, 0);
      gt.xe.forEach((k, j) => datXe(xeChay, j, _p.set(goc0.x + k.x, 0, goc0.z + k.y).clone(), k.bay ? k.bay.yaw : Math.atan2(-k.hy, k.hx),
                                     j < canh.daMauXe ? null : MAU_XE[k.mau], k.an, k.bay));
      canh.daMauXe = gt.xe.length;
      xeChay.than.instanceMatrix.needsUpdate = xeChay.cabin.instanceMatrix.needsUpdate = true;
      if(xeChay.than.instanceColor) xeChay.than.instanceColor.needsUpdate = true;
      gt.nguoi.forEach((ng, j) => {
        if(ng.bay){                      // bị tông: văng lên, lộn vòng, nằm đất rồi thu nhỏ biến mất
          const b = ng.bay;
          _q.setFromAxisAngle(_y, b.yaw).multiply(_q2.setFromAxisAngle(_z, b.pitch));
          _s.setScalar(b.tiLe);
          _p.set(goc0.x + b.x, 0.25 * Math.abs(Math.cos(b.pitch)) + 0.1 * Math.abs(Math.sin(b.pitch)) + b.z, goc0.z + b.y);
          thanNguoi.setMatrixAt(j, _m4.compose(_p, _q, _s));
          _p2.set(0, 0.35, 0).applyQuaternion(_q).add(_p);
          dauNguoi.setMatrixAt(j, _m4.compose(_p2, _q, _s));
          return;
        }
        const nhun = (ng.vx || ng.vy) ? Math.abs(Math.sin(t * 9 + j)) * 0.04 : 0;
        _m4.makeTranslation(goc0.x + ng.x, 0.25 + nhun, goc0.z + ng.y); thanNguoi.setMatrixAt(j, _m4);
        _m4.makeTranslation(goc0.x + ng.x, 0.6 + nhun, goc0.z + ng.y); dauNguoi.setMatrixAt(j, _m4);
      });
      thanNguoi.instanceMatrix.needsUpdate = dauNguoi.instanceMatrix.needsUpdate = true;
      dsDen.forEach((d, j) => den.setColorAt(j, gt.den(d.id, d.truc) === 'xanh' ? MAU_DEN_XANH : MAU_DEN_DO));
      if(den.instanceColor) den.instanceColor.needsUpdate = true;
      for(const e of gt.sk) if(e.loai === 'no') noTai(e.x, e.y);     // vụ nổ do xe bị tông bốc cháy
      gt.sk.length = 0;
      if(huc){
        for(const a of gt.xe) if(a.bay) tinhDap(a.bay, 0.8);
        for(const a of gt.nguoi) if(a.bay) tinhDap(a.bay, 0.3);
      }
    }
    chayHieuUng(dt);

    // 2) xét xong: tô tuyến, rồi robot chạy theo mô phỏng vật lý
    if(xe && t >= tXetXong){
      if(!canh.daToDuong){
        for(const p of c.cong.oDiQua){ const k = p.join(','); if(canh.chiSo.has(k)) canh.tam.setColorAt(canh.chiSo.get(k), canh.mauDuong); }
        canh.daToDuong = true;
      }
      const vatCan = gt && !huc ? gt.chuongNgai(xe.x, xe.y, 30) : null;    // húc: không thấy vật cản động nào, cứ chạy thẳng
      xe.buoc(dt, layTocDo() * (huc ? 1.35 : 1), vatCan);       // húc: tăng áp 35%
      const moi = vong && !xe.xong ? vong.thu(xe, vatCan) : null;
      if(moi){
        xe.doiCong(moi); doiVach(moi);
        for(const p of moi.oDiQua){ const k = p.join(','); if(canh.chiSo.has(k)) canh.tam.setColorAt(canh.chiSo.get(k), canh.mauDuong); }
      }
      robot.position.copy(canh.toaDo(0, 0)).add(new THREE.Vector3(xe.x, 0, xe.y));
      canh.huong = xe.huong;
      if(canh.vach) canh.vach.geometry.setDrawRange(0, xe.i + 2);
      for(const b of banh) b.rotateY(-xe.v * dt / BAN_KINH_BANH);

      // chế độ húc: tông người, ô tô, xe đỗ, nón, cây trên đường đi
      if(huc && xe.v > 0.5){
        const rb = { x: xe.x, y: xe.y, vx: xe.v * Math.sin(xe.huong), vy: xe.v * Math.cos(xe.huong) };
        let trung = 0;
        if(gt){ const kq = gt.vaCham(rb); canh.tong.nguoi += kq.nguoi; canh.tong.xe += kq.xe; trung += kq.nguoi + kq.xe; }
        const r0 = Math.round(rb.y), c0 = Math.round(rb.x);
        for(let a = -2; a <= 2; a++) for(let b = -2; b <= 2; b++){
          for(const it of canh.luoiTinh.get((r0 + a) + ',' + (c0 + b)) || []){
            if(it.bay) continue;
            const ddx = rb.x - it.x, ddy = rb.y - it.y;
            const trungVat = it.loai === 'xe' ? Math.abs(ddx) < 0.62 && Math.abs(ddy) < 1.07    // thân xe đỗ dọc: 0,8 × 1,7 ô, cộng bán kính robot
                                              : Math.hypot(ddx, ddy) < it.ban;
            if(!trungVat) continue;
            it.bay = hatVat(it.loai, it, rb, canh.rngTinh);
            if(it.loai === 'xe' && Math.random() < (xe.v > 10 ? 0.5 : 0.15)) it.bay.noSau = 0.5 + Math.random() * 0.9;
            canh.dangBay.push(it);
            canh.tong.vat++; trung++;
          }
        }
        if(trung) canh.rung = Math.min(1, canh.rung + 0.35 + xe.v * 0.02);
      }
    }
    // vật tĩnh đang bị hất: bay / đổ theo vật lý, nằm im rồi thôi cập nhật
    if(canh.dangBay.length){
      canh.dangBay = canh.dangBay.filter(it => {
        it.bay.buoc(dt);
        const b = it.bay;
        if(b.noSau !== undefined && b.t >= b.noSau){        // xe đỗ bốc cháy: nổ, sóng xung kích lan tiếp
          b.noSau = undefined; b.tSong = b.t + 0.05;
          if(gt) gt.noTai(b.x, b.y); else noTai(b.x, b.y);
        }
        it.ve(it.bay);
        for(const m of it.luoi) m.instanceMatrix.needsUpdate = true;
        return !(it.bay.dat && it.bay.t > 2.5);
      });
    }
    canh.rung = Math.max(0, canh.rung - dt * 2.5);
    if(canh.tam.instanceColor) canh.tam.instanceColor.needsUpdate = true;

    // 3) thân nghiêng theo quán tính: tăng tốc thì ngả ra sau, phanh thì chúi tới, vào cua thì nghiêng ra ngoài
    const aDoc = xe ? xe.aDoc : 0, aNgang = xe ? xe.aNgang : 0, v = xe ? xe.v : 0;
    than.rotation.x = loXo(canh.nghiengDoc, kep(-aDoc * 0.011, 0.24), dt);
    than.rotation.z = loXo(canh.nghiengNgang, kep(-aNgang * 0.012, 0.2), dt);
    than.position.y = Math.abs(Math.sin(t * 22)) * 0.012 * Math.min(1, v / 8);
    robot.rotation.y = canh.huong;
    robot.visible = camHienTai !== 'mat-robot';      // ẩn thân robot khi nhìn bằng mắt robot
    canh.coc.position.y = 1.4 + Math.sin(t * 3) * 0.12;
    canh.coc.rotation.y = t;

    // 4) camera
    if(camHienTai === 'tu-do'){
      dieuKhien.update();
    } else {
      const muc = viTriCamera(canh, robot, canh.huong, t);
      // Mắt robot gắn chặt vào đầu robot (không trễ), các góc khác lướt mượt tới vị trí mới.
      const k = camHienTai === 'mat-robot' ? 1 : 1 - Math.exp(-dt * 4);
      camera.position.lerp(muc.pos, k);
      canh.nhin.lerp(muc.nhin, k);
      camera.lookAt(canh.nhin);
    }
    if(canh.rung > 0) camera.position.add(_p.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(canh.rung * 0.25));   // rung khi tông

    thongTin.innerHTML = !daTimThay
      ? `Không có đường tới điểm giao — đã xét ${dx.length} ô.`
      : t < tXetXong ? `A* đang xét ô… ${canh.daXet}/${dx.length}`
      : `<span class="v3d-hud"><span>Tốc độ <b>${v.toFixed(1)}</b> / ${layTocDo()} ô/s</span>`
        + `<span>Gia tốc <b>${aDoc >= 0 ? '+' : ''}${aDoc.toFixed(1)}</b> ô/s²</span>`
        + `<span>Quãng đường <b>${xe.daDi.toFixed(0)}</b> / ${xe.tongDuong.toFixed(0)} ô</span>`
        + `<span>${xe.xong ? `<b>Đã giao</b> sau ${xe.t.toFixed(1)} s` : `Thời gian <b>${xe.t.toFixed(1)}</b> s`}</span>`
        + (huc ? `<span class="v3d-huc">💥 <b>HÚC</b> · tông ${canh.tong.nguoi} người, ${canh.tong.xe} ô tô, ${canh.tong.vat} vật</span>`
          + `<span class="v3d-huc">⛓ dây chuyền <b>${gt ? gt.day : 0}</b> · 🔥 nổ <b>${gt ? gt.noTong : 0}</b></span>`
        : gt ? `<span>${xe.dangCho ? '<b>Đang nhường đường</b>' : 'Nhường đường'} ${xe.soLanNhuong} lần</span>`
              + `<span>Đi vòng <b>${xe.soLanVong}</b> lần</span>` : '')
        + `</span>`;

    renderer.render(canh.scene, camera);
  };
  khungHinh();

  canh.chayLai = () => {
    canh.t0 = performance.now();
    canh.daXet = 0; canh.daToDuong = false;
    canh.mauGoc.forEach((m, j) => canh.tam.setColorAt(j, m));
    if(canh.vach) canh.vach.geometry.setDrawRange(0, 0);
    if(xe){ xe.datLai(); canh.huong = xe.huong; doiVach(xe.cong); vong = taoVong(); }
    robot.position.copy(canh.toaDo(...p0));
    canh.tong = { nguoi: 0, xe: 0, vat: 0 }; canh.rung = 0; canh.dangBay = [];
    for(const v of canh.vet) { canh.scene.remove(v); v.material.dispose(); }
    canh.vet = []; canh.hat = [];
    if(gt){ gt.day = 0; gt.noTong = 0; }
    for(const it of canh.tinh){ it.bay = null; it.ve(null); for(const m of it.luoi) m.instanceMatrix.needsUpdate = true; }   // dựng lại cây, nón, xe đỗ
    if(huc) canh.datHuc(true);       // chế độ húc còn bật: tính lại tuyến húc từ điểm xuất phát
    dongHo = new THREE.Clock();
  };
}

function dongCanh(){
  if(!canh) return;
  cancelAnimationFrame(canh.raf);
  canh.ro.disconnect();
  canh.dieuKhien.dispose();
  canh.scene.traverse(o => {
    if(o.geometry) o.geometry.dispose();
    if(o.material) [].concat(o.material).forEach(m => m.dispose());
  });
  canh.renderer.dispose();
  canh.renderer.domElement.remove();
  canh = null;
}

function dongXem3D(){
  v3d.hidden = true;
  document.body.style.overflow = '';
  dongCanh();
}

document.getElementById('btn-3d').addEventListener('click', moXem3D);
document.getElementById('v3d-close').addEventListener('click', dongXem3D);
document.getElementById('v3d-replay').addEventListener('click', () => canh?.chayLai());
nutHuc.addEventListener('click', () => canh?.datHuc(!huc));
document.addEventListener('keydown', e => {
  if(v3d.hidden) return;
  if(e.key === 'Escape') return dongXem3D();
  if(e.target.matches?.('input, select, textarea')) return;   // đang gõ tốc độ thì không bắt phím tắt
  if(e.key === 'r' || e.key === 'R') return canh?.chayLai();
  if(e.key === 'b' || e.key === 'B') return canh?.datHuc(!huc);
  const cam = CAMERAS.find(x => x.key === e.key);
  if(cam) chonCamera(cam.id);
});
