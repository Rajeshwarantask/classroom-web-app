import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import { LoadingScreen } from './components/ui/AppStates';
import { env } from './config/env';
import './App.css';

const demoRooms = [
  { id: 'a', code: 'A-101', name: 'Orchard Hall', building: 'North Campus', floor: 1, capacity: 42, equipment: ['Projector', 'Whiteboard'] },
  { id: 'b', code: 'B-204', name: 'Maple Lab', building: 'Science Block', floor: 2, capacity: 28, equipment: ['Computers', 'Projector'] },
  { id: 'c', code: 'C-310', name: 'Harbor Room', building: 'Arts Centre', floor: 3, capacity: 18, equipment: ['Video conferencing'] },
  { id: 'd', code: 'D-112', name: 'Cedar Studio', building: 'Design Annex', floor: 1, capacity: 16, equipment: ['Whiteboard', 'Flexible seating'] },
];

const nav = [
  ['overview', 'Overview', '◒'], ['rooms', 'Find a room', '⌂'], ['bookings', 'My bookings', '▣'], ['timetable', 'Timetable', '▦'], ['analytics', 'Analytics', '◫'],
];

function App() {
  const { session, loading, signOut } = useAuth();
  const [page, setPage] = useState('overview');
  const [rooms, setRooms] = useState(demoRooms);
  const [bookings, setBookings] = useState([]);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [toast, setToast] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!session) return;
    loadData();
  }, [session]);

  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); } }, [toast]);

  async function loadData() {
    const [{ data: roomRows }, { data: bookingRows }] = await Promise.all([
      supabase.from('rooms').select('id,code,name,building,floor,capacity,equipment').order('code'),
      supabase.from('bookings').select('id,room_id,title,purpose,starts_at,ends_at,status,confirmation_code,checked_in_at').order('starts_at', { ascending: true }),
    ]);
    if (roomRows?.length) setRooms(roomRows);
    if (bookingRows) setBookings(bookingRows);
  }

  async function authenticate(event) {
    event.preventDefault(); setAuthBusy(true); setAuthError('');
    const action = authMode === 'signin' ? supabase.auth.signInWithPassword(authForm) : supabase.auth.signUp({ ...authForm, options: { emailRedirectTo: env.authRedirectUrl || window.location.origin + '/auth/callback' } });
    const { error } = await action;
    if (error) setAuthError(error.message.includes('Invalid') ? 'Invalid email or password.' : error.message);
    else if (authMode === 'signup') setAuthError('Check your inbox to confirm your account.');
    setAuthBusy(false);
  }

  async function createBooking(form) {
    const start = new Date(`${form.date}T${form.start}:00`);
    const end = new Date(`${form.date}T${form.end}:00`);
    if (end <= start) return setToast('End time must be after the start time.');
    const collision = bookings.some((b) => b.room_id === selectedRoom.id && b.status !== 'cancelled' && new Date(b.starts_at) < end && new Date(b.ends_at) > start);
    if (collision) return setToast('That room is already reserved for this window.');
    if (!session) return;
    const confirmation = `CLS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data, error } = await supabase.from('bookings').insert({ room_id: selectedRoom.id, user_id: session.user.id, title: form.title.trim(), purpose: form.purpose.trim(), starts_at: start.toISOString(), ends_at: end.toISOString(), confirmation_code: confirmation }).select().single();
    if (error) return setToast(error.code === '23505' ? 'Someone just booked this room. Try another time.' : 'Could not create the reservation.');
    setBookings((current) => [...current, data].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
    setShowBooking(false); setToast(`Reservation confirmed · ${confirmation}`); setPage('bookings');
  }

  async function cancelBooking(booking) {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id).eq('user_id', session.user.id);
    if (error) return setToast('Could not cancel this reservation.');
    setBookings((current) => current.map((b) => b.id === booking.id ? { ...b, status: 'cancelled' } : b)); setToast('Reservation cancelled.');
  }

  async function checkIn(code) {
    const booking = bookings.find((b) => b.confirmation_code.toLowerCase() === code.toLowerCase() && b.status === 'confirmed');
    if (!booking) return setToast('No active reservation matches that code.');
    const { error } = await supabase.from('bookings').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', booking.id);
    if (error) return setToast('Check-in could not be completed.');
    setBookings((current) => current.map((b) => b.id === booking.id ? { ...b, status: 'checked_in', checked_in_at: new Date().toISOString() } : b)); setToast('Checked in. The room is now marked occupied.');
  }

  if (loading) return <LoadingScreen />;
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} onSubmit={authenticate} busy={authBusy} error={authError} />;

  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">N</span><span>northstar</span></div>
      <div className="workspace"><span className="workspace-dot" /> <span>Campus operations</span><span className="chevron">⌄</span></div>
      <nav>{nav.map(([id, label, icon]) => <button className={page === id ? 'nav-item active' : 'nav-item'} onClick={() => setPage(id)} key={id}><span>{icon}</span>{label}{id === 'bookings' && activeBookings.length > 0 && <b>{activeBookings.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="spark">✦</span><strong>Need a hand?</strong><p>Read the quick start guide or contact your campus admin.</p><button>Open help centre ↗</button></div><button className="profile-button" onClick={signOut}><span className="avatar">{(session.user.email || 'U')[0].toUpperCase()}</span><span><strong>{session.user.email?.split('@')[0]}</strong><small>Sign out</small></span><span className="more">•••</span></button></div>
    </aside>
    <main className="main"><header><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1>{page === 'overview' ? 'Good morning' : nav.find((n) => n[0] === page)?.[1]}</h1></div><div className="header-actions"><button className="icon-button">⌕</button><button className="icon-button notification">♢<i /></button><button className="primary-button" onClick={() => { setSelectedRoom(null); setShowBooking(true); }}>+ Reserve a room</button></div></header>
      {page === 'overview' && <Overview rooms={rooms} bookings={activeBookings} onReserve={(room) => { setSelectedRoom(room); setShowBooking(true); }} onCheckIn={checkIn} />}
      {page === 'rooms' && <Rooms rooms={rooms} bookings={activeBookings} onReserve={(room) => { setSelectedRoom(room); setShowBooking(true); }} />}
      {page === 'bookings' && <Bookings bookings={bookings} rooms={rooms} onCancel={cancelBooking} />}
      {page === 'timetable' && <Timetable rooms={rooms} bookings={activeBookings} />}
      {page === 'analytics' && <Analytics rooms={rooms} bookings={activeBookings} />}
    </main>
    {showBooking && <BookingModal rooms={rooms} selectedRoom={selectedRoom} onClose={() => setShowBooking(false)} onSubmit={createBooking} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function AuthScreen({ mode, setMode, form, setForm, onSubmit, busy, error }) { return <div className="auth-screen"><div className="auth-panel"><div className="brand"><span className="brand-mark">N</span><span>northstar</span></div><div className="auth-copy"><p className="eyebrow">CAMPUS OPERATIONS</p><h1>Make every room<br /><em>work harder.</em></h1><p>One calm place to find, reserve, and activate the spaces your campus depends on.</p></div><div className="auth-note"><span>↗</span><div><strong>Designed for the in-between moments</strong><p>From a last-minute tutorial to a packed week of labs.</p></div></div></div><form className="auth-form" onSubmit={onSubmit}><p className="eyebrow">WELCOME BACK</p><h2>{mode === 'signin' ? 'Sign in to Northstar' : 'Create your account'}</h2><p className="muted">{mode === 'signin' ? 'Your campus, in one view.' : 'Use your campus email to get started.'}</p><label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@university.edu" /></label><label>Password<input type="password" minLength="6" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></label>{error && <div className={error.startsWith('Check') ? 'auth-success' : 'auth-error'}>{error}</div>}<button className="primary-button full" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Continue →' : 'Create account →'}</button><p className="switch-auth">{mode === 'signin' ? 'New to Northstar?' : 'Already have an account?'} <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p></form></div> }

function Overview({ rooms, bookings, onReserve, onCheckIn }) { const [code, setCode] = useState(''); const today = bookings.filter((b) => new Date(b.starts_at).toDateString() === new Date().toDateString()); return <section className="page-content"><div className="hero-grid"><div className="hero-card"><div><span className="pill mint">LIVE CAMPUS VIEW</span><h2>Space to think.<br /><em>Room to grow.</em></h2><p>See what’s free right now, or plan ahead with a reservation.</p></div><div className="hero-orbit"><span>✦</span><span>⌂</span><span>▦</span></div></div><div className="checkin-card"><div className="card-heading"><span className="pill blue">QUICK CHECK-IN</span><span className="status-live">● Live</span></div><h3>Activate your room</h3><p>Enter the 6-character code from your confirmation to check in.</p><div className="checkin-form"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength="10" placeholder="CLS-XXXXXX" /><button onClick={() => { onCheckIn(code); setCode(''); }}>Check in</button></div><small>Checking in keeps occupancy accurate for everyone.</small></div></div><div className="section-header"><div><p className="eyebrow">RIGHT NOW</p><h2>Find your next room</h2></div><button className="text-button" onClick={() => onReserve(rooms[0])}>View all rooms →</button></div><div className="room-grid">{rooms.slice(0, 3).map((room, i) => <RoomCard room={room} key={room.id} index={i} onReserve={onReserve} />)}</div><div className="section-header upcoming"><div><p className="eyebrow">YOUR SCHEDULE</p><h2>Today at a glance</h2></div><span className="muted">{today.length} reservation{today.length === 1 ? '' : 's'}</span></div><div className="schedule-card">{today.length ? today.map((b) => <ScheduleRow key={b.id} booking={b} room={rooms.find((r) => r.id === b.room_id)} />) : <div className="empty-row"><span className="empty-icon">◷</span><div><strong>A clear schedule is a good schedule.</strong><p>You have no reservations today.</p></div></div>}</div></section> }

function RoomCard({ room, onReserve, index }) { return <article className={`room-card room-${index}`}><div className="room-card-top"><span className="room-code">{room.code}</span><span className="available"><i /> Available</span></div><h3>{room.name}</h3><p>{room.building} · Floor {room.floor}</p><div className="room-meta"><span>♙ {room.capacity} seats</span><span>⌁ {room.equipment?.[0] || 'Flexible space'}</span></div><button onClick={() => onReserve(room)}>Reserve this room <span>→</span></button></article> }
function Rooms({ rooms, bookings, onReserve }) { return <section className="page-content"><div className="page-intro"><div><p className="eyebrow">SPACE DIRECTORY</p><h2>Find a room that fits.</h2><p>Every space, its capacity, and the tools inside it.</p></div><div className="filter-row"><button className="filter active">All spaces</button><button className="filter">Available now</button><button className="filter">Capacity</button></div></div><div className="room-grid all-rooms">{rooms.map((room, i) => <RoomCard room={room} key={room.id} index={i % 4} onReserve={onReserve} />)}</div><div className="tip-banner"><span>✦</span><div><strong>Planning a recurring class?</strong><p>Use the timetable to spot conflicts before you reserve a room.</p></div><button>Open timetable →</button></div></section> }
function Bookings({ bookings, rooms, onCancel }) { return <section className="page-content"><div className="page-intro"><div><p className="eyebrow">RESERVATION LOG</p><h2>Your bookings.</h2><p>Confirmations, check-ins, and changes in one place.</p></div></div><div className="booking-list">{bookings.length ? bookings.map((booking) => <article className={`booking-row ${booking.status === 'cancelled' ? 'cancelled' : ''}`} key={booking.id}><div className="date-block"><strong>{new Date(booking.starts_at).toLocaleDateString('en-US', { day: '2-digit' })}</strong><span>{new Date(booking.starts_at).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span></div><div className="booking-info"><div className="booking-title"><h3>{booking.title}</h3><span className={`status ${booking.status}`}>{booking.status.replace('_', ' ')}</span></div><p>{rooms.find((r) => r.id === booking.room_id)?.code || 'Room'} · {new Date(booking.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – {new Date(booking.ends_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p><small>Confirmation <strong>{booking.confirmation_code}</strong></small></div>{booking.status === 'confirmed' && <button className="cancel-button" onClick={() => onCancel(booking)}>Cancel</button>}</article>) : <div className="empty-state"><span>▣</span><h3>No bookings yet.</h3><p>Reserve a room when you’re ready to get started.</p></div>}</div></section> }
function Timetable({ rooms, bookings }) { const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']; return <section className="page-content"><div className="page-intro"><div><p className="eyebrow">CONFLICT-AWARE PLANNING</p><h2>Weekly timetable.</h2><p>A quick view of room activity and your reservations.</p></div><span className="pill mint">● SYNCED JUST NOW</span></div><div className="timetable"><div className="time-head">GMT+1</div>{days.map((day) => <div className="day-head" key={day}>{day}<small>{day === 'Mon' ? 'Today' : ' '}</small></div>)}{['09:00', '10:30', '12:00', '14:00', '15:30'].map((time, row) => <React.Fragment key={time}><div className="time-cell">{time}</div>{days.map((day, col) => { const occupied = (row + col) % 4 === 0; return <div className={occupied ? 'slot occupied' : 'slot'} key={day}><small>{occupied ? rooms[(row + col) % rooms.length].code : 'Free'}</small></div>; })}</React.Fragment>)}</div><div className="logic-note"><span>⌁</span><div><strong>How conflicts are prevented</strong><p>Reservations are checked against overlapping time windows, not just matching start times. This prevents edge-case double bookings when two requests arrive together.</p></div></div></section> }
function Analytics({ rooms, bookings }) { const counts = rooms.map((room) => ({ ...room, count: bookings.filter((b) => b.room_id === room.id).length })); return <section className="page-content"><div className="page-intro"><div><p className="eyebrow">OPERATIONS SIGNALS</p><h2>Space utilization.</h2><p>Turn room activity into a better weekly plan.</p></div></div><div className="metric-grid"><div className="metric-card"><span>Total reservations</span><strong>{bookings.length}</strong><small>Across active spaces</small></div><div className="metric-card highlight"><span>Most requested</span><strong>{counts.sort((a, b) => b.count - a.count)[0]?.code || '—'}</strong><small>Based on your activity</small></div><div className="metric-card"><span>Available spaces</span><strong>{rooms.length}</strong><small>Ready to reserve</small></div></div><div className="utilization-card"><div className="card-heading"><div><p className="eyebrow">ROOM UTILIZATION</p><h3>Reservations by space</h3></div><span className="muted">Current period</span></div>{counts.map((room) => <div className="bar-row" key={room.id}><span>{room.code}</span><div className="bar"><i style={{ width: `${Math.min(100, room.count * 18 + 8)}%` }} /></div><strong>{room.count}</strong></div>)}</div></section> }
function ScheduleRow({ booking, room }) { return <div className="schedule-row"><span className="schedule-time">{new Date(booking.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span><span className="schedule-line" /><div><strong>{booking.title}</strong><p>{room?.code} · {room?.name}</p></div><span className={`status ${booking.status}`}>{booking.status.replace('_', ' ')}</span></div> }
function BookingModal({ rooms, selectedRoom, onClose, onSubmit }) { const [form, setForm] = useState({ room: selectedRoom?.id || rooms[0]?.id, title: '', purpose: '', date: new Date().toISOString().slice(0, 10), start: '09:00', end: '10:00' }); const room = rooms.find((r) => r.id === form.room); return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="booking-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}><div className="modal-heading"><div><p className="eyebrow">NEW RESERVATION</p><h2>Make space for it.</h2></div><button type="button" className="close-button" onClick={onClose}>×</button></div><label>Room<select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}</select><small>{room?.capacity} seats · {room?.equipment?.join(' · ')}</small></label><label>What is this for?<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Design review" /></label><label>Purpose<textarea required rows="2" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Give your teammates a little context..." /></label><div className="form-grid"><label>Date<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label>Starts<input type="time" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label><label>Ends<input type="time" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label></div><div className="modal-footer"><span>We’ll check conflicts before confirming.</span><button className="primary-button">Confirm reservation →</button></div></form></div> }

export default App;
