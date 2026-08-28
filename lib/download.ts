/** Triggers a browser download of `csvText` as a file named `filename`.
 *
 * Two details matter here: the anchor is appended to the document before
 * click() (some browsers ignore synthetic clicks on detached anchors), and
 * the object URL is revoked on a delay — revoking in the same tick as
 * click() can abort the download before the browser has opened the blob.
 */
export function downloadCsv(csvText: string, filename: string): void {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
