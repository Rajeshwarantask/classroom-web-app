export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export const DEFAULT_PERIODS = Array.from({ length: 8 }, (_, index) => ({
  index: index + 1,
  label: `Period ${index + 1}`,
  start: 9 * 60 + index * 60,
  end: 10 * 60 + index * 60,
}));

export function intervalOverlaps(leftStart, leftEnd, rightStart, rightEnd) {
  return new Date(leftStart) < new Date(rightEnd) && new Date(leftEnd) > new Date(rightStart);
}

export function isActiveReservation(booking) {
  return ['confirmed', 'checked_in'].includes(booking?.status);
}

export function isPastInterval(start, now = new Date()) {
  return new Date(start).getTime() <= now.getTime();
}

export function hasRoomConflict(roomId, start, end, bookings = [], timetableEntries = [], closures = []) {
  const reservationConflict = bookings.some((booking) => booking.room_id === roomId && isActiveReservation(booking) && intervalOverlaps(start, end, booking.starts_at, booking.ends_at));
  const classConflict = timetableEntries.some((entry) => entry.room_id === roomId && intervalOverlaps(start, end, entry.starts_at, entry.ends_at));
  const closureConflict = closures.some((closure) => closure.room_id === roomId && intervalOverlaps(start, end, closure.starts_at, closure.ends_at));
  return { reservationConflict, classConflict, closureConflict, available: !reservationConflict && !classConflict && !closureConflict };
}

export function filterRooms(rooms, { building = '', floor = '', capacity = '', equipment = '' } = {}) {
  return rooms.filter((room) => room.is_active !== false && room.operational_status !== 'retired')
    .filter((room) => !building || room.building === building)
    .filter((room) => !floor || String(room.floor) === String(floor))
    .filter((room) => !capacity || Number(room.capacity) >= Number(capacity))
    .filter((room) => !equipment || (room.equipment || []).includes(equipment));
}

export function resolveAcademicDay(date, semester) {
  const target = new Date(`${date}T00:00:00Z`);
  const start = new Date(`${semester.start_date}T00:00:00Z`);
  const end = new Date(`${semester.end_date}T23:59:59Z`);
  if (target < start || target > end) return { applicable: false, reason: 'outside_semester' };
  const holiday = (semester.holidays || []).find((day) => day.date === date);
  if (holiday) return { applicable: false, reason: holiday.reason || 'holiday' };
  return { applicable: true, weekday: target.getUTCDay() || 7 };
}

export function facultySchedule(facultyId, entries = []) {
  return entries.filter((entry) => entry.faculty_id === facultyId).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}

export function utilizationSummary(rooms, entries = [], bookings = [], closures = []) {
  const activeRooms = rooms.filter((room) => room.is_active !== false && room.operational_status !== 'retired');
  const teaching = entries.filter((entry) => entry.status !== 'cancelled').length;
  const reserved = bookings.filter(isActiveReservation).length;
  const unavailable = closures.length;
  return { roomCount: activeRooms.length, teachingIntervals: teaching, reservationIntervals: reserved, closureIntervals: unavailable, hasData: teaching + reserved + unavailable > 0 };
}

export function explainAvailability(roomId, start, end, bookings, timetableEntries, closures) {
  const result = hasRoomConflict(roomId, start, end, bookings, timetableEntries, closures);
  if (result.classConflict) return { ...result, reason: 'scheduled_teaching' };
  if (result.closureConflict) return { ...result, reason: 'room_closure' };
  if (result.reservationConflict) return { ...result, reason: 'active_reservation' };
  return { ...result, reason: 'available' };
}

export function formatPeriodTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function getPeriodInterval(periodNumber, duration = 1, periods = DEFAULT_PERIODS) {
  const start = periods.find((period) => period.index === Number(periodNumber));
  const end = periods.find((period) => period.index === Number(periodNumber) + Number(duration) - 1);
  if (!start || !end) return null;
  return { start: formatPeriodTime(start.start), end: formatPeriodTime(end.end), period: start.label, duration: Number(duration) };
}

export function nextAvailablePeriod(entries = [], periodNumber = 1, periods = DEFAULT_PERIODS) {
  return periods.find((period) => period.index >= Number(periodNumber) && !entries.some((entry) => entry.period === period.index)) || null;
}

export function normalizeRpcError(error) {
  const code = error?.code || error?.message || 'unknown_error';
  const messages = {
    past_interval: 'Choose a future campus-local date and period.',
    room_conflict: 'This room conflicts with another allocation.',
    room_closed: 'This room is closed during the selected interval.',
    timetable_conflict: 'This room is scheduled for teaching during the selected interval.',
    invalid_period: 'The selected period is not configured for this academic calendar.',
  };
  return { code, message: messages[code] || 'The request could not be completed.' };
}

const timetableDomain = { DEFAULT_PERIODS, hasRoomConflict, filterRooms, resolveAcademicDay, facultySchedule, utilizationSummary, explainAvailability, getPeriodInterval, normalizeRpcError };
export default timetableDomain;
