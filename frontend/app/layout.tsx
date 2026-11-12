import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pygmy — OTP por e-mail para todos os seus projetos",
  description:
    "API simples e segura para enviar e validar códigos OTP por e-mail. Teste ao vivo.",
};

export const viewport: Viewport = { themeColor: "#06070d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
