/** A side-by-side table. Plain server markup so every cell is in the HTML for search engines;
 * it scrolls sideways inside its wrapper on a narrow screen instead of squashing. */
export function ComparisonTable({
  columns,
  rows,
}: {
  columns: readonly [string, string, string];
  rows: readonly (readonly [string, string, string])[];
}) {
  return (
    <div className="overflow-x-auto">
      <table style={{ minWidth: 640 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([aspect, a, b]) => (
            <tr key={aspect}>
              <td>
                <strong>{aspect}</strong>
              </td>
              <td>{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
