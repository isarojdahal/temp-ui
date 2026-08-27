import './globals.css';

export const metadata = {
  title: 'Drishti AI - Climate Assistant & MCVRA Portal',
  description: 'Unified Climate Knowledge RAG & Multi-Criteria Vulnerability Assessment Portal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="h-screen w-screen overflow-hidden bg-[#070a12] text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
