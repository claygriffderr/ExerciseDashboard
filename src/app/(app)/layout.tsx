import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth/dal";
import { logoutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.displayName}</span>
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink hover:bg-line/40">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
