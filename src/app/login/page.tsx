import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-surface-600 bg-surface-800 p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-accent-300">MangaShelf</h1>
            <p className="mt-2 text-sm text-surface-200">
              Sign in to your account
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
