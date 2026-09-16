import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 1024
SS = 2  # suréchantillonnage
W = S * SS

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def gradient(c1, c2, angle=135):
    D = int(W * 1.5)
    base = Image.linear_gradient('L').resize((D, D), Image.BICUBIC)
    base = base.rotate(-(angle - 90), resample=Image.BICUBIC)
    off = (D - W) // 2
    base = base.crop((off, off, off + W, off + W))
    return Image.composite(Image.new('RGB', (W, W), c2), Image.new('RGB', (W, W), c1), base)

def glow(img, cx, cy, r, color, strength):
    m = Image.new('L', (W, W), 0)
    ImageDraw.Draw(m).ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(255 * strength))
    m = m.filter(ImageFilter.GaussianBlur(r * 0.6))
    return Image.composite(Image.new('RGB', (W, W), color), img, m)

def heart_pts(cx, cy, size, n=400):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size / 17, cy - y * size / 17))
    return pts

def shadow(img, shape_mask, offset=(0, 30), blur=40, opacity=0.35):
    sh = shape_mask.filter(ImageFilter.GaussianBlur(blur * SS))
    sh = ImageChops.offset(sh, offset[0] * SS, offset[1] * SS).point(lambda v: int(v * opacity))
    return Image.composite(Image.new('RGB', (W, W), (10, 30, 30)), img, sh)

def paste_shape(img, mask, color):
    return Image.composite(Image.new('RGB', (W, W), color), img, mask)

def finish(img, name):
    img.resize((S, S), Image.LANCZOS).save(name)

k = SS
CREAM, CORAL = hexc('#FBF6EC'), hexc('#EE7D5C')

# ---------- V1 : carnet + cœur, raffiné ----------
img = gradient(hexc('#3E8C86'), hexc('#1E4F57'), 135)
img = glow(img, 330 * k, 250 * k, 420 * k, hexc('#7FC3B4'), 0.45)
book = Image.new('L', (W, W), 0); d = ImageDraw.Draw(book)
d.rounded_rectangle([262 * k, 196 * k, 780 * k, 838 * k], radius=56 * k, fill=255)
img = shadow(img, book, (0, 34), 46, 0.45)
# pages en dessous (épaisseur)
under = Image.new('L', (W, W), 0)
ImageDraw.Draw(under).rounded_rectangle([282 * k, 214 * k, 800 * k, 858 * k], radius=56 * k, fill=255)
img = paste_shape(img, under, hexc('#DCD3C2'))
img = paste_shape(img, book, CREAM)
# dos du carnet
spine = Image.new('L', (W, W), 0)
ImageDraw.Draw(spine).rounded_rectangle([262 * k, 196 * k, 360 * k, 838 * k], radius=56 * k, fill=255)
ImageDraw.Draw(spine).rectangle([320 * k, 196 * k, 360 * k, 838 * k], fill=255)
img = paste_shape(img, spine, hexc('#E7DCC8'))
# ruban marque-page
rib = Image.new('L', (W, W), 0)
ImageDraw.Draw(rib).polygon([(650 * k, 196 * k), (712 * k, 196 * k), (712 * k, 330 * k), (681 * k, 300 * k), (650 * k, 330 * k)], fill=255)
img = paste_shape(img, rib, CORAL)
# lignes
dl = ImageDraw.Draw(img)
for i, wdt in enumerate([300, 300, 220]):
    y = (620 + i * 66) * k
    dl.rounded_rectangle([420 * k, y, (420 + wdt) * k, y + 22 * k], radius=11 * k, fill=hexc('#C9D8D4'))
# cœur
hm = Image.new('L', (W, W), 0)
ImageDraw.Draw(hm).polygon(heart_pts(560 * k, 440 * k, 150 * k), fill=255)
img = shadow(img, hm, (0, 12), 16, 0.18)
img = paste_shape(img, hm, CORAL)
hl = Image.new('L', (W, W), 0)
ImageDraw.Draw(hl).ellipse([480 * k, 360 * k, 530 * k, 400 * k], fill=110)
img = paste_shape(img, hl.filter(ImageFilter.GaussianBlur(8 * k)), (255, 255, 255))
finish(img, 'icon-v1-carnet.png')

