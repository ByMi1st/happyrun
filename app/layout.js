export const metadata = {
  title: 'HappyRun',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body style={{ margin: 0, fontFamily: '-apple-system, sans-serif', background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  );
}
