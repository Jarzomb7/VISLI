"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: "◈" },
  { label: "Licencje", href: "/admin/licenses", icon: "⬡" },
  { label: "Użytkownicy", href: "/admin/users", icon: "◎" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-white border-r border-gray-100 flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-100">
        <h1 className="text-xl font-bold text-brand-700 tracking-tight">
          VISLI
        </h1>
        <p className="text-[11px] font-medium text-gray-400 tracking-widest uppercase mt-0.5">
          Admin Panel
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-brand-50 text-brand-700 shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all w-full"
        >
          <span className="text-base">⏻</span>
          Wyloguj
        </button>
      </div>
    </aside>
  );
}
