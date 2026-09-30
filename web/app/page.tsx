"use client";

import { useState } from "react";
import { authClient } from "../lib/auth-client";

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const { data: session, isPending } = authClient.useSession();

  async function signUp() {
    setMessage("");

    const result = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (result.error) {
      setMessage(
        result.error.message || "Erreur lors de la création du compte.",
      );
      return;
    }

    setMessage("Compte créé avec succès.");
  }

  async function signIn() {
    setMessage("");

    const result = await authClient.signIn.email({
      email,
      password,
    });

    if (result.error) {
      setMessage(
        result.error.message || "Erreur lors de la connexion.",
      );
      return;
    }

    setMessage("Connexion réussie.");
  }

  async function signInWithGoogle() {
    setMessage("");

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "http://localhost:3000/",
    });

    if (result.error) {
      setMessage(
        result.error.message ||
          "Erreur lors de la connexion avec Google.",
      );
    }
  }

  async function signOut() {
    setMessage("");

    const result = await authClient.signOut();

    if (result.error) {
      setMessage(
        result.error.message || "Erreur lors de la déconnexion.",
      );
      return;
    }

    setMessage("Déconnexion réussie.");
  }

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
          Chargement...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12 text-white">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-bold text-black">
            O
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            OpenBot
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Authentication test
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/20">
          {session ? (
            <div>
              {/* Connected */}
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  ✓
                </div>

                <div>
                  <p className="text-sm font-medium text-emerald-400">
                    Connecté
                  </p>

                  <p className="text-xs text-zinc-500">
                    Session Better Auth active
                  </p>
                </div>
              </div>

              {/* User information */}
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Nom
                  </p>

                  <p className="text-sm text-zinc-200">
                    {session.user.name || "Non renseigné"}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Email
                  </p>

                  <p className="text-sm text-zinc-200">
                    {session.user.email}
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    User ID
                  </p>

                  <p className="break-all rounded-lg bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-500">
                    {session.user.id}
                  </p>
                </div>
              </div>

              {/* Logout */}
              <button
                type="button"
                onClick={signOut}
                className="mt-6 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Se déconnecter
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-medium">
                  Bienvenue
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Connecte-toi pour continuer.
                </p>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={signInWithGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-100"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M21.35 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.95 2.94v2.45h3.16c1.85-1.7 2.9-4.2 2.9-7.42Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 21.5c2.65 0 4.87-.88 6.49-2.38l-3.16-2.45c-.88.59-2.01.94-3.33.94-2.56 0-4.73-1.73-5.51-4.06H3.22V16.1A9.8 9.8 0 0 0 12 21.5Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.49 13.55a5.9 5.9 0 0 1 0-3.1V8H3.22a9.5 9.5 0 0 0 0 8.98l3.27-2.53Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 6.39c1.44 0 2.73.5 3.75 1.48l2.81-2.81C16.87 3.45 14.65 2.5 12 2.5a9.8 9.8 0 0 0-8.78 5.5l3.27 2.45C7.27 8.12 9.44 6.39 12 6.39Z"
                  />
                </svg>

                Continuer avec Google
              </button>

              {/* Divider */}
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-zinc-800" />

                <span className="text-xs text-zinc-600">
                  OU
                </span>

                <div className="h-px flex-1 bg-zinc-800" />
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Nom
                  </label>

                  <input
                    type="text"
                    placeholder="Ton nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Email
                  </label>

                  <input
                    type="email"
                    placeholder="toi@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Mot de passe
                  </label>

                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={signUp}
                    className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                  >
                    Créer un compte
                  </button>

                  <button
                    type="button"
                    onClick={signIn}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700"
                  >
                    Se connecter
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-400">
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          OpenBot authentication · Better Auth + Hono + PostgreSQL
        </p>
      </div>
    </main>
  );
}