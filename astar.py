from browser import *
def day_vao(hd, pt):
    hd.append(pt)
    i = len(hd) - 1
    while i > 0:
        cha = (i - 1) // 2
        if hd[cha] <= hd[i]:
            break
        hd[cha], hd[i] = hd[i], hd[cha]
        i = cha


def lay_ra(hd):
    dau = hd[0]
    cuoi = hd.pop()
    if hd:
        hd[0] = cuoi
        i = 0
        n = len(hd)
        while True:
            t = 2 * i + 1
            if t >= n:
                break
            if t + 1 < n and hd[t + 1] < hd[t]:
                t += 1
            if hd[i] <= hd[t]:
                break
            hd[i], hd[t] = hd[t], hd[i]
            i = t
    return dau


def kc(o1, o2):
    return abs(o1[0] - o2[0]) + abs(o1[1] - o2[1])
def td(bd, xp, dc):
    sh = len(bd)
    sc = len(bd[0])

    stt = 0
    cx = [(kc(xp, dc), kc(xp, dc), stt, xp)]
    g = {xp: 0}
    ot = {}
    dax = set()
    dx = []

    while cx:
        f, h, _, ht = lay_ra(cx)
        if ht in dax:
            continue
        dax.add(ht)
        dx.append(ht)

        if ht == dc:
            dd = [ht]
            while ht in ot:
                ht = ot[ht]
                dd.append(ht)
            dd.reverse()
            return dd, dx

        hg = ht[0]
        ct = ht[1]
        oxq = [
            (hg - 1, ct),
            (hg + 1, ct),
            (hg, ct - 1),
            (hg, ct + 1),
        ]

        for o in oxq:
            h = o[0]
            c = o[1]
            if h < 0 or h >= sh or c < 0 or c >= sc:
                continue
            cp = bd[h][c]
            if cp == 0:
                continue
            if o in dax:
                continue

            gm = g[ht] + cp
            if o in g and gm >= g[o]:
                continue

            ot[o] = ht
            g[o] = gm
            hm = kc(o, dc)
            stt += 1
            day_vao(cx, (gm + hm, hm, stt, o))

    return [], dx


def td_web(bd, xp, dc):
    t0 = window.performance.now()

    cp = {"1": 0, "3": 3}
    bdp = []
    for hg in bd:
        bdp.append([cp.get(ch, 1) for ch in str(hg)])
    xp = (int(xp[0]), int(xp[1]))
    dc = (int(dc[0]), int(dc[1]))
    dd, dx = td(bdp, xp, dc)
    kq = {}
    kq["dd"] = [[o[0], o[1]] for o in dd]
    kq["dx"] = [[o[0], o[1]] for o in dx]
    kq["tg"] = window.performance.now() - t0
    return kq
window.td = td_web
