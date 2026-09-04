import { useState } from "react";

export default function App() {
  const [qty, setQty] = useState(1);
  return (
    <main className="page">
      <h1>Cart</h1>
      <div className="stepper">
        <button onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
        <output>{qty}</output>
        <button onClick={() => setQty(qty + 1)}>+</button>
      </div>
    </main>
  );
}
