// The page is a client component, which can't set its own title.
export const metadata = { title: "New client" };

export default function NewClientLayout({ children }: { children: React.ReactNode }) {
  return children;
}
