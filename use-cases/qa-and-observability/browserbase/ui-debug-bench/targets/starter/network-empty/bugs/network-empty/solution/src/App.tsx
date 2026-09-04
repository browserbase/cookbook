const response: { metrics?: Array<{ name: string; value: number }> } = {};

export default function App() {
  const metrics = response.metrics ?? [];
  return <main className="page"><h1>Metrics</h1>{metrics.length === 0 ? <p>No metrics yet</p> : <ul>{metrics.map(m => <li key={m.name}>{m.name}: {m.value}</li>)}</ul>}</main>;
}
