import { supabase } from '../lib/supabase'

const roomFields = 'id,code,name,building,floor,capacity,equipment'
const bookingFields = 'id,room_id,title,purpose,starts_at,ends_at,status,confirmation_code,checked_in_at,user_id'

export async function listRooms() {
  const { data, error } = await supabase.from('rooms').select(roomFields).order('code')
  return { data: data || [], error }
}

export async function listBookings() {
  const { data, error } = await supabase.from('bookings').select(bookingFields).order('starts_at', { ascending: true })
  return { data: data || [], error }
}

export async function reserveRoom({ roomId, userId, title, purpose, startsAt, endsAt, confirmationCode }) {
  return supabase.from('bookings').insert({ room_id: roomId, user_id: userId, title, purpose, starts_at: startsAt, ends_at: endsAt, confirmation_code: confirmationCode }).select().single()
}

export async function cancelReservation(id, userId) {
  return supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id).eq('user_id', userId)
}

export async function checkInReservation(id) {
  return supabase.from('bookings').update({ status: 'checked_in', checked_in_at: new Date().toISOString() }).eq('id', id)
}
