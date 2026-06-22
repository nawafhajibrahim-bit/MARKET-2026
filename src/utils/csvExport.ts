/**
 * Export an array of objects to a CSV file and trigger a download.
 * @param data Array of plain objects (keys become headers)
 * @param filename e.g. 'sales_2025-06-21.csv'
 */
export function downloadCSV(data: Record<string, unknown>[], filename: string): boolean {
  if (data.length === 0) {
    console.warn('No data to export');
    return false;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    // UTF-8 BOM for Excel compatibility
    '\uFEFF' + headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = String(val ?? '');
        // Escape values that contain commas, quotes, or newlines
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  return true;
}

/**
 * Format a date for filenames: YYYY-MM-DD
 */
export function formatDateForFilename(date = new Date()): string {
  const d = date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
