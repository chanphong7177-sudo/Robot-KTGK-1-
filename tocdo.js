// Thanh tốc độ dùng chung cho lưới 2D và cửa sổ 3D.
// Mỗi khối có class "toc-do" chứa một input range và một input number;
// kéo thanh hay gõ số ở bất kỳ khối nào thì mọi khối khác đều cập nhật theo.
export const TOC_DO_MIN = 10;
export const TOC_DO_MAX = 40;
const KHOA_LUU = 'muhahah-toc-do';

let tocDo = 20;
try {
  const daLuu = Number(localStorage.getItem(KHOA_LUU));
  if(daLuu >= TOC_DO_MIN && daLuu <= TOC_DO_MAX) tocDo = daLuu;
} catch(e) { /* trình duyệt chặn localStorage: dùng mặc định */ }

const nguoiNghe = new Set();

export function layTocDo(){ return tocDo; }
export function khiDoiTocDo(fn){ nguoiNghe.add(fn); return () => nguoiNghe.delete(fn); }

export function datTocDo(v){
  v = Math.round(Number(v));
  if(!Number.isFinite(v)) return false;
  v = Math.min(TOC_DO_MAX, Math.max(TOC_DO_MIN, v));
  tocDo = v;
  try { localStorage.setItem(KHOA_LUU, String(v)); } catch(e) {}
  dongBo();
  nguoiNghe.forEach(fn => fn(v));
  return true;
}

function dongBo(){
  document.querySelectorAll('.toc-do').forEach(k => {
    const range = k.querySelector('input[type=range]');
    const so = k.querySelector('input[type=number]');
    if(range) range.value = tocDo;
    if(so && document.activeElement !== so) so.value = tocDo;
    k.style.setProperty('--phan-tram', ((tocDo - TOC_DO_MIN) / (TOC_DO_MAX - TOC_DO_MIN) * 100) + '%');
    const loi = k.querySelector('.toc-do-loi');
    if(loi) loi.textContent = '';
    if(so) so.classList.remove('invalid');
  });
}

export function ganThanhTocDo(khoi){
  const range = khoi.querySelector('input[type=range]');
  const so = khoi.querySelector('input[type=number]');
  const loi = khoi.querySelector('.toc-do-loi');
  for(const el of [range, so]){
    if(!el) continue;
    el.min = TOC_DO_MIN; el.max = TOC_DO_MAX; el.step = 1;
  }
  range?.addEventListener('input', () => datTocDo(range.value));
  so?.addEventListener('input', () => {
    // Đang gõ: chỉ áp dụng khi số hợp lệ, còn không thì báo lỗi nhưng chưa sửa giúp
    const v = Number(so.value);
    const hopLe = so.value !== '' && Number.isFinite(v) && v >= TOC_DO_MIN && v <= TOC_DO_MAX;
    so.classList.toggle('invalid', !hopLe);
    if(loi) loi.textContent = hopLe ? '' : `Chỉ nhập từ ${TOC_DO_MIN} đến ${TOC_DO_MAX}`;
    if(hopLe) datTocDo(v);
  });
  so?.addEventListener('change', () => datTocDo(so.value === '' ? tocDo : so.value));
  so?.addEventListener('blur', () => { so.value = tocDo; so.classList.remove('invalid'); if(loi) loi.textContent = ''; });
  dongBo();
}

document.querySelectorAll('.toc-do').forEach(ganThanhTocDo);
