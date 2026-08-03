"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "SUPER_ADMIN">("USER");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "No se pudo crear el usuario.");
      return;
    }

    setOk(`Cuenta creada: ${data.user?.email}`);
    setName("");
    setEmail("");
    setPassword("");
    setRole("USER");
    void loadUsers();
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E50914]">
              Super Admin
            </p>
            <h1 className="text-3xl font-black">Usuarios</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Crea cuentas. El registro público está desactivado.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-neutral-300 underline-offset-2 hover:underline"
          >
            Volver al inicio
          </Link>
        </div>

        <form
          onSubmit={onSubmit}
          className="mb-10 space-y-4 rounded-lg border border-white/10 bg-black/40 p-5"
        >
          <h2 className="text-lg font-semibold">Crear usuario</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Nombre
              </label>
              <input
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-300">Rol</label>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "USER" | "SUPER_ADMIN")
                }
                className="w-full rounded border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
              >
                <option value="USER">Usuario</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {ok && (
            <p className="rounded bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
              {ok}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded bg-[#E50914] px-5 py-2.5 text-sm font-bold transition hover:bg-[#f6121d] disabled:opacity-60"
          >
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Cuentas existentes</h2>
          {loadingList ? (
            <p className="text-sm text-neutral-400">Cargando…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-neutral-400">No hay usuarios.</p>
          ) : (
            <ul className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-black/30 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-neutral-400">{u.email}</p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      u.role === "SUPER_ADMIN"
                        ? "bg-[#E50914]/20 text-[#ff6b73]"
                        : "bg-white/10 text-neutral-300"
                    }`}
                  >
                    {u.role === "SUPER_ADMIN" ? "Super Admin" : "Usuario"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
