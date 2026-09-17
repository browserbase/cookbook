import { useState } from "react";

export default function App() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.value ?? email;
    setMsg(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Invite sent" : "Enter a valid email address");
  }
  return <main className="page"><h1>Invite teammate</h1><form onSubmit={submit}><input value={email} onInput={e => setEmail(e.currentTarget.value)} placeholder="email" /><button>Send</button></form><p role="status">{msg}</p></main>;
}
