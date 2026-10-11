import { redirect } from "next/navigation";
import { Wallpaper } from "@/components/glass/wallpaper";
import { Landing } from "@/components/landing/landing";
import { getUser } from "@/lib/session";

export default async function HomePage() {
  if (await getUser()) redirect("/dashboard");
  return (
    <>
      <Wallpaper />
      <Landing />
    </>
  );
}
