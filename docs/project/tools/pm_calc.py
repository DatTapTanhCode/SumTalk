"""Numbers for the PM documents: COCOMO, NPV/ROI/payback, CPM. All inputs are stated assumptions."""
import json

out = {}

# ---------------- COCOMO 81 basic (KLOC counted in the repo, hand-written code without tests/generated UI)
kloc = (3386 + 4518 + 749) / 1000
res = {}
for mode, (a, b, c, d) in {"organic": (2.4, 1.05, 2.5, 0.38), "semi-detached": (3.0, 1.12, 2.5, 0.35)}.items():
    effort = a * kloc ** b
    time = c * effort ** d
    res[mode] = {"effort_pm": round(effort, 1), "time_months": round(time, 1), "staff": round(effort / time, 1),
                 "hours": round(effort * 152), "cost_vnd": round(effort * 152 * 100_000)}
out["cocomo"] = {"kloc": round(kloc, 2), **res}

# ---------------- Function points (unadjusted, IFPUG average weights) from the real API / data model
fp_items = {"EI": (11, 4), "EO": (7, 5), "EQ": (9, 4), "ILF": (6, 10), "EIF": (2, 7)}
ufp = sum(n * w for n, w in fp_items.values())
vaf = 0.65 + 0.01 * 38  # sum of 14 GSC ratings assumed 38
out["fp"] = {"items": fp_items, "ufp": ufp, "vaf": round(vaf, 2), "afp": round(ufp * vaf, 1),
             "hours_at_8h_per_fp": round(ufp * vaf * 8)}

# ---------------- Business case (VND, 3 years, discount 10%)
rate = 0.10
usd = 26_000
dev_hours = 600  # ASSUMPTION - replace with the team's actual total hours
dev_cost = dev_hours * 100_000
ops = {"EC2 t3.large + EBS + IP (~85 USD/month)": 85 * 12 * usd,
       "Whisper API (1,600 h audio x 0.04 USD)": round(1600 * 0.04 * usd),
       "LLM API summary/translation (~5 USD/month)": 5 * 12 * usd,
       "Maintenance (10% of development cost)": round(0.10 * dev_cost)}
ops_year = sum(ops.values())
meetings_year = 40 * 48
hours_saved = 0.75
value_hour = 100_000
full_benefit = meetings_year * hours_saved * value_hour
adoption = [0.5, 0.8, 0.9]


def npv(cfs):
    return sum(cf / (1 + rate) ** t for t, cf in enumerate(cfs))


def payback(cfs):
    cum = 0
    for t, cf in enumerate(cfs):
        if cum + cf >= 0 and t > 0:
            return round(t - 1 + (-cum) / cf, 2)
        cum += cf
    return None


build = [-dev_cost] + [full_benefit * a - ops_year for a in adoption]
saas_year = 20 * 15 * 12 * usd  # 20 seats x 15 USD/month (ASSUMPTION, typical SaaS note-taker price)
saas = [0] + [full_benefit * a - saas_year for a in adoption]
total_benefit = sum(full_benefit * a for a in adoption)
total_cost_build = dev_cost + 3 * ops_year
out["business"] = {
    "dev_cost": dev_cost, "ops": ops, "ops_year": ops_year, "full_benefit": full_benefit,
    "benefits": [full_benefit * a for a in adoption],
    "build_cf": build, "build_npv": round(npv(build)), "build_roi": round((total_benefit - total_cost_build) / total_cost_build * 100, 1),
    "build_payback_years": payback(build),
    "saas_year": saas_year, "saas_cf": saas, "saas_npv": round(npv(saas)),
    "saas_roi": round((total_benefit - 3 * saas_year) / (3 * saas_year) * 100, 1),
}
# sensitivity: NPV if adoption is half, or dev hours double
half = [-dev_cost] + [full_benefit * a * 0.5 - ops_year for a in adoption]
double = [-2 * dev_cost] + [full_benefit * a - ops_year for a in adoption]
out["business"]["npv_half_benefit"] = round(npv(half))
out["business"]["npv_double_dev"] = round(npv(double))
# break-even meetings/week for NPV=0 (3y)
lo, hi = 0.0, 40.0
for _ in range(60):
    mid = (lo + hi) / 2
    fb = mid * 48 * hours_saved * value_hour
    v = npv([-dev_cost] + [fb * a - ops_year for a in adoption])
    lo, hi = (mid, hi) if v < 0 else (lo, mid)
out["business"]["breakeven_meetings_per_week"] = round(hi, 1)

# ---------------- CPM (durations in working days: ESTIMATES)
tasks = [
    ("A", "Khởi động: charter, backlog, yêu cầu & UI/UX", 5, []),
    ("B", "Kiến trúc + môi trường dev", 3, ["A"]),
    ("C", "T1.1 Ghi âm trên trình duyệt + gửi chunk", 8, ["B"]),
    ("D", "T1.2 Offline/mobile (IndexedDB, đồng bộ)", 6, ["C"]),
    ("E", "T1.3 Upload file lớn + chuẩn hoá audio", 6, ["B"]),
    ("F", "STT Whisper, transcript ngôn ngữ gốc", 8, ["B"]),
    ("G", "Phiên âm live", 5, ["C", "F"]),
    ("H", "Benchmark model LLM (Sprint 2)", 4, ["A"]),
    ("I", "#68 Model + prompt tóm tắt", 3, ["H"]),
    ("J", "#69 Transcript dài (map-reduce)", 3, ["I"]),
    ("K", "#70 Bước tóm tắt, lưu trữ, API", 4, ["I", "F"]),
    ("L", "#71 Tab Summary + Regenerate", 3, ["K"]),
    ("M", "#61 Model dịch", 3, ["H"]),
    ("N", "#62 Lưu bản dịch + API", 3, ["M"]),
    ("O", "#63 Bước dịch có tiến độ", 3, ["M", "N"]),
    ("P", "#64 Chọn ngôn ngữ + song ngữ", 3, ["O"]),
    ("Q", "#65 Xuất TXT/SRT", 2, ["N"]),
    ("R", "#66/#72 Đánh giá chất lượng", 3, ["J", "O"]),
    ("S", "#99/#100 Test E2E Sprint 3", 4, ["L", "P", "Q"]),
    ("T", "App desktop (Electron, PyInstaller)", 5, ["G"]),
    ("U", "Streaming + STT remote", 5, ["G"]),
    ("V", "Deploy AWS (Docker, S3, hướng dẫn)", 4, ["U"]),
    ("W", "UAT, phát hành, đóng dự án", 3, ["S", "T", "V", "R", "D", "E"]),
]
info = {t[0]: {"name": t[1], "d": t[2], "pred": t[3]} for t in tasks}
order = [t[0] for t in tasks]
for k in order:
    i = info[k]
    i["es"] = max((info[p]["ef"] for p in i["pred"]), default=0)
    i["ef"] = i["es"] + i["d"]
end = max(i["ef"] for i in info.values())
for k in reversed(order):
    i = info[k]
    succ = [s for s in order if k in info[s]["pred"]]
    i["lf"] = min((info[s]["ls"] for s in succ), default=end)
    i["ls"] = i["lf"] - i["d"]
    i["slack"] = i["ls"] - i["es"]
critical = [k for k in order if info[k]["slack"] == 0]
out["cpm"] = {"end": end, "critical": critical, "tasks": {k: {x: info[k][x] for x in ("name", "d", "pred", "es", "ef", "ls", "lf", "slack")} for k in order}}

print(json.dumps(out, ensure_ascii=False, indent=1))
