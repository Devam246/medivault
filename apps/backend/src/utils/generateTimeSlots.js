/**
 * Generates time slot strings (e.g., '09:00:00') based on start/end times and an interval.
 * @param {string} startTime 'HH:MM'
 * @param {string} endTime 'HH:MM'
 * @param {number} intervalMinutes
 * @returns {string[]}
 */
export function generateTimeSlots(startTime, endTime, intervalMinutes) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  while (currentMinutes + intervalMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    slots.push(timeString);
    currentMinutes += intervalMinutes;
  }
  
  return slots;
}
