/**
 * Returns the current date interpreted in the property's timezone, normalized to UTC midnight.
 * This is crucial for Night Audit to ensure the "Business Date" stays correct regardless of Server execution time.
 */
export function getPropertyBusinessDate(timezone: string = 'Africa/Lagos', date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: timezone, 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  });
  
  // Format returns "YYYY-MM-DD" in the specified timezone
  const formatted = formatter.format(date);
  
  // Create a UTC date representing 00:00:00 of that local day
  const businessDate = new Date(`${formatted}T00:00:00Z`);
  return businessDate;
}

/**
 * Returns the "next" business date (+1 day) from a given business date.
 */
export function getNextBusinessDate(businessDate: Date): Date {
  const nextDate = new Date(businessDate.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate;
}
