import { useState, useEffect, useMemo, useRef } from "react";
import HISTORICAL from "./history.js";

const SERVICES = [
  { id: "trim", label: "Trim", desc: "Clean trim, lined up", price: 15 },
  { id: "fade", label: "Fade / Taper + Trim", desc: "Fade or taper with trim", price: 20 },
];

const ADMIN_PIN = "1234";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DEFAULT_AVAILABILITY = {
  0: null,
  1: { start: 9, end: 19 },
  2: { start: 9, end: 19 },
  3: { start: 9, end: 19 },
  4: { start: 9, end: 19 },
  5: { start: 9, end: 19 },
  6: { start: 10, end: 16 },
};

const HOUR_OPTIONS = [];
for (let h = 7; h <= 21; h++) HOUR_OPTIONS.push(h);
const fmtHour = (h) => `${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`;

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => toISO(new Date());
const fmtDate = (iso) => { const d = new Date(iso + "T12:00:00"); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; };
const isoWeek = (iso) => { const d = new Date(iso + "T12:00:00"); const j = new Date(d.getFullYear(), 0, 1); return `${d.getFullYear()}-W${String(Math.ceil(((d - j) / 864e5 + j.getDay() + 1) / 7)).padStart(2, "0")}`; };
const isoMonth = (iso) => iso.slice(0, 7);

function genSlots(start, end) {
  const slots = [];
  for (let h = start; h < end; h++) {
    slots.push(`${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`);
    slots.push(`${h > 12 ? h - 12 : h === 0 ? 12 : h}:30 ${h >= 12 ? "PM" : "AM"}`);
  }
  return slots;
}

function sGet(k) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } }
function sSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error(e); } }

const gold = "#C9A84C", goldDim = "#A8893A", bg = "#0D0D0D", card = "#161616", card2 = "#1E1E1E", border = "#2A2A2A", textMain = "#F0EBE0", textDim = "#8A8578";
const font = `'Playfair Display', serif`, sans = `'DM Sans', sans-serif`;

