export const metadata = { title: "Welcome to AutoScale" };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-background to-secondary/20">{children}</div>;
}
