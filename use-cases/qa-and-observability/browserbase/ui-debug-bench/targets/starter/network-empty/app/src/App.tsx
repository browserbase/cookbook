const response: { metrics?: Array<{ name: string; value: number }> } = {};
export default function App() {
  return <main className="page"><h1>Metrics</h1><ul>{response.metrics!.map(m => <li key={m.name}>{m.name}: {m.value}</li>)}</ul></main>;
}
