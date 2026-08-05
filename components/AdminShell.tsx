"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  Users,
  UserCircle,
  ArrowLeft,
  Link2,
} from "lucide-react";
import Navbar from "@/components/Navbar";

const nav = [
  { href: "/admin", label: "Usuarios", icon: Users },
  { href: "/admin/streams", label: "Links propios", icon: Link2 },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
  { href: "/cuenta", label: "Mi cuenta", icon: UserCircle },
];

export default function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="app-page">
      <Navbar />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-20 pt-32 md:flex-row md:px-8">
        <aside className="w-full shrink-0 md:w-56">
          <div className="glass-panel sticky top-28 space-y-1 rounded-2xl p-3">
            <div className="mb-3 flex items-center gap-2 px-2 py-1">
              <LayoutDashboard className="h-4 w-4 text-teal-300" />
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Panel admin
              </p>
            </div>
            {nav.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin" ||
                    pathname.startsWith("/admin/usuarios")
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-teal-300 text-[#07111d] shadow-lg shadow-teal-950/30"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/"
              className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a VeoTV
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-8">
            <p className="eyebrow">
              Super Admin
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.045em]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                {subtitle}
              </p>
            )}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
