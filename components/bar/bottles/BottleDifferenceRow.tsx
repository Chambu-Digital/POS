export function BottleDifferenceRow({ bottle }: { bottle: any }) {
  const diff = bottle.difference ?? 0
  const diffClass = diff < 0 ? 'text-red-500 font-bold' : diff === 0 ? 'text-green-600' : 'text-blue-600'
  
  return (
    <tr className="border-b text-sm">
      <td className="p-2">#{bottle.bottleNumber}</td>
      <td className="p-2">{new Date(bottle.openedAt).toLocaleDateString()}</td>
      <td className="p-2">{bottle.closedAt ? new Date(bottle.closedAt).toLocaleDateString() : 'N/A'}</td>
      <td className="p-2">{bottle.expectedUnits}</td>
      <td className="p-2">{bottle.actualUnitsSold ?? '-'}</td>
      <td className={`p-2 ${diffClass}`}>{bottle.state === 'closed' ? diff : '-'}</td>
    </tr>
  )
}
