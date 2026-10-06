"use client";

import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import type { SafeLoginItem, VaultProviderStatus } from "../server/vault/types";

type View = "home" | "native" | "onepassword";
const blank = {
  label: "",
  hosts: "",
  username: "",
  password: "",
  totpSecret: "",
  notes: "",
};
export default function VaultStudio() {
  const [view, setView] = useState<View>("home");
  return (
    <div className="vault-studio">
      {view === "home" ? (
        <div className="vault-provider-grid">
          <button className="details-card" onClick={() => setView("native")}>
            <LockKeyhole />
            <span>
              <strong>Native Vault</strong>
              <small>Encrypted local demo provider</small>
            </span>
          </button>
          <button className="details-card" onClick={() => setView("onepassword")}>
            <KeyRound />
            <span>
              <strong>Connect 1Password</strong>
              <small>Server-side SDK integration</small>
            </span>
          </button>
        </div>
      ) : (
        <>
          <button className="back-button" onClick={() => setView("home")}>
            <ArrowLeft size={16} />
            Providers
          </button>
          {view === "native" ? <NativePanel /> : <OnePasswordPanel />}
        </>
      )}
    </div>
  );
}
function NativePanel() {
  const [items, setItems] = useState<SafeLoginItem[]>([]),
    [status, setStatus] = useState<VaultProviderStatus>(),
    [form, setForm] = useState(blank),
    [editing, setEditing] = useState<string>(),
    [error, setError] = useState<string>(),
    [saved, setSaved] = useState(false);
  const load = () =>
    fetch("/api/vault/native", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        setStatus(body.status);
        setItems(body.items ?? []);
        if (body.error) setError(body.error);
      });
  useEffect(() => {
    void load();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const response = await fetch("/api/vault/native", {
      method: editing ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(editing ? { itemId: editing } : {}),
        label: form.label,
        allowedHosts: form.hosts.split(/[\s,]+/),
        username: form.username,
        password: form.password,
        ...(form.totpSecret ? { totpSecret: form.totpSecret } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Unable to save login.");
      return;
    }
    setForm(blank);
    setEditing(undefined);
    setSaved(true);
    await load();
    setTimeout(() => setSaved(false), 1500);
  }
  async function remove(id: string) {
    if (!confirm("Delete this encrypted login record?")) return;
    await fetch(`/api/vault/native?itemId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
  }
  return (
    <div className="workspace-stack">
      <ProviderHead title="Native Vault" status={status} />
      {status?.configured ? (
        <>
          <form className="settings-form" onSubmit={submit}>
            <div className="settings-section">
              <label className="setting-control">
                <span>
                  <strong>Label</strong>
                </span>
                <input
                  required
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </label>
              <label className="setting-control">
                <span>
                  <strong>Allowed hosts</strong>
                  <small>Comma separated</small>
                </span>
                <input
                  required
                  value={form.hosts}
                  onChange={(e) => setForm({ ...form, hosts: e.target.value })}
                />
              </label>
              <label className="setting-control">
                <span>
                  <strong>Username</strong>
                </span>
                <input
                  required
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </label>
              <label className="setting-control">
                <span>
                  <strong>Password</strong>
                  <small>Never shown again</small>
                </span>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
              <label className="setting-control">
                <span>
                  <strong>TOTP secret</strong>
                  <small>Optional; never shown again</small>
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={form.totpSecret}
                  onChange={(e) => setForm({ ...form, totpSecret: e.target.value })}
                />
              </label>
              <label className="setting-control">
                <span>
                  <strong>Notes metadata</strong>
                </span>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            {error && <p className="error-message">{error}</p>}
            <div className="settings-actions">
              <p>
                {saved
                  ? "Saved encrypted login."
                  : editing
                    ? "Replace all secret fields for this record."
                    : "Secrets are encrypted before storage."}
              </p>
              {editing && (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setEditing(undefined);
                    setForm(blank);
                  }}
                >
                  Cancel
                </button>
              )}
              <button className="primary-action">{editing ? "Replace login" : "Save login"}</button>
            </div>
          </form>
          <ItemList
            items={items}
            onEdit={(item) => {
              setEditing(item.itemId);
              setForm({
                ...blank,
                label: item.label,
                hosts: item.allowedHosts.join(", "),
              });
            }}
            onDelete={remove}
          />
        </>
      ) : null}
    </div>
  );
}
function OnePasswordPanel() {
  const [status, setStatus] = useState<VaultProviderStatus>(),
    [items, setItems] = useState<SafeLoginItem[]>([]),
    [error, setError] = useState<string>();
  useEffect(() => {
    fetch("/api/vault/onepassword", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        setStatus(body.status);
        setItems(body.items ?? []);
        setError(body.error);
      });
  }, []);
  return (
    <div className="workspace-stack">
      <ProviderHead title="1Password" status={status} />
      {error && <p className="error-message">{error}</p>}
      {!status?.configured ? (
        <article className="details-card">
          <div>
            <h2>Server setup</h2>
            <p>
              Create a least-privilege service account, grant it access to the Login vault, and set{" "}
              <code>OP_SERVICE_ACCOUNT_TOKEN</code> on the server. For optional local desktop
              approval, set <code>OP_ACCOUNT</code> to the account name and enable SDK integration
              in the 1Password app.
            </p>
          </div>
        </article>
      ) : (
        <ItemList items={items} />
      )}
    </div>
  );
}
function ProviderHead({ title, status }: { title: string; status?: VaultProviderStatus }) {
  return (
    <article className="details-card">
      <ShieldCheck />
      <div>
        <h2>{title}</h2>
        <p>{status?.message ?? "Checking provider…"}</p>
        <strong>
          {status?.healthy
            ? "Connected"
            : status?.configured
              ? "Needs attention"
              : "Not configured"}{" "}
          · {status?.mode ?? "checking"}
        </strong>
      </div>
    </article>
  );
}
function ItemList({
  items,
  onEdit,
  onDelete,
}: {
  items: SafeLoginItem[];
  onEdit?: (item: SafeLoginItem) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="skill-list">
      {items.length ? (
        items.map((item) => (
          <article key={`${item.provider}:${item.vaultId ?? ""}:${item.itemId}`}>
            <KeyRound />
            <div>
              <strong>{item.label}</strong>
              <p>{item.allowedHosts.join(", ") || "No mapped host"}</p>
              <small>
                {item.vaultName ? `Vault ${item.vaultName} · ` : ""}Username{" "}
                {item.fields.username ? "available" : "unknown"} · Password{" "}
                {item.fields.password ? "available" : "unknown"} · TOTP{" "}
                {item.fields.totp ? "available" : "not mapped"}
              </small>
            </div>
            {onEdit && (
              <button className="secondary-action" onClick={() => onEdit(item)}>
                Replace
              </button>
            )}
            {onDelete && (
              <button className="secondary-action" onClick={() => void onDelete(item.itemId)}>
                Delete
              </button>
            )}
          </article>
        ))
      ) : (
        <p>No Login items available.</p>
      )}
    </div>
  );
}
