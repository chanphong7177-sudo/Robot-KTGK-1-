// Chế độ "Húc" (phím B): vật bị robot tông thì văng lên, xoay tròn, rơi, nảy rồi nằm im.
// Dùng chung cho người, ô tô (chạy hoặc đỗ), nón và cây. Tọa độ lưới: x = cột, y = hàng, z = độ cao (ô).
// Cách xoay (khớp xem3d.js): yaw quanh trục đứng, pitch nghiêng về phía văng, roll lăn quanh thân xe.
const NUA_PI = Math.PI / 2;
const TRONG_LUC = 18;

// co + heSo·v = tốc độ văng ngang (ô/s, v = tốc độ robot), toiDa chặn trên; vz = tốc độ bay lên
const CAU_HINH = {
  nguoi: { co: 2, heSo: 0.5, toiDa: 16, vz: 3.5, heSoZ: 0.2, toiDaZ: 9, tSong: 2.8, maSat: 4, nay: 0.3 },
  xe:    { co: 1, heSo: 0.3, toiDa: 10, vz: 1.5, heSoZ: 0.1, toiDaZ: 5, tSong: 3.4, maSat: 2.2, nay: 0.3 },
  non:   { co: 3, heSo: 0.6, toiDa: 18, vz: 3, heSoZ: 0.25, toiDaZ: 10, tSong: Infinity, maSat: 3, nay: 0.45 },
};

export class VatBay {
  constructor(o){
    Object.assign(this, { loai: 'nguoi', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, wYaw: 0, roll: 0, wRoll: 0,
      pitch: 0, wPitch: 0, t: 0, dat: false, nay: 0.3, maSat: 3, tSong: Infinity }, o);
  }

  get het(){ return this.t >= this.tSong; }
  // 1 → 0 trong 0,5 s cuối đời: vật thu nhỏ rồi biến mất (xe / người hồi sinh sau đó)
  get tiLe(){ return this.t < this.tSong - 0.5 ? 1 : Math.max(0, (this.tSong - this.t) / 0.5); }

  buoc(dt){
    this.t += dt;
    if(this.loai === 'cay'){            // cây đổ dần như bản lề ở gốc, không bay
      if(!this.dat){
        this.wPitch += 9 * dt;
        this.pitch += this.wPitch * dt;
        if(this.pitch >= NUA_PI){ this.pitch = NUA_PI; this.dat = true; }
      }
      return;
    }
    this.vz -= TRONG_LUC * dt;
    this.z += this.vz * dt;
    if(this.z <= 0){
      this.z = 0;
      if(this.vz < -1.5){               // nảy lên, mất bớt năng lượng
        this.vz = -this.vz * this.nay;
        this.vx *= 0.75; this.vy *= 0.75; this.wYaw *= 0.7; this.wRoll *= 0.7; this.wPitch *= 0.7;
      } else { this.vz = 0; this.dat = true; }
    }
    if(this.dat){                        // nằm trên đất: ma sát, rồi nằm ngang / lật nghiêng cho vững
      const k = Math.exp(-this.maSat * 2 * dt), s = Math.min(1, 10 * dt);
      this.vx *= k; this.vy *= k; this.wYaw *= k; this.wRoll *= k; this.wPitch *= k;
      if(this.loai === 'xe'){
        this.roll += (Math.round(this.roll / NUA_PI) * NUA_PI - this.roll) * s;
        this.pitch += -this.pitch * s;
      } else {
        this.pitch += ((Math.round(this.pitch / Math.PI - 0.5) + 0.5) * Math.PI - this.pitch) * s;
      }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.yaw += this.wYaw * dt; this.roll += this.wRoll * dt; this.pitch += this.wPitch * dt;
  }
}

// Tạo trạng thái văng cho vật `vt` ({x, y, vx?, vy?, yaw?}) bị robot rb ({x, y, vx, vy}) tông.
// loai: 'nguoi' | 'xe' | 'non' | 'cay'. rng: hàm 0..1.
export function hatVat(loai, vt, rb, rng){
  const v = Math.hypot(rb.vx, rb.vy);
  let hx = vt.x - rb.x, hy = vt.y - rb.y;
  const d = Math.hypot(hx, hy) || 1; hx /= d; hy /= d;
  if(v > 0.5){                           // văng theo hướng robot đang chạy, hơi lệch ra khỏi tâm vật
    const ax = rb.vx / v + hx * 0.6, ay = rb.vy / v + hy * 0.6, l = Math.hypot(ax, ay) || 1;
    hx = ax / l; hy = ay / l;
  }
  if(loai === 'cay') return new VatBay({ loai, x: vt.x, y: vt.y, yaw: Math.atan2(hy, -hx) });

  const c = CAU_HINH[loai], dau = () => rng() < 0.5 ? -1 : 1;
  const hs = Math.min(c.toiDa, c.co + v * c.heSo);
  const o = { loai, x: vt.x, y: vt.y, vx: hx * hs + (vt.vx || 0) * 0.6, vy: hy * hs + (vt.vy || 0) * 0.6,
              vz: Math.min(c.toiDaZ, c.vz + v * c.heSoZ), tSong: c.tSong, maSat: c.maSat, nay: c.nay };
  if(loai === 'xe'){
    Object.assign(o, { yaw: vt.yaw || 0, wYaw: dau() * (2 + rng() * 5), wRoll: dau() * (3 + rng() * 5) });
  } else {
    Object.assign(o, { yaw: Math.atan2(hy, -hx), wPitch: dau() * (loai === 'non' ? 10 + rng() * 10 : 7 + rng() * 7) });
  }
  return new VatBay(o);
}
