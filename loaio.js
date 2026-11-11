// Các loại ô trên bản đồ (dùng chung cho mọi file).
// Ký tự trong ô nhập bản đồ:  0 đường/vỉa hè · 1 nhà · S xuất phát · G điểm giao
//   N làn xe ngang · D làn xe dọc · + ngã tư · X ô tô đang đỗ · C nón giao thông · T cây
export const O = { DUONG: 0, NHA: 1, LAN_NGANG: 2, LAN_DOC: 3, NGA_TU: 4, XE_DO: 5, NON: 6, CAY: 7 };
export const KY_TU = ['0', '1', 'N', 'D', '+', 'X', 'C', 'T'];
export const TU_KY_TU = { '0': 0, '1': 1, 'N': 2, 'D': 3, '+': 4, 'X': 5, 'C': 6, 'T': 7 };

export const laVatCan = l => l === O.NHA || l >= O.XE_DO;          // robot không đi qua được
export const laLan = l => l >= O.LAN_NGANG && l <= O.NGA_TU;        // làn ô tô: robot đi được nhưng tránh
export const laNgang = l => l === O.LAN_NGANG || l === O.NGA_TU;
export const laDoc = l => l === O.LAN_DOC || l === O.NGA_TU;
export const CHI_PHI_LAN = 3;   // A*: đi 1 ô làn xe "đắt" bằng 3 ô vỉa hè, nên robot chỉ băng qua đường khi cần
