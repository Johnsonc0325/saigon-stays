# -*- coding: utf-8 -*-
"""Build a multi-page Ho Chi Minh travel guide centered on Centoria Hotel.

Pages:  index.html (住宿+概覽) / attractions.html (景點) / food.html (美食) / tips.html (注意事項)
Reuses the design language of build_stays.py (paper/ink/green accent, serif numerals).
"""
import io, json, os, re, shutil
from PIL import Image

VAULT_ATT = r"C:\Users\USER\iCloudDrive\iCloud~md~obsidian\我的世界\00_附件"
VAULT_HCM = r"C:\Users\USER\iCloudDrive\iCloud~md~obsidian\我的世界\越南\胡志明"
OUT = r"D:\04_Personal\胡志明住宿精選"
IMGDIR = os.path.join(OUT, "images")
os.makedirs(IMGDIR, exist_ok=True)

TRIP = {"start": "2026-10-26", "end": "2026-10-30", "nights": 4}
HOTEL = {"name": "Centoria Hotel By Urban B", "price": 326, "rating": "9.5",
         "lat": 10.82772, "lng": 106.67848,
         "addr": "656/52 Đường Quang Trung, Go Vap 區",
         "stay": "入住 14:00 後｜退房 12:00 前"}

# ------------------------------------------------------------------ CSS
CSS = r"""
*,*::before,*::after{box-sizing:border-box}
:root{
  --paper:#F6F4F0; --card:#FFFFFF; --ink:#171614; --ink2:#3A3833; --muted:#7C776E;
  --line:#E4DFD6; --line2:#CFC9BD; --accent:#2C5340; --accent-soft:#E9EFE9;
  --warn:#8A5A1E; --warn-soft:#F7EFE2;
  --sans:"PingFang TC","Microsoft JhengHei","Noto Sans TC","Hiragino Sans TC",system-ui,-apple-system,"Segoe UI",sans-serif;
  --serif:Georgia,"Times New Roman","Songti TC","Source Han Serif TC",serif;
  --maxw:1100px; --r:3px;
}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
  font-size:15px;line-height:1.72;text-wrap:pretty;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}
a{color:inherit}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
.num{font-family:var(--serif);font-variant-numeric:tabular-nums}

/* topbar + nav */
.topbar{position:sticky;top:0;z-index:30;background:rgba(246,244,240,.93);
  border-bottom:1px solid var(--line);backdrop-filter:saturate(120%) blur(6px)}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;
  min-height:58px;padding-top:8px;padding-bottom:8px;flex-wrap:wrap}
.brand{font-weight:600;letter-spacing:.01em;font-size:14.5px}
.brand .dot{color:var(--muted);margin:0 6px}
.nav{display:flex;gap:4px;flex-wrap:wrap}
.nav a{font-size:13px;color:var(--muted);text-decoration:none;padding:5px 11px;border-radius:999px;
  transition:background .15s,color .15s}
.nav a:hover{color:var(--ink);background:var(--card)}
.nav a[aria-current="page"]{color:#fff;background:var(--ink)}
.trip{font-size:12.5px;color:var(--muted);letter-spacing:.02em}
.trip b{color:var(--ink);font-weight:600;font-family:var(--serif)}

/* hero */
.hero{padding-top:60px;padding-bottom:6px}
.eyebrow{font-family:var(--serif);font-size:11px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--muted);margin:0 0 20px}
h1{font-size:clamp(28px,4.6vw,46px);line-height:1.24;letter-spacing:-.02em;margin:0 0 26px;font-weight:700;max-width:780px}
h1 span{color:var(--muted);font-weight:400}
.lede{margin:0;color:var(--ink2);font-size:14.5px;max-width:64ch}
.lede b{font-weight:600;color:var(--ink)}

/* section */
section{padding-top:56px}
h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);
  font-weight:600;margin:0 0 20px;padding-bottom:14px;border-bottom:1px solid var(--line2)}
h3{font-size:19px;font-weight:600;letter-spacing:-.01em;margin:0 0 6px}
p{margin:0 0 12px}

/* hotel card */
.hotel{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:30px;align-items:start}
.hotel .shot{background:#EAE7E1;border-radius:var(--r);overflow:hidden;aspect-ratio:4/3}
.hotel .shot img{width:100%;height:100%;object-fit:cover}
.thumbs{display:flex;gap:8px;overflow-x:auto;padding-top:10px;scrollbar-width:thin}
.thumbs img{width:70px;height:52px;object-fit:cover;border-radius:2px;flex:0 0 auto;opacity:.6;
  cursor:pointer;border:1px solid transparent;transition:opacity .15s}
.thumbs img:hover{opacity:.9}
.thumbs img.on{opacity:1;border-color:var(--ink)}
.badge{display:inline-block;font-size:11.5px;background:var(--accent);color:#fff;
  border-radius:2px;padding:3px 9px;letter-spacing:.04em;margin-bottom:12px}
.facts{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin:14px 0 16px}
.price{font-family:var(--serif);font-size:26px;letter-spacing:-.01em}
.price .cur{font-size:13px;color:var(--muted);margin-right:3px}
.price .unit{font-family:var(--sans);font-size:12px;color:var(--muted);margin-left:6px}
.rating{font-size:13px;color:var(--ink2)}
.rating b{font-family:var(--serif);font-size:15px}
.dl{display:grid;grid-template-columns:82px 1fr;gap:7px 16px;margin:0 0 18px;font-size:13.5px}
.dl dt{color:var(--muted);font-size:12.5px}
.dl dd{margin:0;color:var(--ink2)}
ul.pl{list-style:none;margin:0;padding:0;font-size:13.5px;color:var(--ink2)}
ul.pl li{display:flex;gap:9px;margin-bottom:5px}
ul.pl .m{color:var(--accent);flex:0 0 auto}
ul.pl.neg li{color:var(--muted)}
ul.pl.neg .m{color:var(--muted)}
.tag{display:inline-block;font-size:11.5px;color:var(--muted);background:var(--accent-soft);
  border-radius:2px;padding:2px 8px;margin:0 6px 6px 0}

/* table */
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:11px 14px 11px 0;border-bottom:1px solid var(--line);vertical-align:baseline}
th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600;
  border-bottom-color:var(--line2)}
td.r,th.r{text-align:right;padding-right:0}
tbody tr:hover{background:var(--card)}
tbody td:first-child{color:var(--muted);font-family:var(--serif)}
tbody td.p{font-family:var(--serif);font-size:14.5px;white-space:nowrap}
.tnote{color:var(--muted);font-size:12.5px;margin:14px 0 0}

/* cards grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);
  overflow:hidden;display:flex;flex-direction:column}
.card .shot{background:#EAE7E1;aspect-ratio:4/3;overflow:hidden}
.card .shot img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.card:hover .shot img{transform:scale(1.02)}
.card .in{padding:16px 17px 18px;flex:1;display:flex;flex-direction:column}
.card h3{font-size:16px;margin:0 0 6px;line-height:1.4}
.card .meta{font-size:12.5px;color:var(--muted);margin:0 0 10px}
.card p{font-size:13.5px;color:var(--ink2);margin:0 0 10px}
.card .foot{margin-top:auto;font-size:12.5px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap}
.pill{display:inline-block;font-size:11.5px;border:1px solid var(--line2);border-radius:999px;
  padding:2px 9px;color:var(--ink2);margin:0 6px 6px 0}

/* callout */
.callout{background:var(--warn-soft);border-left:3px solid var(--warn);border-radius:var(--r);
  padding:15px 18px;font-size:13.5px;color:var(--ink2);margin:0 0 18px}
.callout b{color:var(--ink)}
.note{background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:var(--r);
  padding:15px 18px;font-size:13.5px;color:var(--ink2);margin:0 0 18px}

/* tips accordion */
details{background:var(--card);border:1px solid var(--line);border-radius:var(--r);
  margin-bottom:12px;overflow:hidden}
details summary{padding:15px 18px;cursor:pointer;font-weight:600;font-size:14.5px;list-style:none;
  display:flex;justify-content:space-between;align-items:center;gap:12px}
details summary::-webkit-details-marker{display:none}
details summary::after{content:"＋";color:var(--muted);font-weight:400}
details[open] summary::after{content:"−"}
details .dbody{padding:0 18px 18px;font-size:13.5px;color:var(--ink2);border-top:1px solid var(--line)}
details .dbody h4{margin:16px 0 8px;font-size:13px;color:var(--ink)}
details .dbody ul{margin:0 0 12px;padding-left:20px}
details .dbody li{margin-bottom:5px}
details .dbody code{background:var(--paper);border:1px solid var(--line);border-radius:2px;
  padding:1px 6px;font-size:12.5px}


footer.spacer{margin-top:70px;border-top:1px solid var(--line);height:72px}

@media (max-width:860px){
  .wrap{padding-left:20px;padding-right:20px}
  .hero{padding-top:38px}
  .topbar{position:static}
  .hotel{grid-template-columns:1fr;gap:22px}
  .nav{width:100%;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;padding-bottom:2px}
  .nav::-webkit-scrollbar{display:none}
  .nav a{flex:0 0 auto}
  .grid{grid-template-columns:1fr}
  section{padding-top:42px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
"""

