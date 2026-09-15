import "./globals.css";

export const metadata = {
  title: "Client Ops Dashboard — Sharp Ahead",
  description: "Media spend pacing, KPI tracking and retainer hours in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
