"""
Tạo mô hình robot 3D trong Blender rồi xuất ra robot.glb cho trang web.

Cách chạy (chọn một):
    1) Nhấp đúp tao_robot_3d.bat          (tự tìm blender.exe)
    2) blender --background --python tao_robot_blender.py
    3) Mở Blender > tab Scripting > Open file này > Run Script

Kết quả, nằm cạnh file này:
    robot.glb    -> trang web nạp file này khi bấm "Xem trong 3D"
    robot.blend  -> mở bằng Blender để chỉnh sửa tiếp rồi chạy lại script

Quy ước để khớp với web (three.js):
    - Đơn vị: 1 = 1 ô lưới. Robot cao khoảng 1.0, gốc tọa độ ở giữa đáy.
    - Mặt trước robot hướng về -Y trong Blender (khi xuất glTF sẽ thành +Z).
"""
import math
import os
import sys

import bpy

# ---------- cấu hình ----------
TEN_FILE_GLB = "robot.glb"
TEN_FILE_BLEND = "robot.blend"

MAU_THAN = "#edf2ef"     # trắng ngà, giống --fg của trang
MAU_NHAN = "#ff8a5c"     # cam, giống --accent
MAU_TOI = "#1b2722"      # xanh đen, giống --surface-2
MAU_BANH = "#263530"


def thu_muc_xuat():
    """Ưu tiên đường dẫn sau dấu --, sau đó là thư mục chứa script."""
    if "--" in sys.argv:
        sau = sys.argv[sys.argv.index("--") + 1:]
        if sau:
            return os.path.abspath(sau[0])
    try:
        d = os.path.dirname(os.path.abspath(__file__))
        if os.path.isdir(d):
            return d
    except NameError:
        pass
    if bpy.data.filepath:
        return os.path.dirname(bpy.data.filepath)
    return os.getcwd()


def hex_sang_linear(h):
    """Blender dùng màu linear, còn mã màu web là sRGB."""
    h = h.lstrip("#")
    kq = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        kq.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*kq, 1.0)


def vat_lieu(ten, mau, kim_loai=0.0, nham=0.5, phat_sang=0.0):
    m = bpy.data.materials.new(ten)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_sang_linear(mau)
    bsdf.inputs["Metallic"].default_value = kim_loai
    bsdf.inputs["Roughness"].default_value = nham
    if phat_sang > 0:
        # Blender 4.x đổi tên "Emission" thành "Emission Color"
        khoa = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
        bsdf.inputs[khoa].default_value = hex_sang_linear(mau)
        bsdf.inputs["Emission Strength"].default_value = phat_sang
    return m


def gan(obj, ten, mat, goc, smooth=True):
    obj.name = ten
    obj.data.materials.append(mat)
    obj.parent = goc
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def hop_bo_tron(ten, kich_thuoc, vi_tri, mat, goc, bo=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vi_tri)
    o = bpy.context.active_object
    o.scale = kich_thuoc
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    md = o.modifiers.new("Bevel", "BEVEL")
    md.width = bo
    md.segments = 4
    return gan(o, ten, mat, goc, smooth=False)


def cau(ten, r, vi_tri, mat, goc):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=vi_tri, segments=32, ring_count=16)
    return gan(bpy.context.active_object, ten, mat, goc)


def tru(ten, r, cao, vi_tri, mat, goc, xoay=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=cao, location=vi_tri, rotation=xoay, vertices=32)
    return gan(bpy.context.active_object, ten, mat, goc)


def tao_robot():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    m_than = vat_lieu("Than", MAU_THAN, nham=0.35)
    m_nhan = vat_lieu("Nhan", MAU_NHAN, nham=0.4)
    m_den = vat_lieu("Den", MAU_NHAN, phat_sang=3.0)
    m_toi = vat_lieu("Toi", MAU_TOI, kim_loai=0.3, nham=0.5)
    m_banh = vat_lieu("Banh", MAU_BANH, nham=0.8)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    goc = bpy.context.active_object
    goc.name = "Robot"

    # đế + 4 bánh
    hop_bo_tron("De", (0.60, 0.50, 0.08), (0, 0, 0.14), m_toi, goc, bo=0.03)
    for x in (-0.27, 0.27):
        for y in (-0.16, 0.16):
            tru("Banh", 0.085, 0.07, (x, y, 0.085), m_banh, goc, xoay=(0, math.pi / 2, 0))

    # thân + khoang chứa đồ (2 ngăn, mặt trước)
    hop_bo_tron("Than", (0.54, 0.44, 0.40), (0, 0, 0.38), m_than, goc, bo=0.06)
    hop_bo_tron("Khoang_tren", (0.40, 0.03, 0.12), (0, -0.215, 0.44), m_toi, goc, bo=0.015)
    hop_bo_tron("Khoang_duoi", (0.40, 0.03, 0.12), (0, -0.215, 0.30), m_toi, goc, bo=0.015)
    hop_bo_tron("Vien_khoang", (0.30, 0.035, 0.012), (0, -0.22, 0.37), m_nhan, goc, bo=0.004)

    # tay
    for s in (-1, 1):
        tru("Tay", 0.025, 0.22, (s * 0.31, -0.02, 0.42), m_than, goc, xoay=(0, s * math.radians(35), 0))

    # cổ + đầu + mắt + miệng
    tru("Co", 0.035, 0.08, (0, 0, 0.61), m_toi, goc)
    cau("Dau", 0.17, (0, 0, 0.78), m_than, goc)
    for x in (-0.06, 0.06):
        cau("Mat", 0.028, (x, -0.15, 0.80), m_den, goc)
    tru("Mieng", 0.008, 0.08, (0, -0.16, 0.73), m_toi, goc, xoay=(0, math.pi / 2, 0))

    # ăng-ten + đèn LIDAR
    tru("Ang_ten", 0.01, 0.10, (0, 0, 0.99), m_toi, goc)
    cau("Den_LIDAR", 0.03, (0, 0, 1.05), m_den, goc)

    # đèn + camera để xem trước trong Blender (không xuất ra glb)
    bpy.ops.object.light_add(type="AREA", location=(1.2, -1.5, 2.0))
    bpy.context.active_object.data.energy = 300
    bpy.ops.object.camera_add(location=(1.6, -2.2, 1.3), rotation=(math.radians(72), 0, math.radians(36)))
    bpy.context.scene.camera = bpy.context.active_object
    return goc


def xuat(goc):
    thu_muc = thu_muc_xuat()
    duong_glb = os.path.join(thu_muc, TEN_FILE_GLB)
    duong_blend = os.path.join(thu_muc, TEN_FILE_BLEND)

    bpy.ops.object.select_all(action="DESELECT")
    goc.select_set(True)
    for con in goc.children:
        con.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=duong_glb,
        export_format="GLB",
        use_selection=True,
        export_apply=True,   # áp dụng modifier bo góc trước khi xuất
        export_yup=True,
    )
    bpy.ops.wm.save_as_mainfile(filepath=duong_blend)
    print("Đã xuất:", duong_glb)
    print("Đã lưu :", duong_blend)


if __name__ == "__main__":
    xuat(tao_robot())
