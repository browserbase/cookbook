import { useState } from "react";
export default function App() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState("");
  function submit(e: React.FormEvent) { e.preventDefault(); setMsg(email ? "Invite sent" : "Email required"); }
  return <main className="page"><h1>Invite teammate</h1><form onSubmit={submit}><input value={email} onChange={e => setEmail(e.target.value)} placeholder="email" /><button>Send</button></form><p role="status">{msg}</p></main>;
}