# ------------------------------------------------------------------ helpers
def page(title, desc, active, body, extra_head=""):
    nav_items = [("index.html", "主頁"), ("attractions.html", "景點"),
                 ("food.html", "美食"), ("shopping.html", "體驗購物"),
                 ("tips.html", "注意事項")]
    nav = "".join(
        '<a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == active else "", t)
        for h, t in nav_items)
    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<style>{CSS}</style>
{extra_head}
</head>
<body>

<header class="topbar">
  <div class="wrap">
    <div class="brand">胡志明 5 天 <span class="dot">·</span> <em style="font-style:normal;color:var(--muted);font-weight:400">2026.10.26–30</em></div>
    <nav class="nav">{nav}</nav>
    <div class="trip">住 <b>Centoria Hotel</b>｜Go Vap 區</div>
  </div>
</header>

{body}

<footer class="spacer" aria-hidden="true"></footer>

</body>
</html>
"""

def copy_img(src_name, out_name, maxw=1100, q=82):
    src = os.path.join(VAULT_ATT, src_name)
    if not os.path.exists(src):
        return None
    dst = os.path.join(IMGDIR, out_name)
    try:
        im = Image.open(src).convert("RGB")
        if im.width > maxw:
            im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=q, optimize=True, progressive=True)
        return "images/" + out_name
    except Exception:
        return None

def read_md(folder, filename):
    p = os.path.join(VAULT_HCM, folder, filename)
    if not os.path.exists(p):
        return ""
    return io.open(p, encoding="utf-8", errors="ignore").read()

print("helpers ready")


# ------------------------------------------------------------------ data: 景點
SPOTS = [
  {"slug":"post","name":"中央郵局","en":"Saigon Central Post Office","emoji":"🏤",
   "img":"6a826eab_img_3.jpg","lat":10.7799129,"lng":106.699902,
   "addr":"02 Công trường Công xã Paris, Bến Nghé, Quận 1",
   "hours":"週一至六 07:30–18:00｜週日 08:00–17:00","rating":"4.4（5,670 則）",
   "desc":"緊鄰紅教堂的百年網紅地標。步入大廳，復古穹頂、華麗吊燈、雕花窗格滿是法式風情；復古電話亭與老式櫃檯自帶懷舊濾鏡。可以在這裡手寫明信片寄回台灣，儀式感十足。",
   "tip":"避開旅行團高峰入內；用穹頂線條仰拍很有縱深感，室外可與紅教堂同框。"},
  {"slug":"hall","name":"市政廳","en":"Ho Chi Minh City Hall","emoji":"🏛️",
   "img":"6a826eab_img_2.jpg","lat":10.7765431,"lng":106.700916,
   "addr":"86 Lê Thánh Tôn, Sài Gòn, Quận 1",
   "hours":"週一至五 07:00–11:30、13:30–17:00（六日休息）","rating":"4.7",
   "desc":"市中心核心地帶的法式復古建築，代表性地標。整棟色調溫柔雅致，精緻浮雕與復古窗廊盡顯百年法式浪漫，門前綠植與雕塑隨手一拍都是異域風情。白天陽光漫過輪廓、夜晚燈光點亮整棟樓，氛圍感拉滿。",
   "tip":"白天光線柔和時拍建築全景；傍晚亮燈後拍夜景，光影交融更有大片質感。"},
  {"slug":"cafe","name":"咖啡公寓","en":"The Cafe Apartment","emoji":"☕",
   "img":"6a826eab_img_5.jpg","lat":10.7737,"lng":106.7040,
   "addr":"42 Nguyễn Huệ, Bến Nghé, Quận 1",
   "hours":"各店不同，多數 08:00–22:00","rating":"4.4",
   "desc":"一棟九層老公寓被改造成數十家風格咖啡店與小店，是胡志明最熱門的打卡點。每層樓各有一家店，從復古書店到工業風咖啡館，適合慢慢逛、慢慢拍。",
   "tip":"建議白天先逛，傍晚再到對面步行街拍整棟外觀；進店需要消費才能上樓。"},
  {"slug":"bui","name":"范五老街","en":"Bùi Viện Walking Street","emoji":"🌃",
   "img":"6a826eab_img_4.jpg","lat":10.767351,"lng":106.6938836,
   "addr":"Bùi Viện, Phạm Ngũ Lão, Quận 1",
   "hours":"24 小時營業","rating":"4.3（27,038 則）",
   "desc":"全球背包客聚集的網紅街區。白天街巷閒適安逸、沿街小店錯落有致；夜幕降臨後霓虹亮起，酒吧、商鋪熱鬧喧囂，動感音樂與人群交織，是體驗西貢夜生活的地方。",
   "tip":"傍晚到訪最佳，暖調街燈加霓虹氛圍感十足；坐街邊店隨拍就很出片。"},
]

# 從 Centoria 到各景點的距離（直線實測，車程 = 直線 ×1.35 @25km/h）
import math
def dist_km(a, b):
    R = 6371.0
    la1, lo1 = math.radians(a[0]), math.radians(a[1])
    la2, lo2 = math.radians(b[0]), math.radians(b[1])
    d = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(d))

HOTEL_PT = (HOTEL["lat"], HOTEL["lng"])
for s in SPOTS:
    s["km"] = dist_km(HOTEL_PT, (s["lat"], s["lng"]))
    s["ride_km"] = s["km"] * 1.35
    s["mins"] = round(s["ride_km"] / 25 * 60)

# ------------------------------------------------------------------ data: 住宿
HOTEL_DATA = {
  "slug":"s12","name":"Centoria Hotel By Urban B","sub":"3 星級・Go Vap 區・設施新",
  "badge":"✅ 已訂房",
  "area":"Go Vap 區","areaNote":"安靜住宅區，離市中心較遠","type":"飯店・3 星級",
  "price":326,"rating":"9.5","ratingCount":"24 則","ratingNote":"優異（員工 9.6・位置 9.2）",
  "host":"Booking.com・Urban B 系列","roomType":"雙人房｜冰箱、迷你吧、電熱水壺、書桌",
  "stay":"入住 14:00 後｜退房 12:00 前","cancel":"依 Booking 頁面為準",
  "access":"656/52 Đường Quang Trung, Go Vap 區",
  "facilities":"免費 WiFi、共用廚房、客房服務、冰箱、迷你吧、電熱水壺、淋浴設施、吹風機、書桌",
  "breakdown":[["員工素質","9.6"],["位置","9.2"]],
  "pros":["評分 9.5（優異），24 條點評中員工素質 9.6 最高",
          "房客形容「new and refreshing」——房間新穎、乾淨整潔",
          "員工與經理親切熱心（澳洲、喬治亞、土耳其、越南房客一致提到）",
          "有共用廚房、冰箱、迷你吧、電熱水壺，長住很方便"],
  "cons":["位於 Go Vap 區，離第 1 區市中心較遠，需叫車（約 20–25 分鐘）",
          "點評數僅 24 條，樣本偏少",
          "3 星級飯店，房間空間預期不大"],
  "summary":"Urban B 系列中評價最高的一間（9.5，優異），主打新穎乾淨與親切服務，員工素質 9.6。適合想住安靜住宅區、需要共用廚房的行程；代價是離市中心景點較遠，每天需安排 Grab 往返。",
  "lat":10.82772,"lng":106.67848,
  "src":"https://www.booking.com/hotel/vn/centoria-by-urban-b.zh-tw.html",
  "tags":["3星級","共用廚房","新穎","安靜住宅區"],
}
print("data ready:", len(SPOTS), "spots")


# ------------------------------------------------------------------ 主頁
def build_index():
    h = HOTEL_DATA
    # 住宿照片
    photos = ["booking_centoria_%d.jpg" % i for i in range(1, 7)]
    labels = ["外觀", "房間", "浴室", "房間", "外觀", "大廳"]
    shots = []
    for i, (fn, lb) in enumerate(zip(photos, labels), 1):
        p = os.path.join(VAULT_ATT, fn)
        if os.path.exists(p):
            out = copy_img(fn, "centoria_%02d.jpg" % i)
            if out:
                shots.append({"src": out, "label": lb})

    thumbs = "".join(
        '<img src="%s" alt="%s" data-i="%d"%s>' % (s["src"], s["label"], i, ' class="on"' if i == 0 else "")
        for i, s in enumerate(shots))
    main = shots[0]["src"] if shots else ""

    # 距離表
    rows = ""
    for s in sorted(SPOTS, key=lambda x: x["km"]):
        grab = 20000 + round(s["ride_km"] * 14000 / 1000) * 1000
        rows += f"""<tr><td>{s['emoji']}</td><td>{s['name']}</td>
        <td class="p num">{s['ride_km']:.1f} km</td>
        <td class="num">{s['mins']} 分</td>
        <td class="r num">~{grab//1000}K ₫</td></tr>"""

    pros = "".join(f'<li><span class="m">+</span><span>{x}</span></li>' for x in h["pros"])
    cons = "".join(f'<li><span class="m">−</span><span>{x}</span></li>' for x in h["cons"])
    bd = "".join(f'<span>{k}<b class="num">{v}</b></span>' for k, v in h["breakdown"])

    body = f"""
<main class="wrap">
  <div class="hero">
    <p class="eyebrow">Ho Chi Minh City · 5 Days</p>
    <h1>胡志明 5 天<br><span>以 Centoria Hotel 為據點</span></h1>
    <p class="lede">2026 年 10 月 26–30 日，4 晚。住宿訂在 <b>Go Vap 區的 Centoria Hotel By Urban B</b>（3 星、評分 9.5）。
    這份攻略以它為中心，整理了交通時間、景點、美食與出入境注意事項。<b>重點：到市中心各景點約 6–7 公里，需搭 Grab 約 20–25 分鐘。</b></p>
  </div>

  <section id="hotel">
    <h2>住宿 · 已訂</h2>
    <div class="hotel">
      <div>
        <div class="shot"><img src="{main}" alt="{h['name']}"></div>
        <div class="thumbs">{thumbs}</div>
      </div>
      <div>
        <span class="badge">{h['badge']}</span>
        <h3>{h['name']}</h3>
        <p class="meta" style="color:var(--muted);font-size:13px;margin:0 0 4px">{h['sub']}</p>
        <div class="facts">
          <span class="price"><span class="cur">RM</span>{h['price']}<span class="unit">/ 4 晚</span></span>
          <span class="rating"><b>{h['rating']}</b> / 10 · {h['ratingCount']}</span>
        </div>
        <dl class="dl">
          <dt>地區</dt><dd>{h['area']}（{h['areaNote']}）</dd>
          <dt>地址</dt><dd>{h['access']}</dd>
          <dt>入住</dt><dd>{h['stay']}</dd>
          <dt>房型</dt><dd>{h['roomType']}</dd>
          <dt>設施</dt><dd>{h['facilities']}</dd>
          <dt>取消</dt><dd>{h['cancel']}</dd>
        </dl>
        <div class="bd" style="display:flex;gap:18px;font-size:12.5px;color:var(--ink2);margin-bottom:14px">{bd}</div>
        <ul class="pl">{pros}</ul>
        <ul class="pl neg" style="margin-top:10px">{cons}</ul>
        <p class="note" style="margin-top:16px">{h['summary']}</p>
        <p style="font-size:13px;margin:14px 0 0"><a href="{h['src']}" target="_blank" rel="noopener" style="color:var(--accent);border-bottom:1px solid currentColor;text-decoration:none">在 Booking.com 查看 ↗</a></p>
      </div>
    </div>
  </section>

  <section id="transport">
    <h2>從飯店出發 · 交通時間</h2>
    <div class="callout">
      <b>Centoria 在 Go Vap 區，離第 1 區市中心約 6–7 公里。</b>
      每天出門前建議先用 <b>Grab</b> 叫車（東南亞版 Uber，可用信用卡或現金）。
      車資為估算值，實際依時段與車型浮動。
    </div>
    <table>
      <thead><tr><th></th><th>目的地</th><th>車程距離</th><th>時間</th><th class="r">Grab 約</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <p class="tnote">車程距離 = 直線距離 ×1.35（道路係數）；時間以市區 25 km/h 估算。實際請以 Grab App 為準。</p>
  </section>

  <section id="quick">
    <h2>攻略分頁</h2>
    <div class="grid">
      <a class="card" href="attractions.html" style="text-decoration:none">
        <div class="in"><h3>📍 景點</h3><p>中央郵局、市政廳、咖啡公寓、范五老街 · 含距離與交通</p>
        <div class="foot"><span>{len(SPOTS)} 個景點</span></div></div>
      </a>
      <a class="card" href="food.html" style="text-decoration:none">
        <div class="in"><h3>🍜 美食</h3><p>河粉、法棍、咖啡、燒烤、米其林 · 精選 + 完整清單</p>
        <div class="foot"><span>精選 12 家</span></div></div>
      </a>
      <a class="card" href="shopping.html" style="text-decoration:none">
        <div class="in"><h3>🛍️ 體驗 & 購物</h3><p>湄公河遊船、美甲、陶瓷家居、超市手信</p>
        <div class="foot"><span>10 篇</span></div></div>
      </a>
      <a class="card" href="tips.html" style="text-decoration:none">
        <div class="in"><h3>🧳 注意事項</h3><p>電子入境卡教學、出行必備清單、預約提醒</p>
        <div class="foot"><span>3 篇</span></div></div>
      </a>
    </div>
  </section>
</main>

<script>
(function(){{
  var main=document.querySelector('.hotel .shot img');
  var th=document.querySelectorAll('.thumbs img');
  th.forEach(function(t){{
    t.addEventListener('click',function(){{
      main.src=t.src;
      th.forEach(function(x){{x.classList.remove('on')}});
      t.classList.add('on');
    }});
  }});
}})();
</script>
"""
    return page("胡志明 5 天攻略｜Centoria Hotel 為據點（2026.10.26–30）",
                "以 Centoria Hotel（Go Vap 區）為據點的胡志明 5 天攻略：住宿資訊、交通時間、景點、美食與出入境注意事項。",
                "index.html", body)


# ------------------------------------------------------------------ 景點頁
def build_attractions():
    cards = ""
    for s in sorted(SPOTS, key=lambda x: x["km"]):
        img = copy_img(s["img"], "spot_%s.jpg" % s["slug"]) if s["img"] else None
        shot = f'<div class="shot"><img src="{img}" alt="{s["name"]}"></div>' if img else ""
        cards += f"""
      <article class="card">
        {shot}
        <div class="in">
          <h3>{s['emoji']} {s['name']}</h3>
          <p class="meta">{s['en']}</p>
          <p>{s['desc']}</p>
          <p style="font-size:12.5px;color:var(--ink2)"><b>拍照建議：</b>{s['tip']}</p>
          <div class="foot">
            <span>🕐 {s['hours']}</span>
            <span>⭐ {s['rating']}</span>
          </div>
          <div class="foot" style="margin-top:8px">
            <span>📍 {s['addr'][:44]}</span>
          </div>
          <div class="foot" style="margin-top:8px">
            <span style="color:var(--accent);font-weight:600">從飯店 {s['ride_km']:.1f} km · 約 {s['mins']} 分鐘車程</span>
          </div>
          <p style="margin:10px 0 0;font-size:12.5px"><a href="https://www.google.com/maps/search/?api=1&query={s['lat']},{s['lng']}" target="_blank" rel="noopener" style="color:var(--accent);border-bottom:1px solid currentColor;text-decoration:none">Google Maps ↗</a></p>
        </div>
      </article>"""

    body = f"""
<main class="wrap">
  <div class="hero">
    <p class="eyebrow">Attractions · Quận 1</p>
    <h1>景點 <span>· 4 個市中心地標</span></h1>
    <p class="lede">全部位在第 1 區，彼此步行可達。從 Centoria 出發約 <b>20–23 分鐘車程</b>，
    建議排成一天的行程：中央郵局 → 市政廳 → 咖啡公寓 → 傍晚范五老街。</p>
  </div>

  <section>
    <h2>距離一覽（從 Centoria Hotel）</h2>
    <table>
      <thead><tr><th></th><th>景點</th><th>車程距離</th><th>時間</th><th class="r">評分</th></tr></thead>
      <tbody>{"".join(f'<tr><td>{s["emoji"]}</td><td>{s["name"]}</td><td class="p num">{s["ride_km"]:.1f} km</td><td class="num">{s["mins"]} 分</td><td class="r num">{s["rating"].split("（")[0]}</td></tr>' for s in sorted(SPOTS, key=lambda x: x["km"]))}</tbody>
    </table>
    <p class="tnote">四個景點彼此間距都在 1 公里內，同一天步行串完最順。</p>
  </section>

  <section>
    <h2>景點介紹</h2>
    <div class="grid">{cards}
    </div>
  </section>
</main>
"""
    return page("景點 · 胡志明 5 天攻略", "胡志明第 1 區 4 個必去景點：中央郵局、市政廳、咖啡公寓、范五老街，含從 Centoria Hotel 的距離與交通時間。",
                "attractions.html", body)

print("index + attractions builders ready")


# ------------------------------------------------------------------ 美食頁
FOOD_PICKS = [
  ("最紅法棍｜Bánh Mì Huynh Hoa", "法棍", "胡志明最有名的法棍，排隊名店，料多到滿出來"),
  ("河粉｜Phở Hòa Pasteur", "河粉", "老字號河粉，湯頭清甜，觀光客與本地人都愛"),
  ("24小時河粉｜Phố Quỳnh", "河粉", "24 小時營業，宵夜救星"),
  ("Pizza 4P's：越南必吃手工披薩與螃蟹奶油麵", "異國", "越南必吃手工披薩，螃蟹奶油麵 5 星推薦"),
  ("米其林越南菜餐廳｜Bếp Mẹ Ỉn", "米其林", "米其林推薦的越南家常菜"),
  ("軟殼蟹米其林｜Quán Thuý 94", "米其林", "軟殼蟹招牌，米其林必比登"),
  ("亞洲Top3咖啡｜The Workshop Coffee", "咖啡", "亞洲 Top3 咖啡館，工業風空間"),
  ("百年老宅咖啡店｜Dabao Concept", "咖啡", "百年老宅改建，庭園咖啡"),
  ("蛋咖啡早餐｜Little Hà Nội", "咖啡", "河內名物蛋咖啡，早餐時段最對味"),
  ("老賴羊肉火鍋：廣東梅州第五代的胡志明老店", "火鍋", "梅州華僑第五代經營，羊肉料理傳承兩代"),
  ("胡志明暗巷巴西烤肉：ALEGRIA 15種肉吃到飽", "燒烤", "暗巷巴西烤肉吃到飽，比吃牛排還划算"),
  ("日式炭火燒肉｜5KU Station", "燒烤", "日式炭火燒肉，本地人氣店"),
]

def food_meta(name):
    """讀 vault 筆記抓地點/營業時間等"""
    p = os.path.join(VAULT_HCM, "美食", name + ".md")
    if not os.path.exists(p):
        return {}
    t = io.open(p, encoding="utf-8", errors="ignore").read()
    out = {}
    m = re.search(r"location:\s*\[([\d\.\-]+),\s*([\d\.\-]+)\]", t)
    if m:
        out["lat"], out["lng"] = float(m.group(1)), float(m.group(2))
    for key, pat in [("hours", r"🕐\s*\*\*([^*]+)\*\*"), ("addr", r"📍\s*\[([^\]]+)\]"), ("rating", r"⭐\s*([^\n]+)")]:
        mm = re.search(pat, t)
        if mm:
            out[key] = mm.group(1).strip()[:90]
    imgs = re.findall(r"!\[\[([^\]]+)\]\]", t)
    out["imgs"] = imgs
    return out

def build_food():
    all_food = sorted([f[:-3] for f in os.listdir(os.path.join(VAULT_HCM, "美食")) if f.endswith(".md")])

    picks = ""
    for name, cat, blurb in FOOD_PICKS:
        meta = food_meta(name)
        img = None
        if meta.get("imgs"):
            img = copy_img(meta["imgs"][0], "food_" + re.sub(r"[^\w]", "_", name)[:26] + ".jpg", maxw=900)
        shot = f'<div class="shot"><img src="{img}" alt="{name}" loading="lazy"></div>' if img else ""
        extra = ""
        if meta.get("hours"):
            extra += f'<span>🕐 {meta["hours"]}</span>'
        if meta.get("rating"):
            extra += f'<span>⭐ {meta["rating"][:40]}</span>'
        maps = ""
        if meta.get("lat"):
            maps = f'<p style="margin:10px 0 0;font-size:12.5px"><a href="https://www.google.com/maps/search/?api=1&query={meta["lat"]},{meta["lng"]}" target="_blank" rel="noopener" style="color:var(--accent);border-bottom:1px solid currentColor;text-decoration:none">Google Maps ↗</a></p>'
        picks += f"""
      <article class="card">
        {shot}
        <div class="in">
          <span class="pill">{cat}</span>
          <h3 style="font-size:15.5px">{name}</h3>
          <p style="margin:6px 0 10px">{blurb}</p>
          <div class="foot">{extra}</div>
          {maps}
        </div>
      </article>"""

    # 全部清單：按類型分組
    def group(name):
        for kw, g in [("河粉|Phở|Pho ", "河粉 / 麵食"), ("法棍|Bánh Mì|banh mi", "法棍 Bánh Mì"),
                      ("咖啡|Coffee|cà phê|Cafe|Tearoom", "咖啡"), ("燒烤|烤肉|Nướng|BBQ", "燒烤"),
                      ("海鮮|蟹|蝦|鱼|魚", "海鮮"), ("米其林|Fine Dining|La Fontaine", "米其林 / Fine Dining"),
                      ("自助|吃到飽|Buffet", "自助 / 吃到飽"), ("甜品|糖水|冰|布丁|奶昔", "甜點 / 冰品"),
                      ("越南菜|越式|Mặn", "越南菜"), ("日式|日系", "日式")]:
            if re.search(kw, name, re.I):
                return g
        return "其他"

    groups = {}
    for n in all_food:
        groups.setdefault(group(n), []).append(n)

    listing = ""
    for g in sorted(groups, key=lambda x: -len(groups[x])):
        items = "".join(f"<li>{n}</li>" for n in sorted(groups[g]))
        listing += f"<details><summary>{g}（{len(groups[g])}）</summary><div class='dbody'><ul>{items}</ul></div></details>"

    body = f"""
<main class="wrap">
  <div class="hero">
    <p class="eyebrow">Food · {len(all_food)} 篇筆記</p>
    <h1>美食 <span>· 精選 12 家 + 完整清單</span></h1>
    <p class="lede">從 vault 的 {len(all_food)} 篇美食筆記挑出 12 家代表作，
    另外附上完整清單（依類型分組），想吃什麼自己翻。</p>
  </div>

  <section>
    <h2>精選 12 家</h2>
    <div class="grid">{picks}
    </div>
  </section>

  <section>
    <h2>完整清單（{len(all_food)} 篇）</h2>
    <p class="tnote" style="margin:0 0 16px">點開分類查看。這些都在 Obsidian vault 有完整筆記。</p>
    {listing}
  </section>
</main>
"""
    return page("美食 · 胡志明 5 天攻略", f"胡志明美食精選與完整清單（{len(all_food)} 篇筆記）：河粉、法棍、咖啡、燒烤、海鮮、米其林。",
                "food.html", body)



# ------------------------------------------------------------------ 體驗 & 購物頁
EXP_SHOP = [
  # (類型, 標題, 副標, 說明, 圖檔, 地址, 營業時間, 評分, lat, lng)
  ("體驗", "湄公河一日遊", "Mekong Delta day trip", "最期待的就是湄公河坐船，幾十塊錢玩一天，性價比很高。木船在泥濘河水中航行，船上的人戴斗笠。可參加當地一日遊團（多為 My Tho / Ben Tre 路線）。", "6a9409c1_img_7.jpg", "（體驗類，非單一店家，多從第 1 區出發）", "一日遊多為 08:00 出發、17:00 返回", "", None, None),
  ("體驗", "美甲 · Fame Nails", "Pham Hong Thai（七郡）", "逛七郡逛累了臨時走進去，做完對着陽光拍了十分鐘手。東南亞度假風海鹽藍跳色，員工推薦加細閃，陽光下熱帶感十足。環境偏輕 spa，價格比中國輕鬆很多。也可做 foot spa（約 80–120）。", "6a200905_img_1.jpg", "Fame Nails - Pham Hong Thai（一郡、二郡也有分店）", "依店家", "", 10.7714952, 106.6960343),
  ("購物", "CU 便利店 · 椰皇", "范五老街盡頭", "冷藏櫃的椰皇可以插吸管喝，Mua 1 Tặng 1（買一送一）24,000đ ≈ 2 個椰皇。店員會幫忙開，插上吸管邊走邊喝。", "6a9409c1_img_14.jpg", "范五老街盡頭 CU 便利店（連鎖）", "24 小時（便利商店）", "", None, None),
  ("購物", "Grab 綠色騎士帽", "路邊攤", "沒去特別熱門的那家，路過看到講價就買了，比熱門那家便宜。", "6a9409c1_img_9.jpg", "路邊攤（非固定店家）", "—", "", None, None),
  ("購物", "手信超市 · Big C GO", "268 Tô Hiến Thành", "買手信就來這裡，好多越南限定：燕窩、椰子咖啡、零食、河粉都值得買。", "6a9409c1_img_18.jpg", "268 Tô Hiến Thành（大C超市·東方店）", "每日 08:00–22:00", "4.0（13,150 則）", 10.7782741, 106.6654692),
  ("購物", "超市巡禮 · Tops Market", "685 Âu Cơ, Tân Phú", "除了逛景點吃美食，很推薦逛當地超市。Tops Market 進去很容易越逛越久——法棍麵包區一大片，越南限定商品很多。", None, "685 Âu Cơ, Tân Phú（Oriental Plaza）", "每日 07:30–22:00", "4.1（3,451 則）", 10.7896085, 106.6392619),
  ("購物", "家居用品 · In The Mood", "32 Trần Ngọc Diện, An Khánh", "這家店有兩家、就對著開，不要錯過！很好逛，東西有質感，杯子杯墊方巾都適合送朋友。", "6a79301f_img_8.jpg", "32 Trần Ngọc Diện, An Khánh", "每日 10:00–19:00", "4.8", 10.8054138, 106.7408371),
  ("購物", "陶瓷工藝 · amaï Dong Khoi", "76 Đồng Khởi, Quận 1", "陶瓷工藝品店，也有很多木質調餐具，品種多、顏色豐富。位於第 1 區精品街，離景點很近。", "6a79301f_img_11.jpg", "76 Đồng Khởi, Quận 1", "每日 09:30–21:00", "5.0", 10.7751852, 106.7041498),
  ("購物", "陶瓷店 · TuHu Ceramics", "11 Nguyễn Ư Dĩ, An Khánh", "偏陶瓷和木質，很多挺日式的，可以搭配，不會空手而歸。", "6a79301f_img_7.jpg", "11 Nguyễn Ư Dĩ, An Khánh", "每日 09:00–18:00", "4.7", 10.8066159, 106.7431647),
  ("購物", "陶瓷杯碗 · grade b", "14 Trần Ngọc Diện, An Khánh", "附近有好幾家可以一起逛，咖啡杯盤都很好看，還有冰淇淋色系碗，適合回家做甜品。", "6a79301f_img_12.jpg", "14 Trần Ngọc Diện, An Khánh", "每日 09:00–20:00", "4.8", 10.8033558, 106.7391731),
]

def _shop_card(cat, name, sub, desc, img_name, addr, hours, rating, lat, lng):
    img = None
    if img_name:
        img = copy_img(img_name, "shop_" + re.sub(r"[^\w]", "_", name)[:24] + ".jpg", maxw=900)
    shot = f'<div class="shot"><img src="{img}" alt="{name}" loading="lazy"></div>' if img else ""
    foot = ""
    if hours: foot += f"<span>🕐 {hours}</span>"
    if rating: foot += f"<span>⭐ {rating}</span>"
    maps = ""
    if lat:
        maps = f'<p style="margin:10px 0 0;font-size:12.5px"><a href="https://www.google.com/maps/search/?api=1&query={lat},{lng}" target="_blank" rel="noopener" style="color:var(--accent);border-bottom:1px solid currentColor;text-decoration:none">Google Maps ↗</a></p>'
    return f"""
      <article class="card">
        {shot}
        <div class="in">
          <span class="pill">{cat}</span>
          <h3 style="font-size:15.5px">{name}</h3>
          <p class="meta">{sub}</p>
          <p style="margin:6px 0 10px">{desc}</p>
          <div class="foot">{foot}</div>
          <p style="margin:8px 0 0;font-size:12.5px;color:var(--muted)">📍 {addr}</p>
          {maps}
        </div>
      </article>"""


def build_shopping():
    exp_cards = "".join(_shop_card(*row) for row in EXP_SHOP if row[0] == "體驗")
    shop_cards = "".join(_shop_card(*row) for row in EXP_SHOP if row[0] == "購物")
    n_exp = sum(1 for r in EXP_SHOP if r[0] == "體驗")
    n_shop = sum(1 for r in EXP_SHOP if r[0] == "購物")

    body = f"""
<main class="wrap">
  <div class="hero">
    <p class="eyebrow">Experience &amp; Shopping · {len(EXP_SHOP)} 篇</p>
    <h1>體驗 &amp; 購物 <span>· 玩什麼、買什麼</span></h1>
    <p class="lede">除了景點和美食，越南還有這些值得安排：
    <b>湄公河一日遊</b>（坐船）、<b>美甲</b>（便宜又好看），
    以及回程前的採買——<b>手信超市</b>、<b>陶瓷家居</b>。</p>
  </div>

  <section>
    <h2>體驗（{n_exp}）</h2>
    <div class="grid">{exp_cards}
    </div>
  </section>

  <section>
    <h2>購物（{n_shop}）</h2>
    <div class="callout">
      <b>陶瓷 / 家居小店聚落：</b>In The Mood、TuHu Ceramics、grade b 三家都在
      <b>An Khánh（第 2 區 Thảo Điền 一帶）</b>，彼此走路可達，建議排同一趟。
      <b>amaï Dong Khoi</b> 在第 1 區精品街，逛景點時可順路。
    </div>
    <div class="grid">{shop_cards}
    </div>
  </section>
</main>
"""
    return page("體驗 & 購物 · 胡志明 5 天攻略",
                "胡志明體驗與購物：湄公河一日遊、美甲、手信超市、陶瓷家居小店。",
                "shopping.html", body)


# ------------------------------------------------------------------ 注意事項頁
def build_tips():
    def md_body(fn):
        t = read_md("注意事項", fn)
        # 去掉 frontmatter
        t = re.sub(r"^---.*?---\s*", "", t, flags=re.S)
        # 去圖片引用
        t = re.sub(r"!\[\[[^\]]+\]\]", "", t)
        return t

    entry = md_body("越南电子入境卡填写保姆级教程.md")
    packing = md_body("🇻🇳越南旅游出行必备🧳.md")
    plan = md_body("越南会惩罚每一个不提前予约的P人.md")

    def to_html(md):
        out = []
        for line in md.split("\n"):
            l = line.rstrip()
            if not l.strip():
                continue
            if l.startswith("### "):
                out.append(f"<h4>{l[4:]}</h4>")
            elif l.startswith("## "):
                out.append(f"<h4>{l[3:]}</h4>")
            elif l.startswith("# "):
                continue
            elif l.startswith("> "):
                out.append(f"<p style='color:var(--muted);font-size:13px'>{l[2:]}</p>")
            elif l.startswith("- ") or l.startswith("☑ "):
                out.append(f"<li>{l.lstrip('- ').lstrip('☑ ')}</li>")
            else:
                out.append(f"<p>{l}</p>")
        html = "\n".join(out)
        # 把連續 li 包成 ul
        html = re.sub(r"((?:<li>.*?</li>\n?)+)", lambda m: "<ul>" + m.group(1) + "</ul>", html, flags=re.S)
        html = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", html)
        html = re.sub(r"`([^`]+)`", r"<code>\1</code>", html)
        return html

    body = f"""
<main class="wrap">
  <div class="hero">
    <p class="eyebrow">Before You Go · 出發前必讀</p>
    <h1>注意事項 <span>· 3 件事先辦好</span></h1>
    <p class="lede">越南「會懲罰每一個不提前預約的人」。
    出發前務必完成：<b>電子入境卡</b>（抵達前填）、<b>簽證</b>、<b>行李清單</b>。</p>
  </div>

  <section>
    <h2>① 越南電子入境卡</h2>
    <div class="note">
      官網 <b>prearrival.immigration.gov.vn</b> —— 越早填越省入境排隊時間，記得<b>抵達前</b>填完。
    </div>
    <details open>
      <summary>填寫步驟（保姆級教學）</summary>
      <div class="dbody">{to_html(entry)}</div>
    </details>
  </section>

  <section>
    <h2>② 出行必備清單</h2>
    <details open>
      <summary>證件 / 錢 / 電子 / 穿搭 / 過濾花灑</summary>
      <div class="dbody">{to_html(packing)}</div>
    </details>
  </section>

  <section>
    <h2>③ 預約提醒（別當 P 人）</h2>
    <details>
      <summary>越南熱門景點、必吃美食、行程速覽</summary>
      <div class="dbody">{to_html(plan)}</div>
    </details>
  </section>
</main>
"""
    return page("注意事項 · 胡志明 5 天攻略", "出發前必讀：越南電子入境卡填寫教學、出行必備清單、預約提醒。",
                "tips.html", body)


# ------------------------------------------------------------------ main
def main():
    files = {
        "index.html": build_index(),
        "attractions.html": build_attractions(),
        "food.html": build_food(),
        "shopping.html": build_shopping(),
        "tips.html": build_tips(),
    }
    for fn, content in files.items():
        io.open(os.path.join(OUT, fn), "w", encoding="utf-8").write(content)
        print(f"  {fn:20s} {len(content):>7,} bytes")

if __name__ == "__main__":
    main()
