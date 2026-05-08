export const metadata = {
  title: 'HappyRun',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif", background: '#F2F2F7', WebkitFontSmoothing: 'antialiased' }}>
        {children}
      </body>
    </html>
  );
}
