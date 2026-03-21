function parseDate(dateStr) {
  if (!dateStr) return null;
  // Try ISO
  let d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  // Try DD-MM-YYYY
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD-MM-YYYY or DD-MMM-YYYY
      const month = isNaN(parts[1]) ? parts[1] : parseInt(parts[1]) - 1;
      d = new Date(parts[2], month, parts[0]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

console.log(parseDate('1-Sep-2025'));
console.log(parseDate('21-01-2026'));
console.log(parseDate('2026-03-03T23:05:41.041Z'));
