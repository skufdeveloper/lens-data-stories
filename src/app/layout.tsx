import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lens — ваши данные со смыслом",
  description:
    "Превратите таблицу или текст в понятную историю. Инсайты, интерактивные графики и ответы по вашим данным с GigaChat.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
