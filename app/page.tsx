 "use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAdmin } from "./providers";

export default function Home() {
  const { isAdmin, loginWithPin, logout } = useAdmin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const ok = loginWithPin(pin.trim());
    if (!ok) {
      setError("Incorrect PIN. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-900 px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-3xl bg-white/95 p-6 shadow-lg">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-emerald-600">
            Custom Golf Event
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Event Control
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Guests can view the live leaderboard. Admins manage groups & scores.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/event"
            className="flex w-full items-center justify-center rounded-2xl bg-emerald-600 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:bg-emerald-800"
          >
            View Event (Guest)
          </Link>

          <div className="relative my-4 flex items-center">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Admin
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {isAdmin ? (
            <div className="space-y-3 rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-600">
                Logged in as admin
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/admin"
                  className="flex items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-700"
                >
                  Go to Admin
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center justify-center rounded-xl border border-emerald-200 bg-white py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 hover:bg-emerald-50"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                Admin PIN
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 4–6 digit PIN"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              {error && (
                <p className="text-xs font-medium text-rose-600">{error}</p>
              )}
              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-800 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
          >
                Admin Login
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-slate-400">
          Optimized for mobile – add to home screen for a full-screen
          experience.
        </p>
      </div>
    </div>
  );
}