export default function App() {
  const [view, setView] = useState("book");
  const [bookings, setBookings] = useState([]);
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [overrides, setOverrides] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", service: "", date: todayISO(), time: "" });
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [adminTab, setAdminTab] = useState("dashboard");
  const [dashRange, setDashRange] = useState("week");
  const [animIn, setAnimIn] = useState(true);
  const [schedEditDay, setSchedEditDay] = useState(null);
  const [overrideDate, setOverrideDate] = useState("");
  const tapRef = useRef({ count: 0, timer: null });

  useEffect(() => {
    const b = sGet("bookings_v3") || [], a = sGet("availability_v2"), o = sGet("overrides_v2");
    // merge historical + new bookings, dedup by id
    const ids = new Set(b.map(x => x.id));
    const merged = [...HISTORICAL.filter(x => !ids.has(x.id)), ...b];
    setBookings(merged);
    if (a) setAvailability(a);
    if (o) setOverrides(o);
    setLoaded(true);
  }, []);

  const saveB = (b) => { setBookings(b); sSet("bookings_v3", b); };
  const saveA = (a) => { setAvailability(a); sSet("availability_v2", a); };
  const saveO = (o) => { setOverrides(o); sSet("overrides_v2", o); };

  const transition = (next) => { setAnimIn(false); setTimeout(() => { setView(next); setAnimIn(true); }, 220); };

  const handleLogoTap = () => {
    tapRef.current.count++;
    clearTimeout(tapRef.current.timer);
    if (tapRef.current.count >= 5) { tapRef.current.count = 0; transition(view.startsWith("admin") ? "book" : "admin-login"); }
    else tapRef.current.timer = setTimeout(() => (tapRef.current.count = 0), 1200);
  };

  const getSlotsForDate = (iso) => {
    if (overrides[iso] !== undefined) {
      if (overrides[iso] === null) return [];
      return genSlots(overrides[iso].start, overrides[iso].end);
    }
    const dow = new Date(iso + "T12:00:00").getDay();
    const sched = availability[dow];
    if (!sched) return [];
    return genSlots(sched.start, sched.end);
  };

  const takenSlots = useMemo(() => bookings.filter((b) => b.date === form.date && b.status !== "cancelled").map((b) => b.time), [bookings, form.date]);
  const dateSlots = useMemo(() => getSlotsForDate(form.date), [form.date, availability, overrides]);
  const canSubmit = form.name && form.phone && form.service && form.date && form.time;

  const handleBook = () => {
    const entry = { ...form, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), status: "confirmed" };
    saveB([...bookings, entry]);
    transition("success");
  };
  const cancelBooking = (id) => saveB(bookings.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
  const deleteBooking = (id) => saveB(bookings.filter((b) => b.id !== id));

  const calDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 30; i++) { const d = new Date(); d.setDate(d.getDate() + i); days.push(toISO(d)); }
    return days;
  }, []);

  const isDayAvailable = (iso) => {
    if (overrides[iso] !== undefined) return overrides[iso] !== null;
    const dow = new Date(iso + "T12:00:00").getDay();
    return availability[dow] !== null;
  };

  const active = bookings.filter((b) => b.status !== "cancelled");
  const analytics = useMemo(() => {
    const now = todayISO(), nowW = isoWeek(now), nowM = isoMonth(now);
    let f = active;
    if (dashRange === "day") f = active.filter((b) => b.date === now);
    else if (dashRange === "week") f = active.filter((b) => isoWeek(b.date) === nowW);
    else if (dashRange === "month") f = active.filter((b) => isoMonth(b.date) === nowM);
    const cuts = f.length, trims = f.filter((b) => b.service === "trim").length, fades = f.filter((b) => b.service === "fade").length;
    const revenue = f.reduce((s, b) => s + (SERVICES.find((sv) => sv.id === b.service)?.price || 0), 0);
    const daily = [], weekly = [], monthly = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const iso = toISO(d); const db = active.filter((b) => b.date === iso); daily.push({ label: DAYS[d.getDay()], cuts: db.length, revenue: db.reduce((s, b) => s + (SERVICES.find((sv) => sv.id === b.service)?.price || 0), 0) }); }
    for (let i = 3; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i * 7); const wk = isoWeek(toISO(d)); const wb = active.filter((b) => isoWeek(b.date) === wk); weekly.push({ label: `Wk ${wk.split("-W")[1]}`, cuts: wb.length, revenue: wb.reduce((s, b) => s + (SERVICES.find((sv) => sv.id === b.service)?.price || 0), 0) }); }
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const mo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; const mb = active.filter((b) => isoMonth(b.date) === mo); monthly.push({ label: MONTHS[d.getMonth()], cuts: mb.length, revenue: mb.reduce((s, b) => s + (SERVICES.find((sv) => sv.id === b.service)?.price || 0), 0) }); }
    return { cuts, trims, fades, revenue, daily, weekly, monthly };
  }, [active, dashRange]);

  const BarChart = ({ data, valueKey, color, label }) => {
    const max = Math.max(...data.map((d) => d[valueKey]), 1);
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: textDim, marginBottom: 8, fontFamily: sans, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: textMain, fontFamily: sans }}>{valueKey === "revenue" ? `$${d[valueKey]}` : d[valueKey]}</span>
              <div style={{ width: "100%", maxWidth: 40, borderRadius: 4, height: `${Math.max((d[valueKey] / max) * 90, 4)}px`, background: `linear-gradient(180deg, ${color}, ${color}88)`, transition: "height .5s cubic-bezier(.4,0,.2,1)" }} />
              <span style={{ fontSize: 9, color: textDim, fontFamily: sans }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!loaded) return <div style={{ background: bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: gold, fontFamily: font, fontSize: 22, animation: "pulse 1.5s ease infinite" }}>Loading...</div></div>;

  const selectStyle = { padding: "10px 14px", borderRadius: 8, border: `1px solid ${border}`, background: card, color: textMain, fontSize: 14, outline: "none", cursor: "pointer" };

  const shell = (children, isAdmin = false) => (
    <div style={{ background: bg, minHeight: "100vh", fontFamily: sans, color: textMain }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${bg}; }
        input, button, select { font-family: ${sans}; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${bg}; } ::-webkit-scrollbar-thumb { background: ${border}; border-radius: 3px; }
        ::selection { background: ${gold}33; color: ${gold}; }
      `}</style>
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderBottom: `1px solid ${border}` }}>
        <div onClick={handleLogoTap} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${gold}, ${goldDim})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: bg }}>IG</div>
          <span style={{ fontFamily: font, fontSize: 20, fontWeight: 600, color: textMain, letterSpacing: .5 }}>BLENDZZ</span>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 6 }}>
            {["dashboard", "upcoming", "bookings", "schedule"].map((t) => (
              <button key={t} onClick={() => setAdminTab(t)} style={{
                padding: "8px 16px", borderRadius: 8, border: adminTab === t ? "none" : `1px solid ${border}`,
                background: adminTab === t ? card2 : "transparent", color: adminTab === t ? textMain : textDim,
                fontSize: 13, fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
              }}>{t}</button>
            ))}
            <button onClick={() => transition("book")} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: textDim, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>✕ Exit</button>
          </div>
        )}
      </nav>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px", opacity: animIn ? 1 : 0, transform: animIn ? "translateY(0)" : "translateY(12px)", transition: "all .25s ease" }}>
        {children}
      </div>
    </div>
  );

  // ═══════ BOOK ═══════
  if (view === "book") return shell(
    <div>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h1 style={{ fontFamily: font, fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>Book Your Cut</h1>
        <p style={{ color: textDim, fontSize: 14, marginTop: 8 }}>Select your service and pick a time.</p>
      </div>
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, display: "block" }}>Service</label>
        <div style={{ display: "flex", gap: 12 }}>
          {SERVICES.map((s) => (
            <button key={s.id} onClick={() => setForm({ ...form, service: s.id })} style={{
              flex: 1, padding: "20px 16px", borderRadius: 12, cursor: "pointer", transition: "all .2s", textAlign: "left",
              background: form.service === s.id ? `${gold}15` : card, border: form.service === s.id ? `2px solid ${gold}` : `1px solid ${border}`,
              color: form.service === s.id ? gold : textMain,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: textDim, marginTop: 4 }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, display: "block" }}>Date</label>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
          {calDays.map((iso) => {
            const d = new Date(iso + "T12:00:00"); const avail = isDayAvailable(iso); const sel = form.date === iso;
            return (
              <button key={iso} disabled={!avail} onClick={() => setForm({ ...form, date: iso, time: "" })} style={{
                minWidth: 62, padding: "12px 8px", borderRadius: 12, cursor: avail ? "pointer" : "not-allowed", transition: "all .15s",
                background: sel ? gold : avail ? card : `${card}66`, border: sel ? "none" : `1px solid ${avail ? border : border + "44"}`,
                color: sel ? bg : avail ? textMain : textDim + "55", textAlign: "center", opacity: avail ? 1 : 0.35, flexShrink: 0,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{DAYS[d.getDay()]}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{d.getDate()}</div>
                <div style={{ fontSize: 10, marginTop: 2 }}>{MONTHS[d.getMonth()]}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, display: "block" }}>Time</label>
        {dateSlots.length === 0 ? (
          <div style={{ padding: "24px", background: card, borderRadius: 12, border: `1px solid ${border}`, textAlign: "center", color: textDim, fontSize: 13 }}>Not available on this day.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
            {dateSlots.map((t) => {
              const taken = takenSlots.includes(t);
              return (
                <button key={t} disabled={taken} onClick={() => setForm({ ...form, time: t })} style={{
                  padding: "10px 8px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: taken ? "not-allowed" : "pointer", transition: "all .15s",
                  background: form.time === t ? gold : taken ? `${card}88` : card, border: form.time === t ? "none" : `1px solid ${taken ? border + "55" : border}`,
                  color: form.time === t ? bg : taken ? textDim + "66" : textMain, opacity: taken ? 0.4 : 1,
                }}>{t}</button>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        <div>
          <label style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, display: "block" }}>Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: `1px solid ${border}`, background: card, color: textMain, fontSize: 15, outline: "none" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, display: "block" }}>Phone</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(xxx) xxx-xxxx" style={{ width: "100%", padding: "14px 16px", borderRadius: 10, border: `1px solid ${border}`, background: card, color: textMain, fontSize: 15, outline: "none" }} />
        </div>
      </div>
      <button disabled={!canSubmit} onClick={() => transition("confirm")} style={{
        width: "100%", padding: "16px", borderRadius: 12, border: "none", fontSize: 16, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed",
        background: canSubmit ? `linear-gradient(135deg, ${gold}, ${goldDim})` : border, color: canSubmit ? bg : textDim, transition: "all .2s",
        boxShadow: canSubmit ? `0 4px 24px ${gold}33` : "none",
      }}>Continue</button>
    </div>
  );

  // ═══════ CONFIRM ═══════
  if (view === "confirm") return shell(
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ fontFamily: font, fontSize: 28, fontWeight: 700, marginBottom: 24, textAlign: "center" }}>Confirm Booking</h2>
      <div style={{ background: card, borderRadius: 16, padding: 28, border: `1px solid ${border}` }}>
        {[["Service", SERVICES.find((s) => s.id === form.service)?.label], ["Date", fmtDate(form.date)], ["Time", form.time], ["Name", form.name], ["Phone", form.phone]].map(([l, v], i) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: i < 4 ? `1px solid ${border}` : "none" }}>
            <span style={{ color: textDim, fontSize: 13 }}>{l}</span><span style={{ fontWeight: 600, fontSize: 14 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button onClick={() => transition("book")} style={{ flex: 1, padding: "14px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: textDim, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Back</button>
        <button onClick={handleBook} style={{ flex: 2, padding: "14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${gold}, ${goldDim})`, color: bg, fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: `0 4px 24px ${gold}33` }}>Confirm</button>
      </div>
    </div>
  );

  // ═══════ SUCCESS ═══════
  if (view === "success") return shell(
    <div style={{ textAlign: "center", maxWidth: 440, margin: "40px auto" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${gold}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", border: `2px solid ${gold}` }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontFamily: font, fontSize: 28, fontWeight: 700, marginBottom: 12 }}>You're Booked</h2>
      <p style={{ color: textDim, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>{fmtDate(form.date)} at {form.time}<br />See you then.</p>
      <button onClick={() => { setForm({ name: "", phone: "", service: "", date: todayISO(), time: "" }); transition("book"); }} style={{ padding: "14px 36px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: textMain, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Book Another</button>
    </div>
  );

  // ═══════ ADMIN LOGIN ═══════
  if (view === "admin-login") return shell(
    <div style={{ maxWidth: 360, margin: "60px auto", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: `${gold}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: `1px solid ${gold}33` }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <h2 style={{ fontFamily: font, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Dashboard Access</h2>
      <p style={{ color: textDim, fontSize: 13, marginBottom: 24 }}>Enter your PIN</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 48, height: 56, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: card, border: `1px solid ${pinErr ? "#E8443188" : pin.length > i ? gold : border}`, fontSize: 22, fontWeight: 700, color: textMain, transition: "all .2s" }}>{pin[i] ? "•" : ""}</div>
        ))}
      </div>
      {pinErr && <p style={{ color: "#E84431", fontSize: 12, marginBottom: 12 }}>Wrong PIN. Try again.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 220, margin: "0 auto" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"].map((n, i) => (
          n === null ? <div key={i} /> :
          <button key={i} onClick={() => {
            if (n === "⌫") { setPin(pin.slice(0, -1)); setPinErr(false); }
            else if (pin.length < 4) {
              const next = pin + n; setPin(next); setPinErr(false);
              if (next.length === 4) { if (next === ADMIN_PIN) { setPin(""); transition("admin"); } else setTimeout(() => { setPinErr(true); setPin(""); }, 200); }
            }
          }} style={{ width: "100%", aspectRatio: "1.3", borderRadius: 10, border: `1px solid ${border}`, background: card, color: textMain, fontSize: n === "⌫" ? 16 : 20, fontWeight: 600, cursor: "pointer" }}>{n}</button>
        ))}
      </div>
    </div>
  );

  // ═══════ ADMIN ═══════
  if (view === "admin") return shell(
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <h1 style={{ fontFamily: font, fontSize: 28, fontWeight: 700 }}>Dashboard</h1>
      </div>

      {adminTab === "dashboard" && (
        <div style={{ animation: "fadeUp .35s ease" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 24, background: card, borderRadius: 10, padding: 4, width: "fit-content" }}>
            {["day", "week", "month", "all"].map((r) => (
              <button key={r} onClick={() => setDashRange(r)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", background: dashRange === r ? gold : "transparent", color: dashRange === r ? bg : textDim, transition: "all .2s" }}>
                {r === "all" ? "All Time" : `This ${r.charAt(0).toUpperCase() + r.slice(1)}`}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
            {[{ label: "Total Cuts", val: analytics.cuts }, { label: "Trims", val: analytics.trims }, { label: "Fades", val: analytics.fades }, { label: "Revenue", val: `$${analytics.revenue}`, accent: true }].map((s) => (
              <div key={s.label} style={{ background: s.accent ? `linear-gradient(135deg, ${gold}12, ${gold}06)` : card, borderRadius: 14, padding: "22px 20px", border: `1px solid ${s.accent ? gold + "33" : border}` }}>
                <div style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: font, color: s.accent ? gold : textMain }}>{s.val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={{ background: card, borderRadius: 14, padding: 20, border: `1px solid ${border}` }}><BarChart data={analytics.daily} valueKey="cuts" color={gold} label="Cuts · Last 7 Days" /></div>
            <div style={{ background: card, borderRadius: 14, padding: 20, border: `1px solid ${border}` }}><BarChart data={analytics.daily} valueKey="revenue" color="#5BA87D" label="Revenue · Last 7 Days" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: card, borderRadius: 14, padding: 20, border: `1px solid ${border}` }}><BarChart data={analytics.weekly} valueKey="cuts" color={gold} label="Cuts · Last 4 Weeks" /></div>
            <div style={{ background: card, borderRadius: 14, padding: 20, border: `1px solid ${border}` }}><BarChart data={analytics.monthly} valueKey="revenue" color="#5BA87D" label="Revenue · Last 6 Months" /></div>
          </div>
        </div>
      )}

      {adminTab === "bookings" && (
        <div style={{ animation: "fadeUp .35s ease" }}>
          {bookings.length === 0 ? <div style={{ textAlign: "center", padding: "60px 0", color: textDim }}>No bookings yet.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...bookings].reverse().map((b) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: card, borderRadius: 12, border: `1px solid ${border}`, opacity: b.status === "cancelled" ? 0.4 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name} <span style={{ fontWeight: 400, color: textDim }}>· {b.phone}</span></div>
                    <div style={{ fontSize: 12, color: textDim, marginTop: 4 }}>{fmtDate(b.date)} · {b.time} · {SERVICES.find((s) => s.id === b.service)?.label}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, background: b.status === "cancelled" ? "#E8443115" : `${gold}15`, color: b.status === "cancelled" ? "#E84431" : gold }}>{b.status}</span>
                    {b.status !== "cancelled" && <button onClick={() => cancelBooking(b.id)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: textDim, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>}
                    <button onClick={() => deleteBooking(b.id)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid #E8443133`, background: "transparent", color: "#E84431", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {adminTab === "upcoming" && (() => {
        const now = todayISO();
        const upcoming = active.filter(b => b.date >= now).sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));
        const grouped = {};
        upcoming.forEach(b => { if (!grouped[b.date]) grouped[b.date] = []; grouped[b.date].push(b); });
        const dates = Object.keys(grouped).sort();
        return (
          <div style={{ animation: "fadeUp .35s ease" }}>
            {dates.length === 0 ? <div style={{ textAlign: "center", padding: "60px 0", color: textDim }}>No upcoming appointments.</div> : (
              dates.map(date => (
                <div key={date} style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <h3 style={{ fontFamily: font, fontSize: 18, fontWeight: 600 }}>{fmtDate(date)}</h3>
                    <span style={{ fontSize: 12, color: gold, background: `${gold}15`, padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>{grouped[date].length} cut{grouped[date].length > 1 ? "s" : ""}</span>
                    {date === now && <span style={{ fontSize: 11, color: "#5BA87D", background: "#5BA87D15", padding: "3px 10px", borderRadius: 6, fontWeight: 600 }}>TODAY</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grouped[date].sort((a, b) => {
                      const toMin = (t) => { const [time, ap] = t.split(" "); let [h, m] = time.split(":").map(Number); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return h * 60 + m; };
                      return toMin(a.time) - toMin(b.time);
                    }).map(b => (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", padding: "14px 18px", background: card, borderRadius: 12, border: `1px solid ${border}`, gap: 16 }}>
                        <div style={{ minWidth: 80, fontWeight: 700, fontSize: 14, color: gold }}>{b.time}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                          <div style={{ fontSize: 12, color: textDim, marginTop: 2 }}>{SERVICES.find(s => s.id === b.service)?.label}{b.phone ? ` · ${b.phone}` : ""}</div>
                        </div>
                        <button onClick={() => cancelBooking(b.id)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: textDim, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })()}

      {adminTab === "schedule" && (
        <div style={{ animation: "fadeUp .35s ease" }}>
          <div style={{ marginBottom: 36 }}>
            <h3 style={{ fontFamily: font, fontSize: 20, fontWeight: 600, marginBottom: 16 }}>General Availability</h3>
            <p style={{ color: textDim, fontSize: 13, marginBottom: 16 }}>Your default weekly hours. Clients can only book during these windows.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                const sched = availability[dow]; const editing = schedEditDay === dow;
                return (
                  <div key={dow} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: card, borderRadius: 12, border: `1px solid ${border}`, flexWrap: "wrap" }}>
                    <div style={{ width: 90, fontWeight: 600, fontSize: 14 }}>{DAYS_FULL[dow]}</div>
                    {editing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" }}>
                        <select value={sched ? sched.start : 9} onChange={(e) => { const v = parseInt(e.target.value); setAvailability({ ...availability, [dow]: { start: v, end: sched ? Math.max(sched.end, v + 1) : v + 4 } }); }} style={selectStyle}>
                          {HOUR_OPTIONS.slice(0, -1).map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                        </select>
                        <span style={{ color: textDim }}>to</span>
                        <select value={sched ? sched.end : 19} onChange={(e) => { setAvailability({ ...availability, [dow]: { start: sched ? sched.start : 9, end: parseInt(e.target.value) } }); }} style={selectStyle}>
                          {HOUR_OPTIONS.filter((h) => h > (sched ? sched.start : 9)).map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                        </select>
                        <button onClick={() => { saveA(availability); setSchedEditDay(null); }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: gold, color: bg, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: sched ? textMain : textDim }}>{sched ? `${fmtHour(sched.start)} – ${fmtHour(sched.end)}` : "Unavailable"}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setSchedEditDay(dow)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: textDim, fontSize: 12, cursor: "pointer" }}>Edit</button>
                          <button onClick={() => { const a = { ...availability, [dow]: sched ? null : { start: 9, end: 19 } }; setAvailability(a); saveA(a); }} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${sched ? "#E8443133" : gold + "33"}`, background: "transparent", color: sched ? "#E84431" : gold, fontSize: 12, cursor: "pointer" }}>
                            {sched ? "Set Off" : "Set On"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 style={{ fontFamily: font, fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Date Overrides</h3>
            <p style={{ color: textDim, fontSize: 13, marginBottom: 16 }}>Block off specific dates or set custom hours that override your weekly schedule.</p>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 11, color: textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, display: "block" }}>Date</label>
                <input type="date" value={overrideDate} min={todayISO()} onChange={(e) => setOverrideDate(e.target.value)} style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${border}`, background: card, color: textMain, fontSize: 14, outline: "none" }} />
              </div>
              <button onClick={() => { if (!overrideDate) return; saveO({ ...overrides, [overrideDate]: null }); }} style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid #E8443155`, background: "#E8443115", color: "#E84431", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Block Day Off</button>
              <button onClick={() => { if (!overrideDate) return; saveO({ ...overrides, [overrideDate]: { start: 9, end: 17 } }); }} style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${gold}55`, background: `${gold}15`, color: gold, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Custom Hours</button>
            </div>
            {Object.keys(overrides).length === 0 ? (
              <div style={{ padding: "24px", background: card, borderRadius: 12, border: `1px solid ${border}`, textAlign: "center", color: textDim, fontSize: 13 }}>No overrides set.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)).map(([date, val]) => (
                  <div key={date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: card, borderRadius: 12, border: `1px solid ${border}`, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{fmtDate(date)}</span>
                      <span style={{ color: val === null ? "#E84431" : gold, fontSize: 12, marginLeft: 12 }}>{val === null ? "Blocked Off" : `${fmtHour(val.start)} – ${fmtHour(val.end)}`}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {val !== null && (
                        <>
                          <select value={val.start} onChange={(e) => saveO({ ...overrides, [date]: { ...val, start: parseInt(e.target.value) } })} style={{ ...selectStyle, padding: "6px 10px", fontSize: 12 }}>
                            {HOUR_OPTIONS.slice(0, -1).map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                          </select>
                          <span style={{ color: textDim, fontSize: 12 }}>to</span>
                          <select value={val.end} onChange={(e) => saveO({ ...overrides, [date]: { ...val, end: parseInt(e.target.value) } })} style={{ ...selectStyle, padding: "6px 10px", fontSize: 12 }}>
                            {HOUR_OPTIONS.filter((h) => h > val.start).map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                          </select>
                        </>
                      )}
                      <button onClick={() => { const o = { ...overrides }; delete o[date]; saveO(o); }} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid #E8443133`, background: "transparent", color: "#E84431", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    true
  );

  return null;
}
