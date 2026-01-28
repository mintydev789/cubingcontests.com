import "bootstrap/dist/css/bootstrap.css";
import "~/app/globals.css";
import MainLayout from "~/app/components/UI/MainLayout.tsx";
// Prevent server-side rendering bug with FA icons, where the icons flash as very large before full page load
import "@fortawesome/fontawesome-svg-core/styles.css";
// Prevent FA from adding its CSS since we did it manually above
import { config } from "@fortawesome/fontawesome-svg-core";
import { headers } from "next/headers";
import { auth } from "~/server/auth.ts";

config.autoAddCss = false;

export const metadata = {
  title: "Cubing Contests",
  description: "The best place for hosting unofficial Rubik's Cube competitions and speedcuber meetups.",
  keywords:
    "rubik's rubiks cube contest contests competition competitions meetup meetups speedcubing speed cubing puzzle",
  icons: { icon: "/favicon.png" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL!),
  openGraph: {
    images: ["/screenshots/cubing_contests_1.jpg"],
  },
};

type Props = {
  children: React.ReactNode;
};

export default async function RootLayout({ children }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <html lang="en">
      <MainLayout initSession={session}>{children}</MainLayout>
    </html>
  );
}