# ---------- V2 : cœur posé dans deux mains en coupe ----------
img = gradient(hexc('#4F9A92'), hexc('#24555C'), 150)
img = glow(img, 512 * k, 380 * k, 400 * k, hexc('#9BD1C2'), 0.4)
hands = Image.new('L', (W, W), 0); d = ImageDraw.Draw(hands)
def petal(cx, cy, rx, ry, rot):
    m = Image.new('L', (W, W), 0)
    ImageDraw.Draw(m).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    return m.rotate(rot, center=(cx, cy), resample=Image.BICUBIC)
left = petal(390 * k, 690 * k, 250 * k, 105 * k, -28)
right = petal(634 * k, 690 * k, 250 * k, 105 * k, 28)
hands = ImageChops.lighter(left, right)
cut = Image.new('L', (W, W), 0)
ImageDraw.Draw(cut).rectangle([0, 0, W, 610 * k], fill=255)
hands = ImageChops.subtract(hands, cut)
img = shadow(img, hands, (0, 22), 30, 0.35)
img = paste_shape(img, left.point(lambda v: v) if False else ImageChops.subtract(left, cut), hexc('#FBF6EC'))
img = paste_shape(img, ImageChops.subtract(right, cut), hexc('#F1E8D8'))
hm = Image.new('L', (W, W), 0)
ImageDraw.Draw(hm).polygon(heart_pts(512 * k, 440 * k, 190 * k), fill=255)
img = shadow(img, hm, (0, 18), 24, 0.3)
img = paste_shape(img, hm, hexc('#EE7D5C'))
hl = Image.new('L', (W, W), 0)
ImageDraw.Draw(hl).ellipse([410 * k, 340 * k, 475 * k, 390 * k], fill=120)
img = paste_shape(img, hl.filter(ImageFilter.GaussianBlur(10 * k)), (255, 255, 255))
finish(img, 'icon-v2-mains.png')

# ---------- V3 : cœur-soleil qui se lève (apaisement) ----------
img = gradient(hexc('#FCD9B8'), hexc('#3C7C7A'), 90)
img = glow(img, 512 * k, 560 * k, 360 * k, hexc('#FFF1DC'), 0.55)
hm = Image.new('L', (W, W), 0)
ImageDraw.Draw(hm).polygon(heart_pts(512 * k, 500 * k, 230 * k), fill=255)
img = paste_shape(img, hm.filter(ImageFilter.GaussianBlur(40 * k)).point(lambda v: v // 3), hexc('#FFD2B0'))
img = paste_shape(img, hm, hexc('#EE7D5C'))
# horizon : collines douces
hill = Image.new('L', (W, W), 0); d = ImageDraw.Draw(hill)
d.ellipse([-300 * k, 640 * k, 700 * k, 1300 * k], fill=255)
d.ellipse([380 * k, 600 * k, 1400 * k, 1320 * k], fill=255)
img = paste_shape(img, hill, hexc('#2F6B6F'))
hill2 = Image.new('L', (W, W), 0)
ImageDraw.Draw(hill2).ellipse([-200 * k, 760 * k, 1250 * k, 1500 * k], fill=255)
img = paste_shape(img, hill2, hexc('#1F4D52'))
finish(img, 'icon-v3-aube.png')

# planche comparative
sheet = Image.new('RGB', (3 * 360 + 80, 440), (245, 242, 236))
dd = ImageDraw.Draw(sheet)
for i, n in enumerate(['icon-v1-carnet.png', 'icon-v2-mains.png', 'icon-v3-aube.png']):
    ic = Image.open(n).resize((320, 320), Image.LANCZOS)
    m = Image.new('L', (320, 320), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, 319, 319], radius=72, fill=255)
    sheet.paste(ic, (40 + i * 360, 40), m)
    sm = Image.open(n).resize((60, 60), Image.LANCZOS)
    m2 = Image.new('L', (60, 60), 0); ImageDraw.Draw(m2).rounded_rectangle([0, 0, 59, 59], radius=14, fill=255)
    sheet.paste(sm, (40 + i * 360 + 130, 370), m2)
sheet.save('comparatif.png')
print('ok')
