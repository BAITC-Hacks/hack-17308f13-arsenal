import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Аким на 5 часов",
  description:
    "Пять мероприятий для лучшего города. Симулятор на синтетических данных.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
