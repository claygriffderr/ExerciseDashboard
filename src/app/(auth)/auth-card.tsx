import Link from "next/link";
import { Logo } from "@/components/logo";
import { InsecureContextWarning } from "@/components/insecure-context-warning";
import { secureCookies } from "@/lib/config";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 mb-6 text-muted">{subtitle}</p>
          <InsecureContextWarning secureCookies={secureCookies()} />
          {children}
        </div>
      </div>
    </main>
  );
}
