#!/usr/bin/env python3
"""產生 data.js、overlay.webp（對位後的官網導覽圖）、map.jpg（官網原圖）。

官網導覽圖（20260730 導覽圖 DM 第 1 頁）是手繪示意圖，不按比例：
真實園區是沿海岸山坡、東邊（台 11 線）低、西邊（水晶城堡）高；官網圖把「東」畫在下方、「北」畫在右方，
大約順時針轉 90 度。控制點全部取自 OpenStreetMap（設施點位／建築物中心），用薄板樣條（TPS，含平滑項）對位。
誤差見 README（留一驗證），屬推估。

用法：python3 tools/build.py   （需要 numpy、Pillow；來源圖 tools/src/map_full.png ＝ PDF 第 1 頁 150dpi 裁左 83%）
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'src')
LAT0, LON0 = 23.901, 121.601
MX = 111320 * math.cos(math.radians(LAT0)); MY = 110574
LAM = 0.02  # TPS 平滑項（相對值），避免手繪圖局部比例怪異造成影像摺疊

def to_m(lat, lon): return ((lon - LON0) * MX, (lat - LAT0) * MY)
def to_ll(x, y): return (LAT0 + y / MY, LON0 + x / MX)

# 官網圖像素 (x,y) → 真實 (lat,lon)；全部來自 OSM（2026-11-24 api.openstreetmap.org）
CTRL = [
    ('晴空纜車站（8區上站）', (1415, 475), (23.9011394, 121.599795)),   # aerialway=station
    ('晴空纜車站（2區下站）', (1350, 1690), (23.9011212, 121.6026711)),  # aerialway=station
    ('燈塔咖啡屋', (1950, 1800), (23.902228, 121.602849)),
    ('海洋村客服中心', (1790, 1777), (23.901931, 121.602849)),
    ('愛情摩天輪', (1020, 1345), (23.900419, 121.601994)),
    ('海洋劇場（海豚）', (1640, 1330), (23.901583, 121.601552)),
    ('海洋探索館', (1700, 1560), (23.90171, 121.602235)),
    ('水獺館', (848, 1688), (23.90023, 121.602678)),
    ('鯨魚大冒險', (1790, 880), (23.902089, 121.600354)),
    ('嘉年華小吃', (1695, 1133), (23.901533, 121.601044)),
    ('鯨魚的夢想家', (1753, 1191), (23.901768, 121.601205)),
    ('峽灣餐廳', (1185, 1363), (23.900961, 121.601916)),
    ('沙木里餐廳', (1303, 1286), (23.901143, 121.601636)),
    ('多尼漢堡', (1435, 715), (23.90122, 121.600518)),
    ('海洋嘉年華', (1590, 650), (23.901362, 121.600282)),
    ('探險島補貨站', (979, 1668), (23.900383, 121.602576)),
]
# 導覽圖上「畫園區」的範圍（避開兩側說明欄、照片泡泡、下方公路與海）
MASK = [(720, 160), (2400, 160), (2400, 1180), (2080, 1200), (2080, 2060), (700, 2060), (760, 1300), (700, 800)]
BBOX = (23.8988, 121.5985, 23.9031, 121.6043)  # s, w, n, e

def U(r):
    with np.errstate(divide='ignore', invalid='ignore'):
        v = r * r * np.log(r)
    return np.nan_to_num(v)

class TPS:
    def __init__(self, src, dst, lam=0.0):
        src = np.asarray(src, float); dst = np.asarray(dst, float); n = len(src)
        K = U(np.linalg.norm(src[:, None] - src[None], axis=2))
        K = K + lam * np.mean(np.abs(K)) * np.eye(n)
        P = np.c_[np.ones(n), src]
        A = np.zeros((n + 3, n + 3)); A[:n, :n] = K; A[:n, n:] = P; A[n:, :n] = P.T
        b = np.zeros((n + 3, 2)); b[:n] = dst
        sol = np.linalg.solve(A, b)
        self.c, self.w, self.a = src, sol[:n], sol[n:]
    def __call__(self, q):
        q = np.atleast_2d(np.asarray(q, float))
        return self.a[0] + q @ self.a[1:] + U(np.linalg.norm(q[:, None] - self.c[None], axis=2)) @ self.w
    def export(self):
        r = lambda a: [[round(float(v), 6) for v in row] for row in a]
        return {'c': r(self.c), 'w': r(self.w), 'a': r(self.a)}

def build():
    src_img = Image.open(os.path.join(SRC, 'map_full.png')).convert('RGB')
    # 官網原圖（給「官網原圖」模式）
    src_img.save(os.path.join(ROOT, 'map.jpg'), quality=72, optimize=True, progressive=True)
    S = np.asarray(src_img)
    park = json.load(open(os.path.join(SRC, 'park_polygon.json')))
    mp = np.array([p[1] for p in CTRL], float)
    xy = np.array([to_m(*p[2]) for p in CTRL])
    fwd = TPS(xy, mp, LAM)   # 真實(公尺) → 官網圖像素
    inv = TPS(mp, xy, LAM)   # 官網圖像素 → 真實(公尺)
    loo = []
    for i in range(len(CTRL)):
        k = [j for j in range(len(CTRL)) if j != i]
        t = TPS(mp[k], xy[k], LAM); loo.append(float(np.linalg.norm(t(mp[i])[0] - xy[i])))
    fit = [float(np.linalg.norm(inv(mp[i])[0] - xy[i])) for i in range(len(CTRL))]
    for (n, _, _), e, f in zip(CTRL, loo, fit):
        print(f'  {n}: 留一 {e:.0f} m，擬合殘差 {f:.0f} m')
    print('留一誤差 中位數 %.0f m，最大 %.0f m' % (np.median(loo), max(loo)))
    s_, w_, n_, e_ = BBOX; res = 0.4
    W = int((e_ - w_) * MX / res); H = int((n_ - s_) * MY / res)
    LO, LA = np.meshgrid(np.linspace(w_, e_, W), np.linspace(n_, s_, H))
    q = np.c_[((LO - LON0) * MX).ravel(), ((LA - LAT0) * MY).ravel()]
    m = fwd(q); u = m[:, 0].reshape(H, W); v = m[:, 1].reshape(H, W)
    mk = Image.new('L', src_img.size, 0); ImageDraw.Draw(mk).polygon(MASK, fill=255); M = np.asarray(mk)
    ui = np.clip(np.round(u).astype(int), 0, src_img.width - 1); vi = np.clip(np.round(v).astype(int), 0, src_img.height - 1)
    inside = (u >= 0) & (u < src_img.width) & (v >= 0) & (v < src_img.height)
    pk = Image.new('L', (W, H), 0)
    ImageDraw.Draw(pk).polygon([((lo - w_) / (e_ - w_) * W, (n_ - la) / (n_ - s_) * H) for la, lo in park], fill=255)
    pk = pk.filter(ImageFilter.MaxFilter(int(30 / res) | 1)).filter(ImageFilter.GaussianBlur(5))
    alpha = np.where(inside, M[vi, ui], 0).astype(np.float32) * (np.asarray(pk) / 255.0)
    du = np.gradient(u); dv = np.gradient(v); det = du[1] * dv[0] - du[0] * dv[1]
    inpark = np.asarray(pk) > 128
    print('Jacobian 摺疊比例(園區內):', round(float((np.sign(det[inpark]) != np.sign(np.median(det[inpark]))).mean()), 4))
    Image.fromarray(np.dstack([S[vi, ui], alpha.astype(np.uint8)]), 'RGBA').save(os.path.join(ROOT, 'overlay.webp'), quality=78, method=6)
    meta = {'bounds': [[s_, w_], [n_, e_]], 'tps': fwd.export(), 'size': list(src_img.size),
            'ctrl': [[p[0], list(p[1]), [round(p[2][0], 6), round(p[2][1], 6)]] for p in CTRL],
            'loo': [round(v) for v in loo]}
    return meta, inv, fwd

def main():
    meta, inv, fwd = build()
    P = json.load(open(os.path.join(ROOT, 'tools', 'pois.json')))
    for p in P:
        if 'm' not in p:
            u, v = fwd(np.array([to_m(*p['ll'])]))[0]; p['m'] = [round(float(u)), round(float(v))]
        if 'll' not in p:
            x, y = inv(p['m'])[0]; lat, lon = to_ll(x, y)
            p['ll'] = [round(lat, 6), round(lon, 6)]; p['est'] = 1
    js = ('// 由 tools/build.py 產生，請勿手改\n'
          f'const GEO={json.dumps(meta, ensure_ascii=False)};\n'
          f'const POIS={json.dumps(P, ensure_ascii=False)};\n'
          f'const LOCAL={{lat0:{LAT0},lon0:{LON0},mx:{MX:.4f},my:{MY}}};\n'
          f'const PARKPOLY={json.dumps(json.load(open(os.path.join(SRC, "park_polygon.json"))))};\n')
    open(os.path.join(ROOT, 'data.js'), 'w').write(js)
    print('POI', len(P), 'data.js', len(js))

if __name__ == '__main__':
    main()
