import Link from "next/link";
import { Logo } from "@/components/logo";
import { PlateCalculator } from "@/components/plate-calculator";
import { requireUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { gearFromProfile } from "@/lib/training/profile-gear";
import { logoutAction } from "../(auth)/actions";
import { savePlateSettings } from "./actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { barWeight: true, availablePlates: true },
  });
  const gear = gearFromProfile(profile);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
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
          <NavLinks />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-24 sm:px-6">{children}</div>
      <PlateCalculator initialBar={gear.barWeight} initialPlates={gear.plates} save={savePlateSettings} />
    </div>
  );
}
